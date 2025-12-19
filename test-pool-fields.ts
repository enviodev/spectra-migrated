/**
 * Test script to verify Pool entity field calculations
 * Tests: spotPrice, totalFeeRatio, totalAdminFees
 * 
 * Usage: 
 *   cd envio-spectra-migrated
 *   pnpm ts-node test-pool-fields.ts <poolAddress>
 * 
 * Example:
 *   pnpm ts-node test-pool-fields.ts 0x0e2e7e5692074f406fa4037c8c8c1ace4b6ece32
 */

const { createPublicClient, http, parseAbi } = require("viem");
const { mainnet } = require("viem/chains");
import * as dotenv from "dotenv";
dotenv.config();

// PoolType enum (matching the one in the codebase)
const PoolType = {
  CURVE: "CURVE",
  CURVE_NG: "CURVE_NG",
  CURVE_SNG: "CURVE_SNG",
  UNKNOWN: "UNKNOWN",
};

const SUBGRAPH_ENDPOINT = "https://api.goldsky.com/api/public/project_cm55feuq3euos01xjb3w504ls/subgraphs/spectra-mainnet/1.4.0/gn";

// Pool address to test (from command line or default)
const poolAddress = process.argv[2] || "0x0e2e7e5692074f406fa4037c8c8c1ace4b6ece32";
const chainId = 1; // Mainnet

// ABIs for pool contract calls
const CURVE_POOL_ABI = parseAbi([
  "function last_prices() view returns (uint256)",
  "function fee() view returns (uint256)",
  "function admin_fee() view returns (uint256)",
  "function balances(uint256) view returns (uint256)",
  "function coins(uint256) view returns (address)",
]);

// Import full ABI to correctly parse stored_rates() return value
import CURVE_POOL_SNG_ABI_JSON from "./abis/CurvePoolSNG.json";
const CURVE_POOL_SNG_ABI = CURVE_POOL_SNG_ABI_JSON as any;

// Minimal ABI for other functions
const CURVE_POOL_SNG_ABI_MINIMAL = parseAbi([
  "function fee() view returns (uint256)",
  "function admin_fee() view returns (uint256)",
  "function balances(uint256) view returns (uint256)",
  "function coins(uint256) view returns (address)",
]);

interface PoolData {
  id: string;
  address: string;
  spotPrice: string;
  totalFeeRatio: string;
  totalAdminFees: string;
  type: string;
  feeRate: string;
  adminFeeRate: string;
  futureVault?: string | null;
  ibtAsset: string;
  ptAsset: string;
  createdAtTimestamp: string;
}

interface GraphQLResponse {
  data?: {
    Pool?: Array<PoolData>;
    Transaction?: Array<{
      id: string;
      block: string;
      poolInTransaction: {
        id: string;
      };
    }>;
  };
  errors?: Array<{ message: string }>;
}

/**
 * Get the most recent block number for a pool from the subgraph
 * This gets the block from the most recent transaction that updated the pool
 */
async function getBlockNumberFromSubgraph(poolAddress: string): Promise<number | null> {
  const query = `
    query GetPoolTransactions($poolAddress: String!) {
      transactions(
        where: { poolInTransaction: $poolAddress }
        orderBy: block
        orderDirection: desc
        first: 1
      ) {
        id
        block
      }
    }
  `;

  try {
    const response = await fetch(SUBGRAPH_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        variables: { poolAddress: poolAddress.toLowerCase() },
      }),
    });

    const result = (await response.json()) as GraphQLResponse;
    
    if (result.errors) {
      console.error("GraphQL errors:", result.errors);
      return null;
    }

    if (result.data && (result.data as any).transactions && (result.data as any).transactions.length > 0) {
      return parseInt((result.data as any).transactions[0].block);
    }

    return null;
  } catch (error) {
    console.error("Error fetching block number:", error);
    return null;
  }
}

/**
 * Get all transaction blocks for a pool to find the last update
 */
async function getAllPoolTransactionBlocks(poolId: string): Promise<number[]> {
  const query = `
    query GetPoolTransactions($poolId: String!) {
      transactions(
        where: { poolInTransaction: $poolId }
        orderBy: block
        orderDirection: desc
        first: 20
      ) {
        id
        block
      }
    }
  `;

  try {
    const response = await fetch(SUBGRAPH_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        variables: { poolId: poolId },
      }),
    });

    const result = (await response.json()) as GraphQLResponse;
    
    if (result.errors) {
      console.error("GraphQL errors in getAllPoolTransactionBlocks:", result.errors);
      return [];
    }

    if (result.data && (result.data as any).transactions) {
      return (result.data as any).transactions.map((tx: any) => parseInt(tx.block));
    }

    return [];
  } catch (error) {
    console.error("Error in getAllPoolTransactionBlocks:", error);
    return [];
  }
}

/**
 * Get Pool entity from subgraph
 */
async function getPoolFromSubgraph(poolAddress: string): Promise<PoolData | null> {
  const query = `
    query GetPool($address: String!) {
      pools(where: { address: $address }, first: 1) {
        id
        address
        spotPrice
        totalFeeRatio
        totalAdminFees
        type
        feeRate
        adminFeeRate
        futureVault
        ibtAsset
        ptAsset
        createdAtTimestamp
      }
    }
  `;

  try {
    const response = await fetch(SUBGRAPH_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        variables: { address: poolAddress.toLowerCase() },
      }),
    });

    const result = (await response.json()) as GraphQLResponse;
    
    if (result.errors) {
      console.error("GraphQL errors:", result.errors);
      return null;
    }

    if (result.data && (result.data as any).pools && (result.data as any).pools.length > 0) {
      return (result.data as any).pools[0];
    }

    return null;
  } catch (error) {
    console.error("Error fetching pool:", error);
    return null;
  }
}

/**
 * Get spot price from RPC at a specific block
 */
async function getSpotPriceFromRPC(
  poolAddress: string,
  poolType: string,
  blockNumber: number,
  publicClient: any
): Promise<bigint> {
  const blockNumberBigInt = BigInt(blockNumber);
  const address = poolAddress as `0x${string}`;

  // Check string value (PoolType.CURVE_SNG is just "CURVE_SNG")
  if (poolType === "CURVE_SNG" || poolType === PoolType?.CURVE_SNG) {
    try {
      const [lastPrice, storedRates] = await Promise.all([
        publicClient.readContract({
          address,
          abi: CURVE_POOL_SNG_ABI,
          functionName: "last_price",
          args: [BigInt(0)],
          blockNumber: blockNumberBigInt,
        }),
        publicClient.readContract({
          address,
          abi: CURVE_POOL_SNG_ABI,
          functionName: "stored_rates",
          args: [],
          blockNumber: blockNumberBigInt,
        }),
      ]);

      if (storedRates[0] > BigInt(0)) {
        const result = (storedRates[1] * lastPrice) / storedRates[0];
        return BigInt(result.toString());
      }
      return BigInt(0);
    } catch (error) {
      console.error(`Error getting spot price for CURVE_SNG:`, error);
      return BigInt(0);
    }
  } else {
    try {
      const lastPrices = await publicClient.readContract({
        address,
        abi: CURVE_POOL_ABI,
        functionName: "last_prices",
        blockNumber: blockNumberBigInt,
      });
      return lastPrices;
    } catch (error) {
      console.error(`Error getting spot price for ${poolType}:`, error);
      return BigInt(0);
    }
  }
}

/**
 * Main test function
 */
async function main() {
  console.log(`\n=== Testing Pool Fields for ${poolAddress} ===\n`);

  // Get RPC URL
  const rpcUrl = process.env[`ENVIO_RPC_URL_${chainId}`] || process.env.RPC_URL;
  if (!rpcUrl) {
    console.error(`No RPC URL found for chain ${chainId}`);
    console.error("Set ENVIO_RPC_URL_1 or RPC_URL environment variable");
    process.exit(1);
  }

  // Create public client
  const publicClient = createPublicClient({
    chain: mainnet,
    transport: http(rpcUrl, { batch: true }),
  }) as any;
  
  // Get latest block info for timestamp estimation
  let latestBlockInfo: any = null;
  try {
    const latestBlock = await publicClient.getBlockNumber();
    latestBlockInfo = await publicClient.getBlock({ blockNumber: latestBlock });
  } catch (error) {
    console.warn("Could not get latest block info");
  }

  // 1. Get Pool from subgraph
  console.log("1. Fetching Pool from subgraph...");
  const subgraphPool = await getPoolFromSubgraph(poolAddress);
  if (!subgraphPool) {
    console.error("Pool not found in subgraph");
    process.exit(1);
  }

  console.log(`   Pool ID: ${subgraphPool.id}`);
  console.log(`   Pool Type: ${subgraphPool.type}`);
  console.log(`   Created At Timestamp: ${subgraphPool.createdAtTimestamp}`);
  console.log(`   Subgraph spotPrice: ${subgraphPool.spotPrice}`);
  console.log(`   Subgraph totalFeeRatio: ${subgraphPool.totalFeeRatio}`);
  console.log(`   Subgraph totalAdminFees: ${subgraphPool.totalAdminFees}`);
  
  // Try to get the block number from createdAtTimestamp
  let creationBlock: number | null = null;
  if (latestBlockInfo) {
    try {
      // Estimate block from timestamp
      const timestamp = parseInt(subgraphPool.createdAtTimestamp);
      const latestBlockNum = Number(await publicClient.getBlockNumber());
      const latestBlockTimestamp = Number(latestBlockInfo.timestamp);
      const secondsPerBlock = 12; // Rough estimate for Ethereum
      const blocksAgo = Math.floor((latestBlockTimestamp - timestamp) / secondsPerBlock);
      creationBlock = Math.max(1, latestBlockNum - blocksAgo);
      console.log(`   Estimated creation block: ${creationBlock} (from timestamp ${timestamp})`);
    } catch (error) {
      console.log(`   Could not estimate creation block: ${(error as Error).message}`);
    }
  }

  // 2. Get block numbers from all recent transactions (these are when the pool was updated)
  console.log("\n2. Fetching transaction blocks from subgraph (pool update blocks)...");
  const allBlocks = await getAllPoolTransactionBlocks(subgraphPool.id);
  if (allBlocks.length === 0) {
    console.error("Could not get transaction blocks from subgraph");
    // Fallback to single block query
    const singleBlock = await getBlockNumberFromSubgraph(poolAddress);
    if (!singleBlock) {
      console.error("Could not get any block number from subgraph");
      process.exit(1);
    }
    allBlocks.push(singleBlock);
    console.log(`   Using fallback: block ${singleBlock}`);
  } else {
    console.log(`   Found ${allBlocks.length} recent pool update transactions`);
    console.log(`   Blocks (most recent first): ${allBlocks.join(", ")}`);
  }
  const mostRecentUpdateBlock = allBlocks[0]; // Most recent update
  console.log(`   Most recent pool update block: ${mostRecentUpdateBlock}`);
  console.log(`   This is the block where the pool entity was last updated.`);

  // 3. Test spotPrice RPC call - try different blocks to find match
  console.log("\n3. Testing spotPrice RPC call at different blocks...");
  console.log(`   Subgraph spotPrice: ${subgraphPool.spotPrice}`);
  console.log(`   Pool Type: ${subgraphPool.type}`);
  console.log(`   Most recent pool update block: ${mostRecentUpdateBlock}`);
  
  // Get latest block
  const latestBlock = await publicClient.getBlockNumber();
  const latestBlockNum = Number(latestBlock);
  console.log(`   Latest block: ${latestBlockNum}`);
  
  // First, verify we're using the correct poolType
  console.log(`\n   Verifying poolType: ${subgraphPool.type}`);
  console.log(`   Testing with all possible pool types to see if type mismatch is the issue...`);
  
  // Test with all pool types to see if we get a match
  const poolTypesToTest = ["CURVE_SNG", "CURVE_NG", "CURVE", "UNKNOWN"];
  let foundBlock: number | null = null;
  let foundPoolType: string | null = null;
  
  for (const testPoolType of poolTypesToTest) {
    console.log(`\n   Testing with poolType: ${testPoolType}`);
    try {
      const testSpotPrice = await getSpotPriceFromRPC(
        poolAddress,
        testPoolType,
        mostRecentUpdateBlock,
        publicClient
      );
      console.log(`   Result: ${testSpotPrice.toString()}`);
      if (testSpotPrice.toString() === subgraphPool.spotPrice) {
        foundBlock = mostRecentUpdateBlock;
        foundPoolType = testPoolType;
        console.log(`   ✅ MATCH FOUND with poolType ${testPoolType} at block ${mostRecentUpdateBlock}!`);
        console.log(`   ⚠️  The subgraph type "${subgraphPool.type}" might be incorrect, actual type is "${testPoolType}"`);
        break;
      } else {
        const diff = BigInt(subgraphPool.spotPrice) - testSpotPrice;
        const diffPercent = (Number(diff) / Number(BigInt(subgraphPool.spotPrice))) * 100;
        console.log(`   Diff: ${diffPercent.toFixed(2)}%`);
      }
    } catch (error) {
      // Suppress expected errors for wrong pool types
      const errorMsg = (error as Error).message;
      if (errorMsg.includes("reverted") || errorMsg.includes("last_prices")) {
        console.log(`   Expected error (wrong pool type): function not available for this pool`);
      } else {
        console.log(`   Error with ${testPoolType}: ${errorMsg}`);
      }
    }
  }
  
  // If no match with different types, try all transaction blocks with the subgraph's type
  if (!foundBlock) {
    console.log(`\n   No match with different pool types. Trying all transaction blocks with subgraph type "${subgraphPool.type}"...`);
    for (const txBlock of allBlocks) {
      try {
        const testSpotPrice = await getSpotPriceFromRPC(
          poolAddress,
          subgraphPool.type,
          txBlock,
          publicClient
        );
        const diff = BigInt(subgraphPool.spotPrice) - testSpotPrice;
        const diffPercent = (Number(diff) / Number(BigInt(subgraphPool.spotPrice))) * 100;
        console.log(`   Block ${txBlock}: ${testSpotPrice.toString()} (diff: ${diffPercent.toFixed(2)}%)`);
        if (testSpotPrice.toString() === subgraphPool.spotPrice) {
          foundBlock = txBlock;
          foundPoolType = subgraphPool.type;
          console.log(`   ✅ MATCH FOUND at block ${txBlock}!`);
          break;
        }
      } catch (error) {
        console.log(`   Block ${txBlock}: Error - ${(error as Error).message}`);
      }
    }
  }
  
  // Also test with detailed debug for CURVE_SNG at the most recent update block
  const poolTypeToUse = foundPoolType || subgraphPool.type;
  if (poolTypeToUse === "CURVE_SNG" && !foundBlock) {
    console.log(`\n   Debugging CURVE_SNG calculation at most recent update block ${mostRecentUpdateBlock}...`);
    console.log(`   Testing different last_price() index values (i parameter: 0 or 1)...`);
    try {
      const [lastPrice0, lastPrice1, storedRates] = await Promise.all([
        publicClient.readContract({
          address: poolAddress as `0x${string}`,
          abi: CURVE_POOL_SNG_ABI,
          functionName: "last_price",
          args: [BigInt(0)],
          blockNumber: BigInt(mostRecentUpdateBlock),
        }).catch(() => BigInt(0)),
        publicClient.readContract({
          address: poolAddress as `0x${string}`,
          abi: CURVE_POOL_SNG_ABI,
          functionName: "last_price",
          args: [BigInt(1)],
          blockNumber: BigInt(mostRecentUpdateBlock),
        }).catch(() => BigInt(0)),
        publicClient.readContract({
          address: poolAddress as `0x${string}`,
          abi: CURVE_POOL_SNG_ABI,
          functionName: "stored_rates",
          args: [],
          blockNumber: BigInt(mostRecentUpdateBlock),
        }).catch(() => [BigInt(0), BigInt(0)] as bigint[]),
      ]);

      // Type assertions
      const lastPrice0BigInt = BigInt(lastPrice0 as bigint | string | number);
      const lastPrice1BigInt = BigInt(lastPrice1 as bigint | string | number);
      const storedRatesArray = storedRates as bigint[];
      
      console.log(`   last_price(0): ${lastPrice0BigInt.toString()}`);
      console.log(`   last_price(1): ${lastPrice1BigInt.toString()}`);
      console.log(`   stored_rates[0]: ${storedRatesArray[0].toString()}`);
      console.log(`   stored_rates[1]: ${storedRatesArray[1].toString()}`);
      
      // Test all possible calculations
      console.log(`\n   Testing all possible calculations...`);
      const calculations = [
        { name: "storedRates[1] * lastPrice(0) / storedRates[0]", calc: () => storedRatesArray[0] > BigInt(0) ? (storedRatesArray[1] * lastPrice0BigInt) / storedRatesArray[0] : BigInt(0) },
        { name: "storedRates[1] * lastPrice(1) / storedRates[0]", calc: () => storedRatesArray[0] > BigInt(0) ? (storedRatesArray[1] * lastPrice1BigInt) / storedRatesArray[0] : BigInt(0) },
        { name: "storedRates[0] * lastPrice(0) / storedRates[1]", calc: () => storedRatesArray[1] > BigInt(0) ? (storedRatesArray[0] * lastPrice0BigInt) / storedRatesArray[1] : BigInt(0) },
        { name: "storedRates[0] * lastPrice(1) / storedRates[1]", calc: () => storedRatesArray[1] > BigInt(0) ? (storedRatesArray[0] * lastPrice1BigInt) / storedRatesArray[1] : BigInt(0) },
        { name: "lastPrice(0) directly", calc: () => lastPrice0BigInt },
        { name: "lastPrice(1) directly", calc: () => lastPrice1BigInt },
        { name: "storedRates[1] directly", calc: () => storedRatesArray[1] },
        { name: "storedRates[0] directly", calc: () => storedRatesArray[0] },
      ];
      
      for (const calc of calculations) {
        try {
          const result = calc.calc();
          const match = result.toString() === subgraphPool.spotPrice;
          console.log(`   ${calc.name}: ${result.toString()} ${match ? "✅ MATCH!" : ""}`);
          if (match) {
            foundBlock = mostRecentUpdateBlock;
            console.log(`   ✅ FOUND MATCHING CALCULATION: ${calc.name}`);
          }
        } catch (error) {
          // Skip invalid calculations
        }
      }
      
      // If no match, try testing at each update block with different indices
      if (!foundBlock) {
        console.log(`\n   Testing at each pool update block with different indices and calculations...`);
        for (const updateBlock of allBlocks) {
          try {
            const [lp0, lp1, sr] = await Promise.all([
              publicClient.readContract({
                address: poolAddress as `0x${string}`,
                abi: CURVE_POOL_SNG_ABI,
                functionName: "last_price",
                args: [BigInt(0)],
                blockNumber: BigInt(updateBlock),
              }).catch(() => BigInt(0)),
              publicClient.readContract({
                address: poolAddress as `0x${string}`,
                abi: CURVE_POOL_SNG_ABI,
                functionName: "last_price",
                args: [BigInt(1)],
                blockNumber: BigInt(updateBlock),
              }).catch(() => BigInt(0)),
              publicClient.readContract({
                address: poolAddress as `0x${string}`,
                abi: CURVE_POOL_SNG_ABI,
                functionName: "stored_rates",
                args: [],
                blockNumber: BigInt(updateBlock),
              }).catch(() => [BigInt(0), BigInt(0)] as bigint[]),
            ]);

            // Type assertions
            const lp0BigInt = BigInt(lp0 as bigint | string | number);
            const lp1BigInt = BigInt(lp1 as bigint | string | number);
            const srArray = sr as bigint[];
            
            // Test all combinations
            const testCalcs = [
              { name: "storedRates[1] * lastPrice(0) / storedRates[0]", value: srArray[0] > BigInt(0) ? (srArray[1] * lp0BigInt) / srArray[0] : BigInt(0) },
              { name: "storedRates[1] * lastPrice(1) / storedRates[0]", value: srArray[0] > BigInt(0) ? (srArray[1] * lp1BigInt) / srArray[0] : BigInt(0) },
              { name: "lastPrice(0) directly", value: lp0BigInt },
              { name: "lastPrice(1) directly", value: lp1BigInt },
              { name: "storedRates[1] directly", value: srArray[1] },
            ];
            
            for (const testCalc of testCalcs) {
              if (testCalc.value.toString() === subgraphPool.spotPrice) {
                console.log(`   ✅ MATCH FOUND at block ${updateBlock} with: ${testCalc.name}!`);
                foundBlock = updateBlock;
                break;
              }
            }
            
            if (foundBlock) break;
          } catch (error) {
            continue;
          }
        }
      }
    } catch (error) {
      console.error(`   Error in debug calculation:`, error);
    }
  }
  
  // Try creation block (subgraph might store spotPrice from pool creation)
  if (!foundBlock && creationBlock) {
    console.log(`\n   Trying estimated creation block: ${creationBlock} with poolType: ${poolTypeToUse}`);
    try {
      const creationSpotPrice = await getSpotPriceFromRPC(
        poolAddress,
        poolTypeToUse,
        creationBlock,
        publicClient
      );
      console.log(`   RPC spotPrice: ${creationSpotPrice.toString()}`);
      if (creationSpotPrice.toString() === subgraphPool.spotPrice) {
        foundBlock = creationBlock;
        foundPoolType = poolTypeToUse;
        console.log(`   ✅ MATCH FOUND at creation block ${creationBlock}!`);
        console.log(`   ⚠️  This means subgraph stores spotPrice from pool creation!`);
      } else {
        const diff = BigInt(subgraphPool.spotPrice) - creationSpotPrice;
        const diffPercent = (Number(diff) / Number(BigInt(subgraphPool.spotPrice))) * 100;
        console.log(`   ❌ No match (diff: ${diffPercent.toFixed(2)}%)`);
      }
    } catch (error) {
      console.log(`   Error testing creation block: ${(error as Error).message}`);
    }
  }
  
  // Try latest block (subgraph might store latest value)
  if (!foundBlock) {
    console.log(`\n   Trying latest block: ${latestBlockNum} with poolType: ${poolTypeToUse}`);
    const latestSpotPrice = await getSpotPriceFromRPC(
      poolAddress,
      poolTypeToUse,
      latestBlockNum,
      publicClient
    );
    console.log(`   RPC spotPrice: ${latestSpotPrice.toString()}`);
    if (latestSpotPrice.toString() === subgraphPool.spotPrice) {
      foundBlock = latestBlockNum;
      foundPoolType = poolTypeToUse;
      console.log(`   ✅ MATCH FOUND at latest block ${latestBlockNum}!`);
      console.log(`   ⚠️  This means subgraph stores LATEST spotPrice, not historical!`);
    } else {
      console.log(`   ❌ No match`);
    }
  }

  // Try blocks around most recent update block (±10, ±100, ±1000, ±10000)
  if (!foundBlock) {
    const blocksToTry = [
      mostRecentUpdateBlock - 10,
      mostRecentUpdateBlock - 100,
      mostRecentUpdateBlock - 1000,
      mostRecentUpdateBlock - 10000,
      mostRecentUpdateBlock + 10,
      mostRecentUpdateBlock + 100,
      mostRecentUpdateBlock + 1000,
      mostRecentUpdateBlock + 10000,
    ].filter(b => b > 0);

    console.log(`\n   Trying blocks around most recent update block (±10, ±100, ±1000, ±10000)...`);
  for (const testBlock of blocksToTry) {
    try {
      const testSpotPrice = await getSpotPriceFromRPC(
        poolAddress,
        subgraphPool.type,
        testBlock,
        publicClient
      );
      if (testSpotPrice.toString() === subgraphPool.spotPrice) {
        foundBlock = testBlock;
        console.log(`   ✅ MATCH FOUND at block ${testBlock}!`);
        break;
      }
    } catch (error) {
      // Skip blocks that don't exist
      continue;
    }
  }

    // If not found, try a wider search from latest block backwards
    if (!foundBlock) {
      console.log(`\n   Trying blocks from latest backwards (searching last 50k blocks)...`);
      const latestBlockNum = Number(await publicClient.getBlockNumber());
      const targetPrice = BigInt(subgraphPool.spotPrice);
      
      // Search backwards from latest block in chunks
      const chunkSize = 5000;
      const maxBlocksToSearch = 50000;
      let searchStart = latestBlockNum;
      let searchEnd = Math.max(1, latestBlockNum - maxBlocksToSearch);
      
      // Sample blocks in chunks
      for (let chunkStart = searchStart; chunkStart >= searchEnd && !foundBlock; chunkStart -= chunkSize) {
        const chunkEnd = Math.max(searchEnd, chunkStart - chunkSize);
        const sampleBlocks = [
          chunkStart,
          chunkStart - Math.floor(chunkSize / 4),
          chunkStart - Math.floor(chunkSize / 2),
          chunkStart - Math.floor(3 * chunkSize / 4),
          chunkEnd,
        ].filter(b => b > 0 && b <= latestBlockNum);
        
        for (const searchBlock of sampleBlocks) {
          try {
            const searchSpotPrice = await getSpotPriceFromRPC(
              poolAddress,
              subgraphPool.type,
              searchBlock,
              publicClient
            );
            if (searchSpotPrice === targetPrice) {
              foundBlock = searchBlock;
              console.log(`   ✅ MATCH FOUND at block ${foundBlock}!`);
              break;
            }
          } catch (error) {
            continue;
          }
        }
      }
    }
  }

  if (!foundBlock) {
    console.log(`\n   ❌ No matching block found. This suggests:`);
    console.log(`      - The subgraph might be storing a calculated/modified value`);
    console.log(`      - The subgraph might be using a different calculation method`);
    console.log(`      - The value might be from a block outside our search range`);
    console.log(`      - The subgraph value might be incorrect`);
  } else {
    console.log(`\n   ✅ Found matching block: ${foundBlock}`);
    console.log(`   This is the block the subgraph is using for spotPrice.`);
  }

  // 4. Test fee() and admin_fee() RPC calls (using most recent update block)
  console.log("\n4. Testing fee() and admin_fee() RPC calls...");
  try {
    const abi = subgraphPool.type === "CURVE_SNG" ? CURVE_POOL_SNG_ABI : CURVE_POOL_ABI;
    const blockNumberBigInt = BigInt(mostRecentUpdateBlock);
    const [fee, adminFee] = await Promise.all([
      publicClient.readContract({
        address: poolAddress as `0x${string}`,
        abi,
        functionName: "fee",
        blockNumber: blockNumberBigInt,
      }) as Promise<bigint>,
      publicClient.readContract({
        address: poolAddress as `0x${string}`,
        abi,
        functionName: "admin_fee",
        blockNumber: blockNumberBigInt,
      }) as Promise<bigint>,
    ]);
    console.log(`   RPC fee() (at block ${mostRecentUpdateBlock}): ${fee.toString()}`);
    console.log(`   Subgraph feeRate: ${subgraphPool.feeRate}`);
    console.log(`   Match: ${fee.toString() === subgraphPool.feeRate ? "✅" : "❌"}`);
    console.log(`   RPC admin_fee() (at block ${mostRecentUpdateBlock}): ${adminFee.toString()}`);
    console.log(`   Subgraph adminFeeRate: ${subgraphPool.adminFeeRate}`);
    console.log(`   Match: ${adminFee.toString() === subgraphPool.adminFeeRate ? "✅" : "❌"}`);
  } catch (error) {
    console.error("   Error fetching fee/admin_fee:", error);
  }

  // 5. Get pool balances (using most recent update block)
  console.log("\n5. Testing pool balances RPC calls...");
  try {
    const abi = subgraphPool.type === "CURVE_SNG" ? CURVE_POOL_SNG_ABI : CURVE_POOL_ABI;
    const blockNumberBigInt = BigInt(mostRecentUpdateBlock);
    const [ibtBalance, ptBalance] = await Promise.all([
      publicClient.readContract({
        address: poolAddress as `0x${string}`,
        abi,
        functionName: "balances",
        args: [BigInt(0)],
        blockNumber: blockNumberBigInt,
      }) as Promise<bigint>,
      publicClient.readContract({
        address: poolAddress as `0x${string}`,
        abi,
        functionName: "balances",
        args: [BigInt(1)],
        blockNumber: blockNumberBigInt,
      }) as Promise<bigint>,
    ]);
    console.log(`   IBT Balance (at block ${mostRecentUpdateBlock}): ${ibtBalance.toString()}`);
    console.log(`   PT Balance (at block ${mostRecentUpdateBlock}): ${ptBalance.toString()}`);
  } catch (error) {
    console.error("   Error fetching balances:", error);
  }

  console.log("\n=== Test Complete ===\n");
  console.log("Note: totalFeeRatio and totalAdminFees are accumulated values");
  console.log("from multiple transactions, so they cannot be verified with a single RPC call.");
  console.log("If spotPrice matches but totalFeeRatio/totalAdminFees don't, the issue is");
  console.log("likely in the calculation/accumulation logic in the handlers.\n");
}

main().catch(console.error);

