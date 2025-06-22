
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
    } else {
      statusDisplay.textContent = 'NOT A VALID PASS ENTRY';
      statusDisplay.classList.remove('valid');
      statusDisplay.classList.add('invalid');
    }
  } catch (error) {
    statusDisplay.textContent = `Error fetching data`;
    statusDisplay.classList.remove('valid');
    statusDisplay.classList.add('invalid');
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
