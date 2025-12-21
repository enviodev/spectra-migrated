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

  // Logging for specific AssetAmount IDs being debugged
  const TRACK_ID_1 = "1-0x00259cbeb2647834f9f9e2fb52630407aedf35403a524c4c9992f1851c3bd42d-0x740c030edbdddfcf14dffbedb8019dd841376b42-LP-233";
  const TRACK_ID_2 = "1-0x0015ef6e95bd45f1a91498be9eea32e133e0dfd0636b4c1600908062aba6452d-0xa62ca1514944cc858a52e672df52fde0fda44a20-LP-495";
  const isTracked = assetAmountId.toLowerCase() === TRACK_ID_1.toLowerCase() || 
                    assetAmountId.toLowerCase() === TRACK_ID_2.toLowerCase();

  if (isTracked) {
    context.log.info(`[AssetAmount.getAssetAmount Debug] ID: ${assetAmountId}`);
    context.log.info(`  TransactionHash: ${transactionHash}`);
    context.log.info(`  AssetAddress: ${normalizedAssetAddress}`);
    context.log.info(`  AssetType: ${assetType}`);
    context.log.info(`  LogIndex: ${logIndex}`);
    context.log.info(`  Amount being added: ${amount.toString()}`);
  }

  let assetAmount = await context.AssetAmount.get(assetAmountId);

  if (!assetAmount) {
    if (isTracked) {
      context.log.info(`  AssetAmount does not exist, creating new entity`);
    }
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
  } else {
    if (isTracked) {
      context.log.info(`  AssetAmount exists, current amount: ${assetAmount.amount.toString()}`);
    }
  }

  // Accumulate amount (matches original subgraph behavior)
  // Reference: subgraph line 29 - assetAmount.amount.plus(amount)
  const newAmount = assetAmount.amount + amount;
  
  if (isTracked) {
    context.log.info(`  New amount (current + added): ${assetAmount.amount.toString()} + ${amount.toString()} = ${newAmount.toString()}`);
  }
  
  const updatedAssetAmount = {
    ...assetAmount,
    amount: newAmount,
  };
  
  context.AssetAmount.set(updatedAssetAmount);

  if (isTracked) {
    context.log.info(`  AssetAmount saved with amount: ${updatedAssetAmount.amount.toString()}`);
  }

  return updatedAssetAmount;
}
