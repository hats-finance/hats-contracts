const ADDRESSES = require("./addresses.js");
async function main(
    governance = ADDRESSES[network.name].governance,
    rewardsToken = "0x51a6Efc15c50EcE1DaAD1Ee4fbF8DEC76584c365",
    rewardPerBlock = "16185644800000000",
    startBlock = null,
    multiplierPeriod = "195200",
    whitelistedRouters = ["0xE592427A0AEce92De3Edee1F18E0157C05861564"],
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
      if (!silent) {
        console.log(`${facet} deployed at: ${facetInstance.address}`);
      }
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
      whitelistedRouters,
      tokenLockFactory
    ],
    silent: silent
  });

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
      tokenLockFactory,
      '"'
    );
  }

  return hatDiamond;
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
