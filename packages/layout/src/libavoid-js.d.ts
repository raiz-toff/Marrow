/**
 * libavoid-js@0.5.0-beta.5 ships broken type declarations (its package.json
 * points at a d.ts that does not exist, and the real one omits half the API).
 * This shim types only the surface we use; the wrapper in router.ts keeps the
 * untyped surface contained.
 */
declare module 'libavoid-js' {
  export const AvoidLib: {
    /** Loads the WASM (resolved next to the module in Node). Singleton. */
    load(wasmPath?: string): Promise<void>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getInstance(): any;
  };
}
