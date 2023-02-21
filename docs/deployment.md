# Deployment 

We'll run through an example on ethereums Sepolia test-net

## Create a `.env` file

Create a `.env` file if it does not exist - you can copy `.env.example`, and add the private key you want to use for the deployment

> The deploymnet scripts only support deploying with a private key - i.e. no hardware signers are supported

## Let hardhat know about the network

First we add a section to the `networks` section of the [hardhat.config.js](../hardhat.config.js) file:
```
    sepolia: {
      url: `https://rpc.sepolia.dev`,
      accounts: [process.env.SEPOLIA_PK],
      gasPrice: "auto",
      gas: "auto",
    }
```
we use the `SEPOLIA_PK` is the private key of the account from which the contracts will be deployed, which you should set in the `.env` file.


## Choose the settings of the HATVaultsRegistry

In the file [config.js](../config.js), we add a section for the sepolia network:

```
    "sepolia": {
      "governance": "0xFc9F1d127f8047B0F41e9eAC2Adc2e5279C568B7",
      "timelockDelay": 300,
      "executors": [], // proposal executors - if this empty, governance will be an executor
      "rewardControllersConf": [], // no reward controllers
      "hatToken": "",  // deploy a fresh HATToken contract
      "hatVaultsRegistryConf": {
        "bountyGovernanceHAT": "0",
        "bountyHackerHATVested": "0"
      }
    }
```

## Deploy the contracts 

Run the command:

```
npx hardhat deploy --network sepolia
```
This will compile the contracts in the `contracts` directory and then run the deployment scripts that are defined in the [deploy](../deploy/) directory

You can run separate steps of the deployment scipts using the `--tags` flag, for example::

```
npx hardhat deploy --network sepolia --tags HATVaultsNFT
```

## Verifying the deployment

The following command will run a number of sanity checks on the deployment:

```
npx hardhat --network sepolia etherscan-verify
```

## Deploymnet artefacts

The deploy procedure will write some information about the deployment to the `deployments` directory. Consider committing this information to the git repository for future reference.





