// Reference: spectra-subgraph-master/src/entities/ERC4626.ts

import { UNIT_BI } from "../constants";
import { getIBTRate as getIBTRateEffect } from "../effects/getIBTRate";

import { getERC20Decimals } from "./ERC20";

/**
 * Get IBT rate (convertToAssets with 1 unit of shares)
 * Reference: spectra-subgraph-master/src/entities/ERC4626.ts
 */
export async function getIBTRate(
  address: string,
  chainId: number,
  blockNumber: number,
  context: any
): Promise<bigint> {
  // Get decimals first
  const decimals = await getERC20Decimals(address, chainId, blockNumber, context);

  const result = await context.effect(getIBTRateEffect, {
    ibtAddress: address,
    decimals: decimals,
    chainId: chainId,
    blockNumber: blockNumber,
  });

  const data = result as { ibtRate: string };
  return BigInt(data.ibtRate || UNIT_BI.toString());
}
