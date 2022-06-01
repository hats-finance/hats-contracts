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

const { setup } = require("./hatvaults.js");

contract("HatVaults", (accounts) => {
  it("Arbitrator logic", async () => {
    await setup(accounts);
  });
});
