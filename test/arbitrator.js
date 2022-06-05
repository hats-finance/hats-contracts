const utils = require("./utils.js");
const { contract } = require("hardhat");
const {
  setup,
  advanceToSafetyPeriod,
  submitClaim,
  assertFunctionRaisesException,
} = require("./common.js");

contract("HatVaults", (accounts) => {
  it("Set arbitrator", async () => {
    const { hatVaults } = await setup(accounts);
    await assertFunctionRaisesException(
      hatVaults.setGlobalParameter("arbitrator", accounts[1], {
        from: accounts[1],
      }),
      "Ownable: caller is not the owner"
    );

    tx = await hatVaults.setGlobalParameter("arbitrator", accounts[1]);

    assert.equal(await hatVaults.arbitrator(), accounts[1]);
    assert.equal(tx.logs[0].event, "SetGlobalParameter");
    assert.equal(tx.logs[0].args._newValue, accounts[1]);
  });

  it("Set challenge period", async () => {
    const { hatVaults } = await setup(accounts);
    await assertFunctionRaisesException(
      hatVaults.setChallengePeriod(123, { from: accounts[1] }),
      "Ownable: caller is not the owner"
    );

    tx = await hatVaults.setChallengePeriod(123);

    assert.equal(await hatVaults.challengePeriod(), 123);
    assert.equal(tx.logs[0].event, "SetGlobalParameter");
    assert.equal(tx.logs[0].args._name, "challengePeriod");
    assert.equal(tx.logs[0].args._newValue, 123);
  });

  it("Set challengeTimeOutPeriod", async () => {
    const { hatVaults } = await setup(accounts);
    await assertFunctionRaisesException(
      hatVaults.setChallengeTimeOutPeriod(123, { from: accounts[1] }),
      "Ownable: caller is not the owner"
    );

    tx = await hatVaults.setChallengeTimeOutPeriod(123);

    assert.equal(await hatVaults.challengeTimeOutPeriod(), 123);
    assert.equal(tx.logs[0].event, "SetGlobalParameter");
    assert.equal(tx.logs[0].args._newValue, 123);
  });

  it("No challenge - approve claim", async () => {
    const { hatVaults, stakingToken } = await setup(accounts);
    // set challenge period to 1000
    hatVaults.setChallengePeriod(1000);
    await advanceToSafetyPeriod(hatVaults);

    const staker = accounts[1];

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

    const claim = await hatVaults.claims(claimId);
    const poolinfo = await hatVaults.poolInfos(claim.pid);
    console.log(claim);
    console.log(poolinfo);
    console.log(claim.pid);
    console.log(poolinfo.balance.toString());
    // challenge period is over
    // anyone can now approve the claim, accepting the claim with the same amount is fine
    const tx = await hatVaults.approveClaim(claimId, 1234, {
      from: accounts[2],
    });
    console.log(tx.logs[1]);
    assert.equal(tx.logs[1].event, "ApproveClaim");
    assert.equal(tx.logs[1].args._bountyPercentage.toString(), "8000");
    // TODO: check that the amount (1234) is ignored in this case
  });

  it("challenge - approve Claim ", async () => {
    const { hatVaults } = await setup(accounts);
    // set challenge period to 1000
    hatVaults.setChallengePeriod(1000);
    const owner = accounts[0];
    const staker = accounts[1];
    const arbitrator = accounts[2];
    await hatVaults.setGlobalParameter("arbitrator", arbitrator);

    await advanceToSafetyPeriod(hatVaults);

    // we send some funds to the vault so we can pay out later when approveClaim is called
    await stakingToken.mint(staker, web3.utils.toWei("2"));
    await stakingToken.approve(hatVaults.address, web3.utils.toWei("1"), {
      from: staker,
    });
    await hatVaults.deposit(0, web3.utils.toWei("1"), { from: staker });
    await hatVaults.updatePool(0);

    const claimId = await submitClaim(hatVaults, { accounts });

    // only arbitrator can challenge the claim
    assertFunctionRaisesException(
      hatVaults.challengeClaim(claimId, { from: accounts[2] }),
      "HVE47"
    );
    assertFunctionRaisesException(
      hatVaults.challengeClaim(claimId, { from: owner }),
      "HVE47"
    );
    await hatVaults.challengeClaim(claimId, { from: arbitrator });
    // now that the claim is challenged, only arbitrator can accept or dismiss
    await assertFunctionRaisesException(
      hatVaults.approveClaim(claimId, 8000, { from: staker }),
      "HVE48"
    );

    await assertFunctionRaisesException(
      hatVaults.approveClaim(claimId, 8000, { from: owner }),
      "HVE48"
    );

    await hatVaults.approveClaim(claimId, 8000, { from: arbitrator });
  });

  it("challenge - dismiss claim", async () => {
    const { hatVaults } = await setup(accounts);
    // set challenge period to 1000
    hatVaults.setChallengePeriod(1000);
    const owner = accounts[0];
    const arbitrator = accounts[1];
    await hatVaults.setGlobalParameter("arbitrator", arbitrator);
    await advanceToSafetyPeriod(hatVaults);
    const claimId = await submitClaim(hatVaults, { accounts });

    await hatVaults.challengeClaim(claimId, { from: arbitrator });
    // now that the claim is challenged, only arbitrator can accept or dismiss
    await assertFunctionRaisesException(
      hatVaults.dismissClaim(claimId, { from: accounts[2] }),
      "HVE09"
    );

    await assertFunctionRaisesException(
      hatVaults.dismissClaim(claimId, { from: owner }),
      "HVE09"
    );
    await hatVaults.dismissClaim(claimId, { from: arbitrator });
  });

  it("TO BE DONE: challenge - timeout", async () => {});
});
