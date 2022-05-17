// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import "../libraries/LibAppStorage.sol";
import "../libraries/LibVaults.sol";

contract ParamsFacet is Modifiers {
    event SetWithdrawSafetyPeriod(uint256 indexed _withdrawPeriod, uint256 indexed _safetyPeriod);
    event SetVestingParams(uint256 indexed _pid, uint256 indexed _duration, uint256 indexed _periods);
    event SetHatVestingParams(uint256 indexed _duration, uint256 indexed _periods);
    event SetRewardMultipliers(uint256[24] _rewardMultipliers);
    event SetBountySplit(uint256 indexed _pid, BountySplit _bountySplit);
    event SetClaimFee(uint256 _fee);
    event SetFeeSetter(address indexed _newFeeSetter);
    event SetPoolFee(uint256 indexed _pid, uint256 _newFee);
    event RouterWhitelistStatusChanged(address indexed _router, bool _status);

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
        s.generalParameters.withdrawRequestPendingPeriod = _withdrawRequestPendingPeriod;
        s.generalParameters.withdrawRequestEnablePeriod = _withdrawRequestEnablePeriod;
    }

    /**
     * @dev setRewardMultipliers - called by hats governance to set reward multipliers
     * @param _rewardMultipliers reward multipliers
    */
    function setRewardMultipliers(uint256[24] memory _rewardMultipliers) external onlyOwner {
        s.rewardMultipliers = _rewardMultipliers;
        emit SetRewardMultipliers(_rewardMultipliers);
    }

    /**
     * @dev setClaimFee - called by hats governance to set claim fee
     * @param _fee claim fee in ETH
    */
    function setClaimFee(uint256 _fee) external onlyOwner {
        s.generalParameters.claimFee = _fee;
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
        s.generalParameters.withdrawPeriod = _withdrawPeriod;
        s.generalParameters.safetyPeriod = _safetyPeriod;
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
        s.bountyInfos[_pid].vestingDuration = _duration;
        s.bountyInfos[_pid].vestingPeriods = _periods;
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
        s.generalParameters.hatVestingDuration = _duration;
        s.generalParameters.hatVestingPeriods = _periods;
        emit SetHatVestingParams(_duration, _periods);
    }

    /**
    * @dev setBountySplit - set the pool token bounty split upon an approval
    * the function can be called only by governance.
    * the sum of the parts of the bounty split should be less than `HUNDRED_PERCENT`
    * @param _pid The pool id
    * @param _bountySplit The bounty split
    * and sent to the hacker(claim reported)
    */
    function setBountySplit(uint256 _pid, BountySplit memory _bountySplit)
    external
    onlyOwner noSubmittedClaims(_pid) noSafetyPeriod {
        LibVaults.validateSplit(_bountySplit);
        s.bountyInfos[_pid].bountySplit = _bountySplit;
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
        s.generalParameters.setBountyLevelsDelay = _delay;
    }

    function setFeeSetter(address _newFeeSetter) external onlyOwner {
        s.feeSetter = _newFeeSetter;
        emit SetFeeSetter(_newFeeSetter);
    }

    function setPoolFee(uint256 _pid, uint256 _newFee) external onlyFeeSetter {
        require(_newFee <= MAX_FEE, "HVE36");
        s.poolInfos[_pid].fee = _newFee;
        emit SetPoolFee(_pid, _newFee);
    }

    function setRouterWhitelistStatus(address _router, bool _isWhitelisted) external onlyOwner {
        s.whitelistedRouters[_router] = _isWhitelisted;
        emit RouterWhitelistStatusChanged(_router, _isWhitelisted);
    }
}