const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Deploying CryptoPortfolio Smart Contract to EVM...");

  const CryptoPortfolio = await hre.ethers.getContractFactory("CryptoPortfolio");
  const portfolio = await CryptoPortfolio.deploy();
  await portfolio.waitForDeployment();

  const contractAddress = await portfolio.getAddress();
  console.log("=================================================");
  console.log("🎉 SUCCESS: CryptoPortfolio deployed on-chain!");
  console.log(`📌 Contract Address: ${contractAddress}`);
  console.log(`⚡ Network: Local Hardhat (Chain ID: 31337)`);
  console.log(`📦 Architecture: Solidity 0.8.20`);
  console.log("=================================================");

  const deployData = {
    address: contractAddress,
    network: "Local Hardhat (Chain ID: 31337)",
    chainId: 31337,
    solidity: "0.8.20",
    deployedAt: new Date().toISOString()
  };

  fs.writeFileSync(
    path.join(__dirname, "../contract-address.json"),
    JSON.stringify(deployData, null, 2)
  );
  console.log("Saved contract-address.json to project root.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
