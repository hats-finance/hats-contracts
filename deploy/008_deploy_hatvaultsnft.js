const CONFIG = require("../config.js");
const { network } = require("hardhat");

const func = async function (hre) {
    const config = CONFIG[network.name];
    const { deployments, getNamedAccounts } = hre;
    const { deploy, execute, read } = deployments;

    const { deployer } = await getNamedAccounts();

    await deploy('HATVaultsV2Data', {
        from: deployer,
        args: [
            (await deployments.get('HATVaultsRegistry')).address
        ],
        log: true,
    });

    const nftConfig = config.hatVaultsNFTConf || {};
    let merkleTreeIPFSRef = nftConfig.merkleTreeIPFSRef;
    if (!merkleTreeIPFSRef) {
        merkleTreeIPFSRef = "";
    }

    let root = nftConfig.root;
    if (!root) {
        root = ethers.constants.HashZero;
    }

    let deadline = nftConfig.deadline;
    if (!deadline) {
        const now = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp;
        deadline = now + (5 * 60);
    }

    await deploy('HATVaultsNFT', {
        from: deployer,
        args: [
            merkleTreeIPFSRef,
            root,
            deadline
        ],
        log: true,
    });

    let governance = config["governance"];
    if (!governance && network.name === "hardhat") {
        governance = deployer;
    }

    if ((await read('HATVaultsNFT', {}, 'owner')) !== governance) {
        await execute('HATVaultsNFT', { from: deployer, log: true }, 'transferOwnership', governance);
    }
};
module.exports = func;
func.tags = ['HATVaultsNFT'];
