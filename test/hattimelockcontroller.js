const HATVaultsRegistry = artifacts.require("./HATVaultsRegistry.sol");
const HATVault = artifacts.require("./HATVault.sol");
const HATTimelockController = artifacts.require("./HATTimelockController.sol");
const HATTokenMock = artifacts.require("./HATTokenMock.sol");
const ERC20Mock = artifacts.require("./ERC20Mock.sol");
const UniSwapV3RouterMock = artifacts.require("./UniSwapV3RouterMock.sol");
const TokenLockFactory = artifacts.require("./TokenLockFactory.sol");
const HATTokenLock = artifacts.require("./HATTokenLock.sol");
const RewardController = artifacts.require("./RewardController.sol");
const utils = require("./utils.js");

const { deployHatVaults } = require("../scripts/hatvaultsdeploy.js");

var hatVaultsRegistry;
var vault;
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
  challengePeriod=60 * 60 * 24,
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
  hatVaultsRegistry = await HATVaultsRegistry.at(deployment.hatVaultsRegistry.address);
  await hatVaultsRegistry.setChallengePeriod(challengePeriod);
  rewardController = await RewardController.at(
    deployment.rewardController.address
  );
  hatTimelockController = await HATTimelockController.new(
    hatGovernanceDelay,
    [accounts[0]],
    [accounts[0]]
  );
  await hatVaultsRegistry.setArbitrator(hatTimelockController.address);
  tx = await hatVaultsRegistry.transferOwnership(hatTimelockController.address);
  tx = await rewardController.transferOwnership(hatTimelockController.address);
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
  vault = await HATVault.at((await hatVaultsRegistry.createVault(
    stakingToken.address,
    accounts[1],
    rewardController.address,
    maxBounty,
    bountySplit,
    "_descriptionHash",
    [86400, 10],
    false
  )).receipt.rawLogs[0].address);
  await hatTimelockController.setAllocPoint(
    vault.address,
    allocPoint
  );

  await vault.committeeCheckIn({ from: accounts[1] });
};

contract("HatTimelockController", (accounts) => {
  async function calculateExpectedReward(staker, operationBlocksIncrement = 0) {
    let currentBlockNumber = (await web3.eth.getBlock("latest")).number;
    let lastRewardBlock = (await rewardController.vaultInfo(vault.address)).lastRewardBlock;
    let allocPoint = (await rewardController.vaultInfo(vault.address)).allocPoint;
    let rewardPerShare = new web3.utils.BN(
      (await rewardController.vaultInfo(vault.address)).rewardPerShare
    );
    let onee12 = new web3.utils.BN("1000000000000");
    let stakerAmount = await vault.balanceOf(staker);
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
    let lpSupply = await stakingToken.balanceOf(vault.address);
    rewardPerShare = rewardPerShare.add(vaultReward.mul(onee12).div(lpSupply));
    let rewardDebt = await rewardController.rewardDebt(vault.address, staker);
    return stakerAmount
      .mul(rewardPerShare)
      .div(onee12)
      .sub(rewardDebt);
  }

  it("constructor and initialize", async () => {
    await setup(accounts);
    assert.equal(await stakingToken.name(), "Staking");
    assert.equal(await hatVaultsRegistry.owner(), hatTimelockController.address);
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

  it("Update vault visibility", async () => {
    await setup(accounts);
    try {
      await hatTimelockController.updateVaultVisibility(vault.address, true, {
        from: accounts[1],
      });
      assert(false, "only governance");
    } catch (ex) {
      assertVMException(ex);
    }

    try {
      await hatVaultsRegistry.updateVaultVisibility(vault.address, true);
      assert(false, "only governance");
    } catch (ex) {
      assertVMException(ex);
    }
    await hatTimelockController.updateVaultVisibility(vault.address, true);
    await hatTimelockController.setAllocPoint(vault.address, 200);

    var staker = accounts[4];
    await stakingToken.approve(vault.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await stakingToken.mint(staker, web3.utils.toWei("1"));
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });
    assert.equal(await hatToken.balanceOf(staker), 0);
    await hatTimelockController.updateVaultVisibility(vault.address, true);
    await hatTimelockController.updateVaultVisibility(vault.address, true);
    await hatTimelockController.setAllocPoint(vault.address, 200);
    let expectedReward = await calculateExpectedReward(staker);
    assert.equal(await stakingToken.balanceOf(staker), 0);
    await rewardController.claimReward(vault.address, staker, { from: staker });
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

  it("Update vault description", async () => {
    await setup(accounts);
    try {
      await hatTimelockController.updateVaultDescription(vault.address, "descHash", {
        from: accounts[1],
      });
      assert(false, "only governance");
    } catch (ex) {
      assertVMException(ex);
    }

    try {
      await hatVaultsRegistry.updateVaultDescription(vault.address, "descHash");
      assert(false, "only governance");
    } catch (ex) {
      assertVMException(ex);
    }
    await hatTimelockController.updateVaultDescription(vault.address, "descHash");
  });

  it("Pause vault deposits", async () => {
    await setup(accounts);
    try {
      await hatTimelockController.setDepositPause(vault.address, true, {
        from: accounts[1],
      });
      assert(false, "only governance");
    } catch (ex) {
      assertVMException(ex);
    }

    try {
      await vault.setDepositPause(true);
      assert(false, "only governance");
    } catch (ex) {
      assertVMException(ex);
    }
    await hatTimelockController.setDepositPause(vault.address, true);
    await hatTimelockController.setAllocPoint(vault.address, 200);

    var staker = accounts[4];
    await stakingToken.approve(vault.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await stakingToken.mint(staker, web3.utils.toWei("1"));

    try {
      await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });
      assert(false, "cannot deposit when vault deposits are paused");
    } catch (ex) {
      assertVMException(ex);
    }

    await hatTimelockController.setDepositPause(vault.address, false);
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });
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
    await advanceToSafetyPeriod(hatVaultsRegistry);
    const bountyPercentage = 300;
    let tx = await vault.submitClaim(
      accounts[2],
      bountyPercentage,
      "description hash",
      {
        from: accounts[1],
      }
    );

    let claimId = tx.logs[0].args._claimId;

    try {
      await hatTimelockController.approveClaim(vault.address, claimId, bountyPercentage, {
        from: accounts[3],
      });
      assert(false, "only gov");
    } catch (ex) {
      assertVMException(ex);
    }

    await utils.increaseTime(60 * 60 * 24);

    await hatTimelockController.approveClaim(vault.address, claimId, bountyPercentage);

    let path = ethers.utils.solidityPack(
      ["address", "uint24", "address"],
      [stakingToken.address, 0, hatToken.address]
    );
    let amountToSwapAndBurn = await hatVaultsRegistry.swapAndBurn(stakingToken.address);
    let amountForHackersHatRewards = await hatVaultsRegistry.hackersHatReward(
      stakingToken.address,
      accounts[1]
    );
    let amount = amountToSwapAndBurn
      .add(amountForHackersHatRewards)
      .add(await hatVaultsRegistry.governanceHatReward(stakingToken.address));
    let ISwapRouter = new ethers.utils.Interface(UniSwapV3RouterMock.abi);
    let payload = ISwapRouter.encodeFunctionData("exactInput", [
      [path, hatVaultsRegistry.address, 0, amount.toString(), 0],
    ]);

    try {
      await hatTimelockController.swapBurnSend(
        hatVaultsRegistry.address,
        stakingToken.address,
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
      await hatVaultsRegistry.swapBurnSend(stakingToken.address, accounts[1], 0, router.address, payload);
      assert(false, "only gov");
    } catch (ex) {
      assertVMException(ex);
    }

    tx = await hatTimelockController.swapBurnSend(
      hatVaultsRegistry.address,
      stakingToken.address,
      accounts[1],
      0,
      router.address,
      payload,
      { from: accounts[0] }
    );
    let log = (
      await hatVaultsRegistry.getPastEvents("SwapAndBurn", {
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
            (await vault.bountySplit()).swapAndBurn
          ).add(
            new web3.utils.BN(
              (await vault.bountySplit()).governanceHat
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
            (await vault.bountySplit()).swapAndBurn
          )
        )
        .div(new web3.utils.BN("10000"))
        .div(new web3.utils.BN("10000"))
        .toString()
    );
    log = (
      await hatVaultsRegistry.getPastEvents("SwapAndSend", {
        fromBlock: tx.blockNumber,
        toBlock: "latest",
      })
    )[0];
    assert.equal(log.event, "SwapAndSend");
    assert.equal(log.args._amountReceived.toString(), "0");
  });

  it("challenge - approve Claim ", async () => {
    await setup(accounts);
    const staker = accounts[1];
    await advanceToSafetyPeriod(hatVaultsRegistry);

    // we send some funds to the vault so we can pay out later when approveClaim is called
    await stakingToken.mint(staker, web3.utils.toWei("2"));
    await stakingToken.approve(vault.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });
    await rewardController.updateVault(vault.address);

    let claimId = await submitClaim(vault, { accounts });

    assertFunctionRaisesException(
      vault.challengeClaim(claimId),
      "OnlyArbitrator"
    );
    await hatTimelockController.challengeClaim(vault.address, claimId);

    await hatTimelockController.approveClaim(vault.address, claimId, 8000);
  });

  it("challenge - dismiss claim", async () => {
    await setup(accounts);
    // set challenge period to 1000
    await advanceToSafetyPeriod(hatVaultsRegistry);
    let claimId = await submitClaim(vault, { accounts });
    await hatTimelockController.challengeClaim(vault.address, claimId);
    // now that the claim is challenged, only arbitrator can accept or dismiss
    await assertFunctionRaisesException(
      vault.dismissClaim(claimId),
      "OnlyCallableByArbitratorOrAfterChallengeTimeOutPeriod"
    );
    await hatTimelockController.dismissClaim(vault.address, claimId);
  });

  it("setCommittee", async () => {
    await setup(accounts);

    //creat another vault with a different committee
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
    )).receipt.rawLogs[0].address);

    await hatTimelockController.setAllocPoint(
      newVault.address,
      100
    );

    assert.equal(await newVault.committee(), accounts[3]);

    try {
      await newVault.setCommittee(accounts[2]);
      assert(false, "only governance");
    } catch (ex) {
      assertVMException(ex);
    }

    await hatTimelockController.setCommittee(newVault.address, accounts[1]);

    assert.equal(await newVault.committee(), accounts[1]);

    let tx = await newVault.committeeCheckIn({ from: accounts[1] });
    assert.equal(tx.logs[0].event, "CommitteeCheckedIn");

    try {
      await hatTimelockController.setCommittee(newVault.address, accounts[2]);
      assert(false, "committee already checked in");
    } catch (ex) {
      assertVMException(ex, "CommitteeAlreadyCheckedIn");
    }
    await newVault.setCommittee(accounts[2], { from: accounts[1] });
    await newVault.setCommittee(accounts[1], { from: accounts[2] });
  });
});
