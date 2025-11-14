// Reference: spectra-subgraph-master/src/utils/bigDecimalToBigInt.ts

import { BigDecimal } from "generated";

export function bigDecimalToBigInt(value: BigDecimal): bigint {
    const integer = value.toString().split(".")[0];
    return BigInt(integer);
}
