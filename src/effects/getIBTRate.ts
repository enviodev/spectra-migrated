// Reference: spectra-subgraph-master/src/entities/ERC4626.ts
// Effect for fetching IBT rate (convertToAssets with 1 unit of shares)

import { createEffect, S } from "envio";
import { createPublicClient, http, parseAbi } from "viem";
import { UNIT_BI } from "../constants";
import { getERC20Decimals } from "../entities/ERC20";

// Minimal ABI for ERC4626 convertToAssets function
const ERC4626_ABI = parseAbi([
  "function convertToAssets(uint256 shares) view returns (uint256)",
]);

/**
 * Effect to fetch IBT rate (convertToAssets with 10^decimals shares)
 * Uses viem for contract state reading
 */
export const getIBTRate = createEffect(
  {
    name: "getIBTRate",
    input: {
      ibtAddress: S.string,
      decimals: S.number,
      chainId: S.number,
      blockNumber: S.number,
    },
    output: S.schema({
      ibtRate: S.string,
    }),
    rateLimit: false,
    cache: true,
  },
  async ({ input }) => {
    try {
      const rpcUrl = process.env[`RPC_URL_${input.chainId}`] || process.env.RPC_URL;
      if (!rpcUrl) {
        console.warn(`No RPC URL found for chain ${input.chainId}`);
        return { ibtRate: UNIT_BI.toString() };
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

      const ibtAddress = input.ibtAddress as `0x${string}`;

      // Calculate 10^decimals
      let ibtUnit = BigInt(1);
      for (let i = 0; i < input.decimals; i++) {
        ibtUnit *= BigInt(10);
      }

      const ibtRate = await publicClient.readContract({
        address: ibtAddress,
        abi: ERC4626_ABI,
        functionName: "convertToAssets",
        args: [ibtUnit],
      });

      return { ibtRate: ibtRate.toString() };
    } catch (error) {
      console.warn(`getIBTRate() call failed for ${input.ibtAddress}:`, error);
      return { ibtRate: UNIT_BI.toString() };
    }
  }
);

