// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";


contract ERC20Mock is ERC20 {

    /// @notice A record of each accounts delegate
    mapping (address => address) public delegates;

    bool public approveDisableFlag;
    uint8 public tokenDecimals;

    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _decimals
    )
    // solhint-disable-next-line func-visibility
    ERC20(_name, _symbol) {
        approveDisableFlag = false;
        tokenDecimals = _decimals;
    }

    function decimals() public view override returns (uint8) {
        return tokenDecimals;
    }

    function approveDisable(bool _approveDisable) external {
        approveDisableFlag = _approveDisable;
    }

    function mint(address _to, uint256 _amount) public {
        _mint(_to, _amount);
    }

    /**
     * @notice Delegate votes from `msg.sender` to `delegatee`
     * @param delegatee The address to delegate votes to
     */
    function delegate(address delegatee) public {
        delegates[msg.sender] = delegatee;
    }

    function approve(address spender, uint256 amount) public virtual override returns (bool) {
        require(!approveDisableFlag, "approve fail");
        _approve(msg.sender, spender, amount);
        return true;
    }

}
