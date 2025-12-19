/**
 * Test script to debug Pool.lpTotalSupply mismatches
 * Tests lpTotalSupply RPC calls at different blocks
 * 
 * Usage: pnpm ts-node test-lp-total-supply.ts <poolAddress> [chainId]
 * Example: pnpm ts-node test-lp-total-supply.ts 0x1c4d2495f1b9f325cb72c1af0db29985239c68ad 1
 */

import * as dotenv from "dotenv";
dotenv.config();

import { createPublicClient, http, parseAbi } from "viem";
import { mainnet } from "viem/chains";

// Subgraph GraphQL endpoint
const SUBGRAPH_URL = "https://api.goldsky.com/api/public/project_cm55feuq3euos01xjb3w504ls/subgraphs/spectra-mainnet/1.4.0/gn";

// ABIs
const ERC20_ABI = parseAbi([
  "function totalSupply() view returns (uint256)",
  "function decimals() view returns (uint8)",
]);

interface GraphQLResponse {
  data?: {
    pool?: {
      id: string;
      address: string;
      lpTotalSupply: string;
      liquidityToken: {
        address: string;
      };
      createdAtTimestamp: string;
    };
    transactions?: Array<{
      id: string;
      block: string;
      poolInTransaction: {
        id: string;
      };
    }>;
  };
  errors?: Array<{ message: string }>;
}

async function getPoolFromSubgraph(poolAddress: string): Promise<any> {
  const query = `
    query GetPool($address: String!) {
      pools(where: { address: $address }, first: 1) {
        id
        address
        lpTotalSupply
        liquidityToken {
          address
        }
        createdAtTimestamp
      }
    }
  `;

  const response = await fetch(SUBGRAPH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      variables: { address: poolAddress },
    }),
  });

  const result = (await response.json()) as GraphQLResponse;
  
  if (result.errors) {
    console.error("GraphQL errors:", result.errors);
    return null;
  }

  return result.data?.pools?.[0] || null;
}

async function getPoolTransactionsFromSubgraph(poolAddress: string): Promise<any[]> {
  const query = `
    query GetPoolTransactions($poolAddress: String!) {
      transactions(
        where: { poolInTransaction: $poolAddress }
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
      variables: { poolAddress: poolAddress },
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

async function getERC20TotalSupply(tokenAddress: string, chainId: number, blockNumber: number, rpcUrl: string): Promise<bigint> {
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
    const totalSupply = await publicClient.readContract({
      address: tokenAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "totalSupply",
      blockNumber: BigInt(blockNumber),
    });

    return BigInt(totalSupply as bigint | string | number);
  } catch (error) {
    console.warn(`getERC20TotalSupply failed for ${tokenAddress} at block ${blockNumber}:`, error);
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
  const poolAddress = process.argv[2];
  const chainIdArg = process.argv[3];
  
  if (!poolAddress) {
    console.error("Usage: pnpm ts-node test-lp-total-supply.ts <poolAddress> [chainId]");
    console.error("Example: pnpm ts-node test-lp-total-supply.ts 0x1c4d2495f1b9f325cb72c1af0db29985239c68ad 1");
    process.exit(1);
  }

  let chainId = chainIdArg ? parseInt(chainIdArg) : 1;
  
  // Remove chainId prefix if present
  const subgraphPoolAddress = poolAddress.includes("-") && !poolAddress.startsWith("0x")
    ? poolAddress.split("-").slice(1).join("-")
    : poolAddress;

  const rpcUrl = process.env[`ENVIO_RPC_URL_${chainId}`] || process.env.RPC_URL;
  if (!rpcUrl) {
    console.error(`No RPC URL found for chain ${chainId}`);
    process.exit(1);
  }

  console.log(`\n=== Testing LP Total Supply ===`);
  console.log(`Pool Address: ${poolAddress}`);
  console.log(`Chain ID: ${chainId}`);
  console.log(`RPC URL: ${rpcUrl}\n`);

  // Get pool from subgraph
  console.log(`Fetching pool from subgraph: ${subgraphPoolAddress}...`);
  const pool = await getPoolFromSubgraph(subgraphPoolAddress);
  
  if (!pool) {
    console.error("Pool not found in subgraph");
    process.exit(1);
  }

  console.log(`\n=== Subgraph Pool Data ===`);
  console.log(`ID: ${pool.id}`);
  console.log(`Address: ${pool.address}`);
  console.log(`LP Token Address: ${pool.liquidityToken.address}`);
  console.log(`lpTotalSupply: ${pool.lpTotalSupply}`);
  console.log(`Created At: ${pool.createdAtTimestamp}`);

  const lpTokenAddress = pool.liquidityToken.address;
  const latestBlock = await getLatestBlockNumber(chainId, rpcUrl);

  // Get recent transactions for this pool
  console.log(`\nFetching recent transactions for pool...`);
  const transactions = await getPoolTransactionsFromSubgraph(pool.id);
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

  // Estimate creation block from timestamp (rough estimate: 1 block per 12 seconds)
  const createdAtTimestamp = parseInt(pool.createdAtTimestamp);
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const estimatedBlocksAgo = Math.floor((currentTimestamp - createdAtTimestamp) / 12);
  const estimatedCreationBlock = latestBlock - estimatedBlocksAgo;
  if (estimatedCreationBlock > 0) {
    testBlocks.push({ name: "Estimated Creation Block", block: estimatedCreationBlock });
  }

  console.log(`\n=== Testing LP Total Supply at Different Blocks ===`);
  
  for (const testBlock of testBlocks) {
    if (testBlock.block <= 0) continue;
    
    console.log(`\n=== ${testBlock.name} (${testBlock.block}) ===`);
    
    try {
      const [totalSupply, decimals] = await Promise.all([
        getERC20TotalSupply(lpTokenAddress, chainId, testBlock.block, rpcUrl),
        getERC20Decimals(lpTokenAddress, chainId, testBlock.block, rpcUrl),
      ]);

      console.log(`  LP Token Address: ${lpTokenAddress}`);
      console.log(`  Decimals: ${decimals}`);
      console.log(`  RPC totalSupply: ${totalSupply.toString()}`);
      console.log(`  Subgraph lpTotalSupply: ${pool.lpTotalSupply}`);
      
      const subgraphValue = BigInt(pool.lpTotalSupply);
      const diff = totalSupply > subgraphValue 
        ? totalSupply - subgraphValue 
        : subgraphValue - totalSupply;
      const diffPercent = subgraphValue > BigInt(0)
        ? (Number(diff) * 100) / Number(subgraphValue)
        : 0;
      
      console.log(`  Difference: ${diff.toString()} (${diffPercent.toFixed(2)}%)`);
      
      if (totalSupply === subgraphValue) {
        console.log(`  ✅ MATCH!`);
      } else {
        console.log(`  ❌ MISMATCH`);
      }
    } catch (error) {
      console.error(`  Error testing at block ${testBlock.block}:`, error);
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Pool: ${pool.address}`);
  console.log(`LP Token: ${lpTokenAddress}`);
  console.log(`Subgraph lpTotalSupply: ${pool.lpTotalSupply}`);
  console.log(`\nNote: Check if the LP token address is correct.`);
  console.log(`Also verify that lpTotalSupply is being updated correctly on add/remove liquidity events.`);
}

main().catch(console.error);

