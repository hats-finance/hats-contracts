// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import "./Base.sol";

contract Claim is Base {
    using SafeERC20 for IERC20;

    /**
    * @notice Called by a committee to submit a claim for a bounty.
    * The submitted claim needs to be approved or dismissed by the Hats governance.
    * This function should be called only on a safety period, where withdrawals are disabled.
    * Upon a call to this function by the committee the pool withdrawals will be disabled
    * until the Hats governance will approve or dismiss this claim.
    * @param _pid The pool id
    * @param _beneficiary The submitted claim's beneficiary
    * @param _severity The submitted claim's bug severity
    */
    function submitClaim(uint256 _pid,
        address _beneficiary,
        uint256 _severity,
        string calldata _descriptionHash)
    external
    onlyCommittee(_pid)
    noSubmittedClaims(_pid) {
        require(_beneficiary != address(0), "HVE04");
        // require we are in safetyPeriod
        // solhint-disable-next-line not-rely-on-time
        require(block.timestamp % (generalParameters.withdrawPeriod + generalParameters.safetyPeriod) >=
        generalParameters.withdrawPeriod, "HVE05");
        require(_severity < bountyInfos[_pid].bountyLevels.length, "HVE06");

        submittedClaims[_pid] = SubmittedClaim({
            beneficiary: _beneficiary,
            severity: _severity,
            committee: msg.sender,
            // solhint-disable-next-line not-rely-on-time
            createdAt: block.timestamp
        });
        emit SubmitClaim(_pid, msg.sender, _beneficiary, _severity, _descriptionHash);
    }

    /**
    * @notice Dismiss a claim for a bounty submitted by a committee.
    * Called either by Hats govenrance, or by anyone if the claim is over 5 weeks old.
    * @param _pid The pool id
    */
    function dismissClaim(uint256 _pid) external {
        // solhint-disable-next-line not-rely-on-time
        require(msg.sender == governance() || submittedClaims[_pid].createdAt + 5 weeks < block.timestamp, "HVE09");
        delete submittedClaims[_pid];
        emit DismissClaim(_pid);
    }

    /**
    * @notice Approve a claim for a bounty submitted by a committee, and transfer bounty to hacker and committe.
    * Called only by hats governance.
    * @param _pid The pool id
    */
    function approveClaim(uint256 _pid) external onlyGovernance nonReentrant {
        require(submittedClaims[_pid].beneficiary != address(0), "HVE10");
        BountyInfo storage bountyInfo = bountyInfos[_pid];
        SubmittedClaim memory submittedClaim = submittedClaims[_pid];
        delete submittedClaims[_pid];

        IERC20 lpToken = poolInfos[_pid].lpToken;
        ClaimBounty memory claimBounty = calcClaimBounty(_pid, submittedClaim.severity);
        poolInfos[_pid].balance -= claimBounty.hacker
                            + claimBounty.hackerVested
                            + claimBounty.committee
                            + claimBounty.swapAndBurn
                            + claimBounty.hackerHat
                            + claimBounty.governanceHat;
        address tokenLock;
        if (claimBounty.hackerVested > 0) {
        //hacker gets part of bounty to a vesting contract
            tokenLock = tokenLockFactory.createTokenLock(
            address(lpToken),
            0x000000000000000000000000000000000000dEaD, //this address as owner, so it can do nothing.
            submittedClaim.beneficiary,
            claimBounty.hackerVested,
            // solhint-disable-next-line not-rely-on-time
            block.timestamp, //start
            // solhint-disable-next-line not-rely-on-time
            block.timestamp + bountyInfo.vestingDuration, //end
            bountyInfo.vestingPeriods,
            0, //no release start
            0, //no cliff
            ITokenLock.Revocability.Disabled,
            false
            );
            lpToken.safeTransfer(tokenLock, claimBounty.hackerVested);
        }
        lpToken.safeTransfer(submittedClaim.beneficiary, claimBounty.hacker);
        lpToken.safeTransfer(submittedClaim.committee, claimBounty.committee);
        //storing the amount of token which can be swap and burned so it could be swapAndBurn in a seperate tx.
        swapAndBurns[_pid] += claimBounty.swapAndBurn;
        governanceHatRewards[_pid] += claimBounty.governanceHat;
        hackersHatRewards[submittedClaim.beneficiary][_pid] += claimBounty.hackerHat;

        emit ApproveClaim(_pid,
                        msg.sender,
                        submittedClaim.beneficiary,
                        submittedClaim.severity,
                        tokenLock,
                        claimBounty);
        assert(poolInfos[_pid].balance > 0);
    }

    //_descriptionHash - a hash of an ipfs encrypted file which describe the claim.
    // this can be use later on by the claimer to prove her claim
    function claim(string memory _descriptionHash) external payable {
        if (generalParameters.claimFee > 0) {
            require(msg.value >= generalParameters.claimFee, "HVE14");
            // solhint-disable-next-line indent
            payable(governance()).transfer(msg.value);
        }
        emit Claim(msg.sender, _descriptionHash);
    }

    function calcClaimBounty(uint256 _pid, uint256 _severity)
    public
    view
    returns(ClaimBounty memory claimBounty) {
        uint256 totalSupply = poolInfos[_pid].balance;
        require(totalSupply > 0, "HVE28");
        require(_severity < bountyInfos[_pid].bountyLevels.length, "HVE06");
        uint256 totalBountyAmount =
        totalSupply * bountyInfos[_pid].bountyLevels[_severity];
        claimBounty.hackerVested =
        totalBountyAmount * bountyInfos[_pid].bountySplit.hackerVested
        / (HUNDRED_PERCENT * HUNDRED_PERCENT);
        claimBounty.hacker =
        totalBountyAmount * bountyInfos[_pid].bountySplit.hacker
        / (HUNDRED_PERCENT * HUNDRED_PERCENT);
        claimBounty.committee =
        totalBountyAmount * bountyInfos[_pid].bountySplit.committee
        / (HUNDRED_PERCENT * HUNDRED_PERCENT);
        claimBounty.swapAndBurn =
        totalBountyAmount * bountyInfos[_pid].bountySplit.swapAndBurn
        / (HUNDRED_PERCENT * HUNDRED_PERCENT);
        claimBounty.governanceHat =
        totalBountyAmount * bountyInfos[_pid].bountySplit.governanceHat
        / (HUNDRED_PERCENT * HUNDRED_PERCENT);
        claimBounty.hackerHat =
        totalBountyAmount * bountyInfos[_pid].bountySplit.hackerHat
        / (HUNDRED_PERCENT * HUNDRED_PERCENT);
    }
}
