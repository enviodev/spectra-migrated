// Reference: spectra-subgraph/src/mappings/bridgeInterfaceCCTP.ts

import { BridgeInterfaceCCTP } from "generated";
import { getMetavault } from "../entities/Metavault";
import { getAsset } from "../entities/Asset";
import { AssetType } from "../utils/AssetType";

BridgeInterfaceCCTP.BridgeInitiated.handler(async ({ event, context }) => {
  // Ensure metavault exists (metavault is the safe address in the event)
  await getMetavault(
    event.params.safe,
    BigInt(event.block.timestamp),
    event.block.number,
    event.chainId,
    context
  );

  // Fetch token metadata (decimals, symbol, name) using Asset helper
  const tokenInAsset = await getAsset(
    String(event.params.tokenIn),
    BigInt(event.block.timestamp),
    AssetType.UNDERLYING,
    null,
    event.chainId,
    event.block.number,
    context
  );

  // ID with chain prefix for multichain safety
  const id = `${event.chainId}-${event.transaction.hash}-${event.logIndex}`;
  const metavaultId = `${event.chainId}-${event.params.safe}`;
  const operator = String(event.transaction.from);

  const metavaultBridgeInitiated = {
    id,
    operator,
    safe: String(event.params.safe),
    tokenIn: String(event.params.tokenIn),
    amount: event.params.amount,
    tokenInDecimals: tokenInAsset.decimals,
    tokenInSymbol: tokenInAsset.symbol,
    tokenInName: tokenInAsset.name,
    dstChainId: Number(event.params.dstChainId),
    dstSafe: String(event.params.dstSafe),
    bridge: String(event.srcAddress),
    bridgeType: String(event.params.bridge),
    tokenOut: String(event.params.tokenOut),
    metavault_id: metavaultId,
    timestamp: BigInt(event.block.timestamp),
    blockNumber: BigInt(event.block.number),
    transactionHash: String(event.transaction.hash),
    logIndex: BigInt(event.logIndex),
  };

  context.MetavaultBridgeInitiated.set(metavaultBridgeInitiated);
});

