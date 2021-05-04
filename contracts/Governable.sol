// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;


/**
 * @dev Contract module which provides a basic access control mechanism, where
 * there is an account (an governance) that can be granted exclusive access to
 * specific functions.
 *
 * The governance account will be passed on initialization of the contract. This
 * can later be changed with {setPendingGovernance and then transferGovernorship  after 12000 blocks}.
 *
 * This module is used through inheritance. It will make available the modifier
 * `onlyGovernance`, which can be applied to your functions to restrict their use to
 * the governance.
 */
contract Governable {
    address private _governance;
    address public governancePending;
    uint256 public setGovernancePendingAtBlock;
    uint256 public constant TIME_LOCK_DELAY_IN_BLOCKS_UNIT = 12000;


    /// @notice An event thats emitted when a new governance address is set
    event GovernorshipTransferred(address indexed _previousGovernance, address indexed _newGovernance);
    /// @notice An event thats emitted when a new governance address is pending
    event GovernancePending(address indexed _previousGovernance, address indexed _newGovernance, uint256 _atBlock);

    /**
     * @dev Throws if called by any account other than the governance.
     */
    modifier onlyGovernance() {
        require(msg.sender == _governance, "only governance");
        _;
    }

    /**
     * @dev setPendingGovernance set a pending governance address.
     * NOTE: transferGovernorship can be called after a time delay of 12000 blocks.
     */
    function setPendingGovernance(address _newGovernance) external  onlyGovernance {
        require(_newGovernance != address(0), "Governable:new governance is the zero address");
        governancePending = _newGovernance;
        setGovernancePendingAtBlock = block.number;
        emit GovernancePending(_governance, _newGovernance, block.number);
    }

    /**
     * @dev transferGovernorship transfer governorship to the pending governance address.
     * NOTE: transferGovernorship can be called after a time delay of 12000 blocks from the latest setPendingGovernance.
     */
    function transferGovernorship() external  onlyGovernance {
        require(setGovernancePendingAtBlock > 0, "Governable: no pending governance");
        require(block.number - setGovernancePendingAtBlock > TIME_LOCK_DELAY_IN_BLOCKS_UNIT,
        "Governable: cannot confirm governance at this time");
        emit GovernorshipTransferred(_governance, governancePending);
        _governance = governancePending;
        setGovernancePendingAtBlock = 0;
    }

    /**
     * @dev Returns the address of the current governance.
     */
    function governance() public view returns (address) {
        return _governance;
    }

    /**
     * @dev Initializes the contract setting the initial governance.
     */
    function initialize(address _initialGovernance) internal {
        _governance = _initialGovernance;
        emit GovernorshipTransferred(address(0), _initialGovernance);
    }
}
