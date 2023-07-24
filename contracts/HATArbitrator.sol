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

    address public expertCommittee;
    address public court;
    IERC20 public token;
    uint256 public bondsNeededToStartDispute;
    uint256 public minBondAmount;
    uint256 public resolutionChallegPeriod;
    uint256 public submitClaimRequestReviewPeriod;

    mapping(address => mapping(IHATVault => mapping(bytes32 => uint256))) public disputersBonds;
    mapping(address => mapping(IHATVault => mapping(bytes32 => bool))) public bondClaimable;
    mapping(IHATVault => mapping(bytes32 => uint256)) public totalBondsOnClaim;
    mapping(IHATVault => mapping(bytes32 => Resolution)) public resolutions;
    mapping(IHATVault => mapping(bytes32 => uint256)) public resolutionChallengedAt;
    mapping(bytes32 => SubmitClaimRequest) public submitClaimRequests;

    uint256 internal nonce;

    event ClaimDisputed(IHATVault indexed _vault, bytes32 indexed _claimId, address indexed _disputer, uint256 _bondAmount, string _descriptionHash);
    event DisputeDismissed(IHATVault indexed _vault, bytes32 indexed _claimId, string _descriptionHash);
    event DisputeAccepted(IHATVault indexed _vault, bytes32 indexed _claimId, uint16 _bountyPercentage, address _beneficiary, string _descriptionHash);
    event DisputersRefunded(IHATVault indexed _vault, bytes32 indexed _claimId, address[] _disputers);
    event BondRefundClaimed(IHATVault indexed _vault, bytes32 indexed _claimId, address _disputer);
    event ResolutionExecuted(IHATVault indexed _vault, bytes32 indexed _claimId);
    event ResolutionDismissed(IHATVault indexed _vault, bytes32 indexed _claimId);
    event ResolutionChallenged(IHATVault indexed _vault, bytes32 indexed _claimId);

    event SubmitClaimRequestCreated(bytes32 indexed _internalClaimId, address indexed _submitter, uint256 _bond, string _descriptionHash);
    event SubmitClaimRequestDismissed(bytes32 indexed _internalClaimId, string _descriptionHash);
    event SubmitClaimRequestApproved(bytes32 indexed _internalClaimId, bytes32 indexed _claimId, IHATVault indexed _vault);
    event SubmitClaimRequestExpired(bytes32 indexed _internalClaimId);

    modifier onlyExpertCommittee() {
        if (msg.sender != expertCommittee) {
            revert OnlyExpertCommittee();
        }
        _;
    }

    modifier onlyChallengedActiveClaim(IHATVault _vault, bytes32 _claimId) {
        (bytes32 claimId,,,,,uint32 challengedAt,,,,,,,) = _vault.activeClaim();

        if (claimId != _claimId) {
            revert ClaimDisputedIsNotCurrentlyActiveClaim();
        }

        if (challengedAt == 0) {
            revert ClaimIsNotDisputed();
        }
        _;
    }

    modifier onlyUnresolvedDispute(IHATVault _vault, bytes32 _claimId) {
        if (resolutions[_vault][_claimId].resolvedAt != 0) {
            revert AlreadyResolved();
        }
        _;
    }

    modifier onlyResolvedDispute(IHATVault _vault, bytes32 _claimId) {
        if (resolutions[_vault][_claimId].resolvedAt == 0) {
            revert NoResolution();
        }
        _;
    }

    constructor (
        address _expertCommittee,
        address _court,
        IERC20 _token,
        uint256 _bondsNeededToStartDispute,
        uint256 _minBondAmount,
        uint256 _resolutionChallegPeriod,
        uint256 _submitClaimRequestReviewPeriod
    ) {
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

    function dispute(IHATVault _vault, bytes32 _claimId, uint256 _bondAmount, string calldata _descriptionHash) external {
        if (_bondAmount < minBondAmount) {
            revert BondAmountSubmittedTooLow();
        }

        (bytes32 claimId,,,,,uint32 challengedAt,,,,,,,) = _vault.activeClaim();
        if (claimId != _claimId) {
            revert ClaimDisputedIsNotCurrentlyActiveClaim();
        }

        disputersBonds[msg.sender][_vault][_claimId] += _bondAmount;
        totalBondsOnClaim[_vault][_claimId] += _bondAmount;

        token.safeTransferFrom(msg.sender, address(this), _bondAmount);

        if (totalBondsOnClaim[_vault][_claimId] >= bondsNeededToStartDispute) {
            if (challengedAt == 0) {
                _vault.challengeClaim(_claimId);
            } else {
                // solhint-disable-next-line not-rely-on-time
                if (block.timestamp > challengedAt + 24 hours) {
                    revert CannotSubmitMoreEvidence();
                }
            }
        }

        emit ClaimDisputed(_vault, _claimId, msg.sender, _bondAmount, _descriptionHash);
    }

    function dismissDispute(IHATVault _vault, bytes32 _claimId, string calldata _descriptionHash) external onlyExpertCommittee onlyChallengedActiveClaim(_vault, _claimId) onlyUnresolvedDispute(_vault, _claimId) {
        resolutions[_vault][_claimId].resolvedAt = block.timestamp;
        token.safeTransfer(msg.sender, totalBondsOnClaim[_vault][_claimId]);

        _vault.approveClaim(_claimId, 0, address(0));

        emit DisputeDismissed(_vault, _claimId, _descriptionHash);
    }

    function acceptDispute(IHATVault _vault, bytes32 _claimId, uint16 _bountyPercentage, address _beneficiary, address[] calldata _disputersToRefund, string calldata _descriptionHash) external onlyExpertCommittee onlyChallengedActiveClaim(_vault, _claimId) onlyUnresolvedDispute(_vault, _claimId) {
        resolutions[_vault][_claimId] = Resolution({ 
            bountyPercentage: _bountyPercentage,
            beneficiary: _beneficiary,
            resolvedAt: block.timestamp
        });
        _refundDisputers(_vault, _claimId, _disputersToRefund);

        emit DisputeAccepted(_vault, _claimId, _bountyPercentage, _beneficiary, _descriptionHash);
    }

    function refundDisputers(IHATVault _vault, bytes32 _claimId, address[] calldata _disputersToRefund) external onlyExpertCommittee onlyChallengedActiveClaim(_vault, _claimId) onlyResolvedDispute(_vault, _claimId) {
        _refundDisputers(_vault, _claimId, _disputersToRefund);
    }

    function _refundDisputers(IHATVault _vault, bytes32 _claimId, address[] calldata _disputersToRefund) internal {
        for (uint256 i = 0; i < _disputersToRefund.length;) {
            bondClaimable[msg.sender][_vault][_claimId] = true;
            unchecked { ++i; }
        }

        emit DisputersRefunded(_vault, _claimId, _disputersToRefund);
    }

    function refundBond(IHATVault _vault, bytes32 _claimId) external {
        if (!bondClaimable[msg.sender][_vault][_claimId]) {
            (bytes32 claimId,,,,uint32 createdAt,,,,,uint32 challengePeriod,uint32 challengeTimeOutPeriod,,) = _vault.activeClaim();

            if (resolutions[_vault][_claimId].resolvedAt != 0 || (claimId == _claimId && block.timestamp < createdAt + challengePeriod + challengeTimeOutPeriod)) {
                revert CannotClaimBond();
            }
        } else {
            bondClaimable[msg.sender][_vault][_claimId] = false;
        }

        uint256 disputerBond = disputersBonds[msg.sender][_vault][_claimId];
        disputersBonds[msg.sender][_vault][_claimId] = 0;
        token.safeTransfer(msg.sender, disputerBond);

        emit BondRefundClaimed(_vault, _claimId, msg.sender);
    }

    function executeResolution(IHATVault _vault, bytes32 _claimId) external {
        // TODO: This might be too long if the challenge timeout period is too short
        Resolution memory resolution = resolutions[_vault][_claimId];

        if (resolution.resolvedAt == 0) {
            revert NoResolutionExistsForClaim();
        }

        if (resolutionChallengedAt[_vault][_claimId] != 0) {
            if (msg.sender != court) {
                revert CanOnlyBeCalledByCourt();
            }
        } else {
            if (block.timestamp < resolution.resolvedAt + resolutionChallegPeriod) {
                revert ChallengePeriodDidNotPass();
            }
        }

        _vault.approveClaim(_claimId, resolution.bountyPercentage, resolution.beneficiary);

        emit ResolutionExecuted(_vault, _claimId);
    }

    function dismissResolution(IHATVault _vault, bytes32 _claimId) external {
        if (resolutionChallengedAt[_vault][_claimId] == 0) {
            revert CannotDismissUnchallengedResolution();
        }

        if (msg.sender != court) {
            revert CanOnlyBeCalledByCourt();
        }

        _vault.dismissClaim(_claimId);

        emit ResolutionDismissed(_vault, _claimId);
    }

    function challengeResolution(IHATVault _vault, bytes32 _claimId) external onlyChallengedActiveClaim(_vault, _claimId) onlyResolvedDispute(_vault, _claimId) {
        if (block.timestamp >= resolutions[_vault][_claimId].resolvedAt + resolutionChallegPeriod) {
            revert ChallengePeriodPassed();
        }

        resolutionChallengedAt[_vault][_claimId] = block.timestamp;

        emit ResolutionChallenged(_vault, _claimId);

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

    function approveSubmitClaimRequest(IHATVault _vault, bytes32 _internalClaimId, address _beneficiary, uint16 _bountyPercentage, string calldata _descriptionHash) external onlyExpertCommittee {
        SubmitClaimRequest memory submitClaimRequest = submitClaimRequests[_internalClaimId];

        if (block.timestamp > submitClaimRequest.submittedAt + submitClaimRequestReviewPeriod) {
            revert ClaimReviewPeriodEnd();
        }

        delete submitClaimRequests[_internalClaimId];

        bytes32 claimId = _vault.submitClaim(_beneficiary, _bountyPercentage, _descriptionHash);
        
        _vault.challengeClaim(claimId);

        resolutions[_vault][claimId] = Resolution({ 
            bountyPercentage: _bountyPercentage,
            beneficiary: _beneficiary,
            resolvedAt: block.timestamp
        });

        token.safeTransfer(submitClaimRequest.submitter, submitClaimRequest.bond);

        emit SubmitClaimRequestApproved(_internalClaimId, claimId, _vault);
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