// Reference: spectra-subgraph-master/src/entities/PoolStats.ts

import { PoolStats_t, Pool_t } from "generated/src/db/Entities.gen";
import { UNIT_BI, ZERO_BI, ZERO_BD, SECONDS_PER_YEAR } from "../constants";
import { generatePoolStatsId } from "../utils/idGenerators";

export enum PoolActionType {
  BUY_PT = "BUY_PT",
  SELL_PT = "SELL_PT",
  ADD_LIQUIDITY = "ADD_LIQUIDITY",
  REMOVE_LIQUIDITY = "REMOVE_LIQUIDITY",
}

/**
 * Create a new PoolStats entity
 * Reference: spectra-subgraph-master/src/entities/PoolStats.ts
 */
export async function createPoolStats(
  poolId: string,
  span: number,
  statId: number,
  timestamp: bigint,
  context: any
): Promise<PoolStats_t> {
  const poolStatsId = `${poolId}-S-${span}-${statId}`;

  let poolStats = await context.PoolStats.get(poolStatsId);
  if (!poolStats) {
    poolStats = {
      id: poolStatsId,
      pool_id: poolId,
      timestamp: statId * span,
      span: span,
      buys: ZERO_BI,
      sells: ZERO_BI,
      deposits: ZERO_BI,
      withdrawals: ZERO_BI,
      buyVolume: ZERO_BI,
      sellVolume: ZERO_BI,
      depositVolume: ZERO_BI,
      withdrawVolume: ZERO_BI,
      feeUnderlying: ZERO_BI,
      feeRatio: ZERO_BI,
      createdAtTimestamp: timestamp,
      lastUpdatedAtTimestamp: timestamp,
      lastUpdatedAtBlock: BigInt(0),
      spotPrice: UNIT_BI,
      ptRate: ZERO_BI,
      ibtRate: ZERO_BI,
      baseAPY: ZERO_BD,
      exponentAPY: ZERO_BD,
      ibtToPt: ZERO_BI,
      ptToIbt: ZERO_BI,
    };
    context.PoolStats.set(poolStats);
  }
  return poolStats;
}

/**
 * Update pool stats
 * Reference: spectra-subgraph-master/src/entities/PoolStats.ts
 */
export async function updatePoolStats(
  event: any,
  pool: Pool_t,
  span: number,
  type: PoolActionType,
  valueUnderlying: bigint,
  feeUnderlying: bigint,
  feeRatio: bigint,
  chainId: number,
  context: any
): Promise<PoolStats_t> {
  const statId = Math.floor(event.block.timestamp / span);
  const poolStatsId = `${chainId}-${generatePoolStatsId(pool.address, span.toString(), statId.toString())}`;

  let poolStats = await context.PoolStats.get(poolStatsId);
  if (!poolStats) {
    poolStats = await createPoolStats(
      pool.id,
      span,
      statId,
      BigInt(event.block.timestamp),
      context
    );
  }

  // Update based on action type
  switch (type) {
    case PoolActionType.BUY_PT:
      poolStats = {
        ...poolStats,
        buys: poolStats.buys + UNIT_BI,
        buyVolume: poolStats.buyVolume + valueUnderlying,
      };
      break;
    case PoolActionType.SELL_PT:
      poolStats = {
        ...poolStats,
        sells: poolStats.sells + UNIT_BI,
        sellVolume: poolStats.sellVolume + valueUnderlying,
      };
      break;
    case PoolActionType.ADD_LIQUIDITY:
      poolStats = {
        ...poolStats,
        deposits: poolStats.deposits + UNIT_BI,
        depositVolume: poolStats.depositVolume + valueUnderlying,
      };
      break;
    case PoolActionType.REMOVE_LIQUIDITY:
      poolStats = {
        ...poolStats,
        withdrawals: poolStats.withdrawals + UNIT_BI,
        withdrawVolume: poolStats.withdrawVolume + valueUnderlying,
      };
      break;
  }

  // Update fee stats regardless of action type
  poolStats = {
    ...poolStats,
    feeUnderlying: poolStats.feeUnderlying + feeUnderlying,
    feeRatio: poolStats.feeRatio + feeRatio,
    lastUpdatedAtTimestamp: BigInt(event.block.timestamp),
    lastUpdatedAtBlock: BigInt(event.block.number),
  };

  context.PoolStats.set(poolStats);
  return poolStats;
}
