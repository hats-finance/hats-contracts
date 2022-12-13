const { getImplementationAddress } = require("@openzeppelin/upgrades-core");
const CONFIG = require("./config.json");

async function main(config) {
    if (!config) {
        config = CONFIG[network.name];
    }

    const silent = config["silent"] === true;

    const [deployer] = await ethers.getSigners();
    const deployerAddress = await deployer.getAddress();

    let governance = config["governance"];
    let arbitrator = config["arbitrator"];

    if (config["hatTimelockController"]) {
        governance = config["hatTimelockController"];
    } else if (!governance && network.name === "hardhat") {
        governance = deployerAddress;
    }

    if (!arbitrator) {
        const HATGovernanceArbitrator = await ethers.getContractFactory("HATGovernanceArbitrator");
        const hatGovernanceArbitrator = await HATGovernanceArbitrator.deploy();
        await hatGovernanceArbitrator.deployed();
        await hatGovernanceArbitrator.transferOwnership(governance);
        arbitrator = hatGovernanceArbitrator.address;
        if (!silent) {
            console.log("HATGovernanceArbitrator address: " + arbitrator);
        }
    }

    let hatToken = config["hatToken"];

    if (!hatToken && network.name === "hardhat") {
        hatToken = "0x51a6Efc15c50EcE1DaAD1Ee4fbF8DEC76584c365";
    }

    let rewardToken = config["rewardToken"];

    if (!rewardToken && network.name === "hardhat") {
        rewardToken = "0x51a6Efc15c50EcE1DaAD1Ee4fbF8DEC76584c365";
    }

    let startBlock = config["rewardController"]["startBlock"];
    if (!startBlock) {
        startBlock = await ethers.provider.getBlockNumber();
    }
    let epochLength = config["rewardController"]["epochLength"];
    let epochRewardPerBlock = config["rewardController"]["epochRewardPerBlock"];

    const RewardController = await ethers.getContractFactory("RewardController");
    const rewardController = await upgrades.deployProxy(RewardController, [
        (network.name == "hardhat" ? rewardToken : hatToken),
        governance,
        startBlock,
        epochLength,
        epochRewardPerBlock
    ]);

    await rewardController.deployed();

    const rewardControllerImplementation = RewardController.attach(
        await getImplementationAddress(ethers.provider, rewardController.address)
    );

    if (!silent) {
        console.log("RewardController address: " + rewardController.address);
        console.log("RewardControllerImplementation address: " + rewardControllerImplementation.address);
    }

    const HATVault = await ethers.getContractFactory("HATVault");
    const hatVaultImplementation = await HATVault.deploy();
    await hatVaultImplementation.deployed();

    if (!silent) {
        console.log("HATVault implementation address: " + hatVaultImplementation.address);
    }
    let tokenLockFactory = config["tokenLockFactory"];

    if (!tokenLockFactory && network.name === "hardhat") {
        tokenLockFactory = "0x6E6578bC77984A1eF3469af009cFEC5529aEF9F3";
    }

    let bountyGovernanceHAT = config["hatVaultsRegistry"]["bountyGovernanceHAT"];
    let bountyHackerHATVested = config["hatVaultsRegistry"]["bountyHackerHATVested"];

    const HATVaultsRegistry = await ethers.getContractFactory("HATVaultsRegistry");
    const hatVaultsRegistry = await HATVaultsRegistry.deploy(
        hatVaultImplementation.address,
        governance,
        arbitrator,
        hatToken,
        bountyGovernanceHAT,
        bountyHackerHATVested,
        tokenLockFactory,
    );

    await hatVaultsRegistry.deployed();

    if (!silent) {
        console.log("HATVaultsRegistry address:", hatVaultsRegistry.address);
    }

    return { hatVaultsRegistry, rewardController, rewardControllerImplementation, hatVaultImplementation, arbitrator };
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
}

module.exports = { deployHATVaults: main };
