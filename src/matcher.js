export const DEFAULT_WEIGHTS = Object.freeze({
  sceneFit: 0.28,
  audienceFit: 0.22,
  contentQuality: 0.14,
  engagementQuality: 0.10,
  conversionPotential: 0.12,
  costEfficiency: 0.06,
  reliabilitySafety: 0.08,
});

const REASON_LABELS = Object.freeze({
  sceneFit: "场景图谱匹配",
  audienceFit: "受众市场匹配",
  contentQuality: "内容质量",
  engagementQuality: "互动质量",
  conversionPotential: "转化潜力",
  costEfficiency: "成本效率",
  reliabilitySafety: "履约与品牌安全",
});

const MARKET_LANGUAGE = Object.freeze({
  DE: "de",
  JP: "ja",
  US: "en",
  GB: "en",
  AU: "en",
  CA: "en",
  FR: "fr",
  ES: "es",
  KR: "ko",
});

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const numberOrNull = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export function splitTags(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return String(value ?? "")
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function normalizeCreator(raw) {
  return {
    ...raw,
    secondary_scenarios: splitTags(raw.secondary_scenarios),
    follower_count: numberOrNull(raw.follower_count),
    avg_views: numberOrNull(raw.avg_views),
    audience_market_share: numberOrNull(raw.audience_market_share),
    engagement_rate: numberOrNull(raw.engagement_rate),
    completion_rate: numberOrNull(raw.completion_rate),
    click_rate: numberOrNull(raw.click_rate),
    conversion_rate: numberOrNull(raw.conversion_rate),
    rate_usd: numberOrNull(raw.rate_usd),
    delivery_reliability: numberOrNull(raw.delivery_reliability),
    brand_safety: numberOrNull(raw.brand_safety),
    content_quality: numberOrNull(raw.content_quality),
    is_synthetic: String(raw.is_synthetic).toLowerCase() === "true",
  };
}

function getSceneFit(creator, campaign, product) {
  const desired = campaign.scenario;
  const creatorScenes = new Set([creator.primary_scenario, ...creator.secondary_scenarios]);
  if (creator.primary_scenario === desired) return 1;
  if (creator.secondary_scenarios.includes(desired)) return 0.84;

  const productScenes = new Set(product.scenarios ?? []);
  const sharedProductScenes = [...creatorScenes].filter((scene) => productScenes.has(scene));
  if (sharedProductScenes.length >= 2) return 0.68;
  if (sharedProductScenes.length === 1) return 0.52;
  return 0.18;
}

function getAudienceFit(creator, campaign) {
  const marketMatch = creator.audience_primary_market === campaign.market ? 1 : 0.35;
  const languageMatch = creator.language === (campaign.language ?? MARKET_LANGUAGE[campaign.market]) ? 1 : 0.55;
  const marketShare = creator.audience_market_share ?? 0;
  return clamp(marketMatch * 0.42 + languageMatch * 0.18 + marketShare * 0.40);
}

function getEngagementQuality(creator) {
  const engagement = clamp((creator.engagement_rate ?? 0) / 0.12);
  const completion = clamp(creator.completion_rate ?? 0);
  return engagement * 0.45 + completion * 0.55;
}

function getConversionPotential(creator) {
  const clicks = clamp((creator.click_rate ?? 0) / 0.08);
  const conversions = clamp((creator.conversion_rate ?? 0) / 0.04);
  return clicks * 0.55 + conversions * 0.45;
}

function getCostEfficiency(creator) {
  if (!creator.rate_usd || !creator.avg_views) return 0;
  const viewsPerDollar = creator.avg_views / creator.rate_usd;
  return clamp(viewsPerDollar / 180);
}

function getReliabilitySafety(creator) {
  return clamp(((creator.delivery_reliability ?? 0) + (creator.brand_safety ?? 0)) / 2);
}

function getConfidence(creator) {
  const required = [
    creator.audience_market_share,
    creator.engagement_rate,
    creator.completion_rate,
    creator.click_rate,
    creator.conversion_rate,
    creator.rate_usd,
    creator.delivery_reliability,
    creator.brand_safety,
    creator.content_quality,
  ];
  const completeness = required.filter((value) => value !== null && value !== undefined).length / required.length;
  const sourcePenalty = creator.is_synthetic ? 15 : 0;
  return Math.round(clamp(0.60 + completeness * 0.35 - sourcePenalty / 100, 0, 0.95) * 100);
}

function getDataGaps(creator) {
  const gaps = [];
  if (creator.click_rate === null) gaps.push("缺少历史点击率");
  if (creator.conversion_rate === null) gaps.push("缺少历史转化率");
  if (creator.rate_usd === null) gaps.push("缺少可比报价");
  if (creator.is_synthetic) gaps.push("当前为合成演示数据，需以授权数据校准");
  return gaps;
}

function formatPercent(value) {
  return `${Math.round((value ?? 0) * 100)}%`;
}

function buildEvidence(creator, campaign, components) {
  const sceneText = creator.primary_scenario === campaign.scenario
    ? `主场景与 ${campaign.scenario} 完全一致`
    : `内容场景与 ${campaign.scenario} 存在可迁移关联`;

  return [
    {
      type: "scene",
      title: "场景证据",
      text: sceneText,
      strength: components.sceneFit,
    },
    {
      type: "audience",
      title: "受众证据",
      text: `${creator.audience_primary_market} 为第一受众市场，占比 ${formatPercent(creator.audience_market_share)}`,
      strength: components.audienceFit,
    },
    {
      type: "performance",
      title: "表现证据",
      text: `完播 ${formatPercent(creator.completion_rate)}，互动 ${formatPercent(creator.engagement_rate)}，内容质量 ${formatPercent(creator.content_quality)}`,
      strength: (components.contentQuality + components.engagementQuality) / 2,
    },
    {
      type: "source",
      title: "样本摘要",
      text: creator.evidence_summary,
      strength: 0.72,
    },
  ];
}

export function scoreCreator(rawCreator, campaign, product, weights = DEFAULT_WEIGHTS) {
  const creator = normalizeCreator(rawCreator);
  const components = {
    sceneFit: getSceneFit(creator, campaign, product),
    audienceFit: getAudienceFit(creator, campaign),
    contentQuality: clamp(creator.content_quality ?? 0),
    engagementQuality: getEngagementQuality(creator),
    conversionPotential: getConversionPotential(creator),
    costEfficiency: getCostEfficiency(creator),
    reliabilitySafety: getReliabilitySafety(creator),
  };

  const weighted = Object.entries(weights).reduce(
    (total, [key, weight]) => total + components[key] * weight,
    0,
  );
  const riskPenalty = clamp(1 - (creator.brand_safety ?? 0.5)) * 0.08;
  const score = Math.round(clamp(weighted - riskPenalty) * 100);

  const reasons = Object.entries(weights)
    .map(([key, weight]) => ({
      key,
      label: REASON_LABELS[key],
      contribution: components[key] * weight,
      value: components[key],
    }))
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 3);

  return {
    creator,
    score,
    confidence: getConfidence(creator),
    components,
    reasons,
    evidence: buildEvidence(creator, campaign, components),
    dataGaps: getDataGaps(creator),
    projectedViewsPerDollar: creator.rate_usd ? Math.round((creator.avg_views ?? 0) / creator.rate_usd) : null,
  };
}

export function rankCreators(rawCreators, campaign, product, options = {}) {
  const minBrandSafety = options.minBrandSafety ?? 0.78;
  const budgetPerCreator = campaign.budgetPerCreator ?? Number.POSITIVE_INFINITY;
  const ranked = [];
  const excluded = [];

  for (const rawCreator of rawCreators) {
    const result = scoreCreator(rawCreator, campaign, product, options.weights ?? DEFAULT_WEIGHTS);
    const reasons = [];
    if ((result.creator.brand_safety ?? 0) < minBrandSafety) reasons.push("品牌安全评分低于阈值");
    if ((result.creator.rate_usd ?? Number.POSITIVE_INFINITY) > budgetPerCreator) reasons.push("报价超过单达人预算");
    if (result.components.sceneFit < 0.35) reasons.push("与目标场景相关度不足");

    if (reasons.length) excluded.push({ creator: result.creator, reasons });
    else ranked.push(result);
  }

  ranked.sort((a, b) => b.score - a.score || b.confidence - a.confidence);
  return {
    ranked: ranked.map((item, index) => ({ ...item, rank: index + 1 })),
    excluded,
  };
}

const LOCALIZED_HOOKS = Object.freeze({
  de: {
    "night-cycling": "Wie viel von deiner Nachtfahrt bleibt wirklich sichtbar?",
    skiing: "Eine Abfahrt. Jeder Blickwinkel. Kein zweiter Versuch.",
    default: "Zeig die echte Tour — nicht nur den schönsten Ausschnitt.",
  },
  ja: {
    hiking: "歩いた空気まで、一本の映像に残せるだろうか。",
    "family-travel": "撮ることを忘れるほど、自然に残せる旅へ。",
    default: "その瞬間を、見たまま以上に残そう。",
  },
  fr: {
    "solo-travel": "Voyager seul ne veut pas dire choisir un seul angle.",
    default: "Montrez l'expérience complète, pas seulement un extrait.",
  },
  en: {
    "mountain-biking": "One trail. Every line. No second take.",
    diving: "Bring the whole dive back — not just a narrow frame.",
    default: "Show the full experience, not just the highlight.",
  },
  ko: {
    default: "하나의 순간을 더 자유로운 시선으로 기록해 보세요.",
  },
  es: {
    default: "Cuenta la aventura completa, no solo un encuadre.",
  },
});

export function buildLocalizedBrief(scoredCreator, campaign, product) {
  const creator = scoredCreator.creator ?? scoredCreator;
  const locale = MARKET_LANGUAGE[campaign.market] ?? creator.language ?? "en";
  const hooks = LOCALIZED_HOOKS[locale] ?? LOCALIZED_HOOKS.en;
  const hook = hooks[campaign.scenario] ?? hooks.default ?? LOCALIZED_HOOKS.en.default;

  return {
    locale,
    hook,
    angle: `${product.name} × ${campaign.scenario} × ${creator.content_style}`,
    shotPlan: [
      `开场 0–3 秒：以 ${campaign.scenario} 的真实问题建立冲突`,
      `中段：保留 ${creator.content_style} 的原有叙事节奏，展示实际使用过程`,
      `结尾：回到 ${campaign.goal} 目标，以可追踪 CTA 收束`,
    ],
    complianceNote: "发布前由当地运营核对产品表述、文化语境、音乐与素材版权。",
  };
}

