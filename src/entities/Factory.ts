// Reference: spectra-subgraph-master/src/entities/Factory.ts

import { getCurveFactory } from "../effects/getCurveFactory";
import { ZERO_ADDRESS } from "../constants";

/**
 * Create a Factory entity
 * Note: In Envio, we use chainId-prefixed IDs and async RPC calls via Effect API
 */
export async function createFactory(
  registry: string,
  factoryAddress: string,
  timestamp: bigint,
  chainId: number,
  blockNumber: number,
  context: any
): Promise<any> {
  // Prefix with chainId for multichain support
  const factoryId = `${chainId}-${factoryAddress}`;

  let factory = await context.Factory.get(factoryId);
  if (!factory) {
    // Fetch curveFactory via RPC call using Effect API
    const curveFactory = await context.effect(getCurveFactory, {
      factoryAddress: factoryAddress,
      chainId: chainId,
      blockNumber: blockNumber,
    }) || ZERO_ADDRESS;

    factory = {
      id: factoryId,
      address: factoryAddress,
      createdAtTimestamp: timestamp,
      registry: registry,
      curveFactory: curveFactory,
      oldFactory: null,
      oldRegistry: null,
    };

    context.Factory.set(factory);
  }

  return factory;
}
