const CONFIG = require("../config.json");
const { network } = require("hardhat");

const func = async function (hre) {
    const config = CONFIG[network.name];
    const { deployments, getNamedAccounts } = hre;
    const { deploy, execute } = deployments;

    const { deployer } = await getNamedAccounts();

    let bountyGovernanceHAT = config["hatVaultsRegistryConf"]["bountyGovernanceHAT"];
    let bountyHackerHATVested = config["hatVaultsRegistryConf"]["bountyHackerHATVested"];
    let swapToken = config["hatVaultsRegistryConf"]["swapToken"];
    if (!swapToken || swapToken === "HATToken") {
        swapToken = (await deployments.get('HATToken')).address;  
    }

    await deploy('HATVaultsRegistry', {
        from: deployer,
        args: [
            (await deployments.get('HATVault')).address,
            (await deployments.get('HATTimelockController')).address,
            (await deployments.get('HATGovernanceArbitrator')).address,
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
