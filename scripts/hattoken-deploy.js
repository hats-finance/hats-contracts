const { network } = require("hardhat");
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
  const addresses = ADDRESSES[network.name];

  // ethers is avaialble in the global scope
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();

  let governance = addresses.governance;
  if (!governance && network.name === "hardhat") {
    governance = deployerAddress;
  }

  const timelockDelay = network.name === "mainnet" ? 3600 * 24 * 2 : 60 * 5; // 2 days for mainnet or 5 minutes for testnets

  console.log("Deploying the contracts with the account:", deployerAddress);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  const HATToken = await ethers.getContractFactory("HATToken");
  const hatToken = await HATToken.deploy(governance, timelockDelay);
  await hatToken.deployed();

  console.log("hatToken address:", hatToken.address);

  if (network.name !== "hardhat") {
    ADDRESSES[network.name]["hatToken"] = hatToken.address;
    fs.writeFileSync(__dirname + '/addresses.json', JSON.stringify(ADDRESSES, null, 2));
  }

  return hatToken;
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { deployHATToken: main };
