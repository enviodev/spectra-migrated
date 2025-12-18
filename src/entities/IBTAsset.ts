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
  // Track specific address for debugging
  const TRACK_ADDRESS = "0x0022228a2cc5e7ef0274a7baa600d44da5ab5776";
  const isTracking = ibtAddress.toLowerCase() === TRACK_ADDRESS.toLowerCase();

  if (isTracking) {
    context.log.info(`[getIBTAsset] Processing tracked address: ${ibtAddress} at block ${blockNumber}, timestamp: ${timestamp.toString()}`);
  }

  // Normalize address to lowercase to prevent duplicate entries
  const normalizedIbtAddress = ibtAddress.toLowerCase();
  
  // Check if asset exists first (matches subgraph line 11)
  const assetIdWithChain = `${chainId}-${normalizedIbtAddress}`;
  let ibtAsset = await context.Asset.get(assetIdWithChain);

  if (ibtAsset) {
    // Asset exists, return it (matches subgraph line 12-13)
    // Note: In subgraph, if asset exists but doesn't have rate fields, it still returns it without setting them
    // This matches subgraph behavior - rate fields are only set when asset is first created
    if (isTracking) {
      context.log.info(`[getIBTAsset] Asset exists - id: ${ibtAsset.id}, convertToAssetsUnit: ${ibtAsset.convertToAssetsUnit?.toString() || 'null'}, lastIBTRate: ${ibtAsset.lastIBTRate?.toString() || 'null'}, returning without update (matches subgraph)`);
    }
    return ibtAsset;
  }

  // Asset doesn't exist, create it with rate fields (matches subgraph line 15 - createIBTAsset())
  if (isTracking) {
    context.log.info(`[getIBTAsset] Asset doesn't exist, creating with rate fields (matches subgraph createIBTAsset())`);
  }

  // Create basic asset first (matches subgraph line 30 - getAsset())
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

  if (isTracking) {
    context.log.info(`[getIBTAsset] getIBTRate result: ${convertToAssets.toString()}`);
  }

  // Get underlying asset address from ERC4626 vault
  // Reference: subgraph line 36-44 - getERC4626UnderlyingDecimals() first checks if asset exists and has underlying
  // If the IBT asset already has an underlying address cached, use it (matches subgraph behavior)
  let underlyingAddress: string;
  if (ibtAsset.underlying_id) {
    // Use cached underlying address from the asset entity (matches subgraph line 38-40)
    const underlyingAsset = await context.Asset.get(ibtAsset.underlying_id);
    if (underlyingAsset) {
      underlyingAddress = underlyingAsset.address;
      if (isTracking) {
        context.log.info(`[getIBTAsset] Using cached underlying address from asset: ${underlyingAddress}`);
      }
    } else {
      // Fallback to RPC call if underlying asset doesn't exist
      const underlyingAssetResult = await context.effect(getERC4626AssetEffect, {
        vaultAddress: normalizedIbtAddress,
        chainId: chainId,
        blockNumber: blockNumber,
      });
      underlyingAddress = (underlyingAssetResult as { assetAddress: string }).assetAddress;
      if (isTracking) {
        context.log.info(`[getIBTAsset] Fetched underlying address via RPC: ${underlyingAddress}`);
      }
    }
  } else {
    // No cached underlying, fetch via RPC (matches subgraph line 43)
    const underlyingAssetResult = await context.effect(getERC4626AssetEffect, {
      vaultAddress: normalizedIbtAddress,
      chainId: chainId,
      blockNumber: blockNumber,
    });
    underlyingAddress = (underlyingAssetResult as { assetAddress: string }).assetAddress;
    if (isTracking) {
      context.log.info(`[getIBTAsset] Fetched underlying address via RPC (no cache): ${underlyingAddress}`);
    }
  }

  if (isTracking) {
    context.log.info(`[getIBTAsset] getERC4626Asset result: ${underlyingAddress}`);
  }

  // Get underlying decimals to calculate UNDERLYING_UNIT
  // Reference: subgraph line 37-38
  const underlyingDecimals = await getERC20Decimals(
    underlyingAddress,
    chainId,
    blockNumber,
    context
  );

  if (isTracking) {
    context.log.info(`[getIBTAsset] underlying decimals: ${underlyingDecimals}`);
  }

  // Calculate UNDERLYING_UNIT (10^underlying_decimals)
  // Reference: subgraph line 38
  let UNDERLYING_UNIT = BigInt(1);
  for (let i = 0; i < underlyingDecimals; i++) {
    UNDERLYING_UNIT *= BigInt(10);
  }

  if (isTracking) {
    context.log.info(`[getIBTAsset] UNDERLYING_UNIT: ${UNDERLYING_UNIT.toString()}`);
  }

  // Calculate lastIBTRate (convertToAssets / UNDERLYING_UNIT as BigDecimal)
  // Reference: subgraph line 39 - convertToAssets.divDecimal(UNDERLYING_UNIT.toBigDecimal())
  // Convert both BigInts to BigDecimal and divide
  const convertToAssetsBD = new BigDecimal(convertToAssets.toString());
  const underlyingUnitBD = new BigDecimal(UNDERLYING_UNIT.toString());
  const lastIBTRate = convertToAssetsBD.div(underlyingUnitBD);

  if (isTracking) {
    context.log.info(`[getIBTAsset] Calculated lastIBTRate: ${lastIBTRate.toString()}`);
  }

  // Update IBT Asset entity with rate fields
  // Reference: subgraph lines 35, 39-40
  const updatedIbtAsset: Asset_t = {
    ...ibtAsset,
    convertToAssetsUnit: convertToAssets,
    lastIBTRate: lastIBTRate,
    lastUpdateTimestamp: timestamp,
  };

  if (isTracking) {
    context.log.info(`[getIBTAsset] Setting asset with - convertToAssetsUnit: ${updatedIbtAsset.convertToAssetsUnit?.toString() || 'null'}, lastIBTRate: ${updatedIbtAsset.lastIBTRate?.toString() || 'null'}, lastUpdateTimestamp: ${updatedIbtAsset.lastUpdateTimestamp?.toString() || 'null'}`);
    context.log.info(`[getIBTAsset] Calculation details - convertToAssets: ${convertToAssets.toString()}, UNDERLYING_UNIT: ${UNDERLYING_UNIT.toString()}, underlyingDecimals: ${underlyingDecimals}, underlyingAddress: ${underlyingAddress}`);
  }

  context.Asset.set(updatedIbtAsset);

  if (isTracking) {
    context.log.info(`[getIBTAsset] Asset.set() called for ${normalizedIbtAddress} at block ${blockNumber}`);
  }

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
  // Reference: subgraph uses getERC4626Asset() via getUnderlyingUnit()
  const underlyingAssetResult = await context.effect(getERC4626AssetEffect, {
    vaultAddress: normalizedIbtAddress,
    chainId: chainId,
    blockNumber: blockNumber,
  });
  const underlyingAddress = (underlyingAssetResult as { assetAddress: string }).assetAddress;

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
