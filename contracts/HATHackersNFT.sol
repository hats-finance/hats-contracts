// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/access/Ownable.sol";


contract HATHackersNFT is ERC1155Supply, Ownable {

    error MintArrayLengthMismatch();
    error TokenDoesNotExist();

    mapping(uint256 => string) public uris;

    // solhint-disable-next-line no-empty-blocks
    constructor() ERC1155("") {}

    function addVault(address _vault, string calldata _description, uint8 _tiersCount, string memory _uri) external onlyOwner {
        for (uint8 i = 0; i < _tiersCount;) { 
            uris[getTokenId(_vault, _description, i)] = string(abi.encodePacked(_uri, Strings.toString(i)));
            unchecked { ++i; }
        }
    }

    function mint(address _recipient, uint256 _tokenId, uint256 _amount) public onlyOwner {
        if (bytes(uris[_tokenId]).length == 0) {
            revert TokenDoesNotExist();
        }
        _mint(_recipient, _tokenId, _amount, "");
    }
    
    function mintMultiple(address[] calldata _recipients, uint256[] calldata _tokenIds, uint256[] calldata _amounts) public onlyOwner {
        if (_tokenIds.length != _recipients.length || _tokenIds.length != _amounts.length) {
            revert MintArrayLengthMismatch();
        }

        for (uint256 i = 0; i < _tokenIds.length;) { 
            mint(_recipients[i], _tokenIds[i], _amounts[i]);
            unchecked { ++i; }
        }
    }

    function getTokenId(
        address _vault,
        string calldata _description,
        uint8 _tier
    ) public pure returns(uint256) {
        return uint256(keccak256(abi.encodePacked(_vault, _description, _tier)));
    }
    
    function uri(uint256 _tokenId) public view override returns (string memory) {
        return uris[_tokenId];
    }
}
