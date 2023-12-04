// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "../tokenlock/TokenLockFactory.sol";

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

    bytes32 public immutable root;
    uint256 public immutable startTime;
    uint256 public immutable deadline;
    uint256 public immutable periods;
    IERC20 public immutable token;
    TokenLockFactory public immutable tokenLockFactory;

    mapping (bytes32 => bool) public leafRedeemed;

    event MerkleTreeSet(string _merkleTreeIPFSRef, bytes32 _root, uint256 _startTime, uint256 _deadline);
    event TokensRedeemed(address indexed _account, address indexed _tokenLock, uint256 _amount);
    event TokensRecovered(address indexed _owner, uint256 _amount);

    constructor(
        string memory _merkleTreeIPFSRef,
        bytes32 _root,
        uint256 _startTime,
        uint256 _deadline,
        uint256 _periods,
        IERC20 _token,
        TokenLockFactory _tokenLockFactory
    ) {
        root = _root;
        startTime = _startTime;
        deadline = _deadline;
        periods = _periods;
        token = _token;
        tokenLockFactory = _tokenLockFactory;
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
        address _tokenLock = tokenLockFactory.createTokenLock(
            address(token),
            0x0000000000000000000000000000000000000000,
            _account,
            _amount,
            startTime,
            deadline,
            periods,
            0,
            0,
            false,
            true
        );
        token.safeTransfer(_tokenLock, _amount);
        emit TokensRedeemed(_account, _tokenLock, _amount);
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
