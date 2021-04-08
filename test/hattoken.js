const HATToken = artifacts.require("./HATToken.sol");
const utils = require("./utils.js");

function assertVMException(error) {
    let condition = (
        error.message.search('VM Exception') > -1 || error.message.search('Transaction reverted') > -1
    );
    assert.isTrue(condition, 'Expected a VM Exception, got this instead:' + error.message);
}

contract('HATToken', accounts => {

    it("should put 0 tokens in the first account", async () => {
        const token = await HATToken.new(accounts[0],utils.TIME_LOCK_DELAY_IN_BLOCKS_UNIT);
        let balance = await token.balanceOf.call(accounts[0]);
        assert.equal(balance.valueOf(), 0);
    });

    it("should be owned by its creator", async () => {
        const token = await HATToken.new(accounts[0],utils.TIME_LOCK_DELAY_IN_BLOCKS_UNIT);
        let governance = await token.governance();
        assert.equal(governance, accounts[0]);
    });

    it("should mint tokens to minter account", async () => {
        let governance, totalSupply, userSupply;
        governance = accounts[0];
        const token = await HATToken.new(governance,utils.TIME_LOCK_DELAY_IN_BLOCKS_UNIT);
        totalSupply = await token.totalSupply();
        userSupply = await token.balanceOf(governance);
        assert.equal(totalSupply, 0);
        assert.equal(userSupply, 0);
        const cap = web3.utils.toWei("175000");
        await utils.setMinter(token,accounts[0],cap);
        await token.mint(accounts[0], 1000);
        totalSupply = await token.totalSupply();
        userSupply = await token.balanceOf(governance);
        assert.equal(totalSupply, 1000);
        assert.equal(userSupply, 1000);

        await token.mint(accounts[2], 1300);
        totalSupply = await token.totalSupply();
        userSupply = await token.balanceOf(accounts[2]);
        assert.equal(totalSupply, 2300);
        assert.equal(userSupply, 1300);

    });

    it("should allow minting tokens only by minter", async () => {
        const token = await HATToken.new(accounts[0],utils.TIME_LOCK_DELAY_IN_BLOCKS_UNIT);
        let governance = await token.governance();
        let totalSupply = await token.totalSupply();
        await utils.setMinter(token,accounts[0],1000);

        // calling 'mint' as a non-minter throws an error
        try {
            await token.mint(governance, 1000, { 'from': accounts[1] });
            throw 'an error';
        } catch (error) {
            assertVMException(error);
        }

        // and so the supply of tokens should remain unchanged
        let newSupply = await token.totalSupply();
        assert.equal(totalSupply.toNumber(), newSupply.toNumber());
    });

    it("timelock for governance", async () => {
        const token = await HATToken.new(accounts[0],utils.TIME_LOCK_DELAY_IN_BLOCKS_UNIT);

        try {
            await token.confirmGovernance({ 'from': accounts[0]});
            throw 'an error';
        } catch (error) {
            assertVMException(error);
        }

        await token.setPendingGovernance(accounts[1],{ 'from': accounts[0]});
        try {
            await token.confirmGovernance({ 'from': accounts[0]});
            throw 'an error';
        } catch (error) {
            assertVMException(error);
        }
        for (let i=0;i<utils.TIME_LOCK_DELAY_IN_BLOCKS_UNIT -10 ;i++) {
          await utils.mineBlock();
        }

        try {
            await token.confirmGovernance({ 'from': accounts[0]});
            throw 'an error';
        } catch (error) {
            assertVMException(error);
        }

        for (let i=0;i<10 ;i++) {
          await utils.mineBlock();
        }

        await token.confirmGovernance({ 'from': accounts[0]});
        assert.equal(await token.governance(),accounts[1]);
        try {
            await token.confirmGovernance({ 'from': accounts[0]});
            throw 'an error';
        } catch (error) {
            assertVMException(error);
        }
    });

    it("timelock for minter", async () => {
        const token = await HATToken.new(accounts[0],utils.TIME_LOCK_DELAY_IN_BLOCKS_UNIT);

        try {
            await token.confirmMinter(accounts[1],{ 'from': accounts[0]});
            throw 'an error';
        } catch (error) {
            assertVMException(error);
        }

        await token.setPendingMinter(accounts[1],10,{ 'from': accounts[0]});
        try {
            await token.confirmMinter(accounts[1],{ 'from': accounts[0]});
            throw 'an error';
        } catch (error) {
            assertVMException(error);
        }
        for (let i=0;i<utils.TIME_LOCK_DELAY_IN_BLOCKS_UNIT -10 ;i++) {
          await utils.mineBlock();
        }

        try {
            await token.confirmMinter(accounts[1],{ 'from': accounts[0]});
            throw 'an error';
        } catch (error) {
            assertVMException(error);
        }

        for (let i=0;i<10 ;i++) {
          await utils.mineBlock();
        }

        await token.confirmMinter(accounts[1],{ 'from': accounts[0]});
        assert.equal(await token.minters(accounts[1]),10);
        assert.equal(await token.minters(accounts[0]),0);
    });


    it("log the Transfer event on mint", async () => {
        const token = await HATToken.new(accounts[0],utils.TIME_LOCK_DELAY_IN_BLOCKS_UNIT);
        await utils.setMinter(token,accounts[0],1000);
        const tx = await token.mint(accounts[1], 1000, { from: accounts[0] });

        assert.equal(tx.logs.length, 1);
        assert.equal(tx.logs[0].event, "Transfer");
        assert.equal(tx.logs[0].args.to, accounts[1]);
        assert.equal(tx.logs[0].args.amount.toNumber(), 1000);
    });

    it("mint should be reflected in totalSupply", async () => {
        const token = await HATToken.new(accounts[0],utils.TIME_LOCK_DELAY_IN_BLOCKS_UNIT);
        await utils.setMinter(token,accounts[0],2000);
        await token.mint(accounts[1], 1000, { from: accounts[0] });
        let amount = await token.totalSupply();

        assert.equal(amount, 1000);

        await token.mint(accounts[2], 500, { from: accounts[0] });
        amount = await token.totalSupply();

        assert.equal(amount.toNumber(), 1500);
    });

    it("mint should be reflected in balances", async () => {
        const token = await HATToken.new(accounts[0],utils.TIME_LOCK_DELAY_IN_BLOCKS_UNIT);
        await utils.setMinter(token,accounts[0],1000);

        await token.mint(accounts[1], 1000, { from: accounts[0] });

        const amount = await token.balanceOf(accounts[1]);

        assert.equal(amount.toNumber(), 1000);
    });

    it("totalSupply is 0 on init", async () => {
        const token = await HATToken.new(accounts[0],utils.TIME_LOCK_DELAY_IN_BLOCKS_UNIT);

        const totalSupply = await token.totalSupply();

        assert.equal(totalSupply.toNumber(), 0);
    });

    it("burn", async () => {
        const token = await HATToken.new(accounts[0],utils.TIME_LOCK_DELAY_IN_BLOCKS_UNIT);
        await utils.setMinter(token,accounts[0],1000);
        await token.mint(accounts[1], 1000, { from: accounts[0] });
        var amount = await token.balanceOf(accounts[1]);

        assert.equal(amount.toNumber(), 1000);

        await token.burn(100,{ from: accounts[1] });

        amount = await token.balanceOf(accounts[1]);

        assert.equal(amount.toNumber(), 900);

        const totalSupply = await token.totalSupply();

        assert.equal(totalSupply.toNumber(), 900);

        try {
            await token.burn(901,{from:accounts[1]});
            throw 'an error';
        } catch (error) {
            assertVMException(error);
        }
    });

    it("getPriorVotes ", async () => {
        const token = await HATToken.new(accounts[0],utils.TIME_LOCK_DELAY_IN_BLOCKS_UNIT);
        await utils.setMinter(token,accounts[0],2000);

        await token.mint(accounts[1], 100);
        let currentVote = await token.getCurrentVotes(accounts[1]);
        assert.equal(currentVote , 0);
        await token.delegate(accounts[1],{from:accounts[1]});
        currentVote = await token.getCurrentVotes(accounts[1]);
        assert.equal(currentVote , 100);
        let currentBlockNumber = (await web3.eth.getBlock("latest")).number;
        //increment block number
        utils.increaseTime(40);
        currentVote = await token.getPriorVotes(accounts[1],currentBlockNumber);
        assert.equal(currentVote , 100);
        await token.burn(50,{ from: accounts[1]});
        currentBlockNumber = (await web3.eth.getBlock("latest")).number;
        //increment block number
        utils.increaseTime(40);
        currentVote = await token.getPriorVotes(accounts[1],currentBlockNumber);
        assert.equal(currentVote , 50);
    });

    it("CappedToken ", async () => {
        const token = await HATToken.new(accounts[0],utils.TIME_LOCK_DELAY_IN_BLOCKS_UNIT);
        const cap = web3.utils.toWei("500000");
        await utils.setMinter(token,accounts[0],web3.utils.toWei("600000"));
        await token.mint(accounts[1], cap);

        var amount = await token.balanceOf(accounts[1]);

        assert.equal(amount , cap);

        let totalSupply = await token.totalSupply();

        assert.equal(totalSupply, cap);

        try {
            await token.mint(accounts[1], 1);
            throw 'an error';
        } catch (error) {
            assertVMException(error);
        }

        totalSupply = await token.totalSupply();

        assert.equal(totalSupply, cap);
    });

    it("master minting is capped ", async () => {
        const master = accounts[2];
        const token = await HATToken.new(accounts[0],utils.TIME_LOCK_DELAY_IN_BLOCKS_UNIT);
        const cap = web3.utils.toWei("175000");
        await utils.setMinter(token,master,cap);

        await token.mint(accounts[1], cap,{from:master});

        var amount = await token.balanceOf(accounts[1]);

        assert.equal(amount , cap);

        let totalSupply = await token.totalSupply();

        assert.equal(totalSupply, cap);

        try {
            await token.mint(accounts[1], 1,{from:master});
            throw 'an error';
        } catch (error) {
            assertVMException(error);
        }

        totalSupply = await token.totalSupply();

        assert.equal(totalSupply, cap);
    });


    describe('onlyMinter', () => {
        it('mint by minter', async () => {
            const token = await HATToken.new(accounts[0],utils.TIME_LOCK_DELAY_IN_BLOCKS_UNIT);
            await utils.setMinter(token,accounts[0],10);
            try {
                await token.mint(accounts[1], 10, { from: accounts[0] });
            } catch (ex) {
                assert(false, 'minter could not mint');
            }
        });

        it('mint by not minter', async () => {
            const token = await HATToken.new(accounts[0],utils.TIME_LOCK_DELAY_IN_BLOCKS_UNIT);
            await utils.setMinter(token,accounts[0],10);
            try {
                await token.mint(accounts[1], 10, { from: accounts[1] });
            } catch (ex) {
                return;
            }

            assert(false, 'non-minter was able to mint');
        });
    });
});
