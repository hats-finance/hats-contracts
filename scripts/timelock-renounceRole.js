const { network } = require("hardhat");
const CONFIG = require("./addresses.json");
const HATTimelockController = artifacts.require("./HATTimelockController.sol");

async function main(config) {
  // This is just a convenience check
  if (!config) {
    config = CONFIG[network.name];
  }

  var deployer;
  if (config.deployer) {
    deployer = config.deployer;
  } else {
    [deployer] = await ethers.getSigners();
    deployer = await deployer.getAddress();
  }
  const hatTimelockController = await HATTimelockController.at(config.timelock);
  // the deployer automatically gets the admin role, which we renounce (so all admin has to go through the proposer)
  const TIMELOCK_ADMIN_ROLE =
    "0x5f58e3a2316349923ce3780f8d587db2d72378aed66a8261c916544fa6846ca5";

  console.log(`renouncing from admin role..`);
  await hatTimelockController.renounceRole(TIMELOCK_ADMIN_ROLE, deployer);
  console.log(`renouncing done`);

  return hatTimelockController;
}
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { renounceRole: main };
