// Reference: spectra-subgraph-master/src/mappings/metavaults/metavaultWrapper.ts

import { Metavault, MetavaultWrapper, ERC20 } from "generated";
import { ZERO_ADDRESS, ZERO_BI } from "../../constants";
import { updateAccountMetavaultRequest } from "../../entities/AccountAsset";
import { getMetavaultFromWrapper } from "../../entities/Metavault";
import { AssetType } from "../../utils/AssetType";
import { createTransaction } from "../../entities/Transaction";
import { generateTransactionId } from "../../utils/idGenerators";

// Register dynamic contracts created by MetaVaultWrapperInitialized event
Metavault.MetaVaultWrapperInitialized.contractRegister(({ event, context }) => {
  // Register MetavaultWrapper contract
  // Note: MetavaultWrapper implements ERC20, so Transfer events are handled by MetavaultWrapper handlers
  // denham todo - this doesn't make sense
  context.addMetavaultWrapper(event.srcAddress);
});

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
  const eventTimestamp = BigInt(event.block.timestamp);
  const txHash = event.transaction.hash.toLowerCase();

  await updateAccountMetavaultRequest(
    event.params.owner,
    event.srcAddress,
    eventTimestamp,
    AssetType.MV_REQUEST_DEPOSIT,
    "add",
    event.params.assets,
    event.chainId,
    context
  );

  // Create MV_DEPOSIT_REQUEST Transaction (matches subgraph, adapted for Envio)
  const metavault = await getMetavaultFromWrapper(
    event.srcAddress,
    eventTimestamp,
    Number(event.block.number),
    event.chainId,
    context
  );

  await createTransaction(
    {
      id: generateTransactionId(txHash, event.logIndex.toString()),
      transactionAddress: txHash,
      futureInTransaction: ZERO_ADDRESS,
      userInTransaction: String(event.params.owner),
      poolInTransaction: ZERO_ADDRESS,
      metavaultInTransaction: metavault.address,
      amountsIn: [],
      amountsOut: [],
      valueUnderlying: ZERO_BI,
      feeUnderlying: ZERO_BI,
      feeRatio: ZERO_BI,
      transaction: {
        type: "MV_DEPOSIT_REQUEST",
        timestamp: eventTimestamp,
        block: BigInt(event.block.number),
        gas: BigInt((event.block as any).gasUsed || 0),
        gasPrice: BigInt((event.transaction as any).gasPrice || 0),
        fee: ZERO_BI,
        adminFee: ZERO_BI,
      },
      ibtRate: ZERO_BI,
      ptRate: ZERO_BI,
      metavaultEpochId: ZERO_BI,
      metavaultShares: ZERO_BI,
      metavaultAssets: event.params.assets,
    },
    event.chainId,
    context
  );
});

MetavaultWrapper.DecreaseDepositRequest.handler(async ({ event, context }) => {
  // Reference: spectra-subgraph-master/src/mappings/metavaults/metavaultWrapper.ts handleDecreaseDepositRequest
  const eventTimestamp = BigInt(event.block.timestamp);
  const txHash = event.transaction.hash.toLowerCase();

  await updateAccountMetavaultRequest(
    event.params.owner,
    event.srcAddress,
    eventTimestamp,
    AssetType.MV_REQUEST_DEPOSIT,
    "set",
    event.params.newRequestedAssets,
    event.chainId,
    context
  );

  // Create MV_DECREASE_DEPOSIT_REQUEST Transaction if amount actually decreased
  const decreaseAmount =
    event.params.previousRequestedAssets - event.params.newRequestedAssets;

  if (decreaseAmount > ZERO_BI) {
    const metavault = await getMetavaultFromWrapper(
      event.srcAddress,
      eventTimestamp,
      Number(event.block.number),
      event.chainId,
      context
    );

    await createTransaction(
      {
        id: generateTransactionId(txHash, event.logIndex.toString()),
        transactionAddress: txHash,
        futureInTransaction: ZERO_ADDRESS,
        userInTransaction: String(event.params.owner),
        poolInTransaction: ZERO_ADDRESS,
        metavaultInTransaction: metavault.address,
        amountsIn: [],
        amountsOut: [],
        valueUnderlying: ZERO_BI,
        feeUnderlying: ZERO_BI,
        feeRatio: ZERO_BI,
        transaction: {
          type: "MV_DECREASE_DEPOSIT_REQUEST",
          timestamp: eventTimestamp,
          block: BigInt(event.block.number),
          gas: BigInt((event.block as any).gasUsed || 0),
          gasPrice: BigInt((event.transaction as any).gasPrice || 0),
          fee: ZERO_BI,
          adminFee: ZERO_BI,
        },
        ibtRate: ZERO_BI,
        ptRate: ZERO_BI,
        metavaultEpochId: event.params.epochId,
        metavaultShares: ZERO_BI,
        metavaultAssets: decreaseAmount,
      },
      event.chainId,
      context
    );
  }
});

MetavaultWrapper.RedeemRequest.handler(async ({ event, context }) => {
  // Reference: spectra-subgraph-master/src/mappings/metavaults/metavaultWrapper.ts handleRedeemRequest
  const eventTimestamp = BigInt(event.block.timestamp);
  const txHash = event.transaction.hash.toLowerCase();

  await updateAccountMetavaultRequest(
    event.params.owner,
    event.srcAddress,
    eventTimestamp,
    AssetType.MV_REQUEST_REDEEM,
    "add",
    event.params.shares,
    event.chainId,
    context
  );

  const metavault = await getMetavaultFromWrapper(
    event.srcAddress,
    eventTimestamp,
    Number(event.block.number),
    event.chainId,
    context
  );

  await createTransaction(
    {
      id: generateTransactionId(txHash, event.logIndex.toString()),
      transactionAddress: txHash,
      futureInTransaction: ZERO_ADDRESS,
      userInTransaction: String(event.params.owner),
      poolInTransaction: ZERO_ADDRESS,
      metavaultInTransaction: metavault.address,
      amountsIn: [],
      amountsOut: [],
      valueUnderlying: ZERO_BI,
      feeUnderlying: ZERO_BI,
      feeRatio: ZERO_BI,
      transaction: {
        type: "MV_REDEEM_REQUEST",
        timestamp: eventTimestamp,
        block: BigInt(event.block.number),
        gas: BigInt((event.block as any).gasUsed || 0),
        gasPrice: BigInt((event.transaction as any).gasPrice || 0),
        fee: ZERO_BI,
        adminFee: ZERO_BI,
      },
      ibtRate: ZERO_BI,
      ptRate: ZERO_BI,
      metavaultEpochId: ZERO_BI,
      metavaultShares: event.params.shares,
      metavaultAssets: ZERO_BI,
    },
    event.chainId,
    context
  );
});

MetavaultWrapper.DecreaseRedeemRequest.handler(async ({ event, context }) => {
  // Reference: spectra-subgraph-master/src/mappings/metavaults/metavaultWrapper.ts handleDecreaseRedeemRequest
  const eventTimestamp = BigInt(event.block.timestamp);
  const txHash = event.transaction.hash.toLowerCase();

  await updateAccountMetavaultRequest(
    event.params.owner,
    event.srcAddress,
    eventTimestamp,
    AssetType.MV_REQUEST_REDEEM,
    "set",
    event.params.newRequestedShares,
    event.chainId,
    context
  );

  const decreaseAmount =
    event.params.previousRequestedShares - event.params.newRequestedShares;

  if (decreaseAmount > ZERO_BI) {
    const metavault = await getMetavaultFromWrapper(
      event.srcAddress,
      eventTimestamp,
      Number(event.block.number),
      event.chainId,
      context
    );

    await createTransaction(
      {
        id: generateTransactionId(txHash, event.logIndex.toString()),
        transactionAddress: txHash,
        futureInTransaction: ZERO_ADDRESS,
        userInTransaction: String(event.params.owner),
        poolInTransaction: ZERO_ADDRESS,
        metavaultInTransaction: metavault.address,
        amountsIn: [],
        amountsOut: [],
        valueUnderlying: ZERO_BI,
        feeUnderlying: ZERO_BI,
        feeRatio: ZERO_BI,
        transaction: {
          type: "MV_DECREASE_REDEEM_REQUEST",
          timestamp: eventTimestamp,
          block: BigInt(event.block.number),
          gas: BigInt((event.block as any).gasUsed || 0),
          gasPrice: BigInt((event.transaction as any).gasPrice || 0),
          fee: ZERO_BI,
          adminFee: ZERO_BI,
        },
        ibtRate: ZERO_BI,
        ptRate: ZERO_BI,
        metavaultEpochId: event.params.epochId,
        metavaultShares: decreaseAmount,
        metavaultAssets: ZERO_BI,
      },
      event.chainId,
      context
    );
  }
});

MetavaultWrapper.Deposit.handler(async ({ event, context }) => {
  // Reference: spectra-subgraph-master/src/mappings/metavaults/metavaultWrapper.ts handleDeposit
  // All deposit requests are cleared
  const eventTimestamp = BigInt(event.block.timestamp);
  const txHash = event.transaction.hash.toLowerCase();

  await updateAccountMetavaultRequest(
    event.params.owner,
    event.srcAddress,
    eventTimestamp,
    AssetType.MV_REQUEST_DEPOSIT,
    "set",
    ZERO_BI,
    event.chainId,
    context
  );

  const metavault = await getMetavaultFromWrapper(
    event.srcAddress,
    eventTimestamp,
    Number(event.block.number),
    event.chainId,
    context
  );

  await createTransaction(
    {
      id: generateTransactionId(txHash, event.logIndex.toString()),
      transactionAddress: txHash,
      futureInTransaction: ZERO_ADDRESS,
      userInTransaction: String(event.params.owner),
      poolInTransaction: ZERO_ADDRESS,
      metavaultInTransaction: metavault.address,
      amountsIn: [],
      amountsOut: [],
      valueUnderlying: ZERO_BI,
      feeUnderlying: ZERO_BI,
      feeRatio: ZERO_BI,
      transaction: {
        type: "MV_DEPOSIT",
        timestamp: eventTimestamp,
        block: BigInt(event.block.number),
        gas: BigInt((event.block as any).gasUsed || 0),
        gasPrice: BigInt((event.transaction as any).gasPrice || 0),
        fee: ZERO_BI,
        adminFee: ZERO_BI,
      },
      ibtRate: ZERO_BI,
      ptRate: ZERO_BI,
      metavaultEpochId: ZERO_BI,
      metavaultShares: event.params.shares,
      metavaultAssets: event.params.assets,
    },
    event.chainId,
    context
  );
});

MetavaultWrapper.Withdraw.handler(async ({ event, context }) => {
  // Reference: spectra-subgraph-master/src/mappings/metavaults/metavaultWrapper.ts handleWithdraw
  // All redeem requests are cleared
  const eventTimestamp = BigInt(event.block.timestamp);
  const txHash = event.transaction.hash.toLowerCase();

  await updateAccountMetavaultRequest(
    event.params.owner,
    event.srcAddress,
    eventTimestamp,
    AssetType.MV_REQUEST_REDEEM,
    "set",
    ZERO_BI,
    event.chainId,
    context
  );

  const metavault = await getMetavaultFromWrapper(
    event.srcAddress,
    eventTimestamp,
    Number(event.block.number),
    event.chainId,
    context
  );

  await createTransaction(
    {
      id: generateTransactionId(txHash, event.logIndex.toString()),
      transactionAddress: txHash,
      futureInTransaction: ZERO_ADDRESS,
      userInTransaction: String(event.params.owner),
      poolInTransaction: ZERO_ADDRESS,
      metavaultInTransaction: metavault.address,
      amountsIn: [],
      amountsOut: [],
      valueUnderlying: ZERO_BI,
      feeUnderlying: ZERO_BI,
      feeRatio: ZERO_BI,
      transaction: {
        type: "MV_WITHDRAW",
        timestamp: eventTimestamp,
        block: BigInt(event.block.number),
        gas: BigInt((event.block as any).gasUsed || 0),
        gasPrice: BigInt((event.transaction as any).gasPrice || 0),
        fee: ZERO_BI,
        adminFee: ZERO_BI,
      },
      ibtRate: ZERO_BI,
      ptRate: ZERO_BI,
      metavaultEpochId: ZERO_BI,
      metavaultShares: event.params.shares,
      metavaultAssets: event.params.assets,
    },
    event.chainId,
    context
  );
});

