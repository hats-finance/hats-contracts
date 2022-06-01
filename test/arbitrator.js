const HATVaults = artifacts.require("./HATVaults.sol");
const HATVaultsV2Mock = artifacts.require("./HATVaultsV2Mock.sol");
const HATTokenMock = artifacts.require("./HATTokenMock.sol");
const ERC20Mock = artifacts.require("./ERC20Mock.sol");
const UniSwapV3RouterMock = artifacts.require("./UniSwapV3RouterMock.sol");
const TokenLockFactory = artifacts.require("./TokenLockFactory.sol");
const HATTokenLock = artifacts.require("./HATTokenLock.sol");
const PoolsManagerMock = artifacts.require("./PoolsManagerMock.sol");
const RewardController = artifacts.require("./RewardController.sol");
const utils = require("./utils.js");
const ISwapRouter = new ethers.utils.Interface(UniSwapV3RouterMock.abi);

const { deployHatVaults } = require("../scripts/hatvaultsdeploy.js");
const { upgradeHatVaults } = require("../scripts/hatvaultsupgrade.js");

const { setup, assertVMException } = require("./hatvaults.js");

contract("HatVaults", (accounts) => {
  it.only("Set arbitrator", async () => {
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
});
