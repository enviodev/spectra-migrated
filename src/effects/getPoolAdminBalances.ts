// Reference: spectra-subgraph-master/src/entities/FeeClaim.ts
// Effect for fetching pool admin balances from CurvePoolSNG contract

import { createEffect, S } from "envio";
import { createPublicClient, http, parseAbi } from "viem";
import { ZERO_BI } from "../constants";
import { PoolType } from "../utils/PoolType";

// Minimal ABI for CurvePoolSNG admin_balances function
const CURVE_POOL_SNG_ABI = parseAbi([
  "function admin_balances(uint256) view returns (uint256)",
]);

/**
 * Effect to fetch pool admin balances from a CurvePoolSNG contract
 * Uses viem for contract state reading
 */
export const getPoolAdminBalances = createEffect(
  {
    name: "getPoolAdminBalances",
    input: {
      poolAddress: S.string,
      poolType: S.string,
      chainId: S.number,
      blockNumber: S.number,
    },
    output: S.schema({
      ibtAdminBalance: S.string,
      ptAdminBalance: S.string,
    }),
    rateLimit: false,
    cache: true,
  },
  async ({ input }) => {
    try {
      // If pool isn't SNG, return zeros
      if (input.poolType !== PoolType.CURVE_SNG) {
        return {
          ibtAdminBalance: ZERO_BI.toString(),
          ptAdminBalance: ZERO_BI.toString(),
        };
      }

      const rpcUrl = process.env[`ENVIO_RPC_URL_${input.chainId}`] || process.env.RPC_URL;
      if (!rpcUrl) {
        console.warn(`No RPC URL found for chain ${input.chainId}`);
        return {
          ibtAdminBalance: ZERO_BI.toString(),
          ptAdminBalance: ZERO_BI.toString(),
        };
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

      // Call admin_balances(0) and admin_balances(1) in parallel
      const [ibtAdminBalance, ptAdminBalance] = await Promise.all([
        publicClient.readContract({
          address: poolAddress,
          abi: CURVE_POOL_SNG_ABI,
          functionName: "admin_balances",
          args: [BigInt(0)],
        }).catch((err) => {
          console.warn(`admin_balances(0) failed for ${input.poolAddress}:`, err.message);
          return BigInt(0);
        }),
        publicClient.readContract({
          address: poolAddress,
          abi: CURVE_POOL_SNG_ABI,
          functionName: "admin_balances",
          args: [BigInt(1)],
        }).catch((err) => {
          console.warn(`admin_balances(1) failed for ${input.poolAddress}:`, err.message);
          return BigInt(0);
        }),
      ]);

      return {
        ibtAdminBalance: ibtAdminBalance.toString(),
        ptAdminBalance: ptAdminBalance.toString(),
      };
    } catch (error) {
      console.warn(`getPoolAdminBalances() call failed for ${input.poolAddress}:`, error);
      return {
        ibtAdminBalance: ZERO_BI.toString(),
        ptAdminBalance: ZERO_BI.toString(),
      };
    }
  }
);

