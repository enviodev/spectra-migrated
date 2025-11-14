// Reference: spectra-subgraph-master/src/mappings/metavaults/amphorAsyncVault.ts

import { AmphorAsyncVault } from "generated";
import { createMetavaultEpoch } from "../../entities/Metavault";
import { getAmphorAsyncVaultData } from "../../effects/getAmphorAsyncVaultData";

AmphorAsyncVault.EpochStart.handler(async ({ event, context }) => {
  // Reference: spectra-subgraph-master/src/mappings/metavaults/amphorAsyncVault.ts handleEpochStart
  // Get infravault by address
  const infravaultId = `${event.chainId}-${event.srcAddress}`;
  const infravault = await context.Infravault.get(infravaultId);

  if (!infravault) {
    context.log.warn(`EpochStart event call for non-existing Infravault ${event.srcAddress}`);
    return;
  }

  // Get metavault
  const metavault = await context.Metavault.get(infravault.metavault_id || "");
  if (!metavault || !metavault.wrapperAddress) {
    context.log.warn(`EpochStart: Metavault not found or has no wrapper for Infravault ${event.srcAddress}`);
    return;
  }

  // Fetch AmphorAsyncVault data via RPC
  const vaultDataResult = await context.effect(getAmphorAsyncVaultData, {
    vaultAddress: event.srcAddress,
    chainId: event.chainId,
    blockNumber: event.block.number,
  });

  const vaultData = vaultDataResult as {
    epochId: string;
    decimals: number;
  };

  const epochId = BigInt(vaultData.epochId);
  const amphorSharesDecimals = vaultData.decimals;

  // Calculate rate: lastSavedBalance * 10^decimals / totalShares
  // Note: Original subgraph uses BigInt.fromString("10").pow(decimals), but we use BigInt(10) ** BigInt(decimals)
  // However, TypeScript doesn't support BigInt exponentiation, so we use a loop
  let decimalsMultiplier = BigInt(1);
  for (let i = 0; i < amphorSharesDecimals; i++) {
    decimalsMultiplier *= BigInt(10);
  }

  const rate = (event.params.lastSavedBalance * decimalsMultiplier) / event.params.totalShares;
  const assets = event.params.lastSavedBalance;

  // Create MetavaultEpoch entity
  // Note: We pass the wrapper address, but createMetavaultEpoch will use the metavault's safeAddress
  // (which is the owner of the wrapper) for the epoch ID and metavault relationship
  await createMetavaultEpoch(
    metavault.wrapperAddress,
    epochId,
    rate,
    assets,
    BigInt(event.block.timestamp),
    BigInt(event.block.number),
    event.chainId,
    context
  );
});

