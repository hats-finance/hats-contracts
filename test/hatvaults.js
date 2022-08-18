const HATVault = artifacts.require("./HATVault.sol");
const HATVaultsRegistry = artifacts.require("./HATVaultsRegistry.sol");
const HATTokenMock = artifacts.require("./HATTokenMock.sol");
const ERC20Mock = artifacts.require("./ERC20Mock.sol");
const UniSwapV3RouterMock = artifacts.require("./UniSwapV3RouterMock.sol");
const TokenLockFactory = artifacts.require("./TokenLockFactory.sol");
const HATTokenLock = artifacts.require("./HATTokenLock.sol");
const VaultsManagerMock = artifacts.require("./VaultsManagerMock.sol");
const RewardController = artifacts.require("./RewardController.sol");
const utils = require("./utils.js");
const ISwapRouter = new ethers.utils.Interface(UniSwapV3RouterMock.abi);

const { deployHatVaults } = require("../scripts/hatvaultsdeploy.js");
const {
  assertVMException,
  advanceToSafetyPeriod: advanceToSafetyPeriod_,
  rewardPerEpoch,
} = require("./common.js");

var hatVaultsRegistry;
var vault;
var rewardController;
var hatToken;
var router;
var stakingToken;
var tokenLockFactory;
let safeWithdrawBlocksIncrement = 3;
let rewardControllerExpectedHatsBalance;

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
  challengePeriod = 60 * 60 * 24
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

  hatVaultsRegistry = await HATVaultsRegistry.at(deployment.hatVaultsRegistry.address);
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
  await hatToken.transfer(
    rewardController.address,
    web3.utils.toWei(rewardInVaults.toString())
  );
  rewardControllerExpectedHatsBalance = rewardInVaults;

  // setting challengeClaim period to 0 will make running tests a bit easier
  await hatVaultsRegistry.setChallengePeriod(challengePeriod);
  vault = await HATVault.at((await hatVaultsRegistry.createVault(
    stakingToken.address,
    accounts[1],
    rewardController.address,
    maxBounty,
    bountySplit,
    "_descriptionHash",
    [86400, 10],
    false
  )).logs[0].args._vault);
  await rewardController.setAllocPoint(
    vault.address,
    allocPoint
  );
  await vault.committeeCheckIn({ from: accounts[1] });
  return {
    hatVaultsRegistry,
    vault,
    hatToken,
    stakingToken,
  };
};

contract("HatVaults", (accounts) => {
  //this function will increment 4 blocks in local testnet
  async function safeRedeem(vault, amount, staker, redeemFrom=staker) {
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
    return await vault.redeem(amount, staker, redeemFrom, { from: staker });
  }

  async function safeWithdraw(vault, amount, staker, withdrawFrom=staker) {
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
    return await vault.withdraw(amount, staker, withdrawFrom, { from: staker });
  }

  async function advanceToSafetyPeriod() {
    return advanceToSafetyPeriod_(hatVaultsRegistry);
  }

  //advanced time to a withdraw enable period
  async function advanceToNonSafetyPeriod() {
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

  async function calculateExpectedReward(staker, operationBlocksIncrement = 0, currentVault=vault) {
    let currentBlockNumber = (await web3.eth.getBlock("latest")).number;
    let lastRewardBlock = (await rewardController.vaultInfo(currentVault.address)).lastRewardBlock;
    let allocPoint = (await rewardController.vaultInfo(currentVault.address)).allocPoint;
    let rewardPerShare = new web3.utils.BN(
      (await rewardController.vaultInfo(currentVault.address)).rewardPerShare
    );
    let onee12 = new web3.utils.BN("1000000000000");
    let balanceOf = await currentVault.balanceOf(staker);
    let stakerAmount = balanceOf;
    let globalUpdatesLen = await rewardController.getGlobalVaultsUpdatesLength();
    let totalAllocPoint = (
      await rewardController.globalVaultsUpdates(globalUpdatesLen - 1)
    ).totalAllocPoint;
    let vaultReward = await rewardController.getRewardForBlocksRange(
      lastRewardBlock,
      currentBlockNumber + 1 + operationBlocksIncrement,
      allocPoint,
      totalAllocPoint
    );
    let lpSupply = await currentVault.totalSupply();
    let rewardDebt = await rewardController.rewardDebt(currentVault.address, staker);
    let unclaimedReward = await rewardController.unclaimedReward(currentVault.address, staker);
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
    return await vault.redeem(amount, staker, staker, { from: staker });
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
    return await vault.withdraw(amount, staker, staker, { from: staker });
  }

  it("constructor", async () => {
    await setup(accounts);
    assert.equal(await stakingToken.name(), "Staking");
    assert.equal(await hatVaultsRegistry.owner(), accounts[0]);
  });

  it("Set reward controller", async () => {
    await setup(accounts);
    assert.equal((await vault.rewardController()), rewardController.address);

    try {
      await vault.setRewardController(accounts[2], { from: accounts[1] });
      assert(false, "only gov");
    } catch (ex) {
      assertVMException(ex, "OnlyOwner");
    }

    await vault.setRewardController(accounts[2]);

    assert.equal((await vault.rewardController()), accounts[2]);
  });

  it("setCommittee", async () => {
    await setup(accounts);
    assert.equal(await vault.committee(), accounts[1]);

    await vault.setCommittee(accounts[2], { from: accounts[1] });

    assert.equal(await vault.committee(), accounts[2]);

    try {
      await vault.setCommittee(accounts[2], { from: accounts[1] });
      assert(false, "cannot set committee from non committee account");
    } catch (ex) {
      assertVMException(ex, "OnlyCommittee");
    }

    //create another vault with a different committee
    let maxBounty = 8000;
    let bountySplit = [6000, 2000, 500, 0, 1000, 500];
    var stakingToken2 = await ERC20Mock.new("Staking", "STK");
    let newVault = await HATVault.at((await hatVaultsRegistry.createVault(
      stakingToken2.address,
      accounts[3],
      rewardController.address,
      maxBounty,
      bountySplit,
      "_descriptionHash",
      [86400, 10],
      false
    )).logs[0].args._vault);

    await rewardController.setAllocPoint(
      newVault.address,
      100
    );

    assert.equal(await newVault.committee(), accounts[3]);

    await newVault.setCommittee(accounts[1]);

    assert.equal(await newVault.committee(), accounts[1]);
    var staker = accounts[1];
    await stakingToken2.approve(newVault.address, web3.utils.toWei("4"), {
      from: staker,
    });
    await stakingToken2.mint(staker, web3.utils.toWei("1"));
    try {
      await newVault.deposit(web3.utils.toWei("1"), staker, { from: staker });
      assert(false, "cannot deposit before committee check in");
    } catch (ex) {
      assertVMException(ex, "CommitteeNotCheckedInYet");
    }

    try {
      await newVault.committeeCheckIn({ from: accounts[0] });
      assert(false, "only committee can check in");
    } catch (ex) {
      assertVMException(ex, "OnlyCommittee");
    }
    let tx = await newVault.committeeCheckIn({ from: accounts[1] });
    assert.equal(tx.logs[0].event, "CommitteeCheckedIn");

    try {
      await newVault.setCommittee(accounts[2]);
      assert(false, "committee already checked in");
    } catch (ex) {
      assertVMException(ex, "CommitteeAlreadyCheckedIn");
    }
    await newVault.setCommittee(accounts[2], { from: accounts[1] });
    await newVault.setCommittee(accounts[1], { from: accounts[2] });
  });

  it("dismiss can be called by anyone after 5 weeks delay", async () => {
    var staker = accounts[1];
    await setup(accounts, 0, 9000, [9000, 0, 200, 0, 100, 700], 10, 0, 100, false, 2500000, 60 * 60 * 24 * 3);

    await advanceToSafetyPeriod();
    await stakingToken.approve(vault.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await stakingToken.mint(staker, web3.utils.toWei("1"));
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });
    await vault.submitClaim(
      accounts[2],
      8000,
      "description hash",
      {
        from: accounts[1],
      }
    );

    await vault.challengeClaim();
    try {
      await vault.dismissClaim({ from: accounts[1] });
      assert(false, "only arbitrator can dismiss before delay");
    } catch (ex) {
      assertVMException(
        ex,
        "OnlyCallableByArbitratorOrAfterChallengeTimeOutPeriod"
      );
    }
    await utils.increaseTime(1);
    await utils.increaseTime(5 * 7 * 24 * 60 * 60);
    let tx = await vault.dismissClaim({ from: accounts[1] });
    assert.equal(tx.logs[0].event, "DismissClaim");
  });

  it("custom bountySplit and max bounty", async () => {
    try {
      await setup(accounts, 0, 9000, [9000, 0, 200, 0, 100, 800]);
      assert(false, "cannot init with rewardSplit > 10000");
    } catch (ex) {
      assertVMException(ex, "TotalSplitPercentageShouldBeHundredPercent");
    }

    try {
      await setup(accounts, 0, 9000, [8000, 0, 100, 0, 100, 700]);
      assert(false, "cannot init with rewardSplit < 10000");
    } catch (ex) {
      assertVMException(ex, "TotalSplitPercentageShouldBeHundredPercent");
    }

    try {
      await setup(accounts, 0, 11000, [8000, 0, 100, 0, 100, 800]);
      assert(false, "cannot init with max bounty > 10000");
    } catch (ex) {
      assertVMException(ex, "MaxBountyCannotBeMoreThanHundredPercent");
    }

    await setup(accounts, 0, 9000, [8000, 1000, 100, 100, 100, 700], 10, 0, 100, false, 2500000, 60 * 60 * 24 * 3);
    assert.equal((await vault.maxBounty()).toString(), "9000");
    assert.equal(
      (await vault.bountySplit()).hacker.toString(),
      "1000"
    );
    assert.equal(
      (await vault.bountySplit()).hackerVested.toString(),
      "8000"
    );

    assert.equal(
      (await vault.bountySplit()).committee.toString(),
      "100"
    );
    assert.equal(
      (await vault.bountySplit()).swapAndBurn.toString(),
      "100"
    );
    assert.equal(
      (await vault.bountySplit()).governanceHat.toString(),
      "100"
    );
    assert.equal(
      (await vault.bountySplit()).hackerHatVested.toString(),
      "700"
    );

    try {
      await vault.setPendingMaxBounty(11000, { from: accounts[1] });
      assert(false, "max bounty can't be more than 10000");
    } catch (ex) {
      assertVMException(ex, "MaxBountyCannotBeMoreThanHundredPercent");
    }
    try {
      await vault.setPendingMaxBounty(10000, { from: accounts[2] });
      assert(false, "only committee");
    } catch (ex) {
      assertVMException(ex, "OnlyCommittee");
    }
    try {
      await vault.setMaxBounty({ from: accounts[1] });
      assert(false, "no pending");
    } catch (ex) {
      assertVMException(ex, "NoPendingMaxBounty");
    }

    // bountylevel can be 10000 without throwing an error
    await vault.setPendingMaxBounty(10000, {
      from: accounts[1],
    });

    try {
      await vault.setPendingMaxBounty(10001, { from: accounts[1] });
      assert(false, "bounty level should be less than or equal to 10000");
    } catch (ex) {
      assertVMException(ex, "MaxBountyCannotBeMoreThanHundredPercent");
    }
    let tx = await vault.setPendingMaxBounty(10000, {
      from: accounts[1],
    });
    assert.equal(tx.logs[0].event, "SetPendingMaxBounty");
    assert.equal(tx.logs[0].args._maxBounty, 10000);

    await utils.increaseTime(1);
    try {
      await vault.setMaxBounty({ from: accounts[1] });
      assert(false, "no delay yet");
    } catch (ex) {
      assertVMException(ex, "DelayPeriodForSettingMaxBountyHadNotPassed");
    }
    await utils.increaseTime(3600 * 24 * 2);
    try {
      await vault.setMaxBounty({ from: accounts[0] });
      assert(false, "onlyCommittee");
    } catch (ex) {
      assertVMException(ex, "OnlyCommittee");
    }
    tx = await vault.setMaxBounty({ from: accounts[1] });
    assert.equal(tx.logs[0].event, "SetMaxBounty");
    assert.equal(tx.logs[0].args._maxBounty, 10000);

    await advanceToNonSafetyPeriod();

    try {
      await vault.setBountySplit([7000, 0, 1000, 1100, 0, 901]);
      assert(false, "cannot init with bountySplit > 10000");
    } catch (ex) {
      assertVMException(ex, "TotalSplitPercentageShouldBeHundredPercent");
    }
    await vault.setBountySplit([6000, 0, 1000, 2200, 0, 800]);
    assert.equal(
      (await vault.maxBounty()).toString(),
      "10000"
    );
    assert.equal(
      (await vault.bountySplit()).hacker.toString(),
      "0"
    );
    assert.equal(
      (await vault.bountySplit()).hackerVested.toString(),
      "6000"
    );

    assert.equal(
      (await vault.bountySplit()).committee.toString(),
      "1000"
    );
    assert.equal(
      (await vault.bountySplit()).swapAndBurn.toString(),
      "2200"
    );
    assert.equal(
      (await vault.bountySplit()).hackerHatVested.toString(),
      "800"
    );
    await advanceToSafetyPeriod();
    tx = await vault.submitClaim(
      accounts[2],
      10000,
      "description hash",
      {
        from: accounts[1],
      }
    );

    await vault.challengeClaim();
    try {
      await vault.setPendingMaxBounty(8000, { from: accounts[1] });
      assert(false, "there is already pending approval");
    } catch (ex) {
      assertVMException(ex, "ActiveClaimExists");
    }
    try {
      await vault.setBountySplit([6000, 0, 1000, 1100, 1, 800]);
      assert(false, "cannot set split while there is pending approval");
    } catch (ex) {
      assertVMException(ex, "ActiveClaimExists");
    }
    tx = await vault.dismissClaim();
    assert.equal(tx.logs[0].event, "DismissClaim");

    try {
      await vault.setBountySplit([6000, 0, 1000, 1100, 1, 800]);
      assert(false, "cannot set split while in safety period");
    } catch (ex) {
      assertVMException(ex, "SafetyPeriod");
    }
    await advanceToNonSafetyPeriod();

    await vault.setBountySplit([6000, 0, 1000, 1000, 1200, 800]);

    await vault.setPendingMaxBounty(8000, { from: accounts[1] });

    await utils.increaseTime(24 * 3600 * 2);
    await vault.setMaxBounty({ from: accounts[1] });
    assert.equal((await vault.maxBounty()).toString(), "8000");
  });

  it("zero totalAllocPoints", async () => {
    await setup(accounts, 0, 9000, [8000, 1000, 100, 100, 100, 700], 10, 0, 0);

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
    await rewardController.updateVault(vault.address);
  });

  it("anyone can create a vault", async () => {
    await setup(accounts);

    let newVault = await HATVault.at((await hatVaultsRegistry.createVault(
      stakingToken.address,
      accounts[1],
      rewardController.address,
      8000,
      [6000, 2000, 500, 0, 1000, 500],
      "_descriptionHash",
      [86400, 10],
      false,
      { from: accounts[1] }
    )).logs[0].args._vault);
    await newVault.committeeCheckIn({ from: accounts[1] });

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
    let expectedBalance = (await hatToken.balanceOf(staker)).toString();
    await rewardController.updateVault(newVault.address, { from: staker });
    await rewardController.claimReward(newVault.address, staker, { from: staker });
    assert.equal(
      (await hatToken.balanceOf(staker)).toString(),
      expectedBalance
    );
  });

  it("deposit cannot be 0", async () => {
    await setup(accounts);
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
      await vault.mint(0, staker, { from: staker });
      assert(false, "cannot deposit 0");
    } catch (ex) {
      assertVMException(ex, "AmountToDepositIsZero");
    }

    await vault.deposit(1, staker, { from: staker });

    await stakingToken.mint(vault.address, web3.utils.toWei("10"));

    try {
      await vault.deposit(1, staker, { from: staker });
      assert(false, "cannot deposit amount too low for 1 share");
    } catch (ex) {
      assertVMException(ex, "AmountToDepositIsZero");
    }
  });

  it("withdrawn", async () => {
    await setup(accounts, 0, 8000, [6000, 2000, 500, 0, 1000, 500], 10, 0, 100, false, 2500000, 60 * 60 * 24 * 3);
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
      let tx = await vault.setDepositPause(true, { from: accounts[1] });
      assert(false, "only gov");
    } catch (ex) {
      assertVMException(ex, "OnlyOwner");
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
      await vault.mint(web3.utils.toWei("1"), staker, { from: staker });
      assert(false, "cannot mint to a paused vault");
    } catch (ex) {
      assertVMException(ex, "ERC4626: mint more than max");
    }
    await vault.setDepositPause(false);
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });
    await utils.increaseTime(7 * 24 * 3600);
    await advanceToSafetyPeriod();

    tx = await vault.submitClaim(
      accounts[2],
      8000,
      "description hash",
      {
        from: accounts[1],
      }
    );

    await vault.challengeClaim();

    try {
      await safeRedeem(vault, web3.utils.toWei("1"), staker);
      assert(false, "cannot withdraw while pending approval exists");
    } catch (ex) {
      assertVMException(ex, "RedeemMoreThanMax");
    }

    tx = await vault.dismissClaim();
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

  it("withdraw cannot be 0", async () => {
    await setup(accounts);
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
    await vault.submitClaim(accounts[2], 8000, "description hash", {
      from: accounts[1],
    });
    
    await utils.increaseTime(60 * 60 * 24);

    await vault.approveClaim(8000);

    try {
      await safeRedeem(vault, 1, staker);
      assert(false, "cannot redeem amount too low for 1 asset");
    } catch (ex) {
      assertVMException(ex, "WithdrawMustBeGreaterThanZero");
    }      
  });

  it("setWithdrawSafetyPeriod", async () => {
    await setup(accounts, 0, 8000, [6000, 2000, 500, 0, 1000, 500], 10, 0, 100, false, 2500000, 60 * 60 * 24 * 3);
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

    tx = await vault.submitClaim(accounts[2], 8000, "description hash", {
      from: accounts[1],
    });

    await vault.challengeClaim();

    try {
      await safeRedeem(vault, web3.utils.toWei("1"), staker);
      assert(false, "cannot withdraw while pending approval exists");
    } catch (ex) {
      assertVMException(ex, "RedeemMoreThanMax");
    }

    tx = await vault.dismissClaim();
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
    await setup(accounts);
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

  it("deposit cancel withdrawn request ", async () => {
    await setup(accounts);
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
    await vault.withdrawRequest({ from: staker });
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });
    await utils.increaseTime(7 * 24 * 3600);
    try {
      await vault.redeem(web3.utils.toWei("0.5"), staker, staker, { from: staker });
      assert(false, "deposit cancel withdrawRequest");
    } catch (ex) {
      assertVMException(ex, "RedeemMoreThanMax");
    }
  });

  it("withdrawn request ", async () => {
    await setup(accounts);
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
      await vault.redeem(web3.utils.toWei("1"), staker, staker, { from: staker });
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
      await vault.redeem(web3.utils.toWei("1"), staker, staker, { from: staker });
      assert(false, "request is pending");
    } catch (ex) {
      assertVMException(ex, "RedeemMoreThanMax");
    }

    await utils.increaseTime(7 * 24 * 3600);
    try {
      await vault.withdrawRequest({ from: staker });
      assert(false, "there is already pending request");
    } catch (ex) {
      assertVMException(ex, "PendingWithdrawRequestExists");
    }

    await vault.redeem(web3.utils.toWei("0.5"), staker, staker, { from: staker });
    assert.equal(await vault.withdrawEnableStartTime(staker), 0);
    try {
      await vault.redeem(web3.utils.toWei("0.5"), staker, staker, { from: staker });
      assert(false, "no pending request");
    } catch (ex) {
      assertVMException(ex, "RedeemMoreThanMax");
    }
    await vault.withdrawRequest({ from: staker });
    await utils.increaseTime(7 * 24 * 3600);
    await vault.redeem(await vault.balanceOf(staker), staker, staker, { from: staker });
    assert.equal(await vault.withdrawEnableStartTime(staker), 0);
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });
    await vault.withdrawRequest({ from: staker });
    try {
      await vault.withdrawRequest({ from: staker });
      assert(false, "there is already pending request");
    } catch (ex) {
      assertVMException(ex, "PendingWithdrawRequestExists");
    }
    await utils.increaseTime(7 * 24 * 3600);
    try {
      await vault.withdrawRequest({ from: staker });
      assert(false, "there is already pending request");
    } catch (ex) {
      assertVMException(ex, "PendingWithdrawRequestExists");
    }
    await utils.increaseTime(7 * 24 * 3600);
    //request is now expired so can request again.
    await vault.withdrawRequest({ from: staker });
  });

  it("Set fee and fee setter", async () => {
    await setup(accounts);
    try {
      await hatVaultsRegistry.setFeeSetter(accounts[1], {
        from: accounts[1],
      });
      assert(false, "only gov");
    } catch (ex) {
      assertVMException(ex, "Ownable: caller is not the owner");
    }

    await hatVaultsRegistry.setFeeSetter(accounts[0]);
    var tx = await vault.setWithdrawalFee(100);
    assert.equal(await vault.withdrawalFee(), 100);
    assert.equal(tx.logs[0].event, "SetWithdrawalFee");
    assert.equal(tx.logs[0].args._newFee, 100);

    tx = await hatVaultsRegistry.setFeeSetter(accounts[1]);

    assert.equal(await hatVaultsRegistry.feeSetter(), accounts[1]);
    assert.equal(tx.logs[0].event, "SetFeeSetter");
    assert.equal(tx.logs[0].args._newFeeSetter, accounts[1]);

    try {
      await vault.setWithdrawalFee(100);
      assert(false, "only fee setter");
    } catch (ex) {
      assertVMException(ex, "OnlyFeeSetter");
    }

    try {
      await vault.setWithdrawalFee(201, {
        from: accounts[1],
      });
      assert(false, "fee must be lower than or equal to 2%");
    } catch (ex) {
      assertVMException(ex, "WithdrawalFeeTooBig");
    }

    tx = await vault.setWithdrawalFee(200, {
      from: accounts[1],
    });

    assert.equal(await vault.withdrawalFee(), 200);
    assert.equal(tx.logs[0].event, "SetWithdrawalFee");
    assert.equal(tx.logs[0].args._newFee, 200);

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

    let governanceBalance = await stakingToken.balanceOf(accounts[0]);

    await safeRedeem(vault, web3.utils.toWei("1"), staker);
    // Staker got back the reward minus the fee
    assert.equal(
      await stakingToken.balanceOf(staker),
      web3.utils.toWei("0.98")
    );
    // Governance received the fee
    assert.equal(
      (await stakingToken.balanceOf(accounts[0])).toString(),
      governanceBalance
        .add(new web3.utils.BN(web3.utils.toWei("0.02")))
        .toString()
    );

    await stakingToken.mint(staker, web3.utils.toWei("0.02"));
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });
    await vault.deposit(web3.utils.toWei("1"), staker2, { from: staker2 });
    try {
      await safeWithdraw(vault, web3.utils.toWei("0.99"), staker);
      assert(false, "cannot withdraw more than max");
    } catch (ex) {
      assertVMException(ex, "WithdrawMoreThanMax");
    }

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
  });

  it("stake", async () => {
    await setup(accounts);
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

  it("claim reward", async () => {
    await setup(
      accounts,
      (await web3.eth.getBlock("latest")).number,
      8000,
      [6000, 2000, 500, 0, 1000, 500],
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

    try {
      await vault.calcClaimBounty(8001);
      assert(false, "reward percentage is too high");
    } catch (ex) {
      assertVMException(ex, "BountyPercentageHigherThanMaxBounty");
    }
    var tx = await rewardController.claimReward(vault.address, staker, { from: staker });
    assert.equal(tx.logs[1].event, "ClaimReward");
    assert.equal(tx.logs[1].args._vault, vault.address);

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
    await setup(
      accounts,
      (await web3.eth.getBlock("latest")).number,
      8000,
      [6000, 2000, 500, 0, 1000, 500],
      10000
    );
    var staker = accounts[1];
    await stakingToken.approve(vault.address, web3.utils.toWei("4"), {
      from: staker,
    });
    await stakingToken.mint(staker, web3.utils.toWei("1"));

    let expectedReward = 0;

    let tx = await rewardController.claimReward(vault.address, staker, { from: staker });
    assert.equal(tx.logs[0].event, "ClaimReward");
    assert.equal(tx.logs[0].args._vault, vault.address);

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
    assert.equal(tx.logs[1].event, "ClaimReward");
    assert.equal(tx.logs[1].args._vault, vault.address);

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
    await setup(
      accounts,
      (await web3.eth.getBlock("latest")).number,
      8000,
      [6000, 2000, 500, 0, 1000, 500],
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
    await setup(
      accounts,
      (await web3.eth.getBlock("latest")).number,
      8000,
      [6000, 2000, 500, 0, 1000, 500],
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
    assert.equal(tx.logs[0].event, "SafeTransferReward");
    assert.equal(tx.logs[0].args.amount.toString(), expectedReward.toString());
    assert.equal(tx.logs[0].args.user, staker);
    assert.equal(tx.logs[0].args.vault, vault.address);
    assert.isFalse(tx.logs[0].args.amount.eq(0));
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
    await setup(
      accounts,
      (await web3.eth.getBlock("latest")).number,
      8000,
      [6000, 2000, 500, 0, 1000, 500],
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
    assert.equal(tx.logs[1].event, "ClaimReward");
    assert.equal(tx.logs[1].args._vault, vault.address);

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
    assert.equal(tx.logs[1].event, "ClaimReward");
    assert.equal(tx.logs[1].args._vault, vault.address);

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
    await setup(
      accounts,
      (await web3.eth.getBlock("latest")).number,
      8000,
      [6000, 2000, 500, 0, 1000, 500],
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

    tx = await vault.redeemAndClaim(web3.utils.toWei("1"), staker, staker, { from: staker });

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
    assert.equal(tx.logs[1].event, "ClaimReward");
    assert.equal(tx.logs[1].args._vault, vault.address);

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

    tx = await vault.withdrawAndClaim(web3.utils.toWei("1"), staker, staker, { from: staker });

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
    await setup(
      accounts,
      (await web3.eth.getBlock("latest")).number,
      8000,
      [6000, 2000, 500, 0, 1000, 500],
      10000,
      0,
      100,
      false,
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
    let hatTokenCap = await hatToken.CAP();
    let amountToMint = hatTokenCap.sub(hatTotalSupply);
    await utils.setMinter(hatToken, accounts[0], amountToMint);
    await hatToken.mint(accounts[0], amountToMint);
    await hatToken.transfer(rewardController.address, amountToMint);

    // Deposit redeemed existing reward
    await stakingToken.mint(staker, web3.utils.toWei("1"));
    let expectedReward = await rewardController.getPendingReward(vault.address, staker);
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });
    tx = await rewardController.claimReward(vault.address, staker, { from: staker });
    assert.equal(tx.logs[0].event, "SafeTransferReward");
    assert.isTrue(
      parseInt(tx.logs[0].args.amount.toString()) >=
        parseInt(expectedReward.toString())
    );
    assert.equal(tx.logs[0].args.user, staker);
    assert.equal(tx.logs[0].args.vault, vault.address);
    assert.isFalse(tx.logs[0].args.amount.eq(0));
    assert.equal(
      (await hatToken.balanceOf(staker)).toString(),
      tx.logs[0].args.amount.toString()
    );

    await stakingToken.mint(staker, web3.utils.toWei("1"));
    var balanceOfStakerBefore = await hatToken.balanceOf(staker);
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });
    tx = await rewardController.claimReward(vault.address, staker, { from: staker });
    assert.equal(
      (await hatToken.balanceOf(staker)).toString(),
      tx.logs[0].args.amount.add(balanceOfStakerBefore).toString()
    );

    // Deposit redeemed existing reward
    await utils.increaseTime(7 * 24 * 3600);
    await stakingToken.mint(staker, web3.utils.toWei("1"));
    balanceOfStakerBefore = await hatToken.balanceOf(staker);
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });
    tx = await rewardController.claimReward(vault.address, staker, { from: staker });
    assert.equal(
      (await hatToken.balanceOf(staker)).toString(),
      tx.logs[0].args.amount.add(balanceOfStakerBefore).toString()
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
      tx.logs[0].args.amount.add(balanceOfStakerBefore).toString()
    );
    assert.equal(
      (await hatToken.balanceOf(rewardController.address)).toString(),
      amountToMint.sub(userHatBalance).toString()
    );
  });

  it("getRewardForBlocksRange - from below startblock will revert ", async () => {
    await setup(accounts, 1);
    let allocPoint = (await rewardController.vaultInfo(vault.address)).allocPoint;
    let globalUpdatesLen = await rewardController.getGlobalVaultsUpdatesLength();
    let totalAllocPoint = (
      await rewardController.globalVaultsUpdates(globalUpdatesLen - 1)
    ).totalAllocPoint;
    try {
      await rewardController.getRewardForBlocksRange(
        0,
        1,
        allocPoint,
        totalAllocPoint
      );
      assert(false, "from below startblock will revert ");
    } catch (ex) {
      assertVMException(ex);
    }
    await setup(accounts, 0);
    assert.equal(
      (
        await rewardController.getRewardForBlocksRange(
          0,
          1,
          allocPoint,
          totalAllocPoint
        )
      ).toString(),
      web3.utils.toWei("441.3")
    );
  });

  it("getRewardForBlocksRange - from must be <= to", async () => {
    await setup(accounts, 0);
    try {
      await rewardController.getRewardForBlocksRange(1, 0, 0, 1000);
      assert(false, "from must be <= to");
    } catch (ex) {
      assertVMException(ex);
    }
    assert.equal(
      (
        await rewardController.getRewardForBlocksRange(0, 0, 0, 1000)
      ).toNumber(),
      0
    );
  });

  it("setRewardPerEpoch", async () => {
    var rewardPerEpochRandom = [...Array(24)].map(() =>
      web3.utils.toWei(((Math.random() * 100) | 0).toString())
    );
    await setup(accounts, 0);
    let allocPoint = (await rewardController.vaultInfo(vault.address)).allocPoint;
    let globalUpdatesLen = await rewardController.getGlobalVaultsUpdatesLength();
    let totalAllocPoint = (
      await rewardController.globalVaultsUpdates(globalUpdatesLen - 1)
    ).totalAllocPoint;
    try {
      await rewardController.setRewardPerEpoch(rewardPerEpochRandom, {
        from: accounts[1],
      });
      assert(false, "only governance");
    } catch (ex) {
      assertVMException(ex, "Ownable: caller is not the owner");
    }

    let tx = await rewardController.setRewardPerEpoch(rewardPerEpochRandom);
    assert.equal(tx.logs[0].event, "SetRewardPerEpoch");
    let eventRewardPerEpoch = tx.logs[0].args._rewardPerEpoch;
    for (let i = 0; i < eventRewardPerEpoch.length; i++) {
      eventRewardPerEpoch[i] = parseInt(eventRewardPerEpoch[i].toString());
      assert.equal(tx.logs[0].args._rewardPerEpoch[i], rewardPerEpochRandom[i]);
    }

    assert.equal(
      (
        await rewardController.getRewardForBlocksRange(
          0,
          10,
          allocPoint,
          totalAllocPoint
        )
      ).toString(),
      new web3.utils.BN(rewardPerEpochRandom[0])
        .mul(new web3.utils.BN(10))
        .toString()
    );
    assert.equal(
      (
        await rewardController.getRewardForBlocksRange(
          0,
          15,
          allocPoint,
          totalAllocPoint
        )
      ).toString(),
      new web3.utils.BN(rewardPerEpochRandom[0])
        .mul(new web3.utils.BN(10))
        .add(
          new web3.utils.BN(rewardPerEpochRandom[1]).mul(new web3.utils.BN(5))
        )
        .toString()
    );
    assert.equal(
      (
        await rewardController.getRewardForBlocksRange(
          0,
          20,
          allocPoint,
          totalAllocPoint
        )
      ).toString(),
      new web3.utils.BN(rewardPerEpochRandom[0])
        .add(new web3.utils.BN(rewardPerEpochRandom[1]))
        .mul(new web3.utils.BN(10))
        .toString()
    );
    var multiplier = new web3.utils.BN("0");
    for (let i = 0; i < 24; i++) {
      multiplier = multiplier.add(new web3.utils.BN(rewardPerEpochRandom[i]));
    }
    assert.equal(
      (
        await rewardController.getRewardForBlocksRange(
          0,
          1000,
          allocPoint,
          totalAllocPoint
        )
      ).toString(),
      multiplier.mul(new web3.utils.BN(10)).toString()
    );
  });

  it("getMultiplier - ", async () => {
    await setup(accounts, 0);
    let allocPoint = (await rewardController.vaultInfo(vault.address)).allocPoint;
    let globalUpdatesLen = await rewardController.getGlobalVaultsUpdatesLength();
    let totalAllocPoint = (
      await rewardController.globalVaultsUpdates(globalUpdatesLen - 1)
    ).totalAllocPoint;
    assert.equal(
      (
        await rewardController.getRewardForBlocksRange(
          0,
          10,
          allocPoint,
          totalAllocPoint
        )
      ).toString(),
      new web3.utils.BN(rewardPerEpoch[0]).mul(new web3.utils.BN(10)).toString()
    );
    assert.equal(
      (
        await rewardController.getRewardForBlocksRange(
          0,
          15,
          allocPoint,
          totalAllocPoint
        )
      ).toString(),
      new web3.utils.BN(rewardPerEpoch[0])
        .mul(new web3.utils.BN(10))
        .add(new web3.utils.BN(rewardPerEpoch[1]).mul(new web3.utils.BN(5)))
        .toString()
    );
    assert.equal(
      (
        await rewardController.getRewardForBlocksRange(
          0,
          20,
          allocPoint,
          totalAllocPoint
        )
      ).toString(),
      new web3.utils.BN(rewardPerEpoch[0])
        .add(new web3.utils.BN(rewardPerEpoch[1]))
        .mul(new web3.utils.BN(10))
        .toString()
    );
    var multiplier = new web3.utils.BN("0");
    for (let i = 0; i < 24; i++) {
      multiplier = multiplier.add(new web3.utils.BN(rewardPerEpoch[i]));
    }

    assert.equal(
      (
        await rewardController.getRewardForBlocksRange(
          0,
          1000,
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
    await setup(accounts);
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
      multiplier
    );
  });

  it("approve + stake + exit", async () => {
    await setup(
      accounts,
      (await web3.eth.getBlock("latest")).number,
      8000,
      [6000, 2000, 500, 0, 1000, 500],
      10000,
      0,
      100,
      false,
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
    await vault.submitClaim(
      accounts[2],
      8000,
      "description hash",
      {
        from: accounts[1],
      }
    );

    await vault.challengeClaim();
    await utils.increaseTime(60 * 60 * 24 * 3 + 1);

    try {
      await vault.approveClaim(8000);
      assert(false, "lpbalance is zero");
    } catch (ex) {
      assertVMException(ex, "VaultBalanceIsZero");
    }
    let tx = await vault.dismissClaim();
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
    try {
      await vault.submitClaim(accounts[2], 8000, "description hash", {
        from: accounts[1],
      });
      assert(false, "none safety period");
    } catch (ex) {
      assertVMException(ex, "NotSafetyPeriod");
    }
    await advanceToSafetyPeriod();
    try {
      await vault.submitClaim(accounts[2], 8001, "description hash", {
        from: accounts[1],
      });
      assert(false, "percentage requested too high");
    } catch (ex) {
      assertVMException(ex, "BountyPercentageHigherThanMaxBounty");
    }

    try {
      await vault.submitClaim(accounts[2], 8000, "description hash", {
        from: accounts[2],
      });
      assert(false, "only committee");
    } catch (ex) {
      assertVMException(ex, "OnlyCommittee");
    }

    try {
      await vault.approveClaim(8000);
      assert(false, "there is no pending approval");
    } catch (ex) {
      assertVMException(ex, "NoActiveClaimExists");
    }

    tx = await vault.submitClaim(accounts[2], 8000, "description hash", {
      from: accounts[1],
    });

    try {
      await vault.submitClaim(accounts[2], 8000, "description hash", {
        from: accounts[1],
      });
      assert(false, "there is already pending approval");
    } catch (ex) {
      assertVMException(ex, "ActiveClaimExists");
    }
    assert.equal(tx.logs[0].event, "SubmitClaim");
    assert.equal(tx.logs[0].args._committee, accounts[1]);
    assert.equal(tx.logs[0].args._beneficiary, accounts[2]);
    assert.equal(tx.logs[0].args._bountyPercentage, 8000);
    assert.equal(tx.logs[0].args._descriptionHash, "description hash");

    await utils.increaseTime(60 * 60 * 24 * 3 + 1);
    tx = await vault.approveClaim(8000);
    assert.equal(
      await hatToken.balanceOf(rewardController.address),
      web3.utils.toWei(rewardControllerExpectedHatsBalance.toString())
    );
    assert.equal(tx.logs[6].event, "ApproveClaim");

    currentBlockNumber = (await web3.eth.getBlock("latest")).number;
    await vault.deposit(web3.utils.toWei("1"), staker2, { from: staker2 });

    assert.equal(await stakingToken.balanceOf(staker), 0);
    let stakerAmount = await vault.balanceOf(staker);
    assert.equal(stakerAmount.toString(), web3.utils.toWei("1"));
    await safeRedeem(vault, stakerAmount, staker);

    assert.equal(stakerAmount.toString(), web3.utils.toWei("1"));
    tx = await rewardController.claimReward(vault.address, staker, { from: staker });
    assert.equal(tx.logs[0].event, "SafeTransferReward");
    let totalReward = tx.logs[0].args.amount;

    assert.equal(
      web3.utils.fromWei(await stakingToken.balanceOf(staker)),
      "0.2"
    );
    stakerAmount = await vault.balanceOf(staker2);
    await safeRedeem(vault, stakerAmount, staker2);
    tx = await rewardController.claimReward(vault.address, staker2, { from: staker2 });
    assert.equal(tx.logs[0].event, "SafeTransferReward");
    totalReward = totalReward.add(tx.logs[0].args.amount);
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
    await setup(accounts, 0, 8000, [6000, 2000, 500, 0, 1000, 500], 10000);
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
    await vault.submitClaim(
      accounts[2],
      8000,
      "description hash",
      {
        from: accounts[1],
      }
    );

    await utils.increaseTime(60 * 60 * 24);

    let tx = await vault.approveClaim(8000);
    assert.equal(tx.logs[6].event, "ApproveClaim");
    let stakerAmount = await vault.balanceOf(staker);
    assert.equal(stakerAmount.toString(), web3.utils.toWei("1"));
    await safeRedeem(vault, stakerAmount, staker);
    tx = await rewardController.claimReward(vault.address, staker, { from: staker });
    assert.equal(tx.logs[0].event, "SafeTransferReward");
    assert.equal(
      (await hatToken.balanceOf(rewardController.address)).toString(),
      new web3.utils.BN(
        web3.utils.toWei(rewardControllerExpectedHatsBalance.toString())
      )
        .sub(tx.logs[0].args.amount)
        .toString()
    );
    assert.equal(
      web3.utils.fromWei(await stakingToken.balanceOf(staker)),
      "0.2"
    );
  });

  it("withdraw all after approve and check reward", async () => {
    await setup(accounts, 0, 8000, [6000, 2000, 500, 0, 1000, 500], 10000);
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
    await vault.submitClaim(
      accounts[2],
      8000,
      "description hash",
      {
        from: accounts[1],
      }
    );

    await utils.increaseTime(60 * 60 * 24);

    await vault.approveClaim(8000);
    await safeRedeem(vault, await vault.balanceOf(staker), staker, staker);
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });
    await safeRedeem(vault, web3.utils.toWei("1"), staker2);
    let tx = await rewardController.claimReward(vault.address, staker, { from: staker2 });
    assert.equal(tx.logs[0].event, "SafeTransferReward");
    await safeRedeem(vault, web3.utils.toWei("1"), staker);
    tx = await rewardController.claimReward(vault.address, staker, { from: staker });
    assert.equal(tx.logs[0].event, "SafeTransferReward");
    assert.isFalse(tx.logs[0].args.amount.eq(0));
  });

  it("deposit mint withdraw redeem after approve claim", async () => {
    await setup(
      accounts,
      (await web3.eth.getBlock("latest")).number,
      8000,
      [6000, 2000, 500, 0, 1000, 500],
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
    await vault.submitClaim(
      accounts[2],
      8000,
      "description hash",
      {
        from: accounts[1],
      }
    );

    await utils.increaseTime(60 * 60 * 24);

    let tx = await vault.approveClaim(8000);
    assert.equal(tx.logs[6].event, "ApproveClaim");
    assert.equal(await vault.totalSupply(), web3.utils.toWei("1"));
    assert.equal(await vault.balanceOf(staker), web3.utils.toWei("1"));
    assert.equal(await vault.balanceOf(staker2), web3.utils.toWei("0"));
    tx = await vault.deposit(web3.utils.toWei("0.8"), staker2, { from: staker2 });
    assert.equal(tx.logs[3].event, "Deposit");
    assert.equal(tx.logs[3].args.assets.toString(), web3.utils.toWei("0.8"));
    assert.equal(tx.logs[3].args.shares.toString(), web3.utils.toWei("4"));
    assert.equal(await vault.totalSupply(), web3.utils.toWei("5"));
    assert.equal(await vault.balanceOf(staker), web3.utils.toWei("1"));
    assert.equal(await vault.balanceOf(staker2), web3.utils.toWei("4"));

    tx = await vault.mint(web3.utils.toWei("1"), staker2, { from: staker2 });
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
      assertVMException(ex, "WithdrawMoreThanMax");
    }

    tx = await safeWithdraw(vault, web3.utils.toWei("0.8"), staker2);
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

    tx = await safeRedeem(vault, web3.utils.toWei("1"), staker2);
    assert.equal(tx.logs[2].event, "Withdraw");
    assert.equal(tx.logs[2].args.assets.toString(), web3.utils.toWei("0.2"));
    assert.equal(tx.logs[2].args.shares.toString(), web3.utils.toWei("1"));
    assert.equal(await vault.totalSupply(), web3.utils.toWei("1"));
    assert.equal(await vault.balanceOf(staker), web3.utils.toWei("1"));
    assert.equal(await vault.balanceOf(staker2), web3.utils.toWei("0"));

    tx = await safeRedeem(vault, web3.utils.toWei("1"), staker);
    assert.equal(tx.logs[2].event, "Withdraw");
    assert.equal(tx.logs[2].args.assets.toString(), web3.utils.toWei("0.2"));
    assert.equal(tx.logs[2].args.shares.toString(), web3.utils.toWei("1"));
    assert.equal(await vault.totalSupply(), web3.utils.toWei("0"));
    assert.equal(await vault.balanceOf(staker), web3.utils.toWei("0"));
    assert.equal(await vault.balanceOf(staker2), web3.utils.toWei("0"));

    tx = await vault.mint(web3.utils.toWei("1"), staker2, { from: staker2 });
    assert.equal(tx.logs[3].event, "Deposit");
    assert.equal(tx.logs[3].args.assets.toString(), web3.utils.toWei("1"));
    assert.equal(tx.logs[3].args.shares.toString(), web3.utils.toWei("1"));
    assert.equal(await vault.totalSupply(), web3.utils.toWei("1"));
    assert.equal(await vault.balanceOf(staker), web3.utils.toWei("0"));
    assert.equal(await vault.balanceOf(staker2), web3.utils.toWei("1"));
  });

  it("withdraw all and claim reward after approve", async () => {
    await setup(
      accounts,
      (await web3.eth.getBlock("latest")).number,
      8000,
      [6000, 2000, 500, 0, 1000, 500],
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
    await vault.submitClaim(
      accounts[2],
      8000,
      "description hash",
      {
        from: accounts[1],
      }
    );

    await utils.increaseTime(60 * 60 * 24);

    let tx = await vault.approveClaim(8000);
    assert.equal(tx.logs[6].event, "ApproveClaim");
    await vault.withdrawRequest({ from: staker });
    //increase time for pending period
    await utils.increaseTime(7 * 24 * 3600);
    await advanceToNonSafetyPeriod();
    let expectedReward = await calculateExpectedReward(staker);
    tx = await vault.redeem(await vault.balanceOf(staker), staker, staker, { from: staker });
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
    tx = await vault.redeem(await vault.balanceOf(staker2), staker2, staker2, { from: staker2 });
    assert.equal(tx.logs[2].event, "Withdraw");
    assert.equal(tx.logs[2].args.assets.toString(), web3.utils.toWei("1"));
    assert.equal(tx.logs[2].args.shares.toString(), web3.utils.toWei("1"));

    let unclaimedRewardStaker2 = await rewardController.unclaimedReward(vault.address, staker2);
    assert.equal(unclaimedRewardStaker2.toString(), expectedRewardStaker2.toString());
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });
    await safeRedeem(vault, web3.utils.toWei("1"), staker);
    tx = await rewardController.claimReward(vault.address, staker, { from: staker });
    assert.equal(tx.logs[0].event, "SafeTransferReward");
    assert.isFalse(tx.logs[0].args.amount.eq(0));
    assert.equal(
      (await hatToken.balanceOf(rewardController.address)).toString(),
      new web3.utils.BN(
        web3.utils.toWei(rewardControllerExpectedHatsBalance.toString())
      )
        .sub(tx.logs[0].args.amount)
        .toString()
    );
    assert.equal((await rewardController.unclaimedReward(vault.address, staker)).toString(), "0");
  });

  it("deposit for another user", async () => {
    await setup(
      accounts,
      (await web3.eth.getBlock("latest")).number,
      8000,
      [6000, 2000, 500, 0, 1000, 500],
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
    assert.equal(tx.logs[3].args.caller, staker2);
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
      assertVMException(ex, "CannotDepositToAnotherUserWithWithdrawRequest");
    }

    tx = await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });
    assert.equal(tx.logs[3].event, "Deposit");
    assert.equal(tx.logs[3].args.caller, staker);
    assert.equal(tx.logs[3].args.owner, staker);
    assert.equal(tx.logs[3].args.assets.toString(), web3.utils.toWei("1"));
    assert.equal(tx.logs[3].args.shares.toString(), web3.utils.toWei("1"));

    assert.equal((await stakingToken.balanceOf(staker)).toString(), web3.utils.toWei("0"));
    assert.equal((await stakingToken.balanceOf(staker2)).toString(), web3.utils.toWei("1"));
    assert.equal((await vault.balanceOf(staker)).toString(), web3.utils.toWei("2"));
    assert.equal((await vault.balanceOf(staker2)).toString(), web3.utils.toWei("0"));    
  });

  it("mint for another user", async () => {
    await setup(
      accounts,
      (await web3.eth.getBlock("latest")).number,
      8000,
      [6000, 2000, 500, 0, 1000, 500],
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
    let tx = await vault.mint(web3.utils.toWei("1"), staker, { from: staker2 });
    assert.equal(tx.logs[3].event, "Deposit");
    assert.equal(tx.logs[3].args.caller, staker2);
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
      await vault.mint(web3.utils.toWei("1"), staker, { from: staker2 });
      assert(false, "cannot deposit for user with a withdraw request");
    } catch (ex) {
      assertVMException(ex, "CannotDepositToAnotherUserWithWithdrawRequest");
    }

    tx = await vault.mint(web3.utils.toWei("1"), staker, { from: staker });
    assert.equal(tx.logs[3].event, "Deposit");
    assert.equal(tx.logs[3].args.caller, staker);
    assert.equal(tx.logs[3].args.owner, staker);
    assert.equal(tx.logs[3].args.assets.toString(), web3.utils.toWei("1"));
    assert.equal(tx.logs[3].args.shares.toString(), web3.utils.toWei("1"));

    assert.equal((await stakingToken.balanceOf(staker)).toString(), web3.utils.toWei("0"));
    assert.equal((await stakingToken.balanceOf(staker2)).toString(), web3.utils.toWei("1"));
    assert.equal((await vault.balanceOf(staker)).toString(), web3.utils.toWei("2"));
    assert.equal((await vault.balanceOf(staker2)).toString(), web3.utils.toWei("0"));    
  });

  it("withdraw from another user", async () => {
    await setup(
      accounts,
      (await web3.eth.getBlock("latest")).number,
      8000,
      [6000, 2000, 500, 0, 1000, 500],
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
    assert.equal(tx.logs[3].args.caller, staker);
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
    assert.equal(tx.logs[3].args.caller, staker2);
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
    await setup(
      accounts,
      (await web3.eth.getBlock("latest")).number,
      8000,
      [6000, 2000, 500, 0, 1000, 500],
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
    assert.equal(tx.logs[3].args.caller, staker);
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
    assert.equal(tx.logs[3].args.caller, staker2);
    assert.equal(tx.logs[3].args.receiver, staker2);
    assert.equal(tx.logs[3].args.owner, staker);
    assert.equal(tx.logs[3].args.assets.toString(), web3.utils.toWei("1"));
    assert.equal(tx.logs[3].args.shares.toString(), web3.utils.toWei("1"));

    assert.equal((await stakingToken.balanceOf(staker)).toString(), web3.utils.toWei("0"));
    assert.equal((await stakingToken.balanceOf(staker2)).toString(), web3.utils.toWei("2"));
    assert.equal((await vault.balanceOf(staker)).toString(), web3.utils.toWei("0"));
    assert.equal((await vault.balanceOf(staker2)).toString(), web3.utils.toWei("0"));
  });

  it("transfer shares", async () => {
    await setup(
      accounts,
      (await web3.eth.getBlock("latest")).number,
      8000,
      [6000, 2000, 500, 0, 1000, 500],
      10000,
      0,
      100,
      false,
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
    assert.equal(tx.logs[3].args.caller, staker);
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
      assertVMException(ex, "InvalidWithdrawRequest");
    }

    await vault.withdrawRequest({ from: staker2 });
    //increase time for pending period
    await utils.increaseTime(7 * 24 * 3600);

    await advanceToSafetyPeriod();
    try {
      await vault.transfer(staker, web3.utils.toWei("1"), { from: staker2 });
      assert(false, "cannot transfer on safety period");
    } catch (ex) {
      assertVMException(ex, "InvalidWithdrawRequest");
    }

    await advanceToNonSafetyPeriod();

    await vault.withdrawRequest({ from: staker });

    try {
      await vault.transfer(staker, web3.utils.toWei("1"), { from: staker2 });
      assert(false, "cannot transfer to user with a withdraw request");
    } catch (ex) {
      assertVMException(ex, "CannotDepositToAnotherUserWithWithdrawRequest");
    }
    
    await advanceToSafetyPeriod();

    tx = await vault.submitClaim(
      accounts[2],
      8000,
      "description hash",
      {
        from: accounts[1],
      }
    );

    await advanceToNonSafetyPeriod();

    try {
      await vault.transfer(staker3, web3.utils.toWei("1"), { from: staker2 });
      assert(false, "cannot transfer when active claim exists");
    } catch (ex) {
      assertVMException(ex, "ActiveClaimExists");
    }

    await vault.challengeClaim();
    await vault.dismissClaim();

    tx = await vault.transfer(staker3, web3.utils.toWei("1"), { from: staker2 });
    assert.equal(tx.logs[0].event, "Transfer");
    assert.equal(tx.logs[0].args.from, staker2);
    assert.equal(tx.logs[0].args.to, staker3);
    assert.equal(tx.logs[0].args.value.toString(), web3.utils.toWei("1"));
    assert.equal((await vault.balanceOf(staker2)).toString(), web3.utils.toWei("0"));
    assert.equal((await vault.balanceOf(staker3)).toString(), web3.utils.toWei("1"));
  });

  it("transferFrom shares", async () => {
    await setup(
      accounts,
      (await web3.eth.getBlock("latest")).number,
      8000,
      [6000, 2000, 500, 0, 1000, 500],
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
    assert.equal(tx.logs[3].args.caller, staker);
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
    await setup(accounts);
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
    await vault.submitClaim(
      accounts[2],
      4000,
      "description hash",
      {
        from: accounts[1],
      }
    );

    await utils.increaseTime(60 * 60 * 24);

    await vault.approveClaim(4000);
    await advanceToSafetyPeriod();
    await vault.submitClaim(accounts[2], 4000, "description hash", {
      from: accounts[1],
    });

    await utils.increaseTime(60 * 60 * 24);

    await vault.approveClaim(4000);
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
    await setup(accounts, (await web3.eth.getBlock("latest")).number + 10);
    assert.equal(await rewardController.getPendingReward(vault.address, accounts[0]), 0);
    await rewardController.updateVault(vault.address);
  });

  it("deposit + withdraw after time end (bdp bug)", async () => {
    await setup(accounts, (await web3.eth.getBlock("latest")).number);
    var staker = accounts[1];
    let hatsAvailable = await hatToken.balanceOf(rewardController.address);
    await stakingToken.approve(vault.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await stakingToken.mint(staker, web3.utils.toWei("1"));
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });
    var timeToFinishRewardPlan =
      (await rewardController.epochLength()) *
      (await rewardController.MULTIPLIERS_LENGTH());
    await utils.increaseTime(timeToFinishRewardPlan);

    // TODO: Create new massUpdatePools
    // try {
    //   await rewardController.massUpdatePools(0, 2);
    //   assert(false, "massUpdatePools not in range");
    // } catch (ex) {
    //   assertVMException(ex, "InvalidPoolRange");
    // }
    // await rewardController.massUpdatePools(0, 1);
    await rewardController.updateVault(vault.address);

    let expectedReward = await rewardController.getPendingReward(vault.address, staker);
    await safeRedeem(vault, web3.utils.toWei("1"), staker);
    tx = await rewardController.claimReward(vault.address, staker, { from: staker });

    //staker gets stake back
    assert.equal(await stakingToken.balanceOf(staker), web3.utils.toWei("1"));
    //and gets all rewards
    assert.equal(
      (await hatToken.balanceOf(staker)).toString(),
      tx.logs[0].args.amount.toString()
    );
    assert.isTrue(
      parseInt(tx.logs[0].args.amount.toString()) >=
        parseInt(expectedReward.toString())
    );
    assert.equal(
      hatsAvailable.toString(),
      (await hatToken.balanceOf(rewardController.address))
        .add(tx.logs[0].args.amount)
        .toString()
    );
  });

  it("approve + swapBurnSend", async () => {
    await setup(accounts, 0, 8000, [8000, 1000, 0, 250, 350, 400]);
    var staker = accounts[4];
    await stakingToken.approve(vault.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await stakingToken.mint(staker, web3.utils.toWei("1"));
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });
    assert.equal(await hatToken.balanceOf(staker), 0);
    await utils.increaseTime(7 * 24 * 3600);
    let path = ethers.utils.solidityPack(
      ["address", "uint24", "address", "uint24", "address"],
      [stakingToken.address, 0, utils.NULL_ADDRESS, 0, hatToken.address]
    );
    let amountToSwapAndBurn = await hatVaultsRegistry.swapAndBurn(stakingToken.address);
    let amountForHackersHatRewards = await hatVaultsRegistry.hackersHatReward(
      stakingToken.address,
      accounts[2]
    );
    let amount = amountToSwapAndBurn
      .add(amountForHackersHatRewards)
      .add(await hatVaultsRegistry.governanceHatReward(stakingToken.address));
    let payload = ISwapRouter.encodeFunctionData("exactInput", [
      [path, hatVaultsRegistry.address, 0, amount.toString(), 0],
    ]);

    try {
      await hatVaultsRegistry.swapBurnSend(stakingToken.address, accounts[2], 0, router.address, payload);
      assert(false, "cannot swapBurnSend before approve");
    } catch (ex) {
      assertVMException(ex, "AmountToSwapIsZero");
    }
    await advanceToSafetyPeriod();
    await vault.submitClaim(
      accounts[2],
      8000,
      "description hash",
      {
        from: accounts[1],
      }
    );

    await utils.increaseTime(60 * 60 * 24);

    await vault.approveClaim(8000);
    await stakingToken.approveDisable(true);
    try {
      await hatVaultsRegistry.swapBurnSend(stakingToken.address, accounts[2], 0, router.address, payload);
      assert(false, "approve disabled");
    } catch (ex) {
      assertVMException(ex, "SafeERC20: ERC20 operation did not succeed");
    }
    await stakingToken.approveDisable(false);
    await stakingToken.approveZeroDisable(true);
    try {
      await hatVaultsRegistry.swapBurnSend(stakingToken.address, accounts[2], 0, router.address, payload);
      assert(false, "approve to 0 disabled");
    } catch (ex) {
      assertVMException(ex, "SafeERC20: ERC20 operation did not succeed");
    }
    await stakingToken.approveZeroDisable(false);
    amountToSwapAndBurn = await hatVaultsRegistry.swapAndBurn(stakingToken.address);
    amountForHackersHatRewards = await hatVaultsRegistry.hackersHatReward(
      stakingToken.address,
      accounts[2]
    );
    amount = amountToSwapAndBurn
      .add(amountForHackersHatRewards)
      .add(await hatVaultsRegistry.governanceHatReward(stakingToken.address));
    payload = ISwapRouter.encodeFunctionData("exactInput", [
      [path, hatVaultsRegistry.address, 0, amount.toString(), 0],
    ]);
    let tx = await hatVaultsRegistry.swapBurnSend(
      stakingToken.address, 
      accounts[2],
      0,
      router.address,
      payload
    );
    assert.equal(
      await stakingToken.allowance(vault.address, await router.address),
      0
    );
    assert.equal(tx.logs[0].event, "SwapAndBurn");
    var expectedHatBurned = new web3.utils.BN(web3.utils.toWei("0.8"))
      .mul(new web3.utils.BN("250"))
      .div(new web3.utils.BN(10000));
    assert.equal(
      tx.logs[0].args._amountBurned.toString(),
      expectedHatBurned.toString()
    );
    assert.equal(tx.logs[2].event, "SwapAndSend");
    var vestingTokenLock = await HATTokenLock.at(tx.logs[2].args._tokenLock);
    assert.equal(
      await vestingTokenLock.owner(),
      "0x000000000000000000000000000000000000dEaD"
    );
    assert.equal(
      (await hatToken.balanceOf(vestingTokenLock.address)).toString(),
      tx.logs[2].args._amountReceived.toString()
    );
    var expectedHackerReward = new web3.utils.BN(web3.utils.toWei("0.8"))
      .mul(new web3.utils.BN(4))
      .div(new web3.utils.BN(100));
    assert.equal(
      tx.logs[2].args._amountReceived.toString(),
      expectedHackerReward.toString()
    );
    assert.equal(await vestingTokenLock.canDelegate(), true);
    await vestingTokenLock.delegate(accounts[4], { from: accounts[2] });
    try {
      await vestingTokenLock.cancelLock();
      assert(false, "cannot cancel lock");
    } catch (ex) {
      assertVMException(ex);
    }
    assert.equal(
      await hatToken.delegates(vestingTokenLock.address),
      accounts[4]
    );
    try {
      await hatVaultsRegistry.swapBurnSend(stakingToken.address, accounts[2], 0, router.address, payload);
      assert(false, "cannot swapBurnSend twice");
    } catch (ex) {
      assertVMException(ex, "AmountToSwapIsZero");
    }
  });

  it("approve + swapBurnSend weth vault", async () => {
    await setup(
      accounts,
      0,
      8000,
      [8000, 1000, 0, 250, 350, 400],
      10,
      0,
      100,
      utils.NULL_ADDRESS
    );
    assert.equal(await router.WETH9(), stakingToken.address);
    var staker = accounts[4];
    await stakingToken.approve(vault.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await stakingToken.mint(staker, web3.utils.toWei("1"));
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });
    assert.equal(await hatToken.balanceOf(staker), 0);
    await utils.increaseTime(7 * 24 * 3600);
    await advanceToSafetyPeriod();
    await vault.submitClaim(
      accounts[2],
      8000,
      "description hash",
      {
        from: accounts[1],
      }
    );

    await utils.increaseTime(60 * 60 * 24);

    await vault.approveClaim(8000);
    await stakingToken.approveDisable(true);

    await stakingToken.approveDisable(false);
    let path = ethers.utils.solidityPack(
      ["address", "uint24", "address"],
      [stakingToken.address, 0, hatToken.address]
    );
    let amountToSwapAndBurn = await hatVaultsRegistry.swapAndBurn(stakingToken.address);
    let amountForHackersHatRewards = await hatVaultsRegistry.hackersHatReward(
      stakingToken.address,
      accounts[2]
    );
    let amount = amountToSwapAndBurn
      .add(amountForHackersHatRewards)
      .add(await hatVaultsRegistry.governanceHatReward(stakingToken.address));
    let payload = ISwapRouter.encodeFunctionData("exactInput", [
      [path, hatVaultsRegistry.address, 0, amount.toString(), 0],
    ]);
    let tx = await hatVaultsRegistry.swapBurnSend(
      stakingToken.address, 
      accounts[2],
      0,
      router.address,
      payload
    );
    assert.equal(tx.logs[0].event, "SwapAndBurn");
    var expectedHatBurned = new web3.utils.BN(web3.utils.toWei("0.8"))
      .mul(new web3.utils.BN("250"))
      .div(new web3.utils.BN(10000));
    assert.equal(
      tx.logs[0].args._amountBurned.toString(),
      expectedHatBurned.toString()
    );
    assert.equal(tx.logs[2].event, "SwapAndSend");
    var vestingTokenLock = await HATTokenLock.at(tx.logs[2].args._tokenLock);
    assert.equal(
      (await hatToken.balanceOf(vestingTokenLock.address)).toString(),
      tx.logs[2].args._amountReceived.toString()
    );
    var expectedHackerReward = new web3.utils.BN(web3.utils.toWei("0.8"))
      .mul(new web3.utils.BN(4))
      .div(new web3.utils.BN(100));
    assert.equal(
      tx.logs[2].args._amountReceived.toString(),
      expectedHackerReward.toString()
    );
  });

  it("approve+ swapBurnSend with HAT vault", async () => {
    await setup(accounts);
    var staker = accounts[4];
    let newVault = await HATVault.at((await hatVaultsRegistry.createVault(
      hatToken.address,
      accounts[1],
      rewardController.address,
      8000,
      [6000, 2000, 500, 0, 1000, 500],
      "_descriptionHash",
      [86400, 10],
      false
    )).logs[0].args._vault);

    await rewardController.setAllocPoint(
      newVault.address,
      100
    );

    await hatToken.approve(newVault.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await utils.setMinter(hatToken, accounts[0], web3.utils.toWei("1"));
    await hatToken.mint(staker, web3.utils.toWei("1"));
    await newVault.committeeCheckIn({ from: accounts[1] });
    await newVault.deposit(web3.utils.toWei("1"), staker, { from: staker });
    assert.equal(await hatToken.balanceOf(staker), 0);
    assert.equal(
      await hatToken.balanceOf(newVault.address),
      web3.utils.toWei("1")
    );

    await utils.increaseTime(7 * 24 * 3600);
    let path = ethers.utils.solidityPack(
      ["address", "uint24", "address", "uint24", "address"],
      [stakingToken.address, 0, utils.NULL_ADDRESS, 0, hatToken.address]
    );
    let amountToSwapAndBurn = await hatVaultsRegistry.swapAndBurn(hatToken.address);
    let amountForHackersHatRewards = await hatVaultsRegistry.hackersHatReward(
      hatToken.address,
      accounts[2]
    );
    let amount = amountToSwapAndBurn
      .add(amountForHackersHatRewards)
      .add(await hatVaultsRegistry.governanceHatReward(hatToken.address));
    let payload = ISwapRouter.encodeFunctionData("exactInput", [
      [path, hatVaultsRegistry.address, 0, amount.toString(), 0],
    ]);
    try {
      await hatVaultsRegistry.swapBurnSend(hatToken.address, accounts[2], 0, router.address, payload);
      assert(false, "cannot swapBurnSend before approve");
    } catch (ex) {
      assertVMException(ex, "AmountToSwapIsZero");
    }
    await advanceToSafetyPeriod();
    await newVault.submitClaim(
      accounts[2],
      8000,
      "description hash",
      {
        from: accounts[1],
      }
    );

    await utils.increaseTime(60 * 60 * 24);

    await newVault.approveClaim(8000);
    assert.equal(await hatToken.balanceOf(accounts[0]), 0);
    amountToSwapAndBurn = await hatVaultsRegistry.swapAndBurn(hatToken.address);
    amountForHackersHatRewards = await hatVaultsRegistry.hackersHatReward(
      hatToken.address,
      accounts[2]
    );
    amount = amountToSwapAndBurn
      .add(amountForHackersHatRewards)
      .add(await hatVaultsRegistry.governanceHatReward(hatToken.address));
    payload = ISwapRouter.encodeFunctionData("exactInput", [
      [path, hatVaultsRegistry.address, 0, amount.toString(), 0],
    ]);
    let tx = await hatVaultsRegistry.swapBurnSend(
      hatToken.address,
      accounts[2],
      0,
      router.address,
      payload
    );
    //gov gets 10% out of 80% of the vault value
    assert.equal(
      (await hatToken.balanceOf(accounts[0])).toString(),
      web3.utils.toWei("0.08")
    );
    assert.equal(tx.logs[0].event, "SwapAndBurn");
    var expectedHatBurned = 0; //default hat burned is 0
    assert.equal(tx.logs[0].args._amountBurned.toString(), expectedHatBurned);
    assert.equal(tx.logs[2].event, "SwapAndSend");
    var vestingTokenLock = await HATTokenLock.at(tx.logs[2].args._tokenLock);
    assert.equal(
      (await hatToken.balanceOf(vestingTokenLock.address)).toString(),
      tx.logs[2].args._amountReceived.toString()
    );
    var expectedHackerReward = new web3.utils.BN(web3.utils.toWei("1"))
      .mul(new web3.utils.BN(4))
      .div(new web3.utils.BN(100));
    assert.equal(
      tx.logs[2].args._amountReceived.toString(),
      expectedHackerReward.toString()
    );
    assert.equal(await vestingTokenLock.canDelegate(), true);
    await vestingTokenLock.delegate(accounts[4], { from: accounts[2] });
    assert.equal(
      await hatToken.delegates(vestingTokenLock.address),
      accounts[4]
    );
    try {
      await hatVaultsRegistry.swapBurnSend(hatToken.address, accounts[2], 0, router.address, payload);
      assert(false, "cannot swapBurnSend twice");
    } catch (ex) {
      assertVMException(ex, "AmountToSwapIsZero");
    }
  });

  it("Update vault info", async () => {
    await setup(accounts);

    try {
      await hatVaultsRegistry.updateVaultVisibility(vault.address, true, { from: accounts[1] });
      assert(false, "only gov");
    } catch (ex) {
      assertVMException(ex, "Ownable: caller is not the owner");
    }

    let tx = await hatVaultsRegistry.updateVaultVisibility(vault.address, true);
    assert.equal(tx.logs[0].event, "UpdateVaultVisibility");
    assert.equal(tx.logs[0].args._visible, true);

    try {
      await vault.updateVaultDescription("_descriptionHash");
      assert(false, "only committee");
    } catch (ex) {
      assertVMException(ex, "OnlyCommittee");
    }
    tx = await vault.updateVaultDescription("_descriptionHash", { from: accounts[1] });
    assert.equal(tx.logs[0].args._descriptionHash, "_descriptionHash");
    await rewardController.setAllocPoint(vault.address, 200);

    var staker = accounts[4];
    await stakingToken.approve(vault.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await stakingToken.mint(staker, web3.utils.toWei("1"));
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });
    assert.equal(await hatToken.balanceOf(staker), 0);
    await rewardController.setAllocPoint(vault.address, 200);
    let expectedReward = await calculateExpectedReward(staker);
    assert.equal(await stakingToken.balanceOf(staker), 0);
    tx = await rewardController.claimReward(vault.address, staker, { from: staker });
    assert.equal(tx.logs[0].event, "ClaimReward");
    assert.equal(tx.logs[0].args._vault, vault.address);
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

  it("swapAndBurn bounty check", async () => {
    await setup(accounts);
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

    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });

    assert.equal(await hatToken.balanceOf(staker), 0);
    await utils.increaseTime(7 * 24 * 3600);
    await advanceToSafetyPeriod();
    await vault.submitClaim(
      accounts[2],
      8000,
      "description hash",
      {
        from: accounts[1],
      }
    );

    await utils.increaseTime(60 * 60 * 24);

    await vault.approveClaim(8000);
    let path = ethers.utils.solidityPack(
      ["address", "uint24", "address", "uint24", "address"],
      [stakingToken.address, 0, utils.NULL_ADDRESS, 0, hatToken.address]
    );
    let amountToSwapAndBurn = await hatVaultsRegistry.swapAndBurn(stakingToken.address);
    let amountForHackersHatRewards = await hatVaultsRegistry.hackersHatReward(
      stakingToken.address,
      accounts[2]
    );
    let amount = amountToSwapAndBurn
      .add(amountForHackersHatRewards)
      .add(await hatVaultsRegistry.governanceHatReward(stakingToken.address));
    let payload = ISwapRouter.encodeFunctionData("exactInput", [
      [path, hatVaultsRegistry.address, 0, amount.toString(), 0],
    ]);
    let tx = await hatVaultsRegistry.swapBurnSend(
      stakingToken.address,
      accounts[2],
      0,
      router.address,
      payload
    );
    assert.equal(tx.logs[0].event, "SwapAndBurn");
    assert.equal(
      tx.logs[0].args._amountSwapped.toString(),
      new web3.utils.BN(web3.utils.toWei("0.8"))
        .mul(
          new web3.utils.BN(
            (await vault.bountySplit()).swapAndBurn
          )
            .add(
              new web3.utils.BN(
                (await vault.bountySplit()).hackerHatVested
              )
            )
            .add(
              new web3.utils.BN(
                (await vault.bountySplit()).governanceHat
              )
            )
        )
        .div(new web3.utils.BN("10000"))
        .toString()
    );
    assert.equal(
      tx.logs[0].args._amountBurned.toString(),
      new web3.utils.BN(web3.utils.toWei("0.8"))
        .mul(
          new web3.utils.BN(
            (await vault.bountySplit()).swapAndBurn
          )
        )
        .div(new web3.utils.BN("10000"))
        .toString()
    );

    assert.equal(
      tx.logs[2].args._amountReceived.toString(),
      new web3.utils.BN(web3.utils.toWei("0.8"))
        .mul(
          new web3.utils.BN(
            (await vault.bountySplit()).hackerHatVested
          )
        )
        .div(new web3.utils.BN("10000"))
        .toString()
    );
    let afterBountyBalance = (
      await hatToken.balanceOf(tx.logs[2].args._tokenLock)
    ).toString();
    assert.equal(
      tx.logs[2].args._amountReceived.toString(),
      afterBountyBalance
    );
  });

  it("swapBurnSend", async () => {
    await setup(accounts);
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

    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });

    assert.equal(await hatToken.balanceOf(staker), 0);
    await utils.increaseTime(7 * 24 * 3600);
    await advanceToSafetyPeriod();
    await vault.submitClaim(
      accounts[2],
      8000,
      "description hash",
      {
        from: accounts[1],
      }
    );

    await utils.increaseTime(60 * 60 * 24);

    await vault.approveClaim(8000);

    let path = ethers.utils.solidityPack(
      ["address", "uint24", "address", "uint24", "address"],
      [stakingToken.address, 0, utils.NULL_ADDRESS, 0, hatToken.address]
    );
    let amountToSwapAndBurn = await hatVaultsRegistry.swapAndBurn(stakingToken.address);
    let amountForHackersHatRewards = await hatVaultsRegistry.hackersHatReward(
      stakingToken.address,
      accounts[1]
    );
    let amount = amountToSwapAndBurn
      .add(amountForHackersHatRewards)
      .add(await hatVaultsRegistry.governanceHatReward(stakingToken.address));
    let payload = ISwapRouter.encodeFunctionData("exactInput", [
      [path, hatVaultsRegistry.address, 0, amount.toString(), 0],
    ]);

    try {
      await hatVaultsRegistry.swapBurnSend(stakingToken.address, accounts[1], 0, router.address, payload, {
        from: accounts[3],
      });
      assert(false, "only gov");
    } catch (ex) {
      assertVMException(ex, "Ownable: caller is not the owner");
    }

    try {
      await hatVaultsRegistry.swapBurnSend(stakingToken.address, accounts[1], 0, accounts[1], payload, {
        from: accounts[0],
      });
      assert(false, "can only use whitelisted routers");
    } catch (ex) {
      assertVMException(ex, "RoutingContractNotWhitelisted");
    }

    try {
      await hatVaultsRegistry.setRouterWhitelistStatus(router.address, false, {
        from: accounts[3],
      });
      assert(false, "only gov");
    } catch (ex) {
      assertVMException(ex, "Ownable: caller is not the owner");
    }

    let tx = await hatVaultsRegistry.setRouterWhitelistStatus(router.address, false, {
      from: accounts[0],
    });

    assert.equal(tx.logs[0].event, "RouterWhitelistStatusChanged");
    assert.equal(tx.logs[0].args._router, router.address);
    assert.equal(tx.logs[0].args._status, false);

    try {
      await hatVaultsRegistry.swapBurnSend(stakingToken.address, accounts[1], 0, router.address, payload, {
        from: accounts[0],
      });
      assert(false, "can only use whitelisted routers");
    } catch (ex) {
      assertVMException(ex, "RoutingContractNotWhitelisted");
    }

    tx = await hatVaultsRegistry.setRouterWhitelistStatus(router.address, true, {
      from: accounts[0],
    });

    assert.equal(tx.logs[0].event, "RouterWhitelistStatusChanged");
    assert.equal(tx.logs[0].args._router, router.address);
    assert.equal(tx.logs[0].args._status, true);

    tx = await hatVaultsRegistry.swapBurnSend(
      stakingToken.address, 
      accounts[1],
      0,
      router.address,
      payload,
      {
        from: accounts[0],
      }
    );
    assert.equal(tx.logs[0].event, "SwapAndBurn");
    assert.equal(
      tx.logs[0].args._amountSwapped.toString(),
      new web3.utils.BN(web3.utils.toWei("0.8"))
        .mul(
          new web3.utils.BN(
            (await vault.bountySplit()).swapAndBurn
          ).add(
            new web3.utils.BN(
              (await vault.bountySplit()).governanceHat
            )
          )
        )
        .div(new web3.utils.BN("10000"))
        .toString()
    );
    assert.equal(
      tx.logs[0].args._amountBurned.toString(),
      new web3.utils.BN(web3.utils.toWei("1"))
        .mul(
          new web3.utils.BN(
            (await vault.bountySplit()).swapAndBurn
          )
        )
        .div(new web3.utils.BN("10000"))
        .toString()
    );
    assert.equal(tx.logs[1].event, "SwapAndSend");
    assert.equal(tx.logs[1].args._amountReceived.toString(), "0");
    // Not real beneficiary should not get tokens
    let afterBountyBalance = (
      await hatToken.balanceOf(tx.logs[1].args._tokenLock)
    ).toString();
    assert.equal(
      tx.logs[1].args._tokenLock,
      "0x0000000000000000000000000000000000000000"
    );

    amountToSwapAndBurn = await hatVaultsRegistry.swapAndBurn(stakingToken.address);
    amountForHackersHatRewards = await hatVaultsRegistry.hackersHatReward(
      stakingToken.address,
      accounts[2]
    );
    amount = amountToSwapAndBurn
      .add(amountForHackersHatRewards)
      .add(await hatVaultsRegistry.governanceHatReward(stakingToken.address));
    payload = ISwapRouter.encodeFunctionData("exactInput", [
      [path, hatVaultsRegistry.address, 0, amount.toString(), 0],
    ]);

    tx = await hatVaultsRegistry.swapBurnSend(
      stakingToken.address, 
      accounts[2],
      0,
      router.address,
      payload,
      {
        from: accounts[0],
      }
    );

    assert.equal(tx.logs[0].event, "SwapAndBurn");
    assert.equal(tx.logs[0].args._amountBurned.toString(), "0");
    assert.equal(
      tx.logs[2].args._amountReceived.toString(),
      new web3.utils.BN(web3.utils.toWei("0.8"))
        .mul(
          new web3.utils.BN(
            (await vault.bountySplit()).hackerHatVested
          )
        )
        .div(new web3.utils.BN("10000"))
        .toString()
    );
    afterBountyBalance = (
      await hatToken.balanceOf(tx.logs[2].args._tokenLock)
    ).toString();
    assert.equal(
      tx.logs[2].args._amountReceived.toString(),
      afterBountyBalance
    );

    try {
      tx = await hatVaultsRegistry.swapBurnSend(
        stakingToken.address, 
        accounts[1],
        0,
        router.address,
        payload,
        {
          from: accounts[0],
        }
      );
      assert(false, "can claim only once, nothing to redeem or burn");
    } catch (ex) {
      assertVMException(ex, "AmountToSwapIsZero");
    }

    try {
      tx = await hatVaultsRegistry.swapBurnSend(
        stakingToken.address, 
        accounts[2],
        0,
        router.address,
        payload,
        {
          from: accounts[0],
        }
      );
      assert(false, "can claim only once, nothing to redeem or burn");
    } catch (ex) {
      assertVMException(ex, "AmountToSwapIsZero");
    }
  });

  it("swapBurnSend 2 vaults with same token", async () => {
    await setup(accounts);

    let newVault = await HATVault.at((await hatVaultsRegistry.createVault(
      stakingToken.address,
      accounts[1],
      rewardController.address,
      8000,
      [8000, 1000, 100, 150, 350, 400],
      "_descriptionHash",
      [86400, 10],
      false
    )).logs[0].args._vault);

    await rewardController.setAllocPoint(
      newVault.address,
      100
    );

    await newVault.committeeCheckIn({ from: accounts[1] });

    var staker = accounts[4];
    var staker2 = accounts[3];

    await stakingToken.approve(vault.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await stakingToken.approve(newVault.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await stakingToken.approve(vault.address, web3.utils.toWei("1"), {
      from: staker2,
    });
    await stakingToken.approve(newVault.address, web3.utils.toWei("1"), {
      from: staker2,
    });
    await stakingToken.mint(staker, web3.utils.toWei("2"));
    await stakingToken.mint(staker2, web3.utils.toWei("2"));

    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });
    await newVault.deposit(web3.utils.toWei("1"), staker, { from: staker });

    assert.equal(await hatToken.balanceOf(staker), 0);
    await utils.increaseTime(7 * 24 * 3600);
    await advanceToSafetyPeriod();
    await vault.submitClaim(
      accounts[2],
      8000,
      "description hash",
      {
        from: accounts[1],
      }
    );

    await newVault.submitClaim(accounts[2], 8000, "description hash", {
      from: accounts[1],
    });

    await utils.increaseTime(60 * 60 * 24);

    await vault.approveClaim(8000);

    await utils.increaseTime(60 * 60 * 24 * 2);

    await newVault.approveClaim(8000);
 
    let path = ethers.utils.solidityPack(
      ["address", "uint24", "address", "uint24", "address"],
      [stakingToken.address, 0, utils.NULL_ADDRESS, 0, hatToken.address]
    );
    let amountToSwapAndBurn = await hatVaultsRegistry.swapAndBurn(stakingToken.address);
    let amountForHackersHatRewards = await hatVaultsRegistry.hackersHatReward(
      stakingToken.address,
      accounts[1]
    );
    let amount = amountToSwapAndBurn
      .add(amountForHackersHatRewards)
      .add(await hatVaultsRegistry.governanceHatReward(stakingToken.address));
    let payload = ISwapRouter.encodeFunctionData("exactInput", [
      [path, hatVaultsRegistry.address, 0, amount.toString(), 0],
    ]);
    let tx = await hatVaultsRegistry.swapBurnSend(
      stakingToken.address,
      accounts[1],
      0,
      router.address,
      payload,
      {
        from: accounts[0],
      }
    );
    assert.equal(tx.logs[0].event, "SwapAndBurn");
    assert.equal(
      tx.logs[0].args._amountSwapped.toString(),

      new web3.utils.BN(web3.utils.toWei("0.8"))
        .mul(
          new web3.utils.BN(
            (await vault.bountySplit()).swapAndBurn
          ).add(
            new web3.utils.BN(
              (await vault.bountySplit()).governanceHat
            )
          )
        )
        .div(new web3.utils.BN("10000")).add(
          new web3.utils.BN(web3.utils.toWei("0.8"))
          .mul(
            new web3.utils.BN(
              (await newVault.bountySplit()).swapAndBurn
            ).add(
              new web3.utils.BN(
                (await newVault.bountySplit()).governanceHat
              )
            )
          )
          .div(new web3.utils.BN("10000"))
        )
        .toString()
    );
    assert.equal(
      tx.logs[0].args._amountBurned.toString(),
      new web3.utils.BN(web3.utils.toWei("0.8"))
        .mul(
          new web3.utils.BN(
            (await vault.bountySplit()).swapAndBurn
          )
        )
        .div(new web3.utils.BN("10000")).add(
          new web3.utils.BN(web3.utils.toWei("0.8"))
          .mul(
            new web3.utils.BN(
              (await newVault.bountySplit()).swapAndBurn
            )
          )
          .div(new web3.utils.BN("10000"))
        )
        .toString()
    );
    assert.equal(tx.logs[1].event, "SwapAndSend");
    assert.equal(tx.logs[1].args._amountReceived.toString(), "0");
    // Not real beneficiary should not get tokens
    let afterBountyBalance = (
      await hatToken.balanceOf(tx.logs[1].args._tokenLock)
    ).toString();
    assert.equal(
      tx.logs[1].args._tokenLock,
      "0x0000000000000000000000000000000000000000"
    );
    assert.equal(
      tx.logs[1].args._amountReceived.toString(),
      afterBountyBalance
    );

    path = ethers.utils.solidityPack(
      ["address", "uint24", "address", "uint24", "address"],
      [stakingToken.address, 0, utils.NULL_ADDRESS, 0, hatToken.address]
    );
    amountToSwapAndBurn = await hatVaultsRegistry.swapAndBurn(stakingToken.address);
    amountForHackersHatRewards = await hatVaultsRegistry.hackersHatReward(
      stakingToken.address,
      accounts[2]
    );
    amount = amountToSwapAndBurn
      .add(amountForHackersHatRewards)
      .add(await hatVaultsRegistry.governanceHatReward(stakingToken.address));
    payload = ISwapRouter.encodeFunctionData("exactInput", [
      [path, hatVaultsRegistry.address, 0, amount.toString(), 0],
    ]);
    tx = await hatVaultsRegistry.swapBurnSend(
      stakingToken.address,
      accounts[2],
      0,
      router.address,
      payload,
      {
        from: accounts[0],
      }
    );

    assert.equal(tx.logs[0].event, "SwapAndBurn");
    assert.equal(tx.logs[0].args._amountBurned.toString(), "0");
    assert.equal(
      tx.logs[2].args._amountReceived.toString(),
      new web3.utils.BN(web3.utils.toWei("0.8"))
        .mul(
          new web3.utils.BN(
            (await vault.bountySplit()).hackerHatVested
          )
        )
        .div(new web3.utils.BN("10000")).add(new web3.utils.BN(web3.utils.toWei("0.8"))
        .mul(
          new web3.utils.BN(
            (await newVault.bountySplit()).hackerHatVested
          )
        )
        .div(new web3.utils.BN("10000")))
        .toString()
    );
    afterBountyBalance = (
      await hatToken.balanceOf(tx.logs[2].args._tokenLock)
    ).toString();
    assert.equal(
      tx.logs[2].args._amountReceived.toString(),
      afterBountyBalance
    );
  });

  it("swapBurnSend return below than minimum should revert", async () => {
    await setup(
      accounts,
      (await web3.eth.getBlock("latest")).number,
      9000,
      [8000, 1000, 100, 100, 100, 700],
      2
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

    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });

    assert.equal(await hatToken.balanceOf(staker), 0);
    await utils.increaseTime(7 * 24 * 3600);
    await advanceToSafetyPeriod();
    await vault.submitClaim(
      accounts[2],
      8000,
      "description hash",
      {
        from: accounts[1],
      }
    );

    await utils.increaseTime(60 * 60 * 24);

    await vault.approveClaim(8000);
    let path = ethers.utils.solidityPack(
      ["address", "uint24", "address", "uint24", "address"],
      [stakingToken.address, 0, utils.NULL_ADDRESS, 0, hatToken.address]
    );
    let amountToSwapAndBurn = await hatVaultsRegistry.swapAndBurn(stakingToken.address);
    let amountForHackersHatRewards = await hatVaultsRegistry.hackersHatReward(
      stakingToken.address,
      accounts[1]
    );
    let amount = amountToSwapAndBurn
      .add(amountForHackersHatRewards)
      .add(await hatVaultsRegistry.governanceHatReward(stakingToken.address));
    let payload = ISwapRouter.encodeFunctionData("exactInput", [
      [path, hatVaultsRegistry.address, 0, amount.toString(), 0],
    ]);
    try {
      await hatVaultsRegistry.swapBurnSend(
        stakingToken.address,
        accounts[1],
        web3.utils.toWei("1"),
        router.address,
        payload,
        { from: accounts[0] }
      );
      assert(false, "router return less than minimum");
    } catch (ex) {
      assertVMException(ex, "AmountSwappedLessThanMinimum");
    }
  });

  it("swapBurnSend with bad call should revert", async () => {
    await setup(accounts, (await web3.eth.getBlock("latest")).number, 9000, [
      8000,
      1000,
      100,
      100,
      100,
      700,
    ]);

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

    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });

    assert.equal(await hatToken.balanceOf(staker), 0);
    await utils.increaseTime(7 * 24 * 3600);
    await advanceToSafetyPeriod();
    await vault.submitClaim(
      accounts[2],
      8000,
      "description hash",
      {
        from: accounts[1],
      }
    );

    await utils.increaseTime(60 * 60 * 24);

    await vault.approveClaim(8000);
    let payload = "0x00000000000000000000000000000000000001";
    try {
      await hatVaultsRegistry.swapBurnSend(
        stakingToken.address,
        accounts[1],
        web3.utils.toWei("1"),
        router.address,
        payload,
        { from: accounts[0] }
      );
      assert(false, "swap should not be successful");
    } catch (ex) {
      assertVMException(ex, "SwapFailed");
    }
  });

  it("log claim", async () => {
    await setup(accounts);
    let someHash = "0x00000000000000000000000000000000000001";
    let fee = web3.utils.toWei("1");
    var tx = await vault.logClaim(someHash, { from: accounts[3] });
    assert.equal(tx.logs[0].event, "LogClaim");
    assert.equal(tx.logs[0].args._descriptionHash, someHash);
    assert.equal(tx.logs[0].args._claimer, accounts[3]);

    tx = await hatVaultsRegistry.setClaimFee(fee);
    assert.equal(tx.logs[0].event, "SetClaimFee");
    assert.equal(tx.logs[0].args._fee, fee);
    var govBalanceBefore = new web3.utils.BN(
      await web3.eth.getBalance(accounts[0])
    );
    try {
      await vault.logClaim(someHash, {
        from: accounts[3],
        value: web3.utils.toWei("0.9"),
      });
      assert(false, "fee is not enough");
    } catch (ex) {
      assertVMException(ex, "NotEnoughFeePaid");
    }
    tx = await vault.logClaim(someHash, {
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

  it("vesting", async () => {
    await setup(accounts);
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
    await vault.submitClaim(
      accounts[2],
      8000,
      "description hash",
      {
        from: accounts[1],
      }
    );

    await utils.increaseTime(60 * 60 * 24);

    let tx = await vault.approveClaim(8000);
    assert.equal(tx.logs[6].event, "ApproveClaim");
    var vestingTokenLock = await HATTokenLock.at(tx.logs[6].args._tokenLock);
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
      new web3.utils.BN(tx.logs[6].args._claimBounty.hackerVested).eq(
        expectedHackerBalance
      )
    );
    assert.isTrue(
      expectedHackerBalance.eq(await vestingTokenLock.managedAmount())
    );
    assert.equal(await vestingTokenLock.revocable(), 2); //Disable
    assert.equal(await vestingTokenLock.canDelegate(), false);

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
    //hacker get also rewards via none vesting
    var hackerPriviosBalance = new web3.utils.BN("160000000000000000");
    assert.isTrue(
      (await stakingToken.balanceOf(accounts[2]))
        .sub(hackerPriviosBalance)
        .eq(expectedHackerBalance.div(new web3.utils.BN(10)))
    );

    await utils.increaseTime(8640 * 9);
    await vestingTokenLock.release({ from: accounts[2] });
    assert.isTrue(
      (await stakingToken.balanceOf(accounts[2]))
        .sub(hackerPriviosBalance)
        .eq(expectedHackerBalance)
    );
    try {
      await vestingTokenLock.withdrawSurplus(1, { from: accounts[2] });
      assert(false, "no Surplus");
    } catch (ex) {
      assertVMException(ex);
    }
    await stakingToken.mint(vestingTokenLock.address, 10);
    //await stakingToken.transfer(vestingTokenLock.address,10);
    tx = await vestingTokenLock.withdrawSurplus(1, { from: accounts[2] });
    assert.equal(tx.logs[0].event, "TokensWithdrawn");
    assert.equal(tx.logs[0].args.amount, 1);
  });

  it("no vesting", async () => {
    await setup(accounts, 0, 8000, [0, 10000, 0, 0, 0, 0]);

    var staker = accounts[4];
    await stakingToken.approve(vault.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await stakingToken.mint(staker, web3.utils.toWei("1"));

    //stake
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });
    await utils.increaseTime(7 * 24 * 3600);
    await advanceToSafetyPeriod();
    await vault.submitClaim(
      accounts[2],
      8000,
      "description hash",
      {
        from: accounts[1],
      }
    );

    await utils.increaseTime(60 * 60 * 24);

    let tx = await vault.approveClaim(8000);
    assert.equal(tx.logs[5].event, "ApproveClaim");
    assert.equal(tx.logs[5].args._tokenLock, utils.NULL_ADDRESS);
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
    await setup(accounts);
    assert.equal(await vault.vestingDuration(), 86400);
    assert.equal(await vault.vestingPeriods(), 10);

    try {
      await vault.setVestingParams(21000, 7);
      assert(false, "only committee can set vesting params");
    } catch (ex) {
      assertVMException(ex, "OnlyCommittee");
    }
    try {
      await vault.setVestingParams(21000, 0, { from: accounts[1] });
      assert(false, "period should not be zero");
    } catch (ex) {
      assertVMException(ex, "VestingPeriodsCannotBeZero");
    }
    try {
      await vault.setVestingParams(120 * 24 * 3600, 7, { from: accounts[1] });
      assert(false, "duration should be less than 120 days");
    } catch (ex) {
      assertVMException(ex, "VestingDurationTooLong");
    }
    try {
      await vault.setVestingParams(6, 7, { from: accounts[1] });
      assert(false, "duration should be greater than or equal to period");
    } catch (ex) {
      assertVMException(ex, "VestingDurationSmallerThanPeriods");
    }
    var tx = await vault.setVestingParams(21000, 7, { from: accounts[1] });
    assert.equal(tx.logs[0].event, "SetVestingParams");
    assert.equal(tx.logs[0].args._duration, 21000);
    assert.equal(tx.logs[0].args._periods, 7);

    assert.equal(await vault.vestingDuration(), 21000);
    assert.equal(await vault.vestingPeriods(), 7);
  });

  it("set hat vesting params", async () => {
    await setup(accounts);
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
      assertVMException(ex, "VestingPeriodsCannotBeZero");
    }
    try {
      await hatVaultsRegistry.setHatVestingParams(180 * 24 * 3600, 7);
      assert(false, "duration should be less than 180 days");
    } catch (ex) {
      assertVMException(ex, "VestingDurationTooLong");
    }
    try {
      await hatVaultsRegistry.setHatVestingParams(6, 7);
      assert(false, "duration should be greater than or equal to period");
    } catch (ex) {
      assertVMException(ex, "VestingDurationSmallerThanPeriods");
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
    await setup(accounts);
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
      assertVMException(ex, "WithdrawMoreThanMax");
    }

    await advanceToSafetyPeriod();

    try {
      await vault.withdraw(web3.utils.toWei("1"), staker, staker, { from: staker });
      assert(false, "cannot withdraw on safety period");
    } catch (ex) {
      assertVMException(ex, "WithdrawMoreThanMax");
    }
  });

  it("createVault with zero alloc point", async () => {
    await setup(accounts, (await web3.eth.getBlock("latest")).number);
    var staker = accounts[1];
    let stakingToken2 = await ERC20Mock.new("Staking", "STK");
    let newVault = await HATVault.at((await hatVaultsRegistry.createVault(
      stakingToken2.address,
      accounts[0],
      rewardController.address,
      8000,
      [6000, 2000, 500, 0, 1000, 500],
      "_descriptionHash",
      [86400, 10],
      false
    )).logs[0].args._vault);
    await hatVaultsRegistry.updateVaultVisibility(newVault.address, true);
    await rewardController.setAllocPoint(newVault.address, 200);
    await hatVaultsRegistry.updateVaultVisibility(newVault.address, true);
    await rewardController.setAllocPoint(newVault.address, 0);
    await stakingToken2.approve(newVault.address, web3.utils.toWei("2"), {
      from: staker,
    });
    await stakingToken2.mint(staker, web3.utils.toWei("2"));
    await newVault.committeeCheckIn({ from: accounts[0] });
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

  it("creat vault x2 v2", async () => {
    await setup(
      accounts,
      (await web3.eth.getBlock("latest")).number,
      8000,
      [6000, 2000, 500, 0, 1000, 500],
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
        stakingToken2.address,
        accounts[1],
        rewardController.address,
        8000,
        [6000, 2000, 500, 0, 1000, 500],
        "_descriptionHash",
        [10, 86400],
        false
      );
      assert(false, "vesting duration smaller than period");
    } catch (ex) {
      assertVMException(ex, "VestingDurationSmallerThanPeriods");
    }

    try {
      await hatVaultsRegistry.createVault(
        stakingToken2.address,
        accounts[1],
        rewardController.address,
        8000,
        [6000, 2000, 500, 0, 1000, 500],
        "_descriptionHash",
        [121 * 24 * 3600, 10],
        false
      );
      assert(false, "vesting duration is too long");
    } catch (ex) {
      assertVMException(ex, "VestingDurationTooLong");
    }

    try {
      await hatVaultsRegistry.createVault(
        stakingToken2.address,
        accounts[1],
        rewardController.address,
        8000,
        [6000, 2000, 500, 0, 1000, 500],
        "_descriptionHash",
        [86400, 0],
        false
      );
      assert(false, "vesting period cannot be zero");
    } catch (ex) {
      assertVMException(ex, "VestingPeriodsCannotBeZero");
    }
    let newVault = await HATVault.at((await hatVaultsRegistry.createVault(
      stakingToken2.address,
      accounts[1],
      rewardController.address,
      8000,
      [6000, 2000, 500, 0, 1000, 500],
      "_descriptionHash",
      [86400, 10],
      false
    )).logs[0].args._vault);

    await rewardController.setAllocPoint(
      newVault.address,
      100
    );

    await newVault.setCommittee(accounts[0], { from: accounts[1] });
    await stakingToken2.approve(newVault.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await stakingToken2.mint(staker, web3.utils.toWei("1"));

    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });
    await newVault.committeeCheckIn({ from: accounts[0] });
    await newVault.deposit(web3.utils.toWei("1"), staker, { from: staker });

    await hatVaultsRegistry.updateVaultVisibility(vault.address, true);
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
    let hatToken1 = await HATTokenMock.new(accounts[0], utils.TIME_LOCK_DELAY);
    let router1 = await UniSwapV3RouterMock.new(0, utils.NULL_ADDRESS);
    var tokenLock1 = await HATTokenLock.new();
    let tokenLockFactory1 = await TokenLockFactory.new(tokenLock1.address);
    var vaultsManager = await VaultsManagerMock.new();
    let deployment = await deployHatVaults(
      hatToken1.address,
      1,
      rewardPerEpoch,
      10,
      vaultsManager.address,
      hatToken1.address,
      [router1.address],
      tokenLockFactory1.address,
      true
    );

    hatVaultsRegistry1 = await HATVaultsRegistry.at(deployment.hatVaultsRegistry.address);
    rewardController1 = await RewardController.at(
      deployment.rewardController.address
    );
    var globalVaultsUpdatesLength = await rewardController1.getGlobalVaultsUpdatesLength();
    assert.equal(globalVaultsUpdatesLength, 0);
    let stakingToken2 = await ERC20Mock.new("Staking", "STK");
    const vault1 = await HATVault.at((await hatVaultsRegistry1.createVault(
      stakingToken2.address,
      accounts[1],
      rewardController1.address,
      8000,
      [8000, 1000, 100, 150, 350, 400],
      "_descriptionHash",
      [86400, 10],
      false
    )).logs[0].args._vault);

    await rewardController1.updateVault(vault1.address);
    await rewardController1.updateVault(vault1.address);

    globalVaultsUpdatesLength = await rewardController1.getGlobalVaultsUpdatesLength();
    assert.equal(globalVaultsUpdatesLength, 0);
  });

  it("stop in the middle", async () => {
    await setup(
      accounts,
      (await web3.eth.getBlock("latest")).number,
      8000,
      [6000, 2000, 500, 0, 1000, 500],
      10,
      0,
      100,
      false,
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
    let hatTokenCap = await hatToken.CAP();
    let amountToMint = hatTokenCap.sub(hatTotalSupply);
    await utils.setMinter(hatToken, accounts[0], amountToMint);
    await hatToken.mint(accounts[0], amountToMint);
    await hatToken.transfer(rewardController.address, amountToMint);

    await safeRedeem(vault, web3.utils.toWei("1"), staker);
    tx = await rewardController.claimReward(vault.address, staker, { from: staker });
    assert.equal(await stakingToken.balanceOf(staker), web3.utils.toWei("2"));
    let userHatRewards = tx.logs[0].args.amount;
    assert.equal(
      userHatRewards.toString(),
      (await hatToken.balanceOf(staker)).toString()
    );

    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });
    await utils.mineBlock(1);
    await safeRedeem(vault, web3.utils.toWei("1"), staker);
    tx = await rewardController.claimReward(vault.address, staker, { from: staker });
    userHatRewards = userHatRewards.add(tx.logs[0].args.amount);
    assert.equal(
      userHatRewards.toString(),
      (await hatToken.balanceOf(staker)).toString()
    );
  });

  it("check deep alloc history", async () => {
    await setup(
      accounts,
      (await web3.eth.getBlock("latest")).number,
      8000,
      [6000, 2000, 500, 0, 1000, 500],
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
    var tx = await vault.deposit(web3.utils.toWei("1"), staker, {
      from: staker,
    });
    //10
    let newVault = await HATVault.at((await hatVaultsRegistry.createVault(
      stakingToken2.address,
      accounts[1],
      rewardController.address,
      8000,
      [6000, 2000, 500, 0, 1000, 500],
      "_descriptionHash",
      [86400, 10],
      false
    )).logs[0].args._vault);

    await rewardController.setAllocPoint(
      newVault.address,
      100
    );

    //5
    await newVault.setCommittee(accounts[0], { from: accounts[1] });
    //5
    await hatVaultsRegistry.updateVaultVisibility(newVault.address, true);
    await rewardController.setAllocPoint(newVault.address, 300);
    //2.5
    assert.equal((await hatToken.balanceOf(staker)).toString(), 0);
    assert.equal(await rewardController.getGlobalVaultsUpdatesLength(), 3);
    assert.equal(
      (await rewardController.vaultInfo(vault.address)).lastRewardBlock,
      tx.receipt.blockNumber
    );
    await rewardController.claimReward(vault.address, staker, { from: staker });
    assert.equal(
      (await hatToken.balanceOf(staker)).toString(),
      await web3.utils.toWei("1654.875").toString()
    );
  });

  it("deposit twice on the same block", async () => {
    await setup(accounts);
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
    await setup(accounts);
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

  it("withdraw+ deposit + addition HAT ", async () => {
    await setup(accounts, (await web3.eth.getBlock("latest")).number);
    var staker = accounts[1];
    var staker2 = accounts[5];
    let newVault = await HATVault.at((await hatVaultsRegistry.createVault(
      hatToken.address,
      accounts[1],
      rewardController.address,
      8000,
      [6000, 2000, 500, 0, 1000, 500],
      "_descriptionHash",
      [86400, 10],
      false
    )).logs[0].args._vault);

    await rewardController.setAllocPoint(
      newVault.address,
      100
    );

    await utils.setMinter(hatToken, accounts[0], web3.utils.toWei("110"));
    await newVault.committeeCheckIn({ from: accounts[1] });

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
    var tx = await newVault.withdraw(web3.utils.toWei("1"), staker, staker, {
      from: staker,
    });
    assert.equal((await newVault.balanceOf(staker)).toString(), web3.utils.toWei("0.97087378640776699"));
    tx = await rewardController.claimReward(newVault.address, staker, { from: staker });
    assert.equal(
      (await hatToken.balanceOf(staker)).sub(tx.logs[0].args.amount).toString(),
      web3.utils.toWei("1")
    );
    await newVault.redeem(web3.utils.toWei("2"), staker2, staker2, { from: staker2 });
    tx = await rewardController.claimReward(newVault.address, staker, { from: staker });
    assert.equal(
      (await hatToken.balanceOf(staker2))
        .toString(),
      web3.utils.toWei("68.666666666666666673")
    );
  });

  it("transferReward to fail if not enough reward tokens", async () => {
    await setup(
      accounts,
      (await web3.eth.getBlock("latest")).number,
      8000,
      undefined,
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
    let expectedReward = await calculateExpectedReward(staker, 5);
    assert.isTrue(
      parseInt(hatsAvailable.toString()) < parseInt(expectedReward.toString())
    );

    try {
      await rewardController.claimReward(vault.address, staker, { from: staker });
      assert(false, "can't claim reward when there are not enough rewards");
    } catch (ex) {
      assertVMException(ex, "NotEnoughRewardsToTransferToUser");
    }

    await utils.setMinter(hatToken, accounts[0], expectedReward);
    await hatToken.mint(rewardController.address, expectedReward);
    let tx = await rewardController.claimReward(vault.address, staker, { from: staker });
    assert.equal(tx.logs[0].event, "SafeTransferReward");
    assert.equal(tx.logs[0].args.amount.toString(), expectedReward.toString());
    assert.equal(tx.logs[0].args.user, staker);
    assert.equal(tx.logs[0].args.vault, vault.address);
    assert.isFalse(tx.logs[0].args.amount.eq(0));
  });
});

module.exports = {
  assertVMException,
  setup,
  rewardPerEpoch,
  advanceToSafetyPeriod: advanceToSafetyPeriod_,
};
