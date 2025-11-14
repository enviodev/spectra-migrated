// Reference: spectra-subgraph-master/src/entities/CurvePool.ts

import { CURVE_UNIT, ZERO_BI } from "../constants";
import { getPoolLastPrices as getPoolLastPricesEffect } from "../effects/getPoolLastPrices";
import { getPoolVirtualPrice as getPoolVirtualPriceEffect } from "../effects/getPoolVirtualPrice";

/**
 * Get pool last prices
 * Reference: spectra-subgraph-master/src/entities/CurvePool.ts
 */
export async function getPoolLastPrices(
  poolAddress: string,
  poolType: string,
  chainId: number,
  blockNumber: number,
  context: any
): Promise<bigint> {
  const result = await context.effect(getPoolLastPricesEffect, {
    poolAddress: poolAddress,
    poolType: poolType,
    chainId: chainId,
    blockNumber: blockNumber,
  });

  const data = result as { lastPrice: string };
  return BigInt(data.lastPrice || ZERO_BI.toString());
}

/**
 * Get pool virtual price
 * Reference: spectra-subgraph-master/src/entities/CurvePool.ts
 */
export async function getPoolVirtualPrice(
  poolAddress: string,
  chainId: number,
  blockNumber: number,
  context: any
): Promise<bigint> {
  const result = await context.effect(getPoolVirtualPriceEffect, {
    poolAddress: poolAddress,
    chainId: chainId,
    blockNumber: blockNumber,
  });

  const data = result as { virtualPrice: string };
  return BigInt(data.virtualPrice || CURVE_UNIT.toString());
}
