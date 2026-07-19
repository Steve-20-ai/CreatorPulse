import test from "node:test";
import assert from "node:assert/strict";
import { buildLocalizedBrief, rankCreators, scoreCreator } from "../src/matcher.js";

const product = {
  product_id: "ace-pro-2",
  name: "Insta360 Ace Pro 2",
  scenarios: ["night-cycling", "mountain-biking", "skiing"],
};

const campaign = {
  market: "DE",
  language: "de",
  scenario: "night-cycling",
  goal: "conversion",
  budgetPerCreator: 1800,
};

const baseCreator = {
  creator_id: "TEST-1",
  handle: "@test_demo",
  display_name: "Test Creator",
  platform: "YouTube",
  country: "DE",
  language: "de",
  audience_primary_market: "DE",
  audience_market_share: "0.60",
  primary_scenario: "night-cycling",
  secondary_scenarios: "urban-cycling|technology",
  content_style: "evidence-led-review",
  follower_count: "100000",
  avg_views: "80000",
  engagement_rate: "0.08",
  completion_rate: "0.64",
  click_rate: "0.05",
  conversion_rate: "0.025",
  rate_usd: "1400",
  delivery_reliability: "0.96",
  brand_safety: "0.98",
  content_quality: "0.93",
  evidence_summary: "Synthetic test evidence",
  is_synthetic: "true",
};

test("exact scenario and market match receives a strong score", () => {
  const result = scoreCreator(baseCreator, campaign, product);
  assert.ok(result.score >= 75);
  assert.equal(result.components.sceneFit, 1);
  assert.ok(result.confidence < 90, "synthetic data should cap confidence");
  assert.ok(result.evidence.length >= 3);
});

test("ranking excludes creators above budget and preserves the reason", () => {
  const expensive = { ...baseCreator, creator_id: "TEST-2", rate_usd: "2600" };
  const output = rankCreators([baseCreator, expensive], campaign, product);
  assert.equal(output.ranked.length, 1);
  assert.equal(output.excluded.length, 1);
  assert.match(output.excluded[0].reasons.join(" "), /预算/);
});

test("ranking prefers the exact scene match", () => {
  const adjacent = {
    ...baseCreator,
    creator_id: "TEST-3",
    primary_scenario: "skiing",
    secondary_scenarios: "hiking",
  };
  const output = rankCreators([adjacent, baseCreator], campaign, product);
  assert.equal(output.ranked[0].creator.creator_id, "TEST-1");
});

test("China market defaults to local-first candidates", () => {
  const chinaCreator = {
    ...baseCreator,
    creator_id: "TEST-CN",
    country: "CN",
    language: "zh",
    audience_primary_market: "CN",
  };
  const chinaCampaign = { ...campaign, market: "CN", language: "zh" };
  const localFirst = rankCreators([baseCreator, chinaCreator], chinaCampaign, product);
  assert.deepEqual(localFirst.ranked.map((item) => item.creator.creator_id), ["TEST-CN"]);
  assert.match(localFirst.excluded[0].reasons.join(" "), /主要受众市场不匹配/);

  const crossMarket = rankCreators(
    [baseCreator, chinaCreator],
    chinaCampaign,
    product,
    { requireMarketMatch: false },
  );
  assert.equal(crossMarket.ranked.length, 2, "audited cross-market experiments can opt in explicitly");
});

test("localized brief uses the target market language", () => {
  const result = scoreCreator(baseCreator, campaign, product);
  const brief = buildLocalizedBrief(result, campaign, product);
  assert.equal(brief.locale, "de");
  assert.match(brief.hook, /Nachtfahrt/);
  assert.equal(brief.shotPlan.length, 3);
});

test("China market produces a Chinese brief and localized compliance note", () => {
  const chinaCreator = {
    ...baseCreator,
    creator_id: "TEST-CN",
    country: "CN",
    language: "zh",
    audience_primary_market: "CN",
    primary_scenario: "hiking",
  };
  const chinaCampaign = {
    ...campaign,
    market: "CN",
    language: "zh",
    scenario: "hiking",
  };
  const chinaProduct = { ...product, name: "Insta360 X5", scenarios: ["hiking", "travel"] };
  const result = scoreCreator(chinaCreator, chinaCampaign, chinaProduct);
  const brief = buildLocalizedBrief(result, chinaCampaign, chinaProduct);
  assert.equal(brief.locale, "zh");
  assert.match(brief.hook, /山野|视角/);
  assert.match(brief.complianceNote, /个人信息授权|平台规则/);
});
