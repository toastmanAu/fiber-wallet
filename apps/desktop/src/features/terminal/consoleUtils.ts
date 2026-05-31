export function parseRpcParams(input: string): unknown[] {
  const trimmed = input.trim();

  if (!trimmed) {
    return [];
  }

  const parsed = JSON.parse(trimmed) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error("Params must be a JSON array");
  }

  return parsed;
}

export function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

