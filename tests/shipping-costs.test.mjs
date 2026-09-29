import assert from "node:assert/strict";
import { test } from "node:test";
import { parseShippingCosts, totalShippingCosts } from "../app/pengiriman/shipping-costs.ts";

test("optional shipment costs total into one invoice ongkir", () => {
  const form = new FormData();
  form.set("handlingCost", "12500");
  form.set("airShippingCost", "75000");
  form.set("seaShippingCost", "");
  form.set("landShippingCost", "32000");
  form.set("maximShippingCost", "15000");
  form.set("otherShippingCost", "5000");

  const costs = parseShippingCosts(form);
  assert.equal(costs.seaShippingCost, 0);
  assert.equal(totalShippingCosts(costs), 139500);
});

test("shipment costs may all be empty and reject invalid amounts", () => {
  assert.equal(totalShippingCosts(parseShippingCosts(new FormData())), 0);
  const form = new FormData();
  form.set("landShippingCost", "-1");
  assert.throws(() => parseShippingCosts(form), /Ongkir darat/);
  form.set("landShippingCost", "1.5");
  assert.throws(() => parseShippingCosts(form), /Ongkir darat/);
});
