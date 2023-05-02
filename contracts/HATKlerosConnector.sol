// SPDX-License-Identifier: MIT

/**
 *  @authors: [@unknownunknown1]
 *  @reviewers: []
 *  @auditors: []
 *  @bounties: []
 *  @deployments: []
 */

pragma solidity 0.8.16;

import {IDisputeResolver, IArbitrator} from "@kleros/dispute-resolver-interface-contract/contracts/IDisputeResolver.sol";
import "./interfaces/IHATVault.sol";
import "./libraries/CappedMath.sol";

/**
 *  @title HATKlerosConnector
 *  @dev This contract acts a connector between HatsFinance and Kleros court.
 *  This contract trusts that the Arbitrator is honest and will not reenter or modify its costs during a call.
 *  The arbitrator must support appeal period.
 *  The contract also trusts that HATVault contract is honest and won't reenter.
 */
contract HATKlerosConnector is IDisputeResolver {
    using CappedMath for uint256;

    uint256 private constant RULING_OPTIONS = 2; // The amount of non 0 choices the arbitrator can give.
    uint256 private constant MULTIPLIER_DIVISOR = 10000; // Divisor parameter for multipliers.

    enum Status {
        None, // Claim is open to challenge.
        DisputedByClaimant, // Claim was challenged by the hacker.
        DisputedByDepositor, // Claim was challenged by the pool participant.
        Resolved // Claim was resolved by the arbitrator.
    }
    
    enum Decision {
        None, // Court wasn't able to make a decisive ruling. In this case the claim is unchanged. Both sides will get their appeal deposits back in this case.
        MakeNoChanges, // Accept the claim as it is without changing.
        SideWithChallenger // Side with the challenger and either change claim's severity, dismiss it altogether or submit a new claim, depending on who created a dispute.
    }

    struct Claim {
        Status status; // Claim's current status.
        uint16 bountyPercentage; // Bounty that the claimant demands.
        address beneficiary; // Beneficiary address proposed by claimant.
        address challenger; // Address that challenged the claim.
        uint256 nbChallenges; // Number of times the claim was challenged, 2 max.
        uint256 openToChallengeAt; // Time when the claim is open to 2nd challenge.
    }

    // Pending claims are the claims that will be created in Vault after successful hacker's dispute.
    struct PendingClaim {
        uint16 bountyPercentage; // Bounty that the claimant demands.
        address challenger; // Address that challenged the claim.
        string descriptionHash; // Description hash for the vulnerability that challenger wants to submit.
        bool validated; // Claim was validated by arbitrator.
        bool submitted; // Claim was submitted to Vault.
    }

    struct DisputeStruct {
        bytes32 claimId; // Id of the claim in HATVault contract. It is left empty for submission disputes.
        uint256 pendingClaimId; // Index of the pending claim in the array. It's only used for submission disputes.
        uint256 externalDisputeId; // Id of the dispute created in Kleros court.
        Decision ruling; // Ruling given by the arbitrator.
        bool resolved; // True if the dispute has been resolved.
        Round[] rounds; // Appeal rounds.
    }

    // Round struct stores the contributions made to particular sides.
    // - 0 side for `Decision.None`.
    // - 1 side for `Decision.MakeNoChanges`.
    // - 2 side for `Decision.SideWithChallenger`.
    struct Round {
        uint256[3] paidFees; // Tracks the fees paid in this round in the form paidFees[side].
        bool[3] hasPaid; // True if the fees for this particular side have been fully paid in the form hasPaid[side].
        mapping(address => uint256[3]) contributions; // Maps contributors to their contributions for each side in the form contributions[address][side].
        uint256 feeRewards; // Sum of reimbursable appeal fees available to the parties that made contributions to the side that ultimately wins a dispute.
        uint256[] fundedSides; // Stores the sides that are fully funded.
    }


    address public immutable governor; // Governor of this contract.
    IArbitrator public immutable klerosArbitrator; // The kleros arbitrator contract (e.g. Kleros Court).
    IHATVault public immutable vault; // Address of the Vault contract.
    uint256 public metaEvidenceUpdates; // Relevant index of the metaevidence.
    bytes public arbitratorExtraData; // Extra data for the arbitrator.

    uint256 public hackerChallengePeriod; // Time the hacker has to challenge the claim.
    uint256 public depositorChallengePeriod; // Time the depositor has to challenge the claim.
    
    uint256 public winnerMultiplier; // Multiplier for calculating the appeal fee that must be paid for the ruling that was chosen by the arbitrator in the previous round, in basis points.
    uint256 public loserMultiplier; // Multiplier for calculating the appeal fee that must be paid for the ruling that the arbitrator didn't rule for in the previous round, in basis points.
    uint256 public loserAppealPeriodMultiplier; // Multiplier for calculating the duration of the appeal period for the loser, in basis points.

    DisputeStruct[] public disputes; // Stores the disputes created in this contract.
    PendingClaim[] public pendingClaims; // Stores pending claims. If such claim is validated it will be submitted to Vault as a result.
    mapping(bytes32 => Claim) public claims; // Stores disputed claims from Vault.
    mapping(uint256 => uint256) public override externalIDtoLocalID; // Maps external dispute ids to local dispute ids.

    /** @dev Raised when a claim is challenged by claimant.
     *  @param _claimId Id of the claim in Vault cotract.
     */
    event ChallengedByClaimant(bytes32 indexed _claimId);

    /** @dev Raised when a claim is challenged by depositor.
     *  @param _claimId Id of the claim in Vault cotract.
     */
    event ChallengedByDepositor(bytes32 indexed _claimId);
    
    /** @dev Raised when a pending claim is validated.
     *  @param _pendingClaimId Index of the pending claim.
     */
    event PendingClaimValidated(uint256 _pendingClaimId);

    modifier onlyGovernor {require(msg.sender == governor, "The caller must be the governor."); _;}

    /** @dev Constructor.
     *  @param _klerosArbitrator The Kleros arbitrator of the contract.
     *  @param _arbitratorExtraData Extra data for the arbitrator.
     *  @param _vault Address of the Vault contract.
     *  @param _metaEvidenceClaimant Metaevidence for the disputes raised by claimant.
     *  @param _metaEvidenceDepositor Metaevidence for the disputes raised by depositor.
     *  @param _metaEvidenceSubmit Metaevidence for the disputes that will submit a new claim.
     *  @param _hackerChallengePeriod Time the hacker has to challenge a claim.
     *  @param _depositorChallengePeriod Time the depositor has to challenge a claim
     *  @param _winnerMultiplier Multiplier for calculating the appeal cost of the winning side.
     *  @param _loserMultiplier Multiplier for calculation the appeal cost of the losing side.
     *  @param _loserAppealPeriodMultiplier Multiplier for calculating the appeal period for the losing side.
     */
    constructor (
        IArbitrator _klerosArbitrator,
        bytes memory _arbitratorExtraData,
        IHATVault _vault,
        string memory _metaEvidenceClaimant,
        string memory _metaEvidenceDepositor,
        string memory _metaEvidenceSubmit,
        uint256 _hackerChallengePeriod,
        uint256 _depositorChallengePeriod,
        uint256 _winnerMultiplier,
        uint256 _loserMultiplier,
        uint256 _loserAppealPeriodMultiplier
    ) {
        emit MetaEvidence(0, _metaEvidenceClaimant);
        emit MetaEvidence(1, _metaEvidenceDepositor);
        emit MetaEvidence(2, _metaEvidenceSubmit);
        
        governor = msg.sender;
        klerosArbitrator = _klerosArbitrator;
        arbitratorExtraData = _arbitratorExtraData;
        vault = _vault;
        // Sum of both challenge periods shouldn't exceed challenge period of the vault so the depositor will have time to challenge before the claim is approved in Vault.
        require(_hackerChallengePeriod + _depositorChallengePeriod <= vault.getChallengePeriod(), "Wrong timeout values");
        hackerChallengePeriod = _hackerChallengePeriod;
        depositorChallengePeriod = _depositorChallengePeriod;
        winnerMultiplier = _winnerMultiplier;
        loserMultiplier = _loserMultiplier;
        loserAppealPeriodMultiplier = _loserAppealPeriodMultiplier;
    }

    // ******************** //
    // *    Governance    * //
    // ******************** //

    /** @dev Changes hackerChallengePeriod and depositorChallengePeriod variables.
     *  @param _hackerChallengePeriod The new hackerChallengePeriod value.
     *  @param _depositorChallengePeriod The new depositorChallengePeriod value.
     */
    function changeChallengePeriod(uint256 _hackerChallengePeriod, uint256 _depositorChallengePeriod) external onlyGovernor {
        require(_hackerChallengePeriod + _depositorChallengePeriod <= vault.getChallengePeriod(), "Wrong timeout values");
        hackerChallengePeriod = _hackerChallengePeriod;
        depositorChallengePeriod = _depositorChallengePeriod;
    }

    /** @dev Changes winnerMultiplier variable.
     *  @param _winnerMultiplier The new winnerMultiplier value.
     */
    function changeWinnerMultiplier(uint256 _winnerMultiplier) external onlyGovernor {
        winnerMultiplier = _winnerMultiplier;
    }

    /** @dev Changes loserMultiplier variable.
     *  @param _loserMultiplier The new winnerMultiplier value.
     */
    function changeLoserMultiplier(uint256 _loserMultiplier) external onlyGovernor {
        loserMultiplier = _loserMultiplier;
    }

    /** @dev Changes loserAppealPeriodMultiplier variable.
     *  @param _loserAppealPeriodMultiplier The new loserAppealPeriodMultiplier value.
     */
    function changeLoserAppealPeriodMultiplier(uint256 _loserAppealPeriodMultiplier) external onlyGovernor {
        loserAppealPeriodMultiplier = _loserAppealPeriodMultiplier;
    }

    /** @dev Update the meta evidence used for disputes.
     *  @param _metaEvidenceClaimant URI of the new meta evidence for claimant.
     *  @param _metaEvidenceDepositor URI of the new meta evidence for depositor.
     *  @param _metaEvidenceSubmit URI of the new meta evidence for submitting a new claim.
     */
    function changeMetaEvidence(string calldata _metaEvidenceClaimant, string calldata _metaEvidenceDepositor, string calldata _metaEvidenceSubmit) external onlyGovernor {
        metaEvidenceUpdates++;
        emit MetaEvidence(3 * metaEvidenceUpdates, _metaEvidenceClaimant);
        emit MetaEvidence(3 * metaEvidenceUpdates + 1, _metaEvidenceDepositor);
        emit MetaEvidence(3 * metaEvidenceUpdates + 2, _metaEvidenceSubmit);
    }

    // **************************** //
    // *    Hacker's submission   * //
    // **************************** //

    /** @dev Allows the hacker to submit a claim through Kleros court while bypassing the committee.
     *  @param _bountyPercentage Bounty percentage the hacker thinks he is eligible to.
     *  @param _descriptionHash Description hash of the vulnerability.
     *  @param _evidence Link to evidence.
     */
    function startProcedureToSubmitClaim(uint16 _bountyPercentage, string calldata _descriptionHash, string calldata _evidence) external payable {
        require(_bountyPercentage <= vault.maxBounty(), "Bounty too high");
        uint256 arbitrationCost = getArbitrationCost();
        require(msg.value >= arbitrationCost, "Should pay the full deposit.");

        uint256 localDisputeId = disputes.length;
        uint256 metaEvidenceId = 3 * metaEvidenceUpdates + 2;

        DisputeStruct storage dispute = disputes.push();
        dispute.pendingClaimId = pendingClaims.length;
        // Preemptively create a new funding round for future appeals.
        dispute.rounds.push();

        PendingClaim storage pendingClaim = pendingClaims.push();
        pendingClaim.challenger = msg.sender;
        pendingClaim.bountyPercentage = _bountyPercentage;
        pendingClaim.descriptionHash = _descriptionHash;

        uint256 externalDisputeId = klerosArbitrator.createDispute{value: arbitrationCost}(RULING_OPTIONS,  arbitratorExtraData);
        dispute.externalDisputeId = externalDisputeId;
        externalIDtoLocalID[externalDisputeId] = localDisputeId;

        if (msg.value - arbitrationCost > 0) payable(msg.sender).send(msg.value - arbitrationCost);
    
        emit Dispute(klerosArbitrator, externalDisputeId, metaEvidenceId, localDisputeId);
        emit Evidence(klerosArbitrator, localDisputeId, msg.sender, _evidence);
    }

    // ******************** //
    // *    Challenges    * //
    // ******************** //
    
    /** @dev Challenge the claim by the claimant to increase bounty.
     *  @param _claimId The Id of the claim in Vault contract.
     *  @param _bountyPercentage Bounty percentage the hacker thinks he is eligible to.
     *  @param _beneficiary Address of beneficiary proposed by hacker.
     *  @param _evidence URI of the evidence to support the challenge.
     */
    function challengeByClaimant(bytes32 _claimId, uint16 _bountyPercentage, address _beneficiary, string calldata _evidence) external payable {
        (bytes32 claimId, address beneficiary, uint16 bountyPercentage,, uint256 createdAt,,,,,,,,) = vault.activeClaim();

        Claim storage claim = claims[claimId];
        uint256 arbitrationCost = getArbitrationCost();

        require(claimId == _claimId, "Claim id does not match");
        require(claimId != bytes32(0), "No active claim");
        require(claim.status == Status.None, "Claim is already challenged or resolved");
        require(msg.sender == beneficiary, "Only original beneficiary allowed to challenge");
        require(msg.value >= arbitrationCost, "Should pay the full deposit.");

        uint256 metaEvidenceId;
        require(claim.nbChallenges == 0, "Hacker already challenged");
        // Hacker's challenge is identified by increased bounty.
        require(block.timestamp - createdAt <= hackerChallengePeriod, "Time to challenge has passed for hacker");
        require(_bountyPercentage > bountyPercentage && _bountyPercentage <= vault.maxBounty(), "Incorrect bounty");

        metaEvidenceId = 3 * metaEvidenceUpdates;
        claim.status = Status.DisputedByClaimant;

        vault.challengeClaim(_claimId);

        uint256 localDisputeId = disputes.length;
        claim.nbChallenges++;
        claim.challenger = msg.sender;
        claim.bountyPercentage = _bountyPercentage;
        claim.beneficiary = _beneficiary;

        DisputeStruct storage dispute = disputes.push();
        dispute.claimId = claimId;

        // Preemptively create a new funding round for future appeals.
        dispute.rounds.push();

        uint256 externalDisputeId = klerosArbitrator.createDispute{value: arbitrationCost}(RULING_OPTIONS,  arbitratorExtraData);
        dispute.externalDisputeId = externalDisputeId;
        externalIDtoLocalID[externalDisputeId] = localDisputeId;

        if (msg.value - arbitrationCost > 0) payable(msg.sender).send(msg.value - arbitrationCost);

        emit ChallengedByClaimant(_claimId);
        emit Dispute(klerosArbitrator, externalDisputeId, metaEvidenceId, localDisputeId);
        emit Evidence(klerosArbitrator, localDisputeId, msg.sender, _evidence);
    }

    /** @dev Challenge the claim by depositor to dismiss it altogether.
     *  @param _claimId The Id of the claim in Vault contract.
     *  @param _evidence URI of the evidence to support the challenge.
     */
    function challengeByDepositor(bytes32 _claimId, string calldata _evidence) external payable {
        (bytes32 claimId,,,, uint256 createdAt,,,,,,,,) = vault.activeClaim();

        Claim storage claim = claims[claimId];
        uint256 arbitrationCost = getArbitrationCost();

        require(claimId == _claimId, "Claim id does not match");
        require(claimId != bytes32(0), "No active claim");
        require(claim.status == Status.None, "Claim is already challenged or resolved");
        require(msg.value >= arbitrationCost, "Should pay the full deposit.");

        uint256 metaEvidenceId;
        // Hacker didn't challenge.
        if (claim.nbChallenges == 0) {
            require(
                block.timestamp - createdAt > hackerChallengePeriod && 
                block.timestamp - createdAt <= depositorChallengePeriod + hackerChallengePeriod,
                "Not a time to challenge for depositor."
            );
            // Raise the flag in Vault. It's done only during the first challenge.
            vault.challengeClaim(_claimId);
        // Depositor's challenge after hacker's challenge was resolved unsuccessfully.
        } else if (claim.nbChallenges == 1) {
            require(block.timestamp - claim.openToChallengeAt <= depositorChallengePeriod, "Time to challenge has passed for depositor.");
        } else {
            revert("Can only challenge 2 times");
        }

        metaEvidenceId = 3 * metaEvidenceUpdates + 1;
        claim.status = Status.DisputedByDepositor;

        uint256 localDisputeId = disputes.length;
        claim.nbChallenges++;
        claim.challenger = msg.sender;

        DisputeStruct storage dispute = disputes.push();
        dispute.claimId = claimId;

        // Preemptively create a new funding round for future appeals.
        dispute.rounds.push();

        uint256 externalDisputeId = klerosArbitrator.createDispute{value: arbitrationCost}(RULING_OPTIONS,  arbitratorExtraData);
        dispute.externalDisputeId = externalDisputeId;
        externalIDtoLocalID[externalDisputeId] = localDisputeId;

        if (msg.value - arbitrationCost > 0) payable(msg.sender).send(msg.value - arbitrationCost);

        emit ChallengedByDepositor(_claimId);
        emit Dispute(klerosArbitrator, externalDisputeId, metaEvidenceId, localDisputeId);
        emit Evidence(klerosArbitrator, localDisputeId, msg.sender, _evidence);
    }

    /** @dev Give a ruling for a dispute. Can only be called by the arbitrator.
     *  @param _disputeId ID of the dispute in the arbitrator contract.
     *  @param _ruling Ruling given by the arbitrator. Note that 0 is reserved for "Refused to arbitrate".
     */
    function rule(uint256 _disputeId, uint256 _ruling) external override {
        uint256 localDisputeId = externalIDtoLocalID[_disputeId];

        DisputeStruct storage dispute = disputes[localDisputeId];

        require(!dispute.resolved, "Already resolved");
        require(_ruling <= RULING_OPTIONS, "Invalid ruling option");
        require(address(klerosArbitrator) == msg.sender, "Only the arbitrator can execute");
        uint256 finalRuling = _ruling;
    
        // If one side paid its fees, the ruling is in its favor. Note that if the other side had also paid, an appeal would have been created.
        Round storage round = dispute.rounds[dispute.rounds.length - 1];
        if (round.fundedSides.length == 1) finalRuling = round.fundedSides[0];

        dispute.ruling = Decision(finalRuling);
        dispute.resolved = true;

        if (dispute.claimId == bytes32(0)) {
            // Dispute to make a submission.
            if (finalRuling == uint256(Decision.SideWithChallenger)) {
                PendingClaim storage pendingClaim = pendingClaims[dispute.pendingClaimId];
                pendingClaim.validated = true;
                emit PendingClaimValidated(dispute.pendingClaimId);
            }
        } else {
            bytes32 claimId = dispute.claimId;
            Claim storage claim = claims[claimId];
            if (finalRuling == uint256(Decision.SideWithChallenger)) {
                if (claim.status == Status.DisputedByClaimant) {
                    // Claimant won the dispute. Change the severity.
                    vault.approveClaim(claimId, claim.bountyPercentage, claim.beneficiary);
                } else {
                    // Depositor won. Dismiss the claim.
                    vault.dismissClaim(claimId);
                }
                claim.status = Status.Resolved;
            } else {
                // Arbitrator sided with committee or refused to arbitrate (gave 0 ruling).
                if (claim.status == Status.DisputedByClaimant) {
                    // Claimant lost. Set the claim status to default to allow the depositors to challenge.
                    claim.status = Status.None;
                    claim.openToChallengeAt = block.timestamp;
                } else {
                    // Depositor lost. Resolve the claim and report it to HATVault with default parameters.
                    claim.status = Status.Resolved;
                    vault.approveClaim(claimId, 0, address(0));
                }     
            }
        }       

        emit Ruling(IArbitrator(msg.sender), _disputeId, finalRuling);
    }

    /** @dev Approve a claim in Vault if it wasn't challenged by depositor, but was flagged in Vault after hacker's challenge.
     *  @param _claimId The id of the claim in Vault.
     */
    function approveClaim(bytes32 _claimId) external {
        Claim storage claim = claims[_claimId];
        require(claim.status == Status.None, "Claim is already challenged or resolved");
        // Check that the claim exists and was challenged by the hacker before.
        // Note if the claim wasn't challenged before it wouldn't have been registered by this contract and could've been approved directly in Vault.
        require(claim.nbChallenges == 1, "Claim does not exist");
        require(block.timestamp - claim.openToChallengeAt > depositorChallengePeriod, "Depositor still can challenge");
        // Approve the claim while leaving the percentage and beneficiary unchanged.
        claim.status = Status.Resolved;
        vault.approveClaim(_claimId, 0, address(0));
    }

    /** @dev Submits a pending claim to Vault if arbitrator deemed it valid.
     *  @param _pendingClaimId The id in the array of pending claims.
     */
    function submitPendingClaim(uint256 _pendingClaimId) external {
        PendingClaim storage pendingClaim = pendingClaims[_pendingClaimId];
        require(!pendingClaim.submitted, "Already submitted");
        require(pendingClaim.validated, "Claim should be validated");
        pendingClaim.submitted = true;
        // Submit will be reverted if Vault has an active claim. Also note that maxBounty can be decreased in Vault.
        vault.submitClaim(pendingClaim.challenger, pendingClaim.bountyPercentage, pendingClaim.descriptionHash);
    }

    /** @dev Submit a reference to evidence. EVENT.
     *  @param _localDisputeId The id of the related dispute.
     *  @param _evidenceURI Link to evidence.
     */
    function submitEvidence(uint256 _localDisputeId, string calldata _evidenceURI) external override {
        DisputeStruct storage dispute = disputes[_localDisputeId];
        // Note that by reading dispute's value we also check that it exists.
        require(!dispute.resolved, "Dispute already resolved");

        emit Evidence(klerosArbitrator, _localDisputeId, msg.sender, _evidenceURI);
    }

    // ************************ //
    // *       Appeals        * //
    // ************************ //

    /** @dev Takes up to the total amount required to fund a side. Reimburses the rest. Creates an appeal if both sides are fully funded.
     *  @param _localDisputeId The ID of the local dispute.
     *  @param _side The option to fund. 0 - refuse to rule, 1 - make no changes, 2 - side with challenger.
     *  @return fullyFunded Whether the side was fully funded or not.
     */
    function fundAppeal(uint256 _localDisputeId, uint256 _side) external payable override returns (bool) {
        DisputeStruct storage dispute = disputes[_localDisputeId];
        require(!dispute.resolved, "Dispute already resolved.");
        require(_side <= RULING_OPTIONS, "Side out of bounds");

        uint256 externalDisputeId = dispute.externalDisputeId;
        (uint256 appealPeriodStart, uint256 appealPeriodEnd) = klerosArbitrator.appealPeriod(externalDisputeId);
        require(block.timestamp >= appealPeriodStart && block.timestamp < appealPeriodEnd, "Appeal period is over.");

        uint256 multiplier;
        {
            uint256 winner = klerosArbitrator.currentRuling(externalDisputeId);
            if (winner == _side) {
                multiplier = winnerMultiplier;
            } else {
                require(
                    block.timestamp - appealPeriodStart <
                        (appealPeriodEnd - appealPeriodStart).mulCap(loserAppealPeriodMultiplier) / MULTIPLIER_DIVISOR,
                    "Appeal period is over for loser"
                );
                multiplier = loserMultiplier;
            }
        }

        uint256 lastRoundId = dispute.rounds.length - 1;
        Round storage round = dispute.rounds[lastRoundId];
        require(!round.hasPaid[_side], "Appeal fee is already paid.");
        uint256 appealCost = klerosArbitrator.appealCost(externalDisputeId, arbitratorExtraData);
        uint256 totalCost = appealCost.addCap((appealCost.mulCap(multiplier)) / MULTIPLIER_DIVISOR);

        // Take up to the amount necessary to fund the current round at the current costs.
        uint256 contribution = totalCost.subCap(round.paidFees[_side]) > msg.value
            ? msg.value
            : totalCost.subCap(round.paidFees[_side]);
        emit Contribution(_localDisputeId, lastRoundId, _side, msg.sender, contribution);

        round.contributions[msg.sender][_side] += contribution;
        round.paidFees[_side] += contribution;
        if (round.paidFees[_side] >= totalCost) {
            round.feeRewards += round.paidFees[_side];
            round.fundedSides.push(_side);
            round.hasPaid[_side] = true;
            emit RulingFunded(_localDisputeId, lastRoundId, _side);
        }

        if (round.fundedSides.length > 1) {
            // At least two sides are fully funded.
            dispute.rounds.push();

            round.feeRewards = round.feeRewards.subCap(appealCost);
            klerosArbitrator.appeal{value: appealCost}(externalDisputeId, arbitratorExtraData);
        }

        if (msg.value.subCap(contribution) > 0) payable(msg.sender).send(msg.value.subCap(contribution)); // Sending extra value back to contributor. It is the user's responsibility to accept ETH.
        return round.hasPaid[_side];
    }

    /** @dev Sends the fee stake rewards and reimbursements proportional to the contributions made to the winner of a dispute. Reimburses contributions if there is no winner.
     *  @param _localDisputeId The ID of the related dispute.
     *  @param _beneficiary The address to send reward to.
     *  @param _round The round from which to withdraw.
     *  @param _side The ruling to query the reward from.
     *  @return reward The withdrawn amount.
     */
    function withdrawFeesAndRewards(
        uint256 _localDisputeId,
        address payable _beneficiary,
        uint256 _round,
        uint256 _side
    ) public override returns (uint256 reward) {
        DisputeStruct storage dispute = disputes[_localDisputeId];
        Round storage round = dispute.rounds[_round];
        require(dispute.resolved, "Dispute not resolved");

        uint256 finalRuling = uint256(dispute.ruling);
        // Allow to reimburse if funding of the round was unsuccessful.
        if (!round.hasPaid[_side]) {
            reward = round.contributions[_beneficiary][_side];
        } else if (!round.hasPaid[finalRuling]) {
            // Reimburse unspent fees proportionally if the ultimate winner didn't pay appeal fees fully.
            // Note that if only one side is funded it will become a winner and this part of the condition won't be reached.
            reward = round.fundedSides.length > 1
                ? (round.contributions[_beneficiary][_side] * round.feeRewards) /
                    (round.paidFees[round.fundedSides[0]] + round.paidFees[round.fundedSides[1]])
                : 0;
        } else if (finalRuling == _side) {
            uint256 paidFees = round.paidFees[_side];
            // Reward the winner.
            reward = paidFees > 0 ? (round.contributions[_beneficiary][_side] * round.feeRewards) / paidFees : 0;
        }

        if (reward != 0) {
            round.contributions[_beneficiary][_side] = 0;
            _beneficiary.send(reward); // It is the user's responsibility to accept ETH.
            emit Withdrawal(_localDisputeId, _round, _side, _beneficiary, reward);
        }
    }

    /** @dev Allows to withdraw any rewards or reimbursable fees for all rounds at once.
     *  @dev This function is O(n) where n is the total number of rounds. Arbitration cost of subsequent rounds is `A(n) = 2A(n-1) + 1`.
     *  Thus because of this exponential growth of costs, you can assume n is less than 10 at all times.
     *  @param _localDisputeId The ID of the related dispute.
     *  @param _beneficiary The address that made contributions.
     *  @param _contributedTo Side that received contributions from contributor.
     */
    function withdrawFeesAndRewardsForAllRounds(
        uint256 _localDisputeId,
        address payable _beneficiary,
        uint256 _contributedTo
    ) external override {
        DisputeStruct storage dispute = disputes[_localDisputeId];

        uint256 numberOfRounds = dispute.rounds.length;
        for (uint256 roundNumber = 0; roundNumber < numberOfRounds; roundNumber++) {
            withdrawFeesAndRewards(_localDisputeId, _beneficiary, roundNumber, _contributedTo);
        }
    }

    // ***********((********* //
    // *      Getters       * //
    // ********************** //

    /** @dev Get the arbitration cost to challenge a claim.
     *  @return Arbitration cost.
     */   
    function getArbitrationCost() public view returns (uint256) {
        return klerosArbitrator.arbitrationCost(arbitratorExtraData);
    }

    /** @dev Returns number of possible ruling options. Valid rulings are [0, return value].
     *  @return count The number of ruling options.
     */
    function numberOfRulingOptions(
        uint256 /* _localDisputeId */
    ) external pure override returns (uint256) {
        return RULING_OPTIONS;
    }

    /** @dev Returns stake multipliers.
     *  @return winner Winners stake multiplier.
     *  @return loser Losers stake multiplier.
     *  @return loserAppealPeriod Multiplier for calculating an appeal period duration for the losing side.
     *  @return divisor Multiplier divisor.
     */
    function getMultipliers()
        external
        view
        override
        returns (
            uint256 winner,
            uint256 loser,
            uint256 loserAppealPeriod,
            uint256 divisor
        )
    {
        return (winnerMultiplier, loserMultiplier, loserAppealPeriodMultiplier, MULTIPLIER_DIVISOR);
    }

    /** @dev Returns the sum of withdrawable amount.
     *  @dev This function is O(n) where n is the total number of rounds.
     *  @dev This could exceed the gas limit, therefore this function should be used only as a utility and not be relied upon by other contracts.
     *  @param _localDisputeId The ID of the dispute.
     *  @param _beneficiary The contributor for which to query.
     *  @param _contributedTo Side that received contributions from contributor.
     *  @return sum The total amount available to withdraw.
     */
    function getTotalWithdrawableAmount(
        uint256 _localDisputeId,
        address payable _beneficiary,
        uint256 _contributedTo
    ) external view override returns (uint256 sum) {
        DisputeStruct storage dispute = disputes[_localDisputeId];
        if (!dispute.resolved) return sum;

        uint256 finalRuling = uint256(dispute.ruling);
        uint256 noOfRounds = dispute.rounds.length;
        for (uint256 roundNumber = 0; roundNumber < noOfRounds; roundNumber++) {
            Round storage round = dispute.rounds[roundNumber];

            if (!round.hasPaid[_contributedTo]) {
                // Allow to reimburse if funding was unsuccessful for this side.
                sum += round.contributions[_beneficiary][_contributedTo];
            } else if (!round.hasPaid[finalRuling]) {
                // Reimburse unspent fees proportionally if the ultimate winner didn't pay appeal fees fully.
                // Note that if only one side is funded it will become a winner and this part of the condition won't be reached.
                sum += round.fundedSides.length > 1
                    ? (round.contributions[_beneficiary][_contributedTo] * round.feeRewards) /
                        (round.paidFees[round.fundedSides[0]] + round.paidFees[round.fundedSides[1]])
                    : 0;
            } else if (finalRuling == _contributedTo) {
                uint256 paidFees = round.paidFees[_contributedTo];
                // Reward the winner.
                sum += paidFees > 0
                    ? (round.contributions[_beneficiary][_contributedTo] * round.feeRewards) / paidFees
                    : 0;
            }
        }
    }

    /** @dev Gets the number of rounds of the specific dispute.
     *  @param _localDisputeId The ID of the dispute.
     *  @return The number of rounds.
     */
    function getNumberOfRounds(uint256 _localDisputeId) external view returns (uint256) {
        DisputeStruct storage dispute = disputes[_localDisputeId];
        return dispute.rounds.length;
    }

    /** @dev Gets the information of a round of a dispute.
     *  @param _localDisputeId The ID of the dispute.
     *  @param _round The round to query.
     *  @return paidFees The amount of fees paid for each side.
     *  @return hasPaid True if the side is fully funded
     *  @return feeRewards The amount of fees that will be used as rewards.
     *  @return fundedSides Fully funded sides.
     */
    function getRoundInfo(uint256 _localDisputeId, uint256 _round)
        external
        view
        returns (
            uint256[3] memory paidFees,
            bool[3] memory hasPaid,
            uint256 feeRewards,
            uint256[] memory fundedSides
        )
    {
        DisputeStruct storage dispute = disputes[_localDisputeId];
        Round storage round = dispute.rounds[_round];
        return (
            round.paidFees,
            round.hasPaid,
            round.feeRewards,
            round.fundedSides
        );
    }

    /** @dev Gets the contributions made by a party for a given round of a dispute.
     *  @param _localDisputeId The ID of the dispute.
     *  @param _round The round to query.
     *  @param _contributor The address of the contributor.
     *  @return contributions The contributions.
     */
    function getContributions(
        uint256 _localDisputeId,
        uint256 _round,
        address _contributor
    ) external view returns(uint256[3] memory contributions) {
        DisputeStruct storage dispute = disputes[_localDisputeId];
        Round storage round = dispute.rounds[_round];
        contributions = round.contributions[_contributor];
    }
}
