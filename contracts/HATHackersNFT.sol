// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/access/Ownable.sol";


contract HATHackersNFT is ERC1155Supply, Ownable {

    error MintArrayLengthMismatch();
    error TokenDoesNotExist();
    error MintingAlreadyStopped();
    error MintingOfTokenStopped();

    event MintingStopped(uint256 indexed _tokenId);

    mapping(uint256 => string) public uris;
    mapping(uint256 => bool) public mintingStopped;

    constructor(address _hatsGovernance) ERC1155("") {
        _transferOwnership(_hatsGovernance);
    }

    function mint(address _recipient, string calldata _ipfsHash, uint256 _amount) public onlyOwner {
        uint256 tokenId = getTokenId(_ipfsHash);

        if (bytes(uris[tokenId]).length == 0) {
            uris[tokenId] = _ipfsHash;
        }

        if (mintingStopped[tokenId]) {
            revert MintingOfTokenStopped();
        }
        _mint(_recipient, tokenId, _amount, "");
    }

    function stopMint(uint256 _tokenId) public onlyOwner {
        if (mintingStopped[_tokenId]) {
            revert MintingAlreadyStopped();
        }
        mintingStopped[_tokenId] = true;
        emit MintingStopped(_tokenId);
    }

    function mintMultiple(address[] calldata _recipients, string[] calldata _ipfsHashes, uint256[] calldata _amounts) external onlyOwner {
        if (_ipfsHashes.length != _recipients.length || _ipfsHashes.length != _amounts.length) {
            revert MintArrayLengthMismatch();
        }

        for (uint256 i = 0; i < _ipfsHashes.length;) { 
            mint(_recipients[i], _ipfsHashes[i], _amounts[i]);
            unchecked { ++i; }
        }
    }

    function stopMintMultiple(uint256[] calldata _tokenIds) external onlyOwner {
        for (uint256 i = 0; i < _tokenIds.length;) { 
            stopMint(_tokenIds[i]);
            unchecked { ++i; }
        }
    }

    function getTokenId(string calldata _ipfsHash) public pure returns(uint256) {
        return uint256(keccak256(abi.encodePacked(_ipfsHash)));
    }

    function uri(uint256 _tokenId) public view override returns (string memory) {
        return uris[_tokenId];
    }
}
