const ERC20Mock = artifacts.require("./ERC20Mock.sol");
const TokenLockFactory = artifacts.require("./TokenLockFactory.sol");
const HATTokenLock = artifacts.require("./HATTokenLock.sol");
const utils = require("./utils.js");

var stakingToken;
var tokenLockFactory;
var tokenLock;

const setup = async function (
                              accounts,
                              revocable = 1,
                              delegate = false,
                              startsIn = 0
                            ) {
  stakingToken = await ERC20Mock.new("Staking","STK",accounts[0]);

  var tokenLockParent = await HATTokenLock.new();
  tokenLockFactory = await TokenLockFactory.new(tokenLockParent.address);
  let currentBlockTimestamp = (await web3.eth.getBlock("latest")).timestamp;

  let tx =await tokenLockFactory.createTokenLock(stakingToken.address,
                                         accounts[0],
                                         accounts[1],
                                         web3.utils.toWei("1"),
                                         currentBlockTimestamp+startsIn,
                                         currentBlockTimestamp+startsIn+ 1000,
                                         5,
                                         0,
                                         0,
                                         revocable,
                                         delegate
                                       );

  assert.equal(tx.logs[1].event,"TokenLockCreated");
  let tokenLockAddress = tx.logs[1].args.contractAddress;
  tokenLock = await HATTokenLock.at(tokenLockAddress);
  await stakingToken.mint(tokenLockAddress,web3.utils.toWei("1"));

};

function assertVMException(error) {
    let condition = (
        error.message.search('VM Exception') > -1 || error.message.search('Transaction reverted') > -1
    );
    assert.isTrue(condition, 'Expected a VM Exception, got this instead:' + error.message);
}

contract('TokenLock',  accounts =>  {

    it("revoke", async () => {
        await setup(accounts);
        try {
            await tokenLock.revoke({from:accounts[1]});
            assert(false, 'only owner can call revoke');
        } catch (ex) {
          assertVMException(ex);
        }
        var tx = await tokenLock.revoke();
        assert.equal(tx.logs[0].event,"TokensRevoked");
        assert.equal(tx.logs[0].args.beneficiary,accounts[1]);
        assert.equal(tx.logs[0].args.amount.toString(),web3.utils.toWei("1"));
    });

    it("sinceStartTime", async () => {
        await setup(accounts,1,false,100);
        assert.equal(await tokenLock.sinceStartTime(),0);
        assert.equal(await tokenLock.availableAmount(),0);
        //each period is 250 seconds
        await utils.increaseTime(350);
        assert.equal((await tokenLock.sinceStartTime()).toString(),"252");
        assert.equal(await tokenLock.availableAmount(),web3.utils.toWei("0.2"));
    });

    it("cannot revoke after renaunceOwnership revoke", async () => {
        await setup(accounts);
        await tokenLock.renounceOwnership();
        try {
            await tokenLock.revoke();
            assert(false, 'only owner can call revoke');
        } catch (ex) {
          assertVMException(ex);
        }
    });

    it("cannot revoke after renaunceOwnership revoke", async () => {
        await setup(accounts);
        await tokenLock.transferOwnership(accounts[2]);
        try {
            await tokenLock.revoke();
            assert(false, 'only owner can call revoke');
        } catch (ex) {
          assertVMException(ex);
        }
        var tx = await tokenLock.revoke({from:accounts[2]});
        assert.equal(tx.logs[0].event,"TokensRevoked");
        assert.equal(tx.logs[0].args.beneficiary,accounts[1]);
        assert.equal(tx.logs[0].args.amount.toString(),web3.utils.toWei("1"));
        try {
            await tokenLock.revoke({from:accounts[2]});
            assert(false, 'cannot revoke twice');
        } catch (ex) {
          assertVMException(ex);
        }
    });

    it("cancel lock", async () => {
        await setup(accounts);
        try {
            await tokenLock.cancelLock({from:accounts[2]});
            assert(false, 'only owner can call cancelLock');
        } catch (ex) {
          assertVMException(ex);
        }
        var balanceBefore = await stakingToken.balanceOf(tokenLock.address);
        var tx = await tokenLock.cancelLock();
        assert.equal(tx.logs[0].event,"LockCanceled");
        assert.equal(await stakingToken.balanceOf(tokenLock.address),0);
        assert.isTrue((await stakingToken.balanceOf(accounts[0])).eq(balanceBefore));

    });

    it("cannot cancel lock after acceptLock by beneficiary", async () => {
        await setup(accounts);
        try {
            await tokenLock.acceptLock();
            assert(false, 'only beneficiary');
        } catch (ex) {
          assertVMException(ex);
        }
        await tokenLock.acceptLock({from:accounts[1]});
        try {
            await tokenLock.cancelLock();
            assert(false, 'cannot cancel lock after accept by beneficiary');
        } catch (ex) {
          assertVMException(ex);
        }

    });

    it("changeBeneficiary", async () => {
        await setup(accounts);
        try {
            await tokenLock.changeBeneficiary(accounts[3]);
            assert(false, 'only beneficiary');
        } catch (ex) {
          assertVMException(ex);
        }
        await tokenLock.changeBeneficiary(accounts[3],{from:accounts[1]});
        assert.equal(await tokenLock.beneficiary(),accounts[3]);
    });

    it("none revocable", async () => {
        await setup(accounts,2);
        assert.equal(await tokenLock.vestedAmount(),web3.utils.toWei("1"));
        try {
            await tokenLock.revoke();
            assert(false, 'none revocable');
        } catch (ex) {
          assertVMException(ex);
        }
    });

    it("no delegate", async () => {
        await setup(accounts,2);
        assert.equal(await tokenLock.canDelegate(),false);
        try {
            await tokenLock.delegate(accounts[2],{from:accounts[1]});
            assert(false, 'cannot delegate');
        } catch (ex) {
          assertVMException(ex);
        }
    });
    it("delegate", async () => {
        await setup(accounts,2,true);
        assert.equal(await tokenLock.canDelegate(),true);
        try {
            await tokenLock.delegate(accounts[2]);
            assert(false, 'only beneficiary');
        } catch (ex) {
          assertVMException(ex);
        }
        await tokenLock.delegate(accounts[2],{from:accounts[1]});
        assert.equal(await stakingToken.delegates(tokenLock.address),accounts[2]);
    });

    it("setMasterCopy", async () => {
        await setup(accounts);

        try {
            await tokenLockFactory.setMasterCopy(utils.NULL_ADDRESS);
            assert(false, 'address cannot be zero');
        } catch (ex) {
          assertVMException(ex);
        }
        await tokenLockFactory.setMasterCopy(accounts[1]);
    });
});
