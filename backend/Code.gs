/**
 * TFM Smart Production Monitoring System
 * Backend: Google Apps Script
 */

const SHEET_NAMES = [
  'Users', 'Customer', 'Brand', 'Supplier', 'CanSize', 'Machine',
  'ProdBatch', 'ProdRM', 'ProdFillW', 'ProdCan', 'ProdFillQ', 'WHIn', 'QCWaste', 'MachinePM', 'IssueLog', 'Logs'
];

/** 
 * SERVLET HANDLERS 
 */

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  const lock = LockService.getScriptLock();
  try {
    // Wait for up to 10 seconds for other processes to finish.
    lock.waitLock(10000); 
    
    const params = e.parameter;
    const action = params.action;
    
    // Parse Payload if Post
    let payload = {};
    if (e.postData && e.postData.contents) {
      try {
        payload = JSON.parse(e.postData.contents);
      } catch (err) {
        payload = {};
      }
    }
    
    let result = {};
    
    switch (action) {
      case 'setup':
        result = setupDatabase();
        break;
      case 'login':
        result = authenticateUser(payload);
        break;
      case 'getDashboard':
        result = getDashboardData();
        break;
      case 'getDashboardAdv':
        result = getDashboardAdv(payload);
        break;
      case 'getWasteDashboard':
        result = getWasteDashboard(payload);
        break;
      case 'getRMDashboard':
        result = getRMDashboard(payload);
        break;
        
      // --- Master Data CRUD ---
      case 'getUsers': result = getUsers(); break;
      case 'addUser': result = addUser(payload); break;
      case 'updateUser': result = updateUser(payload); break;
      case 'deleteUser': result = deleteUser(payload); break;

      case 'getCustomers': result = getCustomers(); break;
      case 'addCustomer': result = addCustomer(payload); break;
      case 'updateCustomer': result = updateCustomer(payload); break;
      case 'deleteCustomer': result = deleteCustomer(payload); break;

      case 'getBrands': result = getBrands(); break;
      case 'addBrand': result = addBrand(payload); break;
      case 'updateBrand': result = updateBrand(payload); break;
      case 'deleteBrand': result = deleteBrand(payload); break;

      case 'getSuppliers': result = getSuppliers(); break;
      case 'addSupplier': result = addSupplier(payload); break;
      case 'updateSupplier': result = updateSupplier(payload); break;
      case 'deleteSupplier': result = deleteSupplier(payload); break;

      case 'getCanSizes': result = getCanSizes(); break;
      case 'addCanSize': result = addCanSize(payload); break;
      case 'updateCanSize': result = updateCanSize(payload); break;
      case 'deleteCanSize': result = deleteCanSize(payload); break;

      case 'getMachines': result = getMachines(); break;
      case 'addMachine': result = addMachine(payload); break;
      case 'updateMachine': result = updateMachine(payload); break;
      case 'deleteMachine': result = deleteMachine(payload); break;

      // --- Transactions ---
      case 'saveBatch': result = saveBatch(payload); break;
      case 'getOpenBatches': result = getOpenBatches(); break;
      case 'saveRM': result = saveRM(payload); break;
      case 'saveFillWeight': result = saveFillWeight(payload); break;
      case 'saveCanUsage': result = saveCanUsage(payload); break;
      case 'saveFillQuantity': result = saveFillQuantity(payload); break;
      case 'saveWarehouseIn': result = saveWarehouseIn(payload); break;
      case 'saveQCWaste': result = saveQCWaste(payload); break;
      case 'saveMachinePM': result = saveMachinePM(payload); break;

      // --- Transaction CRUD (Read/Update/Delete) ---
      case 'getProdBatches': result = getProdBatches(); break;
      case 'updateBatch': result = updateBatch(payload); break;
      case 'deleteBatch': result = deleteBatch(payload.id); break;

      case 'getProdRMs': result = getProdRMs(); break;
      case 'updateRM': result = updateRM(payload); break;
      case 'deleteRM': result = deleteRM(payload.id); break;

      case 'getProdCans': result = getProdCans(); break;
      case 'updateCanUsage': result = updateCanUsage(payload); break;
      case 'deleteCanUsage': result = deleteCanUsage(payload.id); break;

      case 'getProdFillQs': result = getProdFillQs(); break;
      case 'updateFillQuantity': result = updateFillQuantity(payload); break;
      case 'deleteFillQuantity': result = deleteFillQuantity(payload.id); break;

      case 'getProdFillWs': result = getProdFillWs(); break;
      case 'updateFillWeight': result = updateFillWeight(payload); break;
      case 'deleteFillWeight': result = deleteFillWeight(payload.id); break;

      case 'getWHIns': result = getWHIns(); break;
      case 'updateWarehouseIn': result = updateWarehouseIn(payload); break;
      case 'deleteWarehouseIn': result = deleteWarehouseIn(payload.id); break;

      case 'getQCWastes': result = getQCWastes(); break;
      case 'updateQCWaste': result = updateQCWaste(payload); break;
      case 'deleteQCWaste': result = deleteQCWaste(payload.id); break;

      case 'getMachinePMs': result = getMachinePMs(); break;
      case 'updateMachinePM': result = updateMachinePM(payload); break;
      case 'deleteMachinePM': result = deleteMachinePM(payload.id); break;

      // --- Issue Log ---
      case 'saveIssueLog': result = saveIssueLog(payload); break;
      case 'getIssueLogs': result = getIssueLogs(); break;
      case 'updateIssueLog': result = updateIssueLog(payload); break;
      case 'deleteIssueLog': result = deleteIssueLog(payload.id); break;

      default:
        return createErrorResponse('Invalid Action: ' + action);
    }
    
    return createJSONResponse(result);
    
  } catch (e) {
    return createErrorResponse(e.toString());
  } finally {
    lock.releaseLock();
  }
}

/**
 * RESPONSE HELPERS
 */

function createJSONResponse(data) {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'success',
    data: data
  })).setMimeType(ContentService.MimeType.JSON);
}

function createErrorResponse(message) {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'error',
    message: message
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * DATABASE SETUP
 */

function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const created = [];
  
  // Define Headers for each sheet
  const headers = {
    'Users': ['username', 'password', 'fullname', 'role'], // role: 'admin', 'prod', 'wh', 'qc', 'ma'
    'Customer': ['customer_id', 'customer_name'],
    'Brand': ['brand_id', 'brand_name', 'customer_id'],
    'Supplier': ['supplier_id', 'supplier_name', 'fish_type'],
    'CanSize': ['cansize_id', 'cansize_name'],
    'Machine': ['machine_id', 'machine_name', 'ma_type'],
    'ProdBatch': ['prodbatch_id', 'prodbatch_date', 'batch_id', 'cansize_id', 'brand_id'],
    'ProdRM': ['prodrm_id', 'prodrm_date', 'batch_id', 'supplier_id', 'billsup_no', 'fish_type', 'weight', 'balance', 'fish_balance'],
    'ProdFillW': ['prodfillw_id', 'prodfillw_date', 'batch_id', 'weight'],
    'ProdCan': ['prodcan_id', 'prodcan_date', 'batch_id', 'basket_no', 'can_sum'],
    'ProdFillQ': ['prodfillq_id', 'ProdFillQ_date', 'batch_id', 'ProdFillQ_Qty'],
    'WHIn': ['whin_id', 'whin_date', 'batch_id', 'brand_id', 'so_no', 'can_sum', 'can_hold', 'remark'],
    'QCWaste': ['qcwaste_id', 'qcwaste_date', 'batch_id', 'department', 'can_type', 'waste_let', 'waste_steam', 'waste_float', 'waste_qc', 'waste_it', 'waste_spur', 'waste_seam', 'waste_seamer', 'waste_breakdown', 'waste_bumped', 'waste_swollen', 'waste_falseseam', 'waste_received', 'waste_other'],
    'MachinePM': ['machinepm_id', 'machinepm_date', 'machine_id', 'detail', 'start_time', 'end_time', 'downtime', 'solve', 'can_waste', 'employee'],
    'IssueLog': ['issue_id', 'issue_date', 'department', 'reporter', 'detail', 'status'],
    'Logs': ['timestamp', 'action', 'user', 'details']
  };

  SHEET_NAMES.forEach(name => {
    let sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      created.push(name);
      if (headers[name]) {
        sheet.appendRow(headers[name]);
      }
    }
  });

  // Setup Initial Users if Users sheet is new or empty
  const userSheet = ss.getSheetByName('Users');
  if (userSheet.getLastRow() === 1) { // Only header exists
    userSheet.appendRow(['admin', 'admin1234', 'System Admin', 'admin']);
    userSheet.appendRow(['pd_user', 'pd1234', 'Production Staff', 'prod']);
    userSheet.appendRow(['wh_user', 'wh1234', 'Warehouse Staff', 'wh']);
    userSheet.appendRow(['qc_user', 'qc1234', 'QC Quality Check', 'qc']);
    userSheet.appendRow(['ma_user', 'ma1234', 'Maintenance Staff', 'ma']);
    userSheet.appendRow(['rpt_user', 'rpt1234', 'Report Viewer', 'rpt']);
    created.push('Default Users for 6 Groups');
  }

  return { message: 'Database setup complete', created: created };
}

/**
 * AUTHENTICATION
 */

function authenticateUser(payload) {
  const { username, password } = payload;
  if (!username || !password) throw new Error('Missing credentials');
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Users');
  const data = sheet.getDataRange().getValues(); // 2D array
  
  // Skip header, find user
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    // Simple direct comparison (In production, use hashing!)
    if (row[0] == username && row[1] == password) {
      return {
        username: row[0],
        fullname: row[2],
        role: row[3],
        token: Utilities.getUuid() // Simple session token implementation
      };
    }
  }
  
  throw new Error('Invalid credentials');
}

/**
 * DASHBOARD DATA
 */
function getDashboardData() {
  return getDashboardMetrics();
}
