const HATVault = artifacts.require("./HATVault.sol");
const HATClaimsManager = artifacts.require("./HATClaimsManager.sol");
const HATVaultsRegistry = artifacts.require("./HATVaultsRegistry.sol");
const HATTokenMock = artifacts.require("./HATTokenMock.sol");
const HATPaymentSplitter = artifacts.require("./HATPaymentSplitter.sol");
const HATPaymentSplitterFactory = artifacts.require("./HATPaymentSplitterFactory.sol");
const HATVaultV2Mock = artifacts.require("./HATVaultV2Mock.sol");
const HATClaimsManagerV2Mock = artifacts.require("./HATClaimsManagerV2Mock.sol");
const ERC20Mock = artifacts.require("./ERC20Mock.sol");
const TokenLockFactory = artifacts.require("./TokenLockFactory.sol");
const HATTokenLock = artifacts.require("./HATTokenLock.sol");
const VaultsManagerMock = artifacts.require("./VaultsManagerMock.sol");
const EtherTransferFail = artifacts.require("./EtherTransferFail.sol");
const RewardController = artifacts.require("./RewardController.sol");
const utils = require("./utils.js");

const { deployHATVaults } = require("../scripts/deployments/hatvaultsregistry-deploy");
const {
  assertFunctionRaisesException,
  assertVMException,
  advanceToSafetyPeriod: advanceToSafetyPeriod_,
  advanceToNonSafetyPeriod: advanceToNonSafetyPeriod_,
  epochRewardPerBlock,
  setup,
  submitClaim,
  ZERO_ADDRESS
} = require("./common.js");
const { assert } = require("chai");
const { web3 } = require("hardhat");

let hatVaultImplementation;
let hatVaultsRegistry;
let vault;
let claimsManager;
let rewardController;
let hatToken;
let stakingToken;
let safeWithdrawBlocksIncrement = 3;
let rewardControllerExpectedHatsBalance;

const HUNDRED_PERCENT = 10000;
const MINIMAL_AMOUNT_OF_SHARES = 1000;

async function advanceToSafetyPeriod(registry) {
  if (!registry) registry = hatVaultsRegistry;
  return advanceToSafetyPeriod_(registry);
}

async function advanceToNonSafetyPeriod(registry) {
  if (!registry) registry = hatVaultsRegistry;
  return advanceToNonSafetyPeriod_(registry);
}

/*
  setup will:
  - deploy a registry
  - create a new vault
  - set accounts[1] to be the committee of the vault
  - ...
*/
const setUpGlobalVars = async function(
  accounts,
  startBlock = 0,
  maxBounty = 8000,
  bountySplit = [7500, 2000, 500],
  governanceFee = 2000,
  halvingAfterBlock = 10,
  allocPoint = 100,
  rewardInVaults = 2500000,
  challengePeriod = 60 * 60 * 24,
  isTokenLockRevocable = false
) {
  if (startBlock === 0) {
    startBlock = (await web3.eth.getBlock("latest")).number;
  }
  const setupVars = await setup(accounts, {
    startBlock,
    maxBounty,
    bountySplit,
    governanceFee,
    halvingAfterBlock,
    allocPoint,
    rewardInVaults,
    challengePeriod,
    setDefaultArbitrator: false,
    isTokenLockRevocable
  });

  // copy global variables
  hatVaultImplementation = setupVars.hatVaultImplementation;
  tokenLockFactory = setupVars.tokenLockFactory;
  hatVaultsRegistry = setupVars.registry;
  vault = setupVars.vault;
  claimsManager = setupVars.claimsManager;
  stakingToken = setupVars.stakingToken;
  hatToken = setupVars.hatToken;
  rewardController = setupVars.rewardController;
  hatVaultsExpectedHatsBalance = setupVars.hatVaultsExpectedHatsBalance;
  rewardControllerExpectedHatsBalance = setupVars.rewardControllerExpectedHatsBalance;
  await advanceToNonSafetyPeriod(hatVaultsRegistry);
  return setupVars;
};

contract("HatVaults", (accounts) => {
  //this function will increment 4 blocks in local testnet
  async function safeRedeem(vault, amount, staker, redeemFrom=staker, slippage=false) {
    let withdrawPeriod = (
      await hatVaultsRegistry.generalParameters()
    ).withdrawPeriod.toNumber();
    let safetyPeriod = (
      await hatVaultsRegistry.generalParameters()
    ).safetyPeriod.toNumber();

    //increase time for the case there is already pending request ..so make sure start a new one..
    await utils.increaseTime(7 * 24 * 3600);
    await vault.withdrawRequest({ from: staker });
    if (redeemFrom !== staker) {
      await vault.withdrawRequest({ from: redeemFrom });
    }
    //increase time for pending period
    await utils.increaseTime(7 * 24 * 3600);
    let currentTimeStamp = (await web3.eth.getBlock("latest")).timestamp;
    if (currentTimeStamp % (withdrawPeriod + safetyPeriod) >= withdrawPeriod) {
      await utils.increaseTime(
        (currentTimeStamp % (withdrawPeriod + safetyPeriod)) +
          safetyPeriod -
          withdrawPeriod
      );
    }

    if (slippage) {
      return await vault.methods["redeem(uint256,address,address,uint256)"](amount, staker, redeemFrom, slippage, { from: staker });
    }
    return await vault.methods["redeem(uint256,address,address)"](amount, staker, redeemFrom, { from: staker });
  }

  async function safeWithdraw(vault, amount, staker, withdrawFrom=staker, slippage=false) {
    let withdrawPeriod = (
      await hatVaultsRegistry.generalParameters()
    ).withdrawPeriod.toNumber();
    let safetyPeriod = (
      await hatVaultsRegistry.generalParameters()
    ).safetyPeriod.toNumber();

    //increase time for the case there is already pending request ..so make sure start a new one..
    await utils.increaseTime(7 * 24 * 3600);
    await vault.withdrawRequest({ from: staker });
    if (withdrawFrom !== staker) {
      await vault.withdrawRequest({ from: withdrawFrom });
    }
    //increase time for pending period
    await utils.increaseTime(7 * 24 * 3600);
    let currentTimeStamp = (await web3.eth.getBlock("latest")).timestamp;
    if (currentTimeStamp % (withdrawPeriod + safetyPeriod) >= withdrawPeriod) {
      await utils.increaseTime(
        (currentTimeStamp % (withdrawPeriod + safetyPeriod)) +
          safetyPeriod -
          withdrawPeriod
      );
    }

    if (slippage) {
      return await vault.methods["withdraw(uint256,address,address,uint256)"](amount, staker, withdrawFrom, slippage, { from: staker });
    }
    return await vault.methods["withdraw(uint256,address,address)"](amount, staker, withdrawFrom, { from: staker });
  }

  async function calculateExpectedReward(staker, operationBlocksIncrement = 0, currentVault=vault, currentRewardController=rewardController) {
    let currentBlockNumber = (await web3.eth.getBlock("latest")).number;
    let lastRewardBlock = (await currentRewardController.vaultInfo(currentVault.address)).lastRewardBlock;
    let allocPoint = (await currentRewardController.vaultInfo(currentVault.address)).allocPoint;
    let rewardPerShare = new web3.utils.BN(
      (await currentRewardController.vaultInfo(currentVault.address)).rewardPerShare
    );
    let onee12 = new web3.utils.BN("1000000000000");
    let balanceOf = await currentVault.balanceOf(staker);
    let stakerAmount = balanceOf;
    let globalUpdatesLen = await currentRewardController.getGlobalVaultsUpdatesLength();
    let totalAllocPoint = (
      await currentRewardController.globalVaultsUpdates(globalUpdatesLen - 1)
    ).totalAllocPoint;
    let vaultReward = await currentRewardController.getRewardForBlocksRange(
      lastRewardBlock,
      currentBlockNumber + 1 + operationBlocksIncrement,
      allocPoint,
      totalAllocPoint
    );
    let lpSupply = await currentVault.totalSupply();
    let rewardDebt = await currentRewardController.rewardDebt(currentVault.address, staker);
    let unclaimedReward = await currentRewardController.unclaimedReward(currentVault.address, staker);
    rewardPerShare = rewardPerShare.add(vaultReward.mul(onee12).div(lpSupply));
    return stakerAmount
      .mul(rewardPerShare)
      .div(onee12)
      .add(unclaimedReward)
      .sub(rewardDebt);
  }

  async function unsafeRedeem(vault, amount, staker) {
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
    return await vault.methods["redeem(uint256,address,address)"](amount, staker, staker, { from: staker });
  }

  async function unsafeWithdraw(vault, amount, staker) {
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
    return await vault.methods["withdraw(uint256,address,address)"](amount, staker, staker, { from: staker });
  }

  it("constructor", async () => {
    await setUpGlobalVars(accounts,
      50,
      8000,
      [7500, 2000, 500],
      2000,
      20,
      100,
      2500000,
      false
    );
    assert.equal(await stakingToken.name(), "Staking");
    assert.equal(await hatVaultsRegistry.owner(), accounts[0]);
    assert.equal(await vault.owner(), accounts[0]);

    let logs = await hatVaultsRegistry.getPastEvents('RegistryCreated', {
      fromBlock: 0,
      toBlock: (await web3.eth.getBlock("latest")).number
    });

    assert.equal(logs[0].event, "RegistryCreated");
    assert.equal(logs[0].args._hatVaultImplementation, hatVaultImplementation.address);
    let generalParameters = await hatVaultsRegistry.generalParameters();
    assert.equal(logs[0].args._generalParameters.hatVestingDuration, generalParameters.hatVestingDuration.toString());
    assert.equal(logs[0].args._generalParameters.hatVestingPeriods, generalParameters.hatVestingPeriods.toString());
    assert.equal(logs[0].args._generalParameters.withdrawPeriod, generalParameters.withdrawPeriod.toString());
    assert.equal(logs[0].args._generalParameters.safetyPeriod, generalParameters.safetyPeriod.toString());
    assert.equal(logs[0].args._generalParameters.withdrawRequestEnablePeriod, generalParameters.withdrawRequestEnablePeriod.toString());
    assert.equal(logs[0].args._generalParameters.withdrawRequestPendingPeriod, generalParameters.withdrawRequestPendingPeriod.toString());
    assert.equal(logs[0].args._generalParameters.setMaxBountyDelay, generalParameters.setMaxBountyDelay.toString());
    assert.equal(logs[0].args._generalParameters.claimFee, generalParameters.claimFee.toString());
    assert.equal(logs[0].args._defaultGovernanceFee, "2000");
    assert.equal(logs[0].args._hatGovernance, accounts[0]);
    assert.equal(logs[0].args._defaultArbitrator, await hatVaultsRegistry.defaultArbitrator());
    assert.equal(logs[0].args._defaultChallengePeriod.toString(), (await hatVaultsRegistry.defaultChallengePeriod()).toString());

    logs = await rewardController.getPastEvents('RewardControllerCreated', {
      fromBlock: 0,
      toBlock: (await web3.eth.getBlock("latest")).number
    });

    assert.equal(logs[0].event, "RewardControllerCreated");
    assert.equal(logs[0].args._rewardToken, hatToken.address);
    assert.equal(logs[0].args._governance, accounts[0]);
    assert.equal(logs[0].args._startBlock.toString(), "50");
    assert.equal(logs[0].args._epochLength.toString(), "20");
    for (let i in epochRewardPerBlock) {
      assert.equal(logs[0].args._epochRewardPerBlock[i].toString(), epochRewardPerBlock[i].toString());
    }
  });

  it("Set HATVault implementation", async () => {
    await setUpGlobalVars(accounts);

    let hatVaultV2Mock = await HATVaultV2Mock.new();
    let hatClaimsManagerV2Mock = await HATClaimsManagerV2Mock.new();

    try {
      await hatVaultsRegistry.setVaultImplementations(hatVaultV2Mock.address, hatClaimsManagerV2Mock.address, { from: accounts[1] });
      assert(false, "only gov");
    } catch (ex) {
      assertVMException(ex, "Ownable: caller is not the owner");
    }

    await hatVaultsRegistry.setVaultImplementations(hatVaultV2Mock.address, hatClaimsManagerV2Mock.address);

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
      isTokenLockRevocable: false,
      maxBounty: 8000,
      bountySplit: [7000, 2500, 500],
      governanceFee: 65535,
      vestingDuration: 86400,
      vestingPeriods: 10
      }
    );

    let newVault = await HATVaultV2Mock.at(tx.logs[2].args._vault);
    let newClaimsManager = await HATClaimsManagerV2Mock.at(tx.logs[2].args._claimsManager);

    assert.equal((await newVault.getVersion()), "New version!");
    assert.equal((await newClaimsManager.getVersion()), "New version!");

    try {
      await vault.getVersion();
      assert(false, "method doesn't exist for older vault");
    } catch (ex) {
      assert.equal(ex.message, "vault.getVersion is not a function");
    }

    try {
      await claimsManager.getVersion();
      assert(false, "method doesn't exist for older vault");
    } catch (ex) {
      assert.equal(ex.message, "claimsManager.getVersion is not a function");
    }
  });

  it("Get active claim", async () => {
    await setUpGlobalVars(accounts);

    var staker = accounts[1];
    await stakingToken.approve(vault.address, web3.utils.toWei("4"), {
      from: staker,
    });
    await stakingToken.mint(staker, web3.utils.toWei("1"));
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });

    await advanceToSafetyPeriod();
    let tx = await claimsManager.submitClaim(
      accounts[2],
      8000,
      "description hash",
      {
        from: accounts[1],
      }
    );

    let claimId = tx.logs[0].args._claimId;

    let activeClaim = await claimsManager.getActiveClaim();
    assert.equal(activeClaim.claimId, claimId);
    assert.equal(activeClaim.beneficiary, accounts[2]);
    assert.equal(activeClaim.bountyPercentage, "8000");
    assert.equal(activeClaim.committee, accounts[1]);
    assert.equal(activeClaim.createdAt, (await web3.eth.getBlock(tx.receipt.blockNumber)).timestamp);
    assert.equal(activeClaim.challengedAt, "0");
    assert.equal(activeClaim.governanceFee, "2000");
    assert.equal(activeClaim.arbitrator, accounts[0]);
    assert.equal(activeClaim.challengePeriod, "86400");
    assert.equal(activeClaim.challengeTimeOutPeriod, "10800000");
    assert.equal(activeClaim.arbitratorCanChangeBounty, true);
    assert.equal(activeClaim.arbitratorCanChangeBeneficiary, false);
  });

  it("Only claims manager", async () => {
    await setUpGlobalVars(accounts);

    try {
      await vault.makePayout(1);
      assert(false, "only claims manager");
    } catch (ex) {
      assertVMException(ex, "OnlyClaimsManager");
    }

    try {
      await vault.setWithdrawPaused(false);
      assert(false, "only claims manager");
    } catch (ex) {
      assertVMException(ex, "OnlyClaimsManager");
    }

    try {
      await vault.startVault();
      assert(false, "only claims manager");
    } catch (ex) {
      assertVMException(ex, "OnlyClaimsManager");
    }

    try {
      await vault.destroyVault();
      assert(false, "only claims manager");
    } catch (ex) {
      assertVMException(ex, "OnlyClaimsManager");
    }
  });

  it("Add reward controller", async () => {
    await setUpGlobalVars(accounts);

    const RewardControllerFactory = await ethers.getContractFactory("RewardController");
    let rewardController2 = await RewardControllerFactory.deploy();
    await rewardController2.deployed();

    rewardController2 = await RewardController.at(rewardController2.address);

    await rewardController2.initialize(
      stakingToken.address,
      accounts[0],
      (await web3.eth.getBlock("latest")).number,
      10,
      epochRewardPerBlock
    );

    await stakingToken.mint(rewardController2.address, web3.utils.toWei("2500000"));

    var staker = accounts[1];
    await stakingToken.approve(vault.address, web3.utils.toWei("4"), {
      from: staker,
    });
    await stakingToken.mint(staker, web3.utils.toWei("1"));
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });

    assert.equal((await vault.rewardControllers(0)), rewardController.address);

    try {
      await vault.addRewardController(accounts[2], { from: accounts[1] });
      assert(false, "only governance");
    } catch (ex) {
      assertVMException(ex, "OnlyRegistryOwner");
    }

    try {
      await vault.addRewardController(rewardController.address);
      assert(false, "only governance");
    } catch (ex) {
      assertVMException(ex, "DuplicatedRewardController");
    }

    await advanceToSafetyPeriod();
    let tx = await claimsManager.submitClaim(
      accounts[2],
      8000,
      "description hash",
      {
        from: accounts[1],
      }
    );

    let claimId = tx.logs[0].args._claimId;

    await claimsManager.challengeClaim(claimId);

    // TODO: the limitation that a reward controller can't be added while a claim exists was removed.
    // try {
    //   await vault.addRewardController(rewardController2.address);
    //   assert(false, "cannot propose new reward controller while active claim exists");
    // } catch (ex) {
    //   assertVMException(ex, "ActiveClaimExists");
    // }

    await claimsManager.dismissClaim(claimId);

    await rewardController2.setAllocPoint(vault.address, 100);

    tx = await vault.addRewardController(rewardController2.address);
    assert.equal(tx.logs[0].event, "AddRewardController");
    assert.equal(tx.logs[0].args._newRewardController, rewardController2.address);

    assert.equal((await vault.rewardControllers(0)), rewardController.address);
    assert.equal((await vault.rewardControllers(1)), rewardController2.address);

    let expectedReward = await calculateExpectedReward(staker);

    tx = await rewardController.claimReward(vault.address, staker, { from: staker });
    assert.equal(tx.logs[2].event, "ClaimReward");
    assert.equal(tx.logs[2].args._vault, vault.address);
    assert.equal(tx.logs[2].args._amount.toString(), expectedReward);
    assert.equal(
      (await hatToken.balanceOf(staker)).toString(),
      expectedReward
    );
    assert.equal((await rewardController.getPendingReward(vault.address, staker)).toNumber(), "0");

    expectedReward = await calculateExpectedReward(staker, 0, vault, rewardController2);

    tx = await rewardController2.claimReward(vault.address, staker, { from: staker });
    assert.equal(tx.logs[2].event, "ClaimReward");
    assert.equal(tx.logs[2].args._vault, vault.address);
    assert.equal(tx.logs[2].args._amount.toString(), expectedReward);
    assert.equal(
      (await stakingToken.balanceOf(staker)).toString(),
      expectedReward
    );

    assert.equal((await rewardController2.getPendingReward(vault.address, staker)).toNumber(), "0");
  });

  it("Emergency withdraw", async () => {
    await setUpGlobalVars(accounts);

    var staker = accounts[1];
    await stakingToken.approve(vault.address, web3.utils.toWei("3"), {
      from: staker,
    });
    await stakingToken.mint(staker, web3.utils.toWei("3"));
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });

    assert.equal((await vault.rewardControllers(0)), rewardController.address);

    let expectedReward = await calculateExpectedReward(staker);

    tx = await rewardController.claimReward(vault.address, staker, { from: staker });
    assert.equal(tx.logs[2].event, "ClaimReward");
    assert.equal(tx.logs[2].args._vault, vault.address);
    assert.equal(tx.logs[2].args._amount.toString(), expectedReward.toString());
    assert.isFalse(tx.logs[2].args._amount.eq(0));
    assert.equal(
      (await hatToken.balanceOf(staker)).toString(),
      expectedReward.toString()
    );

    lastBlockNumber = (await web3.eth.getBlock("latest")).number - 1;
    assert.isFalse((await rewardController.getVaultReward(vault.address, lastBlockNumber)).eq(0));
    assert.equal(
      (await rewardController.vaultInfo(vault.address)).allocPoint.toString(),
      "100"
    );

    let withdrawPeriod = (
      await hatVaultsRegistry.generalParameters()
    ).withdrawPeriod.toNumber();
    let safetyPeriod = (
      await hatVaultsRegistry.generalParameters()
    ).safetyPeriod.toNumber();

    //increase time for the case there is already pending request ..so make sure start a new one..
    await utils.increaseTime(7 * 24 * 3600);
    await vault.withdrawRequest({ from: staker });

    //increase time for pending period
    await utils.increaseTime(7 * 24 * 3600);
    let currentTimeStamp = (await web3.eth.getBlock("latest")).timestamp;
    if (currentTimeStamp % (withdrawPeriod + safetyPeriod) >= withdrawPeriod) {
      await utils.increaseTime(
        (currentTimeStamp % (withdrawPeriod + safetyPeriod)) +
          safetyPeriod -
          withdrawPeriod
      );
    }
    await vault.emergencyWithdraw(staker, { from: staker });

    tx = await rewardController.claimReward(vault.address, staker, { from: staker });
    assert.equal(tx.logs[2].event, "ClaimReward");
    assert.equal(tx.logs[2].args._vault, vault.address);
    assert.equal(tx.logs[2].args._amount, 0);
    assert.equal(
      (await hatToken.balanceOf(staker)).toString(),
      expectedReward.toString()
    );
    assert.equal(await rewardController.getPendingReward(vault.address, accounts[0]), 0);

    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });
    let prevExpectedReward = expectedReward;
    expectedReward = await calculateExpectedReward(staker);

    tx = await rewardController.claimReward(vault.address, staker, { from: staker });

    let globalUpdatesLen = await rewardController.getGlobalVaultsUpdatesLength();
    let rewardPerShare = new web3.utils.BN(
      (await rewardController.vaultInfo(vault.address)).rewardPerShare
    );

    assert.equal(tx.logs[0].event, "VaultUpdated");
    assert.equal(tx.logs[0].args._vault, vault.address);
    assert.equal(tx.logs[0].args._rewardPerShare.toString(), rewardPerShare.toString());
    assert.equal(tx.logs[0].args._lastProcessedVaultUpdate, globalUpdatesLen - 1);

    assert.equal(tx.logs[1].event, "UserBalanceCommitted");
    assert.equal(tx.logs[1].args._vault, vault.address);
    assert.equal(tx.logs[1].args._user, staker);
    assert.equal(tx.logs[1].args._unclaimedReward.toString(), expectedReward.toString());
    assert.equal(tx.logs[1].args._rewardDebt.toString(), expectedReward.add(prevExpectedReward).toString());

    assert.equal(tx.logs[2].event, "ClaimReward");
    assert.equal(tx.logs[2].args._vault, vault.address);
    assert.equal(tx.logs[2].args._amount.toString(), expectedReward.toString());
    assert.isFalse(tx.logs[2].args._amount.eq(0));
    assert.equal(
      (await hatToken.balanceOf(staker)).toString(),
      expectedReward.add(prevExpectedReward).toString()
    );

    tx = await vault.addRewardController(accounts[2]);
    assert.equal(tx.logs[0].event, "AddRewardController");
    assert.equal(tx.logs[0].args._newRewardController, accounts[2]);

    assert.equal((await vault.rewardControllers(0)), rewardController.address);
    assert.equal((await vault.rewardControllers(1)), accounts[2]);

    try {
      await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });
      assert(false, "deposit fails with bad reward controller");
    } catch (ex) {
      assertVMException(ex);
    }

    try {
      await safeRedeem(vault, web3.utils.toWei("2"), staker);
      assert(false, "withdraw fails with bad reward controller");
    } catch (ex) {
      assertVMException(ex);
    }

    await vault.emergencyWithdraw(staker, { from: staker });
  });

  it("Reward controller sweep token", async () => {
    await setUpGlobalVars(accounts);

    var staker = accounts[1];
    await stakingToken.approve(vault.address, web3.utils.toWei("3"), {
      from: staker,
    });
    await stakingToken.mint(staker, web3.utils.toWei("3"));
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });

    assert.equal((await vault.rewardControllers(0)), rewardController.address);

    let expectedReward = await calculateExpectedReward(staker);

    tx = await rewardController.claimReward(vault.address, staker, { from: staker });
    assert.equal(tx.logs[2].event, "ClaimReward");
    assert.equal(tx.logs[2].args._vault, vault.address);
    assert.equal(tx.logs[2].args._amount.toString(), expectedReward.toString());
    assert.isFalse(tx.logs[2].args._amount.eq(0));
    assert.equal(
      (await hatToken.balanceOf(staker)).toString(),
      expectedReward.toString()
    );

    lastBlockNumber = (await web3.eth.getBlock("latest")).number - 1;
    assert.isFalse((await rewardController.getVaultReward(vault.address, lastBlockNumber)).eq(0));
    assert.equal(
      (await rewardController.vaultInfo(vault.address)).allocPoint.toString(),
      "100"
    );

    try {
      await rewardController.sweepToken(
        hatToken.address,
        await hatToken.balanceOf(rewardController.address),
        { from: accounts[1] }
      );
      assert(false, "only owner");
    } catch (ex) {
      assertVMException(ex, "Ownable: caller is not the owner");
    }

    let amountToSweep = await hatToken.balanceOf(rewardController.address);
    await rewardController.sweepToken(hatToken.address, amountToSweep);
    assert.equal(
      (await hatToken.balanceOf(rewardController.address)).toString(),
      "0"
    );
    assert.equal(
      (await hatToken.balanceOf(accounts[0])).toString(),
      amountToSweep.toString()
    );

    try {
      await rewardController.claimReward(vault.address, staker, { from: staker });
      assert(false, "can't claim reward when there are not enough rewards");
    } catch (ex) {
      assertVMException(ex, "ERC20: transfer amount exceeds balance");
    }
  });

  it("Set reward controller for vault with no alloc point", async () => {
    await setUpGlobalVars(accounts);

    var staker = accounts[1];
    await stakingToken.approve(vault.address, web3.utils.toWei("4"), {
      from: staker,
    });
    await stakingToken.mint(staker, web3.utils.toWei("1"));
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });

    assert.equal((await vault.rewardControllers(0)), rewardController.address);

    try {
      await rewardController.setAllocPoint(vault.address, 0, { from: accounts[1] });
      assert(false, "only gov");
    } catch (ex) {
      assertVMException(ex, "Ownable: caller is not the owner");
    }

    tx = await rewardController.setAllocPoint(vault.address, 0);

    assert.equal(tx.logs[1].event, "SetAllocPoint");
    assert.equal(tx.logs[1].args._vault, vault.address);
    assert.equal(tx.logs[1].args._prevAllocPoint, 100);
    assert.equal(tx.logs[1].args._allocPoint, 0);

    tx = await vault.addRewardController(accounts[2]);
    assert.equal(tx.logs[0].event, "AddRewardController");
    assert.equal(tx.logs[0].args._newRewardController, accounts[2]);

    assert.equal((await vault.rewardControllers(0)), rewardController.address);
    assert.equal((await vault.rewardControllers(1)), accounts[2]);

    let lastBlockNumber = (await web3.eth.getBlock("latest")).number - 1;
    assert.equal(
      (await rewardController.getVaultReward(vault.address, lastBlockNumber)).toString(),
      "0"
    );
    assert.equal(
      (await rewardController.vaultInfo(vault.address)).allocPoint.toString(),
      "0"
    );
  });

  it("create vault", async () => {
    await setUpGlobalVars(accounts);

    let maxBounty = 8000;
    let bountySplit = [7000, 2500, 500];
    let stakingToken2 = await ERC20Mock.new("Staking", "STK");
    let tx = await hatVaultsRegistry.createVault(
      {
        asset: stakingToken2.address,
        name: "VAULT",
        symbol: "VLT",
        rewardControllers: [rewardController.address],
        owner: await hatVaultsRegistry.owner(),
        isPaused: false,
        descriptionHash: "_descriptionHash1",
      },
      {
      owner: await hatVaultsRegistry.owner(),
      committee: accounts[3],
      arbitrator: accounts[2],
      arbitratorCanChangeBounty: true,
      arbitratorCanChangeBeneficiary: false,
      arbitratorCanSubmitClaims: false,
      isTokenLockRevocable: false,
      maxBounty: maxBounty,
      bountySplit: bountySplit,
      governanceFee: 65535,
      vestingDuration: 86400,
      vestingPeriods: 10
      }
    );
    assert.equal(tx.logs[2].event, "VaultCreated");
    assert.equal(
      tx.logs[2].args._vault,
      await hatVaultsRegistry.hatVaults((await hatVaultsRegistry.getNumberOfVaults()).sub(new web3.utils.BN("1")))
    );

    assert.equal(tx.logs[2].args._vaultParams.asset, stakingToken2.address);
    assert.equal(tx.logs[2].args._vaultParams.owner, await hatVaultsRegistry.owner());
    assert.equal(tx.logs[2].args._vaultParams.rewardControllers[0], rewardController.address);
    assert.equal(tx.logs[2].args._vaultParams.name, "VAULT");
    assert.equal(tx.logs[2].args._vaultParams.symbol, "VLT");
    assert.equal(tx.logs[2].args._vaultParams.isPaused, false);
    assert.equal(tx.logs[2].args._vaultParams.descriptionHash, "_descriptionHash1");
    assert.equal(tx.logs[2].args._claimsManagerParams.owner, await hatVaultsRegistry.owner());
    assert.equal(tx.logs[2].args._claimsManagerParams.committee, accounts[3]);
    assert.equal(tx.logs[2].args._claimsManagerParams.maxBounty, maxBounty);
    assert.equal(tx.logs[2].args._claimsManagerParams.bountySplit.hackerVested, "7000");
    assert.equal(tx.logs[2].args._claimsManagerParams.bountySplit.hacker, "2500");
    assert.equal(tx.logs[2].args._claimsManagerParams.bountySplit.committee, "500");
    assert.equal(tx.logs[2].args._claimsManagerParams.vestingDuration, 86400);
    assert.equal(tx.logs[2].args._claimsManagerParams.vestingPeriods, 10);
    assert.equal(tx.logs[2].args._claimsManagerParams.arbitrator, accounts[2]);
    let newVault = await HATVault.at(tx.logs[2].args._vault);
    let newClaimsManager = await HATClaimsManager.at(tx.logs[2].args._claimsManager);
    let logs = await newVault.getPastEvents('SetVaultDescription', {
        fromBlock: 0,
        toBlock: (await web3.eth.getBlock("latest")).number
    });
    assert.equal(logs[0].event, "SetVaultDescription");
    assert.equal(logs[0].args._descriptionHash, "_descriptionHash1");

    assert.equal(await newVault.name(), "Hats Vault VAULT");
    assert.equal(await newVault.symbol(), "HATVLT");
    assert.equal(await newVault.VERSION(), "3.0");
    assert.equal(await newClaimsManager.VERSION(), "3.0");

    try {
      await newVault.initialize(newClaimsManager.address, {
        asset: stakingToken.address,
        owner: await hatVaultsRegistry.owner(),
        rewardControllers: [rewardController.address],
        name: "VAULT",
        symbol: "VLT",
        descriptionHash: "_descriptionHash",
        isPaused: false
      });
      assert(false, "already initialized");
    } catch (ex) {
      assertVMException(ex, "Initializable: contract is already initialized");
    }

    try {
      await newClaimsManager.initialize(newVault.address, {
        owner: await hatVaultsRegistry.owner(),
        committee: accounts[1],
        arbitrator: accounts[2],
        maxBounty: 8000,
        bountySplit: [7000, 2500, 500],
        governanceFee: 65535,
        arbitratorCanChangeBounty: true,
        arbitratorCanChangeBeneficiary: false,
        arbitratorCanSubmitClaims: false,
        isTokenLockRevocable: false,
        vestingDuration: 86400,
        vestingPeriods: 10
      });
      assert(false, "already initialized");
    } catch (ex) {
      assertVMException(ex, "Initializable: contract is already initialized");
    }
  });

  it("cannot create vault with duplicated reward controller", async () => {
    await setUpGlobalVars(accounts);

    let maxBounty = 8000;
    let bountySplit = [7000, 2500, 500];
    let stakingToken2 = await ERC20Mock.new("Staking", "STK");

    try {
      await hatVaultsRegistry.createVault(
        {
          asset: stakingToken2.address,
          name: "VAULT",
          symbol: "VLT",
          rewardControllers: [rewardController.address, rewardController.address],
          owner: await hatVaultsRegistry.owner(),
          isPaused: false,
          descriptionHash: "_descriptionHash1",
        },
        {
        owner: await hatVaultsRegistry.owner(),
        committee: accounts[3],
        arbitrator: accounts[2],
        maxBounty: maxBounty,
        bountySplit: bountySplit,
        governanceFee: 65535,
        vestingDuration: 86400,
        vestingPeriods: 10
        }
      );
      assert(false, "cannot create vault with duplicated reward controller");
    } catch (ex) {
      assertVMException(ex, "DuplicatedRewardController");
    }
  });

  it("setCommittee", async () => {
    await setUpGlobalVars(accounts);
    assert.equal(await claimsManager.committee(), accounts[1]);

    await claimsManager.setCommittee(accounts[2], { from: accounts[1] });

    assert.equal(await claimsManager.committee(), accounts[2]);

    try {
      await claimsManager.setCommittee(accounts[2], { from: accounts[1] });
      assert(false, "cannot set committee from non committee account");
    } catch (ex) {
      assertVMException(ex, "OnlyCommittee");
    }

    //create another vault with a different committee
    let maxBounty = 8000;
    let bountySplit = [7000, 2500, 500];
    var stakingToken2 = await ERC20Mock.new("Staking", "STK");
    let tx = (await hatVaultsRegistry.createVault(
      {
        asset: stakingToken2.address,
        name: "VAULT",
        symbol: "VLT",
        rewardControllers: [rewardController.address],
        owner: await hatVaultsRegistry.owner(),
        isPaused: false,
        descriptionHash: "_descriptionHash",
      },
      {
      owner: await hatVaultsRegistry.owner(),
      committee: accounts[3],
      arbitrator: "0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF",
      arbitratorCanChangeBounty: true,
      arbitratorCanChangeBeneficiary: false,
      arbitratorCanSubmitIssues: false,
      isTokenLockRevocable: false,
      maxBounty: maxBounty,
      bountySplit: bountySplit,
      governanceFee: 65535,
      vestingDuration: 86400,
      vestingPeriods: 10
      }
    ));

    let newVault = await HATVault.at(tx.logs[2].args._vault);
    let newClaimsManager = await HATClaimsManager.at(tx.logs[2].args._claimsManager);

    tx = await rewardController.setAllocPoint(
      newVault.address,
      100
    );

    assert.equal(tx.logs[0].event, "SetAllocPoint");
    assert.equal(tx.logs[0].args._vault, newVault.address);
    assert.equal(tx.logs[0].args._prevAllocPoint, 0);
    assert.equal(tx.logs[0].args._allocPoint, 100);

    assert.equal(await newClaimsManager.committee(), accounts[3]);

    await newClaimsManager.setCommittee(accounts[1]);

    assert.equal(await newClaimsManager.committee(), accounts[1]);
    var staker = accounts[1];
    await stakingToken2.approve(newVault.address, web3.utils.toWei("4"), {
      from: staker,
    });
    await stakingToken2.mint(staker, web3.utils.toWei("1"));
    try {
      await newVault.deposit(web3.utils.toWei("1"), staker, { from: staker });
      assert(false, "cannot deposit before committee check in");
    } catch (ex) {
      assertVMException(ex, "VaultNotStartedYet");
    }

    try {
      await newClaimsManager.committeeCheckIn({ from: accounts[0] });
      assert(false, "only committee can check in");
    } catch (ex) {
      assertVMException(ex, "OnlyCommittee");
    }
    tx = await newClaimsManager.committeeCheckIn({ from: accounts[1] });
    assert.equal(tx.logs[0].event, "CommitteeCheckedIn");

    try {
      await newClaimsManager.setCommittee(accounts[2]);
      assert(false, "committee already checked in");
    } catch (ex) {
      assertVMException(ex, "CommitteeAlreadyCheckedIn");
    }
    await newClaimsManager.setCommittee(accounts[2], { from: accounts[1] });
    await newClaimsManager.setCommittee(accounts[1], { from: accounts[2] });
  });

  it("dismiss can be called by anyone after 125 days delay", async () => {
    var staker = accounts[1];
    await setUpGlobalVars(accounts, 0, 9000, [9000, 0, 1000], 1000, 10, 100, 2500000, 60 * 60 * 24 * 3);

    await advanceToSafetyPeriod();
    await stakingToken.approve(vault.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await stakingToken.mint(staker, web3.utils.toWei("1"));
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });
    let tx = await claimsManager.submitClaim(
      accounts[2],
      8000,
      "description hash",
      {
        from: accounts[1],
      }
    );

    let claimId = tx.logs[0].args._claimId;

    await claimsManager.challengeClaim(claimId);
    try {
      await claimsManager.dismissClaim(claimId, { from: accounts[1] });
      assert(false, "only arbitrator can dismiss before delay");
    } catch (ex) {
      assertVMException(
        ex,
        "OnlyCallableByArbitratorOrAfterChallengeTimeOutPeriod"
      );
    }
    await utils.increaseTime(1);
    await utils.increaseTime(125 * 24 * 60 * 60);
    tx = await claimsManager.dismissClaim(claimId, { from: accounts[1] });
    assert.equal(tx.logs[0].event, "DismissClaim");
  });

  it("custom bountySplit, governanceFee, and max bounty", async () => {
    try {
      await setUpGlobalVars(accounts, 0, 9000, [9000, 1, 1000], 100);
      assert(false, "cannot init with rewardSplit > 10000");
    } catch (ex) {
      assertVMException(ex, "TotalSplitPercentageShouldBeHundredPercent");
    }

    try {
      await setUpGlobalVars(accounts, 0, 9000, [9000, 0, 999], 100);
      assert(false, "cannot init with rewardSplit < 10000");
    } catch (ex) {
      assertVMException(ex, "TotalSplitPercentageShouldBeHundredPercent");
    }

    try {
      await setUpGlobalVars(accounts, 0, 9901, [8000, 1000, 1000], 100);
      assert(false, "cannot init with max bounty > 10000");
    } catch (ex) {
      assertVMException(ex, "MaxBountyCannotBeMoreThanMaxBountyLimit");
    }

    try {
      await setUpGlobalVars(accounts, 0, 9000, [8000, 1000, 1000], 3501);
      assert(false, "cannot init with default governance fee > 3500");
    } catch (ex) {
      assertVMException(ex, "FeeCannotBeMoreThanMaxFee");
    }

    await setUpGlobalVars(accounts, 0, 9000, [8000, 1500, 500], 200, 10, 100, 2500000, 60 * 60 * 24 * 3);

    try {
      await hatVaultsRegistry.createVault(
        {
          asset: stakingToken.address,
          name: "VAULT",
          symbol: "VLT",
          rewardControllers: [rewardController.address],
          owner: await hatVaultsRegistry.owner(),
          isPaused: false,
          descriptionHash: "_descriptionHash1",
        },
        {
        owner: await hatVaultsRegistry.owner(),
        committee: accounts[3],
        arbitrator: accounts[2],
        maxBounty: 8000,
        bountySplit: [8000, 1500, 500],
        governanceFee: 3501,
        vestingDuration: 86400,
        vestingPeriods: 10
        }
      );
      assert(false, "cannot init with governance fee > 3500");
    } catch (ex) {
      assertVMException(ex, "FeeCannotBeMoreThanMaxFee");
    }

    assert.equal((await claimsManager.maxBounty()).toString(), "9000");
    assert.equal(
      (await claimsManager.bountySplit()).hacker.toString(),
      "1500"
    );
    assert.equal(
      (await claimsManager.bountySplit()).hackerVested.toString(),
      "8000"
    );
    assert.equal(
      (await claimsManager.bountySplit()).committee.toString(),
      "500"
    );
    assert.equal(
      (await claimsManager.getGovernanceFee()).toString(),
      "200"
    );

    try {
      await claimsManager.setPendingMaxBounty(9001);
      assert(false, "max bounty can't be more than 9000");
    } catch (ex) {
      assertVMException(ex, "MaxBountyCannotBeMoreThanMaxBountyLimit");
    }
    try {
      await claimsManager.setPendingMaxBounty(9000, { from: accounts[1] });
      assert(false, "only owner");
    } catch (ex) {
      assertVMException(ex, "Ownable: caller is not the owner");
    }
    try {
      await claimsManager.setMaxBounty();
      assert(false, "no pending");
    } catch (ex) {
      assertVMException(ex, "NoPendingMaxBounty");
    }

    try {
      await claimsManager.setPendingMaxBounty(9001);
      assert(false, "bounty level should be less than or equal to 9000");
    } catch (ex) {
      assertVMException(ex, "MaxBountyCannotBeMoreThanMaxBountyLimit");
    }

    // bountylevel can be 9000 without throwing an error
    let tx = await claimsManager.setPendingMaxBounty(9000);
    assert.equal(tx.logs[0].event, "SetPendingMaxBounty");
    assert.equal(tx.logs[0].args._maxBounty, 9000);

    await utils.increaseTime(1);
    try {
      await claimsManager.setMaxBounty();
      assert(false, "no delay yet");
    } catch (ex) {
      assertVMException(ex, "DelayPeriodForSettingMaxBountyHadNotPassed");
    }
    await utils.increaseTime(3600 * 24 * 2);
    try {
      await claimsManager.setMaxBounty({ from: accounts[1] });
      assert(false, "only owner");
    } catch (ex) {
      assertVMException(ex, "Ownable: caller is not the owner");
    }
    tx = await claimsManager.setMaxBounty();
    assert.equal(tx.logs[0].event, "SetMaxBounty");
    assert.equal(tx.logs[0].args._maxBounty, 9000);

    await advanceToNonSafetyPeriod();

    try {
      await claimsManager.setBountySplit([8000, 1100, 1000]);
      assert(false, "cannot init with bountySplit > 10000");
    } catch (ex) {
      assertVMException(ex, "TotalSplitPercentageShouldBeHundredPercent");
    }
    
    try {
      await claimsManager.setBountySplit([8000, 999, 1001]);
      assert(false, "cannot init with committte bounty > 1000");
    } catch (ex) {
      assertVMException(ex, "CommitteeBountyCannotBeMoreThanMax");
    }

    try {
      await claimsManager.setGovernanceFee(3501);
      assert(false, "cannot set governance fee to more than 3500");
    } catch (ex) {
      assertVMException(ex, "FeeCannotBeMoreThanMaxFee");
    }

    try {
      await claimsManager.setBountySplit([6800, 2200, 1000], { from: accounts[1] });
      assert(false, "only owner");
    } catch (ex) {
      assertVMException(ex, "Ownable: caller is not the owner");
    }

    try {
      await claimsManager.setGovernanceFee(0, { from: accounts[1] });
      assert(false, "only registry owner");
    } catch (ex) {
      assertVMException(ex, "OnlyRegistryOwner");
    }

    await claimsManager.setBountySplit([6800, 2200, 1000]);
    tx = await claimsManager.setGovernanceFee(0);
    assert.equal(tx.logs[0].event, "SetGovernanceFee");
    assert.equal(tx.logs[0].args._governanceFee, "0");

    assert.equal(
      (await claimsManager.maxBounty()).toString(),
      "9000"
    );
    assert.equal(
      (await claimsManager.bountySplit()).hacker.toString(),
      "2200"
    );
    assert.equal(
      (await claimsManager.bountySplit()).hackerVested.toString(),
      "6800"
    );

    assert.equal(
      (await claimsManager.bountySplit()).committee.toString(),
      "1000"
    );
    assert.equal(
      (await claimsManager.getGovernanceFee()).toString(),
      "0"
    );

    await advanceToSafetyPeriod();
    tx = await claimsManager.submitClaim(
      accounts[2],
      9000,
      "description hash",
      {
        from: accounts[1],
      }
    );

    let claimId = tx.logs[0].args._claimId;

    try {
      await claimsManager.setMaxBounty();
      assert(false, "active claim exists");
    } catch (ex) {
      assertVMException(ex, "ActiveClaimExists");
    }

    await claimsManager.challengeClaim(claimId);

    await assertFunctionRaisesException(
      claimsManager.setPendingMaxBounty(8000),
      "ActiveClaimExists"
    );
    await assertFunctionRaisesException(
      claimsManager.setBountySplit([6000, 3000, 1000]),
      "ActiveClaimExists"
    );

    tx = await claimsManager.dismissClaim(claimId);
    assert.equal(tx.logs[0].event, "DismissClaim");
    assert.equal(tx.logs[0].args._claimId, claimId);

    try {
      await claimsManager.setBountySplit([6000, 3000, 1000]);
      assert(false, "cannot set split while in safety period");
    } catch (ex) {
      assertVMException(ex, "SafetyPeriod");
    }

    await advanceToNonSafetyPeriod();

    await claimsManager.setBountySplit([6000, 3000, 1000]);

    tx = await claimsManager.setGovernanceFee(1);
    assert.equal(tx.logs[0].event, "SetGovernanceFee");
    assert.equal(tx.logs[0].args._governanceFee, "1");

    await claimsManager.setPendingMaxBounty(8000);

    await utils.increaseTime(24 * 3600 * 2);
    await claimsManager.setMaxBounty();
    assert.equal((await claimsManager.maxBounty()).toString(), "8000");
  });

  it("max bounty can be 100%", async () => {
    await setUpGlobalVars(accounts, 0, 10000, [9000, 0, 1000], 100);

    // bountylevel can be 10000 without throwing an error
    let tx = await claimsManager.setPendingMaxBounty(10000);
    assert.equal(tx.logs[0].event, "SetPendingMaxBounty");
    assert.equal(tx.logs[0].args._maxBounty, 10000);

    var staker = accounts[1];

    await stakingToken.approve(vault.address, web3.utils.toWei("1"), {
      from: staker,
    });

    await stakingToken.mint(staker, web3.utils.toWei("1"));
    assert.equal(await stakingToken.balanceOf(staker), web3.utils.toWei("1"));
    assert.equal(
      await hatToken.balanceOf(rewardController.address),
      web3.utils.toWei(rewardControllerExpectedHatsBalance.toString())
    );

    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });

    await advanceToSafetyPeriod();

       // any claims with values under MBX_BOUNY_LIMIT work as usual
    tx = await claimsManager.submitClaim(accounts[2], 8000, "description hash", {
      from: accounts[1],
    });
  
    let claimId = tx.logs[0].args._claimId;
  
    await claimsManager.challengeClaim(claimId);
  
    assert.equal((await stakingToken.balanceOf(vault.address)).toString(), web3.utils.toWei("1"));
  
    tx = await claimsManager.approveClaim(claimId, 8001, ZERO_ADDRESS);

    let logs = await vault.getPastEvents('VaultPayout', {
      fromBlock: tx.blockNumber,
      toBlock: tx.blockNumber
    });

    assert.equal(logs[0].event, "VaultPayout");
    assert.equal(logs[0].args._amount, web3.utils.toWei("0.8001").toString());

    // we cannot submit claims that are over MAX_BOUNY_LIMIT though
    try {
      await claimsManager.submitClaim(
        accounts[2],
        9500,
        "description hash",
        {
         from: accounts[1],
        }
      );
      assert(false, "cannot submit less than 100% when max bounty is 100% but more than MAX_BOUNTY_LIMIT");
    } catch (ex) {
      assertVMException(ex, "PayoutMustBeUpToMaxBountyLimitOrHundredPercent");
    }

    tx = await claimsManager.submitClaim(accounts[2], 10000, "description hash", {
      from: accounts[1],
    });

    claimId = tx.logs[0].args._claimId;

    await claimsManager.challengeClaim(claimId);

    try {
      await claimsManager.approveClaim(claimId, 9500, ZERO_ADDRESS);
      assert(false, "cannot approve less than 100% when max bounty is 100%  but more than MAX_BOUNTY_LIMIT");
    } catch (ex) {
      assertVMException(ex, "PayoutMustBeUpToMaxBountyLimitOrHundredPercent");
    }

    // assert.equal(await stakingToken.balanceOf(vault.address), web3.utils.toWei("1"));

    tx = await claimsManager.approveClaim(claimId, 10000, ZERO_ADDRESS);

    logs = await vault.getPastEvents('VaultPayout', {
      fromBlock: tx.blockNumber,
      toBlock: tx.blockNumber
    });

    assert.equal(logs[0].event, "VaultPayout");
    assert.equal(logs[0].args._amount, web3.utils.toWei("0.1999").toString());

    logs = await vault.getPastEvents('VaultDestroyed', {
      fromBlock: tx.blockNumber,
      toBlock: tx.blockNumber
    });

    assert.equal(logs[0].event, "VaultDestroyed");

    assert.equal(await stakingToken.balanceOf(vault.address), "0");

    assert.equal(await vault.depositPause(), true);

    try {
      await vault.setDepositPause(false);
      assert(false, "cannot unpause deposits after vault was destroyed");
    } catch (ex) {
      assertVMException(ex, "CannotUnpauseDestroyedVault");
    }
  });

  it("update default governanceFee", async () => {
    await setUpGlobalVars(accounts);

    assert.equal(
      (await claimsManager.getGovernanceFee()).toString(),
      "2000"
    );

    assert.equal(
      (await hatVaultsRegistry.defaultGovernanceFee()).toString(),
      "2000"
    );

    try {
      await hatVaultsRegistry.setDefaultGovernanceFee(3501);
      assert(false, "cannot set governance fee to more than 2000");
    } catch (ex) {
      assertVMException(ex, "FeeCannotBeMoreThanMaxFee");
    }

    try {
      await hatVaultsRegistry.setDefaultGovernanceFee(200, { from: accounts[1] });
      assert(false, "only owner");
    } catch (ex) {
      assertVMException(ex, "Ownable: caller is not the owner");
    }

    await claimsManager.setGovernanceFee(1500);

    let tx = await hatVaultsRegistry.setDefaultGovernanceFee(200);
    assert.equal(tx.logs[0].event, "SetDefaultGovernanceFee");
    assert.equal(tx.logs[0].args._defaultGovernanceFee.toString(), "200");

    assert.equal(
      (await hatVaultsRegistry.defaultGovernanceFee()).toString(),
      "200"
    );

    tx = await hatVaultsRegistry.createVault(
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
      isTokenLockRevocable: false,
      maxBounty: 8000,
      bountySplit: [7000, 2500, 500],
      governanceFee: 65535,
      vestingDuration: 86400,
      vestingPeriods: 10
      },
      { from: accounts[1] }
    );

    let newClaimsManager = await HATClaimsManager.at(tx.logs[2].args._claimsManager);

    assert.equal(
      (await newClaimsManager.getGovernanceFee()).toString(),
      "200"
    );

    assert.equal(
      (await claimsManager.getGovernanceFee()).toString(),
      "1500"
    );

    tx = await claimsManager.setGovernanceFee(await claimsManager.NULL_UINT16());
    assert.equal(tx.logs[0].event, "SetGovernanceFee");
    assert.equal(tx.logs[0].args._governanceFee.toString(), (await claimsManager.NULL_UINT16()).toString());

    assert.equal(
      (await claimsManager.getGovernanceFee()).toString(),
      "200"
    );

    tx = await hatVaultsRegistry.setDefaultGovernanceFee(300);
    assert.equal(tx.logs[0].event, "SetDefaultGovernanceFee");
    assert.equal(tx.logs[0].args._defaultGovernanceFee.toString(), "300");

    assert.equal(
      (await newClaimsManager.getGovernanceFee()).toString(),
      "300"
    );

    assert.equal(
      (await claimsManager.getGovernanceFee()).toString(),
      "300"
    );
  });

  it("zero totalAllocPoints", async () => {
    await setUpGlobalVars(accounts, 0, 9000, [8000, 1000, 1000], 1000, 10, 0);

    var staker = accounts[1];

    await stakingToken.approve(vault.address, web3.utils.toWei("1"), {
      from: staker,
    });

    await stakingToken.mint(staker, web3.utils.toWei("1"));
    assert.equal(await stakingToken.balanceOf(staker), web3.utils.toWei("1"));
    assert.equal(
      await hatToken.balanceOf(rewardController.address),
      web3.utils.toWei(rewardControllerExpectedHatsBalance.toString())
    );

    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });
    let tx = await rewardController.updateVault(vault.address);
    assert.equal(tx.logs[0].event, "VaultUpdated");
    assert.equal(tx.logs[0].args._vault, vault.address);
    assert.equal(tx.logs[0].args._rewardPerShare, 0);
    assert.equal(tx.logs[0].args._lastProcessedVaultUpdate, 0);
  });

  it("anyone can create a vault", async () => {
    await setUpGlobalVars(accounts);

    assert.equal((await hatVaultsRegistry.getNumberOfVaults()).toString(), "1");

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
      isTokenLockRevocable: false,
      maxBounty: 8000,
      bountySplit: [7000, 2500, 500],
      governanceFee: 65535,
      vestingDuration: 86400,
      vestingPeriods: 10
      },
      { from: accounts[1] }
    );

    let newVault = await HATVault.at(tx.logs[2].args._vault);
    let newClaimsManager = await HATClaimsManager.at(tx.logs[2].args._claimsManager);

    assert.equal((await hatVaultsRegistry.getNumberOfVaults()).toString(), "2");
    await newClaimsManager.committeeCheckIn({ from: accounts[1] });

    var staker = accounts[4];
    await stakingToken.approve(newVault.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await stakingToken.mint(staker, web3.utils.toWei("1"));
    await newVault.deposit(web3.utils.toWei("1"), staker, { from: staker });

    await rewardController.updateVault(newVault.address);

    await rewardController.claimReward(newVault.address, staker, { from: staker });
    assert.equal(
      (await hatToken.balanceOf(staker)).toString(),
      web3.utils.toWei("0").toString()
    );
    await safeRedeem(newVault, web3.utils.toWei("1"), staker);

    await rewardController.setAllocPoint(
      newVault.address,
      100
    );
    await stakingToken.approve(newVault.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await newVault.deposit(web3.utils.toWei("1"), staker, { from: staker });

    let expectedReward = await calculateExpectedReward(staker, 0, newVault);

    await rewardController.claimReward(newVault.address, staker, { from: staker });
    assert.equal(
      (await hatToken.balanceOf(staker)).toString(),
      expectedReward.toString()
    );

    await safeRedeem(newVault, web3.utils.toWei("1"), staker);
    await rewardController.setAllocPoint(
      newVault.address,
      0
    );
    await stakingToken.approve(newVault.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await newVault.deposit(web3.utils.toWei("1"), staker, { from: staker });
    let expectedBalance = (await hatToken.balanceOf(staker));
    expectedReward = await calculateExpectedReward(staker, 0, newVault);
    await rewardController.claimReward(newVault.address, staker, { from: staker });
    assert.equal(
      (await hatToken.balanceOf(staker)).toString(),
      expectedBalance.add(expectedReward).toString()
    );
  });

  it("deposit cannot be 0", async () => {
    await setUpGlobalVars(accounts);
    var staker = accounts[1];

    await stakingToken.approve(vault.address, web3.utils.toWei("1"), {
      from: staker,
    });

    await stakingToken.mint(staker, web3.utils.toWei("1"));
    assert.equal(await stakingToken.balanceOf(staker), web3.utils.toWei("1"));
    assert.equal(
      await hatToken.balanceOf(rewardController.address),
      web3.utils.toWei(rewardControllerExpectedHatsBalance.toString())
    );
    try {
      await vault.methods["mint(uint256,address)"](0, staker, { from: staker });
      assert(false, "cannot deposit 0");
    } catch (ex) {
      assertVMException(ex, "AmountCannotBeZero");
    }

    await vault.deposit(1000000, staker, { from: staker });

    await stakingToken.mint(vault.address, web3.utils.toWei("10"));

    try {
      await vault.deposit(1, staker, { from: staker });
      assert(false, "cannot deposit amount too low for 1 share");
    } catch (ex) {
      assertVMException(ex, "AmountCannotBeZero");
    }
  });

  it("deposit and withdraw cannot be reentered", async () => {
    await setUpGlobalVars(accounts);
    var staker = accounts[1];

    await stakingToken.approve(vault.address, web3.utils.toWei("1"), {
      from: staker,
    });

    await stakingToken.mint(staker, web3.utils.toWei("1"));
    assert.equal(await stakingToken.balanceOf(staker), web3.utils.toWei("1"));
    assert.equal(
      await hatToken.balanceOf(rewardController.address),
      web3.utils.toWei(rewardControllerExpectedHatsBalance.toString())
    );

    await stakingToken.setReenterDeposit(true);

    try {
      await vault.methods["mint(uint256,address)"](1, staker, { from: staker });
      assert(false, "fail on reentrancy attempt");
    } catch (ex) {
      assertVMException(ex, "ReentrancyGuard: reentrant call");
    }

    try {
      await vault.deposit(1, staker, { from: staker });
      assert(false, "fail on reentrancy attempt");
    } catch (ex) {
      assertVMException(ex, "ReentrancyGuard: reentrant call");
    }

    await stakingToken.setReenterDeposit(false);

    await stakingToken.setReenterWithdrawRequest(true);

    try {
      await vault.deposit(1, staker, { from: staker });
      assert(false, "fail on reentrancy attempt");
    } catch (ex) {
      assertVMException(ex, "ReentrancyGuard: reentrant call");
    }

    await stakingToken.setReenterWithdrawRequest(false);

    await vault.deposit(1000000, staker, { from: staker });

    await stakingToken.mint(vault.address, web3.utils.toWei("10"));

    await stakingToken.setReenterWithdraw(true);

    try {
      await safeWithdraw(vault, 1, staker);
      assert(false, "fail on reentrancy attempt");
    } catch (ex) {
      assertVMException(ex, "ReentrancyGuard: reentrant call");
    }

    try {
      await safeRedeem(vault, 1, staker);
      assert(false, "fail on reentrancy attempt");
    } catch (ex) {
      assertVMException(ex, "ReentrancyGuard: reentrant call");
    }

    await stakingToken.setReenterWithdraw(false);

    await safeWithdraw(vault, 1, staker);
  });

  it("withdraw procedure is sane", async () => {
    await setUpGlobalVars(accounts, 0, 8000, [7000, 2500, 500], 1000, 10, 100, 2500000, 60 * 60 * 24 * 3);
    var staker = accounts[1];

    await stakingToken.approve(vault.address, web3.utils.toWei("1"), {
      from: staker,
    });

    await stakingToken.mint(staker, web3.utils.toWei("1"));
    assert.equal(await stakingToken.balanceOf(staker), web3.utils.toWei("1"));
    assert.equal(
      await hatToken.balanceOf(rewardController.address),
      web3.utils.toWei(rewardControllerExpectedHatsBalance.toString())
    );

    try {
      await vault.setDepositPause(true, { from: accounts[1] });
      assert(false, "only gov");
    } catch (ex) {
      assertVMException(ex, "Ownable: caller is not the owner");
    }

    let tx = await vault.setDepositPause(true);
    assert.equal(tx.logs[0].event, "SetDepositPause");
    assert.equal(tx.logs[0].args._depositPause, true);

    try {
      await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });
      assert(false, "cannot deposit to a paused vault");
    } catch (ex) {
      assertVMException(ex, "ERC4626: deposit more than max");
    }

    try {
      await vault.methods["mint(uint256,address)"](web3.utils.toWei("1"), staker, { from: staker });
      assert(false, "cannot mint to a paused vault");
    } catch (ex) {
      assertVMException(ex, "ERC4626: mint more than max");
    }
    await vault.setDepositPause(false);

    tx = await hatVaultsRegistry.setEmergencyPaused(true);
    assert.equal(tx.logs[0].event, "SetEmergencyPaused");
    assert.equal(tx.logs[0].args._isEmergencyPaused, true);

    // can not deposit during emergeny pause
    await assertFunctionRaisesException(
      vault.deposit(web3.utils.toWei("1"), staker, { from: staker }),
      "SystemInEmergencyPause"
    );
    await hatVaultsRegistry.setEmergencyPaused(false);

    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });
    await utils.increaseTime(7 * 24 * 3600);
    await advanceToSafetyPeriod();

    await hatVaultsRegistry.setEmergencyPaused(true);
    
    // can not submit a claim during emergency pause
    const committee = accounts[1];
    await assertFunctionRaisesException(
      claimsManager.submitClaim(
        accounts[2],
        8000,
        "description hash",
        {
          from: committee,
        }
      ),
      "SystemInEmergencyPause"
    );
    tx = await hatVaultsRegistry.setEmergencyPaused(false);
    assert.equal(tx.logs[0].event, "SetEmergencyPaused");
    assert.equal(tx.logs[0].args._isEmergencyPaused, false);

    tx = await claimsManager.submitClaim(
      accounts[2],
      8000,
      "description hash",
      {
        from: accounts[1],
      }
    );

    // can challenge and dismiss claims and withdraw during emergency pause
    await hatVaultsRegistry.setEmergencyPaused(true);

    let claimId = tx.logs[0].args._claimId;
    await claimsManager.challengeClaim(claimId);

    try {
      await safeRedeem(vault, web3.utils.toWei("1"), staker);
      assert(false, "cannot withdraw while pending approval exists");
    } catch (ex) {
      assertVMException(ex, "RedeemMoreThanMax");
    }

    tx = await claimsManager.dismissClaim(claimId);
    assert.equal(tx.logs[0].event, "DismissClaim");

    let currentBlockNumber = (await web3.eth.getBlock("latest")).number;

    let lastRewardBlock = (await rewardController.vaultInfo(vault.address)).lastRewardBlock;
    let rewardPerShare = new web3.utils.BN(
      (await rewardController.vaultInfo(vault.address)).rewardPerShare
    );
    let onee12 = new web3.utils.BN("1000000000000");
    let stakeVaule = new web3.utils.BN(web3.utils.toWei("1"));
    let totalAllocPoint = 100;
    let vaultReward = await rewardController.getRewardForBlocksRange(
      lastRewardBlock,
      currentBlockNumber + 1 + safeWithdrawBlocksIncrement,
      100,
      totalAllocPoint
    );
    rewardPerShare = rewardPerShare.add(vaultReward.mul(onee12).div(stakeVaule));
    let expectedReward = stakeVaule.mul(rewardPerShare).div(onee12);
    await safeRedeem(vault, web3.utils.toWei("1"), staker);
    await rewardController.claimReward(vault.address, staker, { from: staker });

    //staker get stake back
    assert.equal(await stakingToken.balanceOf(staker), web3.utils.toWei("1"));
    assert.equal(
      (await hatToken.balanceOf(staker)).toString(),
      expectedReward.toString()
    );
    try {
      await safeRedeem(vault, 0, staker);
      assert(false, "cannot withdraw 0");
    } catch (ex) {
      assertVMException(ex, "WithdrawMustBeGreaterThanZero");
    }
  });

  it("cannot withdraw if there is an active claim", async () => {
    const { committee, someAccount }= await setUpGlobalVars(accounts, 0, 8000, [7000, 2500, 500], 1000, 10, 100, 2500000, 60 * 60 * 24 * 3);
    const staker = accounts[1];
    let claimId;

    await stakingToken.approve(vault.address, web3.utils.toWei("1"), {
      from: staker,
    });

    await stakingToken.mint(staker, web3.utils.toWei("1"));
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });
    
    // withdrawal is possible
    await safeRedeem(vault, web3.utils.toWei(".01"), staker);

    // submit a claim
    await advanceToSafetyPeriod();
    tx = await claimsManager.submitClaim(someAccount, 8000, "", { from: committee });
    claimId = tx.logs[0].args._claimId;

    await claimsManager.challengeClaim(claimId);

    // cannot withdraw while active claim exists
    await assertFunctionRaisesException(
      safeRedeem(vault, web3.utils.toWei(".01"), staker),
      "RedeemMoreThanMax"
    );

    await claimsManager.dismissClaim(claimId);

    await advanceToNonSafetyPeriod();
    // withdrawal is possible again now claim is dismissed
    // await safeRedeem(vault, web3.utils.toWei(".01"), staker);

  });
  it("withdraw cannot be 0", async () => {
    await setUpGlobalVars(accounts);
    var staker = accounts[1];

    await stakingToken.approve(vault.address, web3.utils.toWei("1"), {
      from: staker,
    });

    await stakingToken.mint(staker, web3.utils.toWei("1"));
    assert.equal(await stakingToken.balanceOf(staker), web3.utils.toWei("1"));
    assert.equal(
      await hatToken.balanceOf(rewardController.address),
      web3.utils.toWei(rewardControllerExpectedHatsBalance.toString())
    );

    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });

    await advanceToSafetyPeriod();
    let tx = await claimsManager.submitClaim(accounts[2], 8000, "description hash", {
      from: accounts[1],
    });
    
    await utils.increaseTime(60 * 60 * 24);

    let claimId = tx.logs[0].args._claimId;
    await claimsManager.approveClaim(claimId, 8000, ZERO_ADDRESS);

    try {
      await safeRedeem(vault, 1, staker);
      assert(false, "cannot redeem amount too low for 1 asset");
    } catch (ex) {
      assertVMException(ex, "WithdrawMustBeGreaterThanZero");
    }      
  });

  it("setWithdrawSafetyPeriod", async () => {
    await setUpGlobalVars(accounts, 0, 8000, [7000, 2500, 500], 1000, 10, 100, 2500000, 60 * 60 * 24 * 3);
    try {
      await hatVaultsRegistry.setWithdrawSafetyPeriod(60 * 60, 60 * 30, {
        from: accounts[1],
      });
      assert(false, "only gov");
    } catch (ex) {
      assertVMException(ex, "Ownable: caller is not the owner");
    }

    try {
      await hatVaultsRegistry.setWithdrawSafetyPeriod(60 * 60 - 1, 60 * 30);
      assert(false, "withdraw period must be >= 1 hour");
    } catch (ex) {
      assertVMException(ex, "WithdrawPeriodTooShort");
    }

    try {
      await hatVaultsRegistry.setWithdrawSafetyPeriod(60 * 60, 60 * 60 * 6 + 1);
      assert(false, "safety period must be <= 6 hours");
    } catch (ex) {
      assertVMException(ex, "SafetyPeriodTooLong");
    }

    var tx = await hatVaultsRegistry.setWithdrawSafetyPeriod(60 * 60, 60 * 30);

    assert.equal((await hatVaultsRegistry.generalParameters()).withdrawPeriod, 60 * 60);
    assert.equal((await hatVaultsRegistry.generalParameters()).safetyPeriod, 60 * 30);
    assert.equal(tx.logs[0].event, "SetWithdrawSafetyPeriod");
    assert.equal(tx.logs[0].args._withdrawPeriod, 60 * 60);
    assert.equal(tx.logs[0].args._safetyPeriod, 60 * 30);

    var staker = accounts[1];

    await stakingToken.approve(vault.address, web3.utils.toWei("1"), {
      from: staker,
    });

    await stakingToken.mint(staker, web3.utils.toWei("1"));
    assert.equal(await stakingToken.balanceOf(staker), web3.utils.toWei("1"));
    assert.equal(
      await hatToken.balanceOf(rewardController.address),
      web3.utils.toWei(rewardControllerExpectedHatsBalance.toString())
    );
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });
    await utils.increaseTime(7 * 24 * 3600);

    let withdrawPeriod = 60 * 60;
    let safetyPeriod = 60 * 30;

    let currentTimeStamp = (await web3.eth.getBlock("latest")).timestamp;

    if (currentTimeStamp % (withdrawPeriod + safetyPeriod) < withdrawPeriod) {
      await utils.increaseTime(
        withdrawPeriod - (currentTimeStamp % (withdrawPeriod + safetyPeriod))
      );
    }

    tx = await claimsManager.submitClaim(accounts[2], 8000, "description hash", {
      from: accounts[1],
    });

    let claimId = tx.logs[0].args._claimId;

    await claimsManager.challengeClaim(claimId);

    try {
      await safeRedeem(vault, web3.utils.toWei("1"), staker);
      assert(false, "cannot withdraw while pending approval exists");
    } catch (ex) {
      assertVMException(ex, "RedeemMoreThanMax");
    }

    tx = await claimsManager.dismissClaim(claimId);
    assert.equal(tx.logs[0].event, "DismissClaim");

    let currentBlockNumber = (await web3.eth.getBlock("latest")).number;

    let lastRewardBlock = (await rewardController.vaultInfo(vault.address)).lastRewardBlock;
    let rewardPerShare = new web3.utils.BN(
      (await rewardController.vaultInfo(vault.address)).rewardPerShare
    );
    let onee12 = new web3.utils.BN("1000000000000");
    let stakeVaule = new web3.utils.BN(web3.utils.toWei("1"));
    let totalAllocPoint = 100;
    let vaultReward = await rewardController.getRewardForBlocksRange(
      lastRewardBlock,
      currentBlockNumber + 1 + safeWithdrawBlocksIncrement,
      100,
      totalAllocPoint
    );
    rewardPerShare = rewardPerShare.add(vaultReward.mul(onee12).div(stakeVaule));
    let expectedReward = stakeVaule.mul(rewardPerShare).div(onee12);
    await safeRedeem(vault, web3.utils.toWei("1"), staker);
    await rewardController.claimReward(vault.address, staker, { from: staker});
    //staker  get stake back
    assert.equal(await stakingToken.balanceOf(staker), web3.utils.toWei("1"));
    assert.equal(
      (await hatToken.balanceOf(staker)).toString(),
      expectedReward.toString()
    );
    try {
      await safeRedeem(vault, 0, staker);
      assert(false, "cannot withdraw 0");
    } catch (ex) {
      assertVMException(ex, "WithdrawMustBeGreaterThanZero");
    }
  });

  it("set withdrawn request params", async () => {
    await setUpGlobalVars(accounts);
    assert.equal(
      (await hatVaultsRegistry.generalParameters()).withdrawRequestEnablePeriod,
      7 * 24 * 3600
    );
    assert.equal(
      (await hatVaultsRegistry.generalParameters()).withdrawRequestPendingPeriod,
      7 * 24 * 3600
    );
    try {
      await hatVaultsRegistry.setWithdrawRequestParams(
        90 * 24 * 3600 + 1,
        7 * 24 * 3600
      );
      assert(false, "pending period must be <= 90 days");
    } catch (ex) {
      assertVMException(ex, "WithdrawRequestPendingPeriodTooLong");
    }

    try {
      await hatVaultsRegistry.setWithdrawRequestParams(1, 6 * 60 * 60 - 1);
      assert(false, "enable period must be >= 6 hour");
    } catch (ex) {
      assertVMException(ex, "WithdrawRequestEnabledPeriodTooShort");
    }

    try {
      await hatVaultsRegistry.setWithdrawRequestParams(1, 24 * 60 * 60 * 100 + 1);
      assert(false, "enable period must be <= 100 days");
    } catch (ex) {
      assertVMException(ex, "WithdrawRequestEnabledPeriodTooLong");
    }

    try {
      await hatVaultsRegistry.setWithdrawRequestParams(1, 60 * 24 * 3600, {
        from: accounts[4],
      });
      assert(false, "only gov");
    } catch (ex) {
      assertVMException(ex, "Ownable: caller is not the owner");
    }
    var tx = await hatVaultsRegistry.setWithdrawRequestParams(1, 60 * 24 * 3600, {
      from: accounts[0],
    });
    assert.equal(
      (await hatVaultsRegistry.generalParameters()).withdrawRequestPendingPeriod,
      1
    );
    assert.equal(tx.logs[0].event, "SetWithdrawRequestParams");
    assert.equal(tx.logs[0].args._withdrawRequestPendingPeriod, 1);
    assert.equal(tx.logs[0].args._withdrawRequestEnablePeriod, 60 * 24 * 3600);
    assert.equal(
      (await hatVaultsRegistry.generalParameters()).withdrawRequestEnablePeriod,
      60 * 24 * 3600
    );
  });

  it("deposit should cancel withdraw request ", async () => {
    await setUpGlobalVars(accounts);
    var staker = accounts[1];

    await stakingToken.approve(vault.address, web3.utils.toWei("2"), {
      from: staker,
    });

    await stakingToken.mint(staker, web3.utils.toWei("2"));
    assert.equal(await stakingToken.balanceOf(staker), web3.utils.toWei("2"));
    assert.equal(
      await hatToken.balanceOf(rewardController.address),
      web3.utils.toWei(rewardControllerExpectedHatsBalance.toString())
    );
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });
    await utils.increaseTime(7 * 24 * 3600);
    await advanceToNonSafetyPeriod();

    // no withdraw request exists
    assert.equal(await vault.withdrawEnableStartTime(staker), web3.utils.toWei("0"));
    await vault.withdrawRequest({ from: staker });
    // there is a withdraw request:
    assert.notEqual(await vault.withdrawEnableStartTime(staker), web3.utils.toWei("0"));

    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });
    // dpeosit cancels the withdraw request:
    assert.equal(await vault.withdrawEnableStartTime(staker), web3.utils.toWei("0"));
    
    // check that we indeed cannot redeem
    await utils.increaseTime(7 * 24 * 3600);
    try {
      await vault.methods["redeem(uint256,address,address)"](web3.utils.toWei("0.5"), staker, staker, { from: staker });
      assert(false, "deposit should cancel withdrawRequest");
    } catch (ex) {
      assertVMException(ex, "RedeemMoreThanMax");
    }
  });

  it("withdraw request ", async () => {
    await setUpGlobalVars(accounts);
    var staker = accounts[1];

    await stakingToken.approve(vault.address, web3.utils.toWei("2"), {
      from: staker,
    });

    await stakingToken.mint(staker, web3.utils.toWei("2"));
    assert.equal(await stakingToken.balanceOf(staker), web3.utils.toWei("2"));
    assert.equal(
      await hatToken.balanceOf(rewardController.address),
      web3.utils.toWei(rewardControllerExpectedHatsBalance.toString())
    );
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });
    await utils.increaseTime(7 * 24 * 3600);
    await advanceToNonSafetyPeriod();
    try {
      await vault.methods["redeem(uint256,address,address)"](web3.utils.toWei("1"), staker, staker, { from: staker });
      assert(false, "cannot withdraw without request");
    } catch (ex) {
      assertVMException(ex, "RedeemMoreThanMax");
    }

    await vault.withdrawRequest({ from: staker });
    assert.equal(
      await vault.withdrawEnableStartTime(staker),
      (await web3.eth.getBlock("latest")).timestamp + 7 * 24 * 3600
    );

    try {
      await vault.methods["redeem(uint256,address,address)"](web3.utils.toWei("1"), staker, staker, { from: staker });
      assert(false, "request is pending");
    } catch (ex) {
      assertVMException(ex, "RedeemMoreThanMax");
    }

    await utils.increaseTime(7 * 24 * 3600);

    await vault.methods["redeem(uint256,address,address)"](web3.utils.toWei("0.5"), staker, staker, { from: staker });
    assert.equal(await vault.withdrawEnableStartTime(staker), 0);
    try {
      await vault.methods["redeem(uint256,address,address)"](web3.utils.toWei("0.5"), staker, staker, { from: staker });
      assert(false, "no pending request");
    } catch (ex) {
      assertVMException(ex, "RedeemMoreThanMax");
    }
    await vault.withdrawRequest({ from: staker });
    await utils.increaseTime(7 * 24 * 3600);
    await vault.methods["redeem(uint256,address,address)"](await vault.balanceOf(staker), staker, staker, { from: staker });
    assert.equal(await vault.withdrawEnableStartTime(staker), 0);
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });
    await vault.withdrawRequest({ from: staker });

    await utils.increaseTime(14 * 24 * 3600);

    //request is now expired so can request again.
    await vault.withdrawRequest({ from: staker });
  });

  it("Set feeSetter", async () => {
    let tx;
    const {vault, registry}= await setUpGlobalVars(accounts);
    
    assert.equal(await registry.feeSetter(), ZERO_ADDRESS);
    
    await assertFunctionRaisesException(
      registry.setFeeSetter(accounts[1],  { from: accounts[1]}),
        "Ownable: caller is not the owner"
    );

    await registry.setFeeSetter(accounts[0]);
    
    // the default account can set the withdrawal fee no problem
    await vault.setWithdrawalFee(100);

    tx = await registry.setFeeSetter(accounts[1]);

    assert.equal(await registry.feeSetter(), accounts[1]);
    assert.equal(tx.logs[0].event, "SetFeeSetter");
    assert.equal(tx.logs[0].args._feeSetter, accounts[1]);

    await assertFunctionRaisesException(
      vault.setWithdrawalFee(100),
      "OnlyFeeSetter"
  );

    await assertFunctionRaisesException(
      vault.setWithdrawalFee(201, { from: accounts[1]}),
      "WithdrawalFeeTooBig"
    );

    tx = await vault.setWithdrawalFee(200, {
      from: accounts[1],
    });

    assert.equal(tx.logs[0].event, "SetWithdrawalFee");
    assert.equal(tx.logs[0].args._newFee, 200);
    assert.equal(await vault.withdrawalFee(), 200);
  });

  it("Withdrawal fee is paid correctly", async () => {
    const { registry, owner }= await setUpGlobalVars(accounts);
    await registry.setFeeSetter(owner);
    await vault.setWithdrawalFee(200, { from: owner });

    var staker = accounts[2];
    var staker2 = accounts[3];
    await stakingToken.approve(vault.address, web3.utils.toWei("2"), {
      from: staker,
    });
    await stakingToken.approve(vault.address, web3.utils.toWei("2"), {
      from: staker2,
    });
    await stakingToken.mint(staker, web3.utils.toWei("1"));
    await stakingToken.mint(staker2, web3.utils.toWei("1"));
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });
    await utils.increaseTime(7 * 24 * 3600);

    let vaultBalance = await stakingToken.balanceOf(vault.address);
    let governanceBalance = await stakingToken.balanceOf(owner);

    await safeRedeem(vault, web3.utils.toWei("1"), staker);
    // Staker got back the reward minus the 2% fee
    assert.equal(
      await stakingToken.balanceOf(staker),
      web3.utils.toWei("0.98")
    );
    // Governance received the fee of 2%
    assert.equal(
      (await stakingToken.balanceOf(owner)).toString(),
      governanceBalance
        .add(new web3.utils.BN(web3.utils.toWei("0.02"))).toString()
    );
    // and the vault paid out 1 token
    assert.equal(
      (vaultBalance - (await stakingToken.balanceOf(vault.address))).toString(), 
      web3.utils.toWei("1").toString() 
    );
    
    // at this point, the staker has withdrawn all and has a zero balance
    assert.equal(
      (await vault.balanceOf(staker)),
      web3.utils.toWei("0")
    );
    
    assert.equal(
      (await vault.maxWithdraw(staker)),
      web3.utils.toWei("0")
    );
 
    await stakingToken.mint(staker, web3.utils.toWei("0.02"));
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });

    // at this point, staker has deposited a total balance of 1e18 shares
    assert.equal(
      (await vault.balanceOf(staker)),
      web3.utils.toWei("1")
    );

   
    await assertFunctionRaisesException(
      safeWithdraw(vault, web3.utils.toWei("0.99"), staker),
      "RedeemMoreThanMax"
    );
    // however the stakes can maxWithdraw only 0.98 (1 minus fees)
    assert.equal(
      (await vault.maxWithdraw(staker)),
      web3.utils.toWei("0.98")
    );

    // previewwithdraw says that to withdraw 0.98 tokens we will burn 1 share
    assert.equal(
      (await vault.previewWithdraw(web3.utils.toWei("0.98"))),
      web3.utils.toWei("1")
    );

    // and vice versa, if we redeem one share, we will get 0.98 tokens
    assert.equal(
      (await vault.previewRedeem(web3.utils.toWei("1"))),
      web3.utils.toWei("0.98")
    );
 
    // withdraw 0.98 tokens (and burn one share)
    await safeWithdraw(vault, web3.utils.toWei("0.98"), staker);

    assert.equal(
      await stakingToken.balanceOf(staker),
      web3.utils.toWei("0.98")
    );
    // Governance received the fee
    assert.equal(
      (await stakingToken.balanceOf(accounts[0])).toString(),
      governanceBalance
        .add(new web3.utils.BN(web3.utils.toWei("0.04")))
        .toString()
    );
    // and all shares of the staker are burnt
    assert.equal(
      (await vault.balanceOf(staker)),
      web3.utils.toWei("0")
    );

  });

  it("previewWithdrawAndFee is calculated correctly", async () => {
    const { registry, owner }= await setUpGlobalVars(accounts);
    await registry.setFeeSetter(owner);
    await vault.setWithdrawalFee(200, { from: owner });

    var staker = accounts[2];
    await stakingToken.approve(vault.address, web3.utils.toWei("2"), {
      from: staker,
    });
    await stakingToken.mint(staker, web3.utils.toWei("1"));
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });
    await utils.increaseTime(7 * 24 * 3600);
    let result = (await vault.previewRedeemAndFee(web3.utils.toWei("1")));
    assert.equal(result.assets, web3.utils.toWei("0.98")); 
    assert.equal(result.fee, web3.utils.toWei("0.02")); 

    result = (await vault.previewWithdrawAndFee(web3.utils.toWei(".98")));
    assert.equal(result.shares, web3.utils.toWei("1")); 
    assert.equal(result.fee, web3.utils.toWei("0.02")); 

    result = (await vault.previewWithdrawAndFee(web3.utils.toWei("1")));
    assert.equal(result.shares.toString(), web3.utils.toWei("1.020408163265306122").toString()); 
    assert.equal(result.fee.toString(), web3.utils.toWei("0.020408163265306122").toString()); 

    result = (await vault.previewRedeemAndFee(web3.utils.toWei("0.5")));
    assert.equal(result.assets, web3.utils.toWei("0.49")); 
    assert.equal(result.fee, web3.utils.toWei("0.01")); 

    result = (await vault.previewWithdrawAndFee(web3.utils.toWei(".49")));
    assert.equal(result.shares, web3.utils.toWei("0.5")); 
    assert.equal(result.fee, web3.utils.toWei("0.01")); 

    // rounding with 1 wei - pay no fee
    result = (await vault.previewRedeemAndFee(new web3.utils.BN("1")));
    assert.equal(result.assets.toString(), (new web3.utils.BN("1")).toString()); 
    assert.equal(result.fee, web3.utils.toWei("0")); 

    // we submit and approve a claim for 90% of the vault value
    await advanceToSafetyPeriod();
    let tx = await claimsManager.submitClaim(
      accounts[2],
      8000,
      "description hash",
      {
        from: accounts[1],
      }
    );

    let claimId = tx.logs[0].args._claimId;
    await utils.increaseTime(60 * 60 * 24);
    await claimsManager.approveClaim(claimId, 8000, ZERO_ADDRESS);
    await advanceToSafetyPeriod();
    result = (await vault.previewRedeemAndFee(web3.utils.toWei("1")));
    assert.equal(result.assets.toString(), web3.utils.toWei("0.196")); 
    assert.equal(result.fee, web3.utils.toWei("0.004")); 

  });
  
  it("Withdrawal fee is paid on redeem", async () => {
    const { registry, owner }= await setUpGlobalVars(accounts);
    await registry.setFeeSetter(owner);
    await vault.setWithdrawalFee(200, { from: owner });

    var staker = accounts[2];
    var staker2 = accounts[3];
    await stakingToken.approve(vault.address, web3.utils.toWei("2"), {
      from: staker,
    });
    await stakingToken.approve(vault.address, web3.utils.toWei("2"), {
      from: staker2,
    });
    await stakingToken.mint(staker, web3.utils.toWei("1"));
    await stakingToken.mint(staker2, web3.utils.toWei("1"));
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });
    await utils.increaseTime(7 * 24 * 3600);

    let vaultBalance = await stakingToken.balanceOf(vault.address);
    let governanceBalance = await stakingToken.balanceOf(owner);
    await assertFunctionRaisesException(
      safeRedeem(vault, web3.utils.toWei("1.0000001"), staker),
      "RedeemMoreThanMax"
    );

    await safeRedeem(vault, web3.utils.toWei("1"), staker);
    // Staker got back the reward minus the 2% fee
    assert.equal(
      await stakingToken.balanceOf(staker),
      web3.utils.toWei("0.98")
    );
    // Governance received the fee of 2%
    assert.equal(
      (await stakingToken.balanceOf(owner)).toString(),
      governanceBalance
        .add(new web3.utils.BN(web3.utils.toWei("0.02"))).toString()
    );
    // and the vault paid out 1 token
    assert.equal(
      (vaultBalance - (await stakingToken.balanceOf(vault.address))).toString(), 
      web3.utils.toWei("1").toString() 
    );
    
    // at this point, the staker has withdrawn all and has a zero balance
    assert.equal(await vault.balanceOf(staker), web3.utils.toWei("0"));
    assert.equal(await vault.maxRedeem(staker), web3.utils.toWei("0"));
 
    await stakingToken.mint(staker, web3.utils.toWei("0.02"));
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });

    // at this point, staker has deposited a total balance of 1e18 shares
    assert.equal(await vault.balanceOf(staker), web3.utils.toWei("1"));

    // withdraw request not submitted yet
    assert.equal(await vault.maxRedeem(staker), "0");
    assert.equal((await vault.maxWithdraw(staker)), "0");

    // however the stakes can maxRedeem 1 share, but maxWithdraw only 0.98 tokens (1 minus fees)
    await vault.withdrawRequest({ from: staker });
    // increase time for pending period
    await utils.increaseTime(7 * 24 * 3600);
    await advanceToNonSafetyPeriod();
    assert.equal((await vault.maxRedeem(staker)), web3.utils.toWei("1"));
    assert.equal(
      (await vault.maxWithdraw(staker)),
      web3.utils.toWei("0.98")
    );
 
  });

  it("Withdrawal fee is paid on withdrawal", async () => {
    const { registry, owner }= await setUpGlobalVars(accounts);
    await registry.setFeeSetter(owner);
    await vault.setWithdrawalFee(200, { from: owner });

    var staker = accounts[2];
    await stakingToken.approve(vault.address, web3.utils.toWei("2"), {
      from: staker,
    });
    await stakingToken.mint(staker, web3.utils.toWei("1"));
    
    // deposit on token 
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });
    
    let vaultBalance = await stakingToken.balanceOf(vault.address);
    assert.equal(vaultBalance, web3.utils.toWei("1"));
    let governanceBalance = await stakingToken.balanceOf(owner);
    assert.equal(governanceBalance, web3.utils.toWei("0"));

    // now we can redeem 1 share, but withdraw a maximum of .98
    await advanceToNonSafetyPeriod();
    await assertFunctionRaisesException(
      safeWithdraw(vault, web3.utils.toWei("0.99"), staker),
      "RedeemMoreThanMax"
    );

    await safeWithdraw(vault, web3.utils.toWei("0.49"), staker);

    // Staker gets the tokens she withdrawn
    assert.equal(await stakingToken.balanceOf(staker), web3.utils.toWei("0.49"));
    // Governance received the fee of 2%
    assert.equal(await stakingToken.balanceOf(owner), web3.utils.toWei("0.01"));

    // and the vault paid out .5 token
    assert.equal(await stakingToken.balanceOf(vault.address), web3.utils.toWei(".5"));
    
    // at this point, the staker has withdrawn .5
    assert.equal(await vault.balanceOf(staker), web3.utils.toWei("0.5"));
  });

  it("No withdrawal fee is paid on transfer", async () => {
    const { registry, owner, someAccount }= await setUpGlobalVars(accounts);
    await registry.setFeeSetter(owner);
    await vault.setWithdrawalFee(200, { from: owner });

    var staker = accounts[2];
    await stakingToken.approve(vault.address, web3.utils.toWei("2"), {
      from: staker,
    });
    await stakingToken.mint(staker, web3.utils.toWei("1"));
    
    // deposit on token 
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });
    
    let vaultBalance = await stakingToken.balanceOf(vault.address);
    assert.equal(vaultBalance, web3.utils.toWei("1"));
    let governanceBalance = await stakingToken.balanceOf(owner);
    assert.equal(governanceBalance, web3.utils.toWei("0"));

    // now we can redeem 1 share, but withdraw a maximum of .98
    await advanceToNonSafetyPeriod();
    
    // however the stakes can maxRedeem 1 share, but maxWithdraw only 0.98 tokens (1 minus fees)
    await vault.withdrawRequest({ from: staker });
    // increase time for pending period
    await utils.increaseTime(7 * 24 * 3600);
    await advanceToNonSafetyPeriod();

    await assertFunctionRaisesException(
      vault.transfer(someAccount, web3.utils.toWei("1.01"), {from: staker}),
      "RedeemMoreThanMax"
    );
    await vault.transfer(someAccount, web3.utils.toWei(".7"), {from: staker}),

    // Staker gets the tokens she withdrawn
    assert.equal(await vault.balanceOf(staker), web3.utils.toWei("0.3"));
    // no fee is paid on the transfer - someAccount gets the entire amount
    assert.equal(await vault.balanceOf(someAccount), web3.utils.toWei("0.7"));
    // Governance received no fees
    assert.equal(await stakingToken.balanceOf(owner), web3.utils.toWei("0"));

  });

  it("stake", async () => {
    await setUpGlobalVars(accounts);
    var staker = accounts[1];
    try {
      await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });
      assert(false, "cannot stake without approve");
    } catch (ex) {
      assertVMException(ex);
    }
    await stakingToken.approve(vault.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await stakingToken.mint(staker, web3.utils.toWei("1"));
    assert.equal(await stakingToken.balanceOf(staker), web3.utils.toWei("1"));
    assert.equal(
      await hatToken.balanceOf(rewardController.address),
      web3.utils.toWei(rewardControllerExpectedHatsBalance.toString())
    );
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });
    assert.equal(
      await hatToken.balanceOf(rewardController.address),
      web3.utils.toWei(rewardControllerExpectedHatsBalance.toString())
    );
    await utils.increaseTime(7 * 24 * 3600);
    assert.equal(await stakingToken.balanceOf(staker), 0);
    assert.equal(
      await stakingToken.balanceOf(vault.address),
      web3.utils.toWei("1")
    );
    //withdraw
    assert.equal(await hatToken.balanceOf(staker), 0);

    let currentBlockNumber = (await web3.eth.getBlock("latest")).number;

    let lastRewardBlock = (await rewardController.vaultInfo(vault.address)).lastRewardBlock;
    let rewardPerShare = new web3.utils.BN(
      (await rewardController.vaultInfo(vault.address)).rewardPerShare
    );
    let onee12 = new web3.utils.BN("1000000000000");
    let stakeVaule = new web3.utils.BN(web3.utils.toWei("1"));
    let totalAllocPoint = 100;
    let vaultReward = await rewardController.getRewardForBlocksRange(
      lastRewardBlock,
      currentBlockNumber + 1 + safeWithdrawBlocksIncrement,
      100,
      totalAllocPoint
    );
    rewardPerShare = rewardPerShare.add(vaultReward.mul(onee12).div(stakeVaule));
    let expectedReward = stakeVaule.mul(rewardPerShare).div(onee12);

    await safeRedeem(vault, web3.utils.toWei("1"), staker);
    //staker get stake back
    assert.equal(await stakingToken.balanceOf(staker), web3.utils.toWei("1"));
    assert.equal(
      (await rewardController.unclaimedReward(vault.address, staker)).toString(),
      expectedReward.toString()
    );
    try {
      await safeRedeem(vault, 0, staker);
      assert(false, "cannot withdraw 0");
    } catch (ex) {
      assertVMException(ex, "WithdrawMustBeGreaterThanZero");
    }
  });

  it("claim reward", async () => {
    await setUpGlobalVars(
      accounts,
      (await web3.eth.getBlock("latest")).number,
      8000,
      [7000, 2500, 500],
      1000,
      10000
    );
    var staker = accounts[1];
    await stakingToken.approve(vault.address, web3.utils.toWei("4"), {
      from: staker,
    });
    await stakingToken.mint(staker, web3.utils.toWei("1"));
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });
    assert.equal(
      await hatToken.balanceOf(rewardController.address),
      web3.utils.toWei(rewardControllerExpectedHatsBalance.toString())
    );

    assert.equal(await hatToken.balanceOf(staker), 0);

    let expectedReward = await calculateExpectedReward(staker);

    var tx = await rewardController.claimReward(vault.address, staker, { from: staker });
    assert.equal(tx.logs[2].event, "ClaimReward");
    assert.equal(tx.logs[2].args._vault, vault.address);

    assert.equal(
      (await hatToken.balanceOf(rewardController.address)).toString(),
      new web3.utils.BN(web3.utils.toWei(rewardControllerExpectedHatsBalance.toString())).sub(expectedReward).toString()
    );
    assert.equal(
      (await hatToken.balanceOf(staker)).toString(),
      expectedReward.toString()
    );
    assert.equal(await stakingToken.balanceOf(staker), 0);
    assert.equal(
      await stakingToken.balanceOf(vault.address),
      web3.utils.toWei("1")
    );
  });

  it("claim reward before deposit", async () => {
    await setUpGlobalVars(
      accounts,
      (await web3.eth.getBlock("latest")).number,
      8000,
      [7000, 2500, 500],
      1000,
      10000
    );
    var staker = accounts[1];
    await stakingToken.approve(vault.address, web3.utils.toWei("4"), {
      from: staker,
    });
    await stakingToken.mint(staker, web3.utils.toWei("1"));

    let expectedReward = 0;

    let tx = await rewardController.claimReward(vault.address, staker, { from: staker });
    assert.equal(tx.logs[2].event, "ClaimReward");
    assert.equal(tx.logs[2].args._vault, vault.address);

    assert.equal(
      (await hatToken.balanceOf(rewardController.address)).toString(),
      web3.utils.toWei(rewardControllerExpectedHatsBalance.toString()).toString()
    );
    assert.equal(
      (await hatToken.balanceOf(staker)).toString(),
      "0"
    );
    assert.equal(await stakingToken.balanceOf(staker), web3.utils.toWei("1"));
    assert.equal(
      await stakingToken.balanceOf(vault.address),
      web3.utils.toWei("0")
    );

    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });
    assert.equal(
      await hatToken.balanceOf(rewardController.address),
      web3.utils.toWei(rewardControllerExpectedHatsBalance.toString())
    );

    assert.equal(await hatToken.balanceOf(staker), 0);

    expectedReward = await calculateExpectedReward(staker);

    tx = await rewardController.claimReward(vault.address, staker, { from: staker });
    assert.equal(tx.logs[2].event, "ClaimReward");
    assert.equal(tx.logs[2].args._vault, vault.address);

    assert.equal(
      (await hatToken.balanceOf(rewardController.address)).toString(),
      new web3.utils.BN(web3.utils.toWei(rewardControllerExpectedHatsBalance.toString())).sub(expectedReward).toString()
    );
    assert.equal(
      (await hatToken.balanceOf(staker)).toString(),
      expectedReward.toString()
    );
    assert.equal(await stakingToken.balanceOf(staker), 0);
    assert.equal(
      await stakingToken.balanceOf(vault.address),
      web3.utils.toWei("1")
    );
  });


  it("cannot claim the same reward twice", async () => {
    await setUpGlobalVars(
      accounts,
      (await web3.eth.getBlock("latest")).number,
      8000,
      [7000, 2500, 500],
      1000,
      10000
    );
    var vaultsManagerMock = await VaultsManagerMock.new();
    await stakingToken.mint(vaultsManagerMock.address, web3.utils.toWei("1"));
    await vaultsManagerMock.deposit(
      vault.address,
      stakingToken.address,
      web3.utils.toWei("1")
    );
    assert.equal(
      await hatToken.balanceOf(rewardController.address),
      web3.utils.toWei(rewardControllerExpectedHatsBalance.toString())
    );

    assert.equal(await hatToken.balanceOf(vaultsManagerMock.address), 0);

    let expectedReward = await calculateExpectedReward(vaultsManagerMock.address);
    await vaultsManagerMock.claimRewardTwice(rewardController.address, vault.address);
    assert.equal(
      (await hatToken.balanceOf(rewardController.address)).toString(),
      new web3.utils.BN(web3.utils.toWei(rewardControllerExpectedHatsBalance.toString())).sub(expectedReward).toString()
    );
    assert.equal(
      (await hatToken.balanceOf(vaultsManagerMock.address)).toString(),
      expectedReward.toString()
    );
    assert.equal(await stakingToken.balanceOf(vaultsManagerMock.address), 0);
    assert.equal(
      await stakingToken.balanceOf(vault.address),
      web3.utils.toWei("1")
    );
  });

  it("multiple stakes from same account", async () => {
    await setUpGlobalVars(
      accounts,
      (await web3.eth.getBlock("latest")).number,
      8000,
      [7000, 2500, 500],
      1000,
      10000
    );
    var staker = accounts[1];
    await stakingToken.approve(vault.address, web3.utils.toWei("4"), {
      from: staker,
    });
    await stakingToken.mint(staker, web3.utils.toWei("1"));
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });

    assert.equal(await hatToken.balanceOf(staker), 0);

    // Deposit redeemed existing reward
    await stakingToken.mint(staker, web3.utils.toWei("1"));
    await vault.deposit(web3.utils.toWei("1"), staker, {
      from: staker,
    });
    let expectedReward = await calculateExpectedReward(staker);
    let tx = await rewardController.claimReward(vault.address, staker, { from: staker });
    assert.equal(tx.logs[2].event, "ClaimReward");
    assert.equal(tx.logs[2].args._amount.toString(), expectedReward.toString());
    assert.equal(tx.logs[2].args._user, staker);
    assert.equal(tx.logs[2].args._vault, vault.address);
    assert.isFalse(tx.logs[2].args._amount.eq(0));
    assert.equal(
      (await hatToken.balanceOf(staker)).toString(),
      expectedReward.toString()
    );

    await stakingToken.mint(staker, web3.utils.toWei("1"));
    var balanceOfStakerBefore = await hatToken.balanceOf(staker);
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });
    expectedReward = await calculateExpectedReward(staker);
    await rewardController.claimReward(vault.address, staker, { from: staker });
    assert.equal(
      (await hatToken.balanceOf(staker)).toString(),
      expectedReward.add(balanceOfStakerBefore).toString()
    );

    // Deposit redeemed existing reward
    await utils.increaseTime(7 * 24 * 3600);
    await stakingToken.mint(staker, web3.utils.toWei("1"));
    balanceOfStakerBefore = await hatToken.balanceOf(staker);
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });
    expectedReward = await calculateExpectedReward(staker, -1);
    assert.equal(
      (await rewardController.unclaimedReward(vault.address, staker)).toString(),
      expectedReward.toString()
    );

    expectedReward = await calculateExpectedReward(staker);
    await rewardController.claimReward(vault.address, staker, { from: staker });
    assert.equal(
      (await hatToken.balanceOf(staker)).toString(),
      expectedReward.add(balanceOfStakerBefore).toString()
    );
    assert.equal(await stakingToken.balanceOf(staker), 0);
    assert.equal(
      await stakingToken.balanceOf(vault.address),
      web3.utils.toWei("4")
    );
    await utils.increaseTime(7 * 24 * 3600);
    //withdraw
    expectedReward = await calculateExpectedReward(
      staker,
      safeWithdrawBlocksIncrement
    );
    balanceOfStakerBefore = await hatToken.balanceOf(staker);
    await safeRedeem(vault, web3.utils.toWei("4"), staker);

    assert.equal(
      (await rewardController.unclaimedReward(vault.address, staker)).toString(),
      expectedReward.toString()
    );
    await rewardController.claimReward(vault.address, staker, { from: staker });
    //staker  get stake back
    assert.equal(
      (await stakingToken.balanceOf(staker)).toString(),
      web3.utils.toWei("4").toString()
    );
    assert.equal(
      (await hatToken.balanceOf(staker)).toString(),
      expectedReward.add(balanceOfStakerBefore).toString()
    );
    assert.equal(
      (await rewardController.unclaimedReward(vault.address, staker)).toString(),
      "0"
    );
  });

  it("claim reward from vault with existing funds claims only from user deposit time", async () => {
    await setUpGlobalVars(
      accounts,
      (await web3.eth.getBlock("latest")).number,
      8000,
      [7000, 2500, 500],
      1000,
      10000
    );
    var staker = accounts[1];
    var staker2 = accounts[2];
    await stakingToken.approve(vault.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await stakingToken.approve(vault.address, web3.utils.toWei("1"), {
      from: staker2,
    });
    await stakingToken.mint(staker, web3.utils.toWei("1"));
    await stakingToken.mint(staker2, web3.utils.toWei("1"));
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });
    
    assert.equal(
      await hatToken.balanceOf(rewardController.address),
      web3.utils.toWei(rewardControllerExpectedHatsBalance.toString())
    );

    assert.equal(await hatToken.balanceOf(staker), 0);

    let expectedReward = await calculateExpectedReward(staker);

    let tx = await rewardController.claimReward(vault.address, staker, { from: staker });
    assert.equal(tx.logs[2].event, "ClaimReward");
    assert.equal(tx.logs[2].args._vault, vault.address);

    assert.equal(
      (await hatToken.balanceOf(rewardController.address)).toString(),
      new web3.utils.BN(web3.utils.toWei(rewardControllerExpectedHatsBalance.toString())).sub(expectedReward).toString()
    );
    assert.equal(
      (await hatToken.balanceOf(staker)).toString(),
      expectedReward.toString()
    );
    assert.equal(await stakingToken.balanceOf(staker), 0);
    assert.equal(
      await stakingToken.balanceOf(vault.address),
      web3.utils.toWei("1")
    );
    rewardControllerExpectedHatsBalance = await hatToken.balanceOf(rewardController.address);

    await vault.deposit(web3.utils.toWei("1"), staker2, { from: staker2 });
    expectedReward = await calculateExpectedReward(staker2);

    tx = await rewardController.claimReward(vault.address, staker2, { from: staker2 });
    assert.equal(tx.logs[2].event, "ClaimReward");
    assert.equal(tx.logs[2].args._vault, vault.address);

    assert.equal(
      (await hatToken.balanceOf(rewardController.address)).toString(),
      rewardControllerExpectedHatsBalance.sub(expectedReward).toString()
    );
    assert.equal(
      (await hatToken.balanceOf(staker2)).toString(),
      expectedReward.toString()
    );
    assert.equal(await stakingToken.balanceOf(staker2), 0);
    assert.equal(
      await stakingToken.balanceOf(vault.address),
      web3.utils.toWei("2")
    );

  });

  it("claim reward after partial withdraw", async () => {
    await setUpGlobalVars(
      accounts,
      (await web3.eth.getBlock("latest")).number,
      8000,
      [7000, 2500, 500],
      1000,
      10000
    );
    var staker = accounts[1];
    await stakingToken.approve(vault.address, web3.utils.toWei("2"), {
      from: staker,
    });

    await stakingToken.mint(staker, web3.utils.toWei("2"));
    await vault.deposit(web3.utils.toWei("2"), staker, { from: staker });
    assert.equal(
      await hatToken.balanceOf(rewardController.address),
      web3.utils.toWei(rewardControllerExpectedHatsBalance.toString())
    );

    assert.equal(await hatToken.balanceOf(staker), 0);

    await advanceToNonSafetyPeriod();
    await vault.withdrawRequest({ from: staker });
    await utils.increaseTime(7 * 24 * 3600);

    let expectedReward = await calculateExpectedReward(staker);

    tx = await vault.methods["redeemAndClaim(uint256,address,address)"](web3.utils.toWei("1"), staker, staker, { from: staker });

    let logs = await rewardController.getPastEvents('ClaimReward', {
        fromBlock: tx.blockNumber,
        toBlock: tx.blockNumber
    });

    assert.equal(logs[0].event, "ClaimReward");
    assert.equal(logs[0].args._vault, vault.address);
    assert.equal(logs[0].args._user.toString(), staker);
    assert.equal(logs[0].args._amount.toString(), expectedReward.toString());
    
    assert.equal(
      (await hatToken.balanceOf(rewardController.address)).toString(),
      new web3.utils.BN(web3.utils.toWei(rewardControllerExpectedHatsBalance.toString())).sub(expectedReward).toString()
    );
    assert.equal(
      (await hatToken.balanceOf(staker)).toString(),
      expectedReward.toString()
    );
    assert.equal(await stakingToken.balanceOf(staker), web3.utils.toWei("1"));
    assert.equal(
      await stakingToken.balanceOf(vault.address),
      web3.utils.toWei("1")
    );
    rewardControllerExpectedHatsBalance = await hatToken.balanceOf(rewardController.address);
    let originalReward = expectedReward;
    expectedReward = await calculateExpectedReward(staker);

    tx = await rewardController.claimReward(vault.address, staker, { from: staker });
    assert.equal(tx.logs[2].event, "ClaimReward");
    assert.equal(tx.logs[2].args._vault, vault.address);

    assert.equal(
      (await hatToken.balanceOf(rewardController.address)).toString(),
      rewardControllerExpectedHatsBalance.sub(expectedReward).toString()
    );
    assert.equal(
      (await hatToken.balanceOf(staker)).toString(),
      originalReward.add(expectedReward).toString()
    );
    assert.equal(await stakingToken.balanceOf(staker), web3.utils.toWei("1"));
    assert.equal(
      await stakingToken.balanceOf(vault.address),
      web3.utils.toWei("1")
    );

    await advanceToNonSafetyPeriod();
    await vault.withdrawRequest({ from: staker });
    await utils.increaseTime(7 * 24 * 3600);

    expectedReward = await calculateExpectedReward(staker);

    tx = await vault.methods["withdrawAndClaim(uint256,address,address)"](web3.utils.toWei("1"), staker, staker, { from: staker });

    logs = await rewardController.getPastEvents('ClaimReward', {
        fromBlock: tx.blockNumber,
        toBlock: tx.blockNumber
    });

    assert.equal(logs[0].event, "ClaimReward");
    assert.equal(logs[0].args._vault, vault.address);
    assert.equal(logs[0].args._user.toString(), staker);
    assert.equal(logs[0].args._amount.toString(), expectedReward.toString());
  });

  it("claim reward after partial withdraw (slippage protection)", async () => {
    await setUpGlobalVars(
      accounts,
      (await web3.eth.getBlock("latest")).number,
      8000,
      [7000, 2500, 500],
      1000,
      10000
    );
    var staker = accounts[1];
    await stakingToken.approve(vault.address, web3.utils.toWei("2"), {
      from: staker,
    });

    await stakingToken.mint(staker, web3.utils.toWei("2"));
    await vault.deposit(web3.utils.toWei("2"), staker, { from: staker });
    assert.equal(
      await hatToken.balanceOf(rewardController.address),
      web3.utils.toWei(rewardControllerExpectedHatsBalance.toString())
    );

    assert.equal(await hatToken.balanceOf(staker), 0);

    await advanceToNonSafetyPeriod();
    await vault.withdrawRequest({ from: staker });
    await utils.increaseTime(7 * 24 * 3600);

    try {
      await vault.methods["redeemAndClaim(uint256,address,address,uint256)"](web3.utils.toWei("1"), staker, staker, web3.utils.toWei("1.01"), { from: staker });
      assert(false, "bad slippage protection");
    } catch (ex) {
      assertVMException(ex, "RedeemSlippageProtection");
    }

    let expectedReward = await calculateExpectedReward(staker);

    tx = await vault.methods["redeemAndClaim(uint256,address,address,uint256)"](web3.utils.toWei("1"), staker, staker, web3.utils.toWei("1"), { from: staker });

    let logs = await rewardController.getPastEvents('ClaimReward', {
        fromBlock: tx.blockNumber,
        toBlock: tx.blockNumber
    });

    assert.equal(logs[0].event, "ClaimReward");
    assert.equal(logs[0].args._vault, vault.address);
    assert.equal(logs[0].args._user.toString(), staker);
    assert.equal(logs[0].args._amount.toString(), expectedReward.toString());
    
    assert.equal(
      (await hatToken.balanceOf(rewardController.address)).toString(),
      new web3.utils.BN(web3.utils.toWei(rewardControllerExpectedHatsBalance.toString())).sub(expectedReward).toString()
    );
    assert.equal(
      (await hatToken.balanceOf(staker)).toString(),
      expectedReward.toString()
    );
    assert.equal(await stakingToken.balanceOf(staker), web3.utils.toWei("1"));
    assert.equal(
      await stakingToken.balanceOf(vault.address),
      web3.utils.toWei("1")
    );
    rewardControllerExpectedHatsBalance = await hatToken.balanceOf(rewardController.address);
    let originalReward = expectedReward;
    expectedReward = await calculateExpectedReward(staker);

    tx = await rewardController.claimReward(vault.address, staker, { from: staker });
    assert.equal(tx.logs[2].event, "ClaimReward");
    assert.equal(tx.logs[2].args._vault, vault.address);

    assert.equal(
      (await hatToken.balanceOf(rewardController.address)).toString(),
      rewardControllerExpectedHatsBalance.sub(expectedReward).toString()
    );
    assert.equal(
      (await hatToken.balanceOf(staker)).toString(),
      originalReward.add(expectedReward).toString()
    );
    assert.equal(await stakingToken.balanceOf(staker), web3.utils.toWei("1"));
    assert.equal(
      await stakingToken.balanceOf(vault.address),
      web3.utils.toWei("1")
    );

    await advanceToNonSafetyPeriod();
    await vault.withdrawRequest({ from: staker });
    await utils.increaseTime(7 * 24 * 3600);

    try {
      await vault.methods["withdrawAndClaim(uint256,address,address,uint256)"](web3.utils.toWei("1"), staker, staker, web3.utils.toWei("0.99"), { from: staker });
      assert(false, "bad slippage protection");
    } catch (ex) {
      assertVMException(ex, "WithdrawSlippageProtection");
    }

    expectedReward = await calculateExpectedReward(staker);

    tx = await vault.methods["withdrawAndClaim(uint256,address,address,uint256)"](web3.utils.toWei("1"), staker, staker, web3.utils.toWei("1"), { from: staker });

    logs = await rewardController.getPastEvents('ClaimReward', {
        fromBlock: tx.blockNumber,
        toBlock: tx.blockNumber
    });

    assert.equal(logs[0].event, "ClaimReward");
    assert.equal(logs[0].args._vault, vault.address);
    assert.equal(logs[0].args._user.toString(), staker);
    assert.equal(logs[0].args._amount.toString(), expectedReward.toString());
  });

  it("hat reward withdraw all balance if reward larger than balance", async () => {
    await setUpGlobalVars(
      accounts,
      (await web3.eth.getBlock("latest")).number,
      8000,
      [7000, 2500, 500],
      1000,
      10000,
      100,
      0
    );
    var staker = accounts[1];
    await stakingToken.approve(vault.address, web3.utils.toWei("4"), {
      from: staker,
    });
    await stakingToken.mint(staker, web3.utils.toWei("1"));
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });

    assert.equal(await hatToken.balanceOf(staker), 0);

    let hatTotalSupply = await hatToken.totalSupply();
    let hatTokenCap = await hatToken.cap();
    let amountToMint = hatTokenCap.sub(hatTotalSupply);
    await hatToken.setMinter(accounts[0], amountToMint);
    await hatToken.mint(accounts[0], amountToMint);
    await hatToken.transfer(rewardController.address, amountToMint);

    // Deposit redeemed existing reward
    await stakingToken.mint(staker, web3.utils.toWei("1"));
    let expectedReward = await rewardController.getPendingReward(vault.address, staker);
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });
    tx = await rewardController.claimReward(vault.address, staker, { from: staker });
    assert.equal(tx.logs[2].event, "ClaimReward");
    assert.isTrue(
      parseInt(tx.logs[2].args._amount.toString()) >=
        parseInt(expectedReward.toString())
    );
    assert.equal(tx.logs[2].args._user, staker);
    assert.equal(tx.logs[2].args._vault, vault.address);
    assert.isFalse(tx.logs[2].args._amount.eq(0));
    assert.equal(
      (await hatToken.balanceOf(staker)).toString(),
      tx.logs[2].args._amount.toString()
    );

    await stakingToken.mint(staker, web3.utils.toWei("1"));
    var balanceOfStakerBefore = await hatToken.balanceOf(staker);
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });
    tx = await rewardController.claimReward(vault.address, staker, { from: staker });
    assert.equal(
      (await hatToken.balanceOf(staker)).toString(),
      tx.logs[2].args._amount.add(balanceOfStakerBefore).toString()
    );

    // Deposit redeemed existing reward
    await utils.increaseTime(7 * 24 * 3600);
    await stakingToken.mint(staker, web3.utils.toWei("1"));
    balanceOfStakerBefore = await hatToken.balanceOf(staker);
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });
    tx = await rewardController.claimReward(vault.address, staker, { from: staker });
    assert.equal(
      (await hatToken.balanceOf(staker)).toString(),
      tx.logs[2].args._amount.add(balanceOfStakerBefore).toString()
    );
    assert.equal(await stakingToken.balanceOf(staker), 0);
    assert.equal(
      await stakingToken.balanceOf(vault.address),
      web3.utils.toWei("4")
    );
    await utils.increaseTime(7 * 24 * 3600);
    //withdraw
    await rewardController.updateVault(vault.address);
    balanceOfStakerBefore = await hatToken.balanceOf(staker);
    await safeRedeem(vault, web3.utils.toWei("4"), staker);
    tx = await rewardController.claimReward(vault.address, staker, { from: staker });

    //staker get stake back
    assert.equal(
      (await stakingToken.balanceOf(staker)).toString(),
      web3.utils.toWei("4").toString()
    );
    let userHatBalance = await hatToken.balanceOf(staker);
    assert.equal(
      userHatBalance.toString(),
      tx.logs[2].args._amount.add(balanceOfStakerBefore).toString()
    );
    assert.equal(
      (await hatToken.balanceOf(rewardController.address)).toString(),
      amountToMint.sub(userHatBalance).toString()
    );
  });


it("getVaultReward - no vault updates will return 0 ", async () => {
    await setUpGlobalVars(accounts);
    const RewardControllerFactory = await ethers.getContractFactory("RewardController");
    rewardController = await RewardControllerFactory.deploy();
    await rewardController.deployed();

    await assertFunctionRaisesException(
      rewardController.initialize(
        hatToken.address,
        accounts[0],
        0,
        0,
        epochRewardPerBlock
      ),
      "EpochLengthZero"
    );

    await rewardController.initialize(
      hatToken.address,
      accounts[0],
      0,
      1,
      epochRewardPerBlock
    );

    try {
      await rewardController.initialize(
        hatToken.address,
        accounts[0],
        0,
        1,
        epochRewardPerBlock
      );
      assert(false, "already initialized");
    } catch (ex) {
      assertVMException(ex, "Initializable: contract is already initialized");
    }
  });

  it("getVaultReward - no vault updates will retrun 0 ", async () => {
    await setUpGlobalVars(accounts);
    let hatToken1 = await HATTokenMock.new(accounts[0]);
    var vaultsManager = await VaultsManagerMock.new();
    let deployment = await deployHATVaults({
      governance: vaultsManager.address,
      arbitrator: vaultsManager.address,
      hatToken: hatToken1.address,
      rewardControllersConf: [{
        startBlock: 1,
        epochLength: 10,
        epochRewardPerBlock
      }],
      hatVaultsRegistryConf: {
        governanceFee: 1000
      },
      silent: true
    });

    hatVaultsRegistry1 = await HATVaultsRegistry.at(deployment.hatVaultsRegistry.address);
    rewardController1 = await RewardController.at(
      deployment.rewardControllers[0].address
    );
    assert.equal(
      await rewardController1.getVaultReward(
        vault.address,
        0,
      ),
      "0"
    );
  });

  it("getRewardForBlocksRange - from below startblock will return 0 ", async () => {
    await setUpGlobalVars(accounts, 1);
    let allocPoint = (await rewardController.vaultInfo(vault.address)).allocPoint;
    let globalUpdatesLen = await rewardController.getGlobalVaultsUpdatesLength();
    let totalAllocPoint = (
      await rewardController.globalVaultsUpdates(globalUpdatesLen - 1)
    ).totalAllocPoint;
    assert.equal(
      await rewardController.getRewardForBlocksRange(
        0,
        1,
        allocPoint,
        totalAllocPoint
      ),
      "0"
    );
    await setUpGlobalVars(accounts, 0);
    let startBlock = parseInt((await rewardController.startBlock()).toString());
    assert.equal(
      (
        await rewardController.getRewardForBlocksRange(
          startBlock,
          startBlock + 1,
          allocPoint,
          totalAllocPoint
        )
      ).toString(),
      web3.utils.toWei("441.3")
    );
  });

  it("getRewardForBlocksRange - from <= to will return 0", async () => {
    await setUpGlobalVars(accounts, 0);
    assert.equal(
      (
        await rewardController.getRewardForBlocksRange(1, 0, 0, 1000)
      ).toNumber(),
      0
    );
    assert.equal(
      (
        await rewardController.getRewardForBlocksRange(0, 0, 0, 1000)
      ).toNumber(),
      0
    );
  });

  it("setEpochRewardPerBlock - can set all before start block", async () => {
    var epochRewardPerBlockRandom = [
      '12000000000000000000', '23000000000000000000',
      '32000000000000000000', '5000000000000000000',
      '47000000000000000000', '32000000000000000000',
      '95000000000000000000', '56000000000000000000',
      '38000000000000000000', '80000000000000000000',
      '62000000000000000000', '71000000000000000000',
      '43000000000000000000', '44000000000000000000',
      '16000000000000000000', '26000000000000000000',
      '32000000000000000000', '97000000000000000000',
      '32000000000000000000', '43000000000000000000',
      '78000000000000000000', '64000000000000000000',
      '65000000000000000000', '29000000000000000000'
    ];

    var startBlock = (await web3.eth.getBlock("latest")).number + 1000;
    await setUpGlobalVars(accounts, startBlock);
    let allocPoint = (await rewardController.vaultInfo(vault.address)).allocPoint;
    let globalUpdatesLen = await rewardController.getGlobalVaultsUpdatesLength();
    let totalAllocPoint = (
      await rewardController.globalVaultsUpdates(globalUpdatesLen - 1)
    ).totalAllocPoint;
    try {
      await rewardController.setEpochRewardPerBlock(epochRewardPerBlockRandom, {
        from: accounts[1],
      });
      assert(false, "only governance");
    } catch (ex) {
      assertVMException(ex, "Ownable: caller is not the owner");
    }

    let tx = await rewardController.setEpochRewardPerBlock(epochRewardPerBlockRandom);
    assert.equal(tx.logs[0].event, "SetEpochRewardPerBlock");
    let eventEpochRewardPerBlock = tx.logs[0].args._epochRewardPerBlock;
    for (let i = 0; i < eventEpochRewardPerBlock.length; i++) {
      eventEpochRewardPerBlock[i] = parseInt(eventEpochRewardPerBlock[i].toString());
      assert.equal(tx.logs[0].args._epochRewardPerBlock[i], epochRewardPerBlockRandom[i]);
    }

    assert.equal(
      (
        await rewardController.getRewardForBlocksRange(
          startBlock,
          startBlock + 10,
          allocPoint,
          totalAllocPoint
        )
      ).toString(),
      new web3.utils.BN(epochRewardPerBlockRandom[0])
        .mul(new web3.utils.BN(10))
        .toString()
    );
    assert.equal(
      (
        await rewardController.getRewardForBlocksRange(
          startBlock,
          startBlock + 15,
          allocPoint,
          totalAllocPoint
        )
      ).toString(),
      new web3.utils.BN(epochRewardPerBlockRandom[0])
        .mul(new web3.utils.BN(10))
        .add(
          new web3.utils.BN(epochRewardPerBlockRandom[1]).mul(new web3.utils.BN(5))
        )
        .toString()
    );
    assert.equal(
      (
        await rewardController.getRewardForBlocksRange(
          startBlock,
          startBlock + 20,
          allocPoint,
          totalAllocPoint
        )
      ).toString(),
      new web3.utils.BN(epochRewardPerBlockRandom[0])
        .add(new web3.utils.BN(epochRewardPerBlockRandom[1]))
        .mul(new web3.utils.BN(10))
        .toString()
    );
    var multiplier = new web3.utils.BN("0");
    for (let i = 0; i < 24; i++) {
      multiplier = multiplier.add(new web3.utils.BN(epochRewardPerBlockRandom[i]));
    }
    assert.equal(
      (
        await rewardController.getRewardForBlocksRange(
          startBlock,
          startBlock + 1000,
          allocPoint,
          totalAllocPoint
        )
      ).toString(),
      multiplier.mul(new web3.utils.BN(10)).toString()
    );
  });

  it("setEpochRewardPerBlock - can set only epoch that have not started", async () => {
    var epochRewardPerBlockRandom = [
      '21000000000000000000', '17000000000000000000',
      '14000000000000000000', '54000000000000000000',
      '63000000000000000000', '55000000000000000000',
      '51000000000000000000', '25000000000000000000',
      '39000000000000000000', '55000000000000000000',
      '27000000000000000000', '99000000000000000000',
      '31000000000000000000', '19000000000000000000',
      '80000000000000000000', '41000000000000000000',
      '37000000000000000000', '11000000000000000000',
      '66000000000000000000', '70000000000000000000',
      '40000000000000000000', '38000000000000000000',
      '84000000000000000000', '38000000000000000000'
    ];

    var startBlock = (await web3.eth.getBlock("latest")).number + 1;
    await setUpGlobalVars(accounts, startBlock);
    let allocPoint = (await rewardController.vaultInfo(vault.address)).allocPoint;
    let globalUpdatesLen = await rewardController.getGlobalVaultsUpdatesLength();
    let totalAllocPoint = (
      await rewardController.globalVaultsUpdates(globalUpdatesLen - 1)
    ).totalAllocPoint;
    try {
      await rewardController.setEpochRewardPerBlock(epochRewardPerBlockRandom, {
        from: accounts[1],
      });
      assert(false, "only governance");
    } catch (ex) {
      assertVMException(ex, "Ownable: caller is not the owner");
    }

    let tx = await rewardController.setEpochRewardPerBlock(epochRewardPerBlockRandom);
    assert.equal(tx.logs[0].event, "SetEpochRewardPerBlock");
    
    // Should now be in the 2rd epoch

    let eventEpochRewardPerBlock = tx.logs[0].args._epochRewardPerBlock;
    for (let i = 0; i < 2; i++) {
      eventEpochRewardPerBlock[i] = parseInt(eventEpochRewardPerBlock[i].toString());
      assert.equal(tx.logs[0].args._epochRewardPerBlock[i], epochRewardPerBlock[i]);
    }

    for (let i = 2; i < eventEpochRewardPerBlock.length; i++) {
      eventEpochRewardPerBlock[i] = parseInt(eventEpochRewardPerBlock[i].toString());
      assert.equal(tx.logs[0].args._epochRewardPerBlock[i], epochRewardPerBlockRandom[i]);
    }

    assert.equal(
      (
        await rewardController.getRewardForBlocksRange(
          startBlock,
          startBlock + 10,
          allocPoint,
          totalAllocPoint
        )
      ).toString(),
      new web3.utils.BN(epochRewardPerBlock[0])
        .mul(new web3.utils.BN(10))
        .toString()
    );
    assert.equal(
      (
        await rewardController.getRewardForBlocksRange(
          startBlock,
          startBlock + 20,
          allocPoint,
          totalAllocPoint
        )
      ).toString(),
      new web3.utils.BN(epochRewardPerBlock[0])
        .add(new web3.utils.BN(epochRewardPerBlock[1]))
        .mul(new web3.utils.BN(10))
        .toString()
    );
    assert.equal(
      (
        await rewardController.getRewardForBlocksRange(
          startBlock,
          startBlock + 30,
          allocPoint,
          totalAllocPoint
        )
      ).toString(),
      new web3.utils.BN(epochRewardPerBlock[0])
        .add(new web3.utils.BN(epochRewardPerBlock[1]))
        .add(new web3.utils.BN(epochRewardPerBlockRandom[2]))
        .mul(new web3.utils.BN(10))
        .toString()
    );

    // Only 4th period and above should have change
    assert.equal(
      (
        await rewardController.getRewardForBlocksRange(
          startBlock,
          startBlock + 40,
          allocPoint,
          totalAllocPoint
        )
      ).toString(),
      new web3.utils.BN(epochRewardPerBlock[0])
        .add(new web3.utils.BN(epochRewardPerBlock[1]))
        .add(new web3.utils.BN(epochRewardPerBlockRandom[2]))
        .add(new web3.utils.BN(epochRewardPerBlockRandom[3]))
        .mul(new web3.utils.BN(10))
        .toString()
    );
    var multiplier = new web3.utils.BN("0");
    for (let i = 0; i < 2; i++) {
      multiplier = multiplier.add(new web3.utils.BN(epochRewardPerBlock[i]));
    }
    for (let i = 2; i < 24; i++) {
      multiplier = multiplier.add(new web3.utils.BN(epochRewardPerBlockRandom[i]));
    }
    assert.equal(
      (
        await rewardController.getRewardForBlocksRange(
          startBlock,
          startBlock + 1000,
          allocPoint,
          totalAllocPoint
        )
      ).toString(),
      multiplier.mul(new web3.utils.BN(10)).toString()
    );
  });

  it("getMultiplier - ", async () => {
    await setUpGlobalVars(accounts, 0);
    let allocPoint = (await rewardController.vaultInfo(vault.address)).allocPoint;
    let globalUpdatesLen = await rewardController.getGlobalVaultsUpdatesLength();
    let totalAllocPoint = (
      await rewardController.globalVaultsUpdates(globalUpdatesLen - 1)
    ).totalAllocPoint;
    let startBlock = parseInt((await rewardController.startBlock()).toString());
    assert.equal(
      (
        await rewardController.getRewardForBlocksRange(
          startBlock,
          startBlock + 10,
          allocPoint,
          totalAllocPoint
        )
      ).toString(),
      new web3.utils.BN(epochRewardPerBlock[0]).mul(new web3.utils.BN(10)).toString()
    );
    assert.equal(
      (
        await rewardController.getRewardForBlocksRange(
          startBlock,
          startBlock + 15,
          allocPoint,
          totalAllocPoint
        )
      ).toString(),
      new web3.utils.BN(epochRewardPerBlock[0])
        .mul(new web3.utils.BN(10))
        .add(new web3.utils.BN(epochRewardPerBlock[1]).mul(new web3.utils.BN(5)))
        .toString()
    );
    assert.equal(
      (
        await rewardController.getRewardForBlocksRange(
          startBlock,
          startBlock + 20,
          allocPoint,
          totalAllocPoint
        )
      ).toString(),
      new web3.utils.BN(epochRewardPerBlock[0])
        .add(new web3.utils.BN(epochRewardPerBlock[1]))
        .mul(new web3.utils.BN(10))
        .toString()
    );
    var multiplier = new web3.utils.BN("0");
    for (let i = 0; i < 24; i++) {
      multiplier = multiplier.add(new web3.utils.BN(epochRewardPerBlock[i]));
    }

    assert.equal(
      (
        await rewardController.getRewardForBlocksRange(
          startBlock,
          startBlock + 1000,
          allocPoint,
          totalAllocPoint
        )
      ).toString(),
      multiplier.mul(new web3.utils.BN(10)).toString()
    );
    var staker = accounts[1];
    assert.equal((await rewardController.getPendingReward(vault.address, staker)).toNumber(), 0);
  });

  it("getPendingReward + getRewardPerBlock", async () => {
    await setUpGlobalVars(accounts, 0, 8000, [7500, 2000, 500], 1500, 100);
    var staker = accounts[1];
    assert.equal((await rewardController.getPendingReward(vault.address, staker)).toNumber(), 0);
    await stakingToken.approve(vault.address, web3.utils.toWei("4"), {
      from: staker,
    });
    await stakingToken.mint(staker, web3.utils.toWei("1"));
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });
    await utils.increaseTime(7 * 24 * 3600);
    var currentBlockNumber = (await web3.eth.getBlock("latest")).number;
    let allocPoint = (await rewardController.vaultInfo(vault.address)).allocPoint;
    let globalUpdatesLen = await rewardController.getGlobalVaultsUpdatesLength();
    let totalAllocPoint = (
      await rewardController.globalVaultsUpdates(globalUpdatesLen - 1)
    ).totalAllocPoint;
    assert.equal(
      (await rewardController.getPendingReward(vault.address, staker)).toString(),
      (
        await rewardController.getRewardForBlocksRange(
          currentBlockNumber - 1,
          currentBlockNumber,
          allocPoint,
          totalAllocPoint
        )
      ).toString()
    );
    var multiplier = await rewardController.getRewardForBlocksRange(
      currentBlockNumber,
      currentBlockNumber + 1,
      allocPoint,
      totalAllocPoint
    );
    assert.equal(
      (
        await rewardController.getRewardForBlocksRange(
          currentBlockNumber - 1,
          currentBlockNumber,
          1,
          1
        )
      ).toString(),
      multiplier.toString()
    );
  });

  it("approve + stake + exit", async () => {
    await setUpGlobalVars(
      accounts,
      (await web3.eth.getBlock("latest")).number,
      8000,
      [7000, 2500, 500],
      1000,
      10000,
      100,
      2500000,
      60 * 60 * 24 * 3
    );

    var staker = accounts[4];
    var staker2 = accounts[3];
    await stakingToken.approve(vault.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await stakingToken.approve(vault.address, web3.utils.toWei("1"), {
      from: staker2,
    });
    await stakingToken.mint(staker, web3.utils.toWei("1"));
    await stakingToken.mint(staker2, web3.utils.toWei("1"));
    await advanceToSafetyPeriod();
    let tx = await claimsManager.submitClaim(
      accounts[2],
      8000,
      "description hash",
      {
        from: accounts[1],
      }
    );

    let claimId = tx.logs[0].args._claimId;

    // cannot claim while an active claim exists
    assert.equal(
      (await vault.maxWithdraw(staker)),
      web3.utils.toWei("0")
    );

    await claimsManager.challengeClaim(claimId);
    await utils.increaseTime(60 * 60 * 24 * 3 + 1);

    tx = await claimsManager.dismissClaim(claimId);
    assert.equal(tx.logs[0].event, "DismissClaim");

    //stake
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });
    assert.equal(
      await hatToken.balanceOf(rewardController.address),
      web3.utils.toWei(rewardControllerExpectedHatsBalance.toString())
    );

    //exit
    assert.equal(await hatToken.balanceOf(staker), 0);
    await utils.increaseTime(7 * 24 * 3600);
    await advanceToNonSafetyPeriod();
    await assertFunctionRaisesException(
      claimsManager.submitClaim(accounts[2], 8000, "description hash", {
        from: accounts[1],
      }),
      "NotSafetyPeriod"
    );
    await advanceToSafetyPeriod();
    await assertFunctionRaisesException(
      claimsManager.submitClaim(accounts[2], 8001, "description hash", {
        from: accounts[1]
      }),
      "BountyPercentageHigherThanMaxBounty"
    );

    // only the comittee can submit a claim
    await assertFunctionRaisesException(
      claimsManager.submitClaim(accounts[2], 8000, "description hash", {
        from: accounts[2],
      }),
      "OnlyCommittee"
    );

    try {
      await claimsManager.approveClaim(web3.utils.randomHex(32), 8000, ZERO_ADDRESS);
      assert(false, "there is no pending approval");
    } catch (ex) {
      assertVMException(ex, "NoActiveClaimExists");
    }

    tx = await claimsManager.submitClaim(accounts[2], 8000, "description hash", {
      from: accounts[1],
    });

    claimId = tx.logs[0].args._claimId;

    // cannot submit a claim if an active claim already exists
    await assertFunctionRaisesException(
      claimsManager.submitClaim(accounts[2], 8000, "description hash", {
        from: accounts[1],
      }),
      "ActiveClaimExists"
    );
 
    assert.equal(tx.logs[0].event, "SubmitClaim");
    assert.equal(tx.logs[0].args._committee, accounts[1]);
    assert.equal(tx.logs[0].args._submitter, accounts[1]);
    assert.equal(tx.logs[0].args._beneficiary, accounts[2]);
    assert.equal(tx.logs[0].args._bountyPercentage, 8000);
    assert.equal(tx.logs[0].args._descriptionHash, "description hash");

    await utils.increaseTime(60 * 60 * 24 * 3 + 1);

    await stakingToken.setReenterApproveClaim(true);
    try {
      await claimsManager.approveClaim(claimId, 8000, ZERO_ADDRESS);
      assert(false, "fail on reentrancy attempt");
    } catch (ex) {
      assertVMException(ex, "ReentrancyGuard: reentrant call");
    }
    await stakingToken.setReenterApproveClaim(false);

    tx = await claimsManager.approveClaim(claimId, 8000, ZERO_ADDRESS);

    assert.equal(
      await hatToken.balanceOf(rewardController.address),
      web3.utils.toWei(rewardControllerExpectedHatsBalance.toString())
    );

    assert.equal(tx.logs[1].event, "ApproveClaim");
    assert.equal(tx.logs[1].args._claimId, claimId);

    currentBlockNumber = (await web3.eth.getBlock("latest")).number;
    await vault.deposit(web3.utils.toWei("1"), staker2, { from: staker2 });

    assert.equal(await stakingToken.balanceOf(staker), 0);
    let stakerAmount = await vault.balanceOf(staker);
    assert.equal(stakerAmount.toString(), web3.utils.toWei("1"));
    await safeRedeem(vault, stakerAmount, staker);

    assert.equal(stakerAmount.toString(), web3.utils.toWei("1"));
    tx = await rewardController.claimReward(vault.address, staker, { from: staker });
    assert.equal(tx.logs[2].event, "ClaimReward");
    let totalReward = tx.logs[2].args._amount;

    assert.equal(
      web3.utils.fromWei(await stakingToken.balanceOf(staker)),
      "0.2"
    );
    stakerAmount = await vault.balanceOf(staker2);
    await safeRedeem(vault, stakerAmount, staker2);
    tx = await rewardController.claimReward(vault.address, staker2, { from: staker2 });
    assert.equal(tx.logs[2].event, "ClaimReward");
    totalReward = totalReward.add(tx.logs[2].args._amount);
    assert.equal(
      (await hatToken.balanceOf(rewardController.address)).toString(),
      new web3.utils.BN(
        web3.utils.toWei(rewardControllerExpectedHatsBalance.toString())
      )
        .sub(totalReward)
        .toString()
    );
    assert.equal(
      web3.utils.fromWei(await stakingToken.balanceOf(staker2)),
      "1"
    );
  });

  it("approve+ stake simple check rewards", async () => {
    await setUpGlobalVars(accounts, 0, 8000, [7000, 2500, 500], 1000, 10000);
    var staker = accounts[4];
    await stakingToken.approve(vault.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await stakingToken.mint(staker, web3.utils.toWei("1"));

    //stake
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });

    assert.equal(await hatToken.balanceOf(staker), 0);
    await utils.increaseTime(7 * 24 * 3600);
    await advanceToSafetyPeriod();
    let tx = await claimsManager.submitClaim(
      accounts[2],
      8000,
      "description hash",
      {
        from: accounts[1],
      }
    );

    let claimId = tx.logs[0].args._claimId;

    await utils.increaseTime(60 * 60 * 24);
    tx = await claimsManager.approveClaim(claimId, 8000, ZERO_ADDRESS);
    assert.equal(tx.logs[1].event, "ApproveClaim");
    assert.equal(tx.logs[1].args._claimId, claimId);
    let stakerAmount = await vault.balanceOf(staker);
    assert.equal(stakerAmount.toString(), web3.utils.toWei("1"));
    await safeRedeem(vault, stakerAmount, staker);
    tx = await rewardController.claimReward(vault.address, staker, { from: staker });
    assert.equal(tx.logs[2].event, "ClaimReward");
    assert.equal(
      (await hatToken.balanceOf(rewardController.address)).toString(),
      new web3.utils.BN(
        web3.utils.toWei(rewardControllerExpectedHatsBalance.toString())
      )
        .sub(tx.logs[2].args._amount)
        .toString()
    );
    assert.equal(
      web3.utils.fromWei(await stakingToken.balanceOf(staker)),
      "0.2"
    );
  });

  it("withdraw all after approve and check reward", async () => {
    await setUpGlobalVars(accounts, 0, 8000, [7000, 2500, 500], 1000, 10000);
    var staker = accounts[1];
    var staker2 = accounts[3];
    await stakingToken.approve(vault.address, web3.utils.toWei("2"), {
      from: staker,
    });
    await stakingToken.approve(vault.address, web3.utils.toWei("1"), {
      from: staker2,
    });
    await stakingToken.mint(staker, web3.utils.toWei("2"));
    await stakingToken.mint(staker2, web3.utils.toWei("1"));

    //stake
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });
    await vault.deposit(web3.utils.toWei("1"), staker2, { from: staker2 });

    await utils.increaseTime(7 * 24 * 3600);
    await advanceToSafetyPeriod();
    let tx = await claimsManager.submitClaim(
      accounts[2],
      8000,
      "description hash",
      {
        from: accounts[1],
      }
    );

    let claimId = tx.logs[0].args._claimId;
    await utils.increaseTime(60 * 60 * 24);

    await claimsManager.approveClaim(claimId, 8000, ZERO_ADDRESS);
    await safeRedeem(vault, await vault.balanceOf(staker), staker, staker);
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });
    await safeRedeem(vault, web3.utils.toWei("1"), staker2);
    tx = await rewardController.claimReward(vault.address, staker, { from: staker2 });
    assert.equal(tx.logs[2].event, "ClaimReward");
    await safeRedeem(vault, web3.utils.toWei("1"), staker);
    tx = await rewardController.claimReward(vault.address, staker, { from: staker });
    assert.equal(tx.logs[2].event, "ClaimReward");
    assert.isFalse(tx.logs[2].args._amount.eq(0));
  });

  it("deposit mint withdraw redeem after approve claim (with slippage protection)", async () => {
    await setUpGlobalVars(
      accounts,
      (await web3.eth.getBlock("latest")).number,
      8000,
      [7000, 2500, 500],
      1000,
      10000
    );
    currentBlockNumber = (await web3.eth.getBlock("latest")).number;
    var staker = accounts[1];
    var staker2 = accounts[2];
    await stakingToken.approve(vault.address, web3.utils.toWei("2"), {
      from: staker,
    });
    await stakingToken.approve(vault.address, web3.utils.toWei("2"), {
      from: staker2,
    });
    await stakingToken.mint(staker, web3.utils.toWei("2"));
    await stakingToken.mint(staker2, web3.utils.toWei("2"));

    //stake
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });
    //exit
    assert.equal(await hatToken.balanceOf(staker), 0);
    assert.equal(
      await hatToken.balanceOf(rewardController.address),
      web3.utils.toWei(rewardControllerExpectedHatsBalance.toString())
    );

    await utils.increaseTime(7 * 24 * 3600);
    await advanceToSafetyPeriod();
    let tx = await claimsManager.submitClaim(
      accounts[2],
      8000,
      "description hash",
      {
        from: accounts[1],
      }
    );

    let claimId = tx.logs[0].args._claimId;
    
    await utils.increaseTime(60 * 60 * 24);
    tx = await claimsManager.approveClaim(claimId, 8000, ZERO_ADDRESS);
    assert.equal(tx.logs[1].event, "ApproveClaim");
    assert.equal(tx.logs[1].args._claimId, claimId);

    assert.equal(await vault.totalSupply(), web3.utils.toWei("1"));
    assert.equal(await vault.balanceOf(staker), web3.utils.toWei("1"));
    assert.equal(await vault.balanceOf(staker2), web3.utils.toWei("0"));
    
    try {
      await vault.methods["deposit(uint256,address,uint256)"](web3.utils.toWei("0.8"), staker2, web3.utils.toWei("5"), { from: staker2 });
      assert(false, "bad slippage protection");
    } catch (ex) {
      assertVMException(ex, "DepositSlippageProtection");
    }

    tx = await vault.methods["deposit(uint256,address,uint256)"](web3.utils.toWei("0.8"), staker2, web3.utils.toWei("4"), { from: staker2 });
    assert.equal(tx.logs[3].event, "Deposit");
    assert.equal(tx.logs[3].args.assets.toString(), web3.utils.toWei("0.8"));
    assert.equal(tx.logs[3].args.shares.toString(), web3.utils.toWei("4"));
    assert.equal(await vault.totalSupply(), web3.utils.toWei("5"));
    assert.equal(await vault.balanceOf(staker), web3.utils.toWei("1"));
    assert.equal(await vault.balanceOf(staker2), web3.utils.toWei("4"));

    try {
      await vault.methods["mint(uint256,address,uint256)"](web3.utils.toWei("1"), staker2, web3.utils.toWei("0.19"), { from: staker2 });
      assert(false, "bad slippage protection");
    } catch (ex) {
      assertVMException(ex, "MintSlippageProtection");
    }

    tx = await vault.methods["mint(uint256,address,uint256)"](web3.utils.toWei("1"), staker2, web3.utils.toWei("0.2"), { from: staker2 });
    assert.equal(tx.logs[3].event, "Deposit");
    assert.equal(tx.logs[3].args.assets.toString(), web3.utils.toWei("0.2"));
    assert.equal(tx.logs[3].args.shares.toString(), web3.utils.toWei("1"));
    assert.equal(await vault.totalSupply(), web3.utils.toWei("6"));
    assert.equal(await vault.balanceOf(staker), web3.utils.toWei("1"));
    assert.equal(await vault.balanceOf(staker2), web3.utils.toWei("5"));

    try {
      await safeWithdraw(vault, web3.utils.toWei("1.1"), staker2);
      assert(false, "cannot withdraw more than max");
    } catch (ex) {
      assertVMException(ex, "RedeemMoreThanMax");
    }

    try {
      await safeWithdraw(vault, web3.utils.toWei("0.8"), staker2, staker2, web3.utils.toWei("3"));
      assert(false, "bad slippage protection");
    } catch (ex) {
      assertVMException(ex, "WithdrawSlippageProtection");
    }

    tx = await safeWithdraw(vault, web3.utils.toWei("0.8"), staker2, staker2, web3.utils.toWei("4"));
    assert.equal(tx.logs[2].event, "Withdraw");
    assert.equal(tx.logs[2].args.assets.toString(), web3.utils.toWei("0.8"));
    assert.equal(tx.logs[2].args.shares.toString(), web3.utils.toWei("4"));
    assert.equal(await vault.totalSupply(), web3.utils.toWei("2"));
    assert.equal(await vault.balanceOf(staker), web3.utils.toWei("1"));
    assert.equal(await vault.balanceOf(staker2), web3.utils.toWei("1"));

    try {
      await safeRedeem(vault, web3.utils.toWei("2"), staker2);
      assert(false, "cannot redeem more than max");
    } catch (ex) {
      assertVMException(ex, "RedeemMoreThanMax");
    }

    try {
      await safeRedeem(vault, web3.utils.toWei("1"), staker2, staker2, web3.utils.toWei("0.21"));
      assert(false, "bad slippage protection");
    } catch (ex) {
      assertVMException(ex, "RedeemSlippageProtection");
    }

    tx = await safeRedeem(vault, web3.utils.toWei("1"), staker2, staker2, web3.utils.toWei("0.2"));
    assert.equal(tx.logs[2].event, "Withdraw");
    assert.equal(tx.logs[2].args.assets.toString(), web3.utils.toWei("0.2"));
    assert.equal(tx.logs[2].args.shares.toString(), web3.utils.toWei("1"));
    assert.equal(await vault.totalSupply(), web3.utils.toWei("1"));
    assert.equal(await vault.balanceOf(staker), web3.utils.toWei("1"));
    assert.equal(await vault.balanceOf(staker2), web3.utils.toWei("0"));

    tx = await safeRedeem(vault, web3.utils.toWei("1"), staker, staker, web3.utils.toWei("0.2"));
    assert.equal(tx.logs[2].event, "Withdraw");
    assert.equal(tx.logs[2].args.assets.toString(), web3.utils.toWei("0.2"));
    assert.equal(tx.logs[2].args.shares.toString(), web3.utils.toWei("1"));
    assert.equal(await vault.totalSupply(), web3.utils.toWei("0"));
    assert.equal(await vault.balanceOf(staker), web3.utils.toWei("0"));
    assert.equal(await vault.balanceOf(staker2), web3.utils.toWei("0"));

    tx = await vault.methods["mint(uint256,address,uint256)"](web3.utils.toWei("1"), staker2, web3.utils.toWei("1"), { from: staker2 });
    assert.equal(tx.logs[3].event, "Deposit");
    assert.equal(tx.logs[3].args.assets.toString(), web3.utils.toWei("1"));
    assert.equal(tx.logs[3].args.shares.toString(), web3.utils.toWei("1"));
    assert.equal(await vault.totalSupply(), web3.utils.toWei("1"));
    assert.equal(await vault.balanceOf(staker), web3.utils.toWei("0"));
    assert.equal(await vault.balanceOf(staker2), web3.utils.toWei("1"));
  });

  it("withdraw all and claim reward after approve", async () => {
    await setUpGlobalVars(
      accounts,
      (await web3.eth.getBlock("latest")).number,
      8000,
      [7000, 2500, 500],
      1000,
      10000
    );
    currentBlockNumber = (await web3.eth.getBlock("latest")).number;
    var staker = accounts[1];
    var staker2 = accounts[3];
    await stakingToken.approve(vault.address, web3.utils.toWei("2"), {
      from: staker,
    });
    await stakingToken.approve(vault.address, web3.utils.toWei("1"), {
      from: staker2,
    });
    await stakingToken.mint(staker, web3.utils.toWei("2"));
    await stakingToken.mint(staker2, web3.utils.toWei("1"));

    //stake
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });
    //exit
    assert.equal(await hatToken.balanceOf(staker), 0);
    assert.equal(
      await hatToken.balanceOf(rewardController.address),
      web3.utils.toWei(rewardControllerExpectedHatsBalance.toString())
    );

    await utils.increaseTime(7 * 24 * 3600);
    await advanceToSafetyPeriod();
    let tx = await claimsManager.submitClaim(
      accounts[2],
      8000,
      "description hash",
      {
        from: accounts[1],
      }
    );

    let claimId = tx.logs[0].args._claimId;
    await utils.increaseTime(60 * 60 * 24);

    tx = await claimsManager.approveClaim(claimId, 8000, ZERO_ADDRESS);
    assert.equal(tx.logs[1].event, "ApproveClaim");
    assert.equal(tx.logs[1].args._claimId, claimId);

    await vault.withdrawRequest({ from: staker });
    //increase time for pending period
    await utils.increaseTime(7 * 24 * 3600);
    await advanceToNonSafetyPeriod();
    let expectedReward = await calculateExpectedReward(staker);
    tx = await vault.methods["redeem(uint256,address,address)"](await vault.balanceOf(staker), staker, staker, { from: staker });
    assert.equal(tx.logs[2].event, "Withdraw");
    assert.equal(tx.logs[2].args.assets.toString(), web3.utils.toWei("0.2"));
    assert.equal(tx.logs[2].args.shares.toString(), web3.utils.toWei("1"));
    let unclaimedReward = await rewardController.unclaimedReward(vault.address, staker);
    assert.equal(unclaimedReward.toString(), expectedReward.toString());

    await vault.deposit(web3.utils.toWei("1"), staker2, { from: staker2 });
    assert.equal(await hatToken.balanceOf(staker2), 0);

    await utils.increaseTime(7 * 24 * 3600);
    await vault.withdrawRequest({ from: staker2 });
    //increase time for pending period
    await utils.increaseTime(7 * 24 * 3600);
    await advanceToNonSafetyPeriod();
    let expectedRewardStaker2 = await calculateExpectedReward(staker2);
    tx = await vault.methods["redeem(uint256,address,address)"](await vault.balanceOf(staker2), staker2, staker2, { from: staker2 });
    assert.equal(tx.logs[2].event, "Withdraw");
    assert.equal(tx.logs[2].args.assets.toString(), web3.utils.toWei("1"));
    assert.equal(tx.logs[2].args.shares.toString(), web3.utils.toWei("1"));

    let unclaimedRewardStaker2 = await rewardController.unclaimedReward(vault.address, staker2);
    assert.equal(unclaimedRewardStaker2.toString(), expectedRewardStaker2.toString());
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });
    await safeRedeem(vault, web3.utils.toWei("1"), staker);
    tx = await rewardController.claimReward(vault.address, staker, { from: staker });
    assert.equal(tx.logs[2].event, "ClaimReward");
    assert.isFalse(tx.logs[2].args._amount.eq(0));
    assert.equal(
      (await hatToken.balanceOf(rewardController.address)).toString(),
      new web3.utils.BN(
        web3.utils.toWei(rewardControllerExpectedHatsBalance.toString())
      )
        .sub(tx.logs[2].args._amount)
        .toString()
    );
    assert.equal((await rewardController.unclaimedReward(vault.address, staker)).toString(), "0");
  });

  it("deposit for another user", async () => {
    await setUpGlobalVars(
      accounts,
      (await web3.eth.getBlock("latest")).number,
      8000,
      [7000, 2500, 500],
      1000,
      10000
    );
    currentBlockNumber = (await web3.eth.getBlock("latest")).number;
    var staker = accounts[1];
    var staker2 = accounts[2];
    await stakingToken.approve(vault.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await stakingToken.approve(vault.address, web3.utils.toWei("1"), {
      from: staker2,
    });
    await stakingToken.mint(staker, web3.utils.toWei("1"));
    await stakingToken.mint(staker2, web3.utils.toWei("1"));

    //stake
    let tx = await vault.deposit(web3.utils.toWei("1"), staker, { from: staker2 });
    assert.equal(tx.logs[3].event, "Deposit");
    assert.equal(tx.logs[3].args.sender, staker2);
    assert.equal(tx.logs[3].args.owner, staker);
    assert.equal(tx.logs[3].args.assets.toString(), web3.utils.toWei("1"));
    assert.equal(tx.logs[3].args.shares.toString(), web3.utils.toWei("1"));

    assert.equal((await stakingToken.balanceOf(staker)).toString(), web3.utils.toWei("1"));
    assert.equal((await stakingToken.balanceOf(staker2)).toString(), web3.utils.toWei("0"));
    assert.equal((await vault.balanceOf(staker)).toString(), web3.utils.toWei("1"));
    assert.equal((await vault.balanceOf(staker2)).toString(), web3.utils.toWei("0"));

    await vault.withdrawRequest({ from: staker });

    await stakingToken.approve(vault.address, web3.utils.toWei("1"), {
      from: staker2,
    });
    await stakingToken.mint(staker2, web3.utils.toWei("1"));

    try {
      await vault.deposit(web3.utils.toWei("1"), staker, { from: staker2 });
      assert(false, "cannot deposit for user with a withdraw request");
    } catch (ex) {
      assertVMException(ex, "CannotTransferToAnotherUserWithActiveWithdrawRequest");
    }

    await utils.increaseTime(parseInt((await hatVaultsRegistry.generalParameters()).withdrawRequestPendingPeriod.toString()));
    await utils.increaseTime(parseInt((await hatVaultsRegistry.generalParameters()).withdrawRequestEnablePeriod.toString()));

    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker2 });
    assert.equal(tx.logs[3].event, "Deposit");
    assert.equal(tx.logs[3].args.sender, staker2);
    assert.equal(tx.logs[3].args.owner, staker);
    assert.equal(tx.logs[3].args.assets.toString(), web3.utils.toWei("1"));
    assert.equal(tx.logs[3].args.shares.toString(), web3.utils.toWei("1"));

    assert.equal((await stakingToken.balanceOf(staker)).toString(), web3.utils.toWei("1"));
    assert.equal((await stakingToken.balanceOf(staker2)).toString(), web3.utils.toWei("0"));
    assert.equal((await vault.balanceOf(staker)).toString(), web3.utils.toWei("2"));
    assert.equal((await vault.balanceOf(staker2)).toString(), web3.utils.toWei("0"));    
  });

  it("mint for another user", async () => {
    await setUpGlobalVars(
      accounts,
      (await web3.eth.getBlock("latest")).number,
      8000,
      [7000, 2500, 500],
      1000,
      10000
    );
    currentBlockNumber = (await web3.eth.getBlock("latest")).number;
    var staker = accounts[1];
    var staker2 = accounts[2];
    await stakingToken.approve(vault.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await stakingToken.approve(vault.address, web3.utils.toWei("1"), {
      from: staker2,
    });
    await stakingToken.mint(staker, web3.utils.toWei("1"));
    await stakingToken.mint(staker2, web3.utils.toWei("1"));

    //stake
    let tx = await vault.methods["mint(uint256,address)"](web3.utils.toWei("1"), staker, { from: staker2 });
    assert.equal(tx.logs[3].event, "Deposit");
    assert.equal(tx.logs[3].args.sender, staker2);
    assert.equal(tx.logs[3].args.owner, staker);
    assert.equal(tx.logs[3].args.assets.toString(), web3.utils.toWei("1"));
    assert.equal(tx.logs[3].args.shares.toString(), web3.utils.toWei("1"));

    assert.equal((await stakingToken.balanceOf(staker)).toString(), web3.utils.toWei("1"));
    assert.equal((await stakingToken.balanceOf(staker2)).toString(), web3.utils.toWei("0"));
    assert.equal((await vault.balanceOf(staker)).toString(), web3.utils.toWei("1"));
    assert.equal((await vault.balanceOf(staker2)).toString(), web3.utils.toWei("0"));

    await vault.withdrawRequest({ from: staker });

    await stakingToken.approve(vault.address, web3.utils.toWei("1"), {
      from: staker2,
    });
    await stakingToken.mint(staker2, web3.utils.toWei("1"));

    try {
      await vault.methods["mint(uint256,address)"](web3.utils.toWei("1"), staker, { from: staker2 });
      assert(false, "cannot deposit for user with a withdraw request");
    } catch (ex) {
      assertVMException(ex, "CannotTransferToAnotherUserWithActiveWithdrawRequest");
    }

    await utils.increaseTime(parseInt((await hatVaultsRegistry.generalParameters()).withdrawRequestPendingPeriod.toString()));
    await utils.increaseTime(parseInt((await hatVaultsRegistry.generalParameters()).withdrawRequestEnablePeriod.toString()));

    tx = await vault.methods["mint(uint256,address)"](web3.utils.toWei("1"), staker, { from: staker2 });
    assert.equal(tx.logs[3].event, "Deposit");
    assert.equal(tx.logs[3].args.sender, staker2);
    assert.equal(tx.logs[3].args.owner, staker);
    assert.equal(tx.logs[3].args.assets.toString(), web3.utils.toWei("1"));
    assert.equal(tx.logs[3].args.shares.toString(), web3.utils.toWei("1"));

    assert.equal((await stakingToken.balanceOf(staker)).toString(), web3.utils.toWei("1"));
    assert.equal((await stakingToken.balanceOf(staker2)).toString(), web3.utils.toWei("0"));
    assert.equal((await vault.balanceOf(staker)).toString(), web3.utils.toWei("2"));
    assert.equal((await vault.balanceOf(staker2)).toString(), web3.utils.toWei("0"));    
  });

  it("withdraw from another user", async () => {
    await setUpGlobalVars(
      accounts,
      (await web3.eth.getBlock("latest")).number,
      8000,
      [7000, 2500, 500],
      1000,
      10000
    );
    currentBlockNumber = (await web3.eth.getBlock("latest")).number;
    var staker = accounts[1];
    var staker2 = accounts[2];
    await stakingToken.approve(vault.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await stakingToken.approve(vault.address, web3.utils.toWei("1"), {
      from: staker2,
    });
    await stakingToken.mint(staker, web3.utils.toWei("1"));
    await stakingToken.mint(staker2, web3.utils.toWei("1"));

    //stake
    let tx = await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });
    assert.equal(tx.logs[3].event, "Deposit");
    assert.equal(tx.logs[3].args.sender, staker);
    assert.equal(tx.logs[3].args.owner, staker);
    assert.equal(tx.logs[3].args.assets.toString(), web3.utils.toWei("1"));
    assert.equal(tx.logs[3].args.shares.toString(), web3.utils.toWei("1"));

    assert.equal((await stakingToken.balanceOf(staker)).toString(), web3.utils.toWei("0"));
    assert.equal((await stakingToken.balanceOf(staker2)).toString(), web3.utils.toWei("1"));
    assert.equal((await vault.balanceOf(staker)).toString(), web3.utils.toWei("1"));
    assert.equal((await vault.balanceOf(staker2)).toString(), web3.utils.toWei("0"));

    try {
      await safeWithdraw(vault, web3.utils.toWei("1"), staker2, staker);
      assert(false, "cannot withdraw from another user without sufficient allowance");
    } catch (ex) {
      assertVMException(ex, "ERC20: insufficient allowance");
    }

    await vault.approve(staker2, web3.utils.toWei("0.5"), { from: staker });

    try {
      await safeWithdraw(vault, web3.utils.toWei("1"), staker2, staker);
      assert(false, "cannot withdraw from another user without sufficient allowance");
    } catch (ex) {
      assertVMException(ex, "ERC20: insufficient allowance");
    }

    await vault.increaseAllowance(staker2, web3.utils.toWei("0.5"), { from: staker });
    tx = await safeWithdraw(vault, web3.utils.toWei("1"), staker2, staker);

    assert.equal(tx.logs[3].event, "Withdraw");
    assert.equal(tx.logs[3].args.sender, staker2);
    assert.equal(tx.logs[3].args.receiver, staker2);
    assert.equal(tx.logs[3].args.owner, staker);
    assert.equal(tx.logs[3].args.assets.toString(), web3.utils.toWei("1"));
    assert.equal(tx.logs[3].args.shares.toString(), web3.utils.toWei("1"));

    assert.equal((await stakingToken.balanceOf(staker)).toString(), web3.utils.toWei("0"));
    assert.equal((await stakingToken.balanceOf(staker2)).toString(), web3.utils.toWei("2"));
    assert.equal((await vault.balanceOf(staker)).toString(), web3.utils.toWei("0"));
    assert.equal((await vault.balanceOf(staker2)).toString(), web3.utils.toWei("0"));
  });

  it("redeem from another user", async () => {
    await setUpGlobalVars(
      accounts,
      (await web3.eth.getBlock("latest")).number,
      8000,
      [7000, 2500, 500],
      1000,
      10000
    );
    currentBlockNumber = (await web3.eth.getBlock("latest")).number;
    var staker = accounts[1];
    var staker2 = accounts[2];
    await stakingToken.approve(vault.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await stakingToken.approve(vault.address, web3.utils.toWei("1"), {
      from: staker2,
    });
    await stakingToken.mint(staker, web3.utils.toWei("1"));
    await stakingToken.mint(staker2, web3.utils.toWei("1"));

    //stake
    let tx = await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });
    assert.equal(tx.logs[3].event, "Deposit");
    assert.equal(tx.logs[3].args.sender, staker);
    assert.equal(tx.logs[3].args.owner, staker);
    assert.equal(tx.logs[3].args.assets.toString(), web3.utils.toWei("1"));
    assert.equal(tx.logs[3].args.shares.toString(), web3.utils.toWei("1"));

    assert.equal((await stakingToken.balanceOf(staker)).toString(), web3.utils.toWei("0"));
    assert.equal((await stakingToken.balanceOf(staker2)).toString(), web3.utils.toWei("1"));
    assert.equal((await vault.balanceOf(staker)).toString(), web3.utils.toWei("1"));
    assert.equal((await vault.balanceOf(staker2)).toString(), web3.utils.toWei("0"));

    try {
      await safeRedeem(vault, web3.utils.toWei("1"), staker2, staker);
      assert(false, "cannot withdraw from another user without sufficient allowance");
    } catch (ex) {
      assertVMException(ex, "ERC20: insufficient allowance");
    }

    await vault.approve(staker2, web3.utils.toWei("0.5"), { from: staker });

    try {
      await safeRedeem(vault, web3.utils.toWei("1"), staker2, staker);
      assert(false, "cannot withdraw from another user without sufficient allowance");
    } catch (ex) {
      assertVMException(ex, "ERC20: insufficient allowance");
    }

    await vault.increaseAllowance(staker2, web3.utils.toWei("0.5"), { from: staker });
    tx = await safeRedeem(vault, web3.utils.toWei("1"), staker2, staker);

    assert.equal(tx.logs[3].event, "Withdraw");
    assert.equal(tx.logs[3].args.sender, staker2);
    assert.equal(tx.logs[3].args.receiver, staker2);
    assert.equal(tx.logs[3].args.owner, staker);
    assert.equal(tx.logs[3].args.assets.toString(), web3.utils.toWei("1"));
    assert.equal(tx.logs[3].args.shares.toString(), web3.utils.toWei("1"));

    assert.equal((await stakingToken.balanceOf(staker)).toString(), web3.utils.toWei("0"));
    assert.equal((await stakingToken.balanceOf(staker2)).toString(), web3.utils.toWei("2"));
    assert.equal((await vault.balanceOf(staker)).toString(), web3.utils.toWei("0"));
    assert.equal((await vault.balanceOf(staker2)).toString(), web3.utils.toWei("0"));
  });

  it("redeeming and transfer is locked while an active claim exists", async () => {
    // cannot transfer if an active claim exists
    const { vault, claimsManager, registry, stakingToken, someAccount } = await setup(accounts);
    await advanceToSafetyPeriod(registry);
    await submitClaim(claimsManager, { accounts });
    // there is an active claim, so call to transfer or redeem will be
    await stakingToken.approve(vault.address, web3.utils.toWei("1"), {
      from: someAccount,
    });
    await stakingToken.mint(someAccount, web3.utils.toWei("1"));

    // deposit some tokens so we can test for redeeming later (depositing still works with an active claim)
    await vault.deposit(web3.utils.toWei("1"), someAccount, { from: someAccount });
  

    await assertFunctionRaisesException(
      vault.transfer(accounts[6], web3.utils.toWei("1"), { from: someAccount }),
      "RedeemMoreThanMax"
    );
    await assertFunctionRaisesException(
      vault.methods["redeem(uint256,address,address)"](web3.utils.toWei("1"), someAccount, someAccount, { from: someAccount }),
      "RedeemMoreThanMax"
    );
    await assertFunctionRaisesException(
      vault.methods["redeem(uint256,address,address)"](web3.utils.toWei("1"), someAccount, someAccount, { from: someAccount }),
      "RedeemMoreThanMax"
    );
    await assertFunctionRaisesException(
      vault.methods["withdraw(uint256,address,address)"](web3.utils.toWei("1"), someAccount, someAccount, { from: someAccount }),
      "RedeemMoreThanMax"
    );
  });

  it("transfer shares", async () => {
    await setUpGlobalVars(
      accounts,
      (await web3.eth.getBlock("latest")).number,
      8000,
      [7000, 2500, 500],
      1000,
      10000,
      100,
      2500000,
      60 * 60 * 24 * 3
    );
    currentBlockNumber = (await web3.eth.getBlock("latest")).number;
    var staker = accounts[1];
    var staker2 = accounts[2];
    var staker3 = accounts[3];
    await stakingToken.approve(vault.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await stakingToken.approve(vault.address, web3.utils.toWei("1"), {
      from: staker2,
    });
    await stakingToken.mint(staker, web3.utils.toWei("1"));
    await stakingToken.mint(staker2, web3.utils.toWei("1"));

    //stake
    let tx = await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });
    assert.equal(tx.logs[3].event, "Deposit");
    assert.equal(tx.logs[3].args.sender, staker);
    assert.equal(tx.logs[3].args.owner, staker);
    assert.equal(tx.logs[3].args.assets.toString(), web3.utils.toWei("1"));
    assert.equal(tx.logs[3].args.shares.toString(), web3.utils.toWei("1"));

    assert.equal((await stakingToken.balanceOf(staker)).toString(), web3.utils.toWei("0"));
    assert.equal((await stakingToken.balanceOf(staker2)).toString(), web3.utils.toWei("1"));
    assert.equal((await vault.balanceOf(staker)).toString(), web3.utils.toWei("1"));
    assert.equal((await vault.balanceOf(staker2)).toString(), web3.utils.toWei("0"));

    await vault.withdrawRequest({ from: staker });
    //increase time for pending period
    await utils.increaseTime(7 * 24 * 3600);
    await advanceToNonSafetyPeriod();
    
    tx = await vault.transfer(staker2, web3.utils.toWei("1"), { from: staker });

    assert.equal(tx.logs[0].event, "Transfer");
    assert.equal(tx.logs[0].args.from, staker);
    assert.equal(tx.logs[0].args.to, staker2);
    assert.equal(tx.logs[0].args.value.toString(), web3.utils.toWei("1"));

    assert.equal((await stakingToken.balanceOf(staker)).toString(), web3.utils.toWei("0"));
    assert.equal((await stakingToken.balanceOf(staker2)).toString(), web3.utils.toWei("1"));
    assert.equal((await vault.balanceOf(staker)).toString(), web3.utils.toWei("0"));
    assert.equal((await vault.balanceOf(staker2)).toString(), web3.utils.toWei("1"));

    try {
      await vault.transfer(staker, web3.utils.toWei("1"), { from: staker2 });
      assert(false, "cannot transfer without making a withdraw request");
    } catch (ex) {
      assertVMException(ex, "RedeemMoreThanMax");
    }

    await vault.withdrawRequest({ from: staker2 });
    //increase time for pending period
    await utils.increaseTime(7 * 24 * 3600);

    await advanceToSafetyPeriod();
    try {
      await vault.transfer(staker, web3.utils.toWei("1"), { from: staker2 });
      assert(false, "cannot transfer on safety period");
    } catch (ex) {
      assertVMException(ex, "RedeemMoreThanMax");
    }

    await advanceToNonSafetyPeriod();

    await vault.withdrawRequest({ from: staker });

    try {
      await vault.transfer(staker, web3.utils.toWei("1"), { from: staker2 });
      assert(false, "cannot transfer to user with a withdraw request");
    } catch (ex) {
      assertVMException(ex, "CannotTransferToAnotherUserWithActiveWithdrawRequest");
    }

    await utils.increaseTime(parseInt((await hatVaultsRegistry.generalParameters()).withdrawRequestPendingPeriod.toString()));
    await utils.increaseTime(parseInt((await hatVaultsRegistry.generalParameters()).withdrawRequestEnablePeriod.toString()));
    await vault.withdrawRequest({ from: staker2 });
    //increase time for pending period
    await utils.increaseTime(parseInt((await hatVaultsRegistry.generalParameters()).withdrawRequestPendingPeriod.toString()));

    tx = await vault.transfer(staker, web3.utils.toWei("1"), { from: staker2 });

    assert.equal(tx.logs[0].event, "Transfer");
    assert.equal(tx.logs[0].args.from, staker2);
    assert.equal(tx.logs[0].args.to, staker);
    assert.equal(tx.logs[0].args.value.toString(), web3.utils.toWei("1"));
    assert.equal((await vault.balanceOf(staker2)).toString(), web3.utils.toWei("0"));
    assert.equal((await vault.balanceOf(staker)).toString(), web3.utils.toWei("1"));

    await advanceToSafetyPeriod();

    await vault.withdrawRequest({ from: staker });
    //increase time for pending period
    await utils.increaseTime(parseInt((await hatVaultsRegistry.generalParameters()).withdrawRequestPendingPeriod.toString()));

    tx = await claimsManager.submitClaim(
      accounts[2],
      8000,
      "description hash",
      {
        from: accounts[1],
      }
    );

    await advanceToNonSafetyPeriod();


    let claimId = tx.logs[0].args._claimId;

    await claimsManager.challengeClaim(claimId);
    await claimsManager.dismissClaim(claimId);

    await hatVaultsRegistry.setEmergencyPaused(true);
    await assertFunctionRaisesException(
      vault.transfer(staker3, web3.utils.toWei("1"), { from: staker }),
      "SystemInEmergencyPause"

    );

    await hatVaultsRegistry.setEmergencyPaused(false);

    tx = await vault.transfer(staker3, web3.utils.toWei("1"), { from: staker });
    assert.equal(tx.logs[0].event, "Transfer");
    assert.equal(tx.logs[0].args.from, staker);
    assert.equal(tx.logs[0].args.to, staker3);
    assert.equal(tx.logs[0].args.value.toString(), web3.utils.toWei("1"));
    assert.equal((await vault.balanceOf(staker)).toString(), web3.utils.toWei("0"));
    assert.equal((await vault.balanceOf(staker3)).toString(), web3.utils.toWei("1"));
  });

  it("transferFrom shares", async () => {
    await setUpGlobalVars(
      accounts,
      (await web3.eth.getBlock("latest")).number,
      8000,
      [7000, 2500, 500],
      1000,
      10000
    );
    currentBlockNumber = (await web3.eth.getBlock("latest")).number;
    var staker = accounts[1];
    var staker2 = accounts[2];
    await stakingToken.approve(vault.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await stakingToken.approve(vault.address, web3.utils.toWei("1"), {
      from: staker2,
    });
    await stakingToken.mint(staker, web3.utils.toWei("1"));
    await stakingToken.mint(staker2, web3.utils.toWei("1"));

    //stake
    let tx = await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });
    assert.equal(tx.logs[3].event, "Deposit");
    assert.equal(tx.logs[3].args.sender, staker);
    assert.equal(tx.logs[3].args.owner, staker);
    assert.equal(tx.logs[3].args.assets.toString(), web3.utils.toWei("1"));
    assert.equal(tx.logs[3].args.shares.toString(), web3.utils.toWei("1"));

    assert.equal((await stakingToken.balanceOf(staker)).toString(), web3.utils.toWei("0"));
    assert.equal((await stakingToken.balanceOf(staker2)).toString(), web3.utils.toWei("1"));
    assert.equal((await vault.balanceOf(staker)).toString(), web3.utils.toWei("1"));
    assert.equal((await vault.balanceOf(staker2)).toString(), web3.utils.toWei("0"));

    await vault.withdrawRequest({ from: staker });
    //increase time for pending period
    await utils.increaseTime(7 * 24 * 3600);
    await advanceToNonSafetyPeriod();
    
    try {
      await vault.transferFrom(staker, staker2, web3.utils.toWei("1"), { from: staker2 });
      assert(false, "insufficient allowance for transfer");
    } catch (ex) {
      assertVMException(ex, "ERC20: insufficient allowance");
    }

    try {
      await vault.transferFrom(staker, staker2, 0, { from: staker2 });
      assert(false, "transfer amount cannot be 0");
    } catch (ex) {
      assertVMException(ex, "AmountCannotBeZero");
    }

    try {
      await vault.transfer(staker, web3.utils.toWei("1"), { from: staker });
      assert(false, "cannot transfer to self");
    } catch (ex) {
      assertVMException(ex, "CannotTransferToSelf");
    }

    await vault.approve(staker2, web3.utils.toWei("1"), { from: staker });

    tx = await vault.transferFrom(staker, staker2, web3.utils.toWei("1"), { from: staker2 });

    assert.equal(tx.logs[1].event, "Transfer");
    assert.equal(tx.logs[1].args.from, staker);
    assert.equal(tx.logs[1].args.to, staker2);
    assert.equal(tx.logs[1].args.value.toString(), web3.utils.toWei("1"));

    assert.equal((await stakingToken.balanceOf(staker)).toString(), web3.utils.toWei("0"));
    assert.equal((await stakingToken.balanceOf(staker2)).toString(), web3.utils.toWei("1"));
    assert.equal((await vault.balanceOf(staker)).toString(), web3.utils.toWei("0"));
    assert.equal((await vault.balanceOf(staker2)).toString(), web3.utils.toWei("1"));
  });

  it("enable farming + 2xapprove+ exit", async () => {
    await setUpGlobalVars(accounts);
    var staker = accounts[4];
    await stakingToken.approve(vault.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await stakingToken.mint(staker, web3.utils.toWei("1"));
    //start farming
    //stake
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });
    await utils.increaseTime(7 * 24 * 3600);
    //exit
    assert.equal(await hatToken.balanceOf(staker), 0);
    await advanceToSafetyPeriod();
    let tx = await claimsManager.submitClaim(
      accounts[2],
      4000,
      "description hash",
      {
        from: accounts[1],
      }
    );

    let claimId = tx.logs[0].args._claimId;
    await utils.increaseTime(60 * 60 * 24);

    await claimsManager.approveClaim(claimId, 4000, ZERO_ADDRESS);
    await advanceToSafetyPeriod();
    tx = await claimsManager.submitClaim(accounts[2], 4000, "description hash", {
      from: accounts[1],
    });

    claimId = tx.logs[0].args._claimId;
    await utils.increaseTime(60 * 60 * 24);
    await claimsManager.approveClaim(claimId, 4000, ZERO_ADDRESS);

    await advanceToNonSafetyPeriod();

    let currentBlockNumber = (await web3.eth.getBlock("latest")).number;
    let lastRewardBlock = (await rewardController.vaultInfo(vault.address)).lastRewardBlock;
    let rewardPerShare = new web3.utils.BN(
      (await rewardController.vaultInfo(vault.address)).rewardPerShare
    );
    let onee12 = new web3.utils.BN("1000000000000");
    let stakeVaule = new web3.utils.BN(web3.utils.toWei("1"));

    let vaultReward = await rewardController.getRewardForBlocksRange(
      lastRewardBlock,
      currentBlockNumber + 1 + safeWithdrawBlocksIncrement,
      100,
      100
    );
    rewardPerShare = rewardPerShare.add(vaultReward.mul(onee12).div(stakeVaule));
    let expectedReward = stakeVaule.mul(rewardPerShare).div(onee12);
    await safeRedeem(vault, web3.utils.toWei("1"), staker);
    await rewardController.claimReward(vault.address, staker, { from: staker });
    assert.equal(
      (await stakingToken.balanceOf(staker)).toString(),
      "360000000000000000"
    ); //(0.6)*(0.6)

    let balanceOfStakerHats = await hatToken.balanceOf(staker);
    assert.equal(balanceOfStakerHats.toString(), expectedReward);
  });

  it("Update pool before start time", async () => {
    await setUpGlobalVars(accounts, (await web3.eth.getBlock("latest")).number + 10);
    assert.equal(await rewardController.getPendingReward(vault.address, accounts[0]), 0);
    await rewardController.updateVault(vault.address);
  });

  it("deposit + withdraw after time end (bdp bug)", async () => {
    await setUpGlobalVars(accounts, (await web3.eth.getBlock("latest")).number);
    var staker = accounts[1];
    let hatsAvailable = await hatToken.balanceOf(rewardController.address);
    await stakingToken.approve(vault.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await stakingToken.mint(staker, web3.utils.toWei("1"));
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });
    var timeToFinishRewardPlan =
      (await rewardController.epochLength()) *
      (await rewardController.NUMBER_OF_EPOCHS());
    await utils.increaseTime(timeToFinishRewardPlan);

    // TODO: Create new massUpdatePools
    // try {
    //   await rewardController.massUpdatePools(0, 2);
    //   assert(false, "massUpdatePools not in range");
    // } catch (ex) {
    //   assertVMException(ex, "InvalidPoolRange");
    // }
    // await rewardController.massUpdatePools(0, 1);
    tx = await rewardController.updateVault(vault.address);

    let globalUpdatesLen = await rewardController.getGlobalVaultsUpdatesLength();
    let rewardPerShare = new web3.utils.BN(
      (await rewardController.vaultInfo(vault.address)).rewardPerShare
    );

    assert.equal(tx.logs[0].event, "VaultUpdated");
    assert.equal(tx.logs[0].args._vault, vault.address);
    assert.equal(tx.logs[0].args._rewardPerShare.toString(), rewardPerShare.toString());
    assert.equal(tx.logs[0].args._lastProcessedVaultUpdate, globalUpdatesLen - 1);

    let expectedReward = await rewardController.getPendingReward(vault.address, staker);
    await safeRedeem(vault, web3.utils.toWei("1"), staker);
    tx = await rewardController.claimReward(vault.address, staker, { from: staker });

    //staker gets stake back
    assert.equal(await stakingToken.balanceOf(staker), web3.utils.toWei("1"));
    //and gets all rewards
    assert.equal(
      (await hatToken.balanceOf(staker)).toString(),
      tx.logs[2].args._amount.toString()
    );
    assert.isTrue(
      parseInt(tx.logs[2].args._amount.toString()) >=
        parseInt(expectedReward.toString())
    );
    assert.equal(
      hatsAvailable.toString(),
      (await hatToken.balanceOf(rewardController.address))
        .add(tx.logs[2].args._amount)
        .toString()
    );
  });

  it("hatpaymentsplitter predict bad splitter", async () => {
    let hatPaymentSplitterImplementation = await HATPaymentSplitter.new();
    let hatPaymentSplitterFactory = await HATPaymentSplitterFactory.new(hatPaymentSplitterImplementation.address);

    try {
      await hatPaymentSplitterFactory.predictSplitterAddress(
        [accounts[2], accounts[3]],
        [5000]
      );
      assert(false, "array length mismatch");
    } catch (ex) {
      assertVMException(ex, "ArrayLengthMismatch");
    }

    try {
      await hatPaymentSplitterFactory.predictSplitterAddress(
        [],
        []
      );
      assert(false, "no payees");
    } catch (ex) {
      assertVMException(ex, "NoPayees");
    }

    try {
      await hatPaymentSplitterFactory.predictSplitterAddress(
        [ZERO_ADDRESS],
        [5000]
      );
      assert(false, "zero address");
    } catch (ex) {
      assertVMException(ex, "ZeroAddress");
    }

    try {
      await hatPaymentSplitterFactory.predictSplitterAddress(
        [accounts[2]],
        [0]
      );
      assert(false, "zero shares");
    } catch (ex) {
      assertVMException(ex, "ZeroShares");
    }

    try {
      await hatPaymentSplitterFactory.predictSplitterAddress(
        [accounts[2], accounts[2]],
        [5000, 2000]
      );
      assert(false, "dulpicated payee");
    } catch (ex) {
      assertVMException(ex, "DuplicatedPayee");
    }
  });

  it("hatpaymentsplitter withdraw from tokenlock", async () => {
    await setUpGlobalVars(accounts, 0, 8000, [1000, 9000, 0], 0);
    var staker = accounts[4];
    await stakingToken.approve(vault.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await stakingToken.mint(staker, web3.utils.toWei("1"));
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });
    assert.equal(await hatToken.balanceOf(staker), 0);

    let hatPaymentSplitterImplementation = await HATPaymentSplitter.new();
    let hatPaymentSplitterFactory = await HATPaymentSplitterFactory.new(hatPaymentSplitterImplementation.address);

    let splitterAddress = await hatPaymentSplitterFactory.predictSplitterAddress(
      [accounts[2], accounts[3]],
      [5000, 5000]
    );

    let tx = await hatPaymentSplitterFactory.createHATPaymentSplitter(
      [accounts[2], accounts[3]],
      [5000, 5000]
    );

    assert.equal(tx.logs[0].event, "HATPaymentSplitterCreated");
    assert.equal(tx.logs[0].args._hatPaymentSplitter, splitterAddress);
    let hatPaymentSplitter = await HATPaymentSplitter.at(splitterAddress);

    try {
      await hatPaymentSplitter.initialize([accounts[2], accounts[3]], [5000, 5000]);
      tx = await hatPaymentSplitterFactory.createHATPaymentSplitter(
        [accounts[2], accounts[3]],
        [5000, 5000]
      );
      assert(false, "already exists");
    } catch (ex) {
      assertVMException(ex, "Initializable: contract is already initialized");
    }

    try {
      await hatPaymentSplitter.initialize([accounts[2], accounts[3]], [5000, 5000]);
      assert(false, "already initialized");
    } catch (ex) {
      assertVMException(ex, "Initializable: contract is already initialized");
    }

    await advanceToSafetyPeriod();
    tx = await claimsManager.submitClaim(
      hatPaymentSplitter.address,
      8000,
      "description hash",
      {
        from: accounts[1],
      }
    );

    let claimId = tx.logs[0].args._claimId;
    await utils.increaseTime(60 * 60 * 24);
    tx = await claimsManager.approveClaim(claimId, 8000, ZERO_ADDRESS);

    var vestingTokenLock = await HATTokenLock.at(tx.logs[1].args._tokenLock);

    await stakingToken.mint(vestingTokenLock.address, web3.utils.toWei("1"));

    await hatPaymentSplitter.withdrawSurplusFromTokenLock(vestingTokenLock.address, web3.utils.toWei("1"), { from: accounts[3] });

    assert.equal(
      (await stakingToken.balanceOf(hatPaymentSplitter.address)).toString(),
      new web3.utils.BN(web3.utils.toWei("1.72")).toString()
    );

    let accidentToken = await ERC20Mock.new("Accident", "ACT");
    await accidentToken.mint(vestingTokenLock.address, web3.utils.toWei("1"));

    await hatPaymentSplitter.sweepTokenFromTokenLock(vestingTokenLock.address, accidentToken.address, { from: accounts[2] });

    assert.equal(
      (await accidentToken.balanceOf(hatPaymentSplitter.address)).toString(),
      web3.utils.toWei("1").toString()
    );

    await utils.increaseTime(60 * 60 * 60 * 24 * 90);

    await hatPaymentSplitter.releaseFromTokenLock(vestingTokenLock.address, { from: accounts[2] });

    assert.equal((await stakingToken.balanceOf(hatPaymentSplitter.address)).toString(), web3.utils.toWei("1.8"));

    await hatPaymentSplitter.release(stakingToken.address, accounts[2]);
    await hatPaymentSplitter.release(stakingToken.address, accounts[3]);

    assert.equal(
      (await stakingToken.balanceOf(hatPaymentSplitter.address)).toString(),
      "0"
    );

    assert.equal(
      (await stakingToken.balanceOf(accounts[2])).toString(),
      new web3.utils.BN(web3.utils.toWei("0.9")).toString()
    );

    assert.equal(
      (await stakingToken.balanceOf(accounts[3])).toString(),
      new web3.utils.BN(web3.utils.toWei("0.9")).toString()
    );

    assert.equal(
      (await accidentToken.balanceOf(hatPaymentSplitter.address)).toString(),
      new web3.utils.BN(web3.utils.toWei("1")).toString()
    );

    await hatPaymentSplitter.release(accidentToken.address, accounts[2]);
    await hatPaymentSplitter.release(accidentToken.address, accounts[3]);

    assert.equal(
      (await accidentToken.balanceOf(hatPaymentSplitter.address)).toString(),
      "0"
    );

    assert.equal(
      (await accidentToken.balanceOf(accounts[3])).toString(),
      new web3.utils.BN(web3.utils.toWei("0.5")).toString()
    );

    assert.equal(
      (await accidentToken.balanceOf(accounts[3])).toString(),
      new web3.utils.BN(web3.utils.toWei("0.5")).toString()
    );
    
  });

  it("Update vault description", async () => {
    await setUpGlobalVars(accounts);
    assert.equal(await hatVaultsRegistry.isVaultVisible(vault.address), false);

    try {
      await hatVaultsRegistry.setVaultVisibility(vault.address, true, { from: accounts[1] });
      assert(false, "only gov");
    } catch (ex) {
      assertVMException(ex, "Ownable: caller is not the owner");
    }

    let tx = await hatVaultsRegistry.setVaultVisibility(vault.address, true);
    assert.equal(tx.logs[0].event, "SetVaultVisibility");
    assert.equal(tx.logs[0].args._visible, true);
    assert.equal(await hatVaultsRegistry.isVaultVisible(vault.address), true);

    try {
      await vault.setVaultDescription("_descriptionHash", { from: accounts[1] });
      assert(false, "only gov");
    } catch (ex) {
      assertVMException(ex, "OnlyRegistryOwner");
    }
    tx = await vault.setVaultDescription("_descriptionHash");
    assert.equal(tx.logs[0].event, "SetVaultDescription");
    assert.equal(tx.logs[0].args._descriptionHash, "_descriptionHash");
  });

  it("log claim", async () => {
    await setUpGlobalVars(accounts);
    let someHash = "0x00000000000000000000000000000000000001";
    let fee = web3.utils.toWei("1");
    var tx = await hatVaultsRegistry.logClaim(someHash, { from: accounts[3] });
    assert.equal(tx.logs[0].event, "LogClaim");
    assert.equal(tx.logs[0].args._descriptionHash, someHash);
    assert.equal(tx.logs[0].args._claimer, accounts[3]);

    try {
      await hatVaultsRegistry.setClaimFee(fee, { from: accounts[1] });
      assert(false, "only owner");
    } catch (ex) {
      assertVMException(ex, "Ownable: caller is not the owner");
    }

    tx = await hatVaultsRegistry.setClaimFee(fee);
    assert.equal(tx.logs[0].event, "SetClaimFee");
    assert.equal(tx.logs[0].args._fee, fee);
    var govBalanceBefore = new web3.utils.BN(
      await web3.eth.getBalance(accounts[0])
    );
    try {
      await hatVaultsRegistry.logClaim(someHash, {
        from: accounts[3],
        value: web3.utils.toWei("0.9"),
      });
      assert(false, "fee is not enough");
    } catch (ex) {
      assertVMException(ex, "NotEnoughFeePaid");
    }
    tx = await hatVaultsRegistry.logClaim(someHash, {
      from: accounts[3],
      value: web3.utils.toWei("1"),
    });
    var govBalanceAfter = new web3.utils.BN(
      await web3.eth.getBalance(accounts[0])
    );
    assert.equal(govBalanceAfter.sub(govBalanceBefore), fee);
    assert.equal(tx.logs[0].event, "LogClaim");
    assert.equal(tx.logs[0].args._descriptionHash, someHash);
    assert.equal(tx.logs[0].args._claimer, accounts[3]);
  });

  it("logClaim to revert on transfer fail", async () => {
    await setUpGlobalVars(accounts);
    let someHash = "0x00000000000000000000000000000000000001";
    let fee = web3.utils.toWei("1");

    await hatVaultsRegistry.setClaimFee(fee);

    var etherTransferFail = await EtherTransferFail.new();

    await hatVaultsRegistry.transferOwnership(etherTransferFail.address);
  
    try {
      await hatVaultsRegistry.logClaim(someHash, {
        from: accounts[3],
        value: fee,
      });
      assert(false, "fee transfer fail");
    } catch (ex) {
      assertVMException(ex, "ClaimFeeTransferFailed");
    }
  });

  it("revoke vesting", async () => {
    await setUpGlobalVars(
      accounts,
      0,
      8000,
      [7500, 2000, 500],
      2000,
      10,
      100,
      2500000,
      60 * 60 * 24,
      true
    );
    var staker = accounts[4];
    var staker2 = accounts[3];
    await stakingToken.approve(vault.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await stakingToken.approve(vault.address, web3.utils.toWei("1"), {
      from: staker2,
    });
    await stakingToken.mint(staker, web3.utils.toWei("1"));
    await stakingToken.mint(staker2, web3.utils.toWei("1"));

    //stake
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });
    assert.equal(await hatToken.balanceOf(staker), 0);
    await utils.increaseTime(7 * 24 * 3600);
    await advanceToSafetyPeriod();
    let tx = await claimsManager.submitClaim(
      accounts[2],
      8000,
      "description hash",
      {
        from: accounts[1],
      }
    );

    let claimId = tx.logs[0].args._claimId;
    await utils.increaseTime(60 * 60 * 24);
    tx = await claimsManager.approveClaim(claimId, 8000, ZERO_ADDRESS);
    assert.equal(tx.logs[1].event, "ApproveClaim");
    assert.equal(tx.logs[1].args._claimId, claimId);
    var vestingTokenLock = await HATTokenLock.at(tx.logs[1].args._tokenLock);

    assert.equal(await vestingTokenLock.beneficiary(), accounts[2]);
    var depositValutBNAfterClaim = new web3.utils.BN(web3.utils.toWei("0.8"));
    var expectedHackerBalance = depositValutBNAfterClaim
      .mul(new web3.utils.BN(6000))
      .div(new web3.utils.BN(10000));
    assert.isTrue(
      (await stakingToken.balanceOf(vestingTokenLock.address)).eq(
        expectedHackerBalance
      )
    );
    assert.isTrue(
      new web3.utils.BN(tx.logs[1].args._claimBounty.hackerVested).eq(
        expectedHackerBalance
      )
    );
    assert.isTrue(
      expectedHackerBalance.eq(await vestingTokenLock.managedAmount())
    );
    assert.equal(await vestingTokenLock.revocable(), true); //Enabled
    assert.equal(await vestingTokenLock.owner(), accounts[1]);
    assert.equal(await vestingTokenLock.canDelegate(), false);

    let hackerPreviousBalance = await stakingToken.balanceOf(accounts[2]);

    await utils.increaseTime(8640);
    await vestingTokenLock.release({ from: accounts[2] });
    assert.equal(
        (await stakingToken.balanceOf(accounts[2])).sub(hackerPreviousBalance).toString(),
        expectedHackerBalance.div(new web3.utils.BN(10)).toString()
    );

    const vestingTokenLockBalance = await stakingToken.balanceOf(vestingTokenLock.address);
    const committeePreviousBalance = await stakingToken.balanceOf(accounts[1]);
    hackerPreviousBalance = await stakingToken.balanceOf(accounts[2]);

    try {
      await vestingTokenLock.revoke();
      assert(false, "only committee can revoke");
    } catch (ex) {
      assertVMException(ex, "Ownable: caller is not the owner");
    }

    await vestingTokenLock.revoke({ from: accounts[1] });

    assert.equal(
      (await stakingToken.balanceOf(accounts[2])).toString(),
      hackerPreviousBalance.toString()
    );
    assert.equal(
      (await stakingToken.balanceOf(accounts[1])).sub(committeePreviousBalance).toString(),
      vestingTokenLockBalance.toString()
    );
    expect(await ethers.provider.getCode(vestingTokenLock.address)).to.equal("0x");
  });


  it("vesting", async () => {
    await setUpGlobalVars(accounts);
    var staker = accounts[4];
    var staker2 = accounts[3];
    await stakingToken.approve(vault.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await stakingToken.approve(vault.address, web3.utils.toWei("1"), {
      from: staker2,
    });
    await stakingToken.mint(staker, web3.utils.toWei("1"));
    await stakingToken.mint(staker2, web3.utils.toWei("1"));

    //stake
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });
    assert.equal(await hatToken.balanceOf(staker), 0);
    await utils.increaseTime(7 * 24 * 3600);
    await advanceToSafetyPeriod();
    let tx = await claimsManager.submitClaim(
      accounts[2],
      8000,
      "description hash",
      {
        from: accounts[1],
      }
    );

    let claimId = tx.logs[0].args._claimId;
    await utils.increaseTime(60 * 60 * 24);
    tx = await claimsManager.approveClaim(claimId, 8000, ZERO_ADDRESS);
    assert.equal(tx.logs[1].event, "ApproveClaim");
    assert.equal(tx.logs[1].args._claimId, claimId);
    var vestingTokenLock = await HATTokenLock.at(tx.logs[1].args._tokenLock);

    assert.equal(await vestingTokenLock.beneficiary(), accounts[2]);
    var depositValutBNAfterClaim = new web3.utils.BN(web3.utils.toWei("0.8"));
    var expectedHackerBalance = depositValutBNAfterClaim
      .mul(new web3.utils.BN(6000))
      .div(new web3.utils.BN(10000));
    assert.isTrue(
      (await stakingToken.balanceOf(vestingTokenLock.address)).eq(
        expectedHackerBalance
      )
    );
    assert.isTrue(
      new web3.utils.BN(tx.logs[1].args._claimBounty.hackerVested).eq(
        expectedHackerBalance
      )
    );
    assert.isTrue(
      expectedHackerBalance.eq(await vestingTokenLock.managedAmount())
    );
    assert.equal(await vestingTokenLock.revocable(), false); //Disable
    assert.equal(await vestingTokenLock.owner(), "0x0000000000000000000000000000000000000000");
    assert.equal(await vestingTokenLock.canDelegate(), false);

    //hacker get also rewards via none vesting
    var hackerPreviousBalance = await stakingToken.balanceOf(accounts[2]);

    try {
      await vestingTokenLock.delegate(accounts[4]);
      assert(false, "cannot delegate");
    } catch (ex) {
      assertVMException(ex);
    }

    try {
      await vestingTokenLock.revoke();
      assert(false, "cannot revoke");
    } catch (ex) {
      assertVMException(ex);
    }
    try {
      await vestingTokenLock.withdrawSurplus(1);
      assert(false, "no surplus");
    } catch (ex) {
      assertVMException(ex);
    }
    try {
      await vestingTokenLock.release();
      assert(false, "only beneficiary can release");
    } catch (ex) {
      assertVMException(ex);
    }

    try {
      await vestingTokenLock.release({ from: accounts[2] });
      assert(false, "cannot release before first period");
    } catch (ex) {
      assertVMException(ex);
    }
    await utils.increaseTime(8640);
    await vestingTokenLock.release({ from: accounts[2] });
    assert.equal(
        (await stakingToken.balanceOf(accounts[2])).sub(hackerPreviousBalance).toString(),
        expectedHackerBalance.div(new web3.utils.BN(10)).toString()
    );

    await utils.increaseTime(8640 * 9);
    await vestingTokenLock.release({ from: accounts[2] });
    assert.equal(
      (await stakingToken.balanceOf(accounts[2])).sub(hackerPreviousBalance).toString(),
      expectedHackerBalance.toString()
    );
    expect(await ethers.provider.getCode(vestingTokenLock.address)).to.equal("0x");
  });

  it("no vesting", async () => {
    await setUpGlobalVars(accounts, 0, 8000, [0, 10000, 0], 0);

    var staker = accounts[4];
    await stakingToken.approve(vault.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await stakingToken.mint(staker, web3.utils.toWei("1"));

    //stake
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });
    await utils.increaseTime(7 * 24 * 3600);
    await advanceToSafetyPeriod();
    let tx = await claimsManager.submitClaim(
      accounts[2],
      8000,
      "description hash",
      {
        from: accounts[1],
      }
    );

    let claimId = tx.logs[0].args._claimId;
    await utils.increaseTime(60 * 60 * 24);
    tx = await claimsManager.approveClaim(claimId, 8000, ZERO_ADDRESS);

    assert.equal(tx.logs[0].event, "ApproveClaim");
    assert.equal(tx.logs[0].args._claimId, claimId);
    assert.equal(tx.logs[0].args._tokenLock, utils.NULL_ADDRESS);
    assert.equal(
      await stakingToken.balanceOf(vault.address),
      web3.utils.toWei("0.2")
    );
    assert.equal(
      await stakingToken.balanceOf(accounts[2]),
      web3.utils.toWei("0.8")
    );
  });

  it("set vesting params", async () => {
    await setUpGlobalVars(accounts);
    assert.equal(await claimsManager.vestingDuration(), 86400);
    assert.equal(await claimsManager.vestingPeriods(), 10);

    try {
      await claimsManager.setVestingParams(21000, 7, { from: accounts[2] });
      assert(false, "only gov can set vesting params");
    } catch (ex) {
      assertVMException(ex, "Ownable: caller is not the owner");
    }
    try {
      await claimsManager.setVestingParams(21000, 0);
      assert(false, "period should not be zero");
    } catch (ex) {
      assertVMException(ex, "VestingPeriodsCannotBeZero");
    }
    try {
      await claimsManager.setVestingParams(120 * 24 * 3600 + 1, 7);
      assert(false, "duration should be less than or equal to 120 days");
    } catch (ex) {
      assertVMException(ex, "VestingDurationTooLong");
    }
    try {
      await claimsManager.setVestingParams(6, 7);
      assert(false, "duration should be greater than or equal to period");
    } catch (ex) {
      assertVMException(ex, "VestingDurationSmallerThanPeriods");
    }
    var tx = await claimsManager.setVestingParams(21000, 7);
    assert.equal(tx.logs[0].event, "SetVestingParams");
    assert.equal(tx.logs[0].args._duration, 21000);
    assert.equal(tx.logs[0].args._periods, 7);

    assert.equal(await claimsManager.vestingDuration(), 21000);
    assert.equal(await claimsManager.vestingPeriods(), 7);
  });

  it("set hat vesting params", async () => {
    await setUpGlobalVars(accounts);
    assert.equal(
      (await hatVaultsRegistry.generalParameters()).hatVestingDuration,
      90 * 3600 * 24
    );
    assert.equal((await hatVaultsRegistry.generalParameters()).hatVestingPeriods, 90);

    try {
      await hatVaultsRegistry.setHatVestingParams(21000, 7, { from: accounts[2] });
      assert(false, "only gov can set vesting params");
    } catch (ex) {
      assertVMException(ex, "Ownable: caller is not the owner");
    }
    try {
      await hatVaultsRegistry.setHatVestingParams(21000, 0);
      assert(false, "period should not be zero");
    } catch (ex) {
      assertVMException(ex, "HatVestingPeriodsCannotBeZero");
    }
    try {
      await hatVaultsRegistry.setHatVestingParams(180 * 24 * 3600, 7);
      assert(false, "duration should be less than 180 days");
    } catch (ex) {
      assertVMException(ex, "HatVestingDurationTooLong");
    }
    try {
      await hatVaultsRegistry.setHatVestingParams(6, 7);
      assert(false, "duration should be greater than or equal to period");
    } catch (ex) {
      assertVMException(ex, "HatVestingDurationSmallerThanPeriods");
    }
    var tx = await hatVaultsRegistry.setHatVestingParams(21000, 7);
    assert.equal(tx.logs[0].event, "SetHatVestingParams");
    assert.equal(tx.logs[0].args._duration, 21000);
    assert.equal(tx.logs[0].args._periods, 7);

    assert.equal(
      (await hatVaultsRegistry.generalParameters()).hatVestingDuration,
      21000
    );
    assert.equal((await hatVaultsRegistry.generalParameters()).hatVestingPeriods, 7);
  });

  it("unSafeWithdraw", async () => {
    await setUpGlobalVars(accounts);
    var staker = accounts[1];

    await stakingToken.approve(vault.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await stakingToken.mint(staker, web3.utils.toWei("1"));

    //stake
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });
    try {
      await unsafeRedeem(vault, web3.utils.toWei("1"), staker);
      assert(false, "cannot redeem on safety period");
    } catch (ex) {
      assertVMException(ex, "RedeemMoreThanMax");
    }

    try {
      await unsafeWithdraw(vault, web3.utils.toWei("1"), staker);
      assert(false, "cannot withdraw on safety period");
    } catch (ex) {
      assertVMException(ex, "RedeemMoreThanMax");
    }

    await advanceToSafetyPeriod();

    try {
      await vault.methods["withdraw(uint256,address,address)"](web3.utils.toWei("1"), staker, staker, { from: staker });
      assert(false, "cannot withdraw on safety period");
    } catch (ex) {
      assertVMException(ex, "RedeemMoreThanMax");
    }
  });

  it("createVault with zero alloc point", async () => {
    await setUpGlobalVars(accounts, (await web3.eth.getBlock("latest")).number);
    var staker = accounts[1];
    let stakingToken2 = await ERC20Mock.new("Staking", "STK");
    let tx = await hatVaultsRegistry.createVault(
      {
        asset: stakingToken2.address,
        name: "VAULT",
        symbol: "VLT",
        rewardControllers: [rewardController.address],
        owner: await hatVaultsRegistry.owner(),
        isPaused: false,
        descriptionHash: "_descriptionHash",
      },
      {
      owner: await hatVaultsRegistry.owner(),
      committee: accounts[0],
      arbitrator: "0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF",
      arbitratorCanChangeBounty: true,
      arbitratorCanChangeBeneficiary: false,
      arbitratorCanSubmitIssues: false,
      isTokenLockRevocable: false,
      maxBounty: 8000,
      bountySplit: [7000, 2500, 500],
      governanceFee: 65535,
      vestingDuration: 86400,
      vestingPeriods: 10
      }
    );

    let newVault = await HATVault.at(tx.logs[2].args._vault);
    let newClaimsManager = await HATClaimsManager.at(tx.logs[2].args._claimsManager);

    await hatVaultsRegistry.setVaultVisibility(newVault.address, true);
    await rewardController.setAllocPoint(newVault.address, 200);
    await hatVaultsRegistry.setVaultVisibility(newVault.address, true);
    await rewardController.setAllocPoint(newVault.address, 0);
    await stakingToken2.approve(newVault.address, web3.utils.toWei("2"), {
      from: staker,
    });
    await stakingToken2.mint(staker, web3.utils.toWei("2"));
    await newClaimsManager.committeeCheckIn({ from: accounts[0] });
    await newVault.deposit(web3.utils.toWei("1"), staker, { from: staker });
    assert.equal(
      Math.round(
        web3.utils.fromWei(await hatToken.balanceOf(rewardController.address))
      ),
      rewardControllerExpectedHatsBalance
    );
    await rewardController.updateVault(newVault.address);
    assert.equal(
      Math.round(
        web3.utils.fromWei(await hatToken.balanceOf(rewardController.address))
      ),
      rewardControllerExpectedHatsBalance
    );
  });
  
  it("createVault with no reward controller", async () => {
    await setUpGlobalVars(accounts, (await web3.eth.getBlock("latest")).number);
    var staker = accounts[1];
    let stakingToken2 = await ERC20Mock.new("Staking", "STK");
    let tx = await hatVaultsRegistry.createVault(
      {
        asset: stakingToken2.address,
        name: "VAULT",
        symbol: "VLT",
        rewardControllers: [rewardController.address],
        owner: await hatVaultsRegistry.owner(),
        isPaused: false,
        descriptionHash: "_descriptionHash",
      },
      {
      owner: await hatVaultsRegistry.owner(),
      committee: accounts[0],
      arbitrator: "0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF",
      arbitratorCanChangeBounty: true,
      arbitratorCanChangeBeneficiary: false,
      arbitratorCanSubmitIssues: false,
      isTokenLockRevocable: false,
      maxBounty: 8000,
      bountySplit: [7000, 2500, 500],
      governanceFee: 65535,
      vestingDuration: 86400,
      vestingPeriods: 10
      }
    );

    let newVault = await HATVault.at(tx.logs[2].args._vault);
    let newClaimsManager = await HATClaimsManager.at(tx.logs[2].args._claimsManager);

    await hatVaultsRegistry.setVaultVisibility(newVault.address, true);
    await stakingToken2.approve(newVault.address, web3.utils.toWei("2"), {
      from: staker,
    });
    await stakingToken2.mint(staker, web3.utils.toWei("2"));
    await newClaimsManager.committeeCheckIn({ from: accounts[0] });
    await newVault.deposit(web3.utils.toWei("2"), staker, { from: staker });
    assert.equal((await newVault.balanceOf(staker)).toString(), web3.utils.toWei("2"));
    await newVault.withdrawRequest({ from: staker });

    await utils.increaseTime(7 * 24 * 3600);
    await advanceToNonSafetyPeriod();
    await newVault.methods["withdraw(uint256,address,address)"](web3.utils.toWei("1"), staker, staker, {
      from: staker,
    });
    assert.equal((await newVault.balanceOf(staker)).toString(), web3.utils.toWei("1"));
  });

  it("create vault x2 v2", async () => {
    await setUpGlobalVars(
      accounts,
      (await web3.eth.getBlock("latest")).number,
      8000,
      [7000, 2500, 500],
      1000,
      10000
    );

    var staker = accounts[1];
    await stakingToken.approve(vault.address, web3.utils.toWei("2"), {
      from: staker,
    });
    await stakingToken.mint(staker, web3.utils.toWei("2"));
    let stakingToken2 = await ERC20Mock.new("Staking", "STK");

    try {
      await hatVaultsRegistry.createVault(
        {
          asset: stakingToken2.address,
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
        isTokenLockRevocable: false,
        maxBounty: 8000,
        bountySplit: [7000, 2500, 500],
        governanceFee: 65535,
        vestingDuration: 10,
        vestingPeriods: 86400
        }
      );
      assert(false, "vesting duration smaller than period");
    } catch (ex) {
      assertVMException(ex, "VestingDurationSmallerThanPeriods");
    }

    try {
      await hatVaultsRegistry.createVault(
        {
          asset: stakingToken2.address,
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
        isTokenLockRevocable: false,
        maxBounty: 8000,
        bountySplit: [7000, 2500, 500],
        governanceFee: 65535,
        vestingDuration: 121 * 24 * 3600,
        vestingPeriods: 10
        }
      );
      assert(false, "vesting duration is too long");
    } catch (ex) {
      assertVMException(ex, "VestingDurationTooLong");
    }

    try {
      await hatVaultsRegistry.createVault(
        {
          asset: stakingToken2.address,
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
        isTokenLockRevocable: false,
        maxBounty: 8000,
        bountySplit: [7000, 2500, 500],
        governanceFee: 65535,
        vestingDuration: 86400,
        vestingPeriods: 0
        }
      );
      assert(false, "vesting period cannot be zero");
    } catch (ex) {
      assertVMException(ex, "VestingPeriodsCannotBeZero");
    }
    let tx = await hatVaultsRegistry.createVault(
      {
        asset: stakingToken2.address,
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
      isTokenLockRevocable: false,
      maxBounty: 8000,
      bountySplit: [7000, 2500, 500],
      governanceFee: 65535,
      vestingDuration: 86400,
      vestingPeriods: 10
      }
    );

    let newVault = await HATVault.at(tx.logs[2].args._vault);
    let newClaimsManager = await HATClaimsManager.at(tx.logs[2].args._claimsManager);

    await rewardController.setAllocPoint(
      newVault.address,
      100
    );

    await newClaimsManager.setCommittee(accounts[0], { from: accounts[1] });
    await stakingToken2.approve(newVault.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await stakingToken2.mint(staker, web3.utils.toWei("1"));

    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });
    await newClaimsManager.committeeCheckIn({ from: accounts[0] });
    await newVault.deposit(web3.utils.toWei("1"), staker, { from: staker });

    await hatVaultsRegistry.setVaultVisibility(vault.address, true);
    await rewardController.setAllocPoint(vault.address, 200);

    await rewardController.updateVault(vault.address);
    await rewardController.updateVault(newVault.address);
    assert.equal(
      Math.round(
        web3.utils.fromWei(await hatToken.balanceOf(rewardController.address))
      ),
      rewardControllerExpectedHatsBalance
    );
  });

  it("update vault before setting reward controller alloc points", async () => {
    let hatToken1 = await HATTokenMock.new(accounts[0]);
    var tokenLock1 = await HATTokenLock.new();
    let tokenLockFactory1 = await TokenLockFactory.new(tokenLock1.address, accounts[0]);
    var vaultsManager = await VaultsManagerMock.new();
    let deployment = await deployHATVaults({
      governance: vaultsManager.address,
      arbitrator: vaultsManager.address,
      hatToken: hatToken1.address,
      tokenLockFactory: tokenLockFactory1.address,
      rewardControllersConf: [{
        startBlock: 1,
        epochLength: 10,
        epochRewardPerBlock
      }],
      hatVaultsRegistryConf: {
        governanceFee: 1000
      },
      silent: true
    });

    hatVaultsRegistry1 = await HATVaultsRegistry.at(deployment.hatVaultsRegistry.address);
    rewardController1 = await RewardController.at(
      deployment.rewardControllers[0].address
    );
    var globalVaultsUpdatesLength = await rewardController1.getGlobalVaultsUpdatesLength();
    assert.equal(globalVaultsUpdatesLength, 0);
    let stakingToken2 = await ERC20Mock.new("Staking", "STK");
    const tx = await hatVaultsRegistry1.createVault(
      {
        asset: stakingToken2.address,
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
      isTokenLockRevocable: false,
      maxBounty: 8000,
      bountySplit: [8400, 1500, 100],
      governanceFee: 65535,
      vestingDuration: 86400,
      vestingPeriods: 10
      }
    );

    let vault1 = await HATVault.at(tx.logs[2].args._vault);

    await rewardController1.updateVault(vault1.address);
    await rewardController1.updateVault(vault1.address);

    globalVaultsUpdatesLength = await rewardController1.getGlobalVaultsUpdatesLength();
    assert.equal(globalVaultsUpdatesLength, 0);
  });

  it("add/set vault on the same block", async () => {
    let hatToken1 = await HATTokenMock.new(accounts[0]);
    var tokenLock1 = await HATTokenLock.new();
    let tokenLockFactory1 = await TokenLockFactory.new(tokenLock1.address, accounts[0]);
    var vaultsManager = await VaultsManagerMock.new();
    let deployment = await deployHATVaults({
      governance: vaultsManager.address,
      arbitrator: vaultsManager.address,
      hatToken: hatToken1.address,
      tokenLockFactory: tokenLockFactory1.address,
      rewardControllersConf: [{
        startBlock: 1,
        epochLength: 10,
        epochRewardPerBlock
      }],
      hatVaultsRegistryConf: {
        governanceFee: 1000
      },
      silent: true
    });

    hatVaultsRegistry1 = await HATVaultsRegistry.at(deployment.hatVaultsRegistry.address);
    rewardController1 = await RewardController.at(
      deployment.rewardControllers[0].address
    );
    let stakingToken2 = await ERC20Mock.new("Staking", "STK");
    let stakingToken3 = await ERC20Mock.new("Staking", "STK");
    var globalVaultsUpdatesLength = await rewardController1.getGlobalVaultsUpdatesLength();
    assert.equal(globalVaultsUpdatesLength, 0);
    await vaultsManager.createVaults(
      hatVaultsRegistry1.address,
      rewardController1.address,
      100,
      [stakingToken2.address, stakingToken3.address],
      accounts[1],
      8000,
      [7000, 2500, 500],
      "_descriptionHash",
    );
    
    let newVault1 = await HATVault.at(await hatVaultsRegistry1.hatVaults(0));
    let newVault2 = await HATVault.at(await hatVaultsRegistry1.hatVaults(1));
    globalVaultsUpdatesLength = await rewardController1.getGlobalVaultsUpdatesLength();
    assert.equal(globalVaultsUpdatesLength, 1); //2 got in the same block
    assert.equal(await hatVaultsRegistry1.getNumberOfVaults(), 2);
    await vaultsManager.setVaultsAllocPoint(
      [newVault1.address, newVault2.address],
      rewardController1.address,
      200
    );

    globalVaultsUpdatesLength = await rewardController1.getGlobalVaultsUpdatesLength();
    assert.equal(globalVaultsUpdatesLength, 2); //2 got in the same block
    let globalUpdatesLen = await rewardController1.getGlobalVaultsUpdatesLength();
    let totalAllocPoint = (
      await rewardController1.globalVaultsUpdates(globalUpdatesLen - 1)
    ).totalAllocPoint;
    assert.equal(totalAllocPoint.toString(), 400); //2 got in the same block
  });

  it("stop in the middle", async () => {
    await setUpGlobalVars(
      accounts,
      (await web3.eth.getBlock("latest")).number,
      8000,
      [7000, 2500, 500],
      1000,
      10,
      100,
      88260
    );

    var staker = accounts[1];

    await stakingToken.approve(vault.address, web3.utils.toWei("2"), {
      from: staker,
    });
    await stakingToken.mint(staker, web3.utils.toWei("2"));
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });
    await utils.mineBlock(1);
    await rewardController.updateVault(vault.address);
    assert.equal(
      (await hatToken.balanceOf(staker)).toString(),
      web3.utils.toWei("0").toString()
    );
    let hatTotalSupply = await hatToken.totalSupply();
    let hatTokenCap = await hatToken.cap();
    let amountToMint = hatTokenCap.sub(hatTotalSupply);
    await hatToken.setMinter(accounts[0], amountToMint);
    await hatToken.mint(accounts[0], amountToMint);
    await hatToken.transfer(rewardController.address, amountToMint);

    await safeRedeem(vault, web3.utils.toWei("1"), staker);
    tx = await rewardController.claimReward(vault.address, staker, { from: staker });
    assert.equal(await stakingToken.balanceOf(staker), web3.utils.toWei("2"));
    let userHatRewards = tx.logs[2].args._amount;
    assert.equal(
      userHatRewards.toString(),
      (await hatToken.balanceOf(staker)).toString()
    );

    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });
    await utils.mineBlock(1);
    await safeRedeem(vault, web3.utils.toWei("1"), staker);
    tx = await rewardController.claimReward(vault.address, staker, { from: staker });
    userHatRewards = userHatRewards.add(tx.logs[2].args._amount);
    assert.equal(
      userHatRewards.toString(),
      (await hatToken.balanceOf(staker)).toString()
    );
  });

  it("check deep alloc history", async () => {
    await setUpGlobalVars(
      accounts,
      (await web3.eth.getBlock("latest")).number,
      8000,
      [7000, 2500, 500],
      1000,
      10000
    );

    var staker = accounts[1];
    await stakingToken.approve(vault.address, web3.utils.toWei("2"), {
      from: staker,
    });
    await stakingToken.mint(staker, web3.utils.toWei("2"));
    let stakingToken2 = await ERC20Mock.new("Staking", "STK");
    await stakingToken2.approve(vault.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await stakingToken2.mint(staker, web3.utils.toWei("1"));
    let depositTx = await vault.deposit(web3.utils.toWei("1"), staker, {
      from: staker,
    });
    //10
    tx = await hatVaultsRegistry.createVault(
      {
        asset: stakingToken2.address,
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
      isTokenLockRevocable: false,
      maxBounty: 8000,
      bountySplit: [7000, 2500, 500],
      governanceFee: 65535,
      vestingDuration: 86400,
      vestingPeriods: 10
      }
    );

    let newVault = await HATVault.at(tx.logs[2].args._vault);
    let newClaimsManager = await HATClaimsManager.at(tx.logs[2].args._claimsManager);

    let tx2 = await rewardController.setAllocPoint(
      newVault.address,
      100
    );

    assert.equal(tx2.logs[0].event, "SetAllocPoint");
    assert.equal(tx2.logs[0].args._vault, newVault.address);
    assert.equal(tx2.logs[0].args._prevAllocPoint, 0);
    assert.equal(tx2.logs[0].args._allocPoint, 100);

    //5
    await newClaimsManager.setCommittee(accounts[0], { from: accounts[1] });
    //5
    await hatVaultsRegistry.setVaultVisibility(newVault.address, true);
    await rewardController.setAllocPoint(newVault.address, 300);
    //2.5
    assert.equal((await hatToken.balanceOf(staker)).toString(), 0);
    assert.equal(await rewardController.getGlobalVaultsUpdatesLength(), 3);
    assert.equal(
      (await rewardController.vaultInfo(vault.address)).lastRewardBlock,
      depositTx.receipt.blockNumber
    );
    await rewardController.claimReward(vault.address, staker, { from: staker });
    assert.equal(
      (await hatToken.balanceOf(staker)).toString(),
      await web3.utils.toWei("1654.875").toString()
    );
  });

  it("deposit twice on the same block", async () => {
    await setUpGlobalVars(accounts);
    var vaultsManagerMock = await VaultsManagerMock.new();
    await stakingToken.mint(vaultsManagerMock.address, web3.utils.toWei("2"));
    await vaultsManagerMock.depositTwice(
      vault.address,
      stakingToken.address,
      web3.utils.toWei("1")
    );
    assert.equal(
      (await hatToken.balanceOf(vaultsManagerMock.address)).toString(),
      0
    );
  });

  it("set pending bounty level delay", async () => {
    await setUpGlobalVars(accounts);
    try {
      await hatVaultsRegistry.setMaxBountyDelay(24 * 3600 * 2, {
        from: accounts[1],
      });
      assert(false, "only gov");
    } catch (ex) {
      assertVMException(ex, "Ownable: caller is not the owner");
    }

    try {
      await hatVaultsRegistry.setMaxBountyDelay(100, { from: accounts[0] });
      assert(false, "too small");
    } catch (ex) {
      assertVMException(ex, "DelayTooShort");
    }
    assert.equal(
      (await hatVaultsRegistry.generalParameters()).setMaxBountyDelay,
      24 * 3600 * 2
    );
    var tx = await hatVaultsRegistry.setMaxBountyDelay(24 * 3600 * 100, {
      from: accounts[0],
    });
    assert.equal(tx.logs[0].event, "SetMaxBountyDelay");
    assert.equal(tx.logs[0].args._delay, 24 * 3600 * 100);
    assert.equal(
      (await hatVaultsRegistry.generalParameters()).setMaxBountyDelay,
      24 * 3600 * 100
    );
  });

  it("set governance fee receiver", async () => {
    await setUpGlobalVars(accounts);
    try {
      await hatVaultsRegistry.setGovernanceFeeReceiver(accounts[2], {
        from: accounts[1],
      });
      assert(false, "only gov");
    } catch (ex) {
      assertVMException(ex, "Ownable: caller is not the owner");
    }

    assert.equal(
      await hatVaultsRegistry.governanceFeeReceiver(),
      accounts[0]
    );
    var tx = await hatVaultsRegistry.setGovernanceFeeReceiver(accounts[2], {
      from: accounts[0],
    });
    assert.equal(tx.logs[0].event, "SetGovernanceFeeReceiver");
    assert.equal(tx.logs[0].args._governaceFeeReceiver, accounts[2]);
    assert.equal(
      await hatVaultsRegistry.governanceFeeReceiver(),
      accounts[2]
    );
  });

  it("withdraw+ deposit + addition HAT ", async () => {
    await setUpGlobalVars(accounts, (await web3.eth.getBlock("latest")).number);
    var staker = accounts[1];
    var staker2 = accounts[5];
    let tx = await hatVaultsRegistry.createVault(
      {
        asset: hatToken.address,
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
      isTokenLockRevocable: false,
      maxBounty: 8000,
      bountySplit: [7000, 2500, 500],
      governanceFee: 65535,
      vestingDuration: 86400,
      vestingPeriods: 10
      }
    );

    let newVault = await HATVault.at(tx.logs[2].args._vault);
    let newClaimsManager = await HATClaimsManager.at(tx.logs[2].args._claimsManager);

    await rewardController.setAllocPoint(
      newVault.address,
      100
    );

    await hatToken.setMinter(accounts[0], web3.utils.toWei("110"));
    await newClaimsManager.committeeCheckIn({ from: accounts[1] });

    await hatToken.approve(newVault.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await hatToken.approve(newVault.address, web3.utils.toWei("2"), {
      from: staker2,
    });

    await hatToken.mint(staker, web3.utils.toWei("1"));
    await hatToken.mint(staker2, web3.utils.toWei("2"));

    assert.equal(await hatToken.balanceOf(staker), web3.utils.toWei("1"));
    assert.equal(
      await hatToken.balanceOf(newVault.address),
      0
    );
    await newVault.deposit(web3.utils.toWei("1"), staker, { from: staker });
    await newVault.deposit(web3.utils.toWei("2"), staker2, { from: staker2 });
    await utils.increaseTime(7 * 24 * 3600);
    await advanceToNonSafetyPeriod();

    await newVault.withdrawRequest({ from: staker });
    assert.equal(
      await newVault.withdrawEnableStartTime(staker),
      (await web3.eth.getBlock("latest")).timestamp + 7 * 24 * 3600
    );
    await newVault.withdrawRequest({ from: staker2 });

    await utils.increaseTime(7 * 24 * 3600);
    await hatToken.mint(newVault.address, web3.utils.toWei("100"));
    assert.equal((await hatToken.balanceOf(staker)).toString(), 0);
    await advanceToNonSafetyPeriod();
    tx = await newVault.methods["withdraw(uint256,address,address)"](web3.utils.toWei("1"), staker, staker, {
      from: staker,
    });
    assert.equal((await newVault.balanceOf(staker)).toString(), web3.utils.toWei("0.97087378640776699"));
    tx = await rewardController.claimReward(newVault.address, staker, { from: staker });
    assert.equal(
      (await hatToken.balanceOf(staker)).sub(tx.logs[2].args._amount).toString(),
      web3.utils.toWei("1")
    );
    await newVault.methods["redeem(uint256,address,address)"](web3.utils.toWei("2"), staker2, staker2, { from: staker2 });
    tx = await rewardController.claimReward(newVault.address, staker, { from: staker });
    assert.equal(
      (await hatToken.balanceOf(staker2))
        .toString(),
      web3.utils.toWei("68.666666666666666673")
    );
  });

  it("transferReward to fail if not enough reward tokens", async () => {
    await setUpGlobalVars(
      accounts,
      (await web3.eth.getBlock("latest")).number,
      8000,
      undefined,
      undefined,
      undefined,
      undefined,
      1
    );
    var staker = accounts[4];
    await stakingToken.approve(vault.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await stakingToken.mint(staker, web3.utils.toWei("1"));
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });
    await rewardController.updateVault(vault.address);
    let hatsAvailable = await hatToken.balanceOf(rewardController.address);
    let expectedReward = await calculateExpectedReward(staker, 3);
    assert.isTrue(
      parseInt(hatsAvailable.toString()) < parseInt(expectedReward.toString())
    );

    try {
      await rewardController.claimReward(vault.address, staker, { from: staker });
      assert(false, "can't claim reward when there are not enough rewards");
    } catch (ex) {
      assertVMException(ex, "ERC20: transfer amount exceeds balance");
    }

    await hatToken.setMinter(accounts[0], expectedReward);
    await hatToken.mint(rewardController.address, expectedReward);
    let tx = await rewardController.claimReward(vault.address, staker, { from: staker });
    assert.equal(tx.logs[2].event, "ClaimReward");
    assert.equal(tx.logs[2].args._amount.toString(), expectedReward.toString());
    assert.equal(tx.logs[2].args._user, staker);
    assert.equal(tx.logs[2].args._vault, vault.address);
    assert.isFalse(tx.logs[2].args._amount.eq(0));
  });

  it("minimum amount of shares must be at least MINIMAL_AMOUNT_OF_SHARES", async () => {
    await setUpGlobalVars(accounts);
    const staker = accounts[1];
    await stakingToken.mint(staker, "10000000");
    await stakingToken.approve(vault.address, "10000000", { from: staker});
    // 1e6 is the minimum deposit
    await assertFunctionRaisesException(vault.deposit("1", staker, { from: staker }), "AmountOfSharesMustBeMoreThanMinimalAmount");
    await assertFunctionRaisesException(vault.deposit((MINIMAL_AMOUNT_OF_SHARES-1), staker, { from: staker }), "AmountOfSharesMustBeMoreThanMinimalAmount");
    await vault.deposit(MINIMAL_AMOUNT_OF_SHARES, staker, { from: staker });

    assert.equal((await stakingToken.balanceOf(vault.address)).toString(), MINIMAL_AMOUNT_OF_SHARES);

    // redeem all the remaining tokens except 1
    await assertFunctionRaisesException(safeRedeem(vault, MINIMAL_AMOUNT_OF_SHARES-1, staker), "AmountOfSharesMustBeMoreThanMinimalAmount");
    await safeRedeem(vault, MINIMAL_AMOUNT_OF_SHARES, staker);
    assert.equal((await stakingToken.balanceOf(vault.address)).toString(), "0");
    assert.equal((await vault.totalSupply()).toString(), "0");

  });

  it("minimum amount of shares must be at least MINIMAL_AMOUNT_OF_SHARES", async () => {
    await setUpGlobalVars(accounts);
    const staker = accounts[1];
    const MINIMAL_AMOUNT_OF_SHARES = 1000000;
    const bountyPercentage = 8000;
    
    await stakingToken.mint(staker, "10000000");
    await stakingToken.approve(vault.address, "10000000", { from: staker});
    await vault.deposit(MINIMAL_AMOUNT_OF_SHARES, staker, { from: staker });

    assert.equal((await stakingToken.balanceOf(vault.address)).toString(), MINIMAL_AMOUNT_OF_SHARES);
    // now pay out a large amount
    await advanceToSafetyPeriod();
    const claimId = await submitClaim(claimsManager, { accounts, bountyPercentage});
    await utils.increaseTime(60 * 60 * 24);
    await claimsManager.approveClaim(claimId, bountyPercentage, ZERO_ADDRESS);

    assert.equal((await stakingToken.balanceOf(vault.address)).toString(), (HUNDRED_PERCENT - bountyPercentage) * MINIMAL_AMOUNT_OF_SHARES/HUNDRED_PERCENT);

  });


  it("First depositor can partially steal deposits and DoS vault", async () => {
    /**
     * TEST the following scenario:
     * - The first vault's depositor is able to compromise vaults by minting a minimum amount of shares 
     * (such as 1 wei of the staking token) and transferring a much larger amount further on (1 ether worth of staking tokens, or 1e18). 
     * This makes it so supply in ERC4626Upgradeable.sol will be 1, while totalAssets() will return 1e18. 
     * This makes the share price extremely overvalued, and every future deposit below the transferred amount will revert due to convertToShares() returning 0.
     * 
     * Deposit with amounts above this amount transferred by the malicious actor will proceed, however due to rounding issues, the depositor . 
     * In the example below, the code has the first malicious actor transferring 1e18 stakingToken amount, a second clueless actor depositing 1.5e18 tokens 
     * will only receive 1 share. Since the total token amount is 2.5e18 tokens, 1 share will be able to withdraw 1.25e18 tokens, 
     * so the first depositor can exit with a stolen profit of 0.25e18.
     * 
     */
    await setUpGlobalVars( accounts);
    const MINIMAL_AMOUNT_OF_SHARES = await vault.MINIMAL_AMOUNT_OF_SHARES();
    assert.equal((await vault.totalSupply()).toString(), "0");

    currentBlockNumber = (await web3.eth.getBlock("latest")).number;
    var staker = accounts[1];
    var staker2 = accounts[2];
    await stakingToken.approve(vault.address, web3.utils.toWei("1000", "ether"), {
      from: staker,
    });
    await stakingToken.approve(vault.address, web3.utils.toWei("1500", "ether"), {
      from: staker2,
    });
    const stakerInitialDeposit = MINIMAL_AMOUNT_OF_SHARES;
    await stakingToken.mint(staker, stakerInitialDeposit); 

    //Stake minimum amount
    await vault.deposit(MINIMAL_AMOUNT_OF_SHARES, staker, { from: staker });
    //Makes sure all values are set properly
    assert.equal((await vault.balanceOf(staker)).toString(), stakerInitialDeposit);
    assert.equal((await vault.totalSupply()).toString(), stakerInitialDeposit);
    assert.equal((await stakingToken.balanceOf(vault.address)).toString(), stakerInitialDeposit);

    //Now we transfer a large amount of tokens to the vault.
    await stakingToken.mint(staker, web3.utils.toWei('1000', 'ether'));
    await stakingToken.transfer(vault.address, web3.utils.toWei('1000', 'ether'), {
      from: staker,
    });
    // one share is now worth 1e18 + 1 tokens
    // ((1000*1e18+1000)/1000)
    assert.equal((await vault.previewRedeem(1)).toString(), "1000000000000000001");

    const staker2InitialDeposit = web3.utils.toWei('1500', 'ether');
    await stakingToken.mint(staker2, staker2InitialDeposit);
    await vault.deposit(staker2InitialDeposit, staker2, { from: staker2 });

    assert.equal((await vault.totalSupply()).toString(), "2499");
    // commented next line bc there is a small difference in rounding apparently
    // assert.equal((await vault.previewRedeem(1)).toString(), ((1000e18+1000+1500e18)/2499).toString());
    assert.equal((await vault.previewRedeem(1)).toString(), "1000400160064025610");
    assert.equal((await vault.balanceOf(staker2)).toString(), "1499");


    //If able to withdraw, the malicious actor will withdraw all their assets + some extra due to rounding errors.
    await safeRedeem(vault, (await vault.balanceOf(staker)), staker);
    const stakerBalance = await stakingToken.balanceOf(staker);
    const stakerDifference = 1e18 - stakerBalance;
    // the rounding error should be relatively small, less than original deposit divided by MINIMAL_STAKING_AMOUNT
    assert.isAtMost(stakerDifference, stakerInitialDeposit/MINIMAL_AMOUNT_OF_SHARES);
    // staker now has no shares anymore
    assert.equal((await vault.balanceOf(staker)).toString(), "0");


    // similarly, staker2 will loose some, but no significant part, of their deposit
    await safeRedeem(vault, (await vault.balanceOf(staker2)), staker2);
    const staker2Balance = await stakingToken.balanceOf(staker2);
    const staker2Difference = 1e18 - staker2Balance;
    // the rounding error should be relatively small, less than original deposit divided by MINIMAL_STAKING_AMOUNT
    assert.isAtMost(staker2Difference, staker2InitialDeposit/MINIMAL_AMOUNT_OF_SHARES);


  });
});


