// Reference: spectra-subgraph-master/src/mappings/transfers.ts

import { ERC20, IBT, MetavaultWrapper } from "generated";
import { ZERO_ADDRESS } from "../constants";
import { getAccount } from "../entities/Account";
import { updateAccountAssetBalance, updateAccountAssetYTBalance } from "../entities/AccountAsset";
import { getAsset } from "../entities/Asset";
import { getAssetAmount } from "../entities/AssetAmount";
import { updateIBTRates } from "../entities/IBTAsset";
import { updateYieldForAll } from "../entities/Yield";
import { AssetType } from "../utils/AssetType";
import { generateTransferId } from "../utils/idGenerators";

// IBT Transfer handlers
// Reference: spectra-subgraph-master/src/mappings/transfers.ts handleIBTTransfer
// Note: IBT transfers don't create Transfer entities, they just update IBT rates
IBT.Transfer.handler(async ({ event, context }) => {
  await updateIBTRates(
    event.srcAddress,
    BigInt(event.block.timestamp),
    event.chainId,
    Number(event.block.number),
    context
  );
});

// ERC20 Transfer handlers
ERC20.Transfer.handler(async ({ event, context }) => {
  // Reference: spectra-subgraph-master/src/mappings/transfers.ts handleTransfer
  const eventTimestamp = BigInt(event.block.timestamp);

  // Use transaction hash from event (requires field_selection in config.yaml)
  const txHash = (event.transaction as any).hash?.toLowerCase() || `${event.block.number}-${event.logIndex}`;

  // Generate Transfer ID
  const transferId = `${event.chainId}-${generateTransferId(
    txHash,
    eventTimestamp.toString(),
    event.logIndex.toString()
  )}`;

  // Get accounts
  const accountFrom = await getAccount(event.params.from, eventTimestamp, event.chainId, context);
  const accountTo = await getAccount(event.params.to, eventTimestamp, event.chainId, context);

  // Get Asset entity
  // Note: We use AssetType.UNKNOWN initially, the asset should already exist
  const asset = await getAsset(
    event.srcAddress,
    eventTimestamp,
    AssetType.UNKNOWN,
    null,
    event.chainId,
    Number(event.block.number),
    context
  );

  if (!asset) {
    context.log.warn(`Transfer event call for non-existing Asset ${event.srcAddress}`);
    return;
  }

  // Create AssetAmount for the transfer
  const amountOut = await getAssetAmount(
    txHash,
    event.srcAddress,
    event.params.value,
    asset.assetType,
    event.logIndex.toString(),
    eventTimestamp,
    Number(event.block.number),
    event.chainId,
    context
  );

  // Create Transfer entity
  const transfer = {
    id: transferId,
    createdAtTimestamp: eventTimestamp,
    address: txHash,
    block: BigInt(event.block.number),
    logIndex: BigInt(event.logIndex),
    transactionLogIndex: BigInt((event.transaction as any).index || 0),
    from_id: accountFrom.id,
    to_id: accountTo.id,
    gasLimit: BigInt((event.transaction as any).gasLimit || 0),
    gasPrice: BigInt((event.transaction as any).gasPrice || 0),
    amountOut_id: amountOut.id,
  };

  context.Transfer.set(transfer);

  // Update AccountAsset balances based on asset type
  if (asset.assetType === AssetType.YT) {
    // For YT tokens, use updateAccountAssetYTBalance
    // Note: principalTokenAddress is ZERO_ADDRESS for regular YT transfers
    await updateAccountAssetYTBalance(
      accountFrom.address,
      event.srcAddress,
      eventTimestamp,
      AssetType.YT,
      ZERO_ADDRESS,
      event.chainId,
      Number(event.block.number),
      context
    );

    await updateAccountAssetYTBalance(
      accountTo.address,
      event.srcAddress,
      eventTimestamp,
      AssetType.YT,
      ZERO_ADDRESS,
      event.chainId,
      Number(event.block.number),
      context
    );
  } else {
    // For other asset types, use updateAccountAssetBalance
    await updateAccountAssetBalance(
      accountFrom.address,
      event.srcAddress,
      eventTimestamp,
      asset.assetType,
      event.chainId,
      Number(event.block.number),
      context
    );

    await updateAccountAssetBalance(
      accountTo.address,
      event.srcAddress,
      eventTimestamp,
      asset.assetType,
      event.chainId,
      Number(event.block.number),
      context
    );
  }

  // Update yield for all (if this is a PT/YT token)
  if (asset.futureVault_id) {
    const futureVaultAddress = asset.futureVault_id.replace(`${event.chainId}-`, "");
    await updateYieldForAll(
      futureVaultAddress,
      eventTimestamp,
      event.chainId,
      context
    );
  }
});

// // denham todo - check the subgraph 
// // Note: SpectraWrapper.Transfer handler removed - SpectraWrapper now uses ERC20 contract type
// // SpectraWrapper is registered as ERC20 in wrappers.ts, so transfers are handled by ERC20.Transfer handler above

// // MetavaultWrapper Transfer handlers
// // Reference: MetavaultWrapper implements ERC20, so Transfer events track share transfers
// // MetavaultWrapper has Transfer event in config (can't register as both MetavaultWrapper and ERC20 in Envio)
// MetavaultWrapper.Transfer.handler(async ({ event, context }) => {
//   // MetavaultWrapper transfers use the same logic as ERC20 transfers
//   // Reference: spectra-subgraph-master/src/mappings/transfers.ts handleTransfer
//   const eventTimestamp = BigInt(event.block.timestamp);

//   // Use transaction hash from event (requires field_selection in config.yaml)
//   const txHash = (event.transaction as any).hash?.toLowerCase() || `${event.block.number}-${event.logIndex}`;

//   // Generate Transfer ID
//   const transferId = `${event.chainId}-${generateTransferId(
//     txHash,
//     eventTimestamp.toString(),
//     event.logIndex.toString()
//   )}`;

//   // Get accounts
//   const accountFrom = await getAccount(event.params.from.toLowerCase(), eventTimestamp, event.chainId, context);
//   const accountTo = await getAccount(event.params.to.toLowerCase(), eventTimestamp, event.chainId, context);

//   // Get Asset entity
//   const asset = await getAsset(
//     event.srcAddress,
//     eventTimestamp,
//     AssetType.UNKNOWN,
//     null,
//     event.chainId,
//     Number(event.block.number),
//     context
//   );

//   if (!asset) {
//     context.log.warn(`Transfer event call for non-existing Asset ${event.srcAddress}`);
//     return;
//   }

//   // Create AssetAmount for the transfer
//   const amountOut = await getAssetAmount(
//     txHash,
//     event.srcAddress,
//     event.params.value,
//     asset.assetType,
//     event.logIndex.toString(),
//     eventTimestamp,
//     Number(event.block.number),
//     event.chainId,
//     context
//   );

//   // Create Transfer entity
//   const transfer = {
//     id: transferId,
//     createdAtTimestamp: eventTimestamp,
//     address: txHash,
//     block: BigInt(event.block.number),
//     logIndex: BigInt(event.logIndex),
//     transactionLogIndex: BigInt((event.transaction as any).index || 0),
//     from_id: accountFrom.id,
//     to_id: accountTo.id,
//     gasLimit: BigInt((event.transaction as any).gasLimit || 0),
//     gasPrice: BigInt((event.transaction as any).gasPrice || 0),
//     amountOut_id: amountOut.id,
//   };

//   context.Transfer.set(transfer);

//   // Update AccountAsset balances based on asset type
//   if (asset.assetType === AssetType.YT) {
//     // For YT tokens, use updateAccountAssetYTBalance
//     // Note: principalTokenAddress is ZERO_ADDRESS for regular YT transfers
//     await updateAccountAssetYTBalance(
//       accountFrom.address,
//       event.srcAddress,
//       eventTimestamp,
//       AssetType.YT,
//       ZERO_ADDRESS,
//       event.chainId,
//       Number(event.block.number),
//       context
//     );

//     await updateAccountAssetYTBalance(
//       accountTo.address,
//       event.srcAddress,
//       eventTimestamp,
//       AssetType.YT,
//       ZERO_ADDRESS,
//       event.chainId,
//       Number(event.block.number),
//       context
//     );
//   } else {
//     // For other asset types, use updateAccountAssetBalance
//     await updateAccountAssetBalance(
//       accountFrom.address,
//       event.srcAddress,
//       eventTimestamp,
//       asset.assetType,
//       event.chainId,
//       Number(event.block.number),
//       context
//     );

//     await updateAccountAssetBalance(
//       accountTo.address,
//       event.srcAddress,
//       eventTimestamp,
//       asset.assetType,
//       event.chainId,
//       Number(event.block.number),
//       context
//     );
//   }

//   // Update yield for all (if this is a PT/YT token)
//   if (asset.futureVault_id) {
//     const futureVaultAddress = asset.futureVault_id.replace(`${event.chainId}-`, "");
//     await updateYieldForAll(
//       futureVaultAddress,
//       eventTimestamp,
//       event.chainId,
//       context
//     );
//   }
// });

// Note: SpectraWrapper.Transfer handler removed - SpectraWrapper now uses ERC20 contract type
// SpectraWrapper is registered as ERC20 in wrappers.ts, so transfers are handled by ERC20.Transfer handler above

// MetavaultWrapper Transfer handlers
// Reference: MetavaultWrapper implements ERC20, so Transfer events track share transfers
// MetavaultWrapper has Transfer event in config (can't register as both MetavaultWrapper and ERC20 in Envio)
MetavaultWrapper.Transfer.handler(async ({ event, context }) => {
  // MetavaultWrapper transfers use the same logic as ERC20 transfers
  // Reference: spectra-subgraph-master/src/mappings/transfers.ts handleTransfer
  const eventTimestamp = BigInt(event.block.timestamp);

  // Use transaction hash from event (requires field_selection in config.yaml)
  const txHash = (event.transaction as any).hash?.toLowerCase() || `${event.block.number}-${event.logIndex}`;

  // Generate Transfer ID
  const transferId = `${event.chainId}-${generateTransferId(
    txHash,
    eventTimestamp.toString(),
    event.logIndex.toString()
  )}`;

  // Get accounts
  const accountFrom = await getAccount(event.params.from.toLowerCase(), eventTimestamp, event.chainId, context);
  const accountTo = await getAccount(event.params.to.toLowerCase(), eventTimestamp, event.chainId, context);

  // Get Asset entity
  const asset = await getAsset(
    event.srcAddress.toLowerCase(),
    eventTimestamp,
    AssetType.UNKNOWN,
    null,
    event.chainId,
    Number(event.block.number),
    context
  );

  if (!asset) {
    context.log.warn(`Transfer event call for non-existing Asset ${event.srcAddress}`);
    return;
  }

  // Create AssetAmount for the transfer
  const amountOut = await getAssetAmount(
    txHash,
    event.srcAddress.toLowerCase(),
    event.params.value,
    asset.assetType,
    event.logIndex.toString(),
    eventTimestamp,
    Number(event.block.number),
    event.chainId,
    context
  );

  // Create Transfer entity
  const transfer = {
    id: transferId,
    createdAtTimestamp: eventTimestamp,
    address: txHash,
    block: BigInt(event.block.number),
    logIndex: BigInt(event.logIndex),
    transactionLogIndex: BigInt((event.transaction as any).index || 0),
    from_id: accountFrom.id,
    to_id: accountTo.id,
    gasLimit: BigInt((event.transaction as any).gasLimit || 0),
    gasPrice: BigInt((event.transaction as any).gasPrice || 0),
    amountOut_id: amountOut.id,
  };

  context.Transfer.set(transfer);

  // Update AccountAsset balances
  await updateAccountAssetBalance(
    accountFrom.address.toLowerCase(),
    event.srcAddress.toLowerCase(),
    eventTimestamp,
    asset.assetType,
    event.chainId,
    Number(event.block.number),
    context
  );

  await updateAccountAssetBalance(
    accountTo.address.toLowerCase(),
    event.srcAddress.toLowerCase(),
    eventTimestamp,
    asset.assetType,
    event.chainId,
    Number(event.block.number),
    context
  );
});
