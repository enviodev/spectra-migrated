// Reference: spectra-subgraph/src/mappings/metavaults/modules.ts

import { GnosisSafe, GnosisSafeModule } from "generated";

// Metavault/entities live in main entities folder
import { getMetavault } from "../../entities/Metavault";

// Helper to get/create MetavaultModule entity
async function getModule(
  moduleAddress: string,
  metavaultAddress: string,
  chainId: number,
  context: any
): Promise<import("generated/src/db/Entities.gen").MetavaultModule_t> {
  const moduleId = `${chainId}-${moduleAddress}`;
  const metavaultId = `${chainId}-${metavaultAddress}`;

  let module = await context.MetavaultModule.get(moduleId);

  if (!module) {
    // Ensure metavault exists (matches overall metavault patterns)
    await getMetavault(
      metavaultAddress,
      BigInt(Date.now()), // Timestamp won't be used for static fields
      0,
      chainId,
      context
    );

    module = {
      id: moduleId,
      address: moduleAddress,
      metavault_id: metavaultId,
    };
    context.MetavaultModule.set(module);
  }

  return module;
}

// EnabledModule → register the module and dynamic GnosisSafeModule template
// Reference: subgraph uses GnosisSafeModule.create(moduleAddress) - this registers the dynamic contract
GnosisSafe.EnabledModule.contractRegister(({ event, context }) => {
  // Register the GnosisSafeModule contract dynamically (matches subgraph's GnosisSafeModule.create)
  context.addGnosisSafeModule(event.params.module);
});

GnosisSafe.EnabledModule.handler(async ({ event, context }) => {
  // Reference: handleEnabledModule in subgraph
  const moduleAddress = String(event.params.module);
  const metavaultAddress = String(event.srcAddress);

  const module = await getModule(moduleAddress, metavaultAddress, event.chainId, context);
  if (!module) {
    throw new Error("Module not found");
  }
  // Note: Dynamic contract registration is handled in contractRegister above
});

// SafeModuleTransaction → MetavaultTransaction via module
GnosisSafe.SafeModuleTransaction.handler(async ({ event, context }) => {
  // Reference: handleSafeModuleTransaction in subgraph
  const moduleAddress = String(event.params.module);
  const metavaultAddress = String(event.srcAddress);

  const module = await getModule(
    moduleAddress,
    metavaultAddress,
    event.chainId,
    context
  );
  if (!module) {
    throw new Error("Module not found");
  }

  const id = `${event.chainId}-${event.transaction.hash}-${event.logIndex}`;
  const metavaultId = module.metavault_id;

  const metavaultTransaction = {
    id,
    metavault_id: metavaultId,
    to: String(event.params.to),
    value: event.params.value,
    data: String(event.params.data),
    operation: Number(event.params.operation),
    metavaultModule_id: module.id,
    timestamp: BigInt(event.block.timestamp),
    blockNumber: BigInt(event.block.number),
    transactionHash: String(event.transaction.hash),
    logIndex: BigInt(event.logIndex),
  };

  context.MetavaultTransaction.set(metavaultTransaction);
});

// SafeMultiSigTransaction → MetavaultTransaction directly (no module)
GnosisSafe.SafeMultiSigTransaction.handler(async ({ event, context }) => {
  // Reference: handleSafeMultiSigTransaction in subgraph
  const id = `${event.chainId}-${event.transaction.hash}-${event.logIndex}`;
  const metavaultId = `${event.chainId}-${event.srcAddress}`;

  const metavaultTransaction = {
    id,
    metavault_id: metavaultId,
    to: String(event.params.to),
    value: event.params.value,
    data: String(event.params.data),
    operation: Number(event.params.operation),
    metavaultModule_id: undefined,
    timestamp: BigInt(event.block.timestamp),
    blockNumber: BigInt(event.block.number),
    transactionHash: String(event.transaction.hash),
    logIndex: BigInt(event.logIndex),
  };

  context.MetavaultTransaction.set(metavaultTransaction);
});

// TransactionAdded (from GnosisSAFEModule) → TimelockedTransactionAdded
GnosisSafeModule.TransactionAdded.handler(async ({ event, context }) => {
  // Reference: handleTransactionAdded in subgraph
  const id = `${event.chainId}-${event.transaction.hash}-${event.logIndex}`;

  const moduleId = `${event.chainId}-${event.srcAddress}`;
  const metavaultModule = await context.MetavaultModule.get(moduleId);

  if (!metavaultModule) {
    // In subgraph they log a warning and return; in Envio use context.log.warn
    context.log.warn("Module was not registered");
    return;
  }

  const timelockedTransactionAdded = {
    id,
    operator: String(event.transaction.from),
    metavault_id: metavaultModule.metavault_id,
    queueNonce: event.params.queueNonce,
    timelockedTransactionHash: String(event.params.txHash),
    to: String(event.params.to),
    value: event.params.value,
    data: String(event.params.data),
    operation: Number(event.params.operation),
    nonce: event.params.queueNonce,
    timestamp: BigInt(event.block.timestamp),
    blockNumber: BigInt(event.block.number),
    transactionHash: String(event.transaction.hash),
    logIndex: BigInt(event.logIndex),
    delayModule: String(event.srcAddress),
  };

  context.TimelockedTransactionAdded.set(timelockedTransactionAdded);
}
);


