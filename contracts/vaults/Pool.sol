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
        uint256 _allocPoint,
        address _lpToken,
        address _committee,
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
            lpToken: IERC20Upgradeable(_lpToken),
            lastRewardBlock: block.number > startBlock ? block.number : startBlock,
            lastProcessedTotalAllocPoint: 0,
            rewardPerShare: 0,
            totalShares: 0,
            balance: 0,
            withdrawalFee: 0,
            allocPoint: _allocPoint
        }));

        bountyInfos[poolId] = BountyInfo({
            maxBounty: _maxBounty,
            bountySplit: _bountySplit,
            vestingDuration: _bountyVestingParams[0],
            vestingPeriods: _bountyVestingParams[1]
        });

        if (_allocPoint != 0) {
            uint256 totalAllocPoint = (globalPoolUpdates.length == 0) ? _allocPoint :
            globalPoolUpdates[globalPoolUpdates.length-1].totalAllocPoint + _allocPoint;

            updateTotalAllocPoint(totalAllocPoint);
        }

        setPoolsLastProcessedTotalAllocPoint(poolId);
        committees[poolId] = _committee;
        poolDepositPause[poolId] = _isPaused;
        poolInitialized[poolId] = _isInitialized;

        emit AddPool(poolId,
            _allocPoint,
            _lpToken,
            _committee,
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
        uint256 _allocPoint,
        bool _visible,
        bool _depositPause,
        string memory _descriptionHash
    ) external onlyOwner {
        if (poolInfos.length <= _pid) revert PoolDoesNotExist();

        uint256 poolAllocPoint = poolInfos[_pid].allocPoint;
        if (_allocPoint != poolAllocPoint) {
            updatePool(_pid);
            uint256 totalAllocPoint = (globalPoolUpdates.length == 0) ? _allocPoint :
            globalPoolUpdates[globalPoolUpdates.length-1].totalAllocPoint - poolAllocPoint + _allocPoint;
            updateTotalAllocPoint(totalAllocPoint);
        }

        poolInfos[_pid].allocPoint = _allocPoint;
        poolDepositPause[_pid] = _depositPause;

        emit SetPool(_pid, _allocPoint, _visible, _depositPause, _descriptionHash);
    }

    function updateTotalAllocPoint(uint256 _totalAllocPoint) internal {
        if (globalPoolUpdates.length > 0 &&
            globalPoolUpdates[globalPoolUpdates.length-1].blockNumber == block.number) {
            // already update in this block
            globalPoolUpdates[globalPoolUpdates.length-1].totalAllocPoint = _totalAllocPoint;
        } else {
            globalPoolUpdates.push(PoolUpdate({
                blockNumber: block.number,
                totalAllocPoint: _totalAllocPoint
            }));
        }
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
    * (and this function can be removed in the next upgrade, because the current version is upgradeable)
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

        pool.rewardPerShare = _rewardPerShare;
        pool.balance = _balance;

        for (uint256 i = 0; i < _accounts.length; i++) {
            userInfo[_pid][_accounts[i]] = UserInfo({
                shares: _shares[i],
                rewardDebt: _rewardDebts[i]
            });
            pool.totalShares += _shares[i];
        }
    }

    /**
    * @notice massUpdatePools - Update reward variables for all pools
    * Be careful of gas spending!
    * @param _fromPid update pools range from this pool id
    * @param _toPid update pools range to this pool id
    */
    function massUpdatePools(uint256 _fromPid, uint256 _toPid) external {
        if (_toPid > poolInfos.length || _fromPid > _toPid)
            revert InvalidPoolRange();

        for (uint256 pid = _fromPid; pid < _toPid; ++pid) {
            updatePool(pid);
        }

        emit MassUpdatePools(_fromPid, _toPid);
    }
}
