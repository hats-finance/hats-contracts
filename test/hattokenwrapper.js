const ERC20Mock = artifacts.require("./ERC20Mock.sol");
const HATTokenWrapper = artifacts.require("./HATTokenWrapper.sol");
const { contract, web3 } = require("hardhat");
const {
  assertFunctionRaisesException,
} = require("./common.js");
const { assert } = require("chai");

const MINIMAL_AMOUNT_OF_SHARES = 1000;

contract("HATTokenWrapper", (accounts) => {

  let token;
  let tokenWrapper;

  async function setupTokenWrapper() {
    token = await ERC20Mock.new("Staking", "STK");
    tokenWrapper = await HATTokenWrapper.new(token.address, "Staking Wrapper", "STKW");
  }

  it("correct init", async () => {
    await setupTokenWrapper();
    
    assert.equal(await tokenWrapper.name(), "Staking Wrapper");
    assert.equal(await tokenWrapper.symbol(), "STKW");
    assert.equal(await tokenWrapper.asset(), token.address);
  });


  it("minimum amount of shares must be at least MINIMAL_AMOUNT_OF_SHARES", async () => {
    await setupTokenWrapper();
    const holder = accounts[1];
    await token.mint(holder, "10000000");
    await token.approve(tokenWrapper.address, "10000000", { from: holder});
    // 1e6 is the minimum deposit
    await assertFunctionRaisesException(tokenWrapper.deposit("1", holder, { from: holder }), "AmountOfSharesMustBeMoreThanMinimalAmount");
    await assertFunctionRaisesException(tokenWrapper.deposit((MINIMAL_AMOUNT_OF_SHARES-1), holder, { from: holder }), "AmountOfSharesMustBeMoreThanMinimalAmount");
    await tokenWrapper.deposit(MINIMAL_AMOUNT_OF_SHARES, holder, { from: holder });

    assert.equal((await token.balanceOf(tokenWrapper.address)).toString(), MINIMAL_AMOUNT_OF_SHARES);

    // redeem all the remaining tokens except 1
    await assertFunctionRaisesException(tokenWrapper.redeem(MINIMAL_AMOUNT_OF_SHARES-1, holder, holder, { from: holder }), "AmountOfSharesMustBeMoreThanMinimalAmount");
    await tokenWrapper.redeem(MINIMAL_AMOUNT_OF_SHARES, holder, holder, { from: holder });
    assert.equal((await token.balanceOf(tokenWrapper.address)).toString(), "0");
    assert.equal((await tokenWrapper.totalSupply()).toString(), "0");
  });
});