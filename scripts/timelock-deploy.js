const { network } = require("hardhat");
const ADDRESSES = require("./addresses.json");
const { renounceRole } = require("./timelock-renounceRole.js");
const fs = require("fs");

let hatTimelockController;

async function main(config) {
  // This is just a convenience check
  if (!config) {
    config = ADDRESSES[network.name];
  }
  const addresses = config;

  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();

  let governance = addresses.governance;
  if (!governance && network.name === "hardhat") {
    governance = deployerAddress;
  }

  var hatGovernanceDelay;
  if (config.minDelay) {
    hatGovernanceDelay = config.minDelay;
  } else {
    hatGovernanceDelay = network.name === "mainnet" ?  60 * 60 * 24 * 7 : 60 * 5; // 7 days for mainnet or 5 minutes for testnets
  }
  const hatVaultsAddress = config.hatVaults;
  let executors = config.executors;

  console.log("Account balance:", (await deployer.getBalance()).toString());

  const HATTimelockController = await ethers.getContractFactory(
    "HATTimelockController"
  );
  console.log(`waiting for HATTimeLockController to deploy..`);
  console.log("Deploying the contracts with the account:", deployerAddress);
  if (network.name !== "hardhat") {
    let timelock = await HATTimelockController.deploy(
      hatVaultsAddress,
      hatGovernanceDelay, // minDelay
      [governance], // proposers
      executors // executors
    );
    await timelock.deployed();

    ADDRESSES[network.name]["timelock"] = timelock.address;
    fs.writeFileSync(__dirname + '/addresses.json', JSON.stringify(ADDRESSES, null, 2));
    //verify
    try {
      await hre.run("verify:verify", {
        address: timelock.address,
        constructorArguments: [
          hatVaultsAddress,
          hatGovernanceDelay,
          [governance],
          executors,
        ],
      });
    } catch (error) {
      console.log("Verification failed with error: " + error);
    }

    hatTimelockController = timelock;
  } else {
    // if network is hardhat, then we are running a test, and we use a different deploymnet method
    const HATTimelockControllerArtifact = artifacts.require(
      "./HATTimelockController.sol"
    );
    if (!executors) {
      executors = [deployerAddress];
    }
    hatTimelockController = await HATTimelockControllerArtifact.new(
      hatVaultsAddress,
      hatGovernanceDelay, // minDelay
      [governance], // proposers
      executors // executors
    );
  }
  console.log(
    `HATTimeLockController is deployed at`,
    hatTimelockController.address
  );

  // the deployer automatically gets the admin role, which we renounce (so all admin has to go through the proposer)
  await renounceRole({
    timelock: hatTimelockController.address,
    deployer: deployer.address,
  });

  return hatTimelockController;
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { deployTimelock: main };
