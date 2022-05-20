// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import "./DepositFacet.sol";
import "./BaseFacet.sol";

contract ParamsFacet is BaseFacet {

    /**
    * @dev setWithdrawRequestParams - called by hats governance to set withdraw request params
    * @param _withdrawRequestPendingPeriod - the time period where the withdraw request is pending.
    * @param _withdrawRequestEnablePeriod - the time period where the withdraw is enable for a withdraw request.
    */
    function setWithdrawRequestParams(uint256 _withdrawRequestPendingPeriod, uint256  _withdrawRequestEnablePeriod)
    external
    onlyGovernance {
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
    function setRewardMultipliers(uint256[24] memory _rewardMultipliers) external onlyGovernance {
        rewardMultipliers = _rewardMultipliers;
        emit SetRewardMultipliers(_rewardMultipliers);
    }

    /**
     * @dev Called by hats governance to set fee for submitting a claim to any vault
     * @param _fee claim fee in ETH
    */
    function setClaimFee(uint256 _fee) external onlyGovernance {
        generalParameters.claimFee = _fee;
        emit SetClaimFee(_fee);
    }

    /**
     * @dev setWithdrawSafetyPeriod - called by hats governance to set Withdraw Period
     * @param _withdrawPeriod withdraw enable period
     * @param _safetyPeriod withdraw disable period
    */
    function setWithdrawSafetyPeriod(uint256 _withdrawPeriod, uint256 _safetyPeriod) external onlyGovernance {
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
    function setVestingParams(uint256 _pid, uint256 _duration, uint256 _periods) external onlyGovernance {
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
    function setHatVestingParams(uint256 _duration, uint256 _periods) external onlyGovernance {
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
    onlyGovernance noSubmittedClaims(_pid) noSafetyPeriod {
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
    onlyGovernance {
        require(_delay >= 2 days, "HVE18");
        generalParameters.setBountyLevelsDelay = _delay;
        emit SetBountyLevelsDelay(_delay);
    }

    function setFeeSetter(address _newFeeSetter) external onlyGovernance {
        feeSetter = _newFeeSetter;
        emit SetFeeSetter(_newFeeSetter);
    }

    function setPoolWithdrawalFee(uint256 _pid, uint256 _newFee) external onlyFeeSetter {
        require(_newFee <= MAX_FEE, "HVE36");
        poolInfos[_pid].withdrawalFee = _newFee;
        emit SetPoolWithdrawalFee(_pid, _newFee);
    }

    function setRouterWhitelistStatus(address _router, bool _isWhitelisted) external onlyGovernance {
        whitelistedRouters[_router] = _isWhitelisted;
        emit RouterWhitelistStatusChanged(_router, _isWhitelisted);
    }
}