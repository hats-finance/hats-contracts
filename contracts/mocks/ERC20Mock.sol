// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../HATVault.sol";


contract ERC20Mock is ERC20 {

    /// @notice A record of each accounts delegate
    mapping (address => address) public delegates;

    bool public approveDisableFlag;
    bool public approveZeroDisableFlag;
    bool public badTransferFlag;
    bool public reenterApproveClaim;
    bool public reenterDeposit;
    bool public reenterWithdrawRequest;
    bool public reenterWithdraw;

    constructor(
        string memory _name,
        string memory _symbol
    )
    // solhint-disable-next-line func-visibility
    ERC20(_name, _symbol) {
        approveDisableFlag = false;
        approveZeroDisableFlag = false;
        badTransferFlag = false;
    }

    function approveDisable(bool _approveDisable) external {
        approveDisableFlag = _approveDisable;
    }

    function approveZeroDisable(bool _approveZeroDisable) external {
        approveZeroDisableFlag = _approveZeroDisable;
    }

    function setBadTransferFlag(bool _badTransferFlag) external {
        badTransferFlag = _badTransferFlag;
    }

    function setReenterApproveClaim(bool _reenterApproveClaim) external {
        reenterApproveClaim = _reenterApproveClaim;
    }

    function setReenterDeposit(bool _reenterDeposit) external {
        reenterDeposit = _reenterDeposit;
    }

    function setReenterWithdrawRequest(bool _reenterWithdrawRequest) external {
        reenterWithdrawRequest = _reenterWithdrawRequest;
    }

    function setReenterWithdraw(bool _reenterWithdraw) external {
        reenterWithdraw = _reenterWithdraw;
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
        if (approveDisableFlag || (approveZeroDisableFlag && amount == 0)) {
            return false;
        }
        _approve(msg.sender, spender, amount);
        return true;
    }

    function _transfer(
        address from,
        address to,
        uint256 amount
    ) internal override {
        if (reenterApproveClaim) {
            IHATClaimsManager(msg.sender).approveClaim("", 1000, address(0));
        }

        if (reenterDeposit) {
            IHATVault(msg.sender).deposit(1, address(this));
        }

        if (reenterWithdrawRequest) {
            IHATVault(msg.sender).withdrawRequest();
        }

        if (reenterWithdraw) {
            IHATVault(msg.sender).withdraw(1, address(this), address(this));
        }

        if (badTransferFlag) {
            super._transfer(from, to, amount / 2);
        } else {
            super._transfer(from, to, amount);
        }
    }
}
