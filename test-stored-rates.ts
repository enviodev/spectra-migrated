import { createPublicClient, http, parseAbi } from "viem";

const CURVE_POOL_SNG_ABI = parseAbi([
  "function last_price(uint256) view returns (uint256)",
  "function stored_rates() view returns (uint256[2])",
]);

const CURVE_POOL_SNG_ABI_DYNAMIC = parseAbi([
  "function last_price(uint256) view returns (uint256)",
  "function stored_rates() view returns (uint256[])",
]);

async function test() {
  const rpcUrl = process.env.ENVIO_RPC_URL_1 || process.env.RPC_URL;
  if (!rpcUrl) {
    console.error("No RPC URL found");
    return;
  }

  const publicClient = createPublicClient({
    chain: {
      id: 1,
      name: "Ethereum",
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
    transport: http(rpcUrl, { batch: true }),
  });

  const poolAddress = "0x0e2e7e5692074f406fa4037c8c8c1ace4b6ece32" as `0x${string}`;
  const blockNumber = BigInt(22969697);

  console.log("Testing with uint256[2] (fixed array)...");
  try {
    const result1 = await publicClient.readContract({
      address: poolAddress,
      abi: CURVE_POOL_SNG_ABI,
      functionName: "stored_rates",
      blockNumber: blockNumber,
    });
    console.log("Result type:", typeof result1);
    console.log("Result:", result1);
    console.log("Is array:", Array.isArray(result1));
    if (Array.isArray(result1)) {
      console.log("Length:", result1.length);
      result1.forEach((val, i) => {
        console.log(`  [${i}]:`, val, typeof val, val.toString());
      });
    }
  } catch (error) {
    console.error("Error with uint256[2]:", error);
  }

  console.log("\nTesting with uint256[] (dynamic array)...");
  try {
    const result2 = await publicClient.readContract({
      address: poolAddress,
      abi: CURVE_POOL_SNG_ABI_DYNAMIC,
      functionName: "stored_rates",
      blockNumber: blockNumber,
    });
    console.log("Result type:", typeof result2);
    console.log("Result:", result2);
    console.log("Is array:", Array.isArray(result2));
    if (Array.isArray(result2)) {
      console.log("Length:", result2.length);
      result2.forEach((val, i) => {
        console.log(`  [${i}]:`, val, typeof val, val.toString());
      });
    }
  } catch (error) {
    console.error("Error with uint256[]:", error);
  }
}

test().catch(console.error);
