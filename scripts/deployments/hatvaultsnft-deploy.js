const { network } = require("hardhat");
const CONFIG = require("./config.json");

async function main(config) {
    if (!config) {
        config = CONFIG[network.name];
    }

    const silent = config["silent"] === true;

    const [deployer] = await ethers.getSigners();
    const deployerAddress = await deployer.getAddress();

    let hatVaultsRegistry = config["hatVaultsRegistry"];
    if (!hatVaultsRegistry && network.name === "hardhat") {
        hatVaultsRegistry = "0x8B5B7a6055E54a36fF574bbE40cf2eA68d5554b3";
    }

    const HATVaultsV2Data = await ethers.getContractFactory("HATVaultsV2Data");
    const hatVaultsV2Data = await HATVaultsV2Data.deploy(hatVaultsRegistry);
    await hatVaultsV2Data.deployed();

    if (!silent) {    
        console.log("HATVaultsV2Data address: " + hatVaultsV2Data.address);
    }

    let merkleTreeIPFSRef = config["hatVaultsNFTConf"]["merkleTreeIPFSRef"];
    if (!merkleTreeIPFSRef) {
        merkleTreeIPFSRef = "";
    }

    let root = config["hatVaultsNFTConf"]["root"];
    if (!root) {
        root = ethers.constants.HashZero;
    }

    let deadline = config["hatVaultsNFTConf"]["deadline"];
    if (!deadline) {
        const now = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp;
        deadline = now + (5 * 60);
    }

    const HATVaultsNFT = await ethers.getContractFactory("HATVaultsNFT");
    const hatVaultsNFT = await HATVaultsNFT.deploy("", root, deadline);
    await hatVaultsNFT.deployed();

    if (!silent) {    
        console.log("HATVaultsNFT address: " + hatVaultsNFT.address);
    }

    let governance = config["governance"];
    if (!governance && network.name === "hardhat") {
        governance = deployerAddress;
    }

    if (governance !== deployerAddress) {
        await hatVaultsNFT.transferOwnership(governance);
        if (!silent) {    
            console.log("HATVaultsNFT ownership transffered to governance");
        }
    }

    return { hatVaultsV2Data, hatVaultsNFT, merkleTreeIPFSRef, root, deadline };
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
}

module.exports = { deployHATVaultsNFT: main };
