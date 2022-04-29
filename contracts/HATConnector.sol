// SPDX-License-Identifier: MIT

/**
 *  @authors: [@unknownunknown1]
 *  @reviewers: []
 *  @auditors: []
 *  @bounties: []
 *  @deployments: []
 */

pragma solidity 0.8.6;

import { IArbitrable, IArbitrator } from "@kleros/erc-792/contracts/IArbitrator.sol";
import { IEvidence } from "@kleros/erc-792/contracts/erc-1497/IEvidence.sol";
import "./interfaces/IHATVaults.sol";

/**
 *  @title HATConnector
 *  @dev This contract acts a connector between HatsFinance and Kleros court.
 *  This contract trusts that the Arbitrator is honest and will not reenter or modify its costs during a call.
 *  The arbitrator must support appeal period.
 *  The contract also trusts that HATVaults contract is honest and won't reenter.
 */
contract HATConnector is IArbitrable, IEvidence {

    uint256 private constant RULING_OPTIONS = 2; // The amount of non 0 choices the arbitrator can give.
    uint256 private constant MULTIPLIER_DIVISOR = 10000; // Divisor parameter for multipliers.

    enum Status {
        None, // Claim is open to challenge.
        DisputedByClaimant, // Claim was challenged by the hacker.
        DisputedByDepositor, // Claim was challenged by the depositor.
        Resolved, // Claim was resolved by the arbitrator.
        Dismissed // Claim was dismissed by the governance. Arbitrator's ruling is not enforced in this case.
    }
    
    enum Decision {
        None, // Court wasn't able to make a decisive ruling. In this case the claim is unchanged.
        Committee, // Accept the claim as it is without changing.
        Challenger // Side with the challenger and either change claim's severity or dismiss it altogether, depending on who did the challenge.
    }

    struct Claim {
        Status status; // Claim's current status.
        uint256 poolId; // Id of the related pool in HATVaults.
        uint256 nbChallenges; // Number of times the claim was challenged, 2 max.
        uint256 openToChallengeAt; // Stores the timestamp when depositor's challenge becomes available.
        uint256 localDisputeId; // Id of the dispute created in this contract.
        uint256 severity; // Severty that the claimant demands.
    }

    struct DisputeStruct {
        bytes32 claimId; // Id of the claim which is hash(poolId + claim timestamp).
        address challenger; // Address that challenged the claim.
        uint256 externalDisputeId; // Id of the dispute created in Kleros court.
        Decision ruling; // Ruling given by the arbitrator.
        bool resolved; // True if the dispute has been resolved.
        uint256 nbAppeals; // Number of times the dispute was appealed.
    }

    address public immutable governor; // Governor of this contract.
    IArbitrator public immutable arbitrator; // The arbitrator contract (e.g. Kleros Court).
    IHATVaults public immutable HATVaults; // Address of the Vaults contract.
    uint256 public metaEvidenceUpdates; // Relevant index of the metaevidence.
    bytes public arbitratorExtraData; // Extra data for the arbitrator.

    uint256 public claimantWaitingPeriod; // Time the depositor has to wait to allow the claimant to challenge the claim first (e.g. 24 hours according to spec).
    uint256 public appealFeeMultiplier; // Multiplier for appeal fees, in basis points.
    uint256 public maxNbAppeals; // Maximal number of times the appeal can be funded, to avoid stalling the pool.
    uint256 public dismissTimeout; // Time after which the claim can be dismissed without waiting for arbitrator's decision. The ruling becomes irrelevant in this case.

    DisputeStruct[] public disputes; // Stores the disputes created in this contract.
    mapping (bytes32 => Claim) public claims; // Stores the initiated claims.
    mapping(uint256 => uint256) public externalIDtoLocalId; // Maps external dispute ids to local dispute ids.

    event ClaimChallenged(uint256 indexed _poolId, bytes32 indexed _claimId);

    modifier onlyGovernor {require(msg.sender == governor, "The caller must be the governor."); _;}

    /** @dev Constructor.
     *  @param _arbitrator The arbitrator of the contract.
     *  @param _arbitratorExtraData Extra data for the arbitrator.
     *  @param _HATVaults Address of the Vaults contract.
     *  @param _metaEvidenceClaimant Metaevidence for the disputes raised by claimant.
     *  @param _metaEvidenceDepositor Metaevidence for the disputes raised by depositor.
     *  @param _claimantWaitingPeriod Time the depositor has to wait before challenging a claim.
     *  @param _appealFeeMultiplier Multiplier for the appeal fee.
     *  @param _maxNbAppeals Maximal number of appeals.
     *  @param _dismissTimeout Time after which the claim can be dismissed by the governor.
     */
    constructor (
        IArbitrator _arbitrator,
        bytes memory _arbitratorExtraData,
        IHATVaults _HATVaults,
        string memory _metaEvidenceClaimant,
        string memory _metaEvidenceDepositor,
        uint256 _claimantWaitingPeriod,
        uint256 _appealFeeMultiplier,
        uint256 _maxNbAppeals,
        uint256 _dismissTimeout
    ) {
        emit MetaEvidence(0, _metaEvidenceClaimant);
        emit MetaEvidence(1, _metaEvidenceDepositor);
        
        governor = msg.sender;
        arbitrator = _arbitrator;
        arbitratorExtraData = _arbitratorExtraData;
        HATVaults = _HATVaults;
        claimantWaitingPeriod = _claimantWaitingPeriod;
        appealFeeMultiplier = _appealFeeMultiplier;
        maxNbAppeals = _maxNbAppeals;
        dismissTimeout = _dismissTimeout;
    }

    /** @dev Changes claimantWaitingPeriod variable.
     *  @param _claimantWaitingPeriod The new claimantWaitingPeriod value.
     */
    function changeClaimantWaitingPeriod(uint256 _claimantWaitingPeriod) external onlyGovernor {
        claimantWaitingPeriod = _claimantWaitingPeriod;
    }

    /** @dev Changes appealFeeMultiplier variable.
     *  @param _appealFeeMultiplier The new appealFeeMultiplier value.
     */
    function changeAppealFeeMultiplier(uint256 _appealFeeMultiplier) external onlyGovernor {
        appealFeeMultiplier = _appealFeeMultiplier;
    }

    /** @dev Changes maxNbAppeals variable.
     *  @param _maxNbAppeals The new maxNbAppeals value.
     */
    function changeMaxNbAppeals(uint256 _maxNbAppeals) external onlyGovernor {
        maxNbAppeals = _maxNbAppeals;
    }

    /** @dev Changes dismissTimeout variable.
     *  @param _dismissTimeout The new dismissTimeout value.
     */
    function changeDismissTimeout(uint256 _dismissTimeout) external onlyGovernor {
        dismissTimeout = _dismissTimeout;
    }

    /** @dev Update the meta evidence used for disputes.
     *  @param _metaEvidenceClaimant URI of the new meta evidence for claimant.
     *  @param _metaEvidenceDepositor URI of the new meta evidence for depositor
     */
    function changeMetaEvidence(string calldata _metaEvidenceClaimant, string calldata _metaEvidenceDepositor) external onlyGovernor {
        metaEvidenceUpdates++;
        emit MetaEvidence(2 * metaEvidenceUpdates, _metaEvidenceClaimant);
        emit MetaEvidence(2 * metaEvidenceUpdates + 1, _metaEvidenceDepositor);
    }

    /** @dev Challenge the claim created in HATVaults contract. It can be challenged either by the hacker who submitted the claim, or by the pool depositors.
     *  @param _poolId The ID of the related pool.
     *  @param _severity Appropriate severity of the claim according to the hacker.
     *  @param _evidence URI of the evidence to support the challenge.
     */
    function challengeClaim(uint256 _poolId, uint256 _severity, string calldata _evidence) external payable {
        (address beneficiary, uint256 severity,, uint256 createdAt) = HATVaults.pendingApprovals(_poolId);
        // PoolId + time of creation should give a unique ID of the claim, considering they can only happen one at a time.
        bytes32 claimId = keccak256(abi.encodePacked(_poolId, createdAt));
        Claim storage claim = claims[claimId];

        require(beneficiary != address(0), "No pending approval");
        require(claim.status == Status.None, "Claim is already challenged or resolved");
        require(msg.value >= arbitrator.arbitrationCost(arbitratorExtraData), "Should pay the full deposit.");

        if (claim.nbChallenges == 0) {
            require(block.timestamp - createdAt <= HATVaults.getChallengePeriod(), "Time to challenge has passed."); 
        } else {
            require(block.timestamp - claim.openToChallengeAt <= HATVaults.getChallengePeriod(), "Time to challenge has passed.");
        }

        // NOTE: Is beneficiary always a hacker? Or not necessarily? Maybe we need a way to determine more strictly who the hacker is.
        // Depositor in this case is any other address. Is that correct?
        uint256 metaEvidenceId;
        if (msg.sender != beneficiary) {
            // Depositor's challenge.
            require(claim.nbChallenges > 0 || block.timestamp - createdAt > claimantWaitingPeriod, "Can't challenge before claimant");
            metaEvidenceId = metaEvidenceUpdates + 1;
            claim.status = Status.DisputedByDepositor;
        } else {
            // Claimant's challenge. Note that claimant can't challenge after depositor.
            require(claim.nbChallenges == 0, "Claimant already had a dispute");
            require(_severity > severity && _severity <= HATVaults.getMaxSeverity(_poolId), "Severity is not in range");
            metaEvidenceId = metaEvidenceUpdates;
            claim.status = Status.DisputedByClaimant;
            claim.severity = _severity;
        }

        uint256 localDisputeId = disputes.length;
        claim.poolId = _poolId;
        claim.localDisputeId = localDisputeId;
        claim.nbChallenges++;

        DisputeStruct storage dispute = disputes.push();
        dispute.claimId = claimId;
        dispute.challenger = msg.sender;

        // Surplus value will be used to add more jurors.
        uint256 externalDisputeId = arbitrator.createDispute{value: msg.value}(RULING_OPTIONS,  arbitratorExtraData);
        dispute.externalDisputeId = externalDisputeId;
        externalIDtoLocalId[externalDisputeId] = localDisputeId;

        if (claim.nbChallenges == 1) {
            HATVaults.isChallenged(_poolId);
        }
    
        emit ClaimChallenged(_poolId, claimId);
        emit Dispute(arbitrator, externalDisputeId, metaEvidenceId, localDisputeId);
        emit Evidence(arbitrator, localDisputeId, msg.sender, _evidence);
    }

    /** @dev Accept the claim that wasn't challenged before the timeout and unlock the pool.
     *  @param _poolId The ID of the related pool.
     */    
    // NOTE: Should this function also accept the claims that were never challenged? Or should 'acceptClaim' be split between HATVaults and this contract?
    function acceptClaim(uint256 _poolId) external {
        (address beneficiary, uint256 severity,, uint256 createdAt) = HATVaults.pendingApprovals(_poolId);        
        bytes32 claimId = keccak256(abi.encodePacked(_poolId, createdAt));
        Claim storage claim = claims[claimId];
        
        require(beneficiary != address(0), "No pending approval");
        require(claim.status == Status.None, "Claim should not be challenged");
        if (claim.openToChallengeAt == 0) {
            // Claim wasn't challenged by anyone and claim struct wasn't initiated in this contract.
            require(block.timestamp - createdAt > HATVaults.getChallengePeriod(), "Time to challenge should pass");           
        } else {
            // Claim was initiated by the claimant but not fulfilled, and wasn't challenged by a depositor later.
            require(block.timestamp - claim.openToChallengeAt > HATVaults.getChallengePeriod(), "Time to challenge should pass");
            claim.status = Status.Resolved;
        }
        HATVaults.approveClaim(_poolId, severity);
    }

    /** @dev Appeal the juror's decision and request the arbitration from the court once more. Appeal can only be funded by either the committee or challenger to avoid appeal spamming.
     *  @param _ruling Funded ruling option. Note that only the ruling that didn't win in the previous round can be funded.
     */  
    function fundAppeal(uint256 _ruling) external payable {
        // The last dispute is always the relevant one.
        DisputeStruct storage dispute = disputes[disputes.length - 1];
        Claim storage claim = claims[dispute.claimId];
        IArbitrator claimArbitrator = arbitrator;
        uint256 externalDisputeId = dispute.externalDisputeId;

        require(claim.status == Status.DisputedByClaimant || claim.status == Status.DisputedByDepositor, "Status must be Disputed.");
        (uint256 appealPeriodStart, uint256 appealPeriodEnd) = claimArbitrator.appealPeriod(externalDisputeId);
        require(block.timestamp >= appealPeriodStart && block.timestamp < appealPeriodEnd, "Appeal period has passed.");
        require(dispute.nbAppeals < maxNbAppeals, "Can't be appealed anymore");

        uint256 winner = claimArbitrator.currentRuling(externalDisputeId);
        address committee = HATVaults.committees(claim.poolId);

        if (winner == uint256(Decision.Committee)) {
            require(msg.sender == dispute.challenger && _ruling == uint256(Decision.Challenger), "Only losing side is allowed to fund");
        } else if (winner == uint256(Decision.Challenger)) {
            require(msg.sender == committee && _ruling == uint256(Decision.Committee), "Only losing side is allowed to fund");
        } else {
            // Arbitrator didn't favor either of the parties in the previous round.
            require(msg.sender == committee || msg.sender == dispute.challenger, "Only committee or challenger can fund");
        }
        
        uint256 appealCost = claimArbitrator.appealCost(externalDisputeId, arbitratorExtraData);
        uint256 totalCost = appealCost + (appealCost * appealFeeMultiplier) / MULTIPLIER_DIVISOR;
        require(msg.value >= totalCost, "Should cover the total cost");
        dispute.nbAppeals++;

        // The excess value will stay in the contract and will be paid out as a reward to depositors.
        // TODO: reward distribution.
        claimArbitrator.appeal{value: appealCost}(externalDisputeId, arbitratorExtraData);
    }

    /** @dev Give a ruling for a dispute. Can only be called by the arbitrator.
     *  Note that the ruling isn't enforced if the claim was dismissed earlier.
     *  @param _disputeId ID of the dispute in the arbitrator contract.
     *  @param _ruling Ruling given by the arbitrator. Note that 0 is reserved for "Refused to arbitrate".
     */
    function rule(uint256 _disputeId, uint256 _ruling) external override {
        uint256 localDisputeId = externalIDtoLocalId[_disputeId];
        Claim storage claim = claims[disputes[localDisputeId].claimId];

        require(claim.status == Status.DisputedByClaimant || claim.status == Status.DisputedByDepositor || claim.status == Status.Dismissed, "Status must be Disputed.");
        require(_ruling <= RULING_OPTIONS, "Invalid ruling option");
        require(address(arbitrator) == msg.sender, "Only the arbitrator can execute");

        DisputeStruct storage dispute = disputes[localDisputeId];
        dispute.ruling = Decision(_ruling);
        dispute.resolved = true;
        if (claim.status != Status.Dismissed) {
            if (_ruling == uint256(Decision.Challenger)) {
                if (claim.status == Status.DisputedByClaimant) {
                    // Claimant won the dispute. Change the severity.
                    HATVaults.approveClaim(claim.poolId, claim.severity);
                } else {
                    // Depositor won. Dismiss the claim.
                    HATVaults.dismissPendingApprovalClaim(claim.poolId);
                }
                claim.status = Status.Resolved;
            } else {
                // Arbitrator sided with committee or refused to arbitrate (gave 0 ruling).
                if (claim.status == Status.DisputedByClaimant) {
                    // Claimant lost. Set the claim status to default to allow the depositors to challenge.
                    claim.status = Status.None;
                    claim.openToChallengeAt = block.timestamp;
                } else {
                    // Depositor lost. Resolve the claim and report it to HATVaults with default severity.
                    (, uint256 severity,,) = HATVaults.pendingApprovals(claim.poolId);
                    claim.status = Status.Resolved;
                    HATVaults.approveClaim(claim.poolId, severity);
                }     
            }            
        }
        emit Ruling(IArbitrator(msg.sender), _disputeId, _ruling);
    }

    /** @dev Submit a reference to evidence. EVENT.
     *  Note that evidence can be submitted even before the dispute is created.
     *  @param _poolId The id of the related pool.
     *  @param _evidenceURI Link to evidence.
     */
    function submitEvidence(uint256 _poolId, string calldata _evidenceURI) external {
        (address beneficiary,,, uint256 createdAt) = HATVaults.pendingApprovals(_poolId);
        bytes32 claimId = keccak256(abi.encodePacked(_poolId, createdAt));
        require(beneficiary != address(0), "No pending approval");

        emit Evidence(arbitrator, uint256(claimId), msg.sender, _evidenceURI);
    }
    
    /** @dev Dismiss the claim if it takes too long to resolve. Can only be called by the governance.
     *  @param _poolId The id of the related pool.
     */
    function dismissClaim(uint256 _poolId) onlyGovernor external {
        (,,, uint256 createdAt) = HATVaults.pendingApprovals(_poolId);
        bytes32 claimId = keccak256(abi.encodePacked(_poolId, createdAt)); 
        Claim storage claim = claims[claimId];

        require(claim.status == Status.DisputedByClaimant || claim.status == Status.DisputedByDepositor, "Claim should be disputed");
        require(block.timestamp > createdAt + dismissTimeout, "Dismiss timeout did not pass yet");
        claim.status = Status.Dismissed;
        HATVaults.dismissPendingApprovalClaim(_poolId);
    }

    /** @dev Get the arbitration cost to challenge a claim.
     *  @return Arbitration cost.
     */   
    function getArbitrationCost() external view returns (uint256) {
        return arbitrator.arbitrationCost(arbitratorExtraData);
    }

    /** @dev Get the cost of the appeal of the latest dispute.
     *  @return appealCost Cost of the appeal returned by the arbitrator.
     *  @return totalCost Total cost the an appeal funding that includes multiplier.
     */   
    function getAppealCost() external view returns (uint256 appealCost, uint256 totalCost){
        uint256 externalDisputeId = disputes[disputes.length - 1].externalDisputeId;
       
        appealCost = arbitrator.appealCost(externalDisputeId, arbitratorExtraData);
        totalCost = appealCost + (appealCost * appealFeeMultiplier) / MULTIPLIER_DIVISOR;
    }
}
