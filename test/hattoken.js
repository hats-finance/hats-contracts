const HATToken = artifacts.require("./HATToken.sol");

function assertVMException(error) {
    let condition = (
        error.message.search('VM Exception') > -1 || error.message.search('Transaction reverted') > -1
    );
    assert.isTrue(condition, 'Expected a VM Exception, got this instead:' + error.message);
}

contract('HATToken', accounts => {

    it("should put 0 tokens in the first account", async () => {
        const token = await HATToken.new(accounts[0]);
        let balance = await token.balanceOf.call(accounts[0]);
        assert.equal(balance.valueOf(), 0);
    });

    it("should be owned by its creator", async () => {
        const token = await HATToken.new(accounts[0]);
        let minter = await token.minter();
        assert.equal(minter, accounts[0]);
    });

    it("should mint tokens to minter account", async () => {
        let minter, totalSupply, userSupply;
        const token = await HATToken.new(accounts[0]);
        totalSupply = await token.totalSupply();
        minter = await token.minter();
        userSupply = await token.balanceOf(minter);
        assert.equal(totalSupply, 0);
        assert.equal(userSupply, 0);

        await token.mintFromOwner(minter, 1000);
        totalSupply = await token.totalSupply();
        userSupply = await token.balanceOf(minter);
        assert.equal(totalSupply, 1000);
        assert.equal(userSupply, 1000);

        await token.mintFromOwner(accounts[2], 1300);
        totalSupply = await token.totalSupply();
        userSupply = await token.balanceOf(accounts[2]);
        assert.equal(totalSupply, 2300);
        assert.equal(userSupply, 1300);

    });

    it("should allow minting tokens only by minter", async () => {
        const token = await HATToken.new(accounts[0]);
        let minter = await token.minter();
        let totalSupply = await token.totalSupply();

        // calling 'mint' as a non-minter throws an error
        try {
            await token.mintFromOwner(minter, 1000, { 'from': accounts[1] });
            throw 'an error';
        } catch (error) {
            assertVMException(error);
        }

        // and so the supply of tokens should remain unchanged
        let newSupply = await token.totalSupply();
        assert.equal(totalSupply.toNumber(), newSupply.toNumber());
    });

    it("log the Transfer event on mint", async () => {
        const token = await HATToken.new(accounts[0]);

        const tx = await token.mintFromOwner(accounts[1], 1000, { from: accounts[0] });

        assert.equal(tx.logs.length, 1);
        assert.equal(tx.logs[0].event, "Transfer");
        assert.equal(tx.logs[0].args.to, accounts[1]);
        assert.equal(tx.logs[0].args.amount.toNumber(), 1000);
    });

    it("mint should be reflected in totalSupply", async () => {
        const token = await HATToken.new(accounts[0]);

        await token.mintFromOwner(accounts[1], 1000, { from: accounts[0] });
        let amount = await token.totalSupply();

        assert.equal(amount, 1000);

        await token.mintFromOwner(accounts[2], 500, { from: accounts[0] });
        amount = await token.totalSupply();

        assert.equal(amount.toNumber(), 1500);
    });

    it("mint should be reflected in balances", async () => {
        const token = await HATToken.new(accounts[0]);

        await token.mintFromOwner(accounts[1], 1000, { from: accounts[0] });

        const amount = await token.balanceOf(accounts[1]);

        assert.equal(amount.toNumber(), 1000);
    });

    it("totalSupply is 0 on init", async () => {
        const token = await HATToken.new(accounts[0]);

        const totalSupply = await token.totalSupply();

        assert.equal(totalSupply.toNumber(), 0);
    });

    it("burn", async () => {
        const token = await HATToken.new(accounts[0]);

        await token.mintFromOwner(accounts[1], 1000, { from: accounts[0] });

        var amount = await token.balanceOf(accounts[1]);

        assert.equal(amount.toNumber(), 1000);

        await token.burn(100,{ from: accounts[1] });

        amount = await token.balanceOf(accounts[1]);

        assert.equal(amount.toNumber(), 900);

        const totalSupply = await token.totalSupply();

        assert.equal(totalSupply.toNumber(), 900);
    });

    it("getPriorVotes ", async () => {
        const token = await HATToken.new(accounts[0]);
        await token.mintFromOwner(accounts[1], 100);
        let currentVote = await token.getCurrentVotes(accounts[1]);
        assert.equal(currentVote , 0);
        await token.delegate(accounts[1],{from:accounts[1]});
        currentVote = await token.getCurrentVotes(accounts[1]);
        assert.equal(currentVote , 100);
        let currentBlockNumber = (await web3.eth.getBlock("latest")).number;
        //increment block number
        await token.delegate(accounts[1],{from:accounts[1]});
        currentVote = await token.getPriorVotes(accounts[1],currentBlockNumber);
        assert.equal(currentVote , 100);
        await token.burn(50,{ from: accounts[1]});
        currentBlockNumber = (await web3.eth.getBlock("latest")).number;
        //increment block number
        await token.delegate(accounts[1],{from:accounts[1]});
        currentVote = await token.getPriorVotes(accounts[1],currentBlockNumber);
        assert.equal(currentVote , 50);
    });

    it("CappedToken ", async () => {
        const token = await HATToken.new(accounts[0]);
        const cap = web3.utils.toWei("500000");
        await token.mintFromOwner(accounts[1], cap);

        var amount = await token.balanceOf(accounts[1]);

        assert.equal(amount , cap);

        let totalSupply = await token.totalSupply();

        assert.equal(totalSupply, cap);

        try {
            await token.mintFromOwner(accounts[1], 1);
            throw 'an error';
        } catch (error) {
            assertVMException(error);
        }

        totalSupply = await token.totalSupply();

        assert.equal(totalSupply, cap);
    });

    it("master minting is capped ", async () => {
        const master = accounts[2];
        const token = await HATToken.new(accounts[0]);
        await token.setMaster(master);
        const cap = web3.utils.toWei("175000");
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
            const token = await HATToken.new(accounts[0]);
            try {
                await token.mintFromOwner(accounts[1], 10, { from: accounts[0] });
            } catch (ex) {
                assert(false, 'minter could not mint');
            }
        });

        it('mint by not minter', async () => {
            const token = await HATToken.new(accounts[0]);

            try {
                await token.mintFromOwner(accounts[1], 10, { from: accounts[1] });
            } catch (ex) {
                return;
            }

            assert(false, 'non-minter was able to mint');
        });
    });

    describe('onlyMaster', () => {
        it('mint by master', async () => {
            const token = await HATToken.new(accounts[0]);
            await token.setMaster(accounts[2]);
            try {
                await token.mint(accounts[1], 10, { from: accounts[2] });
            } catch (ex) {
                assert(false, 'minter could not mint');
            }
        });

        it('mint by not master', async () => {
            const token = await HATToken.new(accounts[0]);
            await token.setMaster(accounts[2]);
            try {
                await token.mintFromOwner(accounts[1], 10, { from: accounts[1] });
            } catch (ex) {
                return;
            }

            assert(false, 'non-minter was able to mint');
        });
    });
});
