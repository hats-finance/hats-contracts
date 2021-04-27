
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
  console.log(
    "Deploying the contracts with the account:",
    await deployer.getAddress()
  );

  console.log("Account balance:", (await deployer.getBalance()).toString());

  const HATTokenLock = await ethers.getContractFactory("HATTokenLock");
  const hatTokenLock = await HATTokenLock.deploy();
  await hatTokenLock.deployed();

  console.log("hatTokenLock address:", hatTokenLock.address);

  // We also save the contract's artifacts and address in the frontend directory
  saveFrontendFiles(hatTokenLock,"HATTokenLock");

  const TokenLockFactory = await ethers.getContractFactory("TokenLockFactory");
  const tokenLockFactory = await TokenLockFactory.deploy(hatTokenLock.address);
  await tokenLockFactory.deployed();

  console.log("tokenLockFactory address:", tokenLockFactory.address);

  // We also save the contract's artifacts and address in the frontend directory
  saveFrontendFiles(tokenLockFactory,"TokenLockFactory");
}

function saveFrontendFiles(contract,name) {
  const fs = require("fs");
  const contractsDir = __dirname + "/../frontend/src/contracts";

  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir,{recursive: true});
  }

  fs.writeFileSync(
    contractsDir + "/contract-address.json",
    JSON.stringify({ name: contract.address }, undefined, 2)
  );

  const ContractArtifact = artifacts.readArtifactSync(name);

  fs.writeFileSync(
    contractsDir + "/"+name+".json",
    JSON.stringify(ContractArtifact, null, 2)
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
