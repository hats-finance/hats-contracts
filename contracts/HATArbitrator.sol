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
    error ResolutionWasChallenged();
    error ChallengePeriodPassed();
    error NoResolutionExistsForClaim();
    error CannotClaimBond();

    using SafeERC20 for IERC20;

    struct Resolution {
        address beneficiary;
        uint16 bountyPercentage;
        uint256 resolvedAt;
    }

    IHATVault public vault;
    address public expertCommittee;
    address public court;
    IERC20 public token;
    uint256 public bondsNeededToStartDispute;
    uint256 public minBondAmount;

    mapping(address => mapping(bytes32 => uint256)) public disputersBonds;
    mapping(address => mapping(bytes32 => bool)) public bondClaimable;
    mapping(bytes32 => uint256) public totalBondsOnClaim;
    mapping(bytes32 => Resolution) public resolutions;
    mapping(bytes32 => uint256) public resolutionChallengedAt;

    event ClaimDisputed(bytes32 indexed _claimId, address indexed _disputer, bytes32 _ipfsHash, uint256 _bondAmount);

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

    constructor (IHATVault _vault, address _expertCommittee, address _court, IERC20 _token, uint256 _bondsNeededToStartDispute, uint256 _minBondAmount) {
        vault = _vault;
        expertCommittee = _expertCommittee;
        court = _court;
        token = _token;
        bondsNeededToStartDispute = _bondsNeededToStartDispute;
        minBondAmount = _minBondAmount;
        if (minBondAmount > bondsNeededToStartDispute) {
            revert bondsNeededToStartDisputeMustBeHigherThanMinAmount();
        }
    }

    function dispute(bytes32 _claimId, bytes32 _ipfsHash, uint256 _bondAmount) external {
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

        emit ClaimDisputed(_claimId, msg.sender, _ipfsHash, _bondAmount);
    }

    function dismissDispute(bytes32 _claimId) external onlyExpertCommittee onlyChallengedActiveClaim(_claimId) onlyUnresolvedDispute(_claimId) {
        token.safeTransfer(msg.sender, totalBondsOnClaim[_claimId]);

        vault.approveClaim(_claimId, 0, address(0));
    }

    function acceptDispute(bytes32 _claimId,  uint16 _bountyPercentage, address _beneficiary, address[] calldata _disputersToRefund) external onlyExpertCommittee onlyChallengedActiveClaim(_claimId) onlyUnresolvedDispute(_claimId) {
        resolutions[_claimId] = Resolution({ 
            bountyPercentage: _bountyPercentage,
            beneficiary: _beneficiary,
            resolvedAt: block.timestamp
        });
        _refundDisputers(_claimId, _disputersToRefund);
    }

    function refundDisputers(bytes32 _claimId, address[] calldata _disputersToRefund) external onlyExpertCommittee {
        _refundDisputers(_claimId, _disputersToRefund);
    }

    function _refundDisputers(bytes32 _claimId, address[] calldata _disputersToRefund) internal {
        for (uint256 i = 0; i < _disputersToRefund.length;) {
            bondClaimable[msg.sender][_claimId] = true;
            unchecked { ++i; }
        }
    }

    function refundBond(bytes32 _claimId) external {
        if (!bondClaimable[msg.sender][_claimId]) {
            revert CannotClaimBond();
        }
        bondClaimable[msg.sender][_claimId] = false;
        uint256 disputerBond = disputersBonds[msg.sender][_claimId];
        disputersBonds[msg.sender][_claimId] = 0;
        token.safeTransfer(msg.sender, disputerBond);
    }

    function executeResolution(bytes32 _claimId) external {
        // TODO: This might be too long if the challenge timeout period is too short
        Resolution memory resolution = resolutions[_claimId];

        if (resolution.resolvedAt == 0) {
            revert NoResolutionExistsForClaim();
        }

        if (resolutionChallengedAt[_claimId] != 0) {
            if (msg.sender != court) {
                revert ResolutionWasChallenged();
            }
        } else {
            if (block.timestamp < resolution.resolvedAt + 3 days) {
                revert ChallengePeriodDidNotPass();
            }
        }

        vault.approveClaim(_claimId, resolution.bountyPercentage, resolution.beneficiary);
    }

    function dismissResolution(bytes32 _claimId) external {
        if (resolutionChallengedAt[_claimId] == 0) {
            revert CannotDismissUnchallengedResolution();
        }
        if (msg.sender != court) {
            revert ResolutionWasChallenged();
        }
        vault.dismissClaim(_claimId);
    }

    function challengeResolution(bytes32 _claimId) external onlyChallengedActiveClaim(_claimId) onlyResolvedDispute(_claimId) {
        if (block.timestamp >= resolutions[_claimId].resolvedAt + 3 days) {
            revert ChallengePeriodPassed();
        }

        resolutionChallengedAt[_claimId] = block.timestamp;

        // TODO: Here the challnger should also fund the claim with the court to avoid spamming, we can just open it calling the court here
    }
}