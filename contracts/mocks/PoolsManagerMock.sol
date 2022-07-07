// SPDX-License-Identifier: MIT
pragma solidity 0.8.14;

import "../HATVaults.sol";
import "../RewardController.sol";

//this contract is used as an helper contract only for testing purpose

contract PoolsManagerMock {

    function addPools(HATVaults _hatVaults,
                    IRewardController _rewardController,
                    uint256 _allocPoint,
                    address[] memory _lpTokens,
                    address _committee,
                    uint256 _maxBounty,
                    HATVaults.BountySplit memory _bountySplit,
                    string memory _descriptionHash,
                    uint256[2] memory _bountyVestingParams) external {

        for (uint256 i=0; i < _lpTokens.length; i++) {
            _hatVaults.addPool(_lpTokens[i],
                                _committee,
                                _rewardController,
                                _maxBounty,
                                _bountySplit,
                                _descriptionHash,
                                _bountyVestingParams,
                                false,
                                true);
        }

        _rewardController.setAllocPoint(_hatVaults.getNumberOfPools() - 1, _allocPoint);
    }

    function setPools(HATVaults _hatVaults,
                    IRewardController _rewardController,
                    uint256[] memory _pids,
                    uint256 _allocPoint,
                    bool _registered,
                    bool _depositPause,
                    string memory _descriptionHash) external {

        for (uint256 i=0; i < _pids.length; i++) {
            _hatVaults.setPool(_pids[i],
                            _registered,
                            _depositPause,
                            _descriptionHash);
            _rewardController.setAllocPoint(_pids[i], _allocPoint);
        }
    }

    function updatePoolsTwice(RewardController target, uint256 _fromPid, uint256 _toPid) external {
        target.massUpdatePools(_fromPid, _toPid);
        target.massUpdatePools(_fromPid, _toPid);
    }

    function claimRewardTwice(RewardController target, uint256 _pid) external {
        target.claimReward(_pid);
        target.claimReward(_pid);
    }

    function deposit(HATVaults _target, IERC20 _lpToken, uint256 _pid, uint256 _amount) external {
        _lpToken.approve(address(_target), _amount);
        _target.deposit(_pid, _amount);
    }

    function depositTwice(HATVaults _target, IERC20 _lpToken, uint256 _pid, uint256 _amount) external {
        _lpToken.approve(address(_target), _amount * 2);
        _target.deposit(_pid, _amount);
        _target.deposit(_pid, _amount);
    }

    function depositDifferentPids(HATVaults _target, IERC20 _lpToken, uint256[] memory _pids, uint256 _amount)
    external {
        _lpToken.approve(address(_target), _amount * _pids.length);
        uint256  i;
        for (i = 0; i < _pids.length; i++) {
            _target.deposit(_pids[i], _amount);
        }
    }

    function claimDifferentPids(RewardController _target, uint256[] memory _pids) external {
        uint256  i;
        for (i = 0; i < _pids.length; i++) {
            _target.claimReward(_pids[i]);
        }
    }

}
