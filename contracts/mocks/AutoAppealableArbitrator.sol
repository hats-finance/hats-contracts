// SPDX-License-Identifier: MIT

/**
 *  @authors: [@clesaege]
 *  @reviewers: []
 *  @auditors: []
 *  @bounties: []
 *  @deployments: []
 */

pragma solidity 0.8.16;

import "@kleros/erc-792/contracts/IArbitrable.sol";
import "@kleros/erc-792/contracts/IArbitrator.sol";
import "../libraries/CappedMath.sol";

/** @title Auto Appealable Arbitrator
 *  @dev This is a centralized arbitrator which either gives direct rulings or provides a time and fee for appeal.
 */
contract AutoAppealableArbitrator is IArbitrator {
    using CappedMath for uint256; // Operations bounded between 0 and 2**256 - 1.

    address public owner = msg.sender;
    uint256 public arbitrationPrice; // Not public because arbitrationCost already acts as an accessor.
    uint256 public constant NOT_PAYABLE_VALUE = (2**256 - 2) / 2; // High value to be sure that the appeal is too expensive.

    struct Dispute {
        IArbitrable arbitrated; // The contract requiring arbitration.
        uint256 choices; // The amount of possible choices, 0 excluded.
        uint256 fees; // The total amount of fees collected by the arbitrator.
        uint256 ruling; // The current ruling.
        DisputeStatus status; // The status of the dispute.
        uint256 appealCost; // The cost to appeal. 0 before it is appealable.
        uint256 appealPeriodStart; // The start of the appeal period. 0 before it is appealable.
        uint256 appealPeriodEnd; // The end of the appeal Period. 0 before it is appealable.
    }

    modifier onlyOwner {
        require(msg.sender == owner, "Can only be called by the owner.");
        _;
    }

    Dispute[] public disputes;

    /** @dev Constructor. Set the initial arbitration price.
     *  @param _arbitrationPrice Amount to be paid for arbitration.
     */
    constructor(uint256 _arbitrationPrice) public {
        arbitrationPrice = _arbitrationPrice;
    }

    /** @dev Set the arbitration price. Only callable by the owner.
     *  @param _arbitrationPrice Amount to be paid for arbitration.
     */
    function setArbitrationPrice(uint256 _arbitrationPrice) external onlyOwner {
        arbitrationPrice = _arbitrationPrice;
    }

    /** @dev Cost of arbitration. Accessor to arbitrationPrice.
     *  @return fee Amount to be paid.
     */
    function arbitrationCost(bytes memory) public view override returns (uint256 fee) {
        return arbitrationPrice;
    }

    /** @dev Cost of appeal. If appeal is not possible, it's a high value which can never be paid.
     *  @param _disputeID ID of the dispute to be appealed.
     *  @return fee Amount to be paid.
     */
    function appealCost(uint256 _disputeID, bytes memory) public view override returns (uint256 fee) {
        Dispute storage dispute = disputes[_disputeID];
        if (dispute.status == DisputeStatus.Appealable) return dispute.appealCost;
        else return NOT_PAYABLE_VALUE;
    }

    /** @dev Create a dispute. Must be called by the arbitrable contract.
     *  Must be paid at least arbitrationCost().
     *  @param _choices Amount of choices the arbitrator can make in this dispute. When ruling <= choices.
     *  @param _extraData Can be used to give additional info on the dispute to be created.
     *  @return disputeID ID of the dispute created.
     */
    function createDispute(uint256 _choices, bytes memory _extraData)
        public
        payable
        override
        returns (uint256 disputeID)
    {
        uint256 arbitrationFee = arbitrationCost(_extraData);
        require(msg.value >= arbitrationFee, "Value is less than required arbitration fee.");
        disputes.push(
            Dispute({
                arbitrated: IArbitrable(msg.sender),
                choices: _choices,
                fees: msg.value,
                ruling: 0,
                status: DisputeStatus.Waiting,
                appealCost: 0,
                appealPeriodStart: 0,
                appealPeriodEnd: 0
            })
        ); // Create the dispute and return its number.
        disputeID = disputes.length - 1;
        emit DisputeCreation(disputeID, IArbitrable(msg.sender));
    }

    /** @dev Give a ruling. UNTRUSTED.
     *  @param _disputeID ID of the dispute to rule.
     *  @param _ruling Ruling given by the arbitrator. Note that 0 means "Not able/wanting to make a decision".
     */
    function giveRuling(uint256 _disputeID, uint256 _ruling) external onlyOwner {
        Dispute storage dispute = disputes[_disputeID];
        require(_ruling <= dispute.choices, "Invalid ruling.");
        require(dispute.status == DisputeStatus.Waiting, "The dispute must be waiting for arbitration.");

        dispute.ruling = _ruling;
        dispute.status = DisputeStatus.Solved;

        payable(msg.sender).send(dispute.fees); // Avoid blocking.
        dispute.arbitrated.rule(_disputeID, _ruling);
    }

    /** @dev Give an appealable ruling.
     *  @param _disputeID ID of the dispute to rule.
     *  @param _ruling Ruling given by the arbitrator. Note that 0 means "Not able/wanting to make a decision".
     *  @param _appealCost The cost of appeal.
     *  @param _timeToAppeal The time to appeal the ruling.
     */
    function giveAppealableRuling(
        uint256 _disputeID,
        uint256 _ruling,
        uint256 _appealCost,
        uint256 _timeToAppeal
    ) external onlyOwner {
        Dispute storage dispute = disputes[_disputeID];
        require(_ruling <= dispute.choices, "Invalid ruling.");
        require(dispute.status == DisputeStatus.Waiting, "The dispute must be waiting for arbitration.");

        dispute.ruling = _ruling;
        dispute.status = DisputeStatus.Appealable;
        dispute.appealCost = _appealCost;
        dispute.appealPeriodStart = block.timestamp;
        dispute.appealPeriodEnd = block.timestamp.addCap(_timeToAppeal);

        emit AppealPossible(_disputeID, dispute.arbitrated);
    }

    /** @dev Change the appeal fee of a dispute.
     *  @param _disputeID The ID of the dispute to update.
     *  @param _appealCost The new cost to appeal this ruling.
     */
    function changeAppealFee(uint256 _disputeID, uint256 _appealCost) external onlyOwner {
        Dispute storage dispute = disputes[_disputeID];
        require(dispute.status == DisputeStatus.Appealable, "The dispute must be appealable.");

        dispute.appealCost = _appealCost;
    }

    /** @dev Appeal a ruling. Note that it has to be called before the arbitrator contract calls rule.
     *  @param _disputeID ID of the dispute to be appealed.
     *  @param _extraData Can be used to give extra info on the appeal.
     */
    function appeal(uint256 _disputeID, bytes memory _extraData) public payable override {
        Dispute storage dispute = disputes[_disputeID];
        uint256 appealFee = appealCost(_disputeID, _extraData);
        require(dispute.status == DisputeStatus.Appealable, "The dispute must be appealable.");
        require(
            block.timestamp < dispute.appealPeriodEnd,
            "The appeal must occur before the end of the appeal period."
        );
        require(msg.value >= appealFee, "Value is less than required appeal fee");

        dispute.appealPeriodStart = 0;
        dispute.appealPeriodEnd = 0;
        dispute.fees += msg.value;
        dispute.status = DisputeStatus.Waiting;
        emit AppealDecision(_disputeID, IArbitrable(msg.sender));
    }

    /** @dev Execute the ruling of a dispute after the appeal period has passed. UNTRUSTED.
     *  @param _disputeID ID of the dispute to execute.
     */
    function executeRuling(uint256 _disputeID) external {
        Dispute storage dispute = disputes[_disputeID];
        require(dispute.status == DisputeStatus.Appealable, "The dispute must be appealable.");
        require(
            block.timestamp >= dispute.appealPeriodEnd,
            "The dispute must be executed after its appeal period has ended."
        );

        dispute.status = DisputeStatus.Solved;
        payable(msg.sender).send(dispute.fees); // Avoid blocking.
        dispute.arbitrated.rule(_disputeID, dispute.ruling);
    }

    /** @dev Return the status of a dispute (in the sense of ERC792, not the Dispute property).
     *  @param _disputeID ID of the dispute to rule.
     *  @return status The status of the dispute.
     */
    function disputeStatus(uint256 _disputeID) public view override returns (DisputeStatus status) {
        Dispute storage dispute = disputes[_disputeID];
        if (disputes[_disputeID].status == DisputeStatus.Appealable && block.timestamp >= dispute.appealPeriodEnd)
            // If the appeal period is over, consider it solved even if rule has not been called yet.
            return DisputeStatus.Solved;
        else return disputes[_disputeID].status;
    }

    /** @dev Return the ruling of a dispute.
     *  @param _disputeID ID of the dispute.
     *  @return ruling The ruling which have been given or which would be given if no appeals are raised.
     */
    function currentRuling(uint256 _disputeID) public view override returns (uint256 ruling) {
        return disputes[_disputeID].ruling;
    }

    /** @dev Compute the start and end of the dispute's current or next appeal period, if possible.
     *  @param _disputeID ID of the dispute.
     *  @return start The start of the period.
     *  @return end The End of the period.
     */
    function appealPeriod(uint256 _disputeID) public view override returns (uint256 start, uint256 end) {
        Dispute storage dispute = disputes[_disputeID];
        return (dispute.appealPeriodStart, dispute.appealPeriodEnd);
    }
}