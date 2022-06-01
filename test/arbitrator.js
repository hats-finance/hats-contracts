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

var hatVaults;
var rewardController;
var hatToken;
var router;
var stakingToken;
var tokenLockFactory;
let safeWithdrawBlocksIncrement = 3;
let hatVaultsExpectedHatsBalance;
let rewardPerEpoch = [
  web3.utils.toWei("44130"),
  web3.utils.toWei("44130"),
  web3.utils.toWei("88250"),
  web3.utils.toWei("77880"),
  web3.utils.toWei("68730"),
  web3.utils.toWei("60650"),
  web3.utils.toWei("53530"),
  web3.utils.toWei("47240"),
  web3.utils.toWei("41690"),
  web3.utils.toWei("36790"),
  web3.utils.toWei("32470"),
  web3.utils.toWei("28650"),
  web3.utils.toWei("25280"),
  web3.utils.toWei("22310"),
  web3.utils.toWei("19690"),
  web3.utils.toWei("17380"),
  web3.utils.toWei("15340"),
  web3.utils.toWei("13530"),
  web3.utils.toWei("11940"),
  web3.utils.toWei("10540"),
  web3.utils.toWei("9300"),
  web3.utils.toWei("8210"),
  web3.utils.toWei("7240"),
  web3.utils.toWei("6390"),
];

import setup from "./hatvaults.js";

contract("HatVaults", (accounts) => {
  it("Arbitrator logic", async () => {
    await setup(accounts);
  });
});
