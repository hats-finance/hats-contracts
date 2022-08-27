// SPDX-License-Identifier: MIT
// Disclaimer https://github.com/hats-finance/hats-contracts/blob/main/DISCLAIMER.md

pragma solidity 0.8.16;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "./tokenlock/TokenLockFactory.sol";
import "./interfaces/IRewardController.sol";
import "./interfaces/IHATVaultsRegistry.sol";
import "./HATVault.sol";

/** @title Registry to deploy Hats.finance vaults and manage shared parameters
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
* FeeSetter - The only address which can set the fee on withdrawals on all
* vaults.
*
* This project is open-source and can be found at:
* https://github.com/hats-finance/hats-contracts
*/
contract HATVaultsRegistry is IHATVaultsRegistry, Ownable {
    using SafeERC20 for IERC20;

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

    // How to divide the HAT part of bounties, in percentages (out of {HUNDRED_PERCENT})
    // The precentages are taken from the total bounty
    struct HATBountySplit {
        // the percentage of the total bounty to be swapped to HATs and sent to governance
        uint256 governanceHat;
        // the percentage of the total bounty to be swapped to HATs and sent to the hacker via vesting contract
        uint256 hackerHatVested;
    }

    // Used in {swapAndSend} to avoid a "stack too deep" error
    struct SwapData {
        uint256 totalHackersHatReward;
        uint256 amount;
        uint256 amountUnused;
        uint256 hatsReceived;
        uint256 totalHackerReward;
    }

    uint256 public constant HUNDRED_PERCENT = 10000;

    address public immutable hatVaultImplementation;
    address[] public hatVaults;
    mapping(address => bool) public isVaultVisible;

    // PARAMETERS FOR ALL VAULTS
    // a struct with parameters for all vaults
    GeneralParameters public generalParameters;
    ITokenLockFactory public immutable tokenLockFactory;
    // feeSetter sets the withdrawal fee
    address public feeSetter;

    // the token into which a part of the the bounty will be swapped into
    IERC20 public immutable HAT;

    // asset => hacker address => amount
    mapping(address => mapping(address => uint256)) public hackersHatReward;
    // asset => amount
    mapping(address => uint256) public governanceHatReward;

    HATBountySplit public defaultHATBountySplit;

    address public defaultArbitrator;
    uint256 public defaultChallengePeriod;
    uint256 public defaultChallengeTimeOutPeriod;

    bool public isEmergencyPaused;

    /**
    * @notice initialize -
    * @param _hatVaultImplementation The hat vault implementation address.
    * @param _hatGovernance The governance address.
    * @param _HAT the HAT token address
    * @param _defaultHATBountySplit The default way to split the hat bounty betweeen
    * the hacker and the governance
    *   Each entry is a number between 0 and `HUNDRED_PERCENT`.
    *   Total splits should be less than `HUNDRED_PERCENT`.
    * @param _tokenLockFactory Address of the token lock factory to be used
    * to create a vesting contract for the approved claim reporter.
    */
    constructor(
        address _hatVaultImplementation,
        address _hatGovernance,
        address _HAT,
        HATBountySplit memory _defaultHATBountySplit,
        ITokenLockFactory _tokenLockFactory
    ) {
        _transferOwnership(_hatGovernance);
        hatVaultImplementation = _hatVaultImplementation;
        HAT = IERC20(_HAT);

        validateHATSplit(_defaultHATBountySplit);
        defaultHATBountySplit = _defaultHATBountySplit;
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

        defaultArbitrator = _hatGovernance;
        defaultChallengePeriod = 3 days;
        defaultChallengeTimeOutPeriod = 5 weeks;
    }

    /**
    * @notice Called by governance to pause/unpause the system in case of an emergency
    * @param _isEmergencyPaused Is the system in an emergency pause
    */
    function setEmergencyPaused(bool _isEmergencyPaused) external onlyOwner {
        isEmergencyPaused = _isEmergencyPaused;
        emit SetEmergencyPaused(_isEmergencyPaused);
    }

    /**
    * @notice emit an event that includes the given _descriptionHash
    * This can be used by the claimer as evidence that she had access to the information at the time of the call
    * if a claimFee > 0, the caller must send claimFee Ether for the claim to succeed
    * @param _descriptionHash - a hash of an ipfs encrypted file which describes the claim.
    */
    function logClaim(string memory _descriptionHash) external payable {
        if (generalParameters.claimFee > 0) {
            if (msg.value < generalParameters.claimFee)
                revert NotEnoughFeePaid();
            // solhint-disable-next-line indent
            payable(owner()).transfer(msg.value);
        }
        emit LogClaim(msg.sender, _descriptionHash);
    }

    /**
    * @notice Called by governance to set the default HAT token bounty split upon
    * an approval. This default value is used when creating a new vault.
    * @param _defaultHATBountySplit The HAT bounty split
    */
    function setDefaultHATBountySplit(HATBountySplit memory _defaultHATBountySplit) external onlyOwner {
        validateHATSplit(_defaultHATBountySplit);
        defaultHATBountySplit = _defaultHATBountySplit;
        emit SetDefaultHATBountySplit(_defaultHATBountySplit);
    }

    /**
    * @notice Called by governance to set the default arbitrator.
    * @param _defaultArbitrator The default arbitrator address
    */
    function setDefaultArbitrator(address _defaultArbitrator) external onlyOwner {
        defaultArbitrator = _defaultArbitrator;
        emit SetDefaultArbitrator(_defaultArbitrator);
    }

    /**
    * @notice Called by governance to set the default challenge period
    * @param _defaultChallengePeriod The default challenge period
    */
    function setDefaultChallengePeriod(uint256 _defaultChallengePeriod) external onlyOwner {
        validateChallengePeriod(_defaultChallengePeriod);
        defaultChallengePeriod = _defaultChallengePeriod;
        emit SetDefaultChallengePeriod(_defaultChallengePeriod);
    }

    /**
    * @notice Called by governance to set the default challenge timeout
    * @param _defaultChallengeTimeOutPeriod The Default challenge timeout
    */
    function setDefaultChallengeTimeOutPeriod(uint256 _defaultChallengeTimeOutPeriod) external onlyOwner {
        validateChallengeTimeOutPeriod(_defaultChallengeTimeOutPeriod);
        defaultChallengeTimeOutPeriod = _defaultChallengeTimeOutPeriod;
        emit SetDefaultChallengeTimeOutPeriod(_defaultChallengeTimeOutPeriod);
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
    * @notice Called by governance to set time limits for withdraw requests
    * @param _withdrawRequestPendingPeriod Time period where the withdraw
    * request is pending
    * @param _withdrawRequestEnablePeriod Time period after the peding period
    * has ended during which withdrawal is enabled
    */
    function setWithdrawRequestParams(
        uint256 _withdrawRequestPendingPeriod, 
        uint256  _withdrawRequestEnablePeriod
    )
        external
        onlyOwner
    {
        if (_withdrawRequestPendingPeriod > 90 days)
            revert WithdrawRequestPendingPeriodTooLong();
        if (_withdrawRequestEnablePeriod < 6 hours)
            revert WithdrawRequestEnabledPeriodTooShort();
        if (_withdrawRequestEnablePeriod > 100 days)
            revert WithdrawRequestEnabledPeriodTooLong();
        generalParameters.withdrawRequestPendingPeriod = _withdrawRequestPendingPeriod;
        generalParameters.withdrawRequestEnablePeriod = _withdrawRequestEnablePeriod;
        emit SetWithdrawRequestParams(_withdrawRequestPendingPeriod, _withdrawRequestEnablePeriod);
    }

    /**
    * @notice Called by governance to set the fee for logging a claim for a
    * bounty in any vault.
    * @param _fee Claim fee in ETH to be transferred on any call of {logClaim}
    */
    function setClaimFee(uint256 _fee) external onlyOwner {
        generalParameters.claimFee = _fee;
        emit SetClaimFee(_fee);
    }

    /**
    * @notice Called by governance to set the withdraw period and safety
    * period, which are always interchanging.
    * The safety period is time that the committee can submit claims for 
    * bounty payouts, and during which withdrawals are disabled and the bounty
    * split cannot be changed.
    * @param _withdrawPeriod Amount of time during which withdrawals are
    * enabled, and the bounty split can be changed by the governance. Must be
    * at least 1 hour.
    * @param _safetyPeriod Amount of time during which claims for bounties 
    * can be submitted and withdrawals are disabled. Must be at most 6 hours.
    */
    function setWithdrawSafetyPeriod(
        uint256 _withdrawPeriod,
        uint256 _safetyPeriod
    ) 
        external
        onlyOwner
    {
        if (_withdrawPeriod < 1 hours) revert WithdrawPeriodTooShort();
        if (_safetyPeriod > 6 hours) revert SafetyPeriodTooLong();
        generalParameters.withdrawPeriod = _withdrawPeriod;
        generalParameters.safetyPeriod = _safetyPeriod;
        emit SetWithdrawSafetyPeriod(_withdrawPeriod, _safetyPeriod);
    }

    /**
    * @notice Called by governance to set vesting params for rewarding hackers
    * with rewardToken, for all vaults
    * @param _duration Duration of the vesting period. Must be less than 180 
    * days.
    * @param _periods The number of vesting periods. Must be more than 0 and 
    * less then the vesting duration.
    */
    function setHatVestingParams(uint256 _duration, uint256 _periods) 
        external
        onlyOwner
    {
        if (_duration >= 180 days) revert HatVestingDurationTooLong();
        if (_periods == 0) revert HatVestingPeriodsCannotBeZero();
        if (_duration < _periods) revert HatVestingDurationSmallerThanPeriods();
        generalParameters.hatVestingDuration = _duration;
        generalParameters.hatVestingPeriods = _periods;
        emit SetHatVestingParams(_duration, _periods);
    }

    /**
    * @notice Called by governance to set the timelock delay for setting the
    * max bounty (the time between setPendingMaxBounty and setMaxBounty)
    * @param _delay The time period for the delay. Must be at least 2 days.
    */
    function setMaxBountyDelay(uint256 _delay) external onlyOwner {
        if (_delay < 2 days) revert DelayTooShort();
        generalParameters.setMaxBountyDelay = _delay;
        emit SetMaxBountyDelay(_delay);
    }

    /**
    * @notice Create a new vault
    * @param _asset The vault's native token
    * @param _committee The address of the vault's committee 
    * @param _rewardController The reward controller for the vault
    * @param _maxBounty The maximum percentage of the vault that can be paid
    * out as a bounty. Must be between 0 and `HUNDRED_PERCENT`
    * @param _bountySplit The way to split the bounty between the hacker, 
    * hacker vested, and committee.
    *   Each entry is a number between 0 and `HUNDRED_PERCENT`.
    *   Total splits should be equal to `HUNDRED_PERCENT`.
    * @param _descriptionHash Hash of the vault description.
    * @param _bountyVestingParams Vesting params for the part of the bounty
    * that is paid vested in the vault's native token:
    *        _bountyVestingParams[0] - vesting duration
    *        _bountyVestingParams[1] - vesting periods
    * @param _isPaused Whether to initialize the vault with deposits disabled
    * @return vault The address of the new vault
    */
    function createVault(
        IERC20 _asset,
        address _owner,
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
            HATVault.VaultInitParams({
                rewardController: _rewardController,
                vestingDuration: _bountyVestingParams[0],
                vestingPeriods: _bountyVestingParams[1],
                maxBounty: _maxBounty,
                bountySplit: _bountySplit,
                asset: _asset,
                owner: _owner,
                committee: _committee,
                isPaused: _isPaused
            })
        );

        hatVaults.push(vault);

        emit CreateVault(
            vault,
            address(_asset),
            _committee,
            _rewardController,
            _maxBounty,
            _bountySplit,
            _descriptionHash,
            _bountyVestingParams[0],
            _bountyVestingParams[1]
        );
    }

    /**
    * @notice Called by governance to change the UI visibility of a vault
    * @param _vault The address of the vault to update
    * @param _visible Is this vault visible in the UI
    * This parameter can be used by the UI to include or exclude the vault
    */
    function setVaultVisibility(address _vault, bool _visible) external onlyOwner {
        isVaultVisible[_vault] = _visible;
        emit SetVaultVisibility(_vault, _visible);
    }

    /**
    * @notice Transfer the part of the bounty that is supposed to be swapped
    * into HAT tokens from the HATVault to the registry, and keep track of the
    * amounts to be swapped and sent/burnt in a later transaction
    * @param _asset The vault's native token
    * @param _hacker The address of the beneficiary of the bounty
    * @param _hackersHatReward The amount of the vault's native token to be
    * swapped to HAT tokens and sent to the hacker via a vesting contract
    * @param _governanceHatReward The amount of the vault's native token to be
    * swapped to HAT tokens and sent to governance
    */
    function addTokensToSwap(
        IERC20 _asset,
        address _hacker,
        uint256 _hackersHatReward,
        uint256 _governanceHatReward
    ) external {
        uint256 amount = _hackersHatReward + _governanceHatReward;
        hackersHatReward[address(_asset)][_hacker] += _hackersHatReward;
        governanceHatReward[address(_asset)] += _governanceHatReward;
        _asset.safeTransferFrom(msg.sender, address(this), amount);
    }

    /**
    * @notice Called by governance to swap the given asset to HAT tokens and 
    * distribute the HAT tokens: Send to governance their share and send to
    * beneficiaries their share through a vesting contract.
    * @param _asset The address of the token to be swapped to HAT tokens
    * @param _beneficiaries Addresses of beneficiaries
    * @param _amountOutMinimum Minimum amount of HAT tokens at swap
    * @param _routingContract Routing contract to call for the swap
    * @param _routingPayload Payload to send to the _routingContract for the
    * swap
    */
    function swapAndSend(
        address _asset,
        address[] calldata _beneficiaries,
        uint256 _amountOutMinimum,
        address _routingContract,
        bytes calldata _routingPayload
    ) external onlyOwner {
        // Needed to avoid a stack too deep error
        SwapData memory swapData;
        for (uint256 i = 0; i < _beneficiaries.length; i++) {
            swapData.totalHackersHatReward += hackersHatReward[_asset][_beneficiaries[i]];
        }
        swapData.amount = swapData.totalHackersHatReward + governanceHatReward[_asset];
        if (swapData.amount == 0) revert AmountToSwapIsZero();
        IERC20 _HAT = HAT;
        (swapData.hatsReceived, swapData.amountUnused) = _swapTokenForHAT(IERC20(_asset), swapData.amount, _amountOutMinimum, _routingContract, _routingPayload);

        governanceHatReward[_asset] = swapData.amountUnused * governanceHatReward[_asset] / swapData.amount;

        for (uint256 i = 0; i < _beneficiaries.length; i++) {
            uint256 hackerReward = swapData.hatsReceived * hackersHatReward[_asset][_beneficiaries[i]] / swapData.amount;
            swapData.totalHackerReward += hackerReward;
            hackersHatReward[_asset][_beneficiaries[i]] = swapData.amountUnused * hackersHatReward[_asset][_beneficiaries[i]] / swapData.amount;
            address tokenLock;
            if (hackerReward > 0) {
                // hacker gets her reward via vesting contract
                tokenLock = tokenLockFactory.createTokenLock(
                    address(_HAT),
                    0x0000000000000000000000000000000000000000, //this address as owner, so it can do nothing.
                    _beneficiaries[i],
                    hackerReward,
                    // solhint-disable-next-line not-rely-on-time
                    block.timestamp, //start
                    // solhint-disable-next-line not-rely-on-time
                    block.timestamp + generalParameters.hatVestingDuration, //end
                    generalParameters.hatVestingPeriods,
                    0, // no release start
                    0, // no cliff
                    ITokenLock.Revocability.Disabled,
                    true
                );
                _HAT.safeTransfer(tokenLock, hackerReward);
            }
            emit SwapAndSend(_beneficiaries[i], hackersHatReward[_asset][_beneficiaries[i], hackerReward, tokenLock);
        }
        _HAT.safeTransfer(owner(), swapData.hatsReceived - swapData.totalHackerReward);
    }

    /**
    * @notice Returns the general parameters for all vaults
    * @return generalParameters: See { HATVaultsRegistry-generalParameters }
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

    /** 
    * @dev Check that a given hats bounty split is legal, meaning that:
    *   Each entry is a number between 0 and less than `HUNDRED_PERCENT`.
    *   Total splits should be less than `HUNDRED_PERCENT`.
    * function will revert in case the bounty split is not legal.
    * @param _hatBountySplit The bounty split to check
    */
    function validateHATSplit(HATBountySplit memory _hatBountySplit) public pure {
        if (_hatBountySplit.governanceHat +
            _hatBountySplit.hackerHatVested >= HUNDRED_PERCENT)
            revert TotalHatsSplitPercentageShouldBeLessThanHundredPercent();
    }

   /**
     * @notice Check that the given challenge period is legal, meaning
     * that it is greater than 1 day and less than 5 days.
     * @param _challengeTimeOutPeriod The challenge timeout period to check
     */
    function validateChallengePeriod(uint256 _challengePeriod) public pure {
        if ( _challengePeriod < 1 days) revert ChallengePeriodTooShort();
        if (_challengePeriod > 5 days) revert ChallengePeriodTooLong();
    }

    /**
     * @notice Check that the given challenge timeout period is legal, meaning
     * that it is greater than 2 days and less than 85 days.
     * @param _challengeTimeOutPeriod The challenge timeout period to check
     */
    function validateChallengeTimeOutPeriod(uint256 _challengeTimeOutPeriod) public pure {
        if (_challengeTimeOutPeriod < 2 days) revert ChallengeTimeOutPeriodTooShort();
        if (_challengeTimeOutPeriod > 85 days) revert ChallengeTimeOutPeriodTooLong();
    }
    
    /**
    * @dev Use the given routing contract to swap the given token to HAT token
    * @param _asset The token to swap
    * @param _amount Amount of token to swap
    * @param _amountOutMinimum Minimum amount of HAT tokens at swap
    * @param _routingContract Routing contract to call for the swap
    * @param _routingPayload Payload to send to the _routingContract for the 
    * swap
    */
    function _swapTokenForHAT(
        IERC20 _asset,
        uint256 _amount,
        uint256 _amountOutMinimum,
        address _routingContract,
        bytes calldata _routingPayload)
    internal
    returns (uint256 hatsReceived, uint256 amountUnused)
    {
        IERC20 _HAT = HAT;
        if (_asset == _HAT) {
            return (_amount, 0);
        }

        IERC20(_asset).safeApprove(_routingContract, _amount);
        uint256 balanceBefore = _HAT.balanceOf(address(this));
        uint256 assetBalanceBefore = _asset.balanceOf(address(this));

        // solhint-disable-next-line avoid-low-level-calls
        (bool success,) = _routingContract.call(_routingPayload);
        if (!success) revert SwapFailed();
        hatsReceived = _HAT.balanceOf(address(this)) - balanceBefore;
        amountUnused = _amount - (assetBalanceBefore - _asset.balanceOf(address(this)));
        if (hatsReceived < _amountOutMinimum)
            revert AmountSwappedLessThanMinimum();
            
        IERC20(_asset).safeApprove(address(_routingContract), 0);
    }
}
