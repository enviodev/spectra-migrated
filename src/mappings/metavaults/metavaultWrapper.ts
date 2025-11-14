// Reference: spectra-subgraph-master/src/mappings/metavaults/metavaultWrapper.ts

import { Metavault, MetavaultWrapper, ERC20 } from "generated";
import { ZERO_BI } from "../../constants";
import { updateAccountMetavaultRequest } from "../../entities/AccountAsset";
import { getMetavaultFromWrapper } from "../../entities/Metavault";

// Register dynamic contracts created by MetaVaultWrapperInitialized event
Metavault.MetaVaultWrapperInitialized.contractRegister(({ event, context }) => {
  // Register MetavaultWrapper contract
  // Note: MetavaultWrapper implements ERC20, so Transfer events are handled by MetavaultWrapper handlers
  // denham todo - this doesn't make sense
  context.addMetavaultWrapper(event.srcAddress);
});

// AssetType constants (from spectra-subgraph-master/src/utils/AssetType.ts)
const AssetType = {
  MV_REQUEST_DEPOSIT: "MV_REQUEST_DEPOSIT",
  MV_REQUEST_REDEEM: "MV_REQUEST_REDEEM",
} as const;

// Metavault handlers
Metavault.MetaVaultWrapperInitialized.handler(async ({ event, context }) => {
  // Reference: spectra-subgraph-master/src/mappings/metavaults/metavaultWrapper.ts handleMetaVaultWrapperInitialized
  // Get or create metavault from wrapper address
  // This will fetch wrapper data via RPC and populate all metavault fields
  const metavault = await getMetavaultFromWrapper(
    event.srcAddress,
    BigInt(event.block.timestamp),
    event.block.number,
    event.chainId,
    context
  );

  // Update wrapper address (in case metavault already existed with different wrapper)
  context.Metavault.set({
    ...metavault,
    wrapperAddress: event.srcAddress,
  });

  // Note: In subgraph, they call MetavaultWrapper.create() and ERC20.create() here
  // In Envio, this is handled via contractRegister above
}, {
  wildcard: true  // Enable wildcard indexing to track ALL Metavault contracts
});

Metavault.DepositRequest.handler(async ({ event, context }) => {
  // Reference: spectra-subgraph-master/src/mappings/metavaults/metavaultWrapper.ts handleDepositRequest
  await updateAccountMetavaultRequest(
    event.params.owner,
    event.srcAddress,
    BigInt(event.block.timestamp),
    AssetType.MV_REQUEST_DEPOSIT,
    "add",
    event.params.assets,
    event.chainId,
    context
  );
});

Metavault.DecreaseDepositRequest.handler(async ({ event, context }) => {
  // Reference: spectra-subgraph-master/src/mappings/metavaults/metavaultWrapper.ts handleDecreaseDepositRequest
  await updateAccountMetavaultRequest(
    event.params.owner,
    event.srcAddress,
    BigInt(event.block.timestamp),
    AssetType.MV_REQUEST_DEPOSIT,
    "set",
    event.params.newRequestedAssets,
    event.chainId,
    context
  );
});

Metavault.RedeemRequest.handler(async ({ event, context }) => {
  // Reference: spectra-subgraph-master/src/mappings/metavaults/metavaultWrapper.ts handleRedeemRequest
  await updateAccountMetavaultRequest(
    event.params.owner,
    event.srcAddress,
    BigInt(event.block.timestamp),
    AssetType.MV_REQUEST_REDEEM,
    "add",
    event.params.shares,
    event.chainId,
    context
  );
});

Metavault.DecreaseRedeemRequest.handler(async ({ event, context }) => {
  // Reference: spectra-subgraph-master/src/mappings/metavaults/metavaultWrapper.ts handleDecreaseRedeemRequest
  await updateAccountMetavaultRequest(
    event.params.owner,
    event.srcAddress,
    BigInt(event.block.timestamp),
    AssetType.MV_REQUEST_REDEEM,
    "set",
    event.params.newRequestedShares,
    event.chainId,
    context
  );
});

Metavault.Deposit.handler(async ({ event, context }) => {
  // Reference: spectra-subgraph-master/src/mappings/metavaults/metavaultWrapper.ts handleDeposit
  // All deposit requests are cleared
  await updateAccountMetavaultRequest(
    event.params.owner,
    event.srcAddress,
    BigInt(event.block.timestamp),
    AssetType.MV_REQUEST_DEPOSIT,
    "set",
    ZERO_BI,
    event.chainId,
    context
  );
});

Metavault.Withdraw.handler(async ({ event, context }) => {
  // Reference: spectra-subgraph-master/src/mappings/metavaults/metavaultWrapper.ts handleWithdraw
  // All redeem requests are cleared
  await updateAccountMetavaultRequest(
    event.params.owner,
    event.srcAddress,
    BigInt(event.block.timestamp),
    AssetType.MV_REQUEST_REDEEM,
    "set",
    ZERO_BI,
    event.chainId,
    context
  );
});

// MetavaultWrapper handlers (same logic as Metavault handlers)
// Note: In the original subgraph, all handlers are on the Metavault contract
// In Envio, we also register MetavaultWrapper as a separate contract for flexibility
MetavaultWrapper.DepositRequest.handler(async ({ event, context }) => {
  // Reference: spectra-subgraph-master/src/mappings/metavaults/metavaultWrapper.ts handleDepositRequest
  await updateAccountMetavaultRequest(
    event.params.owner,
    event.srcAddress,
    BigInt(event.block.timestamp),
    AssetType.MV_REQUEST_DEPOSIT,
    "add",
    event.params.assets,
    event.chainId,
    context
  );
});

MetavaultWrapper.DecreaseDepositRequest.handler(async ({ event, context }) => {
  // Reference: spectra-subgraph-master/src/mappings/metavaults/metavaultWrapper.ts handleDecreaseDepositRequest
  await updateAccountMetavaultRequest(
    event.params.owner,
    event.srcAddress,
    BigInt(event.block.timestamp),
    AssetType.MV_REQUEST_DEPOSIT,
    "set",
    event.params.newRequestedAssets,
    event.chainId,
    context
  );
});

MetavaultWrapper.RedeemRequest.handler(async ({ event, context }) => {
  // Reference: spectra-subgraph-master/src/mappings/metavaults/metavaultWrapper.ts handleRedeemRequest
  await updateAccountMetavaultRequest(
    event.params.owner,
    event.srcAddress,
    BigInt(event.block.timestamp),
    AssetType.MV_REQUEST_REDEEM,
    "add",
    event.params.shares,
    event.chainId,
    context
  );
});

MetavaultWrapper.DecreaseRedeemRequest.handler(async ({ event, context }) => {
  // Reference: spectra-subgraph-master/src/mappings/metavaults/metavaultWrapper.ts handleDecreaseRedeemRequest
  await updateAccountMetavaultRequest(
    event.params.owner,
    event.srcAddress,
    BigInt(event.block.timestamp),
    AssetType.MV_REQUEST_REDEEM,
    "set",
    event.params.newRequestedShares,
    event.chainId,
    context
  );
});

MetavaultWrapper.Deposit.handler(async ({ event, context }) => {
  // Reference: spectra-subgraph-master/src/mappings/metavaults/metavaultWrapper.ts handleDeposit
  // All deposit requests are cleared
  await updateAccountMetavaultRequest(
    event.params.owner,
    event.srcAddress,
    BigInt(event.block.timestamp),
    AssetType.MV_REQUEST_DEPOSIT,
    "set",
    ZERO_BI,
    event.chainId,
    context
  );
});

MetavaultWrapper.Withdraw.handler(async ({ event, context }) => {
  // Reference: spectra-subgraph-master/src/mappings/metavaults/metavaultWrapper.ts handleWithdraw
  // All redeem requests are cleared
  await updateAccountMetavaultRequest(
    event.params.owner,
    event.srcAddress,
    BigInt(event.block.timestamp),
    AssetType.MV_REQUEST_REDEEM,
    "set",
    ZERO_BI,
    event.chainId,
    context
  );
});

