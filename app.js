const routes = [
  ['today','01','今日任务'],['orders','02','订单与数据导入'],['timeline','03','供需时间轴'],['collaboration','04','协同纠偏中心'],['simulator','05','接单模拟器']
];
const seed = () => ({
  weatherShock:false,
  softLock:null,
  hardLocked:false,
  delivered:false,
  orderQty:1000,
  qLow:807,
  qHigh:1000,
  confirmedOwn:700,
  candidateC:120,
  candidateD:95,
  externalCost:5.1,
  economicBoundary:4.5,
});
let state = seed();
let timer=null;
const $=s=>document.querySelector(s);
const fmt=n=>Number(n).toLocaleString('zh-CN');
function toast(msg){let t=$('.toast');if(!t){t=document.createElement('div');t.className='toast';document.body.appendChild(t)}t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),1800)}
function nav(){ $('#nav').innerHTML=routes.map(([id,n,label])=>`<button class="nav-btn" data-route="${id}"><span class="nav-num">${n}</span>${label}</button>`).join(''); document.querySelectorAll('.nav-btn').forEach(b=>b.onclick=()=>{location.hash=b.dataset.route}) }
function current(){return (location.hash||'#today').slice(1)}
function riskGap(){const safe=state.weatherShock?650:state.confirmedOwn;return Math.max(0,state.orderQty-safe-(state.hardLocked?state.candidateC:0))}
function header(id){const r=routes.find(x=>x[0]===id)||routes[0];$('#pageTitle').textContent=r[2];document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.route===id))}
function today(){const gap=riskGap();return `<div class="grid cols-3">
  <div class="card ${gap?'risk-panel':'ok-panel'}"><span class="badge ${gap?'red':'green'}">${gap?'履约风险':'可履约'}</span><div class="metric ${gap?'risk':'ok'}">${gap?fmt(gap)+'斤':'0斤'}</div><p>${gap?'当前订单仍有未被确认的产能缺口。':'当前确认产能已覆盖订单需求。'}</p></div>
  <div class="card"><span class="badge amber">待确认</span><div class="metric">${state.softLock&&!state.hardLocked?'1':'0'}</div><p>软锁只代表临时保留，必须由供应方确认后才能进入订单保障。</p></div>
  <div class="card"><span class="badge green">版本冻结</span><div class="metric">R1a / O1</div><p>当前网页为V0.3.2机制演示，不输出真实生产准确率。</p></div>
</div>
<div class="section-title"><h2>今天需要处理什么？</h2><span>按风险优先，而不是按页面优先</span></div>
<div class="card">
  <div class="task-row"><span class="badge ${gap?'red':'green'}">P0订单</span><div><strong>学校团餐｜菜心 1000斤</strong><div class="muted">明早 06:30 交付 · 当前缺口 ${gap}斤</div></div><button class="primary" onclick="go('collaboration')">处理缺口</button></div>
  <div class="task-row"><span class="badge amber">演示控制</span><div><strong>${state.weatherShock?'天气冲击已触发':'模拟连续降雨冲击'}</strong><div class="muted">触发后重新计算在田产能，并检查已承诺产能是否进入AT_RISK。</div></div><button class="secondary" onclick="shock()" ${state.weatherShock?'disabled':''}>触发天气冲击</button></div>
</div>`}
function orders(){return `<div class="grid cols-2"><div class="card"><h3>Excel优先，不重建经营系统</h3><p>首轮试点只要求最小字段进入：订单需求、交期、批次、可供数量、田间状态与最终履约。</p><div class="import-box"><div class="upload-icon">⇧</div><strong>导入订单或批次台账</strong><div class="fake-input"><span class="file-chip">订单_示例.xlsx</span><button class="primary" onclick="toast('演示数据已导入')">模拟导入</button></div></div></div><div class="card"><h3>当前演示订单</h3><table class="table"><tr><th>订单</th><th>品类</th><th>需求</th><th>交期</th><th>状态</th></tr><tr><td>P0-260927</td><td>菜心</td><td>1000斤</td><td>明日06:30</td><td><span class="badge red">需处理</span></td></tr></table><p style="margin-top:12px">所有数据均为合成演示数据。</p></div></div>`}
function timeline(){const gap=riskGap(); const safe=Math.max(0,state.orderQty-gap);return `<div class="card"><h3>订单需求与可履约产能放到同一条时间线上</h3><div class="timeline"><div class="timeline-grid"><div class="time-node"><small>T-14</small><div class="dot"></div><b>供给关注</b></div><div class="time-node"><small>T-7</small><div class="dot"></div><b>天气压力</b></div><div class="time-node risk"><small>T-3</small><div class="dot"></div><b>订单判断</b></div><div class="time-node"><small>T-1</small><div class="dot"></div><b>产能确认</b></div><div class="time-node"><small>T</small><div class="dot"></div><b>履约回流</b></div></div></div>
<div class="section-title"><h2>订单 P0</h2><span>需求 1000斤</span></div><div class="capacity-bar"><div class="cap-safe" style="width:${safe/state.orderQty*100}%"></div><div class="cap-gap" style="width:${gap/state.orderQty*100}%"></div></div><div class="legend"><span><i style="background:#4f7a62"></i>已确认 ${safe}斤</span><span><i style="background:#b25d52"></i>缺口 ${gap}斤</span></div>
</div><div class="grid cols-3" style="margin-top:18px"><div class="card"><h3>Q_low</h3><div class="metric">${state.weatherShock?'650':'807'}斤</div><p>保守可用区间下界</p></div><div class="card"><h3>Q_high</h3><div class="metric">${state.weatherShock?'820':'1000'}斤</div><p>当前演示风险输入上界</p></div><div class="card ${state.weatherShock?'risk-panel':''}"><h3>田间修正</h3><div class="metric ${state.weatherShock?'risk':''}">${state.weatherShock?'需复核':'未触发'}</div><p>真实试点中必须补充试收、估产、商品率等现场字段。</p></div></div>`}
function collaboration(){const gap=riskGap();let remain=state.softLock?Math.max(0,Math.ceil((state.softLock.expires-Date.now())/1000)):0;return `<div class="grid cols-2"><div class="card"><h3>候选产能</h3><div class="member-list"><div class="member"><div><strong>成员C｜菜心</strong><small>可报价 120斤 · 历史履约示例 9/10</small></div><button class="primary" onclick="softLock()" ${state.softLock||state.hardLocked?'disabled':''}>申请软锁</button></div><div class="member"><div><strong>成员D｜菜心</strong><small>可报价 95斤 · 预计到场 05:55</small></div><button class="secondary" onclick="toast('成员D保留为替代候选')">保留候选</button></div><div class="member"><div><strong>external-x｜外部供应</strong><small>时间可行 · MC 5.1元/斤</small></div><button class="secondary" onclick="go('simulator')">看经济门</button></div></div></div>
<div class="card"><h3>承诺状态</h3><div class="state-track"><span class="state active">可报价</span><span class="state ${state.softLock&&!state.hardLocked?'active':''}">软锁定</span><span class="state ${state.hardLocked?'active':''}">硬锁定</span><span class="state ${state.weatherShock&&state.hardLocked?'risk':''}">AT_RISK</span><span class="state ${state.delivered?'active':''}">履约回流</span></div><div class="result-box"><strong>当前缺口：${gap}斤</strong><p class="muted">只有双方确认的数量才进入订单保障；风险变化后重新计算。</p></div></div></div>
<div class="section-title"><h2>锁定台账</h2><span>意愿 ≠ 承诺</span></div><div class="card lock-ledger">${state.softLock||state.hardLocked?`<div class="lock-item"><div><span class="badge ${state.weatherShock&&state.hardLocked?'red':'green'}">${state.hardLocked?'HARD_LOCKED':'SOFT_LOCK'}</span></div><div><strong>成员C · 120斤</strong><div class="muted">${state.hardLocked?(state.weatherShock?'天气冲击后进入AT_RISK，需要重新确认':'数量/价格/条件已确认'):'等待供应方确认 · '+remain+'秒后释放'}</div></div>${state.hardLocked?`<button class="secondary" onclick="deliver()">记录履约</button>`:`<button class="primary" onclick="confirmLock()">确认硬锁</button>`}</div>`:'<p class="muted">当前没有锁定记录。先从候选产能申请软锁。</p>'}${state.delivered?'<div class="lock-item"><span class="badge green">FULFILLED</span><div><strong>部分履约示例</strong><div class="muted">承诺120斤 · 有效交付110斤 · 差额-10斤</div></div><strong>110 / 120</strong></div>':''}</div>`}
function simulator(){const qty=state.orderQty;const physical=qty<=1120;const economic=state.externalCost<=state.economicBoundary;return `<div class="card"><h3>接单模拟器</h3><p>先看产能上敢不敢接，再看经济上值不值得接。</p><div class="form-row" style="margin-top:16px"><div class="field"><label>订单数量（斤）</label><input id="qtyInput" type="number" value="${qty}" min="100" max="2000" /></div><div class="field"><label>订单净价（元/斤）</label><input value="5.8" disabled /></div><div class="field"><label>经济边界（元/斤）</label><input value="${state.economicBoundary}" disabled /></div><div class="field"><label>外部边际成本（元/斤）</label><input value="${state.externalCost}" disabled /></div></div><button class="primary" style="margin-top:14px" onclick="recalc()">重新计算建议</button><div class="result-box"><div class="gate"><span>时间与品质门</span><strong class="pass">通过</strong></div><div class="gate"><span>物理产能门</span><strong class="${physical?'pass':'fail'}">${physical?'可协调':'超过当前可协调上限'}</strong></div><div class="gate"><span>经济门：external-x</span><strong class="${economic?'pass':'fail'}">${economic?'通过':'ECONOMIC_GATE 拒绝'}</strong></div><div class="gate"><span>系统建议</span><strong class="${physical&&economic?'pass':'fail'}">${physical&&economic?'建议承接':'暂不建议承接'}</strong></div></div></div>`}
function render(){const id=current();header(id);$('#content').innerHTML=({today,orders,timeline,collaboration,simulator}[id]||today)(); if(id==='collaboration') startTick(); else stopTick()}
function go(id){location.hash=id}
function shock(){state.weatherShock=true;toast('天气风险已触发，系统重新计算');render()}
function softLock(){state.softLock={expires:Date.now()+30000};toast('软锁已创建，等待成员确认');render()}
function confirmLock(){state.hardLocked=true;state.softLock=null;toast('双方确认完成，已转为硬锁');render()}
function deliver(){state.delivered=true;toast('履约结果已回流');render()}
function recalc(){const n=Number($('#qtyInput').value);if(Number.isFinite(n)&&n>0){state.orderQty=n;toast('已按新订单量重算');render()}}
function reset(){state=seed();toast('演示已重置');render()}
function startTick(){stopTick();timer=setInterval(()=>{if(state.softLock && Date.now()>=state.softLock.expires){state.softLock=null;toast('软锁超时，产能自动释放');render()}else if(current()==='collaboration'&&state.softLock){render()}},1000)}
function stopTick(){if(timer){clearInterval(timer);timer=null}}
window.go=go;window.shock=shock;window.softLock=softLock;window.confirmLock=confirmLock;window.deliver=deliver;window.recalc=recalc;
window.addEventListener('hashchange',render);window.addEventListener('load',()=>{nav();$('#resetBtn').onclick=reset;render()});
