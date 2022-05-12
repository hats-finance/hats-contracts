// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;
pragma experimental ABIEncoderV2;

import "../libraries/LibAppStorage.sol";
import "../interfaces/IDiamondLoupe.sol";

interface IHATDiamond {
    event Deposit(address indexed user, uint256 indexed pid, uint256 amount);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event EmergencyWithdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event SendReward(address indexed user, uint256 indexed pid, uint256 amount, uint256 requestedAmount);
    event MassUpdatePools(uint256 _fromPid, uint256 _toPid);

    event SetCommittee(uint256 indexed _pid, address indexed _committee);
    event CommitteeCheckedIn(uint256 indexed _pid);

    event AddPool(uint256 indexed _pid,
                uint256 indexed _allocPoint,
                address indexed _lpToken,
                address _committee,
                string _descriptionHash,
                uint256[] _bountyLevels,
                BountySplit _bountySplit,
                uint256 _bountyVestingDuration,
                uint256 _bountyVestingPeriods);

    event SetPool(uint256 indexed _pid, uint256 indexed _allocPoint, bool indexed _registered, string _descriptionHash);
    event Claim(address indexed _claimer, string _descriptionHash);
    event SetBountySplit(uint256 indexed _pid, BountySplit _bountySplit);
    event SetBountyLevels(uint256 indexed _pid, uint256[] _bountyLevels);
    event SetFeeSetter(address indexed _newFeeSetter);
    event SetPoolFee(uint256 indexed _pid, uint256 _newFee);
    event SetPendingBountyLevels(uint256 indexed _pid, uint256[] _bountyLevels, uint256 _timeStamp);

    event SwapAndSend(uint256 indexed _pid,
                    address indexed _beneficiary,
                    uint256 indexed _amountSwaped,
                    uint256 _amountReceived,
                    address _tokenLock);

    event SwapAndBurn(uint256 indexed _pid, uint256 indexed _amountSwaped, uint256 indexed _amountBurned);
    event SetVestingParams(uint256 indexed _pid, uint256 indexed _duration, uint256 indexed _periods);
    event SetHatVestingParams(uint256 indexed _duration, uint256 indexed _periods);

    event ClaimApproved(address indexed _committee,
                    uint256 indexed _pid,
                    address indexed _beneficiary,
                    uint256 _severity,
                    address _tokenLock,
                    ClaimBounty _claimBounty);

    event ClaimSubmitted(uint256 indexed _pid,
                            address indexed _beneficiary,
                            uint256 indexed _severity,
                            address _committee);

    event WithdrawRequest(uint256 indexed _pid,
                        address indexed _beneficiary,
                        uint256 indexed _withdrawEnableTime);

    event SetWithdrawSafetyPeriod(uint256 indexed _withdrawPeriod, uint256 indexed _safetyPeriod);
    
    event SetRewardMultipliers(uint256[24] _rewardMultipliers);
    
    event SetClaimFee(uint256 _fee);

    event RewardDepositors(uint256 indexed _pid, uint256 indexed _amount);

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // diamond functions
    // struct Facet {
    //     address facetAddress;
    //     bytes4[] functionSelectors;
    // }
    /// @notice Gets all facets and their selectors.
    /// @return facets_ Facet
    function facets() external view returns (IDiamondLoupe.Facet[] memory facets_);

    /// @notice Gets all the function selectors supported by a specific facet.
    /// @param _facet The facet address.
    /// @return facetFunctionSelectors_
    function facetFunctionSelectors(address _facet) external view returns (bytes4[] memory facetFunctionSelectors_);

    /// @notice Get all the facet addresses used by a diamond.
    /// @return facetAddresses_
    function facetAddresses() external view returns (address[] memory facetAddresses_);

    /// @notice Gets the facet that supports the given selector.
    /// @dev If facet is not found return address(0).
    /// @param _functionSelector The function selector.
    /// @return facetAddress_ The facet address.
    function facetAddress(bytes4 _functionSelector) external view returns (address facetAddress_);

    function owner() external view returns (address owner_);

    function HAT() external view returns (address _HAT);

    function generalParameters() external view returns(GeneralParameters memory _generalParameters);
    
    function poolInfos(uint256 _idx) external view returns(PoolInfo memory _poolInfos);

    function globalPoolUpdates(uint256 _idx) external view returns(PoolUpdate memory _poolUpdate);
    
    function userInfo(uint256 _pid, address _user) external view returns(UserInfo memory _userInfo);

    function committees(uint256 _pid) external view returns(address _committee);

    function withdrawEnableStartTime(uint256 _pid, address _user) external view returns(uint256 _requestTime);
    
    function feeSetter() external view returns(address _feeSetter);

    function uniSwapRouter() external view returns(ISwapRouter _uniSwapRouter);

    function transferOwnership(address _newOwner) external;

    function depositHATReward(uint256 _amount) external;

    function massUpdatePools(uint256 _fromPid, uint256 _toPid) external;

    function claimReward(uint256 _pid) external;

    function updatePool(uint256 _pid) external;

    function getMultiplier(uint256 _fromBlock, uint256 _toBlock) external view returns (uint256 result);

    function getRewardForBlocksRange(uint256 _fromBlock, uint256 _toBlock, uint256 _allocPoint, uint256 _totalAllocPoint)
    external
    view
    returns (uint256 reward);

    function calcPoolReward(uint256 _pid, uint256 _fromBlock, uint256 _lastPoolUpdateIndex) external view returns(uint256 reward);

    function submitClaim(uint256 _pid, address _beneficiary, uint256 _severity)
    external;

    function setWithdrawRequestParams(uint256 _withdrawRequestPendingPeriod, uint256  _withdrawRequestEnablePeriod)
    external;

    function dismissClaim(uint256 _pid) external;

    function approveClaim(uint256 _pid) external;

    function rewardDepositors(uint256 _pid, uint256 _amount) external;

    function setRewardMultipliers(uint256[24] memory _rewardMultipliers) external;

    function setClaimFee(uint256 _fee) external;

    function setWithdrawSafetyPeriod(uint256 _withdrawPeriod, uint256 _safetyPeriod) external;

    function claim(string memory _descriptionHash) external payable;

    function setVestingParams(uint256 _pid, uint256 _duration, uint256 _periods) external;

    function setHatVestingParams(uint256 _duration, uint256 _periods) external;

    function setBountySplit(uint256 _pid, BountySplit memory _bountySplit) external;

    function setBountyLevelsDelay(uint256 _delay) external;

    function setPendingBountyLevels(uint256 _pid, uint256[] memory _bountyLevels) external;

    function setBountyLevels(uint256 _pid) external;

    function committeeCheckIn(uint256 _pid) external;

    function setCommittee(uint256 _pid, address _committee) external;

    function addPool(uint256 _allocPoint,
                    address _lpToken,
                    address _committee,
                    uint256[] memory _bountyLevels,
                    BountySplit memory _bountySplit,
                    string memory _descriptionHash,
                    uint256[2] memory _bountyVestingParams)
    external;

    function setPool(uint256 _pid,
                    uint256 _allocPoint,
                    bool _registered,
                    bool _depositPause,
                    string memory _descriptionHash)
    external;

    function setFeeSetter(address _newFeeSetter) external;

    function setPoolFee(uint256 _pid, uint256 _newFee) external;

    function swapBurnSend(uint256 _pid,
                        address _beneficiary,
                        uint256 _amountOutMinimum,
                        uint24[2] memory _fees)
    external;

    function withdrawRequest(uint256 _pid) external;

    function deposit(uint256 _pid, uint256 _amount) external;

    function withdraw(uint256 _pid, uint256 _shares) external;

    function emergencyWithdraw(uint256 _pid) external;

    function getBountyLevels(uint256 _pid) external view returns(uint256[] memory);

    function getBountyInfo(uint256 _pid) external view returns(BountyInfo memory);

    function getRewardPerBlock(uint256 _pid) external view returns (uint256);

    function pendingReward(uint256 _pid, address _user) external view returns (uint256);

    function getGlobalPoolUpdatesLength() external view returns (uint256);

    function getStakedAmount(uint _pid, address _user) external view returns (uint256);

    function poolLength() external view returns (uint256);

    function calcClaimBounty(uint256 _pid, uint256 _severity)
    external
    view
    returns(ClaimBounty memory claimBounty);
}
