const XHATToken = artifacts.require("./XHATToken.sol");
const HATToken = artifacts.require("./HATTokenMock.sol");
const utils = require("./utils.js");

var hatToken;
var xHatToken;
const setup = async function (
                              accounts,
                            ) {
     hatToken = await HATToken.new(accounts[0],utils.TIME_LOCK_DELAY);
     xHatToken = await XHATToken.new(hatToken.address);
};

contract('xHATToken', accounts => {

    it("constructor", async () => {
        await setup(accounts);
        assert.equal(await xHatToken.HAT(), hatToken.address);
        assert.equal(await xHatToken.name(), "xHATToken");
        assert.equal(await xHatToken.symbol(), "xHAT");
        assert.equal(await xHatToken.decimals(), 18);

    });

    it("swapHAT2xHAT", async () => {
        await setup(accounts);
        await utils.setMinter(hatToken,accounts[0],1000);
        await hatToken.mint(accounts[0], 1000);
        assert.equal(await xHatToken.balanceOf(accounts[0]), 0);
        assert.equal(await hatToken.balanceOf(accounts[0]), 1000);
        await hatToken.approve(xHatToken.address,1000);
        await xHatToken.swapHAT2xHAT(1000);
        assert.equal(await xHatToken.balanceOf(accounts[0]), 1000);
        assert.equal(await hatToken.balanceOf(accounts[0]), 0);
    });

    it("swapxHAT2HAT", async () => {
      await setup(accounts);
      await utils.setMinter(hatToken,accounts[0],1000);
      await hatToken.mint(accounts[0], 1000);
      await hatToken.approve(xHatToken.address,1000);
      await xHatToken.swapHAT2xHAT(1000);
      await xHatToken.swapxHAT2HAT(1000);
      assert.equal(await xHatToken.balanceOf(accounts[0]), 0);
      assert.equal(await hatToken.balanceOf(accounts[0]), 1000);
    });

});
