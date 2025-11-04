const express = require('express');
const { ethers } = require('ethers');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// ========== CONFIGURAZIONE ==========
const POLYGON_RPC = process.env.POLYGON_RPC_URL || "https://polygon-rpc.com";
const MASTER_WALLET = "0x8ecd3463bea3eC99B3BBf81cd8502D84E5A60179";

// Indirizzi token su Polygon (AGGIORNA CON INDIRIZZI REALI!)
// IMPORTANTE: Questi sono placeholder - devi trovare gli indirizzi veri dei token DEUR/DUSD/DCNY
const TOKEN_CONTRACTS = {
  DEUR: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", // Placeholder: USDC per test
  DUSD: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", // Placeholder: USDT per test
  DCNY: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"  // Placeholder: USDC per test
};

const provider = new ethers.providers.JsonRpcProvider(POLYGON_RPC);

let lastCheckedBlock = 0;
const deposits = []; // In memoria (per iniziare)

// ========== MONITOR DEPOSITI ==========
async function monitorDeposits() {
  try {
    const currentBlock = await provider.getBlockNumber();
    
    if (lastCheckedBlock === 0) {
      lastCheckedBlock = currentBlock - 100;
    }

    console.log(`🔍 Controllo blocchi ${lastCheckedBlock} → ${currentBlock}`);

    for (const [currency, contractAddress] of Object.entries(TOKEN_CONTRACTS)) {
      const transferTopic = ethers.utils.id("Transfer(address,address,uint256)");
      
      const filter = {
        address: contractAddress,
        topics: [
          transferTopic,
          null,
          ethers.utils.hexZeroPad(MASTER_WALLET, 32)
        ],
        fromBlock: lastCheckedBlock + 1,
        toBlock: currentBlock
      };

      try {
        const logs = await provider.getLogs(filter);

        for (const log of logs) {
          const fromAddress = ethers.utils.getAddress(ethers.utils.hexStripZeros(log.topics[1]));
          const amount = ethers.utils.formatEther(log.data);

          console.log(`💰 Deposito rilevato: ${amount} ${currency} da ${fromAddress}`);

          deposits.push({
            id: log.transactionHash,
            user_address: fromAddress,
            amount: parseFloat(amount),
            currency,
            transaction_hash: log.transactionHash,
            status: 'pending',
            confirmations: 12,
            detected_at: new Date().toISOString()
          });
        }
      } catch (error) {
        console.error(`Errore ${currency}:`, error.message);
      }
    }

    lastCheckedBlock = currentBlock;
  } catch (error) {
    console.error("❌ Errore monitor:", error.message);
  }
}

// Avvia monitor ogni 30 secondi
setInterval(monitorDeposits, 30000);
monitorDeposits();

// ========== API ENDPOINTS ==========

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    database: 'connected',
    monitor: 'active',
    processor: 'active',
    lastCheckedBlock,
    totalDeposits: deposits.length,
    masterWallet: MASTER_WALLET
  });
});

app.get('/api/deposits/by-address/:address', (req, res) => {
  const address = req.params.address.toLowerCase();
  const userDeposits = deposits.filter(d => 
    d.user_address.toLowerCase() === address && 
    d.status === 'pending'
  );
  res.json(userDeposits);
});

app.post('/api/deposits/mark-processed', (req, res) => {
  const { depositIds } = req.body;
  
  depositIds.forEach(id => {
    const deposit = deposits.find(d => d.id === id);
    if (deposit) {
      deposit.status = 'completed';
      console.log(`✅ Deposito processato: ${id}`);
    }
  });
  
  res.json({ success: true });
});

app.post('/api/withdrawal/request', async (req, res) => {
  const { userEmail, amount, currency, toAddress } = req.body;
  
  console.log(`💸 Richiesta prelievo:`);
  console.log(`   - Utente: ${userEmail}`);
  console.log(`   - Importo: ${amount} ${currency}`);
  console.log(`   - Destinazione: ${toAddress}`);
  
  // Per ora solo log (implementa prelievi veri dopo)
  
  res.json({ 
    success: true,
    message: 'Withdrawal request received'
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Backend Epistocracy on port ${PORT}`);
  console.log(`📊 Master Wallet: ${MASTER_WALLET}`);
  console.log(`🔗 Polygon RPC: ${POLYGON_RPC}`);
  console.log(`⚡ Monitoring deposits every 30 seconds...`);
});
