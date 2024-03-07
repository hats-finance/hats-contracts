module.exports = {
    "goerli": {
        "governance": "0x640578ae752BA31d2Ad37112fc515b5238B0BdFF",
        "timelockDelay": 604800,
        "executors": [
            "0xfe46D9193BBCE8c590298d77b6f8dB0e619c7FF7",
            "0xe24886AC31c25B544092542aD55aa484FbBF506B",
            "0xe707ABbDA8146d2d3f3341E9B375Cb1fc78526d8",
            "0x9Fb3d86157a9e2dC2a771C297f88FA9784fa4e31",
            "0x2B6656e212f315D3C2DD477FE7EBFb3A86bb1c94",
            "0xF6aEF099e4473E08bed75E0BB1252C4cdAd96416",
            "0x42eefBC05794e71a0f7e7B63E5EcB52320345eBE"
        ],
        "rewardControllersConf": [],
        "hatToken": "0x07865c6E87B9F70255377e024ace6630C1Eaa37F", // USDC
        "hatVaultsRegistryConf": {
            "swapToken": "0x07865c6E87B9F70255377e024ace6630C1Eaa37F", // USDC
            "bountyGovernanceHAT": "1000",
            "bountyHackerHATVested": "0"
        },
        "hatVaultsNFTConf": {
            "merkleTreeIPFSRef": "",
            "root": null,
            "deadline": null
        }
    },
    "arbitrum_goerli": {
        "governance": "0x640578ae752BA31d2Ad37112fc515b5238B0BdFF",
        "timelockDelay": 604800,
        "executors": [
            "0xfe46D9193BBCE8c590298d77b6f8dB0e619c7FF7",
            "0xe24886AC31c25B544092542aD55aa484FbBF506B",
            "0xe707ABbDA8146d2d3f3341E9B375Cb1fc78526d8",
            "0x9Fb3d86157a9e2dC2a771C297f88FA9784fa4e31",
            "0x2B6656e212f315D3C2DD477FE7EBFb3A86bb1c94",
            "0xF6aEF099e4473E08bed75E0BB1252C4cdAd96416",
            "0x42eefBC05794e71a0f7e7B63E5EcB52320345eBE"
        ],
        "rewardControllersConf": [],
        "hatToken": "0x07865c6E87B9F70255377e024ace6630C1Eaa37F", // USDC
        "hatVaultsRegistryConf": {
            "swapToken": "0x07865c6E87B9F70255377e024ace6630C1Eaa37F", // USDC
            "bountyGovernanceHAT": "1000",
            "bountyHackerHATVested": "0"
        },
        "hatVaultsNFTConf": {
            "merkleTreeIPFSRef": "",
            "root": null,
            "deadline": null
        }
    },
    "optimism_goerli": {
        "governance": "0x0B7602011EC2B862Bc157fF08d27b1018aEb18d5",
        "timelockDelay": 300,
        "executors": [
            "0x0B7602011EC2B862Bc157fF08d27b1018aEb18d5"
        ],
        "rewardControllersConf": [{
            "startBlock": null,
            "epochLength": "195200",
            "epochRewardPerBlock": [
                "441300000000000000000",
                "441300000000000000000",
                "882500000000000000000",
                "778800000000000000000",
                "687300000000000000000",
                "606500000000000000000",
                "535300000000000000000",
                "472400000000000000000",
                "416900000000000000000",
                "367900000000000000000",
                "324700000000000000000",
                "286500000000000000000",
                "252800000000000000000",
                "223100000000000000000",
                "196900000000000000000",
                "173800000000000000000",
                "153400000000000000000",
                "135300000000000000000",
                "119400000000000000000",
                "105400000000000000000",
                "93000000000000000000",
                "82100000000000000000",
                "72400000000000000000",
                "63900000000000000000"
            ]
        }],
        "hatVaultsRegistryConf": {
            "bountyGovernanceHAT": "1000",
            "bountyHackerHATVested": "500"
        },
        "hatVaultsNFTConf": {
            "merkleTreeIPFSRef": "",
            "root": null,
            "deadline": null
        }
    },
    "hardhat": {
        "timelockDelay": 300,
        "rewardControllersConf": [{
            "startBlock": null,
            "epochLength": "195200",
            "epochRewardPerBlock": [
                "441300000000000000000",
                "441300000000000000000",
                "882500000000000000000",
                "778800000000000000000",
                "687300000000000000000",
                "606500000000000000000",
                "535300000000000000000",
                "472400000000000000000",
                "416900000000000000000",
                "367900000000000000000",
                "324700000000000000000",
                "286500000000000000000",
                "252800000000000000000",
                "223100000000000000000",
                "196900000000000000000",
                "173800000000000000000",
                "153400000000000000000",
                "135300000000000000000",
                "119400000000000000000",
                "105400000000000000000",
                "93000000000000000000",
                "82100000000000000000",
                "72400000000000000000",
                "63900000000000000000"
            ],
            "rewardToken": "HATToken"
        }],
        "hatVaultsRegistryConf": {
            "bountyGovernanceHAT": "1000",
            "bountyHackerHATVested": "500",
            "swapToken": "HATToken"
        },
        "hatVaultsNFTConf": {
            "merkleTreeIPFSRef": "",
            "root": null,
            "deadline": null
        }
    },
    "sepolia": {
        "governance": "0xFA6579F3Bb1793eFaB541de06763b872E11bfCBe",
        "timelockDelay": 300,
        "executors": [
            "0x0B7602011EC2B862Bc157fF08d27b1018aEb18d5",
            "0x56E889664F5961452E5f4183AA13AF568198eaD2",
            "0x1885B7c7a3AE1F35BA71C0392C13153A95c4914f"
        ],
        // "hatToken": "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", // USDC
        "hatVaultsRegistryConf": {
            // "swapToken": "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", // USDC
            "bountyGovernanceHAT": "1000",
            "bountyHackerHATVested": "0"
        },
        "hatVaultsNFTConf": {
            "merkleTreeIPFSRef": "",
            "root": null,
            "deadline": null
        },
        "rewardControllersConf": [{
            "startBlock": null,
            "epochLength": "195200",
            "epochRewardPerBlock": [
                "441300000000000000000",
                "441300000000000000000",
                "882500000000000000000",
                "778800000000000000000",
                "687300000000000000000",
                "606500000000000000000",
                "535300000000000000000",
                "472400000000000000000",
                "416900000000000000000",
                "367900000000000000000",
                "324700000000000000000",
                "286500000000000000000",
                "252800000000000000000",
                "223100000000000000000",
                "196900000000000000000",
                "173800000000000000000",
                "153400000000000000000",
                "135300000000000000000",
                "119400000000000000000",
                "105400000000000000000",
                "93000000000000000000",
                "82100000000000000000",
                "72400000000000000000",
                "63900000000000000000"
            ]
        }],
    },
    "polygon": {
        "governance": "0xA5C6D757Ca69c92EeA05B22924d9774658e10c62",
        "timelockDelay": 604800,
        "executors": [
            "0xfe46D9193BBCE8c590298d77b6f8dB0e619c7FF7",
            "0xe24886AC31c25B544092542aD55aa484FbBF506B",
            "0xe707ABbDA8146d2d3f3341E9B375Cb1fc78526d8",
            "0x9Fb3d86157a9e2dC2a771C297f88FA9784fa4e31",
            "0x2B6656e212f315D3C2DD477FE7EBFb3A86bb1c94",
            "0xF6aEF099e4473E08bed75E0BB1252C4cdAd96416",
            "0x42eefBC05794e71a0f7e7B63E5EcB52320345eBE"
        ],
        "rewardControllersConf": [],
        "hatToken": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", // USDC
        "hatVaultsRegistryConf": {
            "swapToken": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", // USDC
            "bountyGovernanceHAT": "1000",
            "bountyHackerHATVested": "0"
        },
        "hatVaultsNFTConf": {
            "merkleTreeIPFSRef": "",
            "root": null,
            "deadline": null
        }
    },
    "mainnet": {
        "governance": "0xBA5Ddb6Af728F01E91D77D12073548D823f6D1ef",
        "timelockDelay": 604800,
        "executors": [
            "0xfe46D9193BBCE8c590298d77b6f8dB0e619c7FF7",
            "0xe24886AC31c25B544092542aD55aa484FbBF506B",
            "0xe707ABbDA8146d2d3f3341E9B375Cb1fc78526d8",
            "0x9Fb3d86157a9e2dC2a771C297f88FA9784fa4e31",
            "0x2B6656e212f315D3C2DD477FE7EBFb3A86bb1c94",
            "0xF6aEF099e4473E08bed75E0BB1252C4cdAd96416",
            "0x42eefBC05794e71a0f7e7B63E5EcB52320345eBE"
        ],
        "rewardControllersConf": [],
        "hatToken": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
        "hatVaultsRegistryConf": {
            "swapToken": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
            "bountyGovernanceHAT": "1000",
            "bountyHackerHATVested": "0"
        },
        "hatVaultsNFTConf": {
            "merkleTreeIPFSRef": "",
            "root": null,
            "deadline": null
        }
    },
    "optimism": {
        "governance": "0x5A6910528b047d3371970dF764ba4046b7DfAd6a",
        "timelockDelay": 604800,
        "executors": [
            "0xfe46D9193BBCE8c590298d77b6f8dB0e619c7FF7",
            "0xe24886AC31c25B544092542aD55aa484FbBF506B",
            "0xe707ABbDA8146d2d3f3341E9B375Cb1fc78526d8",
            "0x9Fb3d86157a9e2dC2a771C297f88FA9784fa4e31",
            "0x2B6656e212f315D3C2DD477FE7EBFb3A86bb1c94",
            "0xF6aEF099e4473E08bed75E0BB1252C4cdAd96416",
            "0x42eefBC05794e71a0f7e7B63E5EcB52320345eBE"
        ],
        "rewardControllersConf": [],
        "hatToken": "0x7F5c764cBc14f9669B88837ca1490cCa17c31607", // USDC
        "hatVaultsRegistryConf": {
            "swapToken": "0x7F5c764cBc14f9669B88837ca1490cCa17c31607", // USDC
            "bountyGovernanceHAT": "1000",
            "bountyHackerHATVested": "0"
        },
        "hatVaultsNFTConf": {
            "merkleTreeIPFSRef": "",
            "root": null,
            "deadline": null
        }
    },
    "arbitrum": {
        "governance": "0x022B95b4c02bbA85604506E6114485615b0aD09A",
        "timelockDelay": 604800,
        "executors": [
            "0xfe46D9193BBCE8c590298d77b6f8dB0e619c7FF7",
            "0xe24886AC31c25B544092542aD55aa484FbBF506B",
            "0xe707ABbDA8146d2d3f3341E9B375Cb1fc78526d8",
            "0x9Fb3d86157a9e2dC2a771C297f88FA9784fa4e31",
            "0x2B6656e212f315D3C2DD477FE7EBFb3A86bb1c94",
            "0xF6aEF099e4473E08bed75E0BB1252C4cdAd96416",
            "0x42eefBC05794e71a0f7e7B63E5EcB52320345eBE"
        ],
        "rewardControllersConf": [],
        "hatToken": "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8", // USDC
        "hatVaultsRegistryConf": {
            "swapToken": "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8", // USDC
            "bountyGovernanceHAT": "1000",
            "bountyHackerHATVested": "0"
        },
        "hatVaultsNFTConf": {
            "merkleTreeIPFSRef": "",
            "root": null,
            "deadline": null
        }
    },
    "bnb": {
        "governance": "0xbFBC2Ab80bD0A12258db952739238e403Be01ece",
        "timelockDelay": 604800,
        "executors": [
            "0xfe46D9193BBCE8c590298d77b6f8dB0e619c7FF7",
            "0xe24886AC31c25B544092542aD55aa484FbBF506B",
            "0xe707ABbDA8146d2d3f3341E9B375Cb1fc78526d8",
            "0x9Fb3d86157a9e2dC2a771C297f88FA9784fa4e31",
            "0x2B6656e212f315D3C2DD477FE7EBFb3A86bb1c94",
            "0xF6aEF099e4473E08bed75E0BB1252C4cdAd96416",
            "0x42eefBC05794e71a0f7e7B63E5EcB52320345eBE"
        ],
        "rewardControllersConf": [],
        "hatToken": "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d", // USDC
        "hatVaultsRegistryConf": {
            "swapToken": "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d", // USDC
            "bountyGovernanceHAT": "1000",
            "bountyHackerHATVested": "0"
        },
        "hatVaultsNFTConf": {
            "merkleTreeIPFSRef": "",
            "root": null,
            "deadline": null
        }
    },
};
