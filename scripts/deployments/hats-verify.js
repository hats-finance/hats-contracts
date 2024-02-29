const CONFIG = require("./config.json");
const ADDRESSES = require("./addresses.json");

async function main(addresses, config) {
  if (!config) {
    config = CONFIG[network.name];
  }

  if (!addresses) {
    addresses = ADDRESSES[network.name];
  }

  let hatTimelockController = addresses["hatTimelockController"];
  let governance = config["governance"];
  let hatGovernanceDelay;
  if (config["timelockDelay"]) {
      hatGovernanceDelay = config["timelockDelay"];
  } else {
      hatGovernanceDelay = network.name === "mainnet" ?  60 * 60 * 24 * 7 : 60 * 5; // 7 days for mainnet or 5 minutes for testnets
  }
  let executors = config["executors"];
  if (!executors) {
      executors = [governance];
  }

  if (executors.indexOf(governance) === -1) {
      executors.push(governance);
  }
  
  await verifyContract(hatTimelockController, [
    hatGovernanceDelay,
    [governance],
    executors,
  ]);

  let hatToken = addresses["hatToken"];
  await verifyContract(hatToken, [hatTimelockController]);

  let hatTokenLock = addresses["hatTokenLock"];
  let tokenLockFactory = addresses["tokenLockFactory"];

  await verifyContract(hatTokenLock, []);
  await verifyContract(tokenLockFactory, [hatTokenLock, hatTimelockController]);

  let arbitrator = addresses["arbitrator"];
  let hatVaultsRegistry = addresses["hatVaultsRegistry"];
  let rewardControllerImplementations = addresses["rewardControllerImplementations"];
  let hatVaultImplementation = addresses["hatVaultImplementation"];

  let governanceFee = config["hatVaultsRegistryConf"]["governanceFee"];
  let governanceFeeReceiver = config["hatVaultsRegistryConf"]["governanceFeeReceiver"];

    if (!governanceFeeReceiver) {
        governanceFeeReceiver = governance;
    }

  await verifyContract(arbitrator, []);
  for (const rewardControllerImplementation of rewardControllerImplementations ) {
      await verifyContract(rewardControllerImplementation, []);
  }
  await verifyContract(hatVaultImplementation, []);
  await verifyContract(hatVaultsRegistry, [
    hatVaultImplementation,
    hatTimelockController,
    arbitrator,
    governanceFee,
    governanceFeeReceiver,
    tokenLockFactory
  ]);

  let hatVaultsV2Data = addresses["hatVaultsV2Data"];
  await verifyContract(hatVaultsV2Data, [hatVaultsRegistry]);

  let hatVaultsNFT = addresses["hatVaultsNFT"];
  let merkleTreeIPFSRef = config["hatVaultsNFTConf"]["merkleTreeIPFSRef"];
  let root = config["hatVaultsNFTConf"]["root"];
  let deadline = config["hatVaultsNFTConf"]["deadline"];

  await verifyContract(hatVaultsNFT, [merkleTreeIPFSRef, root, deadline]);
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

module.exports = { hatsVerify: main };
