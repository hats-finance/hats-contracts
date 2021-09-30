// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/utils/SafeERC20.sol";


/** 
ERC20 Token Wrapper is a custom wrapper contract that is meant to work toegether with the HatVaults pool contract.

It has two types of accounts:

- "normal" accounts that can send and receive wrapper tokens
- "transparent" accounts: if tokens are transfered to these accounts, they are automatically unwrapped

The only way to create a transparent account, and the only way to wrap tokens, by transfering tokens to the poolContract, by calling a method on the poolContrat (e.g. when calling the deposit function on the pool contract)
***/

contract HATVaultsTokenWrapper is ERC20 {
  using SafeERC20 for IERC20;

  IERC20 public immutable wrappedToken;
  address public immutable poolContract;

  mapping (address => bool) public transparentAccounts;
  constructor(address _tokenToWrap, address _poolContract, string memory name_, string memory symbol_) 
    ERC20(name_, symbol_) {
    wrappedToken = IERC20(_tokenToWrap);
    poolContract = _poolContract;
  }

  function transferFrom(address _sender, address _recipient, uint256 _amount) public override returns (bool) {
    if (_recipient == poolContract && msg.sender == poolContract) {
      transparentAccounts[_sender] = true;
      wrappedToken.safeTransferFrom(_sender, address(this), _amount);
      _mint(_recipient, _amount);
    } else {
      super.transferFrom(_sender, _recipient, _amount);
    }
    return true;
  }
  function _transfer(address _sender, address _recipient, uint256 _amount) internal override {
    if (transparentAccounts[_recipient]) {
      _unwrapTokensFor(_sender, _recipient, _amount);
    } else {
      super._transfer(_sender, _recipient, _amount);
    }
  }

  function _unwrapTokensFor(address _sender, address _recipient, uint256 _amount) private {
      _burn(_sender, _amount);
      wrappedToken.safeTransfer(_recipient, _amount);
  }
  function unwrapTokens() public {
      uint256 amount = balanceOf(msg.sender);
      _unwrapTokensFor(msg.sender, msg.sender, amount);
  }
}
