// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import "./Base.sol";

contract Pool is Base {
    /**
    * @dev massUpdatePools - Update reward variables for all pools
    * Be careful of gas spending!
    * @param _fromPid update pools range from this pool id
    * @param _toPid update pools range to this pool id
    */
    function massUpdatePools(uint256 _fromPid, uint256 _toPid) external {
        require(_toPid <= poolInfos.length, "HVE38");
        require(_fromPid <= _toPid, "HVE39");
        for (uint256 pid = _fromPid; pid < _toPid; ++pid) {
            updatePool(pid);
        }
        emit MassUpdatePools(_fromPid, _toPid);
    }

    /**
    * @dev Add a new pool. Can be called only by governance.
    * @param _lpToken The pool's token
    * @param _committee The pool's committee addres
    * @param _bountyLevels The pool's bounty levels.
        Each level is a number between 0 and `HUNDRED_PERCENT`, which represents the percentage of the pool to be rewarded for each severity.
    * @param _bountySplit The way to split the bounty between the hacker, committee and governance.
        Each entry is a number between 0 and `HUNDRED_PERCENT`.
        Total splits should be equal to `HUNDRED_PERCENT`.
        If no bounty is specified for the hacker (direct or vested in pool's token), the default bounty split will be used.
    * @param _descriptionHash the hash of the pool description.
    * @param _bountyVestingParams vesting params for the bounty
    *        _bountyVestingParams[0] - vesting duration
    *        _bountyVestingParams[1] - vesting periods
    */
    function addPool(address _lpToken,
                    address _committee,
                    uint256[] memory _bountyLevels,
                    BountySplit memory _bountySplit,
                    string memory _descriptionHash,
                    uint256[2] memory _bountyVestingParams,
                    bool _isPaused,
                    bool _isInitialized)
    external
    onlyOwner {
        require(_bountyVestingParams[0] < 120 days, "HVE15");
        require(_bountyVestingParams[1] > 0, "HVE16");
        require(_bountyVestingParams[0] >= _bountyVestingParams[1], "HVE17");
        require(_committee != address(0), "HVE21");
        require(_lpToken != address(0), "HVE34");

        uint256 startBlock = rewardController.startBlock();

        poolInfos.push(PoolInfo({
            lpToken: IERC20Upgradeable(_lpToken),
            lastRewardBlock: block.number > startBlock ? block.number : startBlock,
            rewardPerShare: 0,
            totalShares: 0,
            balance: 0,
            withdrawalFee: 0
        }));
   
        uint256 poolId = poolInfos.length-1;
        committees[poolId] = _committee;
        rewardController.setPoolsLastProcessedTotalAllocPoint(poolId);
        uint256[] memory bountyLevels = checkBountyLevels(_bountyLevels);
  
        BountySplit memory bountySplit = (_bountySplit.hackerVested == 0 && _bountySplit.hacker == 0) ?
        getDefaultBountySplit() : _bountySplit;
  
        validateSplit(bountySplit);
        bountyInfos[poolId] = BountyInfo({
            bountyLevels: bountyLevels,
            bountySplit: bountySplit,
            committeeCheckIn: false,
            vestingDuration: _bountyVestingParams[0],
            vestingPeriods: _bountyVestingParams[1]
        });

        poolDepositPause[poolId] = _isPaused;
        poolInitialized[poolId] = _isInitialized;

        emit AddPool(poolId,
            _lpToken,
            _committee,
            _descriptionHash,
            bountyLevels,
            bountySplit,
            _bountyVestingParams[0],
            _bountyVestingParams[1]);
    }

    /**
    * @dev setPool
    * @param _pid the pool id
    * @param _visible is this pool visible in the UI
    * @param _depositPause pause pool deposit (default false).
    * This parameter can be used by the UI to include or exclude the pool
    * @param _descriptionHash the hash of the pool description.
    */
    function setPool(uint256 _pid,
                    bool _visible,
                    bool _depositPause,
                    string memory _descriptionHash)
    external onlyOwner {
        require(poolInfos.length > _pid, "HVE23");
        poolDepositPause[_pid] = _depositPause;
        emit SetPool(_pid, _visible, _depositPause, _descriptionHash);
    }

    function setPoolInitialized(uint256 _pid) external onlyOwner {
        require(poolInfos.length > _pid, "HVE23");
        poolInitialized[_pid] = true;
    }

    function setShares(
        uint256 _pid,
        uint256 _rewardPerShare,
        uint256 _balance,
        address[] memory _accounts,
        uint256[] memory _shares,
        uint256[] memory _rewardDebts)
    external onlyOwner {
        require(!poolInitialized[_pid], "HVE38");
        require(poolInfos.length > _pid, "HVE23");
        require(_accounts.length == _shares.length, "HVE39");
        require(_accounts.length == _rewardDebts.length, "HVE39");
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
}