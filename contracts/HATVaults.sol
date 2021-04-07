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
    mapping (uint256=>mapping(address => bool)) public claimApprovers;
    mapping(address => uint256) public swapAndBurns;
    //hackerAddress ->(token->amount)
    mapping(address => mapping(address => uint256)) public hackersHatRewards;
    address public governance;
    uint256[4] public defaultRewardsSplit = [8500, 500, 500, 400];
    uint256[] public defaultRewardsLevels = [2000, 4000, 6000, 8000, 10000];
    address public projectsRegistery;
    string public vaultName;

    modifier onlyApprover(uint256 _pid) {
        require(claimApprovers[_pid][msg.sender], "only approver");
        _;
    }

    modifier onlyGovernance() {
        require(msg.sender == governance, "only governance");
        _;
    }

    modifier onlyProjectRegistery() {
        require(msg.sender == projectsRegistery, "only projectsRegistery");
        _;
    }

    event SetApprovers(uint256 indexed _pid, address[] indexed _approvers, bool[] indexed _status);

    event AddPool(uint256 indexed _pid,
                uint256 indexed _allocPoint,
                address indexed _lpToken,
                string _name,
                address[] _approvers);

    event SetPool(uint256 indexed _pid,
                uint256 indexed _allocPoint);

    event Claim(string _descriptionHash);

    event SetRewardsSplit(uint256 indexed _pid, uint256[4] indexed _rewardsSplit);

    event SetRewardsLevels(uint256 indexed _pid, uint256[] indexed _rewardsLevels);


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
        uint256[5] memory claimRewards = calcClaimRewards(_poolId, _sevirity);
        factor = claimRewards[4];

        //hacker get its reward
        lpToken.safeTransfer(_beneficiary, claimRewards[0]);
        //approver get its rewards
        lpToken.safeTransfer(msg.sender, claimRewards[1]);
        //storing the amount of token which can be swap and burned
        //so it could be swapAndBurn by any one in a seperate tx.

        swapAndBurns[address(lpToken)] = swapAndBurns[address(lpToken)].add(claimRewards[2]);
        hackersHatRewards[_beneficiary][address(lpToken)] =
        hackersHatRewards[_beneficiary][address(lpToken)].add(claimRewards[3]);
        poolsRewards[_poolId].pendingLpTokenRewards =
        poolsRewards[_poolId].pendingLpTokenRewards.add(claimRewards[2]).add(claimRewards[3]);
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
        require(_rewardsSplit[0]+_rewardsSplit[1]+_rewardsSplit[2]+_rewardsSplit[3] < 10000,
        "total split % should be less than 10000");
        poolsRewards[_pid].rewardsSplit = _rewardsSplit;
        emit SetRewardsSplit(_pid, _rewardsSplit);
    }

    function setRewardsLevels(uint256 _pid, uint256[] memory _rewardsLevels)
    external
    onlyApprover(_pid) {
        poolsRewards[_pid].rewardsLevels = _rewardsLevels;
        emit SetRewardsLevels(_pid, _rewardsLevels);
    }

    function setApprovers(uint256 _pid, address[] memory _claimApprovers, bool[] memory _status)
    external
    onlyApprover(_pid) {
        require(_claimApprovers.length == _status.length, "wrong length");
        require(_claimApprovers.length != 0);

        for (uint256 i=0; i < _claimApprovers.length; i++) {
            claimApprovers[_pid][_claimApprovers[i]] = _status[i];
        }
        emit SetApprovers(_pid, _claimApprovers, _status);
    }

    function addPool(uint256 _allocPoint,
                    address _lpToken,
                    bool _withUpdate,
                    address[] memory _approvers,
                    uint256[] memory _rewardsLevels,
                    uint256[4] memory _rewardsSplit)
    external onlyGovernance {
        add(_allocPoint, IERC20(_lpToken), _withUpdate);
        uint256 poolId = poolLength()-1;
        for (uint256 i=0; i < _approvers.length; i++) {
            claimApprovers[poolId][_approvers[i]] = true;
        }
        uint256[] memory rewardsLevels;
        if (_rewardsLevels.length == 0) {
            rewardsLevels = defaultRewardsLevels;
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

        poolsRewards[poolId].rewardsLevels = rewardsLevels;
        poolsRewards[poolId].rewardsSplit = rewardsSplit;

        string memory name = ERC20(_lpToken).name();

        emit AddPool(poolId, _allocPoint, address(_lpToken), name, _approvers);
    }

    function setPool(uint256 _pid, uint256 _allocPoint, bool _withUpdate) external onlyGovernance {
        set(_pid, _allocPoint, _withUpdate);
        emit SetPool(_pid, _allocPoint);
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
    }

    function getPoolRewardsSplit(uint256 _poolId) external view returns(uint256[4] memory) {
        return poolsRewards[_poolId].rewardsSplit;
    }

    function getPoolRewardsLevels(uint256 _poolId) external view returns(uint256[] memory) {
        return poolsRewards[_poolId].rewardsLevels;
    }

    function getPoolRewardsPendingLpToken(uint256 _poolId) external view returns(uint256) {
        return poolsRewards[_poolId].pendingLpTokenRewards;
    }

    function calcClaimRewards(uint256 _poolId, uint256 _sevirity) public view returns(uint256[5] memory rewards) {
        IERC20 lpToken = poolInfo[_poolId].lpToken;
        uint256 totalSupply = lpToken.balanceOf(address(this)).sub(poolsRewards[_poolId].pendingLpTokenRewards);
        require(totalSupply > 0, "totalSupply is zero");
        require(_sevirity < poolsRewards[_poolId].rewardsLevels.length, "_sevirity is not in the range");
        //hackingRewardAmount
        uint256 claimRewardAmount = totalSupply.mul(poolsRewards[_poolId].rewardsLevels[_sevirity]).div(10000);
        //hackerReward
        rewards[0] = claimRewardAmount.mul(poolsRewards[_poolId].rewardsSplit[0]).div(10000);
        //approverReward
        rewards[1] = claimRewardAmount.mul(poolsRewards[_poolId].rewardsSplit[1]).div(10000);
        //swapAndBurnAmount
        rewards[2] = claimRewardAmount.mul(poolsRewards[_poolId].rewardsSplit[2]).div(10000);
        //hackerHatReward
        rewards[3] = claimRewardAmount.mul(poolsRewards[_poolId].rewardsSplit[3]).div(10000);

        uint256 totalSupplyRemain = totalSupply.sub(rewards[0].add(rewards[1]).add(rewards[2]).add(rewards[3]));
        //factor
        rewards[4] = totalSupplyRemain.mul(factor).div(totalSupply);
    }
}
