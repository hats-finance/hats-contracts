const { network } = require("hardhat");
const CONFIG = require("./addresses.js");
const { verifyTimelock } = require("./timelock-verify.js");
const { renounceRole } = require("./timelock-renounceRole.js");

async function main(config) {
  // This is just a convenience check
  if (!config) {
    config = CONFIG[network.name];
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
    hatGovernanceDelay = 60 * 60 * 24 * 7; // 7 days
  }
  const hatVaultsAddress = config.hatVaultsAddress;
  let executors = config.executors;

  console.log("Account balance:", (await deployer.getBalance()).toString());

  const HATTimelockController = await ethers.getContractFactory(
    "HATTimelockController"
  );
  console.log(`waiting for HATTimeLockController to deploy..`);
  console.log("Deploying the contracts with the account:", deployerAddress);
  var hatTimelockController;
  if (network.name !== "hardhat") {
    hatTimelockController = await HATTimelockController.deploy(
      hatVaultsAddress,
      hatGovernanceDelay, // minDelay
      [governance], // proposers
      executors // executors
    );
    await hatTimelockController.deployed();
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

  // We also save the contract's artifacts and address in the frontend directory
  if (network.name !== "hardhat") {
    await verifyTimelock(
      config.update({ timelock: hatTimeLockController.address })
    );
    saveFrontendFiles(hatTimelockController, "HATTimelockController");
  }
  //verify

  return hatTimelockController;
}

function saveFrontendFiles(contract, name) {
  const fs = require("fs");
  const contractsDir = __dirname + "/../frontend/src/contracts";

  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir, { recursive: true });
  }

  var data = JSON.parse(
    fs.readFileSync(contractsDir + "/contract-address.json", {
      encoding: "utf8",
      flag: "r",
    })
  );
  data[name] = contract.address;

  fs.writeFileSync(
    contractsDir + "/contract-address.json",
    JSON.stringify(data, undefined, 2)
  );

  const HATTimelockControllerArtifact = artifacts.readArtifactSync(
    "HATTimelockController"
  );

  fs.writeFileSync(
    contractsDir + "/HATTimelockController.json",
    JSON.stringify(HATTimelockControllerArtifact, null, 2)
  );
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
