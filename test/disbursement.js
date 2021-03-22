const Disbursement = artifacts.require("./Disbursement.sol")
const TestToken = artifacts.require("./HATToken.sol")
const BigNumber = require('bignumber.js');


contract('Disbursement', function(accounts) {

    const ONE_YEAR = 60*60*24*365
    const FOUR_YEARS = 4 * ONE_YEAR
    const PREASSIGNED_TOKENS = new BigNumber(250000e18) // 10M with 18 decimals

    it('Disbursement tests', async () => {
        const initialBlock = await web3.eth.getBlock(await (web3.eth.getBlockNumber()))
        const start_date = initialBlock.timestamp

        // # Create Test token
        const token = await TestToken.new(accounts[0],0)

        // Create disbursement contracts
        const disbursement_1 = await Disbursement.new(accounts[1], accounts[5], FOUR_YEARS, start_date, token.address, {from: accounts[0]})

        await token.setPendingMinter(accounts[0],PREASSIGNED_TOKENS);
        await token.confirmMinter(accounts[0]);
        // Send tokens to Disbursement contract
        await token.mint(disbursement_1.address, PREASSIGNED_TOKENS)

        assert.equal((await token.getCurrentVotes(accounts[1])).toString(10),PREASSIGNED_TOKENS.toString(10))

        // # Test disbursement
        assert.equal((await token.balanceOf(disbursement_1.address)).toString(10), PREASSIGNED_TOKENS.toString(10))

        assert.equal((await disbursement_1.withdrawnTokens()).toString(10), "0")
        assert.equal(await disbursement_1.token(), token.address)
        assert.equal(await disbursement_1.receiver(), accounts[1])
        assert.equal(await disbursement_1.wallet(), accounts[5])
        assert.equal((await disbursement_1.disbursementPeriod()).toString(10), FOUR_YEARS.toString())
        assert.isAbove((await disbursement_1.startDate()).toNumber(), start_date-10)
        assert.isBelow((await disbursement_1.startDate()).toNumber(), start_date+10)

        assert.isTrue((await disbursement_1.calcMaxWithdraw()).lt(web3.utils.toBN(1e18)))


        // After one year, 1/4 of shares can be withdrawn
        await increaseTimestamp(web3, ONE_YEAR)

        //assert.isTrue((await disbursement_1.calcMaxWithdraw()).eq(web3.utils.toBN(PREASSIGNED_TOKENS.div(4))))
        const  maxWithdrawFirstYear = await disbursement_1.calcMaxWithdraw()
        assert.isTrue(maxWithdrawFirstYear.gt(web3.utils.toBN(PREASSIGNED_TOKENS.div(4).minus(1e18))), maxWithdrawFirstYear)
        assert.isTrue(maxWithdrawFirstYear.lt(web3.utils.toBN(PREASSIGNED_TOKENS.div(4).plus(1e18))), maxWithdrawFirstYear)
        // After two years, 1/2 of shares can be withdrawn
        await increaseTimestamp(web3, ONE_YEAR)
        const  maxWithdrawSecondYear = await disbursement_1.calcMaxWithdraw()
        assert.isTrue(maxWithdrawSecondYear.gt(web3.utils.toBN(PREASSIGNED_TOKENS.div(2).minus(1e18))), maxWithdrawSecondYear)
        assert.isTrue(maxWithdrawSecondYear.lt(web3.utils.toBN(PREASSIGNED_TOKENS.div(2).plus(1e18))), maxWithdrawSecondYear)

        // Owner withdraws shares
        await disbursement_1.withdraw(accounts[1], await disbursement_1.calcMaxWithdraw(), {from: accounts[1]})
        assert.equal(Math.floor(web3.utils.fromWei(await token.getCurrentVotes(accounts[1]))),124999);
        await disbursement_1.delegate(accounts[7],{from:accounts[1]})

        assert.equal(Math.floor(web3.utils.fromWei(await token.getCurrentVotes(accounts[1]))),0);
        assert.equal(Math.floor(web3.utils.fromWei(await token.getCurrentVotes(accounts[7]))),124999);

        //assert.isTrue((await disbursement_1.calcMaxWithdraw()).eq(web3.utils.toBN(0)))
        const firstWithdrawBalance = await token.balanceOf(disbursement_1.address)
        assert.isTrue(firstWithdrawBalance.gt(web3.utils.toBN(PREASSIGNED_TOKENS.div(2).minus(1e18))), firstWithdrawBalance)
        assert.isTrue(firstWithdrawBalance.lt(web3.utils.toBN(PREASSIGNED_TOKENS.div(2).plus(1e18))), firstWithdrawBalance)

        // Wallet withdraws remaining tokens
        const old_balance = await token.balanceOf(accounts[5])
        const old_disbursement_balance = firstWithdrawBalance
        await disbursement_1.walletWithdraw({from: accounts[5]})
        await token.delegate(accounts[1],{from:accounts[1]})
        assert.isTrue((await disbursement_1.calcMaxWithdraw()).eq(web3.utils.toBN(0)))

        final_disbursement_balance = await token.balanceOf(disbursement_1.address)
        assert.isTrue(final_disbursement_balance.eq(web3.utils.toBN(0)), final_disbursement_balance)
        assert.isTrue((await token.balanceOf(accounts[5])).eq(old_balance.add(old_disbursement_balance)))


    })

})

function mineBlock(_web3, reject, resolve) {
    _web3.currentProvider.send({
        method: "evm_mine",
        jsonrpc: "2.0",
        id: new Date().getTime()
      }, (e) => (e ? reject(e) : resolve()))
}

function increaseTimestamp(_web3, increase) {
    return new Promise((resolve, reject) => {
        _web3.currentProvider.send({
            method: "evm_increaseTime",
            params: [increase],
            jsonrpc: "2.0",
            id: new Date().getTime()
          }, (e) => (e ? reject(e) : mineBlock(web3, reject, resolve)))
    })
}
