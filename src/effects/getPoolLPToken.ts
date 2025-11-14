// Reference: spectra-subgraph-master/src/entities/CurvePool.ts
// Effect for fetching LP token address from CurvePool contract

import { createEffect, S } from "envio";
import { createPublicClient, http, parseAbi } from "viem";
import { ZERO_ADDRESS } from "../constants";

// Minimal ABI for token() function
const CURVE_POOL_ABI = parseAbi(["function token() view returns (address)"]);

/**
 * Effect to fetch LP token address from a CurvePool contract
 * Uses viem for contract state reading
 */
export const getPoolLPToken = createEffect(
  {
    name: "getPoolLPToken",
    input: {
      poolAddress: S.string,
      poolType: S.string,
      chainId: S.number,
      blockNumber: S.number,
    },
    output: S.nullable(S.string),
    rateLimit: false,
    cache: true,
  },
  async ({ input }) => {
    try {
      // If pool is SNG, the LP token is itself
      if (input.poolType === "CURVE_SNG") {
        return input.poolAddress;
      }

      const rpcUrl = process.env[`ENVIO_RPC_URL_${input.chainId}`] || process.env.RPC_URL;
      if (!rpcUrl) {
        console.warn(`No RPC URL found for chain ${input.chainId}`);
        return ZERO_ADDRESS;
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

      // Read contract state using viem
      const tokenAddress = await publicClient.readContract({
        address: input.poolAddress as `0x${string}`,
        abi: CURVE_POOL_ABI,
        functionName: "token",
      });

      return (tokenAddress as string);
    } catch (error) {
      console.warn(`getPoolLPToken() call failed for ${input.poolAddress}:`, error);
      return ZERO_ADDRESS;
    }
  }
);

