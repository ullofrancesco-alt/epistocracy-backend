const { getPendingWithdrawals, updateWithdrawalStatus } = require('./database');
const { sendTokens } = require('./blockchain');


const PROCESS_INTERVAL = 60000; // 60 seconds
const MAX_DAILY_WITHDRAWAL = parseFloat(process.env.MAX_DAILY_WITHDRAWAL) || 10000;


// Token address mapping
const TOKEN_ADDRESSES = {
  'Digital EUR': process.env.DEUR_TOKEN_ADDRESS,
  'Digital USD': process.env.DUSD_TOKEN_ADDRESS,
  'Digital CNH': process.env.DCNY_TOKEN_ADDRESS
};


let isProcessing = false;


/**
 * Start withdrawal processor
 */
async function startProcessor() {
  if (isProcessing) {
    console.log('⚠️ Processor already active');
    return;
  }


  console.log('\n💸 ========================================');
  console.log('   WITHDRAWAL PROCESSOR STARTING');
  console.log('========================================');
  console.log(`⏱️ Check interval: ${PROCESS_INTERVAL/1000}s`);
  console.log(`💰 Max daily withdrawal: ${MAX_DAILY_WITHDRAWAL}`);
  console.log(`💳 Platform wallet: ${process.env.PLATFORM_WALLET_ADDRESS}`);
  console.log('========================================');
  console.log('✅ PROCESSOR ACTIVE');
  console.log('========================================\n');
  
  isProcessing = true;
  
  // Check immediately after 5 seconds
  setTimeout(processWithdrawals, 5000);
  
  // Then check every PROCESS_INTERVAL
  setInterval(processWithdrawals, PROCESS_INTERVAL);
}


/**
 * Process all pending withdrawals
 */
async function processWithdrawals() {
  try {
    const pending = await getPendingWithdrawals();
    
    if (pending.length === 0) {
      return; // No withdrawals to process
    }
    
    console.log(`\n💸 ========================================`);
    console.log(`   PROCESSING ${pending.length} WITHDRAWAL(S)`);
    console.log(`========================================\n`);
    
    for (const withdrawal of pending) {
      await processWithdrawal(withdrawal);
    }
    
    console.log(`========================================`);
    console.log(`✅ BATCH COMPLETE`);
    console.log(`========================================\n`);
    
  } catch (error) {
    console.error('❌ Error in withdrawal processor:', error.message);
  }
}


/**
 * Process individual withdrawal
 */
async function processWithdrawal(withdrawal) {
  const { id, user_email, amount, currency, to_address } = withdrawal;
  
  console.log(`💳 Processing withdrawal #${id}`);
  console.log(`   User: ${user_email}`);
  console.log(`   Amount: ${amount} ${currency}`);
  console.log(`   To: ${to_address}`);
  
  try {
    // Get token address for this currency
    const tokenAddress = TOKEN_ADDRESSES[currency];
    
    if (!tokenAddress) {
      throw new Error(`Token address not configured for ${currency}`);
    }
    
    console.log(`   Token address: ${tokenAddress}`);
    
    // Send tokens on blockchain
    const txHash = await sendTokens(tokenAddress, to_address, amount);
    
    // Update database
    await updateWithdrawalStatus(id, 'completed', txHash);
    
    console.log(`   ✅ WITHDRAWAL COMPLETE!`);
    console.log(`   Transaction: ${txHash}`);
    console.log(`   View on PolygonScan: https://polygonscan.com/tx/${txHash}\n`);
    
  } catch (error) {
    console.error(`   ❌ WITHDRAWAL FAILED for #${id}:`, error.message);
    
    // Mark as failed in database
    await updateWithdrawalStatus(id, 'failed', null);
    console.log(`   ⚠️ Marked as failed in database\n`);
  }
}


module.exports = {
  startProcessor
};


