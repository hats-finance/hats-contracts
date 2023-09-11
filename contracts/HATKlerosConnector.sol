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
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IHATArbitrator.sol";
import "./interfaces/IHATVault.sol";
import "./interfaces/IHATKlerosConnector.sol";

/**
 *  @title HATKlerosConnector
 *  @dev This contract acts a connector between HatsFinance and Kleros court.
 *  This contract trusts that the Arbitrator is honest and will not reenter or modify its costs during a call.
 *  The arbitrator must support appeal period.
 *  The contract also trusts that IHATArbitrator contract is honest and won't reenter.
 */
contract HATKlerosConnector is IDisputeResolver, IHATKlerosConnector, Ownable {
    uint256 private constant RULING_OPTIONS = 2; // The amount of non 0 choices the arbitrator can give.
    uint256 private constant MULTIPLIER_DIVISOR = 10000; // Divisor parameter for multipliers.

    struct DisputeStruct {
        bytes32 claimId; // Id of the claim in HATVault contract.
        uint256 externalDisputeId; // Id of the dispute created in Kleros court.
        Decision ruling; // Ruling given by the arbitrator.
        bool resolved; // True if the dispute has been resolved.
        IHATVault vault; // Address of the vault related to a dispute.
        Round[] rounds; // Appeal rounds.
    }

    // Round struct stores the contributions made to particular sides.
    // - 0 side for `Decision.None`.
    // - 1 side for `Decision.ExecuteResolution`.
    // - 2 side for `Decision.DismissResolution`.
    struct Round {
        uint256[3] paidFees; // Tracks the fees paid in this round in the form paidFees[side].
        bool[3] hasPaid; // True if the fees for this particular side have been fully paid in the form hasPaid[side].
        mapping(address => uint256[3]) contributions; // Maps contributors to their contributions for each side in the form contributions[address][side].
        uint256 feeRewards; // Sum of reimbursable appeal fees available to the parties that made contributions to the side that ultimately wins a dispute.
        uint256[] fundedSides; // Stores the sides that are fully funded.
    }

    IArbitrator public immutable klerosArbitrator; // The kleros arbitrator contract (e.g. Kleros Court).
    IHATArbitrator public immutable hatArbitrator; // Address of the Hat arbitrator contract.
    uint256 public metaEvidenceUpdates; // Relevant index of the metaevidence.
    bytes public arbitratorExtraData; // Extra data for the arbitrator.

    uint256 public winnerMultiplier; // Multiplier for calculating the appeal fee that must be paid for the ruling that was chosen by the arbitrator in the previous round, in basis points.
    uint256 public loserMultiplier; // Multiplier for calculating the appeal fee that must be paid for the ruling that the arbitrator didn't rule for in the previous round, in basis points.
    uint256 public immutable loserAppealPeriodMultiplier = 5000; // Multiplier for calculating the duration of the appeal period for the loser, in basis points.

    DisputeStruct[] public disputes; // Stores the disputes created in this contract.
    mapping(bytes32 => bool) public claimChallenged; // True if the claim was challenged in this contract.
    mapping(uint256 => uint256) public override externalIDtoLocalID; // Maps external dispute ids to local dispute ids.

    /** @dev Raised when a claim is challenged.
     *  @param _claimId Id of the claim in Vault cotract.
     */
    event Challenged(bytes32 indexed _claimId);

    /** @dev Constructor.
     *  @param _klerosArbitrator The Kleros arbitrator of the contract.
     *  @param _arbitratorExtraData Extra data for the arbitrator.
     *  @param _hatArbitrator Address of the Hat arbitrator.
     *  @param _metaEvidence Metaevidence for the dispute.
     *  @param _winnerMultiplier Multiplier for calculating the appeal cost of the winning side.
     *  @param _loserMultiplier Multiplier for calculation the appeal cost of the losing side.
     */
    constructor(
        IArbitrator _klerosArbitrator,
        bytes memory _arbitratorExtraData,
        IHATArbitrator _hatArbitrator,
        string memory _metaEvidence,
        uint256 _winnerMultiplier,
        uint256 _loserMultiplier
    ) {
        emit MetaEvidence(0, _metaEvidence);

        klerosArbitrator = _klerosArbitrator;
        arbitratorExtraData = _arbitratorExtraData;
        hatArbitrator = _hatArbitrator;
        winnerMultiplier = _winnerMultiplier;
        loserMultiplier = _loserMultiplier;
    }

    // ******************** //
    // *    Governance    * //
    // ******************** //

    /** @dev Changes winnerMultiplier variable.
     *  @param _winnerMultiplier The new winnerMultiplier value.
     */
    function changeWinnerMultiplier(
        uint256 _winnerMultiplier
    ) external onlyOwner {
        winnerMultiplier = _winnerMultiplier;
    }

    /** @dev Changes loserMultiplier variable.
     *  @param _loserMultiplier The new winnerMultiplier value.
     */
    function changeLoserMultiplier(
        uint256 _loserMultiplier
    ) external onlyOwner {
        loserMultiplier = _loserMultiplier;
    }

    /** @dev Update the meta evidence used for disputes.
     *  @param _metaEvidence URI of the new meta evidence.
     */
    function changeMetaEvidence(
        string calldata _metaEvidence
    ) external onlyOwner {
        metaEvidenceUpdates++;
        emit MetaEvidence(metaEvidenceUpdates, _metaEvidence);
    }

    // ******************** //
    // *    Challenges    * //
    // ******************** //

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
        IHATVault _vault,
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

        // Preemptively create a new funding round for future appeals.
        dispute.rounds.push();

        uint256 externalDisputeId = klerosArbitrator.createDispute{
            value: arbitrationCost
        }(RULING_OPTIONS, arbitratorExtraData);
        dispute.externalDisputeId = externalDisputeId;
        externalIDtoLocalID[externalDisputeId] = localDisputeId;

        if (msg.value > arbitrationCost)
            payable(_disputer).transfer(msg.value - arbitrationCost);

        emit Challenged(_claimId);
        emit Dispute(
            klerosArbitrator,
            externalDisputeId,
            metaEvidenceUpdates,
            localDisputeId
        );
        emit Evidence(klerosArbitrator, localDisputeId, _disputer, _evidence);
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
        require(
            address(klerosArbitrator) == msg.sender,
            "Only the arbitrator can execute"
        );
        uint256 finalRuling = _ruling;

        // If one side paid its fees, the ruling is in its favor. Note that if the other side had also paid, an appeal would have been created.
        Round storage round = dispute.rounds[dispute.rounds.length - 1];
        if (round.fundedSides.length == 1) finalRuling = round.fundedSides[0];

        dispute.ruling = Decision(finalRuling);
        dispute.resolved = true;

        bytes32 claimId = dispute.claimId;
        if (finalRuling == uint256(Decision.ExecuteResolution)) {
            hatArbitrator.executeResolution(dispute.vault, claimId);
        } else {
            // Arbitrator dismissed the resolution or refused to arbitrate (gave 0 ruling).
            hatArbitrator.dismissResolution(dispute.vault, claimId);
        }

        emit Ruling(IArbitrator(msg.sender), _disputeId, finalRuling);
    }

    /** @dev Submit a reference to evidence. EVENT.
     *  @param _localDisputeId The id of the related dispute.
     *  @param _evidenceURI Link to evidence.
     */
    function submitEvidence(
        uint256 _localDisputeId,
        string calldata _evidenceURI
    ) external override {
        DisputeStruct storage dispute = disputes[_localDisputeId];
        // Note that by reading dispute's value we also check that it exists.
        require(!dispute.resolved, "Dispute already resolved");

        emit Evidence(
            klerosArbitrator,
            _localDisputeId,
            msg.sender,
            _evidenceURI
        );
    }

    // ************************ //
    // *       Appeals        * //
    // ************************ //

    /** @dev Takes up to the total amount required to fund a side. Reimburses the rest. Creates an appeal if both sides are fully funded.
     *  @param _localDisputeId The ID of the local dispute.
     *  @param _side The option to fund. 0 - refuse to rule, 1 - make no changes, 2 - side with challenger.
     *  @return fullyFunded Whether the side was fully funded or not.
     */
    function fundAppeal(
        uint256 _localDisputeId,
        uint256 _side
    ) external payable override returns (bool) {
        DisputeStruct storage dispute = disputes[_localDisputeId];
        require(!dispute.resolved, "Dispute already resolved.");
        require(_side <= RULING_OPTIONS, "Side out of bounds");

        uint256 externalDisputeId = dispute.externalDisputeId;
        (uint256 appealPeriodStart, uint256 appealPeriodEnd) = klerosArbitrator
            .appealPeriod(externalDisputeId);
        require(
            block.timestamp >= appealPeriodStart &&
                block.timestamp < appealPeriodEnd,
            "Appeal period is over."
        );

        uint256 multiplier;
        {
            uint256 winner = klerosArbitrator.currentRuling(externalDisputeId);
            if (winner == _side) {
                multiplier = winnerMultiplier;
            } else {
                require(
                    block.timestamp - appealPeriodStart <
                        ((appealPeriodEnd - appealPeriodStart) *
                            loserAppealPeriodMultiplier) /
                            MULTIPLIER_DIVISOR,
                    "Appeal period is over for loser"
                );
                multiplier = loserMultiplier;
            }
        }

        uint256 lastRoundId = dispute.rounds.length - 1;
        Round storage round = dispute.rounds[lastRoundId];
        require(!round.hasPaid[_side], "Appeal fee is already paid.");
        uint256 appealCost = klerosArbitrator.appealCost(
            externalDisputeId,
            arbitratorExtraData
        );
        uint256 totalCost = appealCost +
            (appealCost * multiplier) /
            MULTIPLIER_DIVISOR;

        // Take up to the amount necessary to fund the current round at the current costs.
        uint256 contribution = totalCost - round.paidFees[_side] > msg.value
            ? msg.value
            : totalCost - round.paidFees[_side];
        emit Contribution(
            _localDisputeId,
            lastRoundId,
            _side,
            msg.sender,
            contribution
        );

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

            round.feeRewards = round.feeRewards - appealCost;
            klerosArbitrator.appeal{value: appealCost}(
                externalDisputeId,
                arbitratorExtraData
            );
        }

        if (msg.value > contribution)
            payable(msg.sender).transfer(msg.value - contribution); // Sending extra value back to contributor. It is the user's responsibility to accept ETH.
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
            reward =
                (round.contributions[_beneficiary][_side] * round.feeRewards) /
                (round.paidFees[round.fundedSides[0]] +
                    round.paidFees[round.fundedSides[1]]);
        } else if (finalRuling == _side) {
            uint256 paidFees = round.paidFees[_side];
            // Reward the winner.
            reward = paidFees > 0
                ? (round.contributions[_beneficiary][_side] *
                    round.feeRewards) / paidFees
                : 0;
        }

        if (reward != 0) {
            round.contributions[_beneficiary][_side] = 0;
            _beneficiary.transfer(reward); // It is the user's responsibility to accept ETH.
            emit Withdrawal(
                _localDisputeId,
                _round,
                _side,
                _beneficiary,
                reward
            );
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
        for (
            uint256 roundNumber = 0;
            roundNumber < numberOfRounds;
            roundNumber++
        ) {
            withdrawFeesAndRewards(
                _localDisputeId,
                _beneficiary,
                roundNumber,
                _contributedTo
            );
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
        return (
            winnerMultiplier,
            loserMultiplier,
            loserAppealPeriodMultiplier,
            MULTIPLIER_DIVISOR
        );
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
                sum +=
                    (round.contributions[_beneficiary][_contributedTo] *
                        round.feeRewards) /
                    (round.paidFees[round.fundedSides[0]] +
                        round.paidFees[round.fundedSides[1]]);
            } else if (finalRuling == _contributedTo) {
                uint256 paidFees = round.paidFees[_contributedTo];
                // Reward the winner.
                sum += paidFees > 0
                    ? (round.contributions[_beneficiary][_contributedTo] *
                        round.feeRewards) / paidFees
                    : 0;
            }
        }
    }

    /** @dev Gets the number of rounds of the specific dispute.
     *  @param _localDisputeId The ID of the dispute.
     *  @return The number of rounds.
     */
    function getNumberOfRounds(
        uint256 _localDisputeId
    ) external view returns (uint256) {
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
    function getRoundInfo(
        uint256 _localDisputeId,
        uint256 _round
    )
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
    ) external view returns (uint256[3] memory contributions) {
        DisputeStruct storage dispute = disputes[_localDisputeId];
        Round storage round = dispute.rounds[_round];
        contributions = round.contributions[_contributor];
    }
}
