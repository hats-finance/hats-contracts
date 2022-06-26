const ADDRESSES = require("./addresses.json");
const fs = require("fs");
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');

async function main(
  rewardsToken = ADDRESSES[network.name].hatToken,
  startBlock = null,
  rewardPerEpoch = [
    "44130000000000000000000",
    "44130000000000000000000",
    "88250000000000000000000",
    "77880000000000000000000",
    "68730000000000000000000",
    "60650000000000000000000",
    "53530000000000000000000",
    "47240000000000000000000",
    "41690000000000000000000",
    "36790000000000000000000",
    "32470000000000000000000",
    "28650000000000000000000",
    "25280000000000000000000",
    "22310000000000000000000",
    "19690000000000000000000",
    "17380000000000000000000",
    "15340000000000000000000",
    "13530000000000000000000",
    "11940000000000000000000",
    "10540000000000000000000",
    "9300000000000000000000",
    "8210000000000000000000",
    "7240000000000000000000",
    "6390000000000000000000",
  ],
  epochLength = "195200",
  governance = ADDRESSES[network.name].governance,
  swapToken = ADDRESSES[network.name].hatToken,
  whitelistedRouters = ADDRESSES[network.name].whitelistedRouters,
  tokenLockFactory = ADDRESSES[network.name].tokenLockFactory,
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
  const rewardController = await RewardController.deploy(
    governance,
    startBlock,
    epochLength,
    rewardPerEpoch
  );

  await rewardController.deployed();

  const hatVaults = await upgrades.deployProxy(HATVaults, [
    rewardsToken,
    governance,
    swapToken,
    whitelistedRouters,
    tokenLockFactory,
    rewardController.address,
  ]);

  await hatVaults.deployed();

  const hatVaultsImplementation = await getImplementationAddress(ethers.provider, hatVaults.address);
  if (!silent) {

    console.log("rewardController address:", rewardController.address);
    console.log("hatVaults address:", hatVaults.address);
    console.log("hatVaultsImplementation address:", hatVaultsImplementation);

    if (network.name !== "hardhat") {
      ADDRESSES[network.name]["rewardController"] = rewardController.address;
      ADDRESSES[network.name]["hatVaults"] = hatVaults.address;
      ADDRESSES[network.name]["hatVaultsImplementation"] = hatVaultsImplementation;
      fs.writeFileSync(__dirname + '/addresses.json', JSON.stringify(ADDRESSES, null, 2));
    }
  }

  return { hatVaults, rewardController, hatVaultsImplementation};
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
