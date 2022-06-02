// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import "./Base.sol";

contract Withdraw is Base {
    using SafeERC20Upgradeable for IERC20Upgradeable;

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
        require(block.timestamp > withdrawEnableStartTime[_pid][msg.sender] + generalParameters.withdrawRequestEnablePeriod, "HVE25");
        // set the withdrawRequests time to be withdrawRequestPendingPeriod from now
        // solhint-disable-next-line not-rely-on-time
        withdrawEnableStartTime[_pid][msg.sender] = block.timestamp + generalParameters.withdrawRequestPendingPeriod;
        emit WithdrawRequest(_pid, msg.sender, withdrawEnableStartTime[_pid][msg.sender]);
    }

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
        PoolInfo storage pool = poolInfos[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        require(user.shares >= _shares, "HVE41");

        updatePool(_pid);
        uint256 pending = user.shares * pool.rewardPerShare / 1e12 - user.rewardDebt;
        if (pending > 0) {
            safeTransferReward(msg.sender, pending, _pid);
        }
        if (_shares > 0) {
            user.shares -= _shares;
            uint256 amountToWithdraw = _shares * pool.balance / pool.totalShares;
            uint256 fee = amountToWithdraw * pool.withdrawalFee / HUNDRED_PERCENT;
            pool.balance -= amountToWithdraw;
            pool.totalShares -= _shares;
            safeWithdrawPoolToken(pool.lpToken, amountToWithdraw, fee);
        }
        user.rewardDebt = user.shares * pool.rewardPerShare / 1e12;
        emit Withdraw(msg.sender, _pid, _shares);
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
        PoolInfo storage pool = poolInfos[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        require(user.shares > 0, "HVE42");
        uint256 factoredBalance = user.shares * pool.balance / pool.totalShares;
        pool.totalShares -= user.shares;
        user.shares = 0;
        user.rewardDebt = 0;
        uint256 fee = factoredBalance * pool.withdrawalFee / HUNDRED_PERCENT;
        pool.balance -= factoredBalance;
        safeWithdrawPoolToken(pool.lpToken, factoredBalance, fee);
        emit EmergencyWithdraw(msg.sender, _pid, factoredBalance);
    }

    // Checks that the sender can perform a withdraw at this time
    // and also sets the withdrawRequest to 0
    function checkWithdrawAndResetWithdrawEnableStartTime(uint256 _pid)
        internal
        noActiveClaims(_pid)
        noSafetyPeriod
    {
        // check that withdrawRequestPendingPeriod had passed
        // solhint-disable-next-line not-rely-on-time
        require(block.timestamp > withdrawEnableStartTime[_pid][msg.sender] &&
        // check that withdrawRequestEnablePeriod had not passed and that the last action was withdrawRequests
        // (and not deposit or withdraw, which reset withdrawRequests[_pid][msg.sender] to 0)
        // solhint-disable-next-line not-rely-on-time
                block.timestamp < withdrawEnableStartTime[_pid][msg.sender] + generalParameters.withdrawRequestEnablePeriod,
                "HVE30");
        // if all is ok and withdrawal can be made - reset withdrawRequests[_pid][msg.sender] so that another withdrawRequest
        // will have to be made before next withdrawal
        withdrawEnableStartTime[_pid][msg.sender] = 0;
    }

    function safeWithdrawPoolToken(IERC20Upgradeable _lpToken, uint256 _totalAmount, uint256 _fee)
        internal
    {
        if (_fee > 0) {
            _lpToken.safeTransfer(owner(), _fee);
        }
        _lpToken.safeTransfer(msg.sender, _totalAmount - _fee);
    }
}
