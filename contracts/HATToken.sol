// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20Snapshot.sol";
import "openzeppelin-solidity/contracts/access/Ownable.sol";


contract HATToken is ERC20Snapshot, Ownable {
    using SafeMath for uint256;

    uint256 public constant NUMBER_BLOCKS_PER_DAY = 6000;
    uint256 public seedPoolAmount = 100000000e18;
    address public HATMaster;
    address public HATMasterPending;
    uint256 public setHATMasterPendingAtBlock;

    constructor(
        string memory _name,
        string memory _symbol,
        address _owner
    )
    public
    ERC20(_name, _symbol) {
        transferOwnership(_owner);
    }

    //todo restrict snapshot role..
    function snapshot() public returns(uint256) {
        return _snapshot();
    }

    function mint(address _to, uint256 _amount) public {
        require(msg.sender == HATMaster, "HATToken: only master farmer can mint");
        require(seedPoolAmount > 0, "HATToken: cannot mint for pool");
        require(seedPoolAmount >= _amount, "HATToken: amount greater than limitation");
        seedPoolAmount = seedPoolAmount.sub(_amount);
        _mint(_to, _amount);
    }

    function mintFromOwner(address _account, uint256 _amount) public onlyOwner {
        return _mint(_account, _amount);
    }

    function burn(address _account, uint256 _amount) public onlyOwner {
        return _burn(_account, _amount);
    }

    function setPendingMaster(address _HATMaster) public onlyOwner {
        HATMasterPending = _HATMaster;
        setHATMasterPendingAtBlock = block.number;
    }

    function confirmMaster() public onlyOwner {
        require(block.number - setHATMasterPendingAtBlock > 2 * NUMBER_BLOCKS_PER_DAY,
        "HATToken: cannot confirm at this time");
        HATMaster = HATMasterPending;
    }

    function setMaster(address _HATMaster) public onlyOwner {
        require(HATMaster == address(0x0), "HATToken: Cannot set master");
        HATMaster = _HATMaster;
    }
}
