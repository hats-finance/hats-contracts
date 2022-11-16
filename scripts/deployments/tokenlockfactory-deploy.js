
const CONFIG = require("./config.json");

async function main(config) {
  if (!config) {
    config = CONFIG[network.name];
  }

  const silent = config["silent"] === true;

  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();

  let governance = config["governance"];

  if (config["hatTimelockController"]) {
    governance = config["hatTimelockController"];
  } else if (!governance && network.name === "hardhat") {
    governance = deployerAddress;
  }

  const HATTokenLock = await ethers.getContractFactory("HATTokenLock");
  const hatTokenLock = await HATTokenLock.deploy();
  await hatTokenLock.deployed();

  if (!silent) {
    console.log("HATTokenLock address: " + hatTokenLock.address);
  }

  const TokenLockFactory = await ethers.getContractFactory("TokenLockFactory");
  const tokenLockFactory = await TokenLockFactory.deploy(hatTokenLock.address, governance);
  await tokenLockFactory.deployed();

  if (!silent) {
    console.log("TokenLockFactory address: " + tokenLockFactory.address);
  }

  return { hatTokenLock, tokenLockFactory };
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { deployTokenLockFactory: main };
