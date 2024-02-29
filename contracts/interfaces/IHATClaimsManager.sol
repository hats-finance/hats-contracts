// SPDX-License-Identifier: MIT
// Disclaimer https://github.com/hats-finance/hats-contracts/blob/main/DISCLAIMER.md

pragma solidity 0.8.16;

import "@openzeppelin/contracts-upgradeable/interfaces/IERC4626Upgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./IRewardController.sol";
import "./IHATVault.sol";
import "./IHATVaultsRegistry.sol";

/** @title Interface for Hats.finance Vaults
 * @author Hats.finance
 * @notice A HATVault holds the funds for a specific project's bug bounties.
 * Anyone can permissionlessly deposit into the HATVault using
 * the vault’s native token. When a bug is submitted and approved, the bounty 
 * is paid out using the funds in the vault. Bounties are paid out as a
 * percentage of the vault. The percentage is set according to the severity of
 * the bug. Vaults have regular safety periods (typically for an hour twice a
 * day) which are time for the committee to make decisions.
 *
 * In addition to the roles defined in the IHATVaultsRegistry, every HATVault 
 * has the roles:
 * Committee - The only address which can submit a claim for a bounty payout
 * and set the maximum bounty.
 * User - Anyone can deposit the vault's native token into the vault and 
 * recieve shares for it. Shares represent the user's relative part in the
 * vault, and when a bounty is paid out, users lose part of their deposits
 * (based on percentage paid), but keep their share of the vault.
 * Users also receive rewards for their deposits, which can be claimed at any
 *  time.
 * To withdraw previously deposited tokens, a user must first send a withdraw
 * request, and the withdrawal will be made available after a pending period.
 * Withdrawals are not permitted during safety periods or while there is an 
 * active claim for a bounty payout.
 *
 * Bounties are payed out distributed between a few channels, and that 
 * distribution is set upon creation (the hacker gets part in direct transfer,
 * part in vested reward and part in vested HAT token, part gets rewarded to
 * the committee, part gets swapped to HAT token and burned and/or sent to Hats
 * governance).
 *
 * NOTE: Vaults should not use tokens which do not guarantee that the amount
 * specified is the amount transferred
 *
 * This project is open-source and can be found at:
 * https://github.com/hats-finance/hats-contracts
 */
interface IHATClaimsManager {

    // How to divide the bounty - after deducting the part that is swapped to
    // HAT tokens (and then sent to governance and vested to the hacker)
    // values are in percentages and should add up to 100% (defined as 10000)
    struct BountySplit {
        // the percentage of reward sent to the hacker via vesting contract
        uint16 hackerVested;
        // the percentage of tokens that are sent directly to the hacker
        uint16 hacker;
        // the percentage sent to the committee
        uint16 committee;
    }

    // How to divide a bounty for a claim that has been approved
    // used to keep track of payouts, amounts are in vault's native token
    struct ClaimBounty {
        uint256 hacker;
        uint256 hackerVested;
        uint256 committee;
        uint256 governanceFee;
    }

    struct Claim {
        bytes32 claimId;
        address beneficiary;
        uint16 bountyPercentage;
        // the address of the committee at the time of the submission, so that this committee will
        // be paid their share of the bounty in case the committee changes before claim approval
        address committee;
        uint32 createdAt;
        uint32 challengedAt;
        uint16 governanceFee;
        address arbitrator;
        uint32 challengePeriod;
        uint32 challengeTimeOutPeriod;
        bool arbitratorCanChangeBounty;
        bool arbitratorCanChangeBeneficiary;
    }

    struct PendingMaxBounty {
        uint16 maxBounty;
        uint32 timestamp;
    }

    /**
    * @notice Initialization parameters for the vault
    * @param name The vault's name (concatenated as "Hats Vault " + name)
    * @param symbol The vault's symbol (concatenated as "HAT" + symbol)
    * @param rewardController The reward controller for the vault
    * @param vestingDuration Duration of the vesting period of the vault's
    * token vested part of the bounty
    * @param vestingPeriods The number of vesting periods of the vault's token
    * vested part of the bounty
    * @param maxBounty The maximum percentage of the vault that can be paid
    * out as a bounty
    * @param bountySplit The way to split the bounty between the hacker, 
    * hacker vested, and committee.
    *   Each entry is a number between 0 and `HUNDRED_PERCENT`.
    *   Total splits should be equal to `HUNDRED_PERCENT`.
    * @param governanceFee the fee to be sent to governace of the total payout
    * @param asset The vault's native token
    * @param owner The address of the vault's owner 
    * @param committee The address of the vault's committee 
    * @param arbitrator The address of the vault's arbitrator
    * @param arbitratorCanChangeBounty Can the arbitrator change a claim's bounty
    * @param arbitratorCanChangeBeneficiary Can the arbitrator change a claim's beneficiary
    * @param arbitratorCanSubmitClaims Can the arbitrator submit a claim
    * @param isTokenLockRevocable can the committee revoke the token lock
    * @dev Needed to avoid a "stack too deep" error
    */
    struct ClaimsManagerInitParams {
        uint32 vestingDuration;
        uint32 vestingPeriods;
        uint16 maxBounty;
        BountySplit bountySplit;
        uint16 governanceFee;
        address owner;
        address committee;
        address arbitrator;
        bool arbitratorCanChangeBounty;
        bool arbitratorCanChangeBeneficiary;
        bool arbitratorCanSubmitClaims;
        bool isTokenLockRevocable;
    }

    // Only committee
    error OnlyCommittee();
    // Active claim exists
    error ActiveClaimExists();
    // Safety period
    error SafetyPeriod();
    // Not safety period
    error NotSafetyPeriod();
    // Bounty percentage is higher than the max bounty
    error BountyPercentageHigherThanMaxBounty();
    // Only callable by arbitrator or after challenge timeout period
    error OnlyCallableByArbitratorOrAfterChallengeTimeOutPeriod();
    // No active claim exists
    error NoActiveClaimExists();
    // Claim Id specified is not the active claim Id
    error ClaimIdIsNotActive();
    // Not enough fee paid
    error NotEnoughFeePaid();
    // No pending max bounty
    error NoPendingMaxBounty();
    // Delay period for setting max bounty had not passed
    error DelayPeriodForSettingMaxBountyHadNotPassed();
    // Committee already checked in
    error CommitteeAlreadyCheckedIn();
    // Total bounty split % should be `HUNDRED_PERCENT`
    error TotalSplitPercentageShouldBeHundredPercent();
    // Vesting duration is too long
    error VestingDurationTooLong();
    // Vesting periods cannot be zero
    error VestingPeriodsCannotBeZero();
    // Vesting duration smaller than periods
    error VestingDurationSmallerThanPeriods();
    // Max bounty cannot be more than `MAX_BOUNTY_LIMIT` (unless if it is 100%)
    error MaxBountyCannotBeMoreThanMaxBountyLimit();
    // Committee bounty split cannot be more than `MAX_COMMITTEE_BOUNTY`
    error CommitteeBountyCannotBeMoreThanMax();
    // Only registry owner
    error OnlyRegistryOwner();
    // Set shares arrays must have same length
    error SetSharesArraysMustHaveSameLength();
    // Not enough user balance
    error NotEnoughUserBalance();
    // Only arbitrator or registry owner
    error OnlyArbitratorOrRegistryOwner();
    // Unchallenged claim can only be approved if challenge period is over
    error UnchallengedClaimCanOnlyBeApprovedAfterChallengePeriod();
    // Challenged claim can only be approved by arbitrator before the challenge timeout period
    error ChallengedClaimCanOnlyBeApprovedByArbitratorUntilChallengeTimeoutPeriod();
    // Claim has expired
    error ClaimExpired();
    // Challenge period is over
    error ChallengePeriodEnded();
    // Claim can be challenged only once
    error ClaimAlreadyChallenged();
    // Only callable if challenged
    error OnlyCallableIfChallenged();
    // System is in an emergency pause
    error SystemInEmergencyPause();
    // Cannot set a reward controller that was already used in the past
    error CannotSetToPerviousRewardController();
    // Payout must either be 100%, or up to the MAX_BOUNTY_LIMIT
    error PayoutMustBeUpToMaxBountyLimitOrHundredPercent();
    // Cannot set fee greater than the max fee
    error FeeCannotBeMoreThanMaxFee();


    event SubmitClaim(
        bytes32 indexed _claimId,
        address _committee,
        address indexed _submitter,
        address indexed _beneficiary,
        uint256 _bountyPercentage,
        string _descriptionHash
    );
    event ChallengeClaim(bytes32 indexed _claimId);
    event ApproveClaim(
        bytes32 indexed _claimId,
        address _committee,
        address indexed _approver,
        address indexed _beneficiary,
        uint256 _bountyPercentage,
        address _tokenLock,
        ClaimBounty _claimBounty
    );
    event DismissClaim(bytes32 indexed _claimId);
    event SetCommittee(address indexed _committee);
    event SetVestingParams(
        uint256 _duration,
        uint256 _periods
    );
    event SetBountySplit(BountySplit _bountySplit);
    event CommitteeCheckedIn();
    event SetPendingMaxBounty(uint256 _maxBounty);
    event SetMaxBounty(uint256 _maxBounty);
    event SetGovernanceFee(uint16 _governanceFee);
    event SetArbitrator(address indexed _arbitrator);
    event SetChallengePeriod(uint256 _challengePeriod);
    event SetChallengeTimeOutPeriod(uint256 _challengeTimeOutPeriod);
    event SetArbitratorOptions(bool _arbitratorCanChangeBounty, bool _arbitratorCanChangeBeneficiary, bool _arbitratorCanSubmitClaims);

    /**
    * @notice Initialize a claims manager instance
    * @param _vault The vault instance
    * @param _params The claim manager's initialization parameters
    * @dev See {IHATClaimsManager-ClaimsManagerInitParams} for more details
    * @dev Called when the vault is created in {IHATVaultsRegistry-createVault}
    */
    function initialize(IHATVault _vault, ClaimsManagerInitParams calldata _params) external;

    /* -------------------------------------------------------------------------------- */

    /* ---------------------------------- Claim --------------------------------------- */

    /**
     * @notice Called by the committee to submit a claim for a bounty payout.
     * This function should be called only on a safety period, when withdrawals
     * are disabled, and while there's no other active claim. Cannot be called
     * when the registry is in an emergency pause.
     * Upon a call to this function by the committee the vault's withdrawals
     * will be disabled until the claim is approved or dismissed. Also from the
     * time of this call the arbitrator will have a period of 
     * {IHATVaultsRegistry.challengePeriod} to challenge the claim.
     * @param _beneficiary The submitted claim's beneficiary
     * @param _bountyPercentage The submitted claim's bug requested reward percentage
     */
    function submitClaim(
        address _beneficiary, 
        uint16 _bountyPercentage, 
        string calldata _descriptionHash
    )
        external
        returns (bytes32 claimId);

   
    /**
    * @notice Called by the arbitrator or governance to challenge a claim for a bounty
    * payout that had been previously submitted by the committee.
    * Can only be called during the challenge period after submission of the
    * claim.
    * @param _claimId The claim ID
    */
    function challengeClaim(bytes32 _claimId) external;

    /**
    * @notice Approve a claim for a bounty submitted by a committee, and
    * pay out bounty to hacker and committee. Also transfer to the 
    * IHATVaultsRegistry the part of the bounty that will be swapped to HAT 
    * tokens.
    * If the claim had been previously challenged, this is only callable by
    * the arbitrator. Otherwise, callable by anyone after challengePeriod had
    * passed.
    * @param _claimId The claim ID
    * @param _bountyPercentage The percentage of the vault's balance that will
    * be sent as a bounty. This value will be ignored if the caller is not the
    * arbitrator.
    * @param _beneficiary where the bounty will be sent to. This value will be 
    * ignored if the caller is not the arbitrator.
    */
    function approveClaim(bytes32 _claimId, uint16 _bountyPercentage, address _beneficiary)
        external;

    /**
    * @notice Dismiss the active claim for bounty payout submitted by the
    * committee.
    * Called either by the arbitrator, or by anyone if the claim has timed out.
    * @param _claimId The claim ID
    */
    function dismissClaim(bytes32 _claimId) external;

    /* -------------------------------------------------------------------------------- */

    /* ---------------------------------- Params -------------------------------------- */

    /**
    * @notice Set new committee address. Can be called by existing committee,
    * or by the the vault's owner in the case that the committee hadn't checked in
    * yet.
    * @param _committee The address of the new committee 
    */
    function setCommittee(address _committee) external;

    /**
    * @notice Called by the vault's owner to set the vesting params for the
    * part of the bounty that the hacker gets vested in the vault's native
    * token
    * @param _duration Duration of the vesting period. Must be smaller than
    * 120 days and bigger than `_periods`
    * @param _periods Number of vesting periods. Cannot be 0.
    */
    function setVestingParams(uint32 _duration, uint32 _periods) external;

    /**
    * @notice Called by the vault's owner to set the vault token bounty split
    * upon an approval.
    * Can only be called if is no active claim and not during safety periods.
    * @param _bountySplit The bounty split
    */
    function setBountySplit(BountySplit calldata _bountySplit) external;

    /**
    * @notice Called by the vault's committee to claim it's role.
    * Deposits are enabled only after committee check in.
    */
    function committeeCheckIn() external;

    /**
    * @notice Called by the vault's owner to set a pending request for the
    * maximum percentage of the vault that can be paid out as a bounty.
    * Cannot be called if there is an active claim that has been submitted.
    * Max bounty should be less than or equal to 90% (defined as 9000).
    * It can also be set to 100%, but in this mode the vault will only allow
    * payouts of the 100%, and the vault will become inactive forever afterwards.
    * The pending value can be set by the owner after the time delay (of 
    * {IHATVaultsRegistry.generalParameters.setMaxBountyDelay}) had passed.
    * @param _maxBounty The maximum bounty percentage that can be paid out
    */
    function setPendingMaxBounty(uint16 _maxBounty) external;

    /**
    * @notice Called by the vault's owner to set the vault's max bounty to
    * the already pending max bounty.
    * Cannot be called if there are active claims that have been submitted.
    * Can only be called if there is a max bounty pending approval, and the
    * time delay since setting the pending max bounty had passed.
    */
    function setMaxBounty() external;

    /**
    * @notice Called by the registry's owner to set the fee percentage for payouts 
    * If the value passed is the special "null" value the vault will use the
    * registry's default value.
    * @param _governanceFee The fee percentage for governance
    */
    function setGovernanceFee(uint16 _governanceFee) external;

    /**
    * @notice Called by the registry's owner to set the vault arbitrator
    * If the value passed is the special "null" value the vault will use the
    * registry's default value.
    * @param _arbitrator The address of vault's arbitrator
    */
    function setArbitrator(address _arbitrator) external;

    /**
    * @notice Called by the registry's owner to set the period of time after
    * a claim for a bounty payout has been submitted that it can be challenged
    * by the arbitrator.
    * If the value passed is the special "null" value the vault will use the
    * registry's default value.
    * @param _challengePeriod The vault's challenge period
    */
    function setChallengePeriod(uint32 _challengePeriod) external;

    /**
    * @notice Called by the registry's owner to set the period of time after
    * which a claim for a bounty payout can be dismissed by anyone.
    * If the value passed is the special "null" value the vault will use the
    * registry's default value.
    * @param _challengeTimeOutPeriod The vault's challenge timeout period
    */
    function setChallengeTimeOutPeriod(uint32 _challengeTimeOutPeriod)
        external;

    /**
    * @notice Called by the registry's owner to set whether the arbitrator
    * can change a claim bounty percentage and/ or beneficiary
    * If the value passed is the special "null" value the vault will use the
    * registry's default value.
    * @param _arbitratorCanChangeBounty Whether the arbitrator can change a claim bounty percentage
    * @param _arbitratorCanChangeBeneficiary Whether the arbitrator can change a claim beneficiary
    */
    function setArbitratorOptions(
        bool _arbitratorCanChangeBounty,
        bool _arbitratorCanChangeBeneficiary,
        bool _arbitratorCanSubmitClaims
    )
        external;

    /* -------------------------------------------------------------------------------- */

    /* --------------------------------- Getters -------------------------------------- */

    /** 
    * @notice Returns the max bounty that can be paid from the vault in percentages out of HUNDRED_PERCENT
    * @return The max bounty
    */
    function maxBounty() external view returns(uint16);

    /** 
    * @notice Returns the vault's registry
    * @return The registry's address
    */
    function registry() external view returns(IHATVaultsRegistry);

    /** 
    * @notice Returns whether the committee has checked in
    * @return Whether the committee has checked in
    */
    function committeeCheckedIn() external view returns(bool);

    /** 
    * @notice Returns the current active claim
    * @return The current active claim
    */
    function getActiveClaim() external view returns(Claim memory);

    /** 
    * @notice Returns the vault fee split that goes to the governance
    * If no specific value for this vault has been set, the registry's default
    * value will be returned.
    * @return The vault's fee split that goes to the governance
    */
    function getGovernanceFee() external view returns(uint16);

    /** 
    * @notice Returns the address of the vault's arbitrator
    * If no specific value for this vault has been set, the registry's default
    * value will be returned.
    * @return The address of the vault's arbitrator
    */
    function getArbitrator() external view returns(address);

    /** 
    * @notice Returns the period of time after a claim for a bounty payout has
    * been submitted that it can be challenged by the arbitrator.
    * If no specific value for this vault has been set, the registry's default
    * value will be returned.
    * @return The vault's challenge period
    */
    function getChallengePeriod() external view returns(uint32);

    /** 
    * @notice Returns the period of time after which a claim for a bounty
    * payout can be dismissed by anyone.
    * If no specific value for this vault has been set, the registry's default
    * value will be returned.
    * @return The vault's challenge timeout period
    */
    function getChallengeTimeOutPeriod() external view returns(uint32);

    /** 
    * @notice Returns the claims manager's version
    * @return The claims manager's version
    */
    function VERSION() external view returns(string calldata);
}
