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


  async function deployFacets (...facets) {
    const instances = [];
    for (let facet of facets) {
      let constructorArgs = [];
      if (Array.isArray(facet)) {
        [facet, constructorArgs] = facet;
      }
      let factory;
      factory = await ethers.getContractFactory(facet, {});
      
      const facetInstance = await factory.deploy(...constructorArgs);
      await facetInstance.deployed();
      instances.push(facetInstance);
    }
    return instances;
  }
  let [
    reentrancyCheckMock
  ] = await deployFacets(
    "ReentrancyCheckMock"
  );

  // eslint-disable-next-line no-unused-vars
  const hatDiamond = await diamond.deploy({
    diamondName: 'HATDiamond',
    facets: [
      ["ReentrancyCheckMock", reentrancyCheckMock],
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

module.exports = { deployHatDiamondMock: main };
