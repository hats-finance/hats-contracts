async function main(
  hatVaultsAddress = null,
) {
  const HATVaultsV2Mock = await ethers.getContractFactory("HATVaultsV2Mock");
  const hatVaults = await upgrades.upgradeProxy(hatVaultsAddress, HATVaultsV2Mock);

  return hatVaults;
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { upgradeHatVaults: main };
