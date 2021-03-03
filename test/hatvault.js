const HATVault = artifacts.require("./HATVault.sol");
const HATToken = artifacts.require("./HATToken.sol");
const ProjectsRegistery = artifacts.require("./ProjectsRegistery.sol");

var hatVault;
var hatToken;
var stakingToken;
var projectsRegistery;
// Increases testrpc time by the passed duration in seconds
const increaseTime = async function(duration) {
  const id = await Date.now();

   web3.providers.HttpProvider.prototype.sendAsync = web3.providers.HttpProvider.prototype.send;

  return new Promise((resolve, reject) => {
    web3.currentProvider.send({
      jsonrpc: '2.0',
      method: 'evm_increaseTime',
      params: [duration],
      id: id,
    }, err1 => {
      if (err1) return reject(err1);

      web3.currentProvider.send({
        jsonrpc: '2.0',
        method: 'evm_mine',
        id: id + 1,
      }, (err2, res) => {
        return err2 ? reject(err2) : resolve(res);
      });
    });
  });
};

const setup = async function (accounts) {
  projectsRegistery = await ProjectsRegistery.new();
  await projectsRegistery.initialize(accounts[0]);

  hatToken = await HATToken.new("Hat","HAT",accounts[0]);
  stakingToken = await HATToken.new("Staking","STK",accounts[0]);
  let tx = await projectsRegistery.vaultFactory(accounts[0],
                                                accounts[0],
                                                hatToken.address,
                                                stakingToken.address,
                                                [accounts[0]],
                                                accounts[0]);
  assert.equal(tx.logs[2].event,"LogRegister");
  let hatVaultAddress = tx.logs[2].args._vault;
  hatVault = await HATVault.at(hatVaultAddress);
};

function assertVMException(error) {
    let condition = (
        error.message.search('VM Exception') > -1 || error.message.search('Transaction reverted') > -1
    );
    assert.isTrue(condition, 'Expected a VM Exception, got this instead:' + error.message);
}

contract('HatVault',  accounts =>  {

    it("constructor", async () => {
        await setup(accounts);
        assert.equal(await stakingToken.name(), "Staking");
        assert.equal(await hatVault.governance(), accounts[0]);
        assert.equal(await hatVault.vaultName(), "Staking");

    });

    it("stakeForLpToken", async () => {
        var staker = accounts[1];
        await setup(accounts);
        try {
            await hatVault.stakeForLpToken(1000,{from:staker});
            assert(false, 'cannot stake without approve');
        } catch (ex) {
          assertVMException(ex);
        }
        await stakingToken.approve(hatVault.address,10000,{from:staker});
        try {
            await hatVault.stakeForLpToken(1000,{from:staker});
            assert(false, 'do not have enough tokens to stake');
        } catch (ex) {
          assertVMException(ex);
        }
        await stakingToken.mint(staker,1000);
        assert.equal(await stakingToken.balanceOf(staker), 1000);
        await hatVault.stakeForLpToken(1000,{from:staker});
        assert.equal(await stakingToken.balanceOf(staker), 0);
        assert.equal(await stakingToken.balanceOf(hatVault.address), 1000);
        //check staker lptoken balance
        assert.equal(await hatVault.lpBalances(staker), 1000);
        //withdrawWithLpToken
        await hatVault.withdrawWithLpToken(1000,{from:staker});
        //lptoken burned
        assert.equal(await hatVault.lpBalances(staker), 0);
        //staker  get stake back
        assert.equal(await stakingToken.balanceOf(staker), 1000);

        //no rewards because no rewards set yet..
        assert.equal(await hatVault.rewards(staker), 0);
        await hatVault.getReward({from:staker});
        assert.equal(await hatVault.rewards(staker), 0);

        //set rewards .
        await hatToken.mint(hatVault.address,web3.utils.toWei("1000"));
        await hatVault.notifyRewardAmount(web3.utils.toWei("1000"));
        assert.equal(await hatVault.rewards(staker), 0);
    });

    it("enable farming  + getReward", async () => {
        var staker = accounts[1];
        var rewardTokenAmount = web3.utils.toWei("1000");
        await setup(accounts);
        await stakingToken.approve(hatVault.address,web3.utils.toWei("1"),{from:staker});
        await stakingToken.mint(staker,web3.utils.toWei("1"));
        await hatToken.mint(hatVault.address,rewardTokenAmount);
        //start farming
        await hatVault.notifyRewardAmount(rewardTokenAmount);
        //stake
        await hatVault.stakeForLpToken(web3.utils.toWei("1"),{from:staker});
        assert.equal(await hatVault.lpBalances(staker), web3.utils.toWei("1"));
      //exitWithLpToken
        assert.equal(await hatToken.balanceOf(staker),0);
        await increaseTime(7*24*3600);
        await hatVault.exitWithLpToken({from:staker});
        let balanceOfStakerHats = await hatToken.balanceOf(staker);
        assert.equal(web3.utils.fromWei(balanceOfStakerHats) > 999 ,true);
        assert.equal(web3.utils.fromWei(balanceOfStakerHats) <= 1000 ,true);
    });

  it("enable farming  + approve+ exit", async () => {
    var staker = accounts[1];
    var rewardTokenAmount = web3.utils.toWei("1000");
    await setup(accounts);
    await stakingToken.approve(hatVault.address,web3.utils.toWei("1"),{from:staker});
    await stakingToken.mint(staker,web3.utils.toWei("1"));
    await hatToken.mint(hatVault.address,rewardTokenAmount);
    //start farming
    await hatVault.notifyRewardAmount(rewardTokenAmount);
    //stake
    await hatVault.stakeForLpToken(web3.utils.toWei("1"),{from:staker});
    assert.equal(await hatVault.lpBalances(staker), web3.utils.toWei("1"));
  //exitWithLpToken
    assert.equal(await hatToken.balanceOf(staker),0);
    await increaseTime(7*24*3600);
    await hatVault.approveClaim(accounts[2],1);
    await hatVault.approveClaim(accounts[2],1);
    await hatVault.exitWithLpToken({from:staker});
    let balanceOfStakerHats = await hatToken.balanceOf(staker);
    let expectedBalance = web3.utils.toWei("1") / web3.utils.toWei("1") * await hatVault.factor()
    assert.equal(await stakingToken.balanceOf(staker),expectedBalance)
    assert.equal(web3.utils.fromWei(balanceOfStakerHats) > 999 ,true);
    assert.equal(web3.utils.fromWei(balanceOfStakerHats) <= 1000 ,true);
  });

  it("enable farming  + approve+ getReward", async () => {
    var staker = accounts[1];
    var rewardTokenAmount = web3.utils.toWei("1000");
    await setup(accounts);
    await stakingToken.approve(hatVault.address,web3.utils.toWei("1"),{from:staker});
    await stakingToken.mint(staker,web3.utils.toWei("1"));
    await hatToken.mint(hatVault.address,rewardTokenAmount);
    //start farming
    await hatVault.notifyRewardAmount(rewardTokenAmount);
    //stake
    await hatVault.stakeForLpToken(web3.utils.toWei("1"),{from:staker});
    assert.equal(await hatVault.lpBalances(staker), web3.utils.toWei("1"));
  //exitWithLpToken
    assert.equal(await hatToken.balanceOf(staker),0);
    await increaseTime(7*24*3600);
    await hatVault.approveClaim(accounts[2],0);
    await hatVault.getReward({from:staker});
    let balanceOfStakerHats = await hatToken.balanceOf(staker);
    assert.equal(await stakingToken.balanceOf(staker),0);
    assert.equal(web3.utils.fromWei(balanceOfStakerHats) > 999 ,true);
    assert.equal(web3.utils.fromWei(balanceOfStakerHats) <= 1000 ,true);
  });

});
