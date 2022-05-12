const IHATDiamond = artifacts.require("./IHATDiamond.sol");
const HATToken = artifacts.require("./HATToken.sol");
const TokenLockFactory = artifacts.require("./TokenLockFactory.sol");
const HATTokenLock = artifacts.require("./HATTokenLock.sol");
const { deployHatVaults } = require("../scripts/hatvaultsdeploy.js");

const utils = require("./utils.js");

var hatVaults;
var hatToken;
var REWARD_PER_BLOCK = "10";
var tokenLockFactory;

const setup = async function (
                              accounts,
                              reward_per_block=REWARD_PER_BLOCK,
                              startBlock=0
                            ) {
  hatToken = await HATToken.new(accounts[0],utils.TIME_LOCK_DELAY);
  var tokenLock = await HATTokenLock.new();
  tokenLockFactory = await TokenLockFactory.new(tokenLock.address);
  
  hatVaults = await IHATDiamond.at((await deployHatVaults(
    accounts[0],
    hatToken.address,
    web3.utils.toWei(reward_per_block),
    startBlock,
    10,
    accounts[1], //as uniSwapRouter
    tokenLockFactory.address,
    true
  )).address);
};

function assertVMException(error) {
    let condition = (
        error.message.search('VM Exception') > -1 || error.message.search('Transaction reverted') > -1
    );
    assert.isTrue(condition, 'Expected a VM Exception, got this instead:' + error.message);
}

contract('HatVaults  governance',  accounts =>  {

  it("governance", async () => {
      await setup(accounts);
      assert.equal(await hatVaults.owner(), accounts[0]);

      try {
        await hatVaults.transferOwnership(accounts[1],{from: accounts[1]});
        assert(false, 'only gov can transfer gov');
      } catch (ex) {
        assertVMException(ex);
      }
      try {
        await hatVaults.transferOwnership(utils.NULL_ADDRESS,{from: accounts[0]});
        assert(false, 'gov cannot be zero');
      } catch (ex) {
        assertVMException(ex);
      }

      tx = await hatVaults.transferOwnership(accounts[1], {from: accounts[0]});
      assert.equal(tx.logs[0].event,"OwnershipTransferred");
      assert.equal(tx.logs[0].args.previousOwner,accounts[0]);
      assert.equal(tx.logs[0].args.newOwner,accounts[1]);

      assert.equal(await hatVaults.owner(), accounts[1]);
  }).timeout(40000);
});
