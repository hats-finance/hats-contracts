# For developers

## Deployment

Deployment to a particular network of the contract stack is done with the following command:
`npx hardhat run hats-deploy --network {NETWORKNAME}`

## Verify a deployment on Etherscan

The deployment process will write the addresses of the deployed contracts to deployment/addresses.json. 

The following command will verify the deployed contracts on etherscan:

`npx hardhat run hats-verify --network {NETWORKNAME}`