// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

interface IVotingEscrow {

    struct LockedBalance {
        uint256 amount;
        uint256 unlockTime;
    }

    event LockCreated(address indexed account, uint256 amount, uint256 unlockTime);

    event AmountIncreased(address indexed account, uint256 increasedAmount);

    event UnlockTimeIncreased(address indexed account, uint256 newUnlockTime);

    event Withdrawn(address indexed account, uint256 amount);


    /**
     * @notice Returns the amount of voting power that is owned by `account`
     * @param _account The address of the account to get the voting power of
     * @return The amount of voting power that is owned by `account`
     * @dev Voting power is not represented in actual tokens, but is calculated
     * based on the amount of tokens locked and the amount of time left until
     * they unlock
     */
    function balanceOf(address _account) external view returns (uint256);

    /**
     * @notice Returns the total amount of voting power that is owned by all
     * accounts
     * @return The total amount of voting power that is owned by all accounts
     * @dev Voting power is not represented in actual tokens, but is calculated
     * based on the amount of tokens locked and the amount of time left until
     * they unlock
     */
    function totalSupply() external view returns (uint256);

    /** 
     * @notice Returns the amount of tokens that `account` has locked
     * @param _account The address of the account to get the locked balance of
     * @return The amount of tokens that `account` has locked
     */
    function getLockedBalance(address _account)
        external
        view
        returns (LockedBalance memory);

    /** 
     * @notice Returns the voting power that `account` had at the given timestamp
     * @param _account The address of the account to get the voting power of
     * @param _timestamp The timestamp to get the voting power at
     * @return The voting power that `account` had at the given past timestamp
     */
    function balanceOfAtTimestamp(address _account, uint256 _timestamp)
        external
        view
        returns (uint256);

    /**
     * @notice Returns the total amount of voting power that was owned by all
     * accounts at the given timestamp
     * @param _timestamp The timestamp to get the total voting power at
     * @return The total amount of voting power that was owned by all accounts
     * at the given past timestamp
     */
    function totalSupplyAtTimestamp(uint256 _timestamp) external view returns (uint256);

    /**
     * @notice Creates a lock with the given amount and unlock time for the sender.
     * Sender must not have locked tokens.
     * @param _amount The amount of tokens to lock, must be greater than 0
     * @param _unlockTime The time at which the tokens will unlock, must be in the future
     * and smaller than the maximum lock time allowed
     */
    function createLock(uint256 _amount, uint256 _unlockTime) external;

    /**
     * @notice Increases the amount of tokens locked for `account`
     * @param _account The address of the account to increase the locked balance of, must
     * have a lock that is not expired
     * @param _amount The amount of tokens to increase the lock by, must be greater than 0
     */
    function increaseAmount(address _account, uint256 _amount) external;

    /**
     * @notice Increases the unlock time for the sender. Sender must have a lock that is not
     * expired.
     * @param _unlockTime The new unlock time, must be greater than the current and 
     * smaller than the maximum allowed
     */
    function increaseUnlockTime(uint256 _unlockTime) external;

    /**
     * @notice Withdraws the tokens that are unlocked for the sender. Sender must have a lock
     * that is not expired.
     */
    function withdraw() external;

    /** @notice Recalculate `nextWeekSupply` from scratch. This function eliminates accumulated
     * rounding errors in `nextWeekSupply`, which is incrementally updated in {createLock}, 
     * {increaseAmount} and {increaseUnlockTime}. It is almost never required.
     * @dev Search "rounding error" in test cases for details about the rounding errors.
     */
    function calibrateSupply() external;

    /**
     * @notice Updates the address of a contract to be called in every {createLock}, {increaseAmount}
     * and {increaseUnlockTime}. Can only be called by the owner.
     * @param _newCallback The address of the callback contract to be called, must have a 
     * {syncWithVotingEscrow} function
     */
    function updateCallback(address _newCallback) external;

    /**
     * @notice Updates the maximum lock time allowed. Can only be called by the owner.
     * @param _newMaxTimeAllowed The new maximum lock time allowed, must be greater than the current
     * and smaller than `MAX_TIME`
     */
    function updateMaxTimeAllowed(uint256 _newMaxTimeAllowed) external;

    /**
     * @notice Adds new accounts to the whitelist. Can only be called by the owner.
     * @param _whitelistedContracts The addresses of the accounts to add to the whitelist, must all be contracts
     */
    function addWhitelistedContracts(address[] calldata _whitelistedContracts) external;

 }

