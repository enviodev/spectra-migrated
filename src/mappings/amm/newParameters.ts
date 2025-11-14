// Reference: spectra-subgraph-master/src/mappings/amm/newParameters.ts

import { CurvePool } from "generated";
import { getPoolFee } from "../../effects/getPoolFee";

// CurvePool CommitNewParameters handlers
CurvePool.CommitNewParameters.handler(async ({ event, context }) => {
  // Reference: spectra-subgraph-master/src/mappings/amm/newParameters.ts handleCommitNewParameters
  // Prefix with chainId for multichain support
  const poolId = `${event.chainId}-${event.srcAddress}`;

  const pool = await context.Pool.get(poolId);
  if (pool) {
    context.Pool.set({
      ...pool,
      futureAdminFeeRate: event.params.admin_fee,
      futureAdminFeeDeadline: event.params.deadline,
    });
  }
});

// CurvePool NewParameters handlers
CurvePool.NewParameters.handler(async ({ event, context }) => {
  // Reference: spectra-subgraph-master/src/mappings/amm/newParameters.ts handleNewParameters
  // Prefix with chainId for multichain support
  const poolId = `${event.chainId}-${event.srcAddress}`;

  const pool = await context.Pool.get(poolId);
  if (pool) {
    // Fetch feeRate via RPC call using Effect API
    const feeRateResult = await context.effect(getPoolFee, {
      poolAddress: event.srcAddress,
      chainId: event.chainId,
      blockNumber: event.block.number,
    });

    const feeRateStr = (typeof feeRateResult === "string" ? feeRateResult : null) || "0";

    context.Pool.set({
      ...pool,
      feeRate: BigInt(feeRateStr),
      adminFeeRate: event.params.admin_fee,
    });
  }
});

// CurvePoolNG NewParameters handlers
// Note: Original subgraph has this handler as TODO (see handleNewParametersNG in spectra-subgraph-master/src/mappings/amm/newParameters.ts)
// Leaving as TODO to match original subgraph implementation
CurvePool.NewParametersNG.handler(async ({ event, context }) => {
  // TODO: Original subgraph has this as TODO - not implemented
  // Reference: spectra-subgraph-master/src/mappings/amm/newParameters.ts line 31-33
});

