const func = async function (hre) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  await deploy('HATTokenLock', {
    from: deployer,
    args: [],
    log: true,
  });

  await deploy('TokenLockFactory', {
    from: deployer,
    args: [
      (await deployments.get('HATTokenLock')).address,
      (await deployments.get('HATTimelockController')).address
    ],
    log: true,
  });
};
module.exports = func;
func.tags = ['TokenLockFactory'];
