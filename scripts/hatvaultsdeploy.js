const ADDRESSES = require("./addresses.js");
async function main(
  rewardsToken = "0x51a6Efc15c50EcE1DaAD1Ee4fbF8DEC76584c365",
  startBlock = null,
  rewardPerEpoch,
  epochLength = "195200",
  governance = ADDRESSES[network.name].governance,
  swapToken = "0x51a6Efc15c50EcE1DaAD1Ee4fbF8DEC76584c365",
  whitelistedRouters = ["0xE592427A0AEce92De3Edee1F18E0157C05861564"],
  tokenLockFactory = "0x6E6578bC77984A1eF3469af009cFEC5529aEF9F3",
  silent = false
) {
  // This is just a convenience check
  if (network.name === "hardhat" && !silent) {
    console.warn(
      "You are trying to deploy a contract to the Hardhat Network, which" +
        "gets automatically created and destroyed every time. Use the Hardhat" +
        " option '--network localhost'"
    );
  }

  // ethers is avaialble in the global scope
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();

  if (startBlock === null) {
    startBlock = await ethers.provider.getBlockNumber();
  }
  if (!governance && network.name === "hardhat") {
    governance = deployerAddress;
  }

  if (!silent) {
    console.log("Deploying the contracts with the account:", deployerAddress);
    console.log("Account balance:", (await deployer.getBalance()).toString());
  }

  const HATVaults = await ethers.getContractFactory("HATVaults");
  const RewardController = await ethers.getContractFactory("RewardController");
  const hatVaults = await upgrades.deployProxy(HATVaults, [
    rewardsToken,
    deployerAddress,
    swapToken,
    whitelistedRouters,
    tokenLockFactory,
  ]);

  await hatVaults.deployed();

  const rewardController = await RewardController.deploy(
    governance,
    hatVaults.address,
    startBlock,
    epochLength,
    rewardPerEpoch,
  );

  await rewardController.deployed();

  await hatVaults.setRewardController(rewardController.address);

  if (governance !== deployerAddress) {
    await hatVaults.transferOwnership(governance);
  }

  if (!silent) {
    console.log("hatVaults address:", hatVaults.address);

    // We also save the contract's artifacts and address in the frontend directory
    saveFrontendFiles(hatVaults, "HATVaults");
    //verify
    console.log(
      "npx hardhat verify --network rinkeby",
      hatVaults.address,
      '"',
      rewardsToken,
      '"',
      '"',
      startBlock,
      '"',
      '"',
      epochLength,
      '"',
      '"',
      governance,
      '"',
      '"',
      tokenLockFactory,
      '"'
    );
  }

  return { hatVaults, rewardController };
}

function saveFrontendFiles(contract, name) {
  const fs = require("fs");
  const contractsDir = __dirname + "/../frontend/src/contracts";

  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir, { recursive: true });
  }

  var data = JSON.parse(
    fs.readFileSync(contractsDir + "/contract-address.json", {
      encoding: "utf8",
      flag: "r",
    })
  );
  data[name] = contract.address;

  fs.writeFileSync(
    contractsDir + "/contract-address.json",
    JSON.stringify(data, undefined, 2)
  );

  const HATVaultsArtifact = artifacts.readArtifactSync("HATVaults");

  fs.writeFileSync(
    contractsDir + "/HATVaults.json",
    JSON.stringify(HATVaultsArtifact, null, 2)
  );
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { deployHatVaults: main };
