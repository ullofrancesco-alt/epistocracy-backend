const express = require('express');
const cors = require('cors');
const { initDatabase, testConnection, getPendingDeposits, markDepositsProcessed, createWithdrawalRequest } = require('./database');
const { initWeb3 } = require('./blockchain');
const { startMonitor } = require('./monitor');
const { startProcessor } = require('./processor');


const app = express();
const PORT = process.env.PORT || 8080;


// Middleware
app.use(cors());
app.use(express.json());


// ========================================
// ENDPOINTS API
// ========================================


// Health Check
app.get('/health', async (req, res) => {
  try {
    const dbStatus = await testConnection();
    res.json({
      status: 'ok',
      database: dbStatus ? 'connected' : 'error',
      monitor: 'active',
      processor: 'active',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error',
      error: error.message 
    });
  }
});


// Get pending deposits for user
app.get('/api/deposits/:email/pending', async (req, res) => {
  try {
    const deposits = await getPendingDeposits(req.params.email);
    res.json(deposits);
  } catch (error) {
    console.error('Error getting deposits:', error);
    res.status(500).json({ error: error.message });
  }
});


// Mark deposits as processed (user clicked "Accredita")
app.post('/api/deposits/mark-processed', async (req, res) => {
  try {
    const { depositIds } = req.body;
    
    if (!depositIds || !Array.isArray(depositIds)) {
      return res.status(400).json({ error: 'depositIds array required' });
    }
    
    await markDepositsProcessed(depositIds);
    res.json({ success: true, processed: depositIds.length });
  } catch (error) {
    console.error('Error marking processed:', error);
    res.status(500).json({ error: error.message });
  }
});


// Request withdrawal
app.post('/api/withdrawal/request', async (req, res) => {
  try {
    const { userEmail, amount, currency, toAddress } = req.body;
    
    if (!userEmail || !amount || !currency || !toAddress) {
      return res.status(400).json({ 
        error: 'Missing required fields: userEmail, amount, currency, toAddress' 
      });
    }
    
    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(toAddress)) {
      return res.status(400).json({ error: 'Invalid Ethereum address format' });
    }
    
    const withdrawalId = await createWithdrawalRequest({
      userEmail,
      amount: parseFloat(amount),
      currency,
      toAddress
    });
    
    res.json({ 
      success: true, 
      withdrawalId,
      message: 'Prelievo richiesto. Sarà processato automaticamente entro 2 minuti.' 
    });
  } catch (error) {
    console.error('Error creating withdrawal:', error);
    res.status(500).json({ error: error.message });
  }
});


// Catch-all for undefined routes
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint non trovato' });
});


// ========================================
// STARTUP SEQUENCE
// ========================================


async function start() {
  console.log('\n🚀 ========================================');
  console.log('   EPISTOCRACY BACKEND WEB3');
  console.log('   Automatic Deposits & Withdrawals');
  console.log('========================================\n');
  
  try {
    // 1. Test Database Connection
    console.log('📊 STEP 1: Testing database connection...');
    const dbOk = await testConnection();
    if (!dbOk) {
      throw new Error('❌ Database non raggiungibile');
    }
    console.log('✅ Database connected successfully\n');
    
    // 2. Initialize Database Tables
    console.log('📊 STEP 2: Initializing database tables...');
    await initDatabase();
    console.log('✅ Database tables initialized\n');
    
    // 3. Initialize Web3
    console.log('🔗 STEP 3: Initializing Web3 connection...');
    await initWeb3();
    console.log('✅ Web3 initialized\n');
    
    // 4. Start HTTP Server
    console.log('🌐 STEP 4: Starting HTTP server...');
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ Server listening on port ${PORT}`);
      console.log(`   Health: http://localhost:${PORT}/health\n`);
    });
    
    // 5. Start Blockchain Monitor (after 5 seconds)
    console.log('⏰ STEP 5: Starting blockchain monitor in 5 seconds...');
    setTimeout(() => {
      startMonitor();
    }, 5000);
    
    // 6. Start Withdrawal Processor (after 10 seconds)
    console.log('⏰ STEP 6: Starting withdrawal processor in 10 seconds...\n');
    setTimeout(() => {
      startProcessor();
    }, 10000);
    
    console.log('========================================');
    console.log('✅ SISTEMA COMPLETAMENTE AVVIATO');
    console.log('========================================\n');
    
  } catch (error) {
    console.error('\n❌ ERRORE CRITICO DURANTE STARTUP:');
    console.error(error);
    console.error('\n💡 Verifica:');
    console.error('   - DATABASE_URL configurato correttamente');
    console.error('   - POLYGON_RPC_URL valido');
    console.error('   - Tutte le variabili ambiente presenti\n');
    process.exit(1);
  }
}


// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
});


process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled Rejection:', error);
});


// Start the application
start();
