const { network } = require("hardhat");

const func = async function (hre) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  await deploy('HATToken', {
    from: deployer,
    args: [(await deployments.get('HATTimelockController')).address],
    log: true,
  });
};
module.exports = func;
func.tags = ['HATToken'];
func.skip = () => network.name !== "hardhat";
