// SPDX-License-Identifier: MIT
// Disclaimer https://github.com/hats-finance/hats-contracts/blob/main/DISCLAIMER.md

pragma solidity 0.8.14;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "./tokenlock/TokenLockFactory.sol";
import "./interfaces/IRewardController.sol";
import "./HATVault.sol";

// Errors:
// Withdraw period must be >= 1 hour
error WithdrawPeriodTooShort();
// Safety period must be <= 6 hours
error SafetyPeriodTooLong();
// Withdraw request pending period must be <= 3 months
error WithdrawRequestPendingPeriodTooLong();
// Withdraw request enabled period must be >= 6 hour
error WithdrawRequestEnabledPeriodTooShort();
// Vesting duration is too long
error VestingDurationTooLong();
// Vesting periods cannot be zero
error VestingPeriodsCannotBeZero();
// Vesting duration smaller than periods
error VestingDurationSmallerThanPeriods();
// Delay is too short
error DelayTooShort();

/// @title Manage all Hats.finance vaults
/// Hats.finance is a proactive bounty protocol for white hat hackers and
/// auditors, where projects, community members, and stakeholders incentivize
/// protocol security and responsible disclosure.
/// Hats create scalable vaults using the project’s own token. The value of the
/// bounty increases with the success of the token and project.
/// This project is open-source and can be found on:
/// https://github.com/hats-finance/hats-contracts
contract HATVaultsRegistry is Ownable, ReentrancyGuard {

    struct GeneralParameters {
        uint256 hatVestingDuration;
        uint256 hatVestingPeriods;
        // withdraw enable period. safetyPeriod starts when finished.
        uint256 withdrawPeriod;
        // withdraw disable period - time for the committee to gather and decide on actions,
        // withdrawals are not possible in this time. withdrawPeriod starts when finished.
        uint256 safetyPeriod;
        // period of time after withdrawRequestPendingPeriod where it is possible to withdraw
        // (after which withdrawal is not possible)
        uint256 withdrawRequestEnablePeriod;
        // period of time that has to pass after withdraw request until withdraw is possible
        uint256 withdrawRequestPendingPeriod;
        uint256 setMaxBountyDelay;
        uint256 claimFee;  //claim fee in ETH
    }

    address public immutable hatVaultImplementation;
    address[] public hatVaults;

    // PARAMETERS FOR ALL VAULTS
    // time during which a claim can be challenged by the arbitrator
    uint256 public challengePeriod;
    // time after which a challenged claim is automatically dismissed
    uint256 public challengeTimeOutPeriod;
    // a struct with parameters for all vaults
    GeneralParameters public generalParameters;
    // rewardController determines how many rewards each pool gets in the incentive program
    ITokenLockFactory public tokenLockFactory;
    // feeSetter sets the withdrawal fee
    address public feeSetter;
    // address of the arbitrator - which can dispute claims and override the committee's decisions
    address public arbitrator;
    // the token into which a part of the the bounty will be swapped-into-and-burnt - this will
    // typically be HATs
    ERC20Burnable public swapToken;
    mapping(address => bool) public whitelistedRouters;

    event SetFeeSetter(address indexed _newFeeSetter);
    event SetChallengePeriod(uint256 _challengePeriod);
    event SetChallengeTimeOutPeriod(uint256 _challengeTimeOutPeriod);
    event SetArbitrator(address indexed _arbitrator);
    event SetWithdrawRequestParams(
        uint256 indexed _withdrawRequestPendingPeriod,
        uint256 indexed _withdrawRequestEnablePeriod
    );
    event SetClaimFee(uint256 _fee);
    event SetWithdrawSafetyPeriod(uint256 indexed _withdrawPeriod, uint256 indexed _safetyPeriod);
    event SetHatVestingParams(uint256 indexed _duration, uint256 indexed _periods);
    event SetMaxBountyDelay(uint256 indexed _delay);
    event RouterWhitelistStatusChanged(address indexed _router, bool _status);
    event VaultCreated(
        address indexed _pool,
        address indexed _lpToken,
        address _committee,
        IRewardController _rewardController,
        string _descriptionHash,
        uint256 _maxBounty,
        HATVault.BountySplit _bountySplit,
        uint256 _bountyVestingDuration,
        uint256 _bountyVestingPeriods
    );

    /**
    * @notice initialize -
    * @param _hatGovernance The governance address.
    * @param _swapToken the token that part of a payout will be swapped for
    * and burned - this would typically be HATs
    * @param _whitelistedRouters initial list of whitelisted routers allowed to
    * be used to swap tokens for HAT token.
    * @param _tokenLockFactory Address of the token lock factory to be used
    *        to create a vesting contract for the approved claim reporter.
    */
    constructor(
        address _hatVaultImplementation,
        address _hatGovernance,
        address _swapToken,
        address[] memory _whitelistedRouters,
        ITokenLockFactory _tokenLockFactory
    ) {
        _transferOwnership(_hatGovernance);
        hatVaultImplementation = _hatVaultImplementation;
        swapToken = ERC20Burnable(_swapToken);

        for (uint256 i = 0; i < _whitelistedRouters.length; i++) {
            whitelistedRouters[_whitelistedRouters[i]] = true;
        }
        tokenLockFactory = _tokenLockFactory;
        generalParameters = GeneralParameters({
            hatVestingDuration: 90 days,
            hatVestingPeriods: 90,
            withdrawPeriod: 11 hours,
            safetyPeriod: 1 hours,
            setMaxBountyDelay: 2 days,
            withdrawRequestEnablePeriod: 7 days,
            withdrawRequestPendingPeriod: 7 days,
            claimFee: 0
        });
        arbitrator = _hatGovernance;
        challengePeriod = 3 days;
        challengeTimeOutPeriod = 5 weeks;
    }

    function setFeeSetter(address _newFeeSetter) external onlyOwner {
        feeSetter = _newFeeSetter;
        emit SetFeeSetter(_newFeeSetter);
    }

   /**
     * @notice setArbitrator - called by hats governance to set arbitrator
     * @param _arbitrator New arbitrator.
    */
    function setArbitrator(address _arbitrator) external onlyOwner {
        arbitrator = _arbitrator;
        emit SetArbitrator(_arbitrator);
    }

    /**
    * @notice setWithdrawRequestParams - called by hats governance to set withdraw request params
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
     * @notice Called by hats governance to set fee for submitting a claim to any vault
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
     * @notice setWithdrawSafetyPeriod - called by hats governance to set Withdraw Period
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
    * @notice setHatVestingParams - set vesting params for rewarding claim reporters with rewardToken, for all pools
    * the function can be called only by governance.
    * @param _duration duration of the vesting period
    * @param _periods the vesting periods
    */
    function setHatVestingParams(uint256 _duration, uint256 _periods) external onlyOwner {
        if (_duration >= 180 days) revert VestingDurationTooLong();
        if (_periods == 0) revert VestingPeriodsCannotBeZero();
        if (_duration < _periods) revert VestingDurationSmallerThanPeriods();
        generalParameters.hatVestingDuration = _duration;
        generalParameters.hatVestingPeriods = _periods;
        emit SetHatVestingParams(_duration, _periods);
    }

    /**
    * @notice Set the timelock delay for setting the max bounty
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

    /**
    * @notice Add a new pool. Can be called only by governance.
    * @param _lpToken The pool's token
    * @param _committee The pool's committee addres
    * @param _maxBounty The pool's max bounty.
    * @param _bountySplit The way to split the bounty between the hacker, committee and governance.
        Each entry is a number between 0 and `HUNDRED_PERCENT`.
        Total splits should be equal to `HUNDRED_PERCENT`.
        Bounty must be specified for the hacker (direct or vested in pool's token).
    * @param _descriptionHash the hash of the pool description.
    * @param _bountyVestingParams vesting params for the bounty
    *        _bountyVestingParams[0] - vesting duration
    *        _bountyVestingParams[1] - vesting periods
    */

    function createVault(
        IERC20 _lpToken,
        address _committee,
        IRewardController _rewardController,
        uint256 _maxBounty,
        HATVault.BountySplit memory _bountySplit,
        string memory _descriptionHash,
        uint256[2] memory _bountyVestingParams,
        bool _isPaused
    ) 
    external 
    returns(address vault)
    {
        vault = Clones.clone(hatVaultImplementation);

        HATVault(vault).initialize(
            _rewardController,
            _bountyVestingParams[0],
            _bountyVestingParams[1],
            _maxBounty,
            _bountySplit,
            _lpToken,
            _committee,
            _isPaused
        );

        hatVaults.push(vault);

        emit VaultCreated(
            vault,
            address(_lpToken),
            _committee,
            _rewardController,
            _descriptionHash,
            _maxBounty,
            _bountySplit,
            _bountyVestingParams[0],
            _bountyVestingParams[1]
        );
    }

    function getGeneralParameters() external view returns(GeneralParameters memory) {
        return generalParameters;
    }

    function getNumberOfVaults() external view returns(uint256) {
        return hatVaults.length;
    }
}
