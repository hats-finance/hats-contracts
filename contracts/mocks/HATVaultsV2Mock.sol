// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract ERC20MockNFT is ERC20 {

    constructor(
        string memory _name,
        string memory _symbol
    )
    ERC20(_name, _symbol) {}

    function mint(address _to, uint256 _amount) public {
        _mint(_to, _amount);
    }
}

contract HATVaultsV2Mock {
    ERC20MockNFT[] public hatVaults;

    function addShares(uint256 pid, address account, uint256 shares) external {
        while (pid >= hatVaults.length) {
            hatVaults.push(new ERC20MockNFT("HATVault Mock", "HVM"));
        }

        hatVaults[pid].mint(account, shares);
    }
}
