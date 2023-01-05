const CONFIG = require("../config.json");
const { network } = require("hardhat");

const func = async function (hre) {
    const config = CONFIG[network.name];
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;

    const { deployer } = await getNamedAccounts();

    const rewardControllers = [];
    const rewardControllerImplementations = [];
    let i = 1;

    for (const rewardControllerConfig of config["rewardControllersConf"]) {
        let startBlock = rewardControllerConfig["startBlock"];
        if (!startBlock) {
            startBlock = await ethers.provider.getBlockNumber();
        }
        let epochLength = rewardControllerConfig["epochLength"];
        let epochRewardPerBlock = rewardControllerConfig["epochRewardPerBlock"];

        // TODO: This also deploys new implementation every time, need to find out how to only deploy a new proxy but not new implementation
        await deploy('RewardController_' + i, {
            contract: "RewardController",
            from: deployer,
            log: true,
            proxy: {
                proxyContract: "OpenZeppelinTransparentProxy",
                execute: {
                    init: {
                        methodName: "initialize",
                        args: [
                            (await deployments.get('HATToken')).address, // TODO: Allow to set token in the config
                            (await deployments.get('HATTimelockController')).address, 
                            startBlock, 
                            epochLength, 
                            epochRewardPerBlock
                        ],
                    }
                }
            }
        });
        rewardControllers.push((await deployments.get('RewardController_' + i)).address);
        rewardControllerImplementations.push((await deployments.get('RewardController_' + i)).implementation);
        i++;
    }

};
module.exports = func;
func.tags = ['RewardControllers'];
