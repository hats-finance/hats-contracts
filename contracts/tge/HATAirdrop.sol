// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/*
An airdrop contract that transfers tokens based on a merkle tree.
*/
contract HATAirdrop is Ownable {
    error CannotRedeemBeforeStartTime();
    error CannotRedeemAfterDeadline();
    error LeafAlreadyRedeemed();
    error InvalidMerkleProof();
    error CannotRecoverBeforeDeadline();

    using SafeERC20 for IERC20;

    bytes32 public root;
    uint256 public startTime;
    uint256 public deadline;
    IERC20 public token;

    mapping (bytes32 => bool) public leafRedeemed;

    event MerkleTreeSet(string _merkleTreeIPFSRef, bytes32 _root, uint256 _startTime, uint256 _deadline);
    event TokensRedeemed(address _account, uint256 _amount);
    event TokensRecovered(address _owner, uint256 _amount);

    constructor(
        string memory _merkleTreeIPFSRef,
        bytes32 _root,
        uint256 _startTime,
        uint256 _deadline,
        IERC20 _token
    ) {
        root = _root;
        startTime = _startTime;
        deadline = _deadline;
        token = _token;
        emit MerkleTreeSet(_merkleTreeIPFSRef, _root, _startTime, _deadline);
    }

    function redeem(address _account, uint256 _amount, bytes32[] calldata _proof) external {
        // solhint-disable-next-line not-rely-on-time
        if (block.timestamp < startTime) revert CannotRedeemBeforeStartTime();
        // solhint-disable-next-line not-rely-on-time
        if (block.timestamp > deadline) revert CannotRedeemAfterDeadline();
        bytes32 leaf = _leaf(_account, _amount);
        if (leafRedeemed[leaf]) revert LeafAlreadyRedeemed();
        if(!_verify(_proof, leaf)) revert InvalidMerkleProof();
        leafRedeemed[leaf] = true;
        token.safeTransfer(_account, _amount);
        emit TokensRedeemed(_account, _amount);
    }

    function recoverTokens() external onlyOwner {
        // solhint-disable-next-line not-rely-on-time
        if (block.timestamp <= deadline) revert CannotRecoverBeforeDeadline();
        address owner = owner();
        uint256 amount = token.balanceOf(address(this));
        token.safeTransfer(owner, amount);
        emit TokensRecovered(owner, amount);
    }

    function _verify(bytes32[] calldata proof, bytes32 leaf) internal view returns (bool) {
        return MerkleProof.verifyCalldata(proof, root, leaf);
    }

    function _leaf(address _account, uint256 _amount) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(_account, _amount));
    }
}
