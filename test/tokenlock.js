const ERC20Mock = artifacts.require("./ERC20Mock.sol");
const TokenLockFactory = artifacts.require("./TokenLockFactory.sol");
const HATTokenLock = artifacts.require("./HATTokenLock.sol");
const utils = require("./utils.js");

var stakingToken;
var tokenLockFactory;
var tokenLock;
var tokenLockParent;

const setup = async function(
  accounts,
  revocable = 1,
  delegate = false,
  startsIn = 0,
  endTime = 1000,
  periods = 5,
  vestingCliffTime = 0,
  releaseStartTime = 0
) {
  stakingToken = await ERC20Mock.new("Staking", "STK");

  tokenLockParent = await HATTokenLock.new();
  tokenLockFactory = await TokenLockFactory.new(tokenLockParent.address);
  let currentBlockTimestamp = (await web3.eth.getBlock("latest")).timestamp;

  let tx = await tokenLockFactory.createTokenLock(
    stakingToken.address,
    accounts[0],
    accounts[1],
    web3.utils.toWei("1"),
    currentBlockTimestamp + startsIn,
    currentBlockTimestamp + startsIn + endTime,
    periods,
    releaseStartTime,
    vestingCliffTime,
    revocable,
    delegate
  );

  assert.equal(tx.logs[1].event, "TokenLockCreated");
  let tokenLockAddress = tx.logs[1].args.contractAddress;
  tokenLock = await HATTokenLock.at(tokenLockAddress);
  await stakingToken.mint(tokenLockAddress, web3.utils.toWei("1"));
};

function assertVMException(error) {
  let condition =
    error.message.search("VM Exception") > -1 ||
    error.message.search("Transaction reverted") > -1;
  assert.isTrue(
    condition,
    "Expected a VM Exception, got this instead:" + error.message
  );
}

contract("TokenLock", (accounts) => {
  it("initialize values", async () => {
    await setup(accounts);
    let newTokenLock = await HATTokenLock.new();

    try {
      await newTokenLock.initialize(
        await tokenLock.owner(),
        "0x0000000000000000000000000000000000000000",
        await tokenLock.token(),
        10,
        await tokenLock.startTime(),
        await tokenLock.endTime(),
        await tokenLock.periods(),
        await tokenLock.releaseStartTime(),
        await tokenLock.vestingCliffTime(),
        await tokenLock.revocable(),
        await tokenLock.canDelegate()
      );
      assert(false, "cannot initialize with 0 beneficiary");
    } catch (ex) {
      assertVMException(ex);
    }

    try {
      await newTokenLock.initialize(
        await tokenLock.owner(),
        await tokenLock.token(),
        "0x0000000000000000000000000000000000000000",
        10,
        await tokenLock.startTime(),
        await tokenLock.endTime(),
        await tokenLock.periods(),
        await tokenLock.releaseStartTime(),
        await tokenLock.vestingCliffTime(),
        await tokenLock.revocable(),
        await tokenLock.canDelegate()
      );
      assert(false, "cannot initialize with 0 token");
    } catch (ex) {
      assertVMException(ex);
    }

    try {
      await newTokenLock.initialize(
        await tokenLock.owner(),
        await tokenLock.token(),
        await tokenLock.token(),
        0,
        await tokenLock.startTime(),
        await tokenLock.endTime(),
        await tokenLock.periods(),
        await tokenLock.releaseStartTime(),
        await tokenLock.vestingCliffTime(),
        await tokenLock.revocable(),
        await tokenLock.canDelegate()
      );
      assert(false, "cannot initialize with 0 managed amount");
    } catch (ex) {
      assertVMException(ex);
    }

    try {
      await newTokenLock.initialize(
        await tokenLock.owner(),
        await tokenLock.token(),
        await tokenLock.token(),
        10,
        0,
        await tokenLock.endTime(),
        await tokenLock.periods(),
        await tokenLock.releaseStartTime(),
        await tokenLock.vestingCliffTime(),
        await tokenLock.revocable(),
        await tokenLock.canDelegate()
      );
      assert(false, "cannot initialize with 0 start time");
    } catch (ex) {
      assertVMException(ex);
    }

    try {
      await newTokenLock.initialize(
        await tokenLock.owner(),
        await tokenLock.token(),
        await tokenLock.token(),
        10,
        await tokenLock.endTime(),
        await tokenLock.endTime(),
        await tokenLock.periods(),
        await tokenLock.releaseStartTime(),
        await tokenLock.vestingCliffTime(),
        await tokenLock.revocable(),
        await tokenLock.canDelegate()
      );
      assert(false, "cannot initialize with end time < start time");
    } catch (ex) {
      assertVMException(ex);
    }

    try {
      await newTokenLock.initialize(
        await tokenLock.owner(),
        await tokenLock.token(),
        await tokenLock.token(),
        10,
        await tokenLock.startTime(),
        await tokenLock.endTime(),
        0,
        await tokenLock.releaseStartTime(),
        await tokenLock.vestingCliffTime(),
        await tokenLock.revocable(),
        await tokenLock.canDelegate()
      );
      assert(false, "cannot initialize with less than minimum periods");
    } catch (ex) {
      assertVMException(ex);
    }

    try {
      await newTokenLock.initialize(
        await tokenLock.owner(),
        await tokenLock.token(),
        await tokenLock.token(),
        10,
        await tokenLock.startTime(),
        await tokenLock.endTime(),
        await tokenLock.periods(),
        await tokenLock.releaseStartTime(),
        await tokenLock.vestingCliffTime(),
        0,
        await tokenLock.canDelegate()
      );
      assert(false, "cannot initialize with revocability not set");
    } catch (ex) {
      assertVMException(ex);
    }

    try {
      await newTokenLock.initialize(
        await tokenLock.owner(),
        await tokenLock.token(),
        await tokenLock.token(),
        10,
        await tokenLock.startTime(),
        await tokenLock.endTime(),
        await tokenLock.periods(),
        await tokenLock.endTime(),
        await tokenLock.vestingCliffTime(),
        await tokenLock.revocable(),
        await tokenLock.canDelegate()
      );
      assert(false, "cannot initialize with release start time > end time");
    } catch (ex) {
      assertVMException(ex);
    }

    try {
      await newTokenLock.initialize(
        await tokenLock.owner(),
        await tokenLock.token(),
        await tokenLock.token(),
        10,
        await tokenLock.startTime(),
        await tokenLock.endTime(),
        await tokenLock.periods(),
        await tokenLock.releaseStartTime(),
        await tokenLock.endTime(),
        await tokenLock.revocable(),
        await tokenLock.canDelegate()
      );
      assert(false, "cannot initialize with vesting cliff time > end time");
    } catch (ex) {
      assertVMException(ex);
    }

    await newTokenLock.initialize(
      await tokenLock.owner(),
      await tokenLock.beneficiary(),
      await tokenLock.token(),
      10,
      await tokenLock.startTime(),
      await tokenLock.endTime(),
      await tokenLock.periods(),
      await tokenLock.releaseStartTime(),
      await tokenLock.vestingCliffTime(),
      await tokenLock.revocable(),
      await tokenLock.canDelegate()
    );
  });

  it("cannot initialize twice", async () => {
    await setup(accounts);
    try {
      await tokenLock.initialize(
        await tokenLock.owner(),
        await tokenLock.beneficiary(),
        await tokenLock.token(),
        10,
        await tokenLock.startTime(),
        await tokenLock.endTime(),
        await tokenLock.periods(),
        await tokenLock.releaseStartTime(),
        await tokenLock.vestingCliffTime(),
        await tokenLock.revocable(),
        await tokenLock.canDelegate()
      );
      assert(false, "cannot initialize twice");
    } catch (ex) {
      assertVMException(ex);
    }
  });

  it("revoke", async () => {
    await setup(accounts);
    try {
      await tokenLock.revoke({ from: accounts[1] });
      assert(false, "only owner can call revoke");
    } catch (ex) {
      assertVMException(ex);
    }
    var tx = await tokenLock.revoke();
    assert.equal(tx.logs[0].event, "TokensRevoked");
    assert.equal(tx.logs[0].args.beneficiary, accounts[1]);
    assert.equal(tx.logs[0].args.amount.toString(), web3.utils.toWei("1"));
  });

  it("cannot revoke after full amount is redeemable", async () => {
    await setup(accounts);
    await utils.increaseTime(1000);
    try {
      await tokenLock.revoke();
      assert(false, "cannot revoke after full amount is redeemable");
    } catch (ex) {
      assertVMException(ex);
    }
  });

  it("sinceStartTime", async () => {
    await setup(accounts, 1, false, 100);
    assert.equal(await tokenLock.sinceStartTime(), 0);
    assert.equal(await tokenLock.availableAmount(), 0);
    //each period is 250 seconds
    await utils.increaseTime(350);
    assert.equal((await tokenLock.sinceStartTime()).toString(), "252");
    assert.equal(await tokenLock.availableAmount(), web3.utils.toWei("0.2"));
  });

  it("cannot revoke after renaunceOwnership revoke", async () => {
    await setup(accounts);
    await tokenLock.renounceOwnership();
    try {
      await tokenLock.revoke();
      assert(false, "only owner can call revoke");
    } catch (ex) {
      assertVMException(ex);
    }
  });

  it("owner cannot be 0", async () => {
    await setup(accounts);
    try {
      await tokenLock.transferOwnership(
        "0x0000000000000000000000000000000000000000"
      );
      assert(false, "owner cannot be 0");
    } catch (ex) {
      assertVMException(ex);
    }
    await tokenLock.transferOwnership(accounts[2]);
  });

  it("cannot revoke after renaunceOwnership revoke", async () => {
    await setup(accounts);
    await tokenLock.transferOwnership(accounts[2]);
    try {
      await tokenLock.revoke();
      assert(false, "only owner can call revoke");
    } catch (ex) {
      assertVMException(ex);
    }
    var tx = await tokenLock.revoke({ from: accounts[2] });
    assert.equal(tx.logs[0].event, "TokensRevoked");
    assert.equal(tx.logs[0].args.beneficiary, accounts[1]);
    assert.equal(tx.logs[0].args.amount.toString(), web3.utils.toWei("1"));
    try {
      await tokenLock.revoke({ from: accounts[2] });
      assert(false, "cannot revoke twice");
    } catch (ex) {
      assertVMException(ex);
    }
  });

  it("cancel lock", async () => {
    await setup(accounts);
    try {
      await tokenLock.cancelLock({ from: accounts[2] });
      assert(false, "only owner can call cancelLock");
    } catch (ex) {
      assertVMException(ex);
    }
    var balanceBefore = await stakingToken.balanceOf(tokenLock.address);
    var tx = await tokenLock.cancelLock();
    assert.equal(tx.logs[0].event, "LockCanceled");
    assert.equal(await stakingToken.balanceOf(tokenLock.address), 0);
    assert.isTrue(
      (await stakingToken.balanceOf(accounts[0])).eq(balanceBefore)
    );
  });

  it("cannot cancel lock after acceptLock by beneficiary", async () => {
    await setup(accounts);
    try {
      await tokenLock.acceptLock();
      assert(false, "only beneficiary");
    } catch (ex) {
      assertVMException(ex);
    }
    await tokenLock.acceptLock({ from: accounts[1] });
    try {
      await tokenLock.cancelLock();
      assert(false, "cannot cancel lock after accept by beneficiary");
    } catch (ex) {
      assertVMException(ex);
    }
  });

  it("changeBeneficiary", async () => {
    await setup(accounts);
    try {
      await tokenLock.changeBeneficiary(accounts[3]);
      assert(false, "only beneficiary");
    } catch (ex) {
      assertVMException(ex);
    }
    try {
      await tokenLock.changeBeneficiary(utils.NULL_ADDRESS, {
        from: accounts[1],
      });
      assert(false, "cannot be zero address");
    } catch (ex) {
      assertVMException(ex);
    }
    await tokenLock.changeBeneficiary(accounts[3], { from: accounts[1] });
    assert.equal(await tokenLock.beneficiary(), accounts[3]);
  });

  it("none revocable", async () => {
    await setup(accounts, 2);
    assert.equal(await tokenLock.vestedAmount(), web3.utils.toWei("1"));
    try {
      await tokenLock.revoke();
      assert(false, "none revocable");
    } catch (ex) {
      assertVMException(ex);
    }
  });

  it("vested amount with cliff", async () => {
    let currentBlockTimestamp = (await web3.eth.getBlock("latest")).timestamp;
    let cliffTime = 7 * 24 * 3600;
    let endTime = cliffTime * 2;
    await setup(
      accounts,
      1,
      false,
      0,
      endTime,
      5,
      currentBlockTimestamp + cliffTime
    );
    assert.equal(
      await tokenLock.vestingCliffTime(),
      currentBlockTimestamp + cliffTime
    );
    assert.equal(await tokenLock.vestedAmount(), web3.utils.toWei("0"));
    await utils.increaseTime(cliffTime / 2);
    assert.equal(await tokenLock.vestedAmount(), web3.utils.toWei("0"));
    await utils.increaseTime(cliffTime + cliffTime / 2);
    assert.equal(await tokenLock.vestedAmount(), web3.utils.toWei("1"));
  });

  it("no delegate", async () => {
    await setup(accounts, 2);
    assert.equal(await tokenLock.canDelegate(), false);
    try {
      await tokenLock.delegate(accounts[2], { from: accounts[1] });
      assert(false, "cannot delegate");
    } catch (ex) {
      assertVMException(ex);
    }
  });
  it("delegate", async () => {
    await setup(accounts, 2, true);
    assert.equal(await tokenLock.canDelegate(), true);
    try {
      await tokenLock.delegate(accounts[2]);
      assert(false, "only beneficiary");
    } catch (ex) {
      assertVMException(ex);
    }
    await tokenLock.delegate(accounts[2], { from: accounts[1] });
    assert.equal(await stakingToken.delegates(tokenLock.address), accounts[2]);
  });

  it("setMasterCopy", async () => {
    await setup(accounts);

    try {
      await tokenLockFactory.setMasterCopy(utils.NULL_ADDRESS);
      assert(false, "address cannot be zero");
    } catch (ex) {
      assertVMException(ex);
    }
    await tokenLockFactory.setMasterCopy(accounts[1]);
  });

  it("test before release start time", async () => {
    let currentTimeStamp = (await web3.eth.getBlock("latest")).timestamp;
    await setup(accounts, 1, false, 0, 1000, 1, 0, currentTimeStamp + 999);
    assert.equal(await tokenLock.releasableAmount(), 0);
    await setup(accounts, 1, false, 0, 1000, 1, currentTimeStamp + 999, 0);
    assert.equal(await tokenLock.releasableAmount(), 0);
    await utils.increaseTime(1000);
    assert.equal(await tokenLock.releasableAmount(), web3.utils.toWei("1"));
  });

  it("test single period for 1000 seconds", async () => {
    await setup(accounts, 1, false, 0, 1000, 1);
    assert.equal(await tokenLock.releasableAmount(), 0);
    await utils.increaseTime(900);
    assert.equal(await tokenLock.releasableAmount(), 0);
    await utils.increaseTime(100);
    assert.equal(await tokenLock.releasableAmount(), web3.utils.toWei("1"));
    assert.equal(await stakingToken.balanceOf(accounts[1]), 0);
    await tokenLock.release({ from: accounts[1] });
    assert.equal(
      await stakingToken.balanceOf(accounts[1]),
      web3.utils.toWei("1")
    );
  });

  it("withdraw surplus", async () => {
    await setup(accounts);
    await stakingToken.mint(tokenLock.address, web3.utils.toWei("100"));
    try {
      await tokenLock.withdrawSurplus(1);
      assert(false, "only beneficiary");
    } catch (ex) {
      assertVMException(ex);
    }
    try {
      await tokenLock.withdrawSurplus(0, { from: accounts[1] });
      assert(false, "amount must be greater than 0");
    } catch (ex) {
      assertVMException(ex);
    }
    try {
      await tokenLock.withdrawSurplus(web3.utils.toWei("101"), {
        from: accounts[1],
      });
      assert(false, "amount must be lower than or equal to available surplus");
    } catch (ex) {
      assertVMException(ex);
    }
    assert.equal(await stakingToken.balanceOf(accounts[1]), 0);
    await tokenLock.withdrawSurplus(web3.utils.toWei("100"), {
      from: accounts[1],
    });
    assert.equal(
      await stakingToken.balanceOf(accounts[1]),
      web3.utils.toWei("100")
    );
  });

  it("sweep tokens", async () => {
    await setup(accounts);
    try {
      await tokenLock.sweepToken(stakingToken.address);
      assert(false, "cannot sweep vested token");
    } catch (ex) {
      assertVMException(ex);
    }
    accidentToken = await ERC20Mock.new("Accident", "ACT");
    await accidentToken.mint(tokenLock.address, web3.utils.toWei("1"));

    assert.equal(
      await accidentToken.balanceOf(tokenLock.address),
      web3.utils.toWei("1")
    );
    assert.equal(await accidentToken.balanceOf(accounts[0]), 0);
    assert.equal(await accidentToken.balanceOf(accounts[1]), 0);
    try {
      await tokenLock.sweepToken(accidentToken.address, { from: accounts[1] });
      assert(false, "only owner can sweep tokens (if exists)");
    } catch (ex) {
      assertVMException(ex);
    }
    await tokenLock.sweepToken(accidentToken.address);
    assert.equal(await accidentToken.balanceOf(tokenLock.address), 0);
    assert.equal(
      await accidentToken.balanceOf(accounts[0]),
      web3.utils.toWei("1")
    );
    assert.equal(await accidentToken.balanceOf(accounts[1]), 0);

    await accidentToken.mint(tokenLock.address, web3.utils.toWei("1"));

    assert.equal(
      await accidentToken.balanceOf(tokenLock.address),
      web3.utils.toWei("1")
    );
    assert.equal(
      await accidentToken.balanceOf(accounts[0]),
      web3.utils.toWei("1")
    );
    assert.equal(await accidentToken.balanceOf(accounts[1]), 0);

    await tokenLock.renounceOwnership();

    try {
      await tokenLock.sweepToken(accidentToken.address, { from: accounts[0] });
      assert(
        false,
        "only beneficiary can sweep tokens when owner does not exist"
      );
    } catch (ex) {
      assertVMException(ex);
    }
    await tokenLock.sweepToken(accidentToken.address, { from: accounts[1] });

    assert.equal(await accidentToken.balanceOf(tokenLock.address), 0);
    assert.equal(
      await accidentToken.balanceOf(accounts[0]),
      web3.utils.toWei("1")
    );
    assert.equal(
      await accidentToken.balanceOf(accounts[1]),
      web3.utils.toWei("1")
    );

    // Sweep with 0 balance does nothing
    await tokenLock.sweepToken(accidentToken.address, { from: accounts[1] });

    assert.equal(await accidentToken.balanceOf(tokenLock.address), 0);
    assert.equal(
      await accidentToken.balanceOf(accounts[0]),
      web3.utils.toWei("1")
    );
    assert.equal(
      await accidentToken.balanceOf(accounts[1]),
      web3.utils.toWei("1")
    );
  });
});
