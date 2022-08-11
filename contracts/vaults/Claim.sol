// SPDX-License-Identifier: MIT
pragma solidity 0.8.14;

import "./Base.sol";

contract Claim is Base {
    using SafeERC20 for IERC20;

    /**
    * @notice emit an event that includes the given _descriptionHash
    * This can be used by the claimer as evidence that she had access to the information at the time of the call
    * if a claimFee > 0, the caller must send claimFee Ether for the claim to succeed
    * @param _descriptionHash - a hash of an ipfs encrypted file which describes the claim.
    */
    function logClaim(string memory _descriptionHash) external payable {
        HATVaultsRegistry.GeneralParameters memory generalParameters = registry.getGeneralParameters();
        if (generalParameters.claimFee > 0) {
            if (msg.value < generalParameters.claimFee)
                revert NotEnoughFeePaid();
            // solhint-disable-next-line indent
            payable(owner()).transfer(msg.value);
        }
        emit LogClaim(msg.sender, _descriptionHash);
    }

    /**
    * @notice Called by a committee to submit a claim for a bounty.
    * The submitted claim needs to be approved or dismissed by the Hats governance.
    * This function should be called only on a safety period, where withdrawals are disabled.
    * Upon a call to this function by the committee the vault's withdrawals will be disabled
    * until the Hats governance will approve or dismiss this claim.
    * @param _beneficiary The submitted claim's beneficiary
    * @param _bountyPercentage The submitted claim's bug requested reward percentage
    */
    function submitClaim(address _beneficiary, uint256 _bountyPercentage, string calldata _descriptionHash)
    external
    onlyCommittee()
    noActiveClaim()
    {
        if (_beneficiary == address(0)) revert BeneficiaryIsZero();
        HATVaultsRegistry.GeneralParameters memory generalParameters = registry.getGeneralParameters();
        // require we are in safetyPeriod
        // solhint-disable-next-line not-rely-on-time
        if (block.timestamp % (generalParameters.withdrawPeriod + generalParameters.safetyPeriod) <
        generalParameters.withdrawPeriod) revert NotSafetyPeriod();
        if (_bountyPercentage > maxBounty)
            revert BountyPercentageHigherThanMaxBounty();
        activeClaim = Claim({
            beneficiary: _beneficiary,
            bountyPercentage: _bountyPercentage,
            committee: msg.sender,
            // solhint-disable-next-line not-rely-on-time
            createdAt: block.timestamp,
            isChallenged: false
        });

        emit SubmitClaim(
            msg.sender,
            _beneficiary,
            _bountyPercentage,
            _descriptionHash
        );
    }

    /**
    * @notice Called by a the arbitrator to challenge the active claim
    * This will pause the vault for withdrawals until the claim is resolved
    */
    function challengeClaim() external onlyArbitrator activeClaimExists {
        if (block.timestamp > activeClaim.createdAt + registry.challengeTimeOutPeriod())
            revert ChallengePeriodEnded();
        activeClaim.isChallenged = true;
    }

    /**
    * @notice Approve the active claim for a bounty submitted by a committee, and transfer bounty to hacker and committee.
    * callable by the arbitrator, if isChallenged == true
    * Callable by anyone after challengePeriod is passed and isChallenged == false
    * @param _bountyPercentage The percentage of the vault's balance that will be send as a bounty.
    * The value for _bountyPercentage will be ignored if the caller is not the arbitrator
    */
    function approveClaim(uint256 _bountyPercentage) external nonReentrant activeClaimExists {
        Claim memory claim = activeClaim;
        if (claim.isChallenged) {
            if (msg.sender != registry.arbitrator()) revert ClaimCanOnlyBeApprovedAfterChallengePeriodOrByArbitrator();
            claim.bountyPercentage = _bountyPercentage;
        } else {
            if (block.timestamp <= claim.createdAt + registry.challengePeriod()) revert ClaimCanOnlyBeApprovedAfterChallengePeriodOrByArbitrator();
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
        //storing the amount of token which can be swap and burned so it could be swapAndBurn in a separate tx.
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
            msg.sender,
            claim.beneficiary,
            claim.bountyPercentage,
            tokenLock,
            claimBounty
        );

        delete activeClaim;
    }

    /**
    * @notice Dismiss the active claim for a bounty submitted by a committee.
    * Called either by the arbitrator, or by anyone if the claim is over 5 weeks old.
    */
    function dismissClaim() external {
        Claim memory claim = activeClaim;
        if (!claim.isChallenged) revert OnlyCallableIfChallenged();
        // solhint-disable-next-line not-rely-on-time
        if (block.timestamp < claim.createdAt + registry.challengeTimeOutPeriod() && msg.sender != registry.arbitrator())
            revert OnlyCallableByArbitratorOrAfterChallengeTimeOutPeriod();
        delete activeClaim;

        emit DismissClaim();
    }


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
        / (HUNDRED_PERCENT * HUNDRED_PERCENT);
        claimBounty.hacker =
        totalBountyAmount * bountySplit.hacker
        / (HUNDRED_PERCENT * HUNDRED_PERCENT);
        claimBounty.committee =
        totalBountyAmount * bountySplit.committee
        / (HUNDRED_PERCENT * HUNDRED_PERCENT);
        claimBounty.swapAndBurn =
        totalBountyAmount * bountySplit.swapAndBurn
        / (HUNDRED_PERCENT * HUNDRED_PERCENT);
        claimBounty.governanceHat =
        totalBountyAmount * bountySplit.governanceHat
        / (HUNDRED_PERCENT * HUNDRED_PERCENT);
        claimBounty.hackerHatVested =
        totalBountyAmount * bountySplit.hackerHatVested
        / (HUNDRED_PERCENT * HUNDRED_PERCENT);
    }
}