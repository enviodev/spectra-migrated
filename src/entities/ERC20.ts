// Reference: spectra-subgraph-master/src/entities/ERC20.ts

import { Asset_t } from "generated/src/db/Entities.gen";
import { ZERO_BI } from "../constants";
import { getERC20Data } from "../effects/getERC20Data";
import { getERC20TotalSupply as getERC20TotalSupplyEffect } from "../effects/getERC20TotalSupply";

/**
 * Get ERC20 name
 * Reference: spectra-subgraph-master/src/entities/ERC20.ts
 * 
 * IMPORTANT: Matches original subgraph pattern exactly:
 * 1. Check database first (Asset entity)
 * 2. If exists, return cached value
 * 3. If not exists, make RPC call
 * 4. Return value (does NOT create Asset entity - that's done in getAsset)
 */
export async function getERC20Name(
  address: string,
  chainId: number,
  blockNumber: number,
  context: any
): Promise<string> {
  // Check database first (matches original subgraph pattern)
  const assetId = `${chainId}-${address}`;
  const asset = await context.Asset.get(assetId);
  if (asset) {
    return asset.name;
  }

  // Only fetch via RPC if Asset doesn't exist in database
  try {
    const erc20DataResult = await context.effect(getERC20Data, {
      tokenAddress: address,
      chainId: chainId,
      blockNumber: blockNumber,
    });

    const erc20Data = erc20DataResult as {
      name: string;
      symbol: string;
      decimals: number;
    };

    return erc20Data.name || "UNKNOWN";
  } catch (error) {
    // RPC call failed - log warning and return default (matches original subgraph)
    console.warn(`name() call reverted for ${address}`);
    return "UNKNOWN";
  }
}

/**
 * Get ERC20 symbol
 * Reference: spectra-subgraph-master/src/entities/ERC20.ts
 * 
 * IMPORTANT: Matches original subgraph pattern exactly:
 * 1. Check database first (Asset entity)
 * 2. If exists, return cached value
 * 3. If not exists, make RPC call
 * 4. Return value (does NOT create Asset entity - that's done in getAsset)
 */
export async function getERC20Symbol(
  address: string,
  chainId: number,
  blockNumber: number,
  context: any
): Promise<string> {
  // Check database first (matches original subgraph pattern)
  const assetId = `${chainId}-${address}`;
  const asset = await context.Asset.get(assetId);
  if (asset) {
    return asset.symbol;
  }

  // Only fetch via RPC if Asset doesn't exist in database
  try {
    const erc20DataResult = await context.effect(getERC20Data, {
      tokenAddress: address,
      chainId: chainId,
      blockNumber: blockNumber,
    });

    const erc20Data = erc20DataResult as {
      name: string;
      symbol: string;
      decimals: number;
    };

    return erc20Data.symbol || "UNKNOWN";
  } catch (error) {
    // RPC call failed - log warning and return default (matches original subgraph)
    console.warn(`symbol() call reverted for ${address}`);
    return "UNKNOWN";
  }
}

/**
 * Get ERC20 decimals
 * Reference: spectra-subgraph-master/src/entities/ERC20.ts
 * 
 * IMPORTANT: Matches original subgraph pattern exactly:
 * 1. Check database first (Asset entity)
 * 2. If exists, return cached value
 * 3. If not exists, make RPC call
 * 4. Return value (does NOT create Asset entity - that's done in getAsset)
 */
export async function getERC20Decimals(
  address: string,
  chainId: number,
  blockNumber: number,
  context: any
): Promise<number> {
  // Check database first (matches original subgraph pattern)
  const assetId = `${chainId}-${address}`;
  const asset = await context.Asset.get(assetId);
  if (asset) {
    return asset.decimals;
  }

  // Only fetch via RPC if Asset doesn't exist in database
  try {
    const erc20DataResult = await context.effect(getERC20Data, {
      tokenAddress: address,
      chainId: chainId,
      blockNumber: blockNumber,
    });

    const erc20Data = erc20DataResult as {
      name: string;
      symbol: string;
      decimals: number;
    };

    return erc20Data.decimals || 18;
  } catch (error) {
    // RPC call failed - log warning and return default (matches original subgraph)
    console.warn(`decimals() call reverted for ${address}`);
    return 18;
  }
}

/**
 * Get ERC20 total supply
 * Reference: spectra-subgraph-master/src/entities/ERC20.ts
 */
export async function getERC20TotalSupply(
  address: string,
  chainId: number,
  blockNumber: number,
  context: any
): Promise<bigint> {
  const result = await context.effect(getERC20TotalSupplyEffect, {
    tokenAddress: address,
    chainId: chainId,
    blockNumber: blockNumber,
  });

  const data = result as { totalSupply: string };
  return BigInt(data.totalSupply || ZERO_BI.toString());
}
