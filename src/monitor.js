const { getWeb3, getContract } = require('./blockchain');
const { saveDeposit } = require('./database');


const POLLING_INTERVAL = 30000; // 30 seconds
const MIN_CONFIRMATIONS = parseInt(process.env.MIN_CONFIRMATIONS) || 12;


// Token configurations
const TOKENS = {
  DEUR: {
    address: process.env.DEUR_TOKEN_ADDRESS,
    name: 'Digital EUR'
  },
  DUSD: {
    address: process.env.DUSD_TOKEN_ADDRESS,
    name: 'Digital USD'
  },
  DCNY: {
    address: process.env.DCNY_TOKEN_ADDRESS,
    name: 'Digital CNH'
  }
};


const PLATFORM_WALLET = process.env.PLATFORM_WALLET_ADDRESS;


let lastCheckedBlocks = {};
let isMonitoring = false;


/**
 * Start blockchain monitor
 */
async function startMonitor() {
  if (isMonitoring) {
    console.log('⚠️ Monitor already active');
    return;
  }


  console.log('\n🔍 ========================================');
  console.log('   BLOCKCHAIN MONITOR STARTING');
  console.log('========================================');
  console.log(`📍 Platform Wallet: ${PLATFORM_WALLET}`);
  console.log(`⏱️ Polling interval: ${POLLING_INTERVAL/1000}s`);
  console.log(`✅ Min confirmations: ${MIN_CONFIRMATIONS}`);
  console.log('');
  
  isMonitoring = true;


  try {
    const web3 = getWeb3();
    const currentBlock = await web3.eth.getBlockNumber();
    
    // Initialize last checked blocks for each token
    for (const [key, token] of Object.entries(TOKENS)) {
      if (!token.address) {
        console.log(`⚠️ ${token.name}: No address configured, skipping`);
        continue;
      }
      
      lastCheckedBlocks[token.address] = Number(currentBlock);
      console.log(`👂 Monitoring ${token.name}:`);
      console.log(`   Address: ${token.address}`);
      console.log(`   Starting from block: ${currentBlock}\n`);
    }
    
    console.log('========================================');
    console.log('✅ MONITOR ACTIVE AND LISTENING');
    console.log('========================================\n');
    
    // First check immediately after 5 seconds
    setTimeout(checkAllTokens, 5000);
    
    // Then check every POLLING_INTERVAL
    setInterval(checkAllTokens, POLLING_INTERVAL);
    
  } catch (error) {
    console.error('❌ Error starting monitor:', error.message);
    isMonitoring = false;
  }
}


/**
 * Check all configured tokens
 */
async function checkAllTokens() {
  const web3 = getWeb3();
  
  for (const [key, token] of Object.entries(TOKENS)) {
    if (!token.address) continue;
    
    try {
      await checkToken(web3, token);
    } catch (error) {
      console.error(`❌ Error checking ${token.name}:`, error.message);
    }
  }
}


/**
 * Check specific token for new deposits
 */
async function checkToken(web3, token) {
  try {
    const contract = getContract(token.address);
    const currentBlock = await web3.eth.getBlockNumber();
    const fromBlock = lastCheckedBlocks[token.address] + 1;
    
    if (fromBlock > currentBlock) return;


    // Get Transfer events to platform wallet
    const events = await contract.getPastEvents('Transfer', {
      filter: { to: PLATFORM_WALLET },
      fromBlock: fromBlock,
      toBlock: currentBlock
    });


    if (events.length > 0) {
      console.log(`\n🔍 [${token.name}] Found ${events.length} transfer(s)\n`);
    }


    for (const event of events) {
      await processDeposit(web3, event, token, Number(currentBlock));
    }


    lastCheckedBlocks[token.address] = Number(currentBlock);
    
  } catch (error) {
    throw error;
  }
}


/**
 * Process individual deposit
 */
async function processDeposit(web3, event, token, currentBlock) {
  const { from, to, value } = event.returnValues;
  const txHash = event.transactionHash;
  const blockNumber = Number(event.blockNumber);
  const confirmations = currentBlock - blockNumber;


  const amount = web3.utils.fromWei(value, 'ether');


  console.log(`💰 NEW DEPOSIT DETECTED:`);
  console.log(`   Token: ${token.name}`);
  console.log(`   From: ${from}`);
  console.log(`   To: ${to}`);
  console.log(`   Amount: ${amount}`);
  console.log(`   TX: ${txHash}`);
  console.log(`   Block: ${blockNumber}`);
  console.log(`   Confirmations: ${confirmations}/${MIN_CONFIRMATIONS}`);


  if (confirmations >= MIN_CONFIRMATIONS) {
    console.log(`   ✅ CONFIRMED! Saving to database...`);
    
    // Use wallet address as email identifier (lowercase)
    const userEmail = from.toLowerCase();


    try {
      await saveDeposit({
        userEmail,
        userWalletAddress: from,
        amount: parseFloat(amount),
        currency: token.name,
        txHash,
        blockNumber,
        status: 'confirmed'
      });


      console.log(`   ✅ Deposit saved for user: ${userEmail}`);
      console.log(`   💡 User can now credit this on the website\n`);
      
    } catch (error) {
      console.error(`   ❌ Error saving deposit:`, error.message);
    }
  } else {
    console.log(`   ⏳ Waiting for more confirmations...\n`);
  }
}


module.exports = {
  startMonitor
};
