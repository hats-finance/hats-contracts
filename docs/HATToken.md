



## Functions
### constructor
```solidity
  function constructor(
  ) public
```
Construct a new HAT token



### setPendingGovernance
```solidity
  function setPendingGovernance(
  ) external
```




### confirmGovernance
```solidity
  function confirmGovernance(
  ) external
```




### setPendingMinter
```solidity
  function setPendingMinter(
  ) external
```




### confirmMinter
```solidity
  function confirmMinter(
  ) external
```




### burn
```solidity
  function burn(
  ) external
```




### mint
```solidity
  function mint(
  ) external
```




### allowance
```solidity
  function allowance(
    address account,
    address spender
  ) external returns (uint256)
```
Get the number of tokens `spender` is approved to spend on behalf of `account`


#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`account` | address | The address of the account holding the funds
|`spender` | address | The address of the account spending the funds

#### Return Values:
| Name                           | Type          | Description                                                                  |
| :----------------------------- | :------------ | :--------------------------------------------------------------------------- |
|`The`| address | number of tokens approved

### approve
```solidity
  function approve(
    address spender,
    uint256 rawAmount
  ) external returns (bool)
```
Approve `spender` to transfer up to `amount` from `src`

This will overwrite the approval amount for `spender`
 and is subject to issues noted [here](https://eips.ethereum.org/EIPS/eip-20#approve)

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`spender` | address | The address of the account which may transfer tokens
|`rawAmount` | uint256 | The number of tokens that are approved (2^256-1 means infinite)

#### Return Values:
| Name                           | Type          | Description                                                                  |
| :----------------------------- | :------------ | :--------------------------------------------------------------------------- |
|`Whether`| address | or not the approval succeeded

### increaseAllowance
```solidity
  function increaseAllowance(
  ) external returns (bool)
```

Atomically increases the allowance granted to `spender` by the caller.

This is an alternative to {approve} that can be used as a mitigation for
problems described in {IERC20-approve}.

Emits an {Approval} event indicating the updated allowance.

Requirements:

- `spender` cannot be the zero address.


### decreaseAllowance
```solidity
  function decreaseAllowance(
  ) external returns (bool)
```

Atomically decreases the allowance granted to `spender` by the caller.

This is an alternative to {approve} that can be used as a mitigation for
problems described in {IERC20-approve}.

Emits an {Approval} event indicating the updated allowance.

Requirements:

- `spender` cannot be the zero address.
- `spender` must have allowance for the caller of at least
`subtractedValue`.


### permit
```solidity
  function permit(
    address owner,
    address spender,
    uint256 rawAmount,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) external
```
Triggers an approval from owner to spends


#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`owner` | address | The address to approve from
|`spender` | address | The address to be approved
|`rawAmount` | uint256 | The number of tokens that are approved (2^256-1 means infinite)
|`deadline` | uint256 | The time at which to expire the signature
|`v` | uint8 | The recovery byte of the signature
|`r` | bytes32 | Half of the ECDSA signature pair
|`s` | bytes32 | Half of the ECDSA signature pair

### balanceOf
```solidity
  function balanceOf(
    address account
  ) external returns (uint256)
```
Get the number of tokens held by the `account`


#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`account` | address | The address of the account to get the balance of

#### Return Values:
| Name                           | Type          | Description                                                                  |
| :----------------------------- | :------------ | :--------------------------------------------------------------------------- |
|`The`| address | number of tokens held

### transfer
```solidity
  function transfer(
    address dst,
    uint256 rawAmount
  ) external returns (bool)
```
Transfer `amount` tokens from `msg.sender` to `dst`


#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`dst` | address | The address of the destination account
|`rawAmount` | uint256 | The number of tokens to transfer

#### Return Values:
| Name                           | Type          | Description                                                                  |
| :----------------------------- | :------------ | :--------------------------------------------------------------------------- |
|`Whether`| address | or not the transfer succeeded

### transferFrom
```solidity
  function transferFrom(
    address src,
    address dst,
    uint256 rawAmount
  ) external returns (bool)
```
Transfer `amount` tokens from `src` to `dst`


#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`src` | address | The address of the source account
|`dst` | address | The address of the destination account
|`rawAmount` | uint256 | The number of tokens to transfer

#### Return Values:
| Name                           | Type          | Description                                                                  |
| :----------------------------- | :------------ | :--------------------------------------------------------------------------- |
|`Whether`| address | or not the transfer succeeded

### delegate
```solidity
  function delegate(
    address delegatee
  ) external
```
Delegate votes from `msg.sender` to `delegatee`


#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`delegatee` | address | The address to delegate votes to

### delegateBySig
```solidity
  function delegateBySig(
    address delegatee,
    uint256 nonce,
    uint256 expiry,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) external
```
Delegates votes from signatory to `delegatee`


#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`delegatee` | address | The address to delegate votes to
|`nonce` | uint256 | The contract state required to match the signature
|`expiry` | uint256 | The time at which to expire the signature
|`v` | uint8 | The recovery byte of the signature
|`r` | bytes32 | Half of the ECDSA signature pair
|`s` | bytes32 | Half of the ECDSA signature pair

### getCurrentVotes
```solidity
  function getCurrentVotes(
    address account
  ) external returns (uint96)
```
Gets the current votes balance for `account`


#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`account` | address | The address to get votes balance

#### Return Values:
| Name                           | Type          | Description                                                                  |
| :----------------------------- | :------------ | :--------------------------------------------------------------------------- |
|`The`| address | number of current votes for `account`

### getPriorVotes
```solidity
  function getPriorVotes(
    address account,
    uint256 blockNumber
  ) external returns (uint96)
```
Determine the prior number of votes for an account as of a block number

Block number must be a finalized block or else this function will revert to prevent misinformation.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`account` | address | The address of the account to check
|`blockNumber` | uint256 | The block number to get the vote balance at

#### Return Values:
| Name                           | Type          | Description                                                                  |
| :----------------------------- | :------------ | :--------------------------------------------------------------------------- |
|`The`| address | number of votes the account had as of the given block

### _mint
```solidity
  function _mint(
    address dst,
    uint256 rawAmount
  ) internal
```
Mint new tokens


#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`dst` | address | The address of the destination account
|`rawAmount` | uint256 | The number of tokens to be minted

### _burn
```solidity
  function _burn(
    address src,
    uint256 rawAmount
  ) internal
```
Burn tokens


#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`src` | address | The address of the source account
|`rawAmount` | uint256 | The number of tokens to be burned

### _delegate
```solidity
  function _delegate(
  ) internal
```




### _transferTokens
```solidity
  function _transferTokens(
  ) internal
```




### _moveDelegates
```solidity
  function _moveDelegates(
  ) internal
```




### _writeCheckpoint
```solidity
  function _writeCheckpoint(
  ) internal
```




### safe32
```solidity
  function safe32(
  ) internal returns (uint32)
```




### safe96
```solidity
  function safe96(
  ) internal returns (uint96)
```




### add96
```solidity
  function add96(
  ) internal returns (uint96)
```




### sub96
```solidity
  function sub96(
  ) internal returns (uint96)
```




### getChainId
```solidity
  function getChainId(
  ) internal returns (uint256)
```




## Events
### MinterPending
```solidity
  event MinterPending(
  )
```
An event thats emitted when a new minter address is pending


### MinterChanged
```solidity
  event MinterChanged(
  )
```
An event thats emitted when the minter address is changed


### GovernancePending
```solidity
  event GovernancePending(
  )
```
An event thats emitted when a new governance address is pending


### GovernanceChanged
```solidity
  event GovernanceChanged(
  )
```
An event thats emitted when a new governance address is set


### DelegateChanged
```solidity
  event DelegateChanged(
  )
```
An event thats emitted when an account changes its delegate


### DelegateVotesChanged
```solidity
  event DelegateVotesChanged(
  )
```
An event thats emitted when a delegate account's vote balance changes
