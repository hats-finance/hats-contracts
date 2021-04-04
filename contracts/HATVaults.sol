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

    mapping (uint256=>mapping(address => bool)) public claimApprovers;
    mapping(address => uint256) public swapAndBurns;
    address public governance;
    uint256[][] public hackingRewardsSplit = [[90, 5, 4], [20, 5, 5], [2, 5, 5]];
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
        uint256 totalSupply = lpToken.balanceOf(address(this));
        require(totalSupply > 0, "totalSupply is zero");
        uint256 hackingRewardAmount = totalSupply;
        require(_sevirity < 3, "_sevirity is not in the range");

        uint256 hackerReward = hackingRewardAmount.mul(hackingRewardsSplit[_sevirity][0]).div(100);
        uint256 approverReward = hackingRewardAmount.mul(hackingRewardsSplit[_sevirity][1]).div(100);
        uint256 projectsRegisteryReward = hackingRewardAmount.mul(hackingRewardsSplit[_sevirity][2]).div(100);
        totalSupply = totalSupply.sub(hackerReward.add(approverReward).add(projectsRegisteryReward));
        factor = totalSupply.mul(factor).div(hackingRewardAmount);
        //hacker get its reward
        lpToken.safeTransfer(_beneficiary, hackerReward);
        //approver get its rewards
        lpToken.safeTransfer(msg.sender, approverReward);
        //storing the amount of token which can be swap and burned
        //so it could be swapAndBurn by any one in a seperate tx.
        swapAndBurns[address(lpToken)] = swapAndBurns[address(lpToken)].add(approverReward);
    }

    //_descriptionHash - a hash of an ipfs encrypted file which describe the claim.
    // this can be use later on by the claimer to prove her claim
    function claim(string memory _descriptionHash) external {
        emit Claim(_descriptionHash);
    }

    function setHackingRewardsSplit(uint256[] memory _hackingRewardsSplit, uint256 _sevirity) external onlyGovernance {
        //todo : should the hacker split rewards can be updated ?
        require(_hackingRewardsSplit[0]+_hackingRewardsSplit[1]+_hackingRewardsSplit[2] < 100,
        "total split % should be less than 100");
        hackingRewardsSplit[_sevirity] = _hackingRewardsSplit;
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
                    address[] memory _approvers)
    external onlyGovernance {
        add(_allocPoint, IERC20(_lpToken), _withUpdate);
        uint256 poolId = poolLength()-1;
        for (uint256 i=0; i < _approvers.length; i++) {
            claimApprovers[poolId][_approvers[i]] = true;
        }
        string memory name = ERC20(_lpToken).name();
        emit AddPool(poolId, _allocPoint, address(_lpToken), name, _approvers);
    }

    function setPool(uint256 _pid, uint256 _allocPoint, bool _withUpdate) external onlyGovernance {
        set(_pid, _allocPoint, _withUpdate);
        emit SetPool(_pid, _allocPoint);
    }

    //swap tokens to hats and burn it.
    function swapAndBurn(IERC20 _token) external {
        uint256 amount = swapAndBurns[address(_token)];
        swapAndBurns[address(_token)] = 0;
        require(_token.approve(address(uniSwapRouter), amount), "token approve failed");
        address[] memory path = new address[](2);
        path[0] = address(_token);
        path[1] = address(HAT);
       //Swaps an exact amount of input tokens for as many output tokens as possible,
       //along the route determined by the path.
        uint256 hatBalanceBefore = HAT.balanceOf(address(this));
        uint256 hatsRecieved =
        uniSwapRouter.swapExactTokensForTokens(amount, 0, path, address(this), block.timestamp)[1];
        require(HAT.balanceOf(address(this)) == hatBalanceBefore.add(hatsRecieved), "wrong amount received");
        HAT.burn(hatsRecieved);
    }
}
