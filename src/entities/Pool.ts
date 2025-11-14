// Reference: spectra-subgraph-master/src/entities/Pool.ts

import { Pool_t } from "generated/src/db/Entities.gen";
import { CURVE_UNIT, ZERO_BI, ZERO_ADDRESS } from "../constants";
import { PoolType } from "../utils/PoolType";
import { getAsset } from "./Asset";
import { getAssetAmount } from "./AssetAmount";
import { getPoolFee } from "../effects/getPoolFee";
import { getPoolAdminFee } from "../effects/getPoolAdminFee";
import { getPoolFutureAdminFee } from "../effects/getPoolFutureAdminFee";
import { getPoolLastPrices } from "./CurvePool";
import { getCurveFactory } from "../effects/getCurveFactory";

const FEES_PRECISION = 10;
// Calculate 10^FEES_PRECISION
let FEES_UNIT = BigInt(1);
for (let i = 0; i < FEES_PRECISION; i++) {
  FEES_UNIT *= BigInt(10);
}

/**
 * Calculate pool liquidity in underlying
 * Reference: spectra-subgraph-master/src/entities/Pool.ts
 */
export function getPoolLiquidityInUnderlying(
  ibtAmount: bigint,
  ptAmount: bigint,
  spotPrice: bigint,
  ibtRate: bigint,
  ibtDecimals: number
): bigint {
  const ptInIbt = (ptAmount * CURVE_UNIT) / spotPrice;

  // Calculate 10^ibtDecimals
  let decimalsMultiplier = BigInt(1);
  for (let i = 0; i < ibtDecimals; i++) {
    decimalsMultiplier *= BigInt(10);
  }

  const liquidityInUnderlying = ((ibtAmount + ptInIbt) * ibtRate) / decimalsMultiplier / BigInt(2);
  return liquidityInUnderlying;
}

/**
 * Update pool admin balances and return admin fees
 * Reference: spectra-subgraph-master/src/entities/Pool.ts
 * Returns [ibtAdminFee, ptAdminFee, newIbtAdminBalance, newPtAdminBalance]
 */
export async function updatePoolAdminBalances(
  pool: Pool_t,
  poolAddress: string,
  poolType: string,
  chainId: number,
  blockNumber: number,
  context: any
): Promise<[bigint, bigint, bigint, bigint]> {
  let ibtAdminFee = ZERO_BI;
  let ptAdminFee = ZERO_BI;
  let newIbtAdminBalance = pool.ibtAdminBalance;
  let newPtAdminBalance = pool.ptAdminBalance;

  if (poolType === PoolType.CURVE_SNG) {
    // Import getPoolAdminBalances dynamically to avoid circular dependency
    const { getPoolAdminBalances } = await import("./FeeClaim");
    const adminBalances = await getPoolAdminBalances(
      poolAddress,
      poolType,
      chainId,
      blockNumber,
      context
    );

    newIbtAdminBalance = adminBalances[0];
    newPtAdminBalance = adminBalances[1];

    // Calculate admin fees (difference from previous balances)
    if (adminBalances[0] < pool.ibtAdminBalance) {
      ibtAdminFee = adminBalances[0];
    } else {
      ibtAdminFee = adminBalances[0] - pool.ibtAdminBalance;
    }

    if (adminBalances[1] < pool.ptAdminBalance) {
      ptAdminFee = adminBalances[1];
    } else {
      ptAdminFee = adminBalances[1] - pool.ptAdminBalance;
    }
  }

  return [ibtAdminFee, ptAdminFee, newIbtAdminBalance, newPtAdminBalance];
}

/**
 * Calculate LP fee in underlying
 * Reference: spectra-subgraph-master/src/entities/Pool.ts
 */
export function getLpFeeUnderlying(
  pool: Pool_t,
  valueUnderlying: bigint,
  ibtAdminFee: bigint,
  ptAdminFee: bigint,
  ibtRate: bigint,
  ibtDecimals: number
): bigint {
  if (pool.poolType === PoolType.CURVE) {
    return (valueUnderlying * pool.feeRate) / FEES_UNIT;
  } else if (pool.poolType === PoolType.CURVE_SNG) {
    if (pool.adminFeeRate === ZERO_BI) {
      // If admin fee is zero (or failed to fetch), avoid division by zero.
      return ZERO_BI;
    }
    const ptAdminFeeInIbt = (ptAdminFee * CURVE_UNIT) / pool.spotPrice;

    // Calculate 10^ibtDecimals
    let decimalsMultiplier = BigInt(1);
    for (let i = 0; i < ibtDecimals; i++) {
      decimalsMultiplier *= BigInt(10);
    }

    const adminFeeUnderlying = ((ibtAdminFee + ptAdminFeeInIbt) * ibtRate) / decimalsMultiplier;
    const lpFeeUnderlying = (adminFeeUnderlying * FEES_UNIT) / pool.adminFeeRate;
    return lpFeeUnderlying;
  } else {
    return ZERO_BI;
  }
}

/**
 * Create Pool entity
 * Reference: spectra-subgraph-master/src/entities/Pool.ts
 */
export async function createPool(
  poolAddress: string,
  ibtAddress: string,
  ptAddress: string,
  factoryAddress: string,
  lpAddress: string,
  poolType: string,
  transactionHash: string,
  logIndex: string,
  timestamp: bigint,
  chainId: number,
  blockNumber: number,
  context: any
): Promise<Pool_t> {
  const poolId = `${chainId}-${poolAddress}`;

  // Create AssetAmount for IBT
  const ibtAssetAmount = await getAssetAmount(
    transactionHash,
    ibtAddress,
    ZERO_BI,
    "IBT",
    logIndex,
    timestamp,
    blockNumber,
    chainId,
    context
  );

  // Create AssetAmount for PT
  const ptAssetAmount = await getAssetAmount(
    transactionHash,
    ptAddress,
    ZERO_BI,
    "PT",
    logIndex,
    timestamp,
    blockNumber,
    chainId,
    context
  );

  // Get LP token Asset
  const lpToken = await getAsset(
    lpAddress,
    timestamp,
    "LP",
    null,
    chainId,
    blockNumber,
    context
  );

  // Get Future entity if it exists
  const futureId = `${chainId}-${ptAddress}`;
  const future = await context.Future.get(futureId);

  // Update LP token futureVault relationship if Future exists
  if (future) {
    context.Asset.set({
      ...lpToken,
      futureVault_id: futureId,
    });
  }

  // Get Factory entity
  const factoryId = `${chainId}-${factoryAddress}`;
  const factory = await context.Factory.get(factoryId);

  // Get pool fees via RPC
  const [feeResult, adminFeeResult, futureAdminFeeResult] = await Promise.all([
    context.effect(getPoolFee, {
      poolAddress: poolAddress,
      chainId: chainId,
      blockNumber: blockNumber,
    }),
    context.effect(getPoolAdminFee, {
      poolAddress: poolAddress,
      chainId: chainId,
      blockNumber: blockNumber,
    }),
    context.effect(getPoolFutureAdminFee, {
      poolAddress: poolAddress,
      chainId: chainId,
      blockNumber: blockNumber,
    }),
  ]);

  const feeRate = BigInt((feeResult as any)?.adminFee || (feeResult as string) || ZERO_BI.toString());
  const adminFeeRate = BigInt((adminFeeResult as any)?.adminFee || ZERO_BI.toString());
  const futureAdminFeeRate = BigInt((futureAdminFeeResult as any)?.futureAdminFee || ZERO_BI.toString());

  // Get spot price
  const spotPrice = await getPoolLastPrices(
    poolAddress,
    poolType,
    chainId,
    blockNumber,
    context
  );

  // Create Pool entity
  const pool: Pool_t = {
    id: poolId,
    address: poolAddress,
    createdAtTimestamp: timestamp,
    poolType: poolType as any,
    feeRate: feeRate,
    totalFees: ZERO_BI,
    totalFeeRatio: ZERO_BI,
    adminFeeRate: adminFeeRate,
    totalAdminFees: ZERO_BI,
    totalClaimedAdminFees: ZERO_BI,
    futureAdminFeeRate: futureAdminFeeRate,
    futureAdminFeeDeadline: ZERO_BI,
    initialVirtualPrice: ZERO_BI,
    ibtAdminBalance: ZERO_BI,
    ptAdminBalance: ZERO_BI,
    lpTotalSupply: ZERO_BI,
    spotPrice: spotPrice,
    transactionCount: 0,
    liquidityToken_id: lpToken.id,
    ibtAsset_id: ibtAssetAmount.id,
    ptAsset_id: ptAssetAmount.id,
    factory_id: factory?.id,
    futureVault_id: future?.id,
    metavault_id: undefined,
  };

  context.Pool.set(pool);
  return pool;
}
