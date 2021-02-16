pragma solidity ^0.7.6;
import "openzeppelin-solidity/contracts/proxy/Initializable.sol";
import "openzeppelin-solidity/contracts/access/Ownable.sol";
import "openzeppelin-solidity/contracts/token/ERC20/SafeERC20.sol";
import "./StakingRewards.sol";


// WIP WIP WIP
contract  HATVault is StakingRewards {
    using SafeMath  for uint256;
    using SafeERC20 for IERC20;

    mapping (address => bool) public claimApprovers;
    address public governance;
    uint256[] public hackingRewardsSplit = [90, 5, 5];
    address public projectsRegistery;

    modifier onlyApprover() {
        require(claimApprovers[msg.sender], "only approver");
        _;
    }

    modifier onlyGovernance() {
        require(msg.sender == governance, "only governance");
        _;
    }

    /* ========== CONSTRUCTOR ========== */
    constructor(
        address _owner,
        address _rewardsDistribution,
        address _rewardsToken,
        address _stakingToken,
        address _projectsRegistery
    ) public StakingRewards(_owner, _rewardsDistribution, _rewardsToken, _stakingToken) {
        projectsRegistery = _projectsRegistery;
    }

    function approveClaim(address _beneficiary) external onlyApprover {
        uint256 hackingRewardAmount = _totalSupply;
        _totalSupply = 0;
        //hacker get its reward
        stakingToken.safeTransfer(_beneficiary, hackingRewardAmount.mul(hackingRewardsSplit[0]).div(100));
        //approver get its reward
        stakingToken.safeTransfer(msg.sender, hackingRewardAmount.mul(hackingRewardsSplit[1]).div(100));
        //other projects get its reward ??
        stakingToken.safeTransfer(projectsRegistery, hackingRewardAmount.mul(hackingRewardsSplit[2]).div(100));
    }

    function setHackingRewardsSplit(uint256[3] memory _hackingRewardsSplit) external onlyGovernance {
        hackingRewardsSplit = _hackingRewardsSplit;
    }
}
