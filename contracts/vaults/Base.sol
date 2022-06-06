// SPDX-License-Identifier: MIT
// Disclaimer https://github.com/hats-finance/hats-contracts/blob/main/DISCLAIMER.md

pragma solidity 0.8.14;

import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "../tokenlock/ITokenLockFactory.sol";
import "../RewardController.sol";

contract Base is OwnableUpgradeable, ReentrancyGuardUpgradeable {
    // Parameters that apply to all the vaults
    struct GeneralParameters {
        uint256 hatVestingDuration;
        uint256 hatVestingPeriods;
        // withdraw enable period. safetyPeriod starts when finished.
        uint256 withdrawPeriod;
        // withdraw disable period - time for the committee to gather and decide on actions,
        // withdrawals are not possible in this time. withdrawPeriod starts when finished.
        uint256 safetyPeriod;
        // period of time after withdrawRequestPendingPeriod where it is possible to withdraw
        // (after which withdrawal is not possible)
        uint256 withdrawRequestEnablePeriod;
        // period of time that has to pass after withdraw request until withdraw is possible
        uint256 withdrawRequestPendingPeriod;
        uint256 setMaxBountyDelay;
        uint256 claimFee;  //claim fee in ETH
    }

    // Info of each pool.
    struct PoolInfo {
        bool committeeCheckedIn;
        IERC20Upgradeable lpToken;
        // total amount of LP tokens in pool
        uint256 balance;
        uint256 totalShares;
        uint256 rewardPerShare;
        uint256 lastRewardBlock;
        // index of last PoolUpdate in globalPoolUpdates (number of times we have updated the
        // total allocation points - 1)
        uint256 lastProcessedTotalAllocPoint;
        // fee to take from withdrawals to governance
        uint256 withdrawalFee;
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

    // Info of each pool's bounty policy.
    struct BountyInfo {
        BountySplit bountySplit;
        uint256 maxBounty;
        uint256 vestingDuration;
        uint256 vestingPeriods;
    }

    // How to divide the bounties for each pool, in percentages (out of `HUNDRED_PERCENT`)
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
        // the percentage of the total bounty to be swapped to HATs and sent to the hacker via vesting contract
        uint256 hackerHatVested;
    }

    // How to divide a bounty for a claim that has been approved, in amounts of pool's tokens
    struct ClaimBounty {
        uint256 hacker;
        uint256 hackerVested;
        uint256 committee;
        uint256 swapAndBurn;
        uint256 hackerHatVested;
        uint256 governanceHat;
    }

    // Info of a claim for a bounty payout that has been submitted by a committee
    struct Claim {
        uint256 pid;
        address beneficiary;
        uint256 bountyPercentage;
        // the address of the committee at the time of the submittal, so that this committee will
        // be payed their share of the bounty in case the committee changes before claim approval
        address committee;
        uint256 createdAt;
        bool isChallenged;
    }

    struct PendingMaxBounty {
        uint256 maxBounty;
        uint256 timestamp;
    }

    uint256 public constant HUNDRED_PERCENT = 10000;
    uint256 public constant MAX_FEE = 200; // Max fee is 2%
    uint256 public constant MINIMUM_DEPOSIT = 1e6;

    //PARAMETERS FOR ALL VAULTS
    uint256 public challengePeriod; // time during which a claim can be challenged by the arbitrator
    uint256 public challengeTimeOutPeriod; // time after which a challenged claim is automatically dismissed
    GeneralParameters public generalParameters;
    RewardController public rewardController;
    ITokenLockFactory public tokenLockFactory;
    address public feeSetter;

    address public arbitrator;

    // the ERC20 contract in which rewards are distributed
    IERC20 public rewardToken;
    // the token into which a part of the the bounty will be swapped-into-and-burnt - this will
    // typically be HATs
    ERC20Burnable public swapToken;
    uint256 public rewardAvailable;
    mapping(address => bool) public whitelistedRouters;
    uint256 internal nonce;

    //PARAMETERS PER VAULT
    // Info of each pool.
    PoolInfo[] public poolInfos;
    // poolId -> committee address
    mapping(uint256 => address) public committees;
    // Info of each user that stakes LP tokens. poolId => user address => info
    mapping(uint256 => mapping(address => UserInfo)) public userInfo;
    // poolId -> BountyInfo
    mapping(uint256 => BountyInfo) public bountyInfos;
    // poolId -> PendingMaxBounty
    mapping(uint256 => PendingMaxBounty) public pendingMaxBounty;
    // poolId -> claimId
    mapping(uint256 => uint256) public activeClaims;
    mapping(uint256 => bool) public poolInitialized;
    mapping(uint256 => bool) public poolDepositPause;
    // poolId -> (address -> requestTime)
    // Time of when last withdraw request pending period ended, or 0 if last action was deposit or withdraw
    mapping(uint256 => mapping(address => uint256)) public withdrawEnableStartTime;

    //PARAMETERS PER CLAIM
    // claimId -> Claim
    mapping(uint256 => Claim) public claims;
    // poolId -> amount
    mapping(uint256 => uint256) public swapAndBurns;
    // hackerAddress -> (pid -> amount)
    mapping(address => mapping(uint256 => uint256)) public hackersHatRewards;
    // poolId -> amount
    mapping(uint256 => uint256) public governanceHatRewards;

    event SafeTransferReward(
        address indexed user,
        uint256 indexed pid,
        uint256 amount,
        address rewardToken
    );
    event LogClaim(address indexed _claimer, string _descriptionHash);
    event SubmitClaim(
        uint256 indexed _pid,
        uint256 _claimId,
        address _committee,
        address indexed _beneficiary,
        uint256 indexed _bountyPercentage,
        string _descriptionHash
    );
    event ApproveClaim(
        uint256 indexed _pid,
        uint256 indexed _claimId,
        address indexed _committee,
        address _beneficiary,
        uint256 _bountyPercentage,
        address _tokenLock,
        ClaimBounty _claimBounty
    );
    event DismissClaim(uint256 indexed _pid, uint256 indexed _claimId);
    event Deposit(address indexed user,
        uint256 indexed pid,
        uint256 amount,
        uint256 transferredAmount
    );
    event ClaimReward(uint256 indexed _pid);
    event RewardDepositors(uint256 indexed _pid,
        uint256 indexed _amount,
        uint256 indexed _transferredAmount
    );
    event DepositReward(uint256 indexed _amount,
        uint256 indexed _transferredAmount,
        address indexed _rewardToken
    );
    event SetFeeSetter(address indexed _newFeeSetter);
    event SetCommittee(uint256 indexed _pid, address indexed _committee);
    event SetChallengePeriod(uint256 _challengePeriod);
    event SetChallengeTimeOutPeriod(uint256 _challengeTimeOutPeriod);
    event SetArbitrator(address indexed _arbitrator);
    event SetWithdrawRequestParams(
        uint256 indexed _withdrawRequestPendingPeriod,
        uint256 indexed _withdrawRequestEnablePeriod
    );
    event SetClaimFee(uint256 _fee);
    event SetWithdrawSafetyPeriod(uint256 indexed _withdrawPeriod, uint256 indexed _safetyPeriod);
    event SetVestingParams(
        uint256 indexed _pid,
        uint256 indexed _duration,
        uint256 indexed _periods
    );
    event SetHatVestingParams(uint256 indexed _duration, uint256 indexed _periods);
    event SetBountySplit(uint256 indexed _pid, BountySplit _bountySplit);
    event SetMaxBountyDelay(uint256 indexed _delay);
    event RouterWhitelistStatusChanged(address indexed _router, bool _status);
    event SetPoolWithdrawalFee(uint256 indexed _pid, uint256 _newFee);
    event CommitteeCheckedIn(uint256 indexed _pid);
    event SetPendingMaxBounty(uint256 indexed _pid, uint256 _maxBounty, uint256 _timeStamp);
    event SetMaxBounty(uint256 indexed _pid, uint256 _maxBounty);
    event SetRewardController(address indexed _newRewardController);
    event AddPool(
        uint256 indexed _pid,
        address indexed _lpToken,
        address _committee,
        string _descriptionHash,
        uint256 _maxBounty,
        BountySplit _bountySplit,
        uint256 _bountyVestingDuration,
        uint256 _bountyVestingPeriods
    );
    event SetPool(
        uint256 indexed _pid,
        bool indexed _registered,
        bool _depositPause,
        string _descriptionHash
    );
    event MassUpdatePools(uint256 _fromPid, uint256 _toPid);
    event SwapAndBurn(
        uint256 indexed _pid,
        uint256 indexed _amountSwapped,
        uint256 indexed _amountBurned
    );
    event SwapAndSend(
        uint256 indexed _pid,
        address indexed _beneficiary,
        uint256 indexed _amountSwapped,
        uint256 _amountReceived,
        address _tokenLock
    );
    event WithdrawRequest(
        uint256 indexed _pid,
        address indexed _beneficiary,
        uint256 indexed _withdrawEnableTime
    );
    event Withdraw(address indexed user, uint256 indexed pid, uint256 shares);
    event EmergencyWithdraw(address indexed user, uint256 indexed pid, uint256 amount);

    modifier onlyFeeSetter() {
        require(feeSetter == msg.sender, "HVE35");
        _;
    }

    modifier onlyCommittee(uint256 _pid) {
        if (committees[_pid] != msg.sender) revert HVE01();
        _;
    }

    modifier onlyArbitrator() {
        require(arbitrator == msg.sender, "HVE47");
        _;
    }

    modifier noSafetyPeriod() {
        //disable withdraw for safetyPeriod (e.g 1 hour) after each withdrawPeriod(e.g 11 hours)
        // solhint-disable-next-line not-rely-on-time
        require(block.timestamp %
        (generalParameters.withdrawPeriod + generalParameters.safetyPeriod) <
            generalParameters.withdrawPeriod,
            "HVE03");
        _;
    }

    modifier noActiveClaims(uint256 _pid) {
        if(activeClaims[_pid] != 0) revert HVE02();
        _;
    }

    /**
    * @dev Update the pool's rewardPerShare, not more then once per block
    * @param _pid The pool id
    */
    function updatePool(uint256 _pid) public {
        PoolInfo storage pool = poolInfos[_pid];
        uint256 lastRewardBlock = pool.lastRewardBlock;
        if (block.number <= lastRewardBlock) {
            return;
        }
        uint256 totalShares = pool.totalShares;
        if (totalShares != 0) {
            uint256 lastProcessedAllocPoint = pool.lastProcessedTotalAllocPoint;
            uint256 reward = rewardController.getPoolReward(_pid, lastRewardBlock, lastProcessedAllocPoint);
            pool.rewardPerShare += (reward * 1e12 / totalShares);
        }
        pool.lastRewardBlock = block.number;
        setPoolsLastProcessedTotalAllocPoint(_pid);
    }

    function getDefaultBountySplit() public pure returns (BountySplit memory) {
        return BountySplit({
            hackerVested: 6000,
            hacker: 2000,
            committee: 500,
            swapAndBurn: 0,
            governanceHat: 1000,
            hackerHatVested: 500
        });
    }

    /**
    * @dev Safe HAT transfer function, transfer rewards from the contract only if there are enough
    * rewards available.
    * @param _to The address to transfer the reward to
    * @param _amount The amount of rewards to transfer
    * @param _pid The pool id
   */
    function safeTransferReward(address _to, uint256 _amount, uint256 _pid) internal {
        require(rewardAvailable >= _amount, "HVE46");
        rewardAvailable -= _amount;
        rewardToken.transfer(_to, _amount);
        emit SafeTransferReward(_to, _pid, _amount, address(rewardToken));
    }

    function setPoolsLastProcessedTotalAllocPoint(uint256 _pid) internal {
        uint globalPoolUpdatesLength = rewardController.getGlobalPoolUpdatesLength();
        if (globalPoolUpdatesLength > 0) {
            poolInfos[_pid].lastProcessedTotalAllocPoint = globalPoolUpdatesLength - 1;
        }
    }

    function validateSplit(BountySplit memory _bountySplit) internal pure {
        require(_bountySplit.hackerVested
            + _bountySplit.hacker
            + _bountySplit.committee
            + _bountySplit.swapAndBurn
            + _bountySplit.governanceHat
            + _bountySplit.hackerHatVested == HUNDRED_PERCENT,
        "HVE29");
    }

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[50] private __gap;
}
