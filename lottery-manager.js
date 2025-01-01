require('dotenv').config();
const { ethers } = require('ethers');
const cron = require('node-cron');
const axios = require('axios');
const moment = require('moment');

// Constants
const MAX_RETRIES = 5;
const RETRY_DELAY = 2 * 60 * 1000 + 40 * 1000; // 2 minutes and 40 seconds
const TIMESTAMP_RETRY_DELAY = 1 * 60 * 1000; // 1 minute
const dailyInterval = 600; // 86405 for production
const weeklyInterval = 4800; // 604805 for production

// Contract configurations
const CONTRACTS = {
  DAILY: {
    DAILYBTC: '0x9e4bBEBfD400489de672eedD619AE10470181BF1',
    DAILYETH: '0x1Bd462135a165eFE16E390C43D499Dd08064766F',
    DAILYPOL: '0x2167d9F718c3C41A84715302D504DF1d94239488',
    DAILYCRANNI: '0x6aDe006D44391a8E71e9012390ccDf688Ed6032d'
  },
  WEEKLY: {
    WEEKLYBTC: '0xFAa22D1155b2d8cC14BED0f6c33A8bFDF2F0A91d',
    WEEKLYETH: '0x2a1C657b671c9803eC9C000c5456b21a68cA2571',
    WEEKLYPOL: '0xceD69a43c3Cd2B7625D39A0005cAA30376663aC1',
    WEEKLYCRANNI: '0x84145898E8C8643cd49cd651Ba2650a03815336D'
  }
};

const nftConfigAddress = '0x17Fc1Fe5bCD865d88a03A7031C18cCaFE8fBA427';
let cronJobs = new Map();

// Set up provider and wallet
const provider = new ethers.providers.JsonRpcProvider(process.env.RPC);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

// Contract ABIs 
const contractABI = [
  "function autoSpin(address _address, uint8[] _nodes) external",
  "function autoSpinTimestamp() external view returns (uint256)",
  "event LotteryLog(uint256 timestamp, address adrs, string message, uint256 amount)"
];
const nodeconfigABI = [{
  "inputs": [{ "internalType": "address", "name": "_lbnodes", "type": "address" }],
  "stateMutability": "nonpayable", "type": "constructor"
},
{
  "anonymous": false, "inputs": [{
    "indexed": true, "internalType": "uint8",
    "name": "tokenId", "type": "uint8"
  }, {
    "indexed": true, "internalType": "address",
    "name": "smartcontract", "type": "address"
  }, {
    "indexed": false, "internalType": "uint256",
    "name": "amount", "type": "uint256"
  }, { "indexed": true, "internalType": "address", "name": "owner", "type": "address" }], "name": "NftRewarded", "type": "event"
},
{
  "anonymous": false, "inputs": [{ "indexed": true, "internalType": "uint8", "name": "tokenId", "type": "uint8" },
  { "indexed": true, "internalType": "address", "name": "owner", "type": "address" }], "name": "NftStaked", "type": "event"
},
{
  "anonymous": false, "inputs": [{ "indexed": true, "internalType": "uint8", "name": "tokenId", "type": "uint8" },
  { "indexed": true, "internalType": "address", "name": "owner", "type": "address" }], "name": "NftUnstaked", "type": "event"
},
{
  "anonymous": false, "inputs": [{ "indexed": true, "internalType": "address", "name": "previousOwner", "type": "address" },
  { "indexed": true, "internalType": "address", "name": "newOwner", "type": "address" }], "name": "OwnershipTransferred", "type": "event"
},
{
  "anonymous": false, "inputs": [{ "indexed": false, "internalType": "uint8[]", "name": "nodes", "type": "uint8[]" },
  { "indexed": true, "internalType": "address", "name": "owner", "type": "address" },
  { "indexed": true, "internalType": "address", "name": "smartcontract", "type": "address" }], "name": "UserActivated", "type": "event"
},
{
  "inputs": [{ "internalType": "address", "name": "caller", "type": "address" }, { "internalType": "uint8[]", "name": "_nodes", "type": "uint8[]" },
  { "internalType": "bool", "name": "golden", "type": "bool" },
  { "internalType": "address", "name": "contractAddress", "type": "address" }],
  "name": "activateNodes", "outputs": [], "stateMutability": "nonpayable", "type": "function"
},
{
  "inputs": [{ "internalType": "address", "name": "", "type": "address" },
  { "internalType": "address", "name": "", "type": "address" }],
  "name": "activeAddress", "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
  "stateMutability": "view", "type": "function"
},
{
  "inputs": [{ "internalType": "address", "name": "smartcontract", "type": "address" }],
  "name": "getActiveNodes", "outputs": [{ "internalType": "uint8[]", "name": "", "type": "uint8[]" }],
  "stateMutability": "view", "type": "function"
}, {
  "inputs": [{ "internalType": "address", "name": "smartcontract", "type": "address" }],
  "name": "getContractQueue", "outputs": [{
    "components": [{ "internalType": "uint8[]", "name": "activeNodes", "type": "uint8[]" },
    { "internalType": "uint8[]", "name": "waitingNodes", "type": "uint8[]" }], "internalType": "struct LuckBlocksNodesCFG.QueueInfo",
    "name": "", "type": "tuple"
  }], "stateMutability": "view", "type": "function"
}, { "inputs": [{ "internalType": "uint8", "name": "nftId", "type": "uint8" }, { "internalType": "address", "name": "smartcontract", "type": "address" }], "name": "getNodeStatus", "outputs": [{ "internalType": "string", "name": "", "type": "string" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "_wallet", "type": "address" }], "name": "getStakedNodesFromUser", "outputs": [{ "internalType": "uint8[]", "name": "", "type": "uint8[]" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "_caller", "type": "address" }, { "internalType": "address", "name": "contractAddress", "type": "address" }], "name": "getUserActivation", "outputs": [{ "internalType": "bool", "name": "active", "type": "bool" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "smartcontract", "type": "address" }], "name": "getWaitingNodes", "outputs": [{ "internalType": "uint8[]", "name": "", "type": "uint8[]" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "uint8", "name": "", "type": "uint8" }], "name": "nodes", "outputs": [{ "internalType": "address", "name": "owner", "type": "address" }, { "internalType": "uint256", "name": "totalProfit", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "owner", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "renounceOwnership", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "smartcontract", "type": "address" }], "name": "resetQueue", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "uint8", "name": "tokenId", "type": "uint8" }], "name": "stake", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "newOwner", "type": "address" }], "name": "transferOwnership", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "uint8", "name": "tokenId", "type": "uint8" }], "name": "unstake", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, {
  "inputs": [{ "internalType": "address", "name": "caller", "type": "address" }, { "internalType": "uint256", "name": "reward", "type": "uint256" }, { "internalType": "bool", "name": "golden", "type": "bool" }, { "internalType": "address", "name": "contractAddress", "type": "address" }], "name": "updateNodeInfo", "outputs": [{ "internalType": "bool", "name": "success", "type": "bool" }],
  "stateMutability": "nonpayable", "type": "function"
}];

async function sendTelegramMessage(message) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  try {
    const response = await axios.post(url, {
      chat_id: chatId,
      text: message,
    });
    console.log('Message sent successfully:', response.data);
  } catch (error) {
    console.error('Error sending message to Telegram:', error.response ? error.response.data : error.message);
  }
}

async function getWalletNodes() {
  const nftConfigContract = new ethers.Contract(nftConfigAddress, nodeconfigABI, wallet);
  try {
    const nodes = await nftConfigContract.getStakedNodesFromUser(wallet.address);
    const nodeNumbers = nodes.map(n => Number(n));
    await sendTelegramMessage(`🔍 Detected wallet nodes: ${nodeNumbers.join(', ')}`);
    return nodeNumbers;
  } catch (error) {
    console.error('Error fetching wallet nodes:', error);
    await sendTelegramMessage(`❌ Error fetching wallet nodes: ${error.message}`);
    return [];
  }
}

function filterNodesByType(nodes, lotteryType) {
  const filteredNodes = lotteryType === 'Daily' ?
    nodes.filter(node => node > 10) :
    nodes.filter(node => node <= 10);

  sendTelegramMessage(`📊 Filtered nodes for ${lotteryType} lottery: ${filteredNodes.join(', ')}`);
  return filteredNodes;
}

async function simulateTransaction(contract, nodes) {
  try {
    const result = await provider.call({
      to: contract.address,
      data: contract.interface.encodeFunctionData('autoSpin', [wallet.address, nodes]),
      gasLimit: 2400000
    });

    const errorHex = result.slice(10);
    const bytes = [];
    for (let i = 0; i < errorHex.length; i += 2) {
      bytes.push(parseInt(errorHex.substr(i, 2), 16));
    }
    const utf8String = new TextDecoder('utf-8').decode(new Uint8Array(bytes));
    console.log('Simulation result:', utf8String);
    await sendTelegramMessage(`
Contract: ${contract.address}
########## TEST EXECUTION ##############
Simulation result: ${utf8String.trim()}
#####################################`);

    return result === "0x";
  } catch (error) {
    console.error('Simulation error:', error);
    await sendTelegramMessage(`❌ Simulation error: ${error.message}`);
    return false;
  }
}

async function fetchQueueInfo(contract, nftConfigContract) {
  try {
    const queueInfoActive = await nftConfigContract.getActiveNodes(contract.address);
    const queueInfoWaiting = await nftConfigContract.getWaitingNodes(contract.address);

    await sendTelegramMessage(`
Contract: ${contract.address}
########## NODES QUEUE ##############
💀🟢 Active Nodes: [ ${queueInfoActive} ]
💀🟠 Waiting Nodes: [ ${queueInfoWaiting} ]
#####################################`);
  } catch (error) {
    console.error('Error fetching queue info:', error);
    await sendTelegramMessage(`❌ Error fetching queue info: ${error.message}`);
  }
}

async function checkAndAutoSpin(name, contractAddress, nodes, retryCount = 0) {
  const contract = new ethers.Contract(contractAddress, contractABI, wallet);
  const nftConfigContract = new ethers.Contract(nftConfigAddress, nodeconfigABI, wallet);

  try {
    // Check user activation
    const isActive = await nftConfigContract.getUserActivation(wallet.address, contractAddress);
    await sendTelegramMessage(`🔒 User activation status for ${contractAddress}: ${isActive}`);

    if (!isActive) {
      const shouldProceed = await simulateTransaction(contract, nodes);

      if (shouldProceed) {
        await sendTelegramMessage(`
EXECUTION --- STATUS
---------------------------------
💀 Executing autoSpin activation nodes... 💀
---------------------------------`);

        const tx = await contract.autoSpin(wallet.address, nodes, {
          gasLimit: 2400000,
          maxFeePerGas: ethers.utils.parseUnits('10', 'gwei'),
          maxPriorityFeePerGas: ethers.utils.parseUnits('10', 'gwei'),
        });
        await tx.wait();

        await sendTelegramMessage(`
EXECUTION --- STATUS
---------------------------------
🎲💀 autoSpin activation executed successfully! 🟢🟢
---------------------------------`);

        await scheduleNextExecution(name, contractAddress, nodes);
      } else {
        await handleFailedSimulation(name, contractAddress, nodes, retryCount);
      }
    } else {
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const autoSpinTimestamp = await contract.autoSpinTimestamp();

      await fetchQueueInfo(contract, nftConfigContract);

      const interval = process.env.LOTTERY_TYPE === "Daily" ? dailyInterval : weeklyInterval;
      const drawTimestamp = Number(autoSpinTimestamp) + interval;

      if (currentTimestamp >= drawTimestamp) {
        await handleDrawExecution(name, contract, nodes, retryCount);
      } else {
        await handleEarlyExecution(name, contract, nodes, retryCount);
      }
    }
  } catch (error) {
    console.error('Error executing autoSpin:', error);
    await sendTelegramMessage(`❌ Error executing autoSpin: ${error.message}`);
    await handleError(name,contractAddress, nodes, retryCount);
  }
}

async function handleDrawExecution(name, contract, nodes, retryCount) {
  const shouldProceed = await simulateTransaction(contract, nodes);

  if (shouldProceed) {
    await sendTelegramMessage(`
EXECUTION --- STATUS
---------------------------------
🎲 Executing autoSpin... 🎲
---------------------------------`);

    const tx = await contract.autoSpin(wallet.address, nodes, {
      gasLimit: 2400000,
      maxFeePerGas: ethers.utils.parseUnits('10', 'gwei'),
      maxPriorityFeePerGas: ethers.utils.parseUnits('10', 'gwei'),
    });

    const receipt = await tx.wait();

    if (receipt.status === 1) {
      await sendTelegramMessage(`
EXECUTION --- STATUS
---------------------------------
🟢🎲 autoSpin executed successfully! 🎲🟢
---------------------------------`);

      processTransactionReceipt(name, receipt, contract);
      await scheduleNextExecution(name, contract.address, nodes);
    }
  } else {
    await handleFailedSimulation(name, contract.address, nodes, retryCount);
  }
}

async function processTransactionReceipt(name, receipt, contract) {
  await new Promise(resolve => setTimeout(resolve, 250000));

  const blockNumber = receipt.blockNumber - 10;

  // Process LotteryLog events
  const filterLog = contract.filters.LotteryLog(null, null, null, null);
  const eventsLog = await contract.queryFilter(filterLog, blockNumber, 'latest');

  if (eventsLog.length > 0) {
    const lastEventLog = eventsLog[eventsLog.length - 1];
    await sendTelegramMessage(`
🎲 LOTTERY LOG FOR CONTRACT  - ${name} 🎲

${lastEventLog?.args?.message}

🎲 LOTTERY LOG FOR CONTRACT  - ${name} 🎲`);
  }

  // Process NftRewarded events
  const nftConfigContract = new ethers.Contract(nftConfigAddress, nodeconfigABI, wallet);
  const filter = nftConfigContract.filters.NftRewarded(null, null, null, wallet.address);
  const events = await nftConfigContract.queryFilter(filter, blockNumber, 'latest');

  if (events.length > 0) {
    const lastEvent = events[events.length - 1];
    const { tokenId, smartcontract, amount, owner } = lastEvent.args;

    const rewardMessage = owner === wallet.address ? `
💸 Rewards has gone to your Wallet 💸

Wallet Address: ${wallet.address}

#####################################
Last NftRewarded event:
💀 Token ID: ${tokenId.toString()},
🎲 Smart Contract: ${smartcontract} - ${name},
💸 Amount: ${ethers.utils.formatUnits(amount, 6)},
👤 Owner: ${owner} (YOU)
#####################################` : `
#####################################
Last NftRewarded event:
💀 Token ID: ${tokenId.toString()},
🎲 Smart Contract: ${smartcontract} - ${name},
💸 Amount: ${ethers.utils.formatUnits(amount, 6)},
👤 Owner: ${owner}
#####################################`;

    await sendTelegramMessage(rewardMessage);
  }

}

async function handleFailedSimulation(name, contractAddress, nodes, retryCount) {
  if (retryCount < MAX_RETRIES) {
    await sendTelegramMessage(`
EXECUTION --- STATUS - UPDATE
!!!!!---------------------------------
⏰ Retrying in 2 minutes and 40 seconds... (Attempt ${retryCount + 1} of ${MAX_RETRIES})
---------------------------------!!!!!`);

    setTimeout(() => {
      checkAndAutoSpin(name, contractAddress, nodes, retryCount + 1);
    }, RETRY_DELAY);
  } else {
    await sendTelegramMessage(`
EXECUTION --- STATUS - UPDATE
!!!!!---------------------------------
❌ Max retries reached. Scheduling next execution.
---------------------------------!!!!!`);

    await scheduleNextExecution(name, contractAddress, nodes);
  }
}

async function handleEarlyExecution(name, contract, nodes, retryCount) {
  await sendTelegramMessage(`
EXECUTION --- STATUS - UPDATE
!!!!!---------------------------------
⏰ Current timestamp is less than the required autoSpinTimestamp.
---------------------------------!!!!!`);

  if (retryCount === 0) {
    setTimeout(() => {
      checkAndAutoSpin(name, contract.address, nodes, 1);
    }, TIMESTAMP_RETRY_DELAY);
  } else {
    await scheduleNextExecution(name, contract.address, nodes);
  }
}

async function handleError(name, contractAddress, nodes, retryCount) {
  if (retryCount < MAX_RETRIES) {
    await sendTelegramMessage(`
EXECUTION --- STATUS - UPDATE
!!!!!---------------------------------
⏰ Retrying in 2 minutes and 40 seconds... (Attempt ${retryCount + 1} of ${MAX_RETRIES})
---------------------------------!!!!!`);

    setTimeout(() => {
      checkAndAutoSpin(name, contractAddress, nodes, retryCount + 1);
    }, RETRY_DELAY);
  } else {
    await sendTelegramMessage(`
EXECUTION --- STATUS - UPDATE
!!!!!---------------------------------
❌ Max retries reached. Scheduling next execution.
---------------------------------!!!!!`);

    await scheduleNextExecution(name, contractAddress, nodes);
  }
}

// Function to fetch autoSpinTimestamp from a specific contract
async function getAutoSpinTimestampFromContract(contractAddress) {
  const contract = new ethers.Contract(contractAddress, contractABI, wallet);
  const autoSpinTimestamp = await contract.autoSpinTimestamp();
  return parseInt(autoSpinTimestamp, 10);
}

// Function to get next execution time in cron expression format based on autoSpinTimestamp
async function getNextCronExpression(name, contractAddress, nodes) {
  let autoSpinTimestamp = await getAutoSpinTimestampFromContract(contractAddress);
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const lotteryType = process.env.LOTTERY_TYPE;

  // Convert the autoSpinTimestamp to a moment object
  let nextExecution = moment.unix(autoSpinTimestamp);
  
  // Add appropriate interval based on lottery type
  if (lotteryType === "Daily") {
    if (currentTimestamp >= (Number(autoSpinTimestamp) + dailyInterval)) {
      await sendTelegramMessage(`
Contract: ${contractAddress} - ${name}
⚠️ Current time exceeds next execution time, triggering immediate check...`);
    
    await checkAndAutoSpin(name, contractAddress, nodes, 0);
    
    nextExecution = moment.unix(currentTimestamp);

    }

    nextExecution.add(10, 'minutes'); // Daily - 24 hours in production

  } else if (lotteryType === "Weekly") {
    if (currentTimestamp >= (Number(autoSpinTimestamp) + weeklyInterval)) {
      await sendTelegramMessage(`
Contract: ${contractAddress} - ${name}
⚠️ Current time exceeds next execution time, triggering immediate check...`);
    
    await checkAndAutoSpin(name, contractAddress, nodes, 0);
    nextExecution = moment.unix(currentTimestamp);
    }
    nextExecution.add(1, 'hour'); // Weekly - 1 week in production
    nextExecution.add(20, 'minutes'); // only on test
  }

  await sendTelegramMessage(`
Contract: ${contractAddress} - ${name}
NEXT EXECUTION
!!!!!---------------------------------
        ⏰  ${nextExecution.format('YYYY-MM-DD HH:mm:ss')} ⏰
---------------------------------!!!!!`);

  // Format cron expression based on next execution time
  const minute = nextExecution.minute();
  const hour = nextExecution.hour();
  const dayOfWeek = nextExecution.day();

  // Return appropriate cron expression based on lottery type
  if (lotteryType === "Daily") {
    return `0 ${minute} ${hour} * * *`;
  } else {
    return `0 ${minute} ${hour} * * ${dayOfWeek}`;
  }
}

// Function to update the cron schedule for a specific contract
async function updateCronSchedule(name, contractAddress, cronExpression, nodes) {
  if (cronJobs.has(contractAddress)) {
    cronJobs.get(contractAddress).stop();
  }

  const newCronJob = cron.schedule(cronExpression, () => {
    sendTelegramMessage(`
Contract: ${contractAddress} - ${name}
!!!!!---------------------------------
        ⏰ Running autoSpin check... 
---------------------------------!!!!!`);
    checkAndAutoSpin(name, contractAddress, nodes);
  });

  cronJobs.set(contractAddress, newCronJob);

  await sendTelegramMessage(`
Contract: ${contractAddress} - ${name}
📅 Cron job scheduled with expression: ${cronExpression}
🔍 Using nodes: ${nodes.join(', ')}`);
}

// Function to schedule the next execution for a specific contract
async function scheduleNextExecution(name, contractAddress, nodes) {
  try {
    const cronExpression = await getNextCronExpression(name,contractAddress,nodes);

      await updateCronSchedule(name, contractAddress, cronExpression, nodes);
    
  } catch (error) {
    console.error(`Error scheduling next execution for ${contractAddress}:`, error);
    await sendTelegramMessage(`
Contract: ${contractAddress}
!!!!!---------------------------------
❌ Error scheduling the next execution: ${error.message}
---------------------------------!!!!!

⏰ Retrying in 2 minutes and 40 seconds...`);

    setTimeout(() => {
      checkAndAutoSpin(name, contractAddress, nodes, 0);
    }, RETRY_DELAY);
  }
}

async function executeForAllContracts() {
  const lotteryType = process.env.LOTTERY_TYPE;
  const relevantContracts = lotteryType === 'Daily' ? CONTRACTS.DAILY : CONTRACTS.WEEKLY;

  await sendTelegramMessage(`🎲 Starting ${lotteryType} lottery execution`);

  const walletNodes = await getWalletNodes();
  const filteredNodes = filterNodesByType(walletNodes, lotteryType);

  if (filteredNodes.length === 0) {
    await sendTelegramMessage(`⚠️ No suitable nodes found for ${lotteryType} lottery`);
    return;
  }

  for (const [name, address] of Object.entries(relevantContracts)) {
    await sendTelegramMessage(`🎯 Scheduling execution for ${name} at ${address}`);
    await scheduleNextExecution(name, address, filteredNodes);
  }
}

// Main function to start the process
async function main() {
  await sendTelegramMessage('🚀 Starting lottery manager...');
  await executeForAllContracts();

  /* Set up periodic refresh of wallet nodes
  setInterval(async () => {
    await sendTelegramMessage('🔄 Refreshing wallet nodes and schedules...');
    await executeForAllContracts();
  }, 60 * 60 * 1000); // Every hour */
}

// Run the main function
main().catch(async (error) => {
  console.error('Fatal error:', error);
  await sendTelegramMessage(`❌ Fatal error in lottery manager: ${error.message}`);
});
