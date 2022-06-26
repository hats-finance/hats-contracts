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
  const hatVaultsAddress = config.hatVaults;
  const executors = config.executors;
  console.log(`running verification script`);

  //verify
  await hre.run("verify:verify", {
    address: config.timelock,
    constructorArguments: [
      hatVaultsAddress,
      hatGovernanceDelay,
      [governance],
      executors,
    ],
  });
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
