
// Increases testrpc time by the passed duration in seconds
const increaseTime = async function(duration) {
  const id = await Date.now();

   web3.providers.HttpProvider.prototype.sendAsync = web3.providers.HttpProvider.prototype.send;

  return new Promise((resolve, reject) => {
    web3.currentProvider.send({
      jsonrpc: '2.0',
      method: 'evm_increaseTime',
      params: [duration],
      id: id,
    }, err1 => {
      if (err1) return reject(err1);

      web3.currentProvider.send({
        jsonrpc: '2.0',
        method: 'evm_mine',
        id: id,
      }, (err2, res) => {
        return err2 ? reject(err2) : resolve(res);
      });
    });
  });
};

// Increases testrpc time by the passed duration in seconds
const mineBlock = async function() {
  const id = await Date.now();

   web3.providers.HttpProvider.prototype.sendAsync = web3.providers.HttpProvider.prototype.send;

  return new Promise((resolve, reject) => {
      web3.currentProvider.send({
        jsonrpc: '2.0',
        method: 'evm_mine',
        id: id,
      }, (err2, res) => {
        return err2 ? reject(err2) : resolve(res);
      });
    });
};
const TIME_LOCK_DELAY_IN_BLOCKS_UNIT = 100;
const setMinter = async function(hatToken,minter,cap) {
    await hatToken.setPendingMinter(minter,cap);
    for(var i =0;i<TIME_LOCK_DELAY_IN_BLOCKS_UNIT;i++) {
        await mineBlock();
    }
    await hatToken.confirmMinter(minter);
};

module.exports = {
  increaseTime,
  setMinter,
  mineBlock,
  TIME_LOCK_DELAY_IN_BLOCKS_UNIT
};
