const CONFIG = require("../config.js");
const { network } = require("hardhat");

const func = async function (hre) {
    const config = CONFIG[network.name];
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;

    const { deployer } = await getNamedAccounts();
    
    let governance = config["governance"];
    if (!governance && network.name === "hardhat") {
        governance = deployer;
    }

    let governanceFee = config.hatVaultsRegistryConf.governanceFee;
    let governanceFeeReceiver = config.hatVaultsRegistryConf.governanceFeeReceiver;

    if (!governanceFeeReceiver) {
        governanceFeeReceiver = governance;
    }

    await deploy('HATVaultsRegistry', {
        from: deployer,
        args: [
            (await deployments.get('HATVault')).address,
            (await deployments.get('HATClaimsManager')).address,
            (await deployments.get('HATTimelockController')).address,
            (await deployments.get('HATGovernanceArbitrator')).address,
            governanceFee,
            governanceFeeReceiver,
            (await deployments.get('TokenLockFactory')).address
        ],
        log: true,
    });
};
module.exports = func;
func.tags = ['HATVaultsRegistry'];
