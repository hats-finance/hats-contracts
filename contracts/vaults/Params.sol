// SPDX-License-Identifier: MIT
pragma solidity 0.8.14;

import "./Base.sol";

contract Params is Base {

    function setFeeSetter(address _newFeeSetter) external onlyOwner {
        feeSetter = _newFeeSetter;
        emit SetFeeSetter(_newFeeSetter);
    }

    /**
    * @dev Set new committee address. Can be called by existing committee if it had checked in, or
    * by the governance otherwise.
    * @param _pid pool id
    * @param _committee new committee address
    */
    function setCommittee(uint256 _pid, address _committee)
    external {
        if (_committee == address(0)) revert CommitteeIsZero();
        //governance can update committee only if committee was not checked in yet.
        if (msg.sender == owner() && committees[_pid] != msg.sender) {
            if (poolInfos[_pid].committeeCheckedIn)
                revert CommitteeAlreadyCheckedIn();
        } else {
            if (committees[_pid] != msg.sender) revert OnlyCommittee();
        }

        committees[_pid] = _committee;

        emit SetCommittee(_pid, _committee);
    }

   /**
     * @dev setArbitrator - called by hats governance to set arbitrator
     * @param _arbitrator New arbitrator.
    */
    function setArbitrator(address _arbitrator) external onlyOwner {
        arbitrator = _arbitrator;
        emit SetArbitrator(_arbitrator);
    }

    /**
    * @dev setWithdrawRequestParams - called by hats governance to set withdraw request params
    * @param _withdrawRequestPendingPeriod - the time period where the withdraw request is pending.
    * @param _withdrawRequestEnablePeriod - the time period where the withdraw is enable for a withdraw request.
    */
    function setWithdrawRequestParams(uint256 _withdrawRequestPendingPeriod, uint256  _withdrawRequestEnablePeriod)
    external
    onlyOwner {
        if (90 days < _withdrawRequestPendingPeriod)
            revert WithdrawRequestPendingPeriodTooLong();
        if (6 hours > _withdrawRequestEnablePeriod)
            revert WithdrawRequestEnabledPeriodTooShort();
        generalParameters.withdrawRequestPendingPeriod = _withdrawRequestPendingPeriod;
        generalParameters.withdrawRequestEnablePeriod = _withdrawRequestEnablePeriod;
        emit SetWithdrawRequestParams(_withdrawRequestPendingPeriod, _withdrawRequestEnablePeriod);
    }

    /**
     * @dev Called by hats governance to set fee for submitting a claim to any vault
     * @param _fee claim fee in ETH
    */
    function setClaimFee(uint256 _fee) external onlyOwner {
        generalParameters.claimFee = _fee;
        emit SetClaimFee(_fee);
    }

    function setChallengePeriod(uint256 _challengePeriod) external onlyOwner {
        challengePeriod = _challengePeriod;
        emit SetChallengePeriod(_challengePeriod);
    }

    function setChallengeTimeOutPeriod(uint256 _challengeTimeOutPeriod) external onlyOwner {
        challengeTimeOutPeriod = _challengeTimeOutPeriod;
        emit SetChallengeTimeOutPeriod(_challengeTimeOutPeriod);
    }

    /**
     * @dev setWithdrawSafetyPeriod - called by hats governance to set Withdraw Period
     * @param _withdrawPeriod withdraw enable period
     * @param _safetyPeriod withdraw disable period
    */
    function setWithdrawSafetyPeriod(uint256 _withdrawPeriod, uint256 _safetyPeriod) external onlyOwner {
        if (1 hours > _withdrawPeriod) revert WithdrawPeriodTooShort();
        if (_safetyPeriod > 6 hours) revert SafetyPeriodTooLong();
        generalParameters.withdrawPeriod = _withdrawPeriod;
        generalParameters.safetyPeriod = _safetyPeriod;
        emit SetWithdrawSafetyPeriod(_withdrawPeriod, _safetyPeriod);
    }

    /**
    * @dev setVestingParams - set pool vesting params for rewarding claim reporter with the pool token
    * @param _pid pool id
    * @param _duration duration of the vesting period
    * @param _periods the vesting periods
    */
    function setVestingParams(uint256 _pid, uint256 _duration, uint256 _periods) external onlyOwner {
        if (_duration > 120 days) revert VestingDurationTooLong();
        if (_periods == 0) revert VestingPeriodsCannotBeZero();
        if (_duration < _periods) revert VestingDurationSmallerThanPeriods();
        bountyInfos[_pid].vestingDuration = _duration;
        bountyInfos[_pid].vestingPeriods = _periods;
        emit SetVestingParams(_pid, _duration, _periods);
    }

    /**
    * @dev setHatVestingParams - set vesting params for rewarding claim reporters with rewardToken, for all pools
    * the function can be called only by governance.
    * @param _duration duration of the vesting period
    * @param _periods the vesting periods
    */
    function setHatVestingParams(uint256 _duration, uint256 _periods) external onlyOwner {
        if (_duration > 180 days) revert VestingDurationTooLong();
        if (_periods == 0) revert VestingPeriodsCannotBeZero();
        if (_duration < _periods) revert VestingDurationSmallerThanPeriods();
        generalParameters.hatVestingDuration = _duration;
        generalParameters.hatVestingPeriods = _periods;
        emit SetHatVestingParams(_duration, _periods);
    }

    /**
    * @dev Set the pool token bounty split upon an approval
    * The function can be called only by governance.
    * @param _pid The pool id
    * @param _bountySplit The bounty split
    */
    function setBountySplit(uint256 _pid, BountySplit memory _bountySplit)
    external
    onlyOwner noActiveClaims(_pid) noSafetyPeriod {
        validateSplit(_bountySplit);
        bountyInfos[_pid].bountySplit = _bountySplit;
        emit SetBountySplit(_pid, _bountySplit);
    }

    /**
    * @dev Set the timelock delay for setting the max bounty
    * (the time between setPendingMaxBounty and setMaxBounty)
    * @param _delay The delay time
    */
    function setMaxBountyDelay(uint256 _delay)
    external
    onlyOwner {
        if (_delay < 2 days) revert DelayTooShort();
        generalParameters.setMaxBountyDelay = _delay;
        emit SetMaxBountyDelay(_delay);
    }

    function setRouterWhitelistStatus(address _router, bool _isWhitelisted) external onlyOwner {
        whitelistedRouters[_router] = _isWhitelisted;
        emit RouterWhitelistStatusChanged(_router, _isWhitelisted);
    }

    function setPoolWithdrawalFee(uint256 _pid, uint256 _newFee) external onlyFeeSetter {
        if (_newFee > MAX_FEE) revert PoolWithdrawalFeeTooBig();
        poolInfos[_pid].withdrawalFee = _newFee;
        emit SetPoolWithdrawalFee(_pid, _newFee);
    }

    /**
       * @dev committeeCheckIn - committee check in.
    * deposit is enable only after committee check in
    * @param _pid pool id
    */
    function committeeCheckIn(uint256 _pid) external onlyCommittee(_pid) {
        poolInfos[_pid].committeeCheckedIn = true;
        emit CommitteeCheckedIn(_pid);
    }

    /**
   * @dev Set pending request to set pool max bounty.
    * The function can be called only by the pool committee.
    * Cannot be called if there are claims that have been submitted.
    * Max bounty should be less than or equal to `HUNDRED_PERCENT`
    * @param _pid The pool id
    * @param _maxBounty The maximum bounty percentage that can be paid out
    */
    function setPendingMaxBounty(uint256 _pid, uint256 _maxBounty)
    external
    onlyCommittee(_pid) noActiveClaims(_pid) {
        if (_maxBounty > HUNDRED_PERCENT)
            revert MaxBountyCannotBeMoreThanHundredPercent();
        pendingMaxBounty[_pid].maxBounty = _maxBounty;
        // solhint-disable-next-line not-rely-on-time
        pendingMaxBounty[_pid].timestamp = block.timestamp;
        emit SetPendingMaxBounty(_pid, _maxBounty, pendingMaxBounty[_pid].timestamp);
    }

    /**
   * @dev Set the pool max bounty to the already pending max bounty.
   * The function can be called only by the pool committee.
   * Cannot be called if there are claims that have been submitted.
   * Can only be called if there is a max bounty pending approval, and the time delay since setting the pending max bounty
   * had passed.
   * Max bounty should be less than `HUNDRED_PERCENT`
   * @param _pid The pool id
 */
    function setMaxBounty(uint256 _pid)
    external
    onlyCommittee(_pid) noActiveClaims(_pid) {
        if (pendingMaxBounty[_pid].timestamp == 0) revert NoPendingMaxBounty();
        // solhint-disable-next-line not-rely-on-time
        if (block.timestamp - pendingMaxBounty[_pid].timestamp <
            generalParameters.setMaxBountyDelay)
            revert DelayPeriodForSettingMaxBountyHadNotPassed();
        bountyInfos[_pid].maxBounty = pendingMaxBounty[_pid].maxBounty;
        delete pendingMaxBounty[_pid];
        emit SetMaxBounty(_pid, bountyInfos[_pid].maxBounty);
    }

    function setRewardController(RewardController _newRewardController) public onlyOwner {
        rewardController = _newRewardController;
        emit SetRewardController(address(_newRewardController));
    }
}
