const ADDRESSES = require("./addresses.json");
const fs = require("fs");
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');

async function main(
  rewardsToken = ADDRESSES[network.name].hatToken,
  startBlock = null,
  rewardPerEpoch = [
    web3.utils.toWei("44130"),
    web3.utils.toWei("44130"),
    web3.utils.toWei("88250"),
    web3.utils.toWei("77880"),
    web3.utils.toWei("68730"),
    web3.utils.toWei("60650"),
    web3.utils.toWei("53530"),
    web3.utils.toWei("47240"),
    web3.utils.toWei("41690"),
    web3.utils.toWei("36790"),
    web3.utils.toWei("32470"),
    web3.utils.toWei("28650"),
    web3.utils.toWei("25280"),
    web3.utils.toWei("22310"),
    web3.utils.toWei("19690"),
    web3.utils.toWei("17380"),
    web3.utils.toWei("15340"),
    web3.utils.toWei("13530"),
    web3.utils.toWei("11940"),
    web3.utils.toWei("10540"),
    web3.utils.toWei("9300"),
    web3.utils.toWei("8210"),
    web3.utils.toWei("7240"),
    web3.utils.toWei("6390"),
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

  if (!silent) {
    const hatsVaultsImplementation = await getImplementationAddress(ethers.provider, hatVaults.address)

    console.log("rewardController address:", rewardController.address);
    console.log("hatVaults address:", hatVaults.address);
    console.log("hatsVaultsImplementation address:", hatsVaultsImplementation);

    if (network.name !== "hardhat") {
      ADDRESSES[network.name]["rewardController"] = rewardController.address;
      ADDRESSES[network.name]["hatVaults"] = hatVaults.address;
      ADDRESSES[network.name]["hatVaultsImplementation"] = hatsVaultsImplementation;
      ADDRESSES[network.name]["rewardControllerParams"] = [
        startBlock,
        epochLength,
        rewardPerEpoch
      ];
      fs.writeFileSync(__dirname + '/addresses.json', JSON.stringify(ADDRESSES, null, 2));
    }
  }

  return { hatVaults, rewardController };
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
