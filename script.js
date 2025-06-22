
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
    console.log('Received CSV data:', csvText.substring(0, 100)); // Log first 100 chars

    if (!csvText) {
      throw new Error('No data received from spreadsheet');
    }

    const rows = csvText.split('\n').map(row => row.split(','));
    console.log('Number of rows:', rows.length);

    const matchingRow = rows.find(row => 
      row[0] && row[0].toString().trim() === searchTerm.trim()
    );

    if (matchingRow) {
      const fullName = matchingRow[1] || 'Name not available';
      const status = matchingRow[6] || 'No status available';
      const result = `${fullName} - Status: ${status}`;
      statusDisplay.innerHTML = `${fullName} - Status: <b>${status}</b>`;
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
