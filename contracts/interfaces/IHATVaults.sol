// SPDX-License-Identifier: MIT

pragma solidity 0.8.6;

interface IHATVaults {
    function isChallenged(uint256 _poolId) external;

    function approveClaim(uint256 _poolId, uint256 _severity) external;

    function dismissPendingApprovalClaim(uint256 _poolId) external;

    function pendingApprovals(uint256 _poolId) external returns(address, uint256, address, uint256);

    function getChallengePeriod() external returns (uint256);

    function committees(uint256 _poolId) external returns (address);
}