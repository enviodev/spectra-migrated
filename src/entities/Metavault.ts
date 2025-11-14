// Reference: spectra-subgraph-master/src/entities/Metavault.ts

import { Metavault_t, Infravault_t, Asset_t, MetavaultEpoch_t } from "generated/src/db/Entities.gen";
import { getAccount } from "./Account";
import { getMetavaultWrapperData } from "../effects/getMetavaultWrapperData";
import { checkAmphorAsyncVault } from "../effects/checkAmphorAsyncVault";
import { getAsset } from "./Asset";

// InfravaultType constants (from spectra-subgraph-master/src/utils/InfraVaultType.ts)
const InfraVaultType = {
  AMPHOR_ASYNC_VAULT: "AMPHOR_ASYNC_VAULT",
  UNKNOWN: "UNKNOWN",
} as const;

// AssetType constants (from spectra-subgraph-master/src/utils/AssetType.ts)
const AssetType = {
  UNDERLYING: "UNDERLYING",
  MV_SHARES: "MV_SHARES",
} as const;

/**
 * Get or create Metavault entity
 * Note: name, symbol, decimals, and ytAsset are only set when wrapper is initialized
 * (see getMetavaultFromWrapper in original subgraph)
 */
export async function getMetavault(
  metavaultAddress: string,
  timestamp: bigint,
  blockNumber: number,
  chainId: number,
  context: any
): Promise<Metavault_t> {
  // Prefix with chainId for multichain support
  const metavaultId = `${chainId}-${metavaultAddress}`;
  
  let metavault = await context.Metavault.get(metavaultId);
  
  if (!metavault) {
    // Get or create Account entity for the metavault address
    const account = await getAccount(metavaultAddress, timestamp, chainId, context);
    
    // Create Metavault entity
    // Note: name, symbol, decimals, ytAsset are optional and only set when wrapper is initialized
    // markets and chains are @derivedFrom fields, so we don't set them directly
    metavault = {
      id: metavaultId,
      address: metavaultAddress,
      safeAddress: metavaultAddress,
      createdAtTimestamp: timestamp,
      createdAtBlock: BigInt(blockNumber),
      isMetavaultRegistered: false,
      // Optional fields - set when wrapper is initialized
      name: undefined,
      symbol: undefined,
      decimals: undefined,
      // Relationships
      account_id: account.id,
      ytAsset_id: undefined, // Set when wrapper is initialized
      wrapperAddress: undefined,
      infravault_id: undefined,
      underlying_id: undefined,
    };
    context.Metavault.set(metavault);
  }
  
  return metavault;
}

/**
 * Infer infravault type by checking if it's an AmphorAsyncVault
 * Uses RPC calls to check pendingSilo, claimableSilo, epochId
 */
export async function inferInfravaultType(
  infravaultAddress: string,
  chainId: number,
  blockNumber: number,
  context: any
): Promise<string> {
  // Check if it's an AmphorAsyncVault via effect
  const checkResult = await context.effect(checkAmphorAsyncVault, {
    infravaultAddress: infravaultAddress,
    chainId: chainId,
    blockNumber: blockNumber,
  });
  
  const result = checkResult as { isAmphorAsyncVault: boolean };
  
  if (result.isAmphorAsyncVault) {
    return InfraVaultType.AMPHOR_ASYNC_VAULT;
  }
  
  return InfraVaultType.UNKNOWN;
}

/**
 * Create Infravault entity
 */
export async function createInfravault(
  infravaultAddress: string,
  metavaultAddress: string,
  chainId: number,
  blockNumber: number,
  context: any
): Promise<Infravault_t> {
  // Prefix with chainId for multichain support
  const infravaultId = `${chainId}-${infravaultAddress}`;
  
  let infravault = await context.Infravault.get(infravaultId);
  
  if (!infravault) {
    // Infer infravault type
    const infravaultType = await inferInfravaultType(infravaultAddress, chainId, blockNumber, context);
    
    // Get metavault ID
    const metavaultId = `${chainId}-${metavaultAddress}`;
    
    infravault = {
      id: infravaultId,
      address: infravaultAddress,
      metavault_id: metavaultId,
      infravaultType: infravaultType as "AMPHOR_ASYNC_VAULT" | "UNKNOWN",
    };
    context.Infravault.set(infravault);
    
    // Note: If infravaultType is AMPHOR_ASYNC_VAULT, AmphorAsyncVault template registration
    // is handled via contractRegister in the handler (see amphorAsyncVault.ts)
  }
  
  return infravault;
}

/**
 * Get or create Metavault from wrapper address
 * This fetches wrapper data via RPC and populates metavault fields
 */
export async function getMetavaultFromWrapper(
  metavaultWrapperAddress: string,
  timestamp: bigint,
  blockNumber: number,
  chainId: number,
  context: any
): Promise<Metavault_t> {
  // Fetch wrapper data via effect
  const wrapperDataResult = await context.effect(getMetavaultWrapperData, {
    wrapperAddress: metavaultWrapperAddress,
    chainId: chainId,
    blockNumber: blockNumber,
  });
  
  const wrapperData = wrapperDataResult as {
    owner: string;
    infravaultAddress: string;
    name: string;
    symbol: string;
    decimals: number;
    asset: string;
  };
  
  // Get metavault by owner (safeAddress)
  const safeAddress = wrapperData.owner;
  let metavault = await getMetavault(safeAddress, timestamp, blockNumber, chainId, context);
  
  // If metavault already has a wrapper assigned, just update it and return
  if (metavault.wrapperAddress) {
    // Update wrapper address if different
    if (metavault.wrapperAddress !== metavaultWrapperAddress) {
      context.Metavault.set({
        ...metavault,
        wrapperAddress: metavaultWrapperAddress,
      });
    }
    return metavault;
  }
  
  // Metavault does not have a wrapper assigned yet, fill remaining fields
  // Create infravault
  const infravault = await createInfravault(
    wrapperData.infravaultAddress,
    safeAddress,
    chainId,
    blockNumber,
    context
  );
  
  // Get or create Asset entities for underlying and MV_SHARES
  const underlyingAsset = await getAsset(
    wrapperData.asset,
    timestamp,
    AssetType.UNDERLYING,
    null,
    chainId,
    blockNumber,
    context
  );
  
  // For MV_SHARES, use the wrapper address with suffix
  const mvSharesAssetId = `${metavaultWrapperAddress}_MV_SHARES`;
  const mvSharesAsset = await getAsset(
    metavaultWrapperAddress,
    timestamp,
    AssetType.MV_SHARES,
    mvSharesAssetId,
    chainId,
    blockNumber,
    context
  );
  
  // Update metavault with all wrapper data
  context.Metavault.set({
    ...metavault,
    wrapperAddress: metavaultWrapperAddress,
    infravault_id: infravault.id,
    name: wrapperData.name,
    symbol: wrapperData.symbol,
    decimals: wrapperData.decimals,
    underlying_id: underlyingAsset.id,
  });
  
  return metavault;
}

/**
 * Create MetavaultEpoch entity
 * Reference: spectra-subgraph-master/src/entities/Metavault.ts
 * 
 * Note: In the original subgraph, it ALWAYS gets the safeAddress (owner) from the wrapper contract
 * via RPC call: MetavaultWrapper.bind(metavaultWrapperAddress).try_owner().value
 * The safeAddress is the metavault's address (the owner of the wrapper).
 * The epoch ID and metavault relationship use this safeAddress, not the wrapper address.
 */
export async function createMetavaultEpoch(
  metavaultWrapperAddress: string,
  epochId: bigint,
  rate: bigint,
  assets: bigint,
  timestamp: bigint,
  blockNumber: bigint,
  chainId: number,
  context: any
): Promise<MetavaultEpoch_t> {
  // Always fetch owner from wrapper contract via RPC (matches original subgraph)
  // Original: let safeAddress = MetavaultWrapper.bind(metavaultWrapperAddress).try_owner().value
  const wrapperDataResult = await context.effect(getMetavaultWrapperData, {
    wrapperAddress: metavaultWrapperAddress,
    chainId: chainId,
    blockNumber: blockNumber,
  });
  
  const wrapperData = wrapperDataResult as {
    owner: string;
    infravaultAddress: string;
    name: string;
    symbol: string;
    decimals: number;
    asset: string;
  };
  
  // The owner is the safeAddress (metavault address)
  const safeAddress = wrapperData.owner;
  
  // Generate epoch ID: safeAddress-epochId-timestamp (matches original subgraph)
  const epochIdStr = `${chainId}-${safeAddress}-${epochId.toString()}-${timestamp.toString()}`;
  
  // Get metavault by safeAddress (the actual metavault ID)
  const metavaultId = `${chainId}-${safeAddress}`;
  const metavault = await context.Metavault.get(metavaultId);
  
  if (!metavault) {
    console.warn(`createMetavaultEpoch: Metavault not found for safeAddress ${safeAddress}`);
  }
  
  let epoch = await context.MetavaultEpoch.get(epochIdStr);
  
  if (!epoch) {
    epoch = {
      id: epochIdStr,
      timestamp: timestamp,
      blockNumber: blockNumber,
      rate: rate,
      assets: assets,
      metavault_id: metavault?.id || metavaultId,
    };
    context.MetavaultEpoch.set(epoch);
  }
  
  return epoch;
}
