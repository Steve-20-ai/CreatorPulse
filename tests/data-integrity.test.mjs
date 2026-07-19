import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { creators, products } from "../data/sample-data.js";
import { rankCreators } from "../src/matcher.js";

test("sample data contains only clearly marked synthetic creators", () => {
  assert.equal(creators.length, 30);
  for (const creator of creators) {
    assert.equal(String(creator.is_synthetic).toLowerCase(), "true");
    assert.match(creator.handle, /_demo$/);
    assert.ok(creator.creator_id);
    assert.ok(creator.evidence_summary);
  }
  const csvRows = readFileSync(new URL("../data/creators.csv", import.meta.url), "utf8").trim().split(/\r?\n/);
  assert.equal(csvRows.length, creators.length + 1, "CSV and JavaScript fixtures should stay aligned");
});

test("China market uses synthetic localized platform coverage", () => {
  const chinaCreators = creators.filter((creator) => creator.audience_primary_market === "CN");
  assert.equal(chinaCreators.length, 12);
  assert.deepEqual([...new Set(chinaCreators.map((creator) => creator.platform))].sort(), [
    "Bilibili", "Douyin", "Xiaohongshu",
  ]);
  assert.deepEqual(
    Object.fromEntries([...new Set(chinaCreators.map((creator) => creator.platform))]
      .sort()
      .map((platform) => [platform, chinaCreators.filter((creator) => creator.platform === platform).length])),
    { Bilibili: 4, Douyin: 4, Xiaohongshu: 4 },
  );
  for (const creator of chinaCreators) {
    assert.equal(creator.country, "CN");
    assert.equal(creator.language, "zh");
    assert.match(creator.handle, /_demo$/);
  }
});

test("official product names have local assets and demo source notes", () => {
  assert.deepEqual(products.map((product) => product.name), [
    "Insta360 X5",
    "Insta360 Ace Pro 2",
    "Insta360 GO Ultra",
  ]);
  for (const product of products) {
    assert.ok(product.markets.includes("CN"));
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

test("every product scenario has a China-market recommendation", () => {
  for (const product of products) {
    for (const scenario of product.scenarios) {
      const result = rankCreators(creators, {
        market: "CN",
        scenario,
        goal: "conversion",
        budgetPerCreator: 4000,
      }, product);
      assert.ok(result.ranked.length > 0);
      assert.ok(result.ranked.every((item) => item.creator.audience_primary_market === "CN"));
      assert.ok(result.excluded.some((item) => item.reasons.includes("主要受众市场不匹配")));
    }
  }
});
