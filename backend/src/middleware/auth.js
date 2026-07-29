import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { Shop } from "../models/Shop.js";
import { User } from "../models/User.js";
import { seedRepository } from "../repositories/seedRepository.js";

export function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required." });
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, env.jwtSecret);
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token." });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Authentication required." });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions." });
    }
    next();
  };
}

export function requirePermission(...permissions) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Authentication required." });
    if (req.user.role === "admin") return next();
    const userPermissions = new Set(req.user.permissions || []);
    const allowed = permissions.every((permission) => userPermissions.has(permission));
    if (!allowed) return res.status(403).json({ error: "Insufficient permissions." });
    next();
  };
}

export function optionalAuth(req, _res, next) {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    try {
      req.user = jwt.verify(header.slice(7), env.jwtSecret);
    } catch {
      // silent — unauthenticated requests are allowed
    }
  }
  next();
}

/**
 * A JWT's `shopId` claim is only ever as trustworthy as whatever produced
 * it, and can go stale if ownership is ever reassigned or recorded
 * inconsistently after the token was issued. Every seller-scoped route
 * needs the shop that's actually, currently, database-recorded as owned
 * by this authenticated user -- never a bare claim-equality check, and
 * never anything read from client-supplied input (query/body shopId is
 * never consulted here for the seller role).
 *
 * Resolution order:
 *   1. Re-read the persisted seller User (Mongo mode only -- seed mode has
 *      no separate User store to drift from the token, so the JWT claim
 *      already IS the current value there) to get its current `shopId`,
 *      falling back to the JWT's own `shopId` claim if that lookup is
 *      unavailable.
 *   2. Try to resolve that shopId to a Shop, and accept it only if the
 *      Shop's own `ownerId` actually matches this authenticated user.
 *   3. If that fails for any reason (missing shopId, shop doesn't exist,
 *      shopId points at a shop this user doesn't actually own), fall back
 *      to the reverse lookup: find whichever Shop is recorded with
 *      `ownerId` equal to this user. This is what lets a seller through
 *      safely when User.shopId/the JWT claim is missing or stale, as long
 *      as a real owned Shop still exists -- rather than hard-failing on a
 *      data inconsistency that isn't actually an ownership problem.
 *   4. Only return 403 if neither path resolves an owned Shop.
 *
 * Admins are untouched (they legitimately act across all shops via a
 * request-supplied shopId, handled by each route). Attach after
 * `authenticate`/`requireRole` and before the route handler on every
 * seller-scoped route.
 *
 * Deliberate scope decision: this checks OWNERSHIP only, not shop business
 * status. A seller whose shop is Suspended/Terminated/Pending review still
 * passes this gate (they legitimately own the shop) so they can see their
 * own suspension notice, contract status, etc. -- routes that must also
 * block on shop status (e.g. product publication) enforce that separately
 * and should keep doing so; this middleware is not the place for it.
 *
 * On success, the resolved shop is attached as `req.ownedShop` (and its id
 * as `req.ownedShopId`) so downstream handlers/services read the
 * database-verified value instead of continuing to trust the raw JWT claim
 * -- `req.user.shopId` should be treated as unverified input everywhere
 * after this middleware runs, not as an authoritative identifier.
 */
export async function requireOwnedShop(req, res, next) {
  if (req.user?.role !== "seller") return next();

  const userId = req.user?.sub != null ? String(req.user.sub) : "";
  if (!userId) {
    return res.status(403).json({ error: "Shop ownership could not be verified." });
  }

  try {
    async function loadShopById(id) {
      if (!id) return null;
      return env.mongoUri ? Shop.findOne({ id }).lean() : seedRepository.getShop(id);
    }

    function isOwnedByUser(shop) {
      // ownerId may be a Mongo ObjectId (Mongo mode) or a plain string
      // (seed mode) -- normalize both sides to strings rather than relying
      // on ===, which would fail ObjectId-vs-ObjectId comparisons of equal
      // value and always fail ObjectId-vs-string ones.
      return Boolean(shop) && String(shop.ownerId || "") === userId;
    }

    let claimedShopId = req.user.shopId || null;
    if (env.mongoUri) {
      const user = await User.findById(userId).select("shopId").lean().catch(() => null);
      if (user?.shopId) claimedShopId = user.shopId;
    }

    let shop = await loadShopById(claimedShopId);
    if (!isOwnedByUser(shop)) {
      shop = env.mongoUri
        ? await Shop.findOne({ ownerId: userId }).lean().catch(() => null)
        : seedRepository.getState().shops.find((s) => String(s.ownerId || "") === userId) || null;
    }

    if (!isOwnedByUser(shop)) {
      return res.status(403).json({ error: "Shop ownership could not be verified." });
    }

    req.ownedShop = shop;
    req.ownedShopId = shop.id;
    next();
  } catch (err) {
    next(err);
  }
}
