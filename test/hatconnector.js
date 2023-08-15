const { ethers, web3 } = require('hardhat');
const { solidity } = require("ethereum-waffle");
const { use, expect } = require("chai");
const utils = require("./utils.js");
const { ZERO_ADDRESS } = require('./common.js');
const { BigNumber } = ethers;

const oneETH = BigNumber.from(BigInt(1e18));
const EMPTY_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000";
const gasPrice = 2000000000;

use(solidity);

const arbitrationCost = 1000;
const arbitratorExtraData = "0x85";
const appealTimeout = 180;
const appealCost = 5000;
const metaEvidenceClaimant = "ipfs/Claimant";
const metaEvidenceDepositor = "ipfs/Depositor";
const metaEvidenceSubmit = "ipfs/Submit";
const hackerChallengePeriod = 180;
const depositorChallengePeriod = 150;
const winnerMultiplier = 3000;
const loserMultiplier = 7000;
const loserAppealPeriodMultiplier = 5000;
const evidence = "Evidence string";

const vaultBounty = 30;
const hackerBounty = 50;
const vaultDescritionHash = "NewClaim";

let HatConnector;
let Arbitrator;
let HatVault;
let hatConnector;
let arbitrator;
let hatVault;

let vaultChalengePeriod;

let governor;
let claimant;
let depositor;
let submitter;
let crowdfunder1;
let crowdfunder2;
let committee;
let other;

contract("HATKlerosConnector", () => {
  beforeEach("initialize the contract", async function () {
    [governor, claimant, depositor, submitter, crowdfunder1, crowdfunder2, committee, other] = await ethers.getSigners();
    vaultChalengePeriod = 1000;

    Arbitrator = await ethers.getContractFactory("AutoAppealableArbitrator", governor);
    arbitrator = await Arbitrator.deploy(arbitrationCost);

    // Create disputes so the index in tests will not be a default value.
    await arbitrator.connect(other).createDispute(42, arbitratorExtraData, { value: arbitrationCost });
    await arbitrator.connect(other).createDispute(4, arbitratorExtraData, { value: arbitrationCost });

    HatVault = await ethers.getContractFactory("HatVaultForConnectorMock", governor);
    hatVault = await HatVault.deploy(ZERO_ADDRESS, vaultChalengePeriod);

    HatConnector = await ethers.getContractFactory("HATKlerosConnector", governor);
    hatConnector = await HatConnector.deploy(
      arbitrator.address,
      arbitratorExtraData,
      metaEvidenceClaimant,
      metaEvidenceDepositor,
      metaEvidenceSubmit,
      hackerChallengePeriod,
      depositorChallengePeriod,
      winnerMultiplier,
      loserMultiplier,
      loserAppealPeriodMultiplier
    );

    await hatVault.connect(governor).setArbitrator(hatConnector.address);
  });

  it("Should revert if challenge timeout is too low", async () => {
    vaultChalengePeriod = 329;
    arbitrator = await Arbitrator.deploy(arbitrationCost);    
    hatVault = await HatVault.deploy(arbitrator.address, vaultChalengePeriod);    
    await expect(HatConnector.deploy(
      arbitrator.address,
      arbitratorExtraData,
      hatVault.address,
      metaEvidenceClaimant,
      metaEvidenceDepositor,
      metaEvidenceSubmit,
      hackerChallengePeriod,
      depositorChallengePeriod,
      winnerMultiplier,
      loserMultiplier,
      loserAppealPeriodMultiplier
    )).to.be.revertedWith("Wrong timeout values");
  });

  it("Should correctly set constructor params", async () => {
    expect(await hatConnector.governor()).to.equal(await governor.getAddress());
    expect(await hatConnector.klerosArbitrator()).to.equal(arbitrator.address);
    expect(await hatConnector.arbitratorExtraData()).to.equal(arbitratorExtraData);
    expect(await hatConnector.vault()).to.equal(hatVault.address);
    expect(await hatConnector.hackerChallengePeriod()).to.equal(hackerChallengePeriod);
    expect(await hatConnector.depositorChallengePeriod()).to.equal(depositorChallengePeriod);
    expect(await hatConnector.winnerMultiplier()).to.equal(winnerMultiplier);
    expect(await hatConnector.loserMultiplier()).to.equal(loserMultiplier);
    expect(await hatConnector.loserAppealPeriodMultiplier()).to.equal(loserAppealPeriodMultiplier);
    expect(await hatConnector.metaEvidenceUpdates()).to.equal(0);
  });

  it("Should make governance changes", async () => {
    await expect(
      hatConnector.connect(other).changeChallengePeriod(10, 20)
    ).to.be.revertedWith("The caller must be the governor.");
    await expect(
      hatConnector.connect(governor).changeChallengePeriod(500, 501)
    ).to.be.revertedWith("Wrong timeout values");
    await hatConnector.connect(governor).changeChallengePeriod(10, 20);
    expect(await hatConnector.hackerChallengePeriod()).to.equal(10);
    expect(await hatConnector.depositorChallengePeriod()).to.equal(20);

    await expect(
      hatConnector.connect(other).changeWinnerMultiplier(101)
    ).to.be.revertedWith("The caller must be the governor.");
    await hatConnector.connect(governor).changeWinnerMultiplier(101);
    expect(await hatConnector.winnerMultiplier()).to.equal(101);

    await expect(
      hatConnector.connect(other).changeLoserMultiplier(202)
    ).to.be.revertedWith("The caller must be the governor.");
    await hatConnector.connect(governor).changeLoserMultiplier(202);
    expect(await hatConnector.loserMultiplier()).to.equal(202);

    await expect(
      hatConnector.connect(other).changeLoserAppealPeriodMultiplier(303)
    ).to.be.revertedWith("The caller must be the governor.");
    await hatConnector.connect(governor).changeLoserAppealPeriodMultiplier(303);
    expect(await hatConnector.loserAppealPeriodMultiplier()).to.equal(303);

    await expect(
      hatConnector.connect(other).changeMetaEvidence("A", "B", "C")
    ).to.be.revertedWith("The caller must be the governor.");
    await expect(hatConnector.connect(governor).changeMetaEvidence("A", "B", "C"))
      .to.emit(hatConnector, "MetaEvidence")
      .withArgs(3, "A")
      .to.emit(hatConnector, "MetaEvidence")
      .withArgs(4, "B")
      .to.emit(hatConnector, "MetaEvidence")
      .withArgs(5, "C");
    expect(await hatConnector.metaEvidenceUpdates()).to.equal(1);    
  });

  it("Check most of the requires for hacker challenge", async () => {
    const falseClaim = "0xcd9b8f2a432501491d4f288a101653bd2885f67a39ef35776ccd47280e045027";
    await expect(
      hatConnector.connect(claimant).challengeByClaimant(EMPTY_HASH, hackerBounty, await claimant.getAddress(), evidence, { value: arbitrationCost })
    ).to.be.revertedWith("No active claim");

    const txClaim = await hatVault.connect(committee).submitClaim(await claimant.getAddress(), vaultBounty, vaultDescritionHash);
    const activeClaim = await hatVault.activeClaim();
    const claimId = activeClaim[0];
    expect(txClaim)
      .to.emit(hatVault, "SubmitClaim")
      .withArgs(claimId, await committee.getAddress(), await claimant.getAddress(), vaultBounty, vaultDescritionHash);

    await expect(
      hatConnector.connect(claimant).challengeByClaimant(falseClaim, hackerBounty, await claimant.getAddress(), evidence, { value: arbitrationCost })
    ).to.be.revertedWith("Claim id does not match");
    await expect(
      hatConnector.connect(other).challengeByClaimant(claimId, hackerBounty, await claimant.getAddress(), evidence, { value: arbitrationCost })
    ).to.be.revertedWith("Only original beneficiary allowed to challenge");
    await expect(
      hatConnector.connect(claimant).challengeByClaimant(claimId, hackerBounty, await claimant.getAddress(), evidence, { value: arbitrationCost - 1 })
    ).to.be.revertedWith("Should pay the full deposit.");

    // Lower bounty check
    await expect(
      hatConnector.connect(claimant).challengeByClaimant(claimId, vaultBounty, await claimant.getAddress(), evidence, { value: arbitrationCost })
    ).to.be.revertedWith("Incorrect bounty");
    // Higher bounty check
    await expect(
      hatConnector.connect(claimant).challengeByClaimant(claimId, await hatVault.maxBounty() + 1, await claimant.getAddress(), evidence, { value: arbitrationCost })
    ).to.be.revertedWith("Incorrect bounty");

    await utils.increaseTime(hackerChallengePeriod + 1);
    await expect(
      hatConnector.connect(claimant).challengeByClaimant(claimId, hackerBounty, await claimant.getAddress(), evidence, { value: arbitrationCost })
    ).to.be.revertedWith("Time to challenge has passed for hacker");   
  });

  it("Should set correct values after hacker challenge", async () => {
    await hatVault.connect(committee).submitClaim(await claimant.getAddress(), vaultBounty, vaultDescritionHash);
    let activeClaim = await hatVault.activeClaim();
    const claimId = activeClaim[0];
    // Deliberately change beneficiary to check if it's stored correctly
    await hatConnector.connect(claimant).challengeByClaimant(claimId, hackerBounty, await other.getAddress(), evidence, { value: arbitrationCost });

    const claimData = await hatConnector.claims(claimId);
    expect(claimData[0]).to.equal(1, "Incorrect status");
    expect(claimData[1]).to.equal(hackerBounty, "Incorrect bounty");
    expect(claimData[2]).to.equal(await other.getAddress(), "Incorrect beneficiary");
    expect(claimData[3]).to.equal(await claimant.getAddress(), "Incorrect challenger");
    expect(claimData[4]).to.equal(1, "Incorrect number of challenges");
    expect(claimData[5]).to.equal(0, "openToChallengeAt should be 0");

    const disputeData = await hatConnector.disputes(0); // It's the first dispute
    expect(disputeData[0]).to.equal(claimId, "Incorrect claimId");
    expect(disputeData[1]).to.equal(0, "pendingClaimId should be 0");
    expect(disputeData[2]).to.equal(2, "Incorrect external disputeId"); // 2 disputes were already created before, so this should be 3rd external dispute.
    expect(disputeData[3]).to.equal(0, "Ruling should be 0");
    expect(disputeData[4]).to.equal(false, "Resolved should be false");

    expect(await hatConnector.getNumberOfRounds(0)).to.equal(1, "Incorrect number of rounds");
    expect(await hatConnector.externalIDtoLocalID(2)).to.equal(0, "Incorrect local dispute Id");

    const currentTimeStamp = (await web3.eth.getBlock("latest")).timestamp;
    activeClaim = await hatVault.activeClaim();
    expect(activeClaim[5]).to.equal(currentTimeStamp, "Incorrect challenge timestamp");

    const dispute = await arbitrator.disputes(2);
    expect(dispute[0]).to.equal(hatConnector.address, "Incorrect arbitrable address");
    expect(dispute[1]).to.equal(2, "Incorrect number of choices");
    expect(dispute[2]).to.equal(1000, "Incorrect fees value stored"); 
  });

  it("Should not allow hacker to challenge 2nd time", async () => {
    await hatVault.connect(committee).submitClaim(await claimant.getAddress(), vaultBounty, vaultDescritionHash);
    let activeClaim = await hatVault.activeClaim();
    const claimId = activeClaim[0];
    await hatConnector.connect(claimant).challengeByClaimant(claimId, hackerBounty, await other.getAddress(), evidence, { value: arbitrationCost });

    await expect(
      hatConnector.connect(claimant).challengeByClaimant(claimId, hackerBounty, await claimant.getAddress(), evidence, { value: arbitrationCost })
    ).to.be.revertedWith("Claim is already challenged or resolved");
  });

  it("Should emit correct events after hacker challenge", async () => {
    await hatVault.connect(committee).submitClaim(await claimant.getAddress(), vaultBounty, vaultDescritionHash);
    let activeClaim = await hatVault.activeClaim();
    const claimId = activeClaim[0];
    await expect(hatConnector.connect(claimant).challengeByClaimant(claimId, hackerBounty, await other.getAddress(), evidence, { value: arbitrationCost }))
      .to.emit(hatVault, "ChallengeClaim")
      .withArgs(claimId)
      .to.emit(arbitrator, "DisputeCreation")
      .withArgs(2, hatConnector.address)
      .to.emit(hatConnector, "ChallengedByClaimant")
      .withArgs(claimId)
      .to.emit(hatConnector, "Dispute")
      .withArgs(arbitrator.address, 2, 0, 0) // Arbitrator, external dispute id, metaevidence id, local dispute id.
      .to.emit(hatConnector, "Evidence")
      .withArgs(arbitrator.address, 0, await claimant.getAddress(), evidence); // Arbitrator, local dispute Id, challenger, evidence
  });

  it("Should correctly reimburse the claimant in case of overpay", async () => {
    await hatVault.connect(committee).submitClaim(await claimant.getAddress(), vaultBounty, vaultDescritionHash);
    let activeClaim = await hatVault.activeClaim();
    const claimId = activeClaim[0];
    const oldBalance = await claimant.getBalance();
    const tx = await hatConnector.connect(claimant).challengeByClaimant(claimId, hackerBounty, await other.getAddress(), evidence, { gasPrice: gasPrice, value: oneETH });
    txFee = (await tx.wait()).gasUsed * gasPrice;
    
    newBalance = await claimant.getBalance();
    expect(newBalance).to.equal(
      oldBalance.sub(arbitrationCost).sub(txFee),
      "Claimant was not reimbursed correctly"
    );
  });

  it("Should not be possible to approve claim during open hacker challenge", async () => {
    let claimId = "0xcd9b8f2a432501491d4f288a101653bd2885f67a39ef35776ccd47280e045028";
    await expect(
      hatConnector.connect(claimant).approveClaim(claimId)
    ).to.be.revertedWith("Claim does not exist");

    await hatVault.connect(committee).submitClaim(await claimant.getAddress(), vaultBounty, vaultDescritionHash);
    const activeClaim = await hatVault.activeClaim();
    claimId = activeClaim[0];
    await hatConnector.connect(claimant).challengeByClaimant(claimId, hackerBounty, await other.getAddress(), evidence, { value: arbitrationCost });

    await expect(
      hatConnector.connect(claimant).approveClaim(claimId)
    ).to.be.revertedWith("Claim is already challenged or resolved");
  });

  it("Should correctly approve the claim and change the parameters after successful hacker challenge", async () => {
    await hatVault.connect(committee).submitClaim(await claimant.getAddress(), vaultBounty, vaultDescritionHash);
    let activeClaim = await hatVault.activeClaim();
    const claimId = activeClaim[0];
    await hatConnector.connect(claimant).challengeByClaimant(claimId, hackerBounty, await other.getAddress(), evidence, { value: arbitrationCost });

    await expect(arbitrator.connect(governor).giveRuling(2, 2))
      .to.emit(hatConnector, "Ruling")
      .withArgs(arbitrator.address, 2, 2)
      .to.emit(hatVault, "ApproveClaim")
      .withArgs(claimId, hatConnector.address, await other.getAddress(), hackerBounty);

    const disputeData = await hatConnector.disputes(0);
    expect(disputeData[0]).to.equal(claimId, "Incorrect claimId");
    expect(disputeData[1]).to.equal(0, "pendingClaimId should be 0");
    expect(disputeData[2]).to.equal(2, "Incorrect external disputeId");
    expect(disputeData[3]).to.equal(2, "Ruling should be 2");
    expect(disputeData[4]).to.equal(true, "Resolved should be true");

    const claimData = await hatConnector.claims(claimId);
    expect(claimData[0]).to.equal(3, "Incorrect status");
    expect(claimData[1]).to.equal(hackerBounty, "Incorrect bounty");
    expect(claimData[2]).to.equal(await other.getAddress(), "Incorrect beneficiary");
    expect(claimData[3]).to.equal(await claimant.getAddress(), "Incorrect challenger");
    expect(claimData[4]).to.equal(1, "Incorrect number of challenges");
    expect(claimData[5]).to.equal(0, "openToChallengeAt should be 0");

    activeClaim = await hatVault.activeClaim();
    expect(activeClaim[0]).to.equal(EMPTY_HASH, "Active claim should be deleted");
  });

  it("Check requires for rule", async () => {
    await hatVault.connect(committee).submitClaim(await claimant.getAddress(), vaultBounty, vaultDescritionHash);
    let activeClaim = await hatVault.activeClaim();
    const claimId = activeClaim[0];
    await hatConnector.connect(claimant).challengeByClaimant(claimId, hackerBounty, await other.getAddress(), evidence, { value: arbitrationCost });

    await expect(
      hatConnector.connect(claimant).rule(2, 10)
    ).to.be.revertedWith("Invalid ruling option");
    await expect(
      hatConnector.connect(claimant).rule(2, 2)
    ).to.be.revertedWith("Only the arbitrator can execute");

    await arbitrator.connect(governor).giveRuling(2, 2);
    await expect(
      hatConnector.connect(claimant).rule(2, 2)
    ).to.be.revertedWith("Already resolved");
  });

  it("Should set correct values when arbitrator did not side with hacker", async () => {
    await hatVault.connect(committee).submitClaim(await claimant.getAddress(), vaultBounty, vaultDescritionHash);
    let activeClaim = await hatVault.activeClaim();
    const claimId = activeClaim[0];
    await hatConnector.connect(claimant).challengeByClaimant(claimId, hackerBounty, await other.getAddress(), evidence, { value: arbitrationCost });

    await expect(arbitrator.connect(governor).giveRuling(2, 0)) // 0 and 1 ruling should give the same result, but we check with 0
      .to.emit(hatConnector, "Ruling")
      .withArgs(arbitrator.address, 2, 0);

    const disputeData = await hatConnector.disputes(0);
    expect(disputeData[0]).to.equal(claimId, "Incorrect claimId");
    expect(disputeData[1]).to.equal(0, "pendingClaimId should be 0");
    expect(disputeData[2]).to.equal(2, "Incorrect external disputeId");
    expect(disputeData[3]).to.equal(0, "Ruling should be 0");
    expect(disputeData[4]).to.equal(true, "Resolved should be true");

    const claimData = await hatConnector.claims(claimId);
    const currentTimeStamp = (await web3.eth.getBlock("latest")).timestamp;
    expect(claimData[0]).to.equal(0, "Incorrect status");
    expect(claimData[1]).to.equal(hackerBounty, "Incorrect bounty");
    expect(claimData[2]).to.equal(await other.getAddress(), "Incorrect beneficiary");
    expect(claimData[3]).to.equal(await claimant.getAddress(), "Incorrect challenger");
    expect(claimData[4]).to.equal(1, "Incorrect number of challenges");
    expect(claimData[5]).to.equal(currentTimeStamp, "openToChallengeAt is incorrect");

    activeClaim = await hatVault.activeClaim();
    expect(activeClaim[0]).to.equal(claimId, "Active claim should not change");
  });

  it("Should not allow hacker to challenge instead of depositor", async () => {
    await hatVault.connect(committee).submitClaim(await claimant.getAddress(), vaultBounty, vaultDescritionHash);
    let activeClaim = await hatVault.activeClaim();
    const claimId = activeClaim[0];
    await hatConnector.connect(claimant).challengeByClaimant(claimId, hackerBounty, await other.getAddress(), evidence, { value: arbitrationCost });

    await arbitrator.connect(governor).giveRuling(2, 1);

    await expect(
      hatConnector.connect(claimant).challengeByClaimant(claimId, hackerBounty, await other.getAddress(), evidence, { value: arbitrationCost })
    ).to.be.revertedWith("Hacker already challenged");
  });

  it("Depositor should not be able to challenge before or at the time of hacker dispute", async () => {
    await hatVault.connect(committee).submitClaim(await claimant.getAddress(), vaultBounty, vaultDescritionHash);
    let activeClaim = await hatVault.activeClaim();
    const claimId = activeClaim[0];
    
    await expect(
      hatConnector.connect(depositor).challengeByDepositor(claimId, evidence, { value: arbitrationCost })
    ).to.be.revertedWith("Not a time to challenge for depositor.");
    
    await hatConnector.connect(claimant).challengeByClaimant(claimId, hackerBounty, await other.getAddress(), evidence, { value: arbitrationCost });

    await expect(
      hatConnector.connect(depositor).challengeByDepositor(claimId, evidence, { value: arbitrationCost }) 
    ).to.be.revertedWith("Claim is already challenged or resolved");
  });

  it("Sanity checks for depositor challenge should work correctly", async () => {
    const falseClaim = "0xcd9b8f2a432501491d4f288a101653bd2885f67a39ef35776ccd47280e045027";
    await expect(
      hatConnector.connect(depositor).challengeByDepositor(EMPTY_HASH, evidence, { value: arbitrationCost })
    ).to.be.revertedWith("No active claim");

    await hatVault.connect(committee).submitClaim(await claimant.getAddress(), vaultBounty, vaultDescritionHash);
    let activeClaim = await hatVault.activeClaim();
    const claimId = activeClaim[0];
    
    await hatConnector.connect(claimant).challengeByClaimant(claimId, hackerBounty, await other.getAddress(), evidence, { value: arbitrationCost });
    await arbitrator.connect(governor).giveRuling(2, 1);

    await expect(
      hatConnector.connect(depositor).challengeByDepositor(falseClaim, evidence, { value: arbitrationCost })
    ).to.be.revertedWith("Claim id does not match");

    await expect(
      hatConnector.connect(depositor).challengeByDepositor(claimId, evidence, { value: arbitrationCost - 1 }) 
    ).to.be.revertedWith("Should pay the full deposit.");

    await utils.increaseTime(depositorChallengePeriod + 1);
    await expect(
      hatConnector.connect(depositor).challengeByDepositor(claimId, evidence, { value: arbitrationCost }) 
    ).to.be.revertedWith("Time to challenge has passed for depositor.");
  });

  it("Check depositor challenge timeout if there was no challenge", async () => {
    await hatVault.connect(committee).submitClaim(await claimant.getAddress(), vaultBounty, vaultDescritionHash);
    let activeClaim = await hatVault.activeClaim();
    const claimId = activeClaim[0];
    
    await utils.increaseTime(hackerChallengePeriod + depositorChallengePeriod + 1);
    await expect(
      hatConnector.connect(depositor).challengeByDepositor(claimId, evidence, { value: arbitrationCost }) 
    ).to.be.revertedWith("Not a time to challenge for depositor.");
  });

  it("Depositor should not challenge two times in a row", async () => {
    await hatVault.connect(committee).submitClaim(await claimant.getAddress(), vaultBounty, vaultDescritionHash);
    let activeClaim = await hatVault.activeClaim();
    const claimId = activeClaim[0];
    
    await hatConnector.connect(claimant).challengeByClaimant(claimId, hackerBounty, await other.getAddress(), evidence, { value: arbitrationCost });
    await arbitrator.connect(governor).giveRuling(2, 1);

    await hatConnector.connect(depositor).challengeByDepositor(claimId, evidence, { value: arbitrationCost });
    await expect(
      hatConnector.connect(depositor).challengeByDepositor(claimId, evidence, { value: arbitrationCost }) 
    ).to.be.revertedWith("Claim is already challenged or resolved");
  });

  it("Should not be able to challenge if the claim was finalized in the vault", async () => {
    await hatVault.connect(committee).submitClaim(await claimant.getAddress(), vaultBounty, vaultDescritionHash);
    let activeClaim = await hatVault.activeClaim();
    const claimId = activeClaim[0];
    
    await hatConnector.connect(claimant).challengeByClaimant(claimId, hackerBounty, await other.getAddress(), evidence, { value: arbitrationCost });
    await arbitrator.connect(governor).giveRuling(2, 2);

    await expect(
      hatConnector.connect(claimant).challengeByClaimant(claimId, hackerBounty, await other.getAddress(), evidence, { value: arbitrationCost })
    ).to.be.revertedWith("Claim id does not match"); // Active claim was deleted so id won't match an empty hash
    await expect(
      hatConnector.connect(depositor).challengeByDepositor(claimId, evidence, { value: arbitrationCost }) 
    ).to.be.revertedWith("Claim id does not match");
  });

  it("Depositor should be able to challenge if there was no hacker challenge", async () => {
    await hatVault.connect(committee).submitClaim(await claimant.getAddress(), vaultBounty, vaultDescritionHash);
    let activeClaim = await hatVault.activeClaim();
    const claimId = activeClaim[0];
    await utils.increaseTime(hackerChallengePeriod + 1);
    
    await expect(hatConnector.connect(depositor).challengeByDepositor(claimId, evidence, { value: arbitrationCost }))
      .to.emit(hatVault, "ChallengeClaim")
      .withArgs(claimId);
  });

  it("Should set correct values after depositor challenge", async () => {
    await hatVault.connect(committee).submitClaim(await claimant.getAddress(), vaultBounty, vaultDescritionHash);
    let activeClaim = await hatVault.activeClaim();
    const claimId = activeClaim[0];

    await hatConnector.connect(claimant).challengeByClaimant(claimId, hackerBounty, await other.getAddress(), evidence, { value: arbitrationCost });
    await arbitrator.connect(governor).giveRuling(2, 1);

    await hatConnector.connect(depositor).challengeByDepositor(claimId, evidence, { value: arbitrationCost });
    
    const claimData = await hatConnector.claims(claimId);
    expect(claimData[0]).to.equal(2, "Incorrect status");
    expect(claimData[1]).to.equal(hackerBounty, "Incorrect bounty");
    expect(claimData[2]).to.equal(await other.getAddress(), "Incorrect beneficiary");
    expect(claimData[3]).to.equal(await depositor.getAddress(), "Incorrect challenger");
    expect(claimData[4]).to.equal(2, "Incorrect number of challenges");

    const disputeData = await hatConnector.disputes(1); // It's the 2nd dispute
    expect(disputeData[0]).to.equal(claimId, "Incorrect claimId");
    expect(disputeData[1]).to.equal(0, "pendingClaimId should be 0");
    expect(disputeData[2]).to.equal(3, "Incorrect external disputeId"); // 2 disputes were already created at the start and 3rd dispute was done by claimant.
    expect(disputeData[3]).to.equal(0, "Ruling should be 0");
    expect(disputeData[4]).to.equal(false, "Resolved should be false");

    expect(await hatConnector.getNumberOfRounds(1)).to.equal(1, "Incorrect number of rounds");
    expect(await hatConnector.externalIDtoLocalID(3)).to.equal(1, "Incorrect local dispute Id");

    const currentTimeStamp = (await web3.eth.getBlock("latest")).timestamp;
    activeClaim = await hatVault.activeClaim();
    expect(activeClaim[5]).to.not.equal(currentTimeStamp, "Challenge timestamp should not change in vault");

    const dispute = await arbitrator.disputes(3);
    expect(dispute[0]).to.equal(hatConnector.address, "Incorrect arbitrable address");
    expect(dispute[1]).to.equal(2, "Incorrect number of choices");
    expect(dispute[2]).to.equal(1000, "Incorrect fees value stored");
  });

  it("Should emit correct events after depositor challenge", async () => {
    await hatVault.connect(committee).submitClaim(await claimant.getAddress(), vaultBounty, vaultDescritionHash);
    let activeClaim = await hatVault.activeClaim();
    const claimId = activeClaim[0];

    await hatConnector.connect(claimant).challengeByClaimant(claimId, hackerBounty, await other.getAddress(), evidence, { value: arbitrationCost });
    await arbitrator.connect(governor).giveRuling(2, 1);

    await expect(hatConnector.connect(depositor).challengeByDepositor(claimId, evidence, { value: arbitrationCost }))
      .to.emit(arbitrator, "DisputeCreation")
      .withArgs(3, hatConnector.address)
      .to.emit(hatConnector, "ChallengedByDepositor")
      .withArgs(claimId)
      .to.emit(hatConnector, "Dispute")
      .withArgs(arbitrator.address, 3, 1, 1) // Arbitrator, external dispute id, metaevidence id, local dispute id.
      .to.emit(hatConnector, "Evidence")
      .withArgs(arbitrator.address, 1, await depositor.getAddress(), evidence); // Arbitrator, local dispute Id, challenger, evidence
  });

  it("Should correctly reimburse the depositor in case of overpay", async () => {
    await hatVault.connect(committee).submitClaim(await claimant.getAddress(), vaultBounty, vaultDescritionHash);
    let activeClaim = await hatVault.activeClaim();
    const claimId = activeClaim[0];

    await hatConnector.connect(claimant).challengeByClaimant(claimId, hackerBounty, await other.getAddress(), evidence, { value: arbitrationCost });
    await arbitrator.connect(governor).giveRuling(2, 1);

    const oldBalance = await depositor.getBalance();
    const tx = await hatConnector.connect(depositor).challengeByDepositor(claimId, evidence, { gasPrice: gasPrice, value: oneETH });
    txFee = (await tx.wait()).gasUsed * gasPrice;
    
    newBalance = await depositor.getBalance();
    expect(newBalance).to.equal(
      oldBalance.sub(arbitrationCost).sub(txFee),
      "Depositor was not reimbursed correctly"
    );
  });

  it("Should approve claim if the depositor did not challenge", async () => {
    await hatVault.connect(committee).submitClaim(await claimant.getAddress(), vaultBounty, vaultDescritionHash);
    let activeClaim = await hatVault.activeClaim();
    const claimId = activeClaim[0];

    await hatConnector.connect(claimant).challengeByClaimant(claimId, hackerBounty, await other.getAddress(), evidence, { value: arbitrationCost });
    await arbitrator.connect(governor).giveRuling(2, 1);

    await expect(
      hatConnector.connect(other).approveClaim(claimId)
    ).to.be.revertedWith("Depositor still can challenge");

    await utils.increaseTime(depositorChallengePeriod + 1);
    await expect(hatConnector.connect(other).approveClaim(claimId))
      .to.emit(hatVault, "ApproveClaim")
      .withArgs(claimId, hatConnector.address, await claimant.getAddress(), vaultBounty); // Beneficiary and bounty should be unchanged.

    const claimData = await hatConnector.claims(claimId);
    expect(claimData[0]).to.equal(3, "Incorrect status");

    activeClaim = await hatVault.activeClaim();
    expect(activeClaim[0]).to.equal(EMPTY_HASH, "Active claim should be deleted");
  });

  it("Should dismiss the claim after successful depositor challenge", async () => {
    await hatVault.connect(committee).submitClaim(await claimant.getAddress(), vaultBounty, vaultDescritionHash);
    let activeClaim = await hatVault.activeClaim();
    const claimId = activeClaim[0];
    await hatConnector.connect(claimant).challengeByClaimant(claimId, hackerBounty, await other.getAddress(), evidence, { value: arbitrationCost });
    await arbitrator.connect(governor).giveRuling(2, 1);
    await hatConnector.connect(depositor).challengeByDepositor(claimId, evidence, { value: arbitrationCost });
    await expect(arbitrator.connect(governor).giveRuling(3, 2))
      .to.emit(hatConnector, "Ruling")
      .withArgs(arbitrator.address, 3, 2)
      .to.emit(hatVault, "DismissClaim")
      .withArgs(claimId);

    const disputeData = await hatConnector.disputes(1);
    expect(disputeData[3]).to.equal(2, "Ruling should be 2");
    expect(disputeData[4]).to.equal(true, "Resolved should be true");

    const claimData = await hatConnector.claims(claimId);
    expect(claimData[0]).to.equal(3, "Incorrect status");

    activeClaim = await hatVault.activeClaim();
    expect(activeClaim[0]).to.equal(EMPTY_HASH, "Active claim should be deleted");
  });

  it("Should approve the claim with default parameters after unsuccessful depositor challenge", async () => {
    await hatVault.connect(committee).submitClaim(await claimant.getAddress(), vaultBounty, vaultDescritionHash);
    let activeClaim = await hatVault.activeClaim();
    const claimId = activeClaim[0];
    await hatConnector.connect(claimant).challengeByClaimant(claimId, hackerBounty, await other.getAddress(), evidence, { value: arbitrationCost });
    await arbitrator.connect(governor).giveRuling(2, 1);
    await hatConnector.connect(depositor).challengeByDepositor(claimId, evidence, { value: arbitrationCost });
    await expect(arbitrator.connect(governor).giveRuling(3, 1))
      .to.emit(hatConnector, "Ruling")
      .withArgs(arbitrator.address, 3, 1)
      .to.emit(hatVault, "ApproveClaim")
      .withArgs(claimId, hatConnector.address, await claimant.getAddress(), vaultBounty);

    const disputeData = await hatConnector.disputes(1);
    expect(disputeData[3]).to.equal(1, "Ruling should be 2");
    expect(disputeData[4]).to.equal(true, "Resolved should be true");

    const claimData = await hatConnector.claims(claimId);
    expect(claimData[0]).to.equal(3, "Incorrect status");

    activeClaim = await hatVault.activeClaim();
    expect(activeClaim[0]).to.equal(EMPTY_HASH, "Active claim should be deleted");
  });

  it("Check requires for manual claim submission", async () => {
    await expect(
      hatConnector.connect(submitter).startProcedureToSubmitClaim(await hatVault.maxBounty() + 1, vaultDescritionHash, evidence, { value: arbitrationCost }) 
    ).to.be.revertedWith("Bounty too high");

    await expect(
      hatConnector.connect(submitter).startProcedureToSubmitClaim(hackerBounty, vaultDescritionHash, evidence, { value: arbitrationCost - 1 }) 
    ).to.be.revertedWith("Should pay the full deposit.");
  });

  it("Should set correct values after manual submission", async () => {
    await hatConnector.connect(other).startProcedureToSubmitClaim(vaultBounty, "testDescription", evidence, { value: arbitrationCost });
    // Make a 2nd submission so it's not a default index.
    await hatConnector.connect(submitter).startProcedureToSubmitClaim(hackerBounty, vaultDescritionHash, evidence, { value: arbitrationCost });

    const disputeData = await hatConnector.disputes(1);
    expect(disputeData[0]).to.equal(EMPTY_HASH, "ClaimId should be empty");
    expect(disputeData[1]).to.equal(1, "pendingClaimId should be 1");
    expect(disputeData[2]).to.equal(3, "Incorrect external disputeId"); // 2 disputes were already created at the start and 3rd dispute was done by 1st manual submission.
    expect(disputeData[3]).to.equal(0, "Ruling should be 0");
    expect(disputeData[4]).to.equal(false, "Resolved should be false");

    expect(await hatConnector.getNumberOfRounds(1)).to.equal(1, "Incorrect number of rounds");
    expect(await hatConnector.externalIDtoLocalID(3)).to.equal(1, "Incorrect local dispute Id");

    const pendingClaimData = await hatConnector.pendingClaims(1);
    expect(pendingClaimData[0]).to.equal(hackerBounty, "ClaimId should be empty");
    expect(pendingClaimData[1]).to.equal(await submitter.getAddress(), "Incorrect challenger address");
    expect(pendingClaimData[2]).to.equal(vaultDescritionHash, "Incorrect description");
    expect(pendingClaimData[3]).to.equal(false, "Pending claim should not be validated");
    expect(pendingClaimData[4]).to.equal(false, "Pending claim should not be submitted");

    const dispute = await arbitrator.disputes(3);
    expect(dispute[0]).to.equal(hatConnector.address, "Incorrect arbitrable address");
    expect(dispute[1]).to.equal(2, "Incorrect number of choices");
    expect(dispute[2]).to.equal(1000, "Incorrect fees value stored");
  });

  it("Should emit correct events after manual submission", async () => {
    await expect(hatConnector.connect(submitter).startProcedureToSubmitClaim(hackerBounty, vaultDescritionHash, evidence, { value: arbitrationCost }))
      .to.emit(arbitrator, "DisputeCreation")
      .withArgs(2, hatConnector.address)
      .to.emit(hatConnector, "Dispute")
      .withArgs(arbitrator.address, 2, 2, 0) // Arbitrator, external dispute id, metaevidence id, local dispute id.
      .to.emit(hatConnector, "Evidence")
      .withArgs(arbitrator.address, 0, await submitter.getAddress(), evidence); // Arbitrator, local dispute Id, challenger, evidence
  });

  it("Should correctly reimburse the submitter in case of overpay", async () => {
    const oldBalance = await submitter.getBalance();
    const tx = await hatConnector.connect(submitter).startProcedureToSubmitClaim(hackerBounty, vaultDescritionHash, evidence, { gasPrice: gasPrice, value: oneETH });
    txFee = (await tx.wait()).gasUsed * gasPrice;
    
    newBalance = await submitter.getBalance();
    expect(newBalance).to.equal(
      oldBalance.sub(arbitrationCost).sub(txFee),
      "Submitter was not reimbursed correctly"
    );
  });

  it("Should successfully submit the claim in vault if it was validated by arbitrator", async () => { 
    await hatConnector.connect(other).startProcedureToSubmitClaim(vaultBounty, "testDescription", evidence, { value: arbitrationCost });
    // Make a 2nd submission so it's not a default index.
    await hatConnector.connect(submitter).startProcedureToSubmitClaim(hackerBounty, vaultDescritionHash, evidence, { value: arbitrationCost });

    await expect(arbitrator.connect(governor).giveRuling(3, 2))
      .to.emit(hatConnector, "Ruling")
      .withArgs(arbitrator.address, 3, 2)
      .to.emit(hatConnector, "PendingClaimValidated")
      .withArgs(1);

    const disputeData = await hatConnector.disputes(1);
    expect(disputeData[3]).to.equal(2, "Ruling should be 2");
    expect(disputeData[4]).to.equal(true, "Resolved should be true");

    let pendingClaimData = await hatConnector.pendingClaims(1);
    expect(pendingClaimData[3]).to.equal(true, "Pending claim should be validated");
    expect(pendingClaimData[4]).to.equal(false, "Pending claim should not be submitted");

    const txSubmit = await hatConnector.connect(submitter).submitPendingClaim(1);
    pendingClaimData = await hatConnector.pendingClaims(1);
    expect(pendingClaimData[3]).to.equal(true, "Pending claim should be validated");
    expect(pendingClaimData[4]).to.equal(true, "Pending claim should be submitted");

    const activeClaim = await hatVault.activeClaim();
    const claimId = activeClaim[0];
    expect(claimId).to.not.equal(EMPTY_HASH, "ClaimId should not be empty");
    expect(activeClaim[1]).to.equal(await submitter.getAddress(), "Beneficiary is incorrect");
    expect(activeClaim[2]).to.equal(hackerBounty, "Bounty is incorrect");
    expect(activeClaim[3]).to.equal(hatConnector.address, "Committee address is incorrect");

    expect(txSubmit)
      .to.emit(hatVault, "SubmitClaim")
      .withArgs(claimId, hatConnector.address, await submitter.getAddress(), hackerBounty, vaultDescritionHash);    
  });

  it("Should not send a pending claim that was not validated", async () => { 
    await hatConnector.connect(submitter).startProcedureToSubmitClaim(hackerBounty, vaultDescritionHash, evidence, { value: arbitrationCost });

    await expect(
      hatConnector.connect(submitter).submitPendingClaim(0)
    ).to.be.revertedWith("Claim should be validated");

    await arbitrator.connect(governor).giveRuling(2, 0); // Arbitrator did not side with submitter, claim should not be sent.

    await expect(
      hatConnector.connect(submitter).submitPendingClaim(0)
    ).to.be.revertedWith("Claim should be validated");

    const activeClaim = await hatVault.activeClaim();
    expect(activeClaim[0]).to.equal(EMPTY_HASH, "Active claim should be empty");
  });

  it("Should not send validated claim 2 times", async () => { 
    await hatConnector.connect(submitter).startProcedureToSubmitClaim(hackerBounty, vaultDescritionHash, evidence, { value: arbitrationCost });
    await arbitrator.connect(governor).giveRuling(2, 2);
    await hatConnector.connect(submitter).submitPendingClaim(0);

    await expect(
      hatConnector.connect(submitter).submitPendingClaim(0)
    ).to.be.revertedWith("Already submitted");
  });

  it("Should correctly fund an appeal and fire the events", async () => {
    let oldBalance;
    let newBalance;
    let txFundAppeal;
    let txFee;
    let roundInfo;
    
    await hatVault.connect(committee).submitClaim(await claimant.getAddress(), vaultBounty, vaultDescritionHash);
    let activeClaim = await hatVault.activeClaim();
    const claimId = activeClaim[0];

    await hatConnector.connect(claimant).challengeByClaimant(claimId, hackerBounty, await other.getAddress(), evidence, { value: arbitrationCost });

    await expect(hatConnector.connect(crowdfunder1).fundAppeal(0, 3, { value: 1000 })).to.be.revertedWith(
      "Side out of bounds"
    );

    // Check that can't appeal if there was no ruling.
    await expect(hatConnector.connect(crowdfunder1).fundAppeal(0, 2, { value: 1000 })).to.be.revertedWith(
      "Appeal period is over."
    );

    await arbitrator.giveAppealableRuling(2, 1, appealCost, appealTimeout); // 0 local dispute is paired with 2 external dispute.

    // loserFee = appealCost + (appealCost * loserMultiplier / 10000) // 5000 + 5000 * 7/10 = 8500
    // 1st Funding ////////////////////////////////////
    oldBalance = await crowdfunder1.getBalance();
    txFundAppeal = await hatConnector
      .connect(crowdfunder1)
      .fundAppeal(0, 2, { gasPrice: gasPrice, value: appealCost }); // This value doesn't fund fully.
    txFee = (await txFundAppeal.wait()).gasUsed * gasPrice;

    newBalance = await crowdfunder1.getBalance();
    expect(newBalance).to.equal(
      oldBalance.sub(5000).sub(txFee),
      "The crowdfunder has incorrect balance after the first funding"
    );

    roundInfo = await hatConnector.getRoundInfo(0, 0);

    expect(roundInfo[0][2]).to.equal(5000, "Incorrect amount of paidFees registered after the first funding");
    expect(roundInfo[1][2]).to.equal(false, "The side should not be fully funded after partial funding");
    expect(roundInfo[2]).to.equal(0, "FeeRewards value should be 0 after partial funding");

    await expect(txFundAppeal)
      .to.emit(hatConnector, "Contribution")
      .withArgs(0, 0, 2, await crowdfunder1.getAddress(), 5000); // local dispute id, NbRound, Ruling, Sender, Amount

    // 2nd Funding ////////////////////////////////////
    oldBalance = newBalance;
    txFundAppeal = await hatConnector
      .connect(crowdfunder1)
      .fundAppeal(0, 2, { gasPrice: gasPrice, value: oneETH }); // Overpay to check that it's handled correctly.
    txFee = (await txFundAppeal.wait()).gasUsed * gasPrice;
    newBalance = await crowdfunder1.getBalance();
    expect(newBalance).to.equal(
      oldBalance.sub(3500).sub(txFee),
      "The crowdfunder has incorrect balance after the second funding"
    );

    roundInfo = await hatConnector.getRoundInfo(0, 0);
    expect(roundInfo[0][2]).to.equal(8500, "Incorrect paidFees value of the fully funded side");
    expect(roundInfo[1][2]).to.equal(true, "The side should be fully funded after the second funding");
    expect(roundInfo[2]).to.equal(8500, "Incorrect feeRewards value after the full funding");
    expect(roundInfo[3][0]).to.equal(2, "Incorrect funded side stored");

    const contributionInfo = await hatConnector.getContributions(
      0,
      0,
      await crowdfunder1.getAddress()
    );
    expect(contributionInfo[0]).to.equal(0, "0 side should not have contributions");
    expect(contributionInfo[1]).to.equal(0, "1 side should not have contributions");
    expect(contributionInfo[2]).to.equal(8500, "Incorrect contribution value returned by contrbution info");

    expect(await hatConnector.getNumberOfRounds(0)).to.equal(1, "Number of rounds should not increase");

    await expect(txFundAppeal)
      .to.emit(hatConnector, "Contribution")
      .withArgs(0, 0, 2, await crowdfunder1.getAddress(), 3500)
      .to.emit(hatConnector, "RulingFunded")
      .withArgs(0, 0, 2);

    await expect(
      hatConnector.connect(crowdfunder1).fundAppeal(0, 2, { value: appealCost })
    ).to.be.revertedWith("Appeal fee is already paid.");
  });

  it("Should correctly create and fund subsequent appeal rounds", async () => {
    let roundInfo;

    await hatVault.connect(committee).submitClaim(await claimant.getAddress(), vaultBounty, vaultDescritionHash);
    let activeClaim = await hatVault.activeClaim();
    const claimId = activeClaim[0];

    await hatConnector.connect(claimant).challengeByClaimant(claimId, hackerBounty, await other.getAddress(), evidence, { value: arbitrationCost });
    await arbitrator.giveAppealableRuling(2, 1, appealCost, appealTimeout);

    await hatConnector.connect(crowdfunder1).fundAppeal(0, 2, { value: 8500 });
    await hatConnector.connect(crowdfunder2).fundAppeal(0, 1, { value: 5000 }); // Winner appeal fee is 6500 full.

    expect(await hatConnector.getNumberOfRounds(0)).to.equal(1, "Number of rounds should not increase");

    await hatConnector.connect(crowdfunder2).fundAppeal(0, 1, { value: 1500 });

    expect(await hatConnector.getNumberOfRounds(0)).to.equal(
      2,
      "Number of rounds should increase after two sides are fully funded"
    );

    roundInfo = await hatConnector.getRoundInfo(0, 0);
    expect(roundInfo[2]).to.equal(10000, "Incorrect feeRewards value after creating a 2nd round"); // 8500 + 6500 - 5000.

    await arbitrator.giveAppealableRuling(2, 2, appealCost, appealTimeout);

    await hatConnector.connect(crowdfunder1).fundAppeal(0, 0, { value: oneETH });

    roundInfo = await hatConnector.getRoundInfo(0, 1);
    expect(roundInfo[0][0]).to.equal(8500, "Incorrect paidFees value after funding 0 side"); // total loser fee = 5000 + 5000 * 0.7
    expect(roundInfo[1][0]).to.equal(true, "The side should be fully funded");
    expect(roundInfo[3][0]).to.equal(0, "0 side was not stored correctly");

    await hatConnector.connect(crowdfunder2).fundAppeal(0, 2, { value: 6500 });

    roundInfo = await hatConnector.getRoundInfo(0, 1);
    expect(roundInfo[0][2]).to.equal(6500, "Incorrect paidFees value for 2nd crowdfunder");
    expect(roundInfo[1][2]).to.equal(true, "The side should be fully funded");
    expect(roundInfo[2]).to.equal(10000, "Incorrect feeRewards value after creating a 3rd round"); // 8500 + 6500 - 5000.
    expect(roundInfo[3][1]).to.equal(2, "2 side was not stored correctly");

    expect(await hatConnector.getNumberOfRounds(0)).to.equal(3, "Number of rounds should increase to 3");

    // Check that newly created round is empty.
    roundInfo = await hatConnector.getRoundInfo(0, 2);
    expect(roundInfo[2]).to.equal(0, "Incorrect feeRewards value in fresh round");
  });

  it("Should not fund the appeal after the timeout", async () => {
    await hatVault.connect(committee).submitClaim(await claimant.getAddress(), vaultBounty, vaultDescritionHash);
    let activeClaim = await hatVault.activeClaim();
    const claimId = activeClaim[0];
    await hatConnector.connect(claimant).challengeByClaimant(claimId, hackerBounty, await other.getAddress(), evidence, { value: arbitrationCost });

    await arbitrator.giveAppealableRuling(2, 1, appealCost, appealTimeout);

    await utils.increaseTime(appealTimeout / 2 + 1);

    // Loser.
    await expect(
      hatConnector.connect(crowdfunder1).fundAppeal(0, 2, { value: appealCost })
    ).to.be.revertedWith("Appeal period is over for loser");

    // Adding another half will cover the whole period.
    await utils.increaseTime(appealTimeout / 2 + 1);

    // Winner.
    await expect(
      hatConnector.connect(crowdfunder1).fundAppeal(0, 1, { value: appealCost })
    ).to.be.revertedWith("Appeal period is over.");
  });

  it("Should not fund appeal if dispute is resolved", async () => {
    await hatVault.connect(committee).submitClaim(await claimant.getAddress(), vaultBounty, vaultDescritionHash);
    let activeClaim = await hatVault.activeClaim();
    const claimId = activeClaim[0];
    await hatConnector.connect(claimant).challengeByClaimant(claimId, hackerBounty, await other.getAddress(), evidence, { value: arbitrationCost });
    await arbitrator.connect(governor).giveRuling(2, 1);

    await expect(
      hatConnector.connect(crowdfunder1).fundAppeal(0, 1, { value: appealCost })
    ).to.be.revertedWith("Dispute already resolved.");
  });

  it("Should correctly withdraw appeal fees if a dispute had winner/loser", async () => {
    let oldBalance1;
    let oldBalance2;
    let newBalance;
    let newBalance1;
    let newBalance2;
    const claimantAddress = await claimant.getAddress();
    const crowdfunder1Address = await crowdfunder1.getAddress();
    const crowdfunder2Address = await crowdfunder2.getAddress();

    await hatVault.connect(committee).submitClaim(await claimant.getAddress(), vaultBounty, vaultDescritionHash);
    let activeClaim = await hatVault.activeClaim();
    const claimId = activeClaim[0];
    await hatConnector.connect(claimant).challengeByClaimant(claimId, hackerBounty, await other.getAddress(), evidence, { value: arbitrationCost });

    await arbitrator.giveAppealableRuling(2, 1, appealCost, appealTimeout);

    // LoserFee = 8500, WinnerFee = 6500. AppealCost = 5000.
    // 0 Round.
    await hatConnector.connect(claimant).fundAppeal(0, 2, { value: 4000 });
    await hatConnector.connect(crowdfunder1).fundAppeal(0, 2, { value: oneETH });

    await hatConnector.connect(crowdfunder2).fundAppeal(0, 1, { value: 6000 });
    await hatConnector.connect(crowdfunder1).fundAppeal(0, 1, { value: 6000 });

    await arbitrator.giveAppealableRuling(2, 1, appealCost, appealTimeout);

    // 1 Round.
    await hatConnector.connect(claimant).fundAppeal(0, 2, { value: 500 });
    await hatConnector.connect(crowdfunder1).fundAppeal(0, 2, { value: 8000 });

    await hatConnector.connect(crowdfunder2).fundAppeal(0, 1, { value: 20000 });

    await arbitrator.giveAppealableRuling(2, 1, appealCost, appealTimeout);

    // 2 Round.
    // Partially funded side should be reimbursed.
    await hatConnector.connect(claimant).fundAppeal(0, 2, { value: 8499 });

    // Winner doesn't have to fund appeal in this case but let's check if it causes unexpected behaviour.
    await hatConnector.connect(crowdfunder2).fundAppeal(0, 1, { value: oneETH });

    await utils.increaseTime(appealTimeout + 1);

    await expect(hatConnector.withdrawFeesAndRewards(0, claimantAddress, 0, 2)).to.be.revertedWith(
      "Dispute not resolved"
    );

    await arbitrator.executeRuling(2);

    let ruling = await arbitrator.currentRuling(2);

    const disputeData = await hatConnector.disputes(0);
    expect(disputeData[3]).to.equal(ruling, "Incorrect ruling");
    expect(disputeData[4]).to.equal(true, "Resolved should be true");

    const oldBalance = await claimant.getBalance();
    oldBalance1 = await crowdfunder1.getBalance();
    oldBalance2 = await crowdfunder2.getBalance();

    // Withdraw 0 round.
    await hatConnector.withdrawFeesAndRewards(0, claimantAddress, 0, 2);

    newBalance = await claimant.getBalance();
    expect(newBalance).to.equal(oldBalance, "The balance of the claimant should stay the same (withdraw 0 round)");

    await hatConnector.withdrawFeesAndRewards(0, claimantAddress, 0, 1);

    newBalance = await claimant.getBalance();
    expect(newBalance).to.equal(
      oldBalance,
      "The balance of the claimant should stay the same (withdraw 0 round from winning ruling)"
    );

    await hatConnector.withdrawFeesAndRewards(0, crowdfunder1Address, 0, 2);

    newBalance1 = await crowdfunder1.getBalance();
    expect(newBalance1).to.equal(
      oldBalance1,
      "The balance of the crowdfunder1 should stay the same (withdraw 0 round)"
    );

    await expect(hatConnector.withdrawFeesAndRewards(0, crowdfunder1Address, 0, 1))
      .to.emit(hatConnector, "Withdrawal")
      .withArgs(0, 0, 1, crowdfunder1Address, 769); // The reward is 769 = (500/6500 * 10000)

    newBalance1 = await crowdfunder1.getBalance();
    expect(newBalance1).to.equal(
      oldBalance1.add(769),
      "The balance of the crowdfunder1 is incorrect after withdrawing from winning ruling 0 round"
    );

    oldBalance1 = newBalance1;

    await hatConnector.withdrawFeesAndRewards(0, crowdfunder1Address, 0, 1);

    newBalance1 = await crowdfunder1.getBalance();
    expect(newBalance1).to.equal(
      oldBalance1,
      "The balance of the crowdfunder1 should stay the same after withdrawing the 2nd time"
    );

    await hatConnector.withdrawFeesAndRewards(0, crowdfunder2Address, 0, 1);

    newBalance2 = await crowdfunder2.getBalance();
    // 12 / 13 * 10000 = 9230
    expect(newBalance2).to.equal(
      oldBalance2.add(9230),
      "The balance of the crowdfunder2 is incorrect (withdraw 0 round)"
    );

    oldBalance2 = newBalance2;

    let contributionInfo = await hatConnector.getContributions(
      0,
      0,
      crowdfunder1Address
    );
    expect(contributionInfo[1]).to.equal(0, "Contribution of crowdfunder1 should be 0");
    contributionInfo = await hatConnector.getContributions(0, 0, crowdfunder2Address);
    expect(contributionInfo[1]).to.equal(0, "Contribution of crowdfunder2 should be 0");

    // Withdraw 1 round.
    await hatConnector.withdrawFeesAndRewards(0, claimantAddress, 1, 1);
    await hatConnector.withdrawFeesAndRewards(0, claimantAddress, 1, 2);

    await hatConnector.withdrawFeesAndRewards(0, crowdfunder1Address, 1, 1);
    await hatConnector.withdrawFeesAndRewards(0, crowdfunder1Address, 1, 2);

    await hatConnector.withdrawFeesAndRewards(0, crowdfunder2Address, 1, 1);

    newBalance = await claimant.getBalance();
    newBalance1 = await crowdfunder1.getBalance();
    newBalance2 = await crowdfunder2.getBalance();
    expect(newBalance).to.equal(oldBalance, "The balance of the claimant should stay the same (withdraw 1 round)");
    expect(newBalance1).to.equal(
      oldBalance1,
      "The balance of the crowdfunder1 should stay the same (withdraw 1 round)"
    );
    expect(newBalance2).to.equal(
      oldBalance2.add(10000),
      "The balance of the crowdfunder2 is incorrect (withdraw 1 round)"
    );

    contributionInfo = await hatConnector.getContributions(0, 1, crowdfunder2Address);
    expect(contributionInfo[1]).to.equal(0, "Contribution of crowdfunder2 should be 0 in 1 round");
    oldBalance2 = newBalance2;

    // Withdraw 2 round.
    await hatConnector.withdrawFeesAndRewards(0, claimantAddress, 2, 2);
    await hatConnector.withdrawFeesAndRewards(0, crowdfunder2Address, 2, 1);

    newBalance = await claimant.getBalance();
    newBalance2 = await crowdfunder2.getBalance();
    expect(newBalance).to.equal(oldBalance.add(8499), "The balance of the claimant is incorrect (withdraw 2 round)");
    expect(newBalance2).to.equal(
      oldBalance2.add(6500),
      "The balance of the crowdfunder2 is incorrect (withdraw 2 round)"
    );

    contributionInfo = await hatConnector.getContributions(0, 2, crowdfunder2Address);
    expect(contributionInfo[1]).to.equal(0, "Contribution of crowdfunder2 should be 0 in 2 round");
    contributionInfo = await hatConnector.getContributions(0, 2, claimantAddress);
    expect(contributionInfo[2]).to.equal(0, "Contribution of claimant should be 0 in 2 round");
  });

  it("Should correctly withdraw appeal fees if the winner did not pay the fees in the round", async () => {
    let oldBalance;
    let newBalance;

    await hatVault.connect(committee).submitClaim(await claimant.getAddress(), vaultBounty, vaultDescritionHash);
    let activeClaim = await hatVault.activeClaim();
    const claimId = activeClaim[0];
    await hatConnector.connect(claimant).challengeByClaimant(claimId, hackerBounty, await other.getAddress(), evidence, { value: arbitrationCost });

    await arbitrator.giveAppealableRuling(2, 1, appealCost, appealTimeout);

    // LoserFee = 8500. AppealCost = 5000.
    await hatConnector.connect(claimant).fundAppeal(0, 2, { value: 5000 });
    await hatConnector.connect(crowdfunder1).fundAppeal(0, 2, { value: 3500 });

    await hatConnector.connect(crowdfunder2).fundAppeal(0, 0, { value: 1000 });
    await hatConnector.connect(crowdfunder1).fundAppeal(0, 0, { value: 10000 });

    await arbitrator.giveAppealableRuling(2, 1, appealCost, appealTimeout); // No one funded the winning ruling, so contributions to 0 and 2 ruling should be distributed proportionally

    await utils.increaseTime(appealTimeout + 1);

    await arbitrator.executeRuling(2);

    oldBalance = await claimant.getBalance();
    await hatConnector.withdrawFeesAndRewards(0, await claimant.getAddress(), 0, 2);
    newBalance = await claimant.getBalance();
    expect(newBalance).to.equal(oldBalance.add(3529), "The balance of the claimant is incorrect"); // 5000 * 12000 / 17000.

    oldBalance = await crowdfunder1.getBalance();
    await hatConnector.withdrawFeesAndRewards(0, await crowdfunder1.getAddress(), 0, 2);
    newBalance = await crowdfunder1.getBalance();
    expect(newBalance).to.equal(oldBalance.add(2470), "The balance of the crowdfunder1 is incorrect (1 ruling)"); // 3500 * 12000 / 17000.

    oldBalance = newBalance;
    await hatConnector.withdrawFeesAndRewards(0, await crowdfunder1.getAddress(), 0, 0);
    newBalance = await crowdfunder1.getBalance();
    expect(newBalance).to.equal(oldBalance.add(5294), "The balance of the crowdfunder1 is incorrect (4 ruling)"); // 7500 * 12000 / 17000.

    oldBalance = await crowdfunder2.getBalance();
    await hatConnector.withdrawFeesAndRewards(0, await crowdfunder2.getAddress(), 0, 0);
    newBalance = await crowdfunder2.getBalance();
    expect(newBalance).to.equal(oldBalance.add(705), "The balance of the crowdfunder2 is incorrect"); // 1000 * 12000 / 17000.
  });

  it("Should correctly withdraw appeal fees for multiple rounds", async () => {
    let oldBalance;
    let newBalance;
    let totalAmount;

    await hatVault.connect(committee).submitClaim(await claimant.getAddress(), vaultBounty, vaultDescritionHash);
    let activeClaim = await hatVault.activeClaim();
    const claimId = activeClaim[0];
    await hatConnector.connect(claimant).challengeByClaimant(claimId, hackerBounty, await other.getAddress(), evidence, { value: arbitrationCost });

    await arbitrator.giveAppealableRuling(2, 1, appealCost, appealTimeout);

    // LoserFee = 8500. AppealCost = 5000.
    // WinnerFee = 6500.
    await hatConnector.connect(claimant).fundAppeal(0, 2, { value: 5000 });
    await hatConnector.connect(crowdfunder1).fundAppeal(0, 2, { value: 3500 });

    await hatConnector.connect(claimant).fundAppeal(0, 1, { value: 1000 });
    await hatConnector.connect(crowdfunder1).fundAppeal(0, 1, { value: 10000 });

    await arbitrator.giveAppealableRuling(2, 1, appealCost, appealTimeout);

    await hatConnector.connect(claimant).fundAppeal(0, 0, { value: 17 });
    await hatConnector.connect(crowdfunder1).fundAppeal(0, 0, { value: 22 });

    await utils.increaseTime(appealTimeout + 1);

    await arbitrator.executeRuling(2);

    oldBalance = await claimant.getBalance();

    totalAmount = await hatConnector.getTotalWithdrawableAmount(0, await claimant.getAddress(), 1);
    expect(totalAmount).to.equal(1538, "Incorrect withdrawable amount for 2 ruling");
    totalAmount = await hatConnector.getTotalWithdrawableAmount(0, await claimant.getAddress(), 0);
    expect(totalAmount).to.equal(17, "Incorrect withdrawable amount for 0 ruling");

    await hatConnector.withdrawFeesAndRewardsForAllRounds(0, await claimant.getAddress(), 2);
    await hatConnector.withdrawFeesAndRewardsForAllRounds(0, await claimant.getAddress(), 1);
    await hatConnector.withdrawFeesAndRewardsForAllRounds(0, await claimant.getAddress(), 0);

    totalAmount = await hatConnector.getTotalWithdrawableAmount(0, await claimant.getAddress(), 1);
    expect(totalAmount).to.equal(0, "Incorrect withdrawable amount for 2 ruling after withdrawal");
    totalAmount = await hatConnector.getTotalWithdrawableAmount(0, await claimant.getAddress(), 0);
    expect(totalAmount).to.equal(0, "Incorrect withdrawable amount for 0 ruling after withdrawal");

    newBalance = await claimant.getBalance();
    // 1000 * 10000 / 6500 + 17 = 1538 + 17
    expect(newBalance).to.equal(oldBalance.add(1555), "The balance of the claimant is incorrect");

    oldBalance = await crowdfunder1.getBalance();
    await hatConnector.withdrawFeesAndRewardsForAllRounds(0, await crowdfunder1.getAddress(), 2);
    await hatConnector.withdrawFeesAndRewardsForAllRounds(0, await crowdfunder1.getAddress(), 1);
    await hatConnector.withdrawFeesAndRewardsForAllRounds(0, await crowdfunder1.getAddress(), 0);

    newBalance = await crowdfunder1.getBalance();
    // 5500 * 10000 / 6500 + 22 = 8461 + 22
    expect(newBalance).to.equal(oldBalance.add(8483), "The balance of the crowdfunder1 is incorrect");
  });

  it("Should switch the ruling if the loser paid appeal fees while winner did not", async () => {
    await hatVault.connect(committee).submitClaim(await claimant.getAddress(), vaultBounty, vaultDescritionHash);
    let activeClaim = await hatVault.activeClaim();
    const claimId = activeClaim[0];
    await hatConnector.connect(claimant).challengeByClaimant(claimId, hackerBounty, await other.getAddress(), evidence, { value: arbitrationCost });

    await arbitrator.giveAppealableRuling(2, 1, appealCost, appealTimeout); // 1 ruling that dismisses claim should be switched

    await hatConnector.connect(claimant).fundAppeal(0, 2, { value: 8500 });
    await utils.increaseTime(appealTimeout + 1);
    await expect(arbitrator.executeRuling(2))
      .to.emit(hatConnector, "Ruling")
      .withArgs(arbitrator.address, 2, 2)
      .to.emit(hatVault, "ApproveClaim") // Claim should be approved
      .withArgs(claimId, hatConnector.address, await other.getAddress(), hackerBounty);

    const disputeData = await hatConnector.disputes(0);
    expect(disputeData[3]).to.equal(2, "Ruling should be switched to 2");
    expect(disputeData[4]).to.equal(true, "Resolved should be true");
  });

  it("Should correctly submit evidence", async () => {
    await expect(
      hatConnector.connect(other).submitEvidence(0, "Test")
    ).to.be.reverted; // Dispute doesn't exist so it should revert
    
    await hatVault.connect(committee).submitClaim(await claimant.getAddress(), vaultBounty, vaultDescritionHash);
    let activeClaim = await hatVault.activeClaim();
    const claimId = activeClaim[0];
    await hatConnector.connect(claimant).challengeByClaimant(claimId, hackerBounty, await other.getAddress(), evidence, { value: arbitrationCost });
    
    await expect(hatConnector.connect(other).submitEvidence(0, "Test"))
      .to.emit(hatConnector, "Evidence")
      .withArgs(arbitrator.address, 0, await other.getAddress(), "Test");

    await arbitrator.connect(governor).giveRuling(2, 2);

    await expect(
      hatConnector.connect(other).submitEvidence(0, "Test2")
    ).to.be.revertedWith("Dispute already resolved");
  });
});
