// Reference: spectra-subgraph-master/src/entities/FutureDailyStats.ts

import { FutureDailyStats } from "generated";
import { DAYS_PER_YEAR_BD, ZERO_BD, ZERO_BI } from "../constants";
import { generateFutureDailyStatsId } from "../utils/idGenerators";
import { getDayIdFromTimestamp, getPastDayId } from "../utils/dayId";

/**
 * Create a new FutureDailyStats entity
 */
export async function createFutureDailyStats(
  futureAddress: string,
  dayId: number,
  chainId: number,
  context: any
): Promise<FutureDailyStats> {
  const futureDailyStatsId = `${chainId}-${generateFutureDailyStatsId(futureAddress, dayId.toString())}`;
  const futureId = `${chainId}-${futureAddress}`;

  const futureDailyStats = {
    id: futureDailyStatsId,
    future_id: futureId,
    date: dayId,
    dailyDeposits: ZERO_BI,
    dailyWithdrawals: ZERO_BI,
    dailySwaps: ZERO_BI,
    dailyAddLiquidity: ZERO_BI,
    dailyRemoveLiquidity: ZERO_BI,
    dailyUpdates: ZERO_BI,
    ibtRateMA: ZERO_BI,
    lastIBTRate: ZERO_BI,
    lastPTRate: ZERO_BI,
    realizedAPR7D: ZERO_BD,
    realizedAPR30D: ZERO_BD,
    realizedAPR90D: ZERO_BD,
  };

  context.FutureDailyStats.set(futureDailyStats);
  return futureDailyStats;
}

/**
 * Update FutureDailyStats entity
 * Simplified version - full implementation requires getIBTRate, getPTRate, getAPR (RPC calls)
 */
export async function updateFutureDailyStats(
  event: any,
  futureAddress: string,
  chainId: number,
  context: any
): Promise<FutureDailyStats> {
  const dayId = getDayIdFromTimestamp(BigInt(event.block.timestamp));
  const futureId = `${chainId}-${futureAddress}`;

  const futureDailyStatsId = `${chainId}-${generateFutureDailyStatsId(futureAddress, dayId.toString())}`;

  let futureDailyStats = await context.FutureDailyStats.get(futureDailyStatsId);
  if (!futureDailyStats) {
    futureDailyStats = await createFutureDailyStats(
      futureAddress,
      dayId,
      chainId,
      context
    );
  }

  // TODO: Implement full logic with:
  // - getIBTRate(futureAddress) - RPC call
  // - getPTRate(futureAddress) - RPC call
  // - getUnderlying(futureAddress) - RPC call
  // - getERC20Decimals(underlying) - RPC call
  // - Calculate ibtRateMA with moving average
  // - Calculate realizedAPR7D, realizedAPR30D, realizedAPR90D

  // For now, just increment dailyUpdates
  const updatedStats = {
    ...futureDailyStats,
    dailyUpdates: futureDailyStats.dailyUpdates + BigInt(1),
    // TODO: Update ibtRateMA, lastIBTRate, lastPTRate, realizedAPR values when RPC calls are available
  };

  context.FutureDailyStats.set(updatedStats);
  return updatedStats;
}
