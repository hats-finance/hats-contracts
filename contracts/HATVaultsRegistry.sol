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

/**  @title Registry to manage all Hats.finance vaults
* @author hats.finance
* @notice Hats.finance is a proactive bounty protocol for white hat hackers
* and auditors, where projects, community members, and stakeholders
* incentivize protocol security and responsible disclosure.
* Hats create scalable vaults using the project’s own token. The value of the
* bounty increases with the success of the token and project.
*
* The HATVaultsRegistry defines a few roles which are relevant to all vaults:
* Governance - The owner of HATVaultsRegistry and every HATVault created, has
* the permission to set the feeSetter and arbitrator roles, to set time limits
* and bounty parameters and change vaults' info.
* Arbitrator - Can challenge submitted claims for bounty payouts, approve them
* with a different bounty percentage or dismiss them.
* FeeSetter - The only address which can set the fee on withdrawals from all
* vaults.
*
* This project is open-source and can be found at:
* https://github.com/hats-finance/hats-contracts
*/
contract HATVaultsRegistry is Ownable, ReentrancyGuard {

    struct GeneralParameters {
        // vesting duration for the part of the bounty given to the hacker in HAT tokens
        uint256 hatVestingDuration;
        // vesting periods for the part of the bounty given to the hacker in HAT tokens
        uint256 hatVestingPeriods;
        // withdraw enable period. safetyPeriod starts when finished.
        uint256 withdrawPeriod;
        // withdraw disable period - time for the committee to gather and decide on actions,
        // withdrawals are not possible in this time. withdrawPeriod starts when finished.
        uint256 safetyPeriod;
        // period of time after withdrawRequestPendingPeriod where it is possible to withdraw
        // (after which withdrawals are not possible)
        uint256 withdrawRequestEnablePeriod;
        // period of time that has to pass after withdraw request until withdraw is possible
        uint256 withdrawRequestPendingPeriod;
        // period of time that has to pass after setting a pending max
        // bounty before it can be set as the new max bounty
        uint256 setMaxBountyDelay;
        // fee in ETH to be transferred with every logging of a claim
        uint256 claimFee;  
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
        address indexed _vault,
        address indexed _asset,
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
    * @param _hatVaultImplementation The hat vault implementation address.
    * @param _hatGovernance The governance address.
    * @param _swapToken The token that part of a payout will be swapped for
    * and burned - this would typically be HATs
    * @param _whitelistedRouters Initial list of whitelisted routers allowed
    * to be used to swap tokens for HAT token.
    * @param _tokenLockFactory Address of the token lock factory to be used
    * to create a vesting contract for the approved claim reporter.
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

    /**
    * @notice Called by governance to set the fee setter role
    * @param _feeSetter Address of new fee setter
    */
    function setFeeSetter(address _feeSetter) external onlyOwner {
        feeSetter = _feeSetter;
        emit SetFeeSetter(_feeSetter);
    }

    /**
    * @notice Called by governance to set the arbitrator role
    * @param _arbitrator Address of new arbitrator
    */
    function setArbitrator(address _arbitrator) external onlyOwner {
        arbitrator = _arbitrator;
        emit SetArbitrator(_arbitrator);
    }

    /**
    * @notice Called by governance to set time limits for withdraw requests
    * @param _withdrawRequestPendingPeriod Time period where the withdraw
    * request is pending
    * @param _withdrawRequestEnablePeriod Time period after the peding period
    * has ended during which withdrawal is enabled
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
    * @notice Called by governance to set the fee for logging a claim for a
    * bounty in any vault.
    * @param _fee Claim fee in ETH to be transferred on any call of logClaim
    */
    function setClaimFee(uint256 _fee) external onlyOwner {
        generalParameters.claimFee = _fee;
        emit SetClaimFee(_fee);
    }

    /**
    * @notice Called by governance to set the time during which a claim can be
    * challenged by the arbitrator
    * @param _challengePeriod Time period after claim submittion during
    * which the claim can be challenged
    */
    function setChallengePeriod(uint256 _challengePeriod) external onlyOwner {
        challengePeriod = _challengePeriod;
        emit SetChallengePeriod(_challengePeriod);
    }

    /**
    * @notice Called by governance to set time after which a challenged claim 
    * is automatically dismissed
    * @param _challengeTimeOutPeriod Time period after claim has been
    * challenged where the only possible action is dismissal
    */
    function setChallengeTimeOutPeriod(uint256 _challengeTimeOutPeriod) external onlyOwner {
        challengeTimeOutPeriod = _challengeTimeOutPeriod;
        emit SetChallengeTimeOutPeriod(_challengeTimeOutPeriod);
    }

    /**
    * @notice Called by governance to set the withdraw period and safety
    * period, which are always interchanging.
    * The safety period is time for the committee to gather and decide on
    * actions, during which withdrawals are disabled.
    * @param _withdrawPeriod Amount of time during which withdrawals are
    * enabled, and the bounty split can be changed by the governance. Must be
    * at least 1 hour.
    * @param _safetyPeriod Amount of time during which claims for bounties 
    * can be submitted and withdrawals are disabled. Must be at most 6 hours.
    */
    function setWithdrawSafetyPeriod(uint256 _withdrawPeriod, uint256 _safetyPeriod) external onlyOwner {
        if (1 hours > _withdrawPeriod) revert WithdrawPeriodTooShort();
        if (_safetyPeriod > 6 hours) revert SafetyPeriodTooLong();
        generalParameters.withdrawPeriod = _withdrawPeriod;
        generalParameters.safetyPeriod = _safetyPeriod;
        emit SetWithdrawSafetyPeriod(_withdrawPeriod, _safetyPeriod);
    }

    /**
    * @notice Called by governance to set vesting params for rewarding claim
    * reporters with rewardToken, for all vaults
    * @param _duration Duration of the vesting period. Must be less then 180 days.
    * @param _periods The number of vesting periods. Must be more then 0 and 
    * less then the vesting duration.
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
    * @notice Called by governance to set the timelock delay for setting the
    * max bounty (the time between setPendingMaxBounty and setMaxBounty)
    * @param _delay The time period for the delay. Must be at least 2 days.
    */
    function setMaxBountyDelay(uint256 _delay)
    external
    onlyOwner {
        if (_delay < 2 days) revert DelayTooShort();
        generalParameters.setMaxBountyDelay = _delay;
        emit SetMaxBountyDelay(_delay);
    }

    /**
    * @notice Called by governance to add or remove address from the whitelist
    * of routers that can be used for token swapping.
    * @param _router The address of the swapping router
    * @param _isWhitelisted Is this router approved to be used for swapping
    */
    function setRouterWhitelistStatus(address _router, bool _isWhitelisted) external onlyOwner {
        whitelistedRouters[_router] = _isWhitelisted;
        emit RouterWhitelistStatusChanged(_router, _isWhitelisted);
    }

    /**
    * @notice Create a new vault
    * @param _asset The vault's token
    * @param _committee The address of the vault's committee 
    * @param _rewardController The reward controller for the vault
    * @param _maxBounty The maximum percentage of the vault that can be paid
    * out as a bounty. Must be between 0 and `HUNDRED_PERCENT`
    * @param _bountySplit The way to split the bounty between the hacker, 
    * committee and governance.
    *   Each entry is a number between 0 and `HUNDRED_PERCENT`.
    *   Total splits should be equal to `HUNDRED_PERCENT`.
    *   Bounty larger then 0 must be specified for the hacker (direct or 
    *   vested in vault's token).
    * @param _descriptionHash Hash of the vault description.
    * @param _bountyVestingParams Vesting params for the bounty
    *        _bountyVestingParams[0] - vesting duration
    *        _bountyVestingParams[1] - vesting periods
    * @param _isPaused Whether to initialize the vault with deposits disabled
    * @return The address of the new vault
    */
    function createVault(
        IERC20 _asset,
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
            _asset,
            _committee,
            _isPaused
        );

        hatVaults.push(vault);

        emit VaultCreated(
            vault,
            address(_asset),
            _committee,
            _rewardController,
            _descriptionHash,
            _maxBounty,
            _bountySplit,
            _bountyVestingParams[0],
            _bountyVestingParams[1]
        );
    }

    /**
    * @notice Returns the general parameters for all vaults
    * @return generalParameters: 
    *   hatVestingDuration - vesting duration for the part of the bounty given
    *   to the hacker in HAT tokens
    *   hatVestingPeriods - vesting periods for the part of the bounty given
    *   to the hacker in HAT tokens
    *   withdrawPeriod - withdraw enable period. safetyPeriod starts when
    *   finished.
    *   safetyPeriod - withdraw disable period - time for the committee to
    *   gather and decide on actions, withdrawals are not possible in this
    *   time. withdrawPeriod starts when finished.
    *   withdrawRequestEnablePeriod - period of time after 
    *   withdrawRequestPendingPeriod where it is possible to withdraw (after 
    *   which withdrawals are not possible)
    *   withdrawRequestPendingPeriod - period of time that has to pass after
    *   withdraw request until withdraw is possible
    *   setMaxBountyDelay - period of time that has to pass after setting a
    *   pending max bounty before it can be set as the new max bounty
    *   claimFee - fee in ETH to be transferred with every logging of a claim
    */
    function getGeneralParameters() external view returns(GeneralParameters memory) {
        return generalParameters;
    }

    /**
    * @notice Returns the number of vaults that have been previously created 
    */
    function getNumberOfVaults() external view returns(uint256) {
        return hatVaults.length;
    }
}
