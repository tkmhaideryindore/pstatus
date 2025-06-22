function addLogEntry(searchTerm, result) {
  const logDisplay = document.getElementById('logDisplay');
  if (logDisplay) {
    const timestamp = new Date().toLocaleString();
    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry';
    logEntry.textContent = `${timestamp} - Searched: ${searchTerm} - ${result}`;
    logDisplay.insertBefore(logEntry, logDisplay.firstChild);
  }
}

async function searchSheet() {
  const searchTerm = document.getElementById('searchInput').value.trim();
  const statusDisplay = document.getElementById('statusDisplay');

  if (!searchTerm) {
    statusDisplay.textContent = 'Please enter a search term';
    statusDisplay.classList.add('active');
    return;
  }

  try {
    // Get URL from config
    const response = await fetch(getSheetUrl());
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const csvText = await response.text();

    if (!csvText) {
      throw new Error('No data received from spreadsheet');
    }

    // Better CSV parsing to handle quoted values
    const rows = csvText.split('\n').map(row => {
      const result = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < row.length; i++) {
        const char = row[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    });

    // Find the ITS_ID column index from the header row
    const headerRow = rows[0];

    let itsIdColumnIndex = -1;
    let remarkColumnIndex = -1;

    // Look for ITS_ID column
    for (let i = 0; i < headerRow.length; i++) {
      const header = headerRow[i].toString().trim().replace(/"/g, '').toLowerCase();
      if (header.includes('its_id') || header.includes('itsid')) {
        itsIdColumnIndex = i;
      }
      if (header.includes('remarks') || header.includes('remarks')) {
        remarkColumnIndex = i;
      }
    }

    if (itsIdColumnIndex === -1) {
      throw new Error('ITS_ID column not found in the spreadsheet');
    }

    const matchingRow = rows.find((row, index) => {
      if (index === 0) return false; // Skip header row
      const cellValue = row[itsIdColumnIndex] ? row[itsIdColumnIndex].toString().trim().replace(/"/g, '') : '';
      return cellValue === searchTerm.trim();
    });

    if (matchingRow) {
      const fullName = matchingRow[1] || 'Name not available';
      statusDisplay.innerHTML = `<b>VALID PASS ENTRY</b>`;
      statusDisplay.classList.remove('invalid');
      statusDisplay.classList.add('valid');
      addLogEntry(searchTerm, fullName, 'VALID');

    } else {
      statusDisplay.textContent = 'NOT A VALID PASS ENTRY';
      statusDisplay.classList.remove('valid');
      statusDisplay.classList.add('invalid');
      addLogEntry(searchTerm, 'NOT A VALID PASS ENTRY', 'INVALID');
    }
  } catch (error) {
    statusDisplay.textContent = `Error fetching data`;
    statusDisplay.classList.remove('valid');
    statusDisplay.classList.add('invalid');
    addLogEntry(searchTerm, `Error fetching data: ${error}`, 'ERROR');
  }
  statusDisplay.classList.add('active');

  // Clear input after successful search
  document.getElementById('searchInput').value = '';

  // Auto-hide result after 15 seconds instead of refreshing entire page
  setTimeout(function() {
    statusDisplay.classList.remove('active');
  }, 15000);
}

// Allow search on Enter key press
document.getElementById('searchInput').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    searchSheet();
  }
});

// Logging system - Send to Google Sheets
async function addLogEntry(searchTerm, result, status) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp: timestamp,
    searchTerm: searchTerm,
    result: result,
    status: status,
    userAgent: navigator.userAgent,
    sessionId: getSessionId()
  };

  // Also store locally as backup
  let logs = JSON.parse(localStorage.getItem('searchLogs') || '[]');
  logs.unshift(logEntry);
  if (logs.length > 100) {
    logs = logs.slice(0, 100); // Keep fewer local logs since main storage is in Sheets
  }
  localStorage.setItem('searchLogs', JSON.stringify(logs));

  // Send to Google Sheets
  try {
    await sendLogToSheet(logEntry);
    console.log('Log entry sent to Google Sheets:', logEntry);
  } catch (error) {
    console.error('Failed to send log to Google Sheets:', error);
    // Log will still be stored locally as backup
  }
}

// Generate a unique session ID for this browser session
function getSessionId() {
  let sessionId = sessionStorage.getItem('searchSessionId');
  if (!sessionId) {
    sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    sessionStorage.setItem('searchSessionId', sessionId);
  }
  return sessionId;
}

// Send log entry to Google Sheets via Apps Script
async function sendLogToSheet(logEntry) {
  // IMPORTANT: Replace this with your actual deployed Google Apps Script URL
  const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzSqJo_ZZrVgnl9QXS4K5BZY1IhjW1xuGDS0fZfMDRhotg78p9qb4rYwvgCo2ex-KQQ/exec';

  // Method 1: Try URL parameters (most reliable)
  try {
    const params = new URLSearchParams({
      timestamp: logEntry.timestamp,
      searchTerm: logEntry.searchTerm,
      result: logEntry.result,
      status: logEntry.status,
      userAgent: logEntry.userAgent,
      sessionId: logEntry.sessionId
    });

    const urlWithParams = `${GOOGLE_APPS_SCRIPT_URL}?${params.toString()}`;

    await fetch(urlWithParams, {
      method: 'POST',
      mode: 'no-cors'
    });

    console.log('Log sent to Google Sheets via URL parameters');
    return { success: true };

  } catch (urlError) {
    console.error('URL method failed:', urlError);

    // Method 2: Try form data
    try {
      const formData = new FormData();
      formData.append('timestamp', logEntry.timestamp);
      formData.append('searchTerm', logEntry.searchTerm);
      formData.append('result', logEntry.result);
      formData.append('status', logEntry.status);
      formData.append('userAgent', logEntry.userAgent);
      formData.append('sessionId', logEntry.sessionId);

      await fetch(GOOGLE_APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        body: formData
      });

      console.log('Log sent to Google Sheets via form data');
      return { success: true };

    } catch (formError) {
      console.error('Form data method also failed:', formError);

      // Method 3: Try JSON (last resort)
      try {
        await fetch(GOOGLE_APPS_SCRIPT_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(logEntry)
        });

        console.log('Log sent to Google Sheets via JSON');
        return { success: true };

      } catch (jsonError) {
        console.error('All methods failed:', jsonError);
        throw new Error('Failed to send log to Google Sheets');
      }
    }
  }
}

function downloadLogs() {
  const logs = JSON.parse(localStorage.getItem('searchLogs') || '[]');

  if (logs.length === 0) {
    alert('No local logs available to download. Logs are now stored in Google Sheets. You can access them at: https://docs.google.com/spreadsheets/d/1EvpStANT4Ncyinx4jDSB6wPfOztuZar4PP8b1GA_J1s/edit');
    return;
  }

  // Convert logs to CSV format
  const csvHeader = 'Timestamp,Search Term,Result,Status,User Agent,Session ID\n';
  const csvContent = logs.map(log =>
    `"${log.timestamp}","${log.searchTerm}","${log.result}","${log.status}","${log.userAgent}","${log.sessionId || 'N/A'}"`
  ).join('\n');

  const csvData = csvHeader + csvContent;

  // Create blob and download
  const blob = new Blob([csvData], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `local_search_logs_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

function clearLogs() {
  if (confirm('Are you sure you want to clear local logs? This will not affect logs stored in Google Sheets.')) {
    localStorage.removeItem('searchLogs');
    updateLogCount();
    alert('Local logs cleared successfully');
  }
}

function openGoogleSheet() {
  window.open('https://docs.google.com/spreadsheets/d/1EvpStANT4Ncyinx4jDSB6wPfOztuZar4PP8b1GA_J1s/edit', '_blank');
}

// Test function to manually test Google Sheets logging
async function testGoogleSheetsLogging() {
  const testEntry = {
    timestamp: new Date().toISOString(),
    searchTerm: 'TEST_' + Date.now(),
    result: 'Manual Test Entry',
    status: 'TEST',
    userAgent: navigator.userAgent,
    sessionId: getSessionId()
  };

  try {
    await sendLogToSheet(testEntry);
    alert('Test log sent successfully! Check the Google Sheet.');
  } catch (error) {
    alert('Test failed: ' + error.message);
    console.error('Manual test failed:', error);
  }
}

function getLogCount() {
  const logs = JSON.parse(localStorage.getItem('searchLogs') || '[]');
  return logs.length;
}

function updateLogCount() {
  const count = getLogCount();
  document.getElementById('logCount').textContent = `Local Logs: ${count}`;
}

// Initialize log count on page load
document.addEventListener('DOMContentLoaded', function() {
  updateLogCount();

  // Add test button to console
  console.log('To test Google Sheets logging, run: testGoogleSheetsLogging()');
});

// Update log count after each search
const originalAddLogEntry = addLogEntry;
window.addLogEntry = async function(searchTerm, result, status) {
  await originalAddLogEntry(searchTerm, result, status);
  updateLogCount();
};
