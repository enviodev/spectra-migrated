// Reference: spectra-subgraph-master/src/mappings/amm/removeLiquidity.ts

import { CurvePool } from "generated";
import { ZERO_ADDRESS, ZERO_BI, UNIT_BI, SECONDS_PER_HOUR, SECONDS_PER_DAY, CURVE_UNIT } from "../../constants";
import { getAccount } from "../../entities/Account";
import { updateAccountAssetBalance } from "../../entities/AccountAsset";
import { getAssetAmount } from "../../entities/AssetAmount";
import { getPoolLPToken } from "../../effects/getPoolLPToken";
import { getERC20TotalSupply } from "../../entities/ERC20";
import { getERC20Decimals } from "../../entities/ERC20";
import { getIBTRate } from "../../entities/ERC4626";
import { updateFutureDailyStats } from "../../entities/FutureDailyStats";
import { getPTRate } from "../../entities/FutureVault";
import { getPoolLiquidityInUnderlying, updatePoolAdminBalances, getLpFeeUnderlying } from "../../entities/Pool";
import { PoolActionType, updatePoolStats } from "../../entities/PoolStats";
import { createTransaction } from "../../entities/Transaction";
import { AssetType } from "../../utils/AssetType";
import { PoolType } from "../../utils/PoolType";
import { generateTransactionId } from "../../utils/idGenerators";
import { toPrecision } from "../../utils/toPrecision";
import { getPoolLastPrices } from "../../entities/CurvePool";

const FEES_PRECISION = 10;

/**
 * Shared removeLiquidity logic for all pool types
 * Reference: spectra-subgraph-master/src/mappings/amm/removeLiquidity.ts
 * 
 * @param event - The event object
 * @param token_amounts - Array of token amounts [IBT, PT]
 * @param context - The handler context
 * @param token_supply - Optional token supply (if not provided, uses event.params.token_supply)
 */
export async function removeLiquidity(
  event: any,
  token_amounts: bigint[],
  context: any,
  token_supply?: bigint,
  handlerName: string = "RemoveLiquidity"
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

  // Get LP token address
  const lpTokenAddressResult = await context.effect(getPoolLPToken, {
    poolAddress: event.srcAddress,
    poolType: pool.poolType,
    chainId: event.chainId,
    blockNumber: Number(event.block.number),
  });

  const lpTokenAddress = (typeof lpTokenAddressResult === "string" ? lpTokenAddressResult : null) || ZERO_ADDRESS;

  // Get token_supply from event or parameter (new LP total supply after removal)
  const tokenSupply = token_supply !== undefined ? token_supply : BigInt(event.params.token_supply);
  const lpTokenDiff = pool.lpTotalSupply - tokenSupply;

  // Use transaction hash from event (requires field_selection in config.yaml)
  const txHash = event.transaction.hash.toLowerCase();

  // Create AssetAmount for LP input
  const lpAmountIn = await getAssetAmount(
    txHash,
    lpTokenAddress,
    lpTokenDiff,
    AssetType.LP,
    event.logIndex.toString(),
    eventTimestamp,
    Number(event.block.number),
    event.chainId,
    context
  );

  // Update AccountAsset balance for LP
  const lpPosition = await updateAccountAssetBalance(
    account.address,
    lpTokenAddress,
    eventTimestamp,
    AssetType.LP,
    event.chainId,
    Number(event.block.number),
    context
  );

  // Update LP position pool relationship if needed
  if (!lpPosition.pool_id) {
    context.AccountAsset.set({
      ...lpPosition,
      pool_id: poolId,
    });
  }

  // Get pool asset amounts
  const poolIBTAssetAmount = await context.AssetAmount.get(pool.ibtAsset_id || "");
  const poolPTAssetAmount = await context.AssetAmount.get(pool.ptAsset_id || "");

  if (!poolIBTAssetAmount || !poolPTAssetAmount) {
    context.log.warn(`RemoveLiquidity: Missing asset amounts for pool ${event.srcAddress}`);
    return;
  }

  // Get asset addresses
  const ibtAsset = await context.Asset.get(poolIBTAssetAmount.asset_id || "");
  const ptAsset = await context.Asset.get(poolPTAssetAmount.asset_id || "");

  if (!ibtAsset || !ptAsset) {
    context.log.warn(`RemoveLiquidity: Missing assets for pool ${event.srcAddress}`);
    return;
  }

  const ibtAddress = ibtAsset.address;
  const ptAddress = ptAsset.address;

  // Create AssetAmount for IBT output
  const ibtAmountOut = await getAssetAmount(
    txHash,
    ibtAddress,
    token_amounts[0],
    AssetType.IBT,
    event.logIndex.toString(),
    eventTimestamp,
    Number(event.block.number),
    event.chainId,
    context
  );

  // Update AccountAsset balance for IBT
  await updateAccountAssetBalance(
    account.address,
    ibtAddress,
    eventTimestamp,
    AssetType.IBT,
    event.chainId,
    Number(event.block.number),
    context
  );

  // Create AssetAmount for PT output
  const ptAmountOut = await getAssetAmount(
    txHash,
    ptAddress,
    token_amounts[1],
    AssetType.PT,
    event.logIndex.toString(),
    eventTimestamp,
    Number(event.block.number),
    event.chainId,
    context
  );

  // Update AccountAsset balance for PT
  await updateAccountAssetBalance(
    account.address,
    ptAddress,
    eventTimestamp,
    AssetType.PT,
    event.chainId,
    Number(event.block.number),
    context
  );

  // Get spot price
  const spotPrice = await getPoolLastPrices(
    event.srcAddress,
    pool.poolType,
    event.chainId,
    Number(event.block.number),
    context
  );

  // Update pool admin balances
  const [ibtAdminFee, ptAdminFee, newIbtAdminBalance, newPtAdminBalance] = await updatePoolAdminBalances(
    pool,
    event.srcAddress,
    pool.poolType,
    event.chainId,
    Number(event.block.number),
    context
  );

  // Calculate valueUnderlying, feeUnderlying, feeRatio
  let valueUnderlying = ZERO_BI;
  let feeUnderlying = ZERO_BI;
  let feeRatio = ZERO_BI;

  const ibtRate = await getIBTRate(
    ibtAddress,
    event.chainId,
    Number(event.block.number),
    context
  );

  const ptRate = pool.futureVault_id
    ? await getPTRate(
      pool.futureVault_id.replace(`${event.chainId}-`, ""),
      event.chainId,
      Number(event.block.number),
      context
    )
    : ZERO_BI;

  if (pool.futureVault_id && spotPrice > ZERO_BI) {
    // Get IBT decimals
    const ibtDecimals = await getERC20Decimals(
      ibtAddress,
      event.chainId,
      event.block.number,
      context
    );

    // Calculate decimals multiplier
    let decimalsMultiplier = BigInt(1);
    for (let i = 0; i < ibtDecimals; i++) {
      decimalsMultiplier *= BigInt(10);
    }

    const ibtAmount = token_amounts[0];
    const ptAmountInIbt = (token_amounts[1] * CURVE_UNIT) / spotPrice;
    valueUnderlying = ((ibtAmount + ptAmountInIbt) * ibtRate) / decimalsMultiplier;

    feeUnderlying = getLpFeeUnderlying(
      pool,
      ZERO_BI, // for CURVE pools we skip this fee
      ibtAdminFee,
      ptAdminFee,
      ibtRate,
      ibtDecimals
    );

    const liquidityInUnderlying = getPoolLiquidityInUnderlying(
      poolIBTAssetAmount.amount - token_amounts[0],
      poolPTAssetAmount.amount - token_amounts[1],
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
    PoolActionType.REMOVE_LIQUIDITY,
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
    PoolActionType.REMOVE_LIQUIDITY,
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
      amountsIn: [lpAmountIn.id],
      amountsOut: [ibtAmountOut.id, ptAmountOut.id],
      valueUnderlying: valueUnderlying,
      feeUnderlying: feeUnderlying,
      feeRatio: feeRatio,
      transaction: {
        timestamp: eventTimestamp,
        block: BigInt(event.block.number),
        gas: BigInt((event.block as any).gasUsed || 0),
        gasPrice: BigInt((event.transaction as any).gasPrice || 0),
        type: "AMM_REMOVE_LIQUIDITY",
        fee: ZERO_BI,
        adminFee: ZERO_BI,
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
    spotPrice: spotPrice,
    lpTotalSupply: tokenSupply, // Use token_supply from event
    totalFeeRatio: pool.totalFeeRatio + feeRatio,
    ibtAdminBalance: newIbtAdminBalance,
    ptAdminBalance: newPtAdminBalance,
  };

  // Create fee claim for CURVE_SNG pools
  if (pool.poolType === PoolType.CURVE_SNG) {
    const { createFeeClaim } = await import("../../entities/FeeClaim");
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
  context.AssetAmount.set({
    ...poolIBTAssetAmount,
    amount: poolIBTAssetAmount.amount - token_amounts[0],
  });

  context.AssetAmount.set({
    ...poolPTAssetAmount,
    amount: poolPTAssetAmount.amount - token_amounts[1],
  });

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
      dailyRemoveLiquidity: futureDailyStats.dailyRemoveLiquidity + UNIT_BI,
    });
  }
}

// CurvePool RemoveLiquidity handlers
CurvePool.RemoveLiquidity.handler(async ({ event, context }) => {
  // Reference: spectra-subgraph-master/src/mappings/amm/removeLiquidity.ts handleRemoveLiquidity
  await removeLiquidity(event, event.params.token_amounts, context, undefined, "CurvePool.RemoveLiquidity");
});

// CurvePoolSNG RemoveLiquidity handlers
CurvePool.RemoveLiquiditySNG.handler(async ({ event, context }) => {
  // Reference: spectra-subgraph-master/src/mappings/amm/removeLiquidity.ts handleRemoveLiquiditySNG
  await removeLiquidity(event, event.params.token_amounts, context, undefined, "CurvePool.RemoveLiquiditySNG");
});

// CurvePoolSNG RemoveLiquidityImbalance handlers
CurvePool.RemoveLiquidityImbalanceSNG.handler(async ({ event, context }) => {
  // Reference: spectra-subgraph-master/src/mappings/amm/removeLiquidity.ts handleRemoveLiquidityImbalanceSNG
  // RemoveLiquidityImbalance is similar to RemoveLiquidity but with different token_amounts structure
  await removeLiquidity(event, event.params.token_amounts, context, undefined, "CurvePool.RemoveLiquidityImbalanceSNG");
});
