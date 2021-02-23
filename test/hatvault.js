const HATVault = artifacts.require("./HATVault.sol");
const HATToken = artifacts.require("./HATToken.sol");
const LpToken = artifacts.require("./LpToken.sol");

var hatVault;
var hatToken;
var stakingToken;
var lpToken;
const setup = async function (accounts) {

  hatToken = await HATToken.new("Hat","HAT",accounts[0]);
  stakingToken = await HATToken.new("Staking","STK",accounts[0]);
  hatVault = await HATVault.new(accounts[0],
                              accounts[0],
                              hatToken.address,
                              stakingToken.address,
                              accounts[0],
                              "lptoken",
                              "LPT",
                              [accounts[0]],
                              accounts[0]);
  let lpTokenAddress = await hatVault.lpToken();
  lpToken = await LpToken.at(lpTokenAddress);
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
        assert.equal(await lpToken.balanceOf(staker), 1000);
        //withdrawWithLpToken
        await hatVault.withdrawWithLpToken(1000,{from:staker});
        //lptoken burned
        assert.equal(await lpToken.balanceOf(staker), 0);
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
        await hatVault.notifyRewardAmount(rewardTokenAmount);
        await hatVault.stakeForLpToken(web3.utils.toWei("1"),{from:staker});
        assert.equal(await lpToken.balanceOf(staker), web3.utils.toWei("1"));
      //exitWithLpToken
        assert.equal(await hatToken.balanceOf(staker),0);
        await hatVault.exitWithLpToken({from:staker});
        let balanceOfStakerHats = await hatToken.balanceOf(staker);
        let rewardRate = await hatVault.rewardRate();
        assert.equal(balanceOfStakerHats.toString(),rewardRate.toString());
        assert.equal(rewardRate > 0,true);
    });

});
