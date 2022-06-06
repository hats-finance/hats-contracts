// SPDX-License-Identifier: MIT
// Disclaimer https://github.com/hats-finance/hats-contracts/blob/main/DISCLAIMER.md

pragma solidity 0.8.14;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "./vaults/Claim.sol";
import "./vaults/Deposit.sol";
import "./vaults/Params.sol";
import "./vaults/Pool.sol";
import "./vaults/Swap.sol";
import "./vaults/Getters.sol";
import "./vaults/Withdraw.sol";

// Errors:
// HVE01: Only committee
// HVE02: Active claim exists
// HVE03: Safety period
// HVE04: Beneficiary is zero
// HVE05: Not safety period
// HVE06: reward percentage is higher than the max bounty
// HVE07: Withdraw request pending period must be <= 3 months
// HVE08: Withdraw request enabled period must be >= 6 hour
// HVE09: Only callable by governance or after 5 weeks
// HVE10: No active claim exists
// HVE11: Amount to reward is too big
// HVE12: Withdraw period must be >= 1 hour
// HVE13: Safety period must be <= 6 hours
// HVE14: Not enough fee paid
// HVE15: Vesting duration is too long
// HVE16: Vesting periods cannot be zero
// HVE17: Vesting duration smaller than periods
// HVE18: Delay is too short
// HVE19: No pending max bounty
// HVE20: Delay period for setting max bounty had not passed
// HVE21: Committee is zero
// HVE22: Committee already checked in
// HVE23: Pool does not exist
// HVE24: Amount to swap is zero
// HVE25: Pending withdraw request exist
// HVE26: Deposit paused
// HVE27: Amount less than 1e6
// HVE28: totalSupply is zero
// HVE29: Total split % should be `HUNDRED_PERCENT`
// HVE30: Withdraw request is invalid
// HVE31: Token approve failed
// HVE32: Wrong amount received
// HVE33: Max bounty cannot be more than `HUNDRED_PERCENT`
// HVE34: LP token is zero
// HVE35: Only fee setter
// HVE36: Fee must be less than or equal to 2%
// HVE37: Token approve reset failed
// HVE38: Pool must not be initialized
// HVE39: Set shares arrays must have same length
// HVE40: Committee not checked in yet
// HVE41: Not enough user balance
// HVE42: User shares must be greater than 0
// HVE43: Swap was not successful
// HVE44: Routing contract must be whitelisted
// HVE45: Not enough HATs for swap
// HVE46: Not enough rewards to transfer to user

/// @title Manage all Hats.finance vaults
/// Hats.finance is a proactive bounty protocol for white hat hackers and
/// auditors, where projects, community members, and stakeholders incentivize
/// protocol security and responsible disclosure.
/// Hats create scalable vaults using the project’s own token. The value of the
/// bounty increases with the success of the token and project.
/// This project is open-source and can be found on:
/// https://github.com/hats-finance/hats-contracts
contract HATVaults is Claim, Deposit, Params, Pool, Swap, Getters, Withdraw {
    /**
    * @dev initialize -
    * @param _rewardToken The reward token address 
    * @param _hatGovernance The governance address.
    * Some of the contracts functions are limited only to governance:
    * addPool, setPool, dismissClaim, approveClaim, setHatVestingParams,
    * setVestingParams, setRewardsSplit
    * @param _swapToken the token that part of a payout will be swapped for
    * and burned - this would typically be HATs
    * @param _whitelistedRouters initial list of whitelisted routers allowed to
    * be used to swap tokens for HAT token.
    * @param _tokenLockFactory Address of the token lock factory to be used
    *        to create a vesting contract for the approved claim reporter.
    * @param _rewardController Address of the reward controller to be used to
    * manage the reward distribution.
    */
    function initialize(
        address _rewardToken,
        address _hatGovernance,
        address _swapToken,
        address[] memory _whitelistedRouters,
        ITokenLockFactory _tokenLockFactory,
        RewardController _rewardController
    ) external initializer {
        __ReentrancyGuard_init();
        _transferOwnership(_hatGovernance);
        rewardToken = IERC20(_rewardToken);
        swapToken = ERC20Burnable(_swapToken);

        for (uint256 i = 0; i < _whitelistedRouters.length; i++) {
            whitelistedRouters[_whitelistedRouters[i]] = true;
        }
        tokenLockFactory = _tokenLockFactory;
        generalParameters = GeneralParameters({
            hatVestingDuration: 90 days,
            hatVestingPeriods: 90,
            withdrawPeriod: 11 hours,
            safetyPeriod: 1 hours,
            setMaxBountyDelay: 2 days,
            withdrawRequestEnablePeriod: 7 days,
            withdrawRequestPendingPeriod: 7 days,
            claimFee: 0
        });
        setRewardController(_rewardController);
    }
}
