// Reference: spectra-subgraph-master/src/mappings/metavaults/metavaultRegistry.ts

import { MetavaultsRegistry } from "generated";
import { getMetavault } from "../../entities/Metavault";

MetavaultsRegistry.MetavaultRegistered.handler(async ({ event, context }) => {
  // Reference: spectra-subgraph-master/src/mappings/metavaults/metavaultRegistry.ts handleMetavaultRegistered  

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
  // Reference: spectra-subgraph-master/src/mappings/metavaults/metavaultRegistry.ts handleMetavaultUnregistered  

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
  // Reference: spectra-subgraph-master/src/mappings/metavaults/metavaultRegistry.ts handleChainRegistered
  // Prefix with chainId for multichain support
  const metavaultId = `${event.chainId}-${event.params.metavault}`;

  // Create RemoteMetavault entity
  // Note: In subgraph, chains array is manually updated. In Envio, chains is @derivedFrom, 
  // so we create RemoteMetavault with metavault_id relationship and Envio handles the rest
  const remoteMetavaultId = `${event.chainId}-${event.params.metavault}-${event.params.chainId}`;

  // Convert chainId from bigint to number
  const chainIdNum = Number(event.params.chainId);

  const remoteMetavault = {
    id: remoteMetavaultId,
    chainId: chainIdNum,
    remoteMetavaultAddress: String(event.params.remoteMetavaultAddress),
    metavault_id: metavaultId, // This links RemoteMetavault to Metavault, auto-populating metavault.chains
  };
  context.RemoteMetavault.set(remoteMetavault);

  // Note: In Envio, @derivedFrom fields (like metavault.chains) are virtual
  // They are automatically populated based on the reverse relationship (RemoteMetavault.metavault_id)
  // So we don't need to manually add to the chains array like the subgraph does
});

MetavaultsRegistry.ChainUnregistered.handler(async ({ event, context }) => {
  // Reference: spectra-subgraph-master/src/mappings/metavaults/metavaultRegistry.ts handleChainUnregistered
  // Remove RemoteMetavault entity
  // Note: In subgraph, they manually remove from metavault.chains array
  // In Envio, removing the entity will automatically remove it from the @derivedFrom array
  const remoteMetavaultId = `${event.chainId}-${event.params.metavault}-${event.params.chainId}`;
  context.RemoteMetavault.deleteUnsafe(remoteMetavaultId);
});

MetavaultsRegistry.MarketRegistered.handler(async ({ event, context }) => {
  // Reference: spectra-subgraph-master/src/mappings/metavaults/metavaultRegistry.ts handleMarketRegistered
  // Prefix with chainId for multichain support
  const poolId = `${event.chainId}-${event.params.market}`;
  const metavaultId = `${event.chainId}-${event.params.metavault}`;

  let pool = await context.Pool.get(poolId);

  if (pool) {
    // Update Pool entity to set metavault relationship
    // Note: In subgraph, they manually add to metavault.markets array
    // In Envio, markets is @derivedFrom, so setting Pool.metavault_id will automatically add it to metavault.markets
    context.Pool.set({
      ...pool,
      metavault_id: metavaultId,
    });
  }
});

MetavaultsRegistry.MarketUnregistered.handler(async ({ event, context }) => {
  // Reference: spectra-subgraph-master/src/mappings/metavaults/metavaultRegistry.ts handleMarketUnregistered
  // Prefix with chainId for multichain support
  const poolId = `${event.chainId}-${event.params.market}`;
  const metavaultId = `${event.chainId}-${event.params.metavault}`;

  let pool = await context.Pool.get(poolId);
  if (pool && pool.metavault_id === metavaultId) {
    // Remove metavault relationship from Pool
    // Note: In subgraph, they manually remove from metavault.markets array
    // In Envio, this will automatically remove it from metavault.markets (@derivedFrom)
    context.Pool.set({
      ...pool,
      metavault_id: undefined,
    });
  }
});

