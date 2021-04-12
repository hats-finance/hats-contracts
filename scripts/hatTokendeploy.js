
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

  const governance  = await deployer.getAddress();
  const timelockblocks =  2;

  console.log("Account balance:", (await deployer.getBalance()).toString());

  const HATToken = await ethers.getContractFactory("HATToken");
  const hatToken = await HATToken.deploy(governance, timelockblocks);
  await hatToken.deployed();

  console.log("hatToken address:", hatToken.address);

  // We also save the contract's artifacts and address in the frontend directory
  saveFrontendFiles(hatToken);
}

function saveFrontendFiles(hatToken) {
  const fs = require("fs");
  const contractsDir = __dirname + "/../frontend/src/contracts";

  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir,{recursive: true});
  }

  fs.writeFileSync(
    contractsDir + "/contract-address.json",
    JSON.stringify({ HATToken: hatToken.address }, undefined, 2)
  );

  const HATTokenArtifact = artifacts.readArtifactSync("HATToken");

  fs.writeFileSync(
    contractsDir + "/HATToken.json",
    JSON.stringify(HATTokenArtifact, null, 2)
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
