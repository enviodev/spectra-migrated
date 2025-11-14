// Reference: spectra-subgraph-master/src/entities/CurvePool.ts
// Effect for fetching pool admin fee from CurvePool contract

import { createEffect, S } from "envio";
import { createPublicClient, http, parseAbi } from "viem";
import { ZERO_BI } from "../constants";

// Minimal ABI for admin_fee function
const CURVE_POOL_ABI = parseAbi([
  "function admin_fee() view returns (uint256)",
]);

/**
 * Effect to fetch pool admin fee from a CurvePool contract
 * Uses viem for contract state reading
 */
export const getPoolAdminFee = createEffect(
  {
    name: "getPoolAdminFee",
    input: {
      poolAddress: S.string,
      chainId: S.number,
      blockNumber: S.number,
    },
    output: S.schema({
      adminFee: S.string,
    }),
    rateLimit: false,
    cache: true,
  },
  async ({ input }) => {
    try {
      const rpcUrl = process.env[`RPC_URL_${input.chainId}`] || process.env.RPC_URL;
      if (!rpcUrl) {
        console.warn(`No RPC URL found for chain ${input.chainId}`);
        return { adminFee: ZERO_BI.toString() };
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

      const adminFee = await publicClient.readContract({
        address: input.poolAddress as `0x${string}`,
        abi: CURVE_POOL_ABI,
        functionName: "admin_fee",
      });

      return { adminFee: adminFee.toString() };
    } catch (error) {
      console.warn(`admin_fee() call reverted for ${input.poolAddress}`);
      return { adminFee: ZERO_BI.toString() };
    }
  }
);

