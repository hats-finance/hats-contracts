const PRIVATE = require("../.private.json");
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

  //constructor params for test
  //rinkeby hat
  if (network.name === "rinkeby" || network.name === "localhost"){
    hatVaults = PRIVATE["HAT_VAULTS_RINKEBY_ADDRESS"];
    minDelay = (5*60); // 5 minutes,
    proposers = [PRIVATE["HAT_GOV_RINKEBY_ADDRESS"]];
    executors =PRIVATE["HAT_EXECUTORS_RINKEBY_ADDRESSES"];
  }
  if (network.name === "mainnet"){
    hatVaults = PRIVATE["HAT_VAULTS_MAINNET_ADDRESS"];
    minDelay = (3600*24*7); // 7 days,
    proposers = [PRIVATE["HAT_GOV_MULT_SIG_MAINNET_ADDRESS"]];
    executors =PRIVATE["HAT_EXECUTORS_MAINNET_ADDRESSES"];
  }
  
  console.log("Account balance:", (await deployer.getBalance()).toString());

  const HATTimeLock = await ethers.getContractFactory("HATTimelockController");
  const hatTimeLock = await HATTimeLock.deploy( 
      hatVaults,
      minDelay,
      proposers,
      executors
      );
  await hatTimeLock.deployed();

  console.log("hatTimeLock address:", hatTimeLock.address);

  // We also save the contract's artifacts and address in the frontend directory
  saveFrontendFiles(hatTimeLock,"HATTimelockController");
  //verify
  saveConstractorParams(hatVaults,minDelay,proposers,executors);
  console.log("npx hardhat verify --network rinkeby --constructor-args arguments.js",hatTimeLock.address);

}

function saveFrontendFiles(contract,name) {
  const fs = require("fs");
  const contractsDir = __dirname + "/../frontend/src/contracts";

  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir,{recursive: true});
  }

  var data = JSON.parse(fs.readFileSync(contractsDir + "/contract-address.json",
                             {encoding:'utf8', flag:'r'}));
  data[name] = contract.address;

  fs.writeFileSync(
    contractsDir + "/contract-address.json",
    JSON.stringify(data, undefined, 2)
  );

  const HATTimeLockArtifact = artifacts.readArtifactSync("HATTimelockController");

  fs.writeFileSync(
    contractsDir + "/HATTimelockController.json",
    JSON.stringify(HATTimeLockArtifact, null, 2)
  );
}

function saveConstractorParams(...args) {
    const fs = require("fs");
    const constractorParamsDir = __dirname;
  
    fs.writeFileSync(
      "./arguments.js",
      "module.exports = [" + JSON.stringify(args, undefined, 2) + "];"
    );
  
    
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
