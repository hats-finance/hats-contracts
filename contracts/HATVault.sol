// SPDX-License-Identifier: MIT
// Disclaimer https://github.com/hats-finance/hats-contracts/blob/main/DISCLAIMER.md

pragma solidity 0.8.16;

import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC4626Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./tokenlock/TokenLockFactory.sol";
import "./interfaces/IHATVault.sol";
import "./interfaces/IHATClaimsManager.sol";
import "./interfaces/IRewardController.sol";
import "./HATVaultsRegistry.sol";

/** @title A Hats.finance vault which holds the funds for a specific project's
* bug bounties
* @author Hats.finance
* @notice The HATVault can be deposited into in a permissionless manner using
* the vault’s native token. When a bug is submitted and approved, the bounty 
* is paid out using the funds in the vault. Bounties are paid out as a
* percentage of the vault. The percentage is set according to the severity of
* the bug. Vaults have regular safety periods (typically for an hour twice a
* day) which are time for the committee to make decisions.
*
* In addition to the roles defined in the HATVaultsRegistry, every HATVault 
* has the roles:
* Committee - The only address which can submit a claim for a bounty payout
* and set the maximum bounty.
* User - Anyone can deposit the vault's native token into the vault and 
* recieve shares for it. Shares represent the user's relative part in the
* vault, and when a bounty is paid out, users lose part of their deposits
* (based on percentage paid), but keep their share of the vault.
* Users also receive rewards for their deposits, which can be claimed at any
* time.
* To withdraw previously deposited tokens, a user must first send a withdraw
* request, and the withdrawal will be made available after a pending period.
* Withdrawals are not permitted during safety periods or while there is an 
* active claim for a bounty payout.
*
* Bounties are payed out distributed between a few channels, and that 
* distribution is set upon creation (the hacker gets part in direct transfer,
* part in vested reward and part in vested HAT token, part gets rewarded to
* the committee, part gets swapped to HAT token and burned and/or sent to Hats
* governance).
*
* This project is open-source and can be found at:
* https://github.com/hats-finance/hats-contracts
*/
contract HATVault is IHATVault, ERC4626Upgradeable, OwnableUpgradeable, ReentrancyGuardUpgradeable {
    using SafeERC20 for IERC20;
    using MathUpgradeable for uint256;

    uint256 public constant MAX_UINT = type(uint256).max;
    uint256 public constant HUNDRED_PERCENT = 1e4;
    uint256 public constant MAX_WITHDRAWAL_FEE = 2e2; // Max fee is 2%
    uint256 public constant MINIMAL_AMOUNT_OF_SHARES = 1e3; // to reduce rounding errors, the number of shares is either 0, or > than this number

    address public claimsManager;
    IHATVaultsRegistry public registry;

    // Time of when withdrawal period starts for every user that has an
    // active withdraw request. (time when last withdraw request pending 
    // period ended, or 0 if last action was deposit or withdraw)
    mapping(address => uint256) public withdrawEnableStartTime;
    IRewardController[] public rewardControllers;
    uint256 public withdrawalFee;
    bool public vaultStarted;
    bool public depositPause;
    bool public withdrawPaused;
    bool private _isEmergencyWithdraw;
    bool private _vaultDestroyed;

    modifier onlyClaimsManager() {
        if (claimsManager != _msgSender()) revert OnlyClaimsManager();
        _;
    }

    modifier onlyRegistryOwner() {
        if (registry.owner() != _msgSender()) revert OnlyRegistryOwner();
        _;
    }

    modifier onlyFeeSetter() {
        if (registry.feeSetter() != msg.sender) revert OnlyFeeSetter();
        _;
    }

    /** @notice See {IHATVault-initialize}. */
    function initialize(address _claimsManager, IHATVault.VaultInitParams calldata _params) external initializer {
        __ERC20_init(string.concat("Hats Vault ", _params.name), string.concat("HAT", _params.symbol));
        __ERC4626_init(IERC20MetadataUpgradeable(address(_params.asset)));
        __ReentrancyGuard_init();
        _transferOwnership(_params.owner);
        for (uint256 i = 0; i < _params.rewardControllers.length;) { 
            _addRewardController(_params.rewardControllers[i]);
            unchecked { ++i; }
        }
        claimsManager = _claimsManager;
        depositPause = _params.isPaused;
        registry = IHATVaultsRegistry(_msgSender());
        emit SetVaultDescription(_params.descriptionHash);
    }

    /** @notice See {IHATVault-approveClaim}. */
    function makePayout(uint256 _amount) external onlyClaimsManager {
        IERC20(asset()).safeTransfer(address(_msgSender()), _amount);
        emit VaultPayout(_amount);
    }

    /** @notice See {IHATVault-setWithdrawPaused}. */
    function setWithdrawPaused(bool _withdrawPaused) external onlyClaimsManager {
        withdrawPaused = _withdrawPaused;
        emit SetWithdrawPaused(_withdrawPaused);
    }

    /** @notice See {IHATVault-destroyVault}. */
    function startVault() external onlyClaimsManager {
        vaultStarted = true;
        emit VaultStarted();
    }

    /** @notice See {IHATVault-destroyVault}. */
    function destroyVault() external onlyClaimsManager {
        depositPause = true;
        _vaultDestroyed = true;
        emit VaultDestroyed();
    }

    /** @notice See {IHATVault-addRewardController}. */
    function addRewardController(IRewardController _rewardController) external onlyRegistryOwner {
        _addRewardController(_rewardController);
        for (uint256 i = 0; i < rewardControllers.length;) { 
            if (_rewardController == rewardControllers[i]) revert DuplicatedRewardController();
            unchecked { ++i; }
        }
        rewardControllers.push(_rewardController);
        emit AddRewardController(_rewardController);
    }

    /** @notice See {IHATVault-setDepositPause}. */
    function setDepositPause(bool _depositPause) external onlyOwner {
        if (_vaultDestroyed)
            revert CannotUnpauseDestroyedVault();
        depositPause = _depositPause;
        emit SetDepositPause(_depositPause);
    }

    /** @notice See {IHATVault-setVaultDescription}. */
    function setVaultDescription(string calldata _descriptionHash) external onlyRegistryOwner {
        emit SetVaultDescription(_descriptionHash);
    }

    /** @notice See {IHATVault-setWithdrawalFee}. */
    function setWithdrawalFee(uint256 _fee) external onlyFeeSetter {
        if (_fee > MAX_WITHDRAWAL_FEE) revert WithdrawalFeeTooBig();
        withdrawalFee = _fee;
        emit SetWithdrawalFee(_fee);
    }

    /* -------------------------------------------------------------------------------- */


    /* ---------------------------------- Vault --------------------------------------- */

    /** @notice See {IHATVault-withdrawRequest}. */
    function withdrawRequest() external nonReentrant {
        // set the withdrawEnableStartTime time to be withdrawRequestPendingPeriod from now
        // solhint-disable-next-line not-rely-on-time
        uint256 _withdrawEnableStartTime = block.timestamp + registry.getWithdrawRequestPendingPeriod();
        address msgSender = _msgSender();
        withdrawEnableStartTime[msgSender] = _withdrawEnableStartTime;
        emit WithdrawRequest(msgSender, _withdrawEnableStartTime);
    }

    /** @notice See {IHATVault-withdrawAndClaim}. */
    function withdrawAndClaim(uint256 assets, address receiver, address owner) external returns (uint256 shares) {
        shares = withdraw(assets, receiver, owner);
        _claimRewards(owner);
    }

    /** @notice See {IHATVault-redeemAndClaim}. */
    function redeemAndClaim(uint256 shares, address receiver, address owner) external returns (uint256 assets) {
        assets = redeem(shares, receiver, owner);
        _claimRewards(owner);
    }

    /** @notice See {IHATVault-emergencyWithdraw}. */
    function emergencyWithdraw(address receiver) external returns (uint256 assets) {
        _isEmergencyWithdraw = true;
        address msgSender = _msgSender();
        assets = redeem(balanceOf(msgSender), receiver, msgSender);
        _isEmergencyWithdraw = false;
    }

    /** @notice See {IHATVault-withdraw}. */
    function withdraw(uint256 assets, address receiver, address owner) 
        public override(IHATVault, ERC4626Upgradeable) virtual returns (uint256) {
        (uint256 _shares, uint256 _fee) = previewWithdrawAndFee(assets);
        _withdraw(_msgSender(), receiver, owner, assets, _shares, _fee);

        return _shares;
    }

    /** @notice See {IHATVault-redeem}. */
    function redeem(uint256 shares, address receiver, address owner) 
        public override(IHATVault, ERC4626Upgradeable) virtual returns (uint256) {
        (uint256 _assets, uint256 _fee) = previewRedeemAndFee(shares);
        _withdraw(_msgSender(), receiver, owner, _assets, shares, _fee);

        return _assets;
    }

    /** @notice See {IHATVault-deposit}. */
    function deposit(uint256 assets, address receiver) public override(IHATVault, ERC4626Upgradeable) virtual returns (uint256) {
        return super.deposit(assets, receiver);
    }

    /** @notice See {IHATVault-withdraw}. */
    function withdraw(uint256 assets, address receiver, address owner, uint256 maxShares) public virtual returns (uint256) {
        uint256 shares = withdraw(assets, receiver, owner);
        if (shares > maxShares) revert WithdrawSlippageProtection();
        return shares;
    }

    /** @notice See {IHATVault-redeem}. */
    function redeem(uint256 shares, address receiver, address owner, uint256 minAssets) public virtual returns (uint256) {
        uint256 assets = redeem(shares, receiver, owner);
        if (assets < minAssets) revert RedeemSlippageProtection();
        return assets;
    }

    /** @notice See {IHATVault-withdrawAndClaim}. */
    function withdrawAndClaim(uint256 assets, address receiver, address owner, uint256 maxShares) external returns (uint256 shares) {
        shares = withdraw(assets, receiver, owner, maxShares);
        _claimRewards(owner);
    }

    /** @notice See {IHATVault-redeemAndClaim}. */
    function redeemAndClaim(uint256 shares, address receiver, address owner, uint256 minAssets) external returns (uint256 assets) {
        assets = redeem(shares, receiver, owner, minAssets);
        _claimRewards(owner);
    }

    /** @notice See {IHATVault-deposit}. */
    function deposit(uint256 assets, address receiver, uint256 minShares) external virtual returns (uint256) {
        uint256 shares = deposit(assets, receiver);
        if (shares < minShares) revert DepositSlippageProtection();
        return shares;
    }

    /** @notice See {IHATVault-mint}. */
    function mint(uint256 shares, address receiver, uint256 maxAssets) external virtual returns (uint256) {
        uint256 assets = mint(shares, receiver);
        if (assets > maxAssets) revert MintSlippageProtection();
        return assets;
    }

    /** @notice See {IERC4626Upgradeable-maxDeposit}. */
    function maxDeposit(address) public view virtual override(IERC4626Upgradeable, ERC4626Upgradeable) returns (uint256) {
        return depositPause ? 0 : MAX_UINT;
    }

    /** @notice See {IERC4626Upgradeable-maxMint}. */
    function maxMint(address) public view virtual override(IERC4626Upgradeable, ERC4626Upgradeable) returns (uint256) {
        return depositPause ? 0 : MAX_UINT;
    }

    /** @notice See {IERC4626Upgradeable-maxWithdraw}. */
    function maxWithdraw(address owner) public view virtual override(IERC4626Upgradeable, ERC4626Upgradeable) returns (uint256) {
        if (withdrawPaused || !_isWithdrawEnabledForUser(owner)) return 0;
        return previewRedeem(balanceOf(owner));
    }

    /** @notice See {IERC4626Upgradeable-maxRedeem}. */
    function maxRedeem(address owner) public view virtual override(IERC4626Upgradeable, ERC4626Upgradeable) returns (uint256) {
        if (withdrawPaused || !_isWithdrawEnabledForUser(owner)) return 0;
        return balanceOf(owner);
    }

    /** @notice See {IERC4626Upgradeable-previewWithdraw}. */
    function previewWithdraw(uint256 assets) public view virtual override(IERC4626Upgradeable, ERC4626Upgradeable) returns (uint256 shares) {
        (shares,) = previewWithdrawAndFee(assets);
    }

    /** @notice See {IERC4626Upgradeable-previewRedeem}. */
    function previewRedeem(uint256 shares) public view virtual override(IERC4626Upgradeable, ERC4626Upgradeable) returns (uint256 assets) {
        (assets,) = previewRedeemAndFee(shares);
    }

    /** @notice See {IHATVault-previewWithdrawAndFee}. */
    function previewWithdrawAndFee(uint256 assets) public view returns (uint256 shares, uint256 fee) {
        uint256 _withdrawalFee = withdrawalFee;
        fee = assets.mulDiv(_withdrawalFee, (HUNDRED_PERCENT - _withdrawalFee));
        shares = _convertToShares(assets + fee, MathUpgradeable.Rounding.Up);
    }

    /** @notice See {IHATVault-previewRedeemAndFee}. */
    function previewRedeemAndFee(uint256 shares) public view returns (uint256 assets, uint256 fee) {
        uint256 _assetsPlusFee = _convertToAssets(shares, MathUpgradeable.Rounding.Down);
        fee = _assetsPlusFee.mulDiv(withdrawalFee, HUNDRED_PERCENT);
        unchecked { // fee will always be maximun 20% of _assetsPlusFee
            assets = _assetsPlusFee - fee;
        }
    }

    /* -------------------------------------------------------------------------------- */

    /* --------------------------------- Helpers -------------------------------------- */

    /**
    * @dev Deposit funds to the vault. Can only be called if the committee had
    * checked in and deposits are not paused.
    * @param caller Caller of the action (msg.sender)
    * @param receiver Reciever of the shares from the deposit
    * @param assets Amount of vault's native token to deposit
    * @param shares Respective amount of shares to be received
    */
    function _deposit(
        address caller,
        address receiver,
        uint256 assets,
        uint256 shares
    ) internal override virtual nonReentrant {
        if (!vaultStarted)
            revert VaultNotStartedYet();
        if (receiver == caller && withdrawEnableStartTime[receiver] != 0 ) {
            // clear withdraw request if caller deposits in her own account
            withdrawEnableStartTime[receiver] = 0;
        }

        super._deposit(caller, receiver, assets, shares);
    }

    // amount of shares correspond with assets + fee
    function _withdraw(
        address _caller,
        address _receiver,
        address _owner,
        uint256 _assets,
        uint256 _shares,
        uint256 _fee
    ) internal nonReentrant {
        if (_assets == 0) revert WithdrawMustBeGreaterThanZero();
        if (_caller != _owner) {
            _spendAllowance(_owner, _caller, _shares);
        }

        _burn(_owner, _shares);

        IERC20 _asset = IERC20(asset());
        if (_fee > 0) {
            _asset.safeTransfer(registry.owner(), _fee);
        }
        _asset.safeTransfer(_receiver, _assets);

        emit Withdraw(_caller, _receiver, _owner, _assets, _shares);
    }

    /**
    * @dev Claim rewards from the vault's reward controllers for the owner
    * @param owner The owner of the rewards to claim for
    */
    function _claimRewards(address owner) internal {
        for (uint256 i = 0; i < rewardControllers.length;) { 
            rewardControllers[i].claimReward(address(this), owner);
            unchecked { ++i; }
        }
    }

    function _beforeTokenTransfer(
        address _from,
        address _to,
        uint256 _amount
    ) internal virtual override {
        if (_amount == 0) revert AmountCannotBeZero();
        if (_from == _to) revert CannotTransferToSelf();
        // deposit/mint/transfer
        if (_to != address(0)) {
            IHATVaultsRegistry _registry = registry;
            if (_registry.isEmergencyPaused()) revert SystemInEmergencyPause();
            // Cannot transfer or mint tokens to a user for which an active withdraw request exists
            // because then we would need to reset their withdraw request
            uint256 _withdrawEnableStartTime = withdrawEnableStartTime[_to];
            if (_withdrawEnableStartTime != 0) {
                // solhint-disable-next-line not-rely-on-time
                if (block.timestamp <= _withdrawEnableStartTime + _registry.getWithdrawRequestEnablePeriod())
                    revert CannotTransferToAnotherUserWithActiveWithdrawRequest();
            }

            for (uint256 i = 0; i < rewardControllers.length;) { 
                rewardControllers[i].commitUserBalance(_to, _amount, true);
                unchecked { ++i; }
            }
        }
        // withdraw/redeem/transfer
        if (_from != address(0)) {
            if (_amount > maxRedeem(_from)) revert RedeemMoreThanMax();
            // if all is ok and withdrawal can be made - 
            // reset withdrawRequests[_pid][msg.sender] so that another withdrawRequest
            // will have to be made before next withdrawal
            withdrawEnableStartTime[_from] = 0;

            if (!_isEmergencyWithdraw) {
                for (uint256 i = 0; i < rewardControllers.length;) { 
                    rewardControllers[i].commitUserBalance(_from, _amount, false);
                    unchecked { ++i; }
                }
            }
        }
    }

    function _afterTokenTransfer(address, address, uint256) internal virtual override {
        if (totalSupply() > 0 && totalSupply() < MINIMAL_AMOUNT_OF_SHARES) {
          revert AmountOfSharesMustBeMoreThanMinimalAmount();
        }
    }

    /**
    * @dev Checks that the given user can perform a withdraw at this time
    * @param _user Address of the user to check
    */
    function _isWithdrawEnabledForUser(address _user)
        internal view
        returns(bool)
    {
        IHATVaultsRegistry _registry = registry;
        uint256 _withdrawPeriod = _registry.getWithdrawPeriod();
        // disable withdraw for safetyPeriod (e.g 1 hour) after each withdrawPeriod (e.g 11 hours)
        // solhint-disable-next-line not-rely-on-time
        if (block.timestamp % (_withdrawPeriod + _registry.getSafetyPeriod()) >= _withdrawPeriod)
            return false;
        // check that withdrawRequestPendingPeriod had passed
        uint256 _withdrawEnableStartTime = withdrawEnableStartTime[_user];
        // solhint-disable-next-line not-rely-on-time
        return (block.timestamp >= _withdrawEnableStartTime &&
        // check that withdrawRequestEnablePeriod had not passed and that the
        // last action was withdrawRequest (and not deposit or withdraw, which
        // reset withdrawRequests[_user] to 0)
        // solhint-disable-next-line not-rely-on-time
            block.timestamp <= _withdrawEnableStartTime + _registry.getWithdrawRequestEnablePeriod());
    }

    function _addRewardController(IRewardController _rewardController) internal {
        for (uint256 i = 0; i < rewardControllers.length;) { 
            if (_rewardController == rewardControllers[i]) revert DuplicatedRewardController();
            unchecked { ++i; }
        }
        rewardControllers.push(_rewardController);
        emit AddRewardController(_rewardController);
    }

    /* -------------------------------------------------------------------------------- */
}
