// SPDX-License-Identifier: MIT
// Disclaimer https://github.com/hats-finance/hats-contracts/blob/main/DISCLAIMER.md

pragma solidity 0.8.14;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "./interfaces/IRewardController.sol";
import "./HATVault.sol";

contract RewardController is IRewardController, OwnableUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    // Not enough rewards to transfer to user
    error NotEnoughRewardsToTransferToUser();

    struct VaultInfo {
        uint256 rewardPerShare;
        uint256 lastProcessedTotalAllocPoint;
        uint256 lastRewardBlock;
        uint256 allocPoint;
    }

    struct VaultUpdate {
        uint256 blockNumber;// update blocknumber
        uint256 totalAllocPoint; //totalAllocPoint
    }

    uint256 public constant MULTIPLIERS_LENGTH = 24;

    // Block from which the vaults contract will start rewarding.
    uint256 public startBlock;
    uint256 public epochLength;
    // the ERC20 contract in which rewards are distributed
    IERC20Upgradeable public rewardToken;
    // Reward Multipliers
    uint256[24] public rewardPerEpoch;
    VaultUpdate[] public globalVaultsUpdates;
    mapping(address => VaultInfo) public vaultInfo;
    // vault address => user address => reward debt amount
    mapping(address => mapping(address => uint256)) public rewardDebt;

    event SetRewardPerEpoch(uint256[24] _rewardPerEpoch);
    event SafeTransferReward(
        address indexed user,
        address indexed vault,
        uint256 amount,
        address rewardToken
    );
    event ClaimReward(address indexed _vault);

    function initialize(
        address _rewardToken,
        address _hatGovernance,
        uint256 _startRewardingBlock,
        uint256 _epochLength,
        uint256[24] memory _rewardPerEpoch
    ) external initializer {
        rewardToken = IERC20Upgradeable(_rewardToken);
        startBlock = _startRewardingBlock;
        epochLength = _epochLength;
        rewardPerEpoch = _rewardPerEpoch;
        _transferOwnership(_hatGovernance);
    }

    function setAllocPoint(address _vault, uint256 _allocPoint) external onlyOwner {
        if (vaultInfo[_vault].lastRewardBlock == 0) {
            vaultInfo[_vault].lastRewardBlock = block.number > startBlock ? block.number : startBlock;
        }
        updateVault(_vault);
        uint256 totalAllocPoint = (globalVaultsUpdates.length == 0) ? _allocPoint :
        globalVaultsUpdates[globalVaultsUpdates.length-1].totalAllocPoint - vaultInfo[_vault].allocPoint + _allocPoint;
        if (globalVaultsUpdates.length > 0 &&
            globalVaultsUpdates[globalVaultsUpdates.length-1].blockNumber == block.number) {
            // already update in this block
            globalVaultsUpdates[globalVaultsUpdates.length-1].totalAllocPoint = totalAllocPoint;
        } else {
            globalVaultsUpdates.push(VaultUpdate({
                blockNumber: block.number,
                totalAllocPoint: totalAllocPoint
            }));
        }

        vaultInfo[_vault].allocPoint = _allocPoint;
    }

    /**
    * @notice Safe HAT transfer function, transfer rewards from the contract only if there are enough
    * rewards available.
    * @param _to The address to transfer the reward to
    * @param _amount The amount of rewards to transfer
    * @param _vault The vault address
   */
    function safeTransferReward(address _to, uint256 _amount, address _vault) internal {
        if (rewardToken.balanceOf(address(this)) < _amount)
            revert NotEnoughRewardsToTransferToUser();
            
        rewardToken.safeTransfer(_to, _amount);

        emit SafeTransferReward(_to, _vault, _amount, address(rewardToken));
    }

    /**
    * @notice Update the vault's rewardPerShare, not more then once per block
    * @param _vault The vault's address
    */
    function updateVault(address _vault) public {
        VaultInfo storage vault = vaultInfo[_vault];
        uint256 lastRewardBlock = vault.lastRewardBlock;
        if (block.number <= lastRewardBlock) {
            return;
        }

        vault.lastRewardBlock = block.number;

        uint256 totalShares = getTotalShares(_vault);

        if (totalShares != 0) {
            uint256 reward = getVaultReward(_vault, lastRewardBlock);
            vault.rewardPerShare += (reward * 1e12 / totalShares);
        }

        vaultInfo[_vault].lastProcessedTotalAllocPoint = globalVaultsUpdates.length - 1;
    }

    /**
     * @notice Called by owner to set reward multipliers
     * @param _rewardPerEpoch reward multipliers
    */
    function setRewardPerEpoch(uint256[24] memory _rewardPerEpoch) external onlyOwner {
        rewardPerEpoch = _rewardPerEpoch;
        emit SetRewardPerEpoch(_rewardPerEpoch);
    }

    function _updateVaultBalance(
        address _vault,
        address _user,
        uint256 _sharesChange,
        bool _isDeposit,
        bool _claimReward
    ) internal {
        updateVault(_vault);

        uint256 userShares = getShares(_vault, _user);
        uint256 rewardPerShare = vaultInfo[_vault].rewardPerShare;
        uint256 pending = userShares * rewardPerShare / 1e12 - rewardDebt[_vault][_user];
        if (_sharesChange != 0) {
            if (_isDeposit) {
                userShares += _sharesChange;
            } else {
                userShares -= _sharesChange;
            }
        }
        rewardDebt[_vault][_user] = userShares * rewardPerShare / 1e12;
        if (pending > 0 && _claimReward) {
            safeTransferReward(_user, pending, _vault);
        }
    }

    function updateVaultBalance(
        address _user,
        uint256 _sharesChange,
        bool _isDeposit,
        bool _claimReward
    ) external {
        _updateVaultBalance(msg.sender, _user, _sharesChange, _isDeposit, _claimReward);
    }

    /**
     * @notice Transfer to the sender their pending share of rewards.
     * @param _vault The vault address
     */
    function claimReward(address _vault) external {
        _updateVaultBalance(_vault, msg.sender, 0, true, true);

        emit ClaimReward(_vault);
    }

     /**
    * @notice Calculate rewards for a vault by iterating over the history of totalAllocPoints updates,
    * and sum up all rewards periods from vault.lastRewardBlock until current block number.
    * @param _vault The vault address
    * @param _fromBlock The block from which to start calculation
    * @return reward
    */
    function getVaultReward(address _vault, uint256 _fromBlock) public view returns(uint256 reward) {
        uint256 vaultAllocPoint = vaultInfo[_vault].allocPoint;
        uint256 i = vaultInfo[_vault].lastProcessedTotalAllocPoint;
        for (; i < globalVaultsUpdates.length-1; i++) {
            uint256 nextUpdateBlock = globalVaultsUpdates[i+1].blockNumber;
            reward =
            reward + getRewardForBlocksRange(_fromBlock,
                                            nextUpdateBlock,
                                            vaultAllocPoint,
                                            globalVaultsUpdates[i].totalAllocPoint);
            _fromBlock = nextUpdateBlock;
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
        if (_totalAllocPoint > 0) {
            uint256 result;
            uint256 i = (_fromBlock - startBlock) / epochLength + 1;
            for (; i <= MULTIPLIERS_LENGTH; i++) {
                uint256 endBlock = epochLength * i + startBlock;
                if (_toBlock <= endBlock) {
                    break;
                }
                result += (endBlock - _fromBlock) * rewardPerEpoch[i-1];
                _fromBlock = endBlock;
            }
            result += (_toBlock - _fromBlock) * (i > MULTIPLIERS_LENGTH ? 0 : rewardPerEpoch[i-1]);
            reward = result * _allocPoint / _totalAllocPoint / 100;
        }
    }

    /**
     * @notice calculate the amount of rewards an account can claim for having contributed to a specific vault
     * @param _vault the vault address
     * @param _user the account for which the reward is calculated
    */
    function getPendingReward(address _vault, address _user) external view returns (uint256) {
        VaultInfo memory vault = vaultInfo[_vault];
        uint256 rewardPerShare = vault.rewardPerShare;
        uint256 totalShares = getTotalShares(_vault);

        if (block.number > vault.lastRewardBlock && totalShares > 0) {
            uint256 reward = getVaultReward(_vault, vault.lastRewardBlock);
            rewardPerShare += (reward * 1e12 / totalShares);
        }

        return getShares(_vault, _user) * rewardPerShare / 1e12 - rewardDebt[_vault][_user];
    }

    function getTotalShares(address _vault) public view returns (uint256) {
        return HATVault(_vault).totalSupply();
    }

    function getShares(address _vault, address _user) public view returns (uint256) {
        return HATVault(_vault).balanceOf(_user);
    }

    function getGlobalVaultsUpdatesLength() external view returns (uint256) {
        return globalVaultsUpdates.length;
    }

}
