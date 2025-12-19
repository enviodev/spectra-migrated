/**
 * Test script to debug AccountAsset.balance = 0 issues
 * Tests AccountAsset entities that should have balances but are 0
 * 
 * Usage: pnpm ts-node test-account-asset-balance.ts <accountAddress> <assetAddress> [chainId]
 * Example: pnpm ts-node test-account-asset-balance.ts 0x00236feeac26ef92552e3981096350d136084c64 0x1202f5c7b4b9e47a1a484e8b270be34dbbc75055 1
 */

import * as dotenv from "dotenv";
dotenv.config();

import { createPublicClient, http, parseAbi } from "viem";
import { mainnet } from "viem/chains";

// Subgraph GraphQL endpoint
const SUBGRAPH_URL = "https://api.goldsky.com/api/public/project_cm55feuq3euos01xjb3w504ls/subgraphs/spectra-mainnet/1.4.0/gn";

// ABIs
const ERC20_ABI = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
]);

const ERC4626_ABI = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function convertToAssets(uint256 shares) view returns (uint256)",
  "function decimals() view returns (uint8)",
]);

interface GraphQLResponse {
  data?: {
    accountAsset?: {
      id: string;
      balance: string;
      asset: {
        address: string;
        type: string;
      };
      account: {
        address: string;
      };
    };
    transactions?: Array<{
      id: string;
      block: string;
      userInTransaction: {
        address: string;
      };
    }>;
  };
  errors?: Array<{ message: string }>;
}

async function getAccountAssetFromSubgraph(accountAddress: string, assetAddress: string): Promise<any> {
  // AccountAsset ID format: accountAddress-assetAddress
  const accountAssetId = `${accountAddress.toLowerCase()}-${assetAddress.toLowerCase()}`;
  
  const query = `
    query GetAccountAsset($id: ID!) {
      accountAsset(id: $id) {
        id
        balance
        asset {
          address
          type
        }
        account {
          address
        }
      }
    }
  `;

  const response = await fetch(SUBGRAPH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      variables: { id: accountAssetId },
    }),
  });

  const result = (await response.json()) as GraphQLResponse;
  
  if (result.errors) {
    console.error("GraphQL errors:", result.errors);
    return null;
  }

  return result.data?.accountAsset || null;
}

async function getAccountTransactionsFromSubgraph(accountAddress: string): Promise<any[]> {
  const query = `
    query GetAccountTransactions($accountAddress: String!) {
      transactions(
        where: { userInTransaction: $accountAddress }
        orderBy: block
        orderDirection: desc
        first: 10
      ) {
        id
        block
      }
    }
  `;

  const response = await fetch(SUBGRAPH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      variables: { accountAddress: accountAddress.toLowerCase() },
    }),
  });

  const result = (await response.json()) as GraphQLResponse;
  
  if (result.errors) {
    console.error("GraphQL errors:", result.errors);
    return [];
  }

  return result.data?.transactions || [];
}

async function getLatestBlockNumber(chainId: number, rpcUrl: string): Promise<number> {
  const publicClient = createPublicClient({
    chain: chainId === 1 ? mainnet : {
      id: chainId,
      name: `Chain ${chainId}`,
      nativeCurrency: { decimals: 18, name: "ETH", symbol: "ETH" },
      rpcUrls: { default: { http: [rpcUrl] } },
    },
    transport: http(rpcUrl, { batch: true }),
  });

  const blockNumber = await publicClient.getBlockNumber();
  return Number(blockNumber);
}

async function getERC20Balance(tokenAddress: string, accountAddress: string, chainId: number, blockNumber: number, rpcUrl: string): Promise<bigint> {
  const publicClient = createPublicClient({
    chain: chainId === 1 ? mainnet : {
      id: chainId,
      name: `Chain ${chainId}`,
      nativeCurrency: { decimals: 18, name: "ETH", symbol: "ETH" },
      rpcUrls: { default: { http: [rpcUrl] } },
    },
    transport: http(rpcUrl, { batch: true }),
  });

  try {
    const balance = await publicClient.readContract({
      address: tokenAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [accountAddress as `0x${string}`],
      blockNumber: BigInt(blockNumber),
    });

    return BigInt(balance as bigint | string | number);
  } catch (error) {
    console.warn(`getERC20Balance failed for ${tokenAddress} at block ${blockNumber}:`, error);
    return BigInt(0);
  }
}

async function getERC4626Balance(tokenAddress: string, accountAddress: string, chainId: number, blockNumber: number, rpcUrl: string): Promise<bigint> {
  const publicClient = createPublicClient({
    chain: chainId === 1 ? mainnet : {
      id: chainId,
      name: `Chain ${chainId}`,
      nativeCurrency: { decimals: 18, name: "ETH", symbol: "ETH" },
      rpcUrls: { default: { http: [rpcUrl] } },
    },
    transport: http(rpcUrl, { batch: true }),
  });

  try {
    const balance = await publicClient.readContract({
      address: tokenAddress as `0x${string}`,
      abi: ERC4626_ABI,
      functionName: "balanceOf",
      args: [accountAddress as `0x${string}`],
      blockNumber: BigInt(blockNumber),
    });

    return BigInt(balance as bigint | string | number);
  } catch (error) {
    console.warn(`getERC4626Balance failed for ${tokenAddress} at block ${blockNumber}:`, error);
    return BigInt(0);
  }
}

async function getERC20Decimals(tokenAddress: string, chainId: number, blockNumber: number, rpcUrl: string): Promise<number> {
  const publicClient = createPublicClient({
    chain: chainId === 1 ? mainnet : {
      id: chainId,
      name: `Chain ${chainId}`,
      nativeCurrency: { decimals: 18, name: "ETH", symbol: "ETH" },
      rpcUrls: { default: { http: [rpcUrl] } },
    },
    transport: http(rpcUrl, { batch: true }),
  });

  try {
    const decimals = await publicClient.readContract({
      address: tokenAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "decimals",
      blockNumber: BigInt(blockNumber),
    });
    return Number(decimals);
  } catch (error) {
    console.warn(`getERC20Decimals failed for ${tokenAddress} at block ${blockNumber}:`, error);
    return 18; // Default to 18
  }
}

async function main() {
  const accountAddress = process.argv[2];
  const assetAddress = process.argv[3];
  const chainIdArg = process.argv[4];
  
  if (!accountAddress || !assetAddress) {
    console.error("Usage: pnpm ts-node test-account-asset-balance.ts <accountAddress> <assetAddress> [chainId]");
    console.error("Example: pnpm ts-node test-account-asset-balance.ts 0x00236feeac26ef92552e3981096350d136084c64 0x1202f5c7b4b9e47a1a484e8b270be34dbbc75055 1");
    process.exit(1);
  }

  let chainId = chainIdArg ? parseInt(chainIdArg) : 1;

  const rpcUrl = process.env[`ENVIO_RPC_URL_${chainId}`] || process.env.RPC_URL;
  if (!rpcUrl) {
    console.error(`No RPC URL found for chain ${chainId}`);
    process.exit(1);
  }

  console.log(`\n=== Testing AccountAsset Balance ===`);
  console.log(`Account Address: ${accountAddress}`);
  console.log(`Asset Address: ${assetAddress}`);
  console.log(`Chain ID: ${chainId}`);
  console.log(`RPC URL: ${rpcUrl}\n`);

  // Get AccountAsset from subgraph
  console.log(`Fetching AccountAsset from subgraph...`);
  const accountAsset = await getAccountAssetFromSubgraph(accountAddress, assetAddress);
  
  if (!accountAsset) {
    console.error("AccountAsset not found in subgraph");
    process.exit(1);
  }

  console.log(`\n=== Subgraph AccountAsset Data ===`);
  console.log(`ID: ${accountAsset.id}`);
  console.log(`Balance: ${accountAsset.balance}`);
  console.log(`Account: ${accountAsset.account.address}`);
  console.log(`Asset: ${accountAsset.asset.address}`);
  console.log(`Asset Type: ${accountAsset.asset.type}`);

  const latestBlock = await getLatestBlockNumber(chainId, rpcUrl);

  // Get recent transactions for this account
  console.log(`\nFetching recent transactions for account...`);
  const transactions = await getAccountTransactionsFromSubgraph(accountAddress);
  console.log(`Found ${transactions.length} recent transactions`);

  // Test at different blocks
  const testBlocks = [
    { name: "Latest Block", block: latestBlock },
  ];

  // Add transaction blocks
  if (transactions.length > 0) {
    transactions.slice(0, 5).forEach((tx, idx) => {
      const blockNum = parseInt(tx.block);
      testBlocks.push({ name: `Transaction ${idx + 1} Block`, block: blockNum });
      if (blockNum > 0) {
        testBlocks.push({ name: `Transaction ${idx + 1} Block - 1`, block: blockNum - 1 });
      }
      testBlocks.push({ name: `Transaction ${idx + 1} Block + 1`, block: blockNum + 1 });
    });
  }

  console.log(`\n=== Testing Balance at Different Blocks ===`);
  
  for (const testBlock of testBlocks) {
    if (testBlock.block <= 0) continue;
    
    console.log(`\n=== ${testBlock.name} (${testBlock.block}) ===`);
    
    try {
      // Try both ERC20 and ERC4626 balance calls
      const [erc20Balance, erc4626Balance, decimals] = await Promise.all([
        getERC20Balance(assetAddress, accountAddress, chainId, testBlock.block, rpcUrl),
        getERC4626Balance(assetAddress, accountAddress, chainId, testBlock.block, rpcUrl),
        getERC20Decimals(assetAddress, chainId, testBlock.block, rpcUrl),
      ]);

      console.log(`  Asset Address: ${assetAddress}`);
      console.log(`  Account Address: ${accountAddress}`);
      console.log(`  Decimals: ${decimals}`);
      console.log(`  RPC ERC20 balanceOf: ${erc20Balance.toString()}`);
      console.log(`  RPC ERC4626 balanceOf: ${erc4626Balance.toString()}`);
      console.log(`  Subgraph balance: ${accountAsset.balance}`);
      
      const subgraphValue = BigInt(accountAsset.balance);
      
      // Check which RPC call matches
      if (erc20Balance === subgraphValue) {
        console.log(`  ✅ ERC20 balanceOf MATCHES subgraph!`);
      } else if (erc4626Balance === subgraphValue) {
        console.log(`  ✅ ERC4626 balanceOf MATCHES subgraph!`);
      } else {
        const erc20Diff = erc20Balance > subgraphValue 
          ? erc20Balance - subgraphValue 
          : subgraphValue - erc20Balance;
        const erc20DiffPercent = subgraphValue > BigInt(0)
          ? (Number(erc20Diff) * 100) / Number(subgraphValue)
          : 0;
        
        const erc4626Diff = erc4626Balance > subgraphValue 
          ? erc4626Balance - subgraphValue 
          : subgraphValue - erc4626Balance;
        const erc4626DiffPercent = subgraphValue > BigInt(0)
          ? (Number(erc4626Diff) * 100) / Number(subgraphValue)
          : 0;
        
        console.log(`  ERC20 difference: ${erc20Diff.toString()} (${erc20DiffPercent.toFixed(2)}%)`);
        console.log(`  ERC4626 difference: ${erc4626Diff.toString()} (${erc4626DiffPercent.toFixed(2)}%)`);
        console.log(`  ❌ Neither RPC call matches subgraph`);
      }
    } catch (error) {
      console.error(`  Error testing at block ${testBlock.block}:`, error);
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Account: ${accountAddress}`);
  console.log(`Asset: ${assetAddress}`);
  console.log(`Asset Type: ${accountAsset.asset.type}`);
  console.log(`Subgraph balance: ${accountAsset.balance}`);
  console.log(`Envio balance: 0 (from comparison log)`);
  console.log(`\nPossible causes:`);
  console.log(`1. RPC call failing and using fallback (existing balance = 0)`);
  console.log(`2. updateAccountAssetBalance() not being called`);
  console.log(`3. Wrong asset type (ERC20 vs ERC4626)`);
  console.log(`4. Wrong block number for RPC call`);
  console.log(`\nCheck:`);
  console.log(`- Are RPC calls failing? Check error logs.`);
  console.log(`- Is updateAccountAssetBalance() called correctly?`);
  console.log(`- Is the correct balance function used (ERC20 vs ERC4626)?`);
  console.log(`- Is the block number correct for historical queries?`);
}

main().catch(console.error);

