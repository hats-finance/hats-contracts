// SPDX-License-Identifier: MIT
pragma solidity ^0.8.3;

import "./TokenLock.sol";
import "../HATToken.sol";


contract HATTokenLock is TokenLock {

    // Initializer
    function initialize(
        address _owner,
        address _beneficiary,
        HATToken _token,
        uint256 _managedAmount,
        uint256 _startTime,
        uint256 _endTime,
        uint256 _periods,
        uint256 _releaseStartTime,
        uint256 _vestingCliffTime,
        Revocability _revocable
    ) external {
        _initialize(
            _owner,
            _beneficiary,
            address(_token),
            _managedAmount,
            _startTime,
            _endTime,
            _periods,
            _releaseStartTime,
            _vestingCliffTime,
            _revocable
        );
        _token.delegate(_beneficiary);
    }

    /// @dev delegate voting power
    /// @param _delegatee Address of delegatee
    function delegate(address _delegatee)
        external
        onlyBeneficiary
    {
        HATToken(address(token)).delegate(_delegatee);
    }
}
