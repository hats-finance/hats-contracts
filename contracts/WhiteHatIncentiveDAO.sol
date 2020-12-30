pragma solidity 0.7.6;

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/SafeERC20.sol";
import "openzeppelin-solidity/contracts/proxy/Initializable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./DAOToken.sol";


// @title WhiteHatIncentiveDAO, a dao to incentivies white hat hackers to audit and collaborate
contract WhiteHatIncentiveDAO is Initializable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    struct Claim {
      // 1 - submitted
      // 2 - approval 1
      // 3 - approval 2
      // 4 - approval 3
        uint256 status;
        address claimer;
    }

    DAOToken public daoToken;
    address public governance;
    uint256 public claimCounter;

    uint256[] public rewards;

    mapping (address => mapping(address => uint256)) public stakes; //tokenAddr to user to stake amount
    mapping (address => uint256) public tokenTotalStaked; //tokenAddr to user to stake amount
    //claimId to Claim
    mapping (uint256 => Claim) public claims;
    // lptoken to project address
    mapping (address => address) public projectsRegistery;
    //for now we will have same approvers for all projects
    mapping (address => bool) public approvers;

    event ClaimSubmited(address claimer, string _descriptionHash);

    // Modifiers:
    modifier onlyGovernance() {
        require(msg.sender == governance, "only governance");
        _;
    }

    modifier onlyApprover() {
        require(approvers[msg.sender], "only approver");
        _;
    }

    /**
    * @dev initialize takes organization name
    */
    function initialize(DAOToken _daoToken,
                        address _governance,
                        uint256[3] calldata _rewards)
    external
    initializer {
        daoToken = _daoToken;
        governance = _governance;
        rewards = _rewards;
    }

    /**
     * @dev stake - mint daoToken for staking lptoken
     * @param _lptoken liquidity provider token
     * @param _amount The amount of stake tokens
     */
    function stake(IERC20 _lptoken, uint256 _amount) external {
        require(_amount != 0);
        stakes[address(_lptoken)][msg.sender] = stakes[address(_lptoken)][msg.sender].add(_amount);
        tokenTotalStaked[address(_lptoken)] = tokenTotalStaked[address(_lptoken)].add(_amount);
        _lptoken.safeTransferFrom(msg.sender, address(this), _amount);
        uint256 amountOfDAOTokenToMint = calculateDAOTokenToMint(address(_lptoken), msg.sender);
        daoToken.mint(msg.sender, amountOfDAOTokenToMint);
    }

    /**
     * @dev stake - mint daoToken for staking lptoken
     * @param _lptoken liquidity provider token
     */
    function redeemStake(IERC20 _lptoken) external {
        uint256 stakerBalance = stakes[address(_lptoken)][msg.sender];
        require(stakerBalance != 0, "no balance");
        tokenTotalStaked[address(_lptoken)] = tokenTotalStaked[address(_lptoken)].sub(stakerBalance);
        _lptoken.safeTransfer(msg.sender, stakerBalance);
    }

    /**
     * @dev _claimId - approve claim
     * @param _claimId claimId
     */
    function approveClaim(uint256 _claimId) external onlyApprover {
        require(claims[_claimId].status > 0, "claim not exist");
        require(claims[_claimId].status <= 3, "claim already been approved");
        claims[_claimId].status += 1;
        uint256 rewardPercentage = calculateRewardsForApproval(_claimId);
        //send the hacker dao tokens
        //do uniswap to swap ..to whi first..now it exposed ?!
        IERC20(daoToken).safeTransfer(msg.sender, daoToken.balanceOf(address(this)).mul(rewardPercentage).div(100));
    }

    // /**
    // * @dev perform a generic call to an arbitrary contract
    // * @param _contract  the contract's address to call
    // * @param _data ABI-encoded contract call to call `_contract` address.
    // * @param _value value (ETH) to transfer with the transaction
    // */
    // function hack(
    //     address _contract,
    //     bytes memory _data,
    //     uint256 _value,
    //     IERC20 _claimToken)
    // {
    //     bytes memory genericCallReturnValue;
    //     bool success;
    //     uint256 currentBalance = _claimToken.balanceOf(address(this));
    //     // solhint-disable-next-line avoid-call-value
    //     (success, genericCallReturnValue) = _contract.call{value:_value}(_data);
    //     require(success, "transaction reverted on the targer contract");
    //     uint256 hackedTokensAmount = _claimToken.balanceOf(address(this)).sub(currentBalance);
    //     //send hacker the staked whi worth in _claimToken
    //     //do uniswap
    //     tokenTotalStaked[_claimToken] = tokenTotalStaked[_claimToken].sub(currentBalance);
    //     daoToken.transfer(msg.sender, currentBalance);
    //     //send hacked project the diff
    //     _claimToken.transfer(projectsRegistery[_claimToken], hackedTokensAmount);
    // }
    function registerProject(address _projectAddress, address _lptoken) public onlyGovernance {
        projectsRegistery[_lptoken] = _projectAddress;
    }

    function setRewards(uint256[] memory _rewards) public onlyGovernance {
        rewards = _rewards;
    }

    function setApprover(address _approver) public onlyGovernance {
        approvers[_approver] = true;
    }

    function removeApprover(address _approver) public onlyGovernance {
        approvers[_approver] = false;
    }

    /**
     * @dev submitClaim - claim for a potential hack
     * @param _descriptionHash the hackDescription
     * @return claimId
     */
    function submitClaim(string memory _descriptionHash) public returns(uint256 claimId) {
        claimCounter += 1;
        claimId = claimCounter;
        claims[claimId].status = 1;
        claims[claimId].claimer = msg.sender;
        emit ClaimSubmited(msg.sender, _descriptionHash);
    }

    function calculateDAOTokenToMint(address _token, address _staker) public view returns (uint256) {
        //call to uniswap and do some math.. what is the formula?
        // for now will return 1 to 1.
        return stakes[_token][_staker];
    }

    //calculateRewardsForApproval in percentages
    function calculateRewardsForApproval(uint256 _claimId) public view returns(uint256) {
        return rewards[claims[_claimId].status-1];
    }
}
