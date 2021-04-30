// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "../HATVaults.sol";

//this contract is used as an helper contract only for testing purpose

contract PoolsManagerMock {

    function addPools(HATVaults _hatVaults,
                    uint256 _allocPoint,
                    address[] memory _lpTokens,
                    address[] memory _committee,
                    uint256[] memory _rewardsLevels,
                    uint256[4] memory _rewardsSplit,
                    string memory _descriptionHash,
                    uint256 _rewardVestingDuration,
                    uint256 _rewardVestingPeriods) external {

        for (uint256 i=0; i < _lpTokens.length; i++) {
            _hatVaults.addPool(_allocPoint,
                               _lpTokens[i],
                                _committee,
                                _rewardsLevels,
                                _rewardsSplit,
                                _descriptionHash,
                                _rewardVestingDuration,
                                _rewardVestingPeriods);
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

}
