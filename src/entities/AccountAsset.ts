// Reference: spectra-subgraph-master/src/entities/AccountAsset.ts

import { AccountAsset_t } from "generated/src/db/Entities.gen";
import { ZERO_BI } from "../constants";
import { generateAccountAssetId } from "../utils/idGenerators";
import { getAccount } from "./Account";

/**
 * Get Asset ID with suffix (for special assets like MV request/redeem)
 */
export function getAssetId(address: string, suffix: string): string {
  // Normalize address to lowercase to prevent duplicate entries
  return `${address.toLowerCase()}_${suffix}`;
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
  // Normalize addresses to lowercase to prevent duplicate entries
  const normalizedAccountAddress = accountAddress.toLowerCase();
  const normalizedAssetAddress = assetAddress.toLowerCase();
  
  // Generate account asset ID
  const finalAssetId = assetId !== null ? assetId : normalizedAssetAddress;
  const accountAssetId = `${chainId}-${generateAccountAssetId(normalizedAccountAddress, finalAssetId)}`;
  
  let accountAsset = await context.AccountAsset.get(accountAssetId);
  
  if (!accountAsset) {
    // Get or create account (getAccount will normalize the address)
    const account = await getAccount(normalizedAccountAddress, timestamp, chainId, context);
    
    // TODO: Get or create asset via getAsset
    // For now, create AccountAsset with asset_id pointing to assetAddress
    // Full implementation needs: const asset = await getAsset(normalizedAssetAddress, timestamp, assetType, assetId, chainId, context);
    const assetIdWithChain = assetId !== null 
      ? `${chainId}-${assetId}` 
      : `${chainId}-${normalizedAssetAddress}`;
    
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
  // Normalize addresses to lowercase to prevent duplicate entries
  const normalizedAccountAddress = accountAddress.toLowerCase();
  const normalizedMetavaultAddress = metavaultAddress.toLowerCase();
  
  // Get asset ID with suffix for metavault requests
  const assetId = getAssetId(normalizedMetavaultAddress, requestType);
  
  // Get or create account asset
  let accountAsset = await getAccountAsset(
    normalizedAccountAddress,
    normalizedMetavaultAddress,
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
  // Normalize addresses to lowercase to prevent duplicate entries
  const normalizedAccountAddress = accountAddress.toLowerCase();
  const normalizedAssetAddress = assetAddress.toLowerCase();
  
  // Get or create AccountAsset
  const accountAsset = await getAccountAsset(
    normalizedAccountAddress,
    normalizedAssetAddress,
    timestamp,
    assetType,
    null,
    chainId,
    context
  );
  
  // Fetch balance via RPC
  // For IBT assets, use getERC4626Balance; for others, use getERC20Balance
  // Reference: subgraph lines 89-93
  let balanceResult;
  try {
    if (assetType === "IBT") {
      balanceResult = await context.effect(
        (await import("../effects/getERC4626Balance")).getERC4626Balance,
        {
          tokenAddress: normalizedAssetAddress,
          accountAddress: normalizedAccountAddress,
          chainId: chainId,
          blockNumber: blockNumber,
        }
      );
    } else {
      balanceResult = await context.effect(
        (await import("../effects/getERC20Balance")).getERC20Balance,
        {
          tokenAddress: normalizedAssetAddress,
          accountAddress: normalizedAccountAddress,
          chainId: chainId,
          blockNumber: blockNumber,
        }
      );
    }
    
    const balance = BigInt((balanceResult as { balance: string }).balance);
    
    // Update balance
    // Reference: subgraph line 95 - accountAsset.balance = getERC20Balance/getERC4626Balance
    const updatedAccountAsset = {
      ...accountAsset,
      balance: balance,
    };
    context.AccountAsset.set(updatedAccountAsset);
    return updatedAccountAsset;
  } catch (error) {
    // If RPC call fails, log warning but don't throw - return accountAsset with existing balance
    // This matches subgraph behavior where RPC calls can fail silently
    context.log.warn(`updateAccountAssetBalance failed for account ${normalizedAccountAddress}, asset ${normalizedAssetAddress}: ${String(error)}`);
    return accountAsset;
  }
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
  // Normalize addresses to lowercase to prevent duplicate entries
  const normalizedAccountAddress = accountAddress.toLowerCase();
  const normalizedYtAddress = ytAddress.toLowerCase();
  const normalizedPrincipalTokenAddress = principalTokenAddress.toLowerCase();
  
  // Get or create AccountAsset for YT
  const accountAsset = await getAccountAsset(
    normalizedAccountAddress,
    normalizedYtAddress,
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
      tokenAddress: normalizedYtAddress,
      accountAddress: normalizedAccountAddress,
      chainId: chainId,
      blockNumber: blockNumber,
    }
  );
  
  const balance = BigInt((balanceResult as { balance: string }).balance);
  
  // Update balance and set principalToken relationship
  const futureId = `${chainId}-${normalizedPrincipalTokenAddress}`;
  const updatedAccountAsset = {
    ...accountAsset,
    balance: balance,
    principalToken_id: futureId,
  };
  context.AccountAsset.set(updatedAccountAsset);
  return updatedAccountAsset;
}
