// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import "../libraries/LibAppStorage.sol";
import "../libraries/LibVaults.sol";

contract PoolFacet is Modifiers {
    event AddPool(uint256 indexed _pid,
                uint256 indexed _allocPoint,
                address indexed _lpToken,
                address _committee,
                string _descriptionHash,
                uint256[] _bountyLevels,
                BountySplit _bountySplit,
                uint256 _bountyVestingDuration,
                uint256 _bountyVestingPeriods);
    event SetPool(uint256 indexed _pid, uint256 indexed _allocPoint, bool indexed _registered, string _descriptionHash);
    event MassUpdatePools(uint256 _fromPid, uint256 _toPid);

    /**
    * @dev massUpdatePools - Update reward variables for all pools
    * Be careful of gas spending!
    * @param _fromPid update pools range from this pool id
    * @param _toPid update pools range to this pool id
    */
    function massUpdatePools(uint256 _fromPid, uint256 _toPid) external {
        require(_toPid <= s.poolInfos.length, "HVE38");
        require(_fromPid <= _toPid, "HVE39");
        for (uint256 pid = _fromPid; pid < _toPid; ++pid) {
            LibVaults.updatePool(pid);
        }
        emit MassUpdatePools(_fromPid, _toPid);
    }

    function updatePool(uint256 _pid) external {
        LibVaults.updatePool(_pid);
    }

    /**
    * @dev Add a new pool. Can be called only by governance.
    * @param _allocPoint The pool's allocation point
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
    function addPool(uint256 _allocPoint,
                    address _lpToken,
                    address _committee,
                    uint256[] memory _bountyLevels,
                    BountySplit memory _bountySplit,
                    string memory _descriptionHash,
                    uint256[2] memory _bountyVestingParams)
    external
    onlyOwner {
        require(_bountyVestingParams[0] < 120 days, "HVE15");
        require(_bountyVestingParams[1] > 0, "HVE16");
        require(_bountyVestingParams[0] >= _bountyVestingParams[1], "HVE17");
        require(_committee != address(0), "HVE21");
        require(_lpToken != address(0), "HVE34");
        
        uint256 lastRewardBlock = block.number > s.START_BLOCK ? block.number : s.START_BLOCK;
        uint256 totalAllocPoint = (s.globalPoolUpdates.length == 0) ? _allocPoint :
        s.globalPoolUpdates[s.globalPoolUpdates.length-1].totalAllocPoint + _allocPoint;
        if (s.globalPoolUpdates.length > 0 &&
            s.globalPoolUpdates[s.globalPoolUpdates.length-1].blockNumber == block.number) {
            // already update in this block
            s.globalPoolUpdates[s.globalPoolUpdates.length-1].totalAllocPoint = totalAllocPoint;
        } else {
            s.globalPoolUpdates.push(PoolUpdate({
                blockNumber: block.number,
                totalAllocPoint: totalAllocPoint
            }));
        }
        s.poolInfos.push(PoolInfo({
            lpToken: IERC20(_lpToken),
            allocPoint: _allocPoint,
            lastRewardBlock: lastRewardBlock,
            rewardPerShare: 0,
            totalShares: 0,
            lastProcessedTotalAllocPoint: s.globalPoolUpdates.length-1,
            balance: 0,
            fee: 0
        }));
   
        uint256 poolId = s.poolInfos.length-1;
        s.committees[poolId] = _committee;
        uint256[] memory bountyLevels = LibVaults.checkBountyLevels(_bountyLevels);
  
        BountySplit memory bountySplit = (_bountySplit.hackerVested == 0 && _bountySplit.hacker == 0) ?
        LibVaults.getDefaultBountySplit() : _bountySplit;
  
        LibVaults.validateSplit(bountySplit);
        s.bountyInfos[poolId] = BountyInfo({
            bountyLevels: bountyLevels,
            bountySplit: bountySplit,
            committeeCheckIn: false,
            vestingDuration: _bountyVestingParams[0],
            vestingPeriods: _bountyVestingParams[1]
        });

        emit AddPool(poolId,
            _allocPoint,
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
    * @param _allocPoint the pool allocation point
    * @param _registered does this pool is registered (default true).
    * @param _depositPause pause pool deposit (default false).
    * This parameter can be used by the UI to include or exclude the pool
    * @param _descriptionHash the hash of the pool description.
    */
    function setPool(uint256 _pid,
                    uint256 _allocPoint,
                    bool _registered,
                    bool _depositPause,
                    string memory _descriptionHash)
    external onlyOwner {
        require(s.poolInfos.length > _pid, "HVE23");
        set(_pid, _allocPoint);
        s.poolDepositPause[_pid] = _depositPause;
        emit SetPool(_pid, _allocPoint, _registered, _descriptionHash);
    }

    function set(uint256 _pid, uint256 _allocPoint) internal {
        LibVaults.updatePool(_pid);
        uint256 totalAllocPoint =
        s.globalPoolUpdates[s.globalPoolUpdates.length-1].totalAllocPoint
        - s.poolInfos[_pid].allocPoint + _allocPoint;

        if (s.globalPoolUpdates[s.globalPoolUpdates.length-1].blockNumber == block.number) {
            // already update in this block
            s.globalPoolUpdates[s.globalPoolUpdates.length-1].totalAllocPoint = totalAllocPoint;
        } else {
            s.globalPoolUpdates.push(PoolUpdate({
                blockNumber: block.number,
                totalAllocPoint: totalAllocPoint
            }));
        }
        s.poolInfos[_pid].allocPoint = _allocPoint;
    }
}