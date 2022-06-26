const { network } = require("hardhat");
const CONFIG = require("./addresses.json");

async function main(config) {
  if (network.name === "hardhat") {
    throw Error(`Cannot verity contracts on local network "hardhat"`);
  }
  // This is just a convenience check
  if (!config) {
    config = CONFIG[network.name];
  }

  //constructor params for mainnet
  const governance = config.governance;
  var hatGovernanceDelay;
  if (config.minDelay) {
    hatGovernanceDelay = config.minDelay;
  } else {
    hatGovernanceDelay = network.name === "mainnet" ?  60 * 60 * 24 * 7 : 60 * 5; // 7 days for mainnet or 5 minutes for testnets
  }

  const tokenTimelockDelay = network.name === "mainnet" ? 3600 * 24 * 2 : 60 * 5; // 2 days for mainnet or 5 minutes for testnets

  const hatVaultsAddress = config.hatVaults;
  const executors = config.executors;
  console.log(`running verification script`);

  //verify

  await verifyContract(config.hatToken, [
    governance,
    tokenTimelockDelay,
  ]);

  await verifyContract(config.hatTokenLock, []);

  await verifyContract(config.tokenLockFactory, [
    config.hatTokenLock,
  ]);

  await verifyContract(config.rewardController, [
    governance,
    ...config.rewardControllerParams
  ]);

  await verifyContract(config.hatVaultsImplementation, []);

  await verifyContract(config.timelock, [
    hatVaultsAddress,
    hatGovernanceDelay,
    [governance],
    executors,
  ]);
}

async function verifyContract(address, args) {
  try {
    await hre.run("verify:verify", {
      address,
      constructorArguments: args,
    });
  } catch (error) {
    console.log("Verification failed with error: " + error);
  }
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { verifyTimelock: main };
