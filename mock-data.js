/* Mock dataset in the shared UI contract shape (docs/UI_DATA_CONTRACT.md).
 * Category node ids / English path names come from the project's cached Amazon node records
 * (reports/leaf-scout/leaves.json, reports/taxonomy/automotive-nodes.json). Chinese labels are UI wording.
 * Everything commercial (titles, prices, sales, dates, variants, FBA fees, seller, packages, curves) is mock.
 * Mock products have no ASIN on purpose: earlier prototype links borrowed unrelated real ASINs. */
(function (root) {
  'use strict';
  const N = (id, name, originalName) => ({ id, name, originalName });
  const AUTO = N('15684181', '汽配', 'Automotive');
  const EXT = N('15857511', '外部配件', 'Exterior Accessories');
  const BED = N('15737781', '货厢与尾门配件', 'Truck Bed & Tailgate Accessories');
  const INT = N('15857501', '内部配件', 'Interior Accessories');
  const REP = N('15719731', '替换零件', 'Replacement Parts');
  const BODYTRIM = N('13591417011', '车身与饰件', 'Body & Trim');

  // [tier, path, zh name, reason(不推荐 only), fourth, products]
  // product: [zh title, zh highlights, price, sales, date, seller, fulfillment, pkg dims cm|null, variations, fbaFee, en title, en highlights]
  const rows = [
    ['推荐看', [AUTO, EXT, BED, N('15737891', '货厢盖', 'Tonneau Covers')], '皮卡货厢盖', null, 32, [
      ['F-250 / F-350 硬三折货厢盖', '6.8英尺 · 黑色', 479, 4, '2026-09-12', 'SC', 'FBM', [120, 65, 15], 1, null, 'F-250 / F-350 Hard Tri-Fold Tonneau Cover', '6.8 ft; Black'],
      ['Ram 1500 硬四折货厢盖', '6.4英尺 · 铝合金', 569, 9, '2026-08-23', 'SC', 'FBA', [110, 60, 18], 3, 10.65, 'Ram 1500 Hard Quad-Fold Tonneau Cover', '6.4 ft; Aluminum'],
      ['Tacoma 软卷式货厢盖', '5英尺 · 防水布面', 189, 6, '2026-10-02', 'VC', 'FBA', null, 5, 13.05, 'Tacoma Soft Roll-Up Tonneau Cover', '5 ft; Waterproof fabric']]],
    ['推荐看', [AUTO, INT, N('15735451', '中控与收纳', 'Consoles & Organizers'), N('318295011', '后备箱收纳', 'Trunk Organizers')], '后备箱收纳箱', null, 24, [
      ['Bronco 隐藏式收纳箱', '四门款 · 地板下安装', 229, 5, '2026-07-15', 'SC', 'FBA', [45, 30, 12], 3, 9.37, 'Bronco Hidden Storage Box', '4-door model; Under-floor installation'],
      ['SUV 后备箱抽屉箱', '双抽屉 · 80cm', 359, 7, '2026-09-01', 'VC', 'FBA', [80, 50, 40], 5, 11.77, 'SUV Trunk Drawer Box', 'Two drawers; 80 cm']]],
    ['推荐看', [AUTO, EXT, N('15857521', '车罩', 'Covers'), N('15735581', '整车车衣', 'Full Car Covers')], '整车车衣', null, 41, [
      ['Camaro 室内防尘车衣', '定制贴合 · 黑色', 179, 3, '2026-06-25', 'SC', 'FBM', [38, 28, 15], 5, 10.49, 'Camaro Indoor Dust Cover', 'Custom fit; Black'],
      ['SUV 加厚防冰雹车衣', '多层缓冲 · 大号', 259, 8, '2026-08-18', 'VC', 'FBA', [45, 30, 15], 2, 12.89, 'SUV Padded Hail Protection Cover', 'Multilayer cushioning; Large']]],
    ['推荐看', [AUTO, EXT, BED, N('15737841', '货厢帐篷', 'Bed Tents')], '皮卡货厢帐篷', null, 38, [
      ['皮卡双人货厢帐篷', '6.5英尺 · 双层', 219, 6, '2026-07-08', 'SC', 'FBA', [48.26, 35.56, 27.94], 2, 11.61, 'Pickup Truck Bed Tent for Two', '6.5 ft; Double-layer'],
      ['皮卡高顶露营帐篷', '5.5英尺 · 快搭', 329, 4, '2026-09-16', 'SC', 'FBM', [60, 25, 20], 8, 14.01, 'High-Roof Quick-Setup Truck Bed Tent', '5.5 ft; Quick setup']]],
    ['推荐看', [AUTO, INT, N('15736751', '座椅套与配件', 'Seat Covers & Accessories'), N('15736771', '座椅套', 'Seat Covers')], '座椅套', null, 29, [
      ['F-150 全包座椅套', '五座 · 人造皮革', 249, 7, '2026-08-11', 'SC', 'FBM', [48, 30, 20], 8, 12.73, 'F-150 Full-Coverage Seat Covers', 'Five seats; Faux leather']]],
    ['推荐看', [AUTO, N('346333011', '摩托车与动力运动', 'Motorcycle & Powersports'), N('404632011', '配件', 'Accessories'), N('404634011', '行李', 'Luggage'), N('404680011', '边包', 'Saddle Bags')], '摩托车边包', null, 45, [
      ['巡航摩托硬壳边包', '双侧 · 36L', 289, 5, '2026-09-03', 'SC', 'FBA', [42, 28, 15], 1, 13.85, 'Cruiser Motorcycle Hard Saddlebags', 'Pair; 36 L'],
      ['摩托防水软边包', '双侧 · 50L', 169, 8, '2026-10-10', '未知', 'FBM', null, 3, 16.25, 'Waterproof Motorcycle Soft Saddlebags', 'Pair; 50 L']]],
    ['可以考虑', [AUTO, EXT, BED, N('15737921', '货厢工具箱', 'Truck Bed Toolboxes')], '货厢工具箱', null, 86, [
      ['钢制工地工具箱', '36英寸 · 单盖', 209, 9, '2026-08-09', 'SC', 'FBM', [96, 50, 58], null, 14.97, 'Steel Jobsite Tool Box', '36 inch; Single lid'],
      ['钢制双门工具箱', '56英寸 · 双门', 285, 3, '2026-09-22', 'SC', 'FBA', [150, 55, 50], 5, 17.37, 'Steel Double-Door Tool Box', '56 inch; Double door']]],
    ['可以考虑', [AUTO, REP, BODYTRIM, N('15709241', '车身', 'Body'), N('3095005011', '车顶', 'Tops & Roofs'), N('4939614011', 'Jeep 软顶', 'Jeep Soft Tops')], 'Jeep 软顶', null, 72, [
      ['Wrangler 替换软顶', '四门款 · 含侧窗', 399, 4, '2026-06-20', 'VC', 'FBA', [70, 40, 25], 5, 16.09, 'Wrangler Replacement Soft Top', '4-door model; Side windows included']]],
    ['可以考虑', [AUTO, REP, BODYTRIM, N('15709991', '饰件', 'Trim'), N('15710111', '内饰', 'Interior'), N('15710151', '车门内饰板', 'Door Panels')], '车门内饰板', null, 118, [
      ['Silverado 左前门内饰板', '2007–2009 · 黑色', 298, 3, '2026-07-21', 'SC', 'FBM', [110, 70, 25], 2, 17.21, 'Silverado Front Left Door Trim Panel', '2007–2009; Black'],
      ['Silverado 右前门内饰板', '2007–2009 · 黑色', 249, 6, '2026-08-20', 'SC', 'FBA', null, 8, 19.61, 'Silverado Front Right Door Trim Panel', '2007–2009; Black']]],
    ['可以考虑', [AUTO, EXT, N('15735241', '货物管理', 'Cargo Management'), N('15735251', '货物架', 'Cargo Racks')], '货物架', null, 94, [
      ['SUV 铝合金车顶行李架', '车型专用 · 120cm', 219, 5, '2026-09-02', 'SC', 'FBA', [130, 20, 15], 8, 18.33, 'SUV Aluminum Roof Rack', 'Vehicle-specific; 120 cm']]],
    ['可以考虑', [AUTO, N('15736321', '灯具与照明', 'Lights & Lighting Accessories'), N('15736351', '装饰与越野照明', 'Accent & Off Road Lighting'), N('15730331', '灯条', 'Light Bars')], '灯条', null, 136, [
      ['越野 LED 灯条套装', '双灯 · 含线束', 189, 7, '2026-08-15', 'SC', 'FBM', [60, 25, 20], 1, 19.45, 'Off-Road LED Light Bar Kit', 'Two lights; Wiring harness included']]],
    ['不推荐', [AUTO, REP, N('15721631', '制动系统', 'Brake System')], '制动系统', '安全关键部件，验证与售后负担高', 580, []],
    ['不推荐', [AUTO, N('15718791', '油液', 'Oils & Fluids'), N('15718801', '添加剂', 'Additives'), N('15718831', '燃油系统添加剂', 'Fuel System')], '燃油系统添加剂', '涉及配方、运输和销售要求', 360, []],
    ['不推荐', [AUTO, REP, N('15731431', '转向系统', 'Steering System')], '转向系统', '安装与可靠性要求高', 470, []],
    ['不推荐', [AUTO, REP, N('15730551', '传感器', 'Sensors'), N('15730571', '安全气囊传感器', 'Air Bag')], '安全气囊传感器', '安全关键部件，进入要求高', 210, []],
  ];

  const photoCount = [3, 2, 2, 2, 1, 2, 2, 1, 2, 1, 1];
  const months = Array.from({ length: 12 }, (_, m) => { const d = new Date(Date.UTC(2025, 10 + m, 1)); return d.toISOString().slice(0, 7); });
  const factors = [[.95, 1, .96, .94, 1.02, 1.08, 1.12, 1.07, 1.02, .97, .94, 1.03], [.84, .85, .92, 1, 1.14, 1.27, 1.38, 1.32, 1.12, .93, .81, .76], [.58, .62, .7, .85, 1.1, 1.5, 1.9, 1.7, 1.3, .85, .65, .55]];

  const legacyMap = Object.create(null); // v1 saved ids "i-j" -> new mock ids (same mock order)
  const categories = rows.map((r, i) => {
    const [tier, path, name, reason, fourth, prods] = r;
    const node = path[path.length - 1].id;
    const profile = factors[i < 6 ? 0 : i < 11 ? 1 : 2];
    const series = [0, 1, 2].map(k => ({
      asin: null, parentAsin: `mock-parent-${node}-${k + 1}`, label: `第${k + 1}名`, source: 'mock',
      units: profile.map((v, m) => Math.round((130 - i * 3 - k * 28) * v * (1 + Math.sin(m * 1.6 + k + i) * .035))),
    }));
    let seasonalStatus = 'complete';
    if (node === '15730331') { series[2].units[3] = null; seasonalStatus = 'partial'; } // demo: a missing month is not filled with 0
    // demo counterexamples for the composite (mock only):
    // seat covers: three heads peak in different seasons, so the composite looks flat while each head swings
    if (node === '15736771') {
      const peak = (p, base) => Array.from({ length: 12 }, (_, m) => Math.round(base * (1 + 1.6 * Math.max(0, Math.cos((m - p) * Math.PI / 3)))));
      series[0].units = peak(1, 60); series[1].units = peak(5, 55); series[2].units = peak(9, 50);
    }
    // saddle bags: one large steady seller next to two small strongly seasonal heads
    if (node === '404680011') {
      series[0].units = Array.from({ length: 12 }, (_, m) => 1200 + (m % 2) * 20);
      series[1].units = [3, 3, 4, 8, 22, 40, 44, 36, 14, 5, 3, 3];
      series[2].units = [2, 2, 3, 7, 18, 34, 38, 30, 12, 4, 2, 2];
    }
    return {
      id: node, nodeId: node, path, name, tier, reason,
      url: `https://www.amazon.com/b?node=${node}`,
      fourth, fourthState: 'matched', fourthAsins: [],
      months, series, seasonalStatus,
      products: prods.map((p, j) => {
        const id = `mock-${node}-${j + 1}`;
        legacyMap[`${i}-${j}`] = id;
 return {
   id, asin: null, parentAsin: null,
   name: p[0], highlights: p[1].split(' · '), originalTitle: p[10], originalHighlights: p[11].split('; '),
          translationStatus: 'translated',
   image: photoCount[i] ? `images/${i}-${j % photoCount[i]}.jpg` : null,
          productUrl: null,
          price: p[2], currency: 'USD', sales: p[3], date: p[4], variationCount: p[8], fbaFee: p[9],
   seller: p[5], sellerName: null, sellerTypeRaw: null, fulfillment: p[6],
   pkg: p[7] ? { status: null, dims: p[7], unit: 'cm', raw: null, source: 'mock' } : { status: 'unknown', dims: null, unit: null, raw: null, source: null },
          sources: { all: 'mock' }, flags: ['mock'],
        };
      }),
    };
  });

  root.SCOUT_MOCK = {
    schemaVersion: 1, mode: 'mock', generatedAt: '2026-11-11T00:00:00+08:00', dataAsOf: null,
    source: 'UI mock（商业数值、标题、图片均为演示）', coverage: { categories: categories.length, note: 'mock' },
    categories,
  };
  root.SCOUT_MOCK_LEGACY = legacyMap;
})(typeof self !== 'undefined' ? self : this);
