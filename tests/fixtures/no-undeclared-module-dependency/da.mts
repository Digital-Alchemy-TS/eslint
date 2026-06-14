// Minimal Digital-Alchemy surface so the fixtures parse and resolve.
export type TServiceParams = Record<string, { [key: string]: unknown } & ((...args: unknown[]) => unknown)>;
export function CreateLibrary(config: unknown): unknown {
  return config;
}
export function CreateApplication(config: unknown): unknown {
  return config;
}
