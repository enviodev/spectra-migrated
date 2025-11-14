// Reference: spectra-subgraph-master/src/mappings/futures.ts

import { Factory, PrincipalToken, CurvePool } from "generated";
// import { Factory, PrincipalToken, CurvePool, ERC20 } from "generated";
import { AssetType } from "../utils/AssetType";
import { getCurveFactory } from "../effects/getCurveFactory";
import { getPoolType } from "../effects/getPoolType";
import { getPoolLPToken } from "../effects/getPoolLPToken";
import { getPrincipalTokenData } from "../effects/getPrincipalTokenData";
import { ZERO_ADDRESS, ZERO_BI, UNIT_BI } from "../constants";
import { createFactory } from "../entities/Factory";
import { getAccount } from "../entities/Account";
import { getAsset } from "../entities/Asset";
import { generateFeeClaimId, generateTransactionId } from "../utils/idGenerators";
import { updateClaimedYieldAccountAssetBalance, updateYieldForAll } from "../entities/Yield";
import { updateFutureDailyStats } from "../entities/FutureDailyStats";
import { getAssetAmount } from "../entities/AssetAmount";
import { createTransaction } from "../entities/Transaction";
import { updateAccountAssetBalance, updateAccountAssetYTBalance } from "../entities/AccountAsset";
import { RAYS_PRECISION } from "../utils/toPrecision";
import { createPool } from "../entities/Pool";
import { getIBTAsset } from "../entities/IBTAsset";

// Register dynamic contracts created by factory events
Factory.PTDeployed.contractRegister(({ event, context }) => {
  // Register PrincipalToken contract created by PTDeployed event
  // Note: PT already has Transfer events in PrincipalToken config, so no need to register as ERC20
  // This avoids conflicts since Envio doesn't allow the same address for multiple contract types
  context.addPrincipalToken(event.params.pt);
});

Factory.CurvePoolDeployed.contractRegister(({ event, context }) => {
  // Register the CurvePool contract
  context.addCurvePool(event.params.poolAddress);

  // Note: IBT, YT, and LP token addresses would need to be registered to match subgraph
  // IBT: Subgraph registers in PTDeployed via RPC call to getIBT(pt)
  // YT: Requires RPC call to getYT(pt)
  // LP: Requires RPC call to getPoolLPToken(pool)
  // All three would need wildcard indexing to match subgraph behavior without RPC in contractRegister
});

// Factory handlers
Factory.PTDeployed.handler(async ({ event, context }) => {
  // Note: Original subgraph calls getNetwork().chainId, but in Envio we have event.chainId directly
  // No need to call setNetwork() here

  const ptAddress = event.params.pt;
  const futureId = `${event.chainId}-${ptAddress}`;

  // Note: Original subgraph does NOT check if Future exists - it just creates it
  // The PTDeployed event should only fire once per PT, so no need for existence check

  // Fetch PrincipalToken data via RPC call using Effect API
  const ptDataResult = await context.effect(getPrincipalTokenData, {
    ptAddress: ptAddress,
    chainId: event.chainId,
    blockNumber: event.block.number,
  });

  // Type assertion for the effect result
  const ptData = ptDataResult as {
    maturity: string;
    name: string;
    symbol: string;
    underlying: string;
    ibt: string;
    yt: string;
    totalAssets: string;
  };

  // Note: Unlike the check above, we don't return early if RPC fails
  // The original subgraph creates Future entities even when RPC calls fail
  // This allows subsequent events to find the Future, even with incomplete data
  if (!ptData || !ptData.maturity || ptData.maturity === "0") {
    context.log.warn(`Failed to fetch PrincipalToken data for ${ptAddress} - creating Future with default values`);
  }

  const eventTimestamp = BigInt(event.block.timestamp);
  const blockNumber = Number(event.block.number);

  // Get Factory entity
  const factoryId = `${event.chainId}-${event.srcAddress}`;
  const factory = await context.Factory.get(factoryId);

  // Get underlying asset
  const underlyingAddress = ptData.underlying;
  const underlyingAsset = await getAsset(
    underlyingAddress,
    eventTimestamp,
    AssetType.UNDERLYING,
    null,
    event.chainId,
    blockNumber,
    context
  );

  // Get IBT asset
  const ibtAddress = ptData.ibt;

  const ibtAsset = await getIBTAsset(
    ibtAddress,
    eventTimestamp,
    event.chainId,
    blockNumber,
    context
  );

  // Update IBT asset underlying relationship
  context.Asset.set({
    ...ibtAsset,
    underlying_id: underlyingAsset.id,
  });

  // Get PT token asset
  const ptToken = await getAsset(
    ptAddress,
    eventTimestamp,
    AssetType.PT,
    null,
    event.chainId,
    blockNumber,
    context
  );

  // Update PT token futureVault relationship
  context.Asset.set({
    ...ptToken,
    futureVault_id: futureId,
  });

  // Get YT token asset
  const ytAddress = ptData.yt;
  const ytToken = await getAsset(
    ytAddress,
    eventTimestamp,
    AssetType.YT,
    null,
    event.chainId,
    blockNumber,
    context
  );

  // Update YT token futureVault relationship
  context.Asset.set({
    ...ytToken,
    futureVault_id: futureId,
  });

  // Create Future entity
  const future = {
    id: futureId,
    chainId: event.chainId,
    address: ptAddress,
    createdAtTimestamp: eventTimestamp,
    createdAtBlock: BigInt(event.block.number),
    expirationAtTimestamp: BigInt(ptData.maturity),
    symbol: ptData.symbol,
    name: ptData.name,
    unclaimedFees: ZERO_BI,
    totalCollectedFees: ZERO_BI,
    totalAssets: BigInt(ptData.totalAssets),
    state: "ACTIVE" as any,
    underlyingAsset_id: underlyingAsset.id,
    ibtAsset_id: ibtAsset.id,
    factory_id: factory?.id,
    ytAsset_id: ytToken.id,
  };

  context.Future.set(future);
});

Factory.CurvePoolDeployed.handler(async ({ event, context }) => {
  const poolAddress = event.params.poolAddress;
  const ibtAddress = event.params.ibt;
  const ptAddress = event.params.pt;
  const factoryAddress = event.srcAddress;

  // Determine pool type via RPC call
  const poolTypeResult = await context.effect(getPoolType, {
    poolAddress: poolAddress,
    chainId: event.chainId,
    blockNumber: Number(event.block.number),
  });

  const poolType = (typeof poolTypeResult === "string" ? poolTypeResult : null) || "UNKNOWN";

  // Get LP token address via RPC call
  const lpAddressResult = await context.effect(getPoolLPToken, {
    poolAddress: poolAddress,
    poolType: poolType,
    chainId: event.chainId,
    blockNumber: Number(event.block.number),
  });

  const lpAddress = (typeof lpAddressResult === "string" ? lpAddressResult : null) || ZERO_ADDRESS;

  // Use transaction hash from event (requires field_selection in config.yaml)
  const txHash = (event.transaction as any).hash?.toLowerCase();

  // Create Pool entity using createPool helper
  await createPool(
    poolAddress,
    ibtAddress,
    ptAddress,
    factoryAddress,
    lpAddress,
    poolType,
    txHash,
    event.logIndex.toString(),
    BigInt(event.block.timestamp),
    event.chainId,
    Number(event.block.number),
    context
  );

  // Note: Dynamic contract registration is handled in contractRegister
  // CurvePool and ERC20 (LP token) are already registered in config.yaml
});

Factory.RegistryChange.handler(async ({ event, context }) => {
  // Reference: spectra-subgraph-master/src/mappings/futures.ts handleRegistryChange
  // Prefix with chainId for multichain support
  const factoryId = `${event.chainId}-${event.srcAddress}`;

  let factory = await context.Factory.get(factoryId);

  // Factory should exist at this point (either retrieved or created)
  if (!factory) {
    context.log.error(`Failed to get or create Factory ${factoryId}`);

    factory = await createFactory(
      event.params.newRegistry,
      event.srcAddress,
      BigInt(event.block.timestamp),
      event.chainId,
      event.block.number,
      context
    );
    return;
  }

  // Update factory with new and old registry (matches subgraph logic)
  // Ensure all required fields are set (address, id, createdAtTimestamp are required in schema)
  context.Factory.set({
    id: factory.id,
    address: factory.address,
    createdAtTimestamp: factory.createdAtTimestamp,
    oldFactory: factory.oldFactory,
    curveFactory: factory.curveFactory,
    oldRegistry: event.params.previousRegistry,
    registry: event.params.newRegistry,
  });
});

Factory.CurveFactoryChange.handler(async ({ event, context }) => {
  // Reference: spectra-subgraph-master/src/mappings/futures.ts handleCurveFactoryChange
  // Prefix with chainId for multichain support
  const factoryId = `${event.chainId}-${event.srcAddress}`;

  const factory = await context.Factory.get(factoryId);
  if (factory) {
    // Fetch curveFactory via RPC call using Effect API (matches subgraph: getCurveFactory)
    const curveFactory = await context.effect(getCurveFactory, {
      factoryAddress: event.srcAddress,
      chainId: event.chainId,
      blockNumber: event.block.number,
    }) || ZERO_ADDRESS;

    context.Factory.set({
      ...factory,
      curveFactory: curveFactory,
    });
  } else {
    context.log.warn(`CurveFactoryChange event call for non-existing factory ${event.srcAddress}`);
  }
});

// PrincipalToken handlers
PrincipalToken.Paused.handler(async ({ event, context }) => {
  // Reference: spectra-subgraph-master/src/mappings/futures.ts handlePaused
  // Prefix with chainId for multichain support
  const futureId = `${event.chainId}-${event.srcAddress}`;

  const future = await context.Future.get(futureId);
  if (future) {
    context.Future.set({
      ...future,
      state: "PAUSED" as any,
    });
  } else {
    context.log.warn(`Paused event call for non-existing Future ${event.srcAddress}`);
  }
});

PrincipalToken.Unpaused.handler(async ({ event, context }) => {
  // Reference: spectra-subgraph-master/src/mappings/futures.ts handleUnpaused
  // Prefix with chainId for multichain support
  const futureId = `${event.chainId}-${event.srcAddress}`;

  const future = await context.Future.get(futureId);
  if (future) {
    context.Future.set({
      ...future,
      state: "ACTIVE" as any,
    });
  } else {
    context.log.warn(`Unpaused event call for non-existing Future ${event.srcAddress}`);
  }
});

PrincipalToken.FeeClaimed.handler(async ({ event, context }) => {
  // Reference: spectra-subgraph-master/src/mappings/futures.ts handleFeeClaimed
  // Prefix with chainId for multichain support
  const futureId = `${event.chainId}-${event.srcAddress}`;

  const future = await context.Future.get(futureId);
  if (!future) {
    context.log.warn(`FeeClaimed event call for non-existing Future ${event.srcAddress}`);
    return;
  }

  // Generate fee claim ID (matches subgraph: generateFeeClaimId(user, timestamp))
  const claimId = generateFeeClaimId(
    event.params.user,
    event.block.timestamp.toString()
  );

  // Prefix claim ID with chainId for multichain support
  const claimIdWithChain = `${event.chainId}-${claimId}`;

  // Get or create fee collector account (matches subgraph: getAccount(user, timestamp))
  const feeCollector = await getAccount(
    event.params.user,
    BigInt(event.block.timestamp),
    event.chainId,
    context
  );

  // Create FeeClaim entity (matches subgraph logic)
  const claim = {
    id: claimIdWithChain,
    createdAtTimestamp: BigInt(event.block.timestamp),
    amount: event.params.receivedAssets, // matches subgraph: event.params.receivedAssets
    ibtAmount: event.params.redeemedIbts, // Additional field in our schema
    ptAmount: ZERO_BI, // Additional field in our schema
    feeCollector_id: feeCollector.id,
    future_id: futureId,
    pool_id: undefined, // For pool fee claims, not relevant here
  };

  context.FeeClaim.set(claim);

  // Update Future entity (matches subgraph: totalCollectedFees.plus(receivedAssets), unclaimedFees = ZERO_BI)
  context.Future.set({
    ...future,
    totalCollectedFees: future.totalCollectedFees + event.params.receivedAssets,
    unclaimedFees: ZERO_BI,
  });
});

PrincipalToken.YieldClaimed.handler(async ({ event, context }) => {
  // Reference: spectra-subgraph-master/src/mappings/futures.ts handleYieldClaimed
  // Prefix with chainId for multichain support
  const futureId = `${event.chainId}-${event.srcAddress}`;

  const future = await context.Future.get(futureId);
  if (!future) {
    context.log.warn(`YieldClaimed event call for non-existing Future ${event.srcAddress}`);
    return;
  }

  // Update claimed yield account asset balance (matches subgraph: updateClaimedYieldAccountAssetBalance)
  await updateClaimedYieldAccountAssetBalance(
    event.srcAddress,
    event.params.receiver,
    event.params.yieldInIBT, // matches subgraph: event.params.yieldInIBT
    BigInt(event.block.timestamp),
    event.chainId,
    context
  );

  // Update future daily stats (matches subgraph: updateFutureDailyStats)
  await updateFutureDailyStats(
    event,
    event.srcAddress,
    event.chainId,
    context
  );
});

PrincipalToken.YieldUpdated.handler(async ({ event, context }) => {
  // Reference: spectra-subgraph-master/src/mappings/futures.ts handleYieldUpdated
  // Prefix with chainId for multichain support
  const futureId = `${event.chainId}-${event.srcAddress}`;

  const future = await context.Future.get(futureId);
  if (!future) {
    context.log.warn(`YieldUpdated event call for non-existing Future ${event.srcAddress}`);
    return;
  }

  // Update yield for all accounts holding YT tokens (matches subgraph: updateYieldForAll)
  await updateYieldForAll(
    event.srcAddress,
    BigInt(event.block.timestamp),
    event.chainId,
    context
  );
});

PrincipalToken.Transfer.handler(async ({ event, context }) => {
  // Reference: spectra-subgraph-master/src/mappings/futures.ts handlePTTransfer
  // Prefix with chainId for multichain support
  const futureId = `${event.chainId}-${event.srcAddress}`;

  const future = await context.Future.get(futureId);
  if (!future) {
    context.log.warn(`PTTransfer event call for non-existing Future ${event.srcAddress}`);
    return;
  }

  // Update yield for all accounts holding YT tokens (matches subgraph: updateYieldForAll)
  await updateYieldForAll(
    event.srcAddress,
    BigInt(event.block.timestamp),
    event.chainId,
    context
  );

  // Update future daily stats (matches subgraph: updateFutureDailyStats)
  await updateFutureDailyStats(
    event,
    event.srcAddress,
    event.chainId,
    context
  );
});

PrincipalToken.Mint.handler(async ({ event, context }) => {
  // Reference: spectra-subgraph-master/src/mappings/futures.ts

  const futureId = `${event.chainId}-${event.srcAddress}`;
  const future = await context.Future.get(futureId);

  if (!future) {
    context.log.warn(`Mint event call for non-existing Future ${event.srcAddress}`);
    return;
  }

  // Fetch PrincipalToken data to get YT address
  const ptDataResult = await context.effect(getPrincipalTokenData, {
    ptAddress: event.srcAddress,
    chainId: event.chainId,
    blockNumber: event.block.number,
  });

  const ptData = ptDataResult as {
    maturity: string;
    name: string;
    symbol: string;
    decimals: number;
    ibt: string;
    underlying: string;
    yt: string;
    ptRate: string;
    totalAssets: string;
  };

  const ptAddress = event.srcAddress;
  const ytAddress = ptData.yt;

  // Mint event: Mint(address indexed from, address indexed to, uint256 amount)
  // Use 'to' as the recipient (matches subgraph: event.params.to)
  const receiver = event.params.to;

  // Use transaction hash from event (requires field_selection in config.yaml)
  // Note: After adding field_selection, run `pnpm codegen` to update types
  const txHash = event.transaction.hash.toLowerCase();

  // Create AssetAmount for PT (amountOut)
  const firstAmountOut = await getAssetAmount(
    txHash,
    ptAddress,
    event.params.amount,
    "PT",
    event.logIndex.toString(),
    BigInt(event.block.timestamp),
    event.block.number,
    event.chainId,
    context
  );

  // Update AccountAsset balance for PT
  await updateAccountAssetBalance(
    receiver,
    ptAddress,
    BigInt(event.block.timestamp),
    "PT",
    event.chainId,
    event.block.number,
    context
  );

  // Create AssetAmount for YT (amountOut)
  const secondAmountOut = await getAssetAmount(
    txHash,
    ytAddress,
    event.params.amount,
    "YT",
    event.logIndex.toString(),
    BigInt(event.block.timestamp),
    event.block.number,
    event.chainId,
    context
  );

  // Update AccountAsset YT balance
  await updateAccountAssetYTBalance(
    receiver,
    ytAddress,
    BigInt(event.block.timestamp),
    "YT",
    ptAddress,
    event.chainId,
    event.block.number,
    context
  );

  // Calculate valueUnderlying: amount * ptRate / 10^RAYS_PRECISION
  let raysMultiplier = BigInt(1);
  for (let i = 0; i < RAYS_PRECISION; i++) {
    raysMultiplier *= BigInt(10);
  }
  const ptRate = BigInt(ptData.ptRate);
  const valueUnderlying = (event.params.amount * ptRate) / raysMultiplier;

  // Create Transaction entity
  await createTransaction(
    {
      id: generateTransactionId(
        txHash,
        event.logIndex.toString()
      ),
      transactionAddress: txHash,
      futureInTransaction: ptAddress,
      userInTransaction: receiver,
      poolInTransaction: ZERO_ADDRESS,
      amountsIn: [],
      amountsOut: [firstAmountOut.id, secondAmountOut.id],
      valueUnderlying: valueUnderlying,
      feeUnderlying: ZERO_BI,
      feeRatio: ZERO_BI,
      transaction: {
        timestamp: BigInt(event.block.timestamp),
        block: BigInt(event.block.number),
        gas: BigInt((event.block as any).gasUsed || 0), // Requires field_selection for block_fields: [gasUsed]
        gasPrice: BigInt((event.transaction as any).gasPrice || 0), // Requires field_selection for transaction_fields: [gasPrice]
        type: "FUTURE_VAULT_DEPOSIT",
        fee: ZERO_BI,
        adminFee: ZERO_BI,
      },
      ibtRate: ZERO_BI,
      ptRate: ptRate,
    },
    event.chainId,
    context
  );

  // Update FutureDailyStats - Mint specific data
  const futureDailyStats = await updateFutureDailyStats(
    event,
    ptAddress,
    event.chainId,
    context
  );

  // Update dailyDeposits
  context.FutureDailyStats.set({
    ...futureDailyStats,
    dailyDeposits: futureDailyStats.dailyDeposits + UNIT_BI,
  });
});

PrincipalToken.Redeem.handler(async ({ event, context }) => {
  // Reference: spectra-subgraph-master/src/mappings/futures.ts

  const futureId = `${event.chainId}-${event.srcAddress}`;
  const future = await context.Future.get(futureId);

  if (!future) {
    context.log.warn(`Redeem event call for non-existing Future ${event.srcAddress}`);
    return;
  }

  // Fetch PrincipalToken data to get IBT and YT addresses
  const ptDataResult = await context.effect(getPrincipalTokenData, {
    ptAddress: event.srcAddress,
    chainId: event.chainId,
    blockNumber: event.block.number,
  });

  const ptData = ptDataResult as {
    maturity: string;
    name: string;
    symbol: string;
    decimals: number;
    ibt: string;
    underlying: string;
    yt: string;
    ptRate: string;
    totalAssets: string;
  };

  const ptAddress = event.srcAddress;
  const ibtAddress = ptData.ibt;
  const ytAddress = ptData.yt;

  // Redeem event: Redeem(address indexed from, address indexed to, uint256 amount)
  // Use 'from' as the sender (matches subgraph: event.params.from)
  const user = event.params.from;

  // Use transaction hash from event (requires field_selection in config.yaml)
  // Note: After adding field_selection, run `pnpm codegen` to update types
  const txHash = event.transaction.hash.toLowerCase();

  // Create AssetAmount for PT (amountIn)
  const firstAmountIn = await getAssetAmount(
    txHash,
    ptAddress,
    event.params.amount,
    "PT",
    event.logIndex.toString(),
    BigInt(event.block.timestamp),
    event.block.number,
    event.chainId,
    context
  );

  // Update AccountAsset balance for PT
  await updateAccountAssetBalance(
    user,
    ptAddress,
    BigInt(event.block.timestamp),
    "PT",
    event.chainId,
    event.block.number,
    context
  );

  // Create AssetAmount for YT (amountIn)
  const secondAmountIn = await getAssetAmount(
    txHash,
    ytAddress,
    event.params.amount,
    "YT",
    event.logIndex.toString(),
    BigInt(event.block.timestamp),
    event.block.number,
    event.chainId,
    context
  );

  // Update AccountAsset YT balance
  await updateAccountAssetYTBalance(
    user,
    ytAddress,
    BigInt(event.block.timestamp),
    "YT",
    ptAddress,
    event.chainId,
    event.block.number,
    context
  );

  // Calculate valueUnderlying: amount * ptRate / 10^RAYS_PRECISION
  let raysMultiplier = BigInt(1);
  for (let i = 0; i < RAYS_PRECISION; i++) {
    raysMultiplier *= BigInt(10);
  }
  const ptRate = BigInt(ptData.ptRate);
  const valueUnderlying = (event.params.amount * ptRate) / raysMultiplier;

  // Create Transaction entity
  await createTransaction(
    {
      id: generateTransactionId(
        txHash,
        event.logIndex.toString()
      ),
      transactionAddress: txHash,
      futureInTransaction: ptAddress,
      userInTransaction: user,
      poolInTransaction: ZERO_ADDRESS,
      amountsIn: [firstAmountIn.id, secondAmountIn.id],
      amountsOut: [],
      valueUnderlying: valueUnderlying,
      feeUnderlying: ZERO_BI,
      feeRatio: ZERO_BI,
      transaction: {
        timestamp: BigInt(event.block.timestamp),
        block: BigInt(event.block.number),
        gas: BigInt((event.block as any).gasUsed || 0), // Requires field_selection for block_fields: [gasUsed]
        gasPrice: BigInt((event.transaction as any).gasPrice || 0), // Requires field_selection for transaction_fields: [gasPrice]
        type: "FUTURE_VAULT_WITHDRAW",
        fee: ZERO_BI,
        adminFee: ZERO_BI,
      },
      ibtRate: ZERO_BI,
      ptRate: ptRate,
    },
    event.chainId,
    context
  );

  // Update FutureDailyStats - Redeem specific data
  const futureDailyStats = await updateFutureDailyStats(
    event,
    ptAddress,
    event.chainId,
    context
  );

  // Update dailyWithdrawals
  context.FutureDailyStats.set({
    ...futureDailyStats,
    dailyWithdrawals: futureDailyStats.dailyWithdrawals + UNIT_BI,
  });
});

