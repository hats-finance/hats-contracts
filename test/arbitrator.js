const utils = require("./utils.js");
const HATTokenLock = artifacts.require("./HATTokenLock.sol");
const { contract } = require("hardhat");
const {
  setup,
  advanceToSafetyPeriod,
  submitClaim,
  assertFunctionRaisesException,
} = require("./common.js");

contract("HatVaultsRegistry Arbitrator", (accounts) => {
  it("Set arbitrator", async () => {
    const { hatVaultsRegistry } = await setup(accounts);
    await assertFunctionRaisesException(
      hatVaultsRegistry.setArbitrator(accounts[1], { from: accounts[1] }),
      "Ownable: caller is not the owner"
    );

    tx = await hatVaultsRegistry.setArbitrator(accounts[1]);

    assert.equal(await hatVaultsRegistry.arbitrator(), accounts[1]);
    assert.equal(tx.logs[0].event, "SetArbitrator");
    assert.equal(tx.logs[0].args._arbitrator, accounts[1]);
  });

  it("Set challenge period", async () => {
    const { hatVaultsRegistry } = await setup(accounts);
    await assertFunctionRaisesException(
      hatVaultsRegistry.setChallengePeriod(123, { from: accounts[1] }),
      "Ownable: caller is not the owner"
    );

    tx = await hatVaultsRegistry.setChallengePeriod(123);

    assert.equal(await hatVaultsRegistry.challengePeriod(), 123);
    assert.equal(tx.logs[0].event, "SetChallengePeriod");
    assert.equal(tx.logs[0].args._challengePeriod, 123);
  });

  it("Set challengeTimeOutPeriod", async () => {
    const { hatVaultsRegistry } = await setup(accounts);
    await assertFunctionRaisesException(
      hatVaultsRegistry.setChallengeTimeOutPeriod(123, { from: accounts[1] }),
      "Ownable: caller is not the owner"
    );

    tx = await hatVaultsRegistry.setChallengeTimeOutPeriod(123);

    assert.equal(await hatVaultsRegistry.challengeTimeOutPeriod(), 123);
    assert.equal(tx.logs[0].event, "SetChallengeTimeOutPeriod");
    assert.equal(tx.logs[0].args._challengeTimeOutPeriod, 123);
  });

  it("No challenge - approve claim", async () => {
    const { hatVaultsRegistry, vault, stakingToken } = await setup(accounts);
    // set challenge period to 1000
    hatVaultsRegistry.setChallengePeriod(1000);
    await advanceToSafetyPeriod(hatVaultsRegistry);

    const staker = accounts[1];
    await hatVaultsRegistry.setArbitrator(accounts[3]);

    // we send some funds to the vault so we can pay out later when approveClaim is called
    await stakingToken.mint(staker, web3.utils.toWei("2"));
    await stakingToken.approve(vault.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });

    let claimId = await submitClaim(vault, { accounts });

    await assertFunctionRaisesException(
      vault.approveClaim(claimId, 8000, { from: accounts[2] }),
      "ClaimCanOnlyBeApprovedAfterChallengePeriodOrByArbitrator"
    );

    await assertFunctionRaisesException(
      vault.approveClaim(claimId, 8000, { from: accounts[3] }),
      "ClaimCanOnlyBeApprovedAfterChallengePeriodOrByArbitrator"
    );

    // go and pass the challenge period
    await utils.increaseTime(2000);

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
    // set challenge period to 1000
    hatVaultsRegistry.setChallengePeriod(1000);
    await advanceToSafetyPeriod(hatVaultsRegistry);

    const staker = accounts[1];
    await hatVaultsRegistry.setArbitrator(accounts[3]);

    // we send some funds to the vault so we can pay out later when approveClaim is called
    await stakingToken.mint(staker, web3.utils.toWei("2"));
    await stakingToken.approve(vault.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });

    let claimId = await submitClaim(vault, { accounts });

    // go and pass the challenge period
    await utils.increaseTime(2000);

    // challenge period is over
    // anyone can now approve the claim, accepting the claim with the same amount is fine
    const tx = await vault.approveClaim(claimId, 1234, {
      from: accounts[3],
    });
    assert.equal(tx.logs[7].event, "ApproveClaim");
    assert.equal(tx.logs[7].args._claimId, claimId);
    assert.equal(tx.logs[7].args._bountyPercentage.toString(), "8000");
  });

  it("Arbitrator cannot challenge after challenge timeout period", async () => {
    const { hatVaultsRegistry, vault, stakingToken } = await setup(accounts);
    // set challenge period to 1000
    hatVaultsRegistry.setChallengePeriod(1000);
    hatVaultsRegistry.setChallengeTimeOutPeriod(2000);
    await advanceToSafetyPeriod(hatVaultsRegistry);

    const staker = accounts[1];
    await hatVaultsRegistry.setArbitrator(accounts[3]);

    // we send some funds to the vault so we can pay out later when approveClaim is called
    await stakingToken.mint(staker, web3.utils.toWei("2"));
    await stakingToken.approve(vault.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await vault.deposit(web3.utils.toWei("1"), staker, { from: staker });

    let claimId = await submitClaim(vault, { accounts });

    // go and pass the challenge period
    await utils.increaseTime(2000);

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
    // set challenge period to 1000
    hatVaultsRegistry.setChallengePeriod(1000);
    const owner = accounts[0];
    const staker = accounts[1];
    const arbitrator = accounts[2];
    await hatVaultsRegistry.setArbitrator(arbitrator);
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
      "ClaimCanOnlyBeApprovedAfterChallengePeriodOrByArbitrator"
    );
    await assertFunctionRaisesException(
      vault.approveClaim(claimId, 10001, { from: accounts[2] }),
      "BountyPercentageHigherThanMaxBounty"
    );

    await assertFunctionRaisesException(
      vault.approveClaim(claimId, 8001, { from: accounts[2] }),
      "BountyPercentageHigherThanMaxBounty"
    );

    await assertFunctionRaisesException(
      vault.approveClaim(claimId, 6000, { from: owner }),
      "ClaimCanOnlyBeApprovedAfterChallengePeriodOrByArbitrator"
    );

    // go and pass the challenge period
    await utils.increaseTime(2000);

    await assertFunctionRaisesException(
      vault.approveClaim(claimId, 8000, { from: owner }),
      "ClaimCanOnlyBeApprovedAfterChallengePeriodOrByArbitrator"
    );
    assert.equal((await vault.activeClaim()).bountyPercentage, 8000);
    let stakingTokenBalanceBefore = await stakingToken.balanceOf(vault.address);
    tx = await vault.approveClaim(claimId, 6000, { from: arbitrator });
    assert.equal(tx.logs[7].event, "ApproveClaim");
    assert.equal(tx.logs[7].args._claimId, claimId);
    assert.equal(tx.logs[7].args._bountyPercentage, 6000);
    assert.equal(
      (await stakingToken.balanceOf(vault.address)).toString(),
      stakingTokenBalanceBefore.sub(new web3.utils.BN(web3.utils.toWei("0.6"))).toString()
    );
    let vestingTokenLock = await HATTokenLock.at(tx.logs[7].args._tokenLock);
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

  it("challenge - dismiss claim", async () => {
    const { hatVaultsRegistry, vault } = await setup(accounts);
    // set challenge period to 1000
    hatVaultsRegistry.setChallengePeriod(1000);
    const owner = accounts[0];
    const arbitrator = accounts[1];
    await hatVaultsRegistry.setArbitrator(arbitrator);
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
});
