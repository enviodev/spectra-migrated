// Reference: spectra-subgraph-master/src/mappings/wrappers.ts

import { SpectraWrapper, ERC20 } from "generated";
import { getSpectraWrapper } from "../entities/SpectraWrapper";
import { getAsset } from "../entities/Asset";
import { isSpectraWrapper } from "../utils/checkSpectraWrapperSymbol";

// AssetType constants (from spectra-subgraph-master/src/utils/AssetType.ts)
const AssetType = {
  WRAPPER: "WRAPPER",
} as const;

// Cache to track addresses we've already checked to avoid redundant RPC calls
// Key format: "chainId-address"
const checkedAddresses = new Set<string>();

// Register dynamic SpectraWrapper as ERC20 to track transfers (matches subgraph's ERC20.create)
// Only register if symbol starts with "sw-" (matches subgraph line 18-20 check before line 40)
SpectraWrapper.AuthorityUpdated.contractRegister(async ({ event, context }) => {
  // Create cache key
  const cacheKey = `${event.chainId}-${event.srcAddress.toLowerCase()}`;
  
  // Skip if we've already checked this address
  if (checkedAddresses.has(cacheKey)) {
    return;
  }
  
  // Mark as checked to avoid redundant RPC calls
  checkedAddresses.add(cacheKey);
  
  // Check if contract symbol starts with "sw-" before registering as ERC20
  // This prevents Factory contracts (which also emit AuthorityUpdated) from being registered as ERC20
  const isWrapper = await isSpectraWrapper(event.srcAddress, event.chainId);
  
  if (isWrapper) {
    // Register as ERC20 to track Transfer events (matches subgraph line 40 in wrappers.ts)
    context.addERC20(event.srcAddress);
  }
});

SpectraWrapper.AuthorityUpdated.handler(async ({ event, context }) => {
  // Reference: spectra-subgraph-master/src/mappings/wrappers.ts handleAuthorityUpdated
  // Check if symbol starts with "sw-" (SpectraWrapper prefix)
  // This check is done via RPC in getSpectraWrapper, but we can skip if wrapper already exists
  const wrapperId = `${event.chainId}-${event.srcAddress}`;
  const existingWrapper = await context.SpectraWrapper.get(wrapperId);
  if (existingWrapper) {
    // Wrapper already exists, skip
    return;
  }

  // Get or create SpectraWrapper entity (this will fetch data via RPC)
  // Note: getSpectraWrapper will check symbol via RPC, but we create it here
  // The original subgraph checks symbol before creating, but we create and let it fail if needed
  const wrapper = await getSpectraWrapper(
    event.srcAddress,
    BigInt(event.block.timestamp),
    event.block.number,
    event.chainId,
    context
  );

  // Check if symbol starts with "sw-" (done in getSpectraWrapper via RPC)
  // If symbol doesn't start with "sw-", the wrapper won't be created properly
  if (!wrapper.symbol.startsWith("sw-")) {
    // Not a SpectraWrapper, skip
    return;
  }

  // Get or create Asset entity for wrapper
  await getAsset(
    event.srcAddress,
    BigInt(event.block.timestamp),
    AssetType.WRAPPER,
    null,
    event.chainId,
    event.block.number,
    context
  );
}, {
  wildcard: true  // Enable wildcard indexing to track ALL SpectraWrapper contracts
});

// Note: SpectraWrapper.Transfer handler is in transfers.ts to avoid duplicate registration

