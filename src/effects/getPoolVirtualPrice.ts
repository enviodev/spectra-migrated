// Reference: spectra-subgraph-master/src/entities/CurvePool.ts
// Effect for fetching pool virtual price from CurvePool contract

import { createEffect, S } from "envio";
import { createPublicClient, http, parseAbi } from "viem";
import { CURVE_UNIT } from "../constants";

// Minimal ABI for get_virtual_price function
const CURVE_POOL_ABI = parseAbi([
  "function get_virtual_price() view returns (uint256)",
]);

/**
 * Effect to fetch pool virtual price from a CurvePool contract
 * Uses viem for contract state reading
 */
export const getPoolVirtualPrice = createEffect(
  {
    name: "getPoolVirtualPrice",
    input: {
      poolAddress: S.string,
      chainId: S.number,
      blockNumber: S.number,
    },
    output: S.schema({
      virtualPrice: S.string,
    }),
    rateLimit: false,
    cache: true,
  },
  async ({ input }) => {
    try {
      const rpcUrl = process.env[`RPC_URL_${input.chainId}`] || process.env.RPC_URL;
      if (!rpcUrl) {
        console.warn(`No RPC URL found for chain ${input.chainId}`);
        return { virtualPrice: CURVE_UNIT.toString() };
      }

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

      const poolAddress = input.poolAddress as `0x${string}`;

      const virtualPrice = await publicClient.readContract({
        address: poolAddress,
        abi: CURVE_POOL_ABI,
        functionName: "get_virtual_price",
      }).catch((err) => {
        console.warn(`get_virtual_price() failed for ${input.poolAddress}:`, err.message);
        return CURVE_UNIT;
      });

      return { virtualPrice: virtualPrice.toString() };
    } catch (error) {
      console.warn(`getPoolVirtualPrice() call failed for ${input.poolAddress}:`, error);
      return { virtualPrice: CURVE_UNIT.toString() };
    }
  }
);

