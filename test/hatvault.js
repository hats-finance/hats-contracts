const HATVault = artifacts.require("./HATVault.sol");
const HATToken = artifacts.require("./HATToken.sol");

var hatVault;
var hatToken;
var stakingToken;
const setup = async function (accounts) {

  hatToken = await HATToken.new("Hat","HAT",accounts[0]);
  stakingToken = await HATToken.new("Staking","STK",accounts[0]);
  hatVault = await HATVault.new(accounts[0],
                              accounts[0],
                              hatToken.address,
                              stakingToken.address,
                              accounts[0],
                              "lptoken",
                              "LPT",
                              [accounts[0]],
                              accounts[0]);
};

contract('HatVault',  accounts =>  {

    it("constructor", async () => {
        await setup(accounts);
        assert.equal(await stakingToken.name(), "Staking");
        assert.equal(await hatVault.governance(), accounts[0]);

    });

});
