const { network } = require("hardhat");
const CONFIG = require("./config.json");

const TIMELOCK_ADMIN_ROLE = "0x5f58e3a2316349923ce3780f8d587db2d72378aed66a8261c916544fa6846ca5";

async function main(config) {
    if (!config) {
        config = CONFIG[network.name];
    }

    const silent = config["silent"] === true;

    const [deployer] = await ethers.getSigners();
    const deployerAddress = await deployer.getAddress();

    let governance = config["governance"];
    if (!governance && network.name === "hardhat") {
        governance = deployerAddress;
    }

    let hatGovernanceDelay;
    if (config["timelockDelay"]) {
        hatGovernanceDelay = config["timelockDelay"];
    } else {
        hatGovernanceDelay = network.name === "mainnet" ?  60 * 60 * 24 * 7 : 60 * 5; // 7 days for mainnet or 5 minutes for testnets
    }

    let executors = config["executors"];
    if (!executors) {
        executors = [governance];
    }

    if (executors.indexOf(governance) === -1) {
        executors.push(governance);
    }

    const HATTimelockController = await ethers.getContractFactory(
        "HATTimelockController"
    );

    let hatTimelockController = await HATTimelockController.deploy(
        hatGovernanceDelay, // minDelay
        [governance], // proposers
        executors // executors
    );
    await hatTimelockController.deployed();
    
    if (!silent) {
        console.log("HATTimelockController address: " + hatTimelockController.address);
    }

    // the deployer automatically gets the admin role, which we renounce (so all admin has to go through the proposer)
    // TODO: Remove this with OpenZepellin 4.8.0
    await hatTimelockController.renounceRole(TIMELOCK_ADMIN_ROLE, deployerAddress);

    if (!silent) {
        console.log(`Deployer renounced admin role`);
    }

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

module.exports = { deployHATTimelockController: main };
