const ERC20Mock = artifacts.require("./ERC20Mock.sol");
const TokenLockFactory = artifacts.require("./TokenLockFactory.sol");
const HATTokenLock = artifacts.require("./HATTokenLock.sol");
const CloneFactoryMock = artifacts.require("./CloneFactoryMock.sol");
const utils = require("./utils.js");
const { assertVMException } = require("./common.js");

var stakingToken;
var tokenLockFactory;
var tokenLock;
var tokenLockParent;

const setup = async function(
  accounts,
  revocable = true,
  delegate = false,
  startsIn = 0,
  endTime = 1000,
  periods = 5,
  vestingCliffTime = 0,
  releaseStartTime = 0
) {
  stakingToken = await ERC20Mock.new("Staking", "STK");

  tokenLockParent = await HATTokenLock.new();
  tokenLockFactory = await TokenLockFactory.new(tokenLockParent.address, accounts[0]);
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

contract("TokenLock", (accounts) => {
  it("initialize values", async () => {
    await setup(accounts);
    const cloneFactory = await CloneFactoryMock.new();
    let newTokenLock = await HATTokenLock.at(
      (await cloneFactory.clone(tokenLockParent.address)).logs[0].args._clone
    );

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
      assertVMException(ex, "BeneficiaryCannotBeZero");
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
      assertVMException(ex, "TokenCannotBeZero");
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
      assertVMException(ex, "ManagedAmountCannotBeZero");
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
      assertVMException(ex, "StartTimeCannotBeZero");
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
      assertVMException(ex, "StartTimeMustBeBeforeEndTime");
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
      assertVMException(ex, "PeriodsCannotBeBelowMinimum");
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
      assertVMException(ex, "ReleaseStartTimeMustBeBeforeEndTime");
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
      assertVMException(ex, "CliffTimeMustBeBeforeEndTime");
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

  it("cannot initialize master copy", async () => {
    await setup(accounts);

    assert.equal(
      (await tokenLockParent.endTime()).toString(),
      "115792089237316195423570985008687907853269984665640564039457584007913129639935"
    );
    try {
      await tokenLockParent.initialize(
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
      assertVMException(ex, "AlreadyInitialized");
    }
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
      assertVMException(ex, "AlreadyInitialized");
    }
  });

  it("revoke", async () => {
    await setup(accounts);
    try {
      await tokenLock.revoke({ from: accounts[1] });
      assert(false, "only owner can call revoke");
    } catch (ex) {
      assertVMException(ex, "Ownable: caller is not the owner");
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
      assertVMException(ex, "NoAvailableUnvestedAmount");
    }
  });

  it("cannot revoke twice", async () => {
    await setup(accounts);
    await utils.increaseTime(300);
    await tokenLock.revoke();
    try {
      await tokenLock.revoke();
      assert(false, "cannot revoke after lock was already revoked");
    } catch (ex) {
      assertVMException(ex, "LockIsAlreadyRevoked");
    }
  });

  it("sinceStartTime", async () => {
    await setup(accounts, true, false, 100);
    assert.equal(await tokenLock.sinceStartTime(), 0);
    assert.equal(await tokenLock.availableAmount(), 0);
    //each period is 250 seconds
    await utils.increaseTime(350);
    assert.equal((await tokenLock.sinceStartTime()).toString().match("252|253").length, 1);
    assert.equal(await tokenLock.availableAmount(), web3.utils.toWei("0.2"));
  });

  it("redeem and withdraw surplus after revoke", async () => {
    await setup(accounts);
    await stakingToken.mint(tokenLock.address, web3.utils.toWei("1"));
    await utils.increaseTime(300);
    await tokenLock.revoke();
    assert.equal(await stakingToken.balanceOf(accounts[0]), web3.utils.toWei("0.8"));
    assert.equal(await stakingToken.balanceOf(tokenLock.address), web3.utils.toWei("1.2"));
    await tokenLock.release({ from: accounts[1] });
    assert.equal(await stakingToken.balanceOf(accounts[1]), web3.utils.toWei("0.2"));
    assert.equal(await stakingToken.balanceOf(tokenLock.address), web3.utils.toWei("1"));
    await tokenLock.withdrawSurplus(web3.utils.toWei("1"), { from: accounts[1] });
    assert.equal(await stakingToken.balanceOf(accounts[1]), web3.utils.toWei("1.2"));
    assert.equal(await stakingToken.balanceOf(tokenLock.address), web3.utils.toWei("0"));
    expect(await ethers.provider.getCode(tokenLock.address)).to.equal("0x");
  });

  it("cannot revoke after renaunceOwnership revoke", async () => {
    await setup(accounts);
    await tokenLock.renounceOwnership();
    try {
      await tokenLock.revoke();
      assert(false, "only owner can call revoke");
    } catch (ex) {
      assertVMException(ex, "Ownable: caller is not the owner");
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
      assertVMException(ex, "Ownable: new owner is the zero address");
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
      assertVMException(ex, "Ownable: caller is not the owner");
    }
    var tx = await tokenLock.revoke({ from: accounts[2] });
    assert.equal(tx.logs[0].event, "TokensRevoked");
    assert.equal(tx.logs[0].args.beneficiary, accounts[1]);
    assert.equal(tx.logs[0].args.amount.toString(), web3.utils.toWei("1"));
    expect(await ethers.provider.getCode(tokenLock.address)).to.equal("0x");
  });

  it("cancel lock", async () => {
    await setup(accounts);
    try {
      await tokenLock.cancelLock({ from: accounts[2] });
      assert(false, "only owner can call cancelLock");
    } catch (ex) {
      assertVMException(ex, "Ownable: caller is not the owner");
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
      assertVMException(ex, "OnlyBeneficiary");
    }
    await tokenLock.acceptLock({ from: accounts[1] });
    try {
      await tokenLock.cancelLock();
      assert(false, "cannot cancel lock after accept by beneficiary");
    } catch (ex) {
      assertVMException(ex, "CannotCancelAfterLockIsAccepted");
    }
  });

  it("changeBeneficiary", async () => {
    await setup(accounts);
    try {
      await tokenLock.changeBeneficiary(accounts[3]);
      assert(false, "only beneficiary");
    } catch (ex) {
      assertVMException(ex, "OnlyBeneficiary");
    }
    try {
      await tokenLock.changeBeneficiary(utils.NULL_ADDRESS, {
        from: accounts[1],
      });
      assert(false, "cannot be zero address");
    } catch (ex) {
      assertVMException(ex, "BeneficiaryCannotBeZero");
    }
    await tokenLock.changeBeneficiary(accounts[3], { from: accounts[1] });
    assert.equal(await tokenLock.beneficiary(), accounts[3]);
  });

  it("none revocable", async () => {
    await setup(accounts, false);
    assert.equal(await tokenLock.vestedAmount(), web3.utils.toWei("1"));
    try {
      await tokenLock.revoke();
      assert(false, "none revocable");
    } catch (ex) {
      assertVMException(ex, "LockIsNonRevocable");
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
    await setup(accounts, false);
    assert.equal(await tokenLock.canDelegate(), false);
    try {
      await tokenLock.delegate(accounts[2], { from: accounts[1] });
      assert(false, "cannot delegate");
    } catch (ex) {
      assertVMException(ex, "DelegateDisabled");
    }
  });

  it("delegate", async () => {
    await setup(accounts, false, true);
    assert.equal(await tokenLock.canDelegate(), true);
    try {
      await tokenLock.delegate(accounts[2]);
      assert(false, "only beneficiary");
    } catch (ex) {
      assertVMException(ex, "OnlyBeneficiary");
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
      assertVMException(ex, "MasterCopyCannotBeZero");
    }

    try {
      await tokenLockFactory.setMasterCopy(accounts[1], { from: accounts[1] });
      assert(false, "only owner");
    } catch (ex) {
      assertVMException(ex, "Ownable: caller is not the owner");
    }

    await tokenLockFactory.setMasterCopy(accounts[1]);
  });

  it("test before release start time", async () => {
    let currentTimeStamp = (await web3.eth.getBlock("latest")).timestamp;
    await setup(accounts, true, false, 0, 1000, 1, 0, currentTimeStamp + 999);
    assert.equal(await tokenLock.releasableAmount(), 0);
    await setup(accounts, true, false, 0, 1000, 1, currentTimeStamp + 999, 0);
    assert.equal(await tokenLock.releasableAmount(), 0);
    await utils.increaseTime(1000);
    assert.equal(await tokenLock.releasableAmount(), web3.utils.toWei("1"));
  });

  it("test single period for 1000 seconds", async () => {
    await setup(accounts, true, false, 0, 1000, 1);
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
    expect(await ethers.provider.getCode(tokenLock.address)).to.equal("0x");
  });

  it("withdraw surplus", async () => {
    await setup(accounts);
    assert.equal(
      await tokenLock.surplusAmount(),
      web3.utils.toWei("0")
    );
    await stakingToken.mint(tokenLock.address, web3.utils.toWei("100"));
    await utils.increaseTime(1000);
    await tokenLock.release({ from: accounts[1] });
    try {
      await tokenLock.withdrawSurplus(1);
      assert(false, "only beneficiary");
    } catch (ex) {
      assertVMException(ex, "OnlyBeneficiary");
    }
    try {
      await tokenLock.withdrawSurplus(0, { from: accounts[1] });
      assert(false, "amount must be greater than 0");
    } catch (ex) {
      assertVMException(ex, "AmountCannotBeZero");
    }
    try {
      await tokenLock.withdrawSurplus(web3.utils.toWei("101"), {
        from: accounts[1],
      });
      assert(false, "amount must be lower than or equal to available surplus");
    } catch (ex) {
      assertVMException(ex, "AmountRequestedBiggerThanSurplus");
    }
    assert.equal(await stakingToken.balanceOf(accounts[1]), web3.utils.toWei("1"));
    await tokenLock.withdrawSurplus(web3.utils.toWei("100"), {
      from: accounts[1],
    });
    assert.equal(
      await stakingToken.balanceOf(accounts[1]),
      web3.utils.toWei("101")
    );
    expect(await ethers.provider.getCode(tokenLock.address)).to.equal("0x");
  });

  it("sweep tokens", async () => {
    await setup(accounts);
    try {
      await tokenLock.sweepToken(stakingToken.address);
      assert(false, "cannot sweep vested token");
    } catch (ex) {
      assertVMException(ex, "CannotSweepVestedToken");
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
      assertVMException(ex, "OnlySweeper");
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
      assertVMException(ex, "OnlySweeper");
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
