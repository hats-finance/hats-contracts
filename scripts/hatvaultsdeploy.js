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
    swapToken,
    whitelistedRouters,
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
