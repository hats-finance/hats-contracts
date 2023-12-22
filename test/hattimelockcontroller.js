const HATVaultsRegistry = artifacts.require("./HATVaultsRegistry.sol");
const HATVault = artifacts.require("./HATVault.sol");
const HATClaimsManager = artifacts.require("./HATClaimsManager.sol");
const HATTimelockController = artifacts.require("./HATTimelockController.sol");
const HATTokenMock = artifacts.require("./HATTokenMock.sol");
const ERC20Mock = artifacts.require("./ERC20Mock.sol");
const TokenLockFactory = artifacts.require("./TokenLockFactory.sol");
const HATTokenLock = artifacts.require("./HATTokenLock.sol");
const RewardController = artifacts.require("./RewardController.sol");
const HATGovernanceArbitrator = artifacts.require("./HATGovernanceArbitrator.sol");

const { deployHATVaults } = require("../scripts/deployments/hatvaultsregistry-deploy");

var hatVaultsRegistry;
var vault;
var claimsManager;
var rewardController;
var hatTimelockController;
var hatToken;
var stakingToken;
var tokenLockFactory;
var arbitratorContract;
var hatGovernanceDelay = 60 * 60 * 24 * 7;
const {
  assertVMException,
  epochRewardPerBlock,
  advanceToSafetyPeriod,
  advanceToNonSafetyPeriod,
  submitClaim,
  assertFunctionRaisesException,
  MAX_UINT16
} = require("./common.js");

const setup = async function(
  accounts,
  challengePeriod=60 * 60 * 24,
  startBlock = 0,
  maxBounty = 8000,
  bountySplit = [7000, 2500, 500],
  governanceFee = 1000,
  halvingAfterBlock = 10,
  allocPoint = 100,
  rewardInVaults = 2500000
) {
  hatToken = await HATTokenMock.new(accounts[0]);
  await hatToken.setTransferable({from: accounts[0]});
  stakingToken = await ERC20Mock.new("Staking", "STK");

  var tokenLock = await HATTokenLock.new();
  tokenLockFactory = await TokenLockFactory.new(tokenLock.address, accounts[0]);
  let deployment = await deployHATVaults({
    governance: accounts[0],
    hatToken: hatToken.address,
    tokenLockFactory: tokenLockFactory.address,
    rewardControllersConf: [{
      startBlock,
      epochLength: halvingAfterBlock,
      epochRewardPerBlock
    }],
    hatVaultsRegistryConf: {
      governanceFee: governanceFee
    },
    silent: true
  });
  arbitratorContract = await HATGovernanceArbitrator.at(deployment.arbitrator);
  hatVaultsRegistry = await HATVaultsRegistry.at(deployment.hatVaultsRegistry.address);
  rewardController = await RewardController.at(
    deployment.rewardControllers[0].address
  );
  hatTimelockController = await HATTimelockController.new(
    hatGovernanceDelay,
    [accounts[0]],
    [accounts[0]]
  );

  await hatToken.setMinter(
    accounts[0],
    web3.utils.toWei((2500000 + rewardInVaults).toString())
  );

  await hatToken.mint(accounts[0], web3.utils.toWei(rewardInVaults.toString()));
  await hatToken.transfer(
    rewardController.address,
    web3.utils.toWei(rewardInVaults.toString())
  );

  let tx = await hatVaultsRegistry.createVault(
    {
      asset: stakingToken.address,
      name: "VAULT",
      symbol: "VLT",
      rewardControllers: [rewardController.address],
      owner: hatTimelockController.address,
      isPaused: false,
      descriptionHash: "_descriptionHash",
    },
    {
    owner: hatTimelockController.address,
    committee: accounts[1],
    arbitrator: "0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF",
    arbitratorCanChangeBounty: true,
    arbitratorCanChangeBeneficiary: false,
    arbitratorCanSubmitIssues: false,
    isTokenLockRevocable: false,
    maxBounty: maxBounty,
    bountySplit: bountySplit,
    governanceFee: governanceFee,
    vestingDuration: 86400,
    vestingPeriods: 10
    }
  );

  vault = await HATVault.at(tx.logs[2].args._vault);
  claimsManager = await HATClaimsManager.at(tx.logs[2].args._claimsManager);

  await advanceToNonSafetyPeriod(hatVaultsRegistry);

  await hatVaultsRegistry.setDefaultChallengePeriod(challengePeriod);

  await hatVaultsRegistry.transferOwnership(hatTimelockController.address);
  await rewardController.transferOwnership(hatTimelockController.address);
  await arbitratorContract.transferOwnership(hatTimelockController.address);

  await hatTimelockController.setAllocPoint(
    vault.address,
    rewardController.address,
    allocPoint
  );

  await claimsManager.committeeCheckIn({ from: accounts[1] });
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
    assert.equal(await vault.owner(), hatTimelockController.address);
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
      await hatTimelockController.setVaultVisibility(vault.address, true, {
        from: accounts[1],
      });
      assert(false, "only governance");
    } catch (ex) {
      assertVMException(ex);
    }

    try {
      await hatVaultsRegistry.setVaultVisibility(vault.address, true);
      assert(false, "only governance");
    } catch (ex) {
      assertVMException(ex);
    }
    assert.equal(await hatVaultsRegistry.isVaultVisible(vault.address), false);
    await hatTimelockController.setVaultVisibility(vault.address, true);
    assert.equal(await hatVaultsRegistry.isVaultVisible(vault.address), true);
    await hatTimelockController.setAllocPoint(vault.address, rewardController.address, 200);

    var staker = accounts[4];
    await stakingToken.approve(vault.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await stakingToken.mint(staker, web3.utils.toWei("1"));
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });
    assert.equal(await hatToken.balanceOf(staker), 0);
    await hatTimelockController.setVaultVisibility(vault.address, true);
    await hatTimelockController.setVaultVisibility(vault.address, true);
    await hatTimelockController.setAllocPoint(vault.address, rewardController.address, 200);
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
      await hatTimelockController.setVaultDescription(vault.address, "descHash", {
        from: accounts[1],
      });
      assert(false, "only governance");
    } catch (ex) {
      assertVMException(ex);
    }

    try {
      await vault.setVaultDescription("descHash");
      assert(false, "only governance");
    } catch (ex) {
      assertVMException(ex);
    }
    await hatTimelockController.setVaultDescription(vault.address, "descHash");
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
    await hatTimelockController.setAllocPoint(vault.address, rewardController.address, 200);

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

    let claimId = await submitClaim(claimsManager, { accounts });

    await assertFunctionRaisesException(
      claimsManager.challengeClaim(claimId),
      "OnlyArbitratorOrRegistryOwner"
    );

    try {
      await arbitratorContract.approveClaim(claimsManager.address, claimId);
      assert(false, "only governance");
    } catch (ex) {
      assertVMException(ex);
    }

    try {
      await hatTimelockController.approveClaim(arbitratorContract.address, claimsManager.address, claimId, {
        from: accounts[3],
      });
      assert(false, "only gov");
    } catch (ex) {
      assertVMException(ex);
    }

    await hatTimelockController.approveClaim(arbitratorContract.address, claimsManager.address, claimId);
  });

  it("challenge - dismiss claim", async () => {
    await setup(accounts);
    // set challenge period to 1000
    await advanceToSafetyPeriod(hatVaultsRegistry);
    let claimId = await submitClaim(claimsManager, { accounts });
    // now that the claim is challenged, only arbitrator can accept or dismiss
    await assertFunctionRaisesException(
      claimsManager.dismissClaim(claimId),
      "OnlyCallableIfChallenged"
    );

    try {
      await arbitratorContract.dismissClaim(claimsManager.address, claimId);
      assert(false, "only governance");
    } catch (ex) {
      assertVMException(ex);
    }

    try {
      await hatTimelockController.dismissClaim(arbitratorContract.address, claimsManager.address, claimId, {
        from: accounts[1],
      });
      assert(false, "only governance");
    } catch (ex) {
      assertVMException(ex);
    }

    await hatTimelockController.dismissClaim(arbitratorContract.address, claimsManager.address, claimId);
  });

  it("setCommittee", async () => {
    await setup(accounts);

    //creat another vault with a different committee
    let maxBounty = 8000;
    let bountySplit = [7000, 2500, 500];
    let governanceFee = 65535;
    var stakingToken2 = await ERC20Mock.new("Staking", "STK");
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
      committee: accounts[3],
      arbitrator: "0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF",
      arbitratorCanChangeBounty: true,
      arbitratorCanChangeBeneficiary: false,
      arbitratorCanSubmitIssues: false,
      isTokenLockRevocable: false,
      maxBounty: maxBounty,
      bountySplit: bountySplit,
      governanceFee: governanceFee,
      vestingDuration: 86400,
      vestingPeriods: 10
      }
    );
  
    let newVault = await HATVault.at(tx.logs[2].args._vault);
    let newClaimsManager = await HATClaimsManager.at(tx.logs[2].args._claimsManager);

    try {
      await hatTimelockController.setAllocPoint(newVault.address, rewardController.address, 100, {
        from: accounts[1],
      });
      assert(false, "only governance");
    } catch (ex) {
      assertVMException(ex);
    }

    await hatTimelockController.setAllocPoint(
      newVault.address,
      rewardController.address,
      100
    );

    assert.equal(await newClaimsManager.committee(), accounts[3]);

    try {
      await hatTimelockController.setCommittee(newClaimsManager.address, accounts[1], {
        from: accounts[1],
      });
      assert(false, "only governance");
    } catch (ex) {
      assertVMException(ex);
    }

    try {
      await newClaimsManager.setCommittee(accounts[2]);
      assert(false, "only governance");
    } catch (ex) {
      assertVMException(ex);
    }

    await hatTimelockController.setCommittee(newClaimsManager.address, accounts[1]);

    assert.equal(await newClaimsManager.committee(), accounts[1]);

    tx = await newClaimsManager.committeeCheckIn({ from: accounts[1] });
    assert.equal(tx.logs[0].event, "CommitteeCheckedIn");

    try {
      await hatTimelockController.setCommittee(newClaimsManager.address, accounts[2]);
      assert(false, "committee already checked in");
    } catch (ex) {
      assertVMException(ex, "CommitteeAlreadyCheckedIn");
    }
    await newClaimsManager.setCommittee(accounts[2], { from: accounts[1] });
    await newClaimsManager.setCommittee(accounts[1], { from: accounts[2] });
  });

  it("setEmergencyPaused", async () => {
    await setup(accounts);

    var staker = accounts[1];

    await stakingToken.approve(vault.address, web3.utils.toWei("1"), {
      from: staker,
    });

    await stakingToken.mint(staker, web3.utils.toWei("1"));

    try {
      await hatTimelockController.setEmergencyPaused(hatVaultsRegistry.address, true, {
        from: accounts[1],
      });
      assert(false, "only governance");
    } catch (ex) {
      assertVMException(ex);
    }

    try {
      await hatVaultsRegistry.setEmergencyPaused(true);
      assert(false, "only governance");
    } catch (ex) {
      assertVMException(ex);
    }

    await hatTimelockController.setEmergencyPaused(hatVaultsRegistry.address, true);

    await assertFunctionRaisesException(
      vault.deposit(web3.utils.toWei("1"), staker, { from: staker }),
      "SystemInEmergencyPause"
    );

    await hatTimelockController.setEmergencyPaused(hatVaultsRegistry.address, false);
    
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });
  });
});
