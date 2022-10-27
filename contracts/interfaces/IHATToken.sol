// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import "@openzeppelin/contracts/governance/utils/IVotes.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/draft-IERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IHATToken is IVotes, IERC20Permit {

    struct PendingMinter {
        uint256 seedAmount;
        uint256 setMinterPendingAt;
    }
    
    // Only committee
    error OnlyGovernance();

    /// @notice An event thats emitted when a new minter address is pending
    event MinterPending(address indexed minter, uint256 seedAmount, uint256 at);
    /// @notice An event thats emitted when the minter address is changed
    event MinterChanged(address indexed minter, uint256 seedAmount);
    /// @notice An event thats emitted when a new governance address is pending
    event GovernancePending(address indexed oldGovernance, address indexed newGovernance, uint256 at);
    /// @notice An event thats emitted when a new governance address is set
    event GovernanceChanged(address indexed oldGovernance, address indexed newGovernance);

    function setPendingGovernance(address _governance) external;

    function confirmGovernance() external;

    function setPendingMinter(address _minter, uint256 _cap) external;

    function confirmMinter(address _minter) external;

    function burn(uint256 _amount) external;

    function mint(address _account, uint _amount) external;

}
