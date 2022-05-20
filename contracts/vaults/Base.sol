// SPDX-License-Identifier: MIT
// Disclaimer https://github.com/hats-finance/hats-contracts/blob/main/DISCLAIMER.md

pragma solidity 0.8.6;


import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../Governable.sol";
import "../HATToken.sol";
import "../tokenlock/ITokenLockFactory.sol";

contract  Base is Governable, ReentrancyGuard {

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

    // Info of a claim that has been submitted by a committee
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


    HATToken public HAT;
    uint256 public REWARD_PER_BLOCK;
    // Block from which the HAT vault contract will start rewarding.
    uint256 public START_BLOCK;
    uint256 public MULTIPLIER_PERIOD;
    uint256 public constant MULTIPLIERS_LENGTH = 24;
    uint256 public constant HUNDRED_PERCENT = 10000;
    uint256 public constant MAX_FEE = 200; // Max fee is 2%

    // Info of each pool.
    PoolInfo[] public poolInfos;
    PoolUpdate[] public globalPoolUpdates;

    // Reward Multipliers
    uint256[24] public rewardMultipliers = [4413, 4413, 8825, 7788, 6873, 6065,
                                            5353, 4724, 4169, 3679, 3247, 2865,
                                            2528, 2231, 1969, 1738, 1534, 1353,
                                            1194, 1054, 930, 821, 724, 639];

    // Info of each user that stakes LP tokens. pid => user address => info
    mapping (uint256 => mapping (address => UserInfo)) public userInfo;
    //pid -> BountyInfo
    mapping (uint256=>BountyInfo) internal bountyInfos;

    uint256 public hatRewardAvailable;

    //pid -> committee address
    mapping(uint256=>address) public committees;
    //pid -> amount
    mapping(uint256 => uint256) public swapAndBurns;
    //hackerAddress ->(pid->amount)
    mapping(address => mapping(uint256 => uint256)) public hackersHatRewards;
    //pid -> amount
    mapping(uint256 => uint256) public governanceHatRewards;
    //pid -> SubmittedClaim
    mapping(uint256 => SubmittedClaim) public submittedClaims;
    //poolId -> (address -> requestTime)
    // Time of when last withdraw request pending period ended, or 0 if last action was deposit or withdraw
    mapping(uint256 => mapping(address => uint256)) public withdrawEnableStartTime;
    //poolId -> PendingBountyLevels
    mapping(uint256 => PendingBountyLevels) public pendingBountyLevels;

    mapping(uint256 => bool) public poolDepositPause;

    mapping(address=>bool) public whitelistedRouters;

    GeneralParameters public generalParameters;

    address public feeSetter;

    ITokenLockFactory public tokenLockFactory;
    uint256 public constant MINIMUM_DEPOSIT = 1e6;

    modifier onlyCommittee(uint256 _pid) {
        require(committees[_pid] == msg.sender, "HVE01");
        _;
    }

    modifier noSubmittedClaims(uint256 _pid) {
        require(submittedClaims[_pid].beneficiary == address(0), "HVE02");
        _;
    }

    modifier noSafetyPeriod() {
      //disable withdraw for safetyPeriod (e.g 1 hour) after each withdrawPeriod(e.g 11 hours)
      // solhint-disable-next-line not-rely-on-time
        require(block.timestamp % (generalParameters.withdrawPeriod + generalParameters.safetyPeriod) <
        generalParameters.withdrawPeriod,
        "HVE03");
        _;
    }

    modifier onlyFeeSetter() {
        require(feeSetter == msg.sender || (governance() == msg.sender && feeSetter == address(0)), "HVE35");
        _;
    }


    event Deposit(address indexed user, uint256 indexed pid, uint256 amount, uint256 transferredAmount);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 shares);
    event EmergencyWithdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event SafeTransferReward(address indexed user, uint256 indexed pid, uint256 amount, uint256 requestedAmount);
    event MassUpdatePools(uint256 _fromPid, uint256 _toPid);

    event SetCommittee(uint256 indexed _pid, address indexed _committee);
    event CommitteeCheckedIn(uint256 indexed _pid);

    event AddPool(uint256 indexed _pid,
                uint256 indexed _allocPoint,
                address indexed _lpToken,
                address _committee,
                string _descriptionHash,
                uint256[] _bountyLevels,
                BountySplit _bountySplit,
                uint256 _bountyVestingDuration,
                uint256 _bountyVestingPeriods);

    event SetPool(uint256 indexed _pid, uint256 indexed _allocPoint, bool indexed _registered, bool _depositPause, string _descriptionHash);
    event Claim(address indexed _claimer, string _descriptionHash);
    event SetBountySplit(uint256 indexed _pid, BountySplit _bountySplit);
    event SetBountyLevels(uint256 indexed _pid, uint256[] _bountyLevels);
    event SetFeeSetter(address indexed _newFeeSetter);
    event SetPoolWithdrawalFee(uint256 indexed _pid, uint256 _newFee);
    event SetPendingBountyLevels(uint256 indexed _pid, uint256[] _bountyLevels, uint256 _timeStamp);

    event SwapAndSend(uint256 indexed _pid,
                    address indexed _beneficiary,
                    uint256 indexed _amountSwapped,
                    uint256 _amountReceived,
                    address _tokenLock);

    event SwapAndBurn(uint256 indexed _pid, uint256 indexed _amountSwapped, uint256 indexed _amountBurned);
    event SetVestingParams(uint256 indexed _pid, uint256 indexed _duration, uint256 indexed _periods);
    event SetHatVestingParams(uint256 indexed _duration, uint256 indexed _periods);

    event ApproveClaim(uint256 indexed _pid,
                    address indexed _committee,
                    address indexed _beneficiary,
                    uint256 _severity,
                    address _tokenLock,
                    ClaimBounty _claimBounty);

    event SubmitClaim(uint256 indexed _pid,
                            address _committee,
                            address indexed _beneficiary,
                            uint256 indexed _severity);

    event WithdrawRequest(uint256 indexed _pid,
                        address indexed _beneficiary,
                        uint256 indexed _withdrawEnableTime);

    event SetWithdrawSafetyPeriod(uint256 indexed _withdrawPeriod, uint256 indexed _safetyPeriod);
    event SetRewardMultipliers(uint256[24] _rewardMultipliers);
    event SetClaimFee(uint256 _fee);
    event RewardDepositors(uint256 indexed _pid, uint256 indexed _amount);
    event DepositHATReward(uint256 indexed _amount);
    event ClaimReward(uint256 indexed _pid);
    event SetWithdrawRequestParams(uint256 indexed _withdrawRequestPendingPeriod, uint256 indexed _withdrawRequestEnablePeriod);
    event DismissClaim(uint256 indexed _pid);
    event SetBountyLevelsDelay(uint256 indexed _delay);

    event RouterWhitelistStatusChanged(address indexed _router, bool _status);

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
        uint256 lastPoolUpdate = globalPoolUpdates.length-1;
        if (totalShares == 0) {
            pool.lastRewardBlock = block.number;
            pool.lastProcessedTotalAllocPoint = lastPoolUpdate;
            return;
        }
        uint256 reward = calcPoolReward(_pid, lastRewardBlock, lastPoolUpdate);
        pool.rewardPerShare = pool.rewardPerShare + (reward * 1e12 / totalShares);
        pool.lastRewardBlock = block.number;
        pool.lastProcessedTotalAllocPoint = lastPoolUpdate;
    }

    // Safe HAT transfer function, transfer HATs from the contract only if they are earmarked for rewards
    function safeTransferReward(address _to, uint256 _amount, uint256 _pid) internal {
        if (_amount > hatRewardAvailable) { 
            _amount = hatRewardAvailable; 
        }
        hatRewardAvailable -= _amount;
        HAT.transfer(_to, _amount);
        // TODO: fix return of the requested amount
        emit SafeTransferReward(_to, _pid, _amount, _amount);
    }

    /**
    * @dev Calculate rewards for a pool by iterating over the history of totalAllocPoints updates,
    * and sum up all rewards periods from pool.lastRewardBlock until current block number.
    * @param _pid The pool id
    * @param _fromBlock The block from which to start calculation
    * @param _lastPoolUpdateIndex index of last PoolUpdate in globalPoolUpdates to calculate for
    * @return reward
    */
    function calcPoolReward(uint256 _pid, uint256 _fromBlock, uint256 _lastPoolUpdateIndex) public view returns(uint256 reward) {
        uint256 poolAllocPoint = poolInfos[_pid].allocPoint;
        uint256 i = poolInfos[_pid].lastProcessedTotalAllocPoint;
        for (; i < _lastPoolUpdateIndex; i++) {
            uint256 nextUpdateBlock = globalPoolUpdates[i+1].blockNumber;
            reward =
            reward + getRewardForBlocksRange(_fromBlock,
                                            nextUpdateBlock,
                                            poolAllocPoint,
                                            globalPoolUpdates[i].totalAllocPoint);
            _fromBlock = nextUpdateBlock;
        }
        return reward + getRewardForBlocksRange(_fromBlock,
                                                block.number,
                                                poolAllocPoint,
                                                globalPoolUpdates[i].totalAllocPoint);
    }

    function getRewardForBlocksRange(uint256 _fromBlock, uint256 _toBlock, uint256 _allocPoint, uint256 _totalAllocPoint)
    public
    view
    returns (uint256 reward) {
        if (_totalAllocPoint > 0) {
            reward = getMultiplier(_fromBlock, _toBlock) * REWARD_PER_BLOCK * _allocPoint / _totalAllocPoint / 100;
        }
    }

    /**
    * @dev getMultiplier - multiply blocks with relevant multiplier for specific range
    * @param _fromBlock range's from block
    * @param _toBlock range's to block
    * will revert if from < START_BLOCK or _toBlock < _fromBlock
    */
    function getMultiplier(uint256 _fromBlock, uint256 _toBlock) public view returns (uint256 result) {
        uint256 i = (_fromBlock - START_BLOCK) / MULTIPLIER_PERIOD + 1;
        for (; i <= MULTIPLIERS_LENGTH; i++) {
            uint256 endBlock = MULTIPLIER_PERIOD * i + START_BLOCK;
            if (_toBlock <= endBlock) {
                break;
            }
            result += (endBlock - _fromBlock) * rewardMultipliers[i-1];
            _fromBlock = endBlock;
        }
        result += (_toBlock - _fromBlock) * (i > MULTIPLIERS_LENGTH ? 0 : rewardMultipliers[i-1]);
    }

    /**
    * @dev Check bounty levels.
    * Each level should be less than `HUNDRED_PERCENT`
    * If _bountyLevels length is 0, default bounty levels will be returned ([2000, 4000, 6000, 8000]).
    * @param _bountyLevels The bounty levels array
    * @return bountyLevels
    */
    function checkBountyLevels(uint256[] memory _bountyLevels)
    internal
    pure
    returns (uint256[] memory bountyLevels) {
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

    function validateSplit(BountySplit memory _bountySplit) internal pure {
        require(_bountySplit.hackerVested
            + _bountySplit.hacker
            + _bountySplit.committee
            + _bountySplit.swapAndBurn
            + _bountySplit.governanceHat
            + _bountySplit.hackerHat == HUNDRED_PERCENT,
        "HVE29");
    }

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
}