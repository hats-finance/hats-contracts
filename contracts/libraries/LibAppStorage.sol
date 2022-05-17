// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../HATToken.sol";
import "../tokenlock/ITokenLockFactory.sol";
import "../libraries/LibDiamond.sol";

uint256 constant MULTIPLIERS_LENGTH = 24;
uint256 constant HUNDRED_PERCENT = 10000;
uint256 constant MAX_FEE = 200; // Max fee is 2%
uint256 constant MINIMUM_DEPOSIT = 1e6;
uint256 constant _NOT_ENTERED = 1;
uint256 constant _ENTERED = 2;


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
    uint256 withdrawalFee;
}

// Info of each pool's bounty policy.
struct BountyInfo {
    BountySplit bountySplit;
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

// How to devide a bounty for a claim that has been approved, in amounts of pool's tokens
struct ClaimBounty {
    uint256 hackerVested;
    uint256 hacker;
    uint256 committee;
    uint256 swapAndBurn;
    uint256 governanceHat;
    uint256 hackerHat;
}

// Info of a claim that has been submitted by a committe 
struct SubmittedClaim {
    address beneficiary;
    uint256 severity;
    // the address of the committee at the time of the submittal, so that this committee 
    // will be payed their share of the bounty in case the committee changes before claim approval
    address committee;
    uint256 createdAt;
}

struct PendingBountyLevels {
    uint256 timestamp;
    uint256[] bountyLevels;
}

struct AppStorage {
    uint256 ReentrancyGuard_status;

    HATToken HAT;
    uint256 REWARD_PER_BLOCK;
    // Block from which the HAT vault contract will start rewarding.
    uint256 START_BLOCK; 
    uint256 MULTIPLIER_PERIOD;

    // Info of each pool.
    PoolInfo[] poolInfos;
    PoolUpdate[] globalPoolUpdates;

    // Reward Multipliers
    uint256[24] rewardMultipliers;

    // Info of each user that stakes LP tokens. pid => user address => info
    mapping (uint256 => mapping (address => UserInfo)) userInfo;
    // pid -> BountyInfo
    mapping (uint256 => BountyInfo) bountyInfos;

    uint256 hatRewardAvailable;

    mapping(address=>bool) whitelistedRouters;

    // pid -> committee address
    mapping(uint256=>address) committees;
    // pid -> amount
    mapping(uint256 => uint256) swapAndBurns;
    // hackerAddress ->(pid->amount)
    mapping(address => mapping(uint256 => uint256)) hackersHatRewards;
    // pid -> amount
    mapping(uint256 => uint256) governanceHatRewards;
    // pid -> SubmittedClaim
    mapping(uint256 => SubmittedClaim) submittedClaims;
    // poolId -> (address -> requestTime)
    // Time of when last withdraw request pending period ended, or 0 if last action was deposit or withdraw
    mapping(uint256 => mapping(address => uint256)) withdrawEnableStartTime;
    // poolId -> PendingBountyLevels
    mapping(uint256 => PendingBountyLevels) pendingBountyLevels;

    mapping(uint256 => bool) poolDepositPause;

    GeneralParameters generalParameters;

    address feeSetter;

    ITokenLockFactory tokenLockFactory;
}

library LibAppStorage {
    function diamondStorage() internal pure returns (AppStorage storage ds) {
        assembly {
            ds.slot := 0
        }
    }
}

contract Modifiers {    
    AppStorage internal s;

    /**
     * @dev Prevents a contract from calling itself, directly or indirectly.
     * Calling a `nonReentrant` function from another `nonReentrant`
     * function is not supported. It is possible to prevent this from happening
     * by making the `nonReentrant` function external, and making it call a
     * `private` function that does the actual work.
     */
    modifier nonReentrant() {
        // On the first call to nonReentrant, _notEntered will be true
        require(s.ReentrancyGuard_status != _ENTERED, "ReentrancyGuard: reentrant call");

        // Any calls to nonReentrant after this point will fail
        s.ReentrancyGuard_status = _ENTERED;

        _;

        // By storing the original value once again, a refund is triggered (see
        // https://eips.ethereum.org/EIPS/eip-2200)
        s.ReentrancyGuard_status = _NOT_ENTERED;
    }

    modifier onlyOwner {
        LibDiamond.enforceIsContractOwner();
        _;
    }

    modifier onlyCommittee(uint256 _pid) {
        require(s.committees[_pid] == msg.sender, "HVE01");
        _;
    }

    modifier noSubmittedClaims(uint256 _pid) {
        require(s.submittedClaims[_pid].beneficiary == address(0), "HVE02");
        _;
    }

    modifier noSafetyPeriod() {
        // disable withdraw for safetyPeriod (e.g 1 hour) after each withdrawPeriod(e.g 11 hours)
        // solhint-disable-next-line not-rely-on-time
        require(block.timestamp % (s.generalParameters.withdrawPeriod + s.generalParameters.safetyPeriod) <
        s.generalParameters.withdrawPeriod,
        "HVE03");
        _;
    }

    modifier onlyFeeSetter() {
        require(s.feeSetter == msg.sender || (LibDiamond.contractOwner() == msg.sender && s.feeSetter == address(0)), "HVE35");
        _;
    }
}