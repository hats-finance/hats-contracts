const ADDRESSES = require("./addresses.json");
const fs = require("fs");

async function main() {
  // This is just a convenience check
  if (network.name === "hardhat") {
    console.warn(
      "You are trying to deploy a contract to the Hardhat Network, which" +
        "gets automatically created and destroyed every time. Use the Hardhat" +
        " option '--network localhost'"
    );
  }

  // ethers is avaialble in the global scope
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  console.log(
    "Deploying the contracts with the account:",
    deployerAddress
  );

  console.log("Account balance:", (await deployer.getBalance()).toString());

  const HATTokenLock = await ethers.getContractFactory("HATTokenLock");
  const hatTokenLock = await HATTokenLock.deploy();
  await hatTokenLock.deployed();

  console.log("hatTokenLock address:", hatTokenLock.address);

  const TokenLockFactory = await ethers.getContractFactory("TokenLockFactory");
  const tokenLockFactory = await TokenLockFactory.deploy(hatTokenLock.address);
  await tokenLockFactory.deployed();

  console.log("tokenLockFactory address:", tokenLockFactory.address);

  if (network.name !== "hardhat") {
    let governance = ADDRESSES[network.name].governance;

    if (deployerAddress.toLowerCase() !== governance.toLowerCase()) {
      await tokenLockFactory.transferOwnership(governance);
      console.log("Trnasferred factory ownership to:", governance);
    }
    ADDRESSES[network.name]["hatTokenLock"] = hatTokenLock.address;
    ADDRESSES[network.name]["tokenLockFactory"] = tokenLockFactory.address;
    fs.writeFileSync(__dirname + '/addresses.json', JSON.stringify(ADDRESSES, null, 2));
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
