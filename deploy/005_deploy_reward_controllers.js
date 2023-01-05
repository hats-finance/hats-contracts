const CONFIG = require("../config.json");
const { network } = require("hardhat");

const func = async function (hre) {
    const config = CONFIG[network.name];
    const { deployments, getNamedAccounts } = hre;
    const { deploy, execute } = deployments;

    const { deployer } = await getNamedAccounts();

    const rewardControllers = [];
    const rewardControllerImplementations = [];
    for (const rewardControllerConfig of config["rewardControllersConf"]) {
        let startBlock = rewardControllerConfig["startBlock"];
        if (!startBlock) {
            startBlock = await ethers.provider.getBlockNumber();
        }
        let epochLength = rewardControllerConfig["epochLength"];
        let epochRewardPerBlock = rewardControllerConfig["epochRewardPerBlock"];

        // console.log(await deploy('RewardController', {
        //     from: deployer,
        //     args: [
        //         (await deployments.get('HATToken')).address,
        //         (await deployments.get('HATTimelockController')).address, 
        //         startBlock, 
        //         epochLength, 
        //         epochRewardPerBlock
        //     ],
        //     log: true,
        //     proxy: "OptimizedTransparentProxy"
        // }));

        // const rewardController = await upgrades.deployProxy(RewardController, [
        //     hatToken,
        //     governance, 
        //     startBlock, 
        //     epochLength, 
        //     epochRewardPerBlock
        // ]);

        // await rewardController.deployed();

        // const rewardControllerImplementation = RewardController.attach(
        //   await getImplementationAddress(ethers.provider, rewardController.address)
        // );

        // rewardControllers.push(rewardController);
        // rewardControllerImplementations.push(rewardControllerImplementation);

    }
};
module.exports = func;
func.tags = ['RewardControllers'];
