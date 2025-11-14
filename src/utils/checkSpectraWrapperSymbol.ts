// Helper function to check if a contract is a SpectraWrapper by checking its symbol
// This is used in contractRegister where we can't use the Effect API

import { createPublicClient, http, parseAbi } from "viem";

// Minimal ABI for ERC20 symbol function
const ERC20_SYMBOL_ABI = parseAbi(["function symbol() view returns (string)"]);

/**
 * Checks if a contract's symbol starts with "sw-" (SpectraWrapper prefix)
 * Uses direct viem call (not Effect API) for use in contractRegister
 * 
 * @param address - Contract address to check
 * @param chainId - Chain ID
 * @returns true if symbol starts with "sw-", false otherwise
 */
export async function isSpectraWrapper(
  address: string,
  chainId: number
): Promise<boolean> {
  try {
    const rpcUrl = process.env[`ENVIO_RPC_URL_${chainId}`] || process.env.RPC_URL;
    if (!rpcUrl) {
      console.warn(`No RPC URL found for chain ${chainId}`);
      return false;
    }

    const publicClient = createPublicClient({
      chain: {
        id: chainId,
        name: `Chain ${chainId}`,
        nativeCurrency: {
          decimals: 18,
          name: "ETH",
          symbol: "ETH",
        },
        rpcUrls: {
          default: { http: [rpcUrl] },
          public: { http: [rpcUrl] },
        },
      },
      transport: http(rpcUrl, {
        batch: true,
        timeout: 30_000,
      }),
    });

    // Call symbol() function
    const symbol = await publicClient.readContract({
      address: address as `0x${string}`,
      abi: ERC20_SYMBOL_ABI,
      functionName: "symbol",
    });

    // Check if symbol starts with "sw-" (SpectraWrapper prefix)
    return symbol.startsWith("sw-");
  } catch (error) {
    // If the call fails (contract doesn't have symbol(), reverts, etc.), it's not a SpectraWrapper
    // This is expected for Factory contracts and other non-ERC20 contracts
    // Silent failure - return false without logging
    return false;
  }
}

