// Reference: spectra-subgraph-master/src/entities/ERC4626.ts

import { UNIT_BI } from "../constants";
import { getIBTRate as getIBTRateEffect } from "../effects/getIBTRate";

import { getERC20Decimals, getERC20Symbol } from "./ERC20";

/**
 * Get IBT rate (convertToAssets with 1 unit of shares)
 * Reference: spectra-subgraph-master/src/entities/ERC4626.ts
 */
export async function getIBTRate(
  address: string,
  chainId: number,
  blockNumber: number,
  context: any,
  transactionHash?: string,
  logIndex?: string
): Promise<bigint> {
  // Get decimals and symbol first
  const [decimals, symbol] = await Promise.all([
    getERC20Decimals(address, chainId, blockNumber, context),
    getERC20Symbol(address, chainId, blockNumber, context)
  ]);

  const result = await context.effect(getIBTRateEffect, {
    ibtAddress: address,
    decimals: decimals,
    chainId: chainId,
    blockNumber: blockNumber,
    symbol: symbol,
    transactionHash: transactionHash || null,
    logIndex: logIndex || null,
  });

  const data = result as { ibtRate: string };
  return BigInt(data.ibtRate || UNIT_BI.toString());
}
