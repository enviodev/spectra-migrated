// Reference: spectra-subgraph-master/src/entities/CurvePool.ts
// Effect for fetching pool fee from CurvePool contract

import { createEffect, S } from "envio";
import { createPublicClient, http, parseAbi } from "viem";
import { ZERO_BI } from "../constants";

// Minimal ABI for fee function
const CURVE_POOL_ABI = parseAbi([
  "function fee() view returns (uint256)",
]);

/**
 * Effect to fetch pool fee from a CurvePool contract
 * Uses viem for contract state reading
 */
export const getPoolFee = createEffect(
  {
    name: "getPoolFee",
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
      const rpcUrl = process.env[`ENVIO_RPC_URL_${input.chainId}`] || process.env.RPC_URL;
      if (!rpcUrl) {
        console.warn(`No RPC URL found for chain ${input.chainId}`);
        return ZERO_BI.toString();
      }

      // Create public client for this chain
      // Minimal chain definition for viem
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
      const fee = await publicClient.readContract({
        address: input.poolAddress as `0x${string}`,
        abi: CURVE_POOL_ABI,
        functionName: "fee",
      });

      return fee.toString();
    } catch (error) {
      console.warn(`getPoolFee() call failed for ${input.poolAddress}:`, error);
      return ZERO_BI.toString();
    }
  }
);

