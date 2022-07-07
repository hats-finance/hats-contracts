// SPDX-License-Identifier: MIT
pragma solidity 0.8.14;

import "./Base.sol";

contract Swap is Base {
    using SafeERC20 for ERC20Burnable;

    /**
    * @notice Swap pool's token to swapToken.
    * Send to beneficiary and governance their HATs rewards.
    * Burn the rest of swapToken.
    * Only governance is authorized to call this function.
    * @param _pid the pool id
    * @param _beneficiary beneficiary
    * @param _amountOutMinimum minimum output of swapToken at swap
    * @param _routingContract routing contract to call for the swap
    * @param _routingPayload payload to send to the _routingContract for the swap
    **/
    function swapBurnSend(uint256 _pid,
        address _beneficiary,
        uint256 _amountOutMinimum,
        address _routingContract,
        bytes calldata _routingPayload)
    external
    onlyOwner {
        uint256 amountToSwapAndBurn = swapAndBurns[_pid];
        uint256 amountForHackersHatRewards = hackersHatRewards[_beneficiary][_pid];
        uint256 amount = amountToSwapAndBurn + amountForHackersHatRewards + governanceHatRewards[_pid];
        if (amount == 0) revert AmountToSwapIsZero();
        swapAndBurns[_pid] = 0;
        governanceHatRewards[_pid] = 0;
        hackersHatRewards[_beneficiary][_pid] = 0;
        uint256 hatsReceived = swapTokenForHAT(amount, poolInfos[_pid].lpToken, _amountOutMinimum, _routingContract, _routingPayload);
        uint256 burntHats = hatsReceived * amountToSwapAndBurn / amount;
        if (burntHats > 0) {
            swapToken.burn(burntHats);
        }
        emit SwapAndBurn(_pid, amount, burntHats);

        address tokenLock;
        uint256 hackerReward = hatsReceived * amountForHackersHatRewards / amount;
        if (hackerReward > 0) {
            // hacker gets her reward via vesting contract
            tokenLock = tokenLockFactory.createTokenLock(
                address(swapToken),
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
            swapToken.safeTransfer(tokenLock, hackerReward);
        }
        emit SwapAndSend(_pid, _beneficiary, amount, hackerReward, tokenLock);
        swapToken.safeTransfer(owner(), hatsReceived - hackerReward - burntHats);
    }

    function swapTokenForHAT(uint256 _amount,
        IERC20 _token,
        uint256 _amountOutMinimum,
        address _routingContract,
        bytes calldata _routingPayload)
    internal
    returns (uint256 swapTokenReceived)
    {
        if (address(_token) == address(swapToken)) {
            return _amount;
        }
        if (!whitelistedRouters[_routingContract])
            revert RoutingContractNotWhitelisted();
        if (!_token.approve(_routingContract, _amount))
            revert TokenApproveFailed();
        uint256 balanceBefore = swapToken.balanceOf(address(this));

        // solhint-disable-next-line avoid-low-level-calls
        (bool success,) = _routingContract.call(_routingPayload);
        if (!success) revert SwapFailed();
        swapTokenReceived = swapToken.balanceOf(address(this)) - balanceBefore;
        if (swapTokenReceived < _amountOutMinimum)
            revert AmountSwappedLessThanMinimum();
            
        if (!_token.approve(address(_routingContract), 0))
            revert TokenApproveResetFailed();
    }
}
