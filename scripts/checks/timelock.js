const HatTimelockController = artifacts.require("./HATTimelockController.sol");
const HATVaults = artifacts.require("./HATVaults.sol");
const ADDRESSES = require("../addresses.json");
async function main() {
  console.log(`Do sanity check of deployed HatTimelockController contract`);

  const addresses = ADDRESSES[network.name];
  if (!addresses) {
    throw Error(`No deploymnet addresses found on network "${network.name}"`);
  }

  const hatTimelockControllerAddress = addresses.timelock;

  const hatTimelockController = await HatTimelockController.at(
    hatTimelockControllerAddress
  );

  const hatVaults = await HATVaults.at(addresses.hatVaults);

  const EXECUTOR_ROLE = await hatTimelockController.EXECUTOR_ROLE();
  const PROPOSER_ROLE = await hatTimelockController.PROPOSER_ROLE();
  const TIMELOCK_ADMIN_ROLE = await hatTimelockController.TIMELOCK_ADMIN_ROLE();
  console.log(`TIMELOCK_ADMIN_ROLE`, TIMELOCK_ADMIN_ROLE);
  const checks = [];

  async function checkResult(description, f) {
    console.log(`... checking ${description}..`);
    checks.push({ description, result: await f() });
  }

  await checkResult(
    `Governance has PROPOSER ROLE`,
    async () =>
      await hatTimelockController.hasRole(PROPOSER_ROLE, addresses.governance)
  );
  await checkResult(
    `Governance does not have TIMELOCK_ADMIN_ROLE`,
    async () =>
      !(await hatTimelockController.hasRole(
        TIMELOCK_ADMIN_ROLE,
        addresses.governance
      ))
  );
  await checkResult(
    `Governance does not have EXECUTOR_ROLE`,
    async () =>
      !(await hatTimelockController.hasRole(
        EXECUTOR_ROLE,
        addresses.governance
      ))
  );

  await checkResult(
    `Timelock itself has TIMELOCK_ADMIN_ROLE`,
    async () =>
      await hatTimelockController.hasRole(
        TIMELOCK_ADMIN_ROLE,
        hatTimelockController.address
      )
  );

  await checkResult(
    `Some executors have the executor role (${addresses.executors[0]})`,
    async () =>
      await hatTimelockController.hasRole(EXECUTOR_ROLE, addresses.executors[0])
  );

  await checkResult(`Timelock is HATVaults governance`, async () => {
    const currentGov = await hatVaults.owner();
    if (currentGov === hatTimelockControllerAddress) {
      return true;
    } else {
      console.warn(
        `current governance of hatvaults is ${currentGov} (expected the timelock at ${hatTimelockControllerAddress})`
      );
      return false;
    }
  });

  console.log(`------------------------------------------------------------`);
  console.log(`network: ${network.name}`);
  console.log(`addresses used`);
  console.log(addresses);
  var failed = 0;
  console.log(`------------------------------------------------------------`);
  console.log(`Checks`);
  for (i in checks) {
    const check = checks[i];
    console.log(` * ${check.description}: ${check.result}`);
    if (!check.result) {
      failed += 1;
    }
  }
  console.log(`------------------------------------------------------------`);
  if (failed) {
    console.warn(`${failed} checks FAILED!`);
    console.log(`------------------------------------------------------------`);
  }
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { checkTimeLock: main };
