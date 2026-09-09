// Shared Cloudflare D1 typings.
//
// These were previously redeclared, identically, in 16+ separate files across
// src/. Every Worker module that talks to D1 should import from here instead
// of re-typing the same three interfaces.

export interface D1Result<T> {
  results: T[];
}

export interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run(): Promise<unknown>;
}

export interface D1Database {
  prepare(query: string): D1Statement;
  batch(statements: D1Statement[]): Promise<unknown[]>;
}
