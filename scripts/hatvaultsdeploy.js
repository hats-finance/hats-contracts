const ADDRESSES = require("./addresses.js");
async function main(
    governance = ADDRESSES[network.name].governance,
    rewardsToken = "0x51a6Efc15c50EcE1DaAD1Ee4fbF8DEC76584c365",
    rewardPerBlock = "16185644800000000",
    startBlock = null,
    multiplierPeriod = "195200",
    uniSwapRouter = "0xE592427A0AEce92De3Edee1F18E0157C05861564",
    tokenLockFactory = "0x6E6578bC77984A1eF3469af009cFEC5529aEF9F3",
    silent = false
  ) {
  // This is just a convenience check
  if (network.name === "hardhat" && !silent) {
    console.warn(
      "You are trying to deploy a contract to the Hardhat Network, which" +
        "gets automatically created and destroyed every time. Use the Hardhat" +
        " option '--network localhost'"
    );
  }

  const diamond = require("./diamond-util.js");
  let totalGasUsed = ethers.BigNumber.from("0");

  // ethers is avaialble in the global scope
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();

  //constructor params for test
  //rinkeby hat
  if (startBlock === null) {
    startBlock = await ethers.provider.getBlockNumber();
  }

  if (!governance && network.name === "hardhat") {
    governance = deployerAddress;
  }

  if (!silent) {
    console.log("Deploying the contracts with the account:", deployerAddress);
    console.log("Account balance:", (await deployer.getBalance()).toString());
  }

  async function deployFacets (...facets) {
    const LibVaults = await ethers.getContractFactory("LibVaults");
    const libVaults = await LibVaults.deploy();
    if (!silent) {
      console.log(`LibVaults deploy at: ${libVaults.address}`);
    }
    const instances = [];
    for (let facet of facets) {
      let constructorArgs = [];
      if (Array.isArray(facet)) {
        [facet, constructorArgs] = facet;
      }
      let factory;
      if ("UIFacet" === facet) {
        factory = await ethers.getContractFactory(facet, {
          libraries: {
            LibVaults: libVaults.address,
          },
        });
      } else {
        factory = await ethers.getContractFactory(facet, {});
      }
      
      const facetInstance = await factory.deploy(...constructorArgs);
      await facetInstance.deployed();
      const tx = facetInstance.deployTransaction;
      const receipt = await tx.wait();
      if (!silent) {
        console.log(`${facet} deploy gas used:` + strDisplay(receipt.gasUsed));
      }
      totalGasUsed = totalGasUsed.add(receipt.gasUsed);
      instances.push(facetInstance);
    }
    return instances;
  }
  let [
    claimFacet,
    committeeFacet,
    depositFacet,
    diamondCutFacet,
    diamondLoupeFacet,
    ownershipFacet,
    paramsFacet,
    poolFacet,
    rewardFacet,
    swapFacet,
    uiFacet,
    withdrawFacet
  ] = await deployFacets(
    "ClaimFacet",
    "CommitteeFacet",
    "DepositFacet",
    "DiamondCutFacet",
    "DiamondLoupeFacet",
    "OwnershipFacet",
    "ParamsFacet",
    "PoolFacet",
    "RewardFacet",
    "SwapFacet",
    "UIFacet",
    "WithdrawFacet"
  );

  // eslint-disable-next-line no-unused-vars
  const hatDiamond = await diamond.deploy({
    diamondName: 'HATDiamond',
    facets: [
      ["ClaimFacet", claimFacet],
      ["CommitteeFacet", committeeFacet],
      ["DepositFacet", depositFacet],
      ["DiamondCutFacet", diamondCutFacet],
      ["DiamondLoupeFacet", diamondLoupeFacet],
      ["OwnershipFacet", ownershipFacet],
      ["ParamsFacet", paramsFacet],
      ["PoolFacet", poolFacet],
      ["RewardFacet", rewardFacet],
      ["SwapFacet", swapFacet],
      ["UIFacet", uiFacet],
      ["WithdrawFacet", withdrawFacet]
    ],
    args: [
      governance,
      rewardsToken,
      rewardPerBlock,
      startBlock,
      multiplierPeriod,
      uniSwapRouter,
      tokenLockFactory
    ],
    silent: silent
  });

  // We also save the contract's artifacts and address in the frontend directory
  saveFrontendFiles(hatDiamond, "HATDiamond");

  if (!silent) {
    console.log("hatDiamond address:", hatDiamond.address);
    
    //verify
    console.log(
      "npx hardhat verify --network rinkeby",
      hatDiamond.address,
      '"',
      governance,
      '"',
      '"',
      rewardsToken,
      '"',
      '"',
      rewardPerBlock,
      '"',
      '"',
      startBlock,
      '"',
      '"',
      multiplierPeriod,
      '"',
      '"',
      uniSwapRouter,
      '"',
      '"',
      tokenLockFactory,
      '"'
    );
  }

  return hatDiamond;
}

function saveFrontendFiles(contract, name) {
  const fs = require("fs");
  const contractsDir = __dirname + "/../frontend/src/contracts";

  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir, { recursive: true });
  }

  var data = JSON.parse(
    fs.readFileSync(contractsDir + "/contract-address.json", {
      encoding: "utf8",
      flag: "r",
    })
  );
  data[name] = contract.address;

  fs.writeFileSync(
    contractsDir + "/contract-address.json",
    JSON.stringify(data, undefined, 2)
  );

  const HATDiamondArtifact = artifacts.readArtifactSync("HATDiamond");

  fs.writeFileSync(
    contractsDir + "/HATDiamond.json",
    JSON.stringify(HATDiamondArtifact, null, 2)
  );
}

function addCommas (nStr) {
  nStr += '';
  const x = nStr.split('.');
  let x1 = x[0];
  const x2 = x.length > 1 ? '.' + x[1] : '';
  var rgx = /(\d+)(\d{3})/;
  while (rgx.test(x1)) {
    x1 = x1.replace(rgx, '$1' + ',' + '$2');
  }
  return x1 + x2;
}

function strDisplay (str) {
  return addCommas(str.toString());
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { deployHatVaults: main };
