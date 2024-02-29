// SPDX-License-Identifier: MIT

pragma solidity 0.8.16;

contract HatVaultForConnectorMock {

    struct Claim {
        bytes32 claimId;
        address beneficiary;
        uint16 bountyPercentage;
        address committee;
        uint32 createdAt;
        uint32 challengedAt;
        uint256 governanceFee;
        address arbitrator;
        uint32 challengePeriod;
        uint32 challengeTimeOutPeriod;
        bool arbitratorCanChangeBounty;
        bool arbitratorCanChangeBeneficiary;
    }

    uint16 public constant MAX_BOUNTY_LIMIT = 90e2;
    uint32 public constant CHALLENGE_TIMEOUT_PERIOD = type(uint32).max;

    address public arbitrator;
    Claim public activeClaim;
    uint32 public challengePeriod;
    uint256 public nonce;

    event SubmitClaim(bytes32 _claimId, address _submitter, address _beneficiary, uint256 _bountyPercentage, string _descriptionHash);
    event ApproveClaim(bytes32 _claimId, address _sender, address _beneficiary, uint256 _bountyPercentage);
    event ChallengeClaim(bytes32 indexed _claimId);
    event DismissClaim(bytes32 indexed _claimId);

    modifier isActiveClaim(bytes32 _claimId) {
        require(activeClaim.createdAt != 0, "Claim does not exist");
        require(activeClaim.claimId == _claimId, "Claim id is not active");
        _;
    }

    modifier noActiveClaim() {
        require(activeClaim.createdAt == 0, "Active claim exists");
        _;
    }

    constructor (address _arbitrator, uint32 _challengePeriod) {      
        arbitrator = _arbitrator;
        challengePeriod = _challengePeriod;        
    }

    function setArbitrator(address _arbitrator) external {
        arbitrator = _arbitrator;
    }

    function submitClaim(address _beneficiary, uint16 _bountyPercentage, string calldata _descriptionHash)
        external noActiveClaim  returns (bytes32 claimId) {

        require(_bountyPercentage <= MAX_BOUNTY_LIMIT, "Max bounty exceeded");

        claimId = keccak256(abi.encodePacked(address(this), ++nonce));
        activeClaim = Claim({
            claimId: claimId,
            beneficiary: _beneficiary,
            bountyPercentage: _bountyPercentage,
            committee: msg.sender,
            // solhint-disable-next-line not-rely-on-time
            createdAt: uint32(block.timestamp),
            challengedAt: 0,
            governanceFee: 0,
            arbitrator: arbitrator,
            challengePeriod: challengePeriod,
            challengeTimeOutPeriod: CHALLENGE_TIMEOUT_PERIOD,
            arbitratorCanChangeBounty: true,
            arbitratorCanChangeBeneficiary: true
        });

        emit SubmitClaim(
            claimId,
            msg.sender,
            _beneficiary,
            _bountyPercentage,
            _descriptionHash
        );
    }

    function challengeClaim(bytes32 _claimId) external isActiveClaim(_claimId) {
        require(msg.sender == activeClaim.arbitrator, "Only arbitrator allowed");
        require(block.timestamp < activeClaim.createdAt + activeClaim.challengePeriod, "Challenge period ended");
        require(activeClaim.challengedAt == 0, "Claim already challenged");

        activeClaim.challengedAt = uint32(block.timestamp);
        emit ChallengeClaim(_claimId);
    }

    function approveClaim(bytes32 _claimId, uint16 _bountyPercentage, address _beneficiary) external isActiveClaim(_claimId) {
        Claim memory _claim = activeClaim;

        require(msg.sender == activeClaim.arbitrator, "Only arbitrator allowed");
        delete activeClaim;

        if (_bountyPercentage != 0) {
            _claim.bountyPercentage = _bountyPercentage;
        }

        if (_beneficiary != address(0)) {
            _claim.beneficiary = _beneficiary;
        }

        emit ApproveClaim(
            _claimId,
            msg.sender,
            _claim.beneficiary,
            _claim.bountyPercentage
        );
    }

    function dismissClaim(bytes32 _claimId) external isActiveClaim(_claimId) {
        require(activeClaim.challengedAt != 0, "Claim should be challenged");
        require(msg.sender == activeClaim.arbitrator, "Only arbitrator allowed");
        delete activeClaim;

        emit DismissClaim(_claimId);
    }

    function getActiveClaim() public view returns(Claim memory) {
        return activeClaim;
    }
}
