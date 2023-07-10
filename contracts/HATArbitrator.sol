// SPDX-License-Identifier: MIT
// Disclaimer https://github.com/hats-finance/hats-contracts/blob/main/DISCLAIMER.md

pragma solidity 0.8.16;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IHATVault.sol";

contract HATArbitrator {
    error DisputeStartingAmountMustBeHigherThanMinAmount();
    error BondAmountSubmittedTooLow();
    error ClaimDisputedDoesNotExist();
    error CannotSubmitMoreEvidence();
    error ClaimIsNotDisputed();
    error OnlyExpertCommittee();
    error AlreadyResolved();
    error NoResolution();
    error ChallengePeriodDidNotPass();
    error ResolutionWasChallenged();
    error ChallengePeriodPassed();

    using SafeERC20 for IERC20;

    struct Resolution {
        address beneficiary;
        uint16 bountyPercentages;
    }

    IHATVault public vault;
    address public expertCommittee;
    IERC20 public token;
    uint256 public disputeStartingAmount;
    uint256 public minBondAmount;

    mapping(address => mapping(bytes32 => uint256)) public disputersBonds;
    mapping(bytes32 => uint256) public totalBondsOnClaim;
    mapping(bytes32 => Resolution) public resolutions;
    mapping(bytes32 => uint256) public resolvedAt;
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
            revert ClaimDisputedDoesNotExist();
        }

        if (challengedAt == 0) {
            revert ClaimIsNotDisputed();
        }
        _;
    }

    modifier onlyUnresolvedDispute(bytes32 _claimId) {
        if (resolvedAt[_claimId] != 0) {
            revert AlreadyResolved();
        }
        _;
    }

    modifier onlyResolvedDispute(bytes32 _claimId) {
        if (resolvedAt[_claimId] == 0) {
            revert NoResolution();
        }
        _;
    }

    constructor (IHATVault _vault, address _expertCommittee, IERC20 _token, uint256 _disputeStartingAmount, uint256 _minBondAmount) {
        vault = _vault;
        expertCommittee = _expertCommittee;
        token = _token;
        disputeStartingAmount = _disputeStartingAmount;
        minBondAmount = _minBondAmount;
        if (minBondAmount > disputeStartingAmount) {
            revert DisputeStartingAmountMustBeHigherThanMinAmount();
        }
    }

    function dispute(bytes32 _claimId, bytes32 _ipfsHash, uint256 _bondAmount) external {
        if (_bondAmount < minBondAmount) {
            revert BondAmountSubmittedTooLow();
        }

        (bytes32 claimId,,,,,uint32 challengedAt,,,,,,,) = vault.activeClaim();
        if (claimId != _claimId) {
            revert ClaimDisputedDoesNotExist();
        }

        disputersBonds[msg.sender][_claimId] += _bondAmount;
        totalBondsOnClaim[_claimId] += _bondAmount;

        token.safeTransferFrom(msg.sender, address(this), _bondAmount);

        if (totalBondsOnClaim[_claimId] >= disputeStartingAmount) {
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
        token.safeTransferFrom(msg.sender, address(this), totalBondsOnClaim[_claimId]);

        vault.approveClaim(_claimId, 0, address(0));
    }

    function acceptDispute(bytes32 _claimId, Resolution calldata _resolution) external onlyExpertCommittee onlyChallengedActiveClaim(_claimId) onlyUnresolvedDispute(_claimId) {
        resolutions[_claimId] = _resolution;
        resolvedAt[_claimId] = block.timestamp;
    }

    function refundBond(bytes32 _claimId) external onlyResolvedDispute(_claimId) {
        // TODO: For now all disputers get their money back if the dispute is accepted, later we might want to allow refunding only some disputers.
        uint256 disputerBond = disputersBonds[msg.sender][_claimId];
        disputersBonds[msg.sender][_claimId] = 0;
        token.safeTransfer(msg.sender, disputerBond);
    }

    function executeResolution(bytes32 _claimId) external {
        // TODO: This might be too long if the challenge timeout period is too short
        if (resolvedAt[_claimId] == 0 || block.timestamp < resolvedAt[_claimId] + 3 days) {
            revert ChallengePeriodDidNotPass();
        }

        if (resolutionChallengedAt[_claimId] != 0) {
            revert ResolutionWasChallenged();
        }

        Resolution memory resolution = resolutions[_claimId];
        vault.approveClaim(_claimId, resolution.bountyPercentages, resolution.beneficiary);
    }
    

    function challengeResolution(bytes32 _claimId) external onlyResolvedDispute(_claimId) {
        if (block.timestamp >= resolvedAt[_claimId] + 3 days) {
            revert ChallengePeriodPassed();
        }

        resolutionChallengedAt[_claimId] = block.timestamp;

        // TODO: How is the funding handled here? Need to understand what the inteface for the decentralized dispute resolution contract should be
    }
}