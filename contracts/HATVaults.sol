// SPDX-License-Identifier: MIT
pragma solidity ^0.8.3;
import "./interfaces/IUniswapV2Router01.sol";
import "openzeppelin-solidity/contracts/token/ERC20/utils/SafeERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "./HATMaster.sol";


// WIP WIP WIP
contract  HATVaults is HATMaster {
    using SafeMath  for uint256;
    using SafeERC20 for IERC20;

    //pid -> (approver->boolean)
    mapping (uint256=>mapping(address => bool)) public committees;
    mapping(address => uint256) public swapAndBurns;
    //hackerAddress ->(token->amount)
    mapping(address => mapping(address => uint256)) public hackersHatRewards;
    address public governance;
    uint256[4] public defaultRewardsSplit = [8500, 500, 500, 400];
    uint256[] public defaultRewardLevel = [2000, 4000, 6000, 8000, 10000];
    address public projectsRegistery;
    string public vaultName;

    // Info of each pool.
    struct ClaimReward {
        uint256 hackerReward;
        uint256 approverReward;
        uint256 swapAndBurn;
        uint256 hackerHatReward;
        uint256 factor;
    }

    modifier onlyApprover(uint256 _pid) {
        require(committees[_pid][msg.sender], "only committee");
        _;
    }

    modifier onlyGovernance() {
        require(msg.sender == governance, "only governance");
        _;
    }

    event SetCommittee(uint256 indexed _pid, address[] indexed _approvers, bool[] indexed _status);

    event AddPool(uint256 indexed _pid,
                uint256 indexed _allocPoint,
                address indexed _lpToken,
                string _name,
                address[] _approvers,
                string _descriptionHash);

    event SetPool(uint256 indexed _pid,
                uint256 indexed _allocPoint,
                bool indexed _registered,
                string _descriptionHash);

    event Claim(string _descriptionHash);

    event SetRewardsSplit(uint256 indexed _pid, uint256[4] indexed _rewardsSplit);

    event SetRewardsLevels(uint256 indexed _pid, uint256[] indexed _rewardsLevels);

    event SwapAndSend(uint256 indexed _pid,
                    address indexed _beneficiary,
                    uint256 indexed _amountSwaped,
                    uint256 _amountReceived);

    event SwapAndBurn(uint256 indexed _pid,
                    uint256 indexed _amountSwaped,
                    uint256 _amountBurnet);

    IUniswapV2Router01 public immutable uniSwapRouter;

    /* ========== CONSTRUCTOR ========== */
    constructor(
        address _rewardsToken,//hat
        uint256 _rewardPerBlock,
        uint256 _startBlock,
        uint256 _halvingAfterBlock,
        address _governance,
        IUniswapV2Router01 _uniSwapRouter
    ) HATMaster(HATToken(_rewardsToken), _rewardPerBlock, _startBlock, _halvingAfterBlock) {
        governance = _governance;
        uniSwapRouter = _uniSwapRouter;
    }

    function approveClaim(uint256 _poolId, address _beneficiary, uint256 _sevirity) external onlyApprover(_poolId) {
        IERC20 lpToken = poolInfo[_poolId].lpToken;
        ClaimReward memory claimRewards = calcClaimRewards(_poolId, _sevirity);
        poolsRewards[_poolId].factor = claimRewards.factor;

        //hacker get its reward
        lpToken.safeTransfer(_beneficiary, claimRewards.hackerReward);
        //approver get its rewards
        lpToken.safeTransfer(msg.sender, claimRewards.approverReward);
        //storing the amount of token which can be swap and burned
        //so it could be swapAndBurn by any one in a seperate tx.

        swapAndBurns[address(lpToken)] = swapAndBurns[address(lpToken)].add(claimRewards.swapAndBurn);
        hackersHatRewards[_beneficiary][address(lpToken)] =
        hackersHatRewards[_beneficiary][address(lpToken)].add(claimRewards.hackerHatReward);
        poolsRewards[_poolId].pendingLpTokenRewards =
        poolsRewards[_poolId].pendingLpTokenRewards
        .add(claimRewards.swapAndBurn)
        .add(claimRewards.hackerHatReward);
    }

    //_descriptionHash - a hash of an ipfs encrypted file which describe the claim.
    // this can be use later on by the claimer to prove her claim
    function claim(string memory _descriptionHash) external {
        emit Claim(_descriptionHash);
    }

    function setRewardsSplit(uint256 _pid, uint256[4] memory _rewardsSplit)
    external
    onlyGovernance {
        //todo : should the hacker split rewards can be updated ?
        require(
            _rewardsSplit[0]+
            _rewardsSplit[1]+
            _rewardsSplit[2]+
            _rewardsSplit[3] < 10000,
        "total split % should be less than 10000");
        poolsRewards[_pid].hackerRewardSplit = _rewardsSplit[0];
        poolsRewards[_pid].approverRewardSplit = _rewardsSplit[1];
        poolsRewards[_pid].swapAndBurnSplit = _rewardsSplit[2];
        poolsRewards[_pid].hackerHatRewardSplit = _rewardsSplit[3];
        emit SetRewardsSplit(_pid, _rewardsSplit);
    }

    function setRewardsLevels(uint256 _pid, uint256[] memory _rewardsLevels)
    external
    onlyApprover(_pid) {
        if (_rewardsLevels.length == 0) {
            poolsRewards[_pid].rewardsLevels = defaultRewardLevel;
        } else {
            poolsRewards[_pid].rewardsLevels = _rewardsLevels;
        }
        emit SetRewardsLevels(_pid, _rewardsLevels);
    }

    //use also for committee checkin.
    function setCommittee(uint256 _pid, address[] memory _committee, bool[] memory _status)
    external {
        //check if commitee already checked in.
        if (msg.sender == governance && !committees[_pid][msg.sender]) {
            require(!poolsRewards[_pid].committeeCheckIn, "Committee already checked in");
        } else {
            require(committees[_pid][msg.sender], "only committee");
            poolsRewards[_pid].committeeCheckIn = true;
        }
        require(_committee.length == _status.length, "wrong length");
        require(_committee.length != 0);

        bool atLeastOneAddressIsTrue;
        for (uint256 i=0; i < _committee.length; i++) {
            committees[_pid][_committee[i]] = _status[i];
            if (!atLeastOneAddressIsTrue && _status[i]) {
                atLeastOneAddressIsTrue = true;
            }
        }
        require(atLeastOneAddressIsTrue);
        emit SetCommittee(_pid, _committee, _status);
    }

    function addPool(uint256 _allocPoint,
                    address _lpToken,
                    bool _withUpdate,
                    address[] memory _committee,
                    uint256[] memory _rewardsLevels,
                    uint256[4] memory _rewardsSplit,
                    string memory _descriptionHash)
    external
    onlyGovernance {
        add(_allocPoint, IERC20(_lpToken), _withUpdate);
        uint256 poolId = poolLength()-1;
        for (uint256 i=0; i < _committee.length; i++) {
            committees[poolId][_committee[i]] = true;
        }
        uint256[] memory rewardsLevels;
        if (_rewardsLevels.length == 0) {
            rewardsLevels = defaultRewardLevel;
        } else {
            rewardsLevels = _rewardsLevels;
        }
        uint256[4] memory rewardsSplit;
        if (_rewardsSplit[0] == 0) {
            rewardsSplit = defaultRewardsSplit;
        } else {
            rewardsSplit = _rewardsSplit;
        }

        require(rewardsSplit[0]+rewardsSplit[1]+rewardsSplit[2]+rewardsSplit[3] < 10000,
        "total split % should be less than 10000");

        poolsRewards[poolId] = PoolReward({
            rewardsLevels: rewardsLevels,
            pendingLpTokenRewards: 0,
            hackerRewardSplit: rewardsSplit[0],
            approverRewardSplit :rewardsSplit[1],
            swapAndBurnSplit: rewardsSplit[2],
            hackerHatRewardSplit: rewardsSplit[3],
            factor: 1e18,
            committeeCheckIn: false
        });

        string memory name = ERC20(_lpToken).name();

        emit AddPool(poolId, _allocPoint, address(_lpToken), name, _committee, _descriptionHash);
    }

    function setPool(uint256 _pid,
                    uint256 _allocPoint,
                    bool _withUpdate,
                    bool _registered,
                    string memory _descriptionHash)
    external onlyGovernance {
        require(poolInfo[_pid].lpToken != IERC20(address(0)), "pool does not exist");
        set(_pid, _allocPoint, _withUpdate);
        //set approver only if commite not checkin.
        emit SetPool(_pid, _allocPoint, _registered, _descriptionHash);
    }

    //swap tokens to hats and burn it.
    function swapAndBurn(uint256 _pid) external {
        IERC20 token = poolInfo[_pid].lpToken;
        uint256 amount = swapAndBurns[address(token)];
        swapAndBurns[address(token)] = 0;
        require(token.approve(address(uniSwapRouter), amount), "token approve failed");
        address[] memory path = new address[](2);
        path[0] = address(token);
        path[1] = address(HAT);
       //Swaps an exact amount of input tokens for as many output tokens as possible,
       //along the route determined by the path.
        uint256 hatBalanceBefore = HAT.balanceOf(address(this));
        uint256 hatsRecieved =
        uniSwapRouter.swapExactTokensForTokens(amount, 0, path, address(this), block.timestamp)[1];
        require(HAT.balanceOf(address(this)) == hatBalanceBefore.add(hatsRecieved), "wrong amount received");
        poolsRewards[_pid].pendingLpTokenRewards = poolsRewards[_pid].pendingLpTokenRewards.sub(amount);
        HAT.burn(hatsRecieved);
        emit SwapAndBurn(_pid, amount, hatsRecieved);
    }

    //swap tokens to hats and send to msg.sender if is entitile to.
    function swapAndSend(uint256 _pid) external {
        IERC20 token = poolInfo[_pid].lpToken;
        uint256 amount = hackersHatRewards[msg.sender][address(token)];
        require(amount > 0, "no reward for msg.sender");
        hackersHatRewards[msg.sender][address(token)] = 0;
        require(token.approve(address(uniSwapRouter), amount), "token approve failed");
        address[] memory path = new address[](2);
        path[0] = address(token);
        path[1] = address(HAT);
       //Swaps an exact amount of input tokens for as many output tokens as possible,
       //along the route determined by the path.
        uint256 hatBalanceBefore = HAT.balanceOf(address(this));
        uint256 hatsRecieved =
        uniSwapRouter.swapExactTokensForTokens(amount, 0, path, address(this), block.timestamp)[1];
        require(HAT.balanceOf(address(this)) == hatBalanceBefore.add(hatsRecieved), "wrong amount received");
        poolsRewards[_pid].pendingLpTokenRewards = poolsRewards[_pid].pendingLpTokenRewards.sub(amount);
        HAT.transfer(msg.sender, hatsRecieved);
        emit SwapAndSend(_pid, msg.sender, amount, hatsRecieved);
    }

    function getPoolRewardsLevels(uint256 _poolId) external view returns(uint256[] memory) {
        return poolsRewards[_poolId].rewardsLevels;
    }

    function getPoolRewardsPendingLpToken(uint256 _poolId) external view returns(uint256) {
        return poolsRewards[_poolId].pendingLpTokenRewards;
    }

    function getPoolRewards(uint256 _poolId) external view returns(PoolReward memory) {
        return poolsRewards[_poolId];
    }

    function calcClaimRewards(uint256 _poolId, uint256 _sevirity) public view returns(ClaimReward memory claimRewards) {
        IERC20 lpToken = poolInfo[_poolId].lpToken;
        uint256 totalSupply = lpToken.balanceOf(address(this)).sub(poolsRewards[_poolId].pendingLpTokenRewards);
        require(totalSupply > 0, "totalSupply is zero");
        require(_sevirity < poolsRewards[_poolId].rewardsLevels.length, "_sevirity is not in the range");
        //hackingRewardAmount
        uint256 claimRewardAmount = totalSupply.mul(poolsRewards[_poolId].rewardsLevels[_sevirity]).div(10000);
        //hackerReward
        claimRewards.hackerReward =
        claimRewardAmount.mul(poolsRewards[_poolId].hackerRewardSplit).div(10000);
        //approverReward
        claimRewards.approverReward =
        claimRewardAmount.mul(poolsRewards[_poolId].approverRewardSplit).div(10000);
        //swapAndBurnAmount
        claimRewards.swapAndBurn =
        claimRewardAmount.mul(poolsRewards[_poolId].swapAndBurnSplit).div(10000);
        //hackerHatReward
        claimRewards.hackerHatReward =
        claimRewardAmount.mul(poolsRewards[_poolId].hackerHatRewardSplit).div(10000);

        uint256 totalSupplyRemain = totalSupply
        .sub(claimRewards.hackerReward
        .add(claimRewards.approverReward)
        .add(claimRewards.swapAndBurn)
        .add(claimRewards.hackerHatReward));
        //factor
        claimRewards.factor = totalSupplyRemain.mul(poolsRewards[_poolId].factor).div(totalSupply);
    }
}
