# CryptoFolio — Ethereum Blockchain DApp

A decentralized cryptocurrency portfolio tracker and market analytics dashboard powered by a **Solidity 0.8.20 Smart Contract** on a local **Hardhat EVM Blockchain** (Chain ID: `31337`).

---

## 🚀 Quick Start Guide

### Step 1: Install Dependencies
Open your terminal inside this folder and run:
```bash
npm install
```

### Step 2: Start the Local Blockchain Node
Start the local Ethereum blockchain testnet:
```bash
npx hardhat node
```
> *Keep this terminal window running. It simulates an active Ethereum network and mines blocks in real time.*

### Step 3: Deploy the Smart Contract (in a 2nd terminal)
In a new terminal window, deploy the Solidity contract:
```bash
npx hardhat run scripts/deploy.js --network localhost
```

### Step 4: Open the DApp
Simply double-click `index.html` or run:
```bash
open index.html
```
*(Or use a local server: `python3 -m http.server 3000` and visit `http://localhost:3000`)*

---

## 📦 Project Architecture

```
blockchain2/
├── index.html              # Frontend layout with Blockchain System Dashboard
├── style.css               # Dark-mode glassmorphic styling
├── script.js               # Web3 bridge (ethers.js) + CoinGecko market logic
├── contracts/
│   └── CryptoPortfolio.sol # Solidity 0.8.20 Smart Contract (On-Chain Ledger)
├── scripts/
│   └── deploy.js           # Hardhat deployment script
├── hardhat.config.js       # Hardhat EVM network configuration (Chain ID: 31337)
├── contract-address.json   # Deployed contract address & metadata
└── package.json            # Node.js dependencies (Hardhat & Ethers.js)
```

---

## 🎯 Key Blockchain Features to Highlight in Presentation:
1. **On-Chain Ledger:** User investments are permanently stored on the Ethereum blockchain via Solidity mappings and structs.
2. **Transaction Mining:** Adding or removing assets executes `eth_sendTransaction`, which is mined into an EVM block with a unique transaction hash (`0x...`).
3. **Zero Database / Decentralized:** No centralized database or backend server; frontend directly interfaces with the EVM via `ethers.js` JSON-RPC.
4. **Real-Time Market Valuation:** Uses CoinGecko public feed with 7-day custom HTML5 Canvas sparklines.
