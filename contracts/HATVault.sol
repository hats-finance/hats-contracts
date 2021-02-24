pragma solidity ^0.7.6;
import "openzeppelin-solidity/contracts/proxy/Initializable.sol";
import "openzeppelin-solidity/contracts/access/Ownable.sol";
import "openzeppelin-solidity/contracts/token/ERC20/SafeERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "./StakingRewards.sol";


// WIP WIP WIP
contract  HATVault is StakingRewards {
    using SafeMath  for uint256;
    using SafeERC20 for IERC20;

    mapping (address => bool) public claimApprovers;
    address public governance;
    uint256[][] public hackingRewardsSplit = [[90, 5, 5], [20, 5, 5], [2, 5, 5]];
    address public projectsRegistery;
    string public vaultName;
    mapping (address => uint256) public lpBalances;
    uint256 public lpTotalSupply;

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

    event SetApprovers(address[] indexed _approvers, bool[] indexed _status);

    /* ========== CONSTRUCTOR ========== */
    constructor(
        address _owner,
        address _rewardsDistribution,
        address _rewardsToken,//hat
        address _stakingToken,//e.g sushi
        address _projectsRegistery,//this might be the factory
        address[] memory _approvers,
        address _governance
    ) public StakingRewards(_owner, _rewardsDistribution, _rewardsToken, _stakingToken) {
        projectsRegistery = _projectsRegistery;
        vaultName = ERC20(_stakingToken).name();
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

    function setHackingRewardsSplit(uint256[] memory _hackingRewardsSplit, uint256 _sevirity) external onlyGovernance {
        //todo : should the hacker split rewards can be updated ?
        hackingRewardsSplit[_sevirity] = _hackingRewardsSplit;
    }

    function setApprovers(address[] memory _claimApprovers, bool[] memory _status) external onlyApprover {
        require(_claimApprovers.length == _status.length, "wrong length");
        require(_claimApprovers.length != 0);

        for (uint256 i=0; i < _claimApprovers.length; i++) {
            claimApprovers[_claimApprovers[i]] = _status[i];
        }
        emit SetApprovers(_claimApprovers, _status);
    }

    function stakeForLpToken(uint256 _amount) external {
      //stake on stakingRewards
        stake(_amount);
        lpBalances[msg.sender] = lpBalances[msg.sender].add(_amount);
        lpTotalSupply = lpTotalSupply.add(_amount);
    }

    function exitWithLpToken() external {
        uint256 balanceOfLpToken = lpBalances[msg.sender];
        withdrawWithLpToken(balanceOfLpToken);
        getReward();
    }

    function withdrawWithLpToken(uint256 _amount) public {
        uint256 totalSupplyOfLPToken = lpTotalSupply;
        uint256 balanceOfLpToken = lpBalances[msg.sender];
        // this will make sure that _amount is <= with user balance of lptoken.
        lpBalances[msg.sender] = lpBalances[msg.sender].sub(_amount);
        lpTotalSupply = lpTotalSupply.sub(_amount);
        uint256 withdrawAmount = balanceOfLpToken.mul(_totalSupply).div(totalSupplyOfLPToken);
        withdraw(withdrawAmount);
    }

}
