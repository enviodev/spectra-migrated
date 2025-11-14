// Reference: spectra-subgraph-master/src/entities/ERC20.ts
// Effect for fetching ERC20 total supply

import { createEffect, S } from "envio";
import { createPublicClient, http, parseAbi } from "viem";
import { ZERO_BI } from "../constants";

// Minimal ABI for ERC20 totalSupply function
const ERC20_ABI = parseAbi([
  "function totalSupply() view returns (uint256)",
]);

/**
 * Effect to fetch ERC20 total supply
 * Uses viem for contract state reading
 */
export const getERC20TotalSupply = createEffect(
  {
    name: "getERC20TotalSupply",
    input: {
      tokenAddress: S.string,
      chainId: S.number,
      blockNumber: S.number,
    },
    output: S.schema({
      totalSupply: S.string,
    }),
    rateLimit: false,
    cache: true,
  },
  async ({ input }) => {
    try {
      const rpcUrl = process.env[`ENVIO_RPC_URL_${input.chainId}`] || process.env.RPC_URL;
      if (!rpcUrl) {
        console.warn(`No RPC URL found for chain ${input.chainId}`);
        return { totalSupply: ZERO_BI.toString() };
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

      const tokenAddress = input.tokenAddress as `0x${string}`;

      const totalSupply = await publicClient.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: "totalSupply",
      });

      return { totalSupply: totalSupply.toString() };
    } catch (error) {
      console.error(`getERC20TotalSupply() call failed for ${input.tokenAddress}: ${error}`);
      return { totalSupply: ZERO_BI.toString() };
    }
  }
);

