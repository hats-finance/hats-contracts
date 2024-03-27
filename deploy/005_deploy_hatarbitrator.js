const { network } = require("hardhat");
const CONFIG = require("../config.js");

const func = async function (hre) {
    const config = CONFIG[network.name];
    const { deployments, getNamedAccounts } = hre;
    const { deploy, execute, read } = deployments;

    const { deployer } = await getNamedAccounts();

    await deploy('HATArbitrator', {
        from: deployer,
        args: [
            config.hatArbitratorConf.expertCommittee,
            config.hatArbitratorConf.token,
            config.hatArbitratorConf.bondsNeededToStartDispute,
            config.hatArbitratorConf.minBondAmount,
            config.hatArbitratorConf.resolutionChallengePeriod,
            config.hatArbitratorConf.submitClaimRequestReviewPeriod
        ],
        log: true,
    });

    await deploy('HATKlerosConnector', {
        from: deployer,
        args: [
            config.hatKlerosConnectorConf.klerosArbitrator,
            config.hatKlerosConnectorConf.arbitratorExtraData,
            (await deployments.get('HATArbitrator')).address,
            config.hatKlerosConnectorConf.metaEvidence,
            config.hatKlerosConnectorConf.winnerMultiplier,
            config.hatKlerosConnectorConf.loserMultiplier
        ],
        log: true,
    });

    if((await read('HATArbitrator', {}, 'court')) !== (await deployments.get('HATKlerosConnector')).address) {
        await execute('HATArbitrator', { from: deployer, log: true }, 'setCourt', (await deployments.get('HATKlerosConnector')).address);
    }

    if ((await read('HATArbitrator', {}, 'owner')) !== (await deployments.get('HATTimelockController')).address) {
        await execute('HATArbitrator', { from: deployer, log: true }, 'transferOwnership', (await deployments.get('HATTimelockController')).address);
    }

    if ((await read('HATKlerosConnector', {}, 'owner')) !== (await deployments.get('HATTimelockController')).address) {
        await execute('HATKlerosConnector', { from: deployer, log: true }, 'transferOwnership', (await deployments.get('HATTimelockController')).address);
    }
};

module.exports = func;
func.tags = ['HATArbitrator'];
