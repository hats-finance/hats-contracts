// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import "../libraries/LibAppStorage.sol";
import "../libraries/LibDiamond.sol";

contract RewardFacet is Modifiers {
    using SafeERC20 for IERC20;

    event RewardDepositors(uint256 indexed _pid, uint256 indexed _amount);

    function depositHATReward(uint256 _amount) external {
        s.hatRewardAvailable += _amount;
        s.HAT.transferFrom(address(msg.sender), address(this), _amount);
    }

    /**
     * @dev rewardDepositors - add funds to pool to reward depositors.
     * The funds will be given to depositors pro rata upon withdraw
     * @param _pid pool id
     * @param _amount amount to add
    */
    function rewardDepositors(uint256 _pid, uint256 _amount) external {
        require((s.poolInfos[_pid].balance + _amount) / MINIMUM_DEPOSIT < s.poolInfos[_pid].totalShares,
        "HVE11");
        s.poolInfos[_pid].lpToken.safeTransferFrom(msg.sender, address(this), _amount);
        s.poolInfos[_pid].balance += _amount;
        emit RewardDepositors(_pid, _amount);
    }
}