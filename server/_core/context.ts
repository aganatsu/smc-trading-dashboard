import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { ENV } from "./env";
import { getUserByOpenId, upsertUser } from "../db";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

/**
 * Determines if we're running in standalone/local mode.
 * Standalone mode is active when:
 * - STANDALONE_MODE env is explicitly set to 'true', OR
 * - OAUTH_SERVER_URL is not configured (no auth server available)
 */
function isStandaloneMode(): boolean {
  if (process.env.STANDALONE_MODE === 'true') return true;
  if (!ENV.oAuthServerUrl) return true;
  return false;
}

/**
 * Ensures a local owner user exists in the database and returns it.
 * Used in standalone mode (Electron / local dev without OAuth).
 * Creates a default "local-owner" user if OWNER_OPEN_ID is not set.
 */
let cachedOwnerUser: User | null = null;

async function getOrCreateOwnerUser(): Promise<User | null> {
  if (cachedOwnerUser) return cachedOwnerUser;

  // Use OWNER_OPEN_ID if available, otherwise create a default local owner
  const ownerOpenId = ENV.ownerOpenId || "local-owner";

  try {
    // Ensure the owner user exists
    await upsertUser({
      openId: ownerOpenId,
      name: ENV.ownerOpenId ? "Owner" : "Local User",
      role: "admin",
      lastSignedIn: new Date(),
    });

    const user = await getUserByOpenId(ownerOpenId);
    if (user) {
      cachedOwnerUser = user;
    }
    return user ?? null;
  } catch (error) {
    console.warn("[Context] Failed to get/create owner user:", error);
    return null;
  }
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  // In standalone mode (Electron or local without OAuth), skip OAuth entirely — always use owner
  if (isStandaloneMode()) {
    user = await getOrCreateOwnerUser();
  } else {
    try {
      user = await sdk.authenticateRequest(opts.req);
    } catch (error) {
      // Authentication failed — fall back to owner user for single-user mode
      user = null;
    }

    // If no authenticated user, use the owner as default (single-user mode)
    if (!user) {
      user = await getOrCreateOwnerUser();
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
