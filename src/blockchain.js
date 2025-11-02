const { Web3 } = require('web3');


const RPC_URL = process.env.POLYGON_RPC_URL;


// Minimal ERC20 ABI - only what we need
const ERC20_ABI = [
  {
    "constant": true,
    "inputs": [{"name": "_owner", "type": "address"}],
    "name": "balanceOf",
    "outputs": [{"name": "balance", "type": "uint256"}],
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {"name": "_to", "type": "address"},
      {"name": "_value", "type": "uint256"}
    ],
    "name": "transfer",
    "outputs": [{"name": "", "type": "bool"}],
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "name": "from", "type": "address"},
      {"indexed": true, "name": "to", "type": "address"},
      {"indexed": false, "name": "value", "type": "uint256"}
    ],
    "name": "Transfer",
    "type": "event"
  }
];


let web3Instance = null;


/**
 * Initialize Web3 connection
 */
function initWeb3() {
  if (!RPC_URL) {
    throw new Error('❌ POLYGON_RPC_URL non configurato nelle variabili ambiente');
  }
  
  try {
    web3Instance = new Web3(new Web3.providers.HttpProvider(RPC_URL));
    console.log('   ✅ Web3 connected to Polygon RPC');
    return true;
  } catch (error) {
    console.error('   ❌ Error initializing Web3:', error.message);
    throw error;
  }
}


/**
 * Get Web3 instance
 */
function getWeb3() {
  if (!web3Instance) {
    initWeb3();
  }
  return web3Instance;
}


/**
 * Get ERC20 contract instance
 */
function getContract(tokenAddress) {
  const web3 = getWeb3();
  
  if (!tokenAddress || !/^0x[a-fA-F0-9]{40}$/.test(tokenAddress)) {
    throw new Error(`Invalid token address: ${tokenAddress}`);
  }
  
  return new web3.eth.Contract(ERC20_ABI, tokenAddress);
}


/**
 * Send tokens from platform wallet to user
 */
async function sendTokens(tokenAddress, toAddress, amount) {
  const web3 = getWeb3();
  const contract = getContract(tokenAddress);
  
  const privateKey = process.env.PLATFORM_WALLET_PRIVATE_KEY;
  const fromAddress = process.env.PLATFORM_WALLET_ADDRESS;
  
  if (!privateKey || !fromAddress) {
    throw new Error('Wallet credentials mancanti (PLATFORM_WALLET_ADDRESS o PLATFORM_WALLET_PRIVATE_KEY)');
  }
  
  // Convert amount to Wei
  const amountWei = web3.utils.toWei(amount.toString(), 'ether');
  
  console.log(`   💸 Sending ${amount} tokens to ${toAddress}`);
  console.log(`      From: ${fromAddress}`);
  console.log(`      Token: ${tokenAddress}`);
  
  try {
    // Prepare transaction
    const gasPrice = await web3.eth.getGasPrice();
    
    const tx = {
      from: fromAddress,
      to: tokenAddress,
      data: contract.methods.transfer(toAddress, amountWei).encodeABI(),
      gas: 100000,
      gasPrice: gasPrice
    };
    
    // Sign transaction
    const signedTx = await web3.eth.accounts.signTransaction(tx, privateKey);
    
    // Send transaction
    const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
    
    console.log(`   ✅ Transaction successful! Hash: ${receipt.transactionHash}`);
    
    return receipt.transactionHash;
    
  } catch (error) {
    console.error(`   ❌ Error sending tokens:`, error.message);
    throw error;
  }
}


module.exports = {
  initWeb3,
  getWeb3,
  getContract,
  sendTokens
};
