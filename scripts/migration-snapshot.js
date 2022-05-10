const { network } = require("hardhat");
const CONFIG = require("./addresses.js");
const HATVaults = artifacts.require("./HATVaults.sol");
const fs = require("fs");

async function main(config) {
    // This is just a convenience check
    if (!config) {
        config = CONFIG[network.name];
    }

    const hatVaults = await HATVaults.at(config.hatVaultsAddress);
    let poolsCount = parseInt((await hatVaults.poolLength()).toString());

    let snapshot = {};
    for (let i = 0; i < poolsCount; i++) {
        snapshot[i] = {};
    }

    await hatVaults.getPastEvents('Deposit', {
        fromBlock: 0,
        toBlock: 'latest'
    })
    .then(async function(events){
        for (const event of events) {
            let user = event.args.user;
            let pid = event.args.pid;
            let userData = await hatVaults.userInfo(pid, user);
            if (userData.shares.toString() !== '0' || userData.rewardDebt.toString() !== '0') {
                snapshot[pid][user] = { 
                    shares: userData.shares.toString(),
                    rewardDebt: userData.rewardDebt.toString()
                };
            }   
        }
    });

    console.log(snapshot);
    fs.writeFileSync(__dirname + '/../snapshot.json', JSON.stringify(snapshot));
    return snapshot;
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
        console.error(error);
        process.exit(1);
        });
}

module.exports = { getMigrationSnapshot: main };
