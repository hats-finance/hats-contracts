// SPDX-License-Identifier: MIT
pragma solidity 0.8.14;

import "./Base.sol";

contract Pool is Base {

    /**
    * @notice Add a new pool. Can be called only by governance.
    * @param _lpToken The pool's token
    * @param _committee The pool's committee addres
    * @param _maxBounty The pool's max bounty.
    * @param _bountySplit The way to split the bounty between the hacker, committee and governance.
        Each entry is a number between 0 and `HUNDRED_PERCENT`.
        Total splits should be equal to `HUNDRED_PERCENT`.
        Bounty must be specified for the hacker (direct or vested in pool's token).
    * @param _descriptionHash the hash of the pool description.
    * @param _bountyVestingParams vesting params for the bounty
    *        _bountyVestingParams[0] - vesting duration
    *        _bountyVestingParams[1] - vesting periods
    */

    function addPool(
        address _lpToken,
        address _committee,
        IRewardController _rewardController,
        uint256 _maxBounty,
        BountySplit memory _bountySplit,
        string memory _descriptionHash,
        uint256[2] memory _bountyVestingParams,
        bool _isPaused,
        bool _isInitialized
    ) 
    external 
    onlyOwner 
    {
        if (_bountyVestingParams[0] > 120 days)
            revert VestingDurationTooLong();
        if (_bountyVestingParams[1] == 0) revert VestingPeriodsCannotBeZero();
        if (_bountyVestingParams[0] < _bountyVestingParams[1])
            revert VestingDurationSmallerThanPeriods();
        if (_committee == address(0)) revert CommitteeIsZero();
        if (_lpToken == address(0)) revert LPTokenIsZero();
        if (_maxBounty > HUNDRED_PERCENT)
            revert MaxBountyCannotBeMoreThanHundredPercent();
            
        validateSplit(_bountySplit);

        uint256 poolId = poolInfos.length;

        poolInfos.push(PoolInfo({
            committeeCheckedIn: false,
            lpToken: IERC20(_lpToken),
            totalShares: 0,
            balance: 0,
            withdrawalFee: 0,
            rewardController: _rewardController
        }));

        bountyInfos[poolId] = BountyInfo({
            maxBounty: _maxBounty,
            bountySplit: _bountySplit,
            vestingDuration: _bountyVestingParams[0],
            vestingPeriods: _bountyVestingParams[1]
        });

        committees[poolId] = _committee;
        poolDepositPause[poolId] = _isPaused;
        poolInitialized[poolId] = _isInitialized;

        emit AddPool(poolId,
            _lpToken,
            _committee,
            _rewardController,
            _descriptionHash,
            _maxBounty,
            _bountySplit,
            _bountyVestingParams[0],
            _bountyVestingParams[1]);
    }

    /**
    * @notice change the information for a pool
    * ony calleable by the owner of the contract
    * @param _pid the pool id
    * @param _visible is this pool visible in the UI
    * @param _depositPause pause pool deposit (default false).
    * This parameter can be used by the UI to include or exclude the pool
    * @param _descriptionHash the hash of the pool description.
    */
    function setPool(
        uint256 _pid,
        bool _visible,
        bool _depositPause,
        string memory _descriptionHash
    ) external onlyOwner {
        if (poolInfos.length <= _pid) revert PoolDoesNotExist();

        poolDepositPause[_pid] = _depositPause;

        emit SetPool(_pid, _visible, _depositPause, _descriptionHash);
    }
    /**
    * @notice set the flag that the pool is initialized to true
    * ony calleable by the owner of the contract
    * @param _pid the pool id
    */
    function setPoolInitialized(uint256 _pid) external onlyOwner {
        if (poolInfos.length <= _pid) revert PoolDoesNotExist();

        poolInitialized[_pid] = true;
    }

    /**
    * @notice set the shares of users in a pool
    * only calleable by the owner, and only when a pool is not initialized
    * This function is used for migrating older pool data to this new contract
    */
    function setShares(
        uint256 _pid,
        uint256 _rewardPerShare,
        uint256 _balance,
        address[] memory _accounts,
        uint256[] memory _shares,
        uint256[] memory _rewardDebts)
    external onlyOwner {
        if (poolInfos.length <= _pid) revert PoolDoesNotExist();
        if (poolInitialized[_pid]) revert PoolMustNotBeInitialized();
        if (_accounts.length != _shares.length ||
            _accounts.length != _rewardDebts.length)
            revert SetSharesArraysMustHaveSameLength();

        PoolInfo storage pool = poolInfos[_pid];
        pool.balance = _balance;

        for (uint256 i = 0; i < _accounts.length; i++) {
            userShares[_pid][_accounts[i]] = _shares[i];
            pool.totalShares += _shares[i];
        }

        pool.rewardController.setShares(_pid, _rewardPerShare, _accounts, _rewardDebts);
    }
}
