
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
    // Update the URL to use the direct CSV export URL format
    const response = await fetch('https://docs.google.com/spreadsheets/d/17grn0kOCr5QUNtEEGnLOKUaRXJF03cEve0sxTuY0FFk/export?format=csv&gid=0');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const csvText = await response.text();
    console.log('Received CSV data:', csvText.substring(0, 200)); // Log first 200 chars

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
    
    console.log('Number of rows:', rows.length);
    console.log('First few rows:', rows.slice(0, 3));
    console.log('Searching for:', searchTerm.trim());

    // Find the ITS_ID column index from the header row
    const headerRow = rows[0];
    console.log('Header row:', headerRow);
    
    let itsIdColumnIndex = -1;
    let remarkColumnIndex = -1;
    
    // Look for ITS_ID column
    for (let i = 0; i < headerRow.length; i++) {
      const header = headerRow[i].toString().trim().replace(/"/g, '').toLowerCase();
      console.log(`Column ${i} header: "${header}"`);
      if (header.includes('its_id') || header.includes('itsid')) {
        itsIdColumnIndex = i;
      }
      if (header.includes('remarks') || header.includes('remarks')) {
        remarkColumnIndex = i;
      }
    }
    
    console.log('ITS_ID column index:', itsIdColumnIndex);
    console.log('Remark column index:', remarkColumnIndex);
    
    if (itsIdColumnIndex === -1) {
      throw new Error('ITS_ID column not found in the spreadsheet');
    }

    const matchingRow = rows.find((row, index) => {
      if (index === 0) return false; // Skip header row
      const cellValue = row[itsIdColumnIndex] ? row[itsIdColumnIndex].toString().trim().replace(/"/g, '') : '';
      console.log(`Row ${index}: ITS_ID value = "${cellValue}"`);
      return cellValue === searchTerm.trim();
    });

    if (matchingRow) {
      const fullName = matchingRow[1] || 'Name not available';
      const remark = remarkColumnIndex !== -1 ? (matchingRow[remarkColumnIndex] || 'No remark available') : 'Remark column not found';
      const result = `${fullName} - Remark: ${remark}`;
      statusDisplay.innerHTML = `${fullName} - Remark: <b>${remark}</b>`;
      addLogEntry(searchTerm, 'Found: ' + result);
    } else {
      statusDisplay.textContent = 'NOT A VALID PASS ENTRY';
      addLogEntry(searchTerm, 'No valid pass entry');
    }
  } catch (error) {
    console.error('Error details:', error);
    statusDisplay.textContent = `Error fetching data: ${error.message}`;
    addLogEntry(searchTerm, 'Error: ' + error.message);
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
