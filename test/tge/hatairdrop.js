const utils = require("../utils.js");
const ERC20Mock = artifacts.require("./ERC20Mock.sol");
const { contract, web3 } = require("hardhat");
const {
  assertFunctionRaisesException,
} = require("../common.js");
const airdropData = require('./airdropData.json');
const { assert } = require("chai");
const { default: MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");

function hashTokens(account, amount) {
  return Buffer.from(
    ethers.utils.solidityKeccak256(
      ['address', 'uint256'],
      [account, amount]
    ).slice(2),
    'hex'
  );
}

contract("HATAirdrop", (accounts) => {

  let hatAirdrop;
  let token;
  let merkleTree;
  let hashes = [];
  let totalAmount = 0;

  async function setupHATAirdrop() {
    token = await ERC20Mock.new("Staking", "STK");

    for (const [account, amount] of Object.entries(airdropData)) {
      totalAmount += parseInt(amount);
      hashes.push(hashTokens(account, amount));
    }

    merkleTree = new MerkleTree(hashes, keccak256, { sortPairs: true });
    
    const HATAirdrop = artifacts.require("./HATAirdrop.sol");
    hatAirdrop = await HATAirdrop.new(
      "QmSUXfYsk9HgrMBa7tgp3MBm8FGwDF9hnVaR9C1PMoFdS3",
      merkleTree.getHexRoot(),
      (await web3.eth.getBlock("latest")).timestamp + 7 * 24 * 3600,
      (await web3.eth.getBlock("latest")).timestamp + (7 + 365) * 24 * 3600,
      token.address
    );

    await token.mint(hatAirdrop.address, totalAmount);
  }


  it("Redeem all", async () => {
    await setupHATAirdrop();

    await utils.increaseTime(7 * 24 * 3600);

    for (const [account, amount] of Object.entries(airdropData)) {
      let currentBalance = await token.balanceOf(hatAirdrop.address);
      const proof = merkleTree.getHexProof(hashTokens(account, amount));
      let tx = await hatAirdrop.redeem(account, amount, proof);
      assert.equal(tx.logs[0].event, "TokensRedeemed");
      assert.equal(tx.logs[0].args._account.toLowerCase(), account.toLowerCase());
      assert.equal(tx.logs[0].args._amount, amount);
      assert.equal(await token.balanceOf(account), amount);
      assert.equal((await token.balanceOf(hatAirdrop.address)).toString(), currentBalance.sub(web3.utils.toBN(amount)).toString());
    }

    assert.equal((await token.balanceOf(hatAirdrop.address)).toString(), "0");
  });

  it("Cannot redeem before start time", async () => {
    await setupHATAirdrop();

    const [account, amount] = Object.entries(airdropData)[0];
    const proof = merkleTree.getHexProof(hashTokens(account, amount));
    await assertFunctionRaisesException(
      hatAirdrop.redeem(account, amount, proof),
      "CannotRedeemBeforeStartTime"
    );

    await utils.increaseTime(7 * 24 * 3600);

    let tx = await hatAirdrop.redeem(account, amount, proof);
    assert.equal(tx.logs[0].event, "TokensRedeemed");
    assert.equal(tx.logs[0].args._account.toLowerCase(), account.toLowerCase());
    assert.equal(tx.logs[0].args._amount, amount);
  });

  it("Cannot redeem after deadline", async () => {
    await setupHATAirdrop();

    const [account, amount] = Object.entries(airdropData)[0];
    const proof = merkleTree.getHexProof(hashTokens(account, amount));

    await utils.increaseTime(7 * 24 * 3600);

    let tx = await hatAirdrop.redeem(account, amount, proof);
    assert.equal(tx.logs[0].event, "TokensRedeemed");
    assert.equal(tx.logs[0].args._account.toLowerCase(), account.toLowerCase());
    assert.equal(tx.logs[0].args._amount, amount);

    await utils.increaseTime(365 * 24 * 3600);

    const [account2, amount2] = Object.entries(airdropData)[1];
    const proof2 = merkleTree.getHexProof(hashTokens(account2, amount2));

    await assertFunctionRaisesException(
      hatAirdrop.redeem(account2, amount2, proof2),
      "CannotRedeemAfterDeadline"
    );
  });

  it("Cannot redeem twice", async () => {
    await setupHATAirdrop();

    const [account, amount] = Object.entries(airdropData)[0];
    const proof = merkleTree.getHexProof(hashTokens(account, amount));

    await utils.increaseTime(7 * 24 * 3600);

    let tx = await hatAirdrop.redeem(account, amount, proof);
    assert.equal(tx.logs[0].event, "TokensRedeemed");
    assert.equal(tx.logs[0].args._account.toLowerCase(), account.toLowerCase());
    assert.equal(tx.logs[0].args._amount, amount);

    await assertFunctionRaisesException(
      hatAirdrop.redeem(account, amount, proof),
      "LeafAlreadyRedeemed"
    );
  });

  it("Cannot redeem invalid proof", async () => {
    await setupHATAirdrop();

    const [account, amount] = Object.entries(airdropData)[0];

    await utils.increaseTime(7 * 24 * 3600);

    await assertFunctionRaisesException(
      hatAirdrop.redeem(account, amount, [web3.utils.randomHex(32)]),
      "InvalidMerkleProof"
    );

    const proof = merkleTree.getHexProof(hashTokens(account, amount));

    await assertFunctionRaisesException(
      hatAirdrop.redeem(account, "0", proof),
      "InvalidMerkleProof"
    );

    let tx = await hatAirdrop.redeem(account, amount, proof);
    assert.equal(tx.logs[0].event, "TokensRedeemed");
    assert.equal(tx.logs[0].args._account.toLowerCase(), account.toLowerCase());
    assert.equal(tx.logs[0].args._amount, amount);    
  });

  it("Recover tokens", async () => {
    await setupHATAirdrop();

    await assertFunctionRaisesException(
      hatAirdrop.recoverTokens({ from: accounts[1] }),
      "Ownable: caller is not the owner"
    );

    await assertFunctionRaisesException(
      hatAirdrop.recoverTokens(),
      "CannotRecoverBeforeDeadline"
    );

    await utils.increaseTime(7 * 24 * 3600);

    const [account, amount] = Object.entries(airdropData)[0];
    const proof = merkleTree.getHexProof(hashTokens(account, amount));

    let tx = await hatAirdrop.redeem(account, amount, proof);
    assert.equal(tx.logs[0].event, "TokensRedeemed");
    assert.equal(tx.logs[0].args._account.toLowerCase(), account.toLowerCase());
    assert.equal(tx.logs[0].args._amount, amount);

    await utils.increaseTime(365 * 24 * 3600);

    tx = await hatAirdrop.recoverTokens();
    
    assert.equal(tx.logs[0].event, "TokensRecovered");
    assert.equal(tx.logs[0].args._owner.toLowerCase(), accounts[0].toLowerCase());
    assert.equal(tx.logs[0].args._amount.toString(), web3.utils.toBN((totalAmount - parseInt(amount))).toString());
    assert.equal((await token.balanceOf(hatAirdrop.address)).toString(), "0");
  });
});
