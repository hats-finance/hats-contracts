// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import "./Base.sol";

contract Claim is Base {
    using SafeERC20 for IERC20;
    
    /**
    * @notice Called by the committee to submit a claim for a bounty payout.
    * This function should be called only on a safety period, when withdrawals
    * are disabled.
    * Upon a call to this function by the committee the vault's withdrawals
    * will be disabled until the claim is approved or dismissed. Also from the
    * time of this call the arbitrator will have a period of 
    *`HATVaultsRegistry.challengePeriod` to challenge the claim.
    * @param _beneficiary The submitted claim's beneficiary
    * @param _bountyPercentage The submitted claim's bug requested reward percentage
    */
    function submitClaim(address _beneficiary, uint256 _bountyPercentage, string calldata _descriptionHash)
    external
    onlyCommittee()
    noActiveClaim()
    returns (bytes32 claimId)
    {
        HATVaultsRegistry.GeneralParameters memory generalParameters = registry.getGeneralParameters();
        // require we are in safetyPeriod
        // solhint-disable-next-line not-rely-on-time
        if (block.timestamp % (generalParameters.withdrawPeriod + generalParameters.safetyPeriod) <
        generalParameters.withdrawPeriod) revert NotSafetyPeriod();
        if (_bountyPercentage > maxBounty)
            revert BountyPercentageHigherThanMaxBounty();
        claimId = keccak256(abi.encodePacked(address(this), nonce++));
        activeClaim = Claim({
            claimId: claimId,
            beneficiary: _beneficiary,
            bountyPercentage: _bountyPercentage,
            committee: msg.sender,
            // solhint-disable-next-line not-rely-on-time
            createdAt: block.timestamp,
            challengedAt: 0
        });

        emit SubmitClaim(
            claimId,
            msg.sender,
            _beneficiary,
            _bountyPercentage,
            _descriptionHash
        );
    }

    /**
    * @notice Called by the arbitrator to challenge a claim for a bounty
    * payout that had been previously submitted by the committee.
    * Can only be called during the challenge period after submission of the
    * claim.
    * @param _claimId The claim ID
    */
    function challengeClaim(bytes32 _claimId) external onlyArbitrator isActiveClaim(_claimId) {
        // solhint-disable-next-line not-rely-on-time
        if (block.timestamp > activeClaim.createdAt + registry.challengePeriod())
            revert ChallengePeriodEnded();
        // solhint-disable-next-line not-rely-on-time
        activeClaim.challengedAt = block.timestamp;
        emit ChallengeClaim(_claimId);
    }

    /**
    * @notice Approve a claim for a bounty submitted by a committee, and
    * pay out bounty to hacker and committee. Also transfer to the 
    * HATVaultsRegistry the part of the bounty that will be swapped to HAT 
    * tokens.
    * If the claim had been previously challenged, this is only callable by
    * the arbitrator. Otherwise, callable by anyone after challengePeriod had
    * passed.
    * @param _claimId The claim ID
    * @param _bountyPercentage The percentage of the vault's balance that will
    * be sent as a bounty. This value will be ignored if the caller is not the
    * arbitrator.
    */
    function approveClaim(bytes32 _claimId, uint256 _bountyPercentage) external nonReentrant isActiveClaim(_claimId) {
        Claim memory claim = activeClaim;
        delete activeClaim;

        if (claim.challengedAt != 0) {
            // solhint-disable-next-line not-rely-on-time
            if (msg.sender != registry.arbitrator() || block.timestamp > claim.challengedAt + registry.challengeTimeOutPeriod())
                revert ChallengedClaimCanOnlyBeApprovedByArbitratorUntilChallengeTimeoutPeriod();
            claim.bountyPercentage = _bountyPercentage;
        } else {
            // solhint-disable-next-line not-rely-on-time
            if (block.timestamp <= claim.createdAt + registry.challengePeriod()) revert UnchallengedClaimCanOnlyBeApprovedAfterChallengePeriod();
        }

        address tokenLock;

        ClaimBounty memory claimBounty = calcClaimBounty(claim.bountyPercentage);

        IERC20 asset = IERC20(asset());
        if (claimBounty.hackerVested > 0) {
            //hacker gets part of bounty to a vesting contract
            tokenLock = tokenLockFactory.createTokenLock(
                address(asset),
                0x000000000000000000000000000000000000dEaD, //this address as owner, so it can do nothing.
                claim.beneficiary,
                claimBounty.hackerVested,
                // solhint-disable-next-line not-rely-on-time
                block.timestamp, //start
                // solhint-disable-next-line not-rely-on-time
                block.timestamp + vestingDuration, //end
                vestingPeriods,
                0, //no release start
                0, //no cliff
                ITokenLock.Revocability.Disabled,
                false
            );
            asset.safeTransfer(tokenLock, claimBounty.hackerVested);
        }

        asset.safeTransfer(claim.beneficiary, claimBounty.hacker);
        asset.safeTransfer(claim.committee, claimBounty.committee);

        // send to the registry the amount of tokens which should be swapped 
        // to HAT so it could call swapAndBurn in a separate tx.
        asset.safeApprove(address(registry), claimBounty.swapAndBurn + claimBounty.hackerHatVested + claimBounty.governanceHat);
        registry.addTokensToSwap(
            asset,
            claim.beneficiary,
            claimBounty.swapAndBurn,
            claimBounty.hackerHatVested,
            claimBounty.governanceHat
        );

        // emit event before deleting the claim object, bcause we want to read beneficiary and bountyPercentage
        emit ApproveClaim(
            _claimId,
            msg.sender,
            claim.beneficiary,
            claim.bountyPercentage,
            tokenLock,
            claimBounty
        );
    }

    /**
    * @notice Dismiss the active claim for a bounty submitted by a committee.
    * Called either by the arbitrator, or by anyone if the claim is after the challenge timeout period.
    */
    function dismissClaim(bytes32 _claimId) external isActiveClaim(_claimId) {
        Claim memory claim = activeClaim;
        if (claim.challengedAt == 0) revert OnlyCallableIfChallenged();
        // solhint-disable-next-line not-rely-on-time
        if (block.timestamp < claim.challengedAt + registry.challengeTimeOutPeriod() && msg.sender != registry.arbitrator())
            revert OnlyCallableByArbitratorOrAfterChallengeTimeOutPeriod();
        delete activeClaim;

        emit DismissClaim(_claimId);
    }

    /**
    * @dev calculate the specific bounty payout distribution, according to the
    * predefined bounty split and the current bounty percentage
    * @param _bountyPercentage The percentage of the vault's funds to be paid
    * out as bounty
    * @return claimBounty The bounty distribution for this specific claim
    */
    function calcClaimBounty(uint256 _bountyPercentage)
    public
    view
    returns(ClaimBounty memory claimBounty) {
        uint256 totalSupply = totalAssets();
        if (totalSupply == 0) revert VaultBalanceIsZero();
        if (_bountyPercentage > maxBounty)
            revert BountyPercentageHigherThanMaxBounty();
        uint256 totalBountyAmount = totalSupply * _bountyPercentage;
        claimBounty.hackerVested =
        totalBountyAmount * bountySplit.hackerVested
        / (HUNDRED_PERCENT_SQRD);
        claimBounty.hacker =
        totalBountyAmount * bountySplit.hacker
        / (HUNDRED_PERCENT_SQRD);
        claimBounty.committee =
        totalBountyAmount * bountySplit.committee
        / (HUNDRED_PERCENT_SQRD);
        claimBounty.swapAndBurn =
        totalBountyAmount * bountySplit.swapAndBurn
        / (HUNDRED_PERCENT_SQRD);
        claimBounty.governanceHat =
        totalBountyAmount * bountySplit.governanceHat
        / (HUNDRED_PERCENT_SQRD);
        claimBounty.hackerHatVested =
        totalBountyAmount * bountySplit.hackerHatVested
        / (HUNDRED_PERCENT_SQRD);
    }
}
