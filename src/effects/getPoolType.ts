// Reference: spectra-subgraph-master/src/entities/CurvePool.ts
// Effect for determining pool type from CurvePool contract

import { createEffect, S } from "envio";
import { createPublicClient, http, parseAbi } from "viem";

// Minimal ABIs for pool type detection
const CURVE_POOL_SNG_ABI = parseAbi(["function decimals() view returns (uint8)"]);
const CURVE_POOL_NG_ABI = parseAbi(["function ma_time() view returns (uint256)"]);
const CURVE_POOL_ABI = parseAbi(["function ma_half_time() view returns (uint256)"]);

/**
 * Effect to determine pool type by trying different contract calls
 * Uses viem for contract state reading
 */
export const getPoolType = createEffect(
  {
    name: "getPoolType",
    input: {
      poolAddress: S.string,
      chainId: S.number,
      blockNumber: S.number,
    },
    output: S.nullable(S.string),
    rateLimit: false,
    cache: true,
  },
  async ({ input }) => {
    try {
      const rpcUrl = process.env[`RPC_URL_${input.chainId}`] || process.env.RPC_URL;
      if (!rpcUrl) {
        console.warn(`No RPC URL found for chain ${input.chainId}`);
        return "UNKNOWN";
      }

      // Create public client for this chain
      const publicClient = createPublicClient({
        chain: {
          id: input.chainId,
          name: `Chain ${input.chainId}`,
          nativeCurrency: {
            decimals: 18,
            name: "ETH",
            symbol: "ETH",
          },
          rpcUrls: {
            default: {
              http: [rpcUrl],
            },
            public: {
              http: [rpcUrl],
            },
          },
        },
        transport: http(rpcUrl, { batch: true }),
      });

      // Try SNG first (has decimals function)
      try {
        await publicClient.readContract({
          address: input.poolAddress as `0x${string}`,
          abi: CURVE_POOL_SNG_ABI,
          functionName: "decimals",
        });
        return "CURVE_SNG";
      } catch {
        // Not SNG, continue
      }

      // Try NG (has ma_time function)
      try {
        await publicClient.readContract({
          address: input.poolAddress as `0x${string}`,
          abi: CURVE_POOL_NG_ABI,
          functionName: "ma_time",
        });
        return "CURVE_NG";
      } catch {
        // Not NG, continue
      }

      // Try standard Curve (has ma_half_time function)
      try {
        await publicClient.readContract({
          address: input.poolAddress as `0x${string}`,
          abi: CURVE_POOL_ABI,
          functionName: "ma_half_time",
        });
        return "CURVE";
      } catch {
        // Not standard Curve
      }

      console.warn(`All identification methods failed for pool ${input.poolAddress}`);
      return "UNKNOWN";
    } catch (error) {
      console.warn(`getPoolType() call failed for ${input.poolAddress}:`, error);
      return "UNKNOWN";
    }
  }
);

