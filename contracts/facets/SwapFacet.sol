// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import "./BaseFacet.sol";

contract SwapFacet is BaseFacet {
    /**
    * @dev Swap pool's token to HAT.
    * Send to beneficiary and governance their HATs rewards.
    * Burn the rest of HAT.
    * Only governance are authorized to call this function.
    * @param _pid the pool id
    * @param _beneficiary beneficiary
    * @param _amountOutMinimum minimum output of HATs at swap
    * @param _routingContract routing contract to call for the swap
    * @param _routingPayload payload to send to the _routingContract for the swap
    **/
    function swapBurnSend(uint256 _pid,
                        address _beneficiary,
                        uint256 _amountOutMinimum,
                        address _routingContract,
                        bytes calldata _routingPayload)
    external
    onlyGovernance {
        require(whitelistedRouters[_routingContract], "HVE44");
        uint256 amountToSwapAndBurn = swapAndBurns[_pid];
        uint256 amountForHackersHatRewards = hackersHatRewards[_beneficiary][_pid];
        uint256 amount = amountToSwapAndBurn + amountForHackersHatRewards + governanceHatRewards[_pid];
        require(amount > 0, "HVE24");
        swapAndBurns[_pid] = 0;
        governanceHatRewards[_pid] = 0;
        hackersHatRewards[_beneficiary][_pid] = 0;
        uint256 hatsReceived = swapTokenForHAT(amount, poolInfos[_pid].lpToken, _amountOutMinimum, _routingContract, _routingPayload);
        uint256 burntHats = hatsReceived * amountToSwapAndBurn / amount;
        if (burntHats > 0) {
            HAT.burn(burntHats);
        }
        emit SwapAndBurn(_pid, amount, burntHats);
        address tokenLock;
        uint256 hackerReward = hatsReceived * amountForHackersHatRewards / amount;
        if (hackerReward > 0) {
           //hacker get its reward via vesting contract
            tokenLock = tokenLockFactory.createTokenLock(
                address(HAT),
                0x000000000000000000000000000000000000dEaD, //this address as owner, so it can do nothing.
                _beneficiary,
                hackerReward,
                // solhint-disable-next-line not-rely-on-time
                block.timestamp, //start
                // solhint-disable-next-line not-rely-on-time
                block.timestamp + generalParameters.hatVestingDuration, //end
                generalParameters.hatVestingPeriods,
                0, //no release start
                0, //no cliff
                ITokenLock.Revocability.Disabled,
                true
            );
            HAT.transfer(tokenLock, hackerReward);
        }
        emit SwapAndSend(_pid, _beneficiary, amount, hackerReward, tokenLock);
        HAT.transfer(governance(), hatsReceived - hackerReward - burntHats);
    }

    function swapTokenForHAT(uint256 _amount,
                            IERC20 _token,
                            uint256 _amountOutMinimum,
                            address _routingContract,
                            bytes calldata _routingPayload)
    internal
    returns (uint256 hatsReceived)
    {
        if (address(_token) == address(HAT)) {
            return _amount;
        }

        require(_token.approve(_routingContract, _amount), "HVE31");
        uint256 hatBalanceBefore = HAT.balanceOf(address(this));
        (bool success,) = _routingContract.call(_routingPayload);
        require(success, "HVE43");
        hatsReceived = HAT.balanceOf(address(this)) - hatBalanceBefore;
        require(hatsReceived >= _amountOutMinimum, "HVE32");
        require(_token.approve(address(_routingContract), 0), "HVE37");
    }
}