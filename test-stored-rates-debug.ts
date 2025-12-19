import { createPublicClient, http } from "viem";
import * as dotenv from "dotenv";
dotenv.config();

// Import the actual ABI from the JSON file
import CURVE_POOL_SNG_ABI_JSON from "./abis/CurvePoolSNG.json";

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

  console.log("Testing with full ABI from JSON file...");
  try {
    const result = await publicClient.readContract({
      address: poolAddress,
      abi: CURVE_POOL_SNG_ABI_JSON as any,
      functionName: "stored_rates",
      args: [],
      blockNumber: blockNumber,
    });
    
    console.log("Result type:", typeof result);
    console.log("Result:", result);
    console.log("Is array:", Array.isArray(result));
    if (Array.isArray(result)) {
      console.log("Length:", result.length);
      result.forEach((val: any, i: number) => {
        console.log(`  [${i}]:`, val, typeof val, val.toString());
        if (typeof val === 'bigint') {
          console.log(`    BigInt value: ${val.toString()}`);
        }
      });
    } else {
      console.log("Result is not an array!");
      if (result && typeof result === 'object') {
        console.log("Keys:", Object.keys(result as object));
      }
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

test().catch(console.error);

