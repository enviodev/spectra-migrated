// Reference: spectra-subgraph-master/src/entities/CurvePool.ts
// Effect for fetching pool future admin fee from CurvePool contract

import { createEffect, S } from "envio";
import { createPublicClient, http, parseAbi } from "viem";
import { ZERO_BI } from "../constants";

// Minimal ABI for future_admin_fee function
const CURVE_POOL_ABI = parseAbi([
  "function future_admin_fee() view returns (uint256)",
]);

/**
 * Effect to fetch pool future admin fee from a CurvePool contract
 * Uses viem for contract state reading
 */
export const getPoolFutureAdminFee = createEffect(
  {
    name: "getPoolFutureAdminFee",
    input: {
      poolAddress: S.string,
      chainId: S.number,
      blockNumber: S.number,
    },
    output: S.schema({
      futureAdminFee: S.string,
    }),
    rateLimit: false,
    cache: true,
  },
  async ({ input }) => {
    try {
      const rpcUrl = process.env[`RPC_URL_${input.chainId}`] || process.env.RPC_URL;
      if (!rpcUrl) {
        console.warn(`No RPC URL found for chain ${input.chainId}`);
        return { futureAdminFee: ZERO_BI.toString() };
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

      const futureAdminFee = await publicClient.readContract({
        address: input.poolAddress as `0x${string}`,
        abi: CURVE_POOL_ABI,
        functionName: "future_admin_fee",
      });

      return { futureAdminFee: futureAdminFee.toString() };
    } catch (error) {
      console.warn(`future_admin_fee() call reverted for ${input.poolAddress}`);
      return { futureAdminFee: ZERO_BI.toString() };
    }
  }
);

