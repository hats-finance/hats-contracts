pragma solidity ^0.7.6;

import "openzeppelin-solidity/contracts/proxy/Initializable.sol";
import "openzeppelin-solidity/contracts/access/Ownable.sol";
import "openzeppelin-solidity/contracts/token/ERC20/SafeERC20.sol";
import "./HATVault.sol";


contract ProjectsRegistery is Initializable, Ownable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    event LogRegister(address indexed _vault);
    event LogUnRegister(address indexed _vault);


    //vault address to RegisteryData
    mapping(address => bool) public registery;

    function unRegister(address _vault)
    external
    onlyOwner {
        registery[_vault] = false;
        emit LogUnRegister(_vault);
    }

    /* ========== CONSTRUCTOR ========== */
    /**
    * @dev initialize takes organization name
    */
    function initialize(address _owner)
    external
    initializer {
        transferOwnership(_owner);
    }

    function vaultFactory(address _owner,
                        address _rewardsDistribution,
                        address _rewardsToken,//hat
                        address _stakingToken,//e.g sushi
                        address[] memory _approvers,
                        address _governance)
    external
    onlyOwner {
        HATVault vault = new HATVault(_owner,
                                    _rewardsDistribution,
                                    _rewardsToken,
                                    _stakingToken,
                                    address(this),
                                    _approvers,
                                    _governance);

        register(address(vault));
    }

    function swapAndBurn(address uniswap, address _token, uint256 _amount) external {
        //swap tokens to hats and burn it.
        //any one call it ...
    }

    function register(address _vault)
    public
    onlyOwner {
        registery[_vault] = true;
        emit LogRegister(_vault);
    }
}
