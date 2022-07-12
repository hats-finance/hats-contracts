let config = require("./config.json");
const { deployHATToken } = require("./hattoken-deploy.js");
const { deployTokenLockFactory } = require("./tokenlockfactory-deploy.js");
const { deployHatVaults } = require("./hatvaults-deploy.js");
const { deployTimelock } = require("./timelock-deploy.js");
const { verifyHatsContracts } = require("./hats-verify.js");
const ADDRESSES = require("./addresses.json");
const TokenLockFactory = artifacts.require("./TokenLockFactory.sol");
const fs = require("fs");

async function main() {
  config = config[network.name];
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();

  let hatToken = config.hatToken;
  if (!hatToken) {
    console.log("Deploying HAToken");
    hatToken = (await deployHATToken()).address;
  }

  let hatTokenLock = config.hatTokenLock;
  let tokenLockFactory = config.tokenLockFactory;
  if (!tokenLockFactory) {
    console.log("Deploying token factory");
    let tokenLockFactoryResult = await deployTokenLockFactory();
    hatTokenLock = tokenLockFactoryResult.hatTokenLock.address;
    tokenLockFactory = tokenLockFactoryResult.tokenLockFactory.address;
  } else {
    if (!hatTokenLock) {
      hatTokenLock = await (await TokenLockFactory.at(tokenLockFactory)).masterCopy();
    }
  }

  let startBlock;
  let epochLength;
  let rewardPerEpoch;
  let whitelistedRouters;
  
  if (!config.startBlock || config.startBlock === "now") {
    startBlock = null;
  } else {
    startBlock = config.startBlock;
  }

  if (!config.epochLength) {
    epochLength = "195200";
  } else {
    epochLength = config.epochLength;
  }

  if (!config.rewardPerEpoch) {
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
    ];
  } else {
    rewardPerEpoch = config.rewardPerEpoch;
  }

  if (!config.whitelistedRouters) {
    whitelistedRouters = [
      "0xE592427A0AEce92De3Edee1F18E0157C05861564"
    ];
  } else {
    whitelistedRouters = config.whitelistedRouters;
  }

  console.log("Deploying HATVaults");
  
  let hatVaultsResult = await deployHatVaults(
    rewardsToken = hatToken,
    startBlock,
    rewardPerEpoch,
    epochLength,
    deployerAddress,
    hatToken,
    whitelistedRouters,
    tokenLockFactory,
    false
  );

  let hatVaults = hatVaultsResult.hatVaults;
  let rewardController = hatVaultsResult.rewardController;
  let rewardControllerImplementation = hatVaultsResult.rewardControllerImplementation;

  console.log("Deploying timelock");

  let timelock = await deployTimelock({
    hatVaults: hatVaults.address,
    governance: config.governance,
    executors: config.executors,
    minDelay: config.hattimelockDelay
  });

  console.log("Transferring ownership to the timelock");

  await hatVaults.transferOwnership(timelock.address);
  await rewardController.transferOwnership(timelock.address);

  startBlock = await rewardController.startBlock();

  let result = {
    governance: config.governance,
    executors: config.executors,
    hatToken,
    hatTokenLock,
    tokenLockFactory,
    rewardController: rewardController.address,
    hatVaults: hatVaults.address,
    rewardControllerImplementation,
    timelock: timelock.address,
    rewardControllerParams: [
      startBlock.toString(),
      epochLength,
      rewardPerEpoch
    ],
    whitelistedRouters
  };

  console.log("Verifying contracts");
  await verifyHatsContracts(result);

  console.log("Hats Deployment Results:");
  console.log(JSON.stringify(result, null, 2));

  ADDRESSES[network.name] = result;

  fs.writeFileSync(__dirname + '/addresses.json', JSON.stringify(ADDRESSES, null, 2));
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
