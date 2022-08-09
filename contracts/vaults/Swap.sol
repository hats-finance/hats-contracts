// SPDX-License-Identifier: MIT
pragma solidity 0.8.14;

import "./Base.sol";

contract Swap is Base {
    using SafeERC20 for ERC20Burnable;

    /**
    * @notice Swap the vault's token to swapToken.
    * Send to beneficiary and governance their HATs rewards.
    * Burn the rest of swapToken.
    * Only governance is authorized to call this function.
    * @param _beneficiary beneficiary
    * @param _amountOutMinimum minimum output of swapToken at swap
    * @param _routingContract routing contract to call for the swap
    * @param _routingPayload payload to send to the _routingContract for the swap
    **/
    function swapBurnSend(
        address _beneficiary,
        uint256 _amountOutMinimum,
        address _routingContract,
        bytes calldata _routingPayload
    ) external onlyOwner {
        uint256 amount = swapAndBurn + hackersHatReward[_beneficiary] + governanceHatReward;
        if (amount == 0) revert AmountToSwapIsZero();
        ERC20Burnable _swapToken = swapToken;
        uint256 hatsReceived = swapTokenForHAT(amount, _amountOutMinimum, _routingContract, _routingPayload);
        uint256 burntHats = hatsReceived * swapAndBurn / amount;
        if (burntHats > 0) {
            _swapToken.burn(burntHats);
        }
        emit SwapAndBurn(amount, burntHats);

        address tokenLock;
        uint256 hackerReward = hatsReceived * hackersHatReward[_beneficiary] / amount;
        swapAndBurn = 0;
        governanceHatReward = 0;
        hackersHatReward[_beneficiary] = 0;
        if (hackerReward > 0) {
            HATVaultsRegistry.GeneralParameters memory generalParameters = registry.getGeneralParameters();
            // hacker gets her reward via vesting contract
            tokenLock = tokenLockFactory.createTokenLock(
                address(_swapToken),
                0x000000000000000000000000000000000000dEaD, //this address as owner, so it can do nothing.
                _beneficiary,
                hackerReward,
                // solhint-disable-next-line not-rely-on-time
                block.timestamp, //start
                // solhint-disable-next-line not-rely-on-time
                block.timestamp + generalParameters.hatVestingDuration, //end
                generalParameters.hatVestingPeriods,
                0, // no release start
                0, // no cliff
                ITokenLock.Revocability.Disabled,
                true
            );
            _swapToken.safeTransfer(tokenLock, hackerReward);
        }
        emit SwapAndSend(_beneficiary, amount, hackerReward, tokenLock);
        _swapToken.safeTransfer(owner(), hatsReceived - hackerReward - burntHats);
    }

    function swapTokenForHAT(uint256 _amount,
        uint256 _amountOutMinimum,
        address _routingContract,
        bytes calldata _routingPayload)
    internal
    returns (uint256 swapTokenReceived)
    {
        IERC20 asset = IERC20(asset());
        ERC20Burnable _swapToken = swapToken;
        if (address(asset) == address(_swapToken)) {
            return _amount;
        }
        if (!registry.whitelistedRouters(_routingContract))
            revert RoutingContractNotWhitelisted();
        if (!asset.approve(_routingContract, _amount))
            revert TokenApproveFailed();
        uint256 balanceBefore = _swapToken.balanceOf(address(this));

        // solhint-disable-next-line avoid-low-level-calls
        (bool success,) = _routingContract.call(_routingPayload);
        if (!success) revert SwapFailed();
        swapTokenReceived = _swapToken.balanceOf(address(this)) - balanceBefore;
        if (swapTokenReceived < _amountOutMinimum)
            revert AmountSwappedLessThanMinimum();
            
        if (!asset.approve(address(_routingContract), 0))
            revert TokenApproveResetFailed();
    }
}