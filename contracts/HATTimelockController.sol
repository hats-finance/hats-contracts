// SPDX-License-Identifier: MIT
// Disclaimer https://github.com/hats-finance/hats-contracts/blob/main/DISCLAIMER.md

pragma solidity 0.8.6;


import "@openzeppelin/contracts/governance/TimelockController.sol";
import "./interfaces/IHATDiamond.sol";


contract HATTimelockController is TimelockController {
    IHATDiamond public hatVaults;

    constructor(
        IHATDiamond _hatVaults,
        uint256 _minDelay,
        address[] memory _proposers,
        address[] memory _executors
    // solhint-disable-next-line func-visibility
    ) TimelockController(_minDelay, _proposers, _executors) {
        require(address(_hatVaults) != address(0), "HATTimelockController: HATVaults address must not be 0");
        hatVaults = _hatVaults;

    }
    
    // Whitelisted functions

    function approveClaim(uint256 _pid) external onlyRole(PROPOSER_ROLE) {
        hatVaults.approveClaim(_pid);
    }

    function addPool(uint256 _allocPoint,
                    address _lpToken,
                    address _committee,
                    uint256[] memory _bountyLevels,
                    BountySplit memory _bountySplit,
                    string memory _descriptionHash,
                    uint256[2] memory _bountyVestingParams)
    external
    onlyRole(PROPOSER_ROLE) {
        hatVaults.addPool(
            _allocPoint,
            _lpToken,
            _committee,
            _bountyLevels,
            _bountySplit,
            _descriptionHash,
            _bountyVestingParams
        );
    }

    function setPool(uint256 _pid,
                    uint256 _allocPoint,
                    bool _registered,
                    bool _depositPause,
                    string memory _descriptionHash)
    external onlyRole(PROPOSER_ROLE) {
        hatVaults.setPool(
            _pid,
            _allocPoint,
            _registered,
            _depositPause,
            _descriptionHash
        );
    }

    function swapBurnSend(uint256 _pid,
                        address _beneficiary,
                        uint256 _amountOutMinimum,
                        uint24[2] memory _fees)
    external
    onlyRole(PROPOSER_ROLE) {
        hatVaults.swapBurnSend(
            _pid,
            _beneficiary,
            _amountOutMinimum,
            _fees
        );
    }
}