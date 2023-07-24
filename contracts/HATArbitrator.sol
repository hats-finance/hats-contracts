// SPDX-License-Identifier: MIT
// Disclaimer https://github.com/hats-finance/hats-contracts/blob/main/DISCLAIMER.md

pragma solidity 0.8.16;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IHATVault.sol";

contract HATArbitrator {
    error bondsNeededToStartDisputeMustBeHigherThanMinAmount();
    error BondAmountSubmittedTooLow();
    error ClaimDisputedIsNotCurrentlyActiveClaim();
    error CannotSubmitMoreEvidence();
    error ClaimIsNotDisputed();
    error OnlyExpertCommittee();
    error AlreadyResolved();
    error NoResolution();
    error ChallengePeriodDidNotPass();
    error CanOnlyBeCalledByCourt();
    error ChallengePeriodPassed();
    error NoResolutionExistsForClaim();
    error CannotClaimBond();
    error CannotDismissUnchallengedResolution();
    error CallerIsNotSubmitter();
    error ClaimReviewPeriodEnd();
    error ClaimReviewPeriodDidNotEnd();

    using SafeERC20 for IERC20;

    struct Resolution {
        address beneficiary;
        uint16 bountyPercentage;
        uint256 resolvedAt;
    }

    struct SubmitClaimRequest{
        address submitter;
        uint256 bond;
        uint256 submittedAt;
        string descriptionHash;
    }

    IHATVault public vault;
    address public expertCommittee;
    address public court;
    IERC20 public token;
    uint256 public bondsNeededToStartDispute;
    uint256 public minBondAmount;
    uint256 public resolutionChallegPeriod;
    uint256 public submitClaimRequestReviewPeriod;

    mapping(address => mapping(bytes32 => uint256)) public disputersBonds;
    mapping(address => mapping(bytes32 => bool)) public bondClaimable;
    mapping(bytes32 => uint256) public totalBondsOnClaim;
    mapping(bytes32 => Resolution) public resolutions;
    mapping(bytes32 => uint256) public resolutionChallengedAt;
    mapping(bytes32 => SubmitClaimRequest) public submitClaimRequests;

    uint256 internal nonce;

    event ClaimDisputed(bytes32 indexed _claimId, address indexed _disputer, uint256 _bondAmount, string _descriptionHash);
    event DisputeDismissed(bytes32 indexed _claimId, string _descriptionHash);
    event DisputeAccepted(bytes32 indexed _claimId, uint16 _bountyPercentage, address _beneficiary, string _descriptionHash);
    event DisputersRefunded(bytes32 indexed _claimId, address[] _disputers);
    event BondRefundClaimed(bytes32 indexed _claimId, address _disputer);
    event ResolutionExecuted(bytes32 indexed _claimId);
    event ResolutionDismissed(bytes32 indexed _claimId);
    event ResolutionChallenged(bytes32 indexed _claimId);

    event SubmitClaimRequestCreated(bytes32 indexed _internalClaimId, address indexed _submitter, uint256 _bond, string _descriptionHash);
    event SubmitClaimRequestDismissed(bytes32 indexed _internalClaimId, string _descriptionHash);
    event SubmitClaimRequestApproved(bytes32 indexed _internalClaimId, bytes32 indexed _claimId);
    event SubmitClaimRequestExpired(bytes32 indexed _internalClaimId);

    modifier onlyExpertCommittee() {
        if (msg.sender != expertCommittee) {
            revert OnlyExpertCommittee();
        }
        _;
    }

    modifier onlyChallengedActiveClaim(bytes32 _claimId) {
        (bytes32 claimId,,,,,uint32 challengedAt,,,,,,,) = vault.activeClaim();

        if (claimId != _claimId) {
            revert ClaimDisputedIsNotCurrentlyActiveClaim();
        }

        if (challengedAt == 0) {
            revert ClaimIsNotDisputed();
        }
        _;
    }

    modifier onlyUnresolvedDispute(bytes32 _claimId) {
        if (resolutions[_claimId].resolvedAt != 0) {
            revert AlreadyResolved();
        }
        _;
    }

    modifier onlyResolvedDispute(bytes32 _claimId) {
        if (resolutions[_claimId].resolvedAt == 0) {
            revert NoResolution();
        }
        _;
    }

    constructor (
        IHATVault _vault,
        address _expertCommittee,
        address _court,
        IERC20 _token,
        uint256 _bondsNeededToStartDispute,
        uint256 _minBondAmount,
        uint256 _resolutionChallegPeriod,
        uint256 _submitClaimRequestReviewPeriod
    ) {
        vault = _vault;
        expertCommittee = _expertCommittee;
        court = _court;
        token = _token;
        bondsNeededToStartDispute = _bondsNeededToStartDispute;
        minBondAmount = _minBondAmount;
        resolutionChallegPeriod = _resolutionChallegPeriod;
        submitClaimRequestReviewPeriod = _submitClaimRequestReviewPeriod;
        if (minBondAmount > bondsNeededToStartDispute) {
            revert bondsNeededToStartDisputeMustBeHigherThanMinAmount();
        }
    }

    function dispute(bytes32 _claimId, uint256 _bondAmount, string calldata _descriptionHash) external {
        if (_bondAmount < minBondAmount) {
            revert BondAmountSubmittedTooLow();
        }

        (bytes32 claimId,,,,,uint32 challengedAt,,,,,,,) = vault.activeClaim();
        if (claimId != _claimId) {
            revert ClaimDisputedIsNotCurrentlyActiveClaim();
        }

        disputersBonds[msg.sender][_claimId] += _bondAmount;
        totalBondsOnClaim[_claimId] += _bondAmount;

        token.safeTransferFrom(msg.sender, address(this), _bondAmount);

        if (totalBondsOnClaim[_claimId] >= bondsNeededToStartDispute) {
            if (challengedAt == 0) {
                vault.challengeClaim(_claimId);
            } else {
                // solhint-disable-next-line not-rely-on-time
                if (block.timestamp > challengedAt + 24 hours) {
                    revert CannotSubmitMoreEvidence();
                }
            }
        }

        emit ClaimDisputed(_claimId, msg.sender, _bondAmount, _descriptionHash);
    }

    function dismissDispute(bytes32 _claimId, string calldata _descriptionHash) external onlyExpertCommittee onlyChallengedActiveClaim(_claimId) onlyUnresolvedDispute(_claimId) {
        resolutions[_claimId].resolvedAt = block.timestamp;
        token.safeTransfer(msg.sender, totalBondsOnClaim[_claimId]);

        vault.approveClaim(_claimId, 0, address(0));

        emit DisputeDismissed(_claimId, _descriptionHash);
    }

    function acceptDispute(bytes32 _claimId, uint16 _bountyPercentage, address _beneficiary, address[] calldata _disputersToRefund, string calldata _descriptionHash) external onlyExpertCommittee onlyChallengedActiveClaim(_claimId) onlyUnresolvedDispute(_claimId) {
        resolutions[_claimId] = Resolution({ 
            bountyPercentage: _bountyPercentage,
            beneficiary: _beneficiary,
            resolvedAt: block.timestamp
        });
        _refundDisputers(_claimId, _disputersToRefund);

        emit DisputeAccepted(_claimId, _bountyPercentage, _beneficiary, _descriptionHash);
    }

    function refundDisputers(bytes32 _claimId, address[] calldata _disputersToRefund) external onlyExpertCommittee onlyChallengedActiveClaim(_claimId) onlyResolvedDispute(_claimId) {
        _refundDisputers(_claimId, _disputersToRefund);
    }

    function _refundDisputers(bytes32 _claimId, address[] calldata _disputersToRefund) internal {
        for (uint256 i = 0; i < _disputersToRefund.length;) {
            bondClaimable[msg.sender][_claimId] = true;
            unchecked { ++i; }
        }

        emit DisputersRefunded(_claimId, _disputersToRefund);
    }

    function refundBond(bytes32 _claimId) external {
        if (!bondClaimable[msg.sender][_claimId]) {
            (bytes32 claimId,,,,uint32 createdAt,,,,,uint32 challengePeriod,uint32 challengeTimeOutPeriod,,) = vault.activeClaim();

            if (resolutions[_claimId].resolvedAt != 0 || (claimId == _claimId && block.timestamp < createdAt + challengePeriod + challengeTimeOutPeriod)) {
                revert CannotClaimBond();
            }
        } else {
            bondClaimable[msg.sender][_claimId] = false;
        }

        uint256 disputerBond = disputersBonds[msg.sender][_claimId];
        disputersBonds[msg.sender][_claimId] = 0;
        token.safeTransfer(msg.sender, disputerBond);

        emit BondRefundClaimed(_claimId, msg.sender);
    }

    function executeResolution(bytes32 _claimId) external {
        // TODO: This might be too long if the challenge timeout period is too short
        Resolution memory resolution = resolutions[_claimId];

        if (resolution.resolvedAt == 0) {
            revert NoResolutionExistsForClaim();
        }

        if (resolutionChallengedAt[_claimId] != 0) {
            if (msg.sender != court) {
                revert CanOnlyBeCalledByCourt();
            }
        } else {
            if (block.timestamp < resolution.resolvedAt + resolutionChallegPeriod) {
                revert ChallengePeriodDidNotPass();
            }
        }

        vault.approveClaim(_claimId, resolution.bountyPercentage, resolution.beneficiary);

        emit ResolutionExecuted(_claimId);
    }

    function dismissResolution(bytes32 _claimId) external {
        if (resolutionChallengedAt[_claimId] == 0) {
            revert CannotDismissUnchallengedResolution();
        }
        if (msg.sender != court) {
            revert CanOnlyBeCalledByCourt();
        }
        vault.dismissClaim(_claimId);

        emit ResolutionDismissed(_claimId);
    }

    function challengeResolution(bytes32 _claimId) external onlyChallengedActiveClaim(_claimId) onlyResolvedDispute(_claimId) {
        if (block.timestamp >= resolutions[_claimId].resolvedAt + resolutionChallegPeriod) {
            revert ChallengePeriodPassed();
        }

        resolutionChallengedAt[_claimId] = block.timestamp;

        emit ResolutionChallenged(_claimId);

        // TODO: Here the challnger should also fund the claim with the court to avoid spamming, we can just open it calling the court here
    }

    function submitClaimRequest(string calldata _descriptionHash) external {
        bytes32 internalClaimId = keccak256(abi.encodePacked(address(this), ++nonce));
        submitClaimRequests[internalClaimId] = SubmitClaimRequest({
            submitter: msg.sender,
            bond: bondsNeededToStartDispute,
            submittedAt: block.timestamp,
            descriptionHash: _descriptionHash
        });
        token.safeTransferFrom(msg.sender, address(this), bondsNeededToStartDispute);

        emit SubmitClaimRequestCreated(internalClaimId, msg.sender, bondsNeededToStartDispute, _descriptionHash);
    }

    function dismissSubmitClaimRequest(bytes32 _internalClaimId, string calldata _descriptionHash) external onlyExpertCommittee {
        SubmitClaimRequest memory submitClaimRequest = submitClaimRequests[_internalClaimId];

        if (block.timestamp > submitClaimRequest.submittedAt + submitClaimRequestReviewPeriod) {
            revert ClaimReviewPeriodEnd();
        }

        delete submitClaimRequests[_internalClaimId];

        token.safeTransfer(msg.sender, submitClaimRequest.bond);

        emit SubmitClaimRequestDismissed(_internalClaimId, _descriptionHash);
    }

    function approveSubmitClaimRequest(bytes32 _internalClaimId, address _beneficiary, uint16 _bountyPercentage, string calldata _descriptionHash) external onlyExpertCommittee {
        SubmitClaimRequest memory submitClaimRequest = submitClaimRequests[_internalClaimId];

        if (block.timestamp > submitClaimRequest.submittedAt + submitClaimRequestReviewPeriod) {
            revert ClaimReviewPeriodEnd();
        }

        delete submitClaimRequests[_internalClaimId];

        bytes32 claimId = vault.submitClaim(_beneficiary, _bountyPercentage, _descriptionHash);
        
        vault.challengeClaim(claimId);

        resolutions[_claimId] = Resolution({ 
            bountyPercentage: _bountyPercentage,
            beneficiary: _beneficiary,
            resolvedAt: block.timestamp
        });

        token.safeTransfer(submitClaimRequest.submitter, submitClaimRequest.bond);

        emit SubmitClaimRequestApproved(_internalClaimId, claimId);
    }

    function refundExpiredSubmitClaimRequest(bytes32 _internalClaimId) external {
        SubmitClaimRequest memory submitClaimRequest = submitClaimRequests[_internalClaimId];
        if (msg.sender != submitClaimRequest.submitter) {
            revert CallerIsNotSubmitter();
        }

        if (block.timestamp <= submitClaimRequest.submittedAt + submitClaimRequestReviewPeriod) {
            revert ClaimReviewPeriodDidNotEnd();
        }

        delete submitClaimRequests[_internalClaimId];
        token.safeTransfer(msg.sender, bondsNeededToStartDispute);

        emit SubmitClaimRequestExpired(_internalClaimId);
    }
}