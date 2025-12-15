// Reference: spectra-subgraph/src/mappings/metavaults/metavaultRegistry.ts

import { MetavaultsRegistry } from "generated";
import { getMetavault, createMetavaultBridgePath, getMetavaultBridgePathId } from "../../entities/Metavault";
import { getAsset } from "../../entities/Asset";
import { AssetType } from "../../utils/AssetType";

MetavaultsRegistry.MetavaultRegistered.handler(async ({ event, context }) => {
  // Reference: spectra-subgraph/src/mappings/metavaults/metavaultRegistry.ts handleMetavaultRegistered
  // Logic: Get metavault and set isMetavaultRegistered to true

  let metavault = await getMetavault(
    event.params.metavault,
    BigInt(event.block.timestamp),
    event.block.number,
    event.chainId,
    context
  );

  // Update isMetavaultRegistered flag
  context.Metavault.set({
    ...metavault,
    isMetavaultRegistered: true,
  });
});

MetavaultsRegistry.MetavaultUnregistered.handler(async ({ event, context }) => {
  // Reference: spectra-subgraph/src/mappings/metavaults/metavaultRegistry.ts handleMetavaultUnregistered
  // Logic: Get metavault and set isMetavaultRegistered to false

  let metavault = await getMetavault(
    event.params.metavault,
    BigInt(event.block.timestamp),
    event.block.number,
    event.chainId,
    context
  );

  // Update isMetavaultRegistered flag
  context.Metavault.set({
    ...metavault,
    isMetavaultRegistered: false,
  });
});

MetavaultsRegistry.ChainRegistered.handler(async ({ event, context }) => {
  // Reference: spectra-subgraph/src/mappings/metavaults/metavaultRegistry.ts handleChainRegistered
  // Logic: Get metavault (ensures it exists), create RemoteMetavault entity
  // Note: In new subgraph, they manually update metavault.chains array. In Envio, chains is @derivedFrom,
  // so setting metavault_id on RemoteMetavault automatically populates metavault.chains
  
  // Get metavault to ensure it exists (matches new subgraph pattern)
  // Note: We don't use the return value because @derivedFrom handles the chains relationship automatically
  await getMetavault(
    event.params.metavault,
    BigInt(event.block.timestamp),
    event.block.number,
    event.chainId,
    context
  );

  // Prefix with chainId for multichain support
  const metavaultId = `${event.chainId}-${event.params.metavault}`;

  // Create RemoteMetavault entity
  // ID format: `${event.chainId}-${metavault}-${event.params.chainId}`
  // - event.chainId = source chain (where event is emitted, e.g., Arbitrum = 42161)
  // - event.params.chainId = destination chain (being registered, e.g., Base = 8453)
  // Both are needed to prevent collisions in multichain indexing
  // Note: New subgraph uses only `metavault-${chainId}` format, but that's not multichain-safe
  const remoteMetavaultId = `${event.chainId}-${event.params.metavault}-${event.params.chainId}`;

  // Convert chainId from bigint to number (destination chain ID)
  const chainIdNum = Number(event.params.chainId);

  const remoteMetavault = {
    id: remoteMetavaultId,
    chainId: chainIdNum, // Destination chain ID
    remoteMetavaultAddress: String(event.params.remoteMetavaultAddress),
    metavault_id: metavaultId, // This links RemoteMetavault to Metavault, auto-populating metavault.chains via @derivedFrom
  };
  context.RemoteMetavault.set(remoteMetavault);

  // Note: In Envio, @derivedFrom fields (like metavault.chains) are virtual and automatically populated
  // based on the reverse relationship (RemoteMetavault.metavault_id). We don't need to manually
  // update the chains array like the new subgraph does (metavault.chains.push(remoteMetavault.id))
});

MetavaultsRegistry.ChainUnregistered.handler(async ({ event, context }) => {
  // Reference: spectra-subgraph/src/mappings/metavaults/metavaultRegistry.ts handleChainUnregistered
  // Logic: Get metavault (ensures it exists), remove RemoteMetavault entity
  // Note: In new subgraph, they manually remove from metavault.chains array. In Envio, chains is @derivedFrom,
  // so deleting the RemoteMetavault entity automatically removes it from metavault.chains
  
  // Get metavault to ensure it exists (matches new subgraph pattern)
  // Note: We don't use the return value because @derivedFrom handles the chains relationship automatically
  await getMetavault(
    event.params.metavault,
    BigInt(event.block.timestamp),
    event.block.number,
    event.chainId,
    context
  );

  // ID format matches ChainRegistered: `${event.chainId}-${metavault}-${event.params.chainId}`
  // - event.chainId = source chain (where event is emitted)
  // - event.params.chainId = destination chain (being unregistered)
  const remoteMetavaultId = `${event.chainId}-${event.params.metavault}-${event.params.chainId}`;
  
  // Delete RemoteMetavault entity
  // Note: This automatically removes it from metavault.chains via @derivedFrom
  context.RemoteMetavault.deleteUnsafe(remoteMetavaultId);
});

MetavaultsRegistry.MarketRegistered.handler(async ({ event, context }) => {
  // Reference: spectra-subgraph/src/mappings/metavaults/metavaultRegistry.ts handleMarketRegistered
  // Logic: Get metavault (ensures it exists), get pool, set pool.metavault_id relationship
  // Note: In new subgraph, they manually add to metavault.markets array. In Envio, markets is @derivedFrom,
  // so setting Pool.metavault_id automatically adds it to metavault.markets
  
  // Get metavault to ensure it exists (matches new subgraph pattern)
  // Note: We don't use the return value because @derivedFrom handles the markets relationship automatically
  await getMetavault(
    event.params.metavault,
    BigInt(event.block.timestamp),
    event.block.number,
    event.chainId,
    context
  );

  // Prefix with chainId for multichain support
  const poolId = `${event.chainId}-${event.params.market}`;
  const metavaultId = `${event.chainId}-${event.params.metavault}`;

  let pool = await context.Pool.get(poolId);

  if (pool) {
    // Update Pool entity to set metavault relationship
    // Note: This automatically adds the pool to metavault.markets via @derivedFrom
    context.Pool.set({
      ...pool,
      metavault_id: metavaultId,
    });
  }
});

MetavaultsRegistry.MarketUnregistered.handler(async ({ event, context }) => {
  // Reference: spectra-subgraph/src/mappings/metavaults/metavaultRegistry.ts handleMarketUnregistered
  // Logic: Get metavault (ensures it exists), get pool, remove pool.metavault_id relationship
  // Note: In new subgraph, they manually remove from metavault.markets array. In Envio, markets is @derivedFrom,
  // so removing pool.metavault_id automatically removes it from metavault.markets
  
  // Get metavault to ensure it exists (matches new subgraph pattern)
  // Note: We don't use the return value because @derivedFrom handles the markets relationship automatically
  await getMetavault(
    event.params.metavault,
    BigInt(event.block.timestamp),
    event.block.number,
    event.chainId,
    context
  );

  // Prefix with chainId for multichain support
  const poolId = `${event.chainId}-${event.params.market}`;
  const metavaultId = `${event.chainId}-${event.params.metavault}`;

  let pool = await context.Pool.get(poolId);
  if (pool && pool.metavault_id === metavaultId) {
    // Remove metavault relationship from Pool
    // Note: This automatically removes the pool from metavault.markets via @derivedFrom
    context.Pool.set({
      ...pool,
      metavault_id: undefined,
    });
  }
});

MetavaultsRegistry.BridgePathAllowed.handler(async ({ event, context }) => {
  // Reference: spectra-subgraph/src/mappings/metavaults/metavaultRegistry.ts handleBridgePathAllowed
  // Logic: Get metavault (ensures it exists), create MetavaultBridgePath entity
  // Note: getAsset is called inside createMetavaultBridgePath (not redundant like in handler)
  
  // Get metavault to ensure it exists (matches new subgraph pattern)
  await getMetavault(
    event.params.metavault,
    BigInt(event.block.timestamp),
    event.block.number,
    event.chainId,
    context
  );

  // Create MetavaultBridgePath entity
  // Note: createMetavaultBridgePath will call getAsset internally to ensure assets exist
  // and get their IDs for the relationship fields
  await createMetavaultBridgePath(
    String(event.params.metavault),
    String(event.params.tokenIn),
    String(event.params.tokenOut),
    Number(event.params.dstChainId),
    String(event.params.bridge),
    event.chainId,
    BigInt(event.block.timestamp),
    event.block.number,
    context
  );
});

MetavaultsRegistry.BridgePathRemoved.handler(async ({ event, context }) => {
  // Reference: spectra-subgraph/src/mappings/metavaults/metavaultRegistry.ts handleBridgePathRemoved
  // Logic: Get bridge path ID and delete the MetavaultBridgePath entity
  
  const bridgePathId = getMetavaultBridgePathId(
    String(event.params.metavault),
    String(event.params.tokenIn),
    String(event.params.tokenOut),
    Number(event.params.dstChainId),
    String(event.params.bridge),
    event.chainId
  );

  // Delete MetavaultBridgePath entity
  // Note: This automatically removes it from metavault.bridgePaths via @derivedFrom
  context.MetavaultBridgePath.deleteUnsafe(bridgePathId);
});

