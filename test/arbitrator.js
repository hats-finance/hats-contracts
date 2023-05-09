const utils = require("./utils.js");
const HATTokenLock = artifacts.require("./HATTokenLock.sol");
const { contract } = require("hardhat");
const {
  setup,
  advanceToSafetyPeriod,
  advanceToNonSafetyPeriod,
  submitClaim,
  assertFunctionRaisesException,
  ZERO_ADDRESS,
} = require("./common.js");
const { assert } = require("chai");

contract("Registry Arbitrator", (accounts) => {
  it("Set default arbitrator", async () => {
    const { registry, claimsManager } = await setup(accounts, { setDefaultArbitrator: false });

    assert.equal(await registry.defaultArbitrator(), accounts[0]);
    assert.equal(await claimsManager.getArbitrator(), accounts[0]);

    await assertFunctionRaisesException(
      registry.setDefaultArbitrator(accounts[1], { from: accounts[1] }),
      "Ownable: caller is not the owner"
    );

    tx = await registry.setDefaultArbitrator(accounts[1]);

    assert.equal(await registry.defaultArbitrator(), accounts[1]);
    assert.equal(await claimsManager.getArbitrator(), accounts[1]);
    assert.equal(tx.logs[0].event, "SetDefaultArbitrator");
    assert.equal(tx.logs[0].args._defaultArbitrator, accounts[1]);
  });

  it("Set default challenge period", async () => {
    const { registry, claimsManager } = await setup(
      accounts, { setDefaultArbitrator: false, challengePeriod: undefined}
    );


    assert.equal(await registry.defaultChallengePeriod(), 60 * 60 * 24 * 3);
    assert.equal(await claimsManager.getChallengePeriod(), 60 * 60 * 24 * 3);

    await assertFunctionRaisesException(
      registry.setDefaultChallengePeriod(60 * 60 * 24, { from: accounts[1] }),
      "Ownable: caller is not the owner"
    );

    await assertFunctionRaisesException(
      registry.setDefaultChallengePeriod(60 * 60 * 24 - 1),
      "ChallengePeriodTooShort"
    );

    await assertFunctionRaisesException(
      registry.setDefaultChallengePeriod(60 * 60 * 24 * 5 + 1),
      "ChallengePeriodTooLong"
    );

    tx = await registry.setDefaultChallengePeriod(60 * 60 * 24);

    assert.equal(await registry.defaultChallengePeriod(), 60 * 60 * 24);
    assert.equal(await claimsManager.getChallengePeriod(), 60 * 60 * 24);
    assert.equal(tx.logs[0].event, "SetDefaultChallengePeriod");
    assert.equal(tx.logs[0].args._defaultChallengePeriod, 60 * 60 * 24);

    tx = await registry.setDefaultChallengePeriod(60 * 60 * 24 * 5);

    assert.equal(await registry.defaultChallengePeriod(), 60 * 60 * 24 * 5);
    assert.equal(await claimsManager.getChallengePeriod(), 60 * 60 * 24 * 5);
    assert.equal(tx.logs[0].event, "SetDefaultChallengePeriod");
    assert.equal(tx.logs[0].args._defaultChallengePeriod, 60 * 60 * 24 * 5);
  });

  it("Set default challengeTimeOutPeriod", async () => {
    const { registry, claimsManager } = await setup(accounts);

    assert.equal(await registry.defaultChallengeTimeOutPeriod(), 60 * 60 * 24 * 35);
    assert.equal(await claimsManager.getChallengeTimeOutPeriod(), 60 * 60 * 24 * 35);

    await assertFunctionRaisesException(
      registry.setDefaultChallengeTimeOutPeriod(60 * 60 * 24 * 2, { from: accounts[1] }),
      "Ownable: caller is not the owner"
    );

    await assertFunctionRaisesException(
      registry.setDefaultChallengeTimeOutPeriod(60 * 60 * 24 * 2 - 1),
      "ChallengeTimeOutPeriodTooShort"
    );

    await assertFunctionRaisesException(
      registry.setDefaultChallengeTimeOutPeriod(60 * 60 * 24 * 85 + 1),
      "ChallengeTimeOutPeriodTooLong"
    );

    tx = await registry.setDefaultChallengeTimeOutPeriod(60 * 60 * 24 * 2);

    assert.equal(await registry.defaultChallengeTimeOutPeriod(), 60 * 60 * 24 * 2);
    assert.equal(await claimsManager.getChallengeTimeOutPeriod(), 60 * 60 * 24 * 2);
    assert.equal(tx.logs[0].event, "SetDefaultChallengeTimeOutPeriod");
    assert.equal(tx.logs[0].args._defaultChallengeTimeOutPeriod, 60 * 60 * 24 * 2);

    tx = await registry.setDefaultChallengeTimeOutPeriod(60 * 60 * 24 * 85);

    assert.equal(await registry.defaultChallengeTimeOutPeriod(), 60 * 60 * 24 * 85);
    assert.equal(await claimsManager.getChallengeTimeOutPeriod(), 60 * 60 * 24 * 85);
    assert.equal(tx.logs[0].event, "SetDefaultChallengeTimeOutPeriod");
    assert.equal(tx.logs[0].args._defaultChallengeTimeOutPeriod, 60 * 60 * 24 * 85);
  });

  it("Set vault arbitration parameters", async () => {
    const { registry, claimsManager } = await setup(
      accounts, { setDefaultArbitrator: false, challengePeriod: undefined}
    );

    assert.equal(await registry.defaultArbitrator(), accounts[0]);
    assert.equal(await claimsManager.getArbitrator(), accounts[0]);

    assert.equal((await registry.defaultChallengePeriod()).toString(), 60 * 60 * 24 * 3);
    assert.equal(await claimsManager.getChallengePeriod(), 60 * 60 * 24 * 3);

    assert.equal(await registry.defaultChallengeTimeOutPeriod(), 60 * 60 * 24 * 35);
    assert.equal(await claimsManager.getChallengeTimeOutPeriod(), 60 * 60 * 24 * 35);

    assert.equal(await claimsManager.arbitratorCanChangeBounty(), true);
    assert.equal(await claimsManager.arbitratorCanChangeBeneficiary(), false);
    assert.equal(await claimsManager.arbitratorCanSubmitClaims(), false);

    await assertFunctionRaisesException(
      claimsManager.setArbitrator(
        accounts[2],
        { from: accounts[1] }
      ),
      "OnlyRegistryOwner"
    );
    await assertFunctionRaisesException(
      claimsManager.setChallengePeriod(
        60 * 60 * 24,
        { from: accounts[1] }
      ),
      "OnlyRegistryOwner"
    );
    await assertFunctionRaisesException(
      claimsManager.setChallengeTimeOutPeriod(
        60 * 60 * 24 * 2,
        { from: accounts[1] }
      ),
      "OnlyRegistryOwner"
    );

    await assertFunctionRaisesException(
      claimsManager.setChallengePeriod(60 * 60 * 24 - 1),
      "ChallengePeriodTooShort"
    );

    await assertFunctionRaisesException(
      claimsManager.setArbitratorOptions(
        false,
        true,
        true,
        { from: accounts[1] }
      ),
      "OnlyRegistryOwner"
    );

    await assertFunctionRaisesException(
      claimsManager.setChallengePeriod(60 * 60 * 24 * 5 + 1),
      "ChallengePeriodTooLong"
    );

    await assertFunctionRaisesException(
      claimsManager.setChallengeTimeOutPeriod(60 * 60 * 24 * 2 - 1),
      "ChallengeTimeOutPeriodTooShort"
    );

    await assertFunctionRaisesException(
      claimsManager.setChallengeTimeOutPeriod(60 * 60 * 24 * 85 + 1),
      "ChallengeTimeOutPeriodTooLong"
    );

    let tx = await claimsManager.setArbitrator(accounts[2]);
    assert.equal(tx.logs[0].event, "SetArbitrator");
    assert.equal(tx.logs[0].args._arbitrator, accounts[2]);

    tx = await claimsManager.setChallengePeriod(60 * 60 * 24);
    assert.equal(tx.logs[0].event, "SetChallengePeriod");
    assert.equal(tx.logs[0].args._challengePeriod, 60 * 60 * 24);

    tx = await claimsManager.setChallengeTimeOutPeriod(60 * 60 * 24 * 2);
    assert.equal(tx.logs[0].event, "SetChallengeTimeOutPeriod");
    assert.equal(tx.logs[0].args._challengeTimeOutPeriod, 60 * 60 * 24 * 2);

    tx = await claimsManager.setArbitratorOptions(false, true, true);
    assert.equal(tx.logs[0].event, "SetArbitratorOptions");
    assert.equal(tx.logs[0].args._arbitratorCanChangeBounty, false);
    assert.equal(tx.logs[0].args._arbitratorCanChangeBeneficiary, true);
    assert.equal(tx.logs[0].args._arbitratorCanSubmitClaims, true);

    assert.equal(await registry.defaultArbitrator(), accounts[0]);
    assert.equal(await claimsManager.getArbitrator(), accounts[2]);

    assert.equal(await registry.defaultChallengePeriod(), 60 * 60 * 24 * 3);
    assert.equal(await claimsManager.getChallengePeriod(), 60 * 60 * 24);

    assert.equal(await registry.defaultChallengeTimeOutPeriod(), 60 * 60 * 24 * 35);
    assert.equal(await claimsManager.getChallengeTimeOutPeriod(), 60 * 60 * 24 * 2);

    assert.equal(await claimsManager.arbitratorCanChangeBounty(), false);

    assert.equal(await claimsManager.arbitratorCanChangeBeneficiary(), true);

    assert.equal(await claimsManager.arbitratorCanSubmitClaims(), true);

    tx = await claimsManager.setArbitrator(accounts[3]);
    assert.equal(tx.logs[0].event, "SetArbitrator");
    assert.equal(tx.logs[0].args._arbitrator, accounts[3]);

    tx = await claimsManager.setChallengePeriod(60 * 60 * 24 * 5);
    assert.equal(tx.logs[0].event, "SetChallengePeriod");
    assert.equal(tx.logs[0].args._challengePeriod, 60 * 60 * 24 * 5);

    tx = await claimsManager.setChallengeTimeOutPeriod(60 * 60 * 24 * 85);
    assert.equal(tx.logs[0].event, "SetChallengeTimeOutPeriod");
    assert.equal(tx.logs[0].args._challengeTimeOutPeriod, 60 * 60 * 24 * 85);

    tx = await claimsManager.setArbitratorOptions(true, false, false);
    assert.equal(tx.logs[0].event, "SetArbitratorOptions");
    assert.equal(tx.logs[0].args._arbitratorCanChangeBounty, true);
    assert.equal(tx.logs[0].args._arbitratorCanChangeBeneficiary, false);
    assert.equal(tx.logs[0].args._arbitratorCanSubmitClaims, false);

    assert.equal(await registry.defaultArbitrator(), accounts[0]);
    assert.equal(await claimsManager.getArbitrator(), accounts[3]);

    assert.equal(await registry.defaultChallengePeriod(), 60 * 60 * 24 * 3);
    assert.equal(await claimsManager.getChallengePeriod(), 60 * 60 * 24 * 5);

    assert.equal(await registry.defaultChallengeTimeOutPeriod(), 60 * 60 * 24 * 35);
    assert.equal(await claimsManager.getChallengeTimeOutPeriod(), 60 * 60 * 24 * 85);

    assert.equal(await claimsManager.arbitratorCanChangeBounty(), true);

    assert.equal(await claimsManager.arbitratorCanChangeBeneficiary(), false);

    assert.equal(await claimsManager.arbitratorCanSubmitClaims(), false);

    tx = await claimsManager.setArbitrator(await claimsManager.NULL_ADDRESS());
    assert.equal(tx.logs[0].event, "SetArbitrator");
    assert.equal(tx.logs[0].args._arbitrator, await claimsManager.NULL_ADDRESS());

    tx = await claimsManager.setChallengePeriod(await claimsManager.NULL_UINT32());
    assert.equal(tx.logs[0].event, "SetChallengePeriod");
    assert.equal(tx.logs[0].args._challengePeriod.toString(), (await claimsManager.NULL_UINT32()).toString());

    tx = await claimsManager.setChallengeTimeOutPeriod(await claimsManager.NULL_UINT32());
    assert.equal(tx.logs[0].event, "SetChallengeTimeOutPeriod");
    assert.equal(tx.logs[0].args._challengeTimeOutPeriod.toString(), (await claimsManager.NULL_UINT32()).toString());

    tx = await claimsManager.setArbitratorOptions(true, false, false);
    assert.equal(tx.logs[0].event, "SetArbitratorOptions");
    assert.equal(tx.logs[0].args._arbitratorCanChangeBounty, true);
    assert.equal(tx.logs[0].args._arbitratorCanChangeBeneficiary, false);
    assert.equal(tx.logs[0].args._arbitratorCanSubmitClaims, false);

    assert.equal(await registry.defaultArbitrator(), accounts[0]);
    assert.equal(await claimsManager.getArbitrator(), accounts[0]);

    assert.equal(await registry.defaultChallengePeriod(), 60 * 60 * 24 * 3);
    assert.equal(await claimsManager.getChallengePeriod(), 60 * 60 * 24 * 3);

    assert.equal(await registry.defaultChallengeTimeOutPeriod(), 60 * 60 * 24 * 35);
    assert.equal(await claimsManager.getChallengeTimeOutPeriod(), 60 * 60 * 24 * 35);

    assert.equal(await claimsManager.arbitratorCanChangeBounty(), true);

    assert.equal(await claimsManager.arbitratorCanChangeBeneficiary(), false);

    assert.equal(await claimsManager.arbitratorCanSubmitClaims(), false);
  });

  it("No challenge, claim times out: anyone can approve claim", async () => {
    const { registry, claimsManager, someAccount } = await setup(accounts);
    
    await advanceToNonSafetyPeriod(registry);
    // set challenge period to 1 day
    const challengePeriod = 60*60*24;
    await registry.setDefaultChallengePeriod(challengePeriod);

    await registry.setDefaultArbitrator(accounts[3]);

    await advanceToSafetyPeriod(registry);

    let claimId = await submitClaim(claimsManager, { accounts });

    await assertFunctionRaisesException(
      claimsManager.approveClaim(claimId, 8000, ZERO_ADDRESS, { from: someAccount }),
      "UnchallengedClaimCanOnlyBeApprovedAfterChallengePeriod"
    );

    // go and pass the challenge period
    await utils.increaseTime(challengePeriod);
    // challenge period is over
    // anyone can now approve the claim, accepting the claim with the same amount is fine
    const tx = await claimsManager.approveClaim(claimId, 1234, ZERO_ADDRESS, {
      from: someAccount,
    });

    assert.equal(tx.logs[0].event, "ApproveClaim");
    assert.equal(tx.logs[0].args._claimId, claimId);
    // the fact that approveclaim was called with a different percentage is ignored
    assert.equal(tx.logs[0].args._bountyPercentage.toString(), "8000");
  });

  it("Claim expires: anyone can dismiss", async () => {
    const { registry, claimsManager } = await setup(accounts);

    await advanceToNonSafetyPeriod(registry);
    // set challenge period to 1 day
    const challengePeriod = 60*60*24;
    const challengeTimeOutPeriod = 60*60*24*5;
    const arbitrator = accounts[3];
    await registry.setDefaultChallengePeriod(challengePeriod);
    await registry.setDefaultChallengeTimeOutPeriod(challengeTimeOutPeriod);

    await registry.setDefaultArbitrator(arbitrator);

    await advanceToSafetyPeriod(registry);

    let claimId = await submitClaim(claimsManager, { accounts });

    // go and pass the expiration time
    await utils.increaseTime(challengePeriod);
    await utils.increaseTime(challengeTimeOutPeriod);
    // the claim has expired
    // anyone can now dismiss the claim, it cannot be approved anymore
    await assertFunctionRaisesException(
      claimsManager.approveClaim(claimId, 6000, ZERO_ADDRESS, { from: arbitrator }),
      "ClaimExpired"
    );

    tx = await claimsManager.dismissClaim(claimId);
    assert.equal(tx.logs[0].event, "DismissClaim");
    assert.equal(tx.logs[0].args._claimId, claimId);
  });

  it("Arbitrator can only change bounty if claim is challenged", async () => {
    const { registry, vault, claimsManager, stakingToken } = await setup(accounts);
    await advanceToNonSafetyPeriod(registry);
    // set challenge period to one day
    await registry.setDefaultChallengePeriod(60 * 60 * 24);

    const staker = accounts[1];
    await registry.setDefaultArbitrator(accounts[3]);

    // we send some funds to the vault so we can pay out later when approveClaim is called
    await stakingToken.mint(staker, web3.utils.toWei("2"));
    await stakingToken.approve(vault.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });

    await advanceToSafetyPeriod(registry);

    let claimId = await submitClaim(claimsManager, { accounts });

    // go and pass the challenge period
    await utils.increaseTime(60 * 60 * 24);

    // challenge period is over
    // anyone can now approve the claim, accepting the claim with the same amount is fine
    const tx = await claimsManager.approveClaim(claimId, 1234, ZERO_ADDRESS, {
      from: accounts[3],
    });
    assert.equal(tx.logs[1].event, "ApproveClaim");
    assert.equal(tx.logs[1].args._claimId, claimId);
    assert.equal(tx.logs[1].args._bountyPercentage.toString(), "8000");
    assert.equal(tx.logs[1].args._beneficiary, accounts[2]);
  });

  it("Arbitrator can only change beneficiary if claim is challenged", async () => {
    const { registry, vault, claimsManager, stakingToken } = await setup(accounts);
    await advanceToNonSafetyPeriod(registry);
    // set challenge period to one day
    await registry.setDefaultChallengePeriod(60 * 60 * 24);

    const staker = accounts[1];
    await registry.setDefaultArbitrator(accounts[3]);

    // we send some funds to the vault so we can pay out later when approveClaim is called
    await stakingToken.mint(staker, web3.utils.toWei("2"));
    await stakingToken.approve(vault.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });

    await advanceToSafetyPeriod(registry);

    let claimId = await submitClaim(claimsManager, { accounts });

    // go and pass the challenge period
    await utils.increaseTime(60 * 60 * 24);

    // challenge period is over
    // anyone can now approve the claim, accepting the claim with the same amount is fine
    const tx = await claimsManager.approveClaim(claimId, 0, accounts[3], {
      from: accounts[3],
    });
    assert.equal(tx.logs[1].event, "ApproveClaim");
    assert.equal(tx.logs[1].args._claimId, claimId);
    assert.equal(tx.logs[1].args._bountyPercentage.toString(), "8000");
    assert.equal(tx.logs[1].args._beneficiary, accounts[2]);
  });

  it("Arbitrator can only change bounty if can change bounty flag is true", async () => {
    const { registry, vault, claimsManager, stakingToken } = await setup(accounts);
    await advanceToNonSafetyPeriod(registry);
    // set challenge period to one day
    await registry.setDefaultChallengePeriod(60 * 60 * 24);

    const staker = accounts[1];
    await registry.setDefaultArbitrator(accounts[3]);

    // we send some funds to the vault so we can pay out later when approveClaim is called
    await stakingToken.mint(staker, web3.utils.toWei("2"));
    await stakingToken.approve(vault.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });

    await advanceToSafetyPeriod(registry);

    await claimsManager.setArbitratorOptions(false, false, false);

    let claimId = await submitClaim(claimsManager, { accounts });

    await claimsManager.challengeClaim(claimId, {from: accounts[3] });

    // this will only affect the next claim
    await claimsManager.setArbitratorOptions(true, false, false);

    let tx = await claimsManager.approveClaim(claimId, 1234, ZERO_ADDRESS, {
      from: accounts[3],
    });
    assert.equal(tx.logs[1].event, "ApproveClaim");
    assert.equal(tx.logs[1].args._claimId, claimId);
    assert.equal(tx.logs[1].args._bountyPercentage.toString(), "8000");
    assert.equal(tx.logs[1].args._beneficiary, accounts[2]);

    claimId = await submitClaim(claimsManager, { accounts });

    await claimsManager.challengeClaim(claimId, {from: accounts[3] });

    tx = await claimsManager.approveClaim(claimId, 1234, ZERO_ADDRESS, {
      from: accounts[3],
    });
    assert.equal(tx.logs[1].event, "ApproveClaim");
    assert.equal(tx.logs[1].args._claimId, claimId);
    assert.equal(tx.logs[1].args._bountyPercentage.toString(), "1234");
    assert.equal(tx.logs[1].args._beneficiary, accounts[2]);
  });

  it("Arbitrator can only change beneficiary if can change beneficiary flag is true", async () => {
    const { registry, vault, claimsManager, stakingToken } = await setup(accounts);
    await advanceToNonSafetyPeriod(registry);
    // set challenge period to one day
    await registry.setDefaultChallengePeriod(60 * 60 * 24);

    const staker = accounts[1];
    await registry.setDefaultArbitrator(accounts[3]);

    // we send some funds to the vault so we can pay out later when approveClaim is called
    await stakingToken.mint(staker, web3.utils.toWei("2"));
    await stakingToken.approve(vault.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });

    await advanceToSafetyPeriod(registry);

    await claimsManager.setArbitratorOptions(false, false, false);

    let claimId = await submitClaim(claimsManager, { accounts });

    await claimsManager.challengeClaim(claimId, {from: accounts[3] });

    // this will only affect the next claim
    await claimsManager.setArbitratorOptions(false, true, false);

    let tx = await claimsManager.approveClaim(claimId, 0, accounts[3], {
      from: accounts[3],
    });
    assert.equal(tx.logs[1].event, "ApproveClaim");
    assert.equal(tx.logs[1].args._claimId, claimId);
    assert.equal(tx.logs[1].args._bountyPercentage.toString(), "8000");
    assert.equal(tx.logs[1].args._beneficiary.toString(), accounts[2]);

    claimId = await submitClaim(claimsManager, { accounts });

    await claimsManager.challengeClaim(claimId, {from: accounts[3] });

    tx = await claimsManager.approveClaim(claimId, 0, accounts[3], {
      from: accounts[3],
    });
    assert.equal(tx.logs[1].event, "ApproveClaim");
    assert.equal(tx.logs[1].args._claimId, claimId);
    assert.equal(tx.logs[1].args._bountyPercentage.toString(), "8000");
    assert.equal(tx.logs[1].args._beneficiary, accounts[3]);
  });

  it("Arbitrator can only submit claims if can submit claims flag is true", async () => {
    const { registry, vault, claimsManager, stakingToken } = await setup(accounts);
    await advanceToNonSafetyPeriod(registry);
    // set challenge period to one day
    await registry.setDefaultChallengePeriod(60 * 60 * 24);

    const staker = accounts[1];
    await registry.setDefaultArbitrator(accounts[3]);

    // we send some funds to the vault so we can pay out later when approveClaim is called
    await stakingToken.mint(staker, web3.utils.toWei("2"));
    await stakingToken.approve(vault.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });

    await advanceToSafetyPeriod(registry);

    await assertFunctionRaisesException(
      claimsManager.submitClaim(
        accounts[2],
        8000,
        "description hash",
        {
          from: accounts[0],
        }
      ),
      "OnlyCommittee"
    );

    await assertFunctionRaisesException(
      claimsManager.submitClaim(
        accounts[2],
        8000,
        "description hash",
        {
          from: accounts[3],
        }
      ),
      "OnlyCommittee"
    );

    await claimsManager.setArbitratorOptions(false, false, true);

    await assertFunctionRaisesException(
      claimsManager.submitClaim(
        accounts[2],
        8000,
        "description hash",
        {
          from: accounts[0],
        }
      ),
      "OnlyCommittee"
    );

    let tx = await claimsManager.submitClaim(
      accounts[2],
      8000,
      "description hash",
      {
        from: accounts[3],
      }
    );

    let claimId = tx.logs[0].args._claimId;

    await claimsManager.challengeClaim(claimId, {from: accounts[3] });

    tx = await claimsManager.dismissClaim(claimId, {
      from: accounts[3],
    });
    assert.equal(tx.logs[0].event, "DismissClaim");
    assert.equal(tx.logs[0].args._claimId, claimId);

    claimId = await submitClaim(claimsManager, { accounts });

    await claimsManager.challengeClaim(claimId, {from: accounts[3] });

    tx = await claimsManager.approveClaim(claimId, 0, accounts[2], {
      from: accounts[3],
    });
    assert.equal(tx.logs[1].event, "ApproveClaim");
    assert.equal(tx.logs[1].args._claimId, claimId);
    assert.equal(tx.logs[1].args._bountyPercentage.toString(), "8000");
    assert.equal(tx.logs[1].args._beneficiary, accounts[2]);
  });

  it("Arbitrator can only submit claims if can submit claims flag is true", async () => {
    const { registry, vault, stakingToken } = await setup(accounts);
    await advanceToNonSafetyPeriod(registry);
    // set challenge period to one day
    await registry.setDefaultChallengePeriod(60 * 60 * 24);

    const staker = accounts[1];
    await registry.setDefaultArbitrator(accounts[3]);

    // we send some funds to the vault so we can pay out later when approveClaim is called
    await stakingToken.mint(staker, web3.utils.toWei("2"));
    await stakingToken.approve(vault.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });

    await advanceToSafetyPeriod(registry);

    await assertFunctionRaisesException(
      vault.submitClaim(
        accounts[2],
        8000,
        "description hash",
        {
          from: accounts[0],
        }
      ),
      "OnlyCommittee"
    );

    await assertFunctionRaisesException(
      vault.submitClaim(
        accounts[2],
        8000,
        "description hash",
        {
          from: accounts[3],
        }
      ),
      "OnlyCommittee"
    );

    await vault.setArbitratorOptions(false, false, true);

    await assertFunctionRaisesException(
      vault.submitClaim(
        accounts[2],
        8000,
        "description hash",
        {
          from: accounts[0],
        }
      ),
      "OnlyCommittee"
    );

    let tx = await vault.submitClaim(
      accounts[2],
      8000,
      "description hash",
      {
        from: accounts[3],
      }
    );

    let claimId = tx.logs[0].args._claimId;

    await vault.challengeClaim(claimId, {from: accounts[3] });

    tx = await vault.dismissClaim(claimId, {
      from: accounts[3],
    });
    assert.equal(tx.logs[0].event, "DismissClaim");
    assert.equal(tx.logs[0].args._claimId, claimId);

    claimId = await submitClaim(vault, { accounts });

    await vault.challengeClaim(claimId, {from: accounts[3] });

    tx = await vault.approveClaim(claimId, 0, accounts[2], {
      from: accounts[3],
    });
    assert.equal(tx.logs[8].event, "ApproveClaim");
    assert.equal(tx.logs[8].args._claimId, claimId);
    assert.equal(tx.logs[8].args._bountyPercentage.toString(), "8000");
    assert.equal(tx.logs[8].args._beneficiary, accounts[2]);
  });

  it("Arbitrator cannot challenge after challenge period", async () => {
    const { registry, vault, claimsManager, stakingToken } = await setup(accounts);
    await advanceToNonSafetyPeriod(registry);
    // set challenge period to one day
    await registry.setDefaultChallengePeriod(60 * 60 * 24);

    const staker = accounts[1];
    await registry.setDefaultArbitrator(accounts[3]);

    // we send some funds to the vault so we can pay out later when approveClaim is called
    await stakingToken.mint(staker, web3.utils.toWei("2"));
    await stakingToken.approve(vault.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });

    await advanceToSafetyPeriod(registry);

    let claimId = await submitClaim(claimsManager, { accounts });

    // go and pass the challenge period
    await utils.increaseTime(60 * 60 * 24);

    // claim can only be challanged during the challenge period
    await assertFunctionRaisesException(
      claimsManager.challengeClaim(claimId, { from: accounts[3] }),
      "ChallengePeriodEnded"
    );

    // challenge period is over
    // anyone can now approve the claim, accepting the claim with the same amount is fine
    const tx = await claimsManager.approveClaim(claimId, 1234, ZERO_ADDRESS, {
      from: accounts[3],
    });
    assert.equal(tx.logs[1].event, "ApproveClaim");
    assert.equal(tx.logs[1].args._claimId, claimId);
    assert.equal(tx.logs[1].args._bountyPercentage.toString(), "8000");
  });

  it("challenge - approve Claim by arbitrator ", async () => {
    const { registry, vault, claimsManager, stakingToken, committee, arbitrator } = await setup(accounts);
    // set challenge period to one day
    await registry.setDefaultChallengePeriod(60 * 60 * 24);
    const owner = accounts[0];
    const staker = accounts[1];
    await advanceToSafetyPeriod(registry);

    // we send some funds to the vault so we can pay out later when approveClaim is called
    await stakingToken.mint(staker, web3.utils.toWei("2"));
    await stakingToken.approve(vault.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });

    let claimId = await submitClaim(claimsManager, { accounts });

    // only arbitrator and governance can challenge the claim
    await assertFunctionRaisesException(
      claimsManager.challengeClaim(claimId, { from: committee }),
      "OnlyArbitratorOrRegistryOwner"
    );

    let tx = await claimsManager.challengeClaim(claimId, { from: arbitrator });
    assert.equal(tx.logs[0].event, "ChallengeClaim");
    assert.equal(tx.logs[0].args._claimId, claimId);

    // now that the claim is challenged, only arbitrator can accept or dismiss
    await assertFunctionRaisesException(
      claimsManager.approveClaim(claimId, 6000, ZERO_ADDRESS, { from: staker }),
      "ChallengedClaimCanOnlyBeApprovedByArbitratorUntilChallengeTimeoutPeriod"
    );
    await assertFunctionRaisesException(
      claimsManager.approveClaim(claimId, 6000, ZERO_ADDRESS, { from: owner }),
      "ChallengedClaimCanOnlyBeApprovedByArbitratorUntilChallengeTimeoutPeriod"
    );

    // the arbitrator must in any case respect the limits
    await assertFunctionRaisesException(
      claimsManager.approveClaim(claimId, 10001, ZERO_ADDRESS, { from: arbitrator }),
      "BountyPercentageHigherThanMaxBounty"
    );

    await assertFunctionRaisesException(
      claimsManager.approveClaim(claimId, 8001, ZERO_ADDRESS, { from: arbitrator }),
      "BountyPercentageHigherThanMaxBounty"
    );

    // go and pass the challenge period
    await utils.increaseTime(60 * 60 * 24);

    await assertFunctionRaisesException(
      claimsManager.approveClaim(claimId, 8000, ZERO_ADDRESS, { from: owner }),
      "ChallengedClaimCanOnlyBeApprovedByArbitratorUntilChallengeTimeoutPeriod"
    );
    assert.equal((await claimsManager.activeClaim()).bountyPercentage, 8000);
    var stakingTokenBalanceBefore = await stakingToken.balanceOf(vault.address);
    tx = await claimsManager.approveClaim(claimId, 6000, ZERO_ADDRESS, { from: arbitrator });
    assert.equal(tx.logs[1].event, "ApproveClaim");
    assert.equal(tx.logs[1].args._claimId, claimId);
    assert.equal(tx.logs[1].args._bountyPercentage, 6000);
    assert.equal(
      (await stakingToken.balanceOf(vault.address)).toString(),
      stakingTokenBalanceBefore.sub(new web3.utils.BN(web3.utils.toWei("0.6"))).toString()
    );
    var vestingTokenLock = await HATTokenLock.at(tx.logs[1].args._tokenLock);
    assert.equal(await vestingTokenLock.beneficiary(), accounts[2]);
    let depositValutBNAfterClaim = new web3.utils.BN(web3.utils.toWei("0.6"));
    let expectedHackerBalance = depositValutBNAfterClaim
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
  });

  it("challenge - governance can challenge claim", async () => {
    const { registry, vault, claimsManager, stakingToken, arbitrator } = await setup(accounts);
    // set challenge period to one day
    await registry.setDefaultChallengePeriod(60 * 60 * 24);
    const owner = accounts[0];
    const staker = accounts[1];
    await advanceToSafetyPeriod(registry);

    // we send some funds to the vault so we can pay out later when approveClaim is called
    await stakingToken.mint(staker, web3.utils.toWei("2"));
    await stakingToken.approve(vault.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });

    let claimId = await submitClaim(claimsManager, { accounts });

    let tx = await claimsManager.challengeClaim(claimId, { from: owner });
    assert.equal(tx.logs[0].event, "ChallengeClaim");
    assert.equal(tx.logs[0].args._claimId, claimId);

    await claimsManager.dismissClaim(claimId, { from: arbitrator });
  });

  it("challenge - arbitrator changes after claim submitted", async () => {
    const { registry, vault, claimsManager, stakingToken, arbitrator } = await setup(accounts);
    // set challenge period to one day
    await registry.setDefaultChallengePeriod(60 * 60 * 24);
    const staker = accounts[1];
    const newArbitrator = accounts[3];
    await advanceToSafetyPeriod(registry);

    // we send some funds to the vault so we can pay out later when approveClaim is called
    await stakingToken.mint(staker, web3.utils.toWei("2"));
    await stakingToken.approve(vault.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });

    let claimId = await submitClaim(claimsManager, { accounts });

    await claimsManager.setArbitrator(newArbitrator);
    // only arbitrator at the time of submission and governance can challenge the claim
    await assertFunctionRaisesException(
      claimsManager.challengeClaim(claimId, { from: newArbitrator }),
      "OnlyArbitratorOrRegistryOwner"
    );

    let tx = await claimsManager.challengeClaim(claimId, { from: arbitrator });
    assert.equal(tx.logs[0].event, "ChallengeClaim");
    assert.equal(tx.logs[0].args._claimId, claimId);
    
    await assertFunctionRaisesException(
      claimsManager.dismissClaim(claimId, { from: newArbitrator }),
      "OnlyCallableByArbitratorOrAfterChallengeTimeOutPeriod"
    );

    await claimsManager.dismissClaim(claimId, { from: arbitrator });

    claimId = await submitClaim(claimsManager, { accounts });
    await assertFunctionRaisesException(
      claimsManager.challengeClaim(claimId, { from: arbitrator }),
      "OnlyArbitratorOrRegistryOwner"
    );
    tx = await claimsManager.challengeClaim(claimId, { from: newArbitrator });
    assert.equal(tx.logs[0].event, "ChallengeClaim");
    assert.equal(tx.logs[0].args._claimId, claimId);

    await assertFunctionRaisesException(
      claimsManager.dismissClaim(claimId, { from: arbitrator }),
      "OnlyCallableByArbitratorOrAfterChallengeTimeOutPeriod"
    );

    await claimsManager.dismissClaim(claimId, { from: newArbitrator });
  });

  it("anyone can dismiss Claim after challengeTimeOutPeriod", async () => {
    const { registry, claimsManager, arbitrator } = await setup(accounts);
    await advanceToSafetyPeriod(registry);
  
    // set challenge timeout period to two days
    const challengeTimeOutPeriod = 60 * 60 * 24 * 2;
    await registry.setDefaultChallengeTimeOutPeriod(challengeTimeOutPeriod);

    let claimId = await submitClaim(claimsManager, { accounts });

    await claimsManager.challengeClaim(claimId, { from: arbitrator });
    const someAccount = accounts[5];

    await assertFunctionRaisesException(
      claimsManager.approveClaim(claimId, 8000, ZERO_ADDRESS, { from: someAccount }),
      "ChallengedClaimCanOnlyBeApprovedByArbitratorUntilChallengeTimeoutPeriod"
    );
    await assertFunctionRaisesException(
      claimsManager.dismissClaim(claimId, { from: someAccount }),
      "OnlyCallableByArbitratorOrAfterChallengeTimeOutPeriod"
    );
     // go and pass the challenge period
    await utils.increaseTime(challengeTimeOutPeriod + 1);
    
    // challengeTimeOut has passed, not even the arbitrator can approve now
    await assertFunctionRaisesException(
      claimsManager.approveClaim(claimId, 8000, ZERO_ADDRESS, { from: someAccount }),
      "ChallengedClaimCanOnlyBeApprovedByArbitratorUntilChallengeTimeoutPeriod"
    );
    await assertFunctionRaisesException(
      claimsManager.approveClaim(claimId, 8000, ZERO_ADDRESS, { from: arbitrator }),
      "ChallengedClaimCanOnlyBeApprovedByArbitratorUntilChallengeTimeoutPeriod"
    );

    // but anyone  can dismiss the claim
    await claimsManager.dismissClaim(claimId, { from: someAccount });
  });

  it("challenge - dismiss claim by arbitrator", async () => {
    const { registry, claimsManager, arbitrator } = await setup(accounts);
    // set challenge period to one day
    const someAccount = accounts[4];
    await registry.setDefaultChallengePeriod(60 * 60 * 24);
    await registry.setDefaultArbitrator(arbitrator);
    await advanceToSafetyPeriod(registry);
    let claimId = await submitClaim(claimsManager, { accounts });

    await claimsManager.challengeClaim(claimId, { from: arbitrator });
    // now that the claim is challenged, only arbitrator can accept or dismiss
    await assertFunctionRaisesException(
      claimsManager.dismissClaim(claimId, { from: someAccount }),
      "OnlyCallableByArbitratorOrAfterChallengeTimeOutPeriod"
    );

    await assertFunctionRaisesException(
      claimsManager.dismissClaim(claimId, { from: someAccount }),
      "OnlyCallableByArbitratorOrAfterChallengeTimeOutPeriod"
    );
    tx = await claimsManager.dismissClaim(claimId, { from: arbitrator });
    assert.equal(tx.logs[0].event, "DismissClaim");
    assert.equal(tx.logs[0].args._claimId, claimId);
  });

  it("challenge - dismiss claim by anyone after timeout", async () => {
    const { registry, claimsManager, arbitrator, owner } = await setup(accounts);
    const someAccount = accounts[5];
    // set challenge period to one day
    const challengePeriod = 60*60*24*1;
    const challengeTimeOutPeriod = 60*60*24*2;
    await registry.setDefaultChallengePeriod(challengePeriod);
    await registry.setDefaultChallengeTimeOutPeriod(challengeTimeOutPeriod);

    await advanceToSafetyPeriod(registry);
    let claimId = await submitClaim(claimsManager, { accounts });

    await claimsManager.challengeClaim(claimId, { from: arbitrator });

    await utils.increaseTime(challengeTimeOutPeriod);

    // challenge has timed out: anyone can dismiss but nobody can approve
    await assertFunctionRaisesException(
      claimsManager.approveClaim(claimId, 8000, ZERO_ADDRESS, { from: owner }),
      "ChallengedClaimCanOnlyBeApprovedByArbitratorUntilChallengeTimeoutPeriod"
    );

    await assertFunctionRaisesException(
      claimsManager.approveClaim(claimId, 8000, ZERO_ADDRESS, { from: arbitrator }),
      "ChallengedClaimCanOnlyBeApprovedByArbitratorUntilChallengeTimeoutPeriod"
    );

    await claimsManager.dismissClaim(claimId, { from: someAccount });
  });

  it("claim can only be submitted during safety period", async () => {
    const {registry, claimsManager } = await setup(accounts);
    const committee = accounts[1];
    const arbitrator = accounts[2];
    await registry.setDefaultArbitrator(arbitrator);

   
    await advanceToNonSafetyPeriod(registry);
    // challengeClaim will fail if no active claim exists
    await assertFunctionRaisesException(
      claimsManager.submitClaim(committee, 8, "", { from: committee, }),
      "NotSafetyPeriod"
    );
 

  });


  it("only active claim can be challenged", async () => {
    const {registry, claimsManager } = await setup(accounts);
    const committee = accounts[1];
    const arbitrator = accounts[2];
    await registry.setDefaultArbitrator(arbitrator);
    await advanceToSafetyPeriod(registry);

    // challengeClaim will fail if no active claim exists
    await assertFunctionRaisesException(
      claimsManager.challengeClaim(web3.utils.randomHex(32), { from: accounts[2] }),
      "NoActiveClaimExists"
    );
    


    let tx = await claimsManager.submitClaim(committee, 8, "", { from: committee, });
    const claimId1 = tx.logs[0].args._claimId;
    await assertFunctionRaisesException(
      claimsManager.challengeClaim(web3.utils.randomHex(32), { from: accounts[2] }),
      "ClaimIdIsNotActive"
    );

    await claimsManager.challengeClaim(claimId1, { from: arbitrator });
    await claimsManager.dismissClaim(claimId1, { from: arbitrator });

    await assertFunctionRaisesException(
        claimsManager.challengeClaim(claimId1, { from: arbitrator }),
        "NoActiveClaimExists"
    );
  });


  it("claim can be challenged only once", async () => {
    const {registry, claimsManager } = await setup(accounts);
    const committee = accounts[1];
    const arbitrator = accounts[2];
    await registry.setDefaultArbitrator(arbitrator);
    await advanceToSafetyPeriod(registry);
    let tx = await claimsManager.submitClaim(committee, 8, "", { from: committee, });
    const claimId1 = tx.logs[0].args._claimId;
    await claimsManager.challengeClaim(claimId1, { from: arbitrator });
    // challenging claim 1 a second time will revert 
    await assertFunctionRaisesException(
        claimsManager.challengeClaim(claimId1, { from: arbitrator }),
        "ClaimAlreadyChallenged"
    );
  });

  it("will get a fresh claim id for each claim", async () => {
    const {registry, claimsManager } = await setup(accounts);
    const committee = accounts[1];
    const arbitrator = accounts[2];
    await registry.setDefaultArbitrator(arbitrator);
    await advanceToSafetyPeriod(registry);
    // submit, challenge and dimiss claim 1
    let tx = await claimsManager.submitClaim(committee, 8, "", { from: committee, });
    const claimId1 = tx.logs[0].args._claimId;
    await claimsManager.challengeClaim(claimId1, { from: arbitrator });
    await claimsManager.dismissClaim(claimId1, { from: arbitrator });
    let tx2 = await claimsManager.submitClaim(committee, 8, "", { from: committee, });
    const claimId2 = tx2.logs[0].args._claimId;
    assert.notEqual(claimId1, claimId2, "second claim id is the same as the first");
  });

  it("only active claim can be approved", async () => {
    const {committee, registry, claimsManager, arbitrator } = await setup(accounts);
   await advanceToSafetyPeriod(registry);

    // challengeClaim will fail if no active claim exists
    await assertFunctionRaisesException(
      claimsManager.approveClaim(web3.utils.randomHex(32), 8, ZERO_ADDRESS, { from: accounts[2] }),
      "NoActiveClaimExists"
    );

    let tx = await claimsManager.submitClaim(committee, 8, "", { from: committee, });
    const claimId = tx.logs[0].args._claimId;
    await assertFunctionRaisesException(
      claimsManager.approveClaim(web3.utils.randomHex(32), 8, ZERO_ADDRESS, { from: accounts[2] }),
      "ClaimIdIsNotActive"
    );

    await claimsManager.challengeClaim(claimId, { from: arbitrator });
    await claimsManager.dismissClaim(claimId, { from: arbitrator });

    await assertFunctionRaisesException(
      claimsManager.approveClaim(claimId, 8, ZERO_ADDRESS, { from: arbitrator }),
        "NoActiveClaimExists"
    );
  });

  it("only challenged claim can be approved", async () => {
    const { registry, claimsManager  } = await setup(accounts);
    await advanceToSafetyPeriod(registry);

    const claimId = await submitClaim(claimsManager, {accounts});
    await assertFunctionRaisesException(
      claimsManager.approveClaim(claimId, 8, ZERO_ADDRESS, { from: accounts[2] }),
      "UnchallengedClaimCanOnlyBeApprovedAfterChallengePeriod"
    );
  });

 
  it("only active claim can be dismissed", async () => {
    const {registry, claimsManager, arbitrator, committee } = await setup(accounts);
    await advanceToSafetyPeriod(registry);

    // challengeClaim will fail if no active claim exists
    await assertFunctionRaisesException(
      claimsManager.dismissClaim(web3.utils.randomHex(32), { from: accounts[2] }),
      "NoActiveClaimExists"
    );

    let tx = await claimsManager.submitClaim(committee, 8, "", { from: committee, });
    const claimId1 = tx.logs[0].args._claimId;
    await assertFunctionRaisesException(
      claimsManager.challengeClaim(web3.utils.randomHex(32), { from: accounts[2] }),
      "ClaimIdIsNotActive"
    );

    await claimsManager.challengeClaim(claimId1, { from: arbitrator });
    await claimsManager.approveClaim(claimId1, 1, ZERO_ADDRESS, { from: arbitrator });

    await assertFunctionRaisesException(
        claimsManager.dismissClaim(claimId1, { from: arbitrator }),
        "NoActiveClaimExists"
    );
  });

   it("only challenged claim can be dismissed", async () => {
    const { registry, claimsManager, arbitrator } = await setup(accounts);
    await advanceToSafetyPeriod(registry);

    const claimId = await submitClaim(claimsManager, {accounts});
    await assertFunctionRaisesException(
      claimsManager.dismissClaim(claimId, { from: arbitrator }),
      "OnlyCallableIfChallenged"
    );
  });
});
