
Contract module which provides a basic access control mechanism, where
there is an account (an governance) that can be granted exclusive access to
specific functions.

The governance account will be passed on initialization of the contract. This
can later be changed with {setPendingGovernance and then transferGovernorship  after 2 days}.

This module is used through inheritance. It will make available the modifier
`onlyGovernance`, which can be applied to your functions to restrict their use to
the governance.

## Functions
### setPendingGovernance
```solidity
  function setPendingGovernance(
  ) external
```

setPendingGovernance set a pending governance address.
NOTE: transferGovernorship can be called after a time delay of 2 days.


### transferGovernorship
```solidity
  function transferGovernorship(
  ) external
```

transferGovernorship transfer governorship to the pending governance address.
NOTE: transferGovernorship can be called after a time delay of 2 days from the latest setPendingGovernance.


### governance
```solidity
  function governance(
  ) public returns (address)
```

Returns the address of the current governance.


### initialize
```solidity
  function initialize(
  ) internal
```

Initializes the contract setting the initial governance.


## Events
### GovernorshipTransferred
```solidity
  event GovernorshipTransferred(
  )
```
An event thats emitted when a new governance address is set


### GovernancePending
```solidity
  event GovernancePending(
  )
```
An event thats emitted when a new governance address is pending


