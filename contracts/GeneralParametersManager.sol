// SPDX-License-Identifier: MIT
// Disclaimer https://github.com/hats-finance/hats-contracts/blob/main/DISCLAIMER.md

pragma solidity 0.8.6;

import "./HATVaults.sol";


contract GeneralParametersManager {
    struct GeneralParameters {
        uint256 hatVestingDuration;
        uint256 hatVestingPeriods;
        uint256 withdrawPeriod;
        uint256 safetyPeriod; //withdraw disable period in seconds
        uint256 setRewardsLevelsDelay;
        uint256 withdrawRequestEnablePeriod;
        uint256 withdrawRequestPendingPeriod;
        uint256 claimFee;  //claim fee in ETH
    }

    uint256 public constant TIME_LOCK_DELAY = 2 days;

    GeneralParameters internal _generalParameters;
    
    // General parameters setting delays
    GeneralParameters internal _generalParametersPending;
    uint256 public setclaimFeePendingAt;
    uint256 public setWithdrawSafetyPeriodPendingAt;
    uint256 public setHatVestingParamsPendingAt;

    HATVaults public hatVaults;

    event ClaimFeePending(uint256 indexed _newFee);

    event SetClaimFee(uint256 indexed _fee);

    event WithdrawSafetyPeriodPending(uint256 indexed _newWithdrawPeriod, uint256 indexed _newSafetyPeriod);

    event SetWithdrawSafetyPeriod(uint256 indexed _withdrawPeriod, uint256 indexed _safetyPeriod);

    event HatVestingParamsPending(uint256 indexed _newDuration, uint256 indexed _newPeriods);

    event SetHatVestingParams(uint256 indexed _duration, uint256 indexed _periods);

    modifier onlyGovernance() {
        require(hatVaults.governance() == msg.sender, "GeneralParametersManager: caller is not the HATVaults governance");
        _;
    }

    modifier checkDelayPassed(uint256 _updateRequestedAt) {
        require(_updateRequestedAt > 0, "HATVaults: no pending update");
        require(
            // solhint-disable-next-line not-rely-on-time
            block.timestamp - _updateRequestedAt > TIME_LOCK_DELAY,
            "GeneralParametersManager: must wait the update delay"
        );
        _;
    }

    constructor () {
        hatVaults = HATVaults(msg.sender);
        _generalParameters = GeneralParameters({
            hatVestingDuration: 90 days,
            hatVestingPeriods:90,
            withdrawPeriod: 11 hours,
            safetyPeriod: 1 hours,
            setRewardsLevelsDelay: 2 days,
            withdrawRequestEnablePeriod: 7 days,
            withdrawRequestPendingPeriod: 7 days,
            claimFee: 0
        });
    }

    function generalParameters() external view returns (GeneralParameters memory) {
        return _generalParameters;
    }

    function generalParametersPending() external view returns (GeneralParameters memory) {
        return _generalParametersPending;
    }


    /**
     * @dev setWithdrawRequestParams - called by hats governance to set withdraw request params
     * @param _withdrawRequestPendingPeriod - the time period where the withdraw request is pending.
     * @param _withdrawRequestEnablePeriod - the time period where the withdraw is enable for a withdraw request.
    */
    function setWithdrawRequestParams(uint256 _withdrawRequestPendingPeriod, uint256  _withdrawRequestEnablePeriod)
    external
    onlyGovernance {
        _generalParameters.withdrawRequestPendingPeriod = _withdrawRequestPendingPeriod;
        _generalParameters.withdrawRequestEnablePeriod = _withdrawRequestEnablePeriod;
    }

    /**
     * @dev setClaimFee - called by hats governance to set claim fee
     * the change only takes place by calling the setClaimFee function after the required delay has passed.
     * @param _fee claim fee in ETH
    */
    function setClaimFeePending(uint256 _fee) external onlyGovernance {
        _generalParametersPending.claimFee = _fee;
        // solhint-disable-next-line not-rely-on-time
        setclaimFeePendingAt = block.timestamp;
        emit ClaimFeePending(_fee);
    }

    /**
     * @dev setClaimFee - called by hats governance to activate the change of the claim fee after commiting to 
     * the new value in the setClaimFeePending and after the required delay has passed.
    */
    function setClaimFee() external checkDelayPassed(setclaimFeePendingAt) onlyGovernance {        
        _generalParameters.claimFee = _generalParametersPending.claimFee;
        setclaimFeePendingAt = 0;
        emit SetClaimFee(_generalParametersPending.claimFee);
    }

    /**
     * @dev setWithdrawSafetyPeriod - called by hats governance to set new withdraw and safety periods
     * the change only takes place by calling the setWithdrawSafetyPeriod function after the required delay has passed.
     * @param _withdrawPeriod withdraw enable period
     * @param _safetyPeriod withdraw disable period
    */
    function setPendingWithdrawSafetyPeriod(uint256 _withdrawPeriod, uint256 _safetyPeriod) external onlyGovernance {
        require(1 hours <= _withdrawPeriod, "HATVaults: withdrawe period must be longer than 1 hour");
        require(
            30 minutes <= _safetyPeriod && _safetyPeriod <= 3 hours,
            "HATVaults: safety period must be longer than 30 minutes and shorter than 3 hours"
        );
        _generalParametersPending.withdrawPeriod = _withdrawPeriod;
        _generalParametersPending.safetyPeriod = _safetyPeriod;
        // solhint-disable-next-line not-rely-on-time
        setWithdrawSafetyPeriodPendingAt = block.timestamp;
        emit WithdrawSafetyPeriodPending(_withdrawPeriod, _safetyPeriod);
    }

    /**
     * @dev setWithdrawSafetyPeriod - called by hats governance to activate a change in the withdraw and safety periods
     * after commiting to the new values in the setPendingWithdrawSafetyPeriod and after the required delay has passed.
    */
    function setWithdrawSafetyPeriod() external checkDelayPassed(setWithdrawSafetyPeriodPendingAt) onlyGovernance {
        _generalParameters.withdrawPeriod = _generalParametersPending.withdrawPeriod;
        _generalParameters.safetyPeriod = _generalParametersPending.safetyPeriod;
        setWithdrawSafetyPeriodPendingAt = 0;
        emit SetWithdrawSafetyPeriod(_generalParametersPending.withdrawPeriod, _generalParametersPending.safetyPeriod);
    }
    
    /**
    * @dev setHatVestingParams - set HAT vesting params for rewarding claim reporter with HAT token
    * the change only takes place by calling the setHatVestingParams function after the required delay has passed.
    * the function can be called only by governance.
    * @param _duration duration of the vesting period
    * @param _periods the vesting periods
    */
    function setPendingHatVestingParams(uint256 _duration, uint256 _periods) external onlyGovernance {
        require(_duration < 180 days, "vesting duration is too long");
        require(_periods > 0, "vesting periods cannot be zero");
        require(_duration >= _periods, "vesting duration smaller than periods");
        _generalParametersPending.hatVestingDuration = _duration;
        _generalParametersPending.hatVestingPeriods = _periods;
        // solhint-disable-next-line not-rely-on-time
        setHatVestingParamsPendingAt = block.timestamp;
        emit HatVestingParamsPending(_duration, _periods);
    }

    /**
    * @dev setHatVestingParams - called by hats governance to activate a change in the HAT vesting params
    * for rewarding claim reporter with HAT token after commiting to the new values in the
    * setPendingHatVestingParams and after the required delay has passed.
    */
    function setHatVestingParams() external checkDelayPassed(setHatVestingParamsPendingAt) onlyGovernance {
        _generalParameters.hatVestingDuration = _generalParametersPending.hatVestingDuration;
        _generalParameters.hatVestingPeriods = _generalParametersPending.hatVestingPeriods;
        setHatVestingParamsPendingAt = 0;
        emit SetHatVestingParams(_generalParametersPending.hatVestingDuration, _generalParametersPending.hatVestingPeriods);
    }

    /**
    * @dev setRewardsLevelsDelay - set the timelock delay for setting rewars level
    * @param _delay time delay
    */
    function setRewardsLevelsDelay(uint256 _delay)
    external
    onlyGovernance {
        require(_delay >= 2 days, "delay is too short");
        _generalParameters.setRewardsLevelsDelay = _delay;
    }

}
