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

    await deploy('FeeForwarder', {
        from: deployer,
        args: [governance],
        log: true,
    });
};
module.exports = func;
func.tags = ['FeeForwarder'];
