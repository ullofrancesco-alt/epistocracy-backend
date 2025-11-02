const { Pool } = require('pg');


const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});


/**
 * Test database connection
 */
async function testConnection() {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log(`   ✅ Database connected at: ${result.rows[0].now}`);
    return true;
  } catch (error) {
    console.error('   ❌ Database connection error:', error.message);
    return false;
  }
}


/**
 * Initialize database tables
 */
async function initDatabase() {
  try {
    // Deposits table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS deposits (
        id SERIAL PRIMARY KEY,
        user_email VARCHAR(255) NOT NULL,
        user_wallet_address VARCHAR(42) NOT NULL,
        amount DECIMAL(20, 6) NOT NULL,
        currency VARCHAR(50) NOT NULL,
        tx_hash VARCHAR(66) UNIQUE NOT NULL,
        block_number BIGINT NOT NULL,
        status VARCHAR(20) DEFAULT 'confirmed',
        created_at TIMESTAMP DEFAULT NOW(),
        processed_at TIMESTAMP
      );
    `);
    console.log('   ✅ Table "deposits" ready');
    
    // Withdrawals table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS withdrawals (
        id SERIAL PRIMARY KEY,
        user_email VARCHAR(255) NOT NULL,
        amount DECIMAL(20, 6) NOT NULL,
        currency VARCHAR(50) NOT NULL,
        to_address VARCHAR(42) NOT NULL,
        tx_hash VARCHAR(66),
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW(),
        processed_at TIMESTAMP
      );
    `);
    console.log('   ✅ Table "withdrawals" ready');
    
    // Create indexes for better performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_deposits_email ON deposits(user_email);
      CREATE INDEX IF NOT EXISTS idx_deposits_status ON deposits(status);
      CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);
    `);
    console.log('   ✅ Database indexes created');
    
  } catch (error) {
    console.error('   ❌ Error initializing database:', error.message);
    throw error;
  }
}


/**
 * Save deposit to database
 */
async function saveDeposit(data) {
  const { userEmail, userWalletAddress, amount, currency, txHash, blockNumber, status = 'confirmed' } = data;
  
  try {
    // Check if already exists
    const existing = await pool.query(
      'SELECT id FROM deposits WHERE tx_hash = $1',
      [txHash]
    );
    
    if (existing.rows.length > 0) {
      console.log(`   ⚠️ Deposit already exists (tx: ${txHash}), skipping`);
      return existing.rows[0].id;
    }
    
    // Insert new deposit
    const result = await pool.query(
      `INSERT INTO deposits 
       (user_email, user_wallet_address, amount, currency, tx_hash, block_number, status) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING id`,
      [userEmail, userWalletAddress, amount, currency, txHash, blockNumber, status]
    );
    
    console.log(`   ✅ Deposit saved to database (ID: ${result.rows[0].id})`);
    return result.rows[0].id;
    
  } catch (error) {
    console.error(`   ❌ Error saving deposit:`, error.message);
    throw error;
  }
}


/**
 * Get pending deposits for a user
 */
async function getPendingDeposits(userEmail) {
  try {
    const result = await pool.query(
      `SELECT * FROM deposits 
       WHERE user_email = $1 AND processed_at IS NULL 
       ORDER BY created_at DESC`,
      [userEmail.toLowerCase()]
    );
    
    return result.rows;
  } catch (error) {
    console.error(`   ❌ Error getting pending deposits:`, error.message);
    throw error;
  }
}


/**
 * Mark deposits as processed
 */
async function markDepositsProcessed(depositIds) {
  try {
    await pool.query(
      'UPDATE deposits SET processed_at = NOW() WHERE id = ANY($1)',
      [depositIds]
    );
    
    console.log(`   ✅ Marked ${depositIds.length} deposits as processed`);
  } catch (error) {
    console.error(`   ❌ Error marking deposits processed:`, error.message);
    throw error;
  }
}


/**
 * Create withdrawal request
 */
async function createWithdrawalRequest(data) {
  const { userEmail, amount, currency, toAddress } = data;
  
  try {
    const result = await pool.query(
      `INSERT INTO withdrawals 
       (user_email, amount, currency, to_address, status) 
       VALUES ($1, $2, $3, $4, 'pending') 
       RETURNING id`,
      [userEmail, amount, currency, toAddress]
    );
    
    console.log(`   ✅ Withdrawal request created (ID: ${result.rows[0].id})`);
    return result.rows[0].id;
    
  } catch (error) {
    console.error(`   ❌ Error creating withdrawal:`, error.message);
    throw error;
  }
}


/**
 * Get pending withdrawals
 */
async function getPendingWithdrawals() {
  try {
    const result = await pool.query(
      `SELECT * FROM withdrawals 
       WHERE status = 'pending' 
       ORDER BY created_at ASC`
    );
    
    return result.rows;
  } catch (error) {
    console.error(`   ❌ Error getting pending withdrawals:`, error.message);
    throw error;
  }
}


/**
 * Update withdrawal status
 */
async function updateWithdrawalStatus(id, status, txHash = null) {
  try {
    await pool.query(
      `UPDATE withdrawals 
       SET status = $1, tx_hash = $2, processed_at = NOW() 
       WHERE id = $3`,
      [status, txHash, id]
    );
    
    console.log(`   ✅ Withdrawal ${id} updated to status: ${status}`);
  } catch (error) {
    console.error(`   ❌ Error updating withdrawal status:`, error.message);
    throw error;
  }
}


module.exports = {
  testConnection,
  initDatabase,
  saveDeposit,
  getPendingDeposits,
  markDepositsProcessed,
  createWithdrawalRequest,
  getPendingWithdrawals,
  updateWithdrawalStatus
};
