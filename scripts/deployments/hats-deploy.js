let CONFIG = require("./config.json");
const ADDRESSES = require("./addresses.json");
const { deployHATToken } = require("./hattoken-deploy.js");
const { deployHATTimelockController } = require("./hattimelockcontroller-deploy.js");
const { deployTokenLockFactory } = require("./tokenlockfactory-deploy.js");
const { deployHATVaults } = require("./hatvaultsregistry-deploy.js");
const { hatsVerify } = require("./hats-verify.js");
const fs = require("fs");
const { network } = require("hardhat");

async function main() {
  const config = CONFIG[network.name];
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  console.log("Deploying the contracts with the account:", deployerAddress);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  let hatTimelockController = config["hatTimelockController"];
  if (!hatTimelockController) {
    console.log("Deploying HATTimelockController");
    hatTimelockController = (await deployHATTimelockController(config)).address;
  }

  config["hatTimelockController"] = hatTimelockController;

  let hatToken = config["hatToken"];
  if (!hatToken) {
    console.log("Deploying HATtoken");
    hatToken = (await deployHATToken(config)).address;
  }

  config["hatToken"] = hatToken;

  let hatTokenLock = config["hatTokenLock"];
  let tokenLockFactory = config["tokenLockFactory"];
  if (!tokenLockFactory) {
    console.log("Deploying TokenLockFactory");
    let deployment = (await deployTokenLockFactory(config));
    hatTokenLock = deployment.hatTokenLock.address;
    tokenLockFactory = deployment.tokenLockFactory.address;
  }

  config["hatTokenLock"] = hatTokenLock;
  config["tokenLockFactory"] = tokenLockFactory;

  console.log("Deploying HATVaults");
  let {
    hatVaultsRegistry,
    rewardControllers,
    rewardControllerImplementations,
    hatVaultImplementation,
    arbitrator
  } = (await deployHATVaults(config));

  config["arbitrator"] = arbitrator;
  config["hatVaultsRegistry"] = hatVaultsRegistry.address;
  config["rewardControllers"] = rewardControllers.map((x) => x.address);
  config["rewardControllerImplementation"] = rewardControllerImplementations.map((x) => x.address);
  config["hatVaultImplementation"] = hatVaultImplementation.address;

  ADDRESSES[network.name] = {
    governance: config["governance"],
    arbitrator: config["arbitrator"],
    hatTimelockController: config["hatTimelockController"],
    hatToken: config["hatToken"],
    hatTokenLock: config["hatTokenLock"],
    tokenLockFactory: config["tokenLockFactory"],
    hatVaultsRegistry: config["hatVaultsRegistry"],
    rewardControllers: config["rewardControllers"],
    rewardControllerImplementations: config["rewardControllerImplementations"] || [],
    hatVaultImplementation: config["hatVaultImplementation"]
  };
  const outputFile = __dirname + '/addresses.json';
  fs.writeFileSync(outputFile, JSON.stringify(ADDRESSES, null, 2));

  console.log(`Output written to ${outputFile}`);
  console.log(ADDRESSES[network.name]);
  if (network.name !== "hardhat") {
    console.log("Verifying contracts");
    await hatsVerify(ADDRESSES[network.name]).catch((error) => { 
      console.error("verification failed");
      console.error(error);
    });
  }
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
