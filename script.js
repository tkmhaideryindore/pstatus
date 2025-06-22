
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
    const response = await fetch('https://docs.google.com/spreadsheets/d/e/2PACX-1vQ4T5Sv0fLzVR-JVz5fbd9SEjxPexU_1ceanaiL2q9SlA-6OmsdzAxguAHFduN5PfQBmEGvXUf1FPrN/pub?gid=136588082&single=true&output=csv');
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
      //statusDisplay.textContent = `${fullName} - Status: ${status}`;
statusDisplay.innerHTML = `${fullName} - Status: <b>${status}</b>`;
    } else {
      statusDisplay.textContent = 'NOT A VALID PASS ENTRY';
    }
  } catch (error) {
    console.error('Error details:', error);
    statusDisplay.textContent = `Error fetching data: ${error.message}`;
  }
  statusDisplay.classList.add('active');
  setTimeout(function() {
    location.reload();
  }, 10000); // 10000 ms = 10 seconds
}

// Allow search on Enter key press
document.getElementById('searchInput').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    searchSheet();
  }
});
