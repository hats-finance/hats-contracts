// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/utils/SafeERC20.sol";


 // Wrap an ERC20 token with other ERC20 token.
contract HATVaultsTokenWrapper {
    using SafeERC20 for IERC20;

    IERC20 public immutable wrappedToken;
    address public immutable poolContract;
     constructor(address _tokenToWrap, address _poolContract) {
        wrappedToken = IERC20(_tokenToWrap);
        poolContract = _poolContract;

     }

  function transferFrom(address _sender, address _recipient, uint256 _amount) public returns (bool) {
    require(msg.sender == poolContract, "only poolContract can call transferFrom");
    require(_recipient != address(this));

    address recipient = _recipient;
    if (_recipient == poolContract) {
      recipient = address(this);
    }
    wrappedToken.safeTransferFrom(_sender, recipient, _amount);
    return true;
  }
  function transfer(address recipient, uint256 amount) public returns (bool) {
    require(msg.sender == poolContract);
    wrappedToken.safeTransfer(recipient, amount);
    return true;
  }

  function approve(address spender, uint256 amount) public returns (bool)  {
    require(msg.sender == poolContract);
    return wrappedToken.approve(spender, amount);
  }
   function balanceOf(address account) public view returns (uint256) {
      return wrappedToken.balanceOf(account);
    }

}
