const func = async function (hre) {
    const { deployments, getNamedAccounts } = hre;
    const { deploy, execute } = deployments;

    const { deployer } = await getNamedAccounts();


    await deploy('HATGovernanceArbitrator', {
        from: deployer,
        args: [],
        log: true,
    });

    await execute('HATGovernanceArbitrator', { from: deployer, log: true }, 'transferOwnership', (await deployments.get('HATTimelockController')).address);
};
module.exports = func;
func.tags = ['HATGovernanceArbitrator'];
