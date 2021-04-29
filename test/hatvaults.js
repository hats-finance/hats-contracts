const HATVaults = artifacts.require("./HATVaults.sol");
const HATToken = artifacts.require("./HATToken.sol");
const ERC20Mock = artifacts.require("./ERC20Mock.sol");
const UniSwapV2RouterMock = artifacts.require("./UniSwapV2RouterMock.sol");
const TokenLockFactory = artifacts.require("./TokenLockFactory.sol");
const HATTokenLock = artifacts.require("./HATTokenLock.sol");
const utils = require("./utils.js");

var hatVaults;
var hatToken;
var router;
var stakingToken;
var REWARD_PER_BLOCK = "100";
var tokenLockFactory;

const setup = async function (
                              accounts,
                              reward_per_block=REWARD_PER_BLOCK,
                              startBlock=0,
                              rewardsLevels=[],
                              rewardsSplit=[0,0,0,0],
                            ) {
  hatToken = await HATToken.new(accounts[0],utils.TIME_LOCK_DELAY_IN_BLOCKS_UNIT);
  stakingToken = await ERC20Mock.new("Staking","STK",accounts[0]);

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
  await utils.setMinter(hatToken,hatVaults.address,web3.utils.toWei("175000"));
  await utils.setMinter(hatToken,accounts[0],web3.utils.toWei("175000"));
  await hatToken.mint(router.address, web3.utils.toWei("175000"));
  await hatVaults.addPool(100,stakingToken.address,[accounts[0]],rewardsLevels,rewardsSplit,"_descriptionHash",86400,10);
  await hatVaults.setCommittee(0,[accounts[0]],[true]);
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

    it("setCommitte", async () => {
        await setup(accounts);
        assert.equal(await hatVaults.committees(0,accounts[0]), true);

        await hatVaults.setCommittee(0,[accounts[0],accounts[2]],[false,true]);

        assert.equal(await hatVaults.committees(0,accounts[0]), false);
        assert.equal(await hatVaults.committees(0,accounts[2]), true);

        try {
          await hatVaults.setCommittee(0,[accounts[0],accounts[2]],[false,true], {from: accounts[1]});
          assert(false, 'cannot set approvers from non approver account');
        } catch (ex) {
          assertVMException(ex);
        }

        //set other pool with different committee
        let rewardsLevels=[];
        let rewardsSplit=[0,0,0,0];
        var stakingToken2 = await ERC20Mock.new("Staking","STK",accounts[0]);
        await hatVaults.addPool(100,stakingToken2.address,[accounts[1]],rewardsLevels,rewardsSplit,"_descriptionHash",86400,10);
        await hatVaults.setCommittee(1,[accounts[1],accounts[2]],[true,true]);
        assert.equal(await hatVaults.committees(1,accounts[1]), true);
        assert.equal(await hatVaults.committees(1,accounts[2]), true);
        //committe check in
        var staker = accounts[1];
        await stakingToken2.approve(hatVaults.address,web3.utils.toWei("4"),{from:staker});
        await stakingToken2.mint(staker,web3.utils.toWei("1"));
        try {
            await hatVaults.deposit(1,web3.utils.toWei("1"),{from:staker});
            assert(false, 'cannot deposit before committee check in');
        } catch (ex) {
            assertVMException(ex);
        }

        await hatVaults.setCommittee(1,[accounts[1],accounts[2]],[true,true],{from:accounts[1]});
        await hatVaults.deposit(1,web3.utils.toWei("1"),{from:staker});

        try {
             await hatVaults.setCommittee(1,[accounts[1],accounts[2]],[true,true]);
            assert(false, 'commitee already checked in');
        } catch (ex) {
            assertVMException(ex);
        }
        await hatVaults.setCommittee(1,[accounts[1],accounts[2]],[true,true],{from:accounts[2]});
    });

    it("custom rewardsSplit and rewardsLevels", async () => {
      try {
          await setup(accounts, REWARD_PER_BLOCK, 0, [3000, 5000, 7000, 9000], [9000, 200, 100, 800]);
          assert(false, 'cannot init with rewardSplit > 10000');
      } catch (ex) {
          assertVMException(ex);
      }
      try {
          await setup(accounts, REWARD_PER_BLOCK, 0, [3000, 5000, 7000, 11000], [8000, 100, 100, 800]);
          assert(false, 'cannot init with rewardLevel > 10000');
      } catch (ex) {
          assertVMException(ex);
      }

      await setup(accounts, REWARD_PER_BLOCK, 0, [3000, 5000, 7000, 9000], [8000, 100, 100, 700]);
      assert.equal((await hatVaults.getPoolRewardsLevels(0)).length, 4);
      assert.equal((await hatVaults.getPoolRewardsLevels(0))[0].toString(), "3000");
      assert.equal((await hatVaults.getPoolRewardsLevels(0))[1].toString(), "5000");
      assert.equal((await hatVaults.getPoolRewardsLevels(0))[2].toString(), "7000");
      assert.equal((await hatVaults.getPoolRewardsLevels(0))[3].toString(), "9000");
      assert.equal((await hatVaults.getPoolRewards(0)).hackerRewardSplit.toString(), "8000");
      assert.equal((await hatVaults.getPoolRewards(0)).approverRewardSplit.toString(), "100");
      assert.equal((await hatVaults.getPoolRewards(0)).swapAndBurnSplit.toString(), "100");
      assert.equal((await hatVaults.getPoolRewards(0)).hackerHatRewardSplit.toString(), "700");

      try {
          await hatVaults.setRewardsLevels(0, [1500, 3000, 4500, 9000, 11000]);
          assert(false, "reward level can't be more than 10000");
      } catch (ex) {
          assertVMException(ex);
      }
      try {
          await hatVaults.setRewardsLevels(0, [1500, 3000, 4500, 9000, 10000],{from:accounts[2]});
          assert(false, "only committee");
      } catch (ex) {
          assertVMException(ex);
      }
      await hatVaults.setRewardsLevels(0, [1500, 3000, 4500, 9000, 10000]);
      try {
          await hatVaults.setRewardsSplit(0, [7000, 1000, 1100, 900]);
          assert(false, 'cannot init with rewardSplit > 10000');
      } catch (ex) {
          assertVMException(ex);
      }
      await hatVaults.setRewardsSplit(0, [6000, 1000, 1100, 800]);
      assert.equal((await hatVaults.getPoolRewardsLevels(0)).length, 5);
      assert.equal((await hatVaults.getPoolRewardsLevels(0))[0].toString(), "1500");
      assert.equal((await hatVaults.getPoolRewardsLevels(0))[1].toString(), "3000");
      assert.equal((await hatVaults.getPoolRewardsLevels(0))[2].toString(), "4500");
      assert.equal((await hatVaults.getPoolRewardsLevels(0))[3].toString(), "9000");
      assert.equal((await hatVaults.getPoolRewardsLevels(0))[4].toString(), "10000");
      assert.equal((await hatVaults.getPoolRewards(0)).hackerRewardSplit.toString(), "6000");
      assert.equal((await hatVaults.getPoolRewards(0)).approverRewardSplit.toString(), "1000");
      assert.equal((await hatVaults.getPoolRewards(0)).swapAndBurnSplit.toString(), "1100");
      assert.equal((await hatVaults.getPoolRewards(0)).hackerHatRewardSplit.toString(), "800");

      await hatVaults.setRewardsLevels(0, []);
      assert.equal((await hatVaults.getPoolRewardsLevels(0)).length, 5);
      assert.equal((await hatVaults.getPoolRewardsLevels(0))[0].toString(), "2000");
      assert.equal((await hatVaults.getPoolRewardsLevels(0))[1].toString(), "4000");
      assert.equal((await hatVaults.getPoolRewardsLevels(0))[2].toString(), "6000");
      assert.equal((await hatVaults.getPoolRewardsLevels(0))[3].toString(), "8000");
      assert.equal((await hatVaults.getPoolRewardsLevels(0))[4].toString(), "10000");
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
        assert.equal(await hatToken.balanceOf(hatVaults.address), 0);
        await hatVaults.deposit(0,web3.utils.toWei("1"),{from:staker});
        assert.equal(await hatToken.balanceOf(hatVaults.address), 0);
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
        let totalAllocPoint = await hatVaults.totalAllocPoint();
        let poolReward = await hatVaults.getPoolReward(lastRewardBlock,currentBlockNumber+1,100, totalAllocPoint);
        rewardPerShare = rewardPerShare.add(poolReward.mul(onee12).div(stakeVaule));
        let expectedReward = stakeVaule.mul(rewardPerShare).div(onee12);

        await safeWithdraw(0,web3.utils.toWei("1"),staker);
        //staker  get stake back
        assert.equal(await stakingToken.balanceOf(staker), web3.utils.toWei("1"));
        assert.equal((await hatToken.balanceOf(staker)).toString(),
                      expectedReward.toString());
        //withdraw with 0
        await hatVaults.withdraw(0,0,{from:staker});
        assert.equal(await stakingToken.balanceOf(staker), web3.utils.toWei("1"));
        assert.equal((await hatToken.balanceOf(staker)).toString(),
                      expectedReward.toString());
    });

    async function calculateExpectedReward(staker) {
      let currentBlockNumber = (await web3.eth.getBlock("latest")).number;
      let lastRewardBlock = (await hatVaults.poolInfo(0)).lastRewardBlock;
      let allocPoint = (await hatVaults.poolInfo(0)).allocPoint;
      let rewardPerShare = new web3.utils.BN((await hatVaults.poolInfo(0)).rewardPerShare);
      let onee12 = new web3.utils.BN("1000000000000");
      let stakerAmount = (await hatVaults.userInfo(0,staker)).amount;
      let totalAllocPoint = await hatVaults.totalAllocPoint();
      let poolReward = await hatVaults.getPoolReward(lastRewardBlock,currentBlockNumber+1,allocPoint,totalAllocPoint);
      let lpSupply = await stakingToken.balanceOf(hatVaults.address);
      rewardPerShare = rewardPerShare.add(poolReward.mul(onee12).div(lpSupply));
      let rewardDebt = (await hatVaults.userInfo(0,staker)).rewardDebt;
      return stakerAmount.mul(rewardPerShare).div(onee12).sub(rewardDebt);
    }

    async function safeEmergencyWithdraw(pid, staker) {
      let currentBlockNumber = (await web3.eth.getBlock("latest")).number;
      let WITHDRAW_PERIOD  =  await hatVaults.WITHDRAW_PERIOD();
      let WITHDRAW_DISABLE_PERIOD = await hatVaults.WITHDRAW_DISABLE_PERIOD();
      while (currentBlockNumber % (WITHDRAW_PERIOD.toNumber() + WITHDRAW_DISABLE_PERIOD.toNumber()) >= WITHDRAW_PERIOD.toNumber()) {
         await utils.mineBlock();
         currentBlockNumber = (await web3.eth.getBlock("latest")).number;
      }
      return await hatVaults.emergencyWithdraw(pid,{from:staker});
    }

    async function unSafeEmergencyWithdraw(pid, staker) {
      let currentBlockNumber = (await web3.eth.getBlock("latest")).number;
      let WITHDRAW_PERIOD  =  await hatVaults.WITHDRAW_PERIOD();
      let WITHDRAW_DISABLE_PERIOD = await hatVaults.WITHDRAW_DISABLE_PERIOD();
      while (currentBlockNumber % (WITHDRAW_PERIOD.toNumber() + WITHDRAW_DISABLE_PERIOD.toNumber()) < WITHDRAW_PERIOD.toNumber()) {
         await utils.mineBlock();
         currentBlockNumber = (await web3.eth.getBlock("latest")).number;
      }
      return await hatVaults.emergencyWithdraw(pid,{from:staker});
    }

    async function unSafeWithdraw(pid, amount, staker) {
      let currentBlockNumber = (await web3.eth.getBlock("latest")).number;
      let WITHDRAW_PERIOD  =  await hatVaults.WITHDRAW_PERIOD();
      let WITHDRAW_DISABLE_PERIOD = await hatVaults.WITHDRAW_DISABLE_PERIOD();
      while (currentBlockNumber % (WITHDRAW_PERIOD.toNumber() + WITHDRAW_DISABLE_PERIOD.toNumber()) < WITHDRAW_PERIOD.toNumber()) {
         await utils.mineBlock();
         currentBlockNumber = (await web3.eth.getBlock("latest")).number;
      }
      return await hatVaults.withdraw(pid,amount,{from:staker});
    }

    async function safeWithdraw(pid, amount, staker) {
      let currentBlockNumber = (await web3.eth.getBlock("latest")).number;
      let WITHDRAW_PERIOD  =  await hatVaults.WITHDRAW_PERIOD();
      let WITHDRAW_DISABLE_PERIOD = await hatVaults.WITHDRAW_DISABLE_PERIOD();
      while (currentBlockNumber % (WITHDRAW_PERIOD.toNumber() + WITHDRAW_DISABLE_PERIOD.toNumber()) >= WITHDRAW_PERIOD.toNumber()) {
         await utils.mineBlock();
         currentBlockNumber = (await web3.eth.getBlock("latest")).number;
      }
      return await hatVaults.withdraw(pid,amount,{from:staker});
    }


    it("claim reward", async () => {
      await setup(accounts);
      var staker = accounts[1];
      await stakingToken.approve(hatVaults.address,web3.utils.toWei("4"),{from:staker});
      await stakingToken.mint(staker,web3.utils.toWei("1"));
      await hatVaults.deposit(0,web3.utils.toWei("1"),{from:staker});
      assert.equal(await hatToken.balanceOf(hatVaults.address), 0);

      assert.equal(await hatToken.balanceOf(staker), 0);

      let expectedReward = await calculateExpectedReward(staker);
      assert.equal(await hatToken.balanceOf(hatVaults.address), 0);

      await hatVaults.claimReward(0, {from:staker});
      assert.equal(await hatToken.balanceOf(hatVaults.address), 0);

      assert.equal((await hatToken.balanceOf(staker)).toString(), expectedReward.toString());
      assert.equal(await stakingToken.balanceOf(staker), 0);
      assert.equal(await stakingToken.balanceOf(hatVaults.address), web3.utils.toWei("1"));
    });

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
      var tx = await hatVaults.deposit(0,web3.utils.toWei("1"),{from:staker});
      assert.equal(tx.logs[0].event, "SendReward");
      assert.equal(tx.logs[0].args.amount.toString(), expectedReward.toString());
      assert.equal(tx.logs[0].args.user, staker);
      assert.equal(tx.logs[0].args.pid, 0);
      assert.isTrue(tx.logs[0].args.requestedAmount.eq(tx.logs[0].args.amount));
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

  it("pendingReward + getRewardPerBlock", async () => {
    await setup(accounts);
    var staker = accounts[1];
    assert.equal((await hatVaults.pendingReward(0, staker)).toNumber(), 0);
    await stakingToken.approve(hatVaults.address,web3.utils.toWei("4"),{from:staker});
    await stakingToken.mint(staker,web3.utils.toWei("1"));
    await hatVaults.deposit(0,web3.utils.toWei("1"),{from:staker});
    await utils.increaseTime(7*24*3600);
    assert.equal((await hatVaults.pendingReward(0, staker)).toString(), (await hatVaults.getRewardPerBlock(1)).toString());
    assert.equal((await hatVaults.getRewardPerBlock(0)).toString(), "100000000000000000000");
  });

  it("emergency withdraw", async () => {
    await setup(accounts);
    var staker = accounts[1];
    var staker2 = accounts[3];
    await stakingToken.approve(hatVaults.address,web3.utils.toWei("1"),{from:staker});
    await stakingToken.approve(hatVaults.address,web3.utils.toWei("1"),{from:staker2});
    await stakingToken.mint(staker,web3.utils.toWei("1"));
    await stakingToken.mint(staker2,web3.utils.toWei("1"));

    //stake
    await hatVaults.deposit(0,web3.utils.toWei("1"),{from:staker});
    assert.equal(await hatToken.balanceOf(hatVaults.address),0);


    assert.equal(await hatToken.balanceOf(staker),0);
    await utils.increaseTime(7*24*3600);

    assert.equal(await stakingToken.balanceOf(staker),0);
    let stakerAmount = await hatVaults.getStakedAmount(0,staker);
    assert.equal(stakerAmount.toString(),web3.utils.toWei("1"));

    // Can emergency withdraw 1 token
    assert.equal(await stakingToken.balanceOf(staker),0);
    try {
          await unSafeEmergencyWithdraw(0,staker);
          assert(false, 'cannot emergency withdraw ');
        } catch (ex) {
          assertVMException(ex);
      }

    await safeEmergencyWithdraw(0 ,staker);
    assert.equal(await hatToken.balanceOf(hatVaults.address),0);

    assert.equal(web3.utils.fromWei((await stakingToken.balanceOf(staker))),1);

    //Can emergency withdraw only once
    try {
          await safeEmergencyWithdraw(0,staker);
          assert(false, 'Can emergency withdraw only once');
        } catch (ex) {
          assertVMException(ex);
      }
    assert.equal(await hatToken.balanceOf(hatVaults.address),0);

    assert.equal(web3.utils.fromWei((await stakingToken.balanceOf(staker))),1);
    try {
          await hatVaults.withdraw(0,1,{from:staker});
          assert(false, 'cannot withdraw after emergenecy withdraw');
        } catch (ex) {
          assertVMException(ex);
      }
  });

  //
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
    assert.equal(await hatToken.balanceOf(hatVaults.address),0);

  //  assert.equal(await hatVaults.lpBalances(staker), web3.utils.toWei("1"));
  //exit
    assert.equal(await hatToken.balanceOf(staker),0);
    await utils.increaseTime(7*24*3600);
    try {
          await hatVaults.approveClaim(0,accounts[2],4,{from:accounts[2]});
          assert(false, 'only Committee');
        } catch (ex) {
          assertVMException(ex);
      }
      try {
            await hatVaults.pauseApproval(0,true,{from:accounts[2]});
            assert(false, 'only gov');
          } catch (ex) {
            assertVMException(ex);
        }
    await hatVaults.pauseApproval(0,true);
    try {
          await hatVaults.approveClaim(0,accounts[2],4);
          assert(false, 'pool is paused');
        } catch (ex) {
          assertVMException(ex);
      }
    await hatVaults.pauseApproval(0,false);

    var tx = await hatVaults.approveClaim(0,accounts[2],4);
    assert.equal(await hatToken.balanceOf(hatVaults.address),0);

    assert.equal(tx.logs[0].event, "ClaimApprove");
    await hatVaults.deposit(0,web3.utils.toWei("1"),{from:staker2});
    assert.equal(await stakingToken.balanceOf(staker),0);
    let stakerAmount = await hatVaults.getStakedAmount(0,staker);
    assert.equal(stakerAmount.toString(),web3.utils.toWei("1"));
  //  assert.equal(await stakingToken.balanceOf(hatVaults.address),0);
    tx = await hatVaults.withdraw(0,stakerAmount,{from:staker});

    assert.equal(stakerAmount.toString(),web3.utils.toWei("1"));

    assert.equal(tx.logs[0].event, "SendReward");
    assert.isTrue(tx.logs[0].args.amount.eq(tx.logs[0].args.requestedAmount));

    assert.equal(web3.utils.fromWei(await stakingToken.balanceOf(staker)),"0.01");
    stakerAmount = await hatVaults.getStakedAmount(0,staker2);
    tx = await hatVaults.withdraw(0,stakerAmount,{from:staker2});
    assert.equal(tx.logs[0].event, "SendReward");
    assert.isTrue(tx.logs[0].args.amount.eq(tx.logs[0].args.requestedAmount));
    //dust
    assert.equal(web3.utils.fromWei((await hatToken.balanceOf(hatVaults.address)).toString()), "0.0000000001");
    assert.equal(web3.utils.fromWei(await stakingToken.balanceOf(staker2)),"1");
  });


  it("approve+ stake simple check rewards", async () => {
    await setup(accounts);
    var staker = accounts[1];
    await stakingToken.approve(hatVaults.address,web3.utils.toWei("1"),{from:staker});
    await stakingToken.mint(staker,web3.utils.toWei("1"));

    //stake
    await hatVaults.deposit(0,web3.utils.toWei("1"),{from:staker});
  //  assert.equal(await hatVaults.lpBalances(staker), web3.utils.toWei("1"));
  //exit
    assert.equal(await hatToken.balanceOf(staker),0);
    await utils.increaseTime(7*24*3600);
    var tx = await hatVaults.approveClaim(0,accounts[2],4);
    assert.equal(tx.logs[0].event, "ClaimApprove");
    let stakerAmount = await hatVaults.getStakedAmount(0,staker);
    assert.equal(stakerAmount.toString(),web3.utils.toWei("1"));
    tx = await hatVaults.withdraw(0,stakerAmount,{from:staker});
    await hatToken.getPastEvents('Transfer', {
          fromBlock: tx.blockNumber,
          toBlock: 'latest'
      })
      .then(function(events){
          assert.equal(events[0].event,"Transfer");
          assert.equal(events[0].args.from,utils.NULL_ADDRESS);
          assert.equal(events[0].args.to,hatVaults.address );
      });
    assert.equal(tx.logs[0].event, "SendReward");
    assert.isTrue(tx.logs[0].args.amount.eq(tx.logs[0].args.requestedAmount));
    assert.equal(await hatToken.balanceOf(hatVaults.address), 0);
    assert.equal(web3.utils.fromWei(await stakingToken.balanceOf(staker)),"0.01");
  });

  it("emergencyWithdraw after approve and check reward", async () => {
    await setup(accounts);
    var staker = accounts[1];
    var staker2 = accounts[3];
    await stakingToken.approve(hatVaults.address,web3.utils.toWei("2"),{from:staker});
    await stakingToken.approve(hatVaults.address,web3.utils.toWei("1"),{from:staker2});
    await stakingToken.mint(staker,web3.utils.toWei("2"));
    await stakingToken.mint(staker2,web3.utils.toWei("1"));

    //stake
    await hatVaults.deposit(0,web3.utils.toWei("1"),{from:staker});
    await hatVaults.deposit(0,web3.utils.toWei("1"),{from:staker2});

    await utils.increaseTime(7*24*3600);
    await hatVaults.approveClaim(0,accounts[2],4);
    await safeEmergencyWithdraw(0,staker);
    await hatVaults.deposit(0,web3.utils.toWei("1"),{from:staker});
    var tx = await hatVaults.withdraw(0,web3.utils.toWei("1"),{from:staker2});
    assert.equal(tx.logs[0].event, "SendReward");
    assert.isTrue(tx.logs[0].args.amount.eq(tx.logs[0].args.requestedAmount));
    tx = await hatVaults.withdraw(0,web3.utils.toWei("1"),{from:staker});
    assert.equal(tx.logs[0].event, "SendReward");
    assert.isTrue(tx.logs[0].args.amount.eq(tx.logs[0].args.requestedAmount));

  });


  it("emergencyWithdraw after approve", async () => {
    await setup(accounts);
    var staker = accounts[1];
    var staker2 = accounts[3];
    await stakingToken.approve(hatVaults.address,web3.utils.toWei("2"),{from:staker});
    await stakingToken.approve(hatVaults.address,web3.utils.toWei("1"),{from:staker2});
    await stakingToken.mint(staker,web3.utils.toWei("2"));
    await stakingToken.mint(staker2,web3.utils.toWei("1"));

    //stake
    await hatVaults.deposit(0,web3.utils.toWei("1"),{from:staker});
  //exit
    assert.equal(await hatToken.balanceOf(staker),0);
    assert.equal(await hatToken.balanceOf(hatVaults.address),0);

    await utils.increaseTime(7*24*3600);
    var tx = await hatVaults.approveClaim(0,accounts[2],4);
    assert.equal(tx.logs[0].event, "ClaimApprove");
    tx = await safeEmergencyWithdraw(0,staker);

    assert.equal((tx.logs[0].args.amount).toString(),web3.utils.toWei("0.01"));
    await hatVaults.deposit(0,web3.utils.toWei("1"),{from:staker2});
    assert.equal(await hatToken.balanceOf(staker2),0);


    tx = await safeEmergencyWithdraw(0,staker2);
    assert.equal((tx.logs[0].args.amount).toString(),web3.utils.toWei("1"));

    await hatVaults.deposit(0,web3.utils.toWei("1"),{from:staker});
    tx = await hatVaults.withdraw(0,web3.utils.toWei("1"),{from:staker});
    assert.equal(tx.logs[0].event, "SendReward");
    assert.isTrue(tx.logs[0].args.amount.eq(tx.logs[0].args.requestedAmount));
    assert.equal(await hatToken.balanceOf(hatVaults.address),0);

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

    await hatVaults.approveClaim(0,accounts[2],1);
    await hatVaults.approveClaim(0,accounts[2],1);
    let currentBlockNumber = (await web3.eth.getBlock("latest")).number;
    let lastRewardBlock = (await hatVaults.poolInfo(0)).lastRewardBlock;
    let rewardPerShare = new web3.utils.BN((await hatVaults.poolInfo(0)).rewardPerShare);
    let onee12 = new web3.utils.BN("1000000000000");
    let stakeVaule = new web3.utils.BN(web3.utils.toWei("1"));

    let poolReward = await hatVaults.getPoolReward(lastRewardBlock,currentBlockNumber+1,100,100);
    rewardPerShare = rewardPerShare.add(poolReward.mul(onee12).div(stakeVaule));
    let expectedReward = stakeVaule.mul(rewardPerShare).div(onee12);
    await hatVaults.withdraw(0,web3.utils.toWei("1"),{from:staker});
    assert.equal((await stakingToken.balanceOf(staker)).toString(),"364816000000000000");//(0.6)*(0.6)

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
      try {
            await hatVaults.massUpdatePools(0,2);
            assert(false, 'massUpdatePools not in range');
          } catch (ex) {
            assertVMException(ex);
        }
      await hatVaults.massUpdatePools(0,1);
      await hatVaults.withdraw(0,web3.utils.toWei("1"),{from:staker});

      //staker  get stake back
      assert.equal(await stakingToken.balanceOf(staker), web3.utils.toWei("1"));
      //and get all rewards
      assert.equal((await hatToken.balanceOf(staker)).toString(),
                    web3.utils.toWei("175000").toString());
  });

  it("approve+ swapBurnSend", async () => {
    await setup(accounts);
    var staker = accounts[1];
    await stakingToken.approve(hatVaults.address,web3.utils.toWei("1"),{from:staker});
    await stakingToken.mint(staker,web3.utils.toWei("1"));
    await hatVaults.deposit(0,web3.utils.toWei("1"),{from:staker});
    assert.equal(await hatToken.balanceOf(staker),0);
    await utils.increaseTime(7*24*3600);
    try {
          await hatVaults.swapBurnSend(0, accounts[2]);
          assert(false, 'cannot swapBurnSend before approve');
        } catch (ex) {
          assertVMException(ex);
      }
    await hatVaults.approveClaim(0,accounts[2],4);
    var tx = await hatVaults.swapBurnSend(0, accounts[2]);
    assert.equal(tx.logs[0].event, "SwapAndBurn");
    var expectedHatBurned = (new web3.utils.BN(web3.utils.toWei("1"))).mul(new web3.utils.BN(5)).div(new web3.utils.BN(100));
    assert.equal(tx.logs[0].args._amountBurnet.toString(), expectedHatBurned.toString());
    assert.equal(tx.logs[1].event, "SwapAndSend");
    var vestingTokenLock = await HATTokenLock.at(tx.logs[1].args._tokenLock);
    assert.equal((await hatToken.balanceOf(vestingTokenLock.address)).toString(),tx.logs[1].args._amountReceived.toString());
    var expectedHackerReward = (new web3.utils.BN(web3.utils.toWei("1"))).mul(new web3.utils.BN(4)).div(new web3.utils.BN(100));
    assert.equal(tx.logs[1].args._amountReceived.toString(), expectedHackerReward.toString());
    assert.equal(await vestingTokenLock.canDelegate(),true);
    await vestingTokenLock.delegate(accounts[4],{from:accounts[2]});
    assert.equal(await hatToken.delegates(vestingTokenLock.address),accounts[4]);
    try {
          await hatVaults.swapBurnSend(0, accounts[2]);
          assert(false, 'cannot swapBurnSend twice');
        } catch (ex) {
          assertVMException(ex);
      }

  });

  it("setPool", async () => {
    await setup(accounts);
    try {
        await hatVaults.setPool(1, 200, true, '_descriptionHash');
        assert(false, 'no pool exist');
      } catch (ex) {
        assertVMException(ex);
    }
    await hatVaults.setPool(0, 200,true, '_descriptionHash');
    var staker = accounts[1];
    await stakingToken.approve(hatVaults.address,web3.utils.toWei("1"),{from:staker});
    await stakingToken.mint(staker,web3.utils.toWei("1"));
    await hatVaults.deposit(0,web3.utils.toWei("1"),{from:staker});
    assert.equal(await hatToken.balanceOf(staker), 0);
    await hatVaults.setPool(0, 100,true, '_descriptionHash');
    await hatVaults.setPool(0, 200,true, '_descriptionHash');
    let expectedReward = await calculateExpectedReward(staker);
    assert.equal(await stakingToken.balanceOf(staker), 0);
    await hatVaults.claimReward(0, {from:staker});
    assert.equal((await hatToken.balanceOf(staker)).toString(), expectedReward.toString());
    assert.equal(await stakingToken.balanceOf(staker), 0);
    assert.equal(await stakingToken.balanceOf(hatVaults.address), web3.utils.toWei("1"));
  });


  it("swapAndBurn rewards check", async () => {
    await setup(accounts);
    var staker = accounts[1];
    var staker2 = accounts[3];
    assert.equal((await hatVaults.getPoolRewardsPendingLpToken(0)).toString(), "0");

    await stakingToken.approve(hatVaults.address,web3.utils.toWei("1"),{from:staker});
    await stakingToken.approve(hatVaults.address,web3.utils.toWei("1"),{from:staker2});
    await stakingToken.mint(staker,web3.utils.toWei("1"));
    await stakingToken.mint(staker2,web3.utils.toWei("1"));

    await hatVaults.deposit(0,web3.utils.toWei("1"),{from:staker});

    assert.equal(await hatToken.balanceOf(staker),0);
    await utils.increaseTime(7*24*3600);
    await hatVaults.approveClaim(0,accounts[2],4);
    assert.equal(
      (
        await hatVaults.getPoolRewardsPendingLpToken(0)).toString(),
        new web3.utils.BN(web3.utils.toWei("1")).mul(
          (new web3.utils.BN((await hatVaults.getPoolRewards(0)).swapAndBurnSplit)).add(new web3.utils.BN((await hatVaults.getPoolRewards(0)).hackerHatRewardSplit))
      ).div(new web3.utils.BN("10000")).toString()
    );
    var tx = await hatVaults.swapBurnSend(0,accounts[2]);
    assert.equal(tx.logs[0].event, "SwapAndBurn");
    assert.equal(tx.logs[0].args._amountSwaped.toString(),
      new web3.utils.BN(web3.utils.toWei("1")).mul(
        (new web3.utils.BN((await hatVaults.getPoolRewards(0)).swapAndBurnSplit))
        .add(new web3.utils.BN((await hatVaults.getPoolRewards(0)).hackerHatRewardSplit))
      ).div(new web3.utils.BN("10000")).toString()
    );
    assert.equal(tx.logs[0].args._amountBurnet.toString(), new web3.utils.BN(web3.utils.toWei("1")).mul(
      (new web3.utils.BN((await hatVaults.getPoolRewards(0)).swapAndBurnSplit))
    ).div(new web3.utils.BN("10000")).toString());

    assert.equal(tx.logs[1].args._amountReceived.toString(), new web3.utils.BN(web3.utils.toWei("1")).mul(
      (new web3.utils.BN((await hatVaults.getPoolRewards(0)).hackerHatRewardSplit))
    ).div(new web3.utils.BN("10000")).toString());
    let afterRewardBalance = (await hatToken.balanceOf(tx.logs[1].args._tokenLock)).toString();
    assert.equal(tx.logs[1].args._amountReceived.toString(), afterRewardBalance);
  });

  it("swapBurnSend", async () => {
    await setup(accounts);
    var staker = accounts[1];
    var staker2 = accounts[3];
    assert.equal((await hatVaults.getPoolRewardsPendingLpToken(0)).toString(), "0");

    await stakingToken.approve(hatVaults.address,web3.utils.toWei("1"),{from:staker});
    await stakingToken.approve(hatVaults.address,web3.utils.toWei("1"),{from:staker2});
    await stakingToken.mint(staker,web3.utils.toWei("1"));
    await stakingToken.mint(staker2,web3.utils.toWei("1"));

    await hatVaults.deposit(0,web3.utils.toWei("1"),{from:staker});

    assert.equal(await hatToken.balanceOf(staker),0);
    await utils.increaseTime(7*24*3600);
    await hatVaults.approveClaim(0,accounts[2],4);
    assert.equal(
      (
        await hatVaults.getPoolRewardsPendingLpToken(0)).toString(),
        new web3.utils.BN(web3.utils.toWei("1")).mul(
          (new web3.utils.BN((await hatVaults.getPoolRewards(0)).swapAndBurnSplit)).add(new web3.utils.BN((await hatVaults.getPoolRewards(0)).hackerHatRewardSplit))
      ).div(new web3.utils.BN("10000")).toString()
    );

    try {
        await hatVaults.swapBurnSend(0, accounts[1], {from: accounts[1] });
        assert(false, 'only committee or gov');
      } catch (ex) {
        assertVMException(ex);
    }

    var tx = await hatVaults.swapBurnSend(0,accounts[1]);
    assert.equal(tx.logs[0].event, "SwapAndBurn");
    assert.equal(tx.logs[0].args._amountSwaped.toString(),
      new web3.utils.BN(web3.utils.toWei("1")).mul(
        (new web3.utils.BN((await hatVaults.getPoolRewards(0)).swapAndBurnSplit))
      ).div(new web3.utils.BN("10000")).toString()
    );
    assert.equal(tx.logs[0].args._amountBurnet.toString(), new web3.utils.BN(web3.utils.toWei("1")).mul(
      (new web3.utils.BN((await hatVaults.getPoolRewards(0)).swapAndBurnSplit))
    ).div(new web3.utils.BN("10000")).toString());
    assert.equal(tx.logs[1].event, "SwapAndSend");
    assert.equal(tx.logs[1].args._amountReceived.toString(), '0');
    // Not real beneficiary should not get tokens
    let afterRewardBalance = (await hatToken.balanceOf(tx.logs[1].args._tokenLock)).toString();
    assert.equal(tx.logs[1].args._tokenLock, '0x0000000000000000000000000000000000000000');

    tx = await hatVaults.swapBurnSend(0, accounts[2]);

    assert.equal(tx.logs[0].event, "SwapAndBurn");
    assert.equal(tx.logs[0].args._amountBurnet.toString(), '0');
    assert.equal(tx.logs[1].args._amountReceived.toString(), new web3.utils.BN(web3.utils.toWei("1")).mul(
      (new web3.utils.BN((await hatVaults.getPoolRewards(0)).hackerHatRewardSplit))
    ).div(new web3.utils.BN("10000")).toString());
    afterRewardBalance = (await hatToken.balanceOf(tx.logs[1].args._tokenLock)).toString();
    assert.equal(tx.logs[1].args._amountReceived.toString(), afterRewardBalance);

    try {
        tx = await hatVaults.swapBurnSend(0, accounts[1]);
        assert(false, 'can claim only once, nothing to redeem or burn');
      } catch (ex) {
        assertVMException(ex);
    }

    try {
      tx = await hatVaults.swapBurnSend(0, accounts[2]);
      assert(false, 'can claim only once, nothing to redeem or burn');
    } catch (ex) {
      assertVMException(ex);
    }
  });

  it("claim", async () => {
    await setup(accounts);
   let someHash = "0x00000000000000000000000000000000000001";
    var tx = await hatVaults.claim(someHash);
    assert.equal(tx.logs[0].event, "Claim");
    assert.equal(tx.logs[0].args._descriptionHash, someHash);
    assert.equal(tx.logs[0].args._claimer, accounts[0]);
  });


  it("vesting", async () => {
    await setup(accounts);
    var staker = accounts[1];
    var staker2 = accounts[3];
    await stakingToken.approve(hatVaults.address,web3.utils.toWei("1"),{from:staker});
    await stakingToken.approve(hatVaults.address,web3.utils.toWei("1"),{from:staker2});
    await stakingToken.mint(staker,web3.utils.toWei("1"));
    await stakingToken.mint(staker2,web3.utils.toWei("1"));

    //stake
    await hatVaults.deposit(0,web3.utils.toWei("1"),{from:staker});
    assert.equal(await hatToken.balanceOf(staker),0);
    await utils.increaseTime(7*24*3600);
    var tx = await hatVaults.approveClaim(0,accounts[2],4);
    assert.equal(tx.logs[0].event, "ClaimApprove");
    var vestingTokenLock = await HATTokenLock.at(tx.logs[0].args._tokenLock);
    assert.equal(await vestingTokenLock.beneficiary(), accounts[2]);
    var depositValutBN = new web3.utils.BN(web3.utils.toWei("1"));
    var expectedHackerBalance = depositValutBN.mul(new web3.utils.BN(8500)).div(new web3.utils.BN(10000));
    assert.isTrue((await stakingToken.balanceOf(vestingTokenLock.address)).eq(expectedHackerBalance));
    assert.isTrue(tx.logs[0].args._hackerReward.eq(expectedHackerBalance));
    assert.isTrue(expectedHackerBalance.eq(await vestingTokenLock.managedAmount()));
    assert.equal(await vestingTokenLock.revocable(),2);//Disable
    assert.equal(await vestingTokenLock.canDelegate(),false);

    try {
          await vestingTokenLock.delegate(accounts[4]);
          assert(false, 'cannot delegate');
        } catch (ex) {
          assertVMException(ex);
      }

    try {
          await vestingTokenLock.revoke();
          assert(false, 'cannot revoke');
        } catch (ex) {
          assertVMException(ex);
      }
      try {
            await vestingTokenLock.withdrawSurplus(1);
            assert(false, 'no surplus');
          } catch (ex) {
            assertVMException(ex);
        }
        try {
              await vestingTokenLock.release();
              assert(false, 'only beneficiary can release');
            } catch (ex) {
              assertVMException(ex);
          }

         try {
               await vestingTokenLock.release({from:accounts[2]});
               assert(false, 'cannot release before first period');
             } catch (ex) {
               assertVMException(ex);
           }
         await utils.increaseTime(8640);
         await vestingTokenLock.release({from:accounts[2]});
         assert.isTrue((await stakingToken.balanceOf(accounts[2]))
                       .eq(expectedHackerBalance.div(new web3.utils.BN(10))));

         await utils.increaseTime(8640*9);
         await vestingTokenLock.release({from:accounts[2]});
         assert.isTrue((await stakingToken.balanceOf(accounts[2])).eq(expectedHackerBalance));
         try {
               await vestingTokenLock.withdrawSurplus(1,{from:accounts[2]});
               assert(false, 'no Surplus');
             } catch (ex) {
               assertVMException(ex);
           }
         await stakingToken.transfer(vestingTokenLock.address,10);
         tx = await vestingTokenLock.withdrawSurplus(1,{from:accounts[2]});
         assert.equal(tx.logs[0].event,"TokensWithdrawn");
         assert.equal(tx.logs[0].args.amount,1);

  });

  it("set vesting params", async () => {
    await setup(accounts);
    assert.equal((await hatVaults.getPoolRewards(0)).vestingDuration,86400);
    assert.equal((await hatVaults.getPoolRewards(0)).vestingPeriods,10);

    try {
          await hatVaults.setVestingParams(0,21000,7,{from:accounts[2]});
          assert(false, 'only gov can set vesting params');
        } catch (ex) {
          assertVMException(ex);
      }
    var tx = await hatVaults.setVestingParams(0,21000,7);
    assert.equal(tx.logs[0].event, "SetVestingParams");
    assert.equal(tx.logs[0].args._duration, 21000);
    assert.equal(tx.logs[0].args._periods, 7);


    assert.equal((await hatVaults.getPoolRewards(0)).vestingDuration,21000);
    assert.equal((await hatVaults.getPoolRewards(0)).vestingPeriods,7);

  });

  it("set hat vesting params", async () => {
    await setup(accounts);
    assert.equal(await hatVaults.hatVestingDuration(),90*3600*24);
    assert.equal(await hatVaults.hatVestingPeriods(),90);

    try {
          await hatVaults.setHatVestingParams(21000,7,{from:accounts[2]});
          assert(false, 'only gov can set vesting params');
        } catch (ex) {
          assertVMException(ex);
      }
    var tx = await hatVaults.setHatVestingParams(21000,7);
    assert.equal(tx.logs[0].event, "SetHatVestingParams");
    assert.equal(tx.logs[0].args._duration, 21000);
    assert.equal(tx.logs[0].args._periods, 7);

    assert.equal(await hatVaults.hatVestingDuration(),21000);
    assert.equal(await hatVaults.hatVestingPeriods(),7);

  });

  it("unSafeWithdraw", async () => {
    await setup(accounts);
    var staker = accounts[1];

    await stakingToken.approve(hatVaults.address,web3.utils.toWei("1"),{from:staker});
    await stakingToken.mint(staker,web3.utils.toWei("1"));

    //stake
    await hatVaults.deposit(0,web3.utils.toWei("1"),{from:staker});
    try {
        await unSafeWithdraw(0,web3.utils.toWei("1"),staker);
        assert(false, 'cannot withfdraw on safety period');
    } catch (ex) {
      assertVMException(ex);
    }

  });

  // it("massupdate up to 100 pools", async () => {
  //   await setup(accounts);
  //   var staker = accounts[1];
  //   await stakingToken.approve(hatVaults.address,web3.utils.toWei("2"),{from:staker});
  //   await stakingToken.mint(staker,web3.utils.toWei("2"));
  //   let currentBlockNumber = (await web3.eth.getBlock("latest")).number;
  //
  //   console.log(currentBlockNumber.toString())
  //   await hatVaults.deposit(0,web3.utils.toWei("1"),{from:staker});
  //   for (var i=1;i<100;i++) {
  //     let stakingToken2 = await ERC20Mock.new("Staking","STK",accounts[0]);
  //     await hatVaults.addPool(100,stakingToken2.address,[accounts[1]],[],[0,0,0,0],"_descriptionHash",86400,10);
  //     await hatVaults.setCommittee(i,[accounts[0]],[true],{from:accounts[1]});
  //     await stakingToken2.approve(hatVaults.address,web3.utils.toWei("2"),{from:staker});
  //     await stakingToken2.mint(staker,web3.utils.toWei("2"));
  //     await hatVaults.deposit(i,web3.utils.toWei("1"),{from:staker});
  //   }
  //   var j = 0;
  //   for (j;j<25;j++) {
  //     await hatVaults.setPool(j,200,true,"123");
  //     await hatVaults.setPool(j,100,true,"123");
  //
  //     //await utils.mineBlock();
  //
  //   }
  //   await utils.mineBlock();
  //
  //   console.log(web3.utils.fromWei(await hatToken.balanceOf(hatVaults.address)))
  //   currentBlockNumber = (await web3.eth.getBlock("latest")).number;
  //
  //   console.log("bn",currentBlockNumber.toString())
  //   console.log("hatVaults.poolUpdates(1,0)blockNumber",(await hatVaults.poolUpdates(1,0)).blockNumber.toString())
  //   console.log("hatVaults.poolUpdates(1,0)allocPoint",(await hatVaults.poolUpdates(1,0)).allocPoint.toString())
  //   console.log("hatVaults.poolUpdates(1,0)totalAllocPoint",(await hatVaults.poolUpdates(1,0)).totalAllocPoint
  //   .toString())
  //   console.log("hatVaults.poolUpdates(1,0)lastRewardBlock",(await hatVaults.poolInfo(1)).lastRewardBlock.toString())
  //
  //
  //   var tx =await hatVaults.massUpdatePools(0,50);
  //   console.log("balance",web3.utils.fromWei(await hatToken.balanceOf(hatVaults.address)))
  //
  //     await hatToken.getPastEvents('Transfer', {
  //           fromBlock: tx.blockNumber,
  //           toBlock: 'latest'
  //       })
  //       .then(function(events){
  //           assert.equal(events[0].event,"Transfer");
  //           assert.equal(events[0].args.from,utils.NULL_ADDRESS);
  //           assert.equal(events[0].args.to,hatVaults.address);
  //           //there are 100 mint events.
  //           assert.equal(events.length,50);
  //       });
  //
  //       console.log(web3.utils.fromWei(await hatToken.balanceOf(hatVaults.address)))
  //       //assert.equal(tx.receipt.gasUsed,8935378);
  // }).timeout(40000);


  // it("fail test", async () => {
  //   await setup(accounts);
  //   var staker = accounts[1];
  //   await stakingToken.approve(hatVaults.address,web3.utils.toWei("2"),{from:staker});
  //   await stakingToken.mint(staker,web3.utils.toWei("2"));
  //   let currentBlockNumber = (await web3.eth.getBlock("latest")).number;
  //
  //   console.log(currentBlockNumber.toString())
  //   await hatVaults.deposit(0,web3.utils.toWei("1"),{from:staker});
  //   let stakingToken2 = await ERC20Mock.new("Staking","STK",accounts[0]);
  //   await hatVaults.addPool(100,stakingToken2.address,[accounts[1]],[],[0,0,0,0],"_descriptionHash",86400,10);
  //   await hatVaults.setCommittee(1,[accounts[0]],[true],{from:accounts[1]});
  //   await stakingToken2.approve(hatVaults.address,web3.utils.toWei("2"),{from:staker});
  //   await stakingToken2.mint(staker,web3.utils.toWei("2"));
  //   await hatVaults.deposit(1,web3.utils.toWei("1"),{from:staker});
  //   await hatVaults.setPool(0,200,true,"123");
  //   await hatVaults.setPool(1,200,true,"123");
  //   console.log(web3.utils.fromWei(await hatToken.balanceOf(hatVaults.address)))
  //   currentBlockNumber = (await web3.eth.getBlock("latest")).number;
  //   console.log(currentBlockNumber.toString())
  //   var tx =await hatVaults.massUpdatePools(0,2);
  //   console.log("balance",web3.utils.fromWei(await hatToken.balanceOf(hatVaults.address)))
  //   console.log(web3.utils.fromWei(await hatToken.balanceOf(hatVaults.address)))
  //       //assert.equal(tx.receipt.gasUsed,8935378);
  // }).timeout(40000);


});
