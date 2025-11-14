// Reference: spectra-subgraph-master/src/entities/SpectraWrapper.ts

import { SpectraWrapper_t } from "generated/src/db/Entities.gen";
import { getSpectraWrapperData } from "../effects/getSpectraWrapperData";

/**
 * Get or create SpectraWrapper entity
 * Fetches wrapper data via RPC
 */
export async function getSpectraWrapper(
  wrapperAddress: string,
  timestamp: bigint,
  blockNumber: number,
  chainId: number,
  context: any
): Promise<SpectraWrapper_t> {
  // Prefix with chainId for multichain support
  const wrapperId = `${chainId}-${wrapperAddress}`;

  let wrapper = await context.SpectraWrapper.get(wrapperId);

  if (!wrapper) {
    // Fetch wrapper data via effect
    const wrapperDataResult = await context.effect(getSpectraWrapperData, {
      wrapperAddress: wrapperAddress,
      chainId: chainId,
      blockNumber: blockNumber,
    });

    const wrapperData = wrapperDataResult as {
      name: string;
      symbol: string;
      decimals: number;
      vaultShare: string;
      vaultShareName: string;
      vaultShareSymbol: string;
      vaultShareDecimals: number;
      asset: string;
      assetName: string;
      assetSymbol: string;
      assetDecimals: number;
    };

    // Create SpectraWrapper entity
    wrapper = {
      id: wrapperId,
      address: wrapperAddress,
      createdAtTimestamp: timestamp,
      name: wrapperData.name,
      symbol: wrapperData.symbol,
      decimals: wrapperData.decimals,
      vaultShare: wrapperData.vaultShare || "",
      vaultShareName: wrapperData.vaultShareName || "UNKNOWN",
      vaultShareSymbol: wrapperData.vaultShareSymbol || "UNKNOWN",
      vaultShareDecimals: wrapperData.vaultShareDecimals || 18,
      asset: wrapperData.asset || "",
      assetName: wrapperData.assetName || "UNKNOWN",
      assetSymbol: wrapperData.assetSymbol || "UNKNOWN",
      assetDecimals: wrapperData.assetDecimals || 18,
    };
    context.SpectraWrapper.set(wrapper);
  }

  return wrapper;
}
