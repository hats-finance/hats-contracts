const HATVaults = artifacts.require("./HATVaults.sol");
const HATToken = artifacts.require("./HATToken.sol");
const UniSwapV2RouterMock = artifacts.require("./UniSwapV2RouterMock.sol");
const TokenLockFactory = artifacts.require("./TokenLockFactory.sol");
const HATTokenLock = artifacts.require("./HATTokenLock.sol");

const utils = require("./utils.js");

var hatVaults;
var hatToken;
var router;
var REWARD_PER_BLOCK = "10";
var tokenLockFactory;

const setup = async function (
                              accounts,
                              reward_per_block=REWARD_PER_BLOCK,
                              startBlock=0
                            ) {
  hatToken = await HATToken.new(accounts[0],utils.TIME_LOCK_DELAY_IN_BLOCKS_UNIT);

  router =  await UniSwapV2RouterMock.new();
  var tokenLock = await HATTokenLock.new();
  tokenLockFactory = await TokenLockFactory.new(tokenLock.address);

  hatVaults = await HATVaults.new(hatToken.address,
                                  web3.utils.toWei(reward_per_block),
                                  startBlock,
                                  10,
                                  accounts[0],
                                  router.address,
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
      let currentBlockNumber = (await web3.eth.getBlock("latest")).number;
      var tx =  await hatVaults.setPendingGovernance(accounts[1],{from: accounts[0]});
      assert.equal(tx.logs[0].event,"GovernancePending");
      assert.equal(tx.logs[0].args._previousGovernance,accounts[0]);
      assert.equal(tx.logs[0].args._newGovernance,accounts[1]);
      assert.equal(tx.logs[0].args._atBlock,currentBlockNumber+1);

      try {
        await hatVaults.transferGovernorship({from: accounts[1]});
        assert(false, 'only gov can transferGovernorship');
      } catch (ex) {
        assertVMException(ex);
      }

      try {
        await hatVaults.transferGovernorship({from: accounts[0]});
        assert(false, 'need to wait 12000 blocks');
      } catch (ex) {
        assertVMException(ex);
      }
      for(var i =0;i<10000;i++) {
          await utils.mineBlock();
      }
      try {
        await hatVaults.transferGovernorship({from: accounts[0]});
        assert(false, 'need to wait 12000 blocks');
      } catch (ex) {
        assertVMException(ex);
      }
      for(i=10000;i<12000;i++) {
          await utils.mineBlock();
      }
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
