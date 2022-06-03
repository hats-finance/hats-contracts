const { setup, assertVMException } = require("./hatvaults.js");

contract("HatVaults", (accounts) => {
  it("Set arbitrator", async () => {
    const { hatVaults } = await setup(accounts);
    try {
      await hatVaults.setArbitrator(accounts[1], {
        from: accounts[1],
      });
      assert(false, "only gov");
    } catch (ex) {
      assertVMException(ex, "Ownable: caller is not the owner");
    }

    tx = await hatVaults.setArbitrator(accounts[1]);

    assert.equal(await hatVaults.arbitrator(), accounts[1]);
    assert.equal(tx.logs[0].event, "SetArbitrator");
    assert.equal(tx.logs[0].args._arbitrator, accounts[1]);
  });
  // TODO:
  // - now in setup, challengePeriod is set to 0, so we are not really testing the arbitrator logic like that
  // - test setChallengPeriod
  // - test the whole arbitrator logic
});
