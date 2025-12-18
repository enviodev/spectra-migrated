// Reference: spectra-subgraph-master/src/entities/Asset.ts

import { Asset_t } from "generated/src/db/Entities.gen";
import { getERC20Name, getERC20Symbol, getERC20Decimals } from "./ERC20";

/**
 * Get or create Asset entity
 * Reference: spectra-subgraph-master/src/entities/Asset.ts
 * 
 * IMPORTANT: Matches original subgraph pattern exactly:
 * 1. Check if Asset exists in database
 * 2. If exists, return it
 * 3. If not exists, create it by calling getERC20Name, getERC20Symbol, getERC20Decimals
 *    (which check database first, then make RPC calls if needed)
 */
export async function getAsset(
  address: string,
  timestamp: bigint,
  assetType: string,
  assetId: string | null = null,
  chainId: number,
  blockNumber: number,
  context: any
): Promise<Asset_t> {
  // Normalize address to lowercase to prevent duplicate entries
  const normalizedAddress = address.toLowerCase();
  
  // Use provided assetId or normalized address as ID
  const finalAssetId = assetId !== null ? assetId : normalizedAddress;
  // Prefix with chainId for multichain support
  const assetIdWithChain = `${chainId}-${finalAssetId}`;

  let asset = await context.Asset.get(assetIdWithChain);

  if (!asset) {
    // Create Asset entity by calling helper functions
    // These functions check database first, then make RPC calls if needed
    // This matches the original subgraph pattern exactly
    const [name, symbol, decimals] = await Promise.all([
      getERC20Name(normalizedAddress, chainId, blockNumber, context),
      getERC20Symbol(normalizedAddress, chainId, blockNumber, context),
      getERC20Decimals(normalizedAddress, chainId, blockNumber, context),
    ]);

    // Create Asset entity
    asset = {
      id: assetIdWithChain,
      chainId: chainId,
      address: normalizedAddress, // Store normalized (lowercase) address
      createdAtTimestamp: timestamp,
      name: name,
      symbol: symbol,
      decimals: decimals,
      assetType: assetType as any, // AssetType enum
      // Optional relationships
      price: undefined,
      chainlinkPriceFeed: undefined,
      futureVault: undefined,
      underlying: undefined,
      ibt: undefined,
      fytTokenDetails: undefined,
      lpTokenDetails: undefined,
      lastIBTRate: undefined,
      convertToAssetsUnit: undefined,
      lastUpdateTimestamp: undefined,
    };
    context.Asset.set(asset);
  }

  // Note: IBT rate fields are NOT set here (matches subgraph behavior)
  // The subgraph's getAsset() does NOT set IBT rate fields
  // IBT rate fields are only set in getIBTAsset() -> createIBTAsset() when the asset is first created
  // Reference: subgraph's getAsset() only creates basic asset, no IBT-specific logic

  return asset;
}

