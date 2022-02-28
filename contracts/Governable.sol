// SPDX-License-Identifier: MIT

pragma solidity 0.8.6;


/**
 * @dev Contract module which provides a basic access control mechanism, where
 * there is an account (an governance) that can be granted exclusive access to
 * specific functions.
 *
 * The governance account will be passed on initialization of the contract. This
 * can later be changed with {transferGovernance}.
 *
 * This module is used through inheritance. It will make available the modifier
 * `onlyGovernance`, which can be applied to your functions to restrict their use to
 * the governance.
 */
contract Governable {
    address private _governance;


    /// @notice An event thats emitted when a new governance address is set
    event GovernorshipTransferred(address indexed _previousGovernance, address indexed _newGovernance);

    /**
     * @dev Throws if called by any account other than the governance.
     */
    modifier onlyGovernance() {
        require(msg.sender == _governance, "only governance");
        _;
    }

    /**
     * @dev transferGovernorship transfer governorship to a new governance address.
     */
    function transferGovernance(address _newGovernance) external onlyGovernance {
        require(_newGovernance != address(0), "Governable:new governance is the zero address");
        emit GovernorshipTransferred(_governance, _newGovernance);
        _governance = _newGovernance;
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
