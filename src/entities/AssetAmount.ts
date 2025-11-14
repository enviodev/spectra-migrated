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
  // Generate AssetAmount ID
  const assetAmountId = `${chainId}-${generateAssetAmountId(
    transactionHash,
    assetAddress,
    logIndex,
    assetType
  )}`;

  let assetAmount = await context.AssetAmount.get(assetAmountId);

  if (!assetAmount) {
    // Get or create Asset entity
    const asset = await getAsset(
      assetAddress,
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
  const newAmount = assetAmount.amount + amount;
  context.AssetAmount.set({
    ...assetAmount,
    amount: newAmount,
  });

  return {
    ...assetAmount,
    amount: newAmount,
  };
}
