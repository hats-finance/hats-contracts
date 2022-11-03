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
 * @author Hats.finance
 * @notice Hats.finance is a proactive bounty protocol for white hat hackers and
 * security experts, where projects, community members, and stakeholders
 * incentivize protocol security and responsible disclosure.
 * Hats create scalable vaults using the project’s own token. The value of the
 * bounty increases with the success of the token and project.
 *
 * The owner of the registry has the permission to set time limits and bounty
 * parameters and change vaults' info, and to set the other registry roles -
 * fee setter and arbitrator.
 * The arbitrator can challenge submitted claims for bounty payouts made by
 * vaults' committees, approve them with a different bounty percentage or
 * dismiss them.
 * The fee setter can set the fee on withdrawals on all vaults.
 *
 * This project is open-source and can be found at:
 * https://github.com/hats-finance/hats-contracts
 *
 * @dev New hats.finance vaults should be created through a call to {createVault}
 * so that they are linked to the registry
 */
contract HATVaultsRegistry is IHATVaultsRegistry, Ownable {
    using SafeERC20 for IERC20;

    // Used in {swapAndSend} to avoid a "stack too deep" error
    struct SwapData {
        uint256 amount;
        uint256 amountUnused;
        uint256 hatsReceived;
        uint256 totalHackerReward;
        uint256 governanceAmountSwapped;
    }

    uint256 internal constant HUNDRED_PERCENT = 10000;
    // the maximum percentage of the bounty that will be converted in HATs
    uint256 internal constant MAX_HAT_SPLIT = 2000;

    address public immutable hatVaultImplementation;
    address[] public hatVaults;
    
    // vault address => is visible
    mapping(address => bool) public isVaultVisible;
    // asset => hacker address => amount
    mapping(address => mapping(address => uint256)) public hackersHatReward;
    // asset => amount
    mapping(address => uint256) public governanceHatReward;

    // PARAMETERS FOR ALL VAULTS
    IHATVaultsRegistry.GeneralParameters public generalParameters;
    ITokenLockFactory public immutable tokenLockFactory;
    // feeSetter sets the withdrawal fee
    address public feeSetter;

    // the token into which a part of the the bounty will be swapped into
    IERC20 public immutable HAT;

    // How the bountyGovernanceHAT and bountyHackerHATVested set how to divide the hats 
    // bounties of the vault, in percentages (out of `HUNDRED_PERCENT`)
    // The precentages are taken from the total bounty
 
    // the default percentage of the total bounty to be swapped to HATs and sent to governance
    uint256 public defaultBountyGovernanceHAT;
    // the default percentage of the total bounty to be swapped to HATs and sent to the hacker via vesting contract
    uint256 public defaultBountyHackerHATVested;

    uint256 public defaultChallengePeriod;
    uint256 public defaultChallengeTimeOutPeriod;
    address public defaultArbitrator;
    bool public defaultArbitratorCanChangeBounty;

    bool public isEmergencyPaused;

    /**
    * @notice initialize -
    * @param _hatVaultImplementation The hat vault implementation address.
    * @param _hatGovernance The governance address.
    * @param _HAT the HAT token address
    * @param _bountyGovernanceHAT The default percentage of a claim's total
    * bounty to be swapped for HAT and sent to the governance
    * @param _bountyHackerHATVested The default percentage of a claim's total
    * bounty to be swapped for HAT and sent to a vesting contract for the hacker
    *   _bountyGovernanceHAT + _bountyHackerHATVested must be less
    *    than `HUNDRED_PERCENT`.
    * @param _tokenLockFactory Address of the token lock factory to be used
    * to create a vesting contract for the approved claim reporter.
    */
    constructor(
        address _hatVaultImplementation,
        address _hatGovernance,
        address _HAT,
        uint256 _bountyGovernanceHAT,
        uint256 _bountyHackerHATVested,
        ITokenLockFactory _tokenLockFactory
    ) {
        _transferOwnership(_hatGovernance);
        hatVaultImplementation = _hatVaultImplementation;
        HAT = IERC20(_HAT);

        validateHATSplit(_bountyGovernanceHAT, _bountyHackerHATVested);
        tokenLockFactory = _tokenLockFactory;
        generalParameters = IHATVaultsRegistry.GeneralParameters({
            hatVestingDuration: 90 days,
            hatVestingPeriods: 90,
            withdrawPeriod: 11 hours,
            safetyPeriod: 1 hours,
            setMaxBountyDelay: 2 days,
            withdrawRequestEnablePeriod: 7 days,
            withdrawRequestPendingPeriod: 7 days,
            claimFee: 0
        });

        defaultBountyGovernanceHAT = _bountyGovernanceHAT;
        defaultBountyHackerHATVested = _bountyHackerHATVested;
        defaultArbitrator = _hatGovernance;
        defaultChallengePeriod = 3 days;
        defaultChallengeTimeOutPeriod = 5 weeks;
        defaultArbitratorCanChangeBounty = true;
    }

    /** @notice See {IHATVaultsRegistry-setEmergencyPaused}. */
    function setEmergencyPaused(bool _isEmergencyPaused) external onlyOwner {
        isEmergencyPaused = _isEmergencyPaused;
        emit SetEmergencyPaused(_isEmergencyPaused);
    }

    /** @notice See {IHATVaultsRegistry-logClaim}. */
    function logClaim(string calldata _descriptionHash) external payable {
        uint256 claimFee = generalParameters.claimFee;
        if (claimFee > 0) {
            if (msg.value < claimFee)
                revert NotEnoughFeePaid();
            // solhint-disable-next-line indent
            payable(owner()).transfer(msg.value);
        }
        emit LogClaim(msg.sender, _descriptionHash);
    }

    /** @notice See {IHATVaultsRegistry-setDefaultHATBountySplit}. */
    function setDefaultHATBountySplit(
        uint256 _defaultBountyGovernanceHAT,
        uint256 _defaultBountyHackerHATVested
    ) external onlyOwner {
        validateHATSplit(_defaultBountyGovernanceHAT, _defaultBountyHackerHATVested);
        defaultBountyGovernanceHAT = _defaultBountyGovernanceHAT;
        defaultBountyHackerHATVested = _defaultBountyHackerHATVested;
        emit SetDefaultHATBountySplit(_defaultBountyGovernanceHAT, _defaultBountyHackerHATVested);

    }
   
    /** @notice See {IHATVaultsRegistry-setDefaultArbitrator}. */
    function setDefaultArbitrator(address _defaultArbitrator) external onlyOwner {
        defaultArbitrator = _defaultArbitrator;
        emit SetDefaultArbitrator(_defaultArbitrator);
    }

    /** @notice See {IHATVaultsRegistry-setDefaultChallengePeriod}. */
    function setDefaultChallengePeriod(uint256 _defaultChallengePeriod) external onlyOwner {
        validateChallengePeriod(_defaultChallengePeriod);
        defaultChallengePeriod = _defaultChallengePeriod;
        emit SetDefaultChallengePeriod(_defaultChallengePeriod);
    }

    /** @notice See {IHATVaultsRegistry-setDefaultChallengeTimeOutPeriod}. */
    function setDefaultChallengeTimeOutPeriod(uint256 _defaultChallengeTimeOutPeriod) external onlyOwner {
        validateChallengeTimeOutPeriod(_defaultChallengeTimeOutPeriod);
        defaultChallengeTimeOutPeriod = _defaultChallengeTimeOutPeriod;
        emit SetDefaultChallengeTimeOutPeriod(_defaultChallengeTimeOutPeriod);
    }

    /** @notice See {IHATVaultsRegistry-setDefaultArbitratorCanChangeBounty}. */
    function setDefaultArbitratorCanChangeBounty(bool _defaultArbitratorCanChangeBounty) external onlyOwner {
        defaultArbitratorCanChangeBounty = _defaultArbitratorCanChangeBounty;
        emit SetDefaultArbitratorCanChangeBounty(_defaultArbitratorCanChangeBounty);
    }
   
    /** @notice See {IHATVaultsRegistry-setFeeSetter}. */
    function setFeeSetter(address _feeSetter) external onlyOwner {
        feeSetter = _feeSetter;
        emit SetFeeSetter(_feeSetter);
    }

    /** @notice See {IHATVaultsRegistry-setWithdrawRequestParams}. */
    function setWithdrawRequestParams(uint256 _withdrawRequestPendingPeriod, uint256  _withdrawRequestEnablePeriod)
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

    /** @notice See {IHATVaultsRegistry-setClaimFee}. */
    function setClaimFee(uint256 _fee) external onlyOwner {
        generalParameters.claimFee = _fee;
        emit SetClaimFee(_fee);
    }

    /** @notice See {IHATVaultsRegistry-setWithdrawSafetyPeriod}. */
    function setWithdrawSafetyPeriod(uint256 _withdrawPeriod, uint256 _safetyPeriod) external onlyOwner { 
        if (_withdrawPeriod < 1 hours) revert WithdrawPeriodTooShort();
        if (_safetyPeriod > 6 hours) revert SafetyPeriodTooLong();
        generalParameters.withdrawPeriod = _withdrawPeriod;
        generalParameters.safetyPeriod = _safetyPeriod;
        emit SetWithdrawSafetyPeriod(_withdrawPeriod, _safetyPeriod);
    }

    /** @notice See {IHATVaultsRegistry-setHatVestingParams}. */
    function setHatVestingParams(uint256 _duration, uint256 _periods) external onlyOwner {
        if (_duration >= 180 days) revert HatVestingDurationTooLong();
        if (_periods == 0) revert HatVestingPeriodsCannotBeZero();
        if (_duration < _periods) revert HatVestingDurationSmallerThanPeriods();
        generalParameters.hatVestingDuration = _duration;
        generalParameters.hatVestingPeriods = _periods;
        emit SetHatVestingParams(_duration, _periods);
    }

    /** @notice See {IHATVaultsRegistry-setMaxBountyDelay}. */
    function setMaxBountyDelay(uint256 _delay) external onlyOwner {
        if (_delay < 2 days) revert DelayTooShort();
        generalParameters.setMaxBountyDelay = _delay;
        emit SetMaxBountyDelay(_delay);
    }

    /** @notice See {IHATVaultsRegistry-createVault}. */
    function createVault(
        IERC20 _asset,
        address _owner,
        address _committee,
        IRewardController _rewardController,
        uint256 _maxBounty,
        HATVault.BountySplit calldata _bountySplit,
        string calldata _descriptionHash,
        uint256 _bountyVestingDuration,
        uint256 _bountyVestingPeriods,
        bool _isPaused
    ) 
    external 
    returns(address vault)
    {
        vault = Clones.clone(hatVaultImplementation);

        HATVault(vault).initialize(
            IHATVault.VaultInitParams({
                rewardController: _rewardController,
                vestingDuration: _bountyVestingDuration,
                vestingPeriods: _bountyVestingPeriods,
                maxBounty: _maxBounty,
                bountySplit: _bountySplit,
                asset: _asset,
                owner: _owner,
                committee: _committee,
                isPaused: _isPaused,
                descriptionHash: _descriptionHash
            })
        );

        hatVaults.push(vault);

        emit VaultCreated(
            vault,
            address(_asset),
            _committee,
            _rewardController,
            _maxBounty,
            _bountySplit,
            _descriptionHash,
            _bountyVestingDuration,
            _bountyVestingPeriods,
            _isPaused
        );
    }

    /** @notice See {IHATVaultsRegistry-setVaultVisibility}. */
    function setVaultVisibility(address _vault, bool _visible) external onlyOwner {
        isVaultVisible[_vault] = _visible;
        emit SetVaultVisibility(_vault, _visible);
    }

    /** @notice See {IHATVaultsRegistry-addTokensToSwap}. */
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

    /** @notice See {IHATVaultsRegistry-swapAndSend}. */
    function swapAndSend(
        address _asset,
        address[] calldata _beneficiaries,
        uint256 _amountOutMinimum,
        address _routingContract,
        bytes calldata _routingPayload
    ) external onlyOwner {
        // Needed to avoid a "stack too deep" error
        SwapData memory swapData;
        swapData.amount = governanceHatReward[_asset];
        mapping(address => uint256) storage _assetHackersHatReward = hackersHatReward[_asset];

        for (uint256 i; i < _beneficiaries.length;) {
            swapData.amount += _assetHackersHatReward[_beneficiaries[i]];
            unchecked {
                ++i;
            }
        }
        if (swapData.amount == 0) revert AmountToSwapIsZero();
        IERC20 _HAT = HAT;
        (swapData.hatsReceived, swapData.amountUnused) = _swapTokenForHAT(IERC20(_asset), swapData.amount, _amountOutMinimum, _routingContract, _routingPayload);
        
        uint256 governanceHatRewardAsset = governanceHatReward[_asset];
        uint256 calcSwap = (swapData.amount - swapData.amountUnused) / swapData.amount;
        swapData.governanceAmountSwapped = calcSwap * governanceHatRewardAsset;
        governanceHatReward[_asset] = swapData.amountUnused * governanceHatRewardAsset / swapData.amount;

        for (uint256 i; i < _beneficiaries.length;) {
            address _beneficiary = _beneficiaries[i];
            uint256 _hackersHatReward = _assetHackersHatReward[_beneficiary];
            uint256 hackerReward = swapData.hatsReceived * _hackersHatReward / swapData.amount;
            uint256 hackerAmountSwapped = calcSwap * _hackersHatReward;
            swapData.totalHackerReward += hackerReward;
            _assetHackersHatReward[_beneficiary] = swapData.amountUnused * _hackersHatReward / swapData.amount;
            unchecked {
                address tokenLock;
                if (hackerReward > 0) {
                    // hacker gets her reward via vesting contract
                        tokenLock = tokenLockFactory.createTokenLock(
                            address(_HAT),
                            0x0000000000000000000000000000000000000000, //this address as owner, so it can do nothing.
                            _beneficiary,
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
                emit SwapAndSend(_beneficiary, hackerAmountSwapped, hackerReward, tokenLock);
                ++i;
            }
        }
        address _owner = owner();
        uint256 amountSent = swapData.hatsReceived - swapData.totalHackerReward;
        _HAT.safeTransfer(_owner, amountSent);
        emit SwapAndSend(_owner, swapData.governanceAmountSwapped, amountSent, address(0));

    }

    /** @notice See {IHATVaultsRegistry-getGeneralParameters}. */   
    function getGeneralParameters() external view returns (GeneralParameters memory) {
        return generalParameters;
    }

    /** @notice See {IHATVaultsRegistry-getNumberOfVaults}. */
    function getNumberOfVaults() external view returns(uint256) {
        return hatVaults.length;
    }

    /** @notice See {IHATVaultsRegistry-validateHATSplit}. */
    function validateHATSplit(uint256 _bountyGovernanceHAT, uint256 _bountyHackerHATVested) public pure {
        if (_bountyGovernanceHAT + _bountyHackerHATVested > MAX_HAT_SPLIT)
            revert TotalHatsSplitPercentageShouldBeUpToMaxHATSplit();
    }

    /** @notice See {IHATVaultsRegistry-validateChallengePeriod}. */
    function validateChallengePeriod(uint256 _challengePeriod) public pure {
        if (_challengePeriod < 1 days) revert ChallengePeriodTooShort();
        if (_challengePeriod > 5 days) revert ChallengePeriodTooLong();
    }

    /** @notice See {IHATVaultsRegistry-validateChallengeTimeOutPeriod}. */
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
