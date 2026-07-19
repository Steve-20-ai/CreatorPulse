import { buildLocalizedBrief, rankCreators } from "../src/matcher.js";
import { creators, products } from "../data/sample-data.js";

const MARKET_LABELS = {
  DE: "德国 / DE", US: "美国 / US", JP: "日本 / JP", GB: "英国 / GB",
  FR: "法国 / FR", AU: "澳大利亚 / AU", KR: "韩国 / KR",
};

const SCENARIO_LABELS = {
  "night-cycling": "夜骑", "urban-cycling": "城市骑行", "mountain-biking": "山地骑行",
  skiing: "滑雪", snowboarding: "单板滑雪", hiking: "徒步", climbing: "攀登",
  diving: "潜水", surfing: "冲浪", motorcycle: "摩旅", travel: "旅行",
  "solo-travel": "单人旅行", "family-travel": "家庭旅行", "city-travel": "城市旅行",
  "daily-vlog": "日常 Vlog", running: "跑步", vlogging: "视频创作",
};

const LANGUAGE_LABELS = {
  de: "Deutsch", en: "English", ja: "日本語", fr: "Français", ko: "한국어", es: "Español",
};

const state = {
  creators,
  products,
  results: { ranked: [], excluded: [] },
  selectedId: null,
  activeTab: "evidence",
  running: false,
};

const $ = (selector) => document.querySelector(selector);
const elements = {
  form: $("#campaignForm"), product: $("#productSelect"), market: $("#marketSelect"),
  scenario: $("#scenarioSelect"), goal: $("#goalSelect"), budget: $("#budgetInput"),
  budgetOutput: $("#budgetOutput"), run: $("#runButton"), ranking: $("#rankingList"),
  matchCount: $("#matchCount"), excludedCount: $("#excludedCount"), excludedReason: $("#excludedReason"),
  confidence: $("#confidenceValue"), detail: $("#detailContent"), productName: $("#productName"),
  productCategory: $("#productCategory"), productMessage: $("#productMessage"), productImage: $("#productImage"),
  tabs: [...document.querySelectorAll(".tab-button")], tweaksToggle: $("#tweaksToggle"),
  tweaksPanel: $("#tweaksPanel"), density: $("#densitySelect"), contrast: $("#contrastToggle"),
  toast: $("#toast"),
};

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function money(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function compact(value) {
  return new Intl.NumberFormat("zh-CN", { notation: "compact", maximumFractionDigits: 1 }).format(value ?? 0);
}

function percent(value, digits = 0) {
  return `${((value ?? 0) * 100).toFixed(digits)}%`;
}

function selectedProduct() {
  return state.products.find((item) => item.product_id === elements.product.value) ?? state.products[0];
}

function campaign() {
  return {
    market: elements.market.value,
    scenario: elements.scenario.value,
    goal: elements.goal.value,
    budgetPerCreator: Number(elements.budget.value),
  };
}

function fillSelect(select, items, valueOf, labelOf, preferred) {
  select.innerHTML = items.map((item) => `<option value="${escapeHtml(valueOf(item))}">${escapeHtml(labelOf(item))}</option>`).join("");
  if (preferred && items.some((item) => valueOf(item) === preferred)) select.value = preferred;
}

function updateProduct() {
  const product = selectedProduct();
  fillSelect(elements.market, product.markets, (item) => item, (item) => MARKET_LABELS[item] ?? item, "DE");
  fillSelect(elements.scenario, product.scenarios, (item) => item, (item) => SCENARIO_LABELS[item] ?? item, product.scenarios[0]);
  elements.productName.textContent = product.name;
  elements.productCategory.textContent = product.category.replaceAll("-", " ").toUpperCase();
  elements.productMessage.textContent = product.key_message;
  elements.productImage.src = product.asset;
  elements.productImage.alt = `${product.name} 官方产品图`;
}

function updateBudget() {
  const value = Number(elements.budget.value);
  const ratio = ((value - 1000) / 3000) * 100;
  elements.budgetOutput.textContent = money(value);
  elements.budget.style.background = `linear-gradient(90deg, var(--accent) ${ratio}%, var(--line-strong) ${ratio}%)`;
}

function toast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  window.setTimeout(() => elements.toast.classList.remove("is-visible"), 2200);
}

function loading() {
  elements.ranking.innerHTML = `<div class="loading-state"><span></span><span></span><span></span><p>正在重算场景图谱与约束</p></div>`;
}

function summarizeExcluded(excluded) {
  const counts = new Map();
  excluded.forEach((item) => item.reasons.forEach((reason) => counts.set(reason, (counts.get(reason) ?? 0) + 1)));
  return [...counts].map(([reason, count]) => `${reason} ${count}`).join(" · ");
}

function emptyDetail() {
  return `<div class="empty-state"><span>SELECT</span><h3>选择一位达人</h3><p>系统将在这里解释推荐依据、数据缺口和下一步动作。</p></div>`;
}

function renderRanking() {
  const visible = state.results.ranked.slice(0, 7);
  elements.matchCount.textContent = String(state.results.ranked.length);
  elements.excludedCount.textContent = String(state.results.excluded.length);
  elements.excludedReason.textContent = state.results.excluded.length ? summarizeExcluded(state.results.excluded) : "没有候选人被排除";

  if (!visible.length) {
    elements.ranking.innerHTML = `<div class="empty-state"><span>NO MATCH</span><h3>当前约束过窄</h3><p>提高单达人预算或更换场景后再次运行。</p></div>`;
    elements.confidence.textContent = "—";
    elements.detail.innerHTML = emptyDetail();
    return;
  }

  if (!visible.some((item) => item.creator.creator_id === state.selectedId)) state.selectedId = visible[0].creator.creator_id;
  elements.ranking.innerHTML = visible.map((item) => {
    const selected = item.creator.creator_id === state.selectedId;
    return `<button class="creator-card${selected ? " is-selected" : ""}" type="button" data-creator-id="${escapeHtml(item.creator.creator_id)}" aria-pressed="${selected}">
      <span class="rank-number">${String(item.rank).padStart(2, "0")}</span>
      <span class="creator-main"><strong>${escapeHtml(item.creator.display_name)}</strong>
        <span class="creator-meta"><span>${escapeHtml(item.creator.platform)}</span><span>${escapeHtml(item.creator.country)}</span><span>${compact(item.creator.avg_views)} avg.</span></span>
        <span class="reason-line">${escapeHtml(item.reasons[0]?.label ?? "综合匹配")} · ${escapeHtml(SCENARIO_LABELS[item.creator.primary_scenario] ?? item.creator.primary_scenario)}</span>
      </span>
      <span class="score-block"><strong>${item.score}</strong><span>MATCH</span><span class="score-bar"><i style="width:${item.score}%"></i></span></span>
    </button>`;
  }).join("");

  elements.ranking.querySelectorAll("[data-creator-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedId = button.dataset.creatorId;
      renderRanking();
      renderDetail();
    });
  });
  renderDetail();
}

function selectedResult() {
  return state.results.ranked.find((item) => item.creator.creator_id === state.selectedId) ?? null;
}

function renderDetail() {
  const selected = selectedResult();
  if (!selected) {
    elements.confidence.textContent = "—";
    elements.detail.innerHTML = emptyDetail();
    return;
  }
  elements.confidence.textContent = `${selected.confidence}%`;
  if (state.activeTab === "content") renderContent(selected);
  else if (state.activeTab === "attribution") renderAttribution(selected);
  else renderEvidence(selected);
}

function renderEvidence(selected) {
  const creator = selected.creator;
  const reasons = selected.reasons.map((reason) => `<div class="reason-card"><span>${escapeHtml(reason.label)}</span><strong>${Math.round(reason.value * 100)}</strong><div class="mini-bar"><i style="width:${Math.round(reason.value * 100)}%"></i></div></div>`).join("");
  const evidence = selected.evidence.map((item) => `<article class="evidence-card"><div class="evidence-title-row"><strong>${escapeHtml(item.title)}</strong><span>${Math.round(item.strength * 100)} / 100</span></div><p>${escapeHtml(item.text)}</p></article>`).join("");
  const gaps = selected.dataGaps.length ? selected.dataGaps.join("；") : "未检测到关键字段缺口";
  elements.detail.innerHTML = `<div class="creator-profile"><div><h3>${escapeHtml(creator.display_name)}</h3><p>${escapeHtml(creator.handle)} · ${escapeHtml(creator.platform)} · ${escapeHtml(creator.content_style)}</p></div><div class="profile-score"><strong>${selected.score}</strong><span>OVERALL MATCH</span></div></div>
    <div class="reason-grid">${reasons}</div><span class="section-label">Evidence chain</span><div class="evidence-stack">${evidence}</div>
    <span class="section-label">Data gaps</span><div class="gap-card">${escapeHtml(gaps)}</div>`;
}

function renderContent(selected) {
  const brief = buildLocalizedBrief(selected, campaign(), selectedProduct());
  const plan = brief.shotPlan.map((item, index) => `<li><b>${String(index + 1).padStart(2, "0")}</b><span>${escapeHtml(item)}</span></li>`).join("");
  elements.detail.innerHTML = `<div class="brief-output"><div class="brief-hero"><span>LOCALIZED HOOK / ${escapeHtml(brief.locale.toUpperCase())}</span><blockquote>${escapeHtml(brief.hook)}</blockquote></div>
    <div class="brief-body"><div class="brief-meta"><div><span>CREATOR STYLE</span><strong>${escapeHtml(selected.creator.content_style)}</strong></div><div><span>LANGUAGE</span><strong>${escapeHtml(LANGUAGE_LABELS[brief.locale] ?? brief.locale)}</strong></div></div>
    <div><span class="section-label">Creative angle</span><p>${escapeHtml(brief.angle)}</p></div><div><span class="section-label">Shot plan</span><ol class="shot-plan">${plan}</ol></div><div class="compliance-inline">${escapeHtml(brief.complianceNote)}</div></div></div>`;
}

function metricRow(label, value, max, formatted) {
  const width = Math.max(3, Math.min(100, (value / max) * 100));
  return `<div class="metric-row"><span>${escapeHtml(label)}</span><div class="metric-track"><i style="width:${width}%"></i></div><strong>${escapeHtml(formatted)}</strong></div>`;
}

function renderAttribution(selected) {
  const creator = selected.creator;
  const scoreLift = Math.max(0.05, (selected.score - 60) / 100);
  const ctr = (creator.click_rate ?? 0) * (1 + scoreLift * 0.45);
  const cvr = (creator.conversion_rate ?? 0) * (1 + scoreLift * 0.35);
  const clicks = Math.round((creator.avg_views ?? 0) * ctr);
  const orders = Math.max(1, Math.round(clicks * cvr));
  const cpa = (creator.rate_usd ?? 0) / orders;
  elements.detail.innerHTML = `<div class="projection-header"><div><span>ATTRIBUTION PROJECTION</span><h3>${escapeHtml(creator.display_name)}</h3></div><em>模拟验证数据</em></div>
    <div class="projection-grid"><div class="projection-card"><span>预计点击率</span><strong>${percent(ctr, 1)}</strong><small>基于合成历史表现</small></div><div class="projection-card"><span>预计转化率</span><strong>${percent(cvr, 1)}</strong><small>非真实业务承诺</small></div><div class="projection-card"><span>预计订单</span><strong>${orders}</strong><small>单次合作窗口</small></div><div class="projection-card"><span>预计 CPA</span><strong>${money(cpa)}</strong><small>仅用于方案比较</small></div></div>
    <span class="section-label">Funnel signal</span><div class="funnel">${metricRow("曝光", creator.avg_views ?? 0, creator.avg_views ?? 1, compact(creator.avg_views))}${metricRow("点击", clicks, creator.avg_views ?? 1, compact(clicks))}${metricRow("成交", orders, Math.max(clicks, 1), String(orders))}</div>
    <div class="next-action"><span>NEXT BEST ACTION</span><p>将该达人放入 AI 推荐组，与人工经验组进行同市场、同预算的小规模对照实验；通过增量结果更新下一轮匹配权重和预算。</p></div>`;
}

async function runMatching({ announce = true } = {}) {
  if (state.running) return;
  state.running = true;
  elements.run.disabled = true;
  elements.run.querySelector("span:first-child").textContent = "计算中";
  loading();
  await new Promise((resolve) => window.setTimeout(resolve, 320));
  state.results = rankCreators(state.creators, campaign(), selectedProduct());
  state.selectedId = state.results.ranked[0]?.creator.creator_id ?? null;
  state.running = false;
  elements.run.disabled = false;
  elements.run.querySelector("span:first-child").textContent = "运行匹配";
  renderRanking();
  if (announce) toast(`完成：${state.results.ranked.length} 位达人进入可解释排序`);
}

function bindEvents() {
  elements.form.addEventListener("submit", (event) => { event.preventDefault(); runMatching(); });
  elements.product.addEventListener("change", () => { updateProduct(); runMatching({ announce: false }); });
  elements.budget.addEventListener("input", updateBudget);
  elements.tabs.forEach((button) => button.addEventListener("click", () => {
    state.activeTab = button.dataset.tab;
    elements.tabs.forEach((tab) => tab.classList.toggle("is-active", tab === button));
    renderDetail();
  }));
  elements.tweaksToggle.addEventListener("click", () => {
    const open = elements.tweaksPanel.hidden;
    elements.tweaksPanel.hidden = !open;
    elements.tweaksToggle.setAttribute("aria-expanded", String(open));
  });
  elements.density.addEventListener("change", () => { document.body.dataset.density = elements.density.value; });
  elements.contrast.addEventListener("change", () => document.body.classList.toggle("is-high-contrast", elements.contrast.checked));
}

function initialize() {
  fillSelect(elements.product, state.products, (item) => item.product_id, (item) => item.name, "x5");
  updateProduct();
  updateBudget();
  bindEvents();
  runMatching({ announce: false });
}

initialize();

