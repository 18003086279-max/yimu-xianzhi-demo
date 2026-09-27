"use strict";
// All values below are synthetic fixtures. No network requests or production data.
const routes = [
  ["today", "今日总览", "M3 11 12 3l9 8M5 10v11h14V10M9 21v-7h6v7"],
  ["orders", "订单台账", "M6 3h12v18H6zM9 8h6M9 12h6M9 16h4"],
  ["collaboration", "产能协同", "M3 7h18M3 17h18M7 3v8M17 13v8"],
  [
    "simulator",
    "接单测算",
    "M5 3h14v18H5zM8 7h8M8 11h2M14 11h2M8 15h2M14 15h2",
  ],
  ["timeline", "事件时间线", "M6 3v18M6 6h13M6 12h9M6 18h13"],
];
const suppliers = [
  {
    id: "C",
    name: "成员 C",
    type: "member",
    qty: 120,
    shockQty: 90,
    cost: 3.9,
    arrival: "05:40",
    quality: true,
  },
  {
    id: "D",
    name: "成员 D",
    type: "member",
    qty: 95,
    shockQty: 75,
    cost: 4.2,
    arrival: "05:55",
    quality: true,
  },
  {
    id: "X",
    name: "外部供应 X",
    type: "external",
    qty: 400,
    shockQty: 400,
    cost: 5.1,
    arrival: "06:10",
    quality: true,
  },
];
const roleNames = {
  manager: "合作社调度员",
  supplier: "供应方成员",
  viewer: "评委 / 只读",
};
const stateNames = {
  SOFT_LOCK: "软锁待确认",
  HARD_LOCKED: "硬锁已确认",
  AT_RISK: "承诺待复核",
  FULFILLED: "已记录履约",
};
const seed = () => ({
  role: "manager",
  weatherShock: false,
  orderQty: 1000,
  netPrice: 5.8,
  logistics: 0.8,
  reserve: 0.5,
  externalCost: 5.1,
  locks: {},
  events: [],
  filter: { search: "", type: "all", sort: "cost" },
  simDraft: null,
});
let state = seed();
let toastTimer;
const $ = (s) => document.querySelector(s);
const fmt = (n) =>
  Number(n).toLocaleString("zh-CN", { maximumFractionDigits: 2 });
const esc = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const money = (n) => Number(n).toFixed(2);
const cost = (s) => (s.type === "external" ? state.externalCost : s.cost);
const offerQty = (s) => (state.weatherShock ? s.shockQty : s.qty);
const boundary = () =>
  Math.round((state.netPrice - state.logistics - state.reserve) * 100) / 100;
const ownQty = () => (state.weatherShock ? 650 : 700);
const countable = (lock) =>
  lock.status === "HARD_LOCKED"
    ? lock.qty
    : lock.status === "FULFILLED"
      ? lock.delivered
      : 0;
const confirmed = () =>
  ownQty() +
  Object.values(state.locks).reduce((sum, l) => sum + countable(l), 0);
const gap = () => Math.max(0, state.orderQty - confirmed());
const allowed = (role) => state.role === role;
const disabled = (role, condition = false) =>
  !allowed(role) || condition ? "disabled" : "";
const badge = (text, type = "") => `<span class="badge ${type}">${text}</span>`;
const statusBadge = (l) =>
  badge(
    `${stateNames[l.status]} · ${l.status}`,
    l.status === "AT_RISK" ? "red" : l.status === "SOFT_LOCK" ? "amber" : "",
  );
function toast(message) {
  clearTimeout(toastTimer);
  $("#toast").textContent = message;
  $("#toast").classList.add("show");
  toastTimer = setTimeout(() => $("#toast").classList.remove("show"), 3600);
}
function event(title, detail) {
  state.events.push({
    time: new Date().toISOString(),
    role: state.role,
    title,
    detail,
  });
}
function guard(role) {
  if (allowed(role)) return true;
  toast(`请先切换为${roleNames[role]}。`);
  return false;
}
function route() {
  const r = location.hash.slice(1);
  return routes.some((x) => x[0] === r) ? r : "today";
}
function go(id) {
  if (route() === id) {
    render();
    $("#content").focus();
  } else location.hash = id;
}
function bar() {
  const safe = Math.min(confirmed(), state.orderQty);
  return `<div class="capacity-bar" role="img" aria-label="订单需求 ${state.orderQty} 斤，计入保障 ${confirmed()} 斤，缺口 ${gap()} 斤"><div class="cap-safe" style="width:${(safe / state.orderQty) * 100}%"></div><div class="cap-gap" style="width:${(gap() / state.orderQty) * 100}%"></div></div><div class="legend"><span><i></i>计入保障 ${fmt(confirmed())} 斤</span><span class="${gap() ? "risk-text" : ""}"><i class="gap-key"></i>缺口 ${fmt(gap())} 斤</span></div>`;
}
function eventsView(limit = 10000) {
  const list = state.events.slice(-limit).reverse();
  return `<ol class="event-list">${list.map((e) => `<li><time datetime="${e.time}">${new Date(e.time).toLocaleTimeString("zh-CN", { hour12: false })}</time><div><strong>${esc(e.title)}</strong><p>${esc(e.detail)} · ${roleNames[e.role]}</p></div></li>`).join("")}</ol>`;
}
function summaryStrip() {
  return `<div class="summary-strip"><div class="summary-item"><span>订单需求</span><strong>${fmt(state.orderQty)}<small>斤</small></strong><p>菜心 · 09.28 06:30 交付</p></div><div class="summary-item"><span>计入保障</span><strong>${fmt(confirmed())}<small>斤</small></strong><p>自有确认 + 有效成员承诺</p></div><div class="summary-item"><span>待补缺口</span><strong class="${gap() ? "risk-text" : ""}">${fmt(gap())}<small>斤</small></strong><p>软锁与风险承诺不计入</p></div><div class="summary-item"><span>待供应方处理</span><strong>${Object.values(state.locks).filter((l) => ["SOFT_LOCK", "AT_RISK"].includes(l.status)).length}<small>笔</small></strong><p>待确认 / 待复核的承诺</p></div></div>`;
}
function today() {
  return `<div class="welcome"><div><h2>收获有数，<br>每一笔承诺有据。</h2><p>从一张团餐订单出发，看清产能缺口，确认成员供给，<br class="desktop-break">在天气变化前后，作出可解释的履约判断。</p><div class="actions spaced"><button class="primary" data-action="go" data-id="collaboration">开始处理这笔订单</button><button class="text-button" data-action="go" data-id="timeline">查看演示记录</button></div></div><div class="harvest-note"><div class="note-head"><strong>本次收获台账</strong><span>2026 / 09 / 27</span></div><div class="mini-ledger"><span>订单编号</span><strong>P0-260927</strong><span>需求方</span><strong>学校团餐（合成）</strong><span>品类 / 交期</span><strong>菜心 / 明日 06:30</strong><span>天气场景</span><strong>${state.weatherShock ? "连续降雨已触发" : "常规场景"}</strong></div></div></div>${summaryStrip()}<div class="grid cols-2"><section class="card"><div class="order-head"><div><h3>先处理这笔订单</h3><small>保障数量随承诺与天气同步变化</small></div>${badge(gap() ? "存在履约缺口" : "保障已覆盖", gap() ? "red" : "")}</div><dl class="detail-list"><div><dt>自有确认</dt><dd>${ownQty()} 斤</dd></div><div><dt>协同计入</dt><dd>${confirmed() - ownQty()} 斤</dd></div></dl>${bar()}<div class="callout ${gap() ? "risk" : ""}"><strong>${gap() ? `还需补齐 ${fmt(gap())} 斤有效供给` : "当前确认供给已覆盖订单"}</strong><p>${gap() ? "先确认成员可供数量，再评估外部采购成本。" : "这是基于合成条件的保障判断，尚不代表整单实际交付。"}</p></div><div class="actions spaced"><button class="primary" data-action="recalculate" ${disabled("manager")}>重算订单风险</button><button data-action="shock" ${disabled("manager", state.weatherShock)}>模拟连续降雨</button></div><p class="footnote">降雨演示：自有确认量 700 → 650 斤；已硬锁成员产能进入 AT_RISK，复核前不计入保障。</p></section><section class="card"><h3>三分钟演示指南</h3><ol class="guide"><li><strong>调度员：发现缺口，申请软锁</strong>进入产能协同，选择成员 C；软锁保留 30 秒。</li><li><strong>供应方：确认硬锁，作出承诺</strong>在顶部切换角色，确认数量、单价与交期。</li><li><strong>调度员：触发天气，观察风险</strong>模拟连续降雨，硬锁转为 AT_RISK，缺口同步扩大。</li><li><strong>供应方：复核产能，记录履约</strong>按降雨后数量重新确认，再查看测算与事件时间线。</li></ol><p>可随时重置或导出摘要。评委角色可浏览全部页面，业务操作只读。</p></section></div><div class="section-title"><h2>最近发生</h2><button class="text-button" data-action="go" data-id="timeline">全部事件</button></div>${eventsView(3)}`;
}
function orders() {
  return `<div class="inline-info">订单台账用于查看与调整当前合成订单。数量修改后，全站保障、风险与接单测算同步更新。</div><div class="grid cols-2"><section class="card"><div class="order-head"><div><h3>学校团餐 · 菜心</h3><small>P0-260927 / 合成订单</small></div>${badge(gap() ? "存在缺口" : "保障已覆盖", gap() ? "red" : "")}</div><dl class="detail-list"><div><dt>交付时间</dt><dd>2026.09.28 06:30</dd></div><div><dt>质量约束</dt><dd>商品级叶菜（演示假设）</dd></div><div><dt>需求数量</dt><dd>${fmt(state.orderQty)} 斤</dd></div><div><dt>有效保障</dt><dd>${fmt(confirmed())} 斤</dd></div></dl>${bar()}<form id="orderForm"><div class="form-grid"><div class="field"><label for="orderQty">修改订单数量（斤）</label><input id="orderQty" name="qty" type="number" min="100" max="5000" step="1" required value="${state.orderQty}" ${disabled("manager")}><small>100–5,000 斤，整数；仅调整当前演示</small></div></div><button class="primary" ${disabled("manager")}>保存数量并重算</button><p id="orderError" class="error" role="alert"></p></form></section><section class="card"><h3>台账字段示例</h3><p>保留 Excel 台账优先的试点思路。此页面仅展示字段与内置样例，尚未实现 Excel 解析。</p><div class="table-wrap"><table class="table"><caption>内置合成样例 · 无文件上传</caption><thead><tr><th>字段</th><th>示例值</th></tr></thead><tbody><tr><td>order_id</td><td>P0-260927</td></tr><tr><td>crop</td><td>菜心</td></tr><tr><td>quantity_jin</td><td>${state.orderQty}</td></tr><tr><td>delivery_at</td><td>2026-09-28 06:30</td></tr><tr><td>data_source</td><td>SYNTHETIC_DEMO</td></tr></tbody></table></div><p class="footnote">真实试点需另行接入与校验订单、试收、商品率及实际履约记录。此版不模拟“已上传成功”。</p></section></div>`;
}
function candidateRows() {
  let list = suppliers.filter(
    (s) =>
      (state.filter.type === "all" || s.type === state.filter.type) &&
      s.name.toLowerCase().includes(state.filter.search.trim().toLowerCase()),
  );
  list.sort((a, b) =>
    state.filter.sort === "qty"
      ? offerQty(b) - offerQty(a)
      : state.filter.sort === "arrival"
        ? a.arrival.localeCompare(b.arrival)
        : cost(a) - cost(b),
  );
  if (!list.length)
    return `<div class="empty"><strong>没有匹配的供应方</strong><p>试试搜索“成员”，或清空筛选查看全部候选。</p><button class="text-button" data-action="clearFilters">清空筛选</button></div>`;
  return list
    .map((s) => {
      const lock = state.locks[s.id],
        expensive = cost(s) > boundary();
      return `<article class="supplier"><div class="supplier-head"><h3>${s.name} · 菜心</h3>${badge(s.type === "member" ? "社内成员" : "外部候选", "neutral")}</div><div class="supplier-meta"><span>可报价 <strong>${offerQty(s)} 斤</strong></span><span>单价 <strong>¥${money(cost(s))}/斤</strong></span><span>到场 <strong>${s.arrival}</strong></span></div><p>${s.quality ? "品质条件假设通过" : "品质待核验"} · ${expensive ? "高于当前经济边界 ¥" + money(boundary()) : "在当前经济边界内"}${state.weatherShock && s.type === "member" ? " · 数量已按降雨修正" : ""}</p><div class="actions">${lock ? statusBadge(lock) : `<button class="primary" data-action="soft" data-id="${s.id}" ${disabled("manager", expensive || gap() === 0)}>申请软锁 · ${Math.min(offerQty(s), gap())} 斤</button>`}${expensive ? `<button class="text-button" data-action="go" data-id="simulator">查看经济门</button>` : ""}</div></article>`;
    })
    .join("");
}
function recommendations() {
  let remaining = gap(),
    lines = [];
  if (!remaining)
    return {
      lines: ["确认产能已覆盖订单，无需新增补货；继续关注天气与履约。"],
      remaining: 0,
    };
  const risks = suppliers.filter(
    (s) => state.locks[s.id]?.status === "AT_RISK",
  );
  if (risks.length)
    lines.push(
      `优先复核 ${risks.map((s) => s.name).join("、")} 的风险承诺；复核前按 0 斤计入保障。`,
    );
  const eligible = suppliers
    .filter((s) => !state.locks[s.id] && cost(s) <= boundary())
    .sort((a, b) => cost(a) - cost(b));
  for (const s of eligible) {
    const take = Math.min(remaining, offerQty(s));
    if (take) {
      lines.push(
        `建议向${s.name}申请 ${take} 斤，报价 ¥${money(cost(s))}/斤；仍须双方确认。`,
      );
      remaining -= take;
    }
  }
  const pending = Object.values(state.locks).filter(
    (l) => l.status === "SOFT_LOCK",
  );
  if (pending.length)
    lines.push(
      `已有 ${pending.length} 笔软锁等待供应方确认，不重复分配，暂不抵扣缺口。`,
    );
  if (remaining)
    lines.push(
      `上述新增候选全部确认后仍有 ${remaining} 斤待解决；考虑复核已有承诺、协商减量或寻找新供给。`,
    );
  if (suppliers.some((s) => !state.locks[s.id] && cost(s) > boundary()))
    lines.push(`报价超出 ¥${money(boundary())}/斤经济边界的候选未纳入建议。`);
  return { lines, remaining };
}
function lockRows() {
  const entries = Object.entries(state.locks);
  if (!entries.length)
    return `<div class="empty"><strong>还没有产能承诺</strong><p>调度员先从左侧候选申请软锁，再切换供应方确认。软锁不会减少订单缺口。</p></div>`;
  return entries
    .map(([id, l]) => {
      const s = suppliers.find((s) => s.id === id);
      return `<article class="lock-item"><div class="lock-head"><strong>${s.name} · ${l.qty} 斤</strong>${statusBadge(l)}</div><p>约定 ¥${money(l.unitCost)}/斤 · ${s.arrival} 到场 · 商品级叶菜</p>${l.status === "SOFT_LOCK" ? `<p>临时保留还剩 <strong data-expires="${l.expires}">${Math.max(0, Math.ceil((l.expires - Date.now()) / 1000))}</strong> 秒，跨页面也会到期释放。</p><div class="actions"><button class="primary" data-action="confirm" data-id="${id}" ${disabled("supplier")}>确认硬锁</button><button data-action="release" data-id="${id}" ${disabled("manager")}>释放软锁</button></div>` : ""}${l.status === "AT_RISK" ? `<div class="callout risk">天气变化后暂停计入保障。可复核为 ${Math.min(l.qty, offerQty(s))} 斤。</div><div class="actions spaced"><button class="primary" data-action="review" data-id="${id}" ${disabled("supplier")}>复核并确认 ${Math.min(l.qty, offerQty(s))} 斤</button></div>` : ""}${l.status === "HARD_LOCKED" ? `<p>有效承诺已计入保障。填写实际合格交付量，不预设履约成功。</p><form data-delivery="${id}"><div class="field"><label for="delivery-${id}">合格交付量（0–${l.qty} 斤）</label><input id="delivery-${id}" name="delivered" type="number" min="0" max="${l.qty}" step="1" required value="${l.qty}" ${disabled("supplier")}></div><div class="actions spaced"><button class="primary" ${disabled("supplier")}>记录本笔履约</button></div></form>` : ""}${l.status === "FULFILLED" ? `<p>已记录合格交付 ${l.delivered} / 承诺 ${l.qty} 斤。${l.delivered < l.qty ? `<strong class="risk-text">差额 ${l.qty - l.delivered} 斤，已回写订单缺口。</strong>` : "本笔承诺已完成。"}</p>` : ""}</article>`;
    })
    .join("");
}
function collaboration() {
  const rec = recommendations();
  return `<p class="inline-info">${state.role === "manager" ? "调度员可申请或释放软锁；确认与复核请在顶部切换为供应方。" : state.role === "supplier" ? "供应方可确认硬锁、复核风险数量并记录履约；申请软锁请切换为调度员。" : "当前为评委只读视角，可筛选与浏览；业务操作需切换对应角色。"}</p><div class="grid cols-2"><section class="card"><div class="order-head"><div><h3>寻找可确认的供给</h3><small>所有候选均为合成数据 · 到场截止 06:30</small></div>${badge("3 位候选", "neutral")}</div><div class="filters"><label>搜索供应方<input type="search" id="supplierSearch" placeholder="输入成员或外部供应" value="${esc(state.filter.search)}"></label><label>供应类型<select id="supplierType"><option value="all">全部供应方</option><option value="member" ${state.filter.type === "member" ? "selected" : ""}>社内成员</option><option value="external" ${state.filter.type === "external" ? "selected" : ""}>外部供应</option></select></label><label>排序方式<select id="supplierSort"><option value="cost">单价从低到高</option><option value="qty" ${state.filter.sort === "qty" ? "selected" : ""}>可供量从多到少</option><option value="arrival" ${state.filter.sort === "arrival" ? "selected" : ""}>到场时间从早到晚</option></select></label></div><div id="supplierList">${candidateRows()}</div></section><section class="card"><h3>产能承诺台账</h3><div class="state-track"><span class="state">可报价</span><span class="state ${Object.values(state.locks).some((l) => l.status === "SOFT_LOCK") ? "active" : ""}">SOFT_LOCK</span><span class="state ${Object.values(state.locks).some((l) => l.status === "HARD_LOCKED") ? "active" : ""}">HARD_LOCKED</span><span class="state ${Object.values(state.locks).some((l) => l.status === "AT_RISK") ? "risk" : ""}">AT_RISK</span><span class="state ${Object.values(state.locks).some((l) => l.status === "FULFILLED") ? "active" : ""}">FULFILLED</span></div><p>软锁待确认 → 硬锁生效 → 风险时暂停计入 → 复核恢复 → 履约回流</p>${bar()}<div id="lockList">${lockRows()}</div><div class="actions spaced"><button data-action="shock" ${disabled("manager", state.weatherShock)}>模拟连续降雨</button><button data-action="recalculate" ${disabled("manager")}>重算订单风险</button></div></section></div><div class="section-title"><h2>缺口补货建议</h2><span>按经济可行候选的单价排序</span></div><section class="card"><strong class="${gap() ? "risk-text" : ""}">当前待补 ${fmt(gap())} 斤</strong><ol class="recommendations">${rec.lines.map((line) => `<li>${line}</li>`).join("")}</ol><p>建议不会自动采购或产生承诺；产能锁定后才更新订单保障。</p></section>`;
}
// Potential supply is separate from confirmed coverage. Soft locks are potential only;
// AT_RISK quantities are excluded until the supplier explicitly re-confirms them.
function assessment() {
  const viable = (s) => s.quality && s.arrival <= "06:30";
  const available = (s) => {
    const l = state.locks[s.id];
    return !l ? offerQty(s) : l.status === "SOFT_LOCK" ? l.qty : 0;
  };
  const physical =
    confirmed() +
    suppliers.filter(viable).reduce((n, s) => n + available(s), 0);
  const economic =
    confirmed() +
    suppliers
      .filter(
        (s) =>
          viable(s) && (state.locks[s.id]?.unitCost ?? cost(s)) <= boundary(),
      )
      .reduce((n, s) => n + available(s), 0);
  const within = confirmed() >= state.orderQty;
  return {
    physical,
    economic,
    physicalPass: physical >= state.orderQty,
    economicPass: boundary() >= 0 && economic >= state.orderQty,
    within,
  };
}
function simulator() {
  const a = assessment();
  const draft = state.simDraft || state;
  return `<p class="inline-info">先检验可协调产能，再检验补货经济性。计算将更新本次演示订单及价格假设；候选供给不等于已确认保障。</p><div class="grid cols-2"><section class="card"><h3>调整演示假设</h3><form id="simForm"><div class="form-grid">${[
    ["orderQty", "订单数量（斤）", 100, 5000, 1],
    ["netPrice", "订单净价（元/斤）", 0, 100, 0.1],
    ["logistics", "物流与损耗预留（元/斤）", 0, 100, 0.1],
    ["reserve", "目标贡献预留（元/斤）", 0, 100, 0.1],
    ["externalCost", "外部供应 X 报价（元/斤）", 0, 100, 0.1],
  ]
    .map(
      ([id, label, min, max, step]) =>
        `<div class="field"><label for="sim-${id}">${label}</label><input id="sim-${id}" name="${id}" type="number" min="${min}" max="${max}" step="${step}" required value="${esc(draft[id])}" ${disabled("manager")}></div>`,
    )
    .join(
      "",
    )}</div><button class="primary" ${disabled("manager")}>计算并更新演示</button><p id="simError" class="error" role="alert"></p><p class="footnote" id="draftHint">${state.simDraft ? "有未计算的输入；右侧仍显示上次计算结果。" : "右侧为当前已计算结果。"}</p></form><div class="callout"><strong>经济边界 = 净价 − 物流损耗 − 目标贡献</strong><p>¥${money(state.netPrice)} − ¥${money(state.logistics)} − ¥${money(state.reserve)} = ¥${money(boundary())}/斤。此为简化边际采购规则，未计算真实经营利润；已有硬锁沿用确认时单价。</p></div></section><section class="card"><h3>这笔订单，现在能接吗？</h3><div class="gate"><span>时间与品质门<small>候选到场均早于 06:30，品质为假设通过</small></span><strong>演示条件通过</strong></div><div class="gate"><span>物理产能门<small>确认 + 未确认候选，上限 ${fmt(a.physical)} 斤；排除 AT_RISK</small></span><strong class="${a.physicalPass ? "" : "risk-text"}">${a.physicalPass ? "可协调" : "产能不足"}</strong></div><div class="gate"><span>补货经济门<small>边界内可协调 ${fmt(a.economic)} 斤 / 需求 ${fmt(state.orderQty)} 斤</small></span><strong class="${a.economicPass ? "" : "risk-text"}">${a.economicPass ? "通过" : "不通过"}</strong></div><div class="gate"><span>外部供应 X<small>报价 ¥${money(state.externalCost)} / 边界 ¥${money(boundary())}</small></span><strong class="${state.externalCost <= boundary() ? "" : "risk-text"}">${state.externalCost <= boundary() ? "允许候选" : "ECONOMIC_GATE 拒绝"}</strong></div><div class="callout ${!a.physicalPass || !a.economicPass ? "risk" : !a.within ? "warning" : ""}"><strong>${!a.physicalPass || !a.economicPass ? "暂不建议新增承接" : a.within ? "确认供给已覆盖需求" : "可继续协调，暂不可视为保障"}</strong><p>${!a.physicalPass ? "需求超过当前可协调产能，请减量或寻找新供给。" : !a.economicPass ? "经济边界内的供给不足，请协商价格、成本或订单量。" : a.within ? "仍需持续跟踪天气与实际交付。" : "候选尚未全部确认，须完成软锁与硬锁流程。"}</p></div><p class="footnote">自有产能按既有确认量计入；本模型只评估新增补货，不是完整利润表。外部候选被拒绝时，若社内供给已足够，整体经济门仍可通过。</p></section></div>`;
}
function timeline() {
  return `<section class="card"><h3>从供给判断，到履约回流</h3><ol class="step-rail"><li><strong>供给关注</strong><small>T−14 · 建立批次信息</small></li><li><strong>天气压力</strong><small>T−7 · 检查不确定性</small></li><li><strong>订单判断</strong><small>T−3 · 计算履约缺口</small></li><li><strong>产能确认</strong><small>T−1 · 双方确认硬锁</small></li><li><strong>履约回流</strong><small>T · 记录合格交付</small></li></ol><p>以上为机制示意，不代表本次操作的真实时间跨度。下方事件按本机实际操作时间记录。</p>${bar()}<dl class="detail-list"><div><dt>自有预测区间（非保障量）</dt><dd>${state.weatherShock ? "650–820" : "807–1,000"} 斤</dd></div><div><dt>自有已确认（用于保障）</dt><dd>${ownQty()} 斤</dd></div></dl><p>预测区间与已确认量口径不同，不直接相加；保障只采用确认量及有效协同承诺。</p></section><div class="section-title"><h2>本次演示事件</h2><span>${state.events.length} 条 · 最近事件在前</span></div>${eventsView()}<p class="footnote">日志仅记录当前页面会话；重置将清空此前操作。可通过顶部“导出演示摘要”保存全部记录。</p>`;
}
function captureDraft() {
  const f = $("#simForm");
  if (f) {
    state.simDraft = Object.fromEntries(new FormData(f));
    $("#draftHint").textContent = "有未计算的输入；右侧仍显示上次计算结果。";
  }
}
function render() {
  const id = route();
  $("#pageTitle").textContent = routes.find((r) => r[0] === id)[1];
  document.querySelectorAll(".nav-link").forEach((a) => {
    const active = a.hash === "#" + id;
    a.classList.toggle("active", active);
    if (active) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  $("#roleSelect").value = state.role;
  $("#roleHint").textContent =
    state.role === "viewer"
      ? "只读浏览 · 可导出摘要"
      : state.role === "supplier"
        ? "供应方视角 · 确认 / 复核 / 履约"
        : "调度员视角 · 申请 / 调度 / 测算";
  $("#content").innerHTML = {
    today,
    orders,
    collaboration,
    simulator,
    timeline,
  }[id]();
}
function expireLocks() {
  let changed = false;
  for (const [id, l] of Object.entries(state.locks)) {
    if (l.status === "SOFT_LOCK" && Date.now() >= l.expires) {
      delete state.locks[id];
      event(
        "软锁到期释放",
        `${suppliers.find((s) => s.id === id).name} ${l.qty} 斤已返回候选池`,
      );
      changed = true;
    }
  }
  return changed;
}
function soft(id) {
  if (!guard("manager")) return;
  expireLocks();
  const s = suppliers.find((s) => s.id === id);
  if (!s || state.locks[id] || cost(s) > boundary() || !gap())
    return toast("当前条件不允许申请，请检查候选状态与经济门。");
  const qty = Math.min(offerQty(s), gap());
  state.locks[id] = {
    status: "SOFT_LOCK",
    qty,
    unitCost: cost(s),
    expires: Date.now() + 30000,
  };
  event("申请软锁", `${s.name} ${qty} 斤，30 秒内等待供应方确认；未计入保障`);
  render();
  toast("软锁已申请，请切换供应方，在 30 秒内确认。");
}
function confirmLock(id) {
  if (!guard("supplier")) return;
  const expired = expireLocks();
  const l = state.locks[id];
  if (!l || l.status !== "SOFT_LOCK") {
    if (expired) {
      render();
      toast("软锁已过期，请调度员重新申请。");
    }
    return;
  }
  if (l.unitCost > boundary()) {
    return toast(
      "当前经济边界已变化，此报价不可确认；请调度员调整测算或释放软锁。",
    );
  }
  const s = suppliers.find((s) => s.id === id);
  if (l.qty > offerQty(s)) {
    delete state.locks[id];
    event("软锁失效", `${s.name} 可供量不足，请重新申请`);
    render();
    return toast("供给已变化，请重新申请。");
  }
  l.status = "HARD_LOCKED";
  delete l.expires;
  event(
    "供应方确认硬锁",
    `${s.name} ${l.qty} 斤，¥${money(l.unitCost)}/斤，${s.arrival} 到场；当前缺口 ${gap()} 斤`,
  );
  render();
  toast("双方确认完成，硬锁产能已计入保障。");
}
function shock() {
  if (!guard("manager") || state.weatherShock) return;
  expireLocks();
  state.weatherShock = true;
  for (const s of suppliers.filter((s) => s.type === "member")) {
    const l = state.locks[s.id];
    if (l?.status === "HARD_LOCKED") l.status = "AT_RISK";
    if (l?.status === "SOFT_LOCK") {
      delete state.locks[s.id];
      event("天气变化，释放软锁", `${s.name} 原软锁失效，需按修正数量重新申请`);
    }
  }
  event(
    "模拟连续降雨",
    `自有确认量 700 → 650 斤；成员硬锁转 AT_RISK，复核前计入 0 斤；缺口 ${gap()} 斤`,
  );
  render();
  toast("天气冲击已生效，风险承诺已暂停计入保障。");
}
function review(id) {
  if (!guard("supplier")) return;
  const l = state.locks[id],
    s = suppliers.find((s) => s.id === id);
  if (!l || l.status !== "AT_RISK") return;
  const before = l.qty;
  l.qty = Math.min(l.qty, offerQty(s));
  l.status = "HARD_LOCKED";
  event(
    "风险产能复核确认",
    `${s.name} ${before} → ${l.qty} 斤，恢复硬锁；缺口 ${gap()} 斤`,
  );
  render();
  toast("复核完成，修正数量已恢复计入保障。");
}
function release(id) {
  if (!guard("manager")) return;
  const l = state.locks[id];
  if (l?.status !== "SOFT_LOCK") return;
  delete state.locks[id];
  event(
    "调度员释放软锁",
    `${suppliers.find((s) => s.id === id).name} ${l.qty} 斤已返回候选池`,
  );
  render();
  toast("软锁已释放。");
}
function recalculate() {
  if (!guard("manager")) return;
  expireLocks();
  event(
    "订单风险重算",
    `需求 ${state.orderQty} 斤，保障 ${confirmed()} 斤，缺口 ${gap()} 斤`,
  );
  render();
  toast(`已重算：保障 ${confirmed()} 斤，缺口 ${gap()} 斤。`);
}
function reset() {
  state = seed();
  event("初始化合成演示", "订单 1,000 斤，自有确认 700 斤，初始缺口 300 斤");
  if (location.hash !== "#today") location.hash = "today";
  render();
  toast("演示已重置：恢复初始数据、角色、筛选与日志。");
}
function exportSummary() {
  if (expireLocks()) render();
  const a = assessment(),
    rec = recommendations();
  const lines = [
    "一亩先知 · 校赛演示摘要 V0.4",
    "合成演示数据｜不代表真实生产效果，不构成生产或接单建议。",
    `导出时间：${new Date().toLocaleString("zh-CN")}`,
    `当前角色：${roleNames[state.role]}`,
    "",
    "订单 P0-260927｜学校团餐｜菜心｜2026-09-28 06:30",
    `需求 ${state.orderQty} 斤；自有确认 ${ownQty()} 斤；有效保障 ${confirmed()} 斤；缺口 ${gap()} 斤。`,
    `天气：${state.weatherShock ? "模拟连续降雨" : "常规演示场景"}`,
    "",
    "接单测算（最近已计算结果；不含未提交输入）",
    `净价 ${state.netPrice}，物流损耗 ${state.logistics}，目标贡献 ${state.reserve}，经济边界 ${money(boundary())} 元/斤，外部报价 ${state.externalCost} 元/斤。`,
    `物理可协调 ${a.physical} 斤；经济边界内 ${a.economic} 斤；物理门 ${a.physicalPass ? "通过" : "不通过"}；经济门 ${a.economicPass ? "通过" : "不通过"}。`,
    "候选供给不是保障，AT_RISK 复核前排除，自有成本未计入完整利润测算。",
    "",
    "承诺台账",
    ...Object.entries(state.locks).map(
      ([id, l]) =>
        `${suppliers.find((s) => s.id === id).name}｜${l.status}｜承诺 ${l.qty} 斤｜单价 ${l.unitCost} 元/斤｜计入 ${countable(l)} 斤${l.status === "SOFT_LOCK" ? `｜剩余 ${Math.max(0, Math.ceil((l.expires - Date.now()) / 1000))} 秒` : ""}`,
    ),
    ...(Object.keys(state.locks).length ? [] : ["暂无承诺记录"]),
    "",
    "补货建议",
    ...rec.lines,
    "",
    "演示事件（实际操作时间，正序）",
    ...state.events.map(
      (e) => `${e.time}｜${roleNames[e.role]}｜${e.title}｜${e.detail}`,
    ),
    "",
    "纯前端会话数据，无身份认证、真实气象、Excel 解析或后台订单系统。",
  ];
  const blob = new Blob(["\uFEFF" + lines.join("\n")], {
    type: "text/plain;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "一亩先知_合成演示摘要.txt";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  toast("已生成演示摘要，浏览器将下载 TXT 文件。");
}
$("#nav").innerHTML = routes
  .map(
    ([id, label, path]) =>
      `<a class="nav-link" href="#${id}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${path}"/></svg>${label}</a>`,
  )
  .join("");
$("#roleSelect").addEventListener("change", (e) => {
  const next = e.target.value;
  if (!roleNames[next]) return;
  state.role = next;
  event("切换演示角色", roleNames[next]);
  render();
  toast(`已切换为${roleNames[next]}。`);
});
$("#resetBtn").addEventListener("click", reset);
$("#exportBtn").addEventListener("click", exportSummary);
$(".skip-link").addEventListener("click", (e) => {
  e.preventDefault();
  $("#content").focus();
  $("#content").scrollIntoView({ block: "start" });
});
$("#content").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-action]");
  if (!b || b.disabled) return;
  const { action, id } = b.dataset;
  const actions = {
    go: () => go(id),
    soft: () => soft(id),
    confirm: () => confirmLock(id),
    release: () => release(id),
    review: () => review(id),
    shock,
    recalculate,
    clearFilters: () => {
      state.filter = { search: "", type: "all", sort: "cost" };
      render();
      $("#supplierSearch").focus();
    },
  };
  actions[action]?.();
});
$("#content").addEventListener("input", (e) => {
  if (e.target.id === "supplierSearch") {
    state.filter.search = e.target.value;
    $("#supplierList").innerHTML = candidateRows();
  }
  if (e.target.closest("#simForm")) captureDraft();
});
$("#content").addEventListener("change", (e) => {
  if (e.target.id === "supplierType") {
    state.filter.type = e.target.value;
    $("#supplierList").innerHTML = candidateRows();
  }
  if (e.target.id === "supplierSort") {
    state.filter.sort = e.target.value;
    $("#supplierList").innerHTML = candidateRows();
  }
});
$("#content").addEventListener("submit", (e) => {
  e.preventDefault();
  const form = e.target;
  if (form.id === "orderForm") {
    if (!guard("manager")) return;
    const qty = Number(new FormData(form).get("qty"));
    if (!Number.isInteger(qty) || qty < 100 || qty > 5000) {
      $("#orderError").textContent = "请输入 100–5,000 之间的整数。";
      return;
    }
    state.orderQty = qty;
    state.simDraft = null;
    event(
      "更新订单并重算",
      `需求 ${qty} 斤，保障 ${confirmed()} 斤，缺口 ${gap()} 斤`,
    );
    render();
    toast("订单数量已更新，所有页面已同步。");
  } else if (form.id === "simForm") {
    if (!guard("manager")) return;
    const values = Object.fromEntries(
      [...new FormData(form)].map(([k, v]) => [k, Number(v)]),
    );
    if (
      !Number.isInteger(values.orderQty) ||
      values.orderQty < 100 ||
      values.orderQty > 5000 ||
      ["netPrice", "logistics", "reserve", "externalCost"].some(
        (k) => !Number.isFinite(values[k]) || values[k] < 0 || values[k] > 100,
      )
    ) {
      $("#simError").textContent =
        "数量须为 100–5,000 整数，金额须为 0–100 元。";
      return;
    }
    Object.assign(state, values);
    state.simDraft = null;
    event(
      "更新接单测算",
      `需求 ${state.orderQty} 斤，经济边界 ${money(boundary())} 元/斤；确认产能 ${confirmed()} 斤`,
    );
    render();
    toast("测算已更新；当前订单与补货建议已同步。");
  } else if (form.dataset.delivery) {
    if (!guard("supplier")) return;
    const l = state.locks[form.dataset.delivery];
    if (l?.status !== "HARD_LOCKED") return;
    const n = Number(new FormData(form).get("delivered"));
    if (!Number.isInteger(n) || n < 0 || n > l.qty)
      return toast(`请输入 0–${l.qty} 之间的整数。`);
    l.delivered = n;
    l.status = "FULFILLED";
    event(
      "记录本笔履约",
      `${suppliers.find((s) => s.id === form.dataset.delivery).name} 合格交付 ${n}/${l.qty} 斤，订单缺口 ${gap()} 斤`,
    );
    render();
    toast("履约已回写台账，保障采用合格交付量。");
  }
});
window.addEventListener("hashchange", () => {
  if (location.hash === "#content") {
    $("#content").focus();
    return;
  }
  expireLocks();
  render();
  $("#content").focus();
  window.scrollTo({ top: 0, behavior: "instant" });
});
// Preserve unsubmitted inputs when asynchronous expiry changes the shared ledger.
function refreshPreservingInputs() {
  const focusId = document.activeElement?.id;
  const fields = [...document.querySelectorAll("#content input[id]")].map(
    (el) => [el.id, el.value],
  );
  render();
  for (const [id, value] of fields) {
    const el = document.getElementById(id);
    if (el) el.value = value;
  }
  if (focusId) document.getElementById(focusId)?.focus({ preventScroll: true });
}
// A single app-wide clock keeps TTL valid across routes without rebuilding forms each second.
setInterval(() => {
  const changed = expireLocks();
  if (changed) {
    refreshPreservingInputs();
    toast("软锁已到期释放，可重新申请。");
  }
  document
    .querySelectorAll("[data-expires]")
    .forEach(
      (el) =>
        (el.textContent = Math.max(
          0,
          Math.ceil((Number(el.dataset.expires) - Date.now()) / 1000),
        )),
    );
}, 1000);
window.addEventListener("focus", () => {
  if (expireLocks()) refreshPreservingInputs();
});
event("初始化合成演示", "订单 1,000 斤，自有确认 700 斤，初始缺口 300 斤");
render();
