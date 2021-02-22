pragma solidity ^0.7.6;
pragma abicoder v2;

import "openzeppelin-solidity/contracts/proxy/Initializable.sol";
import "openzeppelin-solidity/contracts/access/Ownable.sol";
import "openzeppelin-solidity/contracts/token/ERC20/SafeERC20.sol";


contract ProjectsRegistery is Initializable, Ownable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    event LogRegister(RegisteryData indexed _registeryData);

    struct RegisteryData {
        address token;
        address represntative;
    }

    //vault address to RegisteryData
    mapping(address => RegisteryData) public registery;

    /* ========== CONSTRUCTOR ========== */
    /**
    * @dev initialize takes organization name
    */
    function initialize(address _owner)
    external
    initializer {
        transferOwnership(_owner);
    }

    function register(address _vault, IERC20 _token, address _represntative)
    external
    onlyOwner {
        require(registery[_vault].token != address(0), "msg.sender already register");
        registery[_vault] = RegisteryData(address(_token), _represntative);
        emit LogRegister(registery[_vault]);
    }

    function swapAndBurn(address uniswap, address _token, uint256 _amount) external {
        //swap tokens to hats and burn it.
        //any one call it ...
    }
}
