import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-truffle5";
import "solidity-coverage";
import "@nomiclabs/hardhat-etherscan";
import "hardhat-contract-sizer";
import "hardhat-watcher";
import "hardhat-gas-reporter";
import "@openzeppelin/hardhat-upgrades";
require("dotenv").config();

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
// task("accounts", "Prints the list of accounts", async (_, { ethers }) => {
//   const accounts = await ethers.getSigners();

//   for (const account of accounts) {
//     console.log(account.address);
//   }
// });

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  paths: {
    artifacts: "./build/contracts",
  },
  etherscan: {
    // Your API key for Etherscan
    // Obtain one at https://etherscan.io/
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  gasReporter: {
    enabled: true,
    currency: "USD",
    coinmarketcap: process.env.COINMARKETCAP,
    gasPrice: 100,
  },
  networks: {
    rinkeby: {
      url: `https://rinkeby.infura.io/v3/${process.env.INFURA_KEY}`,
      accounts: [process.env.RINKEBY_PK],
      gasPrice: "auto",
      gas: "auto",
    },
    mainnet: {
      url: `https://mainnet.infura.io/v3/${process.env.INFURA_KEY}`,
      accounts: [process.env.PRIVATE_KEY],
      gasPrice: "auto",
      gas: "auto",
    },
    hardhat: {
      allowUnlimitedContractSize: true,
    },
  },
  solidity: {
    version: "0.8.16",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  contractSizer: {
    alphaSort: false,
    runOnCompile: true,
    disambiguatePaths: true,
  },
  watcher: {
    compile: {
      tasks: ["compile"],
      files: ["./contracts"],
    },
    test: {
      tasks: ["test"],
      files: ["./test", "./contracts", "./scripts"],
    },
    "size-contracts": {
      tasks: ["size-contracts"],
      files: ["./contracts"],
    },
    check: {
      tasks: [
        {
          command: "run",
          params: { script: "./scripts/checks/hattimelockcontroller.js" },
        },
      ],
      files: ["./test", "./contracts", "./scripts"],
    },
  },
};
