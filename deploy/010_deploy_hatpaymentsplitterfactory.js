const func = async function (hre) {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;

    const { deployer } = await getNamedAccounts();

    await deploy('HATPaymentSplitter', {
        from: deployer,
        args: [],
        log: true,
    });

    await deploy('HATPaymentSplitterFactory', {
        from: deployer,
        args: [
        (await deployments.get('HATPaymentSplitter')).address,
        ],
        log: true,
    });
};

module.exports = func;
func.tags = ['HATPaymentSplitterFactory'];