// SPDX-License-Identifier: MIT
// Disclaimer https://github.com/hats-finance/hats-contracts/blob/main/DISCLAIMER.md

pragma solidity 0.8.16;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "./interfaces/IHATVault.sol";
import "./interfaces/IRewardController.sol";



contract RewardController is IRewardController, OwnableUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    struct VaultInfo {
        uint256 rewardPerShare;
        uint256 lastProcessedVaultUpdate;
        uint256 lastRewardBlock;
        uint256 allocPoint;
    }

    struct VaultUpdate {
        uint256 blockNumber;// update blocknumber
        uint256 totalAllocPoint; //totalAllocPoint
    }
    struct UserInfo {
        uint256 rewardDebt;// update blocknumber
        uint256 unclaimedReward; //totalAllocPoint
    }

    uint256 public constant REWARD_PRECISION = 1e12;
    uint256 public constant NUMBER_OF_EPOCHS = 24;

    // Block from which the contract will start rewarding.
    uint256 public startBlock;
    uint256 public epochLength;
    // the ERC20 contract in which rewards are distributed
    IERC20Upgradeable public rewardToken;
    // amount of tokens rewarded in each block, per epoch
    uint256[24] public epochRewardPerBlock;
    VaultUpdate[] public globalVaultsUpdates;
    mapping(address => VaultInfo) public vaultInfo;

    mapping(address => mapping(address => UserInfo)) private userInfo;

    function rewardDebt(address _vault, address _user) public view returns(uint256) {
        return userInfo[_vault][_user].rewardDebt;
    }

    function unclaimedReward(address _vault, address _user) public view returns(uint256) {
        return userInfo[_vault][_user].unclaimedReward;
    }
    
    /** @notice See {IRewardController-initialize}. */
    function initialize(
        address _rewardToken,
        address _hatsGovernance,
        uint256 _startRewardingBlock,
        uint256 _epochLength,
        uint256[24] memory _epochRewardPerBlock
    ) external initializer {
        if (_epochLength == 0) revert EpochLengthZero();
        rewardToken = IERC20Upgradeable(_rewardToken);
        startBlock = _startRewardingBlock;
        epochLength = _epochLength;
        epochRewardPerBlock = _epochRewardPerBlock;
        _transferOwnership(_hatsGovernance);
    }

    /** @notice See {IRewardController-setAllocPoint}. */
    function setAllocPoint(address _vault, uint256 _allocPoint) external onlyOwner {        
        _setAllocPoint(_vault, _allocPoint);
    }

    /** @notice See {IRewardController-updateVault}. */
    function updateVault(address _vault) public {
        VaultInfo storage vault = vaultInfo[_vault];
        uint256 lastRewardBlock = vault.lastRewardBlock;
        if (lastRewardBlock == 0) {
            uint256 sb = startBlock;
            vaultInfo[_vault].lastRewardBlock = block.number > sb ? block.number : sb;
            return;
        }
        if (block.number <= lastRewardBlock) {
            return;
        }

        vault.lastRewardBlock = block.number;

        uint256 totalShares = IERC20Upgradeable(_vault).totalSupply();

        if (totalShares != 0) {
            uint256 reward = getVaultReward(_vault, lastRewardBlock);
            vault.rewardPerShare += (reward * REWARD_PRECISION / totalShares);
        }
        uint256 len = globalVaultsUpdates.length;
        if (len != 0) {
            unchecked {
                vaultInfo[_vault].lastProcessedVaultUpdate = len - 1;
            }
        }
    }

    /** @notice See {IRewardController-setEpochRewardPerBlock}. */
    function setEpochRewardPerBlock(uint256[24] memory _epochRewardPerBlock) external onlyOwner {
        // if rewards have not started yet, update the full list
        if (block.number < startBlock) {
            epochRewardPerBlock = _epochRewardPerBlock;
            emit SetEpochRewardPerBlock(_epochRewardPerBlock);
        }  else {
            uint256 nextEpoch;
            unchecked {
                nextEpoch = (block.number - startBlock) / epochLength + 1;        
            }
            // if rewards are ongoing, update the future rewards but keep past and current
            for (; nextEpoch < NUMBER_OF_EPOCHS; ) {
                epochRewardPerBlock[nextEpoch] = _epochRewardPerBlock[nextEpoch];
                unchecked {
                    ++nextEpoch;
                }
            }
            emit SetEpochRewardPerBlock(epochRewardPerBlock);
        }
        
    }

    function _setAllocPoint(address _vault, uint256 _allocPoint) internal {
        updateVault(_vault);
        uint256 len = globalVaultsUpdates.length;
        uint256 totalAllocPoint = (len == 0) ? _allocPoint :
        globalVaultsUpdates[len-1].totalAllocPoint - vaultInfo[_vault].allocPoint + _allocPoint;
        if (len > 0 &&
            globalVaultsUpdates[len-1].blockNumber == block.number) {
            // already update in this block
            globalVaultsUpdates[len-1].totalAllocPoint = totalAllocPoint;
        } else {
            globalVaultsUpdates.push(VaultUpdate({
                blockNumber: block.number,
                totalAllocPoint: totalAllocPoint
            }));
        }

        vaultInfo[_vault].allocPoint = _allocPoint;
    }

    function _commitUserBalance(
        address _vault,
        address _user,
        uint256 _sharesChange,
        bool _isDeposit
    ) internal {
        if (IHATVault(_vault).rewardControllerRemoved(address(this))) {
            return;
        }
        updateVault(_vault);

        uint256 userShares = IERC20Upgradeable(_vault).balanceOf(_user);
        uint256 rewardPerShare = vaultInfo[_vault].rewardPerShare;
        UserInfo storage info = userInfo[_vault][_user];
        if (userShares != 0) {
            info.unclaimedReward += userShares * rewardPerShare / REWARD_PRECISION - info.rewardDebt;
        }

        if (_sharesChange != 0) {
            if (_isDeposit) {
                userShares += _sharesChange;
            } else {
                userShares -= _sharesChange;
            }
        }

        unchecked {  //@audit wouldnt overflow because of above not overflowing
            info.rewardDebt = userShares * rewardPerShare / REWARD_PRECISION;
        }
        
    }

    /** @notice See {IRewardController-commitUserBalance}. */
    function commitUserBalance(address _user, uint256 _sharesChange, bool _isDeposit) external {
        _commitUserBalance(msg.sender, _user, _sharesChange, _isDeposit);
    }

    /** @notice See {IRewardController-claimReward}. */
    function claimReward(address _vault, address _user) external {
        _commitUserBalance(_vault, _user, 0, true);

        uint256 userUnclaimedReward = userInfo[_vault][_user].unclaimedReward;
        if (userUnclaimedReward > 0) {
            userInfo[_vault][_user].unclaimedReward = 0;
            rewardToken.safeTransfer(_user, userUnclaimedReward);
        }

        emit ClaimReward(_vault, _user, userUnclaimedReward);
    }

    /** @notice See {IRewardController-getVaultReward}. */
    function getVaultReward(address _vault, uint256 _fromBlock) public view returns(uint256 reward) {
        if (globalVaultsUpdates.length == 0) {
            return 0;
        }
        uint256 vaultAllocPoint = vaultInfo[_vault].allocPoint;
        uint256 i = vaultInfo[_vault].lastProcessedVaultUpdate;
        for (; i < globalVaultsUpdates.length-1; ) {
            uint256 nextUpdateBlock = globalVaultsUpdates[i+1].blockNumber;
            reward += getRewardForBlocksRange(_fromBlock,
                                            nextUpdateBlock,
                                            vaultAllocPoint,
                                            globalVaultsUpdates[i].totalAllocPoint);
            _fromBlock = nextUpdateBlock;
            unchecked {
                ++i;
            }
        }
        return reward + getRewardForBlocksRange(_fromBlock,
                                                block.number,
                                                vaultAllocPoint,
                                                globalVaultsUpdates[i].totalAllocPoint);
    }

    function getRewardForBlocksRange(uint256 _fromBlock, uint256 _toBlock, uint256 _allocPoint, uint256 _totalAllocPoint)
    public
    view
    returns (uint256 reward) {
        uint256 sb = startBlock;
        uint256 eL = epochLength;
        if ((_fromBlock >= sb && _toBlock >= _fromBlock) && _totalAllocPoint > 0) {
            uint256 result;
            uint256 i;
            unchecked {
                i = (_fromBlock - sb) / eL + 1;
            }
            for (; i <= NUMBER_OF_EPOCHS; ) {
                uint256 endBlock = eL * i + sb;
                if (_toBlock <= endBlock) {
                    break;
                }
                result += (endBlock - _fromBlock) * epochRewardPerBlock[i-1];
                _fromBlock = endBlock;
                unchecked {
                    ++i;
                }
            }
            result += (_toBlock - _fromBlock) * (i > NUMBER_OF_EPOCHS ? 0 : epochRewardPerBlock[i-1]);
            reward = result * _allocPoint / _totalAllocPoint;
        }
    }

    /** @notice See {IRewardController-getPendingReward}. */
    function getPendingReward(address _vault, address _user) external view returns (uint256) {
        if (IHATVault(_vault).rewardControllerRemoved(address(this))) {
            return userInfo[_vault][_user].unclaimedReward;
        }
        uint256 lastRewardBlock = vaultInfo[_vault].lastRewardBlock;
        uint256 rewardPerShare = vaultInfo[_vault].rewardPerShare;
        uint256 totalShares = IERC20Upgradeable(_vault).totalSupply();

        if (lastRewardBlock != 0 && block.number > lastRewardBlock && totalShares > 0) {
            uint256 reward = getVaultReward(_vault, lastRewardBlock);
            rewardPerShare += (reward * REWARD_PRECISION / totalShares);
        }
        UserInfo memory info = userInfo[_vault][_user];
        return IERC20Upgradeable(_vault).balanceOf(_user) * rewardPerShare / REWARD_PRECISION + 
                info.unclaimedReward - info.rewardDebt;
    }

    /** @notice See {IRewardController-sweepToken}. */
    function sweepToken(IERC20Upgradeable _token, uint256 _amount) external onlyOwner {
        _token.safeTransfer(msg.sender, _amount);
    }

    function getGlobalVaultsUpdatesLength() external view returns (uint256) {
        return globalVaultsUpdates.length;
    }

}
