const utils = require("./utils.js");
const HATArbitrator = artifacts.require("./HATArbitrator.sol");
const ERC20Mock = artifacts.require("./ERC20Mock.sol");
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

  let hatArbitrator;
  let token;

  async function setupHATArbitrator(registry) {
    token = await ERC20Mock.new("Staking", "STK");
    hatArbitrator = await HATArbitrator.new(
      accounts[2],
      accounts[3],
      token.address,
      web3.utils.toWei("1000"),
      web3.utils.toWei("100"),
      60 * 60 * 24 * 7,
      60 * 60 * 24 * 90
    );
    
    await registry.setDefaultArbitrator(hatArbitrator.address);
  }

  it("Dispute claim", async () => {
    const { registry, vault } = await setup(accounts, { setDefaultArbitrator: false });

    await setupHATArbitrator(registry);

    await advanceToSafetyPeriod(registry);

    let claimId = await submitClaim(vault, { accounts });

    await token.mint(accounts[0], web3.utils.toWei("100"));
    await token.approve(hatArbitrator.address, web3.utils.toWei("100"), { from: accounts[0] });

    await token.mint(accounts[1], web3.utils.toWei("1100"));
    await token.approve(hatArbitrator.address, web3.utils.toWei("1100"), { from: accounts[1] });

    await assertFunctionRaisesException(
      hatArbitrator.dispute(vault.address, claimId, web3.utils.toWei("99"), "desc", { from: accounts[0] }),
      "BondAmountSubmittedTooLow"
    );

    await assertFunctionRaisesException(
      hatArbitrator.dispute(vault.address, web3.utils.randomHex(32), web3.utils.toWei("100"), "desc", { from: accounts[0] }),
      "ClaimIsNotCurrentlyActiveClaim"
    );

    let tx = await hatArbitrator.dispute(vault.address, claimId, web3.utils.toWei("100"), "desc", { from: accounts[0] });

    assert.equal(tx.logs[0].event, "ClaimDisputed");
    assert.equal(tx.logs[0].args._vault, vault.address);
    assert.equal(tx.logs[0].args._claimId, claimId);
    assert.equal(tx.logs[0].args._disputer, accounts[0]);
    assert.equal(tx.logs[0].args._bondAmount, web3.utils.toWei("100"));
    assert.equal(tx.logs[0].args._descriptionHash, "desc");

    assert.equal(await hatArbitrator.totalBondsOnClaim(vault.address, claimId), web3.utils.toWei("100"));
    assert.equal(await hatArbitrator.disputersBonds(accounts[0], vault.address, claimId), web3.utils.toWei("100"));
    assert.equal(await hatArbitrator.disputersBonds(accounts[1], vault.address, claimId), web3.utils.toWei("0"));
    assert.equal((await vault.activeClaim()).challengedAt, 0);

    tx = await hatArbitrator.dispute(vault.address, claimId, web3.utils.toWei("900"), "desc2", { from: accounts[1] });
    let challengedAtTimestamp = (await web3.eth.getBlock("latest")).timestamp;

    assert.equal(tx.logs[0].event, "ClaimDisputed");
    assert.equal(tx.logs[0].args._vault, vault.address);
    assert.equal(tx.logs[0].args._claimId, claimId);
    assert.equal(tx.logs[0].args._disputer, accounts[1]);
    assert.equal(tx.logs[0].args._bondAmount, web3.utils.toWei("900"));
    assert.equal(tx.logs[0].args._descriptionHash, "desc2");

    assert.equal(await hatArbitrator.totalBondsOnClaim(vault.address, claimId), web3.utils.toWei("1000"));
    assert.equal(await hatArbitrator.disputersBonds(accounts[0], vault.address, claimId), web3.utils.toWei("100"));
    assert.equal(await hatArbitrator.disputersBonds(accounts[1], vault.address, claimId), web3.utils.toWei("900"));
    assert.equal((await vault.activeClaim()).challengedAt, challengedAtTimestamp);

    tx = await hatArbitrator.dispute(vault.address, claimId, web3.utils.toWei("100"), "desc3", { from: accounts[1] });

    assert.equal(tx.logs[0].event, "ClaimDisputed");
    assert.equal(tx.logs[0].args._vault, vault.address);
    assert.equal(tx.logs[0].args._claimId, claimId);
    assert.equal(tx.logs[0].args._disputer, accounts[1]);
    assert.equal(tx.logs[0].args._bondAmount, web3.utils.toWei("100"));
    assert.equal(tx.logs[0].args._descriptionHash, "desc3");

    assert.equal(await hatArbitrator.totalBondsOnClaim(vault.address, claimId), web3.utils.toWei("1100"));
    assert.equal(await hatArbitrator.disputersBonds(accounts[0], vault.address, claimId), web3.utils.toWei("100"));
    assert.equal(await hatArbitrator.disputersBonds(accounts[1], vault.address, claimId), web3.utils.toWei("1000"));
    assert.equal((await vault.activeClaim()).challengedAt, challengedAtTimestamp);

    await utils.increaseTime(60 * 60 * 24);

    await assertFunctionRaisesException(
      hatArbitrator.dispute(vault.address, claimId, web3.utils.toWei("100"), "desc", { from: accounts[1] }),
      "CannotSubmitMoreEvidence"
    );
  });

  it("Dismiss dispute", async () => {
    const { registry, vault } = await setup(accounts, { setDefaultArbitrator: false });

    await setupHATArbitrator(registry);

    await advanceToSafetyPeriod(registry);

    let claimId = await submitClaim(vault, { accounts });

    await token.mint(accounts[0], web3.utils.toWei("1000"));
    await token.approve(hatArbitrator.address, web3.utils.toWei("1000"), { from: accounts[0] });

    await assertFunctionRaisesException(
      hatArbitrator.dismissDispute(vault.address, claimId, "desc", { from: accounts[2] }),
      "ClaimIsNotDisputed"
    );

    await hatArbitrator.dispute(vault.address, claimId, web3.utils.toWei("1000"), "desc", { from: accounts[0] });

    await assertFunctionRaisesException(
      hatArbitrator.dismissDispute(vault.address, claimId, "desc", { from: accounts[0] }),
      "OnlyExpertCommittee"
    );

    await assertFunctionRaisesException(
      hatArbitrator.dismissDispute(vault.address, web3.utils.randomHex(32), "desc", { from: accounts[2] }),
      "ClaimIsNotCurrentlyActiveClaim"
    );

    let tx = await hatArbitrator.dismissDispute(vault.address, claimId, "desc2", { from: accounts[2] });
    let resolvedAtTimestamp = (await web3.eth.getBlock("latest")).timestamp;

    assert.equal(tx.logs[0].event, "DisputeDismissed");
    assert.equal(tx.logs[0].args._vault, vault.address);
    assert.equal(tx.logs[0].args._claimId, claimId);
    assert.equal(tx.logs[0].args._descriptionHash, "desc2");

    assert.equal(await token.balanceOf(hatArbitrator.address), web3.utils.toWei("0"));
    assert.equal(await token.balanceOf(accounts[2]), web3.utils.toWei("1000"));
    assert.equal((await hatArbitrator.resolutions(vault.address, claimId)).resolvedAt, resolvedAtTimestamp);

    let logs = await vault.getPastEvents('ApproveClaim', {
      fromBlock: (await web3.eth.getBlock("latest")).number - 1,
      toBlock: (await web3.eth.getBlock("latest")).number
    });

    assert.equal(logs[0].event, "ApproveClaim");
    assert.equal(logs[0].args._claimId, claimId);
    assert.equal(logs[0].args._committee, hatArbitrator.address);

    claimId = await submitClaim(vault, { accounts });
    await token.mint(accounts[0], web3.utils.toWei("1000"));
    await token.approve(hatArbitrator.address, web3.utils.toWei("1000"), { from: accounts[0] });
    await hatArbitrator.dispute(vault.address, claimId, web3.utils.toWei("1000"), "desc", { from: accounts[0] });
    await hatArbitrator.acceptDispute(vault.address, claimId, 5000, accounts[2], [], "desc", { from: accounts[2] });

    await assertFunctionRaisesException(
      hatArbitrator.dismissDispute(vault.address, claimId, "desc", { from: accounts[2] }),
      "AlreadyResolved"
    );
  });

  it("Accept dispute", async () => {
    const { registry, vault } = await setup(accounts, { setDefaultArbitrator: false });

    await setupHATArbitrator(registry);

    await advanceToSafetyPeriod(registry);

    let claimId = await submitClaim(vault, { accounts });

    await token.mint(accounts[0], web3.utils.toWei("1000"));
    await token.approve(hatArbitrator.address, web3.utils.toWei("1000"), { from: accounts[0] });

    await assertFunctionRaisesException(
      hatArbitrator.acceptDispute(vault.address, claimId, 5000, accounts[4], [accounts[0]], "desc2", { from: accounts[2] }),
      "ClaimIsNotDisputed"
    );

    await hatArbitrator.dispute(vault.address, claimId, web3.utils.toWei("1000"), "desc", { from: accounts[0] });

    await assertFunctionRaisesException(
      hatArbitrator.acceptDispute(vault.address, claimId, 5000, accounts[4], [accounts[0]], "desc2", { from: accounts[0] }),
      "OnlyExpertCommittee"
    );

    await assertFunctionRaisesException(
      hatArbitrator.acceptDispute(vault.address, web3.utils.randomHex(32), 5000, accounts[4], [accounts[0]], "desc2", { from: accounts[2] }),
      "ClaimIsNotCurrentlyActiveClaim"
    );

    let tx = await hatArbitrator.acceptDispute(vault.address, claimId, 5000, accounts[4], [accounts[0]], "desc2", { from: accounts[2] });
    let resolvedAtTimestamp = (await web3.eth.getBlock("latest")).timestamp;

    assert.equal(tx.logs[1].event, "DisputeAccepted");
    assert.equal(tx.logs[1].args._vault, vault.address);
    assert.equal(tx.logs[1].args._claimId, claimId);
    assert.equal(tx.logs[1].args._bountyPercentage, 5000);
    assert.equal(tx.logs[1].args._beneficiary, accounts[4]);
    assert.equal(tx.logs[1].args._descriptionHash, "desc2");

    assert.equal(tx.logs[0].event, "DisputersRefunded");
    assert.equal(tx.logs[0].args._vault, vault.address);
    assert.equal(tx.logs[0].args._claimId, claimId);
    assert.equal(tx.logs[0].args._disputers.toString(), [accounts[0]].toString());

    assert.equal((await hatArbitrator.resolutions(vault.address, claimId)).bountyPercentage.toString(), "5000");
    assert.equal((await hatArbitrator.resolutions(vault.address, claimId)).beneficiary, accounts[4]);
    assert.equal((await hatArbitrator.resolutions(vault.address, claimId)).resolvedAt, resolvedAtTimestamp);
    assert.equal(await hatArbitrator.bondClaimable(accounts[0], vault.address, claimId), true);

    await assertFunctionRaisesException(
      hatArbitrator.acceptDispute(vault.address, claimId, 5000, accounts[2], [], "desc", { from: accounts[2] }),
      "AlreadyResolved"
    );
  });
});
