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
      statusDisplay.innerHTML = `${fullName} - <b>VALID PASS ENTRY</b>`;
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
  // You'll need to replace this URL with your Google Apps Script web app URL
  const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyPcVx_0MSksBB6BO6h2PSb2GorfxQyR7mbcOgNxJchV9iCiC7qnSu5G4WtgC1oqU5r/exec';

  const response = await fetch(YOUR_APPS_SCRIPT_URL_HERE, {
    method: 'POST',
    mode: 'cors',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      timestamp: logEntry.timestamp,
      searchTerm: logEntry.searchTerm,
      result: logEntry.result,
      status: logEntry.status,
      userAgent: logEntry.userAgent,
      sessionId: logEntry.sessionId
    })
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.json();
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
