// Reference: spectra-subgraph-master/src/mappings/accessManager.ts

import { AccessManager } from "generated";

AccessManager.RoleGranted.handler(async ({ event, context }) => {
  // Reference: spectra-subgraph-master/src/mappings/accessManager.ts handleRoleGranted
  // Prefix with chainId for multichain support
  // Use transaction.hash (requires field_selection in config.yaml)
  const eventId = `${event.chainId}-${event.transaction.hash.toLowerCase()}-${event.logIndex}`;

  // Create RoleGranted event entity
  const roleGranted = {
    id: eventId,
    roleId: event.params.roleId,
    account: event.params.account,
    delay: event.params.delay,
    since: event.params.since,
    newMember: event.params.newMember,
    timestamp: BigInt(event.block.timestamp),
    blockNumber: BigInt(event.block.number),
    transactionHash: event.transaction.hash.toLowerCase(),
    logIndex: BigInt(event.logIndex),
  };
  context.RoleGranted.set(roleGranted);

  // Update or create RoleAttribution
  const attributionId = `${event.chainId}-${event.params.account}-${event.params.roleId}`;
  let attribution = await context.RoleAttribution.get(attributionId);
  if (!attribution) {
    attribution = {
      id: attributionId,
      address: event.params.account,
      roleId: event.params.roleId,
      since: BigInt(0),
      currentDelay: BigInt(0),
      pendingDelay: BigInt(0),
      effect: BigInt(0),
      grantedAt: BigInt(event.block.timestamp),
      updatedAt: BigInt(event.block.timestamp),
    };
  } else {
    // Create new object with updated values (cannot mutate read-only properties)
    attribution = {
      ...attribution,
      since: event.params.since,
      currentDelay: event.params.delay,
      updatedAt: BigInt(event.block.timestamp),
    };
  }
  context.RoleAttribution.set(attribution);
});

AccessManager.RoleRevoked.handler(async ({ event, context }) => {
  // Reference: spectra-subgraph-master/src/mappings/accessManager.ts handleRoleRevoked
  // Prefix with chainId for multichain support
  const eventId = `${event.chainId}-${event.transaction.hash.toLowerCase()}-${event.logIndex}`;

  // Create RoleRevoked event entity
  const roleRevoked = {
    id: eventId,
    roleId: event.params.roleId,
    account: event.params.account,
    delay: BigInt(0), // RoleRevoked doesn't have delay parameter
    since: BigInt(0), // RoleRevoked doesn't have since parameter
    timestamp: BigInt(event.block.timestamp),
    blockNumber: BigInt(event.block.number),
    transactionHash: event.transaction.hash.toLowerCase(),
    logIndex: BigInt(event.logIndex),
  };
  context.RoleRevoked.set(roleRevoked);

  // Remove RoleAttribution using deleteUnsafe
  const attributionId = `${event.chainId}-${event.params.account}-${event.params.roleId}`;
  context.RoleAttribution.deleteUnsafe(attributionId);
});

AccessManager.RoleAdminChanged.handler(async ({ event, context }) => {
  // Reference: spectra-subgraph-master/src/mappings/accessManager.ts handleRoleAdminChanged
  const eventId = `${event.chainId}-${event.transaction.hash.toLowerCase()}-${event.logIndex}`;

  const roleAdminChanged = {
    id: eventId,
    roleId: event.params.roleId,
    admin: event.params.admin,
    timestamp: BigInt(event.block.timestamp),
    blockNumber: BigInt(event.block.number),
    transactionHash: event.transaction.hash.toLowerCase(),
    logIndex: BigInt(event.logIndex),
  };
  context.RoleAdminChanged.set(roleAdminChanged);
});

AccessManager.RoleGuardianChanged.handler(async ({ event, context }) => {
  // Reference: spectra-subgraph-master/src/mappings/accessManager.ts handleRoleGuardianChanged
  const eventId = `${event.chainId}-${event.transaction.hash.toLowerCase()}-${event.logIndex}`;

  const roleGuardianChanged = {
    id: eventId,
    roleId: event.params.roleId,
    guardian: event.params.guardian,
    timestamp: BigInt(event.block.timestamp),
    blockNumber: BigInt(event.block.number),
    transactionHash: event.transaction.hash.toLowerCase(),
    logIndex: BigInt(event.logIndex),
  };
  context.RoleGuardianChanged.set(roleGuardianChanged);
});

AccessManager.RoleGrantDelayChanged.handler(async ({ event, context }) => {
  // Reference: spectra-subgraph-master/src/mappings/accessManager.ts handleRoleGrantDelayChanged
  const eventId = `${event.chainId}-${event.transaction.hash.toLowerCase()}-${event.logIndex}`;

  const roleGrantDelayChanged = {
    id: eventId,
    roleId: event.params.roleId,
    delay: event.params.delay,
    since: event.params.since,
    timestamp: BigInt(event.block.timestamp),
    blockNumber: BigInt(event.block.number),
    transactionHash: event.transaction.hash.toLowerCase(),
    logIndex: BigInt(event.logIndex),
  };
  context.RoleGrantDelayChanged.set(roleGrantDelayChanged);
});

AccessManager.TargetAdminDelayUpdated.handler(async ({ event, context }) => {
  // Reference: spectra-subgraph-master/src/mappings/accessManager.ts handleTargetAdminDelayUpdated
  const eventId = `${event.chainId}-${event.transaction.hash.toLowerCase()}-${event.logIndex}`;

  const targetAdminDelayUpdated = {
    id: eventId,
    target: event.params.target,
    delay: event.params.delay,
    since: event.params.since,
    timestamp: BigInt(event.block.timestamp),
    blockNumber: BigInt(event.block.number),
    transactionHash: event.transaction.hash.toLowerCase(),
    logIndex: BigInt(event.logIndex),
  };
  context.TargetAdminDelayUpdated.set(targetAdminDelayUpdated);
});

AccessManager.TargetClosed.handler(async ({ event, context }) => {
  // Reference: spectra-subgraph-master/src/mappings/accessManager.ts handleTargetClosed
  const eventId = `${event.chainId}-${event.transaction.hash.toLowerCase()}-${event.logIndex}`;

  const targetClosed = {
    id: eventId,
    target: event.params.target,
    closed: event.params.closed,
    timestamp: BigInt(event.block.timestamp),
    blockNumber: BigInt(event.block.number),
    transactionHash: event.transaction.hash.toLowerCase(),
    logIndex: BigInt(event.logIndex),
  };
  context.TargetClosed.set(targetClosed);
});

AccessManager.TargetFunctionRoleUpdated.handler(async ({ event, context }) => {
  // Reference: spectra-subgraph-master/src/mappings/accessManager.ts handleTargetFunctionRoleUpdated
  const eventId = `${event.chainId}-${event.transaction.hash.toLowerCase()}-${event.logIndex}`;

  const targetFunctionRoleUpdated = {
    id: eventId,
    target: event.params.target,
    selector: event.params.selector.toLowerCase(),
    roleId: event.params.roleId,
    timestamp: BigInt(event.block.timestamp),
    blockNumber: BigInt(event.block.number),
    transactionHash: event.transaction.hash.toLowerCase(),
    logIndex: BigInt(event.logIndex),
  };
  context.TargetFunctionRoleUpdated.set(targetFunctionRoleUpdated);
});

AccessManager.OperationScheduled.handler(async ({ event, context }) => {
  // Reference: spectra-subgraph-master/src/mappings/accessManager.ts handleOperationScheduled
  const eventId = `${event.chainId}-${event.transaction.hash.toLowerCase()}-${event.logIndex}`;

  const operationScheduled = {
    id: eventId,
    operationId: event.params.operationId.toLowerCase(),
    nonce: event.params.nonce,
    schedule: event.params.schedule,
    caller: event.params.caller,
    target: event.params.target,
    data: event.params.data.toLowerCase(),
    timestamp: BigInt(event.block.timestamp),
    blockNumber: BigInt(event.block.number),
    transactionHash: event.transaction.hash.toLowerCase(),
    logIndex: BigInt(event.logIndex),
  };
  context.OperationScheduled.set(operationScheduled);
});

AccessManager.OperationExecuted.handler(async ({ event, context }) => {
  // Reference: spectra-subgraph-master/src/mappings/accessManager.ts handleOperationExecuted
  const eventId = `${event.chainId}-${event.transaction.hash.toLowerCase()}-${event.logIndex}`;

  const operationExecuted = {
    id: eventId,
    operationId: event.params.operationId.toLowerCase(),
    nonce: event.params.nonce,
    timestamp: BigInt(event.block.timestamp),
    blockNumber: BigInt(event.block.number),
    transactionHash: event.transaction.hash.toLowerCase(),
    logIndex: BigInt(event.logIndex),
  };
  context.OperationExecuted.set(operationExecuted);
});

AccessManager.OperationCanceled.handler(async ({ event, context }) => {
  // Reference: spectra-subgraph-master/src/mappings/accessManager.ts handleOperationCanceled
  const eventId = `${event.chainId}-${event.transaction.hash.toLowerCase()}-${event.logIndex}`;

  const operationCanceled = {
    id: eventId,
    operationId: event.params.operationId.toLowerCase(),
    nonce: event.params.nonce,
    timestamp: BigInt(event.block.timestamp),
    blockNumber: BigInt(event.block.number),
    transactionHash: event.transaction.hash.toLowerCase(),
    logIndex: BigInt(event.logIndex),
  };
  context.OperationCanceled.set(operationCanceled);
});

AccessManager.RoleLabel.handler(async ({ event, context }) => {
  // Reference: spectra-subgraph-master/src/mappings/accessManager.ts handleRoleLabel
  const eventId = `${event.chainId}-${event.transaction.hash.toLowerCase()}-${event.logIndex}`;

  const roleLabel = {
    id: eventId,
    roleId: event.params.roleId,
    label: event.params.label,
    timestamp: BigInt(event.block.timestamp),
    blockNumber: BigInt(event.block.number),
    transactionHash: event.transaction.hash.toLowerCase(),
    logIndex: BigInt(event.logIndex),
  };
  context.RoleLabel.set(roleLabel);
});

