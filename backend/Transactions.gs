function saveBatch(data) {
  // data: { prodbatch_date, batch_id, cansize_id, brand_id }
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Validation: Check if Batch ID already exists
  const batchSheet = ss.getSheetByName('ProdBatch');
  const batches = batchSheet.getDataRange().getValues();
  for(let i=1; i<batches.length; i++) {
    if(batches[i][2] == data.batch_id) { // Column 3 is batch_id
       throw new Error('Batch ID ' + data.batch_id + ' already exists!');
    }
  }

  const record = {
    prodbatch_id: 'PB-' + Date.now(),
    prodbatch_date: data.prodbatch_date,
    batch_id: data.batch_id,
    cansize_id: data.cansize_id,
    brand_id: data.brand_id
  };
  
  return addRecord('ProdBatch', record);
}

function getOpenBatches() {
  // Return batches created within the last 7 days
  const data = getSheetData('ProdBatch');
  const now = new Date();
  const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
  const cutoffStr = cutoff.toISOString().split('T')[0];
  
  return data.filter(function(row) {
    var d = row.prodbatch_date || row.date || '';
    if (typeof d === 'object' && d.toISOString) d = d.toISOString();
    var dateStr = String(d).split('T')[0];
    return dateStr >= cutoffStr;
  });
}

function saveRM(data) {
  // ProdRM: batch_id, supplier_id, fish_type, weight, balance, fish_balance
  // Note: fish_type should ideally come from Supplier, but user requirement says input/select.
  // We will save it as passed.
  
  return addRecord('ProdRM', {
    prodrm_id: 'RM-' + Date.now(),
    prodrm_date: data.prodrm_date,
    batch_id: data.batch_id,
    supplier_id: data.supplier_id,
    billsup_no: data.billsup_no || '',
    fish_type: data.fish_type || '',
    weight: Number(data.weight),
    balance: Number(data.balance),
    fish_balance: Number(data.fish_balance || 0)
  });
}

function saveFillWeight(data) {
  // ProdFillW: batch_id, weight
  return addRecord('ProdFillW', {
    prodfillw_id: 'FW-' + Date.now(),
    prodfillw_date: data.prodfillw_date,
    batch_id: data.batch_id,
    weight: Number(data.weight)
  });
}

function saveCanUsage(data) {
  // ProdCan: batch_id, basket_no, can_sum
  return addRecord('ProdCan', {
    prodcan_id: 'CAN-' + Date.now(),
    prodcan_date: data.prodcan_date,
    batch_id: data.batch_id,
    basket_no: data.basket_no, // Text/Number
    can_sum: Number(data.can_sum)
  });
}

function saveFillQuantity(data) {
  // ProdFillQ: batch_id, quantity
  // POLYGLOT SAVE: Send BOTH new and old keys to ensure it hits whatever headers exist in the sheet
  return addRecord('ProdFillQ', {
    prodfillq_id: 'PQ-' + Date.now(),
    
    // Date Aliases
    ProdFillQ_date: data.ProdFillQ_date,
    prodfillq_date: data.ProdFillQ_date, 
    date: data.ProdFillQ_date,

    batch_id: data.batch_id,
    
    // Quantity Aliases
    ProdFillQ_Qty: Number(data.ProdFillQ_Qty),
    quantity: Number(data.ProdFillQ_Qty),
    prodfillq_qty: Number(data.ProdFillQ_Qty),
    qty: Number(data.ProdFillQ_Qty)
  });
}

function saveWarehouseIn(data) {
  // WHIn: batch_id, brand_id, so_no, can_sum, can_hold, remark
  return addRecord('WHIn', {
    whin_id: 'WH-' + Date.now(),
    
    // Polyglot Dates
    whin_date: data.whin_date,
    date: data.whin_date,
    
    batch_id: data.batch_id,
    brand_id: data.brand_id,
    so_no: data.so_no || '',
    
    // Polyglot 'Good' Quantity
    can_sum: Number(data.can_sum || 0),
    good: Number(data.can_sum || 0),
    quantity: Number(data.can_sum || 0),
    amount: Number(data.can_sum || 0),

    // Polyglot 'Hold' Quantity
    can_hold: Number(data.can_hold || 0),
    hold: Number(data.can_hold || 0),
    waste: Number(data.can_hold || 0), // Sometimes users map hold to waste conceptually

    remark: data.remark || ''
  });
}

function saveQCWaste(data) {
  // QCWaste: multiple fields
  // Ensure numeric fields are numbers
  const numFields = ['waste_let', 'waste_steam', 'waste_float', 'waste_qc', 'waste_it', 'waste_spur', 'waste_seam', 'waste_seamer', 'waste_breakdown', 'waste_bumped', 'waste_swollen', 'waste_falseseam', 'waste_received', 'waste_other'];
  let record = {
    qcwaste_id: data.qcwaste_id || ('QC-' + Date.now()), // Ensure ID exists
    
    // Polyglot Dates
    qcwaste_date: data.qcwaste_date,
    date: data.qcwaste_date,
    
    // CRITICAL FIX: Add missing batch_id
    batch_id: data.batch_id,

    // Department field (PD/WH/QC)
    department: data.department || 'QC',

    // Polyglot Can Size
    can_type: data.can_type,
    cansize_id: data.can_type,
    size: data.can_type
  };
  
  numFields.forEach(f => {
    record[f] = Number(data[f] || 0);
  });
  
  return addRecord('QCWaste', record);
}

function saveMachinePM(data) {
  // MachinePM
  // Calculate downtime if not provided but start/end are? 
  // For now trust frontend or manual entry.
  return addRecord('MachinePM', {
    machinepm_id: 'PM-' + Date.now(),
    machinepm_date: data.machinepm_date,
    machine_id: data.machine_id,
    detail: data.detail,
    start_time: data.start_time,
    end_time: data.end_time,
    downtime: Number(data.downtime || 0),
    solve: data.solve,
    can_waste: Number(data.can_waste || 0),
    employee: data.employee
  });
}

// DASHBOARD LOGIC
function getDashboardMetrics() {
  const today = formatDate(new Date());
  
  // Get Data
  const batches = getSheetData('ProdBatch');
  const rm = getSheetData('ProdRM');
  const cans = getSheetData('ProdCan');
  
  // Filter Today
  const todayBatches = batches.filter(r => r.prodbatch_date === today);
  const todayRM = rm.filter(r => r.prodrm_date === today);
  const todayCans = cans.filter(r => r.prodcan_date === today);
  
  // Aggregates
  const totalRM = todayRM.reduce((sum, r) => sum + Number(r.weight || 0), 0);
  const totalCans = todayCans.reduce((sum, r) => sum + Number(r.can_sum || 0), 0);
  
  // Charts: Group All Time by Batch (Last 10 Batches)
  // Map batch info
  let batchMap = {};
  batches.forEach(b => { batchMap[b.batch_id] = b.batch_id; }); // Just ID for now
  
  // Aggregate RM per Batch
  let batchRM = {};
  rm.forEach(r => {
    let bid = r.batch_id;
    batchRM[bid] = (batchRM[bid] || 0) + Number(r.weight || 0);
  });
  
  // Aggregate Cans per Batch
  let batchCans = {};
  cans.forEach(r => {
    let bid = r.batch_id;
    batchCans[bid] = (batchCans[bid] || 0) + Number(r.can_sum || 0);
  });
  
  // Prepare Chart Arrays (Match Keys)
  let chartDataKeys = Object.keys(batchRM).slice(-10); // Last 10 active batches
  
  let chartRM = chartDataKeys.map(k => ({ batch: k, weight: batchRM[k] }));
  let chartCans = chartDataKeys.map(k => ({ batch: k, amount: batchCans[k] || 0 }));
  
  return {
    todayBatch: todayBatches.length,
    todayRM: totalRM,
    todayCans: totalCans,
    chartRM: chartRM,
    chartCans: chartCans // Frontend currently uses only RM chart, can add Can chart if needed
  };
}

// --- GENERIC TRANSACTION CRUD HELPERS ---
function getTransactionData(sheetName) {
  return getSheetData(sheetName).reverse(); // Newest first
}

function updateTransaction(sheetName, idField, data) {
  // data must include the id
  return updateRecord(sheetName, idField, data[idField], data);
}

function deleteTransaction(sheetName, idField, id) {
  return deleteRecord(sheetName, idField, id);
}

// SPECIFIC FUNCTIONS (For mapping in Code.gs)
function getProdBatches() { return getTransactionData('ProdBatch'); }
function updateBatch(data) { return updateTransaction('ProdBatch', 'prodbatch_id', data); }
function deleteBatch(id) { return deleteTransaction('ProdBatch', 'prodbatch_id', id); }

function getProdRMs() { return getTransactionData('ProdRM'); }
function updateRM(data) { return updateTransaction('ProdRM', 'prodrm_id', data); }
function deleteRM(id) { return deleteTransaction('ProdRM', 'prodrm_id', id); }

function getProdCans() { return getTransactionData('ProdCan'); }
function updateCanUsage(data) { return updateTransaction('ProdCan', 'prodcan_id', data); }
function deleteCanUsage(id) { return deleteTransaction('ProdCan', 'prodcan_id', id); }

function getProdFillQs() { return getTransactionData('ProdFillQ'); }
function updateFillQuantity(data) { return updateTransaction('ProdFillQ', 'prodfillq_id', data); }
function deleteFillQuantity(id) { return deleteTransaction('ProdFillQ', 'prodfillq_id', id); }

function getProdFillWs() { return getTransactionData('ProdFillW'); }
function updateFillWeight(data) { return updateTransaction('ProdFillW', 'prodfillw_id', data); }
function deleteFillWeight(id) { return deleteTransaction('ProdFillW', 'prodfillw_id', id); }

function getWHIns() { return getTransactionData('WHIn'); }
function updateWarehouseIn(data) { return updateTransaction('WHIn', 'whin_id', data); }
function deleteWarehouseIn(id) { return deleteTransaction('WHIn', 'whin_id', id); }

function getQCWastes() { return getTransactionData('QCWaste'); }
function updateQCWaste(data) { return updateTransaction('QCWaste', 'qcwaste_id', data); } // Fixed: use qcwaste_id as primary key
function deleteQCWaste(id) { return deleteTransaction('QCWaste', 'qcwaste_id', id); }

function getMachinePMs() { return getTransactionData('MachinePM'); }
function updateMachinePM(data) { return updateTransaction('MachinePM', 'machinepm_id', data); }
function deleteMachinePM(id) { return deleteTransaction('MachinePM', 'machinepm_id', id); }

// =============================================
// ISSUE LOG — แจ้งปัญหาในการผลิต
// =============================================
function saveIssueLog(data) {
  return addRecord('IssueLog', {
    issue_id: 'ISS-' + Date.now(),
    issue_date: data.issue_date,
    department: data.department || '',
    reporter: data.reporter || '',
    detail: data.detail || '',
    status: data.status || 'รอแก้ไข'
  });
}

function getIssueLogs() { return getTransactionData('IssueLog'); }
function updateIssueLog(data) { return updateTransaction('IssueLog', 'issue_id', data); }
function deleteIssueLog(id) { return deleteTransaction('IssueLog', 'issue_id', id); }
function formatDate(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function formatCompactDate(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyMMdd');
}

function getDashboardAdv(payload) {
  const startDate = payload.startDate || '';
  const endDate = payload.endDate || '';
  const batchFilter = payload.batchFilter || '';
  
  // Get Data
  const batches = getSheetData('ProdBatch');
  const rm = getSheetData('ProdRM');
  const cans = getSheetData('ProdCan');
  const fillQ = getSheetData('ProdFillQ');
  const fillW = getSheetData('ProdFillW');
  const whIn = getSheetData('WHIn');
  const brands = getSheetData('Brand');
  
  // Helper: extract numeric value from a row trying multiple field names
  const getNum = (row, fields) => {
    for (let i = 0; i < fields.length; i++) {
      const v = row[fields[i]];
      if (v !== undefined && v !== null && v !== '') return Number(v) || 0;
    }
    return 0;
  };
  
  // Helper: extract date from a row trying multiple field names
  const getDate = (row, fields) => {
    for (let i = 0; i < fields.length; i++) {
      const v = row[fields[i]];
      if (v !== undefined && v !== null && v !== '') return String(v);
    }
    return '';
  };

  // Helper to check date range
  const isDateInRange = (dateStr) => {
    if (!dateStr) return false;
    const d = String(dateStr).split('T')[0];
    if (startDate && d < startDate) return false;
    if (endDate && d > endDate) return false;
    return true;
  };

  // Filter Data by date
  let filteredBatches = batches.filter(r => isDateInRange(r.prodbatch_date));
  let filteredRM = rm.filter(r => isDateInRange(r.prodrm_date));
  let filteredCans = cans.filter(r => isDateInRange(r.prodcan_date));
  let filteredFillQ = fillQ.filter(r => isDateInRange(getDate(r, ['ProdFillQ_date', 'prodfillq_date', 'date'])));
  let filteredFillW = fillW.filter(r => isDateInRange(r.prodfillw_date));
  let filteredWHIn = whIn.filter(r => isDateInRange(getDate(r, ['whin_date', 'date'])));

  // Filter by batch if specified
  if (batchFilter) {
    filteredBatches = filteredBatches.filter(r => r.batch_id === batchFilter);
    filteredRM = filteredRM.filter(r => r.batch_id === batchFilter);
    filteredCans = filteredCans.filter(r => r.batch_id === batchFilter);
    filteredFillQ = filteredFillQ.filter(r => r.batch_id === batchFilter);
    filteredFillW = filteredFillW.filter(r => r.batch_id === batchFilter);
    filteredWHIn = filteredWHIn.filter(r => r.batch_id === batchFilter);
  }

  // --- SCORECARDS ---
  const totalRM = filteredRM.reduce((sum, r) => sum + Number(r.weight || 0), 0);
  
  // Production Quantity: try ProdFillQ first, fall back to ProdCan (can_sum) if ProdFillQ gives 0
  let totalProdQ = filteredFillQ.reduce((sum, r) => sum + getNum(r, ['ProdFillQ_Qty', 'quantity', 'prodfillq_qty', 'qty']), 0);
  // Fallback: if ProdFillQ is empty/zero but ProdCan has data, use can_sum from ProdCan
  if (totalProdQ === 0 && filteredCans.length > 0) {
    totalProdQ = filteredCans.reduce((sum, r) => sum + Number(r.can_sum || 0), 0);
  }
  
  const totalCans = filteredCans.reduce((sum, r) => sum + Number(r.can_sum || 0), 0);
  const totalFW = filteredFillW.reduce((sum, r) => sum + Number(r.weight || 0), 0);
  const avgFillWeight = filteredFillW.length > 0 ? (totalFW / filteredFillW.length).toFixed(2) : 0;
  
  const canPerRM = totalRM > 0 ? (totalProdQ / totalRM).toFixed(2) : 0;
  const avgYield = totalRM > 0 ? ((totalProdQ * avgFillWeight) / (totalRM * 10)).toFixed(2) : 0;

  // --- WAREHOUSE SCORECARDS ---
  const totalWHReceived = filteredWHIn.reduce((sum, r) => sum + getNum(r, ['can_sum', 'good', 'quantity', 'amount']), 0);
  const totalWHHeld = filteredWHIn.reduce((sum, r) => sum + getNum(r, ['can_hold', 'hold', 'waste']), 0);

  // --- CHARTS (Group by Batch) ---
  // Collect all batch IDs that have ANY activity
  let activeBatchIds = new Set();
  filteredBatches.forEach(r => activeBatchIds.add(r.batch_id));
  filteredRM.forEach(r => activeBatchIds.add(r.batch_id));
  filteredCans.forEach(r => activeBatchIds.add(r.batch_id));
  filteredFillQ.forEach(r => activeBatchIds.add(r.batch_id));
  filteredWHIn.forEach(r => activeBatchIds.add(r.batch_id));
  
  let batchData = {};
  activeBatchIds.forEach(bid => {
    batchData[bid] = { rm: 0, cans: 0, prodQ: 0, avgW: 0, wCount: 0, wSum: 0, whReceived: 0 };
  });

  filteredRM.forEach(r => { if(batchData[r.batch_id]) batchData[r.batch_id].rm += Number(r.weight || 0); });
  filteredCans.forEach(r => { if(batchData[r.batch_id]) batchData[r.batch_id].cans += Number(r.can_sum || 0); });
  filteredFillQ.forEach(r => { if(batchData[r.batch_id]) batchData[r.batch_id].prodQ += getNum(r, ['ProdFillQ_Qty', 'quantity', 'prodfillq_qty', 'qty']); });
  filteredFillW.forEach(r => { 
    if(batchData[r.batch_id]) {
        batchData[r.batch_id].wSum += Number(r.weight || 0); 
        batchData[r.batch_id].wCount += 1;
    }
  });
  filteredWHIn.forEach(r => { if(batchData[r.batch_id]) batchData[r.batch_id].whReceived += getNum(r, ['can_sum', 'good', 'quantity', 'amount']); });

  // Fallback: if prodQ is 0 for a batch, use cans as production quantity
  activeBatchIds.forEach(bid => {
    if (batchData[bid].prodQ === 0 && batchData[bid].cans > 0) {
      batchData[bid].prodQ = batchData[bid].cans;
    }
  });

  let chartLabels = [];
  let chartRM = [];
  let chartCans = [];
  let chartCanPerRM = [];
  let chartYield = [];
  let chartYieldRM = [];
  let chartWHReceived = [];

  let sortedBatches = Array.from(activeBatchIds).sort();

  sortedBatches.forEach(bid => {
    const d = batchData[bid];
    const avgW = d.wCount > 0 ? d.wSum / d.wCount : 0;
    
    chartLabels.push(bid);
    chartRM.push(d.rm);
    chartCans.push(d.cans);
    chartWHReceived.push(d.whReceived);
    
    const cpr = d.rm > 0 ? (d.prodQ / d.rm).toFixed(2) : 0;
    chartCanPerRM.push(Number(cpr));
    
    const y = d.rm > 0 ? ((d.prodQ * avgW) / (d.rm * 10)).toFixed(2) : 0;
    chartYield.push(Number(y));

    // Yield RM per batch = RM / prodQ (kg per can)
    const yrm = d.prodQ > 0 ? (d.rm / d.prodQ).toFixed(4) : 0;
    chartYieldRM.push(Number(yrm));
  });

  // --- GAUGE: Total production vs total warehouse received ---
  let gaugeProdQ = 0;
  let gaugeReceivedQ = 0;
  activeBatchIds.forEach(bid => {
    gaugeProdQ += batchData[bid].prodQ;
    gaugeReceivedQ += batchData[bid].whReceived;
  });

  // --- Yield RM Avg (overall) = totalRM / totalProdQ ---
  const yieldRMAvg = gaugeProdQ > 0 ? (totalRM / gaugeProdQ).toFixed(4) : 0;

  // --- WAREHOUSE PIE CHART (By Brand) ---
  let brandMap = {};
  brands.forEach(b => { brandMap[b.brand_id] = b.brand_name; });

  let whBrandData = {};
  filteredWHIn.forEach(r => {
    const bName = brandMap[r.brand_id] || r.brand_id || 'Unknown';
    const qty = getNum(r, ['can_sum', 'good', 'quantity', 'amount']);
    whBrandData[bName] = (whBrandData[bName] || 0) + qty;
  });

  let whPieLabels = Object.keys(whBrandData);
  let whPieData = Object.values(whBrandData);

  return {
    scorecards: {
        totalRM: Number(totalRM).toLocaleString(),
        totalProdQ: Number(gaugeProdQ).toLocaleString(),
        totalCans: Number(totalCans).toLocaleString(),
        avgFillWeight: Number(avgFillWeight).toLocaleString(),
        canPerRM: Number(canPerRM).toLocaleString(),
        avgYield: Number(avgYield).toLocaleString(),
        yieldRMAvg: Number(yieldRMAvg).toLocaleString()
    },
    warehouseScorecards: {
        totalReceived: Number(totalWHReceived).toLocaleString(),
        totalHeld: Number(totalWHHeld).toLocaleString()
    },
    gauge: {
        prodQ: gaugeProdQ,
        receivedQ: gaugeReceivedQ
    },
    charts: {
        labels: chartLabels,
        rm: chartRM,
        cans: chartCans,
        canPerRM: chartCanPerRM,
        yield: chartYield,
        yieldRM: chartYieldRM,
        whReceived: chartWHReceived
    },
    whChart: {
        labels: whPieLabels,
        data: whPieData
    }
  };
}

// ========== WASTE DASHBOARD ==========
function getWasteDashboard(payload) {
  const startDate = payload.startDate || '';
  const endDate = payload.endDate || '';
  const batchFilter = payload.batchFilter || '';

  const wasteData = getSheetData('QCWaste');
  const fillQ = getSheetData('ProdFillQ');
  const cans = getSheetData('ProdCan');

  // Helper functions
  const getNum = (row, fields) => {
    for (let i = 0; i < fields.length; i++) {
      const v = row[fields[i]];
      if (v !== undefined && v !== null && v !== '') return Number(v) || 0;
    }
    return 0;
  };

  const getDate = (row, fields) => {
    for (let i = 0; i < fields.length; i++) {
      const v = row[fields[i]];
      if (v !== undefined && v !== null && v !== '') return String(v);
    }
    return '';
  };

  const isDateInRange = (dateStr) => {
    if (!dateStr) return false;
    const d = String(dateStr).split('T')[0];
    if (startDate && d < startDate) return false;
    if (endDate && d > endDate) return false;
    return true;
  };

  // Waste type fields
  const wasteFields = [
    'waste_let', 'waste_steam', 'waste_float', 'waste_qc', 'waste_it',
    'waste_spur', 'waste_seam', 'waste_seamer', 'waste_breakdown'
  ];

  const wasteLabels = {
    'waste_let': 'เลท',
    'waste_steam': 'นึ่ง',
    'waste_float': 'ลอย',
    'waste_qc': 'QC',
    'waste_it': 'IT',
    'waste_spur': 'สเปอร์',
    'waste_seam': 'ตะเข็บ',
    'waste_seamer': 'ซีมเมอร์',
    'waste_breakdown': 'เครื่องเสีย'
  };

  // Filter waste data
  let filtered = wasteData.filter(r => isDateInRange(getDate(r, ['qcwaste_date', 'date'])));
  if (batchFilter) {
    filtered = filtered.filter(r => r.batch_id === batchFilter);
  }

  // Filter production data for ratio calculation
  let filteredFillQ = fillQ.filter(r => isDateInRange(getDate(r, ['ProdFillQ_date', 'prodfillq_date', 'date'])));
  let filteredCans = cans.filter(r => isDateInRange(r.prodcan_date));
  if (batchFilter) {
    filteredFillQ = filteredFillQ.filter(r => r.batch_id === batchFilter);
    filteredCans = filteredCans.filter(r => r.batch_id === batchFilter);
  }

  // --- 1. Summary by Department ---
  const departments = ['PD', 'WH', 'QC'];
  let deptSummary = {};
  departments.forEach(dept => {
    deptSummary[dept] = {};
    wasteFields.forEach(f => { deptSummary[dept][f] = 0; });
  });

  // Also track an "ALL" total
  let totalSummary = {};
  wasteFields.forEach(f => { totalSummary[f] = 0; });

  filtered.forEach(r => {
    const dept = (r.department || 'QC').toUpperCase();
    if (!deptSummary[dept]) {
      deptSummary[dept] = {};
      wasteFields.forEach(f => { deptSummary[dept][f] = 0; });
    }
    wasteFields.forEach(f => {
      const val = Number(r[f] || 0);
      deptSummary[dept][f] += val;
      totalSummary[f] += val;
    });
  });

  // Calculate department totals
  let deptTotals = {};
  departments.forEach(dept => {
    deptTotals[dept] = wasteFields.reduce((sum, f) => sum + (deptSummary[dept][f] || 0), 0);
  });
  let grandTotal = wasteFields.reduce((sum, f) => sum + totalSummary[f], 0);

  // --- 2. Summary by Batch ---
  // Get production qty per batch
  let batchProdQ = {};
  filteredFillQ.forEach(r => {
    const bid = r.batch_id;
    const qty = getNum(r, ['ProdFillQ_Qty', 'quantity', 'prodfillq_qty', 'qty']);
    batchProdQ[bid] = (batchProdQ[bid] || 0) + qty;
  });
  // Fallback to ProdCan
  filteredCans.forEach(r => {
    const bid = r.batch_id;
    if (!batchProdQ[bid]) {
      batchProdQ[bid] = (batchProdQ[bid] || 0) + Number(r.can_sum || 0);
    }
  });

  // Aggregate waste per batch
  let batchWaste = {};
  filtered.forEach(r => {
    const bid = r.batch_id || 'N/A';
    if (!batchWaste[bid]) {
      batchWaste[bid] = {};
      wasteFields.forEach(f => { batchWaste[bid][f] = 0; });
    }
    wasteFields.forEach(f => {
      batchWaste[bid][f] += Number(r[f] || 0);
    });
  });

  // Build batch rows with totals and ratio
  let batchRows = [];
  let sortedBatchIds = Object.keys(batchWaste).sort();
  sortedBatchIds.forEach(bid => {
    const w = batchWaste[bid];
    const batchTotal = wasteFields.reduce((sum, f) => sum + w[f], 0);
    const prodQ = batchProdQ[bid] || 0;
    const ratio = prodQ > 0 ? ((batchTotal / prodQ) * 100).toFixed(2) : 0;
    
    batchRows.push({
      batch_id: bid,
      waste: w,
      total: batchTotal,
      prodQ: prodQ,
      ratio: Number(ratio)
    });
  });

  // --- 3. Chart data: waste by type (stacked bar by department) ---
  let chartByType = {
    labels: wasteFields.map(f => wasteLabels[f] || f),
    datasets: departments.map((dept, idx) => ({
      label: dept === 'PD' ? 'ผลิต' : dept === 'WH' ? 'คลัง' : 'QC',
      data: wasteFields.map(f => deptSummary[dept][f] || 0),
      backgroundColor: ['rgba(217, 83, 79, 0.7)', 'rgba(240, 173, 78, 0.7)', 'rgba(91, 192, 222, 0.7)'][idx]
    }))
  };

  return {
    wasteFields: wasteFields,
    wasteLabels: wasteLabels,
    deptSummary: deptSummary,
    totalSummary: totalSummary,
    deptTotals: deptTotals,
    grandTotal: grandTotal,
    batchRows: batchRows,
    chartByType: chartByType
  };
}

// ========== RM ASSESSMENT DASHBOARD ==========
function getRMDashboard(payload) {
  const startDate = payload.startDate || '';
  const endDate = payload.endDate || '';
  const batchFilter = payload.batchFilter || '';

  const rm = getSheetData('ProdRM');
  const suppliers = getSheetData('Supplier');
  const fillQ = getSheetData('ProdFillQ');
  const canData = getSheetData('ProdCan');
  const fillW = getSheetData('ProdFillW');

  // Helpers
  const getNum = (row, fields) => {
    for (let i = 0; i < fields.length; i++) {
      const v = row[fields[i]];
      if (v !== undefined && v !== null && v !== '') return Number(v) || 0;
    }
    return 0;
  };

  const getDate = (row, fields) => {
    for (let i = 0; i < fields.length; i++) {
      const v = row[fields[i]];
      if (v !== undefined && v !== null && v !== '') return String(v);
    }
    return '';
  };

  const isDateInRange = (dateStr) => {
    if (!dateStr) return false;
    const d = String(dateStr).split('T')[0];
    if (startDate && d < startDate) return false;
    if (endDate && d > endDate) return false;
    return true;
  };

  // Supplier name map
  let supplierMap = {};
  suppliers.forEach(s => { supplierMap[s.supplier_id] = s.supplier_name || s.supplier_id; });

  // Filter RM data
  let filtered = rm.filter(r => isDateInRange(r.prodrm_date));
  if (batchFilter) {
    filtered = filtered.filter(r => r.batch_id === batchFilter);
  }

  // Filter production data
  let filteredFillQ = fillQ.filter(r => isDateInRange(getDate(r, ['ProdFillQ_date', 'prodfillq_date', 'date'])));
  let filteredCans = canData.filter(r => isDateInRange(r.prodcan_date));
  let filteredFillW = fillW.filter(r => isDateInRange(r.prodfillw_date));
  if (batchFilter) {
    filteredFillQ = filteredFillQ.filter(r => r.batch_id === batchFilter);
    filteredCans = filteredCans.filter(r => r.batch_id === batchFilter);
    filteredFillW = filteredFillW.filter(r => r.batch_id === batchFilter);
  }

  // --- SCORECARDS ---
  const totalWeight = filtered.reduce((sum, r) => sum + Number(r.weight || 0), 0);
  const totalBalance = filtered.reduce((sum, r) => sum + Number(r.balance || 0), 0);
  const balancePct = totalWeight > 0 ? ((totalBalance / totalWeight) * 100).toFixed(2) : 0;

  let uniqueSuppliers = new Set();
  let uniqueBills = new Set();
  filtered.forEach(r => {
    if (r.supplier_id) uniqueSuppliers.add(r.supplier_id);
    if (r.billsup_no) uniqueBills.add(r.billsup_no);
  });

  // --- PIE 1: Weight by Supplier ---
  let weightBySupplier = {};
  filtered.forEach(r => {
    const sName = supplierMap[r.supplier_id] || r.supplier_id || 'N/A';
    weightBySupplier[sName] = (weightBySupplier[sName] || 0) + Number(r.weight || 0);
  });

  // --- PIE 2: Batch count by Supplier ---
  let batchesBySupplier = {};
  filtered.forEach(r => {
    const sName = supplierMap[r.supplier_id] || r.supplier_id || 'N/A';
    if (!batchesBySupplier[sName]) batchesBySupplier[sName] = new Set();
    if (r.batch_id) batchesBySupplier[sName].add(r.batch_id);
  });
  let batchCountBySupplier = {};
  Object.keys(batchesBySupplier).forEach(s => {
    batchCountBySupplier[s] = batchesBySupplier[s].size;
  });

  // --- LINE CHART: RM usage by supplier over time (grouped by date) ---
  let dateSupplierMap = {};
  let allDates = new Set();
  let allSupplierNames = new Set();

  filtered.forEach(r => {
    const date = String(r.prodrm_date || '').split('T')[0];
    const sName = supplierMap[r.supplier_id] || r.supplier_id || 'N/A';
    if (!date) return;
    allDates.add(date);
    allSupplierNames.add(sName);
    if (!dateSupplierMap[date]) dateSupplierMap[date] = {};
    dateSupplierMap[date][sName] = (dateSupplierMap[date][sName] || 0) + Number(r.weight || 0);
  });

  let sortedDates = Array.from(allDates).sort();
  let sortedSupplierNames = Array.from(allSupplierNames).sort();

  // Chart colors
  const lineColors = [
    '#d9534f', '#5cb85c', '#337ab7', '#f0ad4e', '#5bc0de',
    '#8e44ad', '#e67e22', '#1abc9c', '#e74c3c', '#2c3e50',
    '#f39c12', '#27ae60', '#3498db', '#9b59b6', '#16a085'
  ];

  let lineDatasets = sortedSupplierNames.map((sName, idx) => ({
    label: sName,
    data: sortedDates.map(d => (dateSupplierMap[d] && dateSupplierMap[d][sName]) || 0),
    borderColor: lineColors[idx % lineColors.length],
    backgroundColor: lineColors[idx % lineColors.length] + '33',
    borderWidth: 2,
    pointRadius: 4,
    tension: 0.3,
    fill: false
  }));

  // --- CROSSTAB: Batch × Supplier ---
  // Production qty per batch
  let batchProdQ = {};
  filteredFillQ.forEach(r => {
    const bid = r.batch_id;
    const qty = getNum(r, ['ProdFillQ_Qty', 'quantity', 'prodfillq_qty', 'qty']);
    batchProdQ[bid] = (batchProdQ[bid] || 0) + qty;
  });
  filteredCans.forEach(r => {
    const bid = r.batch_id;
    if (!batchProdQ[bid]) {
      batchProdQ[bid] = (batchProdQ[bid] || 0) + Number(r.can_sum || 0);
    }
  });

  // Fill weight per batch (for yield calc)
  let batchFW = {};
  let batchFWCount = {};
  filteredFillW.forEach(r => {
    const bid = r.batch_id;
    batchFW[bid] = (batchFW[bid] || 0) + Number(r.weight || 0);
    batchFWCount[bid] = (batchFWCount[bid] || 0) + 1;
  });

  // Build crosstab data
  let crosstabBatches = new Set();
  let crosstabSuppliers = new Set();
  let crosstabData = {};

  filtered.forEach(r => {
    const bid = r.batch_id || 'N/A';
    const sid = supplierMap[r.supplier_id] || r.supplier_id || 'N/A';
    crosstabBatches.add(bid);
    crosstabSuppliers.add(sid);
    const key = bid + '|||' + sid;
    if (!crosstabData[key]) crosstabData[key] = { weight: 0, balance: 0 };
    crosstabData[key].weight += Number(r.weight || 0);
    crosstabData[key].balance += Number(r.balance || 0);
  });

  let sortedCTBatches = Array.from(crosstabBatches).sort();
  let sortedCTSuppliers = Array.from(crosstabSuppliers).sort();

  // Build crosstab rows
  let crosstabRows = [];
  sortedCTBatches.forEach(bid => {
    let rowRM = 0;
    let supplierWeights = {};
    sortedCTSuppliers.forEach(sid => {
      const key = bid + '|||' + sid;
      const w = crosstabData[key] ? crosstabData[key].weight : 0;
      supplierWeights[sid] = w;
      rowRM += w;
    });
    
    const prodQ = batchProdQ[bid] || 0;
    const avgW = batchFWCount[bid] ? batchFW[bid] / batchFWCount[bid] : 0;
    const yieldPct = rowRM > 0 ? ((prodQ * avgW) / (rowRM * 10)).toFixed(2) : 0;

    crosstabRows.push({
      batch_id: bid,
      supplierWeights: supplierWeights,
      totalRM: rowRM,
      prodQ: prodQ,
      yieldPct: Number(yieldPct)
    });
  });

  return {
    scorecards: {
      totalWeight: totalWeight,
      totalBalance: totalBalance,
      balancePct: Number(balancePct),
      supplierCount: uniqueSuppliers.size,
      billCount: uniqueBills.size
    },
    pieWeight: {
      labels: Object.keys(weightBySupplier),
      data: Object.values(weightBySupplier)
    },
    pieBatch: {
      labels: Object.keys(batchCountBySupplier),
      data: Object.values(batchCountBySupplier)
    },
    lineChart: {
      labels: sortedDates,
      datasets: lineDatasets
    },
    crosstab: {
      suppliers: sortedCTSuppliers,
      rows: crosstabRows
    }
  };
}
