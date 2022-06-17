const HATVaults = artifacts.require("./HATVaults.sol");
const HATTimelockController = artifacts.require("./HATTimelockController.sol");
const HATTokenMock = artifacts.require("./HATTokenMock.sol");
const ERC20Mock = artifacts.require("./ERC20Mock.sol");
const UniSwapV3RouterMock = artifacts.require("./UniSwapV3RouterMock.sol");
const TokenLockFactory = artifacts.require("./TokenLockFactory.sol");
const HATTokenLock = artifacts.require("./HATTokenLock.sol");
const RewardController = artifacts.require("./RewardController.sol");
const utils = require("./utils.js");

const { deployHatVaults } = require("../scripts/hatvaultsdeploy.js");

var hatVaults;
var rewardController;
var hatTimelockController;
var hatToken;
var router;
var stakingToken;
var tokenLockFactory;
var hatGovernanceDelay = 60 * 60 * 24 * 7;
const {
  assertVMException,
  rewardPerEpoch,
  advanceToSafetyPeriod,
} = require("./hatvaults.js");
const {
  submitClaim,
  assertFunctionRaisesException,
} = require("./common.js");

const setup = async function(
  accounts,
  challengePeriod=0,
  startBlock = 0,
  maxBounty = 8000,
  bountySplit = [6000, 2000, 500, 0, 1000, 500],
  halvingAfterBlock = 10,
  routerReturnType = 0,
  allocPoint = 100,
  weth = true,
  rewardInVaults = 2500000
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
  await hatVaults.setChallengePeriod(challengePeriod);
  rewardController = await RewardController.at(
    deployment.rewardController.address
  );
  hatTimelockController = await HATTimelockController.new(
    hatVaults.address,
    hatGovernanceDelay,
    [accounts[0]],
    [accounts[0]]
  );
  await hatVaults.setArbitrator(hatTimelockController.address);
  tx = await hatVaults.transferOwnership(hatTimelockController.address);
  tx = await rewardController.transferOwnership(hatTimelockController.address);
  await utils.setMinter(
    hatToken,
    hatVaults.address,
    web3.utils.toWei("2500000")
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
  await hatVaults.depositReward(web3.utils.toWei(rewardInVaults.toString()));
  await hatTimelockController.addPool(
    stakingToken.address,
    accounts[1],
    maxBounty,
    bountySplit,
    "_descriptionHash",
    [86400, 10],
    false,
    true
  );
  hatTimelockController.setAllocPoint(
    (await hatVaults.getNumberOfPools()) - 1,
    allocPoint
  );
  await hatVaults.committeeCheckIn(0, { from: accounts[1] });
};

contract("HatTimelockController", (accounts) => {
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

  it("constructor and initialize", async () => {
    try {
      hatTimelockController = await HATTimelockController.new(
        "0x0000000000000000000000000000000000000000",
        hatGovernanceDelay,
        [accounts[0]],
        [accounts[0]]
      );
      assert(false, "hats vaults cannot be the 0 address");
    } catch (ex) {
      assertVMException(ex);
    }
    await setup(accounts);
    assert.equal(await stakingToken.name(), "Staking");
    assert.equal(await hatVaults.owner(), hatTimelockController.address);
    assert.equal(await hatTimelockController.hatVaults(), hatVaults.address);
    assert.equal(
      await hatTimelockController.hasRole(
        await hatTimelockController.PROPOSER_ROLE(),
        accounts[0]
      ),
      true
    );
    assert.equal(
      await hatTimelockController.hasRole(
        await hatTimelockController.EXECUTOR_ROLE(),
        accounts[0]
      ),
      true
    );
  });

  it("addPool", async () => {
    await setup(accounts);
    try {
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
      assert(false, "only governance");
    } catch (ex) {
      assertVMException(ex);
    }

    try {
      await hatTimelockController.addPool(
        hatToken.address,
        accounts[1],
        8000,
        [6000, 2000, 500, 0, 1000, 500],
        "_descriptionHash",
        [86400, 10],
        false,
        true,
        { from: accounts[1] }
      );
      assert(false, "only governance");
    } catch (ex) {
      assertVMException(ex);
    }

    try {
      await rewardController.setAllocPoint(
        (await hatVaults.getNumberOfPools()) - 1,
        100
      );
      assert(false, "only governance");
    } catch (ex) {
      assertVMException(ex);
    }

    try {
      await hatTimelockController.setAllocPoint(
        (await hatVaults.getNumberOfPools()) - 1,
        100,
        { from: accounts[1] }
      );
      assert(false, "only governance");
    } catch (ex) {
      assertVMException(ex);
    }

    await hatTimelockController.addPool(
      hatToken.address,
      accounts[1],
      8000,
      [6000, 2000, 500, 0, 1000, 500],
      "_descriptionHash",
      [86400, 10],
      false,
      true
    );

    await hatTimelockController.setAllocPoint(
      (await hatVaults.getNumberOfPools()) - 1,
      100
    );
  });

  it("setPool", async () => {
    await setup(accounts);
    try {
      await hatTimelockController.setPool(1, true, false, "_descriptionHash");
      assert(false, "no pool exist");
    } catch (ex) {
      assertVMException(ex);
    }

    try {
      await hatTimelockController.setPool(0, true, false, "_descriptionHash", {
        from: accounts[1],
      });
      assert(false, "only governance");
    } catch (ex) {
      assertVMException(ex);
    }

    try {
      await hatVaults.setPool(0, true, false, "_descriptionHash");
      assert(false, "only governance");
    } catch (ex) {
      assertVMException(ex);
    }
    await hatTimelockController.setPool(0, true, false, "_descriptionHash");
    await hatTimelockController.setAllocPoint(0, 200);

    var staker = accounts[4];
    await stakingToken.approve(hatVaults.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await stakingToken.mint(staker, web3.utils.toWei("1"));
    await hatVaults.deposit(0, web3.utils.toWei("1"), { from: staker });
    assert.equal(await hatToken.balanceOf(staker), 0);
    await hatTimelockController.setPool(0, true, false, "_descriptionHash");
    await hatTimelockController.setPool(0, true, false, "_descriptionHash");
    await hatTimelockController.setAllocPoint(0, 200);
    let expectedReward = await calculateExpectedReward(staker);
    assert.equal(await stakingToken.balanceOf(staker), 0);
    await hatVaults.claimReward(0, { from: staker });
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
    await advanceToSafetyPeriod(hatVaults);
    const bountyPercentage = 300;
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
    try {
      await hatTimelockController.approveClaim(claimId, bountyPercentage, {
        from: accounts[3],
      });
      assert(false, "only gov");
    } catch (ex) {
      assertVMException(ex);
    }

    // try {
    //   await hatVaults.approveClaim(claimId, bountyPercentage);
    //   assert(false, "only gov");
    // } catch (ex) {
    //   assertVMException(ex);
    // }

    await hatTimelockController.approveClaim(claimId, bountyPercentage);

    let path = ethers.utils.solidityPack(
      ["address", "uint24", "address"],
      [stakingToken.address, 0, hatToken.address]
    );
    let amountToSwapAndBurn = await hatVaults.swapAndBurns(0);
    let amountForHackersHatRewards = await hatVaults.hackersHatRewards(
      accounts[1],
      0
    );
    let amount = amountToSwapAndBurn
      .add(amountForHackersHatRewards)
      .add(await hatVaults.governanceHatRewards(0));
    let ISwapRouter = new ethers.utils.Interface(UniSwapV3RouterMock.abi);
    let payload = ISwapRouter.encodeFunctionData("exactInput", [
      [path, hatVaults.address, 0, amount.toString(), 0],
    ]);

    try {
      await hatTimelockController.swapBurnSend(
        0,
        accounts[1],
        0,
        router.address,
        payload,
        {
          from: accounts[3],
        }
      );
      assert(false, "only gov");
    } catch (ex) {
      assertVMException(ex);
    }

    try {
      await hatVaults.swapBurnSend(0, accounts[1], 0, router.address, payload);
      assert(false, "only gov");
    } catch (ex) {
      assertVMException(ex);
    }

    tx = await hatTimelockController.swapBurnSend(
      0,
      accounts[1],
      0,
      router.address,
      payload,
      { from: accounts[0] }
    );
    let log = (
      await hatVaults.getPastEvents("SwapAndBurn", {
        fromBlock: tx.blockNumber,
        toBlock: "latest",
      })
    )[0];
    assert.equal(log.event, "SwapAndBurn");
    assert.equal(
      log.args._amountSwapped.toString(),
      new web3.utils.BN(web3.utils.toWei(bountyPercentage.toString()))
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
        .div(new web3.utils.BN("10000"))
        .toString()
    );
    assert.equal(
      log.args._amountBurned.toString(),
      new web3.utils.BN(web3.utils.toWei(bountyPercentage.toString()))
        .mul(
          new web3.utils.BN(
            (await hatVaults.bountyInfos(0)).bountySplit.swapAndBurn
          )
        )
        .div(new web3.utils.BN("10000"))
        .div(new web3.utils.BN("10000"))
        .toString()
    );
    log = (
      await hatVaults.getPastEvents("SwapAndSend", {
        fromBlock: tx.blockNumber,
        toBlock: "latest",
      })
    )[0];
    assert.equal(log.event, "SwapAndSend");
    assert.equal(log.args._amountReceived.toString(), "0");
  });

  it("challenge - approve Claim ", async () => {
    await setup(accounts, 1000);
    const staker = accounts[1];
    // set challenge period to 1000
    // hatVaults.setChallengePeriod(1000);
    await advanceToSafetyPeriod(hatVaults);

    // we send some funds to the vault so we can pay out later when approveClaim is called
    await stakingToken.mint(staker, web3.utils.toWei("2"));
    await stakingToken.approve(hatVaults.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await hatVaults.deposit(0, web3.utils.toWei("1"), { from: staker });
    await hatVaults.updatePool(0);

    const claimId = await submitClaim(hatVaults, { accounts });

    assertFunctionRaisesException(
      hatVaults.challengeClaim(claimId),
      "OnlyArbitrator"
    );
    await hatTimelockController.challengeClaim(claimId);

    await hatTimelockController.approveClaim(claimId, 8000);
  });

  it("challenge - dismiss claim", async () => {
    await setup(accounts, 1000);
    // set challenge period to 1000
    await advanceToSafetyPeriod(hatVaults);
    const claimId = await submitClaim(hatVaults, { accounts });
    await hatTimelockController.challengeClaim(claimId);
    // now that the claim is challenged, only arbitrator can accept or dismiss
    await assertFunctionRaisesException(
      hatVaults.dismissClaim(claimId),
      "OnlyCallableByArbitratorOrAfterChallengeTimeOutPeriod"
    );
    await hatTimelockController.dismissClaim(claimId);
  });
});
