// SPDX-License-Identifier: MIT

/**
 *  @authors: [@unknownunknown1]
 *  @reviewers: []
 *  @auditors: []
 *  @bounties: []
 *  @deployments: []
 */

pragma solidity 0.8.16;

import "./interfaces/IHATArbitrator.sol";
import "./interfaces/IHATClaimsManager.sol";
import "./interfaces/IHATKlerosConnector.sol";
import { IArbitrable, IArbitrator } from "@kleros/erc-792/contracts/IArbitrator.sol";

/**
 *  @title HATKlerosV2Connector
 *  @dev This contract acts a connector between HatsFinance and Kleros court V2. The contract doesn't support appeals and evidence
 *  submisstion, since it'll be handled by the court.
 */
contract HATKlerosV2Connector is IArbitrable, IHATKlerosConnector {

    uint256 private constant RULING_OPTIONS = 2; // The amount of non 0 choices the arbitrator can give.        

    struct DisputeStruct {
        bytes32 claimId; // Id of the claim in HATVault contract.
        uint256 externalDisputeId; // Id of the dispute created in Kleros court.
        Decision ruling; // Ruling given by the arbitrator.
        bool resolved; // True if the dispute has been resolved.
        IHATClaimsManager vault; // Address of the vault related to a dispute.
    }

    IArbitrator public immutable klerosArbitrator; // The kleros arbitrator contract (e.g. Kleros Court).
    IHATArbitrator public immutable hatArbitrator; // Address of the Hat arbitrator contract.
    bytes public arbitratorExtraData; // Extra data for the arbitrator.

    DisputeStruct[] public disputes; // Stores the disputes created in this contract.
    mapping(bytes32 => bool) public claimChallenged; // True if the claim was challenged in this contract..
    mapping(uint256 => uint256) public externalIDtoLocalID; // Maps external dispute ids to local dispute ids.

    /** @dev Raised when a claim is challenged.
     *  @param _claimId Id of the claim in Vault cotract.
     */
    event Challenged(bytes32 indexed _claimId);

    /** @dev Constructor.
     *  @param _klerosArbitrator The Kleros arbitrator of the contract.
     *  @param _arbitratorExtraData Extra data for the arbitrator.
     *  @param _hatArbitrator Address of the Hat arbitrator.
     *  @param _metaEvidence Metaevidence for the dispute.
     */
    constructor (
        IArbitrator _klerosArbitrator,
        bytes memory _arbitratorExtraData,
        IHATArbitrator _hatArbitrator,
        string memory _metaEvidence
    ) {
        // TODO: add new IEvidence events once they're established.
        //emit MetaEvidence(0, _metaEvidence);
        
        klerosArbitrator = _klerosArbitrator;
        arbitratorExtraData = _arbitratorExtraData;
        hatArbitrator = _hatArbitrator;
    }

    /** @dev Notify KlerosArbitrator that expert's committee decision was challenged. Can only be called by Hat arbitrator.
     *  Requires the arbitration fees to be paid.
     *  @param _claimId The Id of the active claim in Vault contract.
     *  @param _evidence URI of the evidence to support the challenge.
     *  @param _vault Relevant vault address.
     *  @param _disputer Address that made the challenge.
     *  Note that the validity of the claim should be checked by Hat arbitrator.
     */
    function notifyArbitrator(
        bytes32 _claimId,
        string calldata _evidence,
        IHATClaimsManager _vault,
        address _disputer
    ) external payable override {
        require(msg.sender == address(hatArbitrator), "Wrong caller");
        require(!claimChallenged[_claimId], "Claim already challenged");

        uint256 arbitrationCost = getArbitrationCost();
        require(msg.value >= arbitrationCost, "Should pay the full deposit.");

        claimChallenged[_claimId] = true;

        uint256 localDisputeId = disputes.length;

        DisputeStruct storage dispute = disputes.push();
        dispute.claimId = _claimId;
        dispute.vault = _vault;

        uint256 externalDisputeId = klerosArbitrator.createDispute{value: arbitrationCost}(RULING_OPTIONS,  arbitratorExtraData);
        dispute.externalDisputeId = externalDisputeId;
        externalIDtoLocalID[externalDisputeId] = localDisputeId;

        if (msg.value > arbitrationCost) payable(_disputer).transfer(msg.value - arbitrationCost);

        emit Challenged(_claimId);
        // TODO: add new IEvidence events once they're established.
        //emit Dispute(klerosArbitrator, externalDisputeId, 0, localDisputeId);
        //emit Evidence(klerosArbitrator, localDisputeId, msg.sender, _evidence);
    } 

    /** @dev Give a ruling for a dispute. Can only be called by the Kleros arbitrator.
     *  @param _disputeId ID of the dispute in the Kleros arbitrator contract.
     *  @param _ruling Ruling given by the arbitrator. Note that 0 is reserved for "Refused to arbitrate".
     */
    function rule(uint256 _disputeId, uint256 _ruling) external override {
        uint256 localDisputeId = externalIDtoLocalID[_disputeId];

        DisputeStruct storage dispute = disputes[localDisputeId];

        require(!dispute.resolved, "Already resolved");
        require(_ruling <= RULING_OPTIONS, "Invalid ruling option");
        require(address(klerosArbitrator) == msg.sender, "Only the arbitrator can execute");
    
        dispute.ruling = Decision(_ruling);
        dispute.resolved = true;

        bytes32 claimId = dispute.claimId;
        if (_ruling == uint256(Decision.ExecuteResolution)) {  
            hatArbitrator.executeResolution(dispute.vault, claimId);
        } else {
            // Arbitrator dismissed the resolution or refused to arbitrate (gave 0 ruling).
            hatArbitrator.dismissResolution(dispute.vault, claimId);
        }
      
        emit Ruling(IArbitrator(msg.sender), _disputeId, _ruling);
    }

    /** @dev Get the arbitration cost to challenge a claim.
     *  @return Arbitration cost.
     */   
    function getArbitrationCost() public view returns (uint256) {
        return klerosArbitrator.arbitrationCost(arbitratorExtraData);
    }
}
