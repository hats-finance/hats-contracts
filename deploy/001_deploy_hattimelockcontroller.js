const CONFIG = require("../config.js");
const { network } = require("hardhat");
const TIMELOCK_ADMIN_ROLE = "0x5f58e3a2316349923ce3780f8d587db2d72378aed66a8261c916544fa6846ca5";

const func = async function (hre) {
  const config = CONFIG[network.name];
  const { deployments, getNamedAccounts } = hre;
  const { deploy, execute, read } = deployments;

  const { deployer } = await getNamedAccounts();
  console.log("................", deployer);
  
  let governance = config["governance"];
  if (!governance && network.name === "hardhat") {
    governance = deployer;
  }

  let hatGovernanceDelay = config.timelockDelay;

  let executors = config.executors;
  if (!executors && network.name === "hardhat") {
    executors = [governance];
  }

  if (executors.indexOf(governance) === -1) {
    executors.push(governance);
  }

  await deploy('HATTimelockController', {
    from: deployer,
    args: [
      hatGovernanceDelay, // minDelay
      [governance], // proposers
      executors // executors
    ],
    log: true,
  });

  if ((await read('HATTimelockController', {}, 'hasRole', TIMELOCK_ADMIN_ROLE, deployer))) {
    await execute('HATTimelockController', { from: deployer, log: true }, 'renounceRole', TIMELOCK_ADMIN_ROLE, deployer);
  }
};
module.exports = func;
func.tags = ['HATTimelockController'];
