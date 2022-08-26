// SPDX-License-Identifier: MIT
// Disclaimer https://github.com/hats-finance/hats-contracts/blob/main/DISCLAIMER.md

pragma solidity 0.8.16;


import "./vaults/Claim.sol";
import "./vaults/Deposits.sol";
import "./vaults/Params.sol";
import "./vaults/Withdrawals.sol";


/** @title A HAT vault which holds the funds for a specific project's bug 
* bounties
* @author hats.finance
* @notice The HAT vault can be deposited into in a permissionless maner using
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
*
* @dev HATVault implements the ERC4626 standard
*/
contract HATVault is Claim, Deposits, Params, Withdrawals {

    /**
    * @notice Initialize a vault instance
    * @param _rewardController The reward controller for the vault
    * @param _vestingDuration Duration of the vesting period of the vault's
    * token vested part of the bounty
    * @param _vestingPeriods The number of vesting periods of the vault's token
    * vested part of the bounty
    * @param _maxBounty The maximum percentage of the vault that can be paid
    * out as a bounty
    * @param _bountySplit The way to split the bounty between the hacker, 
    * committee and governance.
    *   Each entry is a number between 0 and `HUNDRED_PERCENT`.
    *   Total splits should be equal to `HUNDRED_PERCENT`.
    * @param _asset The vault's native token
    * @param _committee The address of the vault's committee 
    * @param _isPaused Whether to initialize the vault with deposits disabled
    */
    function initialize(
        IRewardController _rewardController,
        uint256 _vestingDuration,
        uint256 _vestingPeriods,
        uint256 _maxBounty,
        BountySplit memory _bountySplit,
        IERC20 _asset,
        address _committee,
        bool _isPaused
    ) external initializer {
        if (_maxBounty > HUNDRED_PERCENT)
            revert MaxBountyCannotBeMoreThanHundredPercent();
        validateSplit(_bountySplit);
        __ERC4626_init(IERC20MetadataUpgradeable(address(_asset)));
        rewardController = _rewardController;
        _setVestingParams(_vestingDuration, _vestingPeriods);
        maxBounty = _maxBounty;
        bountySplit = _bountySplit;
        committee = _committee;
        depositPause = _isPaused;
        HATVaultsRegistry _registry = HATVaultsRegistry(msg.sender);
        registry = _registry;
        __ReentrancyGuard_init();
        tokenLockFactory = _registry.tokenLockFactory();
    }

    /**
    * @dev Deposit funds to the vault. Can only be called if deposits are not
    * paused.
    * @param receiver Reciever of the shares from the deposit
    * @param assets Amount of vault's native token to deposit
    * @dev See {IERC4626-deposit}.
    */
    function deposit(       
        uint256 assets,
        address receiver
    ) public override(ERC4626Upgradeable) returns (uint256){
        super.deposit(assets, receiver);
    }


    /**
    * @dev Deposit funds to the vault. Can only be called if deposits are not
    * paused.
    * NOTE: Vaults should not use tokens which do not guarantee that the 
    * amount specified is the amount transferred
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
    ) internal override(Deposits, ERC4626Upgradeable) {
        Deposits._deposit(caller, receiver, assets, shares);
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        if (to != address(0)) {
            // Cannot transfer or mint tokens to a user for which an active withdraw request exists
            if (withdrawEnableStartTime[to] != 0) {
                HATVaultsRegistry.GeneralParameters memory generalParameters = registry.getGeneralParameters();
                // solhint-disable-next-line not-rely-on-time
                if (block.timestamp < withdrawEnableStartTime[to] + generalParameters.withdrawRequestEnablePeriod)
                    revert CannotTransferToAnotherUserWithActiveWithdrawRequest();
            }
            rewardController.updateVaultBalance(to, amount, true);
        }

        if (from != address(0)) {
            checkWithdrawAndResetWithdrawEnableStartTime(from);
            rewardController.updateVaultBalance(from, amount, false);
        }
    }

    /** 
    * @notice Withdraw previously deposited funds from the vault.
    * Can only be performed if a withdraw request has been previously
    * submitted, and the pending period had passed, and while the withdraw
    * enabled timeout had not passed. Withdrawals are not permitted during
    * safety periods or while there is an active claim for a bounty payout.
    * @param assets Amount of tokens to withdraw
    * @param receiver Address of receiver of the funds 
    * @param owner Address of owner of the funds 
    * @dev See {IERC4626-withdraw}.
    */
    function withdraw(
        uint256 assets,
        address receiver,
        address owner
    ) public override(Withdrawals, ERC4626Upgradeable) returns (uint256) {
        return Withdrawals.withdraw(assets, receiver, owner);
    }

    /** 
    * @notice Redeem shares in the vault, and withdraw the respective amount
    * of underlying assets.
    * Can only be performed if a withdraw request has been previously
    * submitted, and the pending period had passed, and while the withdraw
    * enabled timeout had not passed. Withdrawals are not permitted during
    * safety periods or while there is an active claim for a bounty payout.
    * @param shares Amount of shares to redeem
    * @param receiver Address of receiver of the funds 
    * @param owner Address of owner of the funds 
    * @dev See {IERC4626-redeem}.
    */
    function redeem(
        uint256 shares,
        address receiver,
        address owner
    ) public override(Withdrawals, ERC4626Upgradeable) returns (uint256) {
        return Withdrawals.redeem(shares, receiver, owner);
    }

    /** @notice See {IERC4626-maxDeposit}. */
    function maxDeposit(address) public view virtual override returns (uint256) {
        return depositPause ? 0 : type(uint256).max;
    }

    /** @notice See {IERC4626-maxMint}. */
    function maxMint(address) public view virtual override returns (uint256) {
        return depositPause ? 0 : type(uint256).max;
    }

    /** @notice See {IERC4626-maxWithdraw}. */
    function maxWithdraw(address owner) public view virtual override returns (uint256) {
        if (activeClaim.createdAt != 0 || !isWithdrawEnabledForUser(owner)) return 0;
        return previewRedeem(balanceOf(owner));
    }

    /** @notice See {IERC4626-maxRedeem}. */
    function maxRedeem(address owner) public view virtual override returns (uint256) {
        if (activeClaim.createdAt != 0 || !isWithdrawEnabledForUser(owner)) return 0;
        return balanceOf(owner);
    }

    /** @notice See {IERC4626-previewWithdraw}. */
    function previewWithdraw(uint256 assets) public view virtual override returns (uint256) {
        uint256 assetsPlusFee = (assets * HUNDRED_PERCENT / (HUNDRED_PERCENT - withdrawalFee));
        return _convertToShares(assetsPlusFee, MathUpgradeable.Rounding.Up);
    }

    /** @notice See {IERC4626-previewRedeem}. */
    function previewRedeem(uint256 shares) public view virtual override returns (uint256) {
        uint256 assets = _convertToAssets(shares, MathUpgradeable.Rounding.Down);
        uint256 fee = assets * withdrawalFee / HUNDRED_PERCENT;
        return assets - fee;
    }
}
