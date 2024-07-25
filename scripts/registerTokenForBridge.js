const { providers, Wallet } = require('ethers');
const { getL2Network, L1ToL2MessageStatus } = require('@arbitrum/sdk');
const { AdminErc20Bridger } = require('@arbitrum/sdk/dist/lib/assetBridger/erc20Bridger');
require('dotenv').config();

const walletPrivateKey = process.env.PRIVATE_KEY;
const l1Provider = new providers.JsonRpcProvider(`https://mainnet.infura.io/v3/${process.env.INFURA_KEY}`);
const l2Provider = new providers.JsonRpcProvider(`https://arbitrum-mainnet.infura.io/v3/${process.env.INFURA_KEY}`);
const l1Wallet = new Wallet(walletPrivateKey, l1Provider);

const main = async () => {
    const l2Network = await getL2Network(l2Provider);
    const adminTokenBridger = new AdminErc20Bridger(l2Network);
    const registerTokenTx = await adminTokenBridger.registerCustomToken(
    "0x76c4ec0068923Da13Ee11527d6cF9b7521000049",
    "0x4D22e37Eb4d71D1acc5f4889a65936D2a44A2f15",
    l1Wallet,
    l2Provider,
    );

    const registerTokenRec = await registerTokenTx.wait();
    console.log(
    `Registering token txn confirmed on L1! 🙌 L1 receipt is: ${registerTokenRec.transactionHash}`,
    );

    /**
     * The L1 side is confirmed; now we listen and wait for the L2 side to be executed; we can do this by computing the expected txn hash of the L2 transaction.
     * To compute this txn hash, we need our message's "sequence numbers", unique identifiers of each L1 to L2 message.
     * We'll fetch them from the event logs with a helper method.
     */
    const l1ToL2Msgs = await registerTokenRec.getL1ToL2Messages(l2Provider);

    /**
     * In principle, a single L1 txn can trigger any number of L1-to-L2 messages (each with its own sequencer number).
     * In this case, the registerTokenOnL2 method created 2 L1-to-L2 messages;
     * - (1) one to set the L1 token to the Custom Gateway via the Router, and
     * - (2) another to set the L1 token to its L2 token address via the Generic-Custom Gateway
     * Here, We check if both messages are redeemed on L2
     */
    expect(l1ToL2Msgs.length, 'Should be 2 messages.').to.eq(2);

    const setTokenTx = await l1ToL2Msgs[0].waitForStatus();
    expect(setTokenTx.status, 'Set token not redeemed.').to.eq(L1ToL2MessageStatus.REDEEMED);

    const setGateways = await l1ToL2Msgs[1].waitForStatus();
    expect(setGateways.status, 'Set gateways not redeemed.').to.eq(L1ToL2MessageStatus.REDEEMED);

    console.log(
    'Your custom token is now registered on our custom gateway 🥳  Go ahead and make the deposit!',
    );
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
