// SPDX-License-Identifier: MIT
// Disclaimer https://github.com/hats-finance/hats-contracts/blob/main/DISCLAIMER.md

pragma solidity 0.8.16;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IHATVault.sol";

/* solhint-disable not-rely-on-time */
contract HATArbitrator {
    error bondsNeededToStartDisputeMustBeHigherThanMinAmount();
    error BondAmountSubmittedTooLow();
    error ClaimIsNotCurrentlyActiveClaim();
    error CannotSubmitMoreEvidence();
    error ClaimIsNotDisputed();
    error OnlyExpertCommittee();
    error AlreadyResolved();
    error NoResolution();
    error ChallengePeriodDidNotPass();
    error CanOnlyBeCalledByCourt();
    error ChallengePeriodPassed();
    error CannotClaimBond();
    error CannotDismissUnchallengedResolution();
    error ClaimReviewPeriodEnd();
    error ClaimReviewPeriodDidNotEnd();
    error ClaimExpired();
    error AlreadyChallenged();

    using SafeERC20 for IERC20;

    struct Resolution {
        address beneficiary;
        uint16 bountyPercentage;
        uint256 resolvedAt;
    }

    struct SubmitClaimRequest {
        address submitter;
        uint256 bond;
        uint256 submittedAt;
        string descriptionHash;
    }

    address public expertCommittee; // address of the Expert Committee
    address public court; // address of the court - kleros, uma, etc
    IERC20 public token; // the token in which bonds need to be paid
    uint256 public minBondAmount; // minimum bond that a disputer needs to provide to participate in a dispute of the committee's claim
    uint256 public bondsNeededToStartDispute; // total amount of bonds needed to start a dispute of a committee's claim
    uint256 public resolutionChallengePeriod; // the amount of time that the expert committee's resolution can be challenged
    uint256 public submitClaimRequestReviewPeriod; // the time within which the expert committee must decide on a submitClaimRequest

    mapping(address => mapping(IHATVault => mapping(bytes32 => uint256)))
        public disputersBonds; // bonds provided by disputers
    mapping(address => mapping(IHATVault => mapping(bytes32 => bool)))
        public bondClaimable; // whether a given bond is reclaimable by the disputer
    mapping(IHATVault => mapping(bytes32 => uint256)) public totalBondsOnClaim; // total amount of bonds ona given claim
    mapping(IHATVault => mapping(bytes32 => Resolution)) public resolutions; // resolutions of disputes by the expert committee
    mapping(IHATVault => mapping(bytes32 => uint256))
        public resolutionChallengedAt; // the time an expert committee's resolution was challenged
    mapping(bytes32 => SubmitClaimRequest) public submitClaimRequests; // a registry of requests to the expert committee to submit a claim

    uint256 internal nonce;

    event ClaimDisputed(
        IHATVault indexed _vault,
        bytes32 indexed _claimId,
        address indexed _disputer,
        uint256 _bondAmount,
        string _descriptionHash
    );
    event DisputeDismissed(
        IHATVault indexed _vault,
        bytes32 indexed _claimId,
        string _descriptionHash
    );
    event DisputeAccepted(
        IHATVault indexed _vault,
        bytes32 indexed _claimId,
        uint16 _bountyPercentage,
        address _beneficiary,
        string _descriptionHash
    );
    event DisputersRefunded(
        IHATVault indexed _vault,
        bytes32 indexed _claimId,
        address[] _disputers
    );
    event DisputersConfiscated(
        IHATVault indexed _vault,
        bytes32 indexed _claimId,
        address[] _disputers
    );
    event BondRefundClaimed(
        IHATVault indexed _vault,
        bytes32 indexed _claimId,
        address _disputer,
        uint256 _amountClaimed
    );
    event ResolutionExecuted(
        IHATVault indexed _vault,
        bytes32 indexed _claimId
    );
    event ResolutionDismissed(
        IHATVault indexed _vault,
        bytes32 indexed _claimId
    );
    event ResolutionChallenged(
        IHATVault indexed _vault,
        bytes32 indexed _claimId
    );

    event SubmitClaimRequestCreated(
        bytes32 indexed _internalClaimId,
        address indexed _submitter,
        uint256 _bond,
        string _descriptionHash
    );
    event SubmitClaimRequestDismissed(
        bytes32 indexed _internalClaimId,
        string _descriptionHash
    );
    event SubmitClaimRequestApproved(
        bytes32 indexed _internalClaimId,
        bytes32 indexed _claimId,
        IHATVault indexed _vault
    );
    event SubmitClaimRequestExpired(bytes32 indexed _internalClaimId);

    modifier onlyExpertCommittee() {
        if (msg.sender != expertCommittee) {
            revert OnlyExpertCommittee();
        }
        _;
    }

    modifier onlyChallengedActiveClaim(IHATVault _vault, bytes32 _claimId) {
        (
            bytes32 claimId,
            ,
            ,
            ,
            uint32 createdAt,
            uint32 challengedAt,
            ,
            ,
            ,
            uint32 challengePeriod,
            uint32 challengeTimeOutPeriod,
            ,

        ) = _vault.activeClaim();

        if (claimId != _claimId) {
            revert ClaimIsNotCurrentlyActiveClaim();
        }

        if (challengedAt == 0) {
            revert ClaimIsNotDisputed();
        }

        if (
            block.timestamp >=
            createdAt + challengePeriod + challengeTimeOutPeriod
        ) {
            revert ClaimExpired();
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

    constructor(
        address _expertCommittee,
        address _court,
        IERC20 _token,
        uint256 _bondsNeededToStartDispute,
        uint256 _minBondAmount,
        uint256 _resolutionChallengePeriod,
        uint256 _submitClaimRequestReviewPeriod
    ) {
        expertCommittee = _expertCommittee;
        court = _court;
        token = _token;
        bondsNeededToStartDispute = _bondsNeededToStartDispute;
        minBondAmount = _minBondAmount;
        resolutionChallengePeriod = _resolutionChallengePeriod;
        submitClaimRequestReviewPeriod = _submitClaimRequestReviewPeriod;
        if (minBondAmount > bondsNeededToStartDispute) {
            revert bondsNeededToStartDisputeMustBeHigherThanMinAmount();
        }
    }

    /**
     * Dispute the commitee's claim
     * Can be called by anyone
     * @param _vault the vault that the claim was created
     * @param _claimId the id of the claim
     * @param _bondAmount Amount of tokens that the disputer will put up as a bond. This must be at least minBondAmount.
     * The dispute is accepted if the total amount of bonds exceeds bondsNeededToStartDispute
     */
    function dispute(
        IHATVault _vault,
        bytes32 _claimId,
        uint256 _bondAmount,
        string calldata _descriptionHash
    ) external {
        if (_bondAmount < minBondAmount) {
            revert BondAmountSubmittedTooLow();
        }

        (bytes32 claimId, , , , , uint32 challengedAt, , , , , , , ) = _vault
            .activeClaim();
        if (claimId != _claimId) {
            revert ClaimIsNotCurrentlyActiveClaim();
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

        emit ClaimDisputed(
            _vault,
            _claimId,
            msg.sender,
            _bondAmount,
            _descriptionHash
        );
    }

    /**
     * Dismiss the dispute - i.e. approve the original claim from the committee
     * Can only be called by the expert commmittee.
     * The expert committee will receive the bonds of the disputers as a payment for their service
     * @param _vault the address of the vault where the claim was started
     * @param _claimId id of the claim that was disputed. Must be the currently active claim
     * @param _descriptionHash an (ipfs) hash representing the motiviations of the dismissal
     */
    function dismissDispute(
        IHATVault _vault,
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

    /**
     * Acccept the dispute - i.e. rule in favor of the disputers and against the original claim from the committee
     * Can only be called by the Expert Committee
     * The expert committee can include a payment for their service in the payout process
     * @param _vault the address of the vault where the claim was started
     * @param _claimId id of the claim that was disputed. Must be the currently active claim
     * @param _bountyPercentage the percentage of the vault that will be paid out to the _beneficiary
     * @param _beneficiary the (new) benficiary of the claim
     * @param _disputersToRefund array of addresses of disputers that will get their bond back
     * @param _disputersToConfiscate array of addresses of disputers that will lose their bond
     * @param _descriptionHash a motivation of the ruling
     */
    function acceptDispute(
        IHATVault _vault,
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

    /**
     * @notice release the bonds of the disputers, so that they can claim them back
     * @param _vault the address of the vault where the claim was started
     * @param _claimId id of the claim that was disputed. Must be the currently active claim
     * @param _disputersToRefund array of addresses
     */
    function refundDisputers(
        IHATVault _vault,
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
        IHATVault _vault,
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

    /**
     * Forfeit the bonds of the given list of disputers. Their bonds will be sent to the expert committee
     * @param _vault the address of the vault where the claim was started
     * @param _claimId id of the claim that was disputed. Must be the currently active claim
     * @param _disputersToConfiscate a list of addresses of disputers whose bond will be forfeited
     */
    function confiscateDisputers(
        IHATVault _vault,
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
        IHATVault _vault,
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

    /**
     * reclaim a bond that msg.sender has put up for a given claim
     * @param _vault the address of the vault where the claim was started
     * @param _claimId id of the claim that was disputed. Must be the currently active claim
     */
    function reclaimBond(IHATVault _vault, bytes32 _claimId) external {
        if (!bondClaimable[msg.sender][_vault][_claimId]) {
            (
                bytes32 claimId,
                ,
                ,
                ,
                uint32 createdAt,
                ,
                ,
                ,
                ,
                uint32 challengePeriod,
                uint32 challengeTimeOutPeriod,
                ,

            ) = _vault.activeClaim();

            if (
                claimId == _claimId &&
                block.timestamp <
                createdAt + challengePeriod + challengeTimeOutPeriod
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

    /**
     * @notice execute a resolution from the expert committee
     * if the resolution was challenged, this can only be called by the court
     * if the resolution was not challenged durring the resolutionChallengePeriod, this can be called by anyone
     * @param _vault the address of the vault where the claim was started
     * @param _claimId id of the claim that was disputed. Must be the currently active claim
     */
    function executeResolution(
        IHATVault _vault,
        bytes32 _claimId
    )
        external
        onlyChallengedActiveClaim(_vault, _claimId)
        onlyResolvedDispute(_vault, _claimId)
    {
        // TODO: This might be too long if the challenge timeout period is too short
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

    /**
     * Dismiss a resolution from the expert committee
     * can only be called by the court
     * @param _vault the address of the vault where the claim was started
     * @param _claimId id of the claim that was disputed. Must be the currently active claim
     */
    function dismissResolution(
        IHATVault _vault,
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

    /**
     * Challenge a resolution of the expert committee - i.e. bring it to the attation of the court
     * @param _vault the address of the vault where the claim was started
     * @param _claimId id of the claim that was disputed. Must be the currently active claim
     */
    function challengeResolution(
        IHATVault _vault,
        bytes32 _claimId
    )
        external
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

        // TODO: add a function to notify the court about the challenge.
        // TODO: reimburse the sender the surplus fee returned by notify() function.

        // TODO: Should resolution be possible to challenge by multiple challengers?

        // TODO: Here the challenger should also fund the claim with the court to avoid spamming, we can just open it calling the court here
    }

    /**
     * Submit a request for the expert committee to consider a claim
     * A security researcher can use this if his claim is ignored by the committee
     * The requester must provide a bond, which they will lose if the claim is considered invalid by the committee
     * @param _descriptionHash a hash of a description of the claim
     */
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

    /**
     * Dismiss a request to create a claim. Can only be called by the expert committee
     * @param _internalClaimId the id of the claim to dismiss
     * @param _descriptionHash a motivation for the dismissal
     */
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

    /**
     * Submit a new claim on the basis of a submitClaimRequest
     * only calleable by the expert committee
     * the claim must be submitted within the submitClaimRequestReviewPeriod
     * @param _vault the vault where the claim was created
     * @param _internalClaimId the id of the claim to approve
     * @param _bountyPercentage the percentage of the vault that will be paid out to the _beneficiary
     * @param _beneficiary the (new) benficiary of the claim
     * @param _descriptionHash a motivation for the claim
     */
    function approveSubmitClaimRequest(
        IHATVault _vault,
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

        token.safeTransfer(
            submitClaimRequest.submitter,
            submitClaimRequest.bond
        );

        emit SubmitClaimRequestApproved(_internalClaimId, claimId, _vault);
    }

    /**
     * Refund the bond of the claimRequest by the sumbitter of the claim
     * @param _internalClaimId the claim of which the bond will be refunded
     */
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
        token.safeTransfer(submitClaimRequest.submitter, bondsNeededToStartDispute);

        emit SubmitClaimRequestExpired(_internalClaimId);
    }
}
