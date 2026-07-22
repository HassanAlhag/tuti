import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { Shop } from "../models/Shop.js";
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
 * it. Every seller-scoped route currently authorizes by comparing
 * `record.shopId === req.user.shopId` — a bare claim-equality check with
 * no database confirmation that this specific user is the shop's real
 * owner. This middleware closes that gap: it loads the Shop record the
 * claim points at and verifies the shop's own `ownerId` resolves back to
 * the authenticated user before allowing the request through. Admins are
 * untouched (they legitimately act across all shops via a request-supplied
 * shopId, handled by each route). Attach after `authenticate`/`requireRole`
 * and before the route handler on every seller-scoped route.
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

  const shopId = req.user.shopId;
  if (!shopId) {
    return res.status(403).json({ error: "No shop is associated with this account." });
  }

  try {
    const shop = env.mongoUri
      ? await Shop.findOne({ id: shopId }).lean()
      : seedRepository.getShop(shopId);

    if (!shop) {
      return res.status(403).json({ error: "Shop ownership could not be verified." });
    }

    // ownerId may be a Mongo ObjectId (Mongo mode) or a plain string (seed
    // mode) on either side of the comparison -- normalize both to strings
    // rather than relying on ===, which would fail ObjectId-vs-ObjectId
    // comparisons of equal value and always fail ObjectId-vs-string ones.
    const ownerId = shop.ownerId != null ? String(shop.ownerId) : "";
    const userId = req.user.sub != null ? String(req.user.sub) : "";
    if (!ownerId || !userId || ownerId !== userId) {
      return res.status(403).json({ error: "Shop ownership could not be verified." });
    }

    req.ownedShop = shop;
    req.ownedShopId = shop.id;
    next();
  } catch (err) {
    next(err);
  }
}
