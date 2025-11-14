// Reference: spectra-subgraph-master/src/mappings/amm/tokenExchange.ts

import { CurvePool } from "generated";
import { ZERO_ADDRESS, ZERO_BI, UNIT_BI, SECONDS_PER_HOUR, SECONDS_PER_DAY, CURVE_UNIT } from "../../constants";
import { getAccount } from "../../entities/Account";
import { updateAccountAssetBalance } from "../../entities/AccountAsset";
import { getAsset } from "../../entities/Asset";
import { getAssetAmount } from "../../entities/AssetAmount";
import { getPoolLastPrices } from "../../entities/CurvePool";
import { getERC20Decimals } from "../../entities/ERC20";
import { getIBTRate } from "../../entities/ERC4626";
import { createFeeClaim } from "../../entities/FeeClaim";
import { updateFutureDailyStats } from "../../entities/FutureDailyStats";
import { getPTRate } from "../../entities/FutureVault";
import { getLpFeeUnderlying, getPoolLiquidityInUnderlying, updatePoolAdminBalances } from "../../entities/Pool";
import { PoolActionType, updatePoolStats } from "../../entities/PoolStats";
import { createTransaction } from "../../entities/Transaction";
import { AssetType } from "../../utils/AssetType";
import { PoolType } from "../../utils/PoolType";
import { generateTransactionId } from "../../utils/idGenerators";
import { toPrecision } from "../../utils/toPrecision";

const FEES_PRECISION = 10;

/**
 * Shared tokenExchange logic for all pool types
 * Reference: spectra-subgraph-master/src/mappings/amm/tokenExchange.ts
 */
async function tokenExchange(
  event: any,
  sold_id: bigint | number,
  tokens_sold: bigint,
  bought_id: bigint | number,
  tokens_bought: bigint,
  context: any,
  handlerName: string = "TokenExchange"
): Promise<void> {
  const eventTimestamp = BigInt(event.block.timestamp);
  const poolId = `${event.chainId}-${event.srcAddress}`;
  
  // Get account
  const account = await getAccount(event.transaction.from, eventTimestamp, event.chainId, context);
  
  // Get pool
  const pool = await context.Pool.get(poolId);
  if (!pool) {
    context.log.warn(`${handlerName} event call for non-existing Pool ${event.srcAddress}`);
    return;
  }
  
  // Convert sold_id and bought_id to bigint for comparison
  const soldId = typeof sold_id === "number" ? BigInt(sold_id) : sold_id;
  const boughtId = typeof bought_id === "number" ? BigInt(bought_id) : bought_id;
  
  // Determine which asset is sold and which is bought
  // sold_id = 0 means IBT, sold_id = 1 means PT
  const isBuyPt = boughtId !== ZERO_BI; // If bought_id is not 0, we're buying PT
  
  // Get pool asset amounts
  const poolIBTAssetAmount = await context.AssetAmount.get(pool.ibtAsset_id || "");
  const poolPTAssetAmount = await context.AssetAmount.get(pool.ptAsset_id || "");
  
  if (!poolIBTAssetAmount || !poolPTAssetAmount) {
    context.log.warn(`TokenExchange: Missing asset amounts for pool ${event.srcAddress}`);
    return;
  }
  
  // Get asset addresses
  const ibtAsset = await context.Asset.get(poolIBTAssetAmount.asset_id || "");
  const ptAsset = await context.Asset.get(poolPTAssetAmount.asset_id || "");
  
  if (!ibtAsset || !ptAsset) {
    context.log.warn(`TokenExchange: Missing assets for pool ${event.srcAddress}`);
    return;
  }
  
  const ibtAddress = ibtAsset.address;
  const ptAddress = ptAsset.address;
  
  // Determine asset sold and asset bought
  const assetSoldAddress = soldId === ZERO_BI ? ibtAddress : ptAddress;
  const assetBoughtAddress = boughtId === ZERO_BI ? ibtAddress : ptAddress;
  const assetSoldType = soldId === ZERO_BI ? AssetType.IBT : AssetType.PT;
  const assetBoughtType = boughtId === ZERO_BI ? AssetType.IBT : AssetType.PT;
  
  // Get pool asset amounts for sold and bought
  const poolAssetInAmount = soldId === ZERO_BI ? poolIBTAssetAmount : poolPTAssetAmount;
  const poolAssetOutAmount = boughtId === ZERO_BI ? poolIBTAssetAmount : poolPTAssetAmount;
  
  // Use transaction hash from event (requires field_selection in config.yaml)
  const txHash = event.transaction.hash.toLowerCase();
  
  // Create AssetAmount for input (sold)
  const amountIn = await getAssetAmount(
    txHash,
    assetSoldAddress,
    tokens_sold,
    assetSoldType,
    event.logIndex.toString(),
    eventTimestamp,
    event.block.number,
    event.chainId,
    context
  );
  
  // Update AccountAsset balance for sold asset
  await updateAccountAssetBalance(
    account.address,
    assetSoldAddress,
    eventTimestamp,
    assetSoldType,
    event.chainId,
    event.block.number,
    context
  );
  
  // Create AssetAmount for output (bought)
  const amountOut = await getAssetAmount(
    txHash,
    assetBoughtAddress,
    tokens_bought,
    assetBoughtType,
    event.logIndex.toString(),
    eventTimestamp,
    event.block.number,
    event.chainId,
    context
  );
  
  // Update AccountAsset balance for bought asset
  await updateAccountAssetBalance(
    account.address,
    assetBoughtAddress,
    eventTimestamp,
    assetBoughtType,
    event.chainId,
    event.block.number,
    context
  );
  
  // Get asset bought for fee calculations
  const assetBought = await getAsset(
    assetBoughtAddress,
    eventTimestamp,
    assetBoughtType,
    null,
    event.chainId,
    event.block.number,
    context
  );
  
  // Calculate fee with bought token precision
  const feeWithBoughtTokenPrecision = toPrecision(
    pool.feeRate,
    FEES_PRECISION,
    assetBought.decimals
  );
  
  // Calculate amountOutWithFee: tokens_bought * 10^decimals / (10^decimals - feeWithBoughtTokenPrecision)
  let decimalsMultiplier = BigInt(1);
  for (let i = 0; i < assetBought.decimals; i++) {
    decimalsMultiplier *= BigInt(10);
  }
  
  const amountOutWithFee = (tokens_bought * decimalsMultiplier) / (decimalsMultiplier - feeWithBoughtTokenPrecision);
  const fee = amountOutWithFee - tokens_bought;
  
  // Calculate admin fee
  const adminFeeWithBoughtTokenPrecision = toPrecision(
    pool.adminFeeRate,
    FEES_PRECISION,
    assetBought.decimals
  );
  const adminFee = (fee * adminFeeWithBoughtTokenPrecision) / decimalsMultiplier;
  
  // Get spot price
  const spotPrice = await getPoolLastPrices(
    event.srcAddress,
    pool.poolType,
    event.chainId,
    event.block.number,
    context
  );
  
  // Update pool admin balances
  const [ibtAdminFee, ptAdminFee, newIbtAdminBalance, newPtAdminBalance] = await updatePoolAdminBalances(
    pool,
    event.srcAddress,
    pool.poolType,
    event.chainId,
    event.block.number,
    context
  );
  
  // Calculate valueUnderlying, feeUnderlying, feeRatio
  let valueUnderlying = ZERO_BI;
  let feeUnderlying = ZERO_BI;
  let feeRatio = ZERO_BI;
  
  const ibtDecimals = await getERC20Decimals(
    ibtAddress,
    event.chainId,
    event.block.number,
    context
  );
  
  const ibtRate = await getIBTRate(
    ibtAddress,
    event.chainId,
    event.block.number,
    context
  );
  
  const ptRate = pool.futureVault_id
    ? await getPTRate(
        pool.futureVault_id.replace(`${event.chainId}-`, ""),
        event.chainId,
        event.block.number,
        context
      )
    : ZERO_BI;
  
  if (pool.futureVault_id && spotPrice > ZERO_BI) {
    // Calculate decimals multiplier for IBT
    let ibtDecimalsMultiplier = BigInt(1);
    for (let i = 0; i < ibtDecimals; i++) {
      ibtDecimalsMultiplier *= BigInt(10);
    }
    
    const ibt = isBuyPt ? tokens_sold : tokens_bought;
    const ptInIbt = (isBuyPt ? tokens_bought : tokens_sold) * CURVE_UNIT / spotPrice;
    valueUnderlying = ((ibt + ptInIbt) * ibtRate) / ibtDecimalsMultiplier / BigInt(2);
    
    feeUnderlying = getLpFeeUnderlying(
      pool,
      valueUnderlying,
      ibtAdminFee,
      ptAdminFee,
      ibtRate,
      ibtDecimals
    );
    
    const liquidityInUnderlying = getPoolLiquidityInUnderlying(
      isBuyPt ? poolAssetInAmount.amount : poolAssetOutAmount.amount,
      isBuyPt ? poolAssetOutAmount.amount : poolAssetInAmount.amount,
      spotPrice,
      ibtRate,
      ibtDecimals
    );
    
    if (liquidityInUnderlying > ZERO_BI) {
      feeRatio = (feeUnderlying * CURVE_UNIT) / liquidityInUnderlying;
    }
  }
  
  // Update pool stats
  await updatePoolStats(
    event,
    pool,
    SECONDS_PER_HOUR,
    isBuyPt ? PoolActionType.BUY_PT : PoolActionType.SELL_PT,
    valueUnderlying,
    feeUnderlying,
    feeRatio,
    event.chainId,
    context
  );
  
  await updatePoolStats(
    event,
    pool,
    SECONDS_PER_DAY,
    isBuyPt ? PoolActionType.BUY_PT : PoolActionType.SELL_PT,
    valueUnderlying,
    feeUnderlying,
    feeRatio,
    event.chainId,
    context
  );
  
  // Create Transaction entity
  await createTransaction(
    {
      id: generateTransactionId(txHash, event.logIndex.toString()),
      transactionAddress: txHash,
      futureInTransaction: ZERO_ADDRESS,
      userInTransaction: account.address,
      poolInTransaction: event.srcAddress,
      amountsIn: [amountIn.id],
      amountsOut: [amountOut.id],
      valueUnderlying: valueUnderlying,
      feeUnderlying: feeUnderlying,
      feeRatio: feeRatio,
      transaction: {
        timestamp: eventTimestamp,
        block: BigInt(event.block.number),
        gas: BigInt((event.block as any).gasUsed || 0),
        gasPrice: BigInt((event.transaction as any).gasPrice || 0),
        type: "AMM_EXCHANGE",
        fee: fee,
        adminFee: adminFee,
      },
      ibtRate: ibtRate,
      ptRate: ptRate,
    },
    event.chainId,
    context
  );
  
  // Update pool entity
  const updatedPool = {
    ...pool,
    totalFees: pool.totalFees + fee,
    totalFeeRatio: pool.totalFeeRatio + feeRatio,
    totalAdminFees: pool.totalAdminFees + adminFee,
    spotPrice: spotPrice,
    ibtAdminBalance: newIbtAdminBalance,
    ptAdminBalance: newPtAdminBalance,
  };
  
  // Create fee claim for CURVE_SNG pools
  if (pool.poolType === PoolType.CURVE_SNG) {
    await createFeeClaim(
      ZERO_ADDRESS,
      eventTimestamp,
      poolId,
      ZERO_BI,
      ibtAdminFee,
      ptAdminFee,
      event.chainId,
      context
    );
  }
  
  context.Pool.set(updatedPool);
  
  // Update AssetAmount entities
  if (soldId === ZERO_BI) {
    // Sold IBT
    context.AssetAmount.set({
      ...poolIBTAssetAmount,
      amount: poolIBTAssetAmount.amount - tokens_sold,
    });
  } else {
    // Sold PT
    context.AssetAmount.set({
      ...poolPTAssetAmount,
      amount: poolPTAssetAmount.amount - tokens_sold,
    });
  }
  
  if (boughtId === ZERO_BI) {
    // Bought IBT
    context.AssetAmount.set({
      ...poolIBTAssetAmount,
      amount: poolIBTAssetAmount.amount + tokens_bought,
    });
  } else {
    // Bought PT
    context.AssetAmount.set({
      ...poolPTAssetAmount,
      amount: poolPTAssetAmount.amount + tokens_bought,
    });
  }
  
  // Update FutureDailyStats if pool has future vault
  if (pool.futureVault_id) {
    const futureVaultAddress = pool.futureVault_id.replace(`${event.chainId}-`, "");
    const futureDailyStats = await updateFutureDailyStats(
      event,
      futureVaultAddress,
      event.chainId,
      context
    );
    
    context.FutureDailyStats.set({
      ...futureDailyStats,
      dailySwaps: futureDailyStats.dailySwaps + UNIT_BI,
    });
  }
}

// CurvePool TokenExchange handlers
CurvePool.TokenExchange.handler(async ({ event, context }) => {
  // Reference: spectra-subgraph-master/src/mappings/amm/tokenExchange.ts handleTokenExchange
  await tokenExchange(
    event,
    event.params.sold_id,
    event.params.tokens_sold,
    event.params.bought_id,
    event.params.tokens_bought,
    context,
    "CurvePool.TokenExchange"
  );
});

// CurvePoolNG TokenExchange handlers
CurvePool.TokenExchangeNG.handler(async ({ event, context }) => {
  // Reference: spectra-subgraph-master/src/mappings/amm/tokenExchange.ts handleTokenExchangeNG
  await tokenExchange(
    event,
    event.params.sold_id,
    event.params.tokens_sold,
    event.params.bought_id,
    event.params.tokens_bought,
    context,
    "CurvePool.TokenExchangeNG"
  );
});

// CurvePoolSNG TokenExchange handlers
CurvePool.TokenExchangeSNG.handler(async ({ event, context }) => {
  // Reference: spectra-subgraph-master/src/mappings/amm/tokenExchange.ts handleTokenExchangeSNG
  // Note: SNG uses int128 for sold_id and bought_id, but we handle it the same way
  await tokenExchange(
    event,
    Number(event.params.sold_id), // Convert int128 to number for comparison
    event.params.tokens_sold,
    Number(event.params.bought_id), // Convert int128 to number for comparison
    event.params.tokens_bought,
    context,
    "CurvePool.TokenExchangeSNG"
  );
});
