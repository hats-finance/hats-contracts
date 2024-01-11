// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/MerkleProofUpgradeable.sol";
import "../tokenlock/ITokenLockFactory.sol";
import "./interfaces/IHATAirdrop.sol";

/*
An airdrop contract that transfers tokens based on a merkle tree.
*/
contract HATAirdrop is IHATAirdrop, Initializable {
    error CannotRedeemBeforeStartTime();
    error CannotRedeemAfterDeadline();
    error LeafAlreadyRedeemed();
    error InvalidMerkleProof();
    error CannotRecoverBeforeDeadline();
    error RedeemerMustBeBeneficiary();

    using SafeERC20Upgradeable for IERC20Upgradeable;

    bytes32 public root;
    uint256 public startTime;
    uint256 public deadline;
    uint256 public lockEndTime;
    uint256 public periods;
    IERC20Upgradeable public token;
    ITokenLockFactory public tokenLockFactory;
    address public factory;

    mapping (bytes32 => bool) public leafRedeemed;

    event MerkleTreeSet(string _merkleTreeIPFSRef, bytes32 _root, uint256 _startTime, uint256 _deadline);
    event TokensRedeemed(address indexed _account, address indexed _tokenLock, uint256 _amount);

    constructor () {
        _disableInitializers();
    }

    /**
    * @notice Initialize a HATAirdrop instance
    * @param _merkleTreeIPFSRef new merkle tree ipfs reference.
    * @param _root new merkle tree root to use for verifying airdrop data.
    * @param _startTime start of the redeem period and of the token lock (if exists)
    * @param _deadline end time to redeem from the contract
    * @param _lockEndTime end time for the token lock contract (if exists)
    * @param _periods number of periods of the token lock contract (if exists)
    * @param _token the token to be airdropped
    * @param _tokenLockFactory the token lock factory to use to deploy the token locks
    */
    function initialize(
        string memory _merkleTreeIPFSRef,
        bytes32 _root,
        uint256 _startTime,
        uint256 _deadline,
        uint256 _lockEndTime,
        uint256 _periods,
        IERC20Upgradeable _token,
        ITokenLockFactory _tokenLockFactory
    ) external initializer {
        root = _root;
        startTime = _startTime;
        deadline = _deadline;
        lockEndTime = _lockEndTime;
        periods = _periods;
        token = _token;
        tokenLockFactory = _tokenLockFactory;
        factory = msg.sender;
        emit MerkleTreeSet(_merkleTreeIPFSRef, _root, _startTime, _deadline);
    }

    function redeem(address _account, uint256 _amount, bytes32[] calldata _proof) external {
        if (msg.sender != _account && msg.sender != factory) {
            revert RedeemerMustBeBeneficiary();
        }
        // solhint-disable-next-line not-rely-on-time
        if (block.timestamp < startTime) revert CannotRedeemBeforeStartTime();
        // solhint-disable-next-line not-rely-on-time
        if (block.timestamp > deadline) revert CannotRedeemAfterDeadline();
        bytes32 leaf = _leaf(_account, _amount);
        if (leafRedeemed[leaf]) revert LeafAlreadyRedeemed();
        if(!_verify(_proof, leaf)) revert InvalidMerkleProof();
        leafRedeemed[leaf] = true;

        address _tokenLock = address(0);
        // solhint-disable-next-line not-rely-on-time
        if (lockEndTime > block.timestamp) {
            _tokenLock = tokenLockFactory.createTokenLock(
                address(token),
                0x0000000000000000000000000000000000000000,
                _account,
                _amount,
                startTime,
                lockEndTime,
                periods,
                0,
                0,
                false,
                true
            );
            token.safeTransferFrom(factory, _tokenLock, _amount);
        } else {
            token.safeTransferFrom(factory, _account, _amount);
        }
       
        emit TokensRedeemed(_account, _tokenLock, _amount);
    }

    function _verify(bytes32[] calldata proof, bytes32 leaf) internal view returns (bool) {
        return MerkleProofUpgradeable.verifyCalldata(proof, root, leaf);
    }

    function _leaf(address _account, uint256 _amount) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(_account, _amount));
    }
}
