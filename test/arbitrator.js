const utils = require("./utils.js");
const HATTokenLock = artifacts.require("./HATTokenLock.sol");
const { contract } = require("hardhat");
const {
  setup,
  advanceToSafetyPeriod,
  advanceToNonSafetyPeriod,
  submitClaim,
  assertFunctionRaisesException,
} = require("./common.js");

contract("HatVaultsRegistry Arbitrator", (accounts) => {
  it("Set arbitrator", async () => {
    const { vault } = await setup(accounts);
    await advanceToNonSafetyPeriod(hatVaultsRegistry);
    await assertFunctionRaisesException(
      vault.setArbitrator(accounts[1], { from: accounts[1] }),
      "OnlyRegistryOwner"
    );

    tx = await vault.setArbitrator(accounts[1]);

    assert.equal(await vault.arbitrator(), accounts[1]);
    assert.equal(tx.logs[0].event, "SetArbitrator");
    assert.equal(tx.logs[0].args._arbitrator, accounts[1]);
  });

  it("Set challenge period", async () => {
    const { vault } = await setup(accounts);
    await advanceToNonSafetyPeriod(hatVaultsRegistry);
    await assertFunctionRaisesException(
      vault.setChallengePeriod(60 * 60 * 24, { from: accounts[1] }),
      "OnlyRegistryOwner"
    );

    await assertFunctionRaisesException(
      vault.setChallengePeriod(60 * 60 * 24 - 1),
      "ChallengePeriodTooShort"
    );

    await assertFunctionRaisesException(
      vault.setChallengePeriod(60 * 60 * 24 * 5 + 1),
      "ChallengePeriodTooLong"
    );

    tx = await vault.setChallengePeriod(60 * 60 * 24);

    assert.equal(await vault.challengePeriod(), 60 * 60 * 24);
    assert.equal(tx.logs[0].event, "SetChallengePeriod");
    assert.equal(tx.logs[0].args._challengePeriod, 60 * 60 * 24);

    tx = await vault.setChallengePeriod(60 * 60 * 24 * 5);

    assert.equal(await vault.challengePeriod(), 60 * 60 * 24 * 5);
    assert.equal(tx.logs[0].event, "SetChallengePeriod");
    assert.equal(tx.logs[0].args._challengePeriod, 60 * 60 * 24 * 5);
  });

  it("Set challengeTimeOutPeriod", async () => {
    const { vault } = await setup(accounts);
    await advanceToNonSafetyPeriod(hatVaultsRegistry);
    await assertFunctionRaisesException(
      vault.setChallengeTimeOutPeriod(60 * 60 * 24 * 2, { from: accounts[1] }),
      "OnlyRegistryOwner"
    );

    await assertFunctionRaisesException(
      vault.setChallengeTimeOutPeriod(60 * 60 * 24 * 2 - 1),
      "ChallengeTimeOutPeriodTooShort"
    );

    await assertFunctionRaisesException(
      vault.setChallengeTimeOutPeriod(60 * 60 * 24 * 85 + 1),
      "ChallengeTimeOutPeriodTooLong"
    );

    tx = await vault.setChallengeTimeOutPeriod(60 * 60 * 24 * 2);

    assert.equal(await vault.challengeTimeOutPeriod(), 60 * 60 * 24 * 2);
    assert.equal(tx.logs[0].event, "SetChallengeTimeOutPeriod");
    assert.equal(tx.logs[0].args._challengeTimeOutPeriod, 60 * 60 * 24 * 2);

    tx = await vault.setChallengeTimeOutPeriod(60 * 60 * 24 * 85);

    assert.equal(await vault.challengeTimeOutPeriod(), 60 * 60 * 24 * 85);
    assert.equal(tx.logs[0].event, "SetChallengeTimeOutPeriod");
    assert.equal(tx.logs[0].args._challengeTimeOutPeriod, 60 * 60 * 24 * 85);
  });

  it("No challenge - approve claim", async () => {
    const { hatVaultsRegistry, vault, stakingToken } = await setup(accounts);
    await advanceToNonSafetyPeriod(hatVaultsRegistry);
    // set challenge period to 1 day
    vault.setChallengePeriod(60 * 60 * 24);

    const staker = accounts[1];
    await vault.setArbitrator(accounts[3]);

    // we send some funds to the vault so we can pay out later when approveClaim is called
    await stakingToken.mint(staker, web3.utils.toWei("2"));
    await stakingToken.approve(vault.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });

    await advanceToSafetyPeriod(hatVaultsRegistry);

    let claimId = await submitClaim(vault, { accounts });

    await assertFunctionRaisesException(
      vault.approveClaim(claimId, 8000, { from: accounts[2] }),
      "UnchallengedClaimCanOnlyBeApprovedAfterChallengePeriod"
    );

    await assertFunctionRaisesException(
      vault.approveClaim(claimId, 8000, { from: accounts[3] }),
      "UnchallengedClaimCanOnlyBeApprovedAfterChallengePeriod"
    );

    // go and pass the challenge period
    await utils.increaseTime(60 * 60 * 24);

    // challenge period is over
    // anyone can now approve the claim, accepting the claim with the same amount is fine
    const tx = await vault.approveClaim(claimId, 1234, {
      from: accounts[2],
    });

    assert.equal(tx.logs[7].event, "ApproveClaim");
    assert.equal(tx.logs[7].args._claimId, claimId);
    assert.equal(tx.logs[7].args._bountyPercentage.toString(), "8000");
  });

  it("Arbitrator can only change bounty if claim is challenged", async () => {
    const { hatVaultsRegistry, vault, stakingToken } = await setup(accounts);
    await advanceToNonSafetyPeriod(hatVaultsRegistry);
    // set challenge period to one day
    vault.setChallengePeriod(60 * 60 * 24);

    const staker = accounts[1];
    await vault.setArbitrator(accounts[3]);

    // we send some funds to the vault so we can pay out later when approveClaim is called
    await stakingToken.mint(staker, web3.utils.toWei("2"));
    await stakingToken.approve(vault.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });

    await advanceToSafetyPeriod(hatVaultsRegistry);

    let claimId = await submitClaim(vault, { accounts });

    // go and pass the challenge period
    await utils.increaseTime(60 * 60 * 24);

    // challenge period is over
    // anyone can now approve the claim, accepting the claim with the same amount is fine
    const tx = await vault.approveClaim(claimId, 1234, {
      from: accounts[3],
    });
    assert.equal(tx.logs[7].event, "ApproveClaim");
    assert.equal(tx.logs[7].args._claimId, claimId);
    assert.equal(tx.logs[7].args._bountyPercentage.toString(), "8000");
  });

  it("Arbitrator cannot challenge after challenge period", async () => {
    const { hatVaultsRegistry, vault, stakingToken } = await setup(accounts);
    await advanceToNonSafetyPeriod(hatVaultsRegistry);
    // set challenge period to one day
    vault.setChallengePeriod(60 * 60 * 24);

    const staker = accounts[1];
    await vault.setArbitrator(accounts[3]);

    // we send some funds to the vault so we can pay out later when approveClaim is called
    await stakingToken.mint(staker, web3.utils.toWei("2"));
    await stakingToken.approve(vault.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });

    await advanceToSafetyPeriod(hatVaultsRegistry);

    let claimId = await submitClaim(vault, { accounts });

    // go and pass the challenge period
    await utils.increaseTime(60 * 60 * 24);

    await assertFunctionRaisesException(
      vault.challengeClaim(claimId, { from: accounts[3] }),
      "ChallengePeriodEnded"
    );

    // challenge period is over
    // anyone can now approve the claim, accepting the claim with the same amount is fine
    const tx = await vault.approveClaim(claimId, 1234, {
      from: accounts[3],
    });
    assert.equal(tx.logs[7].event, "ApproveClaim");
    assert.equal(tx.logs[7].args._claimId, claimId);
    assert.equal(tx.logs[7].args._bountyPercentage.toString(), "8000");
  });

  it("challenge - approve Claim ", async () => {
    const { hatVaultsRegistry, vault, stakingToken } = await setup(accounts);
    // set challenge period to one day
    vault.setChallengePeriod(60 * 60 * 24);
    const owner = accounts[0];
    const staker = accounts[1];
    const arbitrator = accounts[2];
    await vault.setArbitrator(arbitrator);
    await advanceToSafetyPeriod(hatVaultsRegistry);

    // we send some funds to the vault so we can pay out later when approveClaim is called
    await stakingToken.mint(staker, web3.utils.toWei("2"));
    await stakingToken.approve(vault.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });

    // challengeClaim will fail if no active claim exists
    await assertFunctionRaisesException(
      vault.challengeClaim(web3.utils.randomHex(32), { from: accounts[2] }),
      "NoActiveClaimExists"
    );

    let claimId = await submitClaim(vault, { accounts });

    // challengeClaim will fail if no active claim exists
    await assertFunctionRaisesException(
      vault.challengeClaim(web3.utils.randomHex(32), { from: accounts[2] }),
      "WrongClaimId"
    );

    // only arbitrator can challenge the claim
    await assertFunctionRaisesException(
      vault.challengeClaim(claimId, { from: accounts[1] }),
      "OnlyArbitrator"
    );
    await assertFunctionRaisesException(
      vault.challengeClaim(claimId, { from: owner }),
      "OnlyArbitrator"
    );
    let tx = await vault.challengeClaim(claimId, { from: arbitrator });
    assert.equal(tx.logs[0].event, "ChallengeClaim");
    assert.equal(tx.logs[0].args._claimId, claimId);

    // now that the claim is challenged, only arbitrator can accept or dismiss
    await assertFunctionRaisesException(
      vault.approveClaim(claimId, 6000, { from: staker }),
      "ChallengedClaimCanOnlyBeApprovedByArbitratorUntilChallengeTimeoutPeriod"
    );
    await assertFunctionRaisesException(
      vault.approveClaim(claimId, 10001, { from: arbitrator }),
      "BountyPercentageHigherThanMaxBounty"
    );

    await assertFunctionRaisesException(
      vault.approveClaim(claimId, 8001, { from: arbitrator }),
      "BountyPercentageHigherThanMaxBounty"
    );

    await assertFunctionRaisesException(
      vault.approveClaim(claimId, 6000, { from: owner }),
      "ChallengedClaimCanOnlyBeApprovedByArbitratorUntilChallengeTimeoutPeriod"
    );

    // go and pass the challenge period
    await utils.increaseTime(60 * 60 * 24);

    await assertFunctionRaisesException(
      vault.approveClaim(claimId, 8000, { from: owner }),
      "ChallengedClaimCanOnlyBeApprovedByArbitratorUntilChallengeTimeoutPeriod"
    );
    assert.equal((await vault.activeClaim()).bountyPercentage, 8000);
    var stakingTokenBalanceBefore = await stakingToken.balanceOf(vault.address);
    tx = await vault.approveClaim(claimId, 6000, { from: arbitrator });
    assert.equal(tx.logs[7].event, "ApproveClaim");
    assert.equal(tx.logs[7].args._claimId, claimId);
    assert.equal(tx.logs[7].args._bountyPercentage, 6000);
    assert.equal(
      (await stakingToken.balanceOf(vault.address)).toString(),
      stakingTokenBalanceBefore.sub(new web3.utils.BN(web3.utils.toWei("0.6"))).toString()
    );
    var vestingTokenLock = await HATTokenLock.at(tx.logs[7].args._tokenLock);
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
      new web3.utils.BN(tx.logs[7].args._claimBounty.hackerVested).eq(
        expectedHackerBalance
      )
    );
    assert.isTrue(
      expectedHackerBalance.eq(await vestingTokenLock.managedAmount())
    );
  });

  it("challenge - dismiss claim by arbitrator", async () => {
    const { hatVaultsRegistry, vault } = await setup(accounts);
    // set challenge period to one day
    vault.setChallengePeriod(60 * 60 * 24);
    const owner = accounts[0];
    const arbitrator = accounts[1];
    await vault.setArbitrator(arbitrator);
    await advanceToSafetyPeriod(hatVaultsRegistry);
    let claimId = await submitClaim(vault, { accounts });

    await assertFunctionRaisesException(
      vault.dismissClaim(claimId, { from: arbitrator }),
      "OnlyCallableIfChallenged"
    );

    await vault.challengeClaim(claimId, { from: arbitrator });
    // now that the claim is challenged, only arbitrator can accept or dismiss
    await assertFunctionRaisesException(
      vault.dismissClaim(claimId, { from: accounts[2] }),
      "OnlyCallableByArbitratorOrAfterChallengeTimeOutPeriod"
    );

    await assertFunctionRaisesException(
      vault.dismissClaim(claimId, { from: owner }),
      "OnlyCallableByArbitratorOrAfterChallengeTimeOutPeriod"
    );
    tx = await vault.dismissClaim(claimId, { from: arbitrator });
    assert.equal(tx.logs[0].event, "DismissClaim");
    assert.equal(tx.logs[0].args._claimId, claimId);
  });

  it("challenge - dismiss claim by anyone after timeout", async () => {
    const { hatVaultsRegistry, vault } = await setup(accounts);
    // set challenge period to one day
    vault.setChallengePeriod(60 * 60 * 24);
    vault.setChallengeTimeOutPeriod(60 * 60 * 24 * 2);
    const owner = accounts[0];
    const arbitrator = accounts[1];
    await vault.setArbitrator(arbitrator);
    await advanceToSafetyPeriod(hatVaultsRegistry);
    let claimId = await submitClaim(vault, { accounts });

    await assertFunctionRaisesException(
      vault.dismissClaim(claimId, { from: arbitrator }),
      "OnlyCallableIfChallenged"
    );

    await vault.challengeClaim(claimId, { from: arbitrator });
    // now that the claim is challenged, only arbitrator can accept or dismiss
    await assertFunctionRaisesException(
      vault.dismissClaim(claimId, { from: accounts[2] }),
      "OnlyCallableByArbitratorOrAfterChallengeTimeOutPeriod"
    );

    await assertFunctionRaisesException(
      vault.dismissClaim(claimId, { from: owner }),
      "OnlyCallableByArbitratorOrAfterChallengeTimeOutPeriod"
    );

    await utils.increaseTime(60 * 60 * 24 * 2);

    await assertFunctionRaisesException(
      vault.approveClaim(claimId, 8000, { from: owner }),
      "ChallengedClaimCanOnlyBeApprovedByArbitratorUntilChallengeTimeoutPeriod"
    );

    await assertFunctionRaisesException(
      vault.approveClaim(claimId, 8000, { from: arbitrator }),
      "ChallengedClaimCanOnlyBeApprovedByArbitratorUntilChallengeTimeoutPeriod"
    );

    await vault.dismissClaim(claimId, { from: owner });
  });

});
