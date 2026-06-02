export type BiscuitInspectReport = {
  public_key: string;
  source: string;
  block_count: number;
  revocation_ids: string[];
};

const mobilePairingStatements = [
  'read("node");',
  'read("peers");',
  'read("channels");',
  'read("payments");',
  'write("invoices");',
];

export function expectedMobilePairingBiscuitSource(expiryRfc3339: string): string {
  const expiry = expiryRfc3339.trim();

  return `${mobilePairingStatements.join("\n")}\ncheck if time($time), $time <= ${expiry};`;
}

export function assertMobilePairingBiscuit(report: BiscuitInspectReport, expiryRfc3339: string): void {
  const actual = normalizeBiscuitSource(report.source);
  const expected = normalizeBiscuitSource(expectedMobilePairingBiscuitSource(expiryRfc3339));

  if (report.block_count !== 1) {
    throw new Error("Mobile pairing token must contain exactly one authority block");
  }

  if (actual !== expected) {
    throw new Error("Mobile pairing token scope does not match the required limited template");
  }
}

function normalizeBiscuitSource(source: string): string {
  return source
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}
