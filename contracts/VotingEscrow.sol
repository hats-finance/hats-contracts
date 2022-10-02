// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./interfaces/IVotingEscrow.sol";

interface IVotingEscrowCallback {
    function syncWithVotingEscrow(address account) external;
}

contract VotingEscrow is IVotingEscrow, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    string public name;
    string public symbol;
    uint8 public constant decimals = 18;

    /// @notice The limit on the maximum duration of locks allowed
    /// @dev This value is used in calculations of voting power
    uint256 public immutable MAX_TIME;

    /// @notice The token that is being locked
    IERC20 public immutable HAT;

    /// @notice Mapping of account addresses to their locked balances
    mapping(address => LockedBalance) public locked;

    /// @notice Mapping of unlockTime => total amount that will be unlocked at unlockTime
    mapping(uint256 => uint256) public scheduledUnlock;

    /// @notice Max lock duration allowed at the moment
    uint256 public currentMaxTime;

    /// @notice Contract to be call when an account's locked HAT is updated
    address public callback;

    /// @notice Amount of Hats locked now. Expired locks are not included.
    uint256 public totalLocked;

    /// @notice Total veHAT at the end of the last checkpoint's week
    uint256 public nextWeekSupply;

    /// @notice Mapping of week => vote-locked HAT total supplies
    ///
    ///         Key is the start timestamp of a week on each Thursday. Value is
    ///         vote-locked HAT total supplies captured at the start of each week
    mapping(uint256 => uint256) public veSupplyPerWeek;

    /// @notice Start timestamp of the trading week in which the last checkpoint is made
    uint256 public checkpointWeek;

    /// @notice Mapping of address => true if the address is a whitelisted contract address
    mapping(address => bool) public whitelistedContracts;

    constructor(
        address _HAT,
        string memory name_,
        string memory symbol_,
        uint256 maxTime_,
        uint256 currentMaxTime_
    ) {
        if (currentMaxTime_ > maxTime_) revert CurrentMaxTimeCannotExceedMaxTime();

        HAT = IERC20(_HAT);
        // TODO: Might need to check maxTime is an end of a week
        MAX_TIME = maxTime_;
        currentMaxTime = currentMaxTime_;
        name = name_;
        symbol = symbol_;
        checkpointWeek = _endOfWeek(block.timestamp) - 1 weeks;
    }

    function getTimestampDropBelow(address _account, uint256 _threshold)
        external
        view
        returns (uint256)
    {
        LockedBalance memory lockedBalance = locked[_account];
        if (lockedBalance.amount == 0 || lockedBalance.amount < _threshold) {
            return 0;
        }
        return lockedBalance.unlockTime - (_threshold * MAX_TIME / lockedBalance.amount);
    }

    function balanceOf(address _account) external view override returns (uint256) {
        return _balanceOfAtTimestamp(_account, block.timestamp);
    }

    function totalSupply() external view override returns (uint256) {
        uint256 weekCursor = checkpointWeek;
        uint256 endOfCurrentWeek = _endOfWeek(block.timestamp);
        uint256 startOfCurrentWeek = endOfCurrentWeek - 1 weeks;
        uint256 newNextWeekSupply = nextWeekSupply;
        uint256 newTotalLocked = totalLocked;
        if (weekCursor < startOfCurrentWeek) {
            weekCursor += 1 weeks;
            for (; weekCursor < startOfCurrentWeek; weekCursor += 1 weeks) {
                // Remove HAT unlocked at the beginning of the next week from total locked amount.
                newTotalLocked -= scheduledUnlock[weekCursor];
                // Calculate supply at the end of the next week.
                newNextWeekSupply -= newTotalLocked * 1 weeks / MAX_TIME;
            }
            newTotalLocked -= scheduledUnlock[weekCursor];
            newNextWeekSupply -= newTotalLocked * (block.timestamp - startOfCurrentWeek) / MAX_TIME;
        } else {
            newNextWeekSupply += newTotalLocked * (endOfCurrentWeek - block.timestamp) / MAX_TIME;
        }

        return newNextWeekSupply;
    }

    function getLockedBalance(address _account)
        external
        view
        override
        returns (LockedBalance memory)
    {
        return locked[_account];
    }

    function balanceOfAtTimestamp(address _account, uint256 _timestamp)
        external
        view
        override
        returns (uint256)
    {
        return _balanceOfAtTimestamp(_account, _timestamp);
    }

    function totalSupplyAtTimestamp(uint256 _timestamp) external view returns (uint256) {
        return _totalSupplyAtTimestamp(_timestamp);
    }

    function createLock(uint256 _amount, uint256 _unlockTime) external nonReentrant {
        if (msg.sender != tx.origin && !whitelistedContracts[msg.sender])
            revert OnlyEOAOrWhitelistedContractsAllowed();
        // TODO round instead of require?
        require(
            _unlockTime + 1 weeks == _endOfWeek(_unlockTime),
            "Unlock time must be end of a week"
        );

        LockedBalance memory lockedBalance = locked[msg.sender];

        if (_amount == 0) revert AmountCannotBeZero();
        if (lockedBalance.amount != 0) revert MustWithdrawBeforeCreatingNewLock();
        if (_unlockTime <= block.timestamp) revert UnlockTimeMustBeInTheFuture();
        if (_unlockTime > block.timestamp + currentMaxTime) revert CannotExceedCurrentMaxLockDuration();

        _checkpoint(lockedBalance.amount, lockedBalance.unlockTime, _amount, _unlockTime);
        scheduledUnlock[_unlockTime] += _amount;
        locked[msg.sender].unlockTime = _unlockTime;
        locked[msg.sender].amount = _amount;

        HAT.safeTransferFrom(msg.sender, address(this), _amount);

        if (callback != address(0)) {
            IVotingEscrowCallback(callback).syncWithVotingEscrow(msg.sender);
        }

        emit LockCreated(msg.sender, _amount, _unlockTime);
    }

    function increaseAmount(address _account, uint256 _amount) external nonReentrant {
        LockedBalance memory lockedBalance = locked[_account];

        if (_amount == 0) revert AmountCannotBeZero();
        if (lockedBalance.unlockTime <= block.timestamp) revert LockHasExpired();

        uint256 newAmount = lockedBalance.amount + _amount;
        _checkpoint(
            lockedBalance.amount,
            lockedBalance.unlockTime,
            newAmount,
            lockedBalance.unlockTime
        );
        scheduledUnlock[lockedBalance.unlockTime] += _amount;
        locked[_account].amount = newAmount;

        HAT.safeTransferFrom(msg.sender, address(this), _amount);

        if (callback != address(0)) {
            IVotingEscrowCallback(callback).syncWithVotingEscrow(msg.sender);
        }

        emit AmountIncreased(_account, _amount);
    }

    function increaseUnlockTime(uint256 _unlockTime) external nonReentrant {
        // TODO round instead of require?
        require(
            _unlockTime + 1 weeks == _endOfWeek(_unlockTime),
            "Unlock time must be end of a week"
        );
        LockedBalance memory lockedBalance = locked[msg.sender];

        if (lockedBalance.unlockTime <= block.timestamp) revert LockHasExpired();
        if (_unlockTime <= lockedBalance.unlockTime) revert CanOnlyExtendLock();
        if (_unlockTime > block.timestamp + currentMaxTime) revert CannotExceedCurrentMaxLockDuration();

        _checkpoint(
            lockedBalance.amount,
            lockedBalance.unlockTime,
            lockedBalance.amount,
            _unlockTime
        );
        scheduledUnlock[lockedBalance.unlockTime] -= lockedBalance.amount;
        scheduledUnlock[_unlockTime] += lockedBalance.amount;
        locked[msg.sender].unlockTime = _unlockTime;

        if (callback != address(0)) {
            IVotingEscrowCallback(callback).syncWithVotingEscrow(msg.sender);
        }

        emit UnlockTimeIncreased(msg.sender, _unlockTime);
    }

    function withdraw() external nonReentrant {
        LockedBalance memory lockedBalance = locked[msg.sender];
        if (block.timestamp < lockedBalance.unlockTime) revert LockHasNotExpired();
        uint256 amount = uint256(lockedBalance.amount);

        lockedBalance.unlockTime = 0;
        lockedBalance.amount = 0;
        locked[msg.sender] = lockedBalance;

        HAT.safeTransfer(msg.sender, amount);

        emit Withdrawn(msg.sender, amount);
    }

    function calibrateSupply() external {
        uint256 nextWeek = checkpointWeek + 1 weeks;
        nextWeekSupply = _totalSupplyAtTimestamp(nextWeek);
    }

    function updateCallback(address _newCallback) external onlyOwner {
        if(_newCallback != address(0) && !Address.isContract(_newCallback))
            revert NewCallbackMustBeNullOrContract();
        callback = _newCallback;
    }

    function setCurrentMaxTime(uint256 _newMaxTime) external onlyOwner {
        if (currentMaxTime_ > MAX_TIME) revert CurrentMaxTimeCannotExceedMaxTime();
        if (_newMaxTime <= currentMaxTime) revert CanOnlyIncreaseCurrentMaxTime();
        currentMaxTime = _newMaxTime;
    }

    //TODO whould we want a removeWhitelistedContracts?
    function addWhitelistedContracts(address[] calldata _whitelistedContracts) external onlyOwner {
        for (uint256 i = 0; i < _whitelistedContracts.length; i++) {
            if (!Address.isContract(_whitelistedContracts[i])) revert OnlyContractsCanBeWhitelisted();
            whitelistedContracts[_whitelistedContracts[i]] = true;
        } 
    }

    function _balanceOfAtTimestamp(address _account, uint256 _timestamp)
        private
        view
        returns (uint256)
    {
        if (_timestamp < block.timestamp) revert CannotQueryPastBalance();
        LockedBalance memory lockedBalance = locked[_account];
        if (_timestamp > lockedBalance.unlockTime) {
            return 0;
        }
        return (lockedBalance.amount * (lockedBalance.unlockTime - _timestamp)) / MAX_TIME;
    }

    function _totalSupplyAtTimestamp(uint256 _timestamp) private view returns (uint256) {
        uint256 weekCursor = _endOfWeek(_timestamp);
        uint256 total = 0;
        for (; weekCursor <= _timestamp + MAX_TIME; weekCursor += 1 weeks) {
            total += scheduledUnlock[weekCursor] * (weekCursor - _timestamp) / MAX_TIME;
        }
        return total;
    }

    /// @dev UTC time of a day when the fund settles.
    uint256 internal constant SETTLEMENT_TIME = 14 hours;

    /// @dev Return end timestamp of the trading week containing a given timestamp.
    ///
    ///      A trading week starts at UTC time `SETTLEMENT_TIME` on a Thursday (inclusive)
    ///      and ends at the same time of the next Thursday (exclusive).
    /// @param _timestamp The given timestamp
    /// @return End timestamp of the trading week.
    function _endOfWeek(uint256 _timestamp) internal pure returns (uint256) {
        return ((_timestamp + 1 weeks - SETTLEMENT_TIME) / 1 weeks) * 1 weeks + SETTLEMENT_TIME;
    }

    /// @dev Pre-conditions:
    ///
    ///      - `newAmount > 0`
    ///      - `newUnlockTime > block.timestamp`
    ///      - `newUnlockTime + 1 weeks == _endOfWeek(newUnlockTime)`, i.e. aligned to a trading week
    ///
    ///      The latter two conditions gaurantee that `newUnlockTime` is no smaller than the local
    ///      variable `endOfCurrentWeek` in the function.
    function _checkpoint(
        uint256 _oldAmount,
        uint256 _oldUnlockTime,
        uint256 _newAmount,
        uint256 _newUnlockTime
    ) private {
        // Update veHAT supply at the beginning of each week since the last checkpoint.
        uint256 weekCursor = checkpointWeek;
        uint256 endOfCurrentWeek = _endOfWeek(block.timestamp);
        uint256 startOfCurrentWeek = endOfCurrentWeek - 1 weeks;
        uint256 newTotalLocked = totalLocked;
        uint256 newNextWeekSupply = nextWeekSupply;
        if (weekCursor < startOfCurrentWeek) {
            for (uint256 w = weekCursor + 1 weeks; w <= startOfCurrentWeek; w += 1 weeks) {
                veSupplyPerWeek[w] = newNextWeekSupply;
                // Remove HAT unlocked at the beginning of this week from total locked amount.
                newTotalLocked -= scheduledUnlock[w];
                // Calculate supply at the end of the next week.
                newNextWeekSupply -= newTotalLocked * 1 weeks / MAX_TIME;
            }
            checkpointWeek = startOfCurrentWeek;
        }

        // Remove the old schedule if there is one
        if (_oldAmount > 0 && _oldUnlockTime >= endOfCurrentWeek) {
            newTotalLocked -= _oldAmount;
            newNextWeekSupply -= _oldAmount * (_oldUnlockTime - endOfCurrentWeek) / MAX_TIME;
        }

        totalLocked = newTotalLocked + _newAmount;
        // Round up on division when added to the total supply, so that the total supply is never
        // smaller than the sum of all accounts' veHAT balance.
        nextWeekSupply = newNextWeekSupply + (
            (_newAmount * (_newUnlockTime - endOfCurrentWeek) + (MAX_TIME - 1)) / MAX_TIME
        );
    }
}
