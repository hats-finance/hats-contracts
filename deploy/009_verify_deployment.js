const CONFIG = require("../config.json");
const { network } = require("hardhat");

const func = async function (hre) {
    const config = CONFIG[network.name];
    const { deployments, getNamedAccounts } = hre;
    const { read } = deployments;

    const { deployer } = await getNamedAccounts();

    console.log("\nVerify the deployment:\n");

    // Verify HATTimelockController

    let governance = config["governance"];
    if (!governance && network.name === "hardhat") {
        governance = deployer;
    }

    let executors = config["executors"];
    if (!executors) {
        executors = [governance];
    }

    let hatGovernanceDelay;
    if (config["timelockDelay"]) {
        hatGovernanceDelay = config["timelockDelay"];
    } else {
        hatGovernanceDelay = network.name === "mainnet" ?  60 * 60 * 24 * 7 : 60 * 5; // 7 days for mainnet or 5 minutes for testnets
    }

    const TIMELOCK_ADMIN_ROLE = await read('HATTimelockController', {}, 'TIMELOCK_ADMIN_ROLE');
    const PROPOSER_ROLE = await read('HATTimelockController', {}, 'PROPOSER_ROLE');
    const CANCELLER_ROLE = await read('HATTimelockController', {}, 'CANCELLER_ROLE');
    const EXECUTOR_ROLE = await read('HATTimelockController', {}, 'EXECUTOR_ROLE');

    // Deployer doesn't have the timelock admin role
    verify(
        !(await read('HATTimelockController', {}, 'hasRole', TIMELOCK_ADMIN_ROLE, deployer)),
        "Deployer doesn't have the timelock admin role"
    );

    // Timelock controller itself has the timelock admin role
    verify(
        await read('HATTimelockController', {}, 'hasRole', TIMELOCK_ADMIN_ROLE, (await deployments.get('HATTimelockController')).address),
        "Timelock controller itself has the timelock admin role"
    );

    // Governane has the proposer role
    verify(
        await read('HATTimelockController', {}, 'hasRole', PROPOSER_ROLE, governance),
        "Governance " + governance + " has the proposer role"
    );

    // Governane has the canceller role
    verify(
        await read('HATTimelockController', {}, 'hasRole', CANCELLER_ROLE, governance),
        "Governance " + governance + " has the canceller role"
    );

    for (executor of executors) {
        // Each executor has the execute role
        verify(
            await read('HATTimelockController', {}, 'hasRole', EXECUTOR_ROLE, executor),
            "Executor " + executor + " has the execute role"
        );
    }

    // Min delay is correct
    verify(
        (await read('HATTimelockController', {}, 'getMinDelay')).toString() === hatGovernanceDelay.toString(),
        "Min delay is " + hatGovernanceDelay + " seconds"
    );

    const HATTimelockController = artifacts.require("./HATTimelockController.sol");

    let hatTimelockController = await HATTimelockController.at((await deployments.get('HATTimelockController')).address);
    let logs = await hatTimelockController.getPastEvents('RoleGranted', {
        fromBlock: (await deployments.get('HATTimelockController')).receipt.blockNumber,
        toBlock: await ethers.provider.getBlockNumber()
    });

    // Roles granted should be the 4 + number of executors
    // (renounced deployer role, timelock admin of itself, governance proposer and canceller roles, and executor role to the executors)
    verify(
        logs.length === 4 + executors.length,
        "No unexpected roles were granted"
    );

    // TIMELOCK_ADMIN_ROLE should be the admin role of the TIMELOCK_ADMIN_ROLE
    verify(
        await read('HATTimelockController', {}, 'getRoleAdmin', TIMELOCK_ADMIN_ROLE) === TIMELOCK_ADMIN_ROLE,
        "TIMELOCK_ADMIN_ROLE should be the admin role of the TIMELOCK_ADMIN_ROLE"
    );

    // TIMELOCK_ADMIN_ROLE should be the admin role of the PROPOSER_ROLE
    verify(
        await read('HATTimelockController', {}, 'getRoleAdmin', PROPOSER_ROLE) === TIMELOCK_ADMIN_ROLE,
        "TIMELOCK_ADMIN_ROLE should be the admin role of the PROPOSER_ROLE"
    );

    // TIMELOCK_ADMIN_ROLE should be the admin role of the CANCELLER_ROLE
    verify(
        await read('HATTimelockController', {}, 'getRoleAdmin', CANCELLER_ROLE) === TIMELOCK_ADMIN_ROLE,
        "TIMELOCK_ADMIN_ROLE should be the admin role of the CANCELLER_ROLE"
    );

    // TIMELOCK_ADMIN_ROLE should be the admin role of the EXECUTOR_ROLE
    verify(
        await read('HATTimelockController', {}, 'getRoleAdmin', EXECUTOR_ROLE) === TIMELOCK_ADMIN_ROLE,
        "TIMELOCK_ADMIN_ROLE should be the admin role of the EXECUTOR_ROLE"
    );

    // Verify HATToken
    if (network.name === "hardhat") {
        verify(
            await read('HATToken', {}, 'owner') === (await deployments.get('HATTimelockController')).address,
            "HATToken governance is the HATTimelockController"
        );
    }

    // Verify TokenLockFactory
    verify(
        await read('TokenLockFactory', {}, 'owner') === (await deployments.get('HATTimelockController')).address,
        "TokenLockFactory owner is the HATTimelockController"
    );

    verify(
        await read('TokenLockFactory', {}, 'masterCopy') === (await deployments.get('HATTokenLock')).address,
        "TokenLockFactory masterCopy is the HATTokenLock"
    );

    // Verify Arbitrator
    verify(
        await read('HATGovernanceArbitrator', {}, 'owner') === (await deployments.get('HATTimelockController')).address,
        "Arbitrator owner is the HATTimelockController"
    );

    // Verify Reward Controller

    // TODO: Verify reward controllers

    // Verify HATVaultsRegistry

    let bountyGovernanceHAT = config["hatVaultsRegistryConf"]["bountyGovernanceHAT"];
    let bountyHackerHATVested = config["hatVaultsRegistryConf"]["bountyHackerHATVested"];
    let swapToken = config["hatVaultsRegistryConf"]["swapToken"];
    if (!swapToken || swapToken === "HATToken") {
        swapToken = (await deployments.get('HATToken')).address;  
    }

    verify(
        await read('HATVaultsRegistry', {}, 'owner') === (await deployments.get('HATTimelockController')).address,
        "HATVaultsRegistry owner is the HATTimelockController"
    );

    verify(
        await read('HATVaultsRegistry', {}, 'defaultArbitrator') === (await deployments.get('HATGovernanceArbitrator')).address,
        "HATVaultsRegistry default arbitrator is the Arbitrator"
    );

    verify(
        await read('HATVaultsRegistry', {}, 'hatVaultImplementation') === (await deployments.get('HATVault')).address,
        "HATVaultsRegistry HATVault implementation is correct"
    );

    verify(
        await read('HATVaultsRegistry', {}, 'tokenLockFactory') === (await deployments.get('TokenLockFactory')).address,
        "HATVaultsRegistry TokenLockFactory is correct"
    );

    verify(
        await read('HATVaultsRegistry', {}, 'HAT') === swapToken,
        "HATVaultsRegistry swap token is correct (" + swapToken + ")"
    );

    verify(
        (await read('HATVaultsRegistry', {}, 'defaultBountyGovernanceHAT')).toString() === bountyGovernanceHAT.toString(),
        "HATVaultsRegistry default bountyGovernanceHAT is correct (" + bountyGovernanceHAT + ")"
    );

    verify(
        (await read('HATVaultsRegistry', {}, 'defaultBountyHackerHATVested')).toString() === bountyHackerHATVested.toString(),
        "HATVaultsRegistry default bountyHackerHATVested is correct (" + bountyHackerHATVested + ")"
    );
}

function verify(condition, msg) {
    console.log(condition ? '\x1b[32m%s\x1b[0m' : '\x1b[31m%s\x1b[0m', msg + ": " + condition);
}
module.exports = func;
