const WrapToken = artifacts.require("./WrapToken.sol");
const HATToken = artifacts.require("./HATTokenMock.sol");
const ERCToken = artifacts.require("./ERC20Mock.sol");
const utils = require("./utils.js");

var hatToken;
var wrapedToken;
const setup = async function (
                              accounts,
                            ) {
     hatToken = await HATToken.new(accounts[0],utils.TIME_LOCK_DELAY);
     wrapedToken = await WrapToken.new(hatToken.address,"xHATToken","xhat");
};

contract('WrapToken', accounts => {

    it("constructor", async () => {
        await setup(accounts);
        assert.equal(await wrapedToken.token(), hatToken.address);
        assert.equal(await wrapedToken.name(), "xHATToken");
        assert.equal(await wrapedToken.symbol(), "xhat");
        assert.equal(await wrapedToken.decimals(), 18);
    });

    it("wrapToken", async () => {
        await setup(accounts);
        await utils.setMinter(hatToken,accounts[0],1000);
        await hatToken.mint(accounts[0], 1000);
        assert.equal(await wrapedToken.balanceOf(accounts[0]), 0);
        assert.equal(await hatToken.balanceOf(accounts[0]), 1000);
        await hatToken.approve(wrapedToken.address,1000);
        await wrapedToken.wrapToken(1000);
        assert.equal(await wrapedToken.balanceOf(accounts[0]), 1000);
        assert.equal(await hatToken.balanceOf(accounts[0]), 0);
    });

    it("unwrapToken", async () => {
      await setup(accounts);
      await utils.setMinter(hatToken,accounts[0],1000);
      await hatToken.mint(accounts[0], 1000);
      await hatToken.approve(wrapedToken.address,1000);
      await wrapedToken.wrapToken(1000);
      await wrapedToken.unwrapToken(1000);
      assert.equal(await wrapedToken.balanceOf(accounts[0]), 0);
      assert.equal(await hatToken.balanceOf(accounts[0]), 1000);
    });

    it("checkDecimals", async () => {
      var ercMock6Decimals = await ERCToken.new("ERC206Decimals","6DEC",6);
      var wrapedToken6Decimal = await WrapToken.new(ercMock6Decimals.address,"xHATToken","xhat");
      assert.equal(await wrapedToken6Decimal.name(), "xHATToken");
      assert.equal(await wrapedToken6Decimal.symbol(), "xhat");
      assert.equal(await wrapedToken6Decimal.decimals(), 6);
    });

});
