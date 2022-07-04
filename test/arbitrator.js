const utils = require("./utils.js");
const HATTokenLock = artifacts.require("./HATTokenLock.sol");
const { contract } = require("hardhat");
const {
  setup,
  advanceToSafetyPeriod,
  submitClaim,
  assertFunctionRaisesException,
} = require("./common.js");

contract("HatVaults Arbitrator", (accounts) => {
  it("Set arbitrator", async () => {
    const { hatVaults } = await setup(accounts);
    await assertFunctionRaisesException(
      hatVaults.setArbitrator(accounts[1], { from: accounts[1] }),
      "Ownable: caller is not the owner"
    );

    tx = await hatVaults.setArbitrator(accounts[1]);

    assert.equal(await hatVaults.arbitrator(), accounts[1]);
    assert.equal(tx.logs[0].event, "SetArbitrator");
    assert.equal(tx.logs[0].args._arbitrator, accounts[1]);
  });

  it("Set challenge period", async () => {
    const { hatVaults } = await setup(accounts);
    await assertFunctionRaisesException(
      hatVaults.setChallengePeriod(123, { from: accounts[1] }),
      "Ownable: caller is not the owner"
    );

    tx = await hatVaults.setChallengePeriod(123);

    assert.equal(await hatVaults.challengePeriod(), 123);
    assert.equal(tx.logs[0].event, "SetChallengePeriod");
    assert.equal(tx.logs[0].args._challengePeriod, 123);
  });

  it("Set challengeTimeOutPeriod", async () => {
    const { hatVaults } = await setup(accounts);
    await assertFunctionRaisesException(
      hatVaults.setChallengeTimeOutPeriod(123, { from: accounts[1] }),
      "Ownable: caller is not the owner"
    );

    tx = await hatVaults.setChallengeTimeOutPeriod(123);

    assert.equal(await hatVaults.challengeTimeOutPeriod(), 123);
    assert.equal(tx.logs[0].event, "SetChallengeTimeOutPeriod");
    assert.equal(tx.logs[0].args._challengeTimeOutPeriod, 123);
  });

  it("No challenge - approve claim", async () => {
    const { hatVaults, stakingToken } = await setup(accounts);
    // set challenge period to 1000
    hatVaults.setChallengePeriod(1000);
    await advanceToSafetyPeriod(hatVaults);

    const staker = accounts[1];
    await hatVaults.setArbitrator(accounts[3]);

    // we send some funds to the vault so we can pay out later when approveClaim is called
    await stakingToken.mint(staker, web3.utils.toWei("2"));
    await stakingToken.approve(hatVaults.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await hatVaults.deposit(0, web3.utils.toWei("1"), { from: staker });
    await hatVaults.updatePool(0);

    const claimId = await submitClaim(hatVaults, { accounts });

    await assertFunctionRaisesException(
      hatVaults.approveClaim(claimId, 8000, { from: accounts[2] }),
      "ClaimCanOnlyBeApprovedAfterChallengePeriodOrByArbitrator"
    );

    await assertFunctionRaisesException(
      hatVaults.approveClaim(claimId, 8000, { from: accounts[3] }),
      "ClaimCanOnlyBeApprovedAfterChallengePeriodOrByArbitrator"
    );

    // go and pass the challenge period
    await utils.increaseTime(2000);

    // challenge period is over
    // anyone can now approve the claim, accepting the claim with the same amount is fine
    const tx = await hatVaults.approveClaim(claimId, 1234, {
      from: accounts[2],
    });
    assert.equal(tx.logs[1].event, "ApproveClaim");
    assert.equal(tx.logs[1].args._bountyPercentage.toString(), "8000");
  });

  it("Aribtrator can only change bounty if claim is challenged", async () => {
    const { hatVaults, stakingToken } = await setup(accounts);
    // set challenge period to 1000
    hatVaults.setChallengePeriod(1000);
    await advanceToSafetyPeriod(hatVaults);

    const staker = accounts[1];
    await hatVaults.setArbitrator(accounts[3]);

    // we send some funds to the vault so we can pay out later when approveClaim is called
    await stakingToken.mint(staker, web3.utils.toWei("2"));
    await stakingToken.approve(hatVaults.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await hatVaults.deposit(0, web3.utils.toWei("1"), { from: staker });
    await hatVaults.updatePool(0);

    const claimId = await submitClaim(hatVaults, { accounts });

    // go and pass the challenge period
    await utils.increaseTime(2000);

    // challenge period is over
    // anyone can now approve the claim, accepting the claim with the same amount is fine
    const tx = await hatVaults.approveClaim(claimId, 1234, {
      from: accounts[3],
    });
    assert.equal(tx.logs[1].event, "ApproveClaim");
    assert.equal(tx.logs[1].args._bountyPercentage.toString(), "8000");
  });

  it("Aribtrator cannot challenge after challenge period", async () => {
    const { hatVaults, stakingToken } = await setup(accounts);
    // set challenge period to 1000
    hatVaults.setChallengePeriod(1000);
    await advanceToSafetyPeriod(hatVaults);

    const staker = accounts[1];
    await hatVaults.setArbitrator(accounts[3]);

    // we send some funds to the vault so we can pay out later when approveClaim is called
    await stakingToken.mint(staker, web3.utils.toWei("2"));
    await stakingToken.approve(hatVaults.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await hatVaults.deposit(0, web3.utils.toWei("1"), { from: staker });
    await hatVaults.updatePool(0);

    const claimId = await submitClaim(hatVaults, { accounts });

    // go and pass the challenge period
    await utils.increaseTime(2000);

    await assertFunctionRaisesException(
      hatVaults.challengeClaim(claimId, { from: accounts[3] }),
      "ChallengePeriodEnded"
    );

    // challenge period is over
    // anyone can now approve the claim, accepting the claim with the same amount is fine
    const tx = await hatVaults.approveClaim(claimId, 1234, {
      from: accounts[3],
    });
    assert.equal(tx.logs[1].event, "ApproveClaim");
    assert.equal(tx.logs[1].args._bountyPercentage.toString(), "8000");
  });

  it("challenge - approve Claim ", async () => {
    const { hatVaults, stakingToken } = await setup(accounts);
    // set challenge period to 1000
    hatVaults.setChallengePeriod(1000);
    const owner = accounts[0];
    const staker = accounts[1];
    const arbitrator = accounts[2];
    await hatVaults.setArbitrator(arbitrator);
    await advanceToSafetyPeriod(hatVaults);

    // we send some funds to the vault so we can pay out later when approveClaim is called
    await stakingToken.mint(staker, web3.utils.toWei("2"));
    await stakingToken.approve(hatVaults.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await hatVaults.deposit(0, web3.utils.toWei("1"), { from: staker });
    await hatVaults.updatePool(0);

    const claimId = await submitClaim(hatVaults, { accounts });

    // challengeClaim will fail if passing an non-existent claimID
    await assertFunctionRaisesException(
      hatVaults.challengeClaim("1234", { from: accounts[2] }),
      "NoActiveClaimExists"
    );

    // only arbitrator can challenge the claim
    await assertFunctionRaisesException(
      hatVaults.challengeClaim(claimId, { from: accounts[1] }),
      "OnlyArbitrator"
    );
    await assertFunctionRaisesException(
      hatVaults.challengeClaim(claimId, { from: owner }),
      "OnlyArbitrator"
    );
    await hatVaults.challengeClaim(claimId, { from: arbitrator });
    // now that the claim is challenged, only arbitrator can accept or dismiss
    await assertFunctionRaisesException(
      hatVaults.approveClaim(claimId, 6000, { from: staker }),
      "ClaimCanOnlyBeApprovedAfterChallengePeriodOrByArbitrator"
    );
    await assertFunctionRaisesException(
      hatVaults.approveClaim(claimId, 10001, { from: accounts[2] }),
      "BountyPercentageHigherThanMaxBounty"
    );

    await assertFunctionRaisesException(
      hatVaults.approveClaim(claimId, 8001, { from: accounts[2] }),
      "BountyPercentageHigherThanMaxBounty"
    );

    await assertFunctionRaisesException(
      hatVaults.approveClaim(claimId, 6000, { from: owner }),
      "ClaimCanOnlyBeApprovedAfterChallengePeriodOrByArbitrator"
    );

    // go and pass the challenge period
    await utils.increaseTime(2000);

    await assertFunctionRaisesException(
      hatVaults.approveClaim(claimId, 8000, { from: owner }),
      "ClaimCanOnlyBeApprovedAfterChallengePeriodOrByArbitrator"
    );
    assert.equal((await hatVaults.claims(claimId)).bountyPercentage, 8000);
    var stakingTokenBalanceBefore = await stakingToken.balanceOf(hatVaults.address);
    var tx = await hatVaults.approveClaim(claimId, 6000, { from: arbitrator });
    assert.equal(tx.logs[1].event, "ApproveClaim");
    assert.equal(tx.logs[1].args._bountyPercentage, 6000);
    assert.equal(
      (await stakingToken.balanceOf(hatVaults.address)).toString(),
      stakingTokenBalanceBefore.sub(new web3.utils.BN(web3.utils.toWei("0.51"))).toString()
    );
    var vestingTokenLock = await HATTokenLock.at(tx.logs[1].args._tokenLock);
    assert.equal(await vestingTokenLock.beneficiary(), accounts[2]);
    var depositValutBNAfterClaim = new web3.utils.BN(web3.utils.toWei("0.6"));
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
  });

  it("challenge - dismiss claim", async () => {
    const { hatVaults } = await setup(accounts);
    // set challenge period to 1000
    hatVaults.setChallengePeriod(1000);
    const owner = accounts[0];
    const arbitrator = accounts[1];
    await hatVaults.setArbitrator(arbitrator);
    await advanceToSafetyPeriod(hatVaults);
    const claimId = await submitClaim(hatVaults, { accounts });

    await hatVaults.challengeClaim(claimId, { from: arbitrator });
    // now that the claim is challenged, only arbitrator can accept or dismiss
    await assertFunctionRaisesException(
      hatVaults.dismissClaim(claimId, { from: accounts[2] }),
      "OnlyCallableByArbitratorOrAfterChallengeTimeOutPeriod"
    );

    await assertFunctionRaisesException(
      hatVaults.dismissClaim(claimId, { from: owner }),
      "OnlyCallableByArbitratorOrAfterChallengeTimeOutPeriod"
    );
    await hatVaults.dismissClaim(claimId, { from: arbitrator });
  });
});
