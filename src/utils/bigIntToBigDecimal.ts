// Reference: spectra-subgraph-master/src/utils/bigIntToBigDecimal.ts

import { BigDecimal } from "generated";

export function bigIntToBigDecimal(
    quantity: bigint,
    decimals: number = 18
): BigDecimal {
    // Calculate 10^decimals
    let divisor = BigInt(1);
    for (let i = 0; i < decimals; i++) {
        divisor = divisor * BigInt(10);
    }
    return new BigDecimal(quantity.toString()).div(new BigDecimal(divisor.toString()));
}
