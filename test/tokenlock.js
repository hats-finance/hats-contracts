const ERC20Mock = artifacts.require("./ERC20Mock.sol");
const TokenLockFactory = artifacts.require("./TokenLockFactory.sol");
const HATTokenLock = artifacts.require("./HATTokenLock.sol");

var stakingToken;
var tokenLockFactory;
var tokenLock;

const setup = async function (
                              accounts
                            ) {
  stakingToken = await ERC20Mock.new("Staking","STK",accounts[0]);

  var tokenLockParent = await HATTokenLock.new();
  tokenLockFactory = await TokenLockFactory.new(tokenLockParent.address);
  let currentBlockTimestamp = (await web3.eth.getBlock("latest")).timestamp;

  let tx =await tokenLockFactory.createTokenLock(stakingToken.address,
                                         accounts[0],
                                         accounts[1],
                                         web3.utils.toWei("1"),
                                         currentBlockTimestamp,
                                         currentBlockTimestamp+ 1000,
                                         5,
                                         0,
                                         0,
                                         1,
                                         false
                                       );

  assert.equal(tx.logs[2].event,"TokenLockCreated");
  let tokenLockAddress = tx.logs[2].args.contractAddress;
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
});
