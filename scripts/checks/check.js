const { checkTimeLock } = require("./timelock.js");

async function main() {
  await checkTimeLock();
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
