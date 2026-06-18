import test from "node:test";
import assert from "node:assert/strict";

const {
  PERMISSIONS,
  permissionsForRole,
  roleDefinitions,
} = await import("./user.roles.js");

test("support defaults do not include audit.read", () => {
  assert.equal(permissionsForRole("support").includes("audit.read"), false);

  const supportRole = roleDefinitions().find((role) => role.id === "support");
  assert.ok(supportRole);
  assert.equal(supportRole.permissions.includes("audit.read"), false);
});

test("audit.read remains globally available and admin-defaulted", () => {
  assert.ok(PERMISSIONS.some((permission) => permission.id === "audit.read"));
  assert.ok(permissionsForRole("admin").includes("audit.read"));
});
