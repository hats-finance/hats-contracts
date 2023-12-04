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
const metaEvidence = "ipfs/X";
const winnerMultiplier = 3000;
const loserMultiplier = 7000;
const evidence = "Evidence string";
const resolutionChallengePeriod = 300;
const vaultBounty = 30;
const expertCommitteeBounty = 50;
const vaultDescritionHash = "New Claim";

let HatConnector;
let Arbitrator;
let HatArbitrator;
let hatConnector;
let arbitrator;
let hatArbitrator;
let BadEthReceiver;
let badEthReceiver;

let activeClaim;
let claimId;

let governor;
let claimant;
let crowdfunder1;
let crowdfunder2;
let committee;
let other;

contract("HATKlerosConnector", () => {
  beforeEach("initialize the contract", async function () {
    [governor, claimant, disputer, challenger, crowdfunder1, crowdfunder2, committee, expertCommittee, other] = await ethers.getSigners();
    vaultChalengePeriod = 1000;

    Arbitrator = await ethers.getContractFactory("AutoAppealableArbitrator", governor);
    arbitrator = await Arbitrator.deploy(arbitrationCost);

    // Create disputes so the index in tests will not be a default value.
    await arbitrator.connect(other).createDispute(42, arbitratorExtraData, { value: arbitrationCost });
    await arbitrator.connect(other).createDispute(4, arbitratorExtraData, { value: arbitrationCost });

    HatVault = await ethers.getContractFactory("HatVaultForConnectorMock", governor);
    hatVault = await HatVault.deploy(ZERO_ADDRESS, vaultChalengePeriod);

    HatArbitrator = await ethers.getContractFactory("HATArbitratorForConnector", governor);
    hatArbitrator = await HatArbitrator.deploy(resolutionChallengePeriod);

    await hatVault.connect(governor).setArbitrator(hatArbitrator.address);

    HatConnector = await ethers.getContractFactory("HATKlerosConnector", governor);
    hatConnector = await HatConnector.deploy(
      arbitrator.address,
      arbitratorExtraData,
      hatArbitrator.address,
      metaEvidence,
      winnerMultiplier,
      loserMultiplier
    );

    BadEthReceiver = await ethers.getContractFactory("BadKlerosConnectorEthReceiver", governor);
    badEthReceiver = await BadEthReceiver.deploy();
    
    await hatArbitrator.connect(governor).setCourt(hatConnector.address);
    // Initial setup. Create claim, challenge it, accept the challenge by committee and invoke kleros arbitrator after
    await hatVault.connect(committee).submitClaim(await claimant.getAddress(), vaultBounty, vaultDescritionHash);
    activeClaim = await hatVault.getActiveClaim();
    claimId = activeClaim[0];
    // Claim is disputed by the disputer and vault is notified.
    await hatArbitrator.connect(disputer).dispute(hatVault.address, claimId);
    // Expert committee arbitrates the dispute
    await hatArbitrator.connect(expertCommittee).acceptDispute(hatVault.address, claimId, expertCommitteeBounty, await claimant.getAddress());
  });

  it("Should correctly set initial values", async () => {
    expect(await hatConnector.owner()).to.equal(await governor.getAddress());
    expect(await hatConnector.klerosArbitrator()).to.equal(arbitrator.address);
    expect(await hatConnector.arbitratorExtraData()).to.equal(arbitratorExtraData);
    expect(await hatConnector.hatArbitrator()).to.equal(hatArbitrator.address);
    expect(await hatConnector.winnerMultiplier()).to.equal(winnerMultiplier);
    expect(await hatConnector.loserMultiplier()).to.equal(loserMultiplier);
    expect(await hatConnector.loserAppealPeriodMultiplier()).to.equal(5000);
    expect(await hatConnector.metaEvidenceUpdates()).to.equal(0);

    expect(await hatArbitrator.court()).to.equal(hatConnector.address);
    const resolution = await hatArbitrator.resolutions(hatVault.address, claimId);
  
    expect(resolution[0]).to.equal(await claimant.getAddress());
    expect(resolution[1]).to.equal(expertCommitteeBounty);
    expect(resolution[2]).to.not.equal(0, "Resolve timestamp should not be 0");

    activeClaim = await hatVault.getActiveClaim();
    expect(activeClaim[5]).to.not.equal(0, "Challenge timestamp should not be 0");
  });

  it("Should make governance changes", async () => {
    await expect(
      hatConnector.connect(other).changeWinnerMultiplier(101)
    ).to.be.revertedWith("Ownable: caller is not the owner");
    await hatConnector.connect(governor).changeWinnerMultiplier(101);
    expect(await hatConnector.winnerMultiplier()).to.equal(101);

    await expect(
      hatConnector.connect(other).changeLoserMultiplier(202)
    ).to.be.revertedWith("Ownable: caller is not the owner");
    await hatConnector.connect(governor).changeLoserMultiplier(202);
    expect(await hatConnector.loserMultiplier()).to.equal(202);

    await expect(
      hatConnector.connect(other).changeMetaEvidence("New meta")
    ).to.be.revertedWith("Ownable: caller is not the owner");
    await expect(hatConnector.connect(governor).changeMetaEvidence("New meta"))
      .to.emit(hatConnector, "MetaEvidence")
      .withArgs(1, "New meta");
    expect(await hatConnector.metaEvidenceUpdates()).to.equal(1);    
  });

  it("Check most of the requires for hacker challenge", async () => {      
    await expect(
      hatConnector.connect(other).notifyArbitrator(claimId, evidence, hatVault.address, await challenger.getAddress(), { value: arbitrationCost })
    ).to.be.revertedWith("Wrong caller");

    await expect(
      hatArbitrator.connect(challenger).challengeResolution(hatVault.address, claimId, evidence, { value: arbitrationCost - 1 })
    ).to.be.revertedWith("Should pay the full deposit.");

    await utils.increaseTime(resolutionChallengePeriod - 1);

    await expect(
      hatArbitrator.connect(challenger).challengeResolution(hatVault.address, claimId, evidence, { value: arbitrationCost })
    ).to.be.revertedWith("ChallengePeriodPassed");
  });

  it("Should set correct values after hacker challenge", async () => {
    await hatArbitrator.connect(challenger).challengeResolution(hatVault.address, claimId, evidence, { value: arbitrationCost });

    expect(await hatConnector.claimChallenged(claimId)).to.equal(true, "Claim should be challenged");

    const disputeData = await hatConnector.disputes(0); // It's the first dispute
    expect(disputeData[0]).to.equal(claimId, "Incorrect claimId");
    expect(disputeData[1]).to.equal(2, "Incorrect external disputeId"); // 2 disputes were already created before, so this should be 3rd external dispute.
    expect(disputeData[2]).to.equal(0, "Ruling should be 0");
    expect(disputeData[3]).to.equal(false, "Resolved should be false");
    expect(disputeData[4]).to.equal(hatVault.address, "Incorrect hat vault address");

    expect(await hatConnector.getNumberOfRounds(0)).to.equal(1, "Incorrect number of rounds");
    expect(await hatConnector.externalIDtoLocalID(2)).to.equal(0, "Incorrect local dispute Id");

    const currentTimeStamp = (await web3.eth.getBlock("latest")).timestamp;
    expect(await hatArbitrator.resolutionChallengedAt(hatVault.address, claimId)).to.equal(currentTimeStamp, "Wrong timestamp for resolution challenge");

    const dispute = await arbitrator.disputes(2);
    expect(dispute[0]).to.equal(hatConnector.address, "Incorrect arbitrable address");
    expect(dispute[1]).to.equal(2, "Incorrect number of choices");
    expect(dispute[2]).to.equal(1000, "Incorrect fees value stored"); 
  });

  it("Should not allow to challenge 2nd time", async () => {
    await hatArbitrator.connect(challenger).challengeResolution(hatVault.address, claimId, evidence, { value: arbitrationCost });
    await expect(
      hatArbitrator.connect(challenger).challengeResolution(hatVault.address, claimId, evidence, { value: arbitrationCost })
    ).to.be.revertedWith("Claim already challenged");
  });

  it("Should emit correct events after challenge", async () => {
    await expect(hatArbitrator.connect(challenger).challengeResolution(hatVault.address, claimId, evidence, { value: arbitrationCost }))
      .to.emit(arbitrator, "DisputeCreation")
      .withArgs(2, hatConnector.address)
      .to.emit(hatConnector, "Challenged")
      .withArgs(claimId)
      .to.emit(hatConnector, "Dispute")
      .withArgs(arbitrator.address, 2, 0, 0) // Arbitrator, external dispute id, metaevidence id, local dispute id.
      .to.emit(hatConnector, "Evidence")
      .withArgs(arbitrator.address, 0, await challenger.getAddress(), evidence); // Arbitrator, local dispute Id, challenger, evidence
  });

  it("Should correctly reimburse the claimant in case of overpay", async () => {
    await ethers.provider.send("hardhat_setBalance", [
      await challenger.getAddress(),
      "0x77436DCB99D4CE4C0000", // 100 ETH
    ]);

    await expect(
      badEthReceiver.connect(challenger).challengeResolution(hatArbitrator.address, hatVault.address, claimId, evidence, { gasPrice: gasPrice, value: oneETH })
    ).to.be.revertedWith("Failed to send ETH");

    const oldBalance = await challenger.getBalance();
    const tx = await hatArbitrator.connect(challenger).challengeResolution(hatVault.address, claimId, evidence, { gasPrice: gasPrice, value: oneETH });
    txFee = (await tx.wait()).gasUsed * gasPrice;
    
    newBalance = await challenger.getBalance();
    expect(newBalance).to.equal(
      oldBalance.sub(arbitrationCost).sub(txFee),
      "Claimant was not reimbursed correctly"
    );
  });

  it("Check number of ruling options", async () => {
    expect(await hatConnector.numberOfRulingOptions(0)).to.equal(2);
  });

  it("Check multipliers", async () => {
    expect((await hatConnector.getMultipliers())[0].toString()).to.equal(winnerMultiplier.toString());
    expect((await hatConnector.getMultipliers())[1].toString()).to.equal(loserMultiplier.toString());
    expect((await hatConnector.getMultipliers())[2].toString()).to.equal("5000");
    expect((await hatConnector.getMultipliers())[3].toString()).to.equal("10000");
  });

  it("Should correctly execute resolution if the court decided so", async () => {
    await hatArbitrator.connect(challenger).challengeResolution(hatVault.address, claimId, evidence, { value: arbitrationCost });
    await expect(arbitrator.connect(governor).giveRuling(2, 1))
      .to.emit(hatConnector, "Ruling")
      .withArgs(arbitrator.address, 2, 1)
      .to.emit(hatVault, "ApproveClaim")
      .withArgs(claimId, hatArbitrator.address, await claimant.getAddress(), expertCommitteeBounty);

    const disputeData = await hatConnector.disputes(0);
    expect(disputeData[0]).to.equal(claimId, "Incorrect claimId");
    expect(disputeData[1]).to.equal(2, "Incorrect external disputeId");
    expect(disputeData[2]).to.equal(1, "Ruling should be 1");
    expect(disputeData[3]).to.equal(true, "Resolved should be true");
    expect(disputeData[4]).to.equal(hatVault.address, "Incorrect hat vault address");

    activeClaim = await hatVault.getActiveClaim();
    expect(activeClaim[0]).to.equal(EMPTY_HASH, "Active claim should be deleted");
  });

  it("Check requires for rule", async () => {
    await hatArbitrator.connect(challenger).challengeResolution(hatVault.address, claimId, evidence, { value: arbitrationCost });
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

  it("Should correctly dismiss the resolution", async () => {
    await hatArbitrator.connect(challenger).challengeResolution(hatVault.address, claimId, evidence, { value: arbitrationCost });
    await expect(arbitrator.connect(governor).giveRuling(2, 2)) 
      .to.emit(hatConnector, "Ruling")
      .withArgs(arbitrator.address, 2, 2)
      .to.emit(hatVault, "DismissClaim")
      .withArgs(claimId);

    const disputeData = await hatConnector.disputes(0);
    expect(disputeData[0]).to.equal(claimId, "Incorrect claimId");
    expect(disputeData[1]).to.equal(2, "Incorrect external disputeId");
    expect(disputeData[2]).to.equal(2, "Ruling should be 2");
    expect(disputeData[3]).to.equal(true, "Resolved should be true");
    expect(disputeData[4]).to.equal(hatVault.address, "Incorrect hat vault address");

    activeClaim = await hatVault.getActiveClaim();
    expect(activeClaim[0]).to.equal(EMPTY_HASH, "Active claim should be deleted");
  });

  it("Should dismiss when 0 ruling", async () => {
    await hatArbitrator.connect(challenger).challengeResolution(hatVault.address, claimId, evidence, { value: arbitrationCost });
    await expect(arbitrator.connect(governor).giveRuling(2, 0)) 
      .to.emit(hatConnector, "Ruling")
      .withArgs(arbitrator.address, 2, 0)
      .to.emit(hatVault, "DismissClaim")
      .withArgs(claimId);

    const disputeData = await hatConnector.disputes(0);
    expect(disputeData[0]).to.equal(claimId, "Incorrect claimId");
    expect(disputeData[1]).to.equal(2, "Incorrect external disputeId");
    expect(disputeData[2]).to.equal(0, "Ruling should be 0");
    expect(disputeData[3]).to.equal(true, "Resolved should be true");
    expect(disputeData[4]).to.equal(hatVault.address, "Incorrect hat vault address");

    activeClaim = await hatVault.getActiveClaim();
    expect(activeClaim[0]).to.equal(EMPTY_HASH, "Active claim should be deleted");
  });

  it("Should correctly fund an appeal and fire the events", async () => {
    let oldBalance;
    let newBalance;
    let txFundAppeal;
    let txFee;
    let roundInfo;
    
    await hatArbitrator.connect(challenger).challengeResolution(hatVault.address, claimId, evidence, { value: arbitrationCost });
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
    await expect(
      badEthReceiver.connect(challenger).fundAppeal(hatConnector.address, 0, 2, { gasPrice: gasPrice, value: oneETH })
    ).to.be.revertedWith("Failed to send ETH");

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

    await hatArbitrator.connect(challenger).challengeResolution(hatVault.address, claimId, evidence, { value: arbitrationCost });
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
    await hatArbitrator.connect(challenger).challengeResolution(hatVault.address, claimId, evidence, { value: arbitrationCost });
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
    await hatArbitrator.connect(challenger).challengeResolution(hatVault.address, claimId, evidence, { value: arbitrationCost });
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

    await hatArbitrator.connect(challenger).challengeResolution(hatVault.address, claimId, evidence, { value: arbitrationCost });

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
    expect(disputeData[2]).to.equal(ruling, "Incorrect ruling");
    expect(disputeData[3]).to.equal(true, "Resolved should be true");

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

    let totalWithdrawableAmount = await hatConnector.getTotalWithdrawableAmount(0, crowdfunder1Address, 2);
    expect(totalWithdrawableAmount).to.equal(0, "Incorrect withdrawable amount for not resolved dispute");

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

  it("Should fail to withdraw when receiver reverts", async () => {
    await hatArbitrator.connect(challenger).challengeResolution(hatVault.address, claimId, evidence, { value: arbitrationCost });

    await arbitrator.giveAppealableRuling(2, 1, appealCost, appealTimeout);

    await badEthReceiver.setShouldFail(false);

    // LoserFee = 8500, WinnerFee = 6500. AppealCost = 5000.
    // 0 Round.
    await badEthReceiver.connect(claimant).fundAppeal(hatConnector.address, 0, 2, { value: 4000 });
    await badEthReceiver.connect(crowdfunder1).fundAppeal(hatConnector.address, 0, 2, { value: oneETH });

    await hatConnector.connect(crowdfunder2).fundAppeal(0, 1, { value: 6000 });
    await hatConnector.connect(crowdfunder1).fundAppeal(0, 1, { value: 6000 });

    await arbitrator.giveAppealableRuling(2, 1, appealCost, appealTimeout);

    // 1 Round.
    await badEthReceiver.connect(claimant).fundAppeal(hatConnector.address, 0, 2, { value: 500 });
    await badEthReceiver.connect(crowdfunder1).fundAppeal(hatConnector.address, 0, 2, { value: 8000 });

    await hatConnector.connect(crowdfunder2).fundAppeal(0, 1, { value: 20000 });

    await arbitrator.giveAppealableRuling(2, 1, appealCost, appealTimeout);

    // 2 Round.
    // Partially funded side should be reimbursed.
    await badEthReceiver.connect(claimant).fundAppeal(hatConnector.address, 0, 2, { value: 8499 });

    // Winner doesn't have to fund appeal in this case but let's check if it causes unexpected behaviour.
    await hatConnector.connect(crowdfunder2).fundAppeal(0, 1, { value: oneETH });

    await utils.increaseTime(appealTimeout + 1);

    await arbitrator.executeRuling(2);

    await badEthReceiver.setShouldFail(true);

    await expect(
      hatConnector.withdrawFeesAndRewards(0, badEthReceiver.address, 2, 2)
    ).to.be.revertedWith("Failed to send ETH");
  });

  it("Should correctly withdraw appeal fees if a dispute had winner/loser when appeal cost is 0", async () => {
    let oldBalance1;
    let oldBalance2;
    let newBalance;
    let newBalance1;
    let newBalance2;
    const claimantAddress = await claimant.getAddress();
    const crowdfunder1Address = await crowdfunder1.getAddress();
    const crowdfunder2Address = await crowdfunder2.getAddress();

    await hatArbitrator.connect(challenger).challengeResolution(hatVault.address, claimId, evidence, { value: arbitrationCost });

    await arbitrator.giveAppealableRuling(2, 1, 0, appealTimeout);

    // LoserFee = 8500, WinnerFee = 6500. AppealCost = 5000.
    // 0 Round.
    await hatConnector.connect(claimant).fundAppeal(0, 2, { value: 0 });

    await hatConnector.connect(crowdfunder1).fundAppeal(0, 1, { value: 0 });

    await arbitrator.giveAppealableRuling(2, 1, 0, appealTimeout);

    // 1 Round.
    await hatConnector.connect(claimant).fundAppeal(0, 2, { value: 0 });

    await hatConnector.connect(crowdfunder2).fundAppeal(0, 1, { value: 0 });

    await arbitrator.giveAppealableRuling(2, 1, appealCost, appealTimeout);

    // 2 Round.
    // Partially funded side should be reimbursed.
    await hatConnector.connect(claimant).fundAppeal(0, 2, { value: 0 });

    // Winner doesn't have to fund appeal in this case but let's check if it causes unexpected behaviour.
    await hatConnector.connect(crowdfunder2).fundAppeal(0, 1, { value: 0 });

    await utils.increaseTime(appealTimeout + 1);

    await arbitrator.executeRuling(2);

    const oldBalance = await claimant.getBalance();
    oldBalance1 = await crowdfunder1.getBalance();
    oldBalance2 = await crowdfunder2.getBalance();

    let totalWithdrawableAmount = await hatConnector.getTotalWithdrawableAmount(0, await claimant.getAddress(), 1);
    expect(totalWithdrawableAmount).to.equal(0, "Incorrect withdrawable amount for not resolved dispute");

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

    await hatConnector.withdrawFeesAndRewards(0, crowdfunder1Address, 0, 1);

    newBalance1 = await crowdfunder1.getBalance();
    expect(newBalance1).to.equal(
      oldBalance1,
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
    expect(newBalance2).to.equal(
      oldBalance2,
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
      oldBalance2,
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
    expect(newBalance).to.equal(oldBalance, "The balance of the claimant is incorrect (withdraw 2 round)");
    expect(newBalance2).to.equal(
      oldBalance2,
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

    await hatArbitrator.connect(challenger).challengeResolution(hatVault.address, claimId, evidence, { value: arbitrationCost });
    await arbitrator.giveAppealableRuling(2, 1, appealCost, appealTimeout);

    // LoserFee = 8500. AppealCost = 5000.
    await hatConnector.connect(claimant).fundAppeal(0, 2, { value: 5000 });
    await hatConnector.connect(crowdfunder1).fundAppeal(0, 2, { value: 3500 });

    await hatConnector.connect(crowdfunder2).fundAppeal(0, 0, { value: 1000 });
    await hatConnector.connect(crowdfunder1).fundAppeal(0, 0, { value: 10000 });

    await arbitrator.giveAppealableRuling(2, 1, appealCost, appealTimeout); // No one funded the winning ruling, so contributions to 0 and 2 ruling should be distributed proportionally

    await utils.increaseTime(appealTimeout + 1);

    await arbitrator.executeRuling(2);

    let totalWithdrawableAmount = await hatConnector.getTotalWithdrawableAmount(0, await claimant.getAddress(), 2);
    expect(totalWithdrawableAmount).to.equal(3529, "Incorrect withdrawable amount for not resolved dispute");

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

    await hatArbitrator.connect(challenger).challengeResolution(hatVault.address, claimId, evidence, { value: arbitrationCost });
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

    totalAmount = await hatConnector.getTotalWithdrawableAmount(0, await claimant.getAddress(), 1);
    expect(totalAmount).to.equal(0, "Incorrect withdrawable amount for not resolved dispute");

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
    await hatArbitrator.connect(challenger).challengeResolution(hatVault.address, claimId, evidence, { value: arbitrationCost });

    await arbitrator.giveAppealableRuling(2, 2, appealCost, appealTimeout); // 2 ruling that dismisses claim should be switched

    await hatConnector.connect(claimant).fundAppeal(0, 1, { value: 8500 });
    await utils.increaseTime(appealTimeout + 1);
    await expect(arbitrator.executeRuling(2))
      .to.emit(hatConnector, "Ruling")
      .withArgs(arbitrator.address, 2, 1)
      .to.emit(hatVault, "ApproveClaim") // Resolution should be executed
      .withArgs(claimId, hatArbitrator.address, await claimant.getAddress(), expertCommitteeBounty);

    const disputeData = await hatConnector.disputes(0);
    expect(disputeData[2]).to.equal(1, "Ruling should be switched to 1");
    expect(disputeData[3]).to.equal(true, "Resolved should be true");
  });

  it("Should correctly submit evidence", async () => {
    await expect(
      hatConnector.connect(other).submitEvidence(0, "Test")
    ).to.be.reverted; // Dispute doesn't exist so it should revert
    
    await hatArbitrator.connect(challenger).challengeResolution(hatVault.address, claimId, evidence, { value: arbitrationCost });
    
    await expect(hatConnector.connect(other).submitEvidence(0, "Test"))
      .to.emit(hatConnector, "Evidence")
      .withArgs(arbitrator.address, 0, await other.getAddress(), "Test");

    await arbitrator.connect(governor).giveRuling(2, 2);

    await expect(
      hatConnector.connect(other).submitEvidence(0, "Test2")
    ).to.be.revertedWith("Dispute already resolved");
  });
});
