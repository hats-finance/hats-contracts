const HATVaults = artifacts.require("./HATVaults.sol");
const HATToken = artifacts.require("./HATToken.sol");
const ERC20Mock = artifacts.require("./ERC20Mock.sol");
const UniSwapV2RouterMock = artifacts.require("./UniSwapV2RouterMock.sol");
const utils = require("./utils.js");

var hatVaults;
var hatToken;
var stakingToken;
var REWARD_PER_BLOCK = "100";

const setup = async function (accounts,reward_per_block=REWARD_PER_BLOCK, startBlock=0) {
  hatToken = await HATToken.new(accounts[0],utils.TIME_LOCK_DELAY_IN_BLOCKS_UNIT);
  stakingToken = await ERC20Mock.new("Staking","STK",accounts[0]);

  var router =  await UniSwapV2RouterMock.new();

  hatVaults = await HATVaults.new(hatToken.address,
                                  web3.utils.toWei(reward_per_block),
                                  startBlock,
                                  10,
                                  accounts[0],
                                  router.address);
  await utils.setMinter(hatToken,hatVaults.address,web3.utils.toWei("175000"));
  await utils.setMinter(hatToken,accounts[0],web3.utils.toWei("175000"));
  await hatToken.mint(router.address, web3.utils.toWei("175000"));
  await hatVaults.addPool(100,stakingToken.address,true,[accounts[0]],[],[0,0,0,0]);
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
    });
  //
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
        await utils.increaseTime(7*24*3600);
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

    async function calculateExpectedReward(staker) {
      let currentBlockNumber = (await web3.eth.getBlock("latest")).number;
      let lastRewardBlock = (await hatVaults.poolInfo(0)).lastRewardBlock;
      let allocPoint = (await hatVaults.poolInfo(0)).allocPoint;
      let rewardPerShare = new web3.utils.BN((await hatVaults.poolInfo(0)).rewardPerShare);
      //console.log("rewardPerShare",web3.utils.fromWei(rewardPerShare.toString()))
      let onee12 = new web3.utils.BN("1000000000000");
      let stakerAmount = (await hatVaults.userInfo(0,staker)).amount;
      let poolReward = await hatVaults.getPoolReward(lastRewardBlock,currentBlockNumber+1,allocPoint);
      let lpSupply = await stakingToken.balanceOf(hatVaults.address);
      rewardPerShare = rewardPerShare.add(poolReward.mul(onee12).div(lpSupply));
      let rewardDebt = (await hatVaults.userInfo(0,staker)).rewardDebt;
      return stakerAmount.mul(rewardPerShare).div(onee12).sub(rewardDebt);
    }

    it("multiple stakes from same account", async () => {
      await setup(accounts);
      var staker = accounts[1];
      await stakingToken.approve(hatVaults.address,web3.utils.toWei("4"),{from:staker});
      await stakingToken.mint(staker,web3.utils.toWei("1"));
      await hatVaults.deposit(0,web3.utils.toWei("1"),{from:staker});

      assert.equal(await hatToken.balanceOf(staker), 0);

      // Deposit redeemed existing reward
      await stakingToken.mint(staker,web3.utils.toWei("1"));
      let expectedReward = await calculateExpectedReward(staker);
      await hatVaults.deposit(0,web3.utils.toWei("1"),{from:staker});
      assert.equal((await hatToken.balanceOf(staker)).toString(), expectedReward.toString());

      await stakingToken.mint(staker,web3.utils.toWei("1"));
      expectedReward = await calculateExpectedReward(staker);
      var balanceOfStakerBefore = await hatToken.balanceOf(staker);
      await hatVaults.deposit(0,web3.utils.toWei("1"),{from:staker});
      assert.equal((await hatToken.balanceOf(staker)).toString(), expectedReward.add(balanceOfStakerBefore).toString());

      // Deposit redeemed existing reward
      await utils.increaseTime(7*24*3600);
      await stakingToken.mint(staker,web3.utils.toWei("1"));
      expectedReward = await calculateExpectedReward(staker);
      balanceOfStakerBefore = await hatToken.balanceOf(staker);
      await hatVaults.deposit(0,web3.utils.toWei("1"),{from:staker});
      assert.equal((await hatToken.balanceOf(staker)).toString(), expectedReward.add(balanceOfStakerBefore).toString());
      assert.equal(await stakingToken.balanceOf(staker), 0);
      assert.equal(await stakingToken.balanceOf(hatVaults.address), web3.utils.toWei("4"));
      await utils.increaseTime(7*24*3600);
      //withdraw
      expectedReward = await calculateExpectedReward(staker);
      balanceOfStakerBefore = await hatToken.balanceOf(staker);
      await hatVaults.withdraw(0,web3.utils.toWei("4"),{from:staker});
      //staker  get stake back
      assert.equal((await stakingToken.balanceOf(staker)).toString(), web3.utils.toWei("4").toString());
      assert.equal((await hatToken.balanceOf(staker)).toString(), expectedReward.add(balanceOfStakerBefore).toString());
    });

    it("getMultiplier - from below startblock return 0", async () => {
      await setup(accounts, REWARD_PER_BLOCK, 1);
      assert.equal((await hatVaults.getMultiplier(0, 1)).toNumber(), 0);
      await setup(accounts, REWARD_PER_BLOCK, 0);
      assert.equal((await hatVaults.getMultiplier(0, 1)).toNumber(), 688);
    });

    it("getMultiplier - from must be <= to", async () => {
      await setup(accounts, REWARD_PER_BLOCK, 0);
      try {
        await hatVaults.getMultiplier(1, 0);
        assert(false, 'from must be <= to');
      } catch (ex) {
        assertVMException(ex);
      }
      assert.equal((await hatVaults.getMultiplier(0, 0)).toNumber(), 0);
    });

    it("getMultiplier - from below startblock return 0", async () => {
      await setup(accounts, REWARD_PER_BLOCK, 0);
      assert.equal((await hatVaults.getMultiplier(0, 10)).toNumber(), 688 * 10);
      assert.equal((await hatVaults.getMultiplier(0, 15)).toNumber(), (688 * 10) + (413 * 5));
      assert.equal((await hatVaults.getMultiplier(0, 20)).toNumber(), (688 * 10) + (413 * 10));
      assert.equal((await hatVaults.getMultiplier(0, 1000)).toNumber(), (688 * 10) + (413 * 10) + (310 * 10) + (232 * 10) + (209 * 10) + (188 * 10) + (169 * 10) + (152 * 10) + (137 * 10) + (123 * 10) + (111 * 10) + (100 * 890));
  });


  it("emergency withdraw", async () => {
    await setup(accounts);
    var staker = accounts[1];
    var staker2 = accounts[3];
    var notStaker = accounts[4];
    await stakingToken.approve(hatVaults.address,web3.utils.toWei("1"),{from:staker});
    await stakingToken.approve(hatVaults.address,web3.utils.toWei("1"),{from:staker2});
    await stakingToken.mint(staker,web3.utils.toWei("1"));
    await stakingToken.mint(staker2,web3.utils.toWei("1"));

    //stake
    await hatVaults.deposit(0,web3.utils.toWei("1"),{from:staker});

    assert.equal(await hatToken.balanceOf(staker),0);
    await utils.increaseTime(7*24*3600);

    assert.equal(await stakingToken.balanceOf(staker),0);
    let stakerAmount = await hatVaults.getStakedAmount(0,staker);
    assert.equal(stakerAmount.toString(),web3.utils.toWei("1"));

    // Can emergency withdraw 1 token
    assert.equal(await stakingToken.balanceOf(staker),0);
    await hatVaults.emergencyWithdraw(0 ,{from:staker});
    assert.equal(web3.utils.fromWei((await stakingToken.balanceOf(staker))),1);

    // Can emergency withdraw only once
    await hatVaults.emergencyWithdraw(0 ,{from:staker});
    assert.equal(web3.utils.fromWei((await stakingToken.balanceOf(staker))),1);

    // Can't withdraw if didn't deposit
    assert.equal(web3.utils.fromWei((await stakingToken.balanceOf(notStaker))), 0);
    await hatVaults.emergencyWithdraw(0 ,{from:notStaker});
    assert.equal(web3.utils.fromWei((await stakingToken.balanceOf(notStaker))), 0);
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
    await utils.increaseTime(7*24*3600);
    await hatVaults.approveClaim(0,accounts[2],4);

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
    await utils.increaseTime(7*24*3600);
  //exit
    assert.equal(await hatToken.balanceOf(staker),0);
    var rewards = await hatVaults.calcClaimRewards(0,1);
    //check factor
    assert.equal(web3.utils.fromWei(rewards[4].toString()),"0.604");
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
    let expectedBalance = web3.utils.toWei("1") / web3.utils.toWei("1") * (await hatVaults.getPoolRewards(0)).factor;
    await hatVaults.withdraw(0,web3.utils.toWei("1"),{from:staker});
    assert.equal(await stakingToken.balanceOf(staker),expectedBalance);

    let balanceOfStakerHats = await hatToken.balanceOf(staker);
    assert.equal(balanceOfStakerHats.toString(),
                  expectedReward);

  });

  it("deposit + withdraw after time end (bdp bug)", async () => {
      await setup(accounts,"1000");
      var staker = accounts[1];

      await stakingToken.approve(hatVaults.address,web3.utils.toWei("1"),{from:staker});
      await stakingToken.mint(staker,web3.utils.toWei("1"));
      await hatVaults.deposit(0,web3.utils.toWei("1"),{from:staker});
      //withdraw
      //increase blocks and mine all blocks
      var allBlocksOfFarm = 175000/1000; // rewardsAllocatedToFarm/rewardPerBlock
      for(var i =0;i<allBlocksOfFarm;i++) {
          await utils.increaseTime(1);
      }
      await hatVaults.updatePool(0);
      await hatVaults.withdraw(0,web3.utils.toWei("1"),{from:staker});

      //staker  get stake back
      assert.equal(await stakingToken.balanceOf(staker), web3.utils.toWei("1"));
      //and get all rewards
      assert.equal((await hatToken.balanceOf(staker)).toString(),
                    web3.utils.toWei("175000").toString());
  });

  it("approve+ swapAndSend", async () => {
    await setup(accounts);
    var staker = accounts[1];
    var staker2 = accounts[3];
    await stakingToken.approve(hatVaults.address,web3.utils.toWei("1"),{from:staker});
    await stakingToken.approve(hatVaults.address,web3.utils.toWei("1"),{from:staker2});
    await stakingToken.mint(staker,web3.utils.toWei("1"));
    await stakingToken.mint(staker2,web3.utils.toWei("1"));
    await hatVaults.deposit(0,web3.utils.toWei("1"),{from:staker});
    assert.equal(await hatToken.balanceOf(staker),0);
    await utils.increaseTime(7*24*3600);
    await hatVaults.approveClaim(0,accounts[2],4);

    var tx = await hatVaults.swapAndSend(0,{from:accounts[2]});
    assert.equal(tx.logs[0].event, "SwapAndSend");
    assert.equal((await hatToken.balanceOf(accounts[2])).toString(),tx.logs[0].args._amountReceived.toString());

  });
});
