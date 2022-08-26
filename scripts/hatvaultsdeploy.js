const ADDRESSES = require("./addresses.js");
async function main(
  rewardsToken = "0x51a6Efc15c50EcE1DaAD1Ee4fbF8DEC76584c365",
  startBlock = null,
  rewardPerEpoch = [
    web3.utils.toWei("441.3"),
    web3.utils.toWei("441.3"),
    web3.utils.toWei("882.5"),
    web3.utils.toWei("778.8"),
    web3.utils.toWei("687.3"),
    web3.utils.toWei("606.5"),
    web3.utils.toWei("535.3"),
    web3.utils.toWei("472.4"),
    web3.utils.toWei("416.9"),
    web3.utils.toWei("367.9"),
    web3.utils.toWei("324.7"),
    web3.utils.toWei("286.5"),
    web3.utils.toWei("252.8"),
    web3.utils.toWei("223.1"),
    web3.utils.toWei("196.9"),
    web3.utils.toWei("173.8"),
    web3.utils.toWei("153.4"),
    web3.utils.toWei("135.3"),
    web3.utils.toWei("119.4"),
    web3.utils.toWei("105.4"),
    web3.utils.toWei("93"),
    web3.utils.toWei("82.1"),
    web3.utils.toWei("72.4"),
    web3.utils.toWei("63.9"),
  ],
  epochLength = "195200",
  governance = ADDRESSES[network.name].governance,
  HAT = "0x51a6Efc15c50EcE1DaAD1Ee4fbF8DEC76584c365",
  hatBountySplit = [1000, 500],
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

  const HATVault = await ethers.getContractFactory("HATVault");
  const hatVaultImplementation = await HATVault.deploy();
  await hatVaultImplementation.deployed();
  const HATVaultsRegistry = await ethers.getContractFactory("HATVaultsRegistry");
  const RewardController = await ethers.getContractFactory("RewardController");
  const rewardController = await upgrades.deployProxy(RewardController, [
    rewardsToken,
    deployerAddress,
    startBlock,
    epochLength,
    rewardPerEpoch
  ]);

  await rewardController.deployed();

  const hatVaultsRegistry = await HATVaultsRegistry.deploy(
    hatVaultImplementation.address,
    deployerAddress,
    HAT,
    hatBountySplit,
    tokenLockFactory,
  );

  await hatVaultsRegistry.deployed();

  if (governance !== deployerAddress) {
    await rewardController.transferOwnership(governance);
    await hatVaultsRegistry.transferOwnership(governance);
  }

  if (!silent) {
    console.log("hatVaults address:", hatVaultsRegistry.address);
  }

  return { hatVaultsRegistry, rewardController, hatVaultImplementation };
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
