/**
 * DATABASE OPERATIONS - MASTER DATA
 */

// Generic Helper to get sheet data as JSON
function getSheetData(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  return data.slice(1).map(row => {
    let obj = {};
    headers.forEach((header, index) => {
      let val = row[index];
      // FIX: Handle Date objects to prevent timezone shift when JSON serializing
      if (val instanceof Date) {
        // Use Spreadsheet Timezone to ensure consistency with what user sees in the sheet
        if (header.includes('time')) {
             val = Utilities.formatDate(val, ss.getSpreadsheetTimeZone(), 'HH:mm');
        } else {
             val = Utilities.formatDate(val, ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd');
        }
      }
      obj[header] = val;
    });
    return obj;
  });
}

// Generic Helper to append data
function addRecord(sheetName, dataObj) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  // Create a map for case-insensitive matching
  const dataMap = {};
  Object.keys(dataObj).forEach(k => {
    dataMap[k.toLowerCase()] = dataObj[k];
  });

  const row = headers.map(header => {
      // Try exact match first, then case-insensitive
      if (dataObj.hasOwnProperty(header)) return dataObj[header];
      return dataMap[header.toLowerCase()] || '';
  });
  
  sheet.appendRow(row);
  return { status: 'success', message: 'Record added to ' + sheetName };
}

// Helper to find header index robustly (case-insensitive and ignoring symbols)
function findHeaderIndex(headers, idField) {
  let idx = headers.indexOf(idField);
  if (idx !== -1) return idx;
  const cleanField = String(idField).toLowerCase().replace(/[^a-z0-9]/g, '');
  for (let i = 0; i < headers.length; i++) {
    const cleanHeader = String(headers[i]).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (cleanHeader === cleanField) return i;
  }
  return -1;
}

// Generic Helper to update data
function updateRecord(sheetName, idField, idValue, dataObj) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIndex = findHeaderIndex(headers, idField);
  
  if (idIndex === -1) throw new Error('ID field not found: ' + idField);
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][idIndex] == idValue) {
      // Update row
      const newRow = headers.map((header, colIndex) => {
        return dataObj[header] !== undefined ? dataObj[header] : data[i][colIndex];
      });
      sheet.getRange(i + 1, 1, 1, headers.length).setValues([newRow]);
      return { status: 'success', message: 'Record updated in ' + sheetName };
    }
  }
  throw new Error('Record not found');
}

// Generic Helper to delete data
function deleteRecord(sheetName, idField, idValue) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIndex = findHeaderIndex(headers, idField);
  
  if (idIndex === -1) throw new Error('ID field not found: ' + idField);
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][idIndex] == idValue) {
      sheet.deleteRow(i + 1);
      return { status: 'success', message: 'Record deleted from ' + sheetName };
    }
  }
  throw new Error('Record not found');
}

/** SPECIFIC HANDLERS FOR API MAPPING **/

// Define a schema for sheets, assuming this is what the instruction implies
const SHEET_SCHEMA = {
  'ProdCan': ['prodcan_id', 'prodcan_date', 'batch_id', 'basket_no', 'can_sum'],
  'ProdFillQ': ['prodfillq_id', 'ProdFillQ_date', 'batch_id', 'ProdFillQ_Qty'], // User Definition
  'WHIn': ['whin_id', 'whin_date', 'batch_id', 'brand_id', 'so_no', 'can_sum', 'can_hold', 'remark'],
  'QCWaste': ['qcwaste_id', 'qcwaste_date', 'batch_id', 'department', 'can_type', 'waste_let', 'waste_steam', 'waste_float', 'waste_qc', 'waste_it', 'waste_spur', 'waste_seam', 'waste_seamer', 'waste_breakdown', 'waste_bumped', 'waste_swollen', 'waste_falseseam', 'waste_received', 'waste_other'],
  'ProdBatch': ['prodbatch_id', 'prodbatch_date', 'batch_id', 'cansize_id', 'brand_id'],
  'ProdRM': ['prodrm_id', 'prodrm_date', 'batch_id', 'supplier_id', 'billsup_no', 'fish_type', 'weight', 'balance', 'fish_balance'],
  'ProdFillW': ['prodfillw_id', 'prodfillw_date', 'batch_id', 'weight'],
  'IssueLog': ['issue_id', 'issue_date', 'department', 'reporter', 'detail', 'status'],
};

function getUsers() { return getSheetData('Users'); }
function addUser(data) { return addRecord('Users', data); }
function updateUser(data) { return updateRecord('Users', 'username', data.username, data); }
function deleteUser(data) { return deleteRecord('Users', 'username', data.username); }

function getCustomers() { return getSheetData('Customer'); }
function addCustomer(data) { return addRecord('Customer', data); }
function updateCustomer(data) { return updateRecord('Customer', 'customer_id', data.customer_id, data); }
function deleteCustomer(data) { return deleteRecord('Customer', 'customer_id', data.customer_id); }

function getBrands() { return getSheetData('Brand'); }
function addBrand(data) { return addRecord('Brand', data); }
function updateBrand(data) { return updateRecord('Brand', 'brand_id', data.brand_id, data); }
function deleteBrand(data) { return deleteRecord('Brand', 'brand_id', data.brand_id); }

function getSuppliers() { return getSheetData('Supplier'); }
function addSupplier(data) { return addRecord('Supplier', data); }
function updateSupplier(data) { return updateRecord('Supplier', 'supplier_id', data.supplier_id, data); }
function deleteSupplier(data) { return deleteRecord('Supplier', 'supplier_id', data.supplier_id); }

function getCanSizes() { return getSheetData('CanSize'); }
function addCanSize(data) { return addRecord('CanSize', data); }
function updateCanSize(data) { return updateRecord('CanSize', 'cansize_id', data.cansize_id, data); }
function deleteCanSize(data) { return deleteRecord('CanSize', 'cansize_id', data.cansize_id); }

function getMachines() { return getSheetData('Machine'); }
function addMachine(data) { return addRecord('Machine', data); }
function updateMachine(data) { return updateRecord('Machine', 'machine_id', data.machine_id, data); }
function deleteMachine(data) { return deleteRecord('Machine', 'machine_id', data.machine_id); }

// === MIGRATION HELPER ===
// Run this function from Apps Script Editor to add fish_type column to ProdRM
function migrateProdRM_FishType() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('ProdRM');
  if (!sheet) return 'ProdRM sheet not found';
  
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  if (headers.includes('fish_type')) {
    return 'fish_type column already exists!';
  }
  
  // Find position: after billsup_no, before weight
  let insertAfter = headers.indexOf('billsup_no');
  if (insertAfter === -1) insertAfter = headers.indexOf('supplier_id');
  
  const colPos = insertAfter + 2; // +1 for 0-index, +1 for "after"
  sheet.insertColumnAfter(insertAfter + 1);
  sheet.getRange(1, colPos).setValue('fish_type');
  
  return 'fish_type column added to ProdRM at position ' + colPos;
}

// Run this function from Apps Script Editor to add department column to QCWaste
function migrateQCWaste_Department() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('QCWaste');
  if (!sheet) return 'QCWaste sheet not found';
  
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  if (headers.includes('department')) {
    return 'department column already exists!';
  }
  
  // Insert after batch_id, before can_type
  let insertAfter = headers.indexOf('batch_id');
  if (insertAfter === -1) insertAfter = 1; // fallback
  
  const colPos = insertAfter + 2;
  sheet.insertColumnAfter(insertAfter + 1);
  sheet.getRange(1, colPos).setValue('department');
  
  return 'department column added to QCWaste at position ' + colPos;
}

// =============================================
// MIGRATION FUNCTIONS — Run from Apps Script Editor
// =============================================

// Add fish_balance column to ProdRM (for existing sheets)
function migrateProdRM_FishBalance() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('ProdRM');
  if (!sheet) return 'ProdRM sheet not found';
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  if (headers.includes('fish_balance')) return 'fish_balance already exists!';
  // Add after 'balance'
  const afterIdx = headers.indexOf('balance');
  const colPos = (afterIdx === -1 ? headers.length : afterIdx + 1) + 1;
  if (afterIdx !== -1) sheet.insertColumnAfter(afterIdx + 1);
  sheet.getRange(1, colPos).setValue('fish_balance');
  return 'fish_balance column added to ProdRM at position ' + colPos;
}

// Add so_no column to WHIn (for existing sheets)
function migrateWHIn_SoNo() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('WHIn');
  if (!sheet) return 'WHIn sheet not found';
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  if (headers.includes('so_no')) return 'so_no already exists!';
  // Add after 'brand_id'
  const afterIdx = headers.indexOf('brand_id');
  const colPos = (afterIdx === -1 ? headers.length : afterIdx + 1) + 1;
  if (afterIdx !== -1) sheet.insertColumnAfter(afterIdx + 1);
  sheet.getRange(1, colPos).setValue('so_no');
  return 'so_no column added to WHIn at position ' + colPos;
}

// Add new waste type columns to QCWaste (for existing sheets)
function migrateQCWaste_NewTypes() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('QCWaste');
  if (!sheet) return 'QCWaste sheet not found';
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const newCols = ['waste_bumped', 'waste_swollen', 'waste_falseseam', 'waste_received', 'waste_other'];
  const added = [];
  newCols.forEach(col => {
    if (!headers.includes(col)) {
      const lastCol = sheet.getLastColumn();
      sheet.getRange(1, lastCol + 1).setValue(col);
      headers.push(col); // update local copy
      added.push(col);
    }
  });
  return added.length > 0 ? 'Added columns: ' + added.join(', ') : 'All columns already exist!';
}

// Run ALL migration functions at once
function runAllMigrations() {
  const results = [];
  results.push('ProdRM fish_balance: ' + migrateProdRM_FishBalance());
  results.push('WHIn so_no: ' + migrateWHIn_SoNo());
  results.push('QCWaste new types: ' + migrateQCWaste_NewTypes());
  Logger.log(results.join('\n'));
  return results.join('\n');
}

