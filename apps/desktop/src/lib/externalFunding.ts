const structureKeys = ["version", "cell_deps", "header_deps", "inputs", "outputs", "outputs_data"] as const;

export type FundingTxStructureReport = {
  unchanged: boolean;
  changedKeys: string[];
  unsignedFingerprint: string;
  signedFingerprint: string;
};

export function fundingTxStructureFingerprint(tx: unknown): string {
  if (!isRecord(tx)) {
    return "";
  }

  const structure = Object.fromEntries(structureKeys.map((key) => [key, tx[key] ?? null]));
  return stableStringify(structure);
}

export function compareFundingTxStructure(unsignedTx: unknown, signedTx: unknown): FundingTxStructureReport {
  const changedKeys = structureKeys.filter((key) => {
    const unsignedValue = isRecord(unsignedTx) ? unsignedTx[key] ?? null : null;
    const signedValue = isRecord(signedTx) ? signedTx[key] ?? null : null;
    return stableStringify(unsignedValue) !== stableStringify(signedValue);
  });

  return {
    unchanged: changedKeys.length === 0,
    changedKeys,
    unsignedFingerprint: fundingTxStructureFingerprint(unsignedTx),
    signedFingerprint: fundingTxStructureFingerprint(signedTx),
  };
}

export function parseJsonObject(input: string): Record<string, unknown> {
  const parsed = JSON.parse(input);
  if (!isRecord(parsed)) {
    throw new Error("Expected a JSON object");
  }

  return parsed;
}

export function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
