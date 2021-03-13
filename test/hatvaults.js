const HATVaults = artifacts.require("./HATVaults.sol");
const HATToken = artifacts.require("./HATToken.sol");
const ERC20Mock = artifacts.require("./ERC20Mock.sol");
//const ProjectsRegistery = artifacts.require("./ProjectsRegistery.sol");

var hatVaults;
var hatToken;
var stakingToken;
var REWARD_PER_BLOCK = "100";
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
  hatToken = await HATToken.new(accounts[0]);
  stakingToken = await ERC20Mock.new("Staking","STK",accounts[0]);

  hatVaults = await HATVaults.new(hatToken.address,
                                  web3.utils.toWei(REWARD_PER_BLOCK),
                                  0,
                                  10,
                                  accounts[0]);
  await hatToken.setMaster(hatVaults.address);
  await hatVaults.addPool(100,stakingToken.address,true,[accounts[0]]);
};

function assertVMException(error) {
    let condition = (
        error.message.search('VM Exception') > -1 || error.message.search('Transaction reverted') > -1
    );
    assert.isTrue(condition, 'Expected a VM Exception, got this instead:' + error.message);
}

contract('HatVaults',  accounts =>  {

    it("constructor", async () => {
        await setup(accounts);
        assert.equal(await stakingToken.name(), "Staking");
        assert.equal(await hatVaults.governance(), accounts[0]);
        assert.equal(await hatVaults.owner(), accounts[0]);

    });

    it("stake", async () => {
        await setup(accounts);
        var staker = accounts[1];
        try {
            await hatVaults.deposit(0,web3.utils.toWei("1"),{from:staker});
            assert(false, 'cannot stake without approve');
        } catch (ex) {
          assertVMException(ex);
        }
        await stakingToken.approve(hatVaults.address,web3.utils.toWei("1"),{from:staker});
        try {
            await hatVaults.deposit(0,1000,{from:staker});
            assert(false, 'do not have enough tokens to stake');
        } catch (ex) {
          assertVMException(ex);
        }
        await stakingToken.mint(staker,web3.utils.toWei("1"));
        assert.equal(await stakingToken.balanceOf(staker), web3.utils.toWei("1"));
        await hatVaults.deposit(0,web3.utils.toWei("1"),{from:staker});
        await increaseTime(7*24*3600);
        assert.equal(await stakingToken.balanceOf(staker), 0);
        assert.equal(await stakingToken.balanceOf(hatVaults.address), web3.utils.toWei("1"));
        //withdraw
        assert.equal(await hatToken.balanceOf(staker), 0);
        let currentBlockNumber = (await web3.eth.getBlock("latest")).number;

        let lastRewardBlock = (await hatVaults.poolInfo(0)).lastRewardBlock;
        let rewardPerShare = new web3.utils.BN((await hatVaults.poolInfo(0)).rewardPerShare);
        let onee12 = new web3.utils.BN("1000000000000");
        let stakeVaule = new web3.utils.BN(web3.utils.toWei("1"));
        let poolReward = await hatVaults.getPoolReward(lastRewardBlock,currentBlockNumber+1,100);
        rewardPerShare = rewardPerShare.add(poolReward.mul(onee12).div(stakeVaule));
        let expectedReward = stakeVaule.mul(rewardPerShare).div(onee12);

        await hatVaults.withdraw(0,web3.utils.toWei("1"),{from:staker});
        //staker  get stake back
        assert.equal(await stakingToken.balanceOf(staker), web3.utils.toWei("1"));
        assert.equal((await hatToken.balanceOf(staker)).toString(),
                      expectedReward.toString());
    });
  //
  // //
  it("approve+ stake + exit", async () => {
    await setup(accounts);
    var staker = accounts[1];
    var staker2 = accounts[3];
    await stakingToken.approve(hatVaults.address,web3.utils.toWei("1"),{from:staker});
    await stakingToken.approve(hatVaults.address,web3.utils.toWei("1"),{from:staker2});
    await stakingToken.mint(staker,web3.utils.toWei("1"));
    await stakingToken.mint(staker2,web3.utils.toWei("1"));

    //stake
    await hatVaults.deposit(0,web3.utils.toWei("1"),{from:staker});
  //  assert.equal(await hatVaults.lpBalances(staker), web3.utils.toWei("1"));
  //exit
    assert.equal(await hatToken.balanceOf(staker),0);
    await increaseTime(7*24*3600);
    await hatVaults.approveClaim(0,accounts[2],0);
    await hatVaults.deposit(0,web3.utils.toWei("1"),{from:staker2});
    assert.equal(await stakingToken.balanceOf(staker),0);
    let stakerAmount = await hatVaults.getStakedAmount(0,staker);
    assert.equal(stakerAmount.toString(),web3.utils.toWei("1"));
  //  assert.equal(await stakingToken.balanceOf(hatVaults.address),0);
    await hatVaults.withdraw(0,stakerAmount,{from:staker});

    assert.equal(web3.utils.fromWei(await stakingToken.balanceOf(staker)),"0.01");
    // await hatVaults.exit({from:staker2});
    await hatVaults.withdraw(0,web3.utils.toWei("100"),{from:staker2});
    assert.equal(web3.utils.fromWei(await stakingToken.balanceOf(staker2)),"1");
    // assert.equal((await stakingToken.balanceOf(staker2)).toString(),web3.utils.toWei("1"));
  });

  it("enable farming  + 2xapprove+ exit", async () => {
    await setup(accounts);
    var staker = accounts[1];
    await stakingToken.approve(hatVaults.address,web3.utils.toWei("1"),{from:staker});
    await stakingToken.mint(staker,web3.utils.toWei("1"));
    //start farming
    //stake
    await hatVaults.deposit(0,web3.utils.toWei("1"),{from:staker});
    await increaseTime(7*24*3600);
  //exit
    assert.equal(await hatToken.balanceOf(staker),0);
    await hatVaults.approveClaim(0,accounts[2],1);
    await hatVaults.approveClaim(0,accounts[2],1);
    let currentBlockNumber = (await web3.eth.getBlock("latest")).number;
    let lastRewardBlock = (await hatVaults.poolInfo(0)).lastRewardBlock;
    let rewardPerShare = new web3.utils.BN((await hatVaults.poolInfo(0)).rewardPerShare);
    let onee12 = new web3.utils.BN("1000000000000");
    let stakeVaule = new web3.utils.BN(web3.utils.toWei("1"));
    let poolReward = await hatVaults.getPoolReward(lastRewardBlock,currentBlockNumber+1,100);
    rewardPerShare = rewardPerShare.add(poolReward.mul(onee12).div(stakeVaule));
    let expectedReward = stakeVaule.mul(rewardPerShare).div(onee12);

    await hatVaults.withdraw(0,web3.utils.toWei("1"),{from:staker});
    let expectedBalance = web3.utils.toWei("1") / web3.utils.toWei("1") * await hatVaults.factor();
    assert.equal(await stakingToken.balanceOf(staker),expectedBalance);

    let balanceOfStakerHats = await hatToken.balanceOf(staker);
    assert.equal(balanceOfStakerHats.toString(),
                  expectedReward);

  });
});
