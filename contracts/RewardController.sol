// SPDX-License-Identifier: MIT
// Disclaimer https://github.com/hats-finance/hats-contracts/blob/main/DISCLAIMER.md

pragma solidity 0.8.16;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "./interfaces/IRewardController.sol";

error EpochLengthZero();
error CannotAddTerminatedVault();

contract RewardController is IRewardController, OwnableUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    // Not enough rewards to transfer to user
    error NotEnoughRewardsToTransferToUser();

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

    uint256 public constant REWARD_PRECISION = 1e12;
    uint256 public constant NUMBER_OF_EPOCHS = 24;

    // Block from which the vaults contract will start rewarding.
    uint256 public startBlock;
    uint256 public epochLength;
    // the ERC20 contract in which rewards are distributed
    IERC20Upgradeable public rewardToken;
    // amount of tokens rewarded in each block, per epoch
    uint256[24] public epochRewardPerBlock;
    VaultUpdate[] public globalVaultsUpdates;
    mapping(address => VaultInfo) public vaultInfo;
    // vault address => user address => reward debt amount
    mapping(address => mapping(address => uint256)) public rewardDebt;
    // vault address => user address => unclaimed reward amount
    mapping(address => mapping(address => uint256)) public unclaimedReward;
    // vault address => is terminated
    mapping(address => bool) vaultRewardsTerminated;

    event SetEpochRewardPerBlock(uint256[24] _epochRewardPerBlock);
    event ClaimReward(address indexed _vault, address indexed _user, uint256 _amount);

    function initialize(
        address _rewardToken,
        address _hatGovernance,
        uint256 _startRewardingBlock,
        uint256 _epochLength,
        uint256[24] memory _epochRewardPerBlock
    ) external initializer {
        if (_epochLength == 0) revert EpochLengthZero();
        rewardToken = IERC20Upgradeable(_rewardToken);
        startBlock = _startRewardingBlock;
        epochLength = _epochLength;
        epochRewardPerBlock = _epochRewardPerBlock;
        _transferOwnership(_hatGovernance);
    }

    function setAllocPoint(address _vault, uint256 _allocPoint) external onlyOwner {        
        _setAllocPoint(_vault, _allocPoint);
    }

    /**
    * @notice Update the vault's rewardPerShare, not more then once per block
    * @param _vault The vault's address
    */
    function updateVault(address _vault) public {
        VaultInfo storage vault = vaultInfo[_vault];
        uint256 lastRewardBlock = vault.lastRewardBlock;
        if (lastRewardBlock == 0) {
            vaultInfo[_vault].lastRewardBlock = block.number > startBlock ? block.number : startBlock;
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

        if (globalVaultsUpdates.length != 0) {
            vaultInfo[_vault].lastProcessedVaultUpdate = globalVaultsUpdates.length - 1;
        }
    }

    /**
    * @notice Called by owner to set reward per epoch
    * @param _epochRewardPerBlock reward per epoch
    */
    function setEpochRewardPerBlock(uint256[24] memory _epochRewardPerBlock) external onlyOwner {
        epochRewardPerBlock = _epochRewardPerBlock;
        emit SetEpochRewardPerBlock(_epochRewardPerBlock);
    }

    function _setAllocPoint(address _vault, uint256 _allocPoint) internal {
        if (vaultRewardsTerminated[_vault]) revert CannotAddTerminatedVault();
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

    function _commitUserBalance(
        address _vault,
        address _user,
        uint256 _sharesChange,
        bool _isDeposit
    ) internal {
        updateVault(_vault);

        uint256 userShares = IERC20Upgradeable(_vault).balanceOf(_user);
        uint256 rewardPerShare = vaultInfo[_vault].rewardPerShare;
        unclaimedReward[_vault][_user] += userShares * rewardPerShare / REWARD_PRECISION - rewardDebt[_vault][_user];

        if (_sharesChange != 0) {
            if (_isDeposit) {
                userShares += _sharesChange;
            } else {
                userShares -= _sharesChange;
            }
        }
        rewardDebt[_vault][_user] = userShares * rewardPerShare / REWARD_PRECISION;
    }

    /**
    * @notice Called by the vault to update a user claimable reward after deposit or withdraw.
    * This call should never revert
    * @param _user The user address to updare rewards for
    * @param _sharesChange The user of shared the user deposited or withdrew
    * @param _isDeposit Whether user deposited or withdrew
    */
    function commitUserBalance(address _user, uint256 _sharesChange, bool _isDeposit) external {
        _commitUserBalance(msg.sender, _user, _sharesChange, _isDeposit);
    }

    /**
    * @notice Transfer to the specified user their pending share of rewards.
    * @param _vault The vault address
    * @param _user The user address to claim for
    */
    function claimReward(address _vault, address _user) external {
        _commitUserBalance(_vault, _user, 0, true);

        uint256 userUnclaimedReward = unclaimedReward[_vault][_user];
        if (userUnclaimedReward > 0) {
            unclaimedReward[_vault][_user] = 0;
            rewardToken.safeTransfer(_user, userUnclaimedReward);
        }

        emit ClaimReward(_vault, _user, userUnclaimedReward);
    }

    /**
    * @notice Calculate rewards for a vault by iterating over the history of totalAllocPoints updates,
    * and sum up all rewards periods from vault.lastRewardBlock until current block number.
    * @param _vault The vault address
    * @param _fromBlock The block from which to start calculation
    * @return reward
    */
    function getVaultReward(address _vault, uint256 _fromBlock) public view returns(uint256 reward) {
        if (globalVaultsUpdates.length == 0) {
            return 0;
        }
        uint256 vaultAllocPoint = vaultInfo[_vault].allocPoint;
        uint256 i = vaultInfo[_vault].lastProcessedVaultUpdate;
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
        if (_fromBlock >= startBlock && _totalAllocPoint > 0) {
            uint256 result;
            uint256 i = (_fromBlock - startBlock) / epochLength + 1;
            for (; i <= NUMBER_OF_EPOCHS; i++) {
                uint256 endBlock = epochLength * i + startBlock;
                if (_toBlock <= endBlock) {
                    break;
                }
                result += (endBlock - _fromBlock) * epochRewardPerBlock[i-1];
                _fromBlock = endBlock;
            }
            result += (_toBlock - _fromBlock) * (i > NUMBER_OF_EPOCHS ? 0 : epochRewardPerBlock[i-1]);
            reward = result * _allocPoint / _totalAllocPoint;
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
        uint256 totalShares = IERC20Upgradeable(_vault).totalSupply();

        if (vault.lastRewardBlock != 0 && block.number > vault.lastRewardBlock && totalShares > 0) {
            uint256 reward = getVaultReward(_vault, vault.lastRewardBlock);
            rewardPerShare += (reward * REWARD_PRECISION / totalShares);
        }

        return IERC20Upgradeable(_vault).balanceOf(_user) * rewardPerShare / REWARD_PRECISION + 
                unclaimedReward[_vault][_user] -
                rewardDebt[_vault][_user];
    }

    /**
    * @notice Removes the vault from getting rewards
    */
    function terminateVaultRewards() external {
        if (vaultInfo[msg.sender].allocPoint != 0) {
            _setAllocPoint(msg.sender, 0);
        }
        vaultRewardsTerminated[msg.sender] = true;
    }

    function getGlobalVaultsUpdatesLength() external view returns (uint256) {
        return globalVaultsUpdates.length;
    }

}
