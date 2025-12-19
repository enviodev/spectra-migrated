/**
 * Test script to debug Transaction entity field mismatches
 * Tests valueUnderlying, feeUnderlying, feeRatio, and adminFee calculations
 * 
 * Usage: pnpm ts-node test-transaction-fields.ts <transactionId> [chainId]
 * Example: pnpm ts-node test-transaction-fields.ts 0x001bdd5331b5a8725efa2d14e417ffb7facbbf8ac53cb4272e6e8937a5871b3b-441 1
 */

import * as dotenv from "dotenv";
dotenv.config();

import { createPublicClient, http, parseAbi } from "viem";
import { mainnet } from "viem/chains";

// Subgraph GraphQL endpoint
const SUBGRAPH_URL = "https://api.goldsky.com/api/public/project_cm55feuq3euos01xjb3w504ls/subgraphs/spectra-mainnet/1.4.0/gn";

// Constants
const CURVE_UNIT = BigInt("1000000000000000000000000000"); // 10^27
const FEES_PRECISION = 10;
let FEES_UNIT = BigInt(1);
for (let i = 0; i < FEES_PRECISION; i++) {
  FEES_UNIT *= BigInt(10);
}

// ABIs
const ERC20_ABI = parseAbi([
  "function decimals() view returns (uint8)",
]);

const PRINCIPAL_TOKEN_ABI = parseAbi([
  "function getPTRate() view returns (uint256)",
]);

const ERC4626_ABI = parseAbi([
  "function convertToAssets(uint256 shares) view returns (uint256)",
]);

// Import full ABIs for array return types
import CURVE_POOL_SNG_ABI_JSON from "./abis/CurvePoolSNG.json";
const CURVE_POOL_SNG_ABI = CURVE_POOL_SNG_ABI_JSON as any;

const CURVE_POOL_ABI = parseAbi([
  "function last_prices() view returns (uint256)",
  "function fee() view returns (uint256)",
  "function admin_fee() view returns (uint256)",
  "function balances(uint256) view returns (uint256)",
]);

interface GraphQLResponse {
  data?: {
    transaction?: {
      id: string;
      block: string;
      type: string;
      poolInTransaction?: {
        id: string;
        address: string;
        type: string;
        spotPrice: string;
        feeRate: string;
        adminFeeRate: string;
        ibtAdminBalance: string;
        ptAdminBalance: string;
        ibtAsset: {
          asset: {
            address: string;
            decimals: number;
          };
          amount: string;
        };
        ptAsset: {
          asset: {
            address: string;
          };
          amount: string;
        };
        futureVault?: {
          address: string;
        };
      };
      valueUnderlying: string;
      feeUnderlying: string;
      feeRatio: string;
      adminFee: string;
      ibtRate: string;
      ptRate: string;
      amountsIn?: Array<{ 
        amount: string;
        asset: {
          address: string;
          type: string;
        };
      }>;
      amountsOut?: Array<{ 
        amount: string;
        asset: {
          address: string;
          type: string;
        };
      }>;
    };
  };
  errors?: Array<{ message: string }>;
}

async function getTransactionFromSubgraph(transactionId: string): Promise<any> {
  const query = `
    query GetTransaction($id: ID!) {
      transaction(id: $id) {
        id
        block
        type
        poolInTransaction {
          id
          address
          type
          spotPrice
          feeRate
          adminFeeRate
          ibtAdminBalance
          ptAdminBalance
          ibtAsset {
            asset {
              address
              decimals
            }
            amount
          }
          ptAsset {
            asset {
              address
            }
            amount
          }
          futureVault {
            address
          }
        }
        valueUnderlying
        feeUnderlying
        feeRatio
        adminFee
        ibtRate
        ptRate
        amountsIn {
          amount
          asset {
            address
            type
          }
        }
        amountsOut {
          amount
          asset {
            address
            type
          }
        }
      }
    }
  `;

  const response = await fetch(SUBGRAPH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      variables: { id: transactionId },
    }),
  });

  const result = (await response.json()) as GraphQLResponse;
  
  if (result.errors) {
    console.error("GraphQL errors:", result.errors);
    return null;
  }

  return result.data?.transaction || null;
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

async function getIBTRate(ibtAddress: string, chainId: number, blockNumber: number, rpcUrl: string): Promise<bigint> {
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
    // Get decimals first
    const decimals = await publicClient.readContract({
      address: ibtAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "decimals",
      blockNumber: BigInt(blockNumber),
    });

    // Calculate 10^decimals
    let ibtUnit = BigInt(1);
    for (let i = 0; i < Number(decimals); i++) {
      ibtUnit *= BigInt(10);
    }

    // Call convertToAssets with 10^decimals
    const ibtRate = await publicClient.readContract({
      address: ibtAddress as `0x${string}`,
      abi: ERC4626_ABI,
      functionName: "convertToAssets",
      args: [ibtUnit],
      blockNumber: BigInt(blockNumber),
    });

    return ibtRate as bigint;
  } catch (error) {
    console.warn(`getIBTRate failed for ${ibtAddress} at block ${blockNumber}:`, error);
    return BigInt("1000000000000000000"); // Return UNIT_BI as fallback
  }
}

async function getPTRate(ptAddress: string, chainId: number, blockNumber: number, rpcUrl: string): Promise<bigint> {
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
    const ptRate = await publicClient.readContract({
      address: ptAddress as `0x${string}`,
      abi: PRINCIPAL_TOKEN_ABI,
      functionName: "getPTRate",
      blockNumber: BigInt(blockNumber),
    });

    return ptRate as bigint;
  } catch (error) {
    console.warn(`getPTRate failed for ${ptAddress} at block ${blockNumber}:`, error);
    return BigInt("1000000000000000000000000000"); // Return RAYS_UNIT as fallback
  }
}

async function getSpotPrice(poolAddress: string, poolType: string, chainId: number, blockNumber: number, rpcUrl: string): Promise<bigint> {
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
    if (poolType === "CURVE_SNG") {
      const [lastPrice, storedRates] = await Promise.all([
        publicClient.readContract({
          address: poolAddress as `0x${string}`,
          abi: CURVE_POOL_SNG_ABI,
          functionName: "last_price",
          args: [BigInt(0)],
          blockNumber: BigInt(blockNumber),
        }),
        publicClient.readContract({
          address: poolAddress as `0x${string}`,
          abi: CURVE_POOL_SNG_ABI,
          functionName: "stored_rates",
          args: [],
          blockNumber: BigInt(blockNumber),
        }),
      ]);

      const lastPriceBigInt = BigInt(lastPrice as bigint | string | number);
      const storedRatesArray = storedRates as bigint[];

      if (Array.isArray(storedRatesArray) && storedRatesArray.length >= 2 && storedRatesArray[0] > BigInt(0)) {
        return (storedRatesArray[1] * lastPriceBigInt) / storedRatesArray[0];
      }
      return BigInt(0);
    } else {
      const lastPrices = await publicClient.readContract({
        address: poolAddress as `0x${string}`,
        abi: CURVE_POOL_ABI,
        functionName: "last_prices",
        blockNumber: BigInt(blockNumber),
      });
      return BigInt(lastPrices as bigint | string | number);
    }
  } catch (error) {
    console.warn(`getSpotPrice failed for ${poolAddress} at block ${blockNumber}:`, error);
    return BigInt(0);
  }
}

async function getPoolFee(poolAddress: string, chainId: number, blockNumber: number, rpcUrl: string): Promise<bigint> {
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
    const fee = await publicClient.readContract({
      address: poolAddress as `0x${string}`,
      abi: CURVE_POOL_ABI,
      functionName: "fee",
      blockNumber: BigInt(blockNumber),
    });
    return BigInt(fee as bigint | string | number);
  } catch (error) {
    console.warn(`getPoolFee failed for ${poolAddress} at block ${blockNumber}:`, error);
    return BigInt(0);
  }
}

async function getPoolAdminFee(poolAddress: string, chainId: number, blockNumber: number, rpcUrl: string): Promise<bigint> {
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
    const adminFee = await publicClient.readContract({
      address: poolAddress as `0x${string}`,
      abi: CURVE_POOL_ABI,
      functionName: "admin_fee",
      blockNumber: BigInt(blockNumber),
    });
    return BigInt(adminFee as bigint | string | number);
  } catch (error) {
    console.warn(`getPoolAdminFee failed for ${poolAddress} at block ${blockNumber}:`, error);
    return BigInt(0);
  }
}

async function getPoolAdminBalances(poolAddress: string, chainId: number, blockNumber: number, rpcUrl: string): Promise<[bigint, bigint]> {
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
    const [ibtAdminBalance, ptAdminBalance] = await Promise.all([
      publicClient.readContract({
        address: poolAddress as `0x${string}`,
        abi: CURVE_POOL_SNG_ABI,
        functionName: "admin_balances",
        args: [BigInt(0)],
        blockNumber: BigInt(blockNumber),
      }),
      publicClient.readContract({
        address: poolAddress as `0x${string}`,
        abi: CURVE_POOL_SNG_ABI,
        functionName: "admin_balances",
        args: [BigInt(1)],
        blockNumber: BigInt(blockNumber),
      }),
    ]);

    return [BigInt(ibtAdminBalance as bigint | string | number), BigInt(ptAdminBalance as bigint | string | number)];
  } catch (error) {
    console.warn(`getPoolAdminBalances failed for ${poolAddress} at block ${blockNumber}:`, error);
    return [BigInt(0), BigInt(0)];
  }
}

async function getPoolBalances(poolAddress: string, chainId: number, blockNumber: number, rpcUrl: string): Promise<[bigint, bigint]> {
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
    const [ibtBalance, ptBalance] = await Promise.all([
      publicClient.readContract({
        address: poolAddress as `0x${string}`,
        abi: CURVE_POOL_ABI,
        functionName: "balances",
        args: [BigInt(0)],
        blockNumber: BigInt(blockNumber),
      }),
      publicClient.readContract({
        address: poolAddress as `0x${string}`,
        abi: CURVE_POOL_ABI,
        functionName: "balances",
        args: [BigInt(1)],
        blockNumber: BigInt(blockNumber),
      }),
    ]);

    return [BigInt(ibtBalance as bigint | string | number), BigInt(ptBalance as bigint | string | number)];
  } catch (error) {
    console.warn(`getPoolBalances failed for ${poolAddress} at block ${blockNumber}:`, error);
    return [BigInt(0), BigInt(0)];
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

// Helper function to calculate valueUnderlying (for tokenExchange)
function calculateValueUnderlyingTokenExchange(
  tokens_sold: bigint,
  tokens_bought: bigint,
  isBuyPt: boolean,
  spotPrice: bigint,
  ibtRate: bigint,
  ibtDecimals: number
): bigint {
  const ibt = isBuyPt ? tokens_sold : tokens_bought;
  const ptInIbt = ((isBuyPt ? tokens_bought : tokens_sold) * spotPrice) / CURVE_UNIT;
  
  let decimalsMultiplier = BigInt(1);
  for (let i = 0; i < ibtDecimals; i++) {
    decimalsMultiplier *= BigInt(10);
  }
  
  return ((ibt + ptInIbt) * ibtRate) / decimalsMultiplier / BigInt(2);
}

// Helper function to calculate valueUnderlying (for addLiquidity/removeLiquidity)
function calculateValueUnderlyingLiquidity(
  ibtAmount: bigint,
  ptAmount: bigint,
  spotPrice: bigint,
  ibtRate: bigint,
  ibtDecimals: number
): bigint {
  const ptAmountInIbt = (ptAmount * spotPrice) / CURVE_UNIT;
  
  let decimalsMultiplier = BigInt(1);
  for (let i = 0; i < ibtDecimals; i++) {
    decimalsMultiplier *= BigInt(10);
  }
  
  return ((ibtAmount + ptAmountInIbt) * ibtRate) / decimalsMultiplier;
}

// Helper function to calculate getLpFeeUnderlying
function calculateLpFeeUnderlying(
  poolType: string,
  valueUnderlying: bigint,
  ibtAdminFee: bigint,
  ptAdminFee: bigint,
  spotPrice: bigint,
  adminFeeRate: bigint,
  ibtRate: bigint,
  ibtDecimals: number
): bigint {
  if (poolType === "CURVE") {
    // This would need pool.feeRate, but we don't have it in this context
    return BigInt(0);
  } else if (poolType === "CURVE_SNG") {
    if (adminFeeRate === BigInt(0)) {
      return BigInt(0);
    }
    
    const ptAdminFeeInIbt = (ptAdminFee * spotPrice) / CURVE_UNIT;
    
    let decimalsMultiplier = BigInt(1);
    for (let i = 0; i < ibtDecimals; i++) {
      decimalsMultiplier *= BigInt(10);
    }
    
    const adminFeeUnderlying = ((ibtAdminFee + ptAdminFeeInIbt) * ibtRate) / decimalsMultiplier;
    const lpFeeUnderlying = (adminFeeUnderlying * FEES_UNIT) / adminFeeRate;
    return lpFeeUnderlying;
  }
  return BigInt(0);
}

// Helper function to calculate getPoolLiquidityInUnderlying
function calculatePoolLiquidityInUnderlying(
  ibtAmount: bigint,
  ptAmount: bigint,
  spotPrice: bigint,
  ibtRate: bigint,
  ibtDecimals: number
): bigint {
  const ptInIbt = (ptAmount * CURVE_UNIT) / spotPrice;
  
  let decimalsMultiplier = BigInt(1);
  for (let i = 0; i < ibtDecimals; i++) {
    decimalsMultiplier *= BigInt(10);
  }
  
  return ((ibtAmount + ptInIbt) * ibtRate) / decimalsMultiplier / BigInt(2);
}

async function main() {
  const transactionId = process.argv[2];
  const chainIdArg = process.argv[3];
  
  if (!transactionId) {
    console.error("Usage: pnpm ts-node test-transaction-fields.ts <transactionId> [chainId]");
    console.error("Example: pnpm ts-node test-transaction-fields.ts 0x001bdd5331b5a8725efa2d14e417ffb7facbbf8ac53cb4272e6e8937a5871b3b-441 1");
    process.exit(1);
  }

  // Extract chainId from transactionId if it starts with "1-", "42161-", etc.
  // Transaction ID format: [chainId-]txHash-logIndex
  let chainId = chainIdArg ? parseInt(chainIdArg) : 1;
  let subgraphTransactionId = transactionId;
  
  if (transactionId.includes("-")) {
    const parts = transactionId.split("-");
    // Check if first part is a numeric chainId (not a hex address starting with 0x)
    const firstPart = parts[0];
    if (!firstPart.startsWith("0x") && !isNaN(parseInt(firstPart)) && parseInt(firstPart) > 0 && parseInt(firstPart) < 1000) {
      chainId = parseInt(firstPart);
      // Remove chainId prefix from transactionId for subgraph query
      subgraphTransactionId = parts.slice(1).join("-");
      console.log(`Detected chainId: ${chainId}, Subgraph transactionId: ${subgraphTransactionId}`);
    }
  }

  const rpcUrl = process.env[`ENVIO_RPC_URL_${chainId}`] || process.env.RPC_URL;
  if (!rpcUrl) {
    console.error(`No RPC URL found for chain ${chainId}`);
    process.exit(1);
  }

  console.log(`\n=== Testing Transaction Fields ===`);
  console.log(`Transaction ID: ${transactionId}`);
  console.log(`Chain ID: ${chainId}`);
  console.log(`Subgraph Transaction ID: ${subgraphTransactionId}`);
  console.log(`RPC URL: ${rpcUrl}\n`);
  
  console.log(`Fetching transaction from subgraph with ID: ${subgraphTransactionId}...`);
  const tx = await getTransactionFromSubgraph(subgraphTransactionId);
  
  if (!tx) {
    console.error(`Transaction not found in subgraph with ID: ${subgraphTransactionId}`);
    console.error(`Tried querying with: ${subgraphTransactionId}`);
    console.error(`\nNote: Subgraph transaction IDs are in format: txHash-logIndex`);
    console.error(`Example: 0x001bdd5331b5a8725efa2d14e417ffb7facbbf8ac53cb4272e6e8937a5871b3b-441`);
    process.exit(1);
  }

  console.log(`\n=== Subgraph Transaction Data ===`);
  console.log(`ID: ${tx.id}`);
  console.log(`Block: ${tx.block}`);
  console.log(`Type: ${tx.type}`);
  console.log(`valueUnderlying: ${tx.valueUnderlying}`);
  console.log(`feeUnderlying: ${tx.feeUnderlying}`);
  console.log(`feeRatio: ${tx.feeRatio}`);
  console.log(`adminFee: ${tx.adminFee}`);
  console.log(`ibtRate: ${tx.ibtRate}`);
  console.log(`ptRate: ${tx.ptRate}`);

  if (!tx.poolInTransaction) {
    console.log("\n⚠️  Transaction has no pool - skipping calculations");
    process.exit(0);
  }

  const pool = tx.poolInTransaction;
  console.log(`\n=== Pool Data ===`);
  console.log(`Address: ${pool.address}`);
  console.log(`Type: ${pool.type}`);
  console.log(`spotPrice: ${pool.spotPrice}`);
  console.log(`feeRate: ${pool.feeRate}`);
  console.log(`adminFeeRate: ${pool.adminFeeRate}`);
  console.log(`IBT Address: ${pool.ibtAsset.asset.address}`);
  console.log(`IBT Decimals: ${pool.ibtAsset.asset.decimals}`);
  console.log(`PT Address: ${pool.ptAsset.asset.address}`);
  if (pool.futureVault) {
    console.log(`Future Vault: ${pool.futureVault.address}`);
  }

  const transactionBlock = parseInt(tx.block);
  const latestBlock = await getLatestBlockNumber(chainId, rpcUrl);

  console.log(`\n=== Block Numbers ===`);
  console.log(`Transaction Block: ${transactionBlock}`);
  console.log(`Latest Block: ${latestBlock}`);

  // Get token amounts from transaction
  let tokens_sold: bigint | null = null;
  let tokens_bought: bigint | null = null;
  let isBuyPt = false;

  if (tx.type === "AMM_EXCHANGE") {
    if (tx.amountsIn && tx.amountsIn.length > 0 && tx.amountsOut && tx.amountsOut.length > 0) {
      tokens_sold = BigInt(tx.amountsIn[0].amount);
      tokens_bought = BigInt(tx.amountsOut[0].amount);
      // Determine if buying PT (bought_id !== 0)
      // We'll need to check which asset is which, but for now assume first in is IBT, first out is PT
      isBuyPt = true; // Simplified - would need to check actual asset addresses
    }
  } else if (tx.type === "AMM_ADD_LIQUIDITY") {
    if (tx.amountsIn && tx.amountsIn.length >= 2) {
      tokens_sold = BigInt(tx.amountsIn[0].amount); // IBT
      tokens_bought = BigInt(tx.amountsIn[1].amount); // PT
    }
  } else if (tx.type === "AMM_REMOVE_LIQUIDITY") {
    if (tx.amountsOut && tx.amountsOut.length >= 2) {
      tokens_sold = BigInt(tx.amountsOut[0].amount); // IBT
      tokens_bought = BigInt(tx.amountsOut[1].amount); // PT
    }
  }

  // Test at different blocks
  const testBlocks = [
    { name: "Transaction Block", block: transactionBlock },
    { name: "Latest Block", block: latestBlock },
    { name: "Block - 1", block: transactionBlock - 1 },
    { name: "Block + 1", block: transactionBlock + 1 },
  ];

  for (const testBlock of testBlocks) {
    console.log(`\n=== Testing at ${testBlock.name} (${testBlock.block}) ===`);
    
    try {
      const [spotPrice, ibtRate, ptRate, poolFee, poolAdminFee, ibtDecimals] = await Promise.all([
        getSpotPrice(pool.address, pool.type, chainId, testBlock.block, rpcUrl),
        getIBTRate(pool.ibtAsset.asset.address, chainId, testBlock.block, rpcUrl),
        pool.futureVault ? getPTRate(pool.futureVault.address, chainId, testBlock.block, rpcUrl) : Promise.resolve(BigInt(0)),
        getPoolFee(pool.address, chainId, testBlock.block, rpcUrl),
        getPoolAdminFee(pool.address, chainId, testBlock.block, rpcUrl),
        getERC20Decimals(pool.ibtAsset.asset.address, chainId, testBlock.block, rpcUrl),
      ]);

      console.log(`  spotPrice: ${spotPrice.toString()}`);
      console.log(`  ibtRate: ${ibtRate.toString()}`);
      console.log(`  ptRate: ${ptRate.toString()}`);
      console.log(`  poolFee: ${poolFee.toString()}`);
      console.log(`  poolAdminFee: ${poolAdminFee.toString()}`);
      console.log(`  ibtDecimals: ${ibtDecimals}`);

      // Get admin balances for CURVE_SNG pools
      let ibtAdminFee = BigInt(0);
      let ptAdminFee = BigInt(0);
      if (pool.type === "CURVE_SNG") {
        const [ibtAdminBalance, ptAdminBalance] = await getPoolAdminBalances(
          pool.address,
          chainId,
          testBlock.block,
          rpcUrl
        );
        // Calculate admin fees (would need previous balances, but for now just show current)
        console.log(`  ibtAdminBalance: ${ibtAdminBalance.toString()}`);
        console.log(`  ptAdminBalance: ${ptAdminBalance.toString()}`);
        // Note: Admin fees are calculated as difference from previous balances
        // We'd need to query the pool entity to get previous balances
      }

      // Calculate valueUnderlying
      if (tokens_sold !== null && tokens_bought !== null && pool.futureVault && spotPrice > BigInt(0)) {
        let valueUnderlying: bigint;
        
        if (tx.type === "AMM_EXCHANGE") {
          valueUnderlying = calculateValueUnderlyingTokenExchange(
            tokens_sold,
            tokens_bought,
            isBuyPt,
            spotPrice,
            ibtRate,
            ibtDecimals
          );
        } else {
          // For add/remove liquidity
          valueUnderlying = calculateValueUnderlyingLiquidity(
            tokens_sold,
            tokens_bought,
            spotPrice,
            ibtRate,
            ibtDecimals
          );
        }

        console.log(`  Calculated valueUnderlying: ${valueUnderlying.toString()}`);
        console.log(`  Subgraph valueUnderlying: ${tx.valueUnderlying}`);
        const diff = BigInt(tx.valueUnderlying) - valueUnderlying;
        const diffPercent = (Number(diff) * 100) / Number(valueUnderlying);
        console.log(`  Difference: ${diff.toString()} (${diffPercent.toFixed(2)}%)`);

        // Calculate feeUnderlying (would need admin fees from previous state)
        // For now, just show what we can calculate
        if (pool.type === "CURVE_SNG" && poolAdminFee > BigInt(0)) {
          // This is a simplified calculation - actual calculation needs previous admin balances
          const ptAdminFeeInIbt = (ptAdminFee * spotPrice) / CURVE_UNIT;
          let decimalsMultiplier = BigInt(1);
          for (let i = 0; i < ibtDecimals; i++) {
            decimalsMultiplier *= BigInt(10);
          }
          const adminFeeUnderlying = ((ibtAdminFee + ptAdminFeeInIbt) * ibtRate) / decimalsMultiplier;
          const feeUnderlying = (adminFeeUnderlying * FEES_UNIT) / poolAdminFee;
          console.log(`  Calculated feeUnderlying (simplified): ${feeUnderlying.toString()}`);
          console.log(`  Subgraph feeUnderlying: ${tx.feeUnderlying}`);
        }
      }
    } catch (error) {
      console.error(`  Error testing at block ${testBlock.block}:`, error);
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Tested transaction: ${transactionId}`);
  console.log(`Pool: ${pool.address}`);
  console.log(`Transaction Type: ${tx.type}`);
  console.log(`\nNote: Admin fees and feeUnderlying calculations require previous pool state.`);
  console.log(`This script tests the RPC calls at different blocks to identify potential issues.`);
}

main().catch(console.error);

