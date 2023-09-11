const utils = require("./utils.js");
const ERC20Mock = artifacts.require("./ERC20Mock.sol");
const { contract, web3 } = require("hardhat");
const {
  setup,
  advanceToSafetyPeriod,
  submitClaim,
  assertFunctionRaisesException,
  ZERO_ADDRESS,
} = require("./common.js");
const { assert } = require("chai");

contract("Registry Arbitrator", (accounts) => {

  let hatArbitrator;
  let klerosConnector;
  let token;
  let expertCommittee = accounts[8];

  async function setupHATArbitrator(registry, vault) {
    token = await ERC20Mock.new("Staking", "STK");
    
    const HATArbitrator = artifacts.require("./HATArbitrator.sol");
    hatArbitrator = await HATArbitrator.new(
      expertCommittee,
      token.address,
      web3.utils.toWei("1000"),
      web3.utils.toWei("100"),
      60 * 60 * 24 * 7,
      60 * 60 * 24 * 90
    );

    const Arbitrator = await ethers.getContractFactory("AutoAppealableArbitrator");
    const arbitrator = await Arbitrator.deploy(1000);
    const KlerosConnector = await ethers.getContractFactory("HATKlerosConnectorMock");
    klerosConnector = await KlerosConnector.deploy(
      arbitrator.address,
      "0x85",
      hatArbitrator.address,
      "ipfs/",
      3000,
      7000
    );

    await hatArbitrator.setCourt(klerosConnector.address);
    
    await registry.setDefaultArbitrator(hatArbitrator.address);
    await vault.setArbitratorOptions(true, true, true);
  }

  async function makeClaimExpire(vault) {
    await utils.increaseTime(parseInt((await vault.activeClaim()).challengePeriod.toString()));
    await utils.increaseTime(parseInt((await vault.activeClaim()).challengeTimeOutPeriod.toString()));
  }

  it("Set court", async () => {
    token = await ERC20Mock.new("Staking", "STK");

    const HATArbitrator = artifacts.require("./HATArbitrator.sol");
    hatArbitrator = await HATArbitrator.new(
      expertCommittee,
      token.address,
      web3.utils.toWei("1000"),
      web3.utils.toWei("100"),
      60 * 60 * 24 * 7,
      60 * 60 * 24 * 90
    );
 
    await assertFunctionRaisesException(
      hatArbitrator.setCourt(accounts[2], { from: accounts[1] }),
      "Ownable: caller is not the owner"
    );

    await assertFunctionRaisesException(
      hatArbitrator.setCourt(ZERO_ADDRESS),
      "CourtCannotBeZero"
    );

    let tx = await hatArbitrator.setCourt(accounts[2]);

    assert.equal(tx.logs[0].event, "CourtSet");
    assert.equal(tx.logs[0].args._court, accounts[2]);

    assert.equal(await hatArbitrator.court(), accounts[2]);

    await assertFunctionRaisesException(
      hatArbitrator.setCourt(accounts[9]),
      "CannontChangeCourtAddress"
    );
  });

  it("Dispute claim", async () => {
    const { registry, vault } = await setup(accounts, { setDefaultArbitrator: false });

    await setupHATArbitrator(registry, vault);

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

    await setupHATArbitrator(registry, vault);

    await advanceToSafetyPeriod(registry);

    let claimId = await submitClaim(vault, { accounts });

    await token.mint(accounts[0], web3.utils.toWei("1000"));
    await token.approve(hatArbitrator.address, web3.utils.toWei("1000"), { from: accounts[0] });

    await assertFunctionRaisesException(
      hatArbitrator.dismissDispute(vault.address, claimId, "desc", { from: expertCommittee }),
      "ClaimIsNotDisputed"
    );

    await hatArbitrator.dispute(vault.address, claimId, web3.utils.toWei("1000"), "desc", { from: accounts[0] });

    await assertFunctionRaisesException(
      hatArbitrator.dismissDispute(vault.address, claimId, "desc", { from: accounts[0] }),
      "OnlyExpertCommittee"
    );

    await assertFunctionRaisesException(
      hatArbitrator.dismissDispute(vault.address, web3.utils.randomHex(32), "desc", { from: expertCommittee }),
      "ClaimIsNotCurrentlyActiveClaim"
    );

    let tx = await hatArbitrator.dismissDispute(vault.address, claimId, "desc2", { from: expertCommittee });
    let resolvedAtTimestamp = (await web3.eth.getBlock("latest")).timestamp;

    assert.equal(tx.logs[0].event, "DisputeDismissed");
    assert.equal(tx.logs[0].args._vault, vault.address);
    assert.equal(tx.logs[0].args._claimId, claimId);
    assert.equal(tx.logs[0].args._descriptionHash, "desc2");

    assert.equal(await token.balanceOf(hatArbitrator.address), web3.utils.toWei("0"));
    assert.equal(await token.balanceOf(expertCommittee), web3.utils.toWei("1000"));
    assert.equal((await hatArbitrator.resolutions(vault.address, claimId)).resolvedAt, resolvedAtTimestamp);

    let logs = await vault.getPastEvents('ApproveClaim', {
      fromBlock: (await web3.eth.getBlock("latest")).number - 1,
      toBlock: (await web3.eth.getBlock("latest")).number
    });

    assert.equal(logs[0].event, "ApproveClaim");
    assert.equal(logs[0].args._claimId, claimId);
    assert.equal(logs[0].args._approver, hatArbitrator.address);

    claimId = await submitClaim(vault, { accounts });
    await token.mint(accounts[0], web3.utils.toWei("1000"));
    await token.approve(hatArbitrator.address, web3.utils.toWei("1000"), { from: accounts[0] });
    await hatArbitrator.dispute(vault.address, claimId, web3.utils.toWei("1000"), "desc", { from: accounts[0] });
    await hatArbitrator.acceptDispute(vault.address, claimId, 5000, accounts[2], [], [], "desc", { from: expertCommittee });

    await assertFunctionRaisesException(
      hatArbitrator.dismissDispute(vault.address, claimId, "desc", { from: expertCommittee }),
      "AlreadyResolved"
    );

    await makeClaimExpire(vault);

    await assertFunctionRaisesException(
      hatArbitrator.dismissDispute(vault.address, claimId, "desc", { from: expertCommittee }),
      "ClaimExpired"
    );
  });

  it("Accept dispute", async () => {
    const { registry, vault } = await setup(accounts, { setDefaultArbitrator: false });

    await setupHATArbitrator(registry, vault);

    await advanceToSafetyPeriod(registry);

    let claimId = await submitClaim(vault, { accounts });

    await token.mint(accounts[0], web3.utils.toWei("1000"));
    await token.approve(hatArbitrator.address, web3.utils.toWei("1000"), { from: accounts[0] });

    await token.mint(accounts[1], web3.utils.toWei("500"));
    await token.approve(hatArbitrator.address, web3.utils.toWei("500"), { from: accounts[1] });

    await assertFunctionRaisesException(
      hatArbitrator.acceptDispute(vault.address, claimId, 5000, accounts[4], [accounts[0]], [], "desc2", { from: expertCommittee }),
      "ClaimIsNotDisputed"
    );

    await hatArbitrator.dispute(vault.address, claimId, web3.utils.toWei("1000"), "desc", { from: accounts[0] });
    await hatArbitrator.dispute(vault.address, claimId, web3.utils.toWei("500"), "desc", { from: accounts[1] });

    await assertFunctionRaisesException(
      hatArbitrator.acceptDispute(vault.address, claimId, 5000, accounts[4], [accounts[0]], [], "desc2", { from: accounts[0] }),
      "OnlyExpertCommittee"
    );

    await assertFunctionRaisesException(
      hatArbitrator.acceptDispute(vault.address, web3.utils.randomHex(32), 5000, accounts[4], [accounts[0]], [], "desc2", { from: expertCommittee }),
      "ClaimIsNotCurrentlyActiveClaim"
    );

    let tx = await hatArbitrator.acceptDispute(vault.address, claimId, 5000, accounts[4], [accounts[0]], [accounts[1]], "desc2", { from: expertCommittee });
    let resolvedAtTimestamp = (await web3.eth.getBlock("latest")).timestamp;

    assert.equal(tx.logs[2].event, "DisputeAccepted");
    assert.equal(tx.logs[2].args._vault, vault.address);
    assert.equal(tx.logs[2].args._claimId, claimId);
    assert.equal(tx.logs[2].args._bountyPercentage, 5000);
    assert.equal(tx.logs[2].args._beneficiary, accounts[4]);
    assert.equal(tx.logs[2].args._descriptionHash, "desc2");

    assert.equal(tx.logs[0].event, "DisputersRefunded");
    assert.equal(tx.logs[0].args._vault, vault.address);
    assert.equal(tx.logs[0].args._claimId, claimId);
    assert.equal(tx.logs[0].args._disputers.toString(), [accounts[0]].toString());

    assert.equal(tx.logs[1].event, "DisputersConfiscated");
    assert.equal(tx.logs[1].args._vault, vault.address);
    assert.equal(tx.logs[1].args._claimId, claimId);
    assert.equal(tx.logs[1].args._disputers.toString(), [accounts[1]].toString());

    assert.equal((await hatArbitrator.resolutions(vault.address, claimId)).bountyPercentage.toString(), "5000");
    assert.equal((await hatArbitrator.resolutions(vault.address, claimId)).beneficiary, accounts[4]);
    assert.equal((await hatArbitrator.resolutions(vault.address, claimId)).resolvedAt, resolvedAtTimestamp);
    assert.equal(await hatArbitrator.bondClaimable(accounts[0], vault.address, claimId), true);
    assert.equal(await hatArbitrator.bondClaimable(accounts[1], vault.address, claimId), false);
    assert.equal(await hatArbitrator.disputersBonds(accounts[0], vault.address, claimId), web3.utils.toWei("1000"));
    assert.equal(await hatArbitrator.disputersBonds(accounts[1], vault.address, claimId), web3.utils.toWei("0"));

    await assertFunctionRaisesException(
      hatArbitrator.acceptDispute(vault.address, claimId, 5000, accounts[2], [], [], "desc", { from: expertCommittee }),
      "AlreadyResolved"
    );

    await makeClaimExpire(vault);

    await assertFunctionRaisesException(
      hatArbitrator.acceptDispute(vault.address, claimId, 5000, accounts[2], [], [], "desc", { from: expertCommittee }),
      "ClaimExpired"
    );
  });

  it("Refund disputers", async () => {
    const { registry, vault } = await setup(accounts, { setDefaultArbitrator: false });

    await setupHATArbitrator(registry, vault);

    await advanceToSafetyPeriod(registry);

    let claimId = await submitClaim(vault, { accounts });

    await token.mint(accounts[0], web3.utils.toWei("200"));
    await token.approve(hatArbitrator.address, web3.utils.toWei("200"), { from: accounts[0] });
    await token.mint(accounts[1], web3.utils.toWei("300"));
    await token.approve(hatArbitrator.address, web3.utils.toWei("300"), { from: accounts[1] });
    await token.mint(accounts[2], web3.utils.toWei("500"));
    await token.approve(hatArbitrator.address, web3.utils.toWei("500"), { from: accounts[2] });

    await assertFunctionRaisesException(
      hatArbitrator.refundDisputers(vault.address, claimId, [accounts[0]], { from: expertCommittee }),
      "ClaimIsNotDisputed"
    );

    await hatArbitrator.dispute(vault.address, claimId, web3.utils.toWei("200"), "desc", { from: accounts[0] });
    await hatArbitrator.dispute(vault.address, claimId, web3.utils.toWei("300"), "desc", { from: accounts[1] });
    await hatArbitrator.dispute(vault.address, claimId, web3.utils.toWei("500"), "desc", { from: accounts[2] });

    await assertFunctionRaisesException(
      hatArbitrator.refundDisputers(vault.address, claimId, [accounts[0]], { from: accounts[0] }),
      "OnlyExpertCommittee"
    );

    await assertFunctionRaisesException(
      hatArbitrator.refundDisputers(vault.address, web3.utils.randomHex(32), [accounts[0]], { from: expertCommittee }),
      "ClaimIsNotCurrentlyActiveClaim"
    );

    await assertFunctionRaisesException(
      hatArbitrator.refundDisputers(vault.address, claimId, [accounts[0]], { from: expertCommittee }),
      "NoResolution"
    );


    let tx = await hatArbitrator.acceptDispute(vault.address, claimId, 5000, accounts[4], [accounts[0]], [], "desc2", { from: expertCommittee });

    assert.equal(tx.logs[0].event, "DisputersRefunded");
    assert.equal(tx.logs[0].args._vault, vault.address);
    assert.equal(tx.logs[0].args._claimId, claimId);
    assert.equal(tx.logs[0].args._disputers.toString(), [accounts[0]].toString());

    assert.equal(await hatArbitrator.bondClaimable(accounts[0], vault.address, claimId), true);
    assert.equal(await hatArbitrator.bondClaimable(accounts[1], vault.address, claimId), false);
    assert.equal(await hatArbitrator.bondClaimable(accounts[2], vault.address, claimId), false);

    tx = await hatArbitrator.refundDisputers(vault.address, claimId, [accounts[2]], { from: expertCommittee });

    assert.equal(tx.logs[0].event, "DisputersRefunded");
    assert.equal(tx.logs[0].args._vault, vault.address);
    assert.equal(tx.logs[0].args._claimId, claimId);
    assert.equal(tx.logs[0].args._disputers.toString(), [accounts[2]].toString());

    assert.equal(await hatArbitrator.bondClaimable(accounts[0], vault.address, claimId), true);
    assert.equal(await hatArbitrator.bondClaimable(accounts[1], vault.address, claimId), false);
    assert.equal(await hatArbitrator.bondClaimable(accounts[2], vault.address, claimId), true);

    await makeClaimExpire(vault);

    await assertFunctionRaisesException(
      hatArbitrator.refundDisputers(vault.address, claimId, [accounts[0]], { from: expertCommittee }),
      "ClaimExpired"
    );
  });

  it("Confiscate disputers", async () => {
    const { registry, vault } = await setup(accounts, { setDefaultArbitrator: false });

    await setupHATArbitrator(registry, vault);

    await advanceToSafetyPeriod(registry);

    let claimId = await submitClaim(vault, { accounts });

    await token.mint(accounts[0], web3.utils.toWei("200"));
    await token.approve(hatArbitrator.address, web3.utils.toWei("200"), { from: accounts[0] });
    await token.mint(accounts[1], web3.utils.toWei("300"));
    await token.approve(hatArbitrator.address, web3.utils.toWei("300"), { from: accounts[1] });
    await token.mint(accounts[2], web3.utils.toWei("500"));
    await token.approve(hatArbitrator.address, web3.utils.toWei("500"), { from: accounts[2] });

    await assertFunctionRaisesException(
      hatArbitrator.confiscateDisputers(vault.address, claimId, [accounts[0]], { from: expertCommittee }),
      "ClaimIsNotDisputed"
    );

    await hatArbitrator.dispute(vault.address, claimId, web3.utils.toWei("200"), "desc", { from: accounts[0] });
    await hatArbitrator.dispute(vault.address, claimId, web3.utils.toWei("300"), "desc", { from: accounts[1] });
    await hatArbitrator.dispute(vault.address, claimId, web3.utils.toWei("500"), "desc", { from: accounts[2] });

    await assertFunctionRaisesException(
      hatArbitrator.confiscateDisputers(vault.address, claimId, [accounts[0]], { from: accounts[0] }),
      "OnlyExpertCommittee"
    );

    await assertFunctionRaisesException(
      hatArbitrator.confiscateDisputers(vault.address, web3.utils.randomHex(32), [accounts[0]], { from: expertCommittee }),
      "ClaimIsNotCurrentlyActiveClaim"
    );

    await assertFunctionRaisesException(
      hatArbitrator.confiscateDisputers(vault.address, claimId, [accounts[0]], { from: expertCommittee }),
      "NoResolution"
    );

    let tx = await hatArbitrator.acceptDispute(vault.address, claimId, 5000, accounts[4], [], [accounts[0]], "desc2", { from: expertCommittee });

    assert.equal(tx.logs[1].event, "DisputersConfiscated");
    assert.equal(tx.logs[1].args._vault, vault.address);
    assert.equal(tx.logs[1].args._claimId, claimId);
    assert.equal(tx.logs[1].args._disputers.toString(), [accounts[0]].toString());

    assert.equal(await hatArbitrator.bondClaimable(accounts[0], vault.address, claimId), false);
    assert.equal(await hatArbitrator.bondClaimable(accounts[1], vault.address, claimId), false);
    assert.equal(await hatArbitrator.bondClaimable(accounts[2], vault.address, claimId), false);

    assert.equal(await hatArbitrator.disputersBonds(accounts[0], vault.address, claimId), web3.utils.toWei("0"));
    assert.equal(await hatArbitrator.disputersBonds(accounts[1], vault.address, claimId), web3.utils.toWei("300"));
    assert.equal(await hatArbitrator.disputersBonds(accounts[2], vault.address, claimId), web3.utils.toWei("500"));
    assert.equal(await token.balanceOf(expertCommittee), web3.utils.toWei("200"));


    tx = await hatArbitrator.confiscateDisputers(vault.address, claimId, [accounts[1], accounts[2]], { from: expertCommittee });

    assert.equal(tx.logs[0].event, "DisputersConfiscated");
    assert.equal(tx.logs[0].args._vault, vault.address);
    assert.equal(tx.logs[0].args._claimId, claimId);
    assert.equal(tx.logs[0].args._disputers.toString(), [accounts[1], accounts[2]].toString());

    assert.equal(await hatArbitrator.bondClaimable(accounts[0], vault.address, claimId), false);
    assert.equal(await hatArbitrator.bondClaimable(accounts[1], vault.address, claimId), false);
    assert.equal(await hatArbitrator.bondClaimable(accounts[2], vault.address, claimId), false);
    assert.equal(await hatArbitrator.disputersBonds(accounts[0], vault.address, claimId), web3.utils.toWei("0"));
    assert.equal(await hatArbitrator.disputersBonds(accounts[1], vault.address, claimId), web3.utils.toWei("0"));
    assert.equal(await hatArbitrator.disputersBonds(accounts[2], vault.address, claimId), web3.utils.toWei("0"));

    assert.equal(await token.balanceOf(expertCommittee), web3.utils.toWei("1000"));

    await makeClaimExpire(vault);

    await assertFunctionRaisesException(
      hatArbitrator.confiscateDisputers(vault.address, claimId, [accounts[0]], { from: expertCommittee }),
      "ClaimExpired"
    );
  });

  it("Refund bond", async () => {
    const { registry, vault } = await setup(accounts, { setDefaultArbitrator: false });

    await setupHATArbitrator(registry, vault);

    await advanceToSafetyPeriod(registry);

    let claimId = await submitClaim(vault, { accounts });

    await token.mint(accounts[0], web3.utils.toWei("200"));
    await token.approve(hatArbitrator.address, web3.utils.toWei("200"), { from: accounts[0] });
    await token.mint(accounts[1], web3.utils.toWei("300"));
    await token.approve(hatArbitrator.address, web3.utils.toWei("300"), { from: accounts[1] });
    await token.mint(accounts[2], web3.utils.toWei("500"));
    await token.approve(hatArbitrator.address, web3.utils.toWei("500"), { from: accounts[2] });

    await hatArbitrator.dispute(vault.address, claimId, web3.utils.toWei("200"), "desc", { from: accounts[0] });
    await hatArbitrator.dispute(vault.address, claimId, web3.utils.toWei("300"), "desc", { from: accounts[1] });
    await hatArbitrator.dispute(vault.address, claimId, web3.utils.toWei("500"), "desc", { from: accounts[2] });

    await hatArbitrator.acceptDispute(vault.address, claimId, 5000, accounts[4], [accounts[0]], [], "desc2", { from: expertCommittee });

    assert.equal(await hatArbitrator.bondClaimable(accounts[0], vault.address, claimId), true);
    assert.equal(await hatArbitrator.bondClaimable(accounts[1], vault.address, claimId), false);
    assert.equal(await hatArbitrator.bondClaimable(accounts[2], vault.address, claimId), false);

    await assertFunctionRaisesException(
      hatArbitrator.reclaimBond(vault.address, claimId, { from: expertCommittee }),
      "CannotClaimBond"
    );

    let tx = await hatArbitrator.reclaimBond(vault.address, claimId, { from: accounts[0] });

    assert.equal(tx.logs[0].event, "BondRefundClaimed");
    assert.equal(tx.logs[0].args._vault, vault.address);
    assert.equal(tx.logs[0].args._claimId, claimId);
    assert.equal(tx.logs[0].args._disputer, accounts[0]);
    assert.equal(tx.logs[0].args._amountClaimed, web3.utils.toWei("200"));
    
    assert.equal(await hatArbitrator.disputersBonds(accounts[0], vault.address, claimId), web3.utils.toWei("0"));
    assert.equal(await hatArbitrator.bondClaimable(accounts[0], vault.address, claimId), false);
    assert.equal(await token.balanceOf(accounts[0]), web3.utils.toWei("200"));

    await assertFunctionRaisesException(
      hatArbitrator.reclaimBond(vault.address, claimId, { from: accounts[0] }),
      "CannotClaimBond"
    );

    await hatArbitrator.refundDisputers(vault.address, claimId, [accounts[2]], { from: expertCommittee });

    assert.equal(await hatArbitrator.bondClaimable(accounts[0], vault.address, claimId), false);
    assert.equal(await hatArbitrator.bondClaimable(accounts[1], vault.address, claimId), false);
    assert.equal(await hatArbitrator.bondClaimable(accounts[2], vault.address, claimId), true);

    tx = await hatArbitrator.reclaimBond(vault.address, claimId, { from: accounts[2] });

    assert.equal(tx.logs[0].event, "BondRefundClaimed");
    assert.equal(tx.logs[0].args._vault, vault.address);
    assert.equal(tx.logs[0].args._claimId, claimId);
    assert.equal(tx.logs[0].args._disputer, accounts[2]);
    assert.equal(tx.logs[0].args._amountClaimed, web3.utils.toWei("500"));
    
    assert.equal(await hatArbitrator.disputersBonds(accounts[2], vault.address, claimId), web3.utils.toWei("0"));
    assert.equal(await hatArbitrator.bondClaimable(accounts[2], vault.address, claimId), false);
    assert.equal(await token.balanceOf(accounts[2]), web3.utils.toWei("500"));

    await assertFunctionRaisesException(
      hatArbitrator.reclaimBond(vault.address, claimId, { from: accounts[1] }),
      "CannotClaimBond"
    );

    await makeClaimExpire(vault);
    
    tx = await hatArbitrator.reclaimBond(vault.address, claimId, { from: accounts[1] });

    assert.equal(tx.logs[0].event, "BondRefundClaimed");
    assert.equal(tx.logs[0].args._vault, vault.address);
    assert.equal(tx.logs[0].args._claimId, claimId);
    assert.equal(tx.logs[0].args._disputer, accounts[1]);
    assert.equal(tx.logs[0].args._amountClaimed, web3.utils.toWei("300"));
    
    assert.equal(await hatArbitrator.disputersBonds(accounts[1], vault.address, claimId), web3.utils.toWei("0"));
    assert.equal(await hatArbitrator.bondClaimable(accounts[1], vault.address, claimId), false);
    assert.equal(await token.balanceOf(accounts[1]), web3.utils.toWei("300"));

    await vault.dismissClaim(claimId);
    claimId = await submitClaim(vault, { accounts });

    await token.mint(accounts[3], web3.utils.toWei("200"));
    await token.approve(hatArbitrator.address, web3.utils.toWei("200"), { from: accounts[3] });

    await hatArbitrator.dispute(vault.address, claimId, web3.utils.toWei("200"), "desc", { from: accounts[3] });

    await makeClaimExpire(vault);

    tx = await hatArbitrator.reclaimBond(vault.address, claimId, { from: accounts[3] });

    assert.equal(tx.logs[0].event, "BondRefundClaimed");
    assert.equal(tx.logs[0].args._vault, vault.address);
    assert.equal(tx.logs[0].args._claimId, claimId);
    assert.equal(tx.logs[0].args._disputer, accounts[3]);
    assert.equal(tx.logs[0].args._amountClaimed, web3.utils.toWei("200"));
    
    assert.equal(await hatArbitrator.disputersBonds(accounts[3], vault.address, claimId), web3.utils.toWei("0"));
    assert.equal(await hatArbitrator.bondClaimable(accounts[3], vault.address, claimId), false);
    assert.equal(await token.balanceOf(accounts[3]), web3.utils.toWei("200"));

    tx = await hatArbitrator.reclaimBond(vault.address, claimId, { from: accounts[3] });

    assert.equal(tx.logs[0].event, "BondRefundClaimed");
    assert.equal(tx.logs[0].args._vault, vault.address);
    assert.equal(tx.logs[0].args._claimId, claimId);
    assert.equal(tx.logs[0].args._disputer, accounts[3]);
    assert.equal(tx.logs[0].args._amountClaimed, web3.utils.toWei("0"));
    
    assert.equal(await hatArbitrator.disputersBonds(accounts[3], vault.address, claimId), web3.utils.toWei("0"));
    assert.equal(await hatArbitrator.bondClaimable(accounts[3], vault.address, claimId), false);
    assert.equal(await token.balanceOf(accounts[3]), web3.utils.toWei("200"));
  });

  it("Challenge resolution", async () => {
    const { registry, vault } = await setup(accounts, { setDefaultArbitrator: false });

    await setupHATArbitrator(registry, vault);

    await advanceToSafetyPeriod(registry);

    let claimId = await submitClaim(vault, { accounts });

    await token.mint(accounts[0], web3.utils.toWei("1000"));
    await token.approve(hatArbitrator.address, web3.utils.toWei("1000"), { from: accounts[0] });

    await token.mint(accounts[1], web3.utils.toWei("500"));
    await token.approve(hatArbitrator.address, web3.utils.toWei("500"), { from: accounts[1] });

    await assertFunctionRaisesException(
      hatArbitrator.challengeResolution(vault.address, claimId, "evidence", { from: expertCommittee, value: 1000 }),
      "ClaimIsNotDisputed"
    );

    await hatArbitrator.dispute(vault.address, claimId, web3.utils.toWei("1000"), "desc", { from: accounts[0] });
    await hatArbitrator.dispute(vault.address, claimId, web3.utils.toWei("500"), "desc", { from: accounts[1] });

    await assertFunctionRaisesException(
      hatArbitrator.challengeResolution(vault.address, web3.utils.randomHex(32), "evidence", { from: expertCommittee, value: 1000 }),
      "ClaimIsNotCurrentlyActiveClaim"
    );

    await assertFunctionRaisesException(
      hatArbitrator.challengeResolution(vault.address, claimId, "evidence", { from: expertCommittee, value: 1000 }),
      "NoResolution"
    );

    await hatArbitrator.acceptDispute(vault.address, claimId, 5000, accounts[4], [accounts[0]], [accounts[1]], "desc2", { from: expertCommittee });
    
    let tx = await hatArbitrator.challengeResolution(vault.address, claimId, "evidence", { from: accounts[0], value: 1000 });

    assert.equal(tx.logs[0].event, "ResolutionChallenged");
    assert.equal(tx.logs[0].args._vault, vault.address);
    assert.equal(tx.logs[0].args._claimId, claimId);

    await assertFunctionRaisesException(
      hatArbitrator.challengeResolution(vault.address, claimId, "evidence", { from: expertCommittee, value: 1000 }),
      "AlreadyChallenged"
    );

    await assertFunctionRaisesException(
      hatArbitrator.challengeResolution(vault.address, claimId, "evidence", { from: expertCommittee, value: 1000 }),
      "AlreadyChallenged"
    );

    await utils.increaseTime(60 * 60 * 24 * 7);

    await assertFunctionRaisesException(
      hatArbitrator.challengeResolution(vault.address, claimId, "evidence", { from: expertCommittee, value: 1000 }),
      "ChallengePeriodPassed"
    );

    await makeClaimExpire(vault);

    await assertFunctionRaisesException(
      hatArbitrator.challengeResolution(vault.address, claimId, "evidence", { from: accounts[0], value: 1000 }),
      "ClaimExpired"
    );
  });

  it("Execute resolution", async () => {
    const { registry, vault } = await setup(accounts, { setDefaultArbitrator: false });

    await setupHATArbitrator(registry, vault);

    await advanceToSafetyPeriod(registry);

    let claimId = await submitClaim(vault, { accounts });

    await token.mint(accounts[0], web3.utils.toWei("1000"));
    await token.approve(hatArbitrator.address, web3.utils.toWei("1000"), { from: accounts[0] });

    await token.mint(accounts[1], web3.utils.toWei("500"));
    await token.approve(hatArbitrator.address, web3.utils.toWei("500"), { from: accounts[1] });

    await assertFunctionRaisesException(
      hatArbitrator.executeResolution(vault.address, claimId, { from: accounts[0] }),
      "ClaimIsNotDisputed"
    );

    await hatArbitrator.dispute(vault.address, claimId, web3.utils.toWei("1000"), "desc", { from: accounts[0] });
    await hatArbitrator.dispute(vault.address, claimId, web3.utils.toWei("500"), "desc", { from: accounts[1] });

    await assertFunctionRaisesException(
      hatArbitrator.executeResolution(vault.address, web3.utils.randomHex(32), { from: accounts[0] }),
      "ClaimIsNotCurrentlyActiveClaim"
    );

    await assertFunctionRaisesException(
      hatArbitrator.executeResolution(vault.address, claimId, { from: accounts[0] }),
      "NoResolution"
    );

    await hatArbitrator.acceptDispute(vault.address, claimId, 5000, accounts[4], [accounts[0]], [accounts[1]], "desc2", { from: expertCommittee });

    await assertFunctionRaisesException(
      hatArbitrator.executeResolution(vault.address, claimId, { from: accounts[0] }),
      "ChallengePeriodDidNotPass"
    );

    await utils.increaseTime(60 * 60 * 24 * 7);

    let tx = await hatArbitrator.executeResolution(vault.address, claimId, { from: accounts[0] });

    assert.equal(tx.logs[0].event, "ResolutionExecuted");
    assert.equal(tx.logs[0].args._vault, vault.address);
    assert.equal(tx.logs[0].args._claimId, claimId);

    let logs = await vault.getPastEvents('ApproveClaim', {
      fromBlock: (await web3.eth.getBlock("latest")).number - 1,
      toBlock: (await web3.eth.getBlock("latest")).number
    });

    assert.equal(logs[0].event, "ApproveClaim");
    assert.equal(logs[0].args._claimId, claimId);
    assert.equal(logs[0].args._approver, hatArbitrator.address);
    assert.equal(logs[0].args._bountyPercentage, 5000);
    assert.equal(logs[0].args._beneficiary, accounts[4]);

    await assertFunctionRaisesException(
      hatArbitrator.executeResolution(vault.address, claimId, { from: accounts[0] }),
      "ClaimIsNotCurrentlyActiveClaim"
    );

    claimId = await submitClaim(vault, { accounts });

    await token.mint(accounts[0], web3.utils.toWei("1000"));
    await token.approve(hatArbitrator.address, web3.utils.toWei("1000"), { from: accounts[0] });

    await hatArbitrator.dispute(vault.address, claimId, web3.utils.toWei("1000"), "desc", { from: accounts[0] });

    await hatArbitrator.acceptDispute(vault.address, claimId, 4000, accounts[5], [accounts[0]], [], "desc2", { from: expertCommittee });

    await hatArbitrator.challengeResolution(vault.address, claimId, "evidence", { from: accounts[0], value: 1000 });

    await assertFunctionRaisesException(
      hatArbitrator.executeResolution(vault.address, claimId, { from: accounts[0] }),
      "CanOnlyBeCalledByCourt"
    );

    await klerosConnector.executeResolution(hatArbitrator.address, vault.address, claimId);

    logs = await hatArbitrator.getPastEvents('ResolutionExecuted', {
      fromBlock: (await web3.eth.getBlock("latest")).number - 1,
      toBlock: (await web3.eth.getBlock("latest")).number
    });

    assert.equal(logs[0].event, "ResolutionExecuted");
    assert.equal(logs[0].args._vault, vault.address);
    assert.equal(logs[0].args._claimId, claimId);

    logs = await vault.getPastEvents('ApproveClaim', {
      fromBlock: (await web3.eth.getBlock("latest")).number - 1,
      toBlock: (await web3.eth.getBlock("latest")).number
    });

    assert.equal(logs[0].event, "ApproveClaim");
    assert.equal(logs[0].args._claimId, claimId);
    assert.equal(logs[0].args._approver, hatArbitrator.address);
    assert.equal(logs[0].args._bountyPercentage, 4000);
    assert.equal(logs[0].args._beneficiary, accounts[5]);

    claimId = await submitClaim(vault, { accounts });

    await token.mint(accounts[0], web3.utils.toWei("1000"));
    await token.approve(hatArbitrator.address, web3.utils.toWei("1000"), { from: accounts[0] });

    await hatArbitrator.dispute(vault.address, claimId, web3.utils.toWei("1000"), "desc", { from: accounts[0] });

    await hatArbitrator.acceptDispute(vault.address, claimId, 4000, accounts[5], [accounts[0]], [], "desc2", { from: expertCommittee });

    await hatArbitrator.challengeResolution(vault.address, claimId, "evidence", { from: accounts[0], value: 1000 });

    await makeClaimExpire(vault);

    await assertFunctionRaisesException(
      hatArbitrator.executeResolution(vault.address, claimId, { from: accounts[0] }),
      "ClaimExpired"
    );
  });

  it("Dismiss resolution", async () => {
    const { registry, vault } = await setup(accounts, { setDefaultArbitrator: false });

    await setupHATArbitrator(registry, vault);

    await advanceToSafetyPeriod(registry);

    let claimId = await submitClaim(vault, { accounts });

    await token.mint(accounts[0], web3.utils.toWei("1000"));
    await token.approve(hatArbitrator.address, web3.utils.toWei("1000"), { from: accounts[0] });

    await token.mint(accounts[1], web3.utils.toWei("500"));
    await token.approve(hatArbitrator.address, web3.utils.toWei("500"), { from: accounts[1] });

    await assertFunctionRaisesException(
      hatArbitrator.dismissResolution(vault.address, claimId, { from: accounts[9] }),
      "ClaimIsNotDisputed"
    );

    await hatArbitrator.dispute(vault.address, claimId, web3.utils.toWei("1000"), "desc", { from: accounts[0] });
    await hatArbitrator.dispute(vault.address, claimId, web3.utils.toWei("500"), "desc", { from: accounts[1] });

    await assertFunctionRaisesException(
      hatArbitrator.dismissResolution(vault.address, web3.utils.randomHex(32), { from: accounts[9] }),
      "ClaimIsNotCurrentlyActiveClaim"
    );

    await assertFunctionRaisesException(
      hatArbitrator.dismissResolution(vault.address, claimId, { from: accounts[9] }),
      "NoResolution"
    );

    await hatArbitrator.acceptDispute(vault.address, claimId, 5000, accounts[4], [accounts[0]], [accounts[1]], "desc2", { from: expertCommittee });

    await assertFunctionRaisesException(
      hatArbitrator.dismissResolution(vault.address, claimId, { from: accounts[9] }),
      "CannotDismissUnchallengedResolution"
    );

    await hatArbitrator.challengeResolution(vault.address, claimId, "evidence", { from: accounts[0], value: 1000 });

    await assertFunctionRaisesException(
      hatArbitrator.dismissResolution(vault.address, claimId, { from: accounts[0] }),
      "CanOnlyBeCalledByCourt"
    );

    await klerosConnector.dismissResolution(hatArbitrator.address, vault.address, claimId);

    logs = await hatArbitrator.getPastEvents('ResolutionDismissed', {
      fromBlock: (await web3.eth.getBlock("latest")).number - 1,
      toBlock: (await web3.eth.getBlock("latest")).number
    });

    assert.equal(logs[0].event, "ResolutionDismissed");
    assert.equal(logs[0].args._vault, vault.address);
    assert.equal(logs[0].args._claimId, claimId);

    logs = await vault.getPastEvents('DismissClaim', {
      fromBlock: (await web3.eth.getBlock("latest")).number - 1,
      toBlock: (await web3.eth.getBlock("latest")).number
    });

    assert.equal(logs[0].event, "DismissClaim");
    assert.equal(logs[0].args._claimId, claimId);

    claimId = await submitClaim(vault, { accounts });

    await token.mint(accounts[0], web3.utils.toWei("1000"));
    await token.approve(hatArbitrator.address, web3.utils.toWei("1000"), { from: accounts[0] });

    await hatArbitrator.dispute(vault.address, claimId, web3.utils.toWei("1000"), "desc", { from: accounts[0] });

    await hatArbitrator.acceptDispute(vault.address, claimId, 4000, accounts[5], [accounts[0]], [], "desc2", { from: expertCommittee });

    await hatArbitrator.challengeResolution(vault.address, claimId, "evidence", { from: accounts[0], value: 1000 });

    await makeClaimExpire(vault);

    await assertFunctionRaisesException(
      hatArbitrator.dismissResolution(vault.address, claimId, { from: accounts[0] }),
      "ClaimExpired"
    );
  });

  it("Submit claim request", async () => {
    const { registry, vault } = await setup(accounts, { setDefaultArbitrator: false });

    await setupHATArbitrator(registry, vault);

    await token.mint(accounts[0], web3.utils.toWei("1000"));
    await token.approve(hatArbitrator.address, web3.utils.toWei("1000"), { from: accounts[0] });

    let tx = await hatArbitrator.submitClaimRequest("desc", { from: accounts[0] });
    let submitClaimRequestTimestamp = (await web3.eth.getBlock("latest")).timestamp;

    let internalClaimId = web3.utils.keccak256(web3.utils.encodePacked(
      { value: hatArbitrator.address, type: 'address' },
      { value: 1, type: 'uint256' }
    ));

    assert.equal(tx.logs[0].event, "SubmitClaimRequestCreated");
    assert.equal(tx.logs[0].args._internalClaimId, internalClaimId);
    assert.equal(tx.logs[0].args._submitter, accounts[0]);
    assert.equal(tx.logs[0].args._bond, web3.utils.toWei("1000"));
    assert.equal(tx.logs[0].args._descriptionHash, "desc");

    assert.equal((await hatArbitrator.submitClaimRequests(internalClaimId)).submitter, accounts[0]);
    assert.equal((await hatArbitrator.submitClaimRequests(internalClaimId)).bond, web3.utils.toWei("1000"));
    assert.equal((await hatArbitrator.submitClaimRequests(internalClaimId)).submittedAt, submitClaimRequestTimestamp);
    assert.equal((await hatArbitrator.submitClaimRequests(internalClaimId)).descriptionHash, "desc");

    assert.equal(await token.balanceOf(accounts[0]), web3.utils.toWei("0"));
    assert.equal(await token.balanceOf(hatArbitrator.address), web3.utils.toWei("1000"));
  });

  it("Dismiss submit claim request", async () => {
    const { registry, vault } = await setup(accounts, { setDefaultArbitrator: false });

    await setupHATArbitrator(registry, vault);

    await token.mint(accounts[0], web3.utils.toWei("1000"));
    await token.approve(hatArbitrator.address, web3.utils.toWei("1000"), { from: accounts[0] });

    await hatArbitrator.submitClaimRequest("desc", { from: accounts[0] });

    let internalClaimId = web3.utils.keccak256(web3.utils.encodePacked(
      { value: hatArbitrator.address, type: 'address' },
      { value: 1, type: 'uint256' }
    ));

    let wrongInternalClaimId = web3.utils.keccak256(web3.utils.encodePacked(
      { value: hatArbitrator.address, type: 'address' },
      { value: 0, type: 'uint256' }
    ));

    await assertFunctionRaisesException(
      hatArbitrator.dismissSubmitClaimRequest(internalClaimId, "desc2", { from: accounts[0] }),
      "OnlyExpertCommittee"
    );

    await assertFunctionRaisesException(
      hatArbitrator.dismissSubmitClaimRequest(wrongInternalClaimId, "desc2", { from: expertCommittee }),
      "ClaimReviewPeriodEnd"
    );

    let tx = await hatArbitrator.dismissSubmitClaimRequest(internalClaimId, "desc2", { from: expertCommittee });

    assert.equal(tx.logs[0].event, "SubmitClaimRequestDismissed");
    assert.equal(tx.logs[0].args._internalClaimId, internalClaimId);
    assert.equal(tx.logs[0].args._descriptionHash, "desc2");

    assert.equal((await hatArbitrator.submitClaimRequests(internalClaimId)).submitter, ZERO_ADDRESS);
    assert.equal((await hatArbitrator.submitClaimRequests(internalClaimId)).bond, 0);
    assert.equal((await hatArbitrator.submitClaimRequests(internalClaimId)).submittedAt, 0);
    assert.equal((await hatArbitrator.submitClaimRequests(internalClaimId)).descriptionHash, "");

    assert.equal(await token.balanceOf(accounts[0]), web3.utils.toWei("0"));
    assert.equal(await token.balanceOf(hatArbitrator.address), web3.utils.toWei("0"));
    assert.equal(await token.balanceOf(expertCommittee), web3.utils.toWei("1000"));

    await token.mint(accounts[0], web3.utils.toWei("1000"));
    await token.approve(hatArbitrator.address, web3.utils.toWei("1000"), { from: accounts[0] });

    await hatArbitrator.submitClaimRequest("desc", { from: accounts[0] });

    internalClaimId = web3.utils.keccak256(web3.utils.encodePacked(
      { value: hatArbitrator.address, type: 'address' },
      { value: 2, type: 'uint256' }
    ));

    await utils.increaseTime(60 * 60 * 24 * 90);

    await assertFunctionRaisesException(
      hatArbitrator.dismissSubmitClaimRequest(internalClaimId, "desc2", { from: expertCommittee }),
      "ClaimReviewPeriodEnd"
    );
  });

  it("Approve submit claim request", async () => {
    const { registry, vault } = await setup(accounts, { setDefaultArbitrator: false });

    await setupHATArbitrator(registry, vault);

    await token.mint(accounts[0], web3.utils.toWei("1000"));
    await token.approve(hatArbitrator.address, web3.utils.toWei("1000"), { from: accounts[0] });

    await hatArbitrator.submitClaimRequest("desc", { from: accounts[0] });

    let internalClaimId = web3.utils.keccak256(web3.utils.encodePacked(
      { value: hatArbitrator.address, type: 'address' },
      { value: 1, type: 'uint256' }
    ));

    let wrongInternalClaimId = web3.utils.keccak256(web3.utils.encodePacked(
      { value: hatArbitrator.address, type: 'address' },
      { value: 0, type: 'uint256' }
    ));

    await advanceToSafetyPeriod(registry);

    await assertFunctionRaisesException(
      hatArbitrator.approveSubmitClaimRequest(vault.address, internalClaimId, accounts[2], 5000, "desc2", { from: accounts[0] }),
      "OnlyExpertCommittee"
    );

    await assertFunctionRaisesException(
      hatArbitrator.approveSubmitClaimRequest(vault.address, wrongInternalClaimId, accounts[2], 5000, "desc2", { from: expertCommittee }),
      "ClaimReviewPeriodEnd"
    );

    let tx = await hatArbitrator.approveSubmitClaimRequest(vault.address, internalClaimId, accounts[2], 5000, "desc2", { from: expertCommittee });
    let approveSubmitClaimRequestTimestamp = (await web3.eth.getBlock("latest")).timestamp;

    let claimId = web3.utils.keccak256(web3.utils.encodePacked(
      { value: vault.address, type: 'address' },
      { value: 1, type: 'uint256' }
    ));

    assert.equal(tx.logs[0].event, "SubmitClaimRequestApproved");
    assert.equal(tx.logs[0].args._internalClaimId, internalClaimId);
    assert.equal(tx.logs[0].args._claimId, claimId);
    assert.equal(tx.logs[0].args._vault, vault.address);

    assert.equal((await hatArbitrator.submitClaimRequests(internalClaimId)).submitter, ZERO_ADDRESS);
    assert.equal((await hatArbitrator.submitClaimRequests(internalClaimId)).bond, 0);
    assert.equal((await hatArbitrator.submitClaimRequests(internalClaimId)).submittedAt, 0);
    assert.equal((await hatArbitrator.submitClaimRequests(internalClaimId)).descriptionHash, "");

    assert.equal(await token.balanceOf(accounts[0]), web3.utils.toWei("1000"));
    assert.equal(await token.balanceOf(hatArbitrator.address), web3.utils.toWei("0"));
    assert.equal(await token.balanceOf(expertCommittee), web3.utils.toWei("0"));

    assert.equal((await hatArbitrator.resolutions(vault.address, claimId)).bountyPercentage.toString(), "5000");
    assert.equal((await hatArbitrator.resolutions(vault.address, claimId)).beneficiary, accounts[2]);
    assert.equal((await hatArbitrator.resolutions(vault.address, claimId)).resolvedAt, approveSubmitClaimRequestTimestamp);

    assert.equal((await vault.activeClaim()).claimId, claimId);
    assert.equal((await vault.activeClaim()).challengedAt, approveSubmitClaimRequestTimestamp);

    let logs = await vault.getPastEvents('SubmitClaim', {
      fromBlock: (await web3.eth.getBlock("latest")).number - 1,
      toBlock: (await web3.eth.getBlock("latest")).number
    });

    assert.equal(logs[0].event, "SubmitClaim");
    assert.equal(logs[0].args._claimId, claimId);
    assert.equal(logs[0].args._submitter, hatArbitrator.address);
    assert.equal(logs[0].args._bountyPercentage, 5000);
    assert.equal(logs[0].args._beneficiary, accounts[2]);
    assert.equal(logs[0].args._descriptionHash, "desc2");

    logs = await vault.getPastEvents('ChallengeClaim', {
      fromBlock: (await web3.eth.getBlock("latest")).number - 1,
      toBlock: (await web3.eth.getBlock("latest")).number
    });

    assert.equal(logs[0].event, "ChallengeClaim");
    assert.equal(logs[0].args._claimId, claimId);

    await token.approve(hatArbitrator.address, web3.utils.toWei("1000"), { from: accounts[0] });

    await hatArbitrator.submitClaimRequest("desc", { from: accounts[0] });

    internalClaimId = web3.utils.keccak256(web3.utils.encodePacked(
      { value: hatArbitrator.address, type: 'address' },
      { value: 2, type: 'uint256' }
    ));

    await utils.increaseTime(60 * 60 * 24 * 90);

    await assertFunctionRaisesException(
      hatArbitrator.approveSubmitClaimRequest(vault.address, internalClaimId, accounts[2], 5000, "desc2", { from: expertCommittee }),
      "ClaimReviewPeriodEnd"
    );
  });

  it("Refund submit claim request", async () => {
    const { registry, vault } = await setup(accounts, { setDefaultArbitrator: false });

    await setupHATArbitrator(registry, vault);

    await token.mint(accounts[0], web3.utils.toWei("1000"));
    await token.approve(hatArbitrator.address, web3.utils.toWei("1000"), { from: accounts[0] });

    await hatArbitrator.submitClaimRequest("desc", { from: accounts[0] });

    let internalClaimId = web3.utils.keccak256(web3.utils.encodePacked(
      { value: hatArbitrator.address, type: 'address' },
      { value: 1, type: 'uint256' }
    ));

    await assertFunctionRaisesException(
      hatArbitrator.refundExpiredSubmitClaimRequest(internalClaimId, { from: accounts[1] }),
      "ClaimReviewPeriodDidNotEnd"
    );

    await utils.increaseTime(60 * 60 * 24 * 90);

    let tx = await hatArbitrator.refundExpiredSubmitClaimRequest(internalClaimId, { from: accounts[1] });

    assert.equal(tx.logs[0].event, "SubmitClaimRequestExpired");
    assert.equal(tx.logs[0].args._internalClaimId, internalClaimId);

    assert.equal((await hatArbitrator.submitClaimRequests(internalClaimId)).submitter, ZERO_ADDRESS);
    assert.equal((await hatArbitrator.submitClaimRequests(internalClaimId)).bond, 0);
    assert.equal((await hatArbitrator.submitClaimRequests(internalClaimId)).submittedAt, 0);
    assert.equal((await hatArbitrator.submitClaimRequests(internalClaimId)).descriptionHash, "");

    assert.equal(await token.balanceOf(accounts[0]), web3.utils.toWei("1000"));
    assert.equal(await token.balanceOf(hatArbitrator.address), web3.utils.toWei("0"));
    assert.equal(await token.balanceOf(expertCommittee), web3.utils.toWei("0"));
  });
});
