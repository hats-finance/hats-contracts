// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import "../libraries/LibAppStorage.sol";
import "../libraries/LibDiamond.sol";
import "../libraries/LibVaults.sol";

contract SwapFacet is Modifiers {
    event SwapAndSend(uint256 indexed _pid,
                    address indexed _beneficiary,
                    uint256 indexed _amountSwaped,
                    uint256 _amountReceived,
                    address _tokenLock);

    event SwapAndBurn(uint256 indexed _pid, uint256 indexed _amountSwaped, uint256 indexed _amountBurned);

    /**
    * @dev Swap pool's token to HAT.
    * Send to beneficiary and governance their HATs rewards.
    * Burn the rest of HAT.
    * Only governance are authorized to call this function.
    * @param _pid the pool id
    * @param _beneficiary beneficiary
    * @param _amountOutMinimum minimum output of HATs at swap
    * @param _fees the fees for the multi path swap
    **/
    function swapBurnSend(uint256 _pid,
                        address _beneficiary,
                        uint256 _amountOutMinimum,
                        uint24[2] memory _fees)
    external
    onlyOwner {
        IERC20 token = s.poolInfos[_pid].lpToken;
        uint256 amountToSwapAndBurn = s.swapAndBurns[_pid];
        uint256 amountForHackersHatRewards = s.hackersHatRewards[_beneficiary][_pid];
        uint256 amount = amountToSwapAndBurn + amountForHackersHatRewards + s.governanceHatRewards[_pid];
        require(amount > 0, "HVE24");
        s.swapAndBurns[_pid] = 0;
        s.governanceHatRewards[_pid] = 0;
        s.hackersHatRewards[_beneficiary][_pid] = 0;
        uint256 hatsReceived = swapTokenForHAT(amount, token, _fees, _amountOutMinimum);
        uint256 burntHats = hatsReceived * amountToSwapAndBurn / amount;
        if (burntHats > 0) {
            s.HAT.burn(burntHats);
        }
        emit SwapAndBurn(_pid, amount, burntHats);
        address tokenLock;
        uint256 hackerReward = hatsReceived * amountForHackersHatRewards / amount;
        if (hackerReward > 0) {
           //hacker get its reward via vesting contract
            tokenLock = s.tokenLockFactory.createTokenLock(
                address(s.HAT),
                0x000000000000000000000000000000000000dEaD, //this address as owner, so it can do nothing.
                _beneficiary,
                hackerReward,
                // solhint-disable-next-line not-rely-on-time
                block.timestamp, //start
                // solhint-disable-next-line not-rely-on-time
                block.timestamp + s.generalParameters.hatVestingDuration, //end
                s.generalParameters.hatVestingPeriods,
                0, //no release start
                0, //no cliff
                ITokenLock.Revocability.Disabled,
                true
            );
            s.HAT.transfer(tokenLock, hackerReward);
        }
        emit SwapAndSend(_pid, _beneficiary, amount, hackerReward, tokenLock);
        s.HAT.transfer(LibDiamond.contractOwner(), hatsReceived - hackerReward - burntHats);
    }

    function swapTokenForHAT(uint256 _amount,
                            IERC20 _token,
                            uint24[2] memory _fees,
                            uint256 _amountOutMinimum)
    internal
    returns (uint256 hatsReceived)
    {
        if (address(_token) == address(s.HAT)) {
            return _amount;
        }
        require(_token.approve(address(s.uniSwapRouter), _amount), "HVE31");
        uint256 hatBalanceBefore = s.HAT.balanceOf(address(this));
        address weth = s.uniSwapRouter.WETH9();
        bytes memory path;
        if (address(_token) == weth) {
            path = abi.encodePacked(address(_token), _fees[0], address(s.HAT));
        } else {
            path = abi.encodePacked(address(_token), _fees[0], weth, _fees[1], address(s.HAT));
        }
        hatsReceived = s.uniSwapRouter.exactInput(ISwapRouter.ExactInputParams({
            path: path,
            recipient: address(this),
            // solhint-disable-next-line not-rely-on-time
            deadline: block.timestamp,
            amountIn: _amount,
            amountOutMinimum: _amountOutMinimum
        }));
        require(s.HAT.balanceOf(address(this)) - hatBalanceBefore >= _amountOutMinimum, "HVE32");
        require(_token.approve(address(s.uniSwapRouter), 0), "HVE37");
    }
}