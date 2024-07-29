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

## Deployment

Please refer to [deployment](./docs/deployment.md) for information about deploying. For a quick sanity check of the deployment, you can run:

`npx hardhat deploy --network {rinkeby|mainnet} --tags verify`

## Contribute

PRs are welcome - but you may want to coordinate with kufi@hats.finance to coordinate before spending a lot of time on our code

## License

Hats.finance is released under the [MIT License](LICENSE).
