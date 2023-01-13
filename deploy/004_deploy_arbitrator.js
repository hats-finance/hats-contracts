const func = async function (hre) {
    const { deployments, getNamedAccounts } = hre;
    const { deploy, execute, read } = deployments;

    const { deployer } = await getNamedAccounts();


    await deploy('HATGovernanceArbitrator', {
        from: deployer,
        args: [],
        log: true,
    });

    if ((await read('HATGovernanceArbitrator', {}, 'owner')) !== (await deployments.get('HATTimelockController')).address) {
        await execute('HATGovernanceArbitrator', { from: deployer, log: true }, 'transferOwnership', (await deployments.get('HATTimelockController')).address);
    }
};
module.exports = func;
func.tags = ['HATGovernanceArbitrator'];
