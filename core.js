/* SellerScout UI core: pure functions shared by the page and node tests.
 * Contract: docs/UI_DATA_CONTRACT.md (schemaVersion 1). No DOM access here. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ScoutCore = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const TIERS = ['推荐看', '可以考虑', '不推荐'];
  const SIZE_LIMIT = 169;
  const EPS = 1e-10; // Inches: only absorb machine floating-point noise at inclusive boundaries.

  // ---------- primitive coercion: missing stays null, never 0 ----------
  function num(v) {
    if (v === null || v === undefined || v === '') return null;
    const n = typeof v === 'number' ? v : Number(String(v).replace(/[$,\s]/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  function int(v) { const n = num(v); return n === null ? null : Math.round(n); }
  function str(v) { return v === null || v === undefined ? null : (String(v).trim() || null); }
  function strList(v) { return Array.isArray(v) ? v.map(str).filter(Boolean) : []; }
  function isoDate(v) {
    const s = str(v); if (!s) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
  }
  function safeUrl(v) {
    const s = str(v); if (!s) return null;
    if (/^https?:\/\//i.test(s)) return s;
    if (/^(images|data)\/[\w./-]+$/.test(s)) return s; // same-origin relative assets only
    return null;
  }
  function oneOf(v, allowed, fallback) { return allowed.includes(v) ? v : fallback; }

  // Package inputs remain cm; thresholds and labels use inches, sorted longest first.
  function packageResult(dims, unit) {
    if (unit !== undefined && unit !== null && unit !== 'cm') return { status: 'unknown', value: null, dims: null, reason: 'unit' };
    if (!Array.isArray(dims) || dims.length !== 3) return { status: 'unknown', value: null, dims: null, reason: 'missing' };
    const d = dims.map(num);
    if (d.some(x => x === null || x <= 0 || x > 1000)) return { status: 'unknown', value: null, dims: null, reason: 'invalid' };
    const [l, w, h] = [...d].sort((a, b) => b - a);
    const value = l + 2 * (w + h);
    const dimsInches = [l, w, h].map(x => x / 2.54);
    const formulaInches = value / 2.54;
    const passed = dimsInches[0] <= 48 + EPS && dimsInches[1] <= 30 + EPS && formulaInches <= SIZE_LIMIT + EPS;
    const sizeLabel = formulaInches > 130 + EPS ? 'oversize' : formulaInches > 108 + EPS ? 'AHS' : null;
    return { status: passed ? 'pass' : 'fail', value, dims: [l, w, h], dimsInches, formulaInches, sizeLabel, ruleVersion: '2026-11-14', reason: null };
  }

  function normalizePkg(raw) {
    const p = raw && typeof raw === 'object' ? raw : {};
    const unit = str(p.unit);
    const given = oneOf(p.status, ['pass', 'fail', 'unknown', 'conflict'], null);
    // dims without an explicit cm unit are "unit unknown" -> 待补, never pass
    const calc = unit === 'cm' ? packageResult(p.dims, 'cm') : { status: 'unknown', value: null, dims: null };
    let status = calc.status;
    if (given === 'unknown' || p.reason === 'suspected-placeholder') status = 'unknown';
    else if (given === 'conflict') status = 'conflict';
    else if (calc.status !== 'unknown' && (given === 'pass' || given === 'fail') && given !== calc.status) status = 'conflict';
    return {
      status,
      value: calc.value,
      dims: calc.dims,
      dimsInches: calc.dimsInches || null,
      formulaInches: calc.formulaInches ?? null,
      sizeLabel: status === 'pass' || status === 'fail' ? calc.sizeLabel : null,
      ruleVersion: calc.ruleVersion || null,
      raw: str(p.raw),
      source: str(p.source),
      unit: calc.dims ? 'cm' : str(unit),
      declaredStatus: given,
      reason: str(p.reason),
    };
  }

  // ---------- product / category normalization ----------
  function normalizeSeller(v) { return oneOf(v, ['VC', 'SC'], '未知'); }
  function normalizeFulfillment(v) { return oneOf(v, ['FBA', 'FBM'], '未知'); }

  function normalizeProduct(p, cat, mode, issues) {
    const asin = str(p.asin);
    const id = str(p.id) || asin;
    if (!id) { issues.push(`商品缺少 id/asin（类目 ${cat.id}）`); return null; }
    if (mode !== 'mock' && asin && id !== asin) issues.push(`商品 id 与 ASIN 不一致：${id}`);
    const originalTitle = str(p.originalTitle);
    const zhName = str(p.name);
    const translated = p.translationStatus === 'translated' && !!zhName;
    return {
      id,
      asin,
      parentAsin: str(p.parentAsin),
      name: zhName || originalTitle || asin || id,
      nameIsOriginal: !zhName,
      originalTitle,
      highlights: strList(p.highlights),
      originalHighlights: strList(p.originalHighlights),
      translationStatus: translated ? 'translated' : p.translationStatus === 'partial' ? 'partial' : 'pending',
      image: safeUrl(p.image),
      productUrl: safeUrl(p.productUrl) || (asin && mode !== 'mock' ? `https://www.amazon.com/dp/${asin}` : null),
      price: num(p.price),
      currency: str(p.currency) || 'USD',
      sales: int(p.sales),
      date: isoDate(p.date),
      variationCount: int(p.variationCount),
      fbaFee: num(p.fbaFee),
      seller: normalizeSeller(p.seller),
      sellerName: str(p.sellerName),
      sellerTypeRaw: str(p.sellerTypeRaw),
      sellerBasis: str(p.sellerBasis),
      fulfillmentRaw: str(p.fulfillmentRaw),
      fbaFeeBasis: str(p.fbaFeeBasis),
      fulfillment: normalizeFulfillment(p.fulfillment),
      pkg: normalizePkg(p.pkg),
      sources: p.sources && typeof p.sources === 'object' ? p.sources : {},
      flags: strList(p.flags),
      review: p.review && typeof p.review === 'object' ? { status: str(p.review.status), group: str(p.review.group), note: str(p.review.note) } : null,
    };
  }

  function normalizeSeries(raw, monthCount) {
    if (!Array.isArray(raw)) return [];
    return raw.slice(0, 3).map((s, k) => {
      const units = Array.isArray(s && s.units) ? s.units.map(int) : [];
      while (units.length < monthCount) units.push(null);
      return {
        asin: str(s && s.asin), parentAsin: str(s && s.parentAsin),
        label: str(s && s.label) || `第${k + 1}名`, units: units.slice(0, monthCount), source: str(s && s.source),
      };
    });
  }

  function normalizeRankEvidence(raw) {
    const out = Object.create(null);
    if (!raw || typeof raw !== 'object') return out;
    for (const r of ['1', '2', '3', '4']) {
      const rows = Array.isArray(raw[r]) ? raw[r] : [];
      out[r] = rows.filter(x => x && typeof x === 'object').map(x => ({ asin: str(x.asin), parentAsin: str(x.parentAsin), units: int(x.units), title: str(x.title) }));
    }
    return out;
  }

  function normalizeCategory(c, mode, issues) {
    const id = str(c.id) || str(c.nodeId);
    if (!id) { issues.push('类目缺少节点 id'); return null; }
    let path = Array.isArray(c.path) ? c.path.map(n => ({ id: str(n && n.id), name: str(n && n.name) || str(n && n.originalName), originalName: str(n && n.originalName) })) : [];
    path = path.filter(n => n.id && n.name);
    if (!path.length || path[path.length - 1].id !== id) {
      issues.push(`类目 ${id} 的路径末端与节点不一致，已按单节点处理`);
      path = path.filter(n => n.id !== id).concat([{ id, name: str(c.name) || id, originalName: null }]);
    }
    const months = Array.isArray(c.months) ? c.months.map(str).filter(Boolean) : [];
    const cat = {
      id,
      path,
      name: str(c.name) || path[path.length - 1].name,
      tier: oneOf(c.tier, TIERS, '可以考虑'),
      reason: str(c.reason),
      url: safeUrl(c.url) || `https://www.amazon.com/b?node=${encodeURIComponent(id)}`,
      bestsellerUrl: safeUrl(c.bestsellerUrl) || `https://www.amazon.com/gp/bestsellers/automotive/${encodeURIComponent(id)}`,
      fourth: int(c.fourth),
      fourthState: oneOf(c.fourthState, ['matched', 'missing', 'conflict'], int(c.fourth) === null ? 'missing' : 'matched'),
      fourthAsins: strList(c.fourthAsins),
      fourthRule: str(c.fourthRule),
      fourthConflictKind: str(c.fourthConflictKind),
      rankEvidence: normalizeRankEvidence(c.rankEvidence),
      topThreeComplete: c.topThreeComplete === true,
      topThreeReasons: Array.isArray(c.topThreeReasons) ? c.topThreeReasons.filter(r => r && typeof r === 'object').map(r => ({ rank: int(r.rank), reason: str(r.reason), parents: int(r.parents), values: Array.isArray(r.values) ? r.values.map(int).filter(v => v !== null) : [] })) : null,
      entryPolicySource: str(c.entryPolicySource),
      entryReason: str(c.entryReason),
      displayReason: str(c.displayReason),
      collectionState: str(c.collectionState),
      evidenceUrl: safeUrl(c.evidenceUrl),
      months,
      series: normalizeSeries(c.series, months.length),
      comparability: oneOf(c.comparability, ['comparable', 'unreviewed', 'incomparable'], null),
      trendBasis: str(c.trendBasis),
      seasonalStatus: oneOf(c.seasonalStatus, ['complete', 'partial', 'missing', 'incomparable'], 'missing'),
      products: [],
    };
    const seen = new Set();
    for (const p of Array.isArray(c.products) ? c.products : []) {
      const np = normalizeProduct(p || {}, cat, mode, issues);
      if (!np) continue;
      if (seen.has(np.id)) { issues.push(`类目 ${id} 内重复商品 ${np.id}，已保留第一条`); continue; }
      seen.add(np.id); cat.products.push(np);
    }
    return cat;
  }

  function normalizeDataset(rawData) {
    const issues = [];
    const d = rawData && typeof rawData === 'object' ? rawData : Object.create(null);
    const mode = oneOf(d.mode, ['collected', 'api-sample', 'cache', 'mock', 'fixture'], 'mock');
    if (d.schemaVersion !== 1) issues.push(`schemaVersion=${d.schemaVersion}，期望 1`);
    const categories = [];
    const ids = new Set();
    for (const c of Array.isArray(d.categories) ? d.categories : []) {
      const nc = normalizeCategory(c || {}, mode, issues);
      if (!nc) continue;
      if (ids.has(nc.id)) { issues.push(`重复类目节点 ${nc.id}，已保留第一条`); continue; }
      ids.add(nc.id); categories.push(nc);
    }
    return {
      mode,
      generatedAt: str(d.generatedAt),
      dataAsOf: str(d.dataAsOf),
      source: str(d.source),
      coverage: d.coverage && typeof d.coverage === 'object' ? d.coverage : {},
      categories,
      issues,
    };
  }

  // ---------- filtering ----------
  const DEFAULT_FILTERS = Object.freeze({ seller: 'all', fulfillment: 'all', size: 'pass', query: '' });
  function sizeBucket(p) { return p.pkg.status === 'conflict' ? 'unknown' : p.pkg.status; }
  function matchesProduct(p, f) {
    return (f.minPrice === undefined || (p.price !== null && p.price >= f.minPrice))
      && (f.minSales === undefined || (p.sales !== null && p.sales >= f.minSales))
      && (f.seller === 'all' || p.seller === f.seller)
      && (f.fulfillment === 'all' || p.fulfillment === f.fulfillment)
      && (f.size === 'all' || sizeBucket(p) === f.size);
  }
  function textOf(c) { return [c.name, ...c.path.map(n => n.name), ...c.path.map(n => n.originalName || '')].join(' ').toLowerCase(); }
  function productText(p) { return [p.name, ...p.highlights, p.asin || ''].join(' ').toLowerCase(); }

  /** Apply product filters + search. Returns categories (copies) that should appear for the given tier set.
   *  A category matched by name keeps all its filtered products; otherwise only products matching the query. */
  function filterCategories(categories, f) {
    const q = (f.query || '').trim().toLowerCase();
    const out = [];
    for (const c of categories) {
      let products = c.products.filter(p => matchesProduct(p, f));
      const catHit = !q || textOf(c).includes(q);
      if (!catHit) products = products.filter(p => productText(p).includes(q));
      const visible = products.length > 0 || (c.tier === '不推荐' && catHit);
      if (visible) out.push({ ...c, products });
    }
    return out;
  }

  /** Bound rendered rows while retaining the complete filtered pool for counts/search/export. */
  function paginateCategories(categories, requestedPage = 1, productLimit = 40, categoryLimit = 20) {
    productLimit = Math.max(1, Math.trunc(productLimit) || 40);
    categoryLimit = Math.max(1, Math.trunc(categoryLimit) || 20);
    const pages = [];
    let page = [], rows = 0;
    const flush = () => { if (page.length) pages.push(page); page = []; rows = 0; };
    for (const c of categories) {
      if (!c.products.length) {
        if (page.length >= categoryLimit) flush();
        page.push({ ...c, pageCategoryTotal: 0 });
        continue;
      }
      let offset = 0;
      while (offset < c.products.length) {
        if (rows >= productLimit || page.length >= categoryLimit) flush();
        const slice = c.products.slice(offset, offset + productLimit - rows);
        page.push({ ...c, products: slice, pageCategoryTotal: c.products.length });
        offset += slice.length; rows += slice.length;
      }
    }
    flush();
    const totalPages = Math.max(1, pages.length);
    const currentPage = Math.min(Math.max(1, Math.trunc(requestedPage) || 1), totalPages);
    return { items: pages[currentPage - 1] || [], page: currentPage, totalPages };
  }

  // ---------- tree ----------
  /** Build a tree from full category paths; root (Automotive) is the first path element.
   *  Single-child chains without own categories are compressed into one row (labels joined). */
  function buildTree(categories) {
    const rootNode = { id: '__root__', labels: ['全部类目'], ids: [], children: new Map(), cats: [], depth: 0, parent: null };
    for (const c of categories) {
      let node = rootNode;
      const rest = c.path.length > 1 ? c.path.slice(1) : c.path; // drop Automotive root
      for (const seg of rest) {
 if (!node.children.has(seg.id)) node.children.set(seg.id, { id: seg.id, labels: [seg.name], originals: [seg.originalName], ids: [seg.id], children: new Map(), cats: [], parent: node });
        node = node.children.get(seg.id);
      }
      node.cats.push(c.id);
    }
    const sortKey = n => (n.originals && n.originals[0]) || n.labels[0];
    const finalize = (node, depth) => {
      let kids = [...node.children.values()];
      kids = kids.map(k => {
        while (k.cats.length === 0 && k.children.size === 1) {
   const only = [...k.children.values()][0];
          k.labels = k.labels.concat(only.labels); k.originals = k.originals.concat(only.originals); k.ids = k.ids.concat(only.ids);
   k.cats = only.cats; k.children = only.children; k.id = only.id;
          for (const g of k.children.values()) g.parent = k;
        }
        return k;
      });
      kids.sort((a, b) => sortKey(a).localeCompare(sortKey(b), 'en'));
      node.kids = kids; node.depth = depth;
      for (const k of kids) { k.parent = node; finalize(k, depth + 1); }
      node.allCats = node.cats.concat(...kids.map(k => k.allCats));
      return node;
    };
    finalize(rootNode, 0);
    const index = new Map();
    const order = new Map();
    let i = 0;
    const walk = n => { index.set(n.id, n); for (const id of n.ids) if (!index.has(id)) index.set(id, n); for (const c of n.cats) order.set(c, i++); n.kids.forEach(walk); };
    walk(rootNode);
    return { root: rootNode, index, order };
  }

  /** ancestors of a tree node from root (excluded) to node (included) */
  function nodeTrail(node) { const t = []; for (let n = node; n && n.id !== '__root__'; n = n.parent) t.unshift(n); return t; }

  // ---------- seasonality (S04/S05) ----------
  // Same method as scripts/seasonality.py: high/low = mean of 3 highest months / mean of 3 lowest - 1.
  // The composite normalises every head by its own annual mean and weights them equally, so one
  // large seller cannot drown the others. No threshold here turns a number into "stable".
  function highLow(values) {
    if (!Array.isArray(values) || values.length !== 12 || values.some(v => v === null || !Number.isFinite(v) || v < 0)) return null;
    const s = [...values].sort((a, b) => a - b);
    const lo = s.slice(0, 3).reduce((a, b) => a + b, 0), hi = s.slice(-3).reduce((a, b) => a + b, 0);
    return lo > 0 ? (hi / lo - 1) * 100 : null;
  }
  function seriesSpread(units) { const v = highLow(units); return v === null ? null : Math.round(v); }

  /** Per-head metrics plus an equal-weight normalised composite (only when comparable). */
  function seasonality(c) {
    // Twelve positions are not a year unless they are twelve consecutive calendar months.
    const monthNumbers = c.months.map(m => {
      const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(m);
      return match ? Number(match[1]) * 12 + Number(match[2]) - 1 : null;
    });
    const validCalendar = monthNumbers.length === 12 && monthNumbers.every((m, i) => m !== null && (i === 0 || m === monthNumbers[i - 1] + 1));
    const heads = c.series.map(s => {
      const complete = validCalendar && s.units.length === 12 && s.units.every(v => v !== null && v >= 0);
      const mean = complete ? s.units.reduce((a, b) => a + b, 0) / 12 : null;
      return { label: s.label, asin: s.asin, parentAsin: s.parentAsin, complete, mean, highLow: complete ? seriesSpread(s.units) : null };
    });
    const completeHeads = heads.filter(h => h.complete && h.mean > 0);
    const parents = new Set(heads.map(h => h.parentAsin).filter(Boolean));
    let reason = null;
    if (c.seasonalStatus !== 'complete') reason = c.seasonalStatus === 'missing' ? '无数据' : c.seasonalStatus === 'incomparable' ? '不可比' : '缺月';
    else if (c.months.length !== 12) reason = '月份不足12个';
    else if (!validCalendar) reason = '月份无效、重复或不连续';
    else if (heads.length !== 3) reason = `只有${heads.length}款`;
    else if (completeHeads.length !== 3) reason = c.series.some(s => s.units.some(v => v !== null && v < 0)) ? '销量含负数，数据无效'
      : heads.some(h => !h.complete) ? '缺月' : '有一款全年销量为0';
    else if (parents.size !== 3) reason = '不是3个独立父体';
    else if (c.comparability === 'unreviewed') reason = '样本可比性待核';
    else if (c.comparability === 'incomparable') reason = '样本不可比';
    const individual = heads.map(h => h.highLow).filter(v => v !== null);
    const maxIndividual = individual.length ? Math.max(...individual) : null;
    const maxHead = maxIndividual === null ? null : heads.find(h => h.highLow === maxIndividual);
    let composite = null, normalized = null;
    if (!reason) {
      normalized = c.series[0].units.map((_, m) => c.series.reduce((s, a, k) => s + a.units[m] / heads[k].mean, 0) / 3);
      composite = seriesSpread(normalized);
    }
    return { heads, composite, normalized, maxIndividual, maxHead, gap: composite === null || maxIndividual === null ? null : maxIndividual - composite, reason };
  }
  function categorySpread(c) { return seasonality(c).composite; }

  // ---------- saved list (B01/B02) ----------
  const SAVED_VERSION = 2;
  function savedKey(mode) { return `sellerscout-saved-v${SAVED_VERSION}:${mode}`; }
  function snapshot(p, c, mode) {
    return {
      id: p.id, asin: p.asin, parentAsin: p.parentAsin, mode, savedAt: new Date().toISOString(),
      name: p.name, originalTitle: p.originalTitle, highlights: p.highlights, originalHighlights: p.originalHighlights,
      translationStatus: p.translationStatus, image: p.image, productUrl: p.productUrl,
      price: p.price, currency: p.currency, sales: p.sales, date: p.date, variationCount: p.variationCount, fbaFee: p.fbaFee,
      seller: p.seller, sellerName: p.sellerName, sellerBasis: p.sellerBasis, fulfillment: p.fulfillment, fbaFeeBasis: p.fbaFeeBasis, pkg: p.pkg,
      categoryId: c.id, category: c.name, categoryPath: c.path.slice(1).map(n => n.name).join(' / '),
      categoryUrl: c.url, fourth: c.fourth, fourthState: c.fourthState,
      volatilityMax: seasonality(c).maxIndividual, volatilityComposite: seasonality(c).composite,
    };
  }
  function parseSaved(text) {
    try {
      const v = JSON.parse(text || '[]');
      return Array.isArray(v) ? v.filter(x => x && typeof x.id === 'string').map(x => {
        const pkg = x.pkg || {};
        // Saved conclusions belong to an older rule, not conflicting measurements.
        // Retain actual conflicts and missing/placeholder dimensions, and retain the raw evidence.
        const status = pkg.ruleVersion !== '2026-11-14' && ['pass', 'fail'].includes(pkg.status) ? null : pkg.status;
        const updated = normalizePkg({ ...pkg, status });
        return { ...x, pkg: { ...updated, declaredStatus: updated.status } };
      }) : [];
    } catch { return []; }
  }
  /** Map legacy v1 ids ("i-j" mock array indexes) through an explicit table; unknown ids are dropped. */
  function migrateLegacy(legacyIds, legacyMap) {
    if (!Array.isArray(legacyIds)) return [];
    return [...new Set(legacyIds.map(x => legacyMap[x]).filter(Boolean))];
  }

  // ---------- Excel rows (B03/B04) ----------
  const SIZE_TEXT = { pass: '合格', fail: '超出尺寸', unknown: '待补尺寸', conflict: '尺寸冲突' };
  const EXPORT_COLUMNS = [
    ['中文标题', 42], ['中文亮点', 38], ['英文标题', 60], ['英文亮点', 45], ['翻译状态', 10],
    ['类目路径', 45], ['售价（USD）', 13], ['月销量（件）', 13], ['上架日期', 12], ['变体数', 9], ['FBA费用（USD）', 14], ['FBA费用来源', 20],
    ['销售方', 9], ['销售方名称', 18], ['销售方依据', 24], ['配送方式', 10],
    ['包装长（cm）', 12], ['包装宽（cm）', 12], ['包装高（cm）', 12], ['长+2×（宽+高）（cm）', 24], ['尺寸结果', 11], ['尺寸来源', 20],
    ['小类第4名月销（件）', 18], ['第4名记录状态', 14], ['单款最大高低月差（%）', 20], ['三款标准化综合高低月差（%）', 26], ['ASIN', 14], ['父ASIN', 14],
    ['Amazon商品链接', 45], ['Amazon类目链接', 45], ['数据模式', 12], ['备选状态', 14], ['长+2×（宽+高）（英寸）', 26], ['尺寸业务标记', 16],
    ['包装长（英寸）', 16], ['包装宽（英寸）', 16], ['包装高（英寸）', 16],
  ];
  const MODE_TEXT = { collected: '一二档采集', mock: 'Mock演示', 'api-sample': 'API样本', cache: '缓存回放', fixture: '测试数据' };
  const FOURTH_TEXT = { matched: '一致', conflict: '记录冲突，取最高', missing: '未取得' };
  function round2(v) { return v === null ? null : Math.round(v * 100) / 100; }
  function exportRow(s, present) {
    const dims = s.pkg && s.pkg.dims ? s.pkg.dims.map(round2) : [null, null, null];
    return [
      s.name, (s.highlights || []).join('；') || null, s.originalTitle, (s.originalHighlights || []).join('; ') || null,
      s.translationStatus === 'translated' ? '已翻译' : s.translationStatus === 'partial' ? '汽配术语中译' : '待翻译',
      s.categoryPath, s.price, s.sales, s.date, s.variationCount, s.fbaFee, s.fbaFeeBasis || null,
      s.seller, s.sellerName, s.sellerBasis || null, s.fulfillment,
      ...dims, s.pkg ? round2(s.pkg.value) : null, s.pkg ? SIZE_TEXT[s.pkg.status] : '待补尺寸', s.pkg ? s.pkg.source : null,
      s.fourth, FOURTH_TEXT[s.fourthState] || null, num(s.volatilityMax), num(s.volatilityComposite), s.asin, s.parentAsin, s.productUrl, s.categoryUrl,
      MODE_TEXT[s.mode] || s.mode, present ? '当前数据中' : '当前数据未找到',
      s.pkg ? round2(s.pkg.formulaInches ?? null) : null, s.pkg ? s.pkg.sizeLabel || null : null,
      ...(s.pkg?.dimsInches || [null, null, null]),
    ];
  }

  /** items: [{snap, present}]; XLSX: SheetJS. Missing numbers stay empty cells, never 0. */
  function buildWorkbook(XLSX, items, mode) {
    const head = EXPORT_COLUMNS.map(c => c[0]);
    const col = name => head.indexOf(name);
    const rows = items.map(({ snap, present }) => {
      const r = exportRow(snap, present);
      const di = col('上架日期');
      const m = typeof r[di] === 'string' && /^(\d{4})-(\d{2})-(\d{2})$/.exec(r[di]);
      if (m) r[di] = new Date(+m[1], +m[2] - 1, +m[3]);
      return r;
    });
    const ws = XLSX.utils.aoa_to_sheet([head, ...rows], { dateNF: 'yyyy-mm-dd' });
    ws['!cols'] = EXPORT_COLUMNS.map(c => ({ wch: c[1] }));
    ws['!autofilter'] = { ref: ws['!ref'] };
    const fmt = { '售价（USD）': '$0.00', 'FBA费用（USD）': '$0.00', '上架日期': 'yyyy-mm-dd' };
    const links = ['Amazon商品链接', 'Amazon类目链接'];
    rows.forEach((_, i) => {
      for (const [name, z] of Object.entries(fmt)) { const cell = ws[XLSX.utils.encode_cell({ r: i + 1, c: col(name) })]; if (cell) cell.z = z; }
      for (const name of links) { const cell = ws[XLSX.utils.encode_cell({ r: i + 1, c: col(name) })]; if (cell && /^https?:\/\//.test(cell.v)) cell.l = { Target: cell.v }; }
    });
    const wb = XLSX.utils.book_new();
    const label = MODE_TEXT[mode] || mode;
    XLSX.utils.book_append_sheet(wb, ws, mode === 'api-sample' ? '备选商品' : `备选商品（${label}）`);
    wb.Props = { Title: `SellerScout 备选商品（${label}）`, Subject: '选品备选清单' };
    return wb;
  }

  return {
    TIERS, SIZE_LIMIT, DEFAULT_FILTERS, SIZE_TEXT, MODE_TEXT, EXPORT_COLUMNS,
    num, int, str, safeUrl, isoDate, packageResult, normalizePkg, normalizeProduct, normalizeCategory, normalizeDataset,
    matchesProduct, sizeBucket, filterCategories, paginateCategories, normalizeRankEvidence, buildTree, nodeTrail, highLow, seriesSpread, seasonality, categorySpread,
    savedKey, snapshot, parseSaved, migrateLegacy, exportRow, buildWorkbook,
  };
});
