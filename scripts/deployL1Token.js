const { ethers } = require('hardhat');
const { providers, Wallet } = require('ethers');
const { getL2Network } = require('@arbitrum/sdk');
require('dotenv').config();

const walletPrivateKey = process.env.PRIVATE_KEY;
const l1Provider = new providers.JsonRpcProvider(`https://mainnet.infura.io/v3/${process.env.INFURA_KEY}`);
const l2Provider = new providers.JsonRpcProvider(`https://arbitrum-mainnet.infura.io/v3/${process.env.INFURA_KEY}`);
const l1Wallet = new Wallet(walletPrivateKey, l1Provider);

/**
 * For the purpose of our tests, here we deploy an standard ERC20 token (L1Token) to L1
 * It sends its deployer (us) the initial supply of 1000
 */
const main = async () => {
  /**
   * Use l2Network to get the token bridge addresses needed to deploy the token
   */
  const l2Network = await getL2Network(l2Provider);

  const l1Gateway = l2Network.tokenBridge.l1CustomGateway;
  const l1Router = l2Network.tokenBridge.l1GatewayRouter;

  /**
   * Deploy our custom token smart contract to L1
   * We give the custom token contract the address of l1CustomGateway and l1GatewayRouter as well as the initial supply (premine)
   */
  console.log('Deploying the test L1Token to L1:');
  const L1Token = await (await ethers.getContractFactory('HATTokenArbitrumBridgeL1')).connect(l1Wallet);
  const l1Token = await L1Token.deploy(l1Gateway, l1Router, l1Wallet.address);

  await l1Token.deployed();
  console.log(`L1Token is deployed to L1 at ${l1Token.address}`);

  /**
   * Get the deployer token balance
   */
  const tokenBalance = await l1Token.balanceOf(l1Wallet.address);
  console.log(`Initial token balance of deployer: ${tokenBalance}`);
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
