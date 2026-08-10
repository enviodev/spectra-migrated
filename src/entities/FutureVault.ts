// Reference: spectra-subgraph-master/src/entities/FutureVault.ts

import { UNIT_BI, ZERO_BI, ZERO_ADDRESS } from "../constants";
import { getPrincipalTokenData } from "../effects/getPrincipalTokenData";

/**
 * Get PrincipalToken data (cached via effect)
 */
async function getPTData(
  address: string,
  blockNumber: number,
  context: any
): Promise<{
  maturity: string;
  name: string;
  symbol: string;
  decimals: number;
  underlying: string;
  ibt: string;
  yt: string;
  ptRate: string;
  totalAssets: string;
}> {
  const ptDataResult = await context.effect(getPrincipalTokenData, {
    ptAddress: address,
    blockNumber: blockNumber,
  });

  return ptDataResult as {
    maturity: string;
    name: string;
    symbol: string;
    decimals: number;
    underlying: string;
    ibt: string;
    yt: string;
    ptRate: string;
    totalAssets: string;
  };
}

/**
 * Get expiration timestamp (maturity)
 * Reference: spectra-subgraph-master/src/entities/FutureVault.ts
 */
export async function getExpirationTimestamp(
  address: string,
  blockNumber: number,
  context: any
): Promise<bigint> {
  const ptData = await getPTData(address, chainId, blockNumber, context);
  return BigInt(ptData.maturity || "0");
}

/**
 * Get name
 * Reference: spectra-subgraph-master/src/entities/FutureVault.ts
 */
export async function getName(
  address: string,
  blockNumber: number,
  context: any
): Promise<string> {
  const ptData = await getPTData(address, chainId, blockNumber, context);
  return ptData.name || "";
}

/**
 * Get symbol
 * Reference: spectra-subgraph-master/src/entities/FutureVault.ts
 */
export async function getSymbol(
  address: string,
  blockNumber: number,
  context: any
): Promise<string> {
  const ptData = await getPTData(address, chainId, blockNumber, context);
  return ptData.symbol || "";
}

/**
 * Get underlying address
 * Reference: spectra-subgraph-master/src/entities/FutureVault.ts
 */
export async function getUnderlying(
  address: string,
  blockNumber: number,
  context: any
): Promise<string> {
  const ptData = await getPTData(address, chainId, blockNumber, context);
  return ptData.underlying || ZERO_ADDRESS;
}

/**
 * Get IBT address
 * Reference: spectra-subgraph-master/src/entities/FutureVault.ts
 */
export async function getIBT(
  address: string,
  blockNumber: number,
  context: any
): Promise<string> {
  const ptData = await getPTData(address, chainId, blockNumber, context);
  return ptData.ibt || ZERO_ADDRESS;
}

/**
 * Get YT address
 * Reference: spectra-subgraph-master/src/entities/FutureVault.ts
 */
export async function getYT(
  address: string,
  blockNumber: number,
  context: any
): Promise<string> {
  const ptData = await getPTData(address, chainId, blockNumber, context);
  return ptData.yt || ZERO_ADDRESS;
}

/**
 * Get total assets
 * Reference: spectra-subgraph-master/src/entities/FutureVault.ts
 */
export async function getTotalAssets(
  address: string,
  blockNumber: number,
  context: any
): Promise<bigint> {
  const ptData = await getPTData(address, chainId, blockNumber, context);
  return BigInt(ptData.totalAssets || "0");
}

/**
 * Get PT rate
 * Reference: spectra-subgraph-master/src/entities/FutureVault.ts
 */
export async function getPTRate(
  address: string,
  blockNumber: number,
  context: any
): Promise<bigint> {
  const ptData = await getPTData(address, chainId, blockNumber, context);
  return BigInt(ptData.ptRate || UNIT_BI.toString());
}
