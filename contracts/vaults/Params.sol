// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import "./Base.sol";

contract Params is Base {

    /**
    * @dev Set pending request to set pool bounty levels.
    * The bounty level represents the percentage of the pool which will be given as a reward for a certain severity.
    * The function can be called only by the pool committee.
    * Cannot be called if there are claims that have been submitted.
    * Each level should be less than `HUNDRED_PERCENT`
    * @param _pid The pool id
    * @param _bountyLevels The array of bounty level per severity
    */
    function setPendingBountyLevels(uint256 _pid, uint256[] memory _bountyLevels)
    external
    onlyCommittee(_pid) noSubmittedClaims(_pid) {
        pendingBountyLevels[_pid].bountyLevels = checkBountyLevels(_bountyLevels);
        // solhint-disable-next-line not-rely-on-time
        pendingBountyLevels[_pid].timestamp = block.timestamp;
        emit SetPendingBountyLevels(_pid, _bountyLevels, pendingBountyLevels[_pid].timestamp);
    }

    /**
   * @dev Set the pool token bounty levels to the already pending bounty levels.
   * The bounty level represents the percentage of the pool which will be given as a bounty for a certain severity.
   * The function can be called only by the pool committee.
   * Cannot be called if there are claims that have been submitted.
   * Can only be called if there are bounty levels pending approval, and the time delay since setting the pending bounty
   * levels had passed.
   * Each level should be less than `HUNDRED_PERCENT`
   * @param _pid The pool id
 */
    function setBountyLevels(uint256 _pid)
    external
    onlyCommittee(_pid) noSubmittedClaims(_pid) {
        require(pendingBountyLevels[_pid].timestamp > 0, "HVE19");
        // solhint-disable-next-line not-rely-on-time
        require(block.timestamp - pendingBountyLevels[_pid].timestamp > generalParameters.setBountyLevelsDelay, "HVE20");
        bountyInfos[_pid].bountyLevels = pendingBountyLevels[_pid].bountyLevels;
        delete pendingBountyLevels[_pid];
        emit SetBountyLevels(_pid, bountyInfos[_pid].bountyLevels);
    }

    /**
    * @dev setCommittee - set new committee address.
    * @param _pid pool id
    * @param _committee new committee address
    */
    function setCommittee(uint256 _pid, address _committee)
    external {
        require(_committee != address(0), "HVE21");
        //governance can update committee only if committee was not checked in yet.
        if (msg.sender == owner() && committees[_pid] != msg.sender) {
            require(!bountyInfos[_pid].committeeCheckIn, "HVE22");
        } else {
            require(committees[_pid] == msg.sender, "HVE01");
        }

        committees[_pid] = _committee;

        emit SetCommittee(_pid, _committee);
    }

    /**
    * @dev committeeCheckIn - committee check in.
    * deposit is enable only after committee check in
    * @param _pid pool id
    */
    function committeeCheckIn(uint256 _pid) external onlyCommittee(_pid) {
        bountyInfos[_pid].committeeCheckIn = true;
        emit CommitteeCheckedIn(_pid);
    }

    /**
    * @dev setWithdrawRequestParams - called by hats governance to set withdraw request params
    * @param _withdrawRequestPendingPeriod - the time period where the withdraw request is pending.
    * @param _withdrawRequestEnablePeriod - the time period where the withdraw is enable for a withdraw request.
    */
    function setWithdrawRequestParams(uint256 _withdrawRequestPendingPeriod, uint256  _withdrawRequestEnablePeriod)
    external
    onlyOwner {
        require(90 days >= _withdrawRequestPendingPeriod, "HVE07");
        require(6 hours <= _withdrawRequestEnablePeriod, "HVE08");
        generalParameters.withdrawRequestPendingPeriod = _withdrawRequestPendingPeriod;
        generalParameters.withdrawRequestEnablePeriod = _withdrawRequestEnablePeriod;
        emit SetWithdrawRequestParams(_withdrawRequestPendingPeriod, _withdrawRequestEnablePeriod);
    }

    /**
     * @dev setRewardMultipliers - called by hats governance to set reward multipliers
     * @param _rewardMultipliers reward multipliers
    */
    function setRewardMultipliers(uint256[24] memory _rewardMultipliers) external onlyOwner {
        rewardMultipliers = _rewardMultipliers;
        emit SetRewardMultipliers(_rewardMultipliers);
    }

    /**
     * @dev Called by hats governance to set fee for submitting a claim to any vault
     * @param _fee claim fee in ETH
    */
    function setClaimFee(uint256 _fee) external onlyOwner {
        generalParameters.claimFee = _fee;
        emit SetClaimFee(_fee);
    }

    /**
     * @dev setWithdrawSafetyPeriod - called by hats governance to set Withdraw Period
     * @param _withdrawPeriod withdraw enable period
     * @param _safetyPeriod withdraw disable period
    */
    function setWithdrawSafetyPeriod(uint256 _withdrawPeriod, uint256 _safetyPeriod) external onlyOwner {
        require(1 hours <= _withdrawPeriod, "HVE12");
        require(_safetyPeriod <= 6 hours, "HVE13");
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
        require(_duration < 120 days, "HVE15");
        require(_periods > 0, "HVE16");
        require(_duration >= _periods, "HVE17");
        bountyInfos[_pid].vestingDuration = _duration;
        bountyInfos[_pid].vestingPeriods = _periods;
        emit SetVestingParams(_pid, _duration, _periods);
    }

    /**
    * @dev setHatVestingParams - set HAT vesting params for rewarding claim reporters with HAT token, for all pools
    * the function can be called only by governance.
    * @param _duration duration of the vesting period
    * @param _periods the vesting periods
    */
    function setHatVestingParams(uint256 _duration, uint256 _periods) external onlyOwner {
        require(_duration < 180 days, "HVE15");
        require(_periods > 0, "HVE16");
        require(_duration >= _periods, "HVE17");
        generalParameters.hatVestingDuration = _duration;
        generalParameters.hatVestingPeriods = _periods;
        emit SetHatVestingParams(_duration, _periods);
    }

    /**
    * @dev Set the pool token bounty split upon an approval
    * The function can be called only by governance.
    * The sum of the parts of the bounty split should be less than `HUNDRED_PERCENT`
    * @param _pid The pool id
    * @param _bountySplit The bounty split
    */
    function setBountySplit(uint256 _pid, BountySplit memory _bountySplit)
    external
    onlyOwner noSubmittedClaims(_pid) noSafetyPeriod {
        validateSplit(_bountySplit);
        bountyInfos[_pid].bountySplit = _bountySplit;
        emit SetBountySplit(_pid, _bountySplit);
    }

    /**
    * @dev Set the timelock delay for setting bounty levels (the time between setPendingBountyLevels and setBountyLevels)
    * @param _delay The delay time
    */
    function setBountyLevelsDelay(uint256 _delay)
    external
    onlyOwner {
        require(_delay >= 2 days, "HVE18");
        generalParameters.setBountyLevelsDelay = _delay;
        emit SetBountyLevelsDelay(_delay);
    }

    function setFeeSetter(address _newFeeSetter) external onlyOwner {
        feeSetter = _newFeeSetter;
        emit SetFeeSetter(_newFeeSetter);
    }

    function setPoolWithdrawalFee(uint256 _pid, uint256 _newFee) external onlyFeeSetter {
        require(_newFee <= MAX_FEE, "HVE36");
        poolInfos[_pid].withdrawalFee = _newFee;
        emit SetPoolWithdrawalFee(_pid, _newFee);
    }

    function setRouterWhitelistStatus(address _router, bool _isWhitelisted) external onlyOwner {
        whitelistedRouters[_router] = _isWhitelisted;
        emit RouterWhitelistStatusChanged(_router, _isWhitelisted);
    }
}