const HATVaultsRegistry = artifacts.require("./HATVaultsRegistry.sol");
const HATVault = artifacts.require("./HATVault.sol");
const HATClaimsManager = artifacts.require("./HATClaimsManager.sol");
const HATTimelockController = artifacts.require("./HATTimelockController.sol");
const HATTokenMock = artifacts.require("./HATTokenMock.sol");
const ERC20Mock = artifacts.require("./ERC20Mock.sol");
const UniSwapV3RouterMock = artifacts.require("./UniSwapV3RouterMock.sol");
const TokenLockFactory = artifacts.require("./TokenLockFactory.sol");
const HATTokenLock = artifacts.require("./HATTokenLock.sol");
const RewardController = artifacts.require("./RewardController.sol");
const ExpertCommitteeArbitrator = artifacts.require("./ExpertCommitteeArbitrator.sol");
const utils = require("./utils.js");
const IExpertCommitteeArbitrator = new ethers.utils.Interface(ExpertCommitteeArbitrator.abi);
const IHATClaimsManager = new ethers.utils.Interface(HATClaimsManager.abi);

const { deployHATVaults } = require("../scripts/deployments/hatvaultsregistry-deploy.js");

var hatVaultsRegistry;
var vault;
var claimsManager;
var rewardController;
var hatTimelockController;
var hatToken;
var router;
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
  MAX_UINT16,
  ZERO_ADDRESS
} = require("./common.js");

const setup = async function(
  accounts,
  challengePeriod=60 * 60 * 24,
  startBlock = 0,
  maxBounty = 8000,
  bountySplit = [7000, 2500, 500],
  hatBountySplit = [1000, 500],
  halvingAfterBlock = 10,
  routerReturnType = 0,
  allocPoint = 100,
  weth = true,
  rewardInVaults = 2500000
) {
  hatToken = await HATTokenMock.new(accounts[0]);
  await hatToken.setTransferable({from: accounts[0]});
  stakingToken = await ERC20Mock.new("Staking", "STK");
  var wethAddress = utils.NULL_ADDRESS;
  if (weth) {
    wethAddress = stakingToken.address;
  }
  router = await UniSwapV3RouterMock.new(routerReturnType, wethAddress);
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
      bountyGovernanceHAT: hatBountySplit[0],
      bountyHackerHATVested: hatBountySplit[1]
    },
    silent: true
  });
  hatVaultsRegistry = await HATVaultsRegistry.at(deployment.hatVaultsRegistry.address);
  arbitratorContract = await ExpertCommitteeArbitrator.new(accounts[7]);
  await hatVaultsRegistry.setDefaultArbitrator(arbitratorContract.address);
  rewardController = await RewardController.at(
    deployment.rewardControllers[0].address
  );
  hatTimelockController = await HATTimelockController.new(
    hatGovernanceDelay,
    [accounts[0]],
    [accounts[0]],
    [accounts[1]]
  );

  await hatToken.setMinter(
    accounts[0],
    web3.utils.toWei((2500000 + rewardInVaults).toString())
  );
  await hatToken.mint(router.address, web3.utils.toWei("2500000"));
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
    bountyGovernanceHAT: MAX_UINT16,
    bountyHackerHATVested: MAX_UINT16,
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

contract("ExpertCommitteeArbitrator", (accounts) => {
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

    await arbitratorContract.challengeClaim(claimsManager.address, claimId, 0, ZERO_ADDRESS, {from: accounts[7]});

    try {
      await arbitratorContract.approveClaim(claimsManager.address, claimId, {from: accounts[7]});
      assert(false, "only governance");
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
    await arbitratorContract.challengeClaim(claimsManager.address, claimId, 0, ZERO_ADDRESS, {from: accounts[7]});
    try {
      await arbitratorContract.dismissClaim(claimsManager.address, claimId);
      assert(false, "only governance");
    } catch (ex) {
      assertVMException(ex);
    }

    try {
      await hatTimelockController.dismissClaim(arbitratorContract.address, claimsManager.address, claimId, {
        from: accounts[7],
      });
      assert(false, "only governance");
    } catch (ex) {
      assertVMException(ex);
    }

    await hatTimelockController.dismissClaim(arbitratorContract.address, claimsManager.address, claimId);
  });

  it("expert committee can challenge with new values and arbitrator can approve", async () => {
    await setup(accounts);
    const newBounty = 6000;
    const newBeneficiary = accounts[5];

    // Schedule expert committee change through timelock
    await hatTimelockController.schedule(
      claimsManager.address,
      0, // value
      IHATClaimsManager.encodeFunctionData("setArbitratorOptions", [true, true, true]),
      "0x0000000000000000000000000000000000000000000000000000000000000000", // predecessor
      "0x0000000000000000000000000000000000000000000000000000000000000000", // salt
      60 * 60 * 24 * 7 // delay
    );

    // Wait for timelock delay
    await utils.increaseTime(60 * 60 * 24 * 7);

    // Execute the scheduled expert committee change
    await hatTimelockController.execute(
      claimsManager.address, 
      0,
      IHATClaimsManager.encodeFunctionData("setArbitratorOptions", [true, true, true]),
      "0x0000000000000000000000000000000000000000000000000000000000000000",
      "0x0000000000000000000000000000000000000000000000000000000000000000"
    );

    await advanceToSafetyPeriod(hatVaultsRegistry);

    // Submit claim
    let claimId = await submitClaim(claimsManager, { accounts });

    // Non-expert committee cannot challenge
    await assertFunctionRaisesException(
      arbitratorContract.challengeClaim(
        claimsManager.address,
        claimId,
        newBounty,
        newBeneficiary,
        { from: accounts[2] }
      ),
      "OnlyExpertCommittee"
    );

    // Expert committee can challenge with new values
    await arbitratorContract.challengeClaim(
      claimsManager.address,
      claimId,
      newBounty,
      newBeneficiary,
      { from: accounts[7] } // expert committee set in setup
    );

    // Verify the proposal was stored
    const proposal = await claimsManager.arbitratorChangeProposals(claimId);
    assert.equal(proposal.bountyPercentage, newBounty);
    assert.equal(proposal.beneficiary, newBeneficiary);

    // Governance can approve through timelock
    await hatTimelockController.approveClaim(
      arbitratorContract.address,
      claimsManager.address,
      claimId
    );
  });

  it("only governance can set expert committee", async () => {
    await setup(accounts);
    const newExpertCommittee = accounts[8];

    // Non-owner cannot set expert committee
    await assertFunctionRaisesException(
      arbitratorContract.setExpertCommittee(newExpertCommittee, { from: accounts[1] }),
      "Ownable: caller is not the owner"
    );

    // Non-timelock cannot set expert committee
    await assertFunctionRaisesException(
      arbitratorContract.setExpertCommittee(newExpertCommittee, { from: accounts[0] }),
      "Ownable: caller is not the owner"
    );

    // Verify current expert committee
    assert.equal(await arbitratorContract.expertCommittee(), accounts[7]);

    // Schedule expert committee change through timelock
    await hatTimelockController.schedule(
      arbitratorContract.address,
      0, // value
      IExpertCommitteeArbitrator.encodeFunctionData("setExpertCommittee", [newExpertCommittee]),
      "0x0000000000000000000000000000000000000000000000000000000000000000", // predecessor
      "0x0000000000000000000000000000000000000000000000000000000000000000", // salt
      60 * 60 * 24 * 7 // delay
    );

    // Wait for timelock delay
    await utils.increaseTime(60 * 60 * 24 * 7);

    // Execute the scheduled expert committee change
    await hatTimelockController.execute(
      arbitratorContract.address, 
      0,
      IExpertCommitteeArbitrator.encodeFunctionData("setExpertCommittee", [newExpertCommittee]),
      "0x0000000000000000000000000000000000000000000000000000000000000000",
      "0x0000000000000000000000000000000000000000000000000000000000000000"
    );

    // Verify expert committee was updated
    assert.equal(await arbitratorContract.expertCommittee(), newExpertCommittee);

    // Old expert committee can no longer challenge
    await assertFunctionRaisesException(
      arbitratorContract.challengeClaim(
        claimsManager.address,
        web3.utils.randomHex(32),
        6000,
        accounts[5],
        { from: accounts[7] }
      ),
      "OnlyExpertCommittee"
    );

    // New expert committee can challenge
    await advanceToSafetyPeriod(hatVaultsRegistry);
    const claimId = await submitClaim(claimsManager, { accounts });
    await arbitratorContract.challengeClaim(
      claimsManager.address,
      claimId,
      6000,
      accounts[5],
      { from: newExpertCommittee }
    );
  });

  it("only expert committee can challenge", async () => {
    await setup(accounts);
    await advanceToSafetyPeriod(hatVaultsRegistry);
    
    const newBounty = 6000;
    const newBeneficiary = accounts[5];
    let claimId = await submitClaim(claimsManager, { accounts });

    // Owner cannot challenge
    await assertFunctionRaisesException(
        arbitratorContract.challengeClaim(
            claimsManager.address,
            claimId,
            newBounty,
            newBeneficiary,
            { from: accounts[0] }
        ),
        "OnlyExpertCommittee"
    );

    // Random account cannot challenge
    await assertFunctionRaisesException(
        arbitratorContract.challengeClaim(
            claimsManager.address,
            claimId,
            newBounty,
            newBeneficiary,
            { from: accounts[3] }
        ),
        "OnlyExpertCommittee"
    );

    // Expert committee can challenge
    await arbitratorContract.challengeClaim(
        claimsManager.address,
        claimId,
        newBounty,
        newBeneficiary,
        { from: accounts[7] } // expert committee
    );
  });
});
