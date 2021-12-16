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
  const governance  = "0xBA5Ddb6Af728F01E91D77D12073548D823f6D1ef";
  const hatGovernanceDelay = 60*60*24*7;
  const hatVaultsAddress = "0x571f39d351513146248AcafA9D0509319A327C4D";
  const executors = [
    "0x2B6656e212f315D3C2DD477FE7EBFb3A86bb1c94",
    "0x9Fb3d86157a9e2dC2a771C297f88FA9784fa4e31",
    "0xF6aEF099e4473E08bed75E0BB1252C4cdAd96416",
    "0xb3E7828EC7Ce2B270E3008B6400597C3a203809e",
    "0xd714Dd60e22BbB1cbAFD0e40dE5Cfa7bBDD3F3C8"
  ];

  console.log("Account balance:", (await deployer.getBalance()).toString());


  const HATTimelockController = await ethers.getContractFactory("HATTimelockController");
  const hatTimelockController = await HATTimelockController.deploy(
                                            hatVaultsAddress,
                                            hatGovernanceDelay,
                                            [governance],
                                            executors);
  await hatTimelockController.deployed();

  console.log("hatTimelockController address:", hatTimelockController.address);

  // We also save the contract's artifacts and address in the frontend directory
  saveFrontendFiles(hatVaults,"HATVaults");
  saveFrontendFiles(hatTimelockController,"HATTimelockController");
  //verify

  console.log("npx hardhat verify --network mainnet",hatTimelockController.address,
                                                     '"',hatVaultsAddress,'"',
                                                     '"',hatGovernanceDelay,'"',
                                                     '"', [governance],'"',
                                                     '"',executors,'"');

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

  const HATTimelockControllerArtifact = artifacts.readArtifactSync("HATTimelockController");

  fs.writeFileSync(
    contractsDir + "/HATTimelockController.json",
    JSON.stringify(HATTimelockControllerArtifact, null, 2)
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
