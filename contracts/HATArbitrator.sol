// SPDX-License-Identifier: MIT
// Disclaimer https://github.com/hats-finance/hats-contracts/blob/main/DISCLAIMER.md

pragma solidity 0.8.16;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IHATKlerosConnector.sol";
import "./interfaces/IHATArbitrator.sol";

/* solhint-disable not-rely-on-time */
contract HATArbitrator is IHATArbitrator, Ownable {
    using SafeERC20 for IERC20;

    address public expertCommittee; // address of the Expert Committee
    address public court; // address of the court - kleros, uma, etc
    IERC20 public token; // the token in which bonds need to be paid
    uint256 public minBondAmount; // minimum bond that a disputer needs to provide to participate in a dispute of the committee's claim
    uint256 public bondsNeededToStartDispute; // total amount of bonds needed to start a dispute of a committee's claim
    uint256 public resolutionChallengePeriod; // the amount of time that the expert committee's resolution can be challenged
    uint256 public submitClaimRequestReviewPeriod; // the time within which the expert committee must decide on a submitClaimRequest

    mapping(address => mapping(IHATClaimsManager => mapping(bytes32 => uint256)))
        public disputersBonds; // bonds provided by disputers
    mapping(address => mapping(IHATClaimsManager => mapping(bytes32 => bool)))
        public bondClaimable; // whether a given bond is reclaimable by the disputer
    mapping(IHATClaimsManager => mapping(bytes32 => uint256)) public totalBondsOnClaim; // total amount of bonds ona given claim
    mapping(IHATClaimsManager => mapping(bytes32 => Resolution)) public resolutions; // resolutions of disputes by the expert committee
    mapping(IHATClaimsManager => mapping(bytes32 => uint256))
        public resolutionChallengedAt; // the time an expert committee's resolution was challenged
    mapping(bytes32 => SubmitClaimRequest) public submitClaimRequests; // a registry of requests to the expert committee to submit a claim

    uint256 internal nonce;

    modifier onlyExpertCommittee() {
        if (msg.sender != expertCommittee) {
            revert OnlyExpertCommittee();
        }
        _;
    }

    modifier onlyChallengedActiveClaim(IHATClaimsManager _vault, bytes32 _claimId) {
        IHATClaimsManager.Claim memory claim = _vault.getActiveClaim();

        if (claim.claimId != _claimId) {
            revert ClaimIsNotCurrentlyActiveClaim();
        }

        if (claim.challengedAt == 0) {
            revert ClaimIsNotDisputed();
        }

        if (
            block.timestamp >=
            claim.createdAt + claim.challengePeriod + claim.challengeTimeOutPeriod
        ) {
            revert ClaimExpired();
        }
        _;
    }

    modifier onlyUnresolvedDispute(IHATClaimsManager _vault, bytes32 _claimId) {
        if (resolutions[_vault][_claimId].resolvedAt != 0) {
            revert AlreadyResolved();
        }
        _;
    }

    modifier onlyResolvedDispute(IHATClaimsManager _vault, bytes32 _claimId) {
        if (resolutions[_vault][_claimId].resolvedAt == 0) {
            revert NoResolution();
        }
        _;
    }

    constructor(
        address _expertCommittee,
        IERC20 _token,
        uint256 _bondsNeededToStartDispute,
        uint256 _minBondAmount,
        uint256 _resolutionChallengePeriod,
        uint256 _submitClaimRequestReviewPeriod
    ) {
        expertCommittee = _expertCommittee;
        token = _token;
        bondsNeededToStartDispute = _bondsNeededToStartDispute;
        minBondAmount = _minBondAmount;
        resolutionChallengePeriod = _resolutionChallengePeriod;
        submitClaimRequestReviewPeriod = _submitClaimRequestReviewPeriod;
        if (minBondAmount > bondsNeededToStartDispute) {
            revert bondsNeededToStartDisputeMustBeHigherThanMinAmount();
        }
    }

    /** @notice See {IHATArbitrator-setCourt}. */
    function setCourt(address _court) external onlyOwner {
        if (_court == address(0)) {
            revert CourtCannotBeZero();
        }

        if (court != address(0)) {
            revert CannontChangeCourtAddress();
        }

        court = _court;

        emit CourtSet(_court);
    }

    /** @notice See {IHATArbitrator-dispute}. */
    function dispute(
        IHATClaimsManager _vault,
        bytes32 _claimId,
        uint256 _bondAmount,
        string calldata _descriptionHash
    ) external {
        if (_bondAmount < minBondAmount) {
            revert BondAmountSubmittedTooLow();
        }

        IHATClaimsManager.Claim memory claim = _vault.getActiveClaim();
        if (claim.claimId != _claimId) {
            revert ClaimIsNotCurrentlyActiveClaim();
        }

        disputersBonds[msg.sender][_vault][_claimId] += _bondAmount;
        totalBondsOnClaim[_vault][_claimId] += _bondAmount;

        token.safeTransferFrom(msg.sender, address(this), _bondAmount);

        if (totalBondsOnClaim[_vault][_claimId] >= bondsNeededToStartDispute) {
            if (claim.challengedAt == 0) {
                _vault.challengeClaim(_claimId);
            } else {
                // solhint-disable-next-line not-rely-on-time
                if (block.timestamp > claim.challengedAt + 24 hours) {
                    revert CannotSubmitMoreEvidence();
                }
            }
        }

        emit ClaimDisputed(
            _vault,
            _claimId,
            msg.sender,
            _bondAmount,
            _descriptionHash
        );
    }

    /** @notice See {IHATArbitrator-dismissDispute}. */
    function dismissDispute(
        IHATClaimsManager _vault,
        bytes32 _claimId,
        string calldata _descriptionHash
    )
        external
        onlyExpertCommittee
        onlyChallengedActiveClaim(_vault, _claimId)
        onlyUnresolvedDispute(_vault, _claimId)
    {
        resolutions[_vault][_claimId].resolvedAt = block.timestamp;
        token.safeTransfer(msg.sender, totalBondsOnClaim[_vault][_claimId]);

        _vault.approveClaim(_claimId, 0, address(0));

        emit DisputeDismissed(_vault, _claimId, _descriptionHash);
    }

    /** @notice See {IHATArbitrator-acceptDispute}. */
    function acceptDispute(
        IHATClaimsManager _vault,
        bytes32 _claimId,
        uint16 _bountyPercentage,
        address _beneficiary,
        address[] calldata _disputersToRefund,
        address[] calldata _disputersToConfiscate,
        string calldata _descriptionHash
    )
        external
        onlyExpertCommittee
        onlyChallengedActiveClaim(_vault, _claimId)
        onlyUnresolvedDispute(_vault, _claimId)
    {
        resolutions[_vault][_claimId] = Resolution({
            bountyPercentage: _bountyPercentage,
            beneficiary: _beneficiary,
            resolvedAt: block.timestamp
        });
        _refundDisputers(_vault, _claimId, _disputersToRefund);
        _confiscateDisputers(_vault, _claimId, _disputersToConfiscate);

        emit DisputeAccepted(
            _vault,
            _claimId,
            _bountyPercentage,
            _beneficiary,
            _descriptionHash
        );
    }

    /** @notice See {IHATArbitrator-refundDisputers}. */
    function refundDisputers(
        IHATClaimsManager _vault,
        bytes32 _claimId,
        address[] calldata _disputersToRefund
    )
        external
        onlyExpertCommittee
        onlyChallengedActiveClaim(_vault, _claimId)
        onlyResolvedDispute(_vault, _claimId)
    {
        _refundDisputers(_vault, _claimId, _disputersToRefund);
    }

    function _refundDisputers(
        IHATClaimsManager _vault,
        bytes32 _claimId,
        address[] calldata _disputersToRefund
    ) internal {
        for (uint256 i = 0; i < _disputersToRefund.length; ) {
            bondClaimable[_disputersToRefund[i]][_vault][_claimId] = true;
            unchecked {
                ++i;
            }
        }

        emit DisputersRefunded(_vault, _claimId, _disputersToRefund);
    }

    /** @notice See {IHATArbitrator-confiscateDisputers}. */
    function confiscateDisputers(
        IHATClaimsManager _vault,
        bytes32 _claimId,
        address[] calldata _disputersToConfiscate
    )
        external
        onlyExpertCommittee
        onlyChallengedActiveClaim(_vault, _claimId)
        onlyResolvedDispute(_vault, _claimId)
    {
        _confiscateDisputers(_vault, _claimId, _disputersToConfiscate);
    }

    function _confiscateDisputers(
        IHATClaimsManager _vault,
        bytes32 _claimId,
        address[] calldata _disputersToConfiscate
    ) internal {
        uint256 totalBondsToConfiscate;
        for (uint256 i = 0; i < _disputersToConfiscate.length; ) {
            totalBondsToConfiscate += disputersBonds[_disputersToConfiscate[i]][
                _vault
            ][_claimId];
            disputersBonds[_disputersToConfiscate[i]][_vault][_claimId] = 0;
            unchecked {
                ++i;
            }
        }

        token.safeTransfer(expertCommittee, totalBondsToConfiscate);

        emit DisputersConfiscated(_vault, _claimId, _disputersToConfiscate);
    }

    /** @notice See {IHATArbitrator-reclaimBond}. */
    function reclaimBond(IHATClaimsManager _vault, bytes32 _claimId) external {
        if (!bondClaimable[msg.sender][_vault][_claimId]) {
            // the bond is claimable if either
            // (a) it is not part of the curr

            IHATClaimsManager.Claim memory claim = _vault.getActiveClaim();

            if (
                claim.claimId == _claimId &&
                block.timestamp <
                claim.createdAt + claim.challengePeriod + claim.challengeTimeOutPeriod
            ) {
                revert CannotClaimBond();
            }
        } else {
            bondClaimable[msg.sender][_vault][_claimId] = false;
        }

        uint256 disputerBond = disputersBonds[msg.sender][_vault][_claimId];
        disputersBonds[msg.sender][_vault][_claimId] = 0;
        token.safeTransfer(msg.sender, disputerBond);

        emit BondRefundClaimed(_vault, _claimId, msg.sender, disputerBond);
    }

    /** @notice See {IHATArbitrator-executeResolution}. */
    function executeResolution(
        IHATClaimsManager _vault,
        bytes32 _claimId
    )
        external
        onlyChallengedActiveClaim(_vault, _claimId)
        onlyResolvedDispute(_vault, _claimId)
    {
        Resolution memory resolution = resolutions[_vault][_claimId];

        if (resolutionChallengedAt[_vault][_claimId] != 0) {
            if (msg.sender != court) {
                revert CanOnlyBeCalledByCourt();
            }
        } else {
            if (
                block.timestamp <
                resolution.resolvedAt + resolutionChallengePeriod
            ) {
                revert ChallengePeriodDidNotPass();
            }
        }

        _vault.approveClaim(
            _claimId,
            resolution.bountyPercentage,
            resolution.beneficiary
        );

        emit ResolutionExecuted(_vault, _claimId);
    }

    /** @notice See {IHATArbitrator-dismissResolution}. */
    function dismissResolution(
        IHATClaimsManager _vault,
        bytes32 _claimId
    )
        external
        onlyChallengedActiveClaim(_vault, _claimId)
        onlyResolvedDispute(_vault, _claimId)
    {
        if (resolutionChallengedAt[_vault][_claimId] == 0) {
            revert CannotDismissUnchallengedResolution();
        }

        if (msg.sender != court) {
            revert CanOnlyBeCalledByCourt();
        }

        _vault.dismissClaim(_claimId);

        emit ResolutionDismissed(_vault, _claimId);
    }

    /** @notice See {IHATArbitrator-challengeResolution}. */
    function challengeResolution(
        IHATClaimsManager _vault,
        bytes32 _claimId,
        string calldata _evidence
    )
        external
        payable
        onlyChallengedActiveClaim(_vault, _claimId)
        onlyResolvedDispute(_vault, _claimId)
    {
        if (
            block.timestamp >=
            resolutions[_vault][_claimId].resolvedAt + resolutionChallengePeriod
        ) {
            revert ChallengePeriodPassed();
        }

        if (resolutionChallengedAt[_vault][_claimId] != 0) {
            revert AlreadyChallenged();
        }

        resolutionChallengedAt[_vault][_claimId] = block.timestamp;

        emit ResolutionChallenged(_vault, _claimId);

        IHATKlerosConnector(court).notifyArbitrator{value: msg.value}(
            _claimId,
            _evidence,
            _vault,
            msg.sender
        );
    }

    /** @notice See {IHATArbitrator-submitClaimRequest}. */
    function submitClaimRequest(string calldata _descriptionHash) external {
        bytes32 internalClaimId = keccak256(
            abi.encodePacked(address(this), ++nonce)
        );
        submitClaimRequests[internalClaimId] = SubmitClaimRequest({
            submitter: msg.sender,
            bond: bondsNeededToStartDispute,
            submittedAt: block.timestamp,
            descriptionHash: _descriptionHash
        });
        token.safeTransferFrom(
            msg.sender,
            address(this),
            bondsNeededToStartDispute
        );

        emit SubmitClaimRequestCreated(
            internalClaimId,
            msg.sender,
            bondsNeededToStartDispute,
            _descriptionHash
        );
    }

    /** @notice See {IHATArbitrator-dismissSubmitClaimRequest}. */
    function dismissSubmitClaimRequest(
        bytes32 _internalClaimId,
        string calldata _descriptionHash
    ) external onlyExpertCommittee {
        SubmitClaimRequest memory submitClaimRequest = submitClaimRequests[
            _internalClaimId
        ];

        if (
            block.timestamp >
            submitClaimRequest.submittedAt + submitClaimRequestReviewPeriod
        ) {
            revert ClaimReviewPeriodEnd();
        }

        delete submitClaimRequests[_internalClaimId];

        token.safeTransfer(msg.sender, submitClaimRequest.bond);

        emit SubmitClaimRequestDismissed(_internalClaimId, _descriptionHash);
    }

    /** @notice See {IHATArbitrator-approveSubmitClaimRequest}. */
    function approveSubmitClaimRequest(
        IHATClaimsManager _vault,
        bytes32 _internalClaimId,
        address _beneficiary,
        uint16 _bountyPercentage,
        string calldata _descriptionHash
    ) external onlyExpertCommittee {
        SubmitClaimRequest memory submitClaimRequest = submitClaimRequests[
            _internalClaimId
        ];

        if (
            block.timestamp >
            submitClaimRequest.submittedAt + submitClaimRequestReviewPeriod
        ) {
            revert ClaimReviewPeriodEnd();
        }

        delete submitClaimRequests[_internalClaimId];

        bytes32 claimId = _vault.submitClaim(
            _beneficiary,
            _bountyPercentage,
            _descriptionHash
        );

        // pass control over the claim to the arbitrator
        _vault.challengeClaim(claimId);

        resolutions[_vault][claimId] = Resolution({
            bountyPercentage: _bountyPercentage,
            beneficiary: _beneficiary,
            resolvedAt: block.timestamp
        });

        // refund the bond to the submitter
        token.safeTransfer(
            submitClaimRequest.submitter,
            submitClaimRequest.bond
        );

        emit SubmitClaimRequestApproved(_internalClaimId, claimId, _vault);
    }

    /** @notice See {IHATArbitrator-refundExpiredSubmitClaimRequest}. */
    function refundExpiredSubmitClaimRequest(
        bytes32 _internalClaimId
    ) external {
        SubmitClaimRequest memory submitClaimRequest = submitClaimRequests[
            _internalClaimId
        ];

        if (
            block.timestamp <=
            submitClaimRequest.submittedAt + submitClaimRequestReviewPeriod
        ) {
            revert ClaimReviewPeriodDidNotEnd();
        }

        delete submitClaimRequests[_internalClaimId];
        token.safeTransfer(
            submitClaimRequest.submitter,
            bondsNeededToStartDispute
        );

        emit SubmitClaimRequestExpired(_internalClaimId);
    }
}
