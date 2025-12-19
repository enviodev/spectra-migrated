/**
 * Comprehensive test script to verify effect calls for all field mismatches
 * 
 * This script:
 * 1. Queries the subgraph for entities with mismatches to get their values
 * 2. Gets block numbers from related transactions or uses timestamp estimation
 * 3. Tests the corresponding RPC calls at those block numbers
 * 4. Compares results to identify if the issue is in our effect calls
 */

import { createPublicClient, http, parseAbi } from "viem";
import { mainnet } from "viem/chains";
import * as dotenv from "dotenv";
dotenv.config();

const SUBGRAPH_URL = "https://api.goldsky.com/api/public/project_cm55feuq3euos01xjb3w504ls/subgraphs/spectra-mainnet/1.4.0/gn";

// Test cases extracted from comparison log - focusing on effect-based fields
const TEST_CASES = {
  // AccountAsset balance mismatches (uses getERC4626Balance or getERC20Balance)
  accountAsset: [
    {
      id: "0x000001ac4e512d670c34fedf6c71ce2f49fb160a-0x1202f5c7b4b9e47a1a484e8b270be34dbbc75055",
      accountAddress: "0x000001ac4e512d670c34fedf6c71ce2f49fb160a",
      assetAddress: "0x1202f5c7b4b9e47a1a484e8b270be34dbbc75055",
      expectedBalance: "938297773993114380",
      envioBalance: "0",
    },
    {
      id: "0x0000fdc9f77e5386f260501c34a4a93314ccba2e-0x1202f5c7b4b9e47a1a484e8b270be34dbbc75055",
      accountAddress: "0x0000fdc9f77e5386f260501c34a4a93314ccba2e",
      assetAddress: "0x1202f5c7b4b9e47a1a484e8b270be34dbbc75055",
      expectedBalance: "269509283248156",
      envioBalance: "5496105435196988687",
    },
    {
      id: "0x001005306685021a4edaf9de69c9b5b2a34c4caa-0x1202f5c7b4b9e47a1a484e8b270be34dbbc75055",
      accountAddress: "0x001005306685021a4edaf9de69c9b5b2a34c4caa",
      assetAddress: "0x1202f5c7b4b9e47a1a484e8b270be34dbbc75055",
      expectedBalance: "4758478017629002395935",
      envioBalance: "0",
    },
    {
      id: "0x00236feeac26ef92552e3981096350d136084c64-0x1202f5c7b4b9e47a1a484e8b270be34dbbc75055",
      accountAddress: "0x00236feeac26ef92552e3981096350d136084c64",
      assetAddress: "0x1202f5c7b4b9e47a1a484e8b270be34dbbc75055",
      expectedBalance: "940199519721420872132",
      envioBalance: "0",
    },
  ],
  // Pool spotPrice mismatches (uses getPoolLastPrices)
  poolSpotPrice: [
    {
      id: "0x0c15c823c614c77f09ef90d35a71b6616070a22a",
      poolAddress: "0x0c15c823c614c77f09ef90d35a71b6616070a22a",
      expectedSpotPrice: "856768881863617099",
      envioSpotPrice: "62514691743306808",
    },
    {
      id: "0x0e2e7e5692074f406fa4037c8c8c1ace4b6ece32",
      poolAddress: "0x0e2e7e5692074f406fa4037c8c8c1ace4b6ece32",
      expectedSpotPrice: "916085129432855534",
      envioSpotPrice: "62512229622673647",
    },
    {
      id: "0x1618f07908d5c9875478d74e26127b763e7be271",
      poolAddress: "0x1618f07908d5c9875478d74e26127b763e7be271",
      expectedSpotPrice: "8740094368637974",
      envioSpotPrice: "63521086333324513",
    },
  ],
  // Pool feeRate mismatches (uses getPoolFee)
  poolFeeRate: [
    {
      id: "0x0e2e7e5692074f406fa4037c8c8c1ace4b6ece32",
      poolAddress: "0x0e2e7e5692074f406fa4037c8c8c1ace4b6ece32",
      expectedFeeRate: "10398814",
      envioFeeRate: "11318549",
    },
  ],
};

// ABIs
const ERC20_ABI = parseAbi([
  "function balanceOf(address account) view returns (uint256)",
]);

const ERC4626_ABI = parseAbi([
  "function balanceOf(address account) view returns (uint256)",
]);

const CURVE_POOL_ABI = parseAbi([
  "function last_prices() view returns (uint256)",
  "function fee() view returns (uint256)",
]);

const CURVE_POOL_SNG_ABI = parseAbi([
  "function last_price(uint256) view returns (uint256)",
  "function stored_rates() view returns (uint256[2])",
]);

interface GraphQLResponse {
  data?: any;
  errors?: Array<{ message: string; [key: string]: any }>;
}

async function querySubgraph(query: string): Promise<any> {
  const response = await fetch(SUBGRAPH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    throw new Error(`Subgraph query failed: ${response.statusText}`);
  }

  const data = await response.json() as GraphQLResponse;
  if (data.errors) {
    throw new Error(`Subgraph query errors: ${JSON.stringify(data.errors)}`);
  }

  return data.data;
}

async function getBlockNumberFromTransaction(
  accountAddress: string | null,
  assetAddress: string | null,
  poolAddress: string | null
): Promise<bigint | null> {
  // Query subgraph for the most recent transaction involving these entities to get block number
  let query = "";
  
  if (accountAddress && assetAddress) {
    // Query for AccountAsset-related transaction
    // Note: Subgraph uses address (Bytes) not ID for userInTransaction
    query = `
      query {
        transactions(
          first: 1,
          orderBy: block,
          orderDirection: desc,
          where: {
            userInTransaction: "${accountAddress.toLowerCase()}"
          }
        ) {
          block
          amountsIn {
            asset {
              address
            }
          }
          amountsOut {
            asset {
              address
            }
          }
        }
      }
    `;
  } else if (poolAddress) {
    // Query for Pool-related transaction
    // Note: Subgraph uses address (Bytes) not ID for poolInTransaction
    query = `
      query {
        transactions(
          first: 1,
          orderBy: block,
          orderDirection: desc,
          where: {
            poolInTransaction: "${poolAddress.toLowerCase()}"
          }
        ) {
          block
        }
      }
    `;
  }
  
  if (!query) return null;
  
  try {
    const data = await querySubgraph(query);
    const transactions = data.transactions;
    if (transactions && transactions.length > 0) {
      // For accountAsset, verify the transaction involves the correct asset
      if (accountAddress && assetAddress) {
        const tx = transactions[0];
        const involvesAsset = tx.amountsIn?.some((amt: any) => 
          amt.asset?.address?.toLowerCase() === assetAddress.toLowerCase()
        ) || tx.amountsOut?.some((amt: any) => 
          amt.asset?.address?.toLowerCase() === assetAddress.toLowerCase()
        );
        if (!involvesAsset) {
          return null;
        }
      }
      
      if (transactions[0].block) {
        return BigInt(transactions[0].block);
      }
    }
  } catch (error: any) {
    // Silently fail - we'll use latest block as fallback
    console.log(`    ⚠️  Could not query transaction block: ${error.message}`);
  }
  
  return null;
}

async function testAccountAssetBalance(
  accountAddress: string,
  assetAddress: string,
  expectedBalance: string,
  envioBalance: string,
  blockNumber: bigint | null
) {
  const rpcUrl = process.env.ENVIO_RPC_URL_1 || process.env.RPC_URL;
  if (!rpcUrl) {
    console.error("Please set ENVIO_RPC_URL_1 or RPC_URL environment variable");
    return;
  }

  const publicClient = createPublicClient({
    chain: mainnet,
    transport: http(rpcUrl, { batch: true }),
  });

  console.log(`\n  Testing balance for account ${accountAddress}, asset ${assetAddress}`);
  if (blockNumber) {
    console.log(`    At block: ${blockNumber.toString()}`);
  } else {
    console.log(`    At latest block`);
  }

  try {
    // Try ERC4626 first (for IBT assets)
    let balance: bigint;
    let usedERC4626 = false;
    
    try {
      balance = await publicClient.readContract({
        address: assetAddress as `0x${string}`,
        abi: ERC4626_ABI,
        functionName: "balanceOf",
        args: [accountAddress as `0x${string}`],
        blockNumber: blockNumber || undefined,
      });
      usedERC4626 = true;
    } catch {
      // Fallback to ERC20
      balance = await publicClient.readContract({
        address: assetAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [accountAddress as `0x${string}`],
        blockNumber: blockNumber || undefined,
      });
    }

    const balanceStr = balance.toString();
    const expectedStr = expectedBalance;
    const envioStr = envioBalance;
    const matchExpected = balanceStr === expectedStr;
    const matchEnvio = balanceStr === envioStr;

    console.log(`    ✅ RPC call succeeded (${usedERC4626 ? "ERC4626" : "ERC20"})`);
    console.log(`    Subgraph expected: ${expectedStr}`);
    console.log(`    Envio stored:      ${envioStr}`);
    console.log(`    RPC result:       ${balanceStr}`);
    console.log(`    Match subgraph:   ${matchExpected ? "✅ YES" : "❌ NO"}`);
    console.log(`    Match Envio:      ${matchEnvio ? "✅ YES" : "❌ NO"}`);
    
    if (!matchExpected) {
      const diff = Math.abs(Number(balance) - Number(expectedBalance));
      const diffPercent = (diff / Number(expectedBalance)) * 100;
      console.log(`    Diff from subgraph: ${diff} (${diffPercent.toFixed(2)}%)`);
    }
    
    if (matchExpected && !matchEnvio) {
      console.log(`    ⚠️  RPC matches subgraph but Envio has wrong value - likely cache or logic issue`);
    } else if (!matchExpected && matchEnvio) {
      console.log(`    ⚠️  RPC matches Envio but subgraph has different value - check block number`);
    } else if (!matchExpected && !matchEnvio) {
      console.log(`    ⚠️  All three differ - need to investigate further`);
    }
  } catch (error: any) {
    console.log(`    ❌ RPC call failed: ${error.message}`);
    if (error.shortMessage) {
      console.log(`       ${error.shortMessage}`);
    }
  }
}

async function testPoolSpotPrice(
  poolAddress: string,
  expectedSpotPrice: string,
  envioSpotPrice: string,
  poolType: string = "CURVE",
  blockNumber: bigint | null
) {
  const rpcUrl = process.env.ENVIO_RPC_URL_1 || process.env.RPC_URL;
  if (!rpcUrl) {
    console.error("Please set ENVIO_RPC_URL_1 or RPC_URL environment variable");
    return;
  }

  const publicClient = createPublicClient({
    chain: mainnet,
    transport: http(rpcUrl, { batch: true }),
  });

  console.log(`\n  Testing spotPrice for pool ${poolAddress} (${poolType})`);
  if (blockNumber) {
    console.log(`    At block: ${blockNumber.toString()}`);
  } else {
    console.log(`    At latest block`);
  }

  try {
    let spotPrice: bigint;

    if (poolType === "CURVE_SNG") {
      const [lastPrice, storedRates] = await Promise.all([
        publicClient.readContract({
          address: poolAddress as `0x${string}`,
          abi: CURVE_POOL_SNG_ABI,
          functionName: "last_price",
          args: [BigInt(0)],
          blockNumber: blockNumber || undefined,
        }),
        publicClient.readContract({
          address: poolAddress as `0x${string}`,
          abi: CURVE_POOL_SNG_ABI,
          functionName: "stored_rates",
          blockNumber: blockNumber || undefined,
        }),
      ]);

      if (storedRates[0] > BigInt(0)) {
        spotPrice = (storedRates[1] * lastPrice) / storedRates[0];
      } else {
        spotPrice = BigInt(0);
      }
    } else {
      spotPrice = await publicClient.readContract({
        address: poolAddress as `0x${string}`,
        abi: CURVE_POOL_ABI,
        functionName: "last_prices",
        blockNumber: blockNumber || undefined,
      });
    }

    const spotPriceStr = spotPrice.toString();
    const expectedStr = expectedSpotPrice;
    const envioStr = envioSpotPrice;
    const matchExpected = spotPriceStr === expectedStr;
    const matchEnvio = spotPriceStr === envioStr;

    console.log(`    ✅ RPC call succeeded`);
    console.log(`    Subgraph expected: ${expectedStr}`);
    console.log(`    Envio stored:      ${envioStr}`);
    console.log(`    RPC result:       ${spotPriceStr}`);
    console.log(`    Match subgraph:   ${matchExpected ? "✅ YES" : "❌ NO"}`);
    console.log(`    Match Envio:      ${matchEnvio ? "✅ YES" : "❌ NO"}`);
    
    if (!matchExpected) {
      const diff = Math.abs(Number(spotPrice) - Number(expectedSpotPrice));
      const diffPercent = (diff / Number(expectedSpotPrice)) * 100;
      console.log(`    Diff from subgraph: ${diff} (${diffPercent.toFixed(2)}%)`);
    }
    
    if (matchExpected && !matchEnvio) {
      console.log(`    ⚠️  RPC matches subgraph but Envio has wrong value - likely cache or logic issue`);
    } else if (!matchExpected && matchEnvio) {
      console.log(`    ⚠️  RPC matches Envio but subgraph has different value - check block number`);
    }
  } catch (error: any) {
    console.log(`    ❌ RPC call failed: ${error.message}`);
    if (error.shortMessage) {
      console.log(`       ${error.shortMessage}`);
    }
  }
}

async function testPoolFeeRate(
  poolAddress: string,
  expectedFeeRate: string,
  envioFeeRate: string,
  blockNumber: bigint | null
) {
  const rpcUrl = process.env.ENVIO_RPC_URL_1 || process.env.RPC_URL;
  if (!rpcUrl) {
    console.error("Please set ENVIO_RPC_URL_1 or RPC_URL environment variable");
    return;
  }

  const publicClient = createPublicClient({
    chain: mainnet,
    transport: http(rpcUrl, { batch: true }),
  });

  console.log(`\n  Testing feeRate for pool ${poolAddress}`);
  if (blockNumber) {
    console.log(`    At block: ${blockNumber.toString()}`);
  } else {
    console.log(`    At latest block`);
  }

  try {
    const feeRate = await publicClient.readContract({
      address: poolAddress as `0x${string}`,
      abi: CURVE_POOL_ABI,
      functionName: "fee",
      blockNumber: blockNumber || undefined,
    });

    const feeRateStr = feeRate.toString();
    const expectedStr = expectedFeeRate;
    const envioStr = envioFeeRate;
    const matchExpected = feeRateStr === expectedStr;
    const matchEnvio = feeRateStr === envioStr;

    console.log(`    ✅ RPC call succeeded`);
    console.log(`    Subgraph expected: ${expectedStr}`);
    console.log(`    Envio stored:      ${envioStr}`);
    console.log(`    RPC result:       ${feeRateStr}`);
    console.log(`    Match subgraph:   ${matchExpected ? "✅ YES" : "❌ NO"}`);
    console.log(`    Match Envio:      ${matchEnvio ? "✅ YES" : "❌ NO"}`);
    
    if (!matchExpected) {
      const diff = Math.abs(Number(feeRate) - Number(expectedFeeRate));
      const diffPercent = (diff / Number(expectedFeeRate)) * 100;
      console.log(`    Diff from subgraph: ${diff} (${diffPercent.toFixed(2)}%)`);
    }
    
    if (matchExpected && !matchEnvio) {
      console.log(`    ⚠️  RPC matches subgraph but Envio has wrong value - likely cache or logic issue`);
    }
  } catch (error: any) {
    console.log(`    ❌ RPC call failed: ${error.message}`);
    if (error.shortMessage) {
      console.log(`       ${error.shortMessage}`);
    }
  }
}

async function main() {
  console.log("=== Testing Effect Calls for Field Mismatches ===\n");

  const rpcUrl = process.env.ENVIO_RPC_URL_1 || process.env.RPC_URL;
  if (!rpcUrl) {
    console.error("Please set ENVIO_RPC_URL_1 or RPC_URL environment variable");
    console.error("Example: ENVIO_RPC_URL_1=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY");
    process.exit(1);
  }
  
  console.log(`Using RPC URL: ${rpcUrl.substring(0, 30)}...\n`);

  // Test AccountAsset balances
  console.log("\n=== AccountAsset Balance Tests ===");
  for (const testCase of TEST_CASES.accountAsset) {
    // Query subgraph to get entity data
    const query = `
      query {
        accountAsset(id: "${testCase.id}") {
          id
          balance
          createdAtTimestamp
          asset {
            id
            address
            type
          }
          account {
            id
            address
          }
        }
      }
    `;

    try {
      const subgraphData = await querySubgraph(query);
      const accountAsset = subgraphData.accountAsset;

      if (!accountAsset) {
        console.log(`\n❌ AccountAsset ${testCase.id} not found in subgraph`);
        // Test without block number as fallback
        await testAccountAssetBalance(
          testCase.accountAddress,
          testCase.assetAddress,
          testCase.expectedBalance,
          testCase.envioBalance,
          null
        );
        continue;
      }

      console.log(`\n📊 AccountAsset: ${testCase.id}`);
      console.log(`  Subgraph balance: ${accountAsset.balance}`);
      console.log(`  Envio balance: ${testCase.envioBalance}`);
      console.log(`  Asset type: ${accountAsset.asset?.type || "unknown"}`);

      // Get block number from most recent transaction involving this account and asset
      const blockNumber = await getBlockNumberFromTransaction(
        testCase.accountAddress,
        testCase.assetAddress,
        null
      );

      if (blockNumber) {
        console.log(`  Using block from transaction: ${blockNumber.toString()}`);
      } else {
        console.log(`  ⚠️  Could not find transaction block, using latest block`);
      }

      await testAccountAssetBalance(
        testCase.accountAddress,
        testCase.assetAddress,
        testCase.expectedBalance,
        testCase.envioBalance,
        blockNumber
      );
    } catch (error: any) {
      console.log(`\n❌ Error querying subgraph for ${testCase.id}: ${error.message}`);
      // Test without block number as fallback
      await testAccountAssetBalance(
        testCase.accountAddress,
        testCase.assetAddress,
        testCase.expectedBalance,
        testCase.envioBalance,
        null
      );
    }
  }

  // Test Pool spotPrice
  console.log("\n\n=== Pool spotPrice Tests ===");
  for (const testCase of TEST_CASES.poolSpotPrice) {
    // Query subgraph to get pool data
    const query = `
      query {
        pool(id: "${testCase.poolAddress}") {
          id
          address
          spotPrice
          feeRate
          createdAtTimestamp
          type
        }
      }
    `;

    try {
      const subgraphData = await querySubgraph(query);
      const pool = subgraphData.pool;

      if (!pool) {
        console.log(`\n❌ Pool ${testCase.poolAddress} not found in subgraph`);
        await testPoolSpotPrice(
          testCase.poolAddress,
          testCase.expectedSpotPrice,
          testCase.envioSpotPrice,
          "CURVE",
          null
        );
        continue;
      }

      console.log(`\n📊 Pool: ${testCase.poolAddress}`);
      console.log(`  Subgraph spotPrice: ${pool.spotPrice}`);
      console.log(`  Envio spotPrice: ${testCase.envioSpotPrice}`);
      console.log(`  Pool type: ${pool.type || "CURVE"}`);

      // Get block number from most recent transaction involving this pool
      const blockNumber = await getBlockNumberFromTransaction(
        null,
        null,
        testCase.poolAddress
      );

      if (blockNumber) {
        console.log(`  Using block from transaction: ${blockNumber.toString()}`);
      } else {
        console.log(`  ⚠️  Could not find transaction block, using latest block`);
      }

      await testPoolSpotPrice(
        testCase.poolAddress,
        testCase.expectedSpotPrice,
        testCase.envioSpotPrice,
        pool.type || "CURVE",
        blockNumber
      );
    } catch (error: any) {
      console.log(`\n❌ Error querying subgraph for ${testCase.poolAddress}: ${error.message}`);
      await testPoolSpotPrice(
        testCase.poolAddress,
        testCase.expectedSpotPrice,
        testCase.envioSpotPrice,
        "CURVE",
        null
      );
    }
  }

  // Test Pool feeRate
  console.log("\n\n=== Pool feeRate Tests ===");
  for (const testCase of TEST_CASES.poolFeeRate) {
    // Query subgraph to get pool data
    const query = `
      query {
        pool(id: "${testCase.poolAddress}") {
          id
          address
          feeRate
          createdAtTimestamp
        }
      }
    `;

    try {
      const subgraphData = await querySubgraph(query);
      const pool = subgraphData.pool;

      if (!pool) {
        console.log(`\n❌ Pool ${testCase.poolAddress} not found in subgraph`);
        await testPoolFeeRate(
          testCase.poolAddress,
          testCase.expectedFeeRate,
          testCase.envioFeeRate,
          null
        );
        continue;
      }

      console.log(`\n📊 Pool: ${testCase.poolAddress}`);
      console.log(`  Subgraph feeRate: ${pool.feeRate}`);
      console.log(`  Envio feeRate: ${testCase.envioFeeRate}`);

      // Get block number from most recent transaction involving this pool
      const blockNumber = await getBlockNumberFromTransaction(
        null,
        null,
        testCase.poolAddress
      );

      if (blockNumber) {
        console.log(`  Using block from transaction: ${blockNumber.toString()}`);
      } else {
        console.log(`  ⚠️  Could not find transaction block, using latest block`);
      }

      await testPoolFeeRate(
        testCase.poolAddress,
        testCase.expectedFeeRate,
        testCase.envioFeeRate,
        blockNumber
      );
    } catch (error: any) {
      console.log(`\n❌ Error querying subgraph for ${testCase.poolAddress}: ${error.message}`);
      await testPoolFeeRate(
        testCase.poolAddress,
        testCase.expectedFeeRate,
        testCase.envioFeeRate,
        null
      );
    }
  }

  console.log("\n\n=== Summary ===");
  console.log("Interpretation:");
  console.log("  ✅ RPC matches subgraph + ❌ Envio differs = Cache or logic issue");
  console.log("  ❌ RPC differs from subgraph = Block number or effect implementation issue");
  console.log("  All three differ = Need to investigate further");
  console.log("\nNext steps:");
  console.log("  1. If RPC matches subgraph: Delete cache files and re-index");
  console.log("  2. If RPC differs: Check block number or effect implementation");
  console.log("  3. Check if blockNumber is being passed correctly to effects");
}

main().catch(console.error);
