// SPDX-License-Identifier: MIT
pragma solidity 0.8.14;

import "./Base.sol";

contract Params is Base {

    /**
    * @notice Set new committee address. Can be called by existing committee
    * if it had previously checked in, or by the governance otherwise.
    * @param _committee The address of the new committee 
    */
    function setCommittee(address _committee)
    external {
        if (_committee == address(0)) revert CommitteeIsZero();
        // governance can update committee only if committee was not checked in yet.
        if (msg.sender == owner() && committee != msg.sender) {
            if (committeeCheckedIn)
                revert CommitteeAlreadyCheckedIn();
        } else {
            if (committee != msg.sender) revert OnlyCommittee();
        }

        committee = _committee;

        emit SetCommittee(_committee);
    }

    /**
    * @notice Called by governance to set the vesting params for the part of
    * the bounty that the hacker gets vested in the vault's token
    * @param _duration Duration of the vesting period. Must be smaller than
    * 120 days and bigger than `_periods`
    * @param _periods Number of vesting periods. Cannot be 0.
    */
    function setVestingParams(uint256 _duration, uint256 _periods) external onlyOwner {
        if (_duration >= 120 days) revert VestingDurationTooLong();
        if (_periods == 0) revert VestingPeriodsCannotBeZero();
        if (_duration < _periods) revert VestingDurationSmallerThanPeriods();
        vestingDuration = _duration;
        vestingPeriods = _periods;
        emit SetVestingParams(_duration, _periods);
    }

    /**
    * @notice Called by governance to set the vault token bounty split upon an
    * approval.
    * Can only be called if is no active claim and not during safety periods.
    * @param _bountySplit The bounty split
    */
    function setBountySplit(BountySplit memory _bountySplit)
    external
    onlyOwner noActiveClaim noSafetyPeriod {
        validateSplit(_bountySplit);
        bountySplit = _bountySplit;
        emit SetBountySplit(_bountySplit);
    }

    /**
    * @notice Called by the fee setter to set the fee for withdrawals from the
    * vault.
    * @param _fee The new fee. Must be smaller then `MAX_FEE`
    */
    function setWithdrawalFee(uint256 _fee) external onlyFeeSetter {
        if (_fee > MAX_FEE) revert WithdrawalFeeTooBig();
        withdrawalFee = _fee;
        emit SetWithdrawalFee(_fee);
    }

    /**
    * @notice Called by the vault's committee to claim it's role.
    * Deposits are enabled only after committee check in.
    */
    function committeeCheckIn() external onlyCommittee {
        committeeCheckedIn = true;
        emit CommitteeCheckedIn();
    }

    /**
    * @notice Called by the vault's committee to set a pending request for the
    * maximum percentage of the vault that can be paid out as a bounty.
    * Cannot be called if there is an active claim that has been submitted.
    * Max bounty should be less than or equal to `HUNDRED_PERCENT`.
    * The pending value can later be set after the time delay (of 
    * HATVaultsRegistry.GeneralParameters.setMaxBountyDelay) had passed.
    * @param _maxBounty The maximum bounty percentage that can be paid out
    */
    function setPendingMaxBounty(uint256 _maxBounty)
    external
    onlyCommittee noActiveClaim {
        if (_maxBounty > HUNDRED_PERCENT)
            revert MaxBountyCannotBeMoreThanHundredPercent();
        pendingMaxBounty.maxBounty = _maxBounty;
        // solhint-disable-next-line not-rely-on-time
        pendingMaxBounty.timestamp = block.timestamp;
        emit SetPendingMaxBounty(_maxBounty, pendingMaxBounty.timestamp);
    }

    /**
    * @notice Called by the vault's committee to set the vault's max bounty to
    * the already pending max bounty.
    * Cannot be called if there are active claims that have been submitted.
    * Can only be called if there is a max bounty pending approval, and the
    * time delay since setting the pending max bounty had passed.
    */
    function setMaxBounty() external onlyCommittee noActiveClaim {
        if (pendingMaxBounty.timestamp == 0) revert NoPendingMaxBounty();

        HATVaultsRegistry.GeneralParameters memory generalParameters = registry.getGeneralParameters();

        // solhint-disable-next-line not-rely-on-time
        if (block.timestamp - pendingMaxBounty.timestamp <
            generalParameters.setMaxBountyDelay)
            revert DelayPeriodForSettingMaxBountyHadNotPassed();
        maxBounty = pendingMaxBounty.maxBounty;
        delete pendingMaxBounty;
        emit SetMaxBounty(maxBounty);
    }

    /**
    * @notice Called by the vault's committee to set the vault's reward
    * controller
    * @param _rewardController The new reward controller
    */
    function setRewardController(IRewardController _rewardController) public onlyOwner {
        rewardController = _rewardController;
        emit SetRewardController(_rewardController);
    }
}