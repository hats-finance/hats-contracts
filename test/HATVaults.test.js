const {expect} = require("chai");
const {ethers} = require("hardhat");
//
// const chai = require("chai");
// const { solidity } = require("ethereum-waffle");
//
// chai.use(solidity);
//
// const HATVaults = artifacts.require("./HATVaults.sol");
// const HATTokenMock = artifacts.require("./HATTokenMock.sol");
// const ERC20Mock = artifacts.require("./ERC20Mock.sol");
// const UniSwapV3RouterMock = artifacts.require("./UniSwapV3RouterMock.sol");
// const TokenLockFactory = artifacts.require("./TokenLockFactory.sol");
// const HATTokenLock = artifacts.require("./HATTokenLock.sol");
// const PoolsManagerMock = artifacts.require("./PoolsManagerMock.sol");

const utils = require("./utils.js");
//const ISwapRouter = new ethers.utils.Interface(UniSwapV3RouterMock.abi);



let hatVaults;
let hatVaultsFromCommittee;
let hatVaultsFromUser1;
let hatToken;
let lpToken;
let router;
const REWARD_PER_BLOCK = "10";
const REAL_REWARD_PER_BLOCK = "0.0161856448";
let tokenLockFactory;
const safeWithdrawBlocksIncrement = 3;
let hatVaultsExpectedHatsBalance;
let accounts;
let governance;
let committee;
let user1;
const oneEth = ethers.utils.parseEther("1");
const zeroEth = ethers.utils.parseEther("0");
const pid = 0;


async function deployContract(contractName, args = []) {
    const contractFactory = await ethers.getContractFactory(contractName);
    let contract = await contractFactory.deploy(...args);
    await contract.deployed();
    return contract;
}

const setup = async function (
    accounts,
    reward_per_block = REWARD_PER_BLOCK,
    startBlock = 0,
    bountyLevels = [],
    bountySplit = [0, 0, 0, 0, 0, 0],
    halvingAfterBlock = 10,
    routerReturnType = 0,
    allocPoint = 100,
    bountyVestingParams = [86400, 10],
    weth = false,
) {
    hatToken = await deployContract("HATTokenMock", [governance, utils.TIME_LOCK_DELAY]);
    lpToken = await deployContract("ERC20Mock", ["Staking", "STK"]);
    let wethAddress = utils.NULL_ADDRESS;
    if (weth) {
        wethAddress = lpToken.address;
    }
    router = await deployContract("UniSwapV3RouterMock", [routerReturnType, wethAddress]);
    const tokenLock = await deployContract("HATTokenLock");
    tokenLockFactory = await deployContract("TokenLockFactory", [tokenLock.address]);

    hatVaults = await deployContract("HATVaults",
        [hatToken.address,
            web3.utils.toWei(reward_per_block),
            startBlock,
            halvingAfterBlock,
            governance,
            [router.address],
            tokenLockFactory.address]
    );
    hatVaultsFromUser1 = hatVaults.connect(user1);
    hatVaultsFromCommittee = hatVaults.connect(committee);

    await hatVaults.addPool(
        allocPoint,
        lpToken.address,
        committee,
        bountyLevels,
        bountySplit,
        "testing pool",
        bountyVestingParams,
    );
    await hatVaultsFromCommittee.committeeCheckIn(pid);
};

async function depositHATRewards(rewardInVaults) {
    let rewardInWei = web3.utils.toWei(rewardInVaults.toString());
    await utils.setMinter(hatToken, governance, rewardInWei);
    await hatToken.mint(governance, rewardInWei);
    await hatToken.approve(hatVaults.address, rewardInWei);
    let tx = await hatVaults.depositHATReward(rewardInWei);
    assert.equal(tx.logs[0].event, "DepositHATReward");
    assert.equal(tx.logs[0].args._amount,);
    hatVaultsExpectedHatsBalance = rewardInVaults;
}

async function calculateExpectedReward(staker, operationBlocksIncrement = 0) {
    let currentBlockNumber = (await web3.eth.getBlock("latest")).number;
    let lastRewardBlock = (await hatVaults.poolInfos(pid)).lastRewardBlock;
    let allocPoint = (await hatVaults.poolInfos(pid)).allocPoint;
    let rewardPerShare = new web3.utils.BN(
        (await hatVaults.poolInfos(pid)).rewardPerShare
    );
    let onee12 = new web3.utils.BN("1000000000000");
    let stakerAmount = (await hatVaults.userInfo(pid, staker)).shares;
    let globalUpdatesLen = await hatVaults.getGlobalPoolUpdatesLength();
    let totalAllocPoint = (
        await hatVaults.globalPoolUpdates(globalUpdatesLen - 1)
    ).totalAllocPoint;
    let poolReward = await hatVaults.getRewardForBlocksRange(
        lastRewardBlock,
        currentBlockNumber + 1 + operationBlocksIncrement,
        allocPoint,
        totalAllocPoint
    );
    let lpSupply = await lpToken.balanceOf(hatVaults.address);
    rewardPerShare = rewardPerShare.add(poolReward.mul(onee12).div(lpSupply));
    let rewardDebt = (await hatVaults.userInfo(pid, staker)).rewardDebt;
    return stakerAmount
        .mul(rewardPerShare)
        .div(onee12)
        .sub(rewardDebt);
}

async function safeWithdraw(pid, user, amount) {
    let withdrawPeriod = (await hatVaults.generalParameters()).withdrawPeriod.toNumber();
    let safetyPeriod = (await hatVaults.generalParameters()).safetyPeriod.toNumber();
    let hatVaultsFromUser = hatVaults.connect(user);
    //increase time for the case there is already pending request ..so make sure start a new one..
    await utils.increaseTime(7 * 24 * 3600);
    await hatVaultsFromUser.withdrawRequest(pid);
    //increase time for pending period
    await utils.increaseTime(7 * 24 * 3600);
    let currentTimeStamp = (await web3.eth.getBlock("latest")).timestamp;
    if (currentTimeStamp % (withdrawPeriod + safetyPeriod) >= withdrawPeriod) {
        await utils.increaseTime(
            (currentTimeStamp % (withdrawPeriod + safetyPeriod)) +
            safetyPeriod -
            withdrawPeriod
        );
    }
    return await hatVaultsFromUser.withdraw(pid, amount);
}

contract('Testing rewards logic',
    function (accounts) {
        let expectedRewardAfter1EthDeposit;

        beforeEach(async function () {//TODO before?
            governance = accounts[0];
            committee = accounts[1];
            user1 = accounts[2];
            await setup(accounts);

            await lpToken.connect(user1).approve(hatVaults.address, oneEth);
            await lpToken.mint(user1, oneEth);
            //   let userBalance = await lpToken.balanceOf(user1);

            //  expect(userBalance.eq(oneEth)).to.be.true();
            expect((await lpToken.balanceOf(user1)).to.equal(oneEth));
            console.log(userBalance);
            console.log(oneEth);

            expect(await lpToken.balanceOf(user1)).to.equal(oneEth);

        });

        describe.only("after first deposit", function () {
            this.beforeEach(async function () {
                expect(await hatVaultsFromUser1.deposit(pid, oneEth))
                    .to.emit(hatVaults, "Deposit")
                    .withArgs(user1, pid, oneEth);
            });

            describe("when there's enough HAT rewards", function () {
                this.beforeEach(async function () {
                    expectedRewardAfter1EthDeposit = calculateExpectedReward(user1);
                    await depositHATRewards(expectedRewardAfter1EthDeposit);
                });
                it("doesn't reward user", async function () {
                    expect(await hatToken.balanceOf(user1)).to.equal(0);
                });
                it("keeps pending rewards for user", async function () {
                    let pendingReward = await hatVaults.getPendingReward(pid, user1);
                    console.log(pendingReward);
                    expect(await hatVaults.getPendingReward(pid, user1)).to.equal(expectedRewardAfter1EthDeposit);
                });

                describe("after withdraw", function () {
                    this.beforeEach(async function () {
                        await expect(safeWithdraw(pid, user, oneEth))
                            .to.emit(hatVaults, "Withdraw")
                            .withArgs(user1.address, pid, oneEth);
                    });
                    it("transfers to user the pending reward", async function () {
                        expect(await hatToken.balanceOf(user1.address)).to.equal(expectedRewardAfter1EthDeposit);
                    });
                    it("resets user's pending reward", async function () {
                        expect(await hatVaults.getPendingReward(pid, user1.address)).to.equal(0);
                    });
                });

                describe("after claimReward", function () {
                    this.beforeEach(async function () {
                        await expect(hatVaultsFromUser1.claimReward(pid))
                            .to.emit(hatVaults, "claimReward")
                            .withArgs(pid);
                    });
                    it("transfers to user the pending reward", async function () {
                        expect(await hatToken.balanceOf(user1.address)).to.equal(expectedRewardAfter1EthDeposit);
                    });
                    it("resets user's pending reward", async function () {
                        expect(await hatVaults.getPendingReward(pid, user1.address)).to.equal(0);
                    });
                });

            });

            describe("when there's no HAT rewards", function () {
                it("doesn't reward user", async function () {
                    expect(await hatToken.balanceOf(user1)).to.equal(0);
                });
                it("keeps pending rewards for user", async function () {
                    //     let pendingReward = await hatVaults.getPendingReward(pid, user1);
                    //    console.log(pendingReward);
                    expect(await hatVaults.getPendingReward(pid, user1)).to.equal(expectedRewardAfter1EthDeposit);
                });

                describe("after withdraw", function () {
                    this.beforeEach(async function () {
                        await expect(safeWithdraw(pid, user, oneEth))
                            .to.emit(hatVaults, "Withdraw")
                            .withArgs(user1.address, pid, oneEth);
                    });
                    it("doesn't reward user", async function () {
                        expect(await hatToken.balanceOf(user1)).to.equal(0);
                    });
                    it("keeps pending rewards for user", async function () {
                        //  let pendingReward = await hatVaults.getPendingReward(pid, user1);
                        // console.log(pendingReward);
                        expect(await hatVaults.getPendingReward(pid, user1)).to.equal(expectedRewardAfter1EthDeposit);
                    });
                });

                describe("after claimReward", function () {
                    this.beforeEach(async function () {
                        await expect(hatVaultsFromUser1.claimReward(pid))
                            .to.emit(hatVaults, "claimReward")
                            .withArgs(pid);
                    });
                    it("doesn't reward user", async function () {
                        expect(await hatToken.balanceOf(user1)).to.equal(0);
                    });
                    it("keeps pending rewards for user", async function () {
                        //       let pendingReward = await hatVaults.getPendingReward(pid, user1);
                        //      console.log(pendingReward);
                        expect(await hatVaults.getPendingReward(pid, user1)).to.equal(expectedRewardAfter1EthDeposit);
                    });
                });

            });


        });
    });
