// Reference: spectra-subgraph-master/src/entities/AssetAmount.ts

import { AssetAmount_t } from "generated/src/db/Entities.gen";
import { ZERO_BI } from "../constants";
import { generateAssetAmountId } from "../utils/idGenerators";
import { getAsset } from "./Asset";

/**
 * Get or create AssetAmount entity
 * Accumulates amounts for the same transaction/asset/logIndex combination
 */
export async function getAssetAmount(
  transactionHash: string,
  assetAddress: string,
  amount: bigint,
  assetType: string,
  logIndex: string,
  timestamp: bigint,
  blockNumber: number,
  chainId: number,
  context: any
): Promise<AssetAmount_t> {
  // Normalize address to lowercase to prevent duplicate entries
  const normalizedAssetAddress = assetAddress.toLowerCase();
  
  // Generate AssetAmount ID
  const assetAmountId = `${chainId}-${generateAssetAmountId(
    transactionHash,
    normalizedAssetAddress,
    logIndex,
    assetType
  )}`;

  let assetAmount = await context.AssetAmount.get(assetAmountId);

  if (!assetAmount) {
    // Get or create Asset entity (getAsset will normalize the address)
    const asset = await getAsset(
      normalizedAssetAddress,
      timestamp,
      assetType,
      null,
      chainId,
      blockNumber,
      context
    );

    // Create AssetAmount entity
    assetAmount = {
      id: assetAmountId,
      createdAtTimestamp: timestamp,
      amount: ZERO_BI,
      asset_id: asset.id,
      // transactionIn and transactionOut are @derivedFrom, so we don't set them
    };
    context.AssetAmount.set(assetAmount);
  }

  // Accumulate amount (matches original subgraph behavior)
  // Reference: subgraph line 29 - assetAmount.amount.plus(amount)
  // Re-read the assetAmount to ensure we have the latest value (in case of concurrent updates)
  const currentAssetAmount = await context.AssetAmount.get(assetAmountId);
  const currentAmount = currentAssetAmount?.amount || assetAmount.amount || ZERO_BI;
  const newAmount = currentAmount + amount;
  
  const updatedAssetAmount = {
    ...(currentAssetAmount || assetAmount),
    amount: newAmount,
  };
  
  context.AssetAmount.set(updatedAssetAmount);

  return updatedAssetAmount;
}
