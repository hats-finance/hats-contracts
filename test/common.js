const HATVault = artifacts.require("./HATVault.sol");
const HATClaimsManager = artifacts.require("./HATClaimsManager.sol");
const HATVaultsRegistry = artifacts.require("./HATVaultsRegistry.sol");
const HATTokenMock = artifacts.require("./HATTokenMock.sol");
const ERC20Mock = artifacts.require("./ERC20Mock.sol");
const TokenLockFactory = artifacts.require("./TokenLockFactory.sol");
const HATTokenLock = artifacts.require("./HATTokenLock.sol");
const RewardController = artifacts.require("./RewardController.sol");
const utils = require("./utils.js");

const { deployHATVaults } = require("../scripts/deployments/hatvaultsregistry-deploy");

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const MAX_UINT16 = 65535;

let epochRewardPerBlock = [
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
      error.message.includes(expectedErrorMessage) ||
        error.message.includes(expectedReasonString) ||
        // Needed for now because hardhat doesn't fully support the viaIR compiler setting
        error.message === "Returned error: VM Exception while processing transaction: revert with unrecognized return data or custom error" ||
        error.message === "Transaction reverted and Hardhat couldn't infer the reason.",
      "Expected error to be: " +
        expectedError +
        ", got this instead:" +
        error.message
    );
  }
}

const setup = async function(
  accounts,
  options = {}

) {
  const defaultOptions = {
    startBlock : (await web3.eth.getBlock("latest")).number,
    maxBounty : 8000,
    bountySplit : [7500, 2000, 500],
    governanceFee : 2000,
    halvingAfterBlock : 10,
    allocPoint : 100,
    rewardInVaults : 2500000,
    challengePeriod: 60 * 60 * 24,
    setDefaultArbitrator: true,
    isTokenLockRevocable: false
  };
  options = { ...defaultOptions, ...options};
  const committee = accounts[1];
  hatToken = await HATTokenMock.new(accounts[0]);
  await hatToken.setTransferable({from: accounts[0]});
  stakingToken = await ERC20Mock.new("Staking", "STK");
  var tokenLock = await HATTokenLock.new();
  tokenLockFactory = await TokenLockFactory.new(tokenLock.address, accounts[0]);

  let deployment = await deployHATVaults({
    governance: accounts[0],
    arbitrator: accounts[0],
    hatToken: hatToken.address,
    tokenLockFactory: tokenLockFactory.address,
    rewardControllersConf: [{
      startBlock: options.startBlock,
      epochLength: options.halvingAfterBlock,
      epochRewardPerBlock
    }],
    hatVaultsRegistryConf: {
      governanceFee: options.governanceFee
    },
    silent: true
  });

  hatVaultImplementation = deployment.hatVaultImplementation;
  hatVaultsRegistry = await HATVaultsRegistry.at(deployment.hatVaultsRegistry.address);
  rewardController = await RewardController.at(
    deployment.rewardControllers[0].address
  );

  await hatToken.setMinter(
    accounts[0],
    web3.utils.toWei((2500000 + options.rewardInVaults).toString())
  );

  if (options.rewardInVaults > 0) {
    await hatToken.mint(accounts[0], web3.utils.toWei(options.rewardInVaults.toString()));
    await hatToken.transfer(
      rewardController.address,
      web3.utils.toWei(options.rewardInVaults.toString())
   );
  }
  hatVaultsExpectedHatsBalance = options.rewardInVaults;

  // setting challengeClaim period to 0 will make running tests a bit easier
  let tx = await hatVaultsRegistry.createVault(
    {
      asset: stakingToken.address,
      name: "VAULT",
      symbol: "VLT",
      rewardControllers: [rewardController.address],
      owner: await hatVaultsRegistry.owner(),
      isPaused: false,
      descriptionHash: "_descriptionHash",
    },
    {
    owner: await hatVaultsRegistry.owner(),
    committee: accounts[1],
    arbitrator: "0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF",
    arbitratorCanChangeBounty: true,
    arbitratorCanChangeBeneficiary: false,
    arbitratorCanSubmitIssues: false,
    isTokenLockRevocable: options.isTokenLockRevocable,
    maxBounty: options.maxBounty,
    bountySplit: options.bountySplit,
    governanceFee: options.governanceFee,
    vestingDuration: 86400,
    vestingPeriods: 10
    }
  );

  let vault = await HATVault.at(tx.logs[2].args._vault);
  let claimsManager = await HATClaimsManager.at(tx.logs[2].args._claimsManager);

  if (options.challengePeriod) {
    await hatVaultsRegistry.setDefaultChallengePeriod(options.challengePeriod);
  }

  await rewardController.setAllocPoint(
    vault.address,
    options.allocPoint
  );
  await claimsManager.committeeCheckIn({ from: committee });
  const registry = hatVaultsRegistry;
  let arbitrator;
  if (options.setDefaultArbitrator) {
    arbitrator = accounts[2];
    await registry.setDefaultArbitrator(arbitrator);

  }

  return {
    arbitrator,
    committee, // accounts[1]
    hatToken,
    owner: accounts[0],
    registry,
    hatVaultImplementation,
    tokenLockFactory,
    rewardController,
    hatVaultsExpectedHatsBalance,
    someAccount: accounts[5], // an account without any special role
    stakingToken,
    vault,
    claimsManager,
    rewardControllerExpectedHatsBalance: options.rewardInVaults
  };
};

async function advanceToSafetyPeriod(hatVaultsRegistry) {
  let currentTimeStamp = (await web3.eth.getBlock("latest")).timestamp;

  let withdrawPeriod = (
    await hatVaultsRegistry.generalParameters()
  ).withdrawPeriod.toNumber();
  let safetyPeriod = (
    await hatVaultsRegistry.generalParameters()
  ).safetyPeriod.toNumber();

  if (currentTimeStamp % (withdrawPeriod + safetyPeriod) < withdrawPeriod) {
    await utils.increaseTime(
      withdrawPeriod - (currentTimeStamp % (withdrawPeriod + safetyPeriod))
    );
  }
}

//advanced time to a withdraw enable period
async function advanceToNonSafetyPeriod(hatVaultsRegistry) {
  let currentTimeStamp = (await web3.eth.getBlock("latest")).timestamp;
  let withdrawPeriod = (
    await hatVaultsRegistry.generalParameters()
  ).withdrawPeriod.toNumber();
  let safetyPeriod = (
    await hatVaultsRegistry.generalParameters()
  ).safetyPeriod.toNumber();
  if (currentTimeStamp % (withdrawPeriod + safetyPeriod) >= withdrawPeriod) {
    await utils.increaseTime(
      (currentTimeStamp % (withdrawPeriod + safetyPeriod)) +
        safetyPeriod -
        withdrawPeriod
    );
  }
}

async function submitClaim(claimsManager, { accounts, bountyPercentage = 8000 }) {
  const tx = await claimsManager.submitClaim(
    accounts[2],
    bountyPercentage,
    "description hash",
    {
      from: accounts[1],
    }
  );

  return tx.logs[0].args._claimId;
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
  epochRewardPerBlock,
  assertVMException,
  advanceToSafetyPeriod,
  advanceToNonSafetyPeriod,
  submitClaim,
  assertFunctionRaisesException,
  ZERO_ADDRESS,
  MAX_UINT16
};
