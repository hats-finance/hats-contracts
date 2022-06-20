const HATVaults = artifacts.require("./HATVaults.sol");
const HATTokenMock = artifacts.require("./HATTokenMock.sol");
const ERC20Mock = artifacts.require("./ERC20Mock.sol");
const UniSwapV3RouterMock = artifacts.require("./UniSwapV3RouterMock.sol");
const TokenLockFactory = artifacts.require("./TokenLockFactory.sol");
const HATTokenLock = artifacts.require("./HATTokenLock.sol");
const RewardController = artifacts.require("./RewardController.sol");
const utils = require("./utils.js");

const { deployHatVaults } = require("../scripts/hatvaultsdeploy.js");

let rewardPerEpoch = [
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
];

function assertVMException(error, expectedError = "") {
  let condition =
    error.message.search("VM Exception") > -1 ||
    error.message.search("Transaction reverted") > -1;
  assert.isTrue(
    condition,
    "Expected a VM Exception, got this instead:" + error.message
  );
  let expectedErrorMessage = "VM Exception while processing transaction: reverted with custom error '" +
      expectedError + "()'";
  let expectedReasonString = "VM Exception while processing transaction: reverted with reason string '" +
      expectedError + "'";
  if (expectedError) {
    assert(
      error.message === expectedErrorMessage ||
        error.message === expectedReasonString,
      "Expected error to be: " +
        expectedError +
        ", got this instead:" +
        error.message
    );
  }
}

const setup = async function(
  accounts,
  startBlock = 0,
  maxBounty = 8000,
  bountySplit = [6000, 2000, 500, 0, 1000, 500],
  halvingAfterBlock = 10,
  routerReturnType = 0,
  allocPoint = 100,
  weth = false,
  rewardInVaults = 2500000,
  challengePeriod = 0
) {
  hatToken = await HATTokenMock.new(accounts[0], utils.TIME_LOCK_DELAY);
  stakingToken = await ERC20Mock.new("Staking", "STK");
  var wethAddress = utils.NULL_ADDRESS;
  if (weth) {
    wethAddress = stakingToken.address;
  }
  router = await UniSwapV3RouterMock.new(routerReturnType, wethAddress);
  var tokenLock = await HATTokenLock.new();
  tokenLockFactory = await TokenLockFactory.new(tokenLock.address);

  let deployment = await deployHatVaults(
    hatToken.address,
    startBlock,
    rewardPerEpoch,
    halvingAfterBlock,
    accounts[0],
    hatToken.address,
    [router.address],
    tokenLockFactory.address,
    true
  );

  hatVaults = await HATVaults.at(deployment.hatVaults.address);
  rewardController = await RewardController.at(
    deployment.rewardController.address
  );

  await utils.setMinter(
    hatToken,
    accounts[0],
    web3.utils.toWei((2500000 + rewardInVaults).toString())
  );
  await hatToken.mint(router.address, web3.utils.toWei("2500000"));
  await hatToken.mint(accounts[0], web3.utils.toWei(rewardInVaults.toString()));
  await hatToken.approve(
    hatVaults.address,
    web3.utils.toWei(rewardInVaults.toString())
  );
  var tx = await hatVaults.depositReward(
    web3.utils.toWei(rewardInVaults.toString())
  );
  assert.equal(tx.logs[0].event, "DepositReward");
  assert.equal(
    tx.logs[0].args._amount,
    web3.utils.toWei(rewardInVaults.toString())
  );
  hatVaultsExpectedHatsBalance = rewardInVaults;

  // setting challengeClaim period to 0 will make running tests a bit easier
  await hatVaults.setChallengePeriod(challengePeriod);
  await hatVaults.addPool(
    stakingToken.address,
    accounts[1],
    maxBounty,
    bountySplit,
    "_descriptionHash",
    [86400, 10],
    false,
    true
  );
  await rewardController.setAllocPoint(
    (await hatVaults.getNumberOfPools()) - 1,
    allocPoint
  );
  await hatVaults.committeeCheckIn(0, { from: accounts[1] });
  return {
    hatVaults,
    hatToken,
    stakingToken,
  };
};

async function advanceToSafetyPeriod(hatVaults) {
  let currentTimeStamp = (await web3.eth.getBlock("latest")).timestamp;

  let withdrawPeriod = (
    await hatVaults.generalParameters()
  ).withdrawPeriod.toNumber();
  let safetyPeriod = (
    await hatVaults.generalParameters()
  ).safetyPeriod.toNumber();

  if (currentTimeStamp % (withdrawPeriod + safetyPeriod) < withdrawPeriod) {
    await utils.increaseTime(
      withdrawPeriod - (currentTimeStamp % (withdrawPeriod + safetyPeriod))
    );
  }
}

async function submitClaim(hatVaults, { accounts, bountyPercentage = 8000 }) {
  let tx = await hatVaults.submitClaim(
    0,
    accounts[2],
    bountyPercentage,
    "description hash",
    {
      from: accounts[1],
    }
  );
  let claimId = tx.logs[0].args._claimId;
  return claimId;
}

async function assertFunctionRaisesException(functionCall, exceptionString) {
  try {
    await functionCall;
    assert(false, "function call passed but was expected to fail");
  } catch (ex) {
    assertVMException(ex, exceptionString);
  }
}
module.exports = {
  setup,
  rewardPerEpoch,
  assertVMException,
  advanceToSafetyPeriod,
  submitClaim,
  assertFunctionRaisesException,
};
