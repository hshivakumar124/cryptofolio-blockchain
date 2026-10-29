// ==========================================
// CRYPTOFOLIO — 100% ON-CHAIN BLOCKCHAIN DAPP
// Storage Architecture: Solidity 0.8.20 Smart Contract
// Network: Local Hardhat EVM (Chain ID: 31337)
// ==========================================

const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const HARDHAT_RPC = "http://127.0.0.1:8545";
const CONTRACT_ABI = [
    "event InvestmentAdded(address indexed user, uint256 indexed id, string coin, uint256 quantity, uint256 buyPrice, uint256 timestamp)",
    "event InvestmentRemoved(address indexed user, uint256 indexed id)",
    "function addInvestment(string memory _coin, uint256 _quantity, uint256 _buyPrice) public returns (uint256)",
    "function getMyInvestments() public view returns (tuple(uint256 id, string coin, uint256 quantity, uint256 buyPrice, uint256 timestamp)[])",
    "function removeInvestment(uint256 _id) public"
];

let blockchainProvider = null;
let blockchainSigner = null;
let portfolioContract = null;
let isBlockchainConnected = false;
let connectedWalletAddress = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";


// ==========================================
// COIN REGISTRY (12 Coins)
// ==========================================

const COINS = {
    bitcoin: { name: "Bitcoin", symbol: "BTC", emoji: "🪙", color: "#f7931a" },
    ethereum: { name: "Ethereum", symbol: "ETH", emoji: "💠", color: "#627eea" },
    solana: { name: "Solana", symbol: "SOL", emoji: "🟣", color: "#9945ff" },
    binancecoin: { name: "BNB", symbol: "BNB", emoji: "🔶", color: "#f3ba2f" },
    ripple: { name: "XRP", symbol: "XRP", emoji: "💧", color: "#00aae4" },
    cardano: { name: "Cardano", symbol: "ADA", emoji: "🔵", color: "#0033ad" },
    dogecoin: { name: "Dogecoin", symbol: "DOGE", emoji: "🐕", color: "#c3a634" },
    polkadot: { name: "Polkadot", symbol: "DOT", emoji: "⚪", color: "#e6007a" },
    "matic-network": { name: "Polygon", symbol: "MATIC", emoji: "🟪", color: "#8247e5" },
    "avalanche-2": { name: "Avalanche", symbol: "AVAX", emoji: "🔺", color: "#e84142" },
    chainlink: { name: "Chainlink", symbol: "LINK", emoji: "🔗", color: "#2a5ada" },
    "shiba-inu": { name: "Shiba Inu", symbol: "SHIB", emoji: "🐶", color: "#ffa409" }
};

const coinIds = Object.keys(COINS);

// ==========================================
// STATE
// ==========================================

let prices = {};
let sparklineData = {};
let portfolio = JSON.parse(localStorage.getItem("cryptoPortfolio")) || [];
let sortConfig = { key: null, ascending: true };
let countdownTimer = null;
let countdown = 60;
let isFetching = false;
let retryCount = 0;
const REFRESH_INTERVAL = 60; // seconds (safe for CoinGecko free tier)
const MAX_RETRIES = 3;


// ==========================================
// INITIALIZATION
// ==========================================

document.addEventListener("DOMContentLoaded", function () {
    bindFormSubmit();
    displayPortfolio();
    fetchAllMarketData();
    startAutoRefresh();
    initBlockchain();
});


// ==========================================
// API — SINGLE CONSOLIDATED FETCH
// Uses /coins/markets to get price, market cap,
// volume, 24h change, AND sparkline in ONE call.
// ==========================================

async function fetchAllMarketData(isRetry) {
    if (isFetching) return;
    isFetching = true;

    try {
        const ids = coinIds.join(",");
        const url =
            "https://api.coingecko.com/api/v3/coins/markets" +
            "?vs_currency=inr" +
            "&ids=" + ids +
            "&sparkline=true" +
            "&price_change_percentage=24h,7d" +
            "&order=market_cap_desc" +
            "&per_page=12" +
            "&page=1";

        const response = await fetch(url);

        // Handle rate limiting (429) with retry + backoff
        if (response.status === 429) {
            isFetching = false;
            retryCount++;
            if (retryCount <= MAX_RETRIES) {
                var waitSec = retryCount * 15;
                console.warn("Rate limited. Retrying in " + waitSec + "s... (attempt " + retryCount + "/" + MAX_RETRIES + ")");
                showToast("Rate limited. Retrying in " + waitSec + "s...", "info");
                setTimeout(function () { fetchAllMarketData(true); }, waitSec * 1000);
            } else {
                showToast("API rate limit reached. Prices will refresh shortly.", "error");
                retryCount = 0;
            }
            return;
        }

        if (!response.ok) {
            throw new Error("API error: " + response.status);
        }

        const data = await response.json();

        // Reset retry counter on success
        retryCount = 0;

        // Build prices object (same shape the rest of the app expects)
        var newPrices = {};
        data.forEach(function (coin) {
            newPrices[coin.id] = {
                inr: coin.current_price,
                inr_24h_change: coin.price_change_percentage_24h,
                inr_market_cap: coin.market_cap,
                inr_24h_vol: coin.total_volume
            };

            // Store sparkline data
            if (coin.sparkline_in_7d && coin.sparkline_in_7d.price) {
                sparklineData[coin.id] = coin.sparkline_in_7d.price;
            }
        });

        prices = newPrices;

        displayTicker();
        displayMarket();
        displayPortfolio();

        if (!isRetry) {
            console.log("Market data loaded successfully at " + new Date().toLocaleTimeString());
        }

    } catch (error) {
        console.error("Market data fetch failed:", error);

        // Only show error UI if we have no cached data at all
        if (Object.keys(prices).length === 0) {
            showToast("Unable to load prices. Will retry automatically.", "error");
            document.getElementById("marketData").innerHTML =
                '<div class="empty-state"><div class="empty-icon">⚠️</div><p>Unable to load market data. Will retry automatically.</p></div>';
        } else {
            showToast("Refresh failed. Showing cached prices.", "info");
        }
    } finally {
        isFetching = false;
    }
}


// ==========================================
// AUTO-REFRESH WITH COUNTDOWN
// ==========================================

function startAutoRefresh() {
    countdown = REFRESH_INTERVAL;
    updateCountdownDisplay();

    if (countdownTimer) clearInterval(countdownTimer);

    countdownTimer = setInterval(function () {
        countdown--;
        updateCountdownDisplay();

        if (countdown <= 0) {
            countdown = REFRESH_INTERVAL;
            fetchAllMarketData();
        }
    }, 1000);
}

function updateCountdownDisplay() {
    var el = document.getElementById("countdown");
    if (el) {
        el.textContent = countdown + "s";
    }
}

function refreshPrices() {
    countdown = REFRESH_INTERVAL;
    fetchAllMarketData();
    showToast("Refreshing prices...", "success");
}


// ==========================================
// LIVE TICKER BAR
// ==========================================

function displayTicker() {
    const track = document.getElementById("tickerTrack");
    if (!track) return;

    let items = "";

    coinIds.forEach(function (id) {
        if (!prices[id]) return;

        const coin = COINS[id];
        const price = prices[id].inr;
        const change = prices[id].inr_24h_change || 0;
        const changeClass = change >= 0 ? "up" : "down";
        const arrow = change >= 0 ? "▲" : "▼";

        items += '<span class="ticker-item">' +
            '<span class="ticker-coin">' + coin.emoji + " " + coin.symbol + '</span>' +
            '<span class="ticker-price">₹' + formatNumber(price) + '</span>' +
            '<span class="ticker-change ' + changeClass + '">' + arrow + " " + Math.abs(change).toFixed(2) + '%</span>' +
            '</span>';
    });

    // Duplicate for seamless loop
    track.innerHTML = items + items;
}


// ==========================================
// FORM — ADD INVESTMENT
// ==========================================

function bindFormSubmit() {
    document.getElementById("investmentForm")
        .addEventListener("submit", async function (event) {
            event.preventDefault();

            const coin = document.getElementById("coin").value;
            const quantity = Number(document.getElementById("quantity").value);
            const buyPrice = Number(document.getElementById("buyPrice").value);

            if (quantity <= 0 || buyPrice <= 0) {
                showToast("Please enter valid quantity and price.", "error");
                return;
            }

            const addBtn = document.getElementById("addInvestmentBtn");

            if (isBlockchainConnected && portfolioContract) {
                try {
                    if (addBtn) { addBtn.disabled = true; addBtn.textContent = "⏳ Mining Block..."; }
                    showToast("⛓️ Signing EVM Transaction for " + COINS[coin].name + "...", "info");

                    // Scale numbers for Solidity (decimals not native in EVM)
                    const qtyScaled = Math.round(quantity * 1000000);
                    const priceScaled = Math.round(buyPrice * 100);

                    const tx = await portfolioContract.addInvestment(coin, qtyScaled, priceScaled);
                    showToast("⛏️ Tx Broadcasted! Mining into Hardhat Block...", "info");
                    
                    const receipt = await tx.wait(); // Wait for block confirmation!
                    showToast("🎉 Block #" + receipt.blockNumber + " Mined! Saved to Blockchain Ledger.", "success");
                    
                    await loadHoldingsFromBlockchain();
                    this.reset();
                } catch (err) {
                    console.error("Blockchain transaction error:", err);
                    showToast("EVM Transaction failed: " + (err.reason || err.message), "error");
                } finally {
                    if (addBtn) { addBtn.disabled = false; addBtn.textContent = "＋ Add"; }
                }
            } else {
                // Fallback to local storage if node is offline
                const investment = {
                    id: Date.now(),
                    coin: coin,
                    quantity: quantity,
                    buyPrice: buyPrice
                };
                portfolio.push(investment);
                savePortfolio();
                displayPortfolio();
                this.reset();
                showToast(COINS[coin].name + " saved locally (Start Hardhat for on-chain)", "info");
            }
        });
}


// ==========================================
// SAVE / LOAD PORTFOLIO
// ==========================================

function savePortfolio() {
    localStorage.setItem("cryptoPortfolio", JSON.stringify(portfolio));
}


// ==========================================
// DISPLAY PORTFOLIO (Table + Summary + Allocation)
// ==========================================

function displayPortfolio() {
    const table = document.getElementById("holdingsTable");
    const emptyState = document.getElementById("emptyState");

    table.innerHTML = "";

    let totalInvestment = 0;
    let currentValue = 0;
    let allocationMap = {};

    // Apply sort if configured
    let sorted = [...portfolio];
    if (sortConfig.key) {
        sorted.sort(function (a, b) {
            let valA, valB;

            switch (sortConfig.key) {
                case "coin":
                    valA = getCoinName(a.coin).toLowerCase();
                    valB = getCoinName(b.coin).toLowerCase();
                    return sortConfig.ascending
                        ? valA.localeCompare(valB)
                        : valB.localeCompare(valA);

                case "quantity":
                    valA = a.quantity;
                    valB = b.quantity;
                    break;

                case "buyPrice":
                    valA = a.buyPrice;
                    valB = b.buyPrice;
                    break;

                case "currentPrice":
                    valA = prices[a.coin]?.inr || 0;
                    valB = prices[b.coin]?.inr || 0;
                    break;

                case "value":
                    valA = a.quantity * (prices[a.coin]?.inr || 0);
                    valB = b.quantity * (prices[b.coin]?.inr || 0);
                    break;

                case "profit":
                    valA = a.quantity * (prices[a.coin]?.inr || 0) - a.quantity * a.buyPrice;
                    valB = b.quantity * (prices[b.coin]?.inr || 0) - b.quantity * b.buyPrice;
                    break;

                default:
                    return 0;
            }

            if (typeof valA === "string") return 0;
            return sortConfig.ascending ? valA - valB : valB - valA;
        });
    }

    sorted.forEach(function (item) {
        const coin = COINS[item.coin] || {};
        const currentPrice = prices[item.coin]?.inr || 0;
        const investment = item.quantity * item.buyPrice;
        const value = item.quantity * currentPrice;
        const profit = value - investment;
        const profitClass = profit >= 0 ? "positive" : "negative";
        const profitSign = profit >= 0 ? "+" : "";

        totalInvestment += investment;
        currentValue += value;

        // Allocation tracking
        const coinName = getCoinName(item.coin);
        if (!allocationMap[item.coin]) {
            allocationMap[item.coin] = { value: 0, color: coin.color || "#8b5cf6", name: coinName };
        }
        allocationMap[item.coin].value += value;

        const row = document.createElement("tr");
        row.innerHTML =
            '<td>' +
            '<div class="coin-name-cell">' +
            '<div class="coin-emoji">' + (coin.emoji || "🪙") + '</div>' +
            '<div class="coin-name-text">' +
            '<strong>' + (coin.name || item.coin) + '</strong>' +
            '<span>' + (coin.symbol || "") + '</span>' +
            '</div>' +
            '</div>' +
            '</td>' +
            '<td>' + item.quantity + '</td>' +
            '<td>₹' + formatNumber(item.buyPrice) + '</td>' +
            '<td>₹' + formatNumber(currentPrice) + '</td>' +
            '<td>₹' + formatNumber(value) + '</td>' +
            '<td class="' + profitClass + '">' + profitSign + '₹' + formatNumber(Math.abs(profit)) + '</td>' +
            '<td>' +
            '<button class="btn btn-danger" onclick="deleteInvestment(' + item.id + ')">✕ Remove</button>' +
            '</td>';

        table.appendChild(row);
    });

    // Show/hide empty state
    if (emptyState) {
        emptyState.style.display = portfolio.length === 0 ? "block" : "none";
    }

    updateSummary(totalInvestment, currentValue);
    displayAllocation(allocationMap, currentValue);
}


// ==========================================
// SORT TABLE
// ==========================================

function sortTable(key) {
    if (sortConfig.key === key) {
        sortConfig.ascending = !sortConfig.ascending;
    } else {
        sortConfig.key = key;
        sortConfig.ascending = true;
    }

    // Update header visuals
    document.querySelectorAll("#holdingsTableEl thead th").forEach(function (th) {
        th.classList.remove("sorted");
        const arrow = th.querySelector(".sort-arrow");
        if (arrow) arrow.textContent = "▲";
    });

    const activeTh = document.querySelector('[data-sort="' + key + '"]');
    if (activeTh) {
        activeTh.classList.add("sorted");
        const arrow = activeTh.querySelector(".sort-arrow");
        if (arrow) arrow.textContent = sortConfig.ascending ? "▲" : "▼";
    }

    displayPortfolio();
}


// ==========================================
// SUMMARY CARDS
// ==========================================

function updateSummary(totalInvestment, currentValue) {
    const profit = currentValue - totalInvestment;
    let percentage = 0;
    if (totalInvestment > 0) {
        percentage = (profit / totalInvestment) * 100;
    }

    const profitSign = profit >= 0 ? "+" : "-";
    const percentSign = percentage >= 0 ? "+" : "";

    document.getElementById("totalInvestment").textContent =
        "₹" + formatNumber(totalInvestment);

    document.getElementById("currentValue").textContent =
        "₹" + formatNumber(currentValue);

    const plEl = document.getElementById("profitLoss");
    plEl.textContent = profitSign + "₹" + formatNumber(Math.abs(profit));
    plEl.className = "card-value " + (profit >= 0 ? "positive" : "negative");

    const ppEl = document.getElementById("profitPercent");
    ppEl.textContent = percentSign + percentage.toFixed(2) + "%";
    ppEl.className = "card-value " + (percentage >= 0 ? "positive" : "negative");
}


// ==========================================
// PORTFOLIO ALLOCATION BAR
// ==========================================

function displayAllocation(allocationMap, totalValue) {
    const section = document.getElementById("allocationSection");
    const bar = document.getElementById("allocationBar");
    const legend = document.getElementById("allocationLegend");

    if (!section || !bar || !legend) return;

    const entries = Object.entries(allocationMap).filter(function (e) { return e[1].value > 0; });

    if (entries.length === 0 || totalValue <= 0) {
        section.style.display = "none";
        return;
    }

    section.style.display = "block";

    bar.innerHTML = "";
    legend.innerHTML = "";

    entries.sort(function (a, b) { return b[1].value - a[1].value; });

    entries.forEach(function (entry) {
        const pct = (entry[1].value / totalValue * 100).toFixed(1);
        const color = entry[1].color;
        const name = entry[1].name;

        // Bar segment
        const segment = document.createElement("div");
        segment.className = "allocation-segment";
        segment.style.width = pct + "%";
        segment.style.background = color;
        segment.title = name + ": " + pct + "%";
        bar.appendChild(segment);

        // Legend item
        const item = document.createElement("div");
        item.className = "legend-item";
        item.innerHTML =
            '<div class="legend-dot" style="background:' + color + '"></div>' +
            name + " <span>" + pct + "%</span>";
        legend.appendChild(item);
    });
}


// ==========================================
// DELETE INVESTMENT
// ==========================================

async function deleteInvestment(id) {
    const item = portfolio.find(function (p) { return p.id === id; });
    const coinName = item ? getCoinName(item.coin) : "Investment";

    if (isBlockchainConnected && portfolioContract) {
        try {
            showToast("⛓️ Broadcasting removal tx to EVM Ledger...", "info");
            const tx = await portfolioContract.removeInvestment(id);
            await tx.wait();
            showToast("✅ Block Mined! " + coinName + " removed from Blockchain.", "info");
            await loadHoldingsFromBlockchain();
        } catch (err) {
            console.error("Blockchain removal error:", err);
            showToast("On-chain removal failed: " + (err.reason || err.message), "error");
        }
    } else {
        portfolio = portfolio.filter(function (p) { return p.id !== id; });
        savePortfolio();
        displayPortfolio();
        showToast(coinName + " removed from portfolio.", "info");
    }
}


// ==========================================
// MARKET DATA DISPLAY
// ==========================================

function displayMarket() {
    const container = document.getElementById("marketData");
    if (!container) return;

    const searchTerm = (document.getElementById("marketSearch")?.value || "").toLowerCase();

    container.innerHTML = "";

    let visibleCount = 0;

    coinIds.forEach(function (id, index) {
        if (!prices[id]) return;

        const coin = COINS[id];
        const price = prices[id].inr;
        const change = prices[id].inr_24h_change || 0;
        const marketCap = prices[id].inr_market_cap || 0;
        const volume = prices[id].inr_24h_vol || 0;
        const changeClass = change >= 0 ? "up" : "down";
        const arrow = change >= 0 ? "▲" : "▼";

        // Search filter
        const searchable = (coin.name + " " + coin.symbol + " " + id).toLowerCase();
        if (searchTerm && !searchable.includes(searchTerm)) return;

        visibleCount++;

        const card = document.createElement("div");
        card.className = "market-card";
        card.style.animationDelay = (index * 0.05) + "s";

        const sparklineId = "spark-" + id;

        card.innerHTML =
            '<div class="market-card-header">' +
            '<div class="market-card-coin">' +
            '<div class="coin-emoji">' + coin.emoji + '</div>' +
            '<div class="market-card-coin-info">' +
            '<h3>' + coin.name + '</h3>' +
            '<span>' + coin.symbol + '</span>' +
            '</div>' +
            '</div>' +
            '<div class="market-card-change ' + changeClass + '">' +
            arrow + ' ' + Math.abs(change).toFixed(2) + '%' +
            '</div>' +
            '</div>' +
            '<div class="market-card-price">₹' + formatNumber(price) + '</div>' +
            '<div class="market-card-details">' +
            '<span>MCap: <strong>₹' + formatCompact(marketCap) + '</strong></span>' +
            '<span>Vol: <strong>₹' + formatCompact(volume) + '</strong></span>' +
            '</div>' +
            '<div class="sparkline-container" id="' + sparklineId + '"></div>';

        container.appendChild(card);

        // Draw sparkline if data exists
        if (sparklineData[id]) {
            requestAnimationFrame(function () {
                drawSparkline(sparklineId, sparklineData[id], change >= 0);
            });
        }
    });

    if (visibleCount === 0) {
        container.innerHTML =
            '<div class="empty-state"><div class="empty-icon">🔍</div><p>No coins match your search.</p></div>';
    }
}


// ==========================================
// SPARKLINE DRAWING (Canvas)
// ==========================================

function drawSparkline(containerId, data, isPositive) {
    const container = document.getElementById(containerId);
    if (!container || !data || data.length === 0) return;

    const canvas = document.createElement("canvas");
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + "px";
    canvas.style.height = rect.height + "px";

    container.innerHTML = "";
    container.appendChild(canvas);

    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;

    // Downsample if too many points
    let points = data;
    if (points.length > 100) {
        const step = Math.floor(points.length / 100);
        points = points.filter(function (_, i) { return i % step === 0; });
    }

    const min = Math.min.apply(null, points);
    const max = Math.max.apply(null, points);
    const range = max - min || 1;

    const color = isPositive ? "#10b981" : "#ef4444";

    // Draw line
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    points.forEach(function (val, i) {
        const x = (i / (points.length - 1)) * w;
        const y = h - ((val - min) / range) * (h - 4) - 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });

    ctx.stroke();

    // Gradient fill below line
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();

    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    if (isPositive) {
        gradient.addColorStop(0, "rgba(16, 185, 129, 0.15)");
        gradient.addColorStop(1, "rgba(16, 185, 129, 0)");
    } else {
        gradient.addColorStop(0, "rgba(239, 68, 68, 0.15)");
        gradient.addColorStop(1, "rgba(239, 68, 68, 0)");
    }

    ctx.fillStyle = gradient;
    ctx.fill();
}


// ==========================================
// SEARCH / FILTER
// ==========================================

function filterMarket() {
    displayMarket();
}


// ==========================================
// TOAST NOTIFICATIONS
// ==========================================

function showToast(message, type) {
    type = type || "info";

    const container = document.getElementById("toastContainer");
    if (!container) return;

    const icons = {
        success: "✅",
        error: "❌",
        info: "ℹ️"
    };

    const toast = document.createElement("div");
    toast.className = "toast toast-" + type;
    toast.innerHTML =
        '<span class="toast-icon">' + (icons[type] || "ℹ️") + '</span>' +
        '<span>' + message + '</span>';

    container.appendChild(toast);

    // Auto-remove after 4 seconds
    setTimeout(function () {
        toast.classList.add("toast-exit");
        setTimeout(function () {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 300);
    }, 4000);
}


// ==========================================
// EXPORT PORTFOLIO
// ==========================================

function exportPortfolio() {
    if (portfolio.length === 0) {
        showToast("Nothing to export. Add investments first.", "info");
        return;
    }

    const data = JSON.stringify(portfolio, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "crypto-portfolio-" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast("Portfolio exported as JSON!", "success");
}


// ==========================================
// UTILITY — COIN NAME
// ==========================================

function getCoinName(id) {
    return COINS[id] ? COINS[id].name + " (" + COINS[id].symbol + ")" : id;
}


// ==========================================
// UTILITY — NUMBER FORMATTING
// ==========================================

function formatNumber(number) {
    return Number(number).toLocaleString("en-IN", {
        maximumFractionDigits: 2
    });
}

function formatCompact(number) {
    if (number >= 1e12) return (number / 1e12).toFixed(2) + "T";
    if (number >= 1e9) return (number / 1e9).toFixed(2) + "B";
    if (number >= 1e7) return (number / 1e7).toFixed(2) + "Cr";
    if (number >= 1e5) return (number / 1e5).toFixed(2) + "L";
    if (number >= 1e3) return (number / 1e3).toFixed(1) + "K";
    return formatNumber(number);
}

// ==========================================
// BLOCKCHAIN CORE (Ethers.js + Solidity 0.8.20)
// ==========================================

async function initBlockchain() {
    if (typeof ethers === "undefined") {
        console.warn("Ethers.js not loaded. Retrying in 1s...");
        setTimeout(initBlockchain, 1000);
        return;
    }

    try {
        if (window.ethereum) {
            blockchainProvider = new ethers.providers.Web3Provider(window.ethereum);
            blockchainSigner = blockchainProvider.getSigner();
            const network = await blockchainProvider.getNetwork();
            try {
                connectedWalletAddress = await blockchainSigner.getAddress();
            } catch (_) {
                // If not yet requested, connect to default Hardhat account
                blockchainProvider = new ethers.providers.JsonRpcProvider(HARDHAT_RPC);
                blockchainSigner = blockchainProvider.getSigner(0);
                connectedWalletAddress = await blockchainSigner.getAddress();
            }
        } else {
            blockchainProvider = new ethers.providers.JsonRpcProvider(HARDHAT_RPC);
            blockchainSigner = blockchainProvider.getSigner(0);
            connectedWalletAddress = await blockchainSigner.getAddress();
        }

        portfolioContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, blockchainSigner);
        isBlockchainConnected = true;
        updateBlockchainUI(true, connectedWalletAddress, 31337);
        await loadHoldingsFromBlockchain();
        console.log("✅ Connected to EVM Blockchain. Wallet:", connectedWalletAddress);
    } catch (err) {
        console.warn("Hardhat local node not detected on 127.0.0.1:8545:", err.message);
        isBlockchainConnected = false;
        updateBlockchainUI(false, connectedWalletAddress, 31337);
    }
}

async function loadHoldingsFromBlockchain() {
    if (!portfolioContract) return;
    try {
        const onChainData = await portfolioContract.getMyInvestments();
        portfolio = onChainData.map(function (item) {
            return {
                id: item.id.toNumber ? item.id.toNumber() : Number(item.id),
                coin: item.coin,
                quantity: (item.quantity.toNumber ? item.quantity.toNumber() : Number(item.quantity)) / 1000000,
                buyPrice: (item.buyPrice.toNumber ? item.buyPrice.toNumber() : Number(item.buyPrice)) / 100
            };
        });
        displayPortfolio();
    } catch (e) {
        console.error("Failed to read holdings from smart contract:", e);
    }
}

async function syncBlockchainLedger() {
    showToast("Syncing with Hardhat EVM Node...", "info");
    await initBlockchain();
    if (isBlockchainConnected) {
        await loadHoldingsFromBlockchain();
        showToast("✅ Synced with Solidity 0.8.20 Smart Contract!", "success");
    } else {
        showToast("⚠️ Start Hardhat node with: npx hardhat node", "error");
    }
}

async function connectWallet() {
    if (window.ethereum) {
        try {
            const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
            const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
            blockchainSigner = web3Provider.getSigner();
            connectedWalletAddress = accounts[0];
            portfolioContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, blockchainSigner);
            isBlockchainConnected = true;
            updateBlockchainUI(true, connectedWalletAddress, 31337);
            showToast("🦊 Connected to MetaMask: " + formatAddress(connectedWalletAddress), "success");
            await loadHoldingsFromBlockchain();
        } catch (e) {
            showToast("MetaMask connection cancelled.", "error");
        }
    } else {
        await initBlockchain();
        if (isBlockchainConnected) {
            showToast("⚡ Connected to Local Hardhat EVM Node!", "success");
        } else {
            showToast("Run 'npx hardhat node' in terminal to connect.", "info");
        }
    }
}

function updateBlockchainUI(connected, address, chainId) {
    const statusDot = document.getElementById("blockchainStatusDot");
    const statusText = document.getElementById("blockchainNodeStatus");
    const networkText = document.getElementById("smartContractNetwork");
    const addressDisplay = document.getElementById("walletAddressDisplay");
    const headerWallet = document.getElementById("headerWalletShort");

    if (connected) {
        if (statusDot) {
            statusDot.style.background = "#10b981";
            statusDot.style.boxShadow = "0 0 10px #10b981";
        }
        if (statusText) statusText.innerHTML = "• System Connected";
        if (networkText) networkText.textContent = "Local Hardhat (Chain ID: " + (chainId || 31337) + ")";
        if (addressDisplay) addressDisplay.textContent = address || "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
        if (headerWallet) headerWallet.textContent = formatAddress(address || "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
    } else {
        if (statusDot) {
            statusDot.style.background = "#eab308";
            statusDot.style.boxShadow = "0 0 10px #eab308";
        }
        if (statusText) statusText.innerHTML = "• Standby (Start Node)";
        if (addressDisplay) addressDisplay.textContent = "0xf39Fd6e5...2266 (Hardhat Account #0)";
        if (headerWallet) headerWallet.textContent = "Node Standby";
    }
}

function formatAddress(addr) {
    if (!addr || addr.length < 10) return addr;
    return addr.substring(0, 6) + "..." + addr.substring(addr.length - 4);
}
