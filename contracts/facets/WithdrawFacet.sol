// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import "../libraries/LibAppStorage.sol";
import "../libraries/LibDiamond.sol";
import "../libraries/LibVaults.sol";

contract WithdrawFacet is Modifiers {
    using SafeERC20 for IERC20;

    event WithdrawRequest(uint256 indexed _pid,
                        address indexed _beneficiary,
                        uint256 indexed _withdrawEnableTime);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 shares);
    event EmergencyWithdraw(address indexed user, uint256 indexed pid, uint256 amount);
    
    /**
    * @notice Withdraw user's requested share from the pool.
    * The withdrawal will only take place if the user has submitted a withdraw request, and the pending period of
    * `generalParameters.withdrawRequestPendingPeriod` had passed since then, and we are within the period where 
    * withdrawal is enabled, meaning `generalParameters.withdrawRequestEnablePeriod` had not passed since the pending period
    * had finished.
    * @param _pid The pool id
    * @param _shares Amount of shares user wants to withdraw
    **/
    function withdraw(uint256 _pid, uint256 _shares) external nonReentrant {
        checkWithdrawAndResetWithdrawEnableStartTime(_pid);
        PoolInfo storage pool = s.poolInfos[_pid];
        UserInfo storage user = s.userInfo[_pid][msg.sender];
        require(user.shares >= _amount, "HVE41");

        LibVaults.updatePool(_pid);
        uint256 pending = user.shares * pool.rewardPerShare / 1e12 - user.rewardDebt;
        if (pending > 0) {
            LibVaults.safeTransferReward(msg.sender, pending, _pid);
        }
        if (_amount > 0) {
            user.shares -= _amount;
            uint256 amountToWithdraw = _amount * pool.balance / pool.totalShares;
            uint256 fee = amountToWithdraw * pool.withdrawalFee / HUNDRED_PERCENT;
            pool.balance -= amountToWithdraw;
            if (fee > 0) {
                pool.lpToken.safeTransfer(LibDiamond.contractOwner(), fee);
            }
            pool.lpToken.safeTransfer(msg.sender, amountToWithdraw - fee);
            pool.totalShares -= _amount;
        }
        user.rewardDebt = user.shares * pool.rewardPerShare / 1e12;
        emit Withdraw(msg.sender, _pid, _amount);
    }

    /**
    * @notice Withdraw all user's pool share without claim for reward.
    * The withdrawal will only take place if the user has submitted a withdraw request, and the pending period of
    * `generalParameters.withdrawRequestPendingPeriod` had passed since then, and we are within the period where 
    * withdrawal is enabled, meaning `generalParameters.withdrawRequestEnablePeriod` had not passed since the pending period
    * had finished.   
    * @param _pid The pool id
    **/
    function emergencyWithdraw(uint256 _pid) external {
        checkWithdrawAndResetWithdrawEnableStartTime(_pid);
        PoolInfo storage pool = s.poolInfos[_pid];
        UserInfo storage user = s.userInfo[_pid][msg.sender];
        require(user.shares > 0, "HVE42");
        uint256 factoredBalance = user.shares * pool.balance / pool.totalShares;
        pool.totalShares -= user.shares;
        user.shares = 0;
        user.rewardDebt = 0;
        uint256 fee = factoredBalance * pool.withdrawalFee / HUNDRED_PERCENT;
        pool.balance -= factoredBalance;
        if (fee > 0) {
            pool.lpToken.safeTransfer(LibDiamond.contractOwner(), fee);
        }
        pool.lpToken.safeTransfer(msg.sender, factoredBalance - fee);
        emit EmergencyWithdraw(msg.sender, _pid, factoredBalance);
    }
    
    /**
    * @notice Submit a request to withdraw funds from pool # `_pid`. 
    The request will only be approved if the last action was a deposit or withdrawal or in case the last action was a withdraw request,
    that the pending period (of `generalParameters.withdrawRequestPendingPeriod`) had ended and the withdraw enable period (of `generalParameters.withdrawRequestEnablePeriod`)
    had also ended.
    * @param _pid The pool ID
    **/
    function withdrawRequest(uint256 _pid) external {
        // require withdraw to be at least withdrawRequestEnablePeriod+withdrawRequestPendingPeriod since last withdrawwithdrawRequest
        // unless there's been a deposit or withdraw since, in which case withdrawRequest is allowed immediately
        // solhint-disable-next-line not-rely-on-time
        require(block.timestamp > s.withdrawEnableStartTime[_pid][msg.sender] + s.generalParameters.withdrawRequestEnablePeriod, "HVE25");
        // set the withdrawRequests time to be withdrawRequestPendingPeriod from now
        // solhint-disable-next-line not-rely-on-time
        s.withdrawEnableStartTime[_pid][msg.sender] = block.timestamp + s.generalParameters.withdrawRequestPendingPeriod;
        emit WithdrawRequest(_pid, msg.sender, s.withdrawEnableStartTime[_pid][msg.sender]);
    }

    // Checks that the sender can perform a withdraw at this time
    // and also sets the withdrawRequest to 0
    function checkWithdrawAndResetWithdrawEnableStartTime(uint256 _pid) internal noSubmittedClaims(_pid) noSafetyPeriod {
        // check that withdrawRequestPendingPeriod had passed
        // solhint-disable-next-line not-rely-on-time
        require(block.timestamp > s.withdrawEnableStartTime[_pid][msg.sender] &&
        // check that withdrawRequestEnablePeriod had not passed and that the last action was withdrawRequests
        // (and not deposit or withdraw, which reset withdrawRequests[_pid][msg.sender] to 0)
        // solhint-disable-next-line not-rely-on-time
                block.timestamp < s.withdrawEnableStartTime[_pid][msg.sender] + s.generalParameters.withdrawRequestEnablePeriod,
                "HVE30");
        // if all is ok and withdrawal can be made - reset withdrawRequests[_pid][msg.sender] so that another withdrawRequest
        // will have to be made before next withdrawal 
        s.withdrawEnableStartTime[_pid][msg.sender] = 0;
    }
}