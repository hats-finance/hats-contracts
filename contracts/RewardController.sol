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

    uint256 internal constant REWARD_PRECISION = 1e12;
    uint256 public constant NUMBER_OF_EPOCHS = 24;

    // Block from which the contract will start rewarding.
    uint256 public startBlock;
    uint256 public epochLength;
    // the ERC20 contract in which rewards are distributed
    IERC20Upgradeable internal rewardToken;
    // amount of tokens rewarded in each block, per epoch
    uint256[24] public epochRewardPerBlock;
    VaultUpdate[] public globalVaultsUpdates;
    mapping(address => VaultInfo) public vaultInfo;
    // vault address => user address => reward debt amount
    mapping(address => mapping(address => uint256)) public rewardDebt;
    // vault address => user address => unclaimed reward amount
    mapping(address => mapping(address => uint256)) public unclaimedReward; //@audit-info can't group structs or tests die

    /** @notice See {IRewardController-initialize}. */
    function initialize(
        address _rewardToken,
        address _hatsGovernance,
        uint256 _startRewardingBlock,
        uint256 _epochLength,
        uint256[24] calldata _epochRewardPerBlock
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
        uint256 _startBlock = startBlock;

        if (lastRewardBlock == 0) {
            vault.lastRewardBlock = block.number >= _startBlock ? block.number : _startBlock;
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

        uint256 length = globalVaultsUpdates.length;
        if (length != 0) {
            unchecked { vault.lastProcessedVaultUpdate = length - 1; }
        }
    }

    /** @notice See {IRewardController-setEpochRewardPerBlock}. */
    function setEpochRewardPerBlock(uint256[24] calldata _epochRewardPerBlock) external onlyOwner {
        // if rewards have not started yet, update the full list
        uint256 _startBlock = startBlock;
        if (block.number < _startBlock) {
            epochRewardPerBlock = _epochRewardPerBlock;
            emit SetEpochRewardPerBlock(_epochRewardPerBlock);
        }  else {
            unchecked { 
                uint256 nextEpoch = (block.number - _startBlock) / epochLength + 1;
                // if rewards are ongoing, update the future rewards but keep past and current
                for (; nextEpoch < NUMBER_OF_EPOCHS; ++nextEpoch) {
                    epochRewardPerBlock[nextEpoch] = _epochRewardPerBlock[nextEpoch];
                }
            }
            emit SetEpochRewardPerBlock(epochRewardPerBlock);
        }
    }

    function _setAllocPoint(address _vault, uint256 _allocPoint) internal {
        updateVault(_vault);

        uint256 len = globalVaultsUpdates.length;
        VaultInfo storage vault = vaultInfo[_vault];
        uint256 totalAllocPoint;
        bool isAllocated;
        
        if (len > 0){
            VaultUpdate storage vaultUpdate = globalVaultsUpdates[len-1];
            totalAllocPoint = vaultUpdate.totalAllocPoint - vault.allocPoint + _allocPoint;
            if(vaultUpdate.blockNumber == block.number) {
                // already update in this block
                vaultUpdate.totalAllocPoint = totalAllocPoint;
                isAllocated = true;
            }
        } else {
            totalAllocPoint = _allocPoint;
        }
        
        if (!isAllocated) {
            globalVaultsUpdates.push(VaultUpdate({
                blockNumber: block.number,
                totalAllocPoint: totalAllocPoint
            }));
        }

        vault.allocPoint = _allocPoint;
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
        mapping(address => uint256) storage vaultRewardDebt = rewardDebt[_vault];
        if (userShares != 0) {
            unclaimedReward[_vault][_user] += userShares * rewardPerShare / REWARD_PRECISION - vaultRewardDebt[_user];
        }

        if (_sharesChange != 0) {
            if (_isDeposit) {
                userShares += _sharesChange;
            } else {
                userShares -= _sharesChange;
            }
        }
        vaultRewardDebt[_user] = userShares * rewardPerShare / REWARD_PRECISION;
    }

    /** @notice See {IRewardController-commitUserBalance}. */
    function commitUserBalance(address _user, uint256 _sharesChange, bool _isDeposit) external {
        _commitUserBalance(msg.sender, _user, _sharesChange, _isDeposit);
    }

    /** @notice See {IRewardController-claimReward}. */
    function claimReward(address _vault, address _user) external {
        _commitUserBalance(_vault, _user, 0, true);
        mapping(address => uint256) storage vaultUnclaimedReward = unclaimedReward[_vault];
        uint256 userUnclaimedReward = vaultUnclaimedReward[_user];
        if (userUnclaimedReward > 0) {
            vaultUnclaimedReward[_user] = 0;
            rewardToken.safeTransfer(_user, userUnclaimedReward);
        }

        emit ClaimReward(_vault, _user, userUnclaimedReward);
    }

    /** @notice See {IRewardController-getVaultReward}. */
    function getVaultReward(address _vault, uint256 _fromBlock) public view returns(uint256 reward) {
        if (globalVaultsUpdates.length == 0) {
            return 0;
        }
        VaultInfo storage _vaultInfo =  vaultInfo[_vault];
        uint256 vaultAllocPoint = _vaultInfo.allocPoint;
        uint256 i = _vaultInfo.lastProcessedVaultUpdate;
        uint256 len;
        unchecked {
            len = globalVaultsUpdates.length-1;
        }    
        for (; i < len;) { //@audit-info for whatever reason, caching the length is more expensive by 200 gas
            uint256 nextUpdateBlock;
            unchecked {
                nextUpdateBlock = globalVaultsUpdates[i+1].blockNumber;
            }
            reward += getRewardForBlocksRange(_fromBlock,
                                            nextUpdateBlock,
                                            vaultAllocPoint,
                                            globalVaultsUpdates[i].totalAllocPoint);
            _fromBlock = nextUpdateBlock;
            unchecked { ++i; }
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
        uint256 _startBlock = startBlock;
        uint256 _epochLength = epochLength;
        if ((_fromBlock >= _startBlock && _toBlock >= _fromBlock) && _totalAllocPoint > 0) {
            uint256 result;
            uint256 i;
            unchecked {
                i = (_fromBlock - _startBlock) / _epochLength + 1;
            }
            uint256 epochReward;
            for (; i <= NUMBER_OF_EPOCHS;) {
                uint256 endBlock = _epochLength * i + _startBlock;
                if (_toBlock <= endBlock) {
                    break;
                }
                unchecked {
                    epochReward = epochRewardPerBlock[i-1];
                }
                result += (endBlock - _fromBlock) * epochReward;
                _fromBlock = endBlock;
                unchecked { ++i; }
            }
            uint256 blockDifference;
            unchecked {
                epochReward = i > NUMBER_OF_EPOCHS ? 0 : epochRewardPerBlock[i-1];
                blockDifference = _toBlock - _fromBlock;
            }
            result += blockDifference * epochReward;
            reward = result * _allocPoint / _totalAllocPoint;
        }
    }

    /** @notice See {IRewardController-getPendingReward}. */
    function getPendingReward(address _vault, address _user) external view returns (uint256) {
        mapping(address => uint256) storage vaultUnclaimedReward = unclaimedReward[_vault];

        if (IHATVault(_vault).rewardControllerRemoved(address(this))) {
            return vaultUnclaimedReward[_user];
        }
        VaultInfo storage vault = vaultInfo[_vault];
        uint256 rewardPerShare = vault.rewardPerShare;
        uint256 totalShares = IERC20Upgradeable(_vault).totalSupply();

        if (totalShares > 0 && vault.lastRewardBlock != 0 && block.number > vault.lastRewardBlock) {
            uint256 reward = getVaultReward(_vault, vault.lastRewardBlock);
            rewardPerShare += (reward * REWARD_PRECISION / totalShares);
        }

        return IERC20Upgradeable(_vault).balanceOf(_user) * rewardPerShare / REWARD_PRECISION + 
                vaultUnclaimedReward[_user] -
                rewardDebt[_vault][_user];
    }

    /** @notice See {IRewardController-sweepToken}. */
    function sweepToken(IERC20Upgradeable _token, uint256 _amount) external onlyOwner {
        _token.safeTransfer(msg.sender, _amount);
    }

    function getGlobalVaultsUpdatesLength() external view returns (uint256) {
        return globalVaultsUpdates.length;
    }

}
