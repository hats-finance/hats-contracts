// SPDX-License-Identifier: MIT
// Disclaimer https://github.com/hats-finance/hats-contracts/blob/main/DISCLAIMER.md

pragma solidity 0.8.6;

import "./HATMaster.sol";
import "./HATVaults.sol";
import "./Governable.sol";


contract HATGovernance is Governable {
    using SafeMath for uint256;

    uint256 internal constant REWARDS_LEVEL_DENOMINATOR = 10000;

    HATToken public immutable HAT;

    // Delays duration parameters
    uint256 public shortDelay = 2 days;
    uint256 public longDelay = 61 days;

    // Delays duration parameters
    uint256 public shortDelayPending;
    uint256 public longDelayPending;
    
    // General parameters setting delays
    HATVaults.GeneralParameters public generalParametersPending;
    uint256 public setShortDelayPendingAt;
    uint256 public setLongDelayPendingAt;
    uint256 public setWithdrawRequestParamsPendingAt;
    uint256 public setclaimFeePendingAt;
    uint256 public setWithdrawSafetyPeriodPendingAt;
    uint256 public setHatVestingParamsPendingAt;

    struct VestingParamsPendingStruct {
        uint256 duration;
        uint256 periods;
        uint256 pendingAt;
    }

    // Pools parameters setting delays
    mapping(uint256 => VestingParamsPendingStruct) public poolsRewardVestingParamsPendings;
    mapping(uint256 => HATMaster.RewardsSplit) public rewardsSplitsPending;
    mapping(uint256 => uint256) public rewardsSplitsPendingAt;

    HATVaults public hatVaults;

    event ShortDelayPending(uint256 indexed _previousShortDelay, uint256 indexed _newShortDelay);

    event SetShortDelay(uint256 indexed _previousShortDelay, uint256 indexed _newShortDelay);
    
    event LongDelayPending(uint256 indexed _previousLongDelay, uint256 indexed _newLongDelay);

    event SetLongDelay(uint256 indexed _previousLongDelay, uint256 indexed _newLongDelay);

    event ClaimFeePending(uint256 indexed _newFee);

    event SetClaimFee(uint256 indexed _fee);

    event WithdrawRequestParamsPending(uint256 indexed _newWithdrawRequestPendingPeriod, uint256 indexed _newWithdrawRequestEnablePeriod);
    
    event SetWithdrawRequestParams(uint256 indexed _withdrawRequestPendingPeriod, uint256 indexed _withdrawRequestEnablePeriod);
    
    event WithdrawSafetyPeriodPending(uint256 indexed _newWithdrawPeriod, uint256 indexed _newSafetyPeriod);

    event SetWithdrawSafetyPeriod(uint256 indexed _withdrawPeriod, uint256 indexed _safetyPeriod);

    event HatVestingParamsPending(uint256 indexed _newDuration, uint256 indexed _newPeriods);

    event SetHatVestingParams(uint256 indexed _duration, uint256 indexed _periods);

    event VestingParamsPending(uint256 indexed _pid, uint256 indexed _newDuration, uint256 indexed _newPeriods);

    event SetVestingParams(uint256 indexed _pid, uint256 indexed _duration, uint256 indexed _periods);
    
    event RewardsSplitPending(uint256 indexed _pid, HATMaster.RewardsSplit indexed _newRewardsSplit);
    
    event SetRewardsSplit(uint256 indexed _pid, HATMaster.RewardsSplit _rewardsSplit);

    modifier checkDelayPassed(uint256 _updateRequestedAt, uint256 _delay) {
        require(_updateRequestedAt > 0, "HATVaults: no pending update");
        require(
            // solhint-disable-next-line not-rely-on-time
            block.timestamp - _updateRequestedAt > _delay,
            "HATVaultsParametersManager: must wait the update delay"
        );
        _;
    }
    
    // solhint-disable-next-line func-visibility
    constructor (address _hatGovernance, HATToken _hat) {
        hatVaults = HATVaults(msg.sender);
        Governable.initialize(_hatGovernance);
        HAT = _hat;
    }


    /**
     * @dev setShortDelayPending - called by hats governance to set the short delay for updating parameters
     * @param _delay the new delay for changes based on the short delay
    */
    function setShortDelayPending(uint256 _delay) external onlyGovernance {
        require(_delay >= 2 days && _delay <= 14 days, "short delay must be between 2 and 14 days");
        shortDelayPending = _delay;
        // solhint-disable-next-line not-rely-on-time
        setShortDelayPendingAt = block.timestamp;
        emit ShortDelayPending(shortDelay, _delay);
    }

    /**
     * @dev setShortDelay - called by hats governance to set the short delay for updating parameters
    */
    function setShortDelay() external onlyGovernance checkDelayPassed(setShortDelayPendingAt, shortDelay) {
        emit SetShortDelay(shortDelay, shortDelayPending);
        shortDelay = shortDelayPending;
        setShortDelayPendingAt = 0;
    }

    /**
     * @dev setLongDelayPending - called by hats governance to set the long delay for updating parameters
     * @param _delay the new delay for changes based on the long delay
    */
    function setLongDelayPending(uint256 _delay) external onlyGovernance {
        require(_delay >= 14 days && _delay <= 90 days, "long delay must be between 2 weeks and 3 months");
        longDelayPending = _delay;
        // solhint-disable-next-line not-rely-on-time
        setLongDelayPendingAt = block.timestamp;
        emit LongDelayPending(longDelay, _delay);
    }

    /**
     * @dev setLongDelay - called by hats governance to set the long delay for updating parameters
    */
    function setLongDelay() external onlyGovernance checkDelayPassed(setLongDelayPendingAt, longDelay) {
        emit SetLongDelay(longDelay, longDelayPending);
        longDelay = longDelayPending;
        setLongDelayPendingAt = 0;
    }

    /**
     * @dev setPendingWithdrawRequestParams - called by hats governance to set new withdraw request parameters
     * the change only takes place by calling the setWithdrawRequestParams function after the required delay has passed.
     * @param _withdrawRequestPendingPeriod - the time period where the withdraw request is pending.
     * @param _withdrawRequestEnablePeriod - the time period where the withdraw is enable for a withdraw request.
    */
    function setPendingWithdrawRequestParams(
        uint256 _withdrawRequestPendingPeriod,
        uint256  _withdrawRequestEnablePeriod
    ) external onlyGovernance {
        require(60 days >= _withdrawRequestPendingPeriod, "HATVaultsParametersManager: withdrawe request pending period must be <= 2 months");
        require(1 hours <= _withdrawRequestEnablePeriod, "HATVaultsParametersManager: withdrawe request enabled period must be >= 1 hour");
        generalParametersPending.withdrawRequestPendingPeriod = _withdrawRequestPendingPeriod;
        generalParametersPending.withdrawRequestEnablePeriod = _withdrawRequestEnablePeriod;
        // solhint-disable-next-line not-rely-on-time
        setWithdrawRequestParamsPendingAt = block.timestamp;
        emit WithdrawRequestParamsPending(_withdrawRequestPendingPeriod, _withdrawRequestEnablePeriod);
    }

    /**
     * @dev setWithdrawRequestParams - called by hats governance to activate a change in the withdraw request parameters
     * after commiting to the new values in the setPendingWithdrawRequestParams and after the required delay has passed.
    */
    function setWithdrawRequestParams() external 
    checkDelayPassed(setWithdrawRequestParamsPendingAt, longDelay) onlyGovernance {
        setWithdrawRequestParamsPendingAt = 0;
        hatVaults.setWithdrawRequestParams(
            generalParametersPending.withdrawRequestPendingPeriod, 
            generalParametersPending.withdrawRequestEnablePeriod
        );
        emit SetWithdrawRequestParams(
            generalParametersPending.withdrawRequestPendingPeriod,
            generalParametersPending.withdrawRequestEnablePeriod
        );
    }

    /**
     * @dev setClaimFee - called by hats governance to set claim fee
     * the change only takes place by calling the setClaimFee function after the required delay has passed.
     * @param _fee claim fee in ETH
    */
    function setClaimFeePending(uint256 _fee) external onlyGovernance {
        generalParametersPending.claimFee = _fee;
        // solhint-disable-next-line not-rely-on-time
        setclaimFeePendingAt = block.timestamp;
        emit ClaimFeePending(_fee);
    }

    /**
     * @dev setClaimFee - called by hats governance to activate the change of the claim fee after commiting to 
     * the new value in the setClaimFeePending and after the required delay has passed.
    */
    function setClaimFee() external checkDelayPassed(setclaimFeePendingAt, shortDelay) onlyGovernance {        
        setclaimFeePendingAt = 0;
        hatVaults.setClaimFee(generalParametersPending.claimFee);
        emit SetClaimFee(generalParametersPending.claimFee);
    }

    /**
     * @dev setWithdrawSafetyPeriod - called by hats governance to set new withdraw and safety periods
     * the change only takes place by calling the setWithdrawSafetyPeriod function after the required delay has passed.
     * @param _withdrawPeriod withdraw enable period
     * @param _safetyPeriod withdraw disable period
    */
    function setPendingWithdrawSafetyPeriod(uint256 _withdrawPeriod, uint256 _safetyPeriod) external onlyGovernance {
        require(1 hours <= _withdrawPeriod, "HATVaultsParametersManager: withdrawe period must be >= 1 hour");
        require(
            30 minutes <= _safetyPeriod && _safetyPeriod <= 3 hours,
            "HATVaultsParametersManager: safety period must be >= 30 minutes and <= 3 hours"
        );
        generalParametersPending.withdrawPeriod = _withdrawPeriod;
        generalParametersPending.safetyPeriod = _safetyPeriod;
        // solhint-disable-next-line not-rely-on-time
        setWithdrawSafetyPeriodPendingAt = block.timestamp;
        emit WithdrawSafetyPeriodPending(_withdrawPeriod, _safetyPeriod);
    }

    /**
     * @dev setWithdrawSafetyPeriod - called by hats governance to activate a change in the withdraw and safety periods
     * after commiting to the new values in the setPendingWithdrawSafetyPeriod and after the required delay has passed.
    */
    function setWithdrawSafetyPeriod() external checkDelayPassed(setWithdrawSafetyPeriodPendingAt, shortDelay) onlyGovernance {
        setWithdrawSafetyPeriodPendingAt = 0;
        hatVaults.setWithdrawSafetyPeriod(generalParametersPending.withdrawPeriod, generalParametersPending.safetyPeriod);
        emit SetWithdrawSafetyPeriod(generalParametersPending.withdrawPeriod, generalParametersPending.safetyPeriod);
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
        generalParametersPending.hatVestingDuration = _duration;
        generalParametersPending.hatVestingPeriods = _periods;
        // solhint-disable-next-line not-rely-on-time
        setHatVestingParamsPendingAt = block.timestamp;
        emit HatVestingParamsPending(_duration, _periods);
    }

    /**
    * @dev setHatVestingParams - called by hats governance to activate a change in the HAT vesting params
    * for rewarding claim reporter with HAT token after commiting to the new values in the
    * setPendingHatVestingParams and after the required delay has passed.
    */
    function setHatVestingParams() external checkDelayPassed(setHatVestingParamsPendingAt, shortDelay) onlyGovernance {
        setHatVestingParamsPendingAt = 0;
        hatVaults.setHatVestingParams(generalParametersPending.hatVestingDuration, generalParametersPending.hatVestingPeriods);
        emit SetHatVestingParams(generalParametersPending.hatVestingDuration, generalParametersPending.hatVestingPeriods);
    }

    // -----------------------------------------------------------------------
    
    /**
    * @dev setPendingVestingParams - set pool vesting params for rewarding claim reporter with the pool token
    * the change only takes place by calling the setVestingParams function after the required delay has passed.
    * @param _pid pool id
    * @param _duration duration of the vesting period
    * @param _periods the vesting periods
    */
    function setPendingVestingParams(uint256 _pid, uint256 _duration, uint256 _periods) external onlyGovernance {
        require(_duration < 120 days, "vesting duration is too long");
        require(_periods > 0, "vesting periods cannot be zero");
        require(_duration >= _periods, "vesting duration smaller than periods");
        poolsRewardVestingParamsPendings[_pid] = VestingParamsPendingStruct({
            duration: _duration,
            periods: _periods,
            // solhint-disable-next-line not-rely-on-time
            pendingAt: block.timestamp
        });
        emit VestingParamsPending(_pid, _duration, _periods);
    }

    /**
    * @dev setVestingParams - called by hats governance to activate a change in a pool vesting params
    * for rewarding claim reporter with the pool token after commiting to the new values in the
    * setPendingVestingParams and after the required delay has passed.
    * @param _pid pool id
    */
    function setVestingParams(uint256 _pid) external checkDelayPassed(poolsRewardVestingParamsPendings[_pid].pendingAt, shortDelay) onlyGovernance {
        poolsRewardVestingParamsPendings[_pid].pendingAt = 0;
        hatVaults.setVestingParams(_pid, poolsRewardVestingParamsPendings[_pid].duration, poolsRewardVestingParamsPendings[_pid].periods);
        emit SetVestingParams(_pid, poolsRewardVestingParamsPendings[_pid].duration, poolsRewardVestingParamsPendings[_pid].periods);
    }

    /**
    * @dev setPendingRewardsSplit - set the pool token rewards split upon an approval
    * the function can be called only by governance.
    * the sum of the rewards split should be less than 10000 (less than 100%)
    * the change only takes place by calling the setRewardsSplit function after the required delay has passed.
    * @param _pid pool id
    * @param _rewardsSplit split
    */
    function setPendingRewardsSplit(uint256 _pid, HATMaster.RewardsSplit memory _rewardsSplit)
    external
    onlyGovernance {
        validateSplit(_rewardsSplit);
        rewardsSplitsPending[_pid] = _rewardsSplit;
        // solhint-disable-next-line not-rely-on-time
        rewardsSplitsPendingAt[_pid] = block.timestamp;
        emit RewardsSplitPending(_pid, _rewardsSplit);
    }

    /**
    * @dev setRewardsSplit - activates a change of a pool token rewards split
    * the function can be called only by governance.
    * the sum of the rewards split should be less than 10000 (less than 100%)
    * used after commiting to the new values in the setPendingRewardsSplit and after the required delay has passed.
    */
    function setRewardsSplit(uint256 _pid)
    external
    checkDelayPassed(rewardsSplitsPendingAt[_pid], shortDelay) onlyGovernance {
        rewardsSplitsPendingAt[_pid] = 0;
        hatVaults.setRewardsSplit(_pid, rewardsSplitsPending[_pid]);
        emit SetRewardsSplit(_pid, rewardsSplitsPending[_pid]);
    }

    function validateSplit(HATMaster.RewardsSplit memory _rewardsSplit) public pure {
        require(_rewardsSplit.hackerVestedReward
            .add(_rewardsSplit.hackerReward)
            .add(_rewardsSplit.committeeReward)
            .add(_rewardsSplit.swapAndBurn)
            .add(_rewardsSplit.governanceHatReward)
            .add(_rewardsSplit.hackerHatReward) == REWARDS_LEVEL_DENOMINATOR,
        "total split % should be 10000");
    }


    // Whitelisted functions

    function dismissPendingApprovalClaim(uint256 _pid) external onlyGovernance {
        hatVaults.dismissPendingApprovalClaim(_pid);
    }

     function approveClaim(uint256 _pid) external onlyGovernance {
         hatVaults.approveClaim(_pid);
     }

    function setRewardsLevelsDelay(uint256 _delay) external onlyGovernance {
        hatVaults.setRewardsLevelsDelay(_delay);
    }

    function setCommittee(uint256 _pid, address _committee) external onlyGovernance {
        hatVaults.setCommittee(_pid, _committee);
    }

    function addPool(uint256 _allocPoint,
                    address _lpToken,
                    address _committee,
                    uint256[] memory _rewardsLevels,
                    HATVaults.RewardsSplit memory _rewardsSplit,
                    string memory _descriptionHash,
                    uint256[2] memory _rewardVestingParams)
    external
    onlyGovernance {
        hatVaults.addPool(
            _allocPoint,
            _lpToken,
            _committee,
            _rewardsLevels,
            _rewardsSplit,
            _descriptionHash,
            _rewardVestingParams
        );
    }

    function setPool(uint256 _pid,
                    uint256 _allocPoint,
                    bool _registered,
                    bool _depositPause,
                    string memory _descriptionHash)
    external onlyGovernance {
        hatVaults.setPool(
            _pid,
            _allocPoint,
            _registered,
            _depositPause,
            _descriptionHash
        );
    }

    function swapBurnSend(uint256 _pid,
                        address _beneficiary,
                        uint256 _amountOutMinimum,
                        uint24[2] memory _fees)
    external
    onlyGovernance {
        hatVaults.swapBurnSend(
            _pid,
            _beneficiary,
            _amountOutMinimum,
            _fees
        );
        HAT.transfer(governance(), HAT.balanceOf(address(this)));
    }

    function claimETH() external {
        payable(governance()).transfer(address(this).balance);
    }

    // solhint-disable-next-line no-empty-blocks
    receive() external payable {}

    // TODO: Implement logic to transfer ownership of the hatvaults
}
