const HATVaults = artifacts.require("./HATVaults.sol");
const HATTimelockController = artifacts.require("./HATTimelockController.sol");
const HATTokenMock = artifacts.require("./HATTokenMock.sol");
const ERC20Mock = artifacts.require("./ERC20Mock.sol");
const UniSwapV3RouterMock = artifacts.require("./UniSwapV3RouterMock.sol");
const TokenLockFactory = artifacts.require("./TokenLockFactory.sol");
const HATTokenLock = artifacts.require("./HATTokenLock.sol");
const utils = require("./utils.js");

var hatVaults;
var hatTimelockController;
var hatToken;
var router;
var stakingToken;
var REWARD_PER_BLOCK = "10";
var tokenLockFactory;
var hatGovernanceDelay = 60 * 60 * 24 * 7;

const setup = async function(
  accounts,
  reward_per_block = REWARD_PER_BLOCK,
  startBlock = 0,
  bountyLevels = [],
  bountySplit = [0, 0, 0, 0, 0, 0],
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
  hatVaults = await HATVaults.new(
    hatToken.address,
    web3.utils.toWei(reward_per_block),
    startBlock,
    halvingAfterBlock,
    accounts[0],
    [router.address],
    tokenLockFactory.address
  );
  hatTimelockController = await HATTimelockController.new(
    hatVaults.address,
    hatGovernanceDelay,
    [accounts[0]],
    [accounts[0]]
  );
  tx = await hatVaults.transferGovernance(hatTimelockController.address);
  await utils.setMinter(
    hatToken,
    hatVaults.address,
    web3.utils.toWei("2500000")
  );
  await utils.setMinter(hatToken, accounts[0], web3.utils.toWei((2500000 + rewardInVaults).toString()));
  await hatToken.mint(router.address, web3.utils.toWei("2500000"));
  await hatToken.mint(accounts[0], web3.utils.toWei(rewardInVaults.toString()));
  await hatToken.approve(hatVaults.address, web3.utils.toWei(rewardInVaults.toString()));
  await hatVaults.depositHATReward(web3.utils.toWei(rewardInVaults.toString()));
  await hatTimelockController.addPool(
    allocPoint,
    stakingToken.address,
    accounts[1],
    bountyLevels,
    bountySplit,
    "_descriptionHash",
    [86400, 10]
  );
  await hatVaults.committeeCheckIn(0, { from: accounts[1] });
};

function assertVMException(error) {
  let condition =
    error.message.search("VM Exception") > -1 ||
    error.message.search("Transaction reverted") > -1;
  assert.isTrue(
    condition,
    "Expected a VM Exception, got this instead:" + error.message
  );
}

contract("HatVaults", (accounts) => {
  async function advanceToSaftyPeriod() {
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

  async function calculateExpectedReward(staker, operationBlocksIncrement = 0) {
    let currentBlockNumber = (await web3.eth.getBlock("latest")).number;
    let lastRewardBlock = (await hatVaults.poolInfos(0)).lastRewardBlock;
    let allocPoint = (await hatVaults.poolInfos(0)).allocPoint;
    let rewardPerShare = new web3.utils.BN(
      (await hatVaults.poolInfos(0)).rewardPerShare
    );
    let onee12 = new web3.utils.BN("1000000000000");
    let stakerAmount = (await hatVaults.userInfo(0, staker)).shares;
    let globalUpdatesLen = await hatVaults.getGlobalPoolUpdatesLength();
    let totalAllocPoint = (
      await hatVaults.globalPoolUpdates(globalUpdatesLen - 1)
    ).totalAllocPoint;
    let poolReward = await hatVaults.getRewardForBlocksRange(
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
    assert.equal(await hatVaults.governance(), hatTimelockController.address);
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
        100,
        hatToken.address,
        accounts[1],
        [],
        [0, 0, 0, 0, 0, 0],
        "_descriptionHash",
        [86400, 10]
      );
      assert(false, "only governance");
    } catch (ex) {
      assertVMException(ex);
    }

    try {
      await hatTimelockController.addPool(
        100,
        hatToken.address,
        accounts[1],
        [],
        [0, 0, 0, 0, 0, 0],
        "_descriptionHash",
        [86400, 10],
        { from: accounts[1] }
      );
      assert(false, "only governance");
    } catch (ex) {
      assertVMException(ex);
    }
    await hatTimelockController.addPool(
      100,
      hatToken.address,
      accounts[1],
      [],
      [0, 0, 0, 0, 0, 0],
      "_descriptionHash",
      [86400, 10]
    );
  });

  it("setPool", async () => {
    await setup(accounts);
    try {
      await hatTimelockController.setPool(
        1,
        200,
        true,
        false,
        "_descriptionHash"
      );
      assert(false, "no pool exist");
    } catch (ex) {
      assertVMException(ex);
    }

    try {
      await hatTimelockController.setPool(
        0,
        200,
        true,
        false,
        "_descriptionHash",
        { from: accounts[1] }
      );
      assert(false, "only governance");
    } catch (ex) {
      assertVMException(ex);
    }

    try {
      await hatVaults.setPool(0, 200, true, false, "_descriptionHash");
      assert(false, "only governance");
    } catch (ex) {
      assertVMException(ex);
    }
    await hatTimelockController.setPool(
      0,
      200,
      true,
      false,
      "_descriptionHash"
    );
    var staker = accounts[4];
    await stakingToken.approve(hatVaults.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await stakingToken.mint(staker, web3.utils.toWei("1"));
    await hatVaults.deposit(0, web3.utils.toWei("1"), { from: staker });
    assert.equal(await hatToken.balanceOf(staker), 0);
    await hatTimelockController.setPool(
      0,
      100,
      true,
      false,
      "_descriptionHash"
    );
    await hatTimelockController.setPool(
      0,
      200,
      true,
      false,
      "_descriptionHash"
    );
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
    await advanceToSaftyPeriod();
    await hatVaults.submitClaim(0, accounts[2], 3, {
      from: accounts[1],
    });

    try {
      await hatTimelockController.approveClaim(0, { from: accounts[3] });
      assert(false, "only gov");
    } catch (ex) {
      assertVMException(ex);
    }

    try {
      await hatVaults.approveClaim(0);
      assert(false, "only gov");
    } catch (ex) {
      assertVMException(ex);
    }

    await hatTimelockController.approveClaim(0);

    let path = ethers.utils.solidityPack(["address", "uint24", "address"], [stakingToken.address, 0, hatToken.address]);
    let amountToSwapAndBurn = await hatVaults.swapAndBurns(0);
    let amountForHackersHatRewards = await hatVaults.hackersHatRewards(accounts[1], 0);
    let amount = amountToSwapAndBurn.add(amountForHackersHatRewards).add(await hatVaults.governanceHatRewards(0));
    let ISwapRouter = new ethers.utils.Interface(UniSwapV3RouterMock.abi);
    let payload = ISwapRouter.encodeFunctionData("exactInput", [[path, hatVaults.address, 0, amount.toString(), 0]]);

    try {
      await hatTimelockController.swapBurnSend(0, accounts[1], 0, router.address, payload, {
        from: accounts[3],
      });
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

    var tx = await hatTimelockController.swapBurnSend(
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
      new web3.utils.BN(web3.utils.toWei("0.8"))
        .mul(
          new web3.utils.BN(
            (await hatVaults.getBountyInfo(0)).bountySplit.swapAndBurn
          ).add(
            new web3.utils.BN(
              (
                await hatVaults.getBountyInfo(0)
              ).bountySplit.governanceHat
            )
          )
        )
        .div(new web3.utils.BN("10000"))
        .toString()
    );
    assert.equal(
      log.args._amountBurned.toString(),
      new web3.utils.BN(web3.utils.toWei("1"))
        .mul(
          new web3.utils.BN(
            (await hatVaults.getBountyInfo(0)).bountySplit.swapAndBurn
          )
        )
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
});
