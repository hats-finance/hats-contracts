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
  const rewardsToken = "0x51a6Efc15c50EcE1DaAD1Ee4fbF8DEC76584c365";
  const rewardPerBlock  = "16185644800000000";
  const startBlock =  await ethers.provider.getBlockNumber();
  const multiplierPeriod = "195200";
  //const governance  = PRIVATE["HAT_MULT_SIG_ADDRESS"];
  const governance  = await deployer.getAddress()
  //v3 router
  const uniSwapRouter = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
  const tokenLockFactory  = "0x6E6578bC77984A1eF3469af009cFEC5529aEF9F3";
  console.log("Account balance:", (await deployer.getBalance()).toString());

  const HATVaults = await ethers.getContractFactory("HATVaults");
  const hatVaults = await HATVaults.deploy(rewardsToken,
                                           rewardPerBlock ,
                                           startBlock ,
                                           multiplierPeriod,
                                           governance,
                                           uniSwapRouter,
                                           tokenLockFactory);
  await hatVaults.deployed();

  console.log("hatVaults address:", hatVaults.address);

  // We also save the contract's artifacts and address in the frontend directory
  saveFrontendFiles(hatVaults,"HATVaults");
  //verify
  console.log("npx hardhat verify --network rinkeby",hatVaults.address,
                                                     '"',rewardsToken,'"',
                                                     '"',rewardPerBlock,'"',
                                                     '"',startBlock,'"',
                                                     '"',multiplierPeriod,'"',
                                                     '"', governance,'"',
                                                     '"',uniSwapRouter,'"',
                                                     '"',tokenLockFactory,'"');

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

  const HATVaultsArtifact = artifacts.readArtifactSync("HATVaults");

  fs.writeFileSync(
    contractsDir + "/HATVaults.json",
    JSON.stringify(HATVaultsArtifact, null, 2)
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
