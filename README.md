### Hats-contracts gas optimizations

### Gas optimized fork - https://github.com/Tofunmi1/hats-contracts

## Initial gas measurement running `npm run gas-avg` - is 6975095

- after adding optimizations = `6973951`

## HATVault.sol

### SubmitClaim (initial average = `352515`, after optimizing = `352411`)

- Use `++nonce` instead of `nonce++` (nonce is a state variable)
  - [line 212](https://github.com/hats-finance/hats-contracts/blob/15b37a68f97f8f737a8808a9ff55d60bc2376d7e/contracts/HATVault.sol#L212)
- for calculations that wont overflow or underflow, use the `unchecked{}` block
  - [line 208-209](https://github.com/hats-finance/hats-contracts/blob/15b37a68f97f8f737a8808a9ff55d60bc2376d7e/contracts/HATVault.sol#L208-209)
- making a privileged function payable would save gas

### challengeClaim (initial average = `63089`, after optimizing =`63017` )

- for calculations that wont overflow or underflow, use the `unchecked{}` block
  - [line 244](https://github.com/hats-finance/hats-contracts/blob/15b37a68f97f8f737a8808a9ff55d60bc2376d7e/contracts/HATVault.sol#L244)

### approveClaim (initial average = `410813`, after optimizing = `410602`)

- for calculations that wont overflow or underflow, use the `unchecked{}` block
  - [line 261](https://github.com/hats-finance/hats-contracts/blob/15b37a68f97f8f737a8808a9ff55d60bc2376d7e/contracts/HATVault.sol#L261)
  - [line 270](https://github.com/hats-finance/hats-contracts/blob/15b37a68f97f8f737a8808a9ff55d60bc2376d7e/contracts/HATVault.sol#L270)
  - [line 282](https://github.com/hats-finance/hats-contracts/blob/15b37a68f97f8f737a8808a9ff55d60bc2376d7e/contracts/HATVault.sol#L282)

* ## HATTimeLockController

- making priviledged functions payable would save some gas

### `approveClaim` before adding payable average was `458758`

- aftter adding payable average cost is `458734`
- saved 24 gas

### Doing the same with all the functions in `HATTimeLockController.sol`, also saved some gas

- ## HATTokenLock

#### since the `delegate()` function is a priviledged function making it payable would save some gas

- [line 46](https://github.com/hats-finance/hats-contracts/blob/15b37a68f97f8f737a8808a9ff55d60bc2376d7e/contracts/tokenlock/HATTokenLock.sol#L46)

* ## HATVaultRegistry

### logClaim

- in [`logclaim`](https://github.com/hats-finance/hats-contracts/blob/15b37a68f97f8f737a8808a9ff55d60bc2376d7e/contracts/HATVaultsRegistry.sol#L146) payable(address).transfer(), would take a constant gas of `21000`
  - use `address.call` instead

### swapAndSend (before optimizing = `442149`, after optimzing = `442011`)

- use very efficient loops in `swapAndSend`, using unchecked increments, like `unchecked {++i;}`,and dont access an array's length in every iteration(cache the array's length in a local variable

  - [line 322](https://github.com/hats-finance/hats-contracts/blob/15b37a68f97f8f737a8808a9ff55d60bc2376d7e/contracts/HATVaultsRegistry.sol#L322)
  - [line 332](https://github.com/hats-finance/hats-contracts/blob/15b37a68f97f8f737a8808a9ff55d60bc2376d7e/contracts/HATVaultsRegistry.sol#L332)

# <img src="https://raw.githubusercontent.com/hats-finance/icons/main/hats.svg" alt="Hats.Finance" text="sds" height="40px"> Hats.Finance | Contracts

[![Coverage Status](https://coveralls.io/repos/github/hats-finance/hats-contracts/badge.svg?t=Ko4Ndz&kill_cache=2)](https://coveralls.io/github/hats-finance/hats-contracts)

The Hats protocol is designed to give white hats hackers the opportunity to gain more on their good behaviour and contribution. Trying to tilt the balance of incentives, and incentivizing more hackers to act responsively. It is doing so by letting projects publish on-chain bounties for their protocols, with committees in-charge of approving or rejecting claims. To further increase the efficiency of this model, the HAT token is introduced, to help bootstrap both ends in this two-sided market.

## Overview

### Usage

Installation:

```
npm install
```

Create `.env` files as needed. There is a file called `.env.example` that you can use as a template.

Run the tests:

```
npx hardhat test
```

## Security

Audit reports are in the [audit](./audit) directory.

Please report any security issues you find to contact@hats.finance

## Check deployment

`npx hardhat run --network {rinkeby|mainnet} scripts/checks/check.js`

## Contribute

## License

Hats.finance is released under the [MIT License](LICENSE).
