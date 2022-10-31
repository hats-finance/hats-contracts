const { network } = require("hardhat");
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

    const HATToken = await ethers.getContractFactory("HATToken");
    const hatToken = await HATToken.deploy(governance);
    await hatToken.deployed();

    if (!silent) {    
        console.log("HATToken address: " + hatToken.address);
    }
    return hatToken;
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
}

module.exports = { deployHATToken: main };
