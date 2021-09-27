// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/utils/SafeERC20.sol";


/** - user calls approve the vault on tokenwrapper
- user calls "deposit" on vault -> tokens go from token --> wrapper
- vault lp = wrapped token
-------------
- vault creates lock, calls lpToken.transfer(---)  (wrapper --> wrapper)
- lock expires --> lock calls lpToken.transfer(lock --> user, hacker, etc)

***/

contract HATVaultsTokenWrapper is ERC20 {
  using SafeERC20 for IERC20;

  IERC20 public immutable wrappedToken;
  address public immutable poolContract;

  mapping (address => bool) public stakers;
  constructor(address _tokenToWrap, address _poolContract, string memory name_, string memory symbol_) ERC20(name_, symbol_) {
    wrappedToken = IERC20(_tokenToWrap);
    poolContract = _poolContract;
  }

  function transferFrom(address _sender, address _recipient, uint256 _amount) public override returns (bool) {
    // if the recipient is the poolContract, we create new wrapped tokens, and add the sender to the list of stakers
    // if the recipient is a staker, we unwrap the tokens and send them to the staker
    // in all other cases, we just use the ERC20 transferFrom
    if (_recipient == poolContract) {
      wrappedToken.safeTransferFrom(_sender, address(this), _amount);
      _mint(_recipient, _amount);
      stakers[_sender] = true;
    } else {
      // if (stakers[_recipient]) {
      //   _burn(_sender, _amount);
      //   wrappedToken.safeTransfer(_recipient, _amount);
      // } else {
        super.transferFrom(_sender, _recipient, _amount);
      // }
    }
    return true;
  }
  function transfer(address _recipient, uint256 _amount) public override returns (bool) {
    // if recipient is a staker, we unwrap the tokens 
    // in other case, we just call the usual transfer
    if (stakers[_recipient]) {
      _burn(msg.sender, _amount);
      wrappedToken.safeTransfer(_recipient, _amount);
    } else {
      _transfer(msg.sender, _recipient, _amount);
    }
    return true;
  }
  function unwrapTokens() public {
      uint256 amount = balanceOf(msg.sender);
      _burn(msg.sender, amount);
      wrappedToken.safeTransfer(msg.sender, amount);
  }
  
}
