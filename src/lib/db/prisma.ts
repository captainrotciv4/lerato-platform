import { PrismaClient } from "@prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";

declare global {
  // eslint-disable-next-line no-var
  var __prisma_v3: PrismaClient | undefined;
}

function isNeonTimeout(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as Record<string, unknown>;
  // Catch any Neon connection failure by message (covers "fetch failed", cold-start, etc.)
  const msg = typeof e["message"] === "string" ? e["message"] : "";
  if (msg.includes("fetch failed") || msg.includes("Error connecting to database")) return true;
  // Also check error code in the cause chain
  const cause = e["sourceError"] as Record<string, unknown> | undefined;
  const root = (cause?.["cause"] ?? e["cause"]) as Record<string, unknown> | undefined;
  const code = typeof root?.["code"] === "string" ? root["code"] : "";
  return code === "ETIMEDOUT" || code === "ECONNRESET" || code === "ECONNREFUSED";
}

export async function dbRetry<T>(fn: () => Promise<T>, attempts = 6): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === attempts - 1 || !isNeonTimeout(err)) throw err;
      // Exponential backoff: 1s, 2s, 4s, 8s, 16s — recovers fast when almost warm
      const delay = Math.min(1000 * Math.pow(2, i), 16000);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error("unreachable");
}

function createClient(): PrismaClient {
  // PrismaNeonHttp uses pure HTTP — no WebSocket, no persistent connections,
  // immune to Neon's idle-connection timeouts and cold-start ErrorEvent failures.
  const adapter = new PrismaNeonHttp(process.env.DATABASE_URL as string, {});
  const client = new PrismaClient({ adapter });

  // PrismaNeonHttp does not support interactive transactions.
  // Patch $transaction so existing action code runs sequentially without
  // needing a rewrite. No rollback on failure — acceptable for this app.
  // Also wraps with dbRetry so Neon cold-starts don't break form submissions.
  const patched = new Proxy(client, {
    get(target, prop) {
      if (prop === "$transaction") {
        return (fnOrQueries: unknown, _opts?: unknown) => {
          if (typeof fnOrQueries === "function") {
            return dbRetry(() =>
              (fnOrQueries as (tx: PrismaClient) => Promise<unknown>)(target)
            );
          }
          return dbRetry(() => Promise.all(fnOrQueries as Promise<unknown>[]));
        };
      }
      return (target as unknown as Record<string | symbol, unknown>)[prop];
    },
  }) as PrismaClient;

  return patched;
}

// In development, always recreate so proxy changes take effect after HMR.
// PrismaNeonHttp is stateless HTTP — no persistent connection to lose.
export const prisma =
  process.env.NODE_ENV === "production"
    ? (global.__prisma_v3 ?? (global.__prisma_v3 = createClient()))
    : createClient();
