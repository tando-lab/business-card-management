type PagesFunction<Env = unknown, Params extends string = string, Data extends Record<string, unknown> = Record<string, unknown>> = (
  context: EventContext<Env, Params, Data>
) => Response | Promise<Response>;

interface EventContext<Env = unknown, Params extends string = string, Data extends Record<string, unknown> = Record<string, unknown>> {
  request: Request;
  env: Env;
  params: Record<Params, string>;
  data: Data;
  functionPath: string;
  waitUntil(promise: Promise<unknown>): void;
  next(input?: Request | string, init?: RequestInit): Promise<Response>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<D1ExecResult>;
  dump(): Promise<ArrayBuffer>;
}

interface D1PreparedStatement {
  bind(...values: Array<string | number | null | ArrayBuffer | Uint8Array>): D1PreparedStatement;
  first<T = Record<string, unknown>>(columnName?: string): Promise<T | null>;
  run<T = unknown>(): Promise<D1Result<T>>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  raw<T = unknown>(): Promise<T[]>;
}

interface D1Result<T = unknown> {
  results?: T[];
  success: boolean;
  meta: Record<string, unknown>;
  error?: string;
}

interface D1ExecResult {
  count: number;
  duration: number;
}

interface R2Bucket {
  get(key: string): Promise<R2ObjectBody | null>;
  put(key: string, value: ReadableStream | ArrayBuffer | ArrayBufferView | string | Blob | null, options?: R2PutOptions): Promise<R2Object>;
  delete(key: string | string[]): Promise<void>;
}

interface R2PutOptions {
  httpMetadata?: {
    contentType?: string;
  };
  customMetadata?: Record<string, string>;
}

interface R2Object {
  key: string;
  version: string;
  size: number;
  etag: string;
  httpEtag: string;
  uploaded: Date;
  writeHttpMetadata(headers: Headers): void;
}

interface R2ObjectBody extends R2Object {
  body: ReadableStream;
  bodyUsed: boolean;
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
  json<T = unknown>(): Promise<T>;
  blob(): Promise<Blob>;
}
