with open('gas-report.txt') as f:
    lines = f.readlines()
    included_contracts = ["HATTimelockController", "HATTokenLock", "HATVault", "HATVaultsRegistry", "RewardController", "TokenLockFactory"]
    total_avg_gas = 0
    for i in range(9, len(lines), 2):
        line = lines[i]
        contract_name = lines[i].split("·")[0].strip().replace("|  ", "").replace("\x1b[90m", "").replace("\x1b[39m", "").replace("\x1b[32m\x1b[1m", "").replace("\x1b[22m\x1b[39m", "").replace("\x1b[22m", "")
        if (contract_name == "Deployments"):
            break
        if contract_name in included_contracts:
            total_avg_gas += int(lines[i].split("·")[4].strip())
    print("Total of averages: " + str(total_avg_gas))
