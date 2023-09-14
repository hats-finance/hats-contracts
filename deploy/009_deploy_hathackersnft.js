const CONFIG = require("../config.js");

const func = async function (hre) {
    const config = CONFIG[network.name];
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;

    const { deployer } = await getNamedAccounts();

    let governance = config["governance"];
    if (!governance) {
        governance = deployer;
    }

    await deploy('HATHackersNFT', {
        from: deployer,
        args: [governance],
        log: true,
    });
};

module.exports = func;
func.tags = ['HATHackersNFT'];
