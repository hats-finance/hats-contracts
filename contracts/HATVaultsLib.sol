// SPDX-License-Identifier: MIT
// Disclaimer https://github.com/hats-finance/hats-contracts/blob/main/DISCLAIMER.md

pragma solidity 0.8.6;


import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./Governable.sol";
import "./HATToken.sol";
import "./tokenlock/ITokenLockFactory.sol";
import "./interfaces/ISwapRouter.sol";


// Errors:
// HVE01: Only committee
// HVE02: Claim submitted
// HVE03: Safety period
// HVE04: Beneficiary is zero
// HVE05: Not safety period
// HVE06: _severity is not in the range
// HVE07: Withdraw request pending period must be <= 3 months
// HVE08: Withdraw request enabled period must be >= 6 hour
// HVE09: Only callable by governance or after 5 weeks
// HVE10: No claim submitted
// HVE11: Amount to reward is too big
// HVE12: Withdraw period must be >= 1 hour
// HVE13: Safety period must be <= 6 hours
// HVE14: Not enough fee paid
// HVE15: Vesting duration is too long
// HVE16: Vesting periods cannot be zero
// HVE17: Vesting duration smaller than periods
// HVE18: Delay is too short
// HVE19: No pending set bounty levels
// HVE20: Delay period for setting bounty levels had not passed
// HVE21: Committee is zero
// HVE22: Committee already checked in
// HVE23: Pool does not exist
// HVE24: Amount is zero
// HVE25: Pending withdraw request exist
// HVE26: Deposit paused
// HVE27: Amount less than 1e6
// HVE28: totalSupply is zero
// HVE29: Total split % should be `HUNDRED_PERCENT`
// HVE30: Withdraw request is invalid
// HVE31: Token approve failed
// HVE32: Wrong amount received
// HVE33: Bounty level can not be more than `HUNDRED_PERCENT`
// HVE34: LP token is zero
// HVE35: Only fee setter
// HVE36: Fee must be less than or eqaul to 2%
// HVE37: Token approve reset failed
// HVE38: Pool range is too big
// HVE39: Invalid pool range
// HVE40: Committee not checked in yet
// HVE41: Not enough user balance
// HVE42: User shares must be greater than 0
// HVE43: Swap was not successful
// HVE44: Routing contract must be whitelisted


/// @title Manage all Hats.finance vaults
library  HATVaultsLib {

    //Parameters that apply to all the vaults
    struct GeneralParameters {
        uint256 hatVestingDuration;
        uint256 hatVestingPeriods;
        //withdraw enable period. safetyPeriod starts when finished.
        uint256 withdrawPeriod;
        //withdraw disable period - time for the commitee to gather and decide on actions, withdrawals are not possible in this time
        //withdrawPeriod starts when finished.
        uint256 safetyPeriod;
        uint256 setBountyLevelsDelay;
        // period of time after withdrawRequestPendingPeriod where it is possible to withdraw
        // (after which withdrawal is not possible)
        uint256 withdrawRequestEnablePeriod;
        // period of time that has to pass after withdraw request until withdraw is possible
        uint256 withdrawRequestPendingPeriod;
        uint256 claimFee;  //claim fee in ETH
    }

    struct UserInfo {
        uint256 shares;     // The user share of the pool based on the shares of lpToken the user has provided.
        uint256 rewardDebt; // Reward debt. See explanation below.
        //
        // We do some fancy math here. Basically, any point in time, the amount of HATs
        // entitled to a user but is pending to be distributed is:
        //
        //   pending reward = (user.shares * pool.rewardPerShare) - user.rewardDebt
        //
        // Whenever a user deposits or withdraws LP tokens to a pool. Here's what happens:
        //   1. The pool's `rewardPerShare` (and `lastRewardBlock`) gets updated.
        //   2. User receives the pending reward sent to his/her address.
        //   3. User's `shares` gets updated.
        //   4. User's `rewardDebt` gets updated.
    }

    struct PoolUpdate {
        uint256 blockNumber;// update blocknumber
        uint256 totalAllocPoint; //totalAllocPoint
    }

    // Info of each pool.
    struct PoolInfo {
        IERC20 lpToken;
        uint256 allocPoint;
        uint256 lastRewardBlock;
        uint256 rewardPerShare;
        uint256 totalShares;
        // index of last PoolUpdate in globalPoolUpdates (number of times we have updated the total allocation points - 1)
        uint256 lastProcessedTotalAllocPoint;
        // total amount of LP tokens in pool
        uint256 balance;
        // fee to take from withdrawals to governance
        uint256 withdrawalFee;
    }
    // Info of each pool's bounty policy.
    struct BountyInfo {
        HATVaultsLib.BountySplit bountySplit;
        uint256[] bountyLevels;
        bool committeeCheckIn;
        uint256 vestingDuration;
        uint256 vestingPeriods;
    }
    
    // How to devide the bounties for each pool, in percentages (out of `HUNDRED_PERCENT`)
    struct BountySplit {
        //the percentage of the total bounty to reward the hacker via vesting contract
        uint256 hackerVested;
        //the percentage of the total bounty to reward the hacker
        uint256 hacker;
        // the percentage of the total bounty to be sent to the committee
        uint256 committee;
        // the percentage of the total bounty to be swapped to HATs and then burned
        uint256 swapAndBurn;
        // the percentage of the total bounty to be swapped to HATs and sent to governance
        uint256 governanceHat;
        // the percentage of the total bounty to be swapped to HATs and sent to the hacker
        uint256 hackerHat;
    }

    struct ClaimBounty {
        uint256 hackerVested;
        uint256 hacker;
        uint256 committee;
        uint256 swapAndBurn;
        uint256 governanceHat;
        uint256 hackerHat;
    }
    uint256 public constant HUNDRED_PERCENT = 10000;

    function getDefaultBountySplit() public pure returns (BountySplit memory) {
        return BountySplit({
            hackerVested: 6000,
            hacker: 2000,
            committee: 500,
            swapAndBurn: 0,
            governanceHat: 1000,
            hackerHat: 500
        });
    }

  /**
   * @dev Check bounty levels.
   * Each level should be less than `HUNDRED_PERCENT`
   * If _bountyLevels length is 0, default bounty levels wdill be returned ([2000, 4000, 6000, 8000]).
   * @param _bountyLevels The bounty levels array
   * @return bountyLevels
 */
  function checkBountyLevels(uint256[] memory _bountyLevels)
    public
    pure
    returns (uint256[] memory bountyLevels) {
        bountyLevels = new uint256[](4);
        uint256 i;
        if (_bountyLevels.length == 0) {
            bountyLevels = new uint256[](4);
            for (i; i < 4; i++) {
              //defaultRewardLevels = [2000, 4000, 6000, 8000];
                bountyLevels[i] = 2000*(i+1);
            }
        } else {
            for (i; i < _bountyLevels.length; i++) {
                require(_bountyLevels[i] < HUNDRED_PERCENT, "HVE33");
            }
            bountyLevels = _bountyLevels;
        }
    }

    function calcClaimBounty(uint256 _pid, uint256 _severity,  HATVaultsLib.PoolInfo[] storage poolInfos,  BountyInfo storage bountyInfo)
      public
      view
      returns(ClaimBounty memory claimBounty) {
        uint256 totalSupply = poolInfos[_pid].balance;
        require(_severity < bountyInfo.bountyLevels.length, "HVE06");
        require(totalSupply > 0, "HVE28");
        uint256 totalBountyAmount =
        totalSupply * bountyInfo.bountyLevels[_severity];
        claimBounty.hackerVested =
        totalBountyAmount * bountyInfo.bountySplit.hackerVested
        / (HUNDRED_PERCENT * HUNDRED_PERCENT);
        claimBounty.hacker =
        totalBountyAmount * bountyInfo.bountySplit.hacker
        / (HUNDRED_PERCENT * HUNDRED_PERCENT);
        claimBounty.committee =
        totalBountyAmount * bountyInfo.bountySplit.committee
        / (HUNDRED_PERCENT * HUNDRED_PERCENT);
        claimBounty.swapAndBurn =
        totalBountyAmount * bountyInfo.bountySplit.swapAndBurn
        / (HUNDRED_PERCENT * HUNDRED_PERCENT);
        claimBounty.governanceHat =
        totalBountyAmount * bountyInfo.bountySplit.governanceHat
        / (HUNDRED_PERCENT * HUNDRED_PERCENT);
        claimBounty.hackerHat =
        totalBountyAmount * bountyInfo.bountySplit.hackerHat
        / (HUNDRED_PERCENT * HUNDRED_PERCENT);
    }
}