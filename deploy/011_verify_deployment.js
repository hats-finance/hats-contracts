const CONFIG = require("../config.js");
const { network } = require("hardhat");
let failures = 0;

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
    if (!executors || executors.length === 0) {
        executors = [governance];
    }

    if (executors.indexOf(governance) === -1) {
        executors.push(governance);
    }

    let hatGovernanceDelay = config["timelockDelay"];

    const TIMELOCK_ADMIN_ROLE = await read('HATTimelockController', {}, 'TIMELOCK_ADMIN_ROLE');
    const PROPOSER_ROLE = await read('HATTimelockController', {}, 'PROPOSER_ROLE');
    const CANCELLER_ROLE = await read('HATTimelockController', {}, 'CANCELLER_ROLE');
    const EXECUTOR_ROLE = await read('HATTimelockController', {}, 'EXECUTOR_ROLE');

    // print some general info before diagnosing
    console.log("************************************************");
    console.log("deployer: ", deployer);
    console.log("governance: ", governance);
    console.log("executors: ", executors);
    console.log("************************************************");
    console.log("TIMELOCK_ADMIN_ROLE", TIMELOCK_ADMIN_ROLE);
    console.log("PROPOSER_ROLE", PROPOSER_ROLE);
    console.log("CANCELLER_ROLE", CANCELLER_ROLE);
    console.log("EXECUTOR_ROLE", EXECUTOR_ROLE);
    console.log("************************************************");
    console.log("HATTimelockController", (await deployments.get('HATTimelockController')).address);
    console.log("************************************************");


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

    verify(
      !(await read('HATTimelockController', {}, 'hasRole', TIMELOCK_ADMIN_ROLE, deployer)),
      `TIMELOCK_ADMIN_ROLE should NOT be the admin role of the deployer ${deployer}`
    );
    // Roles granted should be the 4 + number of executors
    // (renounced deployer role, timelock admin of itself, governance proposer and canceller roles, and executor role to the executors)
    const roleGrantEventsCount = 3 + executors.length;
    verify(
      logs.length === roleGrantEventsCount,
      `No unexpected roles were granted (expected ${roleGrantEventsCount}, got ${logs.length})`
    );

    // if unexpected roles were granted we print some extra info
    if (logs.length > roleGrantEventsCount) {
        const timelockAddress = (await deployments.get('HATTimelockController')).address;
          
        const EXPECTED_ROLES = {
            [governance]: [PROPOSER_ROLE, CANCELLER_ROLE],
            [timelockAddress]: TIMELOCK_ADMIN_ROLE,
        };
        for (executor of executors) {
            EXPECTED_ROLES[executor] = [EXECUTOR_ROLE];
        }
        for (log of logs) {
            const role = log.args.role;
            const account = log.args.account;
            // roles that should be defined
            const expectedRoles = EXPECTED_ROLES[account] || [];
            if (!expectedRoles.includes(role)) {
              console.log(`** The account ${account} should not have role ${role}`);
            }
        }
    }
    
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
        (await read('TokenLockFactory', {}, 'masterCopy')).toLowerCase() === (await deployments.get('HATTokenLock')).address.toLowerCase(),
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

    let governanceFee = config["hatVaultsRegistryConf"]["governanceFee"];

    let governanceFeeReceiver = config["hatVaultsRegistryConf"]["governanceFeeReceiver"];

    if (!governanceFeeReceiver) {
        governanceFeeReceiver = governance;
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
        await read('HATVaultsRegistry', {}, 'hatClaimsManagerImplementation') === (await deployments.get('HATClaimsManager')).address,
        "HATVaultsRegistry HATVault implementation is correct"
    );

    verify(
        (await read('HATVaultsRegistry', {}, 'defaultGovernanceFee')).toString() === governanceFee.toString(),
        "HATVaultsRegistry default governanceFee is correct (" + governanceFee + ")"
    );

    verify(
        (await read('HATVaultsRegistry', {}, 'governanceFeeReceiver')).toString() === governanceFeeReceiver.toString(),
        "HATVaultsRegistry governanceFeeReceiver is correct (" + governanceFeeReceiver + ")"
    );

    if (failures > 0) {
      throw Error(`${failures} checks failed!`);
    }
};

function verify(condition, msg) {
    console.log(condition ? '\x1b[32m%s\x1b[0m' : '\x1b[31m%s\x1b[0m', msg + ": " + condition);
    if (!condition) failures++;
}

func.tags = ['verify'];
module.exports = func;
