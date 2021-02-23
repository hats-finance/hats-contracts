pragma solidity ^0.7.6;
import "openzeppelin-solidity/contracts/proxy/Initializable.sol";
import "openzeppelin-solidity/contracts/access/Ownable.sol";
import "openzeppelin-solidity/contracts/token/ERC20/SafeERC20.sol";
import "./StakingRewards.sol";
import "./LpToken.sol";


// WIP WIP WIP
contract  HATVault is StakingRewards {
    using SafeMath  for uint256;
    using SafeERC20 for IERC20;

    mapping (address => bool) public claimApprovers;
    address public governance;
    uint256[][] public hackingRewardsSplit = [[90, 5, 5], [20, 5, 5], [2, 5, 5]];
    address public projectsRegistery;
    LpToken public lpToken;

    modifier onlyApprover() {
        require(claimApprovers[msg.sender], "only approver");
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

    event SetAppovers(address[] indexed _approvers, bool[] indexed _status);

    /* ========== CONSTRUCTOR ========== */
    constructor(
        address _owner,
        address _rewardsDistribution,
        address _rewardsToken,//hat
        address _stakingToken,//e.g sushi
        address _projectsRegistery,//this might be the factory
        string  memory _lpTokenName,
        string memory _lpTokenSymbol,
        address[] memory _approvers,
        address _governance
    ) public StakingRewards(_owner, _rewardsDistribution, _rewardsToken, _stakingToken) {
        projectsRegistery = _projectsRegistery;
        lpToken = new LpToken(_lpTokenName, _lpTokenSymbol, address(this));
        for (uint256 i=0; i < _approvers.length; i++) {
            claimApprovers[_approvers[i]] = true;
        }
        governance = _governance;
    }

    function approveClaim(address _beneficiary, uint256 _sevirity) external onlyApprover {
        uint256 hackingRewardAmount = _totalSupply;
        require(_sevirity < 3, "_sevirity is not in the range");

        uint256 hackerReward = hackingRewardAmount.mul(hackingRewardsSplit[_sevirity][0]).div(100);
        uint256 approverReward = hackingRewardAmount.mul(hackingRewardsSplit[_sevirity][1]).div(100);
        uint256 projectsRegisteryReward = hackingRewardAmount.mul(hackingRewardsSplit[_sevirity][2]).div(100);
        _totalSupply = _totalSupply.sub(hackerReward.add(approverReward).add(projectsRegisteryReward));
        //hacker get its reward
        stakingToken.safeTransfer(_beneficiary, hackerReward);
        //approver get its rewards
        stakingToken.safeTransfer(msg.sender, approverReward);
        //other projects get its reward ??
        stakingToken.safeTransfer(projectsRegistery, projectsRegisteryReward);
    }

    function setHackingRewardsSplit(uint256[3][] memory _hackingRewardsSplit) external onlyGovernance {
        //todo : should the hacker split rewards can be updated ?
        hackingRewardsSplit = _hackingRewardsSplit;
    }

    function setApprovers(address[] memory _claimApprovers, bool[] memory _status) external onlyApprover {
        require(_claimApprovers.length == _status.length, "wrong length");
        require(_claimApprovers.length != 0);

        for (uint256 i=0; i < _claimApprovers.length; i++) {
            claimApprovers[_claimApprovers[i]] = _status[i];
        }
        emit SetAppovers(_claimApprovers, _status);
    }

    function stakeForLpToken(uint256 _amount) external {
      //stake on stakingRewards
        stake(_amount);
        lpToken.mint(msg.sender, _amount);
    }

    function exitWithLpToken() external {
        uint256 balanceOfLpToken = lpToken.balanceOf(msg.sender);
        withdrawWithLpToken(balanceOfLpToken);
        getReward();
    }

    function withdrawWithLpToken(uint256 _amount) public {
        uint256 totalSupplyOfLPToken = lpToken.totalSupply();
        uint256 balanceOfLpToken = lpToken.balanceOf(msg.sender);
        // this will make sure that _amount is <= with user balance of lptoken.
        lpToken.burn(msg.sender, _amount);
        uint256 withdrawAmount = balanceOfLpToken.mul(_totalSupply).div(totalSupplyOfLPToken);
        withdraw(withdrawAmount);
    }

}
