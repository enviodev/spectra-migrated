// Reference: spectra-subgraph-master/src/entities/IBTAsset.ts

import { Asset_t } from "generated/src/db/Entities.gen";
import { BigDecimal } from "generated";
import { getERC4626Asset as getERC4626AssetEffect } from "../effects/getERC4626Asset";
import { getAsset } from "./Asset";
import { getIBTRate } from "./ERC4626";
import { getERC20Decimals } from "./ERC20";

/**
 * Get or create IBT Asset entity with IBT rate fields set
 * Reference: spectra-subgraph-master/src/entities/IBTAsset.ts createIBTAsset()
 * 
 * This function matches the subgraph's createIBTAsset() logic:
 * - Gets convertToAssets via getIBTRate()
 * - Gets underlying asset address via getERC4626Asset()
 * - Gets underlying decimals to calculate UNDERLYING_UNIT
 * - Sets convertToAssetsUnit, lastIBTRate, and lastUpdateTimestamp
 */
export async function getIBTAsset(
  ibtAddress: string,
  timestamp: bigint,
  chainId: number,
  blockNumber: number,
  context: any
): Promise<Asset_t> {
  // Normalize address to lowercase to prevent duplicate entries
  const normalizedIbtAddress = ibtAddress.toLowerCase();
  
  // Check if asset exists first (matches subgraph line 11)
  const assetIdWithChain = `${chainId}-${normalizedIbtAddress}`;
  let ibtAsset = await context.Asset.get(assetIdWithChain);

  // Note: The subgraph's getIBTAsset() returns existing asset without updating rates
  // However, test results show that rates can be stale/incorrect if not updated
  // We'll always recalculate and update rates to ensure accuracy at the current block
  // This is a deviation from subgraph behavior but necessary for correctness

  // Get or create basic asset (matches subgraph line 30 - getAsset())
  ibtAsset = await getAsset(
    normalizedIbtAddress,
    timestamp,
    "IBT",
    null,
    chainId,
    blockNumber,
    context
  );

  // Set chainId, address, createdAtTimestamp explicitly (matches subgraph lines 31-33)
  // Note: getAsset() already sets these, but subgraph sets them again explicitly
  ibtAsset = {
    ...ibtAsset,
    chainId: chainId,
    address: normalizedIbtAddress, // Use normalized address
    createdAtTimestamp: timestamp,
  };
  context.Asset.set(ibtAsset);

  // Get IBT rate (convertToAssets with 1 unit of shares)
  // Reference: subgraph line 34
  const convertToAssets = await getIBTRate(
    normalizedIbtAddress,
    chainId,
    blockNumber,
    context
  );

  // Get underlying asset address from ERC4626 vault
  // Reference: subgraph line 36-44 - getERC4626UnderlyingDecimals() first checks if asset exists and has underlying
  // If the IBT asset already has an underlying address cached, use it (matches subgraph behavior)
  let underlyingAddress: string;
  if (ibtAsset.underlying_id) {
    // Use cached underlying address from the asset entity (matches subgraph line 38-40)
    const underlyingAsset = await context.Asset.get(ibtAsset.underlying_id);
    if (underlyingAsset) {
      underlyingAddress = underlyingAsset.address;
    } else {
      // Fallback to RPC call if underlying asset doesn't exist
      const underlyingAssetResult = await context.effect(getERC4626AssetEffect, {
        vaultAddress: normalizedIbtAddress,
        chainId: chainId,
        blockNumber: blockNumber,
      });
      underlyingAddress = (underlyingAssetResult as { assetAddress: string }).assetAddress;
    }
  } else {
    // No cached underlying, fetch via RPC (matches subgraph line 43)
    const underlyingAssetResult = await context.effect(getERC4626AssetEffect, {
      vaultAddress: normalizedIbtAddress,
      chainId: chainId,
      blockNumber: blockNumber,
    });
    underlyingAddress = (underlyingAssetResult as { assetAddress: string }).assetAddress;
  }

  // Get underlying decimals to calculate UNDERLYING_UNIT
  // Reference: subgraph line 37-38
  const underlyingDecimals = await getERC20Decimals(
    underlyingAddress,
    chainId,
    blockNumber,
    context
  );

  // Calculate UNDERLYING_UNIT (10^underlying_decimals)
  // Reference: subgraph line 38
  let UNDERLYING_UNIT = BigInt(1);
  for (let i = 0; i < underlyingDecimals; i++) {
    UNDERLYING_UNIT *= BigInt(10);
  }

  // Calculate lastIBTRate (convertToAssets / UNDERLYING_UNIT as BigDecimal)
  // Reference: subgraph line 39 - convertToAssets.divDecimal(UNDERLYING_UNIT.toBigDecimal())
  // Convert both BigInts to BigDecimal and divide
  const convertToAssetsBD = new BigDecimal(convertToAssets.toString());
  const underlyingUnitBD = new BigDecimal(UNDERLYING_UNIT.toString());
  const lastIBTRate = convertToAssetsBD.div(underlyingUnitBD);

  // Update IBT Asset entity with rate fields
  // Reference: subgraph lines 35, 39-40
  const updatedIbtAsset: Asset_t = {
    ...ibtAsset,
    convertToAssetsUnit: convertToAssets,
    lastIBTRate: lastIBTRate,
    lastUpdateTimestamp: timestamp,
  };

  context.Asset.set(updatedIbtAsset);

  return updatedIbtAsset;
}

/**
 * Update IBT rates
 * Reference: spectra-subgraph-master/src/entities/IBTAsset.ts updateIBTRates()
 * 
 * This function matches the subgraph's updateIBTRates() logic:
 * - Gets convertToAssets via getIBTRate()
 * - Gets underlying asset address via getERC4626Asset()
 * - Gets underlying decimals to calculate UNDERLYING_UNIT
 * - Updates convertToAssetsUnit, lastIBTRate, and lastUpdateTimestamp
 */
export async function updateIBTRates(
  ibtAddress: string,
  timestamp: bigint,
  chainId: number,
  blockNumber: number,
  context: any
): Promise<void> {
  // Normalize address to lowercase to prevent duplicate entries
  const normalizedIbtAddress = ibtAddress.toLowerCase();
  
  // Get or create IBT Asset entity
  const ibtAsset = await getIBTAsset(
    normalizedIbtAddress,
    timestamp,
    chainId,
    blockNumber,
    context
  );

  // Get IBT rate (convertToAssets with 1 unit of shares)
  // Reference: subgraph line 21
  const convertToAssets = await getIBTRate(
    normalizedIbtAddress,
    chainId,
    blockNumber,
    context
  );

  // Get underlying asset address from ERC4626 vault
  // Reference: subgraph line 23 - getUnderlyingUnit() which calls getERC4626UnderlyingDecimals()
  // getERC4626UnderlyingDecimals() first checks if asset exists and has underlying cached (line 36-40)
  // Only fetches via RPC if not cached (line 43)
  let underlyingAddress: string;
  if (ibtAsset.underlying_id) {
    // Use cached underlying address from the asset entity (matches subgraph line 38-40)
    const underlyingAsset = await context.Asset.get(ibtAsset.underlying_id);
    if (underlyingAsset) {
      underlyingAddress = underlyingAsset.address;
    } else {
      // Fallback to RPC call if underlying asset doesn't exist
      const underlyingAssetResult = await context.effect(getERC4626AssetEffect, {
        vaultAddress: normalizedIbtAddress,
        chainId: chainId,
        blockNumber: blockNumber,
      });
      underlyingAddress = (underlyingAssetResult as { assetAddress: string }).assetAddress;
    }
  } else {
    // No cached underlying, fetch via RPC (matches subgraph line 43)
    const underlyingAssetResult = await context.effect(getERC4626AssetEffect, {
      vaultAddress: normalizedIbtAddress,
      chainId: chainId,
      blockNumber: blockNumber,
    });
    underlyingAddress = (underlyingAssetResult as { assetAddress: string }).assetAddress;
  }

  // Get underlying decimals to calculate UNDERLYING_UNIT
  // Reference: subgraph line 23 - getUnderlyingUnit() which calls getERC4626UnderlyingDecimals()
  const underlyingDecimals = await getERC20Decimals(
    underlyingAddress,
    chainId,
    blockNumber,
    context
  );

  // Calculate UNDERLYING_UNIT (10^underlying_decimals)
  // Reference: subgraph line 23
  let UNDERLYING_UNIT = BigInt(1);
  for (let i = 0; i < underlyingDecimals; i++) {
    UNDERLYING_UNIT *= BigInt(10);
  }

  // Calculate lastIBTRate (convertToAssets / UNDERLYING_UNIT as BigDecimal)
  // Reference: subgraph line 24 - convertToAssets.divDecimal(UNDERLYING_UNIT.toBigDecimal())
  const convertToAssetsBD = new BigDecimal(convertToAssets.toString());
  const underlyingUnitBD = new BigDecimal(UNDERLYING_UNIT.toString());
  const lastIBTRate = convertToAssetsBD.div(underlyingUnitBD);

  // Update IBT Asset entity
  // Reference: subgraph lines 22, 24-25
  context.Asset.set({
    ...ibtAsset,
    convertToAssetsUnit: convertToAssets,
    lastIBTRate: lastIBTRate,
    lastUpdateTimestamp: timestamp,
  });
}
