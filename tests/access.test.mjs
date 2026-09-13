import assert from "node:assert/strict";
import test from "node:test";
import { canAccessRestrictedMenus } from "../app/access.ts";

test("Dashboard and Finance allow superadmins and Guntur", () => {
  assert.equal(canAccessRestrictedMenus({ role: "superadmin", username: "admin-baru" }), true);
  assert.equal(canAccessRestrictedMenus({ role: "user", username: "guntur" }), true);
  assert.equal(canAccessRestrictedMenus({ role: "user", username: "Guntur" }), true);
});

test("Dashboard and Finance deny other users and anonymous visitors", () => {
  for (const username of ["sisi", "egha", "user-baru", "guntur-lain", "superadmin"]) {
    assert.equal(canAccessRestrictedMenus({ role: "user", username }), false);
  }
  assert.equal(canAccessRestrictedMenus(null), false);
});
