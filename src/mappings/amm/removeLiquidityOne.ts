// Reference: spectra-subgraph-master/src/mappings/amm/removeLiquidityOne.ts

import { CurvePool } from "generated";
import { ZERO_BI } from "../../constants";
import { removeLiquidity } from "./removeLiquidity";

/**
 * Shared removeLiquidityOne logic for all pool types
 * Reference: spectra-subgraph-master/src/mappings/amm/removeLiquidityOne.ts
 * 
 * removeLiquidityOne converts parameters and calls removeLiquidity
 */
async function removeLiquidityOne(
  event: any,
  coin_amount: bigint,
  coin_index: bigint | number,
  token_amount: bigint,
  context: any,
  handlerName: string = "RemoveLiquidityOne"
): Promise<void> {
  const poolId = `${event.chainId}-${event.srcAddress}`;
  const pool = await context.Pool.get(poolId);

  if (!pool) {
    context.log.warn(`${handlerName} event call for non-existing Pool ${event.srcAddress}`);
    return;
  }

  // Convert coin_index to bigint for comparison
  const coinIndex = typeof coin_index === "number" ? BigInt(coin_index) : coin_index;

  // Build token_amounts array based on coin_index
  // coin_index = 0 means IBT, coin_index = 1 means PT
  const token_amounts = [
    coinIndex === ZERO_BI ? coin_amount : ZERO_BI,
    coinIndex === BigInt(1) ? coin_amount : ZERO_BI,
  ];

  // Calculate token_supply (new LP total supply after removal)
  const token_supply = pool.lpTotalSupply - token_amount;

  // Call removeLiquidity with converted parameters
  await removeLiquidity(event, token_amounts, context, token_supply, handlerName);
}

// CurvePool RemoveLiquidityOne handlers
CurvePool.RemoveLiquidityOne.handler(async ({ event, context }) => {
  // Reference: spectra-subgraph-master/src/mappings/amm/removeLiquidityOne.ts handleRemoveLiquidityOne
  await removeLiquidityOne(
    event,
    event.params.coin_amount,
    event.params.coin_index,
    event.params.token_amount,
    context,
    "CurvePool.RemoveLiquidityOne"
  );
});

// CurvePoolNG RemoveLiquidityOne handlers
CurvePool.RemoveLiquidityOneNG.handler(async ({ event, context }) => {
  // Reference: spectra-subgraph-master/src/mappings/amm/removeLiquidityOne.ts handleRemoveLiquidityOneNG
  await removeLiquidityOne(
    event,
    event.params.coin_amount,
    event.params.coin_index,
    event.params.token_amount,
    context,
    "CurvePool.RemoveLiquidityOneNG"
  );
});

// CurvePoolSNG RemoveLiquidityOne handlers
// Note: SNG uses token_id (int128) instead of coin_index (uint256)
CurvePool.RemoveLiquidityOneSNG.handler(async ({ event, context }) => {
  // Reference: spectra-subgraph-master/src/mappings/amm/removeLiquidityOne.ts handleRemoveLiquidityOneSNG
  await removeLiquidityOne(
    event,
    event.params.coin_amount,
    Number(event.params.token_id), // Convert int128 to number for comparison
    event.params.token_amount,
    context,
    "CurvePool.RemoveLiquidityOneSNG"
  );
});
