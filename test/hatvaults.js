const HATVaults = artifacts.require("./HATVaults.sol");
const HATTokenMock = artifacts.require("./HATTokenMock.sol");
const ERC20Mock = artifacts.require("./ERC20Mock.sol");
const UniSwapV2RouterMock = artifacts.require("./UniSwapV2RouterMock.sol");
const TokenLockFactory = artifacts.require("./TokenLockFactory.sol");
const HATTokenLock = artifacts.require("./HATTokenLock.sol");
const PoolsManagerMock = artifacts.require("./PoolsManagerMock.sol");
const utils = require("./utils.js");

var hatVaults;
var hatToken;
var router;
var stakingToken;
var REWARD_PER_BLOCK = "10";
var tokenLockFactory;
let safeWithdrawBlocksIncrement = 3;

const setup = async function (
                              accounts,
                              reward_per_block=REWARD_PER_BLOCK,
                              startBlock=0,
                              rewardsLevels=[],
                              rewardsSplit=[0,0,0,0,0,0],
                            ) {
  hatToken = await HATTokenMock.new(accounts[0],utils.TIME_LOCK_DELAY_IN_BLOCKS_UNIT);
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
  await hatVaults.addPool(100,stakingToken.address,accounts[1],rewardsLevels,rewardsSplit,"_descriptionHash",[86400,10]);
  await hatVaults.setCommittee(0,accounts[1],{from:accounts[1]});
};

function assertVMException(error) {
    let condition = (
        error.message.search('VM Exception') > -1 || error.message.search('Transaction reverted') > -1
    );
    assert.isTrue(condition, 'Expected a VM Exception, got this instead:' + error.message);
}

contract('HatVaults',  accounts =>  {

    //this function will increment 4 blocks in local testnet
    async function safeWithdraw(pid, amount, staker) {
      let currentBlockNumber = (await web3.eth.getBlock("latest")).number;

      let WITHDRAW_PERIOD  =  await hatVaults.WITHDRAW_PERIOD();
      let WITHDRAW_DISABLE_PERIOD = await hatVaults.WITHDRAW_DISABLE_PERIOD();
      while (currentBlockNumber % (WITHDRAW_PERIOD.toNumber() + WITHDRAW_DISABLE_PERIOD.toNumber()) >= WITHDRAW_PERIOD.toNumber()) {
         await utils.mineBlock();
         currentBlockNumber = (await web3.eth.getBlock("latest")).number;
      }
      //increase time for the case there is already pending request ..so make sure start a new one..
      await utils.increaseTime(1*24*3600);
      await hatVaults.withdrawRequest(pid,{from:staker});
      //increase time for pending period
      await utils.increaseTime(7*24*3600);
      return await hatVaults.withdraw(pid,amount,{from:staker});
    }

    async function advanceToSaftyPeriod() {
      let currentBlockNumber = (await web3.eth.getBlock("latest")).number;
      let WITHDRAW_PERIOD  =  await hatVaults.WITHDRAW_PERIOD();
      let WITHDRAW_DISABLE_PERIOD = await hatVaults.WITHDRAW_DISABLE_PERIOD();
      while (currentBlockNumber % (WITHDRAW_PERIOD.toNumber() + WITHDRAW_DISABLE_PERIOD.toNumber()) < WITHDRAW_PERIOD.toNumber()) {
         await utils.mineBlock();
         currentBlockNumber = (await web3.eth.getBlock("latest")).number;
      }
      currentBlockNumber = (await web3.eth.getBlock("latest")).number;
    }

    //advanced blocks to a withdraw enable period
    async function advanceToNoneSaftyPeriod() {
      let currentBlockNumber = (await web3.eth.getBlock("latest")).number;
      let WITHDRAW_PERIOD  =  await hatVaults.WITHDRAW_PERIOD();
      let WITHDRAW_DISABLE_PERIOD = await hatVaults.WITHDRAW_DISABLE_PERIOD();
      while (currentBlockNumber % (WITHDRAW_PERIOD.toNumber() + WITHDRAW_DISABLE_PERIOD.toNumber()) >= WITHDRAW_PERIOD.toNumber()) {
         await utils.mineBlock();
         currentBlockNumber = (await web3.eth.getBlock("latest")).number;
      }
      currentBlockNumber = (await web3.eth.getBlock("latest")).number;
    }

    async function calculateExpectedReward(staker,operationBlocksIncrement = 0) {
      let currentBlockNumber = (await web3.eth.getBlock("latest")).number;
      let lastRewardBlock = (await hatVaults.poolInfo(0)).lastRewardBlock;
      let allocPoint = (await hatVaults.poolInfo(0)).allocPoint;
      let rewardPerShare = new web3.utils.BN((await hatVaults.poolInfo(0)).rewardPerShare);
      let onee12 = new web3.utils.BN("1000000000000");
      let stakerAmount = (await hatVaults.userInfo(0,staker)).amount;
      let globalUpdatesLen =  await hatVaults.getGlobalPoolUpdatesLength();
      let totalAllocPoint = (await hatVaults.globalPoolUpdates(globalUpdatesLen-1)).totalAllocPoint;
      let poolReward = await hatVaults.getPoolReward(lastRewardBlock,currentBlockNumber+1+operationBlocksIncrement,allocPoint,totalAllocPoint);
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
      //increase time for the case there is already pending request ..so make sure start a new one..
      await utils.increaseTime(1*24*3600);
      await hatVaults.withdrawRequest(pid,{from:staker});
      //increase time for pending period
      await utils.increaseTime(7*24*3600);
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

    it("constructor", async () => {
        await setup(accounts);
        assert.equal(await stakingToken.name(), "Staking");
        assert.equal(await hatVaults.governance(), accounts[0]);
    });

    it("setCommitte", async () => {
        await setup(accounts);
        assert.equal(await hatVaults.committees(0), accounts[1]);

        try {
          await hatVaults.setCommittee(0,utils.NULL_ADDRESS,{from: accounts[1]});
          assert(false, 'cannot set zero address committee');
        } catch (ex) {
          assertVMException(ex);
        }

        await hatVaults.setCommittee(0,accounts[2],{from:accounts[1]});

        assert.equal(await hatVaults.committees(0),accounts[2]);

        try {
          await hatVaults.setCommittee(0,accounts[2],{from: accounts[1]});
          assert(false, 'cannot set committee from non committee account');
        } catch (ex) {
          assertVMException(ex);
        }

        //set other pool with different committee
        let rewardsLevels=[];
        let rewardsSplit=[0,0,0,0,0,0];
        var stakingToken2 = await ERC20Mock.new("Staking","STK",accounts[0]);
        await hatVaults.addPool(100,stakingToken2.address,accounts[1],rewardsLevels,rewardsSplit,"_descriptionHash",[86400,10]);

        await hatVaults.setCommittee(1,accounts[1]);

        assert.equal(await hatVaults.committees(1),accounts[1]);
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

        await hatVaults.setCommittee(1,accounts[2],{from:accounts[1]});
        await hatVaults.deposit(1,web3.utils.toWei("1"),{from:staker});

        try {
             await hatVaults.setCommittee(1,accounts[2]);
            assert(false, 'commitee already checked in');
        } catch (ex) {
            assertVMException(ex);
        }
        await hatVaults.setCommittee(1,accounts[1],{from:accounts[2]});
    });

    it("custom rewardsSplit and rewardsLevels", async () => {
      try {
          await setup(accounts, REWARD_PER_BLOCK, 0, [3000, 5000, 7000, 9000], [9000,0, 200, 0,100, 800]);
          assert(false, 'cannot init with rewardSplit > 10000');
      } catch (ex) {
          assertVMException(ex);
      }
      try {
          await setup(accounts, REWARD_PER_BLOCK, 0, [3000, 5000, 7000, 11000], [8000,0, 100,0, 100, 800]);
          assert(false, 'cannot init with rewardLevel > 10000');
      } catch (ex) {
          assertVMException(ex);
      }

      await setup(accounts, REWARD_PER_BLOCK, 0, [3000, 5000, 7000, 9000], [8000, 0,100, 0,100, 700]);
      assert.equal((await hatVaults.getPoolRewardsLevels(0)).length, 4);
      assert.equal((await hatVaults.getPoolRewardsLevels(0))[0].toString(), "3000");
      assert.equal((await hatVaults.getPoolRewardsLevels(0))[1].toString(), "5000");
      assert.equal((await hatVaults.getPoolRewardsLevels(0))[2].toString(), "7000");
      assert.equal((await hatVaults.getPoolRewardsLevels(0))[3].toString(), "9000");
      assert.equal((await hatVaults.getPoolRewards(0)).rewardsSplit.hackerReward.toString(), "0");
      assert.equal((await hatVaults.getPoolRewards(0)).rewardsSplit.hackerVestedReward.toString(), "8000");

      assert.equal((await hatVaults.getPoolRewards(0)).rewardsSplit.committeeReward.toString(), "100");
      assert.equal((await hatVaults.getPoolRewards(0)).rewardsSplit.swapAndBurn.toString(), "0");
      assert.equal((await hatVaults.getPoolRewards(0)).rewardsSplit.governanceHatReward.toString(), "100");
      assert.equal((await hatVaults.getPoolRewards(0)).rewardsSplit.hackerHatReward.toString(), "700");

      try {
          await hatVaults.setRewardsLevels(0, [1500, 3000, 4500, 9000, 11000],{from:accounts[1]});
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
      await hatVaults.setRewardsLevels(0, [1500, 3000, 4500, 9000, 10000],{from:accounts[1]});
      try {
          await hatVaults.setRewardsSplit(0, [7000, 0,1000, 1100,0, 900]);
          assert(false, 'cannot init with rewardSplit > 10000');
      } catch (ex) {
          assertVMException(ex);
      }
      await hatVaults.setRewardsSplit(0, [6000,0,1000, 1100,0, 800]);
      assert.equal((await hatVaults.getPoolRewardsLevels(0)).length, 5);
      assert.equal((await hatVaults.getPoolRewardsLevels(0))[0].toString(), "1500");
      assert.equal((await hatVaults.getPoolRewardsLevels(0))[1].toString(), "3000");
      assert.equal((await hatVaults.getPoolRewardsLevels(0))[2].toString(), "4500");
      assert.equal((await hatVaults.getPoolRewardsLevels(0))[3].toString(), "9000");
      assert.equal((await hatVaults.getPoolRewardsLevels(0))[4].toString(), "10000");
      assert.equal((await hatVaults.getPoolRewards(0)).rewardsSplit.hackerReward.toString(), "0");
      assert.equal((await hatVaults.getPoolRewards(0)).rewardsSplit.hackerVestedReward.toString(), "6000");

      assert.equal((await hatVaults.getPoolRewards(0)).rewardsSplit.committeeReward.toString(), "1000");
      assert.equal((await hatVaults.getPoolRewards(0)).rewardsSplit.swapAndBurn.toString(), "1100");
      assert.equal((await hatVaults.getPoolRewards(0)).rewardsSplit.hackerHatReward.toString(), "800");

      await hatVaults.setRewardsLevels(0, [],{from:accounts[1]});
      assert.equal((await hatVaults.getPoolRewardsLevels(0)).length, 5);
      assert.equal((await hatVaults.getPoolRewardsLevels(0))[0].toString(), "2000");
      assert.equal((await hatVaults.getPoolRewardsLevels(0))[1].toString(), "4000");
      assert.equal((await hatVaults.getPoolRewardsLevels(0))[2].toString(), "6000");
      assert.equal((await hatVaults.getPoolRewardsLevels(0))[3].toString(), "8000");
      assert.equal((await hatVaults.getPoolRewardsLevels(0))[4].toString(), "10000");
  });

  it("withdrawn", async () => {
      await setup(accounts);
      var staker = accounts[1];

      await stakingToken.approve(hatVaults.address,web3.utils.toWei("1"),{from:staker});

      await stakingToken.mint(staker,web3.utils.toWei("1"));
      assert.equal(await stakingToken.balanceOf(staker), web3.utils.toWei("1"));
      assert.equal(await hatToken.balanceOf(hatVaults.address), 0);
      await hatVaults.deposit(0,web3.utils.toWei("1"),{from:staker});
      await utils.increaseTime(7*24*3600);
      await advanceToSaftyPeriod();
      await hatVaults.pendingApprovalClaim(0,accounts[2],4,{from:accounts[1]});
      try {
          await safeWithdraw(0,web3.utils.toWei("1"),staker);
          assert(false, 'cannot stake without approve');
      } catch (ex) {
        assertVMException(ex);
      }

      await hatVaults.dismissPendingApprovalClaim(0);
      let currentBlockNumber = (await web3.eth.getBlock("latest")).number;

      let lastRewardBlock = (await hatVaults.poolInfo(0)).lastRewardBlock;
      let rewardPerShare = new web3.utils.BN((await hatVaults.poolInfo(0)).rewardPerShare);
      let onee12 = new web3.utils.BN("1000000000000");
      let stakeVaule = new web3.utils.BN(web3.utils.toWei("1"));
      let totalAllocPoint = 100;
      let poolReward = await hatVaults.getPoolReward(lastRewardBlock,currentBlockNumber+1+safeWithdrawBlocksIncrement,100, totalAllocPoint);
      rewardPerShare = rewardPerShare.add(poolReward.mul(onee12).div(stakeVaule));
      let expectedReward = stakeVaule.mul(rewardPerShare).div(onee12);

      await safeWithdraw(0,web3.utils.toWei("1"),staker);
      //staker  get stake back
      assert.equal(await stakingToken.balanceOf(staker), web3.utils.toWei("1"));
      assert.equal((await hatToken.balanceOf(staker)).toString(),
                    expectedReward.toString());
      //withdraw with 0
      await safeWithdraw(0,0,staker);
      assert.equal(await stakingToken.balanceOf(staker), web3.utils.toWei("1"));
      assert.equal((await hatToken.balanceOf(staker)).toString(),
                    expectedReward.toString());
  });

  it("set withdrawn request params ", async () => {
      await setup(accounts);
      assert.equal(await hatVaults.withdrawEnablePeriod(), (1*24*3600));
      assert.equal(await hatVaults.withdrawRequestPendingPeriod(), (7*24*3600));
      try {
          await hatVaults.setWithrawRequestParams(1,1,{from:accounts[4]});
          assert(false, 'only gov');
      } catch (ex) {
        assertVMException(ex);
      }
      await hatVaults.setWithrawRequestParams(1,1,{from:accounts[0]});
      assert.equal(await hatVaults.withdrawEnablePeriod(), 1);
      assert.equal(await hatVaults.withdrawRequestPendingPeriod(), 1);

  });

  it("withdrawn request ", async () => {
      await setup(accounts);
      var staker = accounts[1];

      await stakingToken.approve(hatVaults.address,web3.utils.toWei("2"),{from:staker});

      await stakingToken.mint(staker,web3.utils.toWei("2"));
      assert.equal(await stakingToken.balanceOf(staker), web3.utils.toWei("2"));
      assert.equal(await hatToken.balanceOf(hatVaults.address), 0);
      await hatVaults.deposit(0,web3.utils.toWei("1"),{from:staker});
      await utils.increaseTime(7*24*3600);
      await advanceToNoneSaftyPeriod();
      try {
          await hatVaults.withdraw(0,web3.utils.toWei("1"),{from:staker});
          assert(false, 'cannot withdraw without request');
      } catch (ex) {
        assertVMException(ex);
      }

      try {
          await hatVaults.emergencyWithdraw(0,{from:staker});
          assert(false, 'cannot emergencyWithdraw without request');
      } catch (ex) {
        assertVMException(ex);
      }
      await hatVaults.withdrawRequest(0,{from:staker});
      assert.equal(await hatVaults.withdrawRequests(0,staker),
      (await web3.eth.getBlock("latest")).timestamp +(7*24*3600));

      try {
          await hatVaults.withdraw(0,web3.utils.toWei("1"),{from:staker});
          assert(false, 'request is pending');
      } catch (ex) {
        assertVMException(ex);
      }

      try {
          await hatVaults.emergencyWithdraw(0,{from:staker});
          assert(false, 'request is pending');
      } catch (ex) {
        assertVMException(ex);
      }
      await utils.increaseTime(7*24*3600);
      try {
          await hatVaults.withdrawRequest(0,{from:staker});
          assert(false, 'there is already pending request');
      } catch (ex) {
        assertVMException(ex);
      }

      await hatVaults.withdraw(0,web3.utils.toWei("0.5"),{from:staker});
      assert.equal(await hatVaults.withdrawRequests(0,staker),
      0);
      try {
          await hatVaults.emergencyWithdraw(0,{from:staker});
          assert(false, 'no pending request');
      } catch (ex) {
        assertVMException(ex);
      }
      await hatVaults.withdrawRequest(0,{from:staker});
      await utils.increaseTime(7*24*3600);
      await hatVaults.emergencyWithdraw(0,{from:staker});
      assert.equal(await hatVaults.withdrawRequests(0,staker),
      0);
      await hatVaults.deposit(0,web3.utils.toWei("1"),{from:staker});
      await hatVaults.withdrawRequest(0,{from:staker});
      try {
          await hatVaults.withdrawRequest(0,{from:staker});
          assert(false, 'there is already pending request');
      } catch (ex) {
        assertVMException(ex);
      }
      await utils.increaseTime(7*24*3600);
      try {
          await hatVaults.withdrawRequest(0,{from:staker});
          assert(false, 'there is already pending request');
      } catch (ex) {
        assertVMException(ex);
      }
      await utils.increaseTime(1*24*3600);
      //request is now expired so can request again.
      await hatVaults.withdrawRequest(0,{from:staker});
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
        let totalAllocPoint = 100;
        let poolReward = await hatVaults.getPoolReward(lastRewardBlock,currentBlockNumber+1+safeWithdrawBlocksIncrement,100, totalAllocPoint);
        rewardPerShare = rewardPerShare.add(poolReward.mul(onee12).div(stakeVaule));
        let expectedReward = stakeVaule.mul(rewardPerShare).div(onee12);

        await safeWithdraw(0,web3.utils.toWei("1"),staker);
        //staker get stake back
        assert.equal(await stakingToken.balanceOf(staker), web3.utils.toWei("1"));
        assert.equal((await hatToken.balanceOf(staker)).toString(),
                      expectedReward.toString());
        //withdraw with 0
        await safeWithdraw(0,0,staker);
        assert.equal(await stakingToken.balanceOf(staker), web3.utils.toWei("1"));
        assert.equal((await hatToken.balanceOf(staker)).toString(),
                      expectedReward.toString());
    });

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
      expectedReward = await calculateExpectedReward(staker,safeWithdrawBlocksIncrement);
      balanceOfStakerBefore = await hatToken.balanceOf(staker);
      await safeWithdraw(0,web3.utils.toWei("4"),staker);
      //staker  get stake back
      assert.equal((await stakingToken.balanceOf(staker)).toString(), web3.utils.toWei("4").toString());
      assert.equal((await hatToken.balanceOf(staker)).toString(), expectedReward.add(balanceOfStakerBefore).toString());
    });

    it("hat reward withdraw all balance if reward larger than balance", async () => {
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
      await hatVaults.updatePool(0);
      balanceOfStakerBefore = await hatToken.balanceOf(staker);
      // Burn tokens so contract doesn't have enough for the whole reward
      let balanceInPool = await hatToken.balanceOf(hatVaults.address);
      await hatToken.burnFrom(hatVaults.address, balanceInPool);
      expectedReward = await calculateExpectedReward(staker,safeWithdrawBlocksIncrement);
      await safeWithdraw(0,web3.utils.toWei("4"),staker);
      //staker get stake back
      assert.equal((await stakingToken.balanceOf(staker)).toString(), web3.utils.toWei("4").toString());
      assert.equal((await hatToken.balanceOf(staker)).toString(), expectedReward.sub(balanceInPool).add(balanceOfStakerBefore).toString());
      assert.equal((await hatToken.balanceOf(hatVaults.address)).toString(), '0');
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
    assert.equal((await hatVaults.getRewardPerBlock(0)).toString(), "10000000000000000000");
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


  it("approve+ stake + exit", async () => {
    await setup(accounts);
    var staker = accounts[4];
    var staker2 = accounts[3];
    await stakingToken.approve(hatVaults.address,web3.utils.toWei("1"),{from:staker});
    await stakingToken.approve(hatVaults.address,web3.utils.toWei("1"),{from:staker2});
    await stakingToken.mint(staker,web3.utils.toWei("1"));
    await stakingToken.mint(staker2,web3.utils.toWei("1"));
    await advanceToSaftyPeriod();
    await hatVaults.pendingApprovalClaim(0,accounts[2],4,{from:accounts[1]});
    try {
          await hatVaults.approveClaim(0);
          assert(false, 'lpbalance is zero');
        } catch (ex) {
          assertVMException(ex);
      }
    await hatVaults.dismissPendingApprovalClaim(0);

    //stake
    await hatVaults.deposit(0,web3.utils.toWei("1"),{from:staker});
    assert.equal(await hatToken.balanceOf(hatVaults.address),0);

  //exit
    assert.equal(await hatToken.balanceOf(staker),0);
    await utils.increaseTime(7*24*3600);
    await advanceToNoneSaftyPeriod();
    try {
          await hatVaults.pendingApprovalClaim(0,accounts[2],4,{from:accounts[1]});
          assert(false, 'none safty period');
        } catch (ex) {
          assertVMException(ex);
      }
    await advanceToSaftyPeriod();
    try {
          await hatVaults.pendingApprovalClaim(0,accounts[2],5,{from:accounts[1]});
          assert(false, 'severity is out of range');
        } catch (ex) {
          assertVMException(ex);
      }

    try {
          await hatVaults.pendingApprovalClaim(0,utils.NULL_ADDRESS,4,{from:accounts[1]});
          assert(false, 'beneficiary is zero');
        } catch (ex) {
          assertVMException(ex);
      }
    try {
          await hatVaults.pendingApprovalClaim(0,accounts[2],4,{from:accounts[2]});
          assert(false, 'only Committee');
        } catch (ex) {
          assertVMException(ex);
      }
      try {
            await hatVaults.approveClaim(0);
            assert(false, 'there is no pending approval');
          } catch (ex) {
            assertVMException(ex);
        }
    var tx = await hatVaults.pendingApprovalClaim(0,accounts[2],4,{from:accounts[1]});
    try {
          await hatVaults.pendingApprovalClaim(0,accounts[2],4,{from:accounts[1]});
          assert(false, 'there is already pending approval');
        } catch (ex) {
          assertVMException(ex);
      }
    assert.equal(tx.logs[0].event, "PendingApprovalLog");
    tx = await hatVaults.approveClaim(0);
    assert.equal(await hatToken.balanceOf(hatVaults.address),0);
    assert.equal(tx.logs[0].event, "ClaimApprove");

    await hatVaults.deposit(0,web3.utils.toWei("1"),{from:staker2});
    assert.equal(await stakingToken.balanceOf(staker),0);
    let stakerAmount = await hatVaults.getStakedAmount(0,staker);
    assert.equal(stakerAmount.toString(),web3.utils.toWei("1"));
  //  assert.equal(await stakingToken.balanceOf(hatVaults.address),0);
    tx = await safeWithdraw(0,stakerAmount,staker);

    assert.equal(stakerAmount.toString(),web3.utils.toWei("1"));

    assert.equal(tx.logs[0].event, "SendReward");
    assert.isTrue(tx.logs[0].args.amount.eq(tx.logs[0].args.requestedAmount));

    assert.equal(web3.utils.fromWei(await stakingToken.balanceOf(staker)),"0.01");
    stakerAmount = await hatVaults.getStakedAmount(0,staker2);
    tx = await await safeWithdraw(0,stakerAmount,staker2);
    assert.equal(tx.logs[0].event, "SendReward");
    assert.isTrue(tx.logs[0].args.amount.eq(tx.logs[0].args.requestedAmount));
    //dust
    assert.equal(web3.utils.fromWei((await hatToken.balanceOf(hatVaults.address)).toString()), "0.000000000037");
    assert.equal(web3.utils.fromWei(await stakingToken.balanceOf(staker2)),"1");
  });


  it("approve+ stake simple check rewards", async () => {
    await setup(accounts);
    var staker = accounts[4];
    await stakingToken.approve(hatVaults.address,web3.utils.toWei("1"),{from:staker});
    await stakingToken.mint(staker,web3.utils.toWei("1"));

    //stake
    await hatVaults.deposit(0,web3.utils.toWei("1"),{from:staker});

    assert.equal(await hatToken.balanceOf(staker),0);
    await utils.increaseTime(7*24*3600);
    await advanceToSaftyPeriod();
    await hatVaults.pendingApprovalClaim(0,accounts[2],4,{from:accounts[1]});
    var tx = await hatVaults.approveClaim(0);
    assert.equal(tx.logs[0].event, "ClaimApprove");
    let stakerAmount = await hatVaults.getStakedAmount(0,staker);
    assert.equal(stakerAmount.toString(),web3.utils.toWei("1"));
    tx = await safeWithdraw(0,stakerAmount,staker);
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
    await advanceToSaftyPeriod();
    await hatVaults.pendingApprovalClaim(0,accounts[2],4,{from:accounts[1]});
    await hatVaults.approveClaim(0);
    await safeEmergencyWithdraw(0,staker);
    await hatVaults.deposit(0,web3.utils.toWei("1"),{from:staker});
    var tx = await safeWithdraw(0,web3.utils.toWei("1"),staker2);
    assert.equal(tx.logs[0].event, "SendReward");
    assert.isTrue(tx.logs[0].args.amount.eq(tx.logs[0].args.requestedAmount));
    tx = await safeWithdraw(0,web3.utils.toWei("1"),staker);
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
    await advanceToSaftyPeriod();
    await hatVaults.pendingApprovalClaim(0,accounts[2],4,{from:accounts[1]});
    var tx = await hatVaults.approveClaim(0);
    assert.equal(tx.logs[0].event, "ClaimApprove");
    tx = await safeEmergencyWithdraw(0,staker);

    assert.equal((tx.logs[0].args.amount).toString(),web3.utils.toWei("0.01"));
    await hatVaults.deposit(0,web3.utils.toWei("1"),{from:staker2});
    assert.equal(await hatToken.balanceOf(staker2),0);


    tx = await safeEmergencyWithdraw(0,staker2);
    assert.equal((tx.logs[0].args.amount).toString(),web3.utils.toWei("1"));

    await hatVaults.deposit(0,web3.utils.toWei("1"),{from:staker});
    tx = await safeWithdraw(0,web3.utils.toWei("1"),staker);
    assert.equal(tx.logs[0].event, "SendReward");
    assert.isTrue(tx.logs[0].args.amount.eq(tx.logs[0].args.requestedAmount));
    assert.equal(await hatToken.balanceOf(hatVaults.address),0);

  });

  it("enable farming  + 2xapprove+ exit", async () => {
    await setup(accounts);
    var staker = accounts[4];
    await stakingToken.approve(hatVaults.address,web3.utils.toWei("1"),{from:staker});
    await stakingToken.mint(staker,web3.utils.toWei("1"));
    //start farming
    //stake
    await hatVaults.deposit(0,web3.utils.toWei("1"),{from:staker});
    await utils.increaseTime(7*24*3600);
  //exit
    assert.equal(await hatToken.balanceOf(staker),0);
    await advanceToSaftyPeriod();
    await hatVaults.pendingApprovalClaim(0,accounts[2],1,{from:accounts[1]});
    await hatVaults.approveClaim(0);
    await advanceToSaftyPeriod();
    await hatVaults.pendingApprovalClaim(0,accounts[2],1,{from:accounts[1]});
    await hatVaults.approveClaim(0);
    await advanceToNoneSaftyPeriod();

    let currentBlockNumber = (await web3.eth.getBlock("latest")).number;
    let lastRewardBlock = (await hatVaults.poolInfo(0)).lastRewardBlock;
    let rewardPerShare = new web3.utils.BN((await hatVaults.poolInfo(0)).rewardPerShare);
    let onee12 = new web3.utils.BN("1000000000000");
    let stakeVaule = new web3.utils.BN(web3.utils.toWei("1"));

    let poolReward = await hatVaults.getPoolReward(lastRewardBlock,currentBlockNumber+1+safeWithdrawBlocksIncrement,100,100);
    rewardPerShare = rewardPerShare.add(poolReward.mul(onee12).div(stakeVaule));
    let expectedReward = stakeVaule.mul(rewardPerShare).div(onee12);
    await safeWithdraw(0,web3.utils.toWei("1"),staker);
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
      await safeWithdraw(0,web3.utils.toWei("1"),staker);

      //staker  get stake back
      assert.equal(await stakingToken.balanceOf(staker), web3.utils.toWei("1"));
      //and get all rewards
      assert.equal((await hatToken.balanceOf(staker)).toString(),
                    web3.utils.toWei("175000").toString());
  });

  it("approve+ swapBurnSend", async () => {
    await setup(accounts);
    var staker = accounts[4];
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
    await advanceToSaftyPeriod();
    await hatVaults.pendingApprovalClaim(0,accounts[2],4,{from:accounts[1]});
    await hatVaults.approveClaim(0);
    var tx = await hatVaults.swapBurnSend(0, accounts[2]);
    assert.equal(tx.logs[0].event, "SwapAndBurn");
    var expectedHatBurned = (new web3.utils.BN(web3.utils.toWei("1"))).mul(new web3.utils.BN("25")).div(new web3.utils.BN(1000));
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
    var staker = accounts[4];
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
    var staker = accounts[4];
    var staker2 = accounts[3];
    assert.equal((await hatVaults.getPoolRewardsPendingLpToken(0)).toString(), "0");

    await stakingToken.approve(hatVaults.address,web3.utils.toWei("1"),{from:staker});
    await stakingToken.approve(hatVaults.address,web3.utils.toWei("1"),{from:staker2});
    await stakingToken.mint(staker,web3.utils.toWei("1"));
    await stakingToken.mint(staker2,web3.utils.toWei("1"));

    await hatVaults.deposit(0,web3.utils.toWei("1"),{from:staker});

    assert.equal(await hatToken.balanceOf(staker),0);
    await utils.increaseTime(7*24*3600);
    await advanceToSaftyPeriod();
    await hatVaults.pendingApprovalClaim(0,accounts[2],4,{from:accounts[1]});
    await hatVaults.approveClaim(0);
    assert.equal(
      (
        await hatVaults.getPoolRewardsPendingLpToken(0)).toString(),
        new web3.utils.BN(web3.utils.toWei("1")).mul(
          (new web3.utils.BN((await hatVaults.getPoolRewards(0)).rewardsSplit.swapAndBurn))
          .add(new web3.utils.BN((await hatVaults.getPoolRewards(0)).rewardsSplit.hackerHatReward))
          .add(new web3.utils.BN((await hatVaults.getPoolRewards(0)).rewardsSplit.governanceHatReward))
      ).div(new web3.utils.BN("10000")).toString()
    );
    var tx = await hatVaults.swapBurnSend(0,accounts[2]);
    assert.equal(tx.logs[0].event, "SwapAndBurn");
    assert.equal(tx.logs[0].args._amountSwaped.toString(),
      new web3.utils.BN(web3.utils.toWei("1")).mul(
        (new web3.utils.BN((await hatVaults.getPoolRewards(0)).rewardsSplit.swapAndBurn))
        .add(new web3.utils.BN((await hatVaults.getPoolRewards(0)).rewardsSplit.hackerHatReward))
        .add(new web3.utils.BN((await hatVaults.getPoolRewards(0)).rewardsSplit.governanceHatReward))
      ).div(new web3.utils.BN("10000")).toString()
    );
    assert.equal(tx.logs[0].args._amountBurnet.toString(), new web3.utils.BN(web3.utils.toWei("1")).mul(
      (new web3.utils.BN((await hatVaults.getPoolRewards(0)).rewardsSplit.swapAndBurn))
    ).div(new web3.utils.BN("10000")).toString());

    assert.equal(tx.logs[1].args._amountReceived.toString(), new web3.utils.BN(web3.utils.toWei("1")).mul(
      (new web3.utils.BN((await hatVaults.getPoolRewards(0)).rewardsSplit.hackerHatReward))
    ).div(new web3.utils.BN("10000")).toString());
    let afterRewardBalance = (await hatToken.balanceOf(tx.logs[1].args._tokenLock)).toString();
    assert.equal(tx.logs[1].args._amountReceived.toString(), afterRewardBalance);
  });

  it("swapBurnSend", async () => {
    await setup(accounts);
    var staker = accounts[4];
    var staker2 = accounts[3];
    assert.equal((await hatVaults.getPoolRewardsPendingLpToken(0)).toString(), "0");

    await stakingToken.approve(hatVaults.address,web3.utils.toWei("1"),{from:staker});
    await stakingToken.approve(hatVaults.address,web3.utils.toWei("1"),{from:staker2});
    await stakingToken.mint(staker,web3.utils.toWei("1"));
    await stakingToken.mint(staker2,web3.utils.toWei("1"));

    await hatVaults.deposit(0,web3.utils.toWei("1"),{from:staker});

    assert.equal(await hatToken.balanceOf(staker),0);
    await utils.increaseTime(7*24*3600);
    await advanceToSaftyPeriod();
    await hatVaults.pendingApprovalClaim(0,accounts[2],4,{from:accounts[1]});
    await hatVaults.approveClaim(0);
    assert.equal(
      (
        await hatVaults.getPoolRewardsPendingLpToken(0)).toString(),
        new web3.utils.BN(web3.utils.toWei("1")).mul(
          (new web3.utils.BN((await hatVaults.getPoolRewards(0)).rewardsSplit.swapAndBurn))
          .add(new web3.utils.BN((await hatVaults.getPoolRewards(0)).rewardsSplit.hackerHatReward))
          .add(new web3.utils.BN((await hatVaults.getPoolRewards(0)).rewardsSplit.governanceHatReward))
      ).div(new web3.utils.BN("10000")).toString()
    );

    try {
        await hatVaults.swapBurnSend(0, accounts[1],{from:accounts[3]});
        assert(false, 'only committee or gov');
      } catch (ex) {
        assertVMException(ex);
    }

    var tx = await hatVaults.swapBurnSend(0,accounts[1],{from:accounts[1]});
    assert.equal(tx.logs[0].event, "SwapAndBurn");
    assert.equal(tx.logs[0].args._amountSwaped.toString(),
      new web3.utils.BN(web3.utils.toWei("1")).mul(
        (new web3.utils.BN((await hatVaults.getPoolRewards(0)).rewardsSplit.swapAndBurn))
        .add(new web3.utils.BN((await hatVaults.getPoolRewards(0)).rewardsSplit.governanceHatReward))
      ).div(new web3.utils.BN("10000")).toString()
    );
    assert.equal(tx.logs[0].args._amountBurnet.toString(), new web3.utils.BN(web3.utils.toWei("1")).mul(
      (new web3.utils.BN((await hatVaults.getPoolRewards(0)).rewardsSplit.swapAndBurn))
    ).div(new web3.utils.BN("10000")).toString());
    assert.equal(tx.logs[1].event, "SwapAndSend");
    assert.equal(tx.logs[1].args._amountReceived.toString(), '0');
    // Not real beneficiary should not get tokens
    let afterRewardBalance = (await hatToken.balanceOf(tx.logs[1].args._tokenLock)).toString();
    assert.equal(tx.logs[1].args._tokenLock, '0x0000000000000000000000000000000000000000');

    tx = await hatVaults.swapBurnSend(0, accounts[2],{from:accounts[1]});

    assert.equal(tx.logs[0].event, "SwapAndBurn");
    assert.equal(tx.logs[0].args._amountBurnet.toString(), '0');
    assert.equal(tx.logs[1].args._amountReceived.toString(), new web3.utils.BN(web3.utils.toWei("1")).mul(
      (new web3.utils.BN((await hatVaults.getPoolRewards(0)).rewardsSplit.hackerHatReward))
    ).div(new web3.utils.BN("10000")).toString());
    afterRewardBalance = (await hatToken.balanceOf(tx.logs[1].args._tokenLock)).toString();
    assert.equal(tx.logs[1].args._amountReceived.toString(), afterRewardBalance);

    try {
        tx = await hatVaults.swapBurnSend(0, accounts[1],{from:accounts[1]});
        assert(false, 'can claim only once, nothing to redeem or burn');
      } catch (ex) {
        assertVMException(ex);
    }

    try {
      tx = await hatVaults.swapBurnSend(0, accounts[2],{from:accounts[1]});
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
    var staker = accounts[4];
    var staker2 = accounts[3];
    await stakingToken.approve(hatVaults.address,web3.utils.toWei("1"),{from:staker});
    await stakingToken.approve(hatVaults.address,web3.utils.toWei("1"),{from:staker2});
    await stakingToken.mint(staker,web3.utils.toWei("1"));
    await stakingToken.mint(staker2,web3.utils.toWei("1"));

    //stake
    await hatVaults.deposit(0,web3.utils.toWei("1"),{from:staker});
    assert.equal(await hatToken.balanceOf(staker),0);
    await utils.increaseTime(7*24*3600);
    await advanceToSaftyPeriod();
    await hatVaults.pendingApprovalClaim(0,accounts[2],4,{from:accounts[1]});
    var tx = await hatVaults.approveClaim(0);
    assert.equal(tx.logs[0].event, "ClaimApprove");
    var vestingTokenLock = await HATTokenLock.at(tx.logs[0].args._tokenLock);
    assert.equal(await vestingTokenLock.beneficiary(), accounts[2]);
    var depositValutBN = new web3.utils.BN(web3.utils.toWei("1"));
    var expectedHackerBalance = depositValutBN.mul(new web3.utils.BN(4500)).div(new web3.utils.BN(10000));
    assert.isTrue((await stakingToken.balanceOf(vestingTokenLock.address)).eq(expectedHackerBalance));
    assert.isTrue((new web3.utils.BN(tx.logs[0].args._claimReward.hackerVestedReward)).eq(expectedHackerBalance));
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
         //hacker get also rewards via none vesting
         var hackerPriviosBalance = new web3.utils.BN("400000000000000000");
         assert.isTrue((await stakingToken.balanceOf(accounts[2])).sub(hackerPriviosBalance)
                       .eq(expectedHackerBalance.div(new web3.utils.BN(10))));

         await utils.increaseTime(8640*9);
         await vestingTokenLock.release({from:accounts[2]});
         assert.isTrue((await stakingToken.balanceOf(accounts[2])).sub(hackerPriviosBalance).eq(expectedHackerBalance));
         try {
               await vestingTokenLock.withdrawSurplus(1,{from:accounts[2]});
               assert(false, 'no Surplus');
             } catch (ex) {
               assertVMException(ex);
           }
          await stakingToken.mint(vestingTokenLock.address,10);
         //await stakingToken.transfer(vestingTokenLock.address,10);
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

  it("massupdate gas test 18 [ @skip-on-coverage ] ", async () => {
    await setup(accounts);
    var staker = accounts[1];
    await stakingToken.approve(hatVaults.address,web3.utils.toWei("2"),{from:staker});
    await stakingToken.mint(staker,web3.utils.toWei("2"));

    await hatVaults.deposit(0,web3.utils.toWei("1"),{from:staker});
    for (var i=1;i<18;i++) {
      let stakingToken2 = await ERC20Mock.new("Staking","STK",accounts[0]);
      await hatVaults.addPool(100,stakingToken2.address,accounts[1],[],[0,0,0,0,0,0],"_descriptionHash",[86400,10]);
      await hatVaults.setCommittee(i,accounts[0],{from:accounts[1]});
      await stakingToken2.approve(hatVaults.address,web3.utils.toWei("2"),{from:staker});
      await stakingToken2.mint(staker,web3.utils.toWei("2"));
      await hatVaults.deposit(i,web3.utils.toWei("1"),{from:staker});
    }
    await utils.mineBlock();
    var tx = await hatVaults.massUpdatePools(0,18);
    assert.equal(tx.receipt.gasUsed,2975486);
  }).timeout(40000);


  it("setPool x2", async () => {
    var poolManagerMock = await PoolsManagerMock.new();
    await setup(accounts);
    var staker = accounts[1];
    await stakingToken.approve(hatVaults.address,web3.utils.toWei("2"),{from:staker});
    await stakingToken.mint(staker,web3.utils.toWei("2"));
    await hatVaults.deposit(0,web3.utils.toWei("1"),{from:staker});
    let stakingToken2 = await ERC20Mock.new("Staking","STK",accounts[0]);
    await hatVaults.addPool(100,stakingToken2.address,accounts[1],[],[0,0,0,0,0,0],"_descriptionHash",[86400,10]);
    await hatVaults.setCommittee(1,accounts[0],{from:accounts[1]});
    await stakingToken2.approve(hatVaults.address,web3.utils.toWei("2"),{from:staker});
    await stakingToken2.mint(staker,web3.utils.toWei("2"));
    await hatVaults.deposit(1,web3.utils.toWei("1"),{from:staker});
    await hatVaults.setPool(0,200,true,"123");
    // Update twice in one block should be same as once
    await poolManagerMock.updatePoolsTwice(hatVaults.address, 0, 1);
    await hatVaults.setPool(1,200,true,"123");
    await hatVaults.massUpdatePools(0,2);
    assert.equal(Math.round(web3.utils.fromWei(await hatToken.balanceOf(hatVaults.address))), 80);
    try {
      await hatVaults.massUpdatePools(2,1);
      assert(false, 'invalid mass update pools range');
    } catch (ex) {
      assertVMException(ex);
    }
  });

  it("setPool x2 v2", async () => {
    await setup(accounts);
    var staker = accounts[1];
    await stakingToken.approve(hatVaults.address,web3.utils.toWei("2"),{from:staker});
    await stakingToken.mint(staker,web3.utils.toWei("2"));
    let stakingToken2 = await ERC20Mock.new("Staking","STK",accounts[0]);
    try {
          await hatVaults.addPool(100,stakingToken.address,accounts[1],[],[0,0,0,0,0,0],"_descriptionHash",[86400,10]);
          assert(false, 'cannot add pool with already exist token');
        } catch (ex) {
          assertVMException(ex);
      }
      try {
            await hatVaults.addPool(100,stakingToken2.address,utils.NULL_ADDRESS,[],[0,0,0,0,0,0],"_descriptionHash",[86400,10]);
            assert(false, 'committee cannot be zero');
          } catch (ex) {
            assertVMException(ex);
        }
        try {
              await hatVaults.addPool(100,stakingToken2.address,accounts[1],[],[0,0,0,0,0,0],"_descriptionHash",[10,86400]);
              assert(false, 'vesting duration smaller than period');
            } catch (ex) {
              assertVMException(ex);
          }

          try {
                await hatVaults.addPool(100,stakingToken2.address,accounts[1],[],[0,0,0,0,0,0],"_descriptionHash",[(121*24*3600),10]);
                assert(false, 'vesting duration is too long');
              } catch (ex) {
                assertVMException(ex);
            }

            try {
                 await hatVaults.addPool(100,stakingToken2.address,accounts[1],[],[0,0,0,0,0,0],"_descriptionHash",[86400,0]);
                  assert(false, 'vesting period cannot be zero');
                } catch (ex) {
                  assertVMException(ex);
              }
    await hatVaults.addPool(100,stakingToken2.address,accounts[1],[],[0,0,0,0,0,0],"_descriptionHash",[86400,10]);
    await hatVaults.setCommittee(1,accounts[0],{from:accounts[1]});
    await stakingToken2.approve(hatVaults.address,web3.utils.toWei("1"),{from:staker});
    await stakingToken2.mint(staker,web3.utils.toWei("1"));
    await hatVaults.deposit(0,web3.utils.toWei("1"),{from:staker});
    await hatVaults.deposit(1,web3.utils.toWei("1"),{from:staker});

    await hatVaults.setPool(0,200,true,"123");

    var tx = await hatVaults.massUpdatePools(0,2);
        await hatToken.getPastEvents('Transfer', {
              fromBlock: tx.blockNumber,
              toBlock: 'latest'
          })
          .then(function(events){
              assert.equal(events[0].event,"Transfer");
              assert.equal(events[0].args.from,utils.NULL_ADDRESS);
              assert.equal(events[0].args.to,hatVaults.address);
              assert.equal(events.length,2);
          });
    assert.equal(Math.round(web3.utils.fromWei(await hatToken.balanceOf(hatVaults.address))),25);

  });

  it("add/set pool on the same block", async () => {
    let hatToken1 = await HATTokenMock.new(accounts[0],utils.TIME_LOCK_DELAY_IN_BLOCKS_UNIT);
    let router1 =  await UniSwapV2RouterMock.new();
    var tokenLock1 = await HATTokenLock.new();
    let tokenLockFactory1 = await TokenLockFactory.new(tokenLock1.address);
    var poolManager= await PoolsManagerMock.new();
    let hatVaults1 = await HATVaults.new(hatToken1.address,
                                    web3.utils.toWei("100"),
                                    1,
                                    10,
                                    poolManager.address,
                                    router1.address,
                                    tokenLockFactory1.address);
    let stakingToken2 = await ERC20Mock.new("Staking","STK",accounts[0]);
    let stakingToken3 = await ERC20Mock.new("Staking","STK",accounts[0]);
    var globalPoolUpdatesLength = await hatVaults1.getGlobalPoolUpdatesLength();
    assert.equal(globalPoolUpdatesLength,0);
    await poolManager.addPools(hatVaults1.address,100,[stakingToken2.address,stakingToken3.address],accounts[1],[],[0,0,0,0,0,0],"_descriptionHash",[86400,10]);
    globalPoolUpdatesLength = await hatVaults1.getGlobalPoolUpdatesLength();
    assert.equal(globalPoolUpdatesLength,1); //2 got in the same block
    assert.equal(await hatVaults1.poolLength(),2);
    await poolManager.setPools(hatVaults1.address,[0,1],200,true,"_descriptionHash");

    globalPoolUpdatesLength = await hatVaults1.getGlobalPoolUpdatesLength();
    assert.equal(globalPoolUpdatesLength,2); //2 got in the same block
    let globalUpdatesLen =  await hatVaults1.getGlobalPoolUpdatesLength();
    let totalAllocPoint = (await hatVaults1.globalPoolUpdates(globalUpdatesLen-1)).totalAllocPoint;
    assert.equal(totalAllocPoint.toString(),400); //2 got in the same block
  });
});
