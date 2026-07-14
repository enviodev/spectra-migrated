// Reference: spectra-subgraph-master/src/mappings/registry.ts

import { indexer } from "envio";
import { createFactory } from "../entities/Factory";

// Register dynamic Factory contract created by FactoryChange event
indexer.contractRegister(
  { contract: "Registry", event: "FactoryChange" },
  ({ event, context }) => {
  // Register new Factory contract when FactoryChange event occurs
  context.chain.Factory.add(event.params.newFactory);
}
);

indexer.onEvent(
  { contract: "Registry", event: "FactoryChange" },
  async ({ event, context }) => {
  // Reference: spectra-subgraph-master/src/mappings/registry.ts handleFactoryChange

  // Get or create new Factory entity
  const newFactoryAddress = event.params.newFactory;
  const factory = await createFactory(
    event.srcAddress,
    newFactoryAddress,
    BigInt(event.block.timestamp),
    event.chainId,
    event.block.number,
    context
  );

  // Get or create old Factory entity
  const oldFactoryAddress = event.params.previousFactory;
  const oldFactoryId = `${event.chainId}-${oldFactoryAddress}`;
  let oldFactory = await context.Factory.get(oldFactoryId);

  if (!oldFactory) {
    oldFactory = await createFactory(
      event.srcAddress,
      oldFactoryAddress,
      BigInt(event.block.timestamp),
      event.chainId,
      event.block.number,
      context
    );
  }

  // Update factory with oldFactory relationship (matches subgraph: factory.oldFactory = oldFactory.address)
  context.Factory.set({
    ...factory,
    oldFactory: oldFactoryAddress,
  });
}
);

