/* SellerScout page: rendering + interactions. Pure logic lives in core.js. */
(function () {
  'use strict';
  const C = window.ScoutCore;
  const $ = id => document.getElementById(id);
  const esc = s => String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const DASH = '—';
  const money = v => v === null ? DASH : '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const plain = v => v === null ? DASH : String(v);
  const cm = v => v == null || !Number.isFinite(v) ? DASH : String(Math.round(v * 100) / 100);
  const TOP = 'Top 50';
  const ALL = '全部合格';
  const salesField = $('maxSales') ? 'maxSales' : 'minSales';
  const salesPreset = Boolean($(salesField));
  const initialFilters = () => salesPreset
    ? { ...C.DEFAULT_FILTERS, minPrice: 100, [salesField]: 30 } : { ...C.DEFAULT_FILTERS };
  const preferredFourth = n => n !== null && (salesPreset ? n <= 50 : n < 50);
  const picks = new Map();
  let rankingError = '';
  const METER = { '推荐看': 3, '可以考虑': 2, '不推荐': 1 };
  const MODE_BADGE = { collected: '一、二档采集数据', mock: 'Mock 演示数据', 'api-sample': 'API 样本', cache: '缓存回放', fixture: '树结构测试数据' };
  const LEGACY_KEY = 'scout-prototype-saved-v1';

  let data, tree, productIndex;
  const evidenceStates = new Map();
  const state = {
    tier: '推荐看', node: '__root__', sort: 'default', page: 1, resultKey: null,
    filters: initialFilters(),
    evidence: new Set(), open: new Set(), mobileTree: false, chartNorm: false,
  };
  let saved = []; // snapshots, order = insertion

  // ---------------- data loading ----------------
  async function fetchJson(url) {
    // Published documents carry their initial datasets, including when opened as files.
    const embedded = document.getElementById(url.split('?')[0]);
    if (embedded && embedded.type === 'application/json') return JSON.parse(embedded.textContent);
    const r = await fetch(url, { cache: 'no-cache' });
    if (!r.ok) throw new Error(`${url} HTTP ${r.status}`);
    return r.json();
  }
  async function loadData() {
    const want = new URLSearchParams(location.search).get('data');
    let raw = null, note = null;
    if (want === 'mock') raw = window.SCOUT_MOCK;
    else if (want && want !== 'api' && want !== 'current') {
      if (/^[\w\-./]+\.json$/.test(want) && !want.includes('..') && !want.startsWith('/')) {
        try { raw = await fetchJson(want); } catch (e) { note = `读取 ${want} 失败，已显示 Mock`; }
      } else note = '数据路径无效，已显示 Mock';
    } else {
      try {
        if (want === 'api') raw = await fetchJson('data/api-sample.json');
        else {
          try { raw = await fetchJson('data/catalog.json?v=dimensions-20261114'); }
          catch { raw = await fetchJson('data/current.json'); }
        }
      }
      catch (e) { note = want === 'api' ? 'API 样本暂不可用，已显示 Mock' : '采集数据暂不可用，已显示 Mock'; }
    }
    if (!raw) raw = window.SCOUT_MOCK;
    const d = C.normalizeDataset(raw);
    d.note = note;
    if (d.mode === 'collected') {
      try {
        const ranking = await fetchJson(salesPreset ? 'data/sales30-directions.json' : 'data/top50.json?v=selection-20261117b');
        if (ranking.dataAsOf !== d.dataAsOf) throw Error('榜单与采集日期不同');
        ranking.items.forEach((item, index) => picks.set(item.categoryId, { ...item, rank: index + 1 }));
        if (salesPreset) for (const c of d.categories) c.direction = picks.get(c.id)?.direction;
      } catch (error) {
        rankingError = '榜单读取失败，请刷新重试';
        console.error(error);
      }
    }
    if (d.issues.length) console.warn('[SellerScout] 数据检查', d.issues);
    return d;
  }

  function indexData() {
    tree = C.buildTree(data.categories);
    productIndex = new Map();
    for (const c of data.categories) for (const p of c.products) if (!productIndex.has(p.id)) productIndex.set(p.id, { p, c });
    const top = tree.root.kids;
    // small samples: open everything; large trees (200+ leaves): only first level, rest on demand
    const openAll = n => { if (n.kids.length) { state.open.add(n.id); n.kids.forEach(openAll); } };
    if (data.categories.length <= 40) top.forEach(openAll);
    else if (top.length <= 12) top.forEach(n => n.kids.length && state.open.add(n.id));
  }

  // ---------------- saved list ----------------
  function storage() { try { return window.localStorage; } catch { return null; } }
  function loadSaved() {
    const ls = storage();
    if (!ls) return saved;
    try { return readSaved(ls); }
    catch { return saved; } // Some embedded browsers expose Storage but throw on getItem.
  }
  function readSaved(ls) {
    let list = C.parseSaved(ls.getItem(C.savedKey(salesPreset ? 'sales30-' + data.mode : data.mode)));
    if (data.mode === 'mock' && !ls.getItem(C.savedKey('mock')) && ls.getItem(LEGACY_KEY)) {
      let legacy = [];
      try { legacy = JSON.parse(ls.getItem(LEGACY_KEY)); } catch { legacy = []; }
      const ids = C.migrateLegacy(legacy, window.SCOUT_MOCK_LEGACY || Object.create(null));
      list = ids.map(id => productIndex.get(id)).filter(Boolean).map(({ p, c }) => C.snapshot(p, c, data.mode));
      try { ls.setItem(C.savedKey('mock'), JSON.stringify(list)); ls.removeItem(LEGACY_KEY); } catch { /* storage full */ }
    }
    const seen = new Set();
    return list.filter(s => !seen.has(s.id) && seen.add(s.id));
  }
  function persistSaved() { const ls = storage(); if (ls) try { ls.setItem(C.savedKey(salesPreset ? 'sales30-' + data.mode : data.mode), JSON.stringify(saved)); } catch { /* ignore */ } }
  const isSaved = id => saved.some(s => s.id === id);
  function toggleSaved(id, catId) {
    if (isSaved(id)) saved = saved.filter(s => s.id !== id);
    else {
      const hit = productIndex.get(id); if (!hit) return;
      const c = data.categories.find(x => x.id === catId && x.products.some(p => p.id === id)) || hit.c;
      saved.push(C.snapshot(hit.p, c, data.mode));
    }
    persistSaved();
  }
  /** Current view of saved items: refresh from live data where the product still exists. */
  function savedItems() {
    return saved.map(s => {
      const hit = productIndex.get(s.id);
      if (!hit) return { snap: s, present: false };
      const c = data.categories.find(x => x.id === s.categoryId && x.products.some(p => p.id === s.id)) || hit.c;
      return { snap: { ...C.snapshot(hit.p, c, data.mode), savedAt: s.savedAt }, present: true };
    }).filter(({ snap }) => snap.pkg?.status === 'pass' && (salesField !== 'maxSales' || snap.sales >= 1));
  }

  // ---------------- view model ----------------
  function fourthOrder(category) {
    return category.fourth !== null && (salesPreset || category.fourthState === 'matched') ? category.fourth : Infinity;
  }
  function view() {
    const all = C.filterCategories(data.categories, state.filters);
    const ranked = [];
    const filtered = new Map(all.map(c => [c.id, c]));
    const parents = new Set();
    for (const pick of picks.values()) {
      const c = filtered.get(pick.categoryId);
      if (!c) continue;
      const eligible = new Map(c.products.map(p => [p.asin, p]));
      const p = (pick.asins || [pick.asin]).map(id => eligible.get(id)).find(p => p && !parents.has(p.parentAsin || p.asin));
      if (!p) continue;
      parents.add(p.parentAsin || p.asin);
      ranked.push({ ...c, products: [p], pick: salesPreset ? { ...pick, rank: ranked.length + 1 } : pick });
      if (ranked.length === 50) break;
    }
    const pool = state.tier === ALL ? all.filter(c => c.products.length)
      : state.tier === TOP ? ranked : all.filter(c => c.tier === state.tier);
    const unitIsCat = state.tier === '不推荐';
    const weight = c => unitIsCat ? 1 : c.products.length;
    const byId = new Map(pool.map(c => [c.id, c]));
    const countOf = n => n.allCats.reduce((s, id) => s + (byId.has(id) ? weight(byId.get(id)) : 0), 0);
    const selected = tree.index.get(state.node) || tree.root;
    const inNode = new Set(selected.allCats);
    let results = pool.filter(c => inNode.has(c.id));
    if (state.tier === TOP) {
      results.sort((a, b) => (salesPreset && state.sort === 'price' ? a.products[0].price - b.products[0].price : 0) || a.pick.rank - b.pick.rank);
    }
    else if (state.sort === 'default') results.sort((a, b) => tree.order.get(a.id) - tree.order.get(b.id));
    else if (state.sort === 'count') results.sort((a, b) => b.products.length - a.products.length || tree.order.get(a.id) - tree.order.get(b.id));
    else if (state.sort === 'name') results.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
    else if (state.sort === 'fourth') results.sort((a, b) => fourthOrder(a) - fourthOrder(b) || tree.order.get(a.id) - tree.order.get(b.id));
    const resultKey = JSON.stringify([state.tier, state.node, state.sort, state.filters]);
    if (resultKey !== state.resultKey) { state.page = 1; state.resultKey = resultKey; }
    let ordered = results;
    if (salesPreset && state.sort === 'price' && !unitIsCat && state.tier !== TOP) {
      const rows = results.flatMap(c => c.products.map(p => ({ c, p })));
      rows.sort((a, b) => a.p.price - b.p.price || a.p.asin.localeCompare(b.p.asin));
      ordered = [];
      for (const { c, p } of rows) {
        const last = ordered[ordered.length - 1];
        if (last && last.id === c.id) last.products.push(p);
        else ordered.push({ ...c, products: [p] });
      }
    }
    const pagination = salesPreset && state.tier === TOP ? C.paginateCategories(ordered, 1, 50, 50) : C.paginateCategories(ordered, state.page);
    state.page = pagination.page;
    return { all, ranked, pool, results, countOf, selected, unitIsCat, pagination };
  }

  // ---------------- header / tiers ----------------
  function renderMode() {
    const live = salesPreset && data.mode === 'collected';
    const label = live ? `已查 ${data.coverage.completed} / ${data.coverage.target} 小类`
      : salesPreset ? '头部缓存试跑' : MODE_BADGE[data.mode] || data.mode;
    const date = data.dataAsOf ? ` · ${esc(String(data.dataAsOf).slice(0, 10))}` : '';
    const other = live ? '<a href="legacy.html">旧方案</a>' : salesPreset ? '' : data.mode === 'mock' ? '<a href="?data=current">看采集数据</a>' : '<a href="?data=mock">看 Mock</a>';
    $('modeBadge').innerHTML = `<span class="mode-dot mode-${esc(data.mode)}" aria-hidden="true"></span>${esc(label)}${date}${data.note ? `<span class="mode-note">${esc(data.note)}</span>` : ''}${other}`;
    const eligible = C.filterCategories(data.categories, initialFilters()).filter(c => c.products.length);
    const total = eligible.reduce((count, c) => count + c.products.length, 0);
    if (salesPreset || data.mode === 'collected') $('modeBadge').insertAdjacentText('afterbegin', `合格 ${total.toLocaleString('en-US')} 款 / ${eligible.length} 小类 · `);
    if (live) {
      $('modeBadge').innerHTML = `<span>默认合格 ${total.toLocaleString('en-US')} 款 / ${eligible.length} 小类</span><span>${esc(data.dataAsOf)}</span>${other}`;
    }
    $('modeBadge').title = live ? label + ' · ' + data.source : data.source || '';
  }
  function renderTiers(v) {
    const tiers = data.mode === 'collected' ? [TOP, ...C.TIERS] : salesPreset ? [ALL, ...C.TIERS] : C.TIERS;
    $('tiers').innerHTML = tiers.map(t => {
      const cats = t === ALL ? v.all.filter(c => c.products.length) : t === TOP ? v.ranked : v.all.filter(c => c.tier === t);
      const n = cats.reduce((total, c) => total + c.products.length, 0);
      const numbers = t === '不推荐' ? '暂缓方向' : t === TOP ? `<b>${n}</b> 个方向 · 每类 1 款` : `<b>${n}</b> 款 · ${cats.length} 小类`;
      return `<button class="tier${state.tier === t ? ' active' : ''}" data-tier="${t}" aria-pressed="${state.tier === t}">
        <strong>${t}</strong><span class="tier-num">${numbers}</span></button>`;
    }).join('');
  }

  // ---------------- tree ----------------
  function labelHtml(n) {
    const pre = n.labels.slice(0, -1);
    return (pre.length ? `<span class="tpre">${pre.map(esc).join(' › ')} › </span>` : '') + `<span class="tname">${esc(n.labels[n.labels.length - 1])}</span>`;
  }
  function renderTree(v) {
    $('tree').classList.toggle('no-counts', v.unitIsCat);
    const trail = new Set(C.nodeTrail(v.selected).map(n => n.id));
    const searching = !!state.filters.query.trim();
    const rows = [];
    const visit = (n, level) => {
      const count = v.countOf(n);
      if (count === 0 && !trail.has(n.id)) return;
      const hasKids = n.kids.some(k => v.countOf(k) > 0 || trail.has(k.id));
      const open = hasKids && (searching || state.open.has(n.id));
      const sel = v.selected.id === n.id;
      rows.push(`<li role="none"><div role="treeitem" class="trow${sel ? ' sel' : ''}${trail.has(n.id) && !sel ? ' trail' : ''}" style="--lv:${level}" aria-level="${level}" aria-selected="${sel}"${hasKids ? ` aria-expanded="${open}"` : ''} tabindex="${sel ? 0 : -1}" data-node="${esc(n.id)}">
        <span class="caret${hasKids ? '' : ' none'}" data-caret="${esc(n.id)}" aria-hidden="true"></span><span class="tlabel">${labelHtml(n)}</span><span class="tcount${count ? '' : ' zero'}">${count}</span></div>`);
      if (open) { rows.push('<ul role="group">'); n.kids.forEach(k => visit(k, level + 1)); rows.push('</ul>'); }
      rows.push('</li>');
    };
    tree.root.kids.forEach(k => visit(k, 2));
    const rootSel = v.selected === tree.root;
    const total = v.countOf(tree.root);
    $('treeUnit').textContent = v.unitIsCat ? '' : '商品数';
    $('tree').innerHTML = `<li role="none"><div role="treeitem" class="trow root${rootSel ? ' sel' : ''}" style="--lv:1" aria-level="1" aria-selected="${rootSel}" tabindex="${rootSel ? 0 : -1}" data-node="__root__"><span class="caret none" aria-hidden="true"></span><span class="tlabel"><span class="tname">全部类目</span></span><span class="tcount">${total}</span></div></li>${rows.join('')}`;
    $('treeToggle').innerHTML = `类目：<b>${esc(rootSel ? '全部类目' : v.selected.labels[v.selected.labels.length - 1])}</b><span class="tt-caret" aria-hidden="true"></span>`;
    $('treeToggle').setAttribute('aria-expanded', state.mobileTree);
    document.querySelector('.tree-panel').classList.toggle('open', state.mobileTree);
  }
  function selectNode(id, focus) {
    const n = tree.index.get(id) || tree.root;
    state.node = n.id;
    for (const a of C.nodeTrail(n)) if (a.kids.length) state.open.add(a.id);
    state.mobileTree = false;
    render();
    if (focus) focusRow(n.id);
  }
  function focusRow(id) { const el = document.querySelector(`#tree [data-node="${CSS.escape(id)}"]`); if (el) el.focus(); }
  function onTreeKey(e) {
    const row = e.target.closest('.trow'); if (!row) return;
    const rows = [...document.querySelectorAll('#tree .trow')];
    const i = rows.indexOf(row), id = row.dataset.node, n = tree.index.get(id);
    const move = j => { if (rows[j]) { rows.forEach(r => r.tabIndex = -1); rows[j].tabIndex = 0; rows[j].focus(); } };
    if (e.key === 'ArrowDown') move(i + 1);
    else if (e.key === 'ArrowUp') move(i - 1);
    else if (e.key === 'Home') move(0);
    else if (e.key === 'End') move(rows.length - 1);
    else if (e.key === 'ArrowRight') {
      if (row.getAttribute('aria-expanded') === 'false') { state.open.add(id); render(); focusRow(id); }
      else if (row.getAttribute('aria-expanded') === 'true') move(i + 1);
    } else if (e.key === 'ArrowLeft') {
      if (row.getAttribute('aria-expanded') === 'true' && !state.filters.query.trim()) { state.open.delete(id); render(); focusRow(id); }
      else if (n && n.parent && n.parent.id !== '__root__') focusRow(n.parent.id);
      else focusRow('__root__');
    } else if (e.key === 'Enter' || e.key === ' ') selectNode(id, true);
    else return;
    e.preventDefault();
  }

  // ---------------- results ----------------
  function crumbs(v) {
    const trail = C.nodeTrail(v.selected);
    const parts = [`<button class="crumb" data-node="__root__">全部类目</button>`];
    trail.forEach((n, i) => {
      const last = i === trail.length - 1;
      const text = n.labels.map(esc).join(' › ');
      parts.push(last ? `<span class="crumb cur" aria-current="page">${text}</span>` : `<button class="crumb" data-node="${esc(n.id)}">${text}</button>`);
    });
    if (!trail.length) parts[0] = '<span class="crumb cur" aria-current="page">全部类目</span>';
    $('crumbs').innerHTML = parts.join('<span class="crumb-sep" aria-hidden="true">›</span>');
    const prods = v.results.reduce((s, c) => s + c.products.length, 0);
    $('resultCount').innerHTML = v.unitIsCat ? '' : `<b>${v.results.length}</b> 个小类${v.unitIsCat ? '' : ` · <b>${prods}</b> 款商品`}`;
    const dirty = (salesPreset && (state.filters.minPrice !== 100 || state.filters[salesField] !== 30)) || state.node !== '__root__' || state.filters.query || state.filters.seller !== 'all' || state.filters.fulfillment !== 'all' || state.filters.size !== 'pass';
    $('resetAll').hidden = !dirty;
  }

  function tags(p) {
    const basis = p.sellerBasis ? esc(p.sellerBasis) : (p.seller === 'VC' ? 'Amazon 自营销售' : p.seller === 'SC' ? '第三方卖家' : '') + (p.sellerName ? '：' + esc(p.sellerName) : '');
    const s = p.seller === '未知' ? `<span class="tag unknown"${basis ? ` title="${basis}"` : ''}>销售方未知</span>` : `<span class="tag ${p.seller === 'VC' ? 'vc' : ''}" title="${basis}">${p.seller}</span>`;
    const f = p.fulfillment === '未知' ? '<span class="tag unknown">配送未知</span>' : `<span class="tag">${p.fulfillment}</span>`;
    return s + f + (p.nameIsOriginal ? '<span class="tag pending">未翻译</span>' : '');
  }
  function pkgHtml(p) {
    const k = p.pkg;
    const sizeNote = k.sizeLabel ? `<span class="tag fee-label" title="${k.sizeLabel === 'AHS' ? '公式值超过 108 至 130 英寸' : '公式值超过 130 英寸'} · 附加费提示">${esc(k.sizeLabel)}</span>` : '';
    return `<div class="pkg"><span class="pkg-badge pass">合格</span>${sizeNote}<details class="package-detail"><summary>包装尺寸</summary>${k.dimsInches.map(cm).join(' × ')} 英寸 · 长 + 2 ×（宽 + 高）= ${cm(k.formulaInches)} 英寸${k.sizeLabel ? ` · ${esc(k.sizeLabel)}（尺寸附加费提示）` : ''}</details></div>`;
  }
  function imageHtml(p) {
    const img = p.image ? `<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" decoding="async" width="112" height="112">` : '<span class="noimg">暂无图片</span>';
    if (p.productUrl) return `<a class="pimg" href="${esc(p.productUrl)}" target="_blank" rel="noopener noreferrer" aria-label="在 Amazon 打开 ${esc(p.asin || p.name)}">${img}</a>`;
    return `<div class="pimg nolink" title="${data.mode === 'mock' ? 'Mock 商品没有真实 ASIN' : '缺少商品链接'}">${img}</div>`;
  }
  const metric = (label, value, cls) => `<div class="metric${cls ? ' ' + cls : ''}"><small>${label}</small><b${value === DASH ? ' aria-label="未知"' : ''}>${value}</b></div>`;
  function productRow(p, c) {
    const on = isSaved(p.id);
    return `<div class="product">
      ${imageHtml(p)}
      <div class="pinfo"><div class="ptitle" title="${esc(p.originalTitle || p.name)}">${esc(p.name)}</div>${p.highlights.length ? `<div class="phl">${p.highlights.map(h => `<span>${esc(h)}</span>`).join('')}</div>` : ''}
        <div class="pmeta">${tags(p)}</div>${p.review && p.review.note ? `<div class="purpose-note">${esc(p.review.note)}</div>` : ''}${pkgHtml(p)}</div>
      <div class="metrics">${metric('售价', money(p.price), 'price')}${metric('月销量', p.sales === null ? DASH : p.sales + ' 件')}${metric('上架日期', plain(p.date), 'date')}${metric('变体数', plain(p.variationCount))}${metric('FBA费用', money(p.fbaFee))}</div>
      <button class="save${on ? ' on' : ''}" data-save="${esc(p.id)}" data-cat="${esc(c.id)}" aria-pressed="${on}">${on ? '✓ 已加入' : '加入备选'}</button></div>`;
  }
  function fourthText(c) {
    if (c.fourth === null) return `<b>${c.fourthState === 'conflict' ? '排名冲突' : '未取得'}</b>`;
    const conflict = c.fourthState === 'conflict' ? `<span class="pill warn" title="${esc(c.fourthRule || "多条第4名记录不一致")}">记录冲突</span>` : '';
    const priority = !salesPreset && !conflict && preferredFourth(c.fourth) ? '<span class="pill ok">低于50</span>' : '';
    const date = c.rankDate && c.rankDate !== data.dataAsOf ? ` <small>${esc(c.rankDate)}</small>` : '';
    return `<b>${c.fourth} 件</b>${date}${conflict}${priority}`;
  }
  const SEASON_TEXT = { partial: '缺月', missing: '无数据', incomparable: '不可比' };
  function spreadText(c) {
    const s = C.seasonality(c);
    if (s.maxIndividual === null) return `<b class="muted">${esc(s.reason || '缺月')}</b>`;
    const tail = s.composite !== null ? `<span class="sub">综合 ${s.composite}%</span>` : `<span class="sub">${esc(s.reason || '')}，不算综合</span>`;
    return `<b>单款最高 ${s.maxIndividual}%</b>${tail}`;
  }
  function topThreeText(c) {
    if (c.topThreeReasons === null) return '';
    if (c.topThreeComplete) return '前三名：3 个独立父体';
    const parts = c.topThreeReasons.map(r => {
      if (r.rank === null) return '同一父体占多个名次';
      const what = r.reason === 'multiple_parents' ? `有 ${r.parents} 个父体` : r.reason === 'units_differ' ? '子体销量不一致' : '未返回';
      return `第${r.rank}名${what}`;
    });
    return parts.length ? `前三名不成立：${parts.join('；')}` : '';
  }
  function rankDetails(c) {
    if (c.evidenceUrl && evidenceStates.get(c.id) !== 'loaded') return `<p class="rank-status">${evidenceStates.get(c.id) === 'error' ? '排名明细读取失败，收起后重试' : '正在读取排名明细…'}</p>`;
    const rows = (c.rankEvidence && c.rankEvidence['4']) || [];
    if (!rows.length) return '';
    const vals = rows.map(r => r.units).filter(v => v !== null);
    const used = vals.length ? Math.max(...vals) : null;
    const asinCell = a => /^[A-Z0-9]{10}$/.test(a || '') ? `<a href="https://www.amazon.com/dp/${a}" target="_blank" rel="noopener noreferrer">${a}</a>` : esc(a || DASH);
    return `<details class="rankdet"><summary>第4名记录 ${rows.length} 条</summary><div class="tablewrap"><table><thead><tr><th scope="col">ASIN</th><th scope="col">父体</th><th scope="col">月销</th></tr></thead><tbody>${rows.map(r => {
      const isUsed = r.units !== null && r.units === used && rows.length > 1;
      return `<tr${isUsed ? ' class="used"' : ''}><td>${asinCell(r.asin)}</td><td>${esc(r.parentAsin || DASH)}</td><td>${r.units === null ? DASH : r.units}${isUsed ? '<span aria-hidden="true"> ✓</span><span class="sr">（采用）</span>' : ''}</td></tr>`;
    }).join('')}</tbody></table></div></details>`;
  }
  function monthLabel(m, i) { const [y, mo] = m.split('-'); return (i === 0 || mo === '01') ? `${y.slice(2)}年${+mo}月` : `${+mo}月`; }
  function evidencePanel(c) {
    const s = C.seasonality(c);
    const maxK = s.maxHead ? s.heads.indexOf(s.maxHead) : -1;
    const rowsHtml = c.series.map((a, k) => `<tr${k === maxK ? ' class="max"' : ''}><th scope="row">${esc(a.label)}${a.asin ? `<small>${esc(a.asin)}</small>` : ''}</th>${a.units.map(v => `<td>${v === null ? DASH : v}</td>`).join('')}<td class="sp">${s.heads[k].highLow === null ? DASH : s.heads[k].highLow + '%'}</td></tr>`).join('');
    const legend = c.series.map((a, k) => `<span class="lg lg${k}"><i></i>${esc(a.label)}</span>`).join('');
    const src = data.mode === 'mock' ? 'Mock 曲线' : [...new Set(c.series.map(a => a.source).filter(Boolean))].join('、') || '来源未标注';
    const maxText = s.maxHead ? `单款最高 ${s.maxIndividual}%（${esc(s.maxHead.label)}）` : '';
    const verdict = s.composite !== null
      ? `三款各按自身全年均值标准化后等权，高低三个月相差 ${s.composite}%。${maxText}。`
      : s.maxIndividual !== null ? `${esc(s.reason)}，不算综合值。${maxText}。` : `${esc(s.reason || '缺月')}，不计算波动。`;
    const fourthNote = c.fourthRule ? esc(c.fourthRule)
      : c.fourth === null ? (c.fourthState === 'conflict' ? '多条排名记录冲突' : '未取得第4名数据')
      : preferredFourth(c.fourth) ? '符合第 4 名月销优先条件' : '未达到第 4 名月销优先条件';
    const top3 = topThreeText(c);
    const hasChart = c.series.length && c.months.length;
    const seg = hasChart ? `<div class="seg" role="group" aria-label="曲线口径"><button data-norm="0" aria-pressed="${!state.chartNorm}">原始销量</button><button data-norm="1" aria-pressed="${state.chartNorm}">按各自均值</button></div>` : '';
    return `${c.entryReason ? `<div class="entry-basis"><b>原分档依据</b><p>${esc(c.entryReason)}</p></div>` : ''}<div class="evidence">
      <div class="fourth"><small>小类 BSR 第4名月销</small><strong>${c.fourth === null ? DASH : c.fourth}<span>件</span></strong>
 <p>${fourthNote}${c.rankDate ? ` · ${esc(c.rankDate)}` : ''}</p>${rankDetails(c)}
        <a class="ext" href="${esc(c.bestsellerUrl)}" target="_blank" rel="noopener noreferrer">小类畅销榜 ↗</a></div>
      <div class="trend"><div class="trend-head"><b>当前前三名近12个月父体月销</b>${seg}<div class="legend">${legend}</div></div>
        ${hasChart ? `<canvas data-chart="${esc(c.id)}" role="img" aria-label="${esc(c.name)}前三名近12个月月销量走势，数值见下方表格"></canvas>` : '<p class="nodata">暂无走势数据</p>'}
 ${top3 ? `<p class="top3">${esc(top3)}</p>` : ''}
        ${hasChart ? `<div class="trendtip" id="tip-${esc(c.id)}" aria-live="polite">${verdict}</div>
        <details class="mtable"><summary>逐月数值 · ${esc(src)}</summary>${c.trendBasis ? `<p class="top3">${esc(c.trendBasis)}</p>` : ''}<div class="tablewrap"><table><thead><tr><th scope="col">排名</th>${c.months.map((m, i) => `<th scope="col">${monthLabel(m, i)}</th>`).join('')}<th scope="col">高低月差</th></tr></thead><tbody>${rowsHtml}</tbody></table></div></details>` : ''}</div></div>`;
  }
  function categoryCard(c) {
    const ex = state.evidence.has(c.id);
    const deferred = c.collectionState === 'not-collected';
    const count = c.pageCategoryTotal === undefined ? c.products.length : c.pageCategoryTotal;
    const countText = count > c.products.length ? `本页 ${c.products.length} / 共 ${count} 款` : `${count} 款`;
    const reason = c.pick?.notesByAsin?.[c.products[0]?.asin] || c.pick?.reason || (deferred ? (c.reason || c.entryReason) : null);
    const body = c.products.length ? c.products.map(p => productRow(p, c)).join('')
      : deferred ? '' : `<p class="no-picks">${esc(c.reason || '当前筛选下没有符合条件的商品')}</p>`;
    return `<article class="cat tier-${METER[c.tier]}" data-category="${esc(c.id)}">
      <header class="cat-head"><div class="cat-title"><h3>${c.pick ? `<span class="rank-no">#${c.pick.rank}</span> ${esc(c.pick.direction)}` : esc(c.name)}</h3><a class="cat-amazon-link" href="${esc(c.url)}" target="_blank" rel="noopener noreferrer" title="在 Amazon 查看此小类" aria-label="在 Amazon 新标签页打开${esc(c.name)}小类"><span aria-hidden="true">↗</span></a>${c.pick ? `<button class="link-btn" data-browse="${esc(c.id)}">查看小类 · ${esc(c.name)}</button>` : count ? `<span class="cat-count">${countText}</span>` : deferred ? '<span class="cat-count">未采商品</span>' : ''}</div></header>
      ${reason ? `<p class="cat-reason">${esc(reason)}</p>` : ''}
      ${deferred ? '' : `<div class="signals"><span>第4名月销 ${fourthText(c)}</span><span>全年高低月差 ${spreadText(c)}</span>
        <button class="link-btn" data-expand="${esc(c.id)}" aria-expanded="${ex}">${ex ? '收起走势' : '走势与依据'}</button></div>
      ${ex ? evidencePanel(c) + relatedProducts(c) : ''}`}
      ${body ? `<div class="plist">${body}</div>` : ''}</article>`;
  }
  function relatedProducts(c) {
    const related = (c.pick?.relatedAsins || []).map(id => productIndex.get(id)).filter(hit => hit?.p.pkg.status === 'pass');
    if (!related.length) return '';
    return `<div class="entry-basis"><b>合并的同方向商品</b>${related.map(({p, c: category}) => `<p><a href="${esc(p.productUrl)}" target="_blank" rel="noopener noreferrer">${esc(p.name)}</a> · ${esc(category.name)}</p>`).join('')}</div>`;
  }
  async function toggleEvidence(id) {
    if (state.evidence.has(id)) state.evidence.delete(id);
    else state.evidence.add(id);
    const c = data.categories.find(x => x.id === id);
    if (!c) return;
    const opening = state.evidence.has(id);
    if (opening && c.evidenceUrl && !['loaded', 'loading'].includes(evidenceStates.get(id))) {
      evidenceStates.set(id, 'loading');
      refreshCategory(id);
      try {
        const payload = await fetchJson(c.evidenceUrl);
        if (payload.categoryId !== id || payload.dataAsOf !== data.dataAsOf) throw Error('排名明细与目录不匹配');
        c.rankEvidence = C.normalizeRankEvidence(payload.rankEvidence);
        evidenceStates.set(id, 'loaded');
      } catch (error) { evidenceStates.set(id, 'error'); console.warn('[SellerScout] 排名明细读取失败', error); }
    }
    refreshCategory(id);
  }
  function refreshCategory(id) {
    if (state.sort === 'price') { render(); return; }
    const card = document.querySelector(`[data-category="${CSS.escape(id)}"]`);
    const c = view().pagination.items.find(x => x.id === id);
    if (card && c) { card.outerHTML = categoryCard(c); requestAnimationFrame(drawCharts); }
  }
  function refreshSavedButtons() {
    $('savedCount').textContent = savedItems().length;
    document.querySelectorAll('[data-save]').forEach(button => {
      const on = isSaved(button.dataset.save);
      button.classList.toggle('on', on); button.setAttribute('aria-pressed', String(on));
      button.textContent = on ? '✓ 已加入' : '加入备选';
    });
  }
  function emptyState(v) {
    if (salesPreset && (!Number.isFinite(state.filters.minPrice) || !Number.isFinite(state.filters[salesField])))
      return salesField === 'maxSales' ? '<div class="empty">最低售价须 ≥100 美元，最高父体月销须为至少 1 件的整数。</div>' : '<div class="empty">最低售价须为 100 美元以上，最低月销须为 30 件以上的整数（含边界）。</div>';
    if (state.tier === TOP && rankingError) return `<div class="empty">${rankingError}</div>`;
    if (v.pool.length && !v.results.length) return '<div class="empty"><h3>这个类目没有匹配结果</h3><button class="btn" data-node="__root__">返回全部类目</button></div>';
    return '<div class="empty"><h3>当前筛选下没有匹配结果</h3><button class="btn ghost" id="reset">清除筛选</button></div>';
  }
  function pagerHtml(v) {
    const p = v.pagination;
    if (p.totalPages <= 1) return '';
    return `<nav class="list-pager" aria-label="结果分页"><span>每页最多 ${v.unitIsCat ? '20 个小类' : '40 款'}</span><div>
      <button class="btn small" data-page="${p.page - 1}" ${p.page === 1 ? 'disabled' : ''}>上一页</button>
      <select data-page-select aria-label="跳转结果页">${Array.from({length:p.totalPages},(_,i)=>`<option value="${i+1}" ${p.page===i+1?'selected':''}>第 ${i+1} / ${p.totalPages} 页</option>`).join('')}</select>
      <button class="btn small" data-page="${p.page + 1}" ${p.page === p.totalPages ? 'disabled' : ''}>下一页</button></div></nav>`;
  }
  function renderList(v) {
    if (!v.results.length) { $('list').innerHTML = emptyState(v); return; }
    if (v.unitIsCat) {
      const meanings = [
        ['燃油或排气', '燃油与排气件需专门适配'],
        ['制动系统', '需专门供应链的制动件'],
        ['液体、化学', '液体、化学养护与涂料'],
        ['涉及转向', '转向、承载与乘员防护'],
      ];
      const groups = new Map();
      for (const c of v.results) {
        const label = meanings.find(([prefix]) => c.reason?.startsWith(prefix))?.[1] || '原分档原因待核';
        if (!groups.has(label)) groups.set(label, []);
        groups.get(label).push(c);
      }
      $('list').innerHTML = [...groups].map(([label, cats]) => `<details class="deferred-group"><summary>${esc(label)}</summary><ul>${cats.map(c => `<li><a href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">${esc(c.name)}</a></li>`).join('')}</ul></details>`).join('');
      return;
    }
    let prev = null;
    const groupKey = c => c.path.slice(1, -1).map(n => n.name).join(' › ') || '汽配';
    const groups = new Map();
    for (const c of v.results) groups.set(groupKey(c), (groups.get(groupKey(c)) || 0) + 1);
    const pager = pagerHtml(v);
    $('list').innerHTML = pager + v.pagination.items.map(c => {
      let head = '';
      if (state.sort === 'default' && state.tier !== TOP) {
        const key = groupKey(c);
        if (key !== prev) head = `<h2 class="group">${esc(key)}<small>${groups.get(key)} 个小类</small></h2>`;
        prev = key;
      }
      return head + categoryCard(c);
    }).join('') + pager;
  }
  function goPage(value) {
    state.page = Number(value); render();
    document.querySelector('.resultbar').scrollIntoView({block:'start'});
  }

  function render() {
    const v = view();
    renderTiers(v); renderTree(v); crumbs(v); renderList(v);
    $('sellerFilter').value = state.filters.seller; $('fulfillFilter').value = state.filters.fulfillment;
    const rankedSort = salesPreset && state.tier === TOP && $('sort').querySelector('[value="rank"]');
    $('sort').hidden = (state.tier === TOP && !rankedSort) || v.unitIsCat;
    for (const option of $('sort').options) {
      option.hidden = rankedSort ? !['rank', 'price'].includes(option.value) : option.value === 'rank';
    }
    $('sort').value = state.sort;
    if (salesPreset) {
      for (const id of ['minPrice', salesField]) {
        const input = $(id);
        input.disabled = v.unitIsCat;
        if (document.activeElement !== input) input.value = state.filters[id] === Infinity ? '' : state.filters[id];
        input.setAttribute('aria-invalid', String(!input.validity.valid));
      }
    }
    for (const id of ['sellerFilter', 'fulfillFilter']) $(id).disabled = v.unitIsCat;
    if ($('search').value.trim() !== state.filters.query) $('search').value = state.filters.query;
    $('savedCount').textContent = savedItems().length;
    requestAnimationFrame(drawCharts);
  }

  // ---------------- charts ----------------
  const LINE = [{ c: '#22262d', d: [] }, { c: '#c98a0b', d: [7, 4] }, { c: '#6f7f9e', d: [2, 3] }];
  function drawCharts() {
    document.querySelectorAll('canvas[data-chart]').forEach(cv => {
      const c = data.categories.find(x => x.id === cv.dataset.chart); if (!c) return;
      const w = cv.clientWidth, h = cv.clientHeight, dpr = window.devicePixelRatio || 1; if (!w) return;
      cv.width = w * dpr; cv.height = h * dpr;
      const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);
      const n = c.months.length, L = 36, R = w - 10, T = 10, B = h - 24;
      // normalised view: each head divided by its own mean, so a small seasonal seller is not flattened by a large one
      const plotted = c.series.map(s => {
        if (!state.chartNorm) return s.units;
        const known = s.units.filter(v => v !== null), mean = known.length ? known.reduce((a, b) => a + b, 0) / known.length : 0;
        return s.units.map(v => v === null || !(mean > 0) ? null : v / mean);
      });
      const vals = plotted.flat().filter(v => v !== null);
      const max = state.chartNorm ? Math.max(1, Math.ceil(Math.max(0, ...vals) * 2) / 2) : Math.max(10, Math.ceil(Math.max(0, ...vals) / 50) * 50);
      const tick = v => state.chartNorm ? v.toFixed(1) + "×" : String(Math.round(v));
      const x = m => n > 1 ? L + (R - L) * m / (n - 1) : (L + R) / 2;
      ctx.font = '11px "Segoe UI", "Microsoft YaHei", sans-serif'; ctx.textAlign = 'right';
      for (let i = 0; i < 4; i++) {
        const y = T + (B - T) * i / 3;
        ctx.strokeStyle = '#ebe9e3'; ctx.setLineDash([]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(R, y); ctx.stroke();
        ctx.fillStyle = '#80848c'; ctx.fillText(tick(max * (1 - i / 3)), L - 6, y + 4);
      }
      ctx.textAlign = 'center';
      c.months.forEach((m, i) => { if (w > 520 || i % 2 === 0) ctx.fillText(monthLabel(m, i), x(i), h - 6); });
      c.series.forEach((s, k) => {
        const st = LINE[k] || LINE[0];
 ctx.strokeStyle = st.c; ctx.lineWidth = 2; ctx.setLineDash(st.d); ctx.beginPath();
 let pen = false;
        plotted[k].forEach((v, m) => { if (v === null) { pen = false; return; } const y = B - v / max * (B - T); pen ? ctx.lineTo(x(m), y) : ctx.moveTo(x(m), y); pen = true; });
 ctx.stroke();
        ctx.setLineDash([]); ctx.fillStyle = st.c;
        plotted[k].forEach((v, m) => { if (v !== null && (plotted[k][m - 1] === null || plotted[k][m - 1] === undefined) && (plotted[k][m + 1] === null || plotted[k][m + 1] === undefined)) { ctx.beginPath(); ctx.arc(x(m), B - v / max * (B - T), 2.5, 0, 7); ctx.fill(); } });
      });
      const tip = document.getElementById('tip-' + c.id), base = tip ? tip.textContent : '';
      cv.onmousemove = e => {
        const m = Math.max(0, Math.min(n - 1, Math.round((e.offsetX - L) / (R - L) * (n - 1))));
        if (tip) tip.textContent = `${monthLabel(c.months[m], 0)}：` + c.series.map(s => `${s.label} ${s.units[m] === null ? '缺' : s.units[m] + ' 件'}`).join(' / ');
      };
      cv.onmouseleave = () => { if (tip) tip.textContent = base; };
    });
  }

  // ---------------- saved dialog + export ----------------
  function savedRender() {
    const items = savedItems();
    $('savedTotal').textContent = items.length ? `${items.length} 款` : '';
    $('exportSaved').disabled = !items.length;
    $('savedList').innerHTML = items.length ? `<div class="tablewrap"><table class="savedtable"><thead><tr><th>图片</th><th>商品 / 亮点</th><th>类目</th><th>售价 / 月销</th><th>销售 / 配送</th><th>包装尺寸</th><th>变体 / FBA费用</th><th><span class="sr">操作</span></th></tr></thead><tbody>${items.map(({ snap: s, present }) => {
      const img = s.image ? `<img src="${esc(s.image)}" alt="${esc(s.name)}" loading="lazy" decoding="async" width="56" height="56">` : '<span class="noimg">暂无图片</span>';
      return `<tr class="${present ? '' : 'stale'}"><td>${s.productUrl ? `<a href="${esc(s.productUrl)}" target="_blank" rel="noopener noreferrer">${img}</a>` : img}</td>
        <td class="stitle"><strong>${esc(s.name)}</strong>${(s.highlights || []).length ? `<p>${s.highlights.map(esc).join(' · ')}</p>` : ''}<p>${s.asin ? esc(s.asin) + ' · ' : ''}上架 ${plain(s.date)}${present ? '' : ' · <span class="pill warn">当前数据未找到</span>'}</p></td>
        <td>${s.categoryUrl ? `<a href="${esc(s.categoryUrl)}" target="_blank" rel="noopener noreferrer">${esc(s.category)} ↗</a>` : esc(s.category)}</td>
 <td class="num">${money(s.price)}<br>${s.sales === null ? DASH : s.sales + ' 件 / 月'}</td>
        <td>${esc(s.seller)}<br>${esc(s.fulfillment)}</td><td>${s.pkg ? pkgHtml({ pkg: s.pkg }) : DASH}</td>
 <td class="num">${s.variationCount === null ? DASH : s.variationCount + ' 个'}<br>${money(s.fbaFee)}</td>
        <td><button class="btn small" data-remove="${esc(s.id)}">移除</button></td></tr>`;
    }).join('')}</tbody></table></div>` : '<div class="saved-empty">还没有备选商品</div>';
  }
  let xlsxPromise;
  function loadXlsx() {
    if (window.XLSX) return Promise.resolve();
    if (!xlsxPromise) xlsxPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script'); script.src = 'vendor/xlsx.full.min.js'; script.async = true;
      script.onload = () => { if (window.XLSX) resolve(); else { script.remove(); xlsxPromise = null; reject(Error('Excel组件未就绪')); } };
      script.onerror = () => { script.remove(); xlsxPromise = null; reject(Error('Excel组件读取失败')); };
      document.head.append(script);
    });
    return xlsxPromise;
  }
  async function exportSaved() {
    const items = savedItems(); if (!items.length) return;
    const button = $('exportSaved'); button.disabled = true; button.textContent = '正在准备…';
    try {
      await loadXlsx();
      const wb = C.buildWorkbook(window.XLSX, items, data.mode);
      const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date());
      const tag = data.mode === 'api-sample' ? '' : '-' + (C.MODE_TEXT[data.mode] || data.mode);
      window.XLSX.writeFile(wb, `SellerScout-备选商品${tag}-${day}.xlsx`, { compression: true });
    } catch (e) {
      console.error(e);
      const p = document.createElement('p'); p.className = 'export-error'; p.textContent = '导出失败，请重试'; $('savedList').prepend(p);
    } finally { button.disabled = !savedItems().length; button.textContent = '下载 Excel'; }
  }

  // ---------------- events ----------------
  function bind() {
    document.addEventListener('click', e => {
      const caret = e.target.closest('[data-caret]');
      if (caret && caret.closest('#tree')) {
 const id = caret.dataset.caret;
        if (!state.filters.query.trim()) { state.open.has(id) ? state.open.delete(id) : state.open.add(id); renderTree(view()); focusRow(id); }
 return;
      }
      const t = e.target.closest('[data-node],[data-tier],[data-expand],[data-save],[data-remove],[data-browse],[data-norm],[data-page],#reset,#resetAll,#treeToggle');
      if (!t) return;
      if (t.dataset.node !== undefined) selectNode(t.dataset.node, !!t.closest('#tree'));
      else if (t.dataset.tier) {
        state.tier = t.dataset.tier;
        if (salesPreset && state.sort !== 'price') state.sort = state.tier === TOP ? 'rank' : 'fourth';
        state.node = '__root__'; render();
      }
      else if (t.dataset.expand) { toggleEvidence(t.dataset.expand); }
      else if (t.dataset.save) { toggleSaved(t.dataset.save, t.dataset.cat); refreshSavedButtons(); }
      else if (t.dataset.remove) { saved = saved.filter(s => s.id !== t.dataset.remove); persistSaved(); savedRender(); refreshSavedButtons(); }
      else if (t.dataset.browse) {
        const category = data.categories.find(c => c.id === t.dataset.browse);
        if (category) {
          state.tier = category.tier;
          if (state.sort === 'rank') state.sort = 'fourth';
          state.filters = salesPreset ? { ...state.filters, query: '' } : initialFilters();
          selectNode(category.id, false);
          document.querySelector('.resultbar').scrollIntoView({ block: 'start' });
        }
      }
      else if (t.dataset.page !== undefined) { goPage(t.dataset.page); }
      else if (t.dataset.norm !== undefined) { state.chartNorm = t.dataset.norm === "1"; render(); }
      else if (t.id === 'reset' || t.id === 'resetAll') { state.filters = initialFilters(); state.node = '__root__'; render(); }
      else if (t.id === 'treeToggle') { state.mobileTree = !state.mobileTree; render(); }
    });
    $('tree').addEventListener('keydown', onTreeKey);
    $('sellerFilter').onchange = e => { state.filters.seller = e.target.value; render(); };
    $('fulfillFilter').onchange = e => { state.filters.fulfillment = e.target.value; render(); };
    if (salesPreset) {
      for (const id of ['minPrice', salesField]) {
        $(id).oninput = e => {
          state.filters[id] = e.target.validity.valid ? e.target.valueAsNumber : Infinity;
          render();
        };
      }
    }
    $('sort').onchange = e => { state.sort = e.target.value; render(); };
    let searchTimer;
    $('search').addEventListener('input', e => { state.filters.query = e.target.value.trim(); clearTimeout(searchTimer); searchTimer = setTimeout(render, 150); });
    document.addEventListener('change', e => { if (e.target.matches('[data-page-select]')) goPage(e.target.value); });
    $('showSaved').onclick = () => { savedRender(); $('savedDialog').showModal(); };
    $('exportSaved').onclick = exportSaved;
    $('closeDialog').onclick = () => $('savedDialog').close();
    document.addEventListener('error', e => {
      const img = e.target;
      if (img && img.tagName === 'IMG' && !img.dataset.failed) { img.dataset.failed = '1'; const s = document.createElement('span'); s.className = 'noimg'; s.textContent = '图片加载失败'; img.replaceWith(s); }
    }, true);
    let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(drawCharts, 120); });
    window.addEventListener('storage', e => { if (e.key === C.savedKey(salesPreset ? 'sales30-' + data.mode : data.mode)) { saved = loadSaved(); render(); } });
  }

  loadData().then(d => {
    data = d;
    if (salesPreset) { state.tier = d.mode === 'collected' ? TOP : ALL; state.sort = state.tier === TOP ? 'rank' : 'fourth'; }
    else if (d.mode === 'collected') state.tier = TOP;
    indexData(); saved = loadSaved(); renderMode(); bind(); render();
    document.body.dataset.mode = data.mode;
    window.__scout = { data, tree, state, saved: () => saved, render };
    document.body.classList.remove('reading-preview');
    document.getElementById('rank-preview')?.remove();
  }).catch(error => {
    console.error('SellerScout 初始化失败', error);
    const status = document.getElementById('preview-status');
    if (status) status.textContent = '当前显示可直接浏览的 Top 50。';
    else $('list').textContent = '选品数据加载失败，请刷新重试。';
  });
})();
