const CONFIG = require("../config.json");
const { network } = require("hardhat");

const func = async function (hre) {
    const config = CONFIG[network.name];
    const { deployments, getNamedAccounts } = hre;
    const { deploy, execute } = deployments;

    const { deployer } = await getNamedAccounts();

    let bountyGovernanceHAT = config["hatVaultsRegistryConf"]["bountyGovernanceHAT"];
    let bountyHackerHATVested = config["hatVaultsRegistryConf"]["bountyHackerHATVested"];

    await deploy('HATVaultsRegistry', {
        from: deployer,
        args: [
            (await deployments.get('HATVault')).address,
            (await deployments.get('HATTimelockController')).address,
            (await deployments.get('HATGovernanceArbitrator')).address,
            (await deployments.get('HATToken')).address, // TODO: Add swap token to config
            bountyGovernanceHAT,
            bountyHackerHATVested,
            (await deployments.get('TokenLockFactory')).address,
        ],
        log: true,
    });
};
module.exports = func;
func.tags = ['HATVaultsRegistry'];
