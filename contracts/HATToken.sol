// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";

contract HATToken is ERC20Votes, ERC20Capped {

    struct PendingMinter {
        uint256 seedAmount;
        uint256 setMinterPendingAt;
    }
    address public governance;
    address public governancePending;
    uint256 public setGovernancePendingAt;
    uint256 public immutable timeLockDelay;

    /// @notice Address which may mint new tokens
    /// minter -> minting seedAmount
    mapping (address => uint256) public minters;

    /// @notice Address which may mint new tokens
    /// minter -> minting seedAmount
    mapping (address => PendingMinter) public pendingMinters;

    /// @notice An event thats emitted when a new minter address is pending
    event MinterPending(address indexed minter, uint256 seedAmount, uint256 at);
    /// @notice An event thats emitted when the minter address is changed
    event MinterChanged(address indexed minter, uint256 seedAmount);
    /// @notice An event thats emitted when a new governance address is pending
    event GovernancePending(address indexed oldGovernance, address indexed newGovernance, uint256 at);
    /// @notice An event thats emitted when a new governance address is set
    event GovernanceChanged(address indexed oldGovernance, address indexed newGovernance);

    /**
     * @notice Construct a new HAT token
     */
    // solhint-disable-next-line func-visibility
    constructor(address _governance, uint256 _timeLockDelay) 
        ERC20("hats.finance", "HAT") 
        ERC20Capped(10000000e18) 
        ERC20Permit("hats.finance")
    {
        governance = _governance;
        timeLockDelay = _timeLockDelay;
    }

    function setPendingGovernance(address _governance) external {
        require(msg.sender == governance, "HAT:!governance");
        require(_governance != address(0), "HAT:!_governance");
        governancePending = _governance;
        // solhint-disable-next-line not-rely-on-time
        setGovernancePendingAt = block.timestamp;
        emit GovernancePending(governance, _governance, setGovernancePendingAt);
    }

    function confirmGovernance() external {
        require(msg.sender == governance, "HAT:!governance");
        require(setGovernancePendingAt > 0, "HAT:!governancePending");
        // solhint-disable-next-line not-rely-on-time
        require(block.timestamp - setGovernancePendingAt > timeLockDelay,
        "HAT: cannot confirm governance at this time");
        emit GovernanceChanged(governance, governancePending);
        governance = governancePending;
        setGovernancePendingAt = 0;
    }

    function setPendingMinter(address _minter, uint256 _cap) external {
        require(msg.sender == governance, "HAT::!governance");
        pendingMinters[_minter].seedAmount = _cap;
        // solhint-disable-next-line not-rely-on-time
        pendingMinters[_minter].setMinterPendingAt = block.timestamp;
        emit MinterPending(_minter, _cap, pendingMinters[_minter].setMinterPendingAt);
    }

    function confirmMinter(address _minter) external {
        require(msg.sender == governance, "HAT::mint: only the governance can confirm minter");
        require(pendingMinters[_minter].setMinterPendingAt > 0, "HAT:: no pending minter was set");
        // solhint-disable-next-line not-rely-on-time
        require(block.timestamp - pendingMinters[_minter].setMinterPendingAt > timeLockDelay,
        "HATToken: cannot confirm at this time");
        minters[_minter] = pendingMinters[_minter].seedAmount;
        pendingMinters[_minter].setMinterPendingAt = 0;
        emit MinterChanged(_minter, pendingMinters[_minter].seedAmount);
    }

    function burn(uint256 _amount) external {
        return _burn(msg.sender, _amount);
    }

    function mint(address _account, uint _amount) external {
        require(minters[msg.sender] >= _amount, "HATToken: amount greater than limitation");
        minters[msg.sender] -= _amount;
        _mint(_account, _amount);
    }


    function _afterTokenTransfer(address from, address to, uint256 amount) internal override(ERC20, ERC20Votes) {
       super._afterTokenTransfer(from, to, amount);
    }

    function _burn(address account, uint256 amount) internal override(ERC20, ERC20Votes) {
        super._burn(account, amount);
    }

    function _mint(address account, uint256 amount) internal override(ERC20Votes, ERC20Capped) {
        super._mint(account, amount);
    }

}
