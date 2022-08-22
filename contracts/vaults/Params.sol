// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import "./Base.sol";

contract Params is Base {

    /**
    * @notice Set new committee address. Can be called by existing committee if it had checked in, or
    * by the governance otherwise.
    * @param _committee new committee address
    */
    function setCommittee(address _committee)
    external {
        // governance can update committee only if committee was not checked in yet.
        if (msg.sender == registry.owner() && committee != msg.sender) {
            if (committeeCheckedIn)
                revert CommitteeAlreadyCheckedIn();
        } else {
            if (committee != msg.sender) revert OnlyCommittee();
        }

        committee = _committee;

        emit SetCommittee(_committee);
    }

    /**
    * @notice setVestingParams - set the vesting params for rewarding a claim reporter with the vault token
    * @param _duration duration of the vesting period
    * @param _periods the vesting periods
    */
    function setVestingParams(uint256 _duration, uint256 _periods) external onlyOwner {
        _setVestingParams(_duration, _periods);
    }

    function _setVestingParams(uint256 _duration, uint256 _periods) internal {
        if (_duration >= 120 days) revert VestingDurationTooLong();
        if (_periods == 0) revert VestingPeriodsCannotBeZero();
        if (_duration < _periods) revert VestingDurationSmallerThanPeriods();
        vestingDuration = _duration;
        vestingPeriods = _periods;
        emit SetVestingParams(_duration, _periods);
    }

    /**
    * @notice Set the vault token bounty split upon an approval
    * The function can be called only by governance.
    * @param _bountySplit The bounty split
    */
    function setBountySplit(BountySplit memory _bountySplit)
    external
    onlyOwner noActiveClaim noSafetyPeriod {
        validateSplit(_bountySplit);
        bountySplit = _bountySplit;
        emit SetBountySplit(_bountySplit);
    }

    function setWithdrawalFee(uint256 _newFee) external onlyFeeSetter {
        if (_newFee > MAX_FEE) revert WithdrawalFeeTooBig();
        withdrawalFee = _newFee;
        emit SetWithdrawalFee(_newFee);
    }

    /**
    * @notice committeeCheckIn - committee check in.
    * deposit is enable only after committee check in
    */
    function committeeCheckIn() external onlyCommittee {
        committeeCheckedIn = true;
        emit CommitteeCheckedIn();
    }

    /**
    * @notice Set pending request to set vault's max bounty.
    * The function can be called only by the vault's committee.
    * Cannot be called if there are claims that have been submitted.
    * Max bounty should be less than or equal to `HUNDRED_PERCENT`
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
    * @notice Set the vault's max bounty to the already pending max bounty.
    * The function can be called only by the vault's committee.
    * Cannot be called if there are claims that have been submitted.
    * Can only be called if there is a max bounty pending approval, and the time delay since setting the pending max bounty
    * had passed.
    * Max bounty should be less than `HUNDRED_PERCENT`
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

    function setDepositPause(bool _depositPause) external onlyOwner {
        depositPause = _depositPause;

        emit SetDepositPause(_depositPause);
    }

    function setRewardController(IRewardController _newRewardController) external onlyOwner {
        rewardController = _newRewardController;
        emit SetRewardController(_newRewardController);
    }
}