// Reference: spectra-subgraph-master/src/entities/ERC4626.ts
// Effect for fetching underlying asset address from ERC4626 vault

import { createEffect, S } from "envio";
import { createPublicClient, http, parseAbi } from "viem";
import { ZERO_ADDRESS } from "../constants";

// Minimal ABI for ERC4626 asset() function
const ERC4626_ABI = parseAbi([
  "function asset() view returns (address)",
]);

/**
 * Effect to fetch underlying asset address from ERC4626 vault
 * Uses viem for contract state reading
 */
export const getERC4626Asset = createEffect(
  {
    name: "getERC4626Asset",
    input: {
      vaultAddress: S.string,
      chainId: S.number,
      blockNumber: S.number,
    },
    output: S.schema({
      assetAddress: S.string,
    }),
    rateLimit: false,
    cache: true,
  },
  async ({ input, context }) => {
    try {
      const rpcUrl = process.env[`ENVIO_RPC_URL_${input.chainId}`] || process.env.RPC_URL;
      if (!rpcUrl) {
        context.log.warn(`No RPC URL found for chain ${input.chainId}`);
        return { assetAddress: ZERO_ADDRESS };
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

      const vaultAddress = input.vaultAddress as `0x${string}`;

      const assetAddress = await publicClient.readContract({
        address: vaultAddress,
        abi: ERC4626_ABI,
        functionName: "asset",
        blockNumber: BigInt(input.blockNumber),
      });

      return { assetAddress: String(assetAddress) };
    } catch (error) {
      context.log.warn(`getERC4626Asset() call failed for ${input.vaultAddress}: ${String(error)}`);
      return { assetAddress: ZERO_ADDRESS };
    }
  }
);

