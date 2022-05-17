// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/******************************************************************************\
* Author: Nick Mudge <nick@perfectabstractions.com> (https://twitter.com/mudgen)
* EIP-2535 Diamonds: https://eips.ethereum.org/EIPS/eip-2535
*
* Implementation of a diamond.
/******************************************************************************/

import "./libraries/LibAppStorage.sol";
import { LibDiamond } from "./libraries/LibDiamond.sol";
import { IDiamondCut } from "./interfaces/IDiamondCut.sol";

contract HATDiamond {    
    AppStorage internal s;

    struct ConstructorArgs {
        address owner;
        address _rewardsToken;
        uint256 _rewardPerBlock;
        uint256 _startRewardingBlock;
        uint256 _multiplierPeriod;
        address[] _whitelistedRouters;
        ITokenLockFactory _tokenLockFactory;
    }

    constructor(ConstructorArgs memory _args, IDiamondCut.FacetCut[] memory _diamondCut) {        
        LibDiamond.setContractOwner(_args.owner);
        LibDiamond.diamondCut(_diamondCut, address(0), "");     

        s.HAT = HATToken(_args._rewardsToken);
        s.REWARD_PER_BLOCK = _args._rewardPerBlock;
        s.START_BLOCK = _args._startRewardingBlock;
        s.MULTIPLIER_PERIOD = _args._multiplierPeriod;

        s.tokenLockFactory = _args._tokenLockFactory;
        s.generalParameters = GeneralParameters({
            hatVestingDuration: 90 days,
            hatVestingPeriods: 90,
            withdrawPeriod: 11 hours,
            safetyPeriod: 1 hours,
            setBountyLevelsDelay: 2 days,
            withdrawRequestEnablePeriod: 7 days,
            withdrawRequestPendingPeriod: 7 days,
            claimFee: 0
        });
        for (uint256 i = 0; i < _args._whitelistedRouters.length; i++) {
            s.whitelistedRouters[_args._whitelistedRouters[i]] = true;
        }
        s.rewardMultipliers = [4413, 4413, 8825, 7788, 6873, 6065,
                                5353, 4724, 4169, 3679, 3247, 2865,
                                2528, 2231, 1969, 1738, 1534, 1353,
                                1194, 1054, 930, 821, 724, 639];
        s.ReentrancyGuard_status = _NOT_ENTERED;
    }

    // Find facet for function that is called and execute the
    // function if a facet is found and return any value.
    fallback() external payable {
        LibDiamond.DiamondStorage storage ds;
        bytes32 position = LibDiamond.DIAMOND_STORAGE_POSITION;
        // get diamond storage
        assembly {
            ds.slot := position
        }
        // get facet from function selector
        address facet = ds.selectorToFacetAndPosition[msg.sig].facetAddress;
        require(facet != address(0), "Diamond: Function does not exist");
        // Execute external function from facet using delegatecall and return any value.
        assembly {
            // copy function selector and any arguments
            calldatacopy(0, 0, calldatasize())
            // execute function call using the facet
            let result := delegatecall(gas(), facet, 0, calldatasize(), 0, 0)
            // get any return value
            returndatacopy(0, 0, returndatasize())
            // return any return value or error back to the caller
            switch result
                case 0 {
                    revert(0, returndatasize())
                }
                default {
                    return(0, returndatasize())
                }
        }
    }

    receive() external payable {}
}
