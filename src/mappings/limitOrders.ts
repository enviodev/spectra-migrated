// Reference: spectra-subgraph-master/src/mappings/limitOrders.ts

import { LimitOrderEngine, NonceManager } from "generated";
import { ZERO_BI } from "../constants";

// LimitOrderEngine handlers
LimitOrderEngine.OrderFilled.handler(async ({ event, context }) => {
  // Reference: spectra-subgraph-master/src/mappings/limitOrders.ts handleOrderFilled
  // Use orderHash hex string as entity ID for efficient lookups
  // Prefix with chainId for multichain support
  const orderHashId = `${event.chainId}-${event.params.orderHash.toLowerCase()}`;

  // Get or create OnChainOrderStatus entity
  let orderStatus = await context.OnChainOrderStatus.get(orderHashId);
  if (!orderStatus) {
    // Create new order status entity
    orderStatus = {
      id: orderHashId,
      orderHash: event.params.orderHash.toLowerCase(),
      totalFilled: ZERO_BI,
      cancelled: false,
      updatedAt: BigInt(event.block.timestamp),
      updatedAtBlock: BigInt(event.block.number),
    };
  }

  // Update order status with new fill
  orderStatus = {
    ...orderStatus,
    totalFilled: orderStatus.totalFilled + event.params.actualMaking,
    updatedAt: BigInt(event.block.timestamp),
    updatedAtBlock: BigInt(event.block.number),
  };

  context.OnChainOrderStatus.set(orderStatus);
});

LimitOrderEngine.OrderCanceled.handler(async ({ event, context }) => {
  // Reference: spectra-subgraph-master/src/mappings/limitOrders.ts handleOrderCanceled
  // Use orderHash hex string as entity ID for efficient lookups
  // Prefix with chainId for multichain support
  const orderHashId = `${event.chainId}-${event.params.orderHash.toLowerCase()}`;

  // Get or create OnChainOrderStatus entity
  let orderStatus = await context.OnChainOrderStatus.get(orderHashId);
  if (!orderStatus) {
    // Create new order status entity
    orderStatus = {
      id: orderHashId,
      orderHash: event.params.orderHash.toLowerCase(),
      totalFilled: ZERO_BI,
      cancelled: true,
      updatedAt: BigInt(event.block.timestamp),
      updatedAtBlock: BigInt(event.block.number),
    };
  } else {
    // Mark the order as cancelled
    orderStatus = {
      ...orderStatus,
      cancelled: true,
      updatedAt: BigInt(event.block.timestamp),
      updatedAtBlock: BigInt(event.block.number),
    };
  }

  context.OnChainOrderStatus.set(orderStatus);
});

LimitOrderEngine.NonceIncreased.handler(async ({ event, context }) => {
  // Reference: spectra-subgraph-master/src/mappings/limitOrders.ts handleNonceIncreased
  // Create unique ID for UserNonce entity
  // Prefix with chainId for multichain support
  const userNonceId = `${event.chainId}-nonce-${event.params.maker}`;

  // Get or create UserNonce entity
  let userNonce = await context.UserNonce.get(userNonceId);
  if (!userNonce) {
    // Create new UserNonce entity
    userNonce = {
      id: userNonceId,
      user: event.params.maker,
      latestNonce: event.params.newNonce,
      updatedAt: BigInt(event.block.timestamp),
      updatedAtBlock: BigInt(event.block.number),
    };
  } else {
    // Update with the new nonce (should always be higher)
    userNonce = {
      ...userNonce,
      latestNonce: event.params.newNonce,
      updatedAt: BigInt(event.block.timestamp),
      updatedAtBlock: BigInt(event.block.number),
    };
  }

  context.UserNonce.set(userNonce);
});

LimitOrderEngine.AuthorityUpdated.handler(async ({ event, context }) => {
  // Reference: spectra-subgraph-master/src/mappings/limitOrders.ts
  // Original subgraph only logs this event, no entity updates
  // For now, just log for debugging purposes
  context.log.info(`LimitOrderEngine.AuthorityUpdated: authority=${event.params.authority}`);
});

LimitOrderEngine.FeeRecipientUpdated.handler(async ({ event, context }) => {
  // Reference: spectra-subgraph-master/src/mappings/limitOrders.ts
  // Original subgraph only logs this event, no entity updates
  // For now, just log for debugging purposes
  context.log.info(`LimitOrderEngine.FeeRecipientUpdated: newFeeRecipient=${event.params.newFeeRecipient}`);
});

LimitOrderEngine.RouterUpdated.handler(async ({ event, context }) => {
  // Reference: spectra-subgraph-master/src/mappings/limitOrders.ts
  // Original subgraph only logs this event, no entity updates
  // For now, just log for debugging purposes
  context.log.info(`LimitOrderEngine.RouterUpdated: newRouter=${event.params.newRouter}`);
});

LimitOrderEngine.Paused.handler(async ({ event, context }) => {
  // Reference: spectra-subgraph-master/src/mappings/limitOrders.ts
  // Original subgraph only logs this event, no entity updates
  // For now, just log for debugging purposes
  context.log.info(`LimitOrderEngine.Paused: account=${event.params.account}`);
});

LimitOrderEngine.Unpaused.handler(async ({ event, context }) => {
  // Reference: spectra-subgraph-master/src/mappings/limitOrders.ts
  // Original subgraph only logs this event, no entity updates
  // For now, just log for debugging purposes
  context.log.info(`LimitOrderEngine.Unpaused: account=${event.params.account}`);
});

// NonceManager handlers
NonceManager.NonceIncreased.handler(async ({ event, context }) => {
  // Reference: spectra-subgraph-master/src/mappings/limitOrders.ts handleNonceManagerNonceIncreased
  // Same logic as LimitOrderEngine.NonceIncreased
  // Create unique ID for UserNonce entity
  // Prefix with chainId for multichain support
  const userNonceId = `${event.chainId}-nonce-${event.params.maker}`;

  // Get or create UserNonce entity
  let userNonce = await context.UserNonce.get(userNonceId);
  if (!userNonce) {
    // Create new UserNonce entity
    userNonce = {
      id: userNonceId,
      user: event.params.maker,
      latestNonce: event.params.newNonce,
      updatedAt: BigInt(event.block.timestamp),
      updatedAtBlock: BigInt(event.block.number),
    };
  } else {
    // Update with the new nonce (should always be higher)
    userNonce = {
      ...userNonce,
      latestNonce: event.params.newNonce,
      updatedAt: BigInt(event.block.timestamp),
      updatedAtBlock: BigInt(event.block.number),
    };
  }

  context.UserNonce.set(userNonce);
});

