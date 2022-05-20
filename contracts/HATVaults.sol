// SPDX-License-Identifier: MIT
// Disclaimer https://github.com/hats-finance/hats-contracts/blob/main/DISCLAIMER.md

pragma solidity 0.8.6;


import "./vaults/Claim.sol";
import "./vaults/Committee.sol";
import "./vaults/Deposit.sol";
import "./vaults/Params.sol";
import "./vaults/Pool.sol";
import "./vaults/Swap.sol";
import "./vaults/Getters.sol";
import "./vaults/Withdraw.sol";


// Errors:
// HVE01: Only committee
// HVE02: Claim submitted
// HVE03: Safety period
// HVE04: Beneficiary is zero
// HVE05: Not safety period
// HVE06: _severity is not in the range
// HVE07: Withdraw request pending period must be <= 3 months
// HVE08: Withdraw request enabled period must be >= 6 hour
// HVE09: Only callable by governance or after 5 weeks
// HVE10: No claim submitted
// HVE11: Amount to reward is too big
// HVE12: Withdraw period must be >= 1 hour
// HVE13: Safety period must be <= 6 hours
// HVE14: Not enough fee paid
// HVE15: Vesting duration is too long
// HVE16: Vesting periods cannot be zero
// HVE17: Vesting duration smaller than periods
// HVE18: Delay is too short
// HVE19: No pending set bounty levels
// HVE20: Delay period for setting bounty levels had not passed
// HVE21: Committee is zero
// HVE22: Committee already checked in
// HVE23: Pool does not exist
// HVE24: Amount is zero
// HVE25: Pending withdraw request exist
// HVE26: Deposit paused
// HVE27: Amount less than 1e6
// HVE28: totalSupply is zero
// HVE29: Total split % should be `HUNDRED_PERCENT`
// HVE30: Withdraw request is invalid
// HVE31: Token approve failed
// HVE32: Wrong amount received
// HVE33: Bounty level can not be more than `HUNDRED_PERCENT`
// HVE34: LP token is zero
// HVE35: Only fee setter
// HVE36: Fee must be less than or eqaul to 2%
// HVE37: Token approve reset failed
// HVE38: Pool range is too big
// HVE39: Invalid pool range
// HVE40: Committee not checked in yet
// HVE41: Not enough user balance
// HVE42: User shares must be greater than 0
// HVE43: Swap was not successful
// HVE44: Routing contract must be whitelisted


/// @title Manage all Hats.finance vaults
contract  HATVaults is Committee, Deposit, Params, Pool, Swap, Getters, Withdraw {
   /**
   * @dev constructor -
   * @param _rewardsToken The reward token address (HAT)
   * @param _rewardPerBlock The reward amount per block that the contract will reward pools
   * @param _startRewardingBlock Start block from which the contract will start rewarding
   * @param _multiplierPeriod A fixed period value. Each period will have its own multiplier value,
   *        which sets the reward for each period. e.g a value of 100000 means that each such period is 100000 blocks.
   * @param _hatGovernance The governance address.
   *        Some of the contracts functions are limited only to governance:
   *         addPool, setPool, dismissClaim, approveClaim,
   *         setHatVestingParams, setVestingParams, setRewardsSplit
   * @param _whitelistedRouters initial list of whitelisted routers allowed to be used to swap tokens for HAT token.

   * @param _tokenLockFactory Address of the token lock factory to be used
   *        to create a vesting contract for the approved claim reporter.
   */
    constructor(
        address _rewardsToken,
        uint256 _rewardPerBlock,
        uint256 _startRewardingBlock,
        uint256 _multiplierPeriod,
        address _hatGovernance,
        address[] memory _whitelistedRouters,
        ITokenLockFactory _tokenLockFactory
    // solhint-disable-next-line func-visibility
    ) {
        HAT = HATToken(_rewardsToken);
        REWARD_PER_BLOCK = _rewardPerBlock;
        START_BLOCK = _startRewardingBlock;
        MULTIPLIER_PERIOD = _multiplierPeriod;

        Governable.initialize(_hatGovernance);
        for (uint256 i = 0; i < _whitelistedRouters.length; i++) {
            whitelistedRouters[_whitelistedRouters[i]] = true;
        }
        tokenLockFactory = _tokenLockFactory;
        generalParameters = GeneralParameters({
            hatVestingDuration: 90 days,
            hatVestingPeriods:90,
            withdrawPeriod: 11 hours,
            safetyPeriod: 1 hours,
            setBountyLevelsDelay: 2 days,
            withdrawRequestEnablePeriod: 7 days,
            withdrawRequestPendingPeriod: 7 days,
            claimFee: 0
        });
    }
}
