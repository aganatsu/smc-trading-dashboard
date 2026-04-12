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
 * Ensures the owner user exists in the database and returns it.
 * This is used as a fallback when no auth cookie is present,
 * making the app work without login for single-user mode.
 */
let cachedOwnerUser: User | null = null;

async function getOrCreateOwnerUser(): Promise<User | null> {
  if (cachedOwnerUser) return cachedOwnerUser;

  const ownerOpenId = ENV.ownerOpenId;
  if (!ownerOpenId) return null;

  try {
    // Ensure the owner user exists
    await upsertUser({
      openId: ownerOpenId,
      name: "Owner",
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

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
