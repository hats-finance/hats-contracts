// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import "../libraries/LibAppStorage.sol";
import "../libraries/LibDiamond.sol";
import "../libraries/LibVaults.sol";

contract CommitteeFacet is Modifiers {
    event SetPendingBountyLevels(uint256 indexed _pid, uint256[] _bountyLevels, uint256 _timeStamp);
    event SetBountyLevels(uint256 indexed _pid, uint256[] _bountyLevels);
    event SetCommittee(uint256 indexed _pid, address indexed _committee);
    event CommitteeCheckedIn(uint256 indexed _pid);

    /**
    * @dev Set pending request to set pool bounty levels.
    * The bounty level represents the percentage of the pool which will be given as a reward for a certain severity.
    * The function can be called only by the pool committee.
    * Cannot be called if there are claims that have been submitted.
    * Each level should be less than `HUNDRED_PERCENT`
    * @param _pid The pool id
    * @param _bountyLevels The array of bounty level per severity
    */
    function setPendingBountyLevels(uint256 _pid, uint256[] memory _bountyLevels)
    external
    onlyCommittee(_pid) noSubmittedClaims(_pid) {
        s.pendingBountyLevels[_pid].bountyLevels = LibVaults.checkBountyLevels(_bountyLevels);
        // solhint-disable-next-line not-rely-on-time
        s.pendingBountyLevels[_pid].timestamp = block.timestamp;
        emit SetPendingBountyLevels(_pid, _bountyLevels, s.pendingBountyLevels[_pid].timestamp);
    }

    /**
   * @dev Set the pool token bounty levels to the already pending bounty levels.
   * The bounty level represents the percentage of the pool which will be given as a bounty for a certain severity.
   * The function can be called only by the pool committee.
   * Cannot be called if there are claims that have been submitted.
   * Can only be called if there are bounty levels pending approval, and the time delay since setting the pending bounty 
   * levels had passed.
   * Each level should be less than `HUNDRED_PERCENT`
   * @param _pid The pool id
 */
    function setBountyLevels(uint256 _pid)
    external
    onlyCommittee(_pid) noSubmittedClaims(_pid) {
        require(s.pendingBountyLevels[_pid].timestamp > 0, "HVE19");
        // solhint-disable-next-line not-rely-on-time
        require(block.timestamp - s.pendingBountyLevels[_pid].timestamp > s.generalParameters.setBountyLevelsDelay, "HVE20");
        s.bountyInfos[_pid].bountyLevels = s.pendingBountyLevels[_pid].bountyLevels;
        delete s.pendingBountyLevels[_pid];
        emit SetBountyLevels(_pid, s.bountyInfos[_pid].bountyLevels);
    }

    /**
    * @dev setCommittee - set new committee address.
    * @param _pid pool id
    * @param _committee new committee address
    */
    function setCommittee(uint256 _pid, address _committee)
    external {
        require(_committee != address(0), "HVE21");
        //governance can update committee only if committee was not checked in yet.
        if (msg.sender == LibDiamond.contractOwner() && s.committees[_pid] != msg.sender) {
            require(!s.bountyInfos[_pid].committeeCheckIn, "HVE22");
        } else {
            require(s.committees[_pid] == msg.sender, "HVE01");
        }

        s.committees[_pid] = _committee;

        emit SetCommittee(_pid, _committee);
    }

    /**
    * @dev committeeCheckIn - committee check in.
    * deposit is enable only after committee check in
    * @param _pid pool id
    */
    function committeeCheckIn(uint256 _pid) external onlyCommittee(_pid) {
        s.bountyInfos[_pid].committeeCheckIn = true;
        emit CommitteeCheckedIn(_pid);
    }
}