// Reference: spectra-subgraph-master/src/entities/AccountAsset.ts

import { AccountAsset_t } from "generated/src/db/Entities.gen";
import { ZERO_BI } from "../constants";
import { generateAccountAssetId } from "../utils/idGenerators";
import { getAccount } from "./Account";

/**
 * Get Asset ID with suffix (for special assets like MV request/redeem)
 */
export function getAssetId(address: string, suffix: string): string {
  return `${address}_${suffix}`;
}

/**
 * Get or create AccountAsset entity
 * Simplified version - full implementation requires getAsset
 */
export async function getAccountAsset(
  accountAddress: string,
  assetAddress: string,
  timestamp: bigint,
  assetType: string,
  assetId: string | null = null,
  chainId: number,
  context: any
): Promise<AccountAsset_t> {
  // Generate account asset ID
  const finalAssetId = assetId !== null ? assetId : assetAddress;
  const accountAssetId = `${chainId}-${generateAccountAssetId(accountAddress, finalAssetId)}`;
  
  let accountAsset = await context.AccountAsset.get(accountAssetId);
  
  if (!accountAsset) {
    // Get or create account
    const account = await getAccount(accountAddress, timestamp, chainId, context);
    
    // TODO: Get or create asset via getAsset
    // For now, create AccountAsset with asset_id pointing to assetAddress
    // Full implementation needs: const asset = await getAsset(assetAddress, timestamp, assetType, assetId, chainId, context);
    const assetIdWithChain = assetId !== null 
      ? `${chainId}-${assetId}` 
      : `${chainId}-${assetAddress}`;
    
    accountAsset = {
      id: accountAssetId,
      createdAtTimestamp: timestamp,
      balance: ZERO_BI,
      epochId: ZERO_BI,
      asset_id: assetIdWithChain, // TODO: Set via getAsset
      account_id: account.id,
      pool_id: undefined,
      principalToken_id: undefined,
      generatedYield: undefined,
    };
    context.AccountAsset.set(accountAsset);
  }
  
  return accountAsset;
}

/**
 * Update AccountAsset for metavault requests (deposit/redeem)
 * Simplified version - full implementation requires RPC call for epochId
 */
export async function updateAccountMetavaultRequest(
  accountAddress: string,
  metavaultAddress: string,
  timestamp: bigint,
  requestType: string, // AssetType.MV_REQUEST_DEPOSIT or MV_REQUEST_REDEEM
  operation: string, // "add", "sub", or "set"
  amount: bigint,
  chainId: number,
  context: any
): Promise<AccountAsset_t> {
  // Get asset ID with suffix for metavault requests
  const assetId = getAssetId(metavaultAddress, requestType);
  
  // Get or create account asset
  let accountAsset = await getAccountAsset(
    accountAddress,
    metavaultAddress,
    timestamp,
    requestType,
    assetId,
    chainId,
    context
  );
  
  // Update balance based on operation
  if (operation === "add") {
    accountAsset = {
      ...accountAsset,
      balance: accountAsset.balance + amount,
    };
  } else if (operation === "sub") {
    accountAsset = {
      ...accountAsset,
      balance: accountAsset.balance - amount,
    };
  } else if (operation === "set") {
    accountAsset = {
      ...accountAsset,
      balance: amount,
    };
  } else {
    throw new Error(`Invalid operation: ${operation}`);
  }
  
  // TODO: Get epochId via RPC call
  // const epochId = await getMetavaultWrapperEpochId(metavaultAddress, chainId, context);
  // For now, keep existing epochId
  accountAsset = {
    ...accountAsset,
    createdAtTimestamp: timestamp,
    // epochId: epochId, // TODO: Set via RPC call
  };
  
  context.AccountAsset.set(accountAsset);
  return accountAsset;
}

/**
 * Update AccountAsset balance by fetching from contract via RPC
 * Reference: spectra-subgraph-master/src/entities/AccountAsset.ts
 */
export async function updateAccountAssetBalance(
  accountAddress: string,
  assetAddress: string,
  timestamp: bigint,
  assetType: string,
  chainId: number,
  blockNumber: number,
  context: any
): Promise<AccountAsset_t> {
  // Get or create AccountAsset
  const accountAsset = await getAccountAsset(
    accountAddress,
    assetAddress,
    timestamp,
    assetType,
    null,
    chainId,
    context
  );
  
  // Fetch balance via RPC
  // For IBT assets, use getERC4626Balance; for others, use getERC20Balance
  let balanceResult;
  if (assetType === "IBT") {
    balanceResult = await context.effect(
      (await import("../effects/getERC4626Balance")).getERC4626Balance,
      {
        tokenAddress: assetAddress,
        accountAddress: accountAddress,
        chainId: chainId,
        blockNumber: blockNumber,
      }
    );
  } else {
    balanceResult = await context.effect(
      (await import("../effects/getERC20Balance")).getERC20Balance,
      {
        tokenAddress: assetAddress,
        accountAddress: accountAddress,
        chainId: chainId,
        blockNumber: blockNumber,
      }
    );
  }
  
  const balance = BigInt((balanceResult as { balance: string }).balance);
  
  // Update balance
  const updatedAccountAsset = {
    ...accountAsset,
    balance: balance,
  };
  context.AccountAsset.set(updatedAccountAsset);
  return updatedAccountAsset;
}

/**
 * Update AccountAsset YT balance
 * Reference: spectra-subgraph-master/src/entities/AccountAsset.ts
 */
export async function updateAccountAssetYTBalance(
  accountAddress: string,
  ytAddress: string,
  timestamp: bigint,
  assetType: string,
  principalTokenAddress: string,
  chainId: number,
  blockNumber: number,
  context: any
): Promise<AccountAsset_t> {
  // Get or create AccountAsset for YT
  const accountAsset = await getAccountAsset(
    accountAddress,
    ytAddress,
    timestamp,
    assetType,
    null,
    chainId,
    context
  );
  
  // Fetch balance via RPC
  const balanceResult = await context.effect(
    (await import("../effects/getERC20Balance")).getERC20Balance,
    {
      tokenAddress: ytAddress,
      accountAddress: accountAddress,
      chainId: chainId,
      blockNumber: blockNumber,
    }
  );
  
  const balance = BigInt((balanceResult as { balance: string }).balance);
  
  // Update balance and set principalToken relationship
  const futureId = `${chainId}-${principalTokenAddress}`;
  const updatedAccountAsset = {
    ...accountAsset,
    balance: balance,
    principalToken_id: futureId,
  };
  context.AccountAsset.set(updatedAccountAsset);
  return updatedAccountAsset;
}
