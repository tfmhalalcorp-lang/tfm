// Pure aggregation functions ported from the legacy Google Apps Script
// backend's getDashboardAdv() / getWasteDashboard() / getRMDashboard()
// (backend/Transactions.gs). Each function takes already-fetched,
// already-date/batch-filtered row arrays (filtering happens in the
// Supabase query itself now, not in JS) and returns the same shape of
// scorecards/chart data the legacy dashboards rendered.

function sumBy(rows, field) {
  return rows.reduce((sum, r) => sum + Number(r[field] || 0), 0);
}

export function computeMainDashboard({ rm, cans, fillQ, fillW, whIn, brandMap }) {
  const totalRM = sumBy(rm, 'weight');

  let totalProdQGlobal = sumBy(fillQ, 'qty');
  if (totalProdQGlobal === 0 && cans.length > 0) totalProdQGlobal = sumBy(cans, 'can_sum');

  const totalCans = sumBy(cans, 'can_sum');
  const totalFW = sumBy(fillW, 'weight');
  const avgFillWeight = fillW.length > 0 ? totalFW / fillW.length : 0;
  const canPerRM = totalRM > 0 ? totalProdQGlobal / totalRM : 0;
  const avgYield = totalRM > 0 ? (totalProdQGlobal * avgFillWeight) / (totalRM * 10) : 0;

  const totalWHReceived = sumBy(whIn, 'can_sum');
  const totalWHHeld = sumBy(whIn, 'can_hold');

  const activeBatchIds = new Set([
    ...rm.map((r) => r.batch_id),
    ...cans.map((r) => r.batch_id),
    ...fillQ.map((r) => r.batch_id),
    ...whIn.map((r) => r.batch_id),
  ]);
  const batchData = {};
  activeBatchIds.forEach((bid) => {
    batchData[bid] = { rm: 0, cans: 0, prodQ: 0, wCount: 0, wSum: 0, whReceived: 0 };
  });
  rm.forEach((r) => {
    if (batchData[r.batch_id]) batchData[r.batch_id].rm += Number(r.weight || 0);
  });
  cans.forEach((r) => {
    if (batchData[r.batch_id]) batchData[r.batch_id].cans += Number(r.can_sum || 0);
  });
  fillQ.forEach((r) => {
    if (batchData[r.batch_id]) batchData[r.batch_id].prodQ += Number(r.qty || 0);
  });
  fillW.forEach((r) => {
    if (batchData[r.batch_id]) {
      batchData[r.batch_id].wSum += Number(r.weight || 0);
      batchData[r.batch_id].wCount += 1;
    }
  });
  whIn.forEach((r) => {
    if (batchData[r.batch_id]) batchData[r.batch_id].whReceived += Number(r.can_sum || 0);
  });
  activeBatchIds.forEach((bid) => {
    if (batchData[bid].prodQ === 0 && batchData[bid].cans > 0) batchData[bid].prodQ = batchData[bid].cans;
  });

  const sortedBatches = Array.from(activeBatchIds).sort();
  const chartLabels = [];
  const chartRM = [];
  const chartCans = [];
  const chartWHReceived = [];
  const chartCanPerRM = [];
  const chartYield = [];
  const chartYieldRM = [];

  sortedBatches.forEach((bid) => {
    const d = batchData[bid];
    const avgW = d.wCount > 0 ? d.wSum / d.wCount : 0;
    chartLabels.push(bid);
    chartRM.push(d.rm);
    chartCans.push(d.cans);
    chartWHReceived.push(d.whReceived);
    chartCanPerRM.push(d.rm > 0 ? Number((d.prodQ / d.rm).toFixed(2)) : 0);
    chartYield.push(d.rm > 0 ? Number(((d.prodQ * avgW) / (d.rm * 10)).toFixed(2)) : 0);
    chartYieldRM.push(d.prodQ > 0 ? Number((d.rm / d.prodQ).toFixed(4)) : 0);
  });

  let gaugeProdQ = 0;
  let gaugeReceivedQ = 0;
  activeBatchIds.forEach((bid) => {
    gaugeProdQ += batchData[bid].prodQ;
    gaugeReceivedQ += batchData[bid].whReceived;
  });
  const yieldRMAvg = gaugeProdQ > 0 ? totalRM / gaugeProdQ : 0;

  const whBrandData = {};
  whIn.forEach((r) => {
    const bName = brandMap[r.brand_id] || r.brand_id || 'Unknown';
    whBrandData[bName] = (whBrandData[bName] || 0) + Number(r.can_sum || 0);
  });

  return {
    scorecards: { totalRM, totalProdQ: gaugeProdQ, totalCans, avgFillWeight, canPerRM, avgYield, yieldRMAvg },
    warehouseScorecards: { totalReceived: totalWHReceived, totalHeld: totalWHHeld },
    gauge: { prodQ: gaugeProdQ, receivedQ: gaugeReceivedQ },
    charts: {
      labels: chartLabels,
      rm: chartRM,
      cans: chartCans,
      canPerRM: chartCanPerRM,
      yield: chartYield,
      yieldRM: chartYieldRM,
      whReceived: chartWHReceived,
    },
    whChart: { labels: Object.keys(whBrandData), data: Object.values(whBrandData) },
  };
}

export const WASTE_FIELDS_9 = [
  'waste_let', 'waste_steam', 'waste_float', 'waste_qc', 'waste_it', 'waste_spur', 'waste_seam', 'waste_seamer', 'waste_breakdown',
];
export const WASTE_LABELS_9 = {
  waste_let: 'เลท', waste_steam: 'นึ่ง', waste_float: 'ลอย', waste_qc: 'QC', waste_it: 'IT',
  waste_spur: 'สเปอร์', waste_seam: 'ตะเข็บ', waste_seamer: 'ซีมเมอร์', waste_breakdown: 'เครื่องเสีย',
};

export function computeWasteDashboard({ waste, fillQ, cans }) {
  const departments = ['PD', 'WH', 'QC'];
  const deptSummary = {};
  departments.forEach((d) => {
    deptSummary[d] = {};
    WASTE_FIELDS_9.forEach((f) => (deptSummary[d][f] = 0));
  });
  const totalSummary = {};
  WASTE_FIELDS_9.forEach((f) => (totalSummary[f] = 0));

  waste.forEach((r) => {
    const dept = (r.department || 'QC').toUpperCase();
    if (!deptSummary[dept]) {
      deptSummary[dept] = {};
      WASTE_FIELDS_9.forEach((f) => (deptSummary[dept][f] = 0));
    }
    WASTE_FIELDS_9.forEach((f) => {
      const v = Number(r[f] || 0);
      deptSummary[dept][f] += v;
      totalSummary[f] += v;
    });
  });

  const deptTotals = {};
  departments.forEach((d) => {
    deptTotals[d] = WASTE_FIELDS_9.reduce((s, f) => s + (deptSummary[d][f] || 0), 0);
  });
  const grandTotal = WASTE_FIELDS_9.reduce((s, f) => s + totalSummary[f], 0);

  let batchProdQ = {};
  fillQ.forEach((r) => {
    batchProdQ[r.batch_id] = (batchProdQ[r.batch_id] || 0) + Number(r.qty || 0);
  });
  cans.forEach((r) => {
    if (!batchProdQ[r.batch_id]) batchProdQ[r.batch_id] = (batchProdQ[r.batch_id] || 0) + Number(r.can_sum || 0);
  });

  let batchWaste = {};
  waste.forEach((r) => {
    const bid = r.batch_id || 'N/A';
    if (!batchWaste[bid]) {
      batchWaste[bid] = {};
      WASTE_FIELDS_9.forEach((f) => (batchWaste[bid][f] = 0));
    }
    WASTE_FIELDS_9.forEach((f) => {
      batchWaste[bid][f] += Number(r[f] || 0);
    });
  });

  const batchRows = Object.keys(batchWaste)
    .sort()
    .map((bid) => {
      const w = batchWaste[bid];
      const batchTotal = WASTE_FIELDS_9.reduce((s, f) => s + w[f], 0);
      const prodQ = batchProdQ[bid] || 0;
      const ratio = prodQ > 0 ? (batchTotal / prodQ) * 100 : 0;
      return { batch_id: bid, waste: w, total: batchTotal, prodQ, ratio };
    });

  const deptColors = { PD: 'rgba(217, 83, 79, 0.7)', WH: 'rgba(240, 173, 78, 0.7)', QC: 'rgba(91, 192, 222, 0.7)' };
  const deptLabelTh = { PD: 'ผลิต', WH: 'คลัง', QC: 'QC' };
  const chartByType = {
    labels: WASTE_FIELDS_9.map((f) => WASTE_LABELS_9[f]),
    datasets: departments.map((d) => ({
      label: deptLabelTh[d],
      data: WASTE_FIELDS_9.map((f) => deptSummary[d][f] || 0),
      backgroundColor: deptColors[d],
    })),
  };

  return { wasteFields: WASTE_FIELDS_9, wasteLabels: WASTE_LABELS_9, deptSummary, totalSummary, deptTotals, grandTotal, batchRows, chartByType };
}

export function computeRMDashboard({ rm, fillQ, cans, fillW, supplierMap }) {
  const totalWeight = sumBy(rm, 'weight');
  const totalBalance = sumBy(rm, 'balance');
  const balancePct = totalWeight > 0 ? (totalBalance / totalWeight) * 100 : 0;

  const uniqueSuppliers = new Set();
  const uniqueBills = new Set();
  rm.forEach((r) => {
    if (r.supplier_id) uniqueSuppliers.add(r.supplier_id);
    if (r.billsup_no) uniqueBills.add(r.billsup_no);
  });

  const weightBySupplier = {};
  rm.forEach((r) => {
    const n = supplierMap[r.supplier_id] || r.supplier_id || 'N/A';
    weightBySupplier[n] = (weightBySupplier[n] || 0) + Number(r.weight || 0);
  });

  const batchesBySupplierSet = {};
  rm.forEach((r) => {
    const n = supplierMap[r.supplier_id] || r.supplier_id || 'N/A';
    if (!batchesBySupplierSet[n]) batchesBySupplierSet[n] = new Set();
    if (r.batch_id) batchesBySupplierSet[n].add(r.batch_id);
  });
  const batchCountBySupplier = {};
  Object.keys(batchesBySupplierSet).forEach((n) => {
    batchCountBySupplier[n] = batchesBySupplierSet[n].size;
  });

  const dateSupplierMap = {};
  const allDates = new Set();
  const allSupplierNames = new Set();
  rm.forEach((r) => {
    const date = String(r.prodrm_date || '').split('T')[0];
    const n = supplierMap[r.supplier_id] || r.supplier_id || 'N/A';
    if (!date) return;
    allDates.add(date);
    allSupplierNames.add(n);
    if (!dateSupplierMap[date]) dateSupplierMap[date] = {};
    dateSupplierMap[date][n] = (dateSupplierMap[date][n] || 0) + Number(r.weight || 0);
  });
  const sortedDates = Array.from(allDates).sort();
  const sortedSupplierNames = Array.from(allSupplierNames).sort();
  const lineColors = ['#d9534f', '#5cb85c', '#337ab7', '#f0ad4e', '#5bc0de', '#8e44ad', '#e67e22', '#1abc9c', '#e74c3c', '#2c3e50', '#f39c12', '#27ae60', '#3498db', '#9b59b6', '#16a085'];
  const lineDatasets = sortedSupplierNames.map((n, idx) => ({
    label: n,
    data: sortedDates.map((d) => (dateSupplierMap[d] && dateSupplierMap[d][n]) || 0),
    borderColor: lineColors[idx % lineColors.length],
    backgroundColor: lineColors[idx % lineColors.length] + '33',
    borderWidth: 2,
    pointRadius: 4,
    tension: 0.3,
    fill: false,
  }));

  let batchProdQ = {};
  fillQ.forEach((r) => {
    batchProdQ[r.batch_id] = (batchProdQ[r.batch_id] || 0) + Number(r.qty || 0);
  });
  cans.forEach((r) => {
    if (!batchProdQ[r.batch_id]) batchProdQ[r.batch_id] = (batchProdQ[r.batch_id] || 0) + Number(r.can_sum || 0);
  });

  let batchFW = {};
  let batchFWCount = {};
  fillW.forEach((r) => {
    batchFW[r.batch_id] = (batchFW[r.batch_id] || 0) + Number(r.weight || 0);
    batchFWCount[r.batch_id] = (batchFWCount[r.batch_id] || 0) + 1;
  });

  const crosstabBatches = new Set();
  const crosstabSuppliers = new Set();
  const crosstabData = {};
  rm.forEach((r) => {
    const bid = r.batch_id || 'N/A';
    const sid = supplierMap[r.supplier_id] || r.supplier_id || 'N/A';
    crosstabBatches.add(bid);
    crosstabSuppliers.add(sid);
    const key = bid + '|||' + sid;
    if (!crosstabData[key]) crosstabData[key] = { weight: 0, balance: 0 };
    crosstabData[key].weight += Number(r.weight || 0);
    crosstabData[key].balance += Number(r.balance || 0);
  });
  const sortedCTBatches = Array.from(crosstabBatches).sort();
  const sortedCTSuppliers = Array.from(crosstabSuppliers).sort();
  const crosstabRows = sortedCTBatches.map((bid) => {
    let rowRM = 0;
    const supplierWeights = {};
    sortedCTSuppliers.forEach((sid) => {
      const key = bid + '|||' + sid;
      const w = crosstabData[key] ? crosstabData[key].weight : 0;
      supplierWeights[sid] = w;
      rowRM += w;
    });
    const prodQ = batchProdQ[bid] || 0;
    const avgW = batchFWCount[bid] ? batchFW[bid] / batchFWCount[bid] : 0;
    const yieldPct = rowRM > 0 ? (prodQ * avgW) / (rowRM * 10) : 0;
    return { batch_id: bid, supplierWeights, totalRM: rowRM, prodQ, yieldPct };
  });

  return {
    scorecards: { totalWeight, totalBalance, balancePct, supplierCount: uniqueSuppliers.size, billCount: uniqueBills.size },
    pieWeight: { labels: Object.keys(weightBySupplier), data: Object.values(weightBySupplier) },
    pieBatch: { labels: Object.keys(batchCountBySupplier), data: Object.values(batchCountBySupplier) },
    lineChart: { labels: sortedDates, datasets: lineDatasets },
    crosstab: { suppliers: sortedCTSuppliers, rows: crosstabRows },
  };
}
