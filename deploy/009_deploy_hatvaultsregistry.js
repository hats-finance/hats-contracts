const CONFIG = require("../config.js");
const { network } = require("hardhat");

const func = async function (hre) {
    const config = CONFIG[network.name];
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;

    const { deployer } = await getNamedAccounts();

    let bountyGovernanceHAT = config.hatVaultsRegistryConf.bountyGovernanceHAT;
    let bountyHackerHATVested = config.hatVaultsRegistryConf.bountyHackerHATVested;
    let swapToken = config.hatVaultsRegistryConf.swapToken;
    let useKleros = config.hatVaultsRegistryConf.useKleros;
    if (!swapToken || swapToken === "HATToken") {
        swapToken = (await deployments.get('HATToken')).address;  
    }

    await deploy('HATVaultsRegistry', {
        from: deployer,
        args: [
            (await deployments.get('HATVault')).address,
            (await deployments.get('HATClaimsManager')).address,
            (await deployments.get('HATTimelockController')).address,
            useKleros ? (await deployments.get('HATArbitrator')).address : (await deployments.get('HATGovernanceArbitrator')).address,
            swapToken,
            bountyGovernanceHAT,
            bountyHackerHATVested,
            (await deployments.get('TokenLockFactory')).address,
        ],
        log: true,
    });
};
module.exports = func;
func.tags = ['HATVaultsRegistry'];
