const HATVaults = artifacts.require("./HATVaults.sol");
const HATVaultsV2Mock = artifacts.require("./HATVaultsV2Mock.sol");
const HATTokenMock = artifacts.require("./HATTokenMock.sol");
const ERC20Mock = artifacts.require("./ERC20Mock.sol");
const UniSwapV3RouterMock = artifacts.require("./UniSwapV3RouterMock.sol");
const TokenLockFactory = artifacts.require("./TokenLockFactory.sol");
const HATTokenLock = artifacts.require("./HATTokenLock.sol");
const PoolsManagerMock = artifacts.require("./PoolsManagerMock.sol");
const RewardController = artifacts.require("./RewardController.sol");
const utils = require("./utils.js");
const ISwapRouter = new ethers.utils.Interface(UniSwapV3RouterMock.abi);

const { deployHatVaults } = require("../scripts/hatvaultsdeploy.js");
const { upgradeHatVaults } = require("../scripts/hatvaultsupgrade.js");
const {
  assertVMException,
  advanceToSafetyPeriod: advanceToSafetyPeriod_,
  rewardPerEpoch,
} = require("./common.js");

var hatVaults;
var rewardController;
var hatToken;
var router;
var stakingToken;
var tokenLockFactory;
let safeWithdrawBlocksIncrement = 3;
let hatVaultsExpectedHatsBalance;

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

contract("HatVaults", (accounts) => {
  //this function will increment 4 blocks in local testnet
  async function safeWithdraw(pid, amount, staker) {
    let withdrawPeriod = (
      await hatVaults.generalParameters()
    ).withdrawPeriod.toNumber();
    let safetyPeriod = (
      await hatVaults.generalParameters()
    ).safetyPeriod.toNumber();

    //increase time for the case there is already pending request ..so make sure start a new one..
    await utils.increaseTime(7 * 24 * 3600);
    await hatVaults.withdrawRequest(pid, { from: staker });
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
    return await hatVaults.withdraw(pid, amount, { from: staker });
  }

  async function advanceToSafetyPeriod() {
    return advanceToSafetyPeriod_(hatVaults);
  }

  //advanced time to a withdraw enable period
  async function advanceToNoneSaftyPeriod() {
    let currentTimeStamp = (await web3.eth.getBlock("latest")).timestamp;
    let withdrawPeriod = (
      await hatVaults.generalParameters()
    ).withdrawPeriod.toNumber();
    let safetyPeriod = (
      await hatVaults.generalParameters()
    ).safetyPeriod.toNumber();
    if (currentTimeStamp % (withdrawPeriod + safetyPeriod) >= withdrawPeriod) {
      await utils.increaseTime(
        (currentTimeStamp % (withdrawPeriod + safetyPeriod)) +
          safetyPeriod -
          withdrawPeriod
      );
    }
  }

  async function calculateExpectedReward(staker, operationBlocksIncrement = 0) {
    let currentBlockNumber = (await web3.eth.getBlock("latest")).number;
    let lastRewardBlock = (await hatVaults.poolInfos(0)).lastRewardBlock;
    let allocPoint = await rewardController.poolsAllocPoint(0);
    let rewardPerShare = new web3.utils.BN(
      (await hatVaults.poolInfos(0)).rewardPerShare
    );
    let onee12 = new web3.utils.BN("1000000000000");
    let stakerAmount = (await hatVaults.userInfo(0, staker)).shares;
    let globalUpdatesLen = await rewardController.getGlobalPoolUpdatesLength();
    let totalAllocPoint = (
      await rewardController.globalPoolUpdates(globalUpdatesLen - 1)
    ).totalAllocPoint;
    let poolReward = await rewardController.getRewardForBlocksRange(
      lastRewardBlock,
      currentBlockNumber + 1 + operationBlocksIncrement,
      allocPoint,
      totalAllocPoint
    );
    let lpSupply = await stakingToken.balanceOf(hatVaults.address);
    rewardPerShare = rewardPerShare.add(poolReward.mul(onee12).div(lpSupply));
    let rewardDebt = (await hatVaults.userInfo(0, staker)).rewardDebt;
    return stakerAmount
      .mul(rewardPerShare)
      .div(onee12)
      .sub(rewardDebt);
  }

  async function safeEmergencyWithdraw(pid, staker) {
    let withdrawPeriod = (
      await hatVaults.generalParameters()
    ).withdrawPeriod.toNumber();
    let safetyPeriod = (
      await hatVaults.generalParameters()
    ).safetyPeriod.toNumber();
    //increase time for the case there is already pending request ..so make sure start a new one..
    await utils.increaseTime(7 * 24 * 3600);
    await hatVaults.withdrawRequest(pid, { from: staker });
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
    return await hatVaults.emergencyWithdraw(pid, { from: staker });
  }

  async function unSafeEmergencyWithdraw(pid, staker) {
    let currentTimeStamp = (await web3.eth.getBlock("latest")).timestamp;
    let withdrawPeriod = (
      await hatVaults.generalParameters()
    ).withdrawPeriod.toNumber();
    let safetyPeriod = (
      await hatVaults.generalParameters()
    ).safetyPeriod.toNumber();
    if (currentTimeStamp % (withdrawPeriod + safetyPeriod) >= withdrawPeriod) {
      await utils.increaseTime(
        (currentTimeStamp % (withdrawPeriod + safetyPeriod)) +
          safetyPeriod -
          withdrawPeriod
      );
    }
    return await hatVaults.emergencyWithdraw(pid, { from: staker });
  }

  async function unSafeWithdraw(pid, amount, staker) {
    let currentTimeStamp = (await web3.eth.getBlock("latest")).timestamp;
    let withdrawPeriod = (
      await hatVaults.generalParameters()
    ).withdrawPeriod.toNumber();
    let safetyPeriod = (
      await hatVaults.generalParameters()
    ).safetyPeriod.toNumber();
    if (currentTimeStamp % (withdrawPeriod + safetyPeriod) >= withdrawPeriod) {
      await utils.increaseTime(
        (currentTimeStamp % (withdrawPeriod + safetyPeriod)) +
          safetyPeriod -
          withdrawPeriod
      );
    }
    return await hatVaults.withdraw(pid, amount, { from: staker });
  }

  it("constructor", async () => {
    await setup(accounts);
    assert.equal(await stakingToken.name(), "Staking");
    assert.equal(await hatVaults.owner(), accounts[0]);
  });

  it("upgrade contract", async () => {
    await setup(accounts);
    await upgradeHatVaults(hatVaults.address);
    hatVaults = await HATVaultsV2Mock.at(hatVaults.address);
    assert.equal((await hatVaults.getHatsVersion()).toString(), "2");
  });

  it("setCommittee", async () => {
    await setup(accounts);
    assert.equal(await hatVaults.committees(0), accounts[1]);

    try {
      await hatVaults.setCommittee(0, utils.NULL_ADDRESS, {
        from: accounts[1],
      });
      assert(false, "cannot set zero address committee");
    } catch (ex) {
      assertVMException(ex, "CommitteeIsZero");
    }

    await hatVaults.setCommittee(0, accounts[2], { from: accounts[1] });

    assert.equal(await hatVaults.committees(0), accounts[2]);

    try {
      await hatVaults.setCommittee(0, accounts[2], { from: accounts[1] });
      assert(false, "cannot set committee from non committee account");
    } catch (ex) {
      assertVMException(ex, "OnlyCommittee");
    }

    //set other pool with different committee
    let maxBounty = 8000;
    let bountySplit = [6000, 2000, 500, 0, 1000, 500];
    var stakingToken2 = await ERC20Mock.new("Staking", "STK");
    await hatVaults.addPool(
      stakingToken2.address,
      accounts[3],
      maxBounty,
      bountySplit,
      "_descriptionHash",
      [86400, 10],
      false,
      true
    );

    await rewardController.setAllocPoint(
      (await hatVaults.getNumberOfPools()) - 1,
      100
    );

    assert.equal(await hatVaults.committees(1), accounts[3]);

    await hatVaults.setCommittee(1, accounts[1]);

    assert.equal(await hatVaults.committees(1), accounts[1]);
    var staker = accounts[1];
    await stakingToken2.approve(hatVaults.address, web3.utils.toWei("4"), {
      from: staker,
    });
    await stakingToken2.mint(staker, web3.utils.toWei("1"));
    try {
      await hatVaults.deposit(1, web3.utils.toWei("1"), { from: staker });
      assert(false, "cannot deposit before committee check in");
    } catch (ex) {
      assertVMException(ex, "CommitteeNotCheckedInYet");
    }

    try {
      await hatVaults.committeeCheckIn(1, { from: accounts[0] });
      assert(false, "only committee can check in");
    } catch (ex) {
      assertVMException(ex, "OnlyCommittee");
    }
    let tx = await hatVaults.committeeCheckIn(1, { from: accounts[1] });
    assert.equal(tx.logs[0].event, "CommitteeCheckedIn");
    assert.equal(tx.logs[0].args._pid, 1);

    await stakingToken2.setBadTransferFlag(true);
    tx = await hatVaults.deposit(1, web3.utils.toWei("2"), { from: staker });
    await stakingToken2.setBadTransferFlag(false);
    assert.equal(tx.logs[0].event, "Deposit");
    assert.equal(tx.logs[0].args.amount, web3.utils.toWei("2"));
    assert.equal(tx.logs[0].args.transferredAmount, web3.utils.toWei("1"));

    try {
      await hatVaults.setCommittee(1, accounts[2]);
      assert(false, "committee already checked in");
    } catch (ex) {
      assertVMException(ex, "CommitteeAlreadyCheckedIn");
    }
    await hatVaults.setCommittee(1, accounts[2], { from: accounts[1] });
    await hatVaults.setCommittee(1, accounts[1], { from: accounts[2] });
  });

  it("dismiss can be called by anyone after 5 weeks delay", async () => {
    var staker = accounts[1];
    await setup(accounts, 0, 9000, [9000, 0, 200, 0, 100, 700]);

    await advanceToSafetyPeriod();
    await stakingToken.approve(hatVaults.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await stakingToken.mint(staker, web3.utils.toWei("1"));
    await hatVaults.deposit(0, web3.utils.toWei("1"), { from: staker });
    let tx = await hatVaults.submitClaim(
      0,
      accounts[2],
      8000,
      "description hash",
      {
        from: accounts[1],
      }
    );
    let claimId = tx.logs[0].args._claimId;
    await hatVaults.challengeClaim(claimId);
    try {
      await hatVaults.dismissClaim(claimId, { from: accounts[1] });
      assert(false, "only governance can dismiss before delay");
    } catch (ex) {
      assertVMException(
        ex,
        "OnlyCallableByGovernanceOrAfterChallengeTimeOutPeriod"
      );
    }
    await utils.increaseTime(1);
    await utils.increaseTime(5 * 7 * 24 * 60 * 60);
    tx = await hatVaults.dismissClaim(claimId, { from: accounts[1] });
    assert.equal(tx.logs[0].event, "DismissClaim");
    assert.equal(tx.logs[0].args._pid, 0);
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

    await setup(accounts, 0, 9000, [8000, 1000, 100, 100, 100, 700]);
    assert.equal((await hatVaults.bountyInfos(0)).maxBounty.toString(), "9000");
    assert.equal(
      (await hatVaults.bountyInfos(0)).bountySplit.hacker.toString(),
      "1000"
    );
    assert.equal(
      (await hatVaults.bountyInfos(0)).bountySplit.hackerVested.toString(),
      "8000"
    );

    assert.equal(
      (await hatVaults.bountyInfos(0)).bountySplit.committee.toString(),
      "100"
    );
    assert.equal(
      (await hatVaults.bountyInfos(0)).bountySplit.swapAndBurn.toString(),
      "100"
    );
    assert.equal(
      (await hatVaults.bountyInfos(0)).bountySplit.governanceHat.toString(),
      "100"
    );
    assert.equal(
      (await hatVaults.bountyInfos(0)).bountySplit.hackerHatVested.toString(),
      "700"
    );

    try {
      await hatVaults.setPendingMaxBounty(0, 11000, { from: accounts[1] });
      assert(false, "max bounty can't be more than 10000");
    } catch (ex) {
      assertVMException(ex, "MaxBountyCannotBeMoreThanHundredPercent");
    }
    try {
      await hatVaults.setPendingMaxBounty(0, 10000, { from: accounts[2] });
      assert(false, "only committee");
    } catch (ex) {
      assertVMException(ex, "OnlyCommittee");
    }
    try {
      await hatVaults.setMaxBounty(0, { from: accounts[1] });
      assert(false, "no pending");
    } catch (ex) {
      assertVMException(ex, "NoPendingMaxBounty");
    }

    // bountylevel can be 10000 without throwing an error
    await hatVaults.setPendingMaxBounty(0, 10000, {
      from: accounts[1],
    });

    try {
      await hatVaults.setPendingMaxBounty(0, 10001, { from: accounts[1] });
      assert(false, "bounty level should be less than or equal to 10000");
    } catch (ex) {
      assertVMException(ex, "MaxBountyCannotBeMoreThanHundredPercent");
    }
    let tx = await hatVaults.setPendingMaxBounty(0, 10000, {
      from: accounts[1],
    });
    assert.equal(tx.logs[0].event, "SetPendingMaxBounty");
    assert.equal(tx.logs[0].args._pid, 0);
    assert.equal(tx.logs[0].args._maxBounty, 10000);

    await utils.increaseTime(1);
    try {
      await hatVaults.setMaxBounty(0, { from: accounts[1] });
      assert(false, "no delay yet");
    } catch (ex) {
      assertVMException(ex, "DelayPeriodForSettingMaxBountyHadNotPassed");
    }
    await utils.increaseTime(3600 * 24 * 2);
    try {
      await hatVaults.setMaxBounty(0, { from: accounts[0] });
      assert(false, "onlyCommittee");
    } catch (ex) {
      assertVMException(ex, "OnlyCommittee");
    }
    tx = await hatVaults.setMaxBounty(0, { from: accounts[1] });
    assert.equal(tx.logs[0].event, "SetMaxBounty");
    assert.equal(tx.logs[0].args._pid, 0);
    assert.equal(tx.logs[0].args._maxBounty, 10000);

    await advanceToNoneSaftyPeriod();

    try {
      await hatVaults.setBountySplit(0, [7000, 0, 1000, 1100, 0, 901]);
      assert(false, "cannot init with bountySplit > 10000");
    } catch (ex) {
      assertVMException(ex, "TotalSplitPercentageShouldBeHundredPercent");
    }
    await hatVaults.setBountySplit(0, [6000, 0, 1000, 2200, 0, 800]);
    assert.equal(
      (await hatVaults.bountyInfos(0)).maxBounty.toString(),
      "10000"
    );
    assert.equal(
      (await hatVaults.bountyInfos(0)).bountySplit.hacker.toString(),
      "0"
    );
    assert.equal(
      (await hatVaults.bountyInfos(0)).bountySplit.hackerVested.toString(),
      "6000"
    );

    assert.equal(
      (await hatVaults.bountyInfos(0)).bountySplit.committee.toString(),
      "1000"
    );
    assert.equal(
      (await hatVaults.bountyInfos(0)).bountySplit.swapAndBurn.toString(),
      "2200"
    );
    assert.equal(
      (await hatVaults.bountyInfos(0)).bountySplit.hackerHatVested.toString(),
      "800"
    );
    await advanceToSafetyPeriod();
    tx = await hatVaults.submitClaim(
      0,
      accounts[2],
      10000,
      "description hash",
      {
        from: accounts[1],
      }
    );
    let claimId = tx.logs[0].args._claimId;
    await hatVaults.challengeClaim(claimId);
    try {
      await hatVaults.setPendingMaxBounty(0, 8000, { from: accounts[1] });
      assert(false, "there is already pending approval");
    } catch (ex) {
      assertVMException(ex, "ActiveClaimExists");
    }
    try {
      await hatVaults.setBountySplit(0, [6000, 0, 1000, 1100, 1, 800]);
      assert(false, "cannot set split while there is pending approval");
    } catch (ex) {
      assertVMException(ex, "ActiveClaimExists");
    }
    tx = await hatVaults.dismissClaim(claimId);
    assert.equal(tx.logs[0].event, "DismissClaim");
    assert.equal(tx.logs[0].args._pid, 0);
    try {
      await hatVaults.setBountySplit(0, [6000, 0, 1000, 1100, 1, 800]);
      assert(false, "cannot set split while in safety period");
    } catch (ex) {
      assertVMException(ex, "SafetyPeriod");
    }
    await advanceToNoneSaftyPeriod();

    await hatVaults.setBountySplit(0, [6000, 0, 1000, 1000, 1200, 800]);

    await hatVaults.setPendingMaxBounty(0, 8000, { from: accounts[1] });

    await utils.increaseTime(24 * 3600 * 2);
    await hatVaults.setMaxBounty(0, { from: accounts[1] });
    assert.equal((await hatVaults.bountyInfos(0)).maxBounty.toString(), "8000");
  });

  it("zero totalAllocPoints", async () => {
    await setup(accounts, 0, 9000, [8000, 1000, 100, 100, 100, 700], 10, 0, 0);

    var staker = accounts[1];

    await stakingToken.approve(hatVaults.address, web3.utils.toWei("1"), {
      from: staker,
    });

    await stakingToken.mint(staker, web3.utils.toWei("1"));
    assert.equal(await stakingToken.balanceOf(staker), web3.utils.toWei("1"));
    assert.equal(
      await hatToken.balanceOf(hatVaults.address),
      web3.utils.toWei(hatVaultsExpectedHatsBalance.toString())
    );

    await hatVaults.deposit(0, web3.utils.toWei("1"), { from: staker });
    await hatVaults.updatePool(0);
  });

  it("deposit less than 1e6", async () => {
    await setup(accounts);
    var staker = accounts[1];

    await stakingToken.approve(hatVaults.address, web3.utils.toWei("1"), {
      from: staker,
    });

    await stakingToken.mint(staker, web3.utils.toWei("1"));
    assert.equal(await stakingToken.balanceOf(staker), web3.utils.toWei("1"));
    assert.equal(
      await hatToken.balanceOf(hatVaults.address),
      web3.utils.toWei(hatVaultsExpectedHatsBalance.toString())
    );

    try {
      await hatVaults.deposit(0, "999999", { from: staker });
      assert(false, "cannot deposit less than 1e6");
    } catch (ex) {
      assertVMException(ex, "AmountLessThanMinDeposit");
    }
    await hatVaults.deposit(0, "1000000", { from: staker });
    assert.equal(await stakingToken.balanceOf(hatVaults.address), "1000000");
  });

  it("withdrawn", async () => {
    await setup(accounts);
    var staker = accounts[1];

    await stakingToken.approve(hatVaults.address, web3.utils.toWei("1"), {
      from: staker,
    });

    await stakingToken.mint(staker, web3.utils.toWei("1"));
    assert.equal(await stakingToken.balanceOf(staker), web3.utils.toWei("1"));
    assert.equal(
      await hatToken.balanceOf(hatVaults.address),
      web3.utils.toWei(hatVaultsExpectedHatsBalance.toString())
    );
    await hatVaults.setPool(0, true, true, "_descriptionHash");
    try {
      await hatVaults.deposit(0, web3.utils.toWei("1"), { from: staker });
      assert(false, "cannot deposit to paused pool");
    } catch (ex) {
      assertVMException(ex, "DepositPaused");
    }
    await hatVaults.setPool(0, true, false, "_descriptionHash");
    try {
      await hatVaults.deposit(0, "999999", { from: staker });
      assert(false, "cannot deposit less than 1e6");
    } catch (ex) {
      assertVMException(ex, "AmountLessThanMinDeposit");
    }
    await hatVaults.deposit(0, web3.utils.toWei("1"), { from: staker });
    await utils.increaseTime(7 * 24 * 3600);
    await advanceToSafetyPeriod();

    let tx = await hatVaults.submitClaim(
      0,
      accounts[2],
      8000,
      "description hash",
      {
        from: accounts[1],
      }
    );
    let claimId = tx.logs[0].args._claimId;
    try {
      await safeWithdraw(0, web3.utils.toWei("1"), staker);
      assert(false, "cannot withdraw while pending approval exists");
    } catch (ex) {
      assertVMException(ex, "ActiveClaimExists");
    }

    await hatVaults.challengeClaim(claimId);
    tx = await hatVaults.dismissClaim(claimId);
    assert.equal(tx.logs[0].event, "DismissClaim");
    assert.equal(tx.logs[0].args._pid, 0);
    let currentBlockNumber = (await web3.eth.getBlock("latest")).number;

    let lastRewardBlock = (await hatVaults.poolInfos(0)).lastRewardBlock;
    let rewardPerShare = new web3.utils.BN(
      (await hatVaults.poolInfos(0)).rewardPerShare
    );
    let onee12 = new web3.utils.BN("1000000000000");
    let stakeVaule = new web3.utils.BN(web3.utils.toWei("1"));
    let totalAllocPoint = 100;
    let poolReward = await rewardController.getRewardForBlocksRange(
      lastRewardBlock,
      currentBlockNumber + 1 + safeWithdrawBlocksIncrement,
      100,
      totalAllocPoint
    );
    rewardPerShare = rewardPerShare.add(poolReward.mul(onee12).div(stakeVaule));
    let expectedReward = stakeVaule.mul(rewardPerShare).div(onee12);
    await safeWithdraw(0, web3.utils.toWei("1"), staker);
    //staker  get stake back
    assert.equal(await stakingToken.balanceOf(staker), web3.utils.toWei("1"));
    assert.equal(
      (await hatToken.balanceOf(staker)).toString(),
      expectedReward.toString()
    );
    //withdraw with 0
    await safeWithdraw(0, 0, staker);
    assert.equal(await stakingToken.balanceOf(staker), web3.utils.toWei("1"));
    assert.equal(
      (await hatToken.balanceOf(staker)).toString(),
      expectedReward.toString()
    );
  });

  it("setWithdrawSafetyPeriod", async () => {
    await setup(accounts);
    try {
      await hatVaults.setWithdrawSafetyPeriod(60 * 60, 60 * 30, {
        from: accounts[1],
      });
      assert(false, "only gov");
    } catch (ex) {
      assertVMException(ex, "Ownable: caller is not the owner");
    }

    try {
      await hatVaults.setWithdrawSafetyPeriod(60 * 60 - 1, 60 * 30);
      assert(false, "withdraw period must be >= 1 hour");
    } catch (ex) {
      assertVMException(ex, "WithdrawPeriodTooShort");
    }

    try {
      await hatVaults.setWithdrawSafetyPeriod(60 * 60, 60 * 60 * 6 + 1);
      assert(false, "safety period must be <= 6 hours");
    } catch (ex) {
      assertVMException(ex, "SafetyPeriodTooLong");
    }

    var tx = await hatVaults.setWithdrawSafetyPeriod(60 * 60, 60 * 30);

    assert.equal((await hatVaults.generalParameters()).withdrawPeriod, 60 * 60);
    assert.equal((await hatVaults.generalParameters()).safetyPeriod, 60 * 30);
    assert.equal(tx.logs[0].event, "SetWithdrawSafetyPeriod");
    assert.equal(tx.logs[0].args._withdrawPeriod, 60 * 60);
    assert.equal(tx.logs[0].args._safetyPeriod, 60 * 30);

    var staker = accounts[1];

    await stakingToken.approve(hatVaults.address, web3.utils.toWei("1"), {
      from: staker,
    });

    await stakingToken.mint(staker, web3.utils.toWei("1"));
    assert.equal(await stakingToken.balanceOf(staker), web3.utils.toWei("1"));
    assert.equal(
      await hatToken.balanceOf(hatVaults.address),
      web3.utils.toWei(hatVaultsExpectedHatsBalance.toString())
    );
    await hatVaults.deposit(0, web3.utils.toWei("1"), { from: staker });
    await utils.increaseTime(7 * 24 * 3600);

    let withdrawPeriod = 60 * 60;
    let safetyPeriod = 60 * 30;

    let currentTimeStamp = (await web3.eth.getBlock("latest")).timestamp;

    if (currentTimeStamp % (withdrawPeriod + safetyPeriod) < withdrawPeriod) {
      await utils.increaseTime(
        withdrawPeriod - (currentTimeStamp % (withdrawPeriod + safetyPeriod))
      );
    }

    tx = await hatVaults.submitClaim(0, accounts[2], 8000, "description hash", {
      from: accounts[1],
    });
    let claimId = tx.logs[0].args._claimId;
    try {
      await safeWithdraw(0, web3.utils.toWei("1"), staker);
      assert(false, "cannot withdraw while pending approval exists");
    } catch (ex) {
      assertVMException(ex, "ActiveClaimExists");
    }

    await hatVaults.challengeClaim(claimId);
    tx = await hatVaults.dismissClaim(claimId);
    assert.equal(tx.logs[0].event, "DismissClaim");
    assert.equal(tx.logs[0].args._pid, 0);
    let currentBlockNumber = (await web3.eth.getBlock("latest")).number;

    let lastRewardBlock = (await hatVaults.poolInfos(0)).lastRewardBlock;
    let rewardPerShare = new web3.utils.BN(
      (await hatVaults.poolInfos(0)).rewardPerShare
    );
    let onee12 = new web3.utils.BN("1000000000000");
    let stakeVaule = new web3.utils.BN(web3.utils.toWei("1"));
    let totalAllocPoint = 100;
    let poolReward = await rewardController.getRewardForBlocksRange(
      lastRewardBlock,
      currentBlockNumber + 1 + safeWithdrawBlocksIncrement,
      100,
      totalAllocPoint
    );
    rewardPerShare = rewardPerShare.add(poolReward.mul(onee12).div(stakeVaule));
    let expectedReward = stakeVaule.mul(rewardPerShare).div(onee12);
    await safeWithdraw(0, web3.utils.toWei("1"), staker);
    //staker  get stake back
    assert.equal(await stakingToken.balanceOf(staker), web3.utils.toWei("1"));
    assert.equal(
      (await hatToken.balanceOf(staker)).toString(),
      expectedReward.toString()
    );
    //withdraw with 0
    await safeWithdraw(0, 0, staker);
    assert.equal(await stakingToken.balanceOf(staker), web3.utils.toWei("1"));
    assert.equal(
      (await hatToken.balanceOf(staker)).toString(),
      expectedReward.toString()
    );
  });

  it("set withdrawn request params ", async () => {
    await setup(accounts);
    assert.equal(
      (await hatVaults.generalParameters()).withdrawRequestEnablePeriod,
      7 * 24 * 3600
    );
    assert.equal(
      (await hatVaults.generalParameters()).withdrawRequestPendingPeriod,
      7 * 24 * 3600
    );
    try {
      await hatVaults.setWithdrawRequestParams(
        90 * 24 * 3600 + 1,
        7 * 24 * 3600
      );
      assert(false, "pending period must be <= 90 days");
    } catch (ex) {
      assertVMException(ex, "WithdrawRequestPendingPeriodTooLong");
    }

    try {
      await hatVaults.setWithdrawRequestParams(1, 6 * 60 * 60 - 1);
      assert(false, "enable period must be >= 6 hour");
    } catch (ex) {
      assertVMException(ex, "WithdrawRequestEnabledPeriodTooShort");
    }

    try {
      await hatVaults.setWithdrawRequestParams(1, 60 * 24 * 3600, {
        from: accounts[4],
      });
      assert(false, "only gov");
    } catch (ex) {
      assertVMException(ex, "Ownable: caller is not the owner");
    }
    var tx = await hatVaults.setWithdrawRequestParams(1, 60 * 24 * 3600, {
      from: accounts[0],
    });
    assert.equal(
      (await hatVaults.generalParameters()).withdrawRequestPendingPeriod,
      1
    );
    assert.equal(tx.logs[0].event, "SetWithdrawRequestParams");
    assert.equal(tx.logs[0].args._withdrawRequestPendingPeriod, 1);
    assert.equal(tx.logs[0].args._withdrawRequestEnablePeriod, 60 * 24 * 3600);
    assert.equal(
      (await hatVaults.generalParameters()).withdrawRequestEnablePeriod,
      60 * 24 * 3600
    );
  });

  it("deposit cancel withdrawn request ", async () => {
    await setup(accounts);
    var staker = accounts[1];

    await stakingToken.approve(hatVaults.address, web3.utils.toWei("2"), {
      from: staker,
    });

    await stakingToken.mint(staker, web3.utils.toWei("2"));
    assert.equal(await stakingToken.balanceOf(staker), web3.utils.toWei("2"));
    assert.equal(
      await hatToken.balanceOf(hatVaults.address),
      web3.utils.toWei(hatVaultsExpectedHatsBalance.toString())
    );
    await hatVaults.deposit(0, web3.utils.toWei("1"), { from: staker });
    await utils.increaseTime(7 * 24 * 3600);
    await advanceToNoneSaftyPeriod();
    await hatVaults.withdrawRequest(0, { from: staker });
    await hatVaults.deposit(0, web3.utils.toWei("1"), { from: staker });
    await utils.increaseTime(7 * 24 * 3600);
    try {
      await hatVaults.withdraw(0, web3.utils.toWei("0.5"), { from: staker });
      assert(false, "deposit cancel withdrawRequest");
    } catch (ex) {
      assertVMException(ex, "InvalidWithdrawRequest");
    }
  });

  it("withdrawn request ", async () => {
    await setup(accounts);
    var staker = accounts[1];

    await stakingToken.approve(hatVaults.address, web3.utils.toWei("2"), {
      from: staker,
    });

    await stakingToken.mint(staker, web3.utils.toWei("2"));
    assert.equal(await stakingToken.balanceOf(staker), web3.utils.toWei("2"));
    assert.equal(
      await hatToken.balanceOf(hatVaults.address),
      web3.utils.toWei(hatVaultsExpectedHatsBalance.toString())
    );
    await hatVaults.deposit(0, web3.utils.toWei("1"), { from: staker });
    await utils.increaseTime(7 * 24 * 3600);
    await advanceToNoneSaftyPeriod();
    try {
      await hatVaults.withdraw(0, web3.utils.toWei("1"), { from: staker });
      assert(false, "cannot withdraw without request");
    } catch (ex) {
      assertVMException(ex, "InvalidWithdrawRequest");
    }

    try {
      await hatVaults.emergencyWithdraw(0, { from: staker });
      assert(false, "cannot emergencyWithdraw without request");
    } catch (ex) {
      assertVMException(ex, "InvalidWithdrawRequest");
    }
    await hatVaults.withdrawRequest(0, { from: staker });
    assert.equal(
      await hatVaults.withdrawEnableStartTime(0, staker),
      (await web3.eth.getBlock("latest")).timestamp + 7 * 24 * 3600
    );

    try {
      await hatVaults.withdraw(0, web3.utils.toWei("1"), { from: staker });
      assert(false, "request is pending");
    } catch (ex) {
      assertVMException(ex, "InvalidWithdrawRequest");
    }

    try {
      await hatVaults.emergencyWithdraw(0, { from: staker });
      assert(false, "request is pending");
    } catch (ex) {
      assertVMException(ex, "InvalidWithdrawRequest");
    }
    await utils.increaseTime(7 * 24 * 3600);
    try {
      await hatVaults.withdrawRequest(0, { from: staker });
      assert(false, "there is already pending request");
    } catch (ex) {
      assertVMException(ex, "PendingWithdrawRequestExists");
    }

    await hatVaults.withdraw(0, web3.utils.toWei("0.5"), { from: staker });
    assert.equal(await hatVaults.withdrawEnableStartTime(0, staker), 0);
    try {
      await hatVaults.emergencyWithdraw(0, { from: staker });
      assert(false, "no pending request");
    } catch (ex) {
      assertVMException(ex, "InvalidWithdrawRequest");
    }
    await hatVaults.withdrawRequest(0, { from: staker });
    await utils.increaseTime(7 * 24 * 3600);
    await hatVaults.emergencyWithdraw(0, { from: staker });
    assert.equal(await hatVaults.withdrawEnableStartTime(0, staker), 0);
    await hatVaults.deposit(0, web3.utils.toWei("1"), { from: staker });
    await hatVaults.withdrawRequest(0, { from: staker });
    try {
      await hatVaults.withdrawRequest(0, { from: staker });
      assert(false, "there is already pending request");
    } catch (ex) {
      assertVMException(ex, "PendingWithdrawRequestExists");
    }
    await utils.increaseTime(7 * 24 * 3600);
    try {
      await hatVaults.withdrawRequest(0, { from: staker });
      assert(false, "there is already pending request");
    } catch (ex) {
      assertVMException(ex, "PendingWithdrawRequestExists");
    }
    await utils.increaseTime(7 * 24 * 3600);
    //request is now expired so can request again.
    await hatVaults.withdrawRequest(0, { from: staker });
  });

  it("Set fee and fee setter", async () => {
    await setup(accounts);
    try {
      await hatVaults.setFeeSetter(accounts[1], {
        from: accounts[1],
      });
      assert(false, "only gov");
    } catch (ex) {
      assertVMException(ex, "Ownable: caller is not the owner");
    }

    await hatVaults.setFeeSetter(accounts[0]);
    var tx = await hatVaults.setPoolWithdrawalFee(0, 100);
    assert.equal((await hatVaults.poolInfos(0)).withdrawalFee, 100);
    assert.equal(tx.logs[0].event, "SetPoolWithdrawalFee");
    assert.equal(tx.logs[0].args._pid, 0);
    assert.equal(tx.logs[0].args._newFee, 100);

    tx = await hatVaults.setFeeSetter(accounts[1]);

    assert.equal(await hatVaults.feeSetter(), accounts[1]);
    assert.equal(tx.logs[0].event, "SetFeeSetter");
    assert.equal(tx.logs[0].args._newFeeSetter, accounts[1]);

    try {
      await hatVaults.setPoolWithdrawalFee(0, 100);
      assert(false, "only fee setter");
    } catch (ex) {
      assertVMException(ex, "OnlyFeeSetter");
    }

    try {
      await hatVaults.setPoolWithdrawalFee(0, 201, {
        from: accounts[1],
      });
      assert(false, "fee must be lower than or equal to 2%");
    } catch (ex) {
      assertVMException(ex, "PoolWithdrawalFeeTooBig");
    }

    tx = await hatVaults.setPoolWithdrawalFee(0, 200, {
      from: accounts[1],
    });

    assert.equal((await hatVaults.poolInfos(0)).withdrawalFee, 200);
    assert.equal(tx.logs[0].event, "SetPoolWithdrawalFee");
    assert.equal(tx.logs[0].args._pid, 0);
    assert.equal(tx.logs[0].args._newFee, 200);

    var staker = accounts[2];
    await stakingToken.approve(hatVaults.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await stakingToken.mint(staker, web3.utils.toWei("1"));
    await hatVaults.deposit(0, web3.utils.toWei("1"), { from: staker });
    await utils.increaseTime(7 * 24 * 3600);

    let governanceBalance = await stakingToken.balanceOf(accounts[0]);

    await safeWithdraw(0, web3.utils.toWei("1"), staker);

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
  });

  it("Emergency withdraw fee", async () => {
    await setup(accounts);

    await hatVaults.setFeeSetter(accounts[0]);
    tx = await hatVaults.setPoolWithdrawalFee(0, 200);

    assert.equal((await hatVaults.poolInfos(0)).withdrawalFee, 200);
    assert.equal(tx.logs[0].event, "SetPoolWithdrawalFee");
    assert.equal(tx.logs[0].args._pid, 0);
    assert.equal(tx.logs[0].args._newFee, 200);

    var staker = accounts[2];
    await stakingToken.approve(hatVaults.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await stakingToken.mint(staker, web3.utils.toWei("1"));
    await hatVaults.deposit(0, web3.utils.toWei("1"), { from: staker });
    await utils.increaseTime(7 * 24 * 3600);

    let governanceBalance = await stakingToken.balanceOf(accounts[0]);

    await safeEmergencyWithdraw(0, staker);

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
  });

  it("stake", async () => {
    await setup(accounts);
    var staker = accounts[1];
    try {
      await hatVaults.deposit(0, web3.utils.toWei("1"), { from: staker });
      assert(false, "cannot stake without approve");
    } catch (ex) {
      assertVMException(ex);
    }
    await stakingToken.approve(hatVaults.address, web3.utils.toWei("1"), {
      from: staker,
    });
    try {
      await hatVaults.deposit(0, 1000, { from: staker });
      assert(false, "do not have enough tokens to stake");
    } catch (ex) {
      assertVMException(ex, "AmountLessThanMinDeposit");
    }
    await stakingToken.mint(staker, web3.utils.toWei("1"));
    assert.equal(await stakingToken.balanceOf(staker), web3.utils.toWei("1"));
    assert.equal(
      await hatToken.balanceOf(hatVaults.address),
      web3.utils.toWei(hatVaultsExpectedHatsBalance.toString())
    );
    await hatVaults.deposit(0, web3.utils.toWei("1"), { from: staker });
    assert.equal(
      await hatToken.balanceOf(hatVaults.address),
      web3.utils.toWei(hatVaultsExpectedHatsBalance.toString())
    );
    await utils.increaseTime(7 * 24 * 3600);
    assert.equal(await stakingToken.balanceOf(staker), 0);
    assert.equal(
      await stakingToken.balanceOf(hatVaults.address),
      web3.utils.toWei("1")
    );
    //withdraw
    assert.equal(await hatToken.balanceOf(staker), 0);

    let currentBlockNumber = (await web3.eth.getBlock("latest")).number;

    let lastRewardBlock = (await hatVaults.poolInfos(0)).lastRewardBlock;
    let rewardPerShare = new web3.utils.BN(
      (await hatVaults.poolInfos(0)).rewardPerShare
    );
    let onee12 = new web3.utils.BN("1000000000000");
    let stakeVaule = new web3.utils.BN(web3.utils.toWei("1"));
    let totalAllocPoint = 100;
    let poolReward = await rewardController.getRewardForBlocksRange(
      lastRewardBlock,
      currentBlockNumber + 1 + safeWithdrawBlocksIncrement,
      100,
      totalAllocPoint
    );
    rewardPerShare = rewardPerShare.add(poolReward.mul(onee12).div(stakeVaule));
    let expectedReward = stakeVaule.mul(rewardPerShare).div(onee12);

    await safeWithdraw(0, web3.utils.toWei("1"), staker);
    //staker get stake back
    assert.equal(await stakingToken.balanceOf(staker), web3.utils.toWei("1"));
    assert.equal(
      (await hatToken.balanceOf(staker)).toString(),
      expectedReward.toString()
    );
    //withdraw with 0
    await safeWithdraw(0, 0, staker);
    assert.equal(await stakingToken.balanceOf(staker), web3.utils.toWei("1"));
    assert.equal(
      (await hatToken.balanceOf(staker)).toString(),
      expectedReward.toString()
    );
  });

  it("claim reward", async () => {
    await setup(accounts);
    var staker = accounts[1];
    await stakingToken.approve(hatVaults.address, web3.utils.toWei("4"), {
      from: staker,
    });
    await stakingToken.mint(staker, web3.utils.toWei("1"));
    await hatVaults.deposit(0, web3.utils.toWei("1"), { from: staker });
    assert.equal(
      await hatToken.balanceOf(hatVaults.address),
      web3.utils.toWei(hatVaultsExpectedHatsBalance.toString())
    );

    assert.equal(await hatToken.balanceOf(staker), 0);

    let expectedReward = await calculateExpectedReward(staker);
    assert.equal(
      await hatToken.balanceOf(hatVaults.address),
      web3.utils.toWei(hatVaultsExpectedHatsBalance.toString())
    );

    try {
      await hatVaults.calcClaimBounty(0, 8001);
      assert(false, "reward percentage is too high");
    } catch (ex) {
      assertVMException(ex, "BountyPercentageHigherThanMaxBounty");
    }
    var tx = await hatVaults.claimReward(0, { from: staker });
    assert.equal(tx.logs[0].event, "ClaimReward");
    assert.equal(tx.logs[0].args._pid, 0);

    assert.equal(
      await hatToken.balanceOf(hatVaults.address),
      web3.utils.toWei(hatVaultsExpectedHatsBalance.toString())
    );
    assert.equal(
      (await hatToken.balanceOf(staker)).toString(),
      expectedReward.toString()
    );
    assert.equal(await stakingToken.balanceOf(staker), 0);
    assert.equal(
      await stakingToken.balanceOf(hatVaults.address),
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
    await stakingToken.approve(hatVaults.address, web3.utils.toWei("4"), {
      from: staker,
    });
    await stakingToken.mint(staker, web3.utils.toWei("1"));
    await hatVaults.deposit(0, web3.utils.toWei("1"), { from: staker });

    assert.equal(await hatToken.balanceOf(staker), 0);

    // Deposit redeemed existing reward
    await stakingToken.mint(staker, web3.utils.toWei("1"));
    let expectedReward = await calculateExpectedReward(staker);
    var tx = await hatVaults.deposit(0, web3.utils.toWei("1"), {
      from: staker,
    });
    assert.equal(tx.logs[0].event, "SafeTransferReward");
    assert.equal(tx.logs[0].args.amount.toString(), expectedReward.toString());
    assert.equal(tx.logs[0].args.user, staker);
    assert.equal(tx.logs[0].args.pid, 0);
    assert.isFalse(tx.logs[0].args.amount.eq(0));
    assert.equal(
      (await hatToken.balanceOf(staker)).toString(),
      expectedReward.toString()
    );

    await stakingToken.mint(staker, web3.utils.toWei("1"));
    expectedReward = await calculateExpectedReward(staker);
    var balanceOfStakerBefore = await hatToken.balanceOf(staker);
    await hatVaults.deposit(0, web3.utils.toWei("1"), { from: staker });
    assert.equal(
      (await hatToken.balanceOf(staker)).toString(),
      expectedReward.add(balanceOfStakerBefore).toString()
    );

    // Deposit redeemed existing reward
    await utils.increaseTime(7 * 24 * 3600);
    await stakingToken.mint(staker, web3.utils.toWei("1"));
    expectedReward = await calculateExpectedReward(staker);
    balanceOfStakerBefore = await hatToken.balanceOf(staker);
    await hatVaults.deposit(0, web3.utils.toWei("1"), { from: staker });
    assert.equal(
      (await hatToken.balanceOf(staker)).toString(),
      expectedReward.add(balanceOfStakerBefore).toString()
    );
    assert.equal(await stakingToken.balanceOf(staker), 0);
    assert.equal(
      await stakingToken.balanceOf(hatVaults.address),
      web3.utils.toWei("4")
    );
    await utils.increaseTime(7 * 24 * 3600);
    //withdraw
    expectedReward = await calculateExpectedReward(
      staker,
      safeWithdrawBlocksIncrement
    );
    balanceOfStakerBefore = await hatToken.balanceOf(staker);
    await safeWithdraw(0, web3.utils.toWei("4"), staker);
    //staker  get stake back
    assert.equal(
      (await stakingToken.balanceOf(staker)).toString(),
      web3.utils.toWei("4").toString()
    );
    assert.equal(
      (await hatToken.balanceOf(staker)).toString(),
      expectedReward.add(balanceOfStakerBefore).toString()
    );
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
    await stakingToken.approve(hatVaults.address, web3.utils.toWei("4"), {
      from: staker,
    });
    await stakingToken.mint(staker, web3.utils.toWei("1"));
    await hatVaults.deposit(0, web3.utils.toWei("1"), { from: staker });

    assert.equal(await hatToken.balanceOf(staker), 0);

    let hatTotalSupply = await hatToken.totalSupply();
    let hatTokenCap = await hatToken.CAP();
    let amountToMint = hatTokenCap.sub(hatTotalSupply);
    await utils.setMinter(hatToken, accounts[0], amountToMint);
    await hatToken.mint(accounts[0], amountToMint);
    await hatToken.approve(hatVaults.address, amountToMint);
    tx = await hatVaults.depositReward(amountToMint);
    assert.equal(tx.logs[0].event, "DepositReward");
    assert.equal(tx.logs[0].args._amount.toString(), amountToMint.toString());

    // Deposit redeemed existing reward
    await stakingToken.mint(staker, web3.utils.toWei("1"));
    let expectedReward = await hatVaults.getPendingReward(0, staker);
    tx = await hatVaults.deposit(0, web3.utils.toWei("1"), { from: staker });
    assert.equal(tx.logs[0].event, "SafeTransferReward");
    assert.isTrue(
      parseInt(tx.logs[0].args.amount.toString()) >=
        parseInt(expectedReward.toString())
    );
    assert.equal(tx.logs[0].args.user, staker);
    assert.equal(tx.logs[0].args.pid, 0);
    assert.isFalse(tx.logs[0].args.amount.eq(0));
    assert.equal(
      (await hatToken.balanceOf(staker)).toString(),
      tx.logs[0].args.amount.toString()
    );

    await stakingToken.mint(staker, web3.utils.toWei("1"));
    var balanceOfStakerBefore = await hatToken.balanceOf(staker);
    tx = await hatVaults.deposit(0, web3.utils.toWei("1"), { from: staker });
    assert.equal(
      (await hatToken.balanceOf(staker)).toString(),
      tx.logs[0].args.amount.add(balanceOfStakerBefore).toString()
    );

    // Deposit redeemed existing reward
    await utils.increaseTime(7 * 24 * 3600);
    await stakingToken.mint(staker, web3.utils.toWei("1"));
    balanceOfStakerBefore = await hatToken.balanceOf(staker);
    tx = await hatVaults.deposit(0, web3.utils.toWei("1"), { from: staker });
    assert.equal(
      (await hatToken.balanceOf(staker)).toString(),
      tx.logs[0].args.amount.add(balanceOfStakerBefore).toString()
    );
    assert.equal(await stakingToken.balanceOf(staker), 0);
    assert.equal(
      await stakingToken.balanceOf(hatVaults.address),
      web3.utils.toWei("4")
    );
    await utils.increaseTime(7 * 24 * 3600);
    //withdraw
    await hatVaults.updatePool(0);
    balanceOfStakerBefore = await hatToken.balanceOf(staker);
    tx = await safeWithdraw(0, web3.utils.toWei("4"), staker);

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
      (await hatToken.balanceOf(hatVaults.address)).toString(),
      amountToMint.sub(userHatBalance).toString()
    );
  });

  it("getRewardForBlocksRange - from below startblock will revert ", async () => {
    await setup(accounts, 1);
    let allocPoint = await rewardController.poolsAllocPoint(0);
    let globalUpdatesLen = await rewardController.getGlobalPoolUpdatesLength();
    let totalAllocPoint = (
      await rewardController.globalPoolUpdates(globalUpdatesLen - 1)
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
      web3.utils.toWei(((Math.random() * 10000) | 0).toString())
    );
    await setup(accounts, 0);
    let allocPoint = await rewardController.poolsAllocPoint(0);
    let globalUpdatesLen = await rewardController.getGlobalPoolUpdatesLength();
    let totalAllocPoint = (
      await rewardController.globalPoolUpdates(globalUpdatesLen - 1)
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
        .div(new web3.utils.BN(10))
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
        .div(new web3.utils.BN(100))
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
        .div(new web3.utils.BN(10))
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
      multiplier.div(new web3.utils.BN(10)).toString()
    );
  });

  it("getMultiplier - ", async () => {
    await setup(accounts, 0);
    let allocPoint = await rewardController.poolsAllocPoint(0);
    let globalUpdatesLen = await rewardController.getGlobalPoolUpdatesLength();
    let totalAllocPoint = (
      await rewardController.globalPoolUpdates(globalUpdatesLen - 1)
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
      new web3.utils.BN(rewardPerEpoch[0]).div(new web3.utils.BN(10)).toString()
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
        .div(new web3.utils.BN(100))
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
        .div(new web3.utils.BN(10))
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
      multiplier.div(new web3.utils.BN(10)).toString()
    );
    var staker = accounts[1];
    assert.equal((await hatVaults.getPendingReward(0, staker)).toNumber(), 0);
  });

  it("getPendingReward + getRewardPerBlock", async () => {
    await setup(accounts);
    var staker = accounts[1];
    assert.equal((await hatVaults.getPendingReward(0, staker)).toNumber(), 0);
    await stakingToken.approve(hatVaults.address, web3.utils.toWei("4"), {
      from: staker,
    });
    await stakingToken.mint(staker, web3.utils.toWei("1"));
    await hatVaults.deposit(0, web3.utils.toWei("1"), { from: staker });
    await utils.increaseTime(7 * 24 * 3600);
    var currentBlockNumber = (await web3.eth.getBlock("latest")).number;
    let allocPoint = await rewardController.poolsAllocPoint(0);
    let globalUpdatesLen = await rewardController.getGlobalPoolUpdatesLength();
    let totalAllocPoint = (
      await rewardController.globalPoolUpdates(globalUpdatesLen - 1)
    ).totalAllocPoint;
    assert.equal(
      (await hatVaults.getPendingReward(0, staker)).toString(),
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

  it("emergency withdraw", async () => {
    await setup(accounts);
    var staker = accounts[1];
    var staker2 = accounts[3];
    await stakingToken.approve(hatVaults.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await stakingToken.approve(hatVaults.address, web3.utils.toWei("1"), {
      from: staker2,
    });
    await stakingToken.mint(staker, web3.utils.toWei("1"));
    await stakingToken.mint(staker2, web3.utils.toWei("1"));

    //stake
    await hatVaults.deposit(0, web3.utils.toWei("1"), { from: staker });
    assert.equal(
      await hatToken.balanceOf(hatVaults.address),
      web3.utils.toWei(hatVaultsExpectedHatsBalance.toString())
    );

    assert.equal(await hatToken.balanceOf(staker), 0);
    await utils.increaseTime(7 * 24 * 3600);

    assert.equal(await stakingToken.balanceOf(staker), 0);
    let stakerAmount = (await hatVaults.userInfo(0, staker)).shares;
    assert.equal(stakerAmount.toString(), web3.utils.toWei("1"));

    // Can emergency withdraw 1 token
    assert.equal(await stakingToken.balanceOf(staker), 0);
    try {
      await unSafeEmergencyWithdraw(0, staker);
      assert(false, "cannot emergency withdraw");
    } catch (ex) {
      assertVMException(ex, "InvalidWithdrawRequest");
    }

    await safeEmergencyWithdraw(0, staker);
    assert.equal(
      await hatToken.balanceOf(hatVaults.address),
      web3.utils.toWei(hatVaultsExpectedHatsBalance.toString())
    );

    assert.equal(web3.utils.fromWei(await stakingToken.balanceOf(staker)), 1);

    //Can emergency withdraw only once
    try {
      await safeEmergencyWithdraw(0, staker);
      assert(false, "Can emergency withdraw only once");
    } catch (ex) {
      assertVMException(ex, "UserSharesMustBeGreaterThanZero");
    }
    assert.equal(
      await hatToken.balanceOf(hatVaults.address),
      web3.utils.toWei(hatVaultsExpectedHatsBalance.toString())
    );

    assert.equal(web3.utils.fromWei(await stakingToken.balanceOf(staker)), 1);
    try {
      await hatVaults.withdraw(0, 1, { from: staker });
      assert(false, "cannot withdraw after emergency withdraw");
    } catch (ex) {
      assertVMException(ex, "NotEnoughUserBalance");
    }
  });

  it("approve + stake + exit", async () => {
    await setup(
      accounts,
      (await web3.eth.getBlock("latest")).number,
      8000,
      [6000, 2000, 500, 0, 1000, 500],
      10000
    );

    var staker = accounts[4];
    var staker2 = accounts[3];
    await stakingToken.approve(hatVaults.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await stakingToken.approve(hatVaults.address, web3.utils.toWei("1"), {
      from: staker2,
    });
    await stakingToken.mint(staker, web3.utils.toWei("1"));
    await stakingToken.mint(staker2, web3.utils.toWei("1"));
    await advanceToSafetyPeriod();
    let tx = await hatVaults.submitClaim(
      0,
      accounts[2],
      8000,
      "description hash",
      {
        from: accounts[1],
      }
    );
    let claimId = tx.logs[0].args._claimId;
    try {
      await hatVaults.approveClaim(claimId, 8000);
      assert(false, "lpbalance is zero");
    } catch (ex) {
      assertVMException(ex, "PoolBalanceIsZero");
    }
    await hatVaults.challengeClaim(claimId);
    tx = await hatVaults.dismissClaim(claimId);
    assert.equal(tx.logs[0].event, "DismissClaim");
    assert.equal(tx.logs[0].args._pid, 0);

    //stake
    await hatVaults.deposit(0, web3.utils.toWei("1"), { from: staker });
    assert.equal(
      await hatToken.balanceOf(hatVaults.address),
      web3.utils.toWei(hatVaultsExpectedHatsBalance.toString())
    );

    //exit
    assert.equal(await hatToken.balanceOf(staker), 0);
    await utils.increaseTime(7 * 24 * 3600);
    await advanceToNoneSaftyPeriod();
    try {
      await hatVaults.submitClaim(0, accounts[2], 8000, "description hash", {
        from: accounts[1],
      });
      assert(false, "none safety period");
    } catch (ex) {
      assertVMException(ex, "NotSafetyPeriod");
    }
    await advanceToSafetyPeriod();
    try {
      await hatVaults.submitClaim(0, accounts[2], 8001, "description hash", {
        from: accounts[1],
      });
      assert(false, "percentage requested too high");
    } catch (ex) {
      assertVMException(ex, "BountyPercentageHigherThanMaxBounty");
    }

    try {
      await hatVaults.submitClaim(
        0,
        utils.NULL_ADDRESS,
        8000,
        "description hash",
        {
          from: accounts[1],
        }
      );
      assert(false, "beneficiary is zero");
    } catch (ex) {
      assertVMException(ex, "BeneficiaryIsZero");
    }

    try {
      await hatVaults.submitClaim(0, accounts[2], 8000, "description hash", {
        from: accounts[2],
      });
      assert(false, "only committee");
    } catch (ex) {
      assertVMException(ex, "OnlyCommittee");
    }

    try {
      await hatVaults.approveClaim(0, 8000);
      assert(false, "there is no pending approval");
    } catch (ex) {
      assertVMException(ex, "NoActiveClaimExists");
    }

    try {
      await hatVaults.dismissClaim(0);
      assert(false, "there is no pending approval");
    } catch (ex) {
      assertVMException(ex, "NoActiveClaimExists");
    }

    tx = await hatVaults.submitClaim(0, accounts[2], 8000, "description hash", {
      from: accounts[1],
    });
    claimId = tx.logs[0].args._claimId;
    try {
      await hatVaults.submitClaim(0, accounts[2], 8000, "description hash", {
        from: accounts[1],
      });
      assert(false, "there is already pending approval");
    } catch (ex) {
      assertVMException(ex, "ActiveClaimExists");
    }
    assert.equal(tx.logs[0].event, "SubmitClaim");
    assert.equal(tx.logs[0].args._pid, 0);
    assert.equal(tx.logs[0].args._committee, accounts[1]);
    assert.equal(tx.logs[0].args._beneficiary, accounts[2]);
    assert.equal(tx.logs[0].args._bountyPercentage, 8000);
    assert.equal(tx.logs[0].args._descriptionHash, "description hash");
    assert.isTrue(parseInt(tx.logs[0].args._claimId.toString()) > 0);

    tx = await hatVaults.approveClaim(claimId, 8000);
    assert.equal(
      await hatToken.balanceOf(hatVaults.address),
      web3.utils.toWei(hatVaultsExpectedHatsBalance.toString())
    );
    assert.equal(tx.logs[1].event, "ApproveClaim");

    currentBlockNumber = (await web3.eth.getBlock("latest")).number;
    await hatVaults.deposit(0, web3.utils.toWei("1"), { from: staker2 });

    assert.equal(await stakingToken.balanceOf(staker), 0);
    let stakerAmount = (await hatVaults.userInfo(0, staker)).shares;
    assert.equal(stakerAmount.toString(), web3.utils.toWei("1"));
    tx = await safeWithdraw(0, stakerAmount, staker);

    assert.equal(stakerAmount.toString(), web3.utils.toWei("1"));
    assert.equal(tx.logs[0].event, "SafeTransferReward");
    let totalReward = tx.logs[0].args.amount;

    assert.equal(
      web3.utils.fromWei(await stakingToken.balanceOf(staker)),
      "0.2"
    );
    stakerAmount = (await hatVaults.userInfo(0, staker2)).shares;
    tx = await safeWithdraw(0, stakerAmount, staker2);
    assert.equal(tx.logs[0].event, "SafeTransferReward");
    totalReward = totalReward.add(tx.logs[0].args.amount);
    assert.equal(
      (await hatToken.balanceOf(hatVaults.address)).toString(),
      new web3.utils.BN(
        web3.utils.toWei(hatVaultsExpectedHatsBalance.toString())
      )
        .sub(totalReward)
        .toString()
    );
    assert.equal(
      web3.utils.fromWei(await stakingToken.balanceOf(staker2)),
      "1"
    );
  }).timeout(40000);

  it("approve+ stake simple check rewards", async () => {
    await setup(accounts, 0, 8000, [6000, 2000, 500, 0, 1000, 500], 10000);
    var staker = accounts[4];
    await stakingToken.approve(hatVaults.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await stakingToken.mint(staker, web3.utils.toWei("1"));

    //stake
    await hatVaults.deposit(0, web3.utils.toWei("1"), { from: staker });

    assert.equal(await hatToken.balanceOf(staker), 0);
    await utils.increaseTime(7 * 24 * 3600);
    await advanceToSafetyPeriod();
    let tx = await hatVaults.submitClaim(
      0,
      accounts[2],
      8000,
      "description hash",
      {
        from: accounts[1],
      }
    );
    let claimId = tx.logs[0].args._claimId;
    tx = await hatVaults.approveClaim(claimId, 8000);
    assert.equal(tx.logs[1].event, "ApproveClaim");
    let stakerAmount = (await hatVaults.userInfo(0, staker)).shares;
    assert.equal(stakerAmount.toString(), web3.utils.toWei("1"));
    tx = await safeWithdraw(0, stakerAmount, staker);
    assert.equal(tx.logs[0].event, "SafeTransferReward");
    assert.equal(
      (await hatToken.balanceOf(hatVaults.address)).toString(),
      new web3.utils.BN(
        web3.utils.toWei(hatVaultsExpectedHatsBalance.toString())
      )
        .sub(tx.logs[0].args.amount)
        .toString()
    );
    assert.equal(
      web3.utils.fromWei(await stakingToken.balanceOf(staker)),
      "0.2"
    );
  });

  it("emergencyWithdraw after approve and check reward", async () => {
    await setup(accounts, 0, 8000, [6000, 2000, 500, 0, 1000, 500], 10000);
    var staker = accounts[1];
    var staker2 = accounts[3];
    await stakingToken.approve(hatVaults.address, web3.utils.toWei("2"), {
      from: staker,
    });
    await stakingToken.approve(hatVaults.address, web3.utils.toWei("1"), {
      from: staker2,
    });
    await stakingToken.mint(staker, web3.utils.toWei("2"));
    await stakingToken.mint(staker2, web3.utils.toWei("1"));

    //stake
    await hatVaults.deposit(0, web3.utils.toWei("1"), { from: staker });
    await hatVaults.deposit(0, web3.utils.toWei("1"), { from: staker2 });

    await utils.increaseTime(7 * 24 * 3600);
    await advanceToSafetyPeriod();
    let tx = await hatVaults.submitClaim(
      0,
      accounts[2],
      8000,
      "description hash",
      {
        from: accounts[1],
      }
    );
    let claimId = tx.logs[0].args._claimId;
    await hatVaults.approveClaim(claimId, 8000);
    await safeEmergencyWithdraw(0, staker);
    await hatVaults.deposit(0, web3.utils.toWei("1"), { from: staker });
    tx = await safeWithdraw(0, web3.utils.toWei("1"), staker2);
    assert.equal(tx.logs[0].event, "SafeTransferReward");
    tx = await safeWithdraw(0, web3.utils.toWei("1"), staker);
    assert.equal(tx.logs[0].event, "SafeTransferReward");
    assert.isFalse(tx.logs[0].args.amount.eq(0));
  }).timeout(40000);

  it("emergencyWithdraw after approve", async () => {
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
    await stakingToken.approve(hatVaults.address, web3.utils.toWei("2"), {
      from: staker,
    });
    await stakingToken.approve(hatVaults.address, web3.utils.toWei("1"), {
      from: staker2,
    });
    await stakingToken.mint(staker, web3.utils.toWei("2"));
    await stakingToken.mint(staker2, web3.utils.toWei("1"));

    //stake
    await hatVaults.deposit(0, web3.utils.toWei("1"), { from: staker });
    //exit
    assert.equal(await hatToken.balanceOf(staker), 0);
    assert.equal(
      await hatToken.balanceOf(hatVaults.address),
      web3.utils.toWei(hatVaultsExpectedHatsBalance.toString())
    );

    await utils.increaseTime(7 * 24 * 3600);
    await advanceToSafetyPeriod();
    let tx = await hatVaults.submitClaim(
      0,
      accounts[2],
      8000,
      "description hash",
      {
        from: accounts[1],
      }
    );
    let claimId = tx.logs[0].args._claimId;
    tx = await hatVaults.approveClaim(claimId, 8000);
    assert.equal(tx.logs[1].event, "ApproveClaim");
    tx = await safeEmergencyWithdraw(0, staker);

    assert.equal(tx.logs[0].args.amount.toString(), web3.utils.toWei("0.2"));
    await hatVaults.deposit(0, web3.utils.toWei("1"), { from: staker2 });
    assert.equal(await hatToken.balanceOf(staker2), 0);

    tx = await safeEmergencyWithdraw(0, staker2);
    assert.equal(tx.logs[0].args.amount.toString(), web3.utils.toWei("1"));

    await hatVaults.deposit(0, web3.utils.toWei("1"), { from: staker });
    tx = await safeWithdraw(0, web3.utils.toWei("1"), staker);
    assert.equal(tx.logs[0].event, "SafeTransferReward");
    assert.isFalse(tx.logs[0].args.amount.eq(0));
    assert.equal(
      (await hatToken.balanceOf(hatVaults.address)).toString(),
      new web3.utils.BN(
        web3.utils.toWei(hatVaultsExpectedHatsBalance.toString())
      )
        .sub(tx.logs[0].args.amount)
        .toString()
    );
  });

  it("enable farming  + 2xapprove+ exit", async () => {
    await setup(accounts);
    var staker = accounts[4];
    await stakingToken.approve(hatVaults.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await stakingToken.mint(staker, web3.utils.toWei("1"));
    //start farming
    //stake
    await hatVaults.deposit(0, web3.utils.toWei("1"), { from: staker });
    await utils.increaseTime(7 * 24 * 3600);
    //exit
    assert.equal(await hatToken.balanceOf(staker), 0);
    await advanceToSafetyPeriod();
    let tx = await hatVaults.submitClaim(
      0,
      accounts[2],
      4000,
      "description hash",
      {
        from: accounts[1],
      }
    );
    let claimId = tx.logs[0].args._claimId;
    await hatVaults.approveClaim(claimId, 4000);
    await advanceToSafetyPeriod();
    tx = await hatVaults.submitClaim(0, accounts[2], 4000, "description hash", {
      from: accounts[1],
    });
    let claimId2 = tx.logs[0].args._claimId;
    assert.isTrue(claimId.toString() !== claimId2.toString());
    await hatVaults.approveClaim(claimId2, 4000);
    await advanceToNoneSaftyPeriod();

    let currentBlockNumber = (await web3.eth.getBlock("latest")).number;
    let lastRewardBlock = (await hatVaults.poolInfos(0)).lastRewardBlock;
    let rewardPerShare = new web3.utils.BN(
      (await hatVaults.poolInfos(0)).rewardPerShare
    );
    let onee12 = new web3.utils.BN("1000000000000");
    let stakeVaule = new web3.utils.BN(web3.utils.toWei("1"));

    let poolReward = await rewardController.getRewardForBlocksRange(
      lastRewardBlock,
      currentBlockNumber + 1 + safeWithdrawBlocksIncrement,
      100,
      100
    );
    rewardPerShare = rewardPerShare.add(poolReward.mul(onee12).div(stakeVaule));
    let expectedReward = stakeVaule.mul(rewardPerShare).div(onee12);
    await safeWithdraw(0, web3.utils.toWei("1"), staker);
    assert.equal(
      (await stakingToken.balanceOf(staker)).toString(),
      "360000000000000000"
    ); //(0.6)*(0.6)

    let balanceOfStakerHats = await hatToken.balanceOf(staker);
    assert.equal(balanceOfStakerHats.toString(), expectedReward);
  });

  it("deposit + withdraw after time end (bdp bug)", async () => {
    await setup(accounts, (await web3.eth.getBlock("latest")).number);
    var staker = accounts[1];
    let hatsAvailable = await hatToken.balanceOf(hatVaults.address);
    await stakingToken.approve(hatVaults.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await stakingToken.mint(staker, web3.utils.toWei("1"));
    await hatVaults.deposit(0, web3.utils.toWei("1"), { from: staker });
    var timeToFinishRewardPlan =
      (await rewardController.epochLength()) *
      (await rewardController.MULTIPLIERS_LENGTH());
    await utils.increaseTime(timeToFinishRewardPlan);

    try {
      await hatVaults.massUpdatePools(0, 2);
      assert(false, "massUpdatePools not in range");
    } catch (ex) {
      assertVMException(ex, "InvalidPoolRange");
    }
    await hatVaults.massUpdatePools(0, 1);

    let expectedReward = await hatVaults.getPendingReward(0, staker);
    tx = await safeWithdraw(0, web3.utils.toWei("1"), staker);
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
      (await hatToken.balanceOf(hatVaults.address))
        .add(tx.logs[0].args.amount)
        .toString()
    );
  });

  it("approve + swapBurnSend", async () => {
    await setup(accounts, 0, 8000, [8000, 1000, 0, 250, 350, 400]);
    var staker = accounts[4];
    await stakingToken.approve(hatVaults.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await stakingToken.mint(staker, web3.utils.toWei("1"));
    await hatVaults.deposit(0, web3.utils.toWei("1"), { from: staker });
    assert.equal(await hatToken.balanceOf(staker), 0);
    await utils.increaseTime(7 * 24 * 3600);
    let path = ethers.utils.solidityPack(
      ["address", "uint24", "address", "uint24", "address"],
      [stakingToken.address, 0, utils.NULL_ADDRESS, 0, hatToken.address]
    );
    let amountToSwapAndBurn = await hatVaults.swapAndBurns(0);
    let amountForHackersHatRewards = await hatVaults.hackersHatRewards(
      accounts[2],
      0
    );
    let amount = amountToSwapAndBurn
      .add(amountForHackersHatRewards)
      .add(await hatVaults.governanceHatRewards(0));
    let payload = ISwapRouter.encodeFunctionData("exactInput", [
      [path, hatVaults.address, 0, amount.toString(), 0],
    ]);

    try {
      await hatVaults.swapBurnSend(0, accounts[2], 0, router.address, payload);
      assert(false, "cannot swapBurnSend before approve");
    } catch (ex) {
      assertVMException(ex, "AmountToSwapIsZero");
    }
    await advanceToSafetyPeriod();
    let tx = await hatVaults.submitClaim(
      0,
      accounts[2],
      8000,
      "description hash",
      {
        from: accounts[1],
      }
    );
    let claimId = tx.logs[0].args._claimId;
    await hatVaults.approveClaim(claimId, 8000);
    await stakingToken.approveDisable(true);
    try {
      await hatVaults.swapBurnSend(0, accounts[2], 0, router.address, payload);
      assert(false, "approve disabled");
    } catch (ex) {
      assertVMException(ex, "TokenApproveFailed");
    }
    await stakingToken.approveDisable(false);
    await stakingToken.approveZeroDisable(true);
    try {
      await hatVaults.swapBurnSend(0, accounts[2], 0, router.address, payload);
      assert(false, "approve to 0 disabled");
    } catch (ex) {
      assertVMException(ex, "TokenApproveResetFailed");
    }
    await stakingToken.approveZeroDisable(false);
    amountToSwapAndBurn = await hatVaults.swapAndBurns(0);
    amountForHackersHatRewards = await hatVaults.hackersHatRewards(
      accounts[2],
      0
    );
    amount = amountToSwapAndBurn
      .add(amountForHackersHatRewards)
      .add(await hatVaults.governanceHatRewards(0));
    payload = ISwapRouter.encodeFunctionData("exactInput", [
      [path, hatVaults.address, 0, amount.toString(), 0],
    ]);
    tx = await hatVaults.swapBurnSend(
      0,
      accounts[2],
      0,
      router.address,
      payload
    );
    assert.equal(
      await stakingToken.allowance(hatVaults.address, await router.address),
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
      await hatVaults.swapBurnSend(0, accounts[2], 0, router.address, payload);
      assert(false, "cannot swapBurnSend twice");
    } catch (ex) {
      assertVMException(ex, "AmountToSwapIsZero");
    }
  });

  it("approve + swapBurnSend weth pool", async () => {
    await setup(
      accounts,
      0,
      8000,
      [8000, 1000, 0, 250, 350, 400],
      10,
      0,
      100,
      stakingToken.address
    );
    assert.equal(await router.WETH9(), stakingToken.address);
    var staker = accounts[4];
    await stakingToken.approve(hatVaults.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await stakingToken.mint(staker, web3.utils.toWei("1"));
    await hatVaults.deposit(0, web3.utils.toWei("1"), { from: staker });
    assert.equal(await hatToken.balanceOf(staker), 0);
    await utils.increaseTime(7 * 24 * 3600);
    await advanceToSafetyPeriod();
    let tx = await hatVaults.submitClaim(
      0,
      accounts[2],
      8000,
      "description hash",
      {
        from: accounts[1],
      }
    );
    let claimId = tx.logs[0].args._claimId;
    await hatVaults.approveClaim(claimId, 8000);
    await stakingToken.approveDisable(true);

    await stakingToken.approveDisable(false);
    let path = ethers.utils.solidityPack(
      ["address", "uint24", "address"],
      [stakingToken.address, 0, hatToken.address]
    );
    let amountToSwapAndBurn = await hatVaults.swapAndBurns(0);
    let amountForHackersHatRewards = await hatVaults.hackersHatRewards(
      accounts[2],
      0
    );
    let amount = amountToSwapAndBurn
      .add(amountForHackersHatRewards)
      .add(await hatVaults.governanceHatRewards(0));
    let payload = ISwapRouter.encodeFunctionData("exactInput", [
      [path, hatVaults.address, 0, amount.toString(), 0],
    ]);
    tx = await hatVaults.swapBurnSend(
      0,
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

  it("approve+ swapBurnSend with HAT Pool", async () => {
    await setup(accounts);
    var staker = accounts[4];
    await hatVaults.addPool(
      hatToken.address,
      accounts[1],
      8000,
      [6000, 2000, 500, 0, 1000, 500],
      "_descriptionHash",
      [86400, 10],
      false,
      true
    );
    await rewardController.setAllocPoint(
      (await hatVaults.getNumberOfPools()) - 1,
      100
    );
    await hatToken.approve(hatVaults.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await utils.setMinter(hatToken, accounts[0], web3.utils.toWei("1"));
    await hatToken.mint(staker, web3.utils.toWei("1"));
    await hatVaults.committeeCheckIn(1, { from: accounts[1] });
    await hatVaults.deposit(1, web3.utils.toWei("1"), { from: staker });
    assert.equal(await hatToken.balanceOf(staker), 0);
    assert.equal(
      await hatToken.balanceOf(hatVaults.address),
      web3.utils.toWei((hatVaultsExpectedHatsBalance + 1).toString())
    );

    await utils.increaseTime(7 * 24 * 3600);
    let path = ethers.utils.solidityPack(
      ["address", "uint24", "address", "uint24", "address"],
      [stakingToken.address, 0, utils.NULL_ADDRESS, 0, hatToken.address]
    );
    let amountToSwapAndBurn = await hatVaults.swapAndBurns(0);
    let amountForHackersHatRewards = await hatVaults.hackersHatRewards(
      accounts[2],
      0
    );
    let amount = amountToSwapAndBurn
      .add(amountForHackersHatRewards)
      .add(await hatVaults.governanceHatRewards(0));
    let payload = ISwapRouter.encodeFunctionData("exactInput", [
      [path, hatVaults.address, 0, amount.toString(), 0],
    ]);
    try {
      await hatVaults.swapBurnSend(0, accounts[2], 0, router.address, payload);
      assert(false, "cannot swapBurnSend before approve");
    } catch (ex) {
      assertVMException(ex, "AmountToSwapIsZero");
    }
    await advanceToSafetyPeriod();
    let tx = await hatVaults.submitClaim(
      1,
      accounts[2],
      8000,
      "description hash",
      {
        from: accounts[1],
      }
    );
    let claimId = tx.logs[0].args._claimId;
    await hatVaults.approveClaim(claimId, 8000);
    assert.equal(await hatToken.balanceOf(accounts[0]), 0);
    amountToSwapAndBurn = await hatVaults.swapAndBurns(0);
    amountForHackersHatRewards = await hatVaults.hackersHatRewards(
      accounts[2],
      0
    );
    amount = amountToSwapAndBurn
      .add(amountForHackersHatRewards)
      .add(await hatVaults.governanceHatRewards(0));
    payload = ISwapRouter.encodeFunctionData("exactInput", [
      [path, hatVaults.address, 0, amount.toString(), 0],
    ]);
    tx = await hatVaults.swapBurnSend(
      1,
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
      await hatVaults.swapBurnSend(0, accounts[2], 0, router.address, payload);
      assert(false, "cannot swapBurnSend twice");
    } catch (ex) {
      assertVMException(ex, "AmountToSwapIsZero");
    }
  });

  it("set shares", async () => {
    await setup(accounts);
    try {
      await hatVaults.setShares(1, 0, 0, [], [], []);
      assert(false, "no pool exist");
    } catch (ex) {
      assertVMException(ex, "PoolDoesNotExist");
    }

    try {
      await hatVaults.setPoolInitialized(1);
      assert(false, "no pool exist");
    } catch (ex) {
      assertVMException(ex, "PoolDoesNotExist");
    }

    await hatVaults.setPoolInitialized(0);

    try {
      await hatVaults.setShares(0, 0, 0, [], [], []);
      assert(false, "pool already initialized");
    } catch (ex) {
      assertVMException(ex, "PoolMustNotBeInitialized");
    }

    await hatVaults.addPool(
      stakingToken.address,
      accounts[1],
      8000,
      [8000, 1000, 100, 150, 350, 400],
      "_descriptionHash",
      [86400, 10],
      false,
      false
    );
    await rewardController.setAllocPoint(
      (await hatVaults.getNumberOfPools()) - 1,
      100
    );

    try {
      await hatVaults.setShares(1, 100, 100, [accounts[0]], [1], [1, 1]);
      assert(false, "arrays lengths must match");
    } catch (ex) {
      assertVMException(ex, "SetSharesArraysMustHaveSameLength");
    }

    try {
      await hatVaults.setShares(1, 100, 100, [accounts[0]], [1, 1], [1]);
      assert(false, "arrays lengths must match");
    } catch (ex) {
      assertVMException(ex, "SetSharesArraysMustHaveSameLength");
    }

    try {
      await hatVaults.setShares(
        1,
        100,
        100,
        [accounts[0], accounts[1]],
        [1],
        [1]
      );
      assert(false, "arrays lengths must match");
    } catch (ex) {
      assertVMException(ex, "SetSharesArraysMustHaveSameLength");
    }

    await hatVaults.setShares(
      1,
      10,
      100,
      [accounts[0], accounts[1]],
      [1, 2],
      [1, 2]
    );
    assert.equal(
      (await hatVaults.poolInfos(1)).rewardPerShare.toString(),
      "10"
    );
    assert.equal((await hatVaults.poolInfos(1)).balance.toString(), "100");
    assert.equal((await hatVaults.poolInfos(1)).totalShares.toString(), "3");
    assert.equal(
      (await hatVaults.userInfo(1, accounts[0])).shares.toString(),
      "1"
    );
    assert.equal(
      (await hatVaults.userInfo(1, accounts[0])).rewardDebt.toString(),
      "1"
    );
    assert.equal(
      (await hatVaults.userInfo(1, accounts[1])).shares.toString(),
      "2"
    );
    assert.equal(
      (await hatVaults.userInfo(1, accounts[1])).rewardDebt.toString(),
      "2"
    );

    await hatVaults.addPool(
      stakingToken.address,
      accounts[1],
      8000,
      [8000, 1000, 100, 150, 350, 400],
      "_descriptionHash",
      [86400, 10],
      false,
      true
    );

    await rewardController.setAllocPoint(
      (await hatVaults.getNumberOfPools()) - 1,
      100
    );

    try {
      await hatVaults.setShares(2, 0, 0, [], [], []);
      assert(false, "pool already initialized");
    } catch (ex) {
      assertVMException(ex, "PoolMustNotBeInitialized");
    }
  });

  it("setPool", async () => {
    await setup(accounts);
    try {
      await hatVaults.setPool(1, true, false, "_descriptionHash");
      assert(false, "no pool exist");
    } catch (ex) {
      assertVMException(ex, "PoolDoesNotExist");
    }
    await hatVaults.setPool(0, true, false, "_descriptionHash");
    await rewardController.setAllocPoint(0, 200);

    var staker = accounts[4];
    await stakingToken.approve(hatVaults.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await stakingToken.mint(staker, web3.utils.toWei("1"));
    await hatVaults.deposit(0, web3.utils.toWei("1"), { from: staker });
    assert.equal(await hatToken.balanceOf(staker), 0);
    await hatVaults.setPool(0, true, false, "_descriptionHash");
    await hatVaults.setPool(0, true, false, "_descriptionHash");
    await rewardController.setAllocPoint(0, 200);
    let expectedReward = await calculateExpectedReward(staker);
    assert.equal(await stakingToken.balanceOf(staker), 0);
    var tx = await hatVaults.claimReward(0, { from: staker });
    assert.equal(tx.logs[0].event, "ClaimReward");
    assert.equal(tx.logs[0].args._pid, 0);
    assert.equal(
      (await hatToken.balanceOf(staker)).toString(),
      expectedReward.toString()
    );
    assert.equal(await stakingToken.balanceOf(staker), 0);
    assert.equal(
      await stakingToken.balanceOf(hatVaults.address),
      web3.utils.toWei("1")
    );
  });

  it("swapAndBurn bounty check", async () => {
    await setup(accounts);
    var staker = accounts[4];
    var staker2 = accounts[3];
    await stakingToken.approve(hatVaults.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await stakingToken.approve(hatVaults.address, web3.utils.toWei("1"), {
      from: staker2,
    });
    await stakingToken.mint(staker, web3.utils.toWei("1"));
    await stakingToken.mint(staker2, web3.utils.toWei("1"));

    await hatVaults.deposit(0, web3.utils.toWei("1"), { from: staker });

    assert.equal(await hatToken.balanceOf(staker), 0);
    await utils.increaseTime(7 * 24 * 3600);
    await advanceToSafetyPeriod();
    let tx = await hatVaults.submitClaim(
      0,
      accounts[2],
      8000,
      "description hash",
      {
        from: accounts[1],
      }
    );
    let claimId = tx.logs[0].args._claimId;
    await hatVaults.approveClaim(claimId, 8000);
    let path = ethers.utils.solidityPack(
      ["address", "uint24", "address", "uint24", "address"],
      [stakingToken.address, 0, utils.NULL_ADDRESS, 0, hatToken.address]
    );
    let amountToSwapAndBurn = await hatVaults.swapAndBurns(0);
    let amountForHackersHatRewards = await hatVaults.hackersHatRewards(
      accounts[2],
      0
    );
    let amount = amountToSwapAndBurn
      .add(amountForHackersHatRewards)
      .add(await hatVaults.governanceHatRewards(0));
    let payload = ISwapRouter.encodeFunctionData("exactInput", [
      [path, hatVaults.address, 0, amount.toString(), 0],
    ]);
    tx = await hatVaults.swapBurnSend(
      0,
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
            (await hatVaults.bountyInfos(0)).bountySplit.swapAndBurn
          )
            .add(
              new web3.utils.BN(
                (await hatVaults.bountyInfos(0)).bountySplit.hackerHatVested
              )
            )
            .add(
              new web3.utils.BN(
                (await hatVaults.bountyInfos(0)).bountySplit.governanceHat
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
            (await hatVaults.bountyInfos(0)).bountySplit.swapAndBurn
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
            (await hatVaults.bountyInfos(0)).bountySplit.hackerHatVested
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

    await stakingToken.approve(hatVaults.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await stakingToken.approve(hatVaults.address, web3.utils.toWei("1"), {
      from: staker2,
    });
    await stakingToken.mint(staker, web3.utils.toWei("1"));
    await stakingToken.mint(staker2, web3.utils.toWei("1"));

    await hatVaults.deposit(0, web3.utils.toWei("1"), { from: staker });

    assert.equal(await hatToken.balanceOf(staker), 0);
    await utils.increaseTime(7 * 24 * 3600);
    await advanceToSafetyPeriod();
    let tx = await hatVaults.submitClaim(
      0,
      accounts[2],
      8000,
      "description hash",
      {
        from: accounts[1],
      }
    );
    let claimId = tx.logs[0].args._claimId;
    await hatVaults.approveClaim(claimId, 8000);

    let path = ethers.utils.solidityPack(
      ["address", "uint24", "address", "uint24", "address"],
      [stakingToken.address, 0, utils.NULL_ADDRESS, 0, hatToken.address]
    );
    let amountToSwapAndBurn = await hatVaults.swapAndBurns(0);
    let amountForHackersHatRewards = await hatVaults.hackersHatRewards(
      accounts[1],
      0
    );
    let amount = amountToSwapAndBurn
      .add(amountForHackersHatRewards)
      .add(await hatVaults.governanceHatRewards(0));
    let payload = ISwapRouter.encodeFunctionData("exactInput", [
      [path, hatVaults.address, 0, amount.toString(), 0],
    ]);

    try {
      await hatVaults.swapBurnSend(0, accounts[1], 0, router.address, payload, {
        from: accounts[3],
      });
      assert(false, "only gov");
    } catch (ex) {
      assertVMException(ex, "Ownable: caller is not the owner");
    }

    try {
      await hatVaults.swapBurnSend(0, accounts[1], 0, accounts[1], payload, {
        from: accounts[0],
      });
      assert(false, "can only use whitelisted routers");
    } catch (ex) {
      assertVMException(ex, "RoutingContractNotWhitelisted");
    }

    try {
      await hatVaults.setRouterWhitelistStatus(router.address, false, {
        from: accounts[3],
      });
      assert(false, "only gov");
    } catch (ex) {
      assertVMException(ex, "Ownable: caller is not the owner");
    }

    tx = await hatVaults.setRouterWhitelistStatus(router.address, false, {
      from: accounts[0],
    });

    assert.equal(tx.logs[0].event, "RouterWhitelistStatusChanged");
    assert.equal(tx.logs[0].args._router, router.address);
    assert.equal(tx.logs[0].args._status, false);

    try {
      await hatVaults.swapBurnSend(0, accounts[1], 0, router.address, payload, {
        from: accounts[0],
      });
      assert(false, "can only use whitelisted routers");
    } catch (ex) {
      assertVMException(ex, "RoutingContractNotWhitelisted");
    }

    tx = await hatVaults.setRouterWhitelistStatus(router.address, true, {
      from: accounts[0],
    });

    assert.equal(tx.logs[0].event, "RouterWhitelistStatusChanged");
    assert.equal(tx.logs[0].args._router, router.address);
    assert.equal(tx.logs[0].args._status, true);

    tx = await hatVaults.swapBurnSend(
      0,
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
            (await hatVaults.bountyInfos(0)).bountySplit.swapAndBurn
          ).add(
            new web3.utils.BN(
              (await hatVaults.bountyInfos(0)).bountySplit.governanceHat
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
            (await hatVaults.bountyInfos(0)).bountySplit.swapAndBurn
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

    amountToSwapAndBurn = await hatVaults.swapAndBurns(0);
    amountForHackersHatRewards = await hatVaults.hackersHatRewards(
      accounts[2],
      0
    );
    amount = amountToSwapAndBurn
      .add(amountForHackersHatRewards)
      .add(await hatVaults.governanceHatRewards(0));
    payload = ISwapRouter.encodeFunctionData("exactInput", [
      [path, hatVaults.address, 0, amount.toString(), 0],
    ]);

    tx = await hatVaults.swapBurnSend(
      0,
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
            (await hatVaults.bountyInfos(0)).bountySplit.hackerHatVested
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
      tx = await hatVaults.swapBurnSend(
        0,
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
      tx = await hatVaults.swapBurnSend(
        0,
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

  it("swapBurnSend 2 pools with same token", async () => {
    await setup(accounts);

    await hatVaults.addPool(
      stakingToken.address,
      accounts[1],
      8000,
      [8000, 1000, 100, 150, 350, 400],
      "_descriptionHash",
      [86400, 10],
      false,
      true
    );

    await rewardController.setAllocPoint(
      (await hatVaults.getNumberOfPools()) - 1,
      100
    );
    await hatVaults.committeeCheckIn(1, { from: accounts[1] });

    var staker = accounts[4];
    var staker2 = accounts[3];

    await stakingToken.approve(hatVaults.address, web3.utils.toWei("2"), {
      from: staker,
    });
    await stakingToken.approve(hatVaults.address, web3.utils.toWei("2"), {
      from: staker2,
    });
    await stakingToken.mint(staker, web3.utils.toWei("2"));
    await stakingToken.mint(staker2, web3.utils.toWei("2"));

    await hatVaults.deposit(0, web3.utils.toWei("1"), { from: staker });
    await hatVaults.deposit(1, web3.utils.toWei("1"), { from: staker });

    assert.equal(await hatToken.balanceOf(staker), 0);
    await utils.increaseTime(7 * 24 * 3600);
    await advanceToSafetyPeriod();
    let tx = await hatVaults.submitClaim(
      0,
      accounts[2],
      8000,
      "description hash",
      {
        from: accounts[1],
      }
    );
    let claimId = tx.logs[0].args._claimId;
    tx = await hatVaults.submitClaim(1, accounts[2], 8000, "description hash", {
      from: accounts[1],
    });
    let claimId2 = tx.logs[0].args._claimId;
    assert.isTrue(claimId.toString() !== claimId2.toString());
    await hatVaults.approveClaim(claimId, 8000);
    await hatVaults.approveClaim(claimId2, 8000);

    for (i = 0; i < 2; i++) {
      let path = ethers.utils.solidityPack(
        ["address", "uint24", "address", "uint24", "address"],
        [stakingToken.address, 0, utils.NULL_ADDRESS, 0, hatToken.address]
      );
      let amountToSwapAndBurn = await hatVaults.swapAndBurns(i);
      let amountForHackersHatRewards = await hatVaults.hackersHatRewards(
        accounts[1],
        i
      );
      let amount = amountToSwapAndBurn
        .add(amountForHackersHatRewards)
        .add(await hatVaults.governanceHatRewards(i));
      let payload = ISwapRouter.encodeFunctionData("exactInput", [
        [path, hatVaults.address, 0, amount.toString(), 0],
      ]);
      tx = await hatVaults.swapBurnSend(
        i,
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
              (await hatVaults.bountyInfos(i)).bountySplit.swapAndBurn
            ).add(
              new web3.utils.BN(
                (await hatVaults.bountyInfos(i)).bountySplit.governanceHat
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
              (await hatVaults.bountyInfos(i)).bountySplit.swapAndBurn
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
      assert.equal(
        tx.logs[1].args._amountReceived.toString(),
        afterBountyBalance
      );
    }

    for (i = 0; i < 2; i++) {
      let path = ethers.utils.solidityPack(
        ["address", "uint24", "address", "uint24", "address"],
        [stakingToken.address, 0, utils.NULL_ADDRESS, 0, hatToken.address]
      );
      let amountToSwapAndBurn = await hatVaults.swapAndBurns(i);
      let amountForHackersHatRewards = await hatVaults.hackersHatRewards(
        accounts[2],
        i
      );
      let amount = amountToSwapAndBurn
        .add(amountForHackersHatRewards)
        .add(await hatVaults.governanceHatRewards(i));
      let payload = ISwapRouter.encodeFunctionData("exactInput", [
        [path, hatVaults.address, 0, amount.toString(), 0],
      ]);
      tx = await hatVaults.swapBurnSend(
        i,
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
              (await hatVaults.bountyInfos(i)).bountySplit.hackerHatVested
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
    }
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

    await stakingToken.approve(hatVaults.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await stakingToken.approve(hatVaults.address, web3.utils.toWei("1"), {
      from: staker2,
    });
    await stakingToken.mint(staker, web3.utils.toWei("1"));
    await stakingToken.mint(staker2, web3.utils.toWei("1"));

    await hatVaults.deposit(0, web3.utils.toWei("1"), { from: staker });

    assert.equal(await hatToken.balanceOf(staker), 0);
    await utils.increaseTime(7 * 24 * 3600);
    await advanceToSafetyPeriod();
    let tx = await hatVaults.submitClaim(
      0,
      accounts[2],
      8000,
      "description hash",
      {
        from: accounts[1],
      }
    );
    let claimId = tx.logs[0].args._claimId;
    await hatVaults.approveClaim(claimId, 8000);
    let path = ethers.utils.solidityPack(
      ["address", "uint24", "address", "uint24", "address"],
      [stakingToken.address, 0, utils.NULL_ADDRESS, 0, hatToken.address]
    );
    let amountToSwapAndBurn = await hatVaults.swapAndBurns(0);
    let amountForHackersHatRewards = await hatVaults.hackersHatRewards(
      accounts[1],
      0
    );
    let amount = amountToSwapAndBurn
      .add(amountForHackersHatRewards)
      .add(await hatVaults.governanceHatRewards(0));
    let payload = ISwapRouter.encodeFunctionData("exactInput", [
      [path, hatVaults.address, 0, amount.toString(), 0],
    ]);
    try {
      await hatVaults.swapBurnSend(
        0,
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

    await stakingToken.approve(hatVaults.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await stakingToken.approve(hatVaults.address, web3.utils.toWei("1"), {
      from: staker2,
    });
    await stakingToken.mint(staker, web3.utils.toWei("1"));
    await stakingToken.mint(staker2, web3.utils.toWei("1"));

    await hatVaults.deposit(0, web3.utils.toWei("1"), { from: staker });

    assert.equal(await hatToken.balanceOf(staker), 0);
    await utils.increaseTime(7 * 24 * 3600);
    await advanceToSafetyPeriod();
    let tx = await hatVaults.submitClaim(
      0,
      accounts[2],
      8000,
      "description hash",
      {
        from: accounts[1],
      }
    );
    let claimId = tx.logs[0].args._claimId;
    await hatVaults.approveClaim(claimId, 8000);
    let payload = "0x00000000000000000000000000000000000001";
    try {
      await hatVaults.swapBurnSend(
        0,
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
    var tx = await hatVaults.logClaim(someHash, { from: accounts[3] });
    assert.equal(tx.logs[0].event, "LogClaim");
    assert.equal(tx.logs[0].args._descriptionHash, someHash);
    assert.equal(tx.logs[0].args._claimer, accounts[3]);

    tx = await hatVaults.setClaimFee(fee);
    assert.equal(tx.logs[0].event, "SetClaimFee");
    assert.equal(tx.logs[0].args._fee, fee);
    var govBalanceBefore = new web3.utils.BN(
      await web3.eth.getBalance(accounts[0])
    );
    try {
      await hatVaults.logClaim(someHash, {
        from: accounts[3],
        value: web3.utils.toWei("0.9"),
      });
      assert(false, "fee is not enough");
    } catch (ex) {
      assertVMException(ex, "NotEnoughFeePaid");
    }
    tx = await hatVaults.logClaim(someHash, {
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
    await stakingToken.approve(hatVaults.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await stakingToken.approve(hatVaults.address, web3.utils.toWei("1"), {
      from: staker2,
    });
    await stakingToken.mint(staker, web3.utils.toWei("1"));
    await stakingToken.mint(staker2, web3.utils.toWei("1"));

    //stake
    await hatVaults.deposit(0, web3.utils.toWei("1"), { from: staker });
    assert.equal(await hatToken.balanceOf(staker), 0);
    await utils.increaseTime(7 * 24 * 3600);
    await advanceToSafetyPeriod();
    let tx = await hatVaults.submitClaim(
      0,
      accounts[2],
      8000,
      "description hash",
      {
        from: accounts[1],
      }
    );
    let claimId = tx.logs[0].args._claimId;
    tx = await hatVaults.approveClaim(claimId, 8000);
    assert.equal(tx.logs[1].event, "ApproveClaim");
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
    await stakingToken.approve(hatVaults.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await stakingToken.mint(staker, web3.utils.toWei("1"));

    //stake
    await hatVaults.deposit(0, web3.utils.toWei("1"), { from: staker });
    await utils.increaseTime(7 * 24 * 3600);
    await advanceToSafetyPeriod();
    let tx = await hatVaults.submitClaim(
      0,
      accounts[2],
      8000,
      "description hash",
      {
        from: accounts[1],
      }
    );
    let claimId = tx.logs[0].args._claimId;
    tx = await hatVaults.approveClaim(claimId, 8000);
    assert.equal(tx.logs[0].event, "ApproveClaim");
    assert.equal(tx.logs[0].args._tokenLock, utils.NULL_ADDRESS);
    assert.equal(
      await stakingToken.balanceOf(hatVaults.address),
      web3.utils.toWei("0.2")
    );
    assert.equal(
      await stakingToken.balanceOf(accounts[2]),
      web3.utils.toWei("0.8")
    );
  });

  it("set vesting params", async () => {
    await setup(accounts);
    assert.equal((await hatVaults.bountyInfos(0)).vestingDuration, 86400);
    assert.equal((await hatVaults.bountyInfos(0)).vestingPeriods, 10);

    try {
      await hatVaults.setVestingParams(0, 21000, 7, { from: accounts[2] });
      assert(false, "only gov can set vesting params");
    } catch (ex) {
      assertVMException(ex, "Ownable: caller is not the owner");
    }
    try {
      await hatVaults.setVestingParams(0, 21000, 0);
      assert(false, "period should not be zero");
    } catch (ex) {
      assertVMException(ex, "VestingPeriodsCannotBeZero");
    }
    try {
      await hatVaults.setVestingParams(0, 120 * 24 * 3600, 7);
      assert(false, "duration should be less than 120 days");
    } catch (ex) {
      assertVMException(ex, "VestingDurationTooLong");
    }
    try {
      await hatVaults.setVestingParams(0, 6, 7);
      assert(false, "duration should be greater than or equal to period");
    } catch (ex) {
      assertVMException(ex, "VestingDurationSmallerThanPeriods");
    }
    var tx = await hatVaults.setVestingParams(0, 21000, 7);
    assert.equal(tx.logs[0].event, "SetVestingParams");
    assert.equal(tx.logs[0].args._duration, 21000);
    assert.equal(tx.logs[0].args._periods, 7);

    assert.equal((await hatVaults.bountyInfos(0)).vestingDuration, 21000);
    assert.equal((await hatVaults.bountyInfos(0)).vestingPeriods, 7);
  });

  it("set hat vesting params", async () => {
    await setup(accounts);
    assert.equal(
      (await hatVaults.generalParameters()).hatVestingDuration,
      90 * 3600 * 24
    );
    assert.equal((await hatVaults.generalParameters()).hatVestingPeriods, 90);

    try {
      await hatVaults.setHatVestingParams(21000, 7, { from: accounts[2] });
      assert(false, "only gov can set vesting params");
    } catch (ex) {
      assertVMException(ex, "Ownable: caller is not the owner");
    }
    try {
      await hatVaults.setHatVestingParams(21000, 0);
      assert(false, "period should not be zero");
    } catch (ex) {
      assertVMException(ex, "VestingPeriodsCannotBeZero");
    }
    try {
      await hatVaults.setHatVestingParams(180 * 24 * 3600, 7);
      assert(false, "duration should be less than 180 days");
    } catch (ex) {
      assertVMException(ex, "VestingDurationTooLong");
    }
    try {
      await hatVaults.setHatVestingParams(6, 7);
      assert(false, "duration should be greater than or equal to period");
    } catch (ex) {
      assertVMException(ex, "VestingDurationSmallerThanPeriods");
    }
    var tx = await hatVaults.setHatVestingParams(21000, 7);
    assert.equal(tx.logs[0].event, "SetHatVestingParams");
    assert.equal(tx.logs[0].args._duration, 21000);
    assert.equal(tx.logs[0].args._periods, 7);

    assert.equal(
      (await hatVaults.generalParameters()).hatVestingDuration,
      21000
    );
    assert.equal((await hatVaults.generalParameters()).hatVestingPeriods, 7);
  });

  it("unSafeWithdraw", async () => {
    await setup(accounts);
    var staker = accounts[1];

    await stakingToken.approve(hatVaults.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await stakingToken.mint(staker, web3.utils.toWei("1"));

    //stake
    await hatVaults.deposit(0, web3.utils.toWei("1"), { from: staker });
    try {
      await unSafeWithdraw(0, web3.utils.toWei("1"), staker);
      assert(false, "cannot withdraw on safety period");
    } catch (ex) {
      assertVMException(ex, "InvalidWithdrawRequest");
    }
  });

  it("setPool x2", async () => {
    var poolManagerMock = await PoolsManagerMock.new();
    //  await setup(accounts, REAL_REWARD_PER_BLOCK, 0, [], [0,0, 0, 0,0, 0],10000);
    await setup(accounts, (await web3.eth.getBlock("latest")).number);
    var staker = accounts[1];
    await stakingToken.approve(hatVaults.address, web3.utils.toWei("2"), {
      from: staker,
    });
    await stakingToken.mint(staker, web3.utils.toWei("2"));
    await hatVaults.deposit(0, web3.utils.toWei("1"), { from: staker });
    let stakingToken2 = await ERC20Mock.new("Staking", "STK");
    await hatVaults.addPool(
      stakingToken2.address,
      accounts[1],
      8000,
      [6000, 2000, 500, 0, 1000, 500],
      "_descriptionHash",
      [86400, 10],
      false,
      true
    );

    await rewardController.setAllocPoint(
      (await hatVaults.getNumberOfPools()) - 1,
      100
    );
    await hatVaults.setCommittee(1, accounts[0], { from: accounts[1] });
    await stakingToken2.approve(hatVaults.address, web3.utils.toWei("2"), {
      from: staker,
    });
    await stakingToken2.mint(staker, web3.utils.toWei("2"));
    await hatVaults.committeeCheckIn(1, { from: accounts[0] });
    await hatVaults.deposit(1, web3.utils.toWei("1"), { from: staker });
    await hatVaults.setPool(0, true, false, "123");
    await rewardController.setAllocPoint(0, 200);
    // Update twice in one block should be same as once
    await poolManagerMock.updatePoolsTwice(hatVaults.address, 0, 1);
    await hatVaults.setPool(1, true, false, "123");
    await rewardController.setAllocPoint(1, 200);
    await hatVaults.massUpdatePools(0, 2);
    assert.equal(
      Math.round(
        web3.utils.fromWei(await hatToken.balanceOf(hatVaults.address))
      ),
      hatVaultsExpectedHatsBalance
    );
    try {
      await hatVaults.massUpdatePools(2, 1);
      assert(false, "invalid mass update pools range");
    } catch (ex) {
      assertVMException(ex, "InvalidPoolRange");
    }
  });

  it("addPool with zero alloc point", async () => {
    await setup(accounts, (await web3.eth.getBlock("latest")).number);
    var staker = accounts[1];
    let stakingToken2 = await ERC20Mock.new("Staking", "STK");
    await hatVaults.addPool(
      stakingToken2.address,
      accounts[0],
      8000,
      [6000, 2000, 500, 0, 1000, 500],
      "_descriptionHash",
      [86400, 10],
      false,
      true
    );
    await hatVaults.setPool(1, true, false, "123");
    await rewardController.setAllocPoint(1, 200);
    await hatVaults.setPool(1, true, false, "123");
    await rewardController.setAllocPoint(1, 0);
    await stakingToken2.approve(hatVaults.address, web3.utils.toWei("2"), {
      from: staker,
    });
    await stakingToken2.mint(staker, web3.utils.toWei("2"));
    await hatVaults.committeeCheckIn(1, { from: accounts[0] });
    await hatVaults.deposit(1, web3.utils.toWei("1"), { from: staker });
    assert.equal(
      Math.round(
        web3.utils.fromWei(await hatToken.balanceOf(hatVaults.address))
      ),
      hatVaultsExpectedHatsBalance
    );
    await hatVaults.updatePool(1);
    assert.equal(
      Math.round(
        web3.utils.fromWei(await hatToken.balanceOf(hatVaults.address))
      ),
      hatVaultsExpectedHatsBalance
    );
  });

  it("setPool x2 v2", async () => {
    await setup(
      accounts,
      (await web3.eth.getBlock("latest")).number,
      8000,
      [6000, 2000, 500, 0, 1000, 500],
      10000
    );

    var staker = accounts[1];
    await stakingToken.approve(hatVaults.address, web3.utils.toWei("2"), {
      from: staker,
    });
    await stakingToken.mint(staker, web3.utils.toWei("2"));
    let stakingToken2 = await ERC20Mock.new("Staking", "STK");
    try {
      await hatVaults.addPool(
        stakingToken2.address,
        utils.NULL_ADDRESS,
        8000,
        [6000, 2000, 500, 0, 1000, 500],
        "_descriptionHash",
        [86400, 10],
        false,
        true
      );
      assert(false, "committee cannot be zero");
    } catch (ex) {
      assertVMException(ex, "CommitteeIsZero");
    }

    try {
      await hatVaults.addPool(
        utils.NULL_ADDRESS,
        accounts[1],
        8000,
        [6000, 2000, 500, 0, 1000, 500],
        "_descriptionHash",
        [86400, 10],
        false,
        true
      );
      assert(false, "lp token cannot be zero");
    } catch (ex) {
      assertVMException(ex, "LPTokenIsZero");
    }

    try {
      await hatVaults.addPool(
        stakingToken2.address,
        accounts[1],
        8000,
        [6000, 2000, 500, 0, 1000, 500],
        "_descriptionHash",
        [10, 86400],
        false,
        true
      );
      assert(false, "vesting duration smaller than period");
    } catch (ex) {
      assertVMException(ex, "VestingDurationSmallerThanPeriods");
    }

    try {
      await hatVaults.addPool(
        stakingToken2.address,
        accounts[1],
        8000,
        [6000, 2000, 500, 0, 1000, 500],
        "_descriptionHash",
        [121 * 24 * 3600, 10],
        false,
        true
      );
      assert(false, "vesting duration is too long");
    } catch (ex) {
      assertVMException(ex, "VestingDurationTooLong");
    }

    try {
      await hatVaults.addPool(
        stakingToken2.address,
        accounts[1],
        8000,
        [0, 0, 500, 0, 9000, 500],
        "_descriptionHash",
        [86400, 10],
        false,
        true
      );
      assert(false, "bounty payout to hacker is zero");
    } catch (ex) {
      assertVMException(ex, "BountySplitMustIncludeHackerPayout");
    }

    try {
      await hatVaults.addPool(
        stakingToken2.address,
        accounts[1],
        8000,
        [6000, 2000, 500, 0, 1000, 500],
        "_descriptionHash",
        [86400, 0],
        false,
        true
      );
      assert(false, "vesting period cannot be zero");
    } catch (ex) {
      assertVMException(ex, "VestingPeriodsCannotBeZero");
    }
    await hatVaults.addPool(
      stakingToken2.address,
      accounts[1],
      8000,
      [6000, 2000, 500, 0, 1000, 500],
      "_descriptionHash",
      [86400, 10],
      false,
      true
    );
    await rewardController.setAllocPoint(
      (await hatVaults.getNumberOfPools()) - 1,
      100
    );
    await hatVaults.setCommittee(1, accounts[0], { from: accounts[1] });
    await stakingToken2.approve(hatVaults.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await stakingToken2.mint(staker, web3.utils.toWei("1"));

    await hatVaults.deposit(0, web3.utils.toWei("1"), { from: staker });
    await hatVaults.committeeCheckIn(1, { from: accounts[0] });
    await hatVaults.deposit(1, web3.utils.toWei("1"), { from: staker });

    await hatVaults.setPool(0, true, false, "123");
    await rewardController.setAllocPoint(0, 200);

    await hatVaults.massUpdatePools(0, 2);
    assert.equal(
      Math.round(
        web3.utils.fromWei(await hatToken.balanceOf(hatVaults.address))
      ),
      hatVaultsExpectedHatsBalance
    );
  });

  //   it("addPool with the same token", async () => {
  //     await setup(accounts, REAL_REWARD_PER_BLOCK, (await web3.eth.getBlock("latest")).number, [], [0,0, 0, 0,0, 0],10000);
  //
  //     var staker = accounts[1];
  //     await stakingToken.approve(hatVaults.address,web3.utils.toWei("2"),{from:staker});
  //     await stakingToken.mint(staker,web3.utils.toWei("2"));
  //     await hatVaults.addPool(100,stakingToken.address,accounts[1],[],[0,0,0,0,0,0],"_descriptionHash",[86400,10]);
  //     await hatVaults.setCommittee(1,accounts[0],{from:accounts[1]});
  //     await hatVaults.deposit(0,web3.utils.toWei("1"),{from:staker});
  //     await hatVaults.committeeCheckIn(1,{from:accounts[0]});
  //     await hatVaults.deposit(1,web3.utils.toWei("1"),{from:staker});
  //     await hatVaults.setPool(0,200,true,false,"123");
  //     var tx = await hatVaults.massUpdatePools(0,2);
  //         await hatToken.getPastEvents('Transfer', {
  //               fromBlock: tx.blockNumber,
  //               toBlock: 'latest'
  //           })
  //           .then(function(events){
  //               assert.equal(events[0].event,"Transfer");
  //               assert.equal(events[0].args.from,utils.NULL_ADDRESS);
  //               assert.equal(events[0].args.to,hatVaults.address);
  //               assert.equal(events.length,2);
  //           });
  //     assert.equal(Math.round(web3.utils.fromWei(await hatToken.balanceOf(hatVaults.address))),2);
  //     assert.equal(await stakingToken.balanceOf(staker),0);
  //
  //     await safeWithdraw(0,web3.utils.toWei("1"),staker);
  //     assert.equal(await stakingToken.balanceOf(staker),web3.utils.toWei("1"));
  //
  //     await safeWithdraw(1,web3.utils.toWei("1"),staker);
  //     assert.equal(await stakingToken.balanceOf(staker),web3.utils.toWei("2"));
  //   });
  //
  //   it("addPool with the same token on the same block", async () => {
  //     await setup(accounts, REAL_REWARD_PER_BLOCK, (await web3.eth.getBlock("latest")).number, [], [0,0, 0, 0,0, 0],10000);
  //     var poolManagerMock = await PoolsManagerMock.new();
  //
  //     await stakingToken.mint(poolManagerMock.address,web3.utils.toWei("2"));
  //     await hatVaults.addPool(200,stakingToken.address,accounts[1],[],[0,0,0,0,0,0],"_descriptionHash",[86400,10]);
  //     await hatVaults.committeeCheckIn(1,{from:accounts[1]});
  //     await poolManagerMock.depositDifferentPids(hatVaults.address,stakingToken.address,[0,1],web3.utils.toWei("1"));
  //     var i;
  //     for (i=0;i<100;i++) {
  //         await utils.mineBlock();
  //     }
  //     assert.equal(await hatToken.balanceOf(poolManagerMock.address),0);
  //     var tx = await poolManagerMock.claimDifferentPids(hatVaults.address,[0,1]);
  //     var localEvents;
  //     await hatVaults.getPastEvents('SafeTransferReward', {
  //           fromBlock: tx.blockNumber,
  //           toBlock: 'latest'
  //       })
  //       .then(function(events){
  //            localEvents = events;
  //   });
  //   assert.equal(localEvents[0].returnValues.amount*2,localEvents[1].returnValues.amount);
  //   assert.equal(await hatToken.balanceOf(poolManagerMock.address),localEvents[0].returnValues.amount*3);
  // });

  it("add/set pool on the same block", async () => {
    let hatToken1 = await HATTokenMock.new(accounts[0], utils.TIME_LOCK_DELAY);
    let router1 = await UniSwapV3RouterMock.new(0, utils.NULL_ADDRESS);
    var tokenLock1 = await HATTokenLock.new();
    let tokenLockFactory1 = await TokenLockFactory.new(tokenLock1.address);
    var poolManager = await PoolsManagerMock.new();
    let deployment = await deployHatVaults(
      hatToken1.address,
      1,
      rewardPerEpoch,
      10,
      poolManager.address,
      hatToken1.address,
      [router1.address],
      tokenLockFactory1.address,
      true
    );

    hatVaults1 = await HATVaults.at(deployment.hatVaults.address);
    rewardController1 = await RewardController.at(
      deployment.rewardController.address
    );
    let stakingToken2 = await ERC20Mock.new("Staking", "STK");
    let stakingToken3 = await ERC20Mock.new("Staking", "STK");
    var globalPoolUpdatesLength = await rewardController1.getGlobalPoolUpdatesLength();
    assert.equal(globalPoolUpdatesLength, 0);
    await poolManager.addPools(
      hatVaults1.address,
      rewardController1.address,
      100,
      [stakingToken2.address, stakingToken3.address],
      accounts[1],
      8000,
      [6000, 2000, 500, 0, 1000, 500],
      "_descriptionHash",
      [86400, 10]
    );
    globalPoolUpdatesLength = await rewardController1.getGlobalPoolUpdatesLength();
    assert.equal(globalPoolUpdatesLength, 1); //2 got in the same block
    assert.equal(await hatVaults1.getNumberOfPools(), 2);
    await poolManager.setPools(
      hatVaults1.address,
      rewardController1.address,
      [0, 1],
      200,
      true,
      false,
      "_descriptionHash"
    );

    globalPoolUpdatesLength = await rewardController1.getGlobalPoolUpdatesLength();
    assert.equal(globalPoolUpdatesLength, 2); //2 got in the same block
    let globalUpdatesLen = await rewardController1.getGlobalPoolUpdatesLength();
    let totalAllocPoint = (
      await rewardController1.globalPoolUpdates(globalUpdatesLen - 1)
    ).totalAllocPoint;
    assert.equal(totalAllocPoint.toString(), 400); //2 got in the same block
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

    await stakingToken.approve(hatVaults.address, web3.utils.toWei("2"), {
      from: staker,
    });
    await stakingToken.mint(staker, web3.utils.toWei("2"));
    await hatVaults.deposit(0, web3.utils.toWei("1"), { from: staker });
    await utils.mineBlock(1);
    await hatVaults.massUpdatePools(0, 1);
    assert.equal(
      (await hatToken.balanceOf(staker)).toString(),
      web3.utils.toWei("0").toString()
    );
    let hatTotalSupply = await hatToken.totalSupply();
    let hatTokenCap = await hatToken.CAP();
    let amountToMint = hatTokenCap.sub(hatTotalSupply);
    await utils.setMinter(hatToken, accounts[0], amountToMint);
    await hatToken.mint(accounts[0], amountToMint);
    await hatToken.approve(hatVaults.address, amountToMint);
    tx = await hatVaults.depositReward(amountToMint);
    assert.equal(tx.logs[0].event, "DepositReward");
    assert.equal(tx.logs[0].args._amount.toString(), amountToMint.toString());

    tx = await safeWithdraw(0, web3.utils.toWei("1"), staker);
    assert.equal(await stakingToken.balanceOf(staker), web3.utils.toWei("2"));
    let userHatRewards = tx.logs[0].args.amount;
    assert.equal(
      userHatRewards.toString(),
      (await hatToken.balanceOf(staker)).toString()
    );

    await hatVaults.deposit(0, web3.utils.toWei("1"), { from: staker });
    await utils.mineBlock(1);
    tx = await safeWithdraw(0, web3.utils.toWei("1"), staker);
    userHatRewards = userHatRewards.add(tx.logs[0].args.amount);
    assert.equal(
      userHatRewards.toString(),
      (await hatToken.balanceOf(staker)).toString()
    );
  });

  it("check deep alloc history", async () => {
    //await setup(accounts);
    await setup(
      accounts,
      (await web3.eth.getBlock("latest")).number,
      8000,
      [6000, 2000, 500, 0, 1000, 500],
      10000
    );

    var staker = accounts[1];
    await stakingToken.approve(hatVaults.address, web3.utils.toWei("2"), {
      from: staker,
    });
    await stakingToken.mint(staker, web3.utils.toWei("2"));
    let stakingToken2 = await ERC20Mock.new("Staking", "STK");
    await stakingToken2.approve(hatVaults.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await stakingToken2.mint(staker, web3.utils.toWei("1"));
    var tx = await hatVaults.deposit(0, web3.utils.toWei("1"), {
      from: staker,
    });
    //10
    await hatVaults.addPool(
      stakingToken2.address,
      accounts[1],
      8000,
      [6000, 2000, 500, 0, 1000, 500],
      "_descriptionHash",
      [86400, 10],
      false,
      true
    );

    await rewardController.setAllocPoint(
      (await hatVaults.getNumberOfPools()) - 1,
      100
    );
    //5
    await hatVaults.setCommittee(1, accounts[0], { from: accounts[1] });
    //5
    await hatVaults.setPool(1, true, false, "123");
    await rewardController.setAllocPoint(1, 300);
    //2.5
    assert.equal((await hatToken.balanceOf(staker)).toString(), 0);
    assert.equal(await rewardController.getGlobalPoolUpdatesLength(), 3);
    assert.equal(
      (await hatVaults.poolInfos(0)).lastRewardBlock,
      tx.receipt.blockNumber
    );
    await hatVaults.claimReward(0, { from: staker });
    assert.equal(
      (await hatToken.balanceOf(staker)).toString(),
      await web3.utils.toWei("1654.875").toString()
    );
  });

  it("deposit twice on the same block", async () => {
    await setup(accounts);
    var poolManagerMock = await PoolsManagerMock.new();
    await stakingToken.mint(poolManagerMock.address, web3.utils.toWei("2"));
    await poolManagerMock.depositTwice(
      hatVaults.address,
      stakingToken.address,
      0,
      web3.utils.toWei("1")
    );
    assert.equal(
      (await hatToken.balanceOf(poolManagerMock.address)).toString(),
      0
    );
  });
  it("set pending bounty level delay", async () => {
    await setup(accounts);
    try {
      await hatVaults.setMaxBountyDelay(24 * 3600 * 2, {
        from: accounts[1],
      });
      assert(false, "only gov");
    } catch (ex) {
      assertVMException(ex, "Ownable: caller is not the owner");
    }

    try {
      await hatVaults.setMaxBountyDelay(100, { from: accounts[0] });
      assert(false, "too small");
    } catch (ex) {
      assertVMException(ex, "DelayTooShort");
    }
    assert.equal(
      (await hatVaults.generalParameters()).setMaxBountyDelay,
      24 * 3600 * 2
    );
    var tx = await hatVaults.setMaxBountyDelay(24 * 3600 * 100, {
      from: accounts[0],
    });
    assert.equal(tx.logs[0].event, "SetMaxBountyDelay");
    assert.equal(tx.logs[0].args._delay, 24 * 3600 * 100);
    assert.equal(
      (await hatVaults.generalParameters()).setMaxBountyDelay,
      24 * 3600 * 100
    );
  });

  it("withdraw+ deposit + addition ", async () => {
    await setup(accounts);
    var staker = accounts[1];
    var staker2 = accounts[5];
    var rewarder = accounts[6];

    await stakingToken.approve(hatVaults.address, web3.utils.toWei("3000000"), {
      from: rewarder,
    });
    await stakingToken.approve(hatVaults.address, web3.utils.toWei("4"), {
      from: staker,
    });
    await stakingToken.approve(hatVaults.address, web3.utils.toWei("2"), {
      from: staker2,
    });

    await stakingToken.mint(rewarder, web3.utils.toWei("3000000"));
    await stakingToken.mint(staker, web3.utils.toWei("1"));
    await stakingToken.mint(staker2, web3.utils.toWei("2"));

    assert.equal(await stakingToken.balanceOf(staker), web3.utils.toWei("1"));
    assert.equal(
      await hatToken.balanceOf(hatVaults.address),
      web3.utils.toWei(hatVaultsExpectedHatsBalance.toString())
    );
    try {
      await hatVaults.rewardDepositors(0, web3.utils.toWei("3"), {
        from: rewarder,
      });
      assert(false, "no depositors  yet");
    } catch (ex) {
      assertVMException(ex, "AmountToRewardTooBig");
    }
    await hatVaults.deposit(0, web3.utils.toWei("1"), { from: staker });
    await hatVaults.deposit(0, web3.utils.toWei("2"), { from: staker2 });
    await utils.increaseTime(7 * 24 * 3600);
    await advanceToNoneSaftyPeriod();

    await hatVaults.withdrawRequest(0, { from: staker });
    assert.equal(
      await hatVaults.withdrawEnableStartTime(0, staker),
      (await web3.eth.getBlock("latest")).timestamp + 7 * 24 * 3600
    );
    await hatVaults.withdrawRequest(0, { from: staker2 });

    await utils.increaseTime(7 * 24 * 3600);

    try {
      await hatVaults.rewardDepositors(0, web3.utils.toWei("3000000"), {
        from: rewarder,
      });
      assert(false, "amount to reward is too big");
    } catch (ex) {
      assertVMException(ex, "AmountToRewardTooBig");
    }

    var tx = await hatVaults.rewardDepositors(0, web3.utils.toWei("3"), {
      from: rewarder,
    });
    assert.equal(tx.logs[0].event, "RewardDepositors");
    assert.equal(tx.logs[0].args._pid, 0);
    assert.equal(tx.logs[0].args._amount, web3.utils.toWei("3"));
    assert.equal((await hatVaults.poolInfos(0)).balance, web3.utils.toWei("6"));
    await stakingToken.mint(hatVaults.address, web3.utils.toWei("100"));
    assert.equal((await stakingToken.balanceOf(staker)).toString(), 0);
    await hatVaults.withdraw(0, web3.utils.toWei("1"), { from: staker });
    await hatVaults.withdraw(0, web3.utils.toWei("2"), { from: staker2 });
    assert.equal(
      (await stakingToken.balanceOf(staker)).toString(),
      web3.utils.toWei("2")
    );
    assert.equal(
      (await stakingToken.balanceOf(staker2)).toString(),
      web3.utils.toWei("4")
    );
  });

  it("withdraw+ deposit + addition HAT ", async () => {
    await setup(accounts, (await web3.eth.getBlock("latest")).number);
    var staker = accounts[1];
    var staker2 = accounts[5];
    await hatVaults.addPool(
      hatToken.address,
      accounts[1],
      8000,
      [6000, 2000, 500, 0, 1000, 500],
      "_descriptionHash",
      [86400, 10],
      false,
      true
    );
    await rewardController.setAllocPoint(
      (await hatVaults.getNumberOfPools()) - 1,
      100
    );
    await utils.setMinter(hatToken, accounts[0], web3.utils.toWei("110"));
    await hatVaults.committeeCheckIn(1, { from: accounts[1] });

    await hatToken.approve(hatVaults.address, web3.utils.toWei("4"), {
      from: staker,
    });
    await hatToken.approve(hatVaults.address, web3.utils.toWei("2"), {
      from: staker2,
    });

    await hatToken.mint(staker, web3.utils.toWei("4"));
    await hatToken.mint(staker2, web3.utils.toWei("2"));

    assert.equal(await hatToken.balanceOf(staker), web3.utils.toWei("4"));
    assert.equal(
      await hatToken.balanceOf(hatVaults.address),
      web3.utils.toWei(hatVaultsExpectedHatsBalance.toString())
    );
    await hatVaults.deposit(1, web3.utils.toWei("1"), { from: staker });
    await hatVaults.deposit(1, web3.utils.toWei("2"), { from: staker2 });
    await utils.increaseTime(7 * 24 * 3600);
    await advanceToNoneSaftyPeriod();

    await hatVaults.withdrawRequest(1, { from: staker });
    assert.equal(
      await hatVaults.withdrawEnableStartTime(1, staker),
      (await web3.eth.getBlock("latest")).timestamp + 7 * 24 * 3600
    );
    await hatVaults.withdrawRequest(1, { from: staker2 });

    await utils.increaseTime(7 * 24 * 3600);
    await hatVaults.rewardDepositors(1, web3.utils.toWei("3"), {
      from: staker,
    });
    await hatToken.mint(hatVaults.address, web3.utils.toWei("100"));
    assert.equal((await hatToken.balanceOf(staker)).toString(), 0);
    await advanceToNoneSaftyPeriod();
    var tx = await hatVaults.withdraw(1, web3.utils.toWei("1"), {
      from: staker,
    });
    assert.equal(
      (await hatToken.balanceOf(staker)).sub(tx.logs[0].args.amount).toString(),
      web3.utils.toWei("2")
    );
    tx = await hatVaults.withdraw(1, web3.utils.toWei("2"), { from: staker2 });
    assert.equal(
      (await hatToken.balanceOf(staker2))
        .sub(tx.logs[0].args.amount)
        .toString(),
      web3.utils.toWei("4")
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
    await stakingToken.approve(hatVaults.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await stakingToken.mint(staker, web3.utils.toWei("1"));
    await hatVaults.deposit(0, web3.utils.toWei("1"), { from: staker });
    await hatVaults.massUpdatePools(0, 1);
    let hatsAvailable = await hatToken.balanceOf(hatVaults.address);
    let expectedReward = await hatVaults.getPendingReward(0, staker);
    assert.isTrue(
      parseInt(hatsAvailable.toString()) < parseInt(expectedReward.toString())
    );
    try {
      await safeWithdraw(0, web3.utils.toWei("1"), staker);
      assert(false, "can't withdraw when there are not enough rewards");
    } catch (ex) {
      assertVMException(ex, "NotEnoughRewardsToTransferToUser");
    }
  });
});

module.exports = {
  assertVMException,
  setup,
  rewardPerEpoch,
  advanceToSafetyPeriod: advanceToSafetyPeriod_,
};
