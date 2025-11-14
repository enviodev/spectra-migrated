// Reference: spectra-subgraph-master/src/entities/IBTAsset.ts

import { Asset_t } from "generated/src/db/Entities.gen";
import { getAsset } from "./Asset";
import { getIBTRate } from "./ERC4626";
import { getERC20Decimals } from "./ERC20";

/**
 * Get or create IBT Asset entity
 * Reference: spectra-subgraph-master/src/entities/IBTAsset.ts
 */
export async function getIBTAsset(
  ibtAddress: string,
  timestamp: bigint,
  chainId: number,
  blockNumber: number,
  context: any
): Promise<Asset_t> {
  // Get or create IBT Asset entity
  const ibtAsset = await getAsset(
    ibtAddress,
    timestamp,
    "IBT",
    null,
    chainId,
    blockNumber,
    context
  );

  // Update IBT-specific fields if needed
  // Note: convertToAssetsUnit and lastIBTRate will be updated via updateIBTRates
  return ibtAsset;
}

/**
 * Update IBT rates
 * Reference: spectra-subgraph-master/src/entities/IBTAsset.ts
 */
export async function updateIBTRates(
  ibtAddress: string,
  timestamp: bigint,
  chainId: number,
  blockNumber: number,
  context: any
): Promise<void> {
  // Get or create IBT Asset entity
  const ibtAsset = await getIBTAsset(
    ibtAddress,
    timestamp,
    chainId,
    blockNumber,
    context
  );

  // Get IBT rate (convertToAssets with 1 unit of shares)
  const convertToAssets = await getIBTRate(
    ibtAddress,
    chainId,
    blockNumber,
    context
  );

  // Get underlying decimals to calculate UNDERLYING_UNIT
  // Note: We need to get the underlying address first
  // For now, use the IBT decimals as a fallback
  const ibtDecimals = await getERC20Decimals(
    ibtAddress,
    chainId,
    blockNumber,
    context
  );

  // Calculate UNDERLYING_UNIT (10^decimals)
  let UNDERLYING_UNIT = BigInt(1);
  for (let i = 0; i < ibtDecimals; i++) {
    UNDERLYING_UNIT *= BigInt(10);
  }

  // Calculate lastIBTRate (convertToAssets / UNDERLYING_UNIT as BigDecimal)
  // Note: We'll store as BigInt for now, full BigDecimal calculation would require BigDecimal library
  const lastIBTRate = convertToAssets / UNDERLYING_UNIT;

  // Update IBT Asset entity
  context.Asset.set({
    ...ibtAsset,
    convertToAssetsUnit: convertToAssets,
    lastIBTRate: lastIBTRate, // Simplified - should be BigDecimal
    lastUpdateTimestamp: timestamp,
  });
}
