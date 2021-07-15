const HATToken = artifacts.require("./HATTokenMock.sol");
const utils = require("./utils.js");
const { fromRpcSig } = require('ethereumjs-util');
const ethSigUtil = require('eth-sig-util');
const { EIP712Domain } = require('./eip712.js');
const Wallet = require('ethereumjs-wallet').default;

function assertVMException(error) {
    let condition = (
        error.message.search('VM Exception') > -1 || error.message.search('Transaction reverted') > -1
    );
    assert.isTrue(condition, 'Expected a VM Exception, got this instead:' + error.message);
}

contract('HATToken', accounts => {

    it("should put 0 tokens in the first account", async () => {
        const token = await HATToken.new(accounts[0],utils.TIME_LOCK_DELAY);
        let balance = await token.balanceOf.call(accounts[0]);
        assert.equal(balance.valueOf(), 0);
    });

    it("should be owned by its creator", async () => {
        const token = await HATToken.new(accounts[0],utils.TIME_LOCK_DELAY);
        let governance = await token.governance();
        assert.equal(governance, accounts[0]);
    });

    it("should mint tokens to minter account", async () => {
        let governance, totalSupply, userSupply;
        governance = accounts[0];
        const token = await HATToken.new(governance,utils.TIME_LOCK_DELAY);
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

        try {
            await token.mint('0x0000000000000000000000000000000000000000', 1300);
            throw 'cant mint to 0 address';
        } catch (error) {
            assertVMException(error);
        }

        await token.mint(accounts[2], 1300);
        totalSupply = await token.totalSupply();
        userSupply = await token.balanceOf(accounts[2]);
        assert.equal(totalSupply, 2300);
        assert.equal(userSupply, 1300);

    });

    it("should allow minting tokens only by minter", async () => {
        const token = await HATToken.new(accounts[0],utils.TIME_LOCK_DELAY);
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
        const token = await HATToken.new(accounts[0],utils.TIME_LOCK_DELAY);

        try {
            await token.confirmGovernance({ 'from': accounts[0]});
            throw 'an error';
        } catch (error) {
            assertVMException(error);
        }

        try {
            await token.setPendingGovernance(accounts[1],{ 'from': accounts[1]});
            throw 'only gov can setPendingGovernance ';
        } catch (error) {
            assertVMException(error);
        }

        try {
            await token.setPendingGovernance(utils.NULL_ADDRESS,{ 'from': accounts[0]});
            throw 'cannot set null gov';
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
        await utils.increaseTime(utils.TIME_LOCK_DELAY -10);

        try {
            await token.confirmGovernance({ 'from': accounts[0]});
            throw 'an error';
        } catch (error) {
            assertVMException(error);
        }

        await utils.increaseTime(10);

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
        const token = await HATToken.new(accounts[0],utils.TIME_LOCK_DELAY);

        try {
            await token.confirmMinter(accounts[1],{ 'from': accounts[0]});
            throw 'an error';
        } catch (error) {
            assertVMException(error);
        }
        try {
            await token.setPendingMinter(accounts[1], 10 ,{ 'from': accounts[1]});
            throw 'cant set minter from non governance account';
        } catch (error) {
            assertVMException(error);
        }
        var tx = await token.setPendingMinter(accounts[1],10,{ 'from': accounts[0]});
        assert.equal(tx.logs[0].event,"MinterPending");
        assert.equal(tx.logs[0].args.minter,accounts[1]);
        assert.equal(tx.logs[0].args.seedAmount,10);
        assert.equal(tx.logs[0].args.at,(await web3.eth.getBlock("latest")).timestamp);

        try {
            await token.confirmMinter(accounts[1],{ 'from': accounts[0]});
            throw 'an error';
        } catch (error) {
            assertVMException(error);
        }

        await utils.increaseTime(utils.TIME_LOCK_DELAY -10);

        try {
            await token.confirmMinter(accounts[1],{ 'from': accounts[0]});
            throw 'an error';
        } catch (error) {
            assertVMException(error);
        }

        await utils.increaseTime(10);


        try {
            await token.confirmMinter(accounts[1],{ 'from': accounts[2]});
            throw 'only gov';
        } catch (error) {
            assertVMException(error);
        }

        await token.confirmMinter(accounts[1],{ 'from': accounts[0]});
        assert.equal(await token.minters(accounts[1]),10);
        assert.equal(await token.minters(accounts[0]),0);
    });


    it("log the Transfer event on mint", async () => {
        const token = await HATToken.new(accounts[0],utils.TIME_LOCK_DELAY);
        await utils.setMinter(token,accounts[0],1000);
        const tx = await token.mint(accounts[1], 1000, { from: accounts[0] });

        assert.equal(tx.logs.length, 1);
        assert.equal(tx.logs[0].event, "Transfer");
        assert.equal(tx.logs[0].args.to, accounts[1]);
        assert.equal(tx.logs[0].args.value.toNumber(), 1000);
    });

    it("mint should be reflected in totalSupply", async () => {
        const token = await HATToken.new(accounts[0],utils.TIME_LOCK_DELAY);
        await utils.setMinter(token,accounts[0],2000);
        await token.mint(accounts[1], 1000, { from: accounts[0] });
        let amount = await token.totalSupply();

        assert.equal(amount, 1000);

        await token.mint(accounts[2], 500, { from: accounts[0] });
        amount = await token.totalSupply();

        assert.equal(amount.toNumber(), 1500);
    });

    it("mint should be reflected in balances", async () => {
        const token = await HATToken.new(accounts[0],utils.TIME_LOCK_DELAY);
        await utils.setMinter(token,accounts[0],1000);

        await token.mint(accounts[1], 1000, { from: accounts[0] });

        const amount = await token.balanceOf(accounts[1]);

        assert.equal(amount.toNumber(), 1000);
    });

    it("totalSupply is 0 on init", async () => {
        const token = await HATToken.new(accounts[0],utils.TIME_LOCK_DELAY);

        const totalSupply = await token.totalSupply();

        assert.equal(totalSupply.toNumber(), 0);
    });

    it("burn", async () => {
        const token = await HATToken.new(accounts[0],utils.TIME_LOCK_DELAY);
        await utils.setMinter(token,accounts[0],1000);
        await token.mint(accounts[1], 1000, { from: accounts[0] });
        var amount = await token.balanceOf(accounts[1]);

        assert.equal(amount.toNumber(), 1000);

        await token.burn(100,{ from: accounts[1] });

        try {
            await token.burnFrom('0x0000000000000000000000000000000000000000', 0);
            throw 'cant burn from 0 address';
        } catch (error) {
            assertVMException(error);
        }

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
        const token = await HATToken.new(accounts[0],utils.TIME_LOCK_DELAY);
        await utils.setMinter(token,accounts[0],2000);

        try {
            await token.getPriorVotes(accounts[1], (await web3.eth.getBlock("latest")).number + 1);
            throw 'cant get for future block';
        } catch (error) {
            assertVMException(error);
        }

        // Should start at 0
        let currentVote = await token.getPriorVotes(accounts[1], (await web3.eth.getBlock("latest")).number - 1);
        assert.equal(currentVote , 0);

        await token.mint(accounts[1], 100);
        currentVote = await token.getCurrentVotes(accounts[1]);
        assert.equal(currentVote , 0);
        await token.delegate(accounts[1],{from:accounts[1]});
        currentVote = await token.getCurrentVotes(accounts[1]);
        assert.equal(currentVote , 100);
        let currentBlockNumber = (await web3.eth.getBlock("latest")).number;
        let firstBlockNumber = currentBlockNumber;
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

        // Should be 0 before first action
        currentVote = await token.getPriorVotes(accounts[1], 0);
        assert.equal(currentVote, 0);

        // Check old votes count
        currentVote = await token.getPriorVotes(accounts[1], firstBlockNumber);
        assert.equal(currentVote , 100);

        // Check old votes count
        currentVote = await token.getPriorVotes(accounts[1], currentBlockNumber - 1);
        assert.equal(currentVote , 100);

        // Move block
        await token.burn(0,{ from: accounts[2]});
        await token.burn(0,{ from: accounts[2]});
        await token.burn(0,{ from: accounts[2]});
        await token.burn(1,{ from: accounts[1]});
        // Check old votes count
        currentVote = await token.getPriorVotes(accounts[1], currentBlockNumber);
        assert.equal(currentVote , 50);
        currentVote = await token.getPriorVotes(accounts[1], currentBlockNumber + 2);
        assert.equal(currentVote , 50);
    });

    it("delegate twice in same block ", async () => {
        const token = await HATToken.new(accounts[0],utils.TIME_LOCK_DELAY);
        await utils.setMinter(token,accounts[0],2000);

        // Should start at 0
        let currentVote = await token.getPriorVotes(accounts[1], (await web3.eth.getBlock("latest")).number - 1);
        assert.equal(currentVote , 0);

        await token.mint(accounts[1], 100);
        currentVote = await token.getCurrentVotes(accounts[1]);
        assert.equal(currentVote , 0);
        await token.delegateTwice(accounts[1], accounts[2],{from:accounts[1]});
        currentVote = await token.getCurrentVotes(accounts[1]);
        assert.equal(currentVote , 100);
    });

    it("CappedToken ", async () => {
        const token = await HATToken.new(accounts[0],utils.TIME_LOCK_DELAY);
        const cap = web3.utils.toWei("10000000");
        await utils.setMinter(token,accounts[0],web3.utils.toWei("16000000"));
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
        const token = await HATToken.new(accounts[0],utils.TIME_LOCK_DELAY);
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
            const token = await HATToken.new(accounts[0],utils.TIME_LOCK_DELAY);
            await utils.setMinter(token,accounts[0],10);
            try {
                await token.mint(accounts[1], 10, { from: accounts[0] });
            } catch (ex) {
                assert(false, 'minter could not mint');
            }
        });

        it('mint by not minter', async () => {
            const token = await HATToken.new(accounts[0],utils.TIME_LOCK_DELAY);
            await utils.setMinter(token,accounts[0],10);
            try {
                await token.mint(accounts[1], 10, { from: accounts[1] });
            } catch (ex) {
                return;
            }

            assert(false, 'non-minter was able to mint');
        });
    });

    it("increase/decrease allowance", async () => {
        const token = await HATToken.new(accounts[0],utils.TIME_LOCK_DELAY);
        await utils.setMinter(token,accounts[0],web3.utils.toWei("1000"));
        await token.mint(accounts[1], web3.utils.toWei("100"));
        let value = web3.utils.toWei("10");
        try {
            await token.increaseAllowance(utils.NULL_ADDRESS, value, { from: accounts[1] });
            assert(false, 'spender cannot be null');
        } catch (ex) {
            assertVMException(ex);
        }
        await token.increaseAllowance(accounts[2], value, { from: accounts[1] });
        assert.equal((await token.allowance(accounts[1], accounts[2])).toString(), value.toString());
        await token.increaseAllowance(accounts[2], value, { from: accounts[1] });
        assert.equal((await token.allowance(accounts[1], accounts[2])).toString(), web3.utils.toWei("20"));

        try {
          await token.decreaseAllowance(utils.NULL_ADDRESS, value, { from: accounts[1] });
            assert(false, 'spender cannot be null');
        } catch (ex) {
            assertVMException(ex);
        }

        await token.decreaseAllowance(accounts[2], value, { from: accounts[1] });
        assert.equal((await token.allowance(accounts[1], accounts[2])).toString(), value.toString());
        try {
          await token.decreaseAllowance(accounts[2], web3.utils.toWei("20"), { from: accounts[1] });
            assert(false, 'cannot decrease more than allowence');
        } catch (ex) {
            assertVMException(ex);
        }





    });

    it("transfer from and to 0 address not allowed", async () => {
        const token = await HATToken.new(accounts[0],utils.TIME_LOCK_DELAY);
        await utils.setMinter(token,accounts[0],web3.utils.toWei("1000"));
        await token.mint(accounts[1], web3.utils.toWei("100"));
        let value = web3.utils.toWei("10");

        await token.approve(accounts[2], value, { from: accounts[1] });

        assert.equal((await token.allowance(accounts[1], accounts[2])).toString(), value.toString());

        try {
            await token.transferFrom(accounts[1], '0x0000000000000000000000000000000000000000', web3.utils.toWei("1"), { from: accounts[2] });
            assert(false, 'cannot send to 0 address');
        } catch (ex) {
            assertVMException(ex);
        }

        try {
            await token.transferFromZero(accounts[3], web3.utils.toWei("1"), { from: accounts[2] });
            assert(false, 'cannot send from 0 address');
        } catch (ex) {
            assertVMException(ex);
        }
    });

    it("approve", async () => {
        const token = await HATToken.new(accounts[0],utils.TIME_LOCK_DELAY);
        await utils.setMinter(token,accounts[0],web3.utils.toWei("1000"));
        await token.mint(accounts[1], web3.utils.toWei("100"));
        let value = web3.utils.toWei("10");

        await token.approve(accounts[2], value, { from: accounts[1] });

        assert.equal((await token.allowance(accounts[1], accounts[2])).toString(), value.toString());

        let recipientBalance = (await token.balanceOf(accounts[3])).toString();
        assert.equal(recipientBalance, '0');

        await token.transferFrom(accounts[1], accounts[3], web3.utils.toWei("5"), { from: accounts[2] });

        recipientBalance = (await token.balanceOf(accounts[3])).toString();
        assert.equal(recipientBalance, web3.utils.toWei("5"));

        try {
            await token.transferFrom(accounts[1], accounts[3], web3.utils.toWei("6"), { from: accounts[2] });
            assert(false, 'cannot send above amount allowed');
        } catch (ex) {
            assertVMException(ex);
        }

        recipientBalance = (await token.balanceOf(accounts[3])).toString();
        assert.equal(recipientBalance, web3.utils.toWei("5"));

        await token.transferFrom(accounts[1], accounts[3], web3.utils.toWei("5"), { from: accounts[2] });
        recipientBalance = (await token.balanceOf(accounts[3])).toString();
        assert.equal(recipientBalance, web3.utils.toWei("10"));
    });

    it("approve max", async () => {
        const token = await HATToken.new(accounts[0],utils.TIME_LOCK_DELAY);
        await utils.setMinter(token,accounts[0],web3.utils.toWei("1000"));
        await token.mint(accounts[1], web3.utils.toWei("100"));
        let value = web3.utils.toBN(2).pow(web3.utils.toBN(256)).sub(web3.utils.toBN(1));

        try {
            await token.approve(accounts[2], value.sub(web3.utils.toBN(1)), { from: accounts[1] });
            assert(false, 'cannot allow amount larger than 96 bits');
        } catch (ex) {
            assertVMException(ex);
        }

        await token.approve(accounts[2], value, { from: accounts[1] });

        assert.equal((await token.allowance(accounts[1], accounts[2])).toString(), web3.utils.toBN(2).pow(web3.utils.toBN(96)).sub(web3.utils.toBN(1)).toString());
        await token.transferFrom(accounts[1], accounts[3], web3.utils.toWei("5"), { from: accounts[2] });
        recipientBalance = (await token.balanceOf(accounts[3])).toString();
        assert.equal(recipientBalance, web3.utils.toWei("5"));

        try {
            await token.increaseAllowance(accounts[2], web3.utils.toBN(1), { from: accounts[1] });
            assert(false, 'cannot allow amount larger than 96 bits');
        } catch (ex) {
            assertVMException(ex);
        }
    });

    it("test safe 32", async () => {
        const token = await HATToken.new(accounts[0],utils.TIME_LOCK_DELAY);
        await utils.setMinter(token,accounts[0],web3.utils.toWei("1000"));
        await token.mint(accounts[1], web3.utils.toWei("100"));
        let value = web3.utils.toBN(2).pow(web3.utils.toBN(32));

        try {
            await token.testSafe32(value);
            assert(false, 'cannot allow amount larger than 96 bits');
        } catch (ex) {
            assertVMException(ex);
        }

        value = value.sub(web3.utils.toBN(1));

        let safe32 = await token.testSafe32(value);
        assert.equal(safe32.toString(), value.toString());
    });

    const Permit = [
        { name: 'owner', type: 'address' },
        { name: 'spender', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
    ];

    const buildDataPermit = (chainId, verifyingContract, owner, spender, value, nonce, deadline) => ({
        primaryType: 'Permit',
        types: { EIP712Domain, Permit },
        domain: { name: "hats.finance", chainId, verifyingContract },
        message: { owner, spender, value, nonce, deadline },
    });

    it("permit", async () => {

        const wallet = Wallet.generate();
        const owner = wallet.getAddressString();
        const token = await HATToken.new(accounts[0],utils.TIME_LOCK_DELAY);
        await utils.setMinter(token,accounts[0],web3.utils.toWei("1000"));
        await token.mint(owner, web3.utils.toWei("100"));



        let currentBlockTimestamp = (await web3.eth.getBlock("latest")).timestamp;
        let chainId = await web3.eth.net.getId();
        let value = web3.utils.toWei("10");
        let nonce = 0;
        let deadline = currentBlockTimestamp + (7*24*3600);



        const data = buildDataPermit(
            chainId,
            token.address,
            owner,
            accounts[2],
            value,
            nonce,
            deadline,
        );
        const signature = ethSigUtil.signTypedMessage(wallet.getPrivateKey(), { data });
        const { v, r, s } = fromRpcSig(signature);
        await token.permit(owner, accounts[2], value, deadline, v, r, s);

        assert.equal((await token.nonces(owner)).toString(), '1');
        assert.equal((await token.allowance(owner, accounts[2])).toString(), value.toString());

        let recipientBalance = (await token.balanceOf(accounts[3])).toString();
        assert.equal(recipientBalance, '0');

        await token.transferFrom(owner, accounts[3], web3.utils.toWei("5"), { from: accounts[2] });

        recipientBalance = (await token.balanceOf(accounts[3])).toString();
        assert.equal(recipientBalance, web3.utils.toWei("5"));

        try {
            await token.transferFrom(owner, accounts[3], web3.utils.toWei("6"), { from: accounts[2] });
            assert(false, 'cannot send above amount allowed');
        } catch (ex) {
            assertVMException(ex);
        }

        recipientBalance = (await token.balanceOf(accounts[3])).toString();
        assert.equal(recipientBalance, web3.utils.toWei("5"));

        await token.transferFrom(owner, accounts[3], web3.utils.toWei("5"), { from: accounts[2] });
        recipientBalance = (await token.balanceOf(accounts[3])).toString();
        assert.equal(recipientBalance, web3.utils.toWei("10"));
    });

    it("permit max", async () => {

        const wallet = Wallet.generate();
        const owner = wallet.getAddressString();
        const token = await HATToken.new(accounts[0],utils.TIME_LOCK_DELAY);
        await utils.setMinter(token,accounts[0],web3.utils.toWei("1000"));
        await token.mint(owner, web3.utils.toWei("100"));

        let currentBlockTimestamp = (await web3.eth.getBlock("latest")).timestamp;
        let chainId = await web3.eth.net.getId();
        let value = web3.utils.toBN(2).pow(web3.utils.toBN(256)).sub(web3.utils.toBN(1));
        let nonce = 0;
        let deadline = currentBlockTimestamp + (7*24*3600);
        // Permit all
        const data = buildDataPermit(
            chainId,
            token.address,
            owner,
            accounts[2],
            value,
            nonce,
            deadline,
        );
        const signature = ethSigUtil.signTypedMessage(wallet.getPrivateKey(), { data });
        const { v, r, s } = fromRpcSig(signature);
        await token.permit(owner, accounts[2], value, deadline, v, r, s);

        assert.equal((await token.nonces(owner)).toString(), '1');
        assert.equal((await token.allowance(owner, accounts[2])).toString(), web3.utils.toBN(2).pow(web3.utils.toBN(96)).sub(web3.utils.toBN(1)).toString());
    });

    it("can't replay permit", async () => {
        const wallet = Wallet.generate();
        const owner = wallet.getAddressString();
        const token = await HATToken.new(accounts[0],utils.TIME_LOCK_DELAY);
        await utils.setMinter(token,accounts[0],web3.utils.toWei("1000"));
        await token.mint(owner, web3.utils.toWei("100"));

        let currentBlockTimestamp = (await web3.eth.getBlock("latest")).timestamp;
        let chainId = await web3.eth.net.getId();
        let value = web3.utils.toWei("10");
        let nonce = 0;
        let deadline = currentBlockTimestamp + (7*24*3600);

        const data = buildDataPermit(
            chainId,
            token.address,
            owner,
            accounts[2],
            value,
            nonce,
            deadline,
        );
        const signature = ethSigUtil.signTypedMessage(wallet.getPrivateKey(), { data });
        const { v, r, s } = fromRpcSig(signature);
        await token.permit(owner, accounts[2], value, deadline, v, r, s);

        assert.equal((await token.nonces(owner)).toString(), '1');
        assert.equal((await token.allowance(owner, accounts[2])).toString(), value.toString());

        try {
            await token.permit(owner, accounts[2], value, deadline, v, r, s);
            assert(false, 'cannot replay signed permit message');
        } catch (ex) {
            assertVMException(ex);
        }
    });

    it("can't use signed permit after deadline", async () => {
        const wallet = Wallet.generate();
        const owner = wallet.getAddressString();
        const token = await HATToken.new(accounts[0],utils.TIME_LOCK_DELAY);
        await utils.setMinter(token,accounts[0],web3.utils.toWei("1000"));
        await token.mint(owner, web3.utils.toWei("100"));

        let currentBlockTimestamp = (await web3.eth.getBlock("latest")).timestamp;
        let chainId = await web3.eth.net.getId();
        let value = web3.utils.toWei("10");
        let nonce = 0;
        let deadline = currentBlockTimestamp + (7*24*3600);

        const data = buildDataPermit(
            chainId,
            token.address,
            owner,
            accounts[2],
            value,
            nonce,
            deadline,
        );
        const signature = ethSigUtil.signTypedMessage(wallet.getPrivateKey(), { data });
        const { v, r, s } = fromRpcSig(signature);

        await utils.increaseTime(7*24*3600);

        try {
            await token.permit(owner, accounts[2], value, deadline, v, r, s);
            assert(false, 'cannot replay signed permit message');
        } catch (ex) {
            assertVMException(ex);
        }

        assert.equal((await token.nonces(owner)).toString(), '0');
        assert.equal((await token.allowance(owner, accounts[2])).toString(), '0');
    });

    const Delegation = [
        { name: 'delegatee', type: 'address' },
        { name: 'nonce', type: 'uint256' },
        { name: 'expiry', type: 'uint256' },
    ];

    const buildDataDelegation = (chainId, verifyingContract, delegatee, nonce, expiry) => ({
        primaryType: 'Delegation',
        types: { EIP712Domain, Delegation },
        domain: { name: "hats.finance", chainId, verifyingContract },
        message: { delegatee, nonce, expiry },
    });

    it("delegateBySig", async () => {
        const wallet = Wallet.generate();
        const owner = wallet.getAddressString();
        const token = await HATToken.new(accounts[0],utils.TIME_LOCK_DELAY);
        await utils.setMinter(token,accounts[0],web3.utils.toWei("1000"));
        await token.mint(owner, web3.utils.toWei("100"));

        let currentBlockTimestamp = (await web3.eth.getBlock("latest")).timestamp;
        let chainId = await web3.eth.net.getId();
        let nonce = 0;
        let expiry = currentBlockTimestamp + (7*24*3600);

        const data = buildDataDelegation(
            chainId,
            token.address,
            accounts[2],
            nonce,
            expiry,
        );
        const signature = ethSigUtil.signTypedMessage(wallet.getPrivateKey(), { data });
        const { v, r, s } = fromRpcSig(signature);

        // try {
        //     await token.delegateBySig(accounts[3], nonce, expiry, v, r, s);
        //     assert(false, 'cant delegate with wrong signature');
        // } catch (ex) {
        //     assertVMException(ex);
        // }
        await token.delegateBySig(accounts[2], nonce, expiry, v, r, s);

        assert.equal((await token.nonces(owner)).toString(), '1');
        assert.equal(await token.delegates(owner), accounts[2]);
    });

    it("can't replay delegateBySig", async () => {
        const wallet = Wallet.generate();
        const owner = wallet.getAddressString();
        const token = await HATToken.new(accounts[0],utils.TIME_LOCK_DELAY);
        await utils.setMinter(token,accounts[0],web3.utils.toWei("1000"));
        await token.mint(owner, web3.utils.toWei("100"));

        let currentBlockTimestamp = (await web3.eth.getBlock("latest")).timestamp;
        let chainId = await web3.eth.net.getId();
        let nonce = 0;
        let expiry = currentBlockTimestamp + (7*24*3600);

        const data = buildDataDelegation(
            chainId,
            token.address,
            accounts[2],
            nonce,
            expiry,
        );
        const signature = ethSigUtil.signTypedMessage(wallet.getPrivateKey(), { data });
        const { v, r, s } = fromRpcSig(signature);
        await token.delegateBySig(accounts[2], nonce, expiry, v, r, s);

        assert.equal((await token.nonces(owner)).toString(), '1');
        assert.equal(await token.delegates(owner), accounts[2]);
        try {
            await token.delegateBySig(accounts[2], nonce, expiry, v, r, s);
            assert(false, 'cannot replay signed delegation message');
        } catch (ex) {
            assertVMException(ex);
        }
    });

    it("can't use signed delegation after expiry", async () => {
        const wallet = Wallet.generate();
        const owner = wallet.getAddressString();
        const token = await HATToken.new(accounts[0],utils.TIME_LOCK_DELAY);
        await utils.setMinter(token,accounts[0],web3.utils.toWei("1000"));
        await token.mint(owner, web3.utils.toWei("100"));

        let currentBlockTimestamp = (await web3.eth.getBlock("latest")).timestamp;
        let chainId = await web3.eth.net.getId();
        let nonce = 0;
        let expiry = currentBlockTimestamp + (7*24*3600);

        const data = buildDataDelegation(
            chainId,
            token.address,
            accounts[2],
            nonce,
            expiry,
        );
        const signature = ethSigUtil.signTypedMessage(wallet.getPrivateKey(), { data });
        const { v, r, s } = fromRpcSig(signature);
        await utils.increaseTime(7*24*3600);
        try {
            await token.delegateBySig(accounts[2], nonce, expiry, v, r, s);
            assert(false, 'cannot replay signed permit message');
        } catch (ex) {
            assertVMException(ex);
        }

        assert.equal((await token.nonces(owner)).toString(), '0');
        assert.equal(await token.delegates(owner), '0x0000000000000000000000000000000000000000');
    });
});
