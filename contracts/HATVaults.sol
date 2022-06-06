// SPDX-License-Identifier: MIT
// Disclaimer https://github.com/hats-finance/hats-contracts/blob/main/DISCLAIMER.md

pragma solidity 0.8.14;

import "./vaults/Claim.sol";
import "./vaults/Deposit.sol";
import "./vaults/Params.sol";
import "./vaults/Pool.sol";
import "./vaults/Swap.sol";
import "./vaults/Getters.sol";
import "./vaults/Withdraw.sol";

// Errors:
// HVE01: Only committee
error OnlyCommittee();
// HVE02: Active claim exists
error ActiveClaimExists();
// HVE03: Safety period
error SafetyPeriod();
// HVE04: Beneficiary is zero
error BeneficiaryIsZero();
// HVE05: Not safety period
error NotSafetyPeriod();
// HVE06: Bounty percentage is higher than the max bounty
error BountyPercentageHigherThanMaxBounty();
// HVE07: Withdraw request pending period must be <= 3 months
error WithdrawRequestPendingPeriodTooLong();
// HVE08: Withdraw request enabled period must be >= 6 hour
error WithdrawRequestEnabledPeriodTooShort();
// HVE09: Only callable by governance or after challenge timeout period
error OnlyCallableByGovernanceOrAfterChallengeTimeOutPeriod();
// HVE10: No active claim exists
error NoActiveClaimExists();
// HVE11: Amount to reward is too big
error AmountToRewardTooBig();
// HVE12: Withdraw period must be >= 1 hour
error WithdrawPeriodTooShort();
// HVE13: Safety period must be <= 6 hours
error SafetyPeriodTooLong();
// HVE14: Not enough fee paid
error NotEnoughFeePaid();
// HVE15: Vesting duration is too long
error VestingDurationTooLong();
// HVE16: Vesting periods cannot be zero
error VestingPeriodsCannotBeZero();
// HVE17: Vesting duration smaller than periods
error VestingDurationSmallerThanPeriods();
// HVE18: Delay is too short
error DelayTooShort();
// HVE19: No pending max bounty
error NoPendingMaxBounty();
// HVE20: Delay period for setting max bounty had not passed
error DelayPeriodForSettingMaxBountyHadNotPassed();
// HVE21: Committee is zero
error CommitteeIsZero();
// HVE22: Committee already checked in
error CommitteeAlreadyCheckedIn();
// HVE23: Pool does not exist
error PoolDoesNotExist();
// HVE24: Amount to swap is zero
error AmountToSwapIsZero();
// HVE25: Pending withdraw request exists
error PendingWithdrawRequestExists();
// HVE26: Deposit paused
error DepositPaused();
// HVE27: Amount less than 1e6
error AmountLessThanMinDeposit();
// HVE28: Pool balance is zero
error PoolBalanceIsZero();
// HVE29: Total bounty split % should be `HUNDRED_PERCENT`
error TotalSplitPercentageShouldBeHundredPercent();
// HVE30: Withdraw request is invalid
error InvalidWithdrawRequest();
// HVE31: Token approve failed
error TokenApproveFailed();
// HVE32: Wrong amount received
error AmountSwappedLessThenMinimum();
// HVE33: Max bounty cannot be more than `HUNDRED_PERCENT`
error MaxBountyCannotBeMoreThanHundredPercent();
// HVE34: LP token is zero
error LPTokenIsZero();
// HVE35: Only fee setter
error OnlyFeeSetter();
// HVE36: Fee must be less than or equal to 2%
error PoolWithdrawalFeeTooBig();
// HVE37: Token approve reset failed
error TokenApproveResetFailed();
// HVE38: Pool must not be initialized
error PoolMustNotBeInitialized();
error InvalidPoolRange();
// HVE39: Set shares arrays must have same length
error SetSharesArraysMustHaveSameLength();
// HVE40: Committee not checked in yet
error CommitteeNotCheckedInYet();
// HVE41: Not enough user balance
error NotEnoughUserBalance();
// HVE42: User shares must be greater than 0
error UserSharesMustBeGreaterThanZero();
// HVE43: Swap was not successful
error SwapFailed();
// HVE44: Routing contract must be whitelisted
error RoutingContractNotWhitelisted();
// HVE46: Not enough rewards to transfer to user
error NotEnoughRewardsToTransferToUser();
// HVE47: Only arbitrator
error OnlyArbitrator();
// HVE48: Claim can only be approved if challenge period is over, or if the
// caller is the arbitrator
error ClaimCanOnlyBeApprovedAfterChallengePeriodOrByArbitrator();
// HVE47: Bounty split must include hacker payout
error BountySplitMustIncludeHackerPayout();


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
    * @notice initialize -
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
        rewardToken = IERC20Upgradeable(_rewardToken);
        swapToken = ERC20BurnableUpgradeable(_swapToken);

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
        arbitrator = owner();
        challengePeriod = 3 days;
        challengeTimeOutPeriod = 5 weeks;
    }
}
