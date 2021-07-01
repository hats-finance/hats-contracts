const HATVaults = artifacts.require("./HATVaults.sol");
const HATToken = artifacts.require("./HATToken.sol");
const TokenLockFactory = artifacts.require("./TokenLockFactory.sol");
const HATTokenLock = artifacts.require("./HATTokenLock.sol");

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

  hatVaults = await HATVaults.new(hatToken.address,
                                  web3.utils.toWei(reward_per_block),
                                  startBlock,
                                  10,
                                  accounts[0],
                                  accounts[1], //as uniSwapRouter
                                  tokenLockFactory.address);
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
      assert.equal(await hatVaults.governance(), accounts[0]);
      try {
        await hatVaults.transferGovernorship({from: accounts[0]});
        assert(false, 'no pending governance');
      } catch (ex) {
        assertVMException(ex);
      }

      try {
        await hatVaults.setPendingGovernance(accounts[1],{from: accounts[1]});
        assert(false, 'only gov can set pending gov');
      } catch (ex) {
        assertVMException(ex);
      }
      try {
        await hatVaults.setPendingGovernance(utils.NULL_ADDRESS,{from: accounts[0]});
        assert(false, 'pending gov cannot be zero');
      } catch (ex) {
        assertVMException(ex);
      }
      var tx =  await hatVaults.setPendingGovernance(accounts[1],{from: accounts[0]});
      assert.equal(tx.logs[0].event,"GovernancePending");
      assert.equal(tx.logs[0].args._previousGovernance,accounts[0]);
      assert.equal(tx.logs[0].args._newGovernance,accounts[1]);
      assert.equal(tx.logs[0].args._at,(await web3.eth.getBlock("latest")).timestamp);

      try {
        await hatVaults.transferGovernorship({from: accounts[1]});
        assert(false, 'only gov can transferGovernorship');
      } catch (ex) {
        assertVMException(ex);
      }

      try {
        await hatVaults.transferGovernorship({from: accounts[0]});
        assert(false, 'need to wait 2 days');
      } catch (ex) {
        assertVMException(ex);
      }
      //increase time in 1 day
      await utils.increaseTime(24*3600);
      try {
        await hatVaults.transferGovernorship({from: accounts[0]});
        assert(false, 'need to wait 2 days');
      } catch (ex) {
        assertVMException(ex);
      }

      //increase time in additional 1 day
      await utils.increaseTime(24*3600);

      tx = await hatVaults.transferGovernorship({from: accounts[0]});
      assert.equal(tx.logs[0].event,"GovernorshipTransferred");
      assert.equal(tx.logs[0].args._previousGovernance,accounts[0]);
      assert.equal(tx.logs[0].args._newGovernance,accounts[1]);

      assert.equal(await hatVaults.governance(), accounts[1]);
      try {
        await hatVaults.transferGovernorship({from: accounts[1]});
        assert(false, 'no pending governance');
      } catch (ex) {
        assertVMException(ex);
      }
  }).timeout(40000);
});
