

Contract module which provides a basic access control mechanism, where
there is an account (an owner) that can be granted exclusive access to
specific functions.

The owner account will be passed on initialization of the contract. This
can later be changed with {transferOwnership}.

This module is used through inheritance. It will make available the modifier
`onlyOwner`, which can be applied to your functions to restrict their use to
the owner.

## Functions
### renounceOwnership
```solidity
  function renounceOwnership(
  ) external
```

Leaves the contract without owner. It will not be possible to call
`onlyOwner` functions anymore. Can only be called by the current owner.

NOTE: Renouncing ownership will leave the contract without an owner,
thereby removing any functionality that is only available to the owner.


### transferOwnership
```solidity
  function transferOwnership(
  ) external
```

Transfers ownership of the contract to a new account (`newOwner`).
Can only be called by the current owner.


### owner
```solidity
  function owner(
  ) public returns (address)
```

Returns the address of the current owner.


### initialize
```solidity
  function initialize(
  ) internal
```

Initializes the contract setting the deployer as the initial owner.


## Events
### OwnershipTransferred
```solidity
  event OwnershipTransferred(
  )
```



