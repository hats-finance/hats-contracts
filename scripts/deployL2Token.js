const { ethers } = require('hardhat');
const { providers, Wallet } = require('ethers');
const { getL2Network } = require('@arbitrum/sdk');
require('dotenv').config();

const walletPrivateKey = process.env.PRIVATE_KEY;
const l2Provider = new providers.JsonRpcProvider(`https://arbitrum-mainnet.infura.io/v3/${process.env.INFURA_KEY}`);
const l2Wallet = new Wallet(walletPrivateKey, l2Provider);

const l1TokenAddress = '0x76c4ec0068923Da13Ee11527d6cF9b7521000049';

/**
 * For the purpose of our tests, here we deploy an standard ERC20 token (L2Token) to L2
 */
const main = async () => {
  /**
   * Use l2Network to get the token bridge addresses needed to deploy the token
   */
  const l2Network = await getL2Network(l2Provider);
  const l2Gateway = l2Network.tokenBridge.l2CustomGateway;

  /**
   * Deploy our custom token smart contract to L2
   * We give the custom token contract the address of l2CustomGateway as well as the address of the counterpart L1 token
   */
  console.log('Deploying the test L2Token to L2:');
  const L2Token = await (await ethers.getContractFactory('HATTokenArbitrumBridgeL2')).connect(l2Wallet);
  const l2Token = await L2Token.deploy(l2Gateway, l1TokenAddress, { gasLimit: 10000000, gasPrice: 12379000  },);

  await l2Token.deployed();
  console.log(`L2Token is deployed to L2 at ${l2Token.address}`);
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
