// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "../HATVaults.sol";
import "../HATMaster.sol";

//this contract is used as an helper contract only for testing purpose

contract PoolsManagerMock {

    function addPools(HATVaults _hatVaults,
                    uint256 _allocPoint,
                    address[] memory _lpTokens,
                    address _committee,
                    uint256[] memory _rewardsLevels,
                    HATMaster.RewardsSplit memory _rewardsSplit,
                    string memory _descriptionHash,
                    uint256[2] memory _rewardVestingParams) external {

        for (uint256 i=0; i < _lpTokens.length; i++) {
            _hatVaults.addPool(_allocPoint,
                               _lpTokens[i],
                                _committee,
                                _rewardsLevels,
                                _rewardsSplit,
                                _descriptionHash,
                                _rewardVestingParams);
        }
    }

    function setPools(HATVaults _hatVaults,
                      uint256[] memory _pids,
                      uint256 _allocPoint,
                      bool _registered,
                      string memory _descriptionHash) external {

        for (uint256 i=0; i < _pids.length; i++) {
            _hatVaults.setPool(_pids[i],
                            _allocPoint,
                            _registered,
                            _descriptionHash);
        }
    }

    function updatePoolsTwice(HATMaster target, uint256 _fromPid, uint256 _toPid) external {
        target.massUpdatePools(_fromPid, _toPid);
        target.massUpdatePools(_fromPid, _toPid);
    }

    function depositTwice(HATMaster _target, IERC20 _lpToken, uint256 _pid, uint256 _amount) external {
        _lpToken.approve(address(_target), _amount * 2);
        _target.deposit(_pid, _amount);
        _target.deposit(_pid, _amount);
    }

}
