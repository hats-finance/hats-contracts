
pragma solidity 0.8.6;


import "./HATVaults.sol";

// HPUE01: Pool range is too big
// HPUE02: Invalid pool range

contract HATPoolsUpdater {

    HATVaults public immutable hatVaults;

    constructor(
        HATVaults _hatVaults
    // solhint-disable-next-line func-visibility
    ) {
        hatVaults = _hatVaults; 
    }

    /**
    * @dev massUpdatePools - Update reward variables for all pools
    * Be careful of gas spending!
    * @param _fromPid update pools range from this pool id
    * @param _toPid update pools range to this pool id
    */
    function massUpdatePools(uint256 _fromPid, uint256 _toPid) external {
        require(_toPid <= hatVaults.poolLength(), "HPUE01");
        require(_fromPid <= _toPid, "HPUE02");
        for (uint256 pid = _fromPid; pid < _toPid; ++pid) {
            hatVaults.updatePool(pid);
        }
    }
}