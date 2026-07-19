import test from "node:test";
import assert from "node:assert/strict";
import { creators, products } from "../data/sample-data.js";
import { rankCreators } from "../src/matcher.js";

test("sample data contains only clearly marked synthetic creators", () => {
  assert.equal(creators.length, 18);
  for (const creator of creators) {
    assert.equal(String(creator.is_synthetic).toLowerCase(), "true");
    assert.match(creator.handle, /_demo$/);
    assert.ok(creator.creator_id);
    assert.ok(creator.evidence_summary);
  }
});

test("official product names have local assets and demo source notes", () => {
  assert.deepEqual(products.map((product) => product.name), [
    "Insta360 X5",
    "Insta360 Ace Pro 2",
    "Insta360 GO Ultra",
  ]);
  for (const product of products) {
    assert.equal(product.brand, "Insta360");
    assert.ok(product.model);
    assert.match(product.asset, /^\.\.\/assets\/insta360\//);
    assert.match(product.asset_type, /^(cutout|scene)$/);
    assert.match(product.asset_position, /^\d+% \d+%$/);
    assert.match(product.source_note, /MVP/);
  }
});

test("every product scenario can be ranked without an exception", () => {
  for (const product of products) {
    for (const scenario of product.scenarios) {
      const result = rankCreators(creators, {
        market: product.markets[0],
        scenario,
        goal: "conversion",
        budgetPerCreator: 4000,
      }, product);
      assert.equal(result.ranked.length + result.excluded.length, creators.length);
      result.ranked.forEach((item, index) => assert.equal(item.rank, index + 1));
    }
  }
});
