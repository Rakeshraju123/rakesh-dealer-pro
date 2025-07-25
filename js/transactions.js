// Transactions Management Module
window.TransactionsManagement = (function() {
    'use strict';

    // Private variables
    let transactionsData = [];
    let filteredTransactions = [];
    let currentPage = 1;
    let pageSize = 10;
    let sortField = 'transaction_id';
    let sortDirection = 'asc';
    let currentDeletingTransaction = null;

    // Transactions data will be loaded from API

    // Initialize the transactions management module
    function init() {
        console.log('Initializing Transactions Management...');
        
        // Load transactions data
        loadTransactionsData();
        
        // Setup event listeners
        setupEventListeners();
    }

    // Load transactions data from API
    function loadTransactionsData() {
        showLoading(true);
        
        // Get current filters for API call
        const searchTerm = document.getElementById('transactions-search')?.value || '';
        const typeFilter = document.getElementById('type-filter')?.value || '';
        const dateFrom = document.getElementById('date-from')?.value || '';
        const dateTo = document.getElementById('date-to')?.value || '';
        
        // Build API URL with parameters
        const params = new URLSearchParams({
            action: 'list',
            dealer_id: window.DealerID,
            page: currentPage,
            pageSize: pageSize,
            search: searchTerm,
            type: typeFilter,
            date_from: dateFrom,
            date_to: dateTo,
            sort: sortField,
            direction: sortDirection
        });
        
        fetch(`${window.baseKeyword}api/transactions.php?${params}`)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    transactionsData = data.data.transactions || [];
                    filteredTransactions = [...transactionsData];
                    
                    // Update pagination info from API
                    if (data.data.pagination) {
                        updatePaginationFromAPI(data.data.pagination);
                        renderTransactionsTableWithoutPagination(); // Don't call updatePagination again
                    } else {
                        // Fallback to local pagination if API doesn't provide pagination data
                        renderTransactionsTable();
                    }
                    
                    loadStatistics();
                } else {
                    transactionsData = [];
                    filteredTransactions = [];
                    console.error('Failed to load transactions:', data.error);
                    alert('Failed to load transactions data');
                }
            })
            .catch(error => {
                console.error('Error loading transactions:', error);
                alert('Failed to connect to server');
            })
            .finally(() => {
                showLoading(false);
            });
    }

    // Update pagination info from API response
    function updatePaginationFromAPI(paginationData) {
        const paginationInfo = document.getElementById('pagination-info');
        const paginationControls = document.getElementById('pagination-controls');
        
        if (paginationInfo) {
            const start = ((paginationData.current_page - 1) * paginationData.page_size) + 1;
            const end = Math.min(start + paginationData.page_size - 1, paginationData.total_items);
            paginationInfo.textContent = `Showing ${start}-${end} of ${paginationData.total_items} transactions`;
        }
        
        if (paginationControls) {
            const prevButton = paginationControls.querySelector('#prev-page');
            const nextButton = paginationControls.querySelector('#next-page');
            const pageNumbers = paginationControls.querySelector('#page-numbers');
            
            if (prevButton) prevButton.disabled = !paginationData.has_prev;
            if (nextButton) nextButton.disabled = !paginationData.has_next;
            if (pageNumbers) pageNumbers.innerHTML = generatePageNumbers(paginationData.current_page, paginationData.total_pages);
        }
    }

    // Render transactions table without calling updatePagination (for API-driven pagination)
    function renderTransactionsTableWithoutPagination() {
        const tableBody = document.getElementById('transactions-table-body');
        const emptyState = document.getElementById('transactions-empty-state');
        
        if (!tableBody) return;

        // Show empty state if no transactions
        if (filteredTransactions.length === 0) {
            tableBody.innerHTML = '';
            if (emptyState) emptyState.style.display = 'block';
            return;
        }

        // Hide empty state
        if (emptyState) emptyState.style.display = 'none';

        // Render transactions
        tableBody.innerHTML = filteredTransactions.map(transaction => `
            <tr>
                <td><strong>${transaction.transaction_number || transaction.transaction_id}</strong></td>
                <td>${transaction.customer_name}</td>
                <td>
                    <span class="chip chip--${transaction.transaction_type}">
                        ${capitalizeFirst(transaction.transaction_type)}
                    </span>
                </td>
                <td><strong>${formatCurrency(transaction.amount)}</strong></td>
                <td>${formatCurrency(transaction.fee)}</td>
                <td><strong class="text-success">${formatCurrency(transaction.net_amount)}</strong></td>
                <td>${formatDate(transaction.transaction_date)}</td>
                <td class="cell-icon">
                    <div class="table__actions">
                        <button class="btn btn--text btn--small" onclick="TransactionsManagement.viewTransactionDetails('${transaction.transaction_id}')" title="View Details">
                            <div class="icon icon--eye"></div>
                        </button>
                        <button class="btn btn--text-danger btn--small" onclick="TransactionsManagement.deleteTransaction('${transaction.transaction_id}')" title="Delete Transaction">
                            <div class="icon icon--trash"></div>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    // Handle search functionality
    function handleSearch() {
        currentPage = 1; // Reset to first page when searching
        loadTransactionsData(); // Reload data from server with search parameters
    }

    // Handle filter functionality
    function handleFilter() {
        currentPage = 1; // Reset to first page when filtering
        loadTransactionsData(); // Reload data from server with filter parameters
    }

    // Setup event listeners
    function setupEventListeners() {
        // Search functionality
        const searchInput = document.getElementById('transactions-search');
        if (searchInput) {
            searchInput.addEventListener('input', debounce(handleSearch, 300));
        }

        // Filter functionality
        const typeFilter = document.getElementById('type-filter');
        const dateFromFilter = document.getElementById('date-from');
        const dateToFilter = document.getElementById('date-to');
        
        if (typeFilter) {
            typeFilter.addEventListener('change', handleFilter);
        }
        
        if (dateFromFilter) {
            dateFromFilter.addEventListener('change', handleFilter);
        }
        
        if (dateToFilter) {
            dateToFilter.addEventListener('change', handleFilter);
        }

        // Modal close events
        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('modal-overlay')) {
                closeAllModals();
            }
        });
    }

    // Apply all filters and search
    function applyFilters() {
        const searchTerm = document.getElementById('transactions-search').value.toLowerCase();
        const typeFilter = document.getElementById('type-filter').value;
        const amountFilter = document.getElementById('amount-filter').value;

        filteredTransactions = transactionsData.filter(transaction => {
                    const matchesSearch = !searchTerm || 
            transaction.transaction_number.toLowerCase().includes(searchTerm) ||
            transaction.customer_name.toLowerCase().includes(searchTerm) ||
            transaction.transaction_type.toLowerCase().includes(searchTerm);
        
        const matchesType = !typeFilter || transaction.transaction_type === typeFilter;
            
            let matchesAmount = true;
            if (amountFilter) {
                const amount = transaction.amount;
                switch (amountFilter) {
                    case '0-500':
                        matchesAmount = amount >= 0 && amount <= 500;
                        break;
                    case '500-2000':
                        matchesAmount = amount > 500 && amount <= 2000;
                        break;
                    case '2000+':
                        matchesAmount = amount > 2000;
                        break;
                }
            }

            return matchesSearch && matchesType && matchesAmount;
        });

        currentPage = 1;
        renderTransactionsTable();
        updateStatistics();
    }

    // Clear all filters
    function clearFilters() {
        document.getElementById('transactions-search').value = '';
        document.getElementById('type-filter').value = '';
        document.getElementById('amount-filter').value = '';
        
        filteredTransactions = [...transactionsData];
        currentPage = 1;
        renderTransactionsTable();
        updateStatistics();
    }

    // Sort table by field
    function sortTable(field) {
        if (sortField === field) {
            sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            sortField = field;
            sortDirection = 'asc';
        }

        filteredTransactions.sort((a, b) => {
            let aVal = a[field];
            let bVal = b[field];

            // Handle numeric fields
            if (field === 'amount' || field === 'fee' || field === 'net') {
                aVal = parseFloat(aVal);
                bVal = parseFloat(bVal);
            }

            // Handle date fields
            if (field === 'date') {
                aVal = new Date(aVal);
                bVal = new Date(bVal);
            }

            // Handle string fields
            if (typeof aVal === 'string') {
                aVal = aVal.toLowerCase();
                bVal = bVal.toLowerCase();
            }

            if (sortDirection === 'asc') {
                return aVal > bVal ? 1 : -1;
            } else {
                return aVal < bVal ? 1 : -1;
            }
        });

        // Update table header visual feedback
        updateTableHeaderSorting(field, sortDirection);
        
        renderTransactionsTable();
    }

    // Update table header sorting visual feedback
    function updateTableHeaderSorting(field, direction) {
        // Remove all existing sort classes
        const headers = document.querySelectorAll('.table th');
        headers.forEach(header => {
            header.classList.remove('sort-asc', 'sort-desc');
        });

        // Add sort class to current field
        const currentHeader = document.querySelector(`th[onclick="TransactionsManagement.sortTable('${field}')"]`);
        if (currentHeader) {
            currentHeader.classList.add(direction === 'asc' ? 'sort-asc' : 'sort-desc');
        }
    }

    // Render transactions table
    function renderTransactionsTable() {
        const tableBody = document.getElementById('transactions-table-body');
        const emptyState = document.getElementById('transactions-empty-state');
        
        if (!tableBody) return;

    // Calculate pagination
        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const paginatedTransactions = filteredTransactions.slice(startIndex, endIndex);

        // Show empty state if no transactions
        if (filteredTransactions.length === 0) {
            tableBody.innerHTML = '';
            if (emptyState) emptyState.style.display = 'block';
            updatePagination();
        return;
    }

        if (emptyState) emptyState.style.display = 'none';

                // Render table rows
        tableBody.innerHTML = paginatedTransactions.map(transaction => `
        <tr>
                <td><strong>${transaction.transaction_number || transaction.transaction_id}</strong></td>
            <td>${transaction.customer_name}</td>
            <td>
                    <span class="type-chip type-chip--${transaction.transaction_type}">
                        ${capitalizeFirst(transaction.transaction_type)}
                </span>
            </td>
                <td><strong>${formatCurrency(transaction.amount)}</strong></td>
                <td>
                    <span class="${transaction.fee > 0 ? 'text-warning' : 'text-success'}">
                        ${formatCurrency(transaction.fee)}
                    </span>
            </td>
                <td>
                    <strong class="text-success">${formatCurrency(transaction.net_amount)}</strong>
            </td>
                <td>${formatDate(transaction.transaction_date)}</td>
                <td class="cell-icon">
                    <div class="table__actions">
                        <button class="btn btn--text btn--small" onclick="TransactionsManagement.viewTransactionDetails(${transaction.transaction_id})" title="View Details">
                        <div class="icon icon--eye"></div>
                        </button>
                        <button class="btn btn--text-danger btn--small" onclick="TransactionsManagement.deleteTransaction(${transaction.transaction_id})" title="Delete Transaction">
                        <div class="icon icon--trash"></div>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

        updatePagination();
    }

// Update pagination
    function updatePagination() {
        const totalPages = Math.ceil(filteredTransactions.length / pageSize);
        const paginationInfo = document.getElementById('pagination-info-text');
        const paginationNumbers = document.getElementById('pagination-numbers');
        const prevBtn = document.getElementById('prev-page-btn');
        const nextBtn = document.getElementById('next-page-btn');

        // Update info text
        const startIndex = (currentPage - 1) * pageSize + 1;
        const endIndex = Math.min(currentPage * pageSize, filteredTransactions.length);
        
    if (paginationInfo) {
            paginationInfo.textContent = `Showing ${startIndex}-${endIndex} of ${filteredTransactions.length} transactions`;
    }

    // Update pagination buttons
        if (prevBtn) {
            prevBtn.disabled = currentPage === 1;
    }
        
        if (nextBtn) {
            nextBtn.disabled = currentPage === totalPages || totalPages === 0;
    }

    // Update page numbers
        if (paginationNumbers) {
            paginationNumbers.innerHTML = generatePageNumbers(currentPage, totalPages);
        }
    }

    // Generate page numbers HTML
    function generatePageNumbers(current, total) {
        let html = '';
        const maxVisible = 5;
        let start = Math.max(1, current - Math.floor(maxVisible / 2));
        let end = Math.min(total, start + maxVisible - 1);

        if (end - start + 1 < maxVisible) {
            start = Math.max(1, end - maxVisible + 1);
        }

        for (let i = start; i <= end; i++) {
            html += `
                <button class="btn btn--outlined btn--small ${i === current ? 'btn--active' : ''}" 
                        onclick="TransactionsManagement.goToPage(${i})">
                    ${i}
                </button>
            `;
        }

        return html;
    }

    // Navigation functions
    function goToPage(page) {
        currentPage = page;
        loadTransactionsData();
    }

    function previousPage() {
        if (currentPage > 1) {
            currentPage--;
            loadTransactionsData();
        }
    }

    function nextPage() {
        currentPage++;
        loadTransactionsData();
    }

    function changePageSize() {
        const pageSizeSelect = document.getElementById('page-size-select');
        pageSize = parseInt(pageSizeSelect.value);
        currentPage = 1;
        loadTransactionsData();
    }

    // Load statistics from API
    function loadStatistics() {
        fetch(`${window.baseKeyword}api/transactions.php?action=stats&dealer_id=${window.DealerID}`)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    updateStatisticsFromAPI(data.data);
                } else {
                    console.error('Error loading stats:', data.error);
                }
            })
            .catch(error => {
                console.error('Stats API Error:', error);
            });
    }

    // Update statistics from API response
    function updateStatisticsFromAPI(statsData) {
        document.getElementById('total-transactions-count').textContent = statsData.total_transactions || 0;
        document.getElementById('sales-count').textContent = statsData.sales_count || 0;
        document.getElementById('services-count').textContent = statsData.services_count || 0;
        document.getElementById('total-net-amount').textContent = formatCurrency(statsData.total_net || 0);
        
        // Update percentages (these would be calculated based on previous period data)
        updatePercentageDisplay('total-transactions', '0.0');
        updatePercentageDisplay('sales', '0.0');
        updatePercentageDisplay('services', '0.0');
        updatePercentageDisplay('total-net', '0.0');
    }

    // Update percentage display with appropriate styling
    function updatePercentageDisplay(prefix, percentage) {
        const percentageContainer = document.getElementById(`${prefix}-percentage`);
        const percentageText = document.getElementById(`${prefix}-percent-text`);
        const arrow = document.getElementById(`${prefix}-arrow`);
        
        if (!percentageContainer || !percentageText) return;
        
        // Clean up existing classes
        percentageContainer.classList.remove('stat-percentage--positive', 'stat-percentage--negative', 'stat-percentage--neutral');
        
        // Set the percentage text
        percentageText.textContent = percentage + '%';
        
        // Parse the percentage value
        const numericValue = parseFloat(percentage);
        
        // Add appropriate class and arrow based on percentage value
        if (numericValue > 0) {
            percentageContainer.classList.add('stat-percentage--positive');
            if (arrow) {
                arrow.className = 'icon icon--arrow-up';
                arrow.style.display = 'inline-block';
            }
        } else if (numericValue < 0) {
            percentageContainer.classList.add('stat-percentage--negative');
            if (arrow) {
                arrow.className = 'icon icon--arrow-down';
                arrow.style.display = 'inline-block';
            }
        } else {
            percentageContainer.classList.add('stat-percentage--neutral');
            if (arrow) {
                arrow.style.display = 'none';
            }
        }
    }

    // Update statistics (deprecated - now loaded from API)
    function updateStatistics() {
        // This function is now handled by loadStatistics() and updateStatisticsFromAPI()
        // Keeping for backward compatibility
        loadStatistics();
    }

    // Transaction details modal
    function viewTransactionDetails(transactionId) {
        const transaction = transactionsData.find(t => t.id === transactionId);
        if (!transaction) return;

        document.getElementById('transaction-details-title').textContent = `Transaction Details - ${transaction.transaction_id}`;
        
        const detailsContent = document.getElementById('transaction-details-content');
        detailsContent.innerHTML = `
            <div class="transaction-details-grid">
            <div class="transaction-detail-section">
                    <h4>Transaction Information</h4>
                    <div class="detail-row">
                        <span class="detail-label">Transaction ID:</span>
                        <span class="detail-value">${transaction.transaction_id}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Customer:</span>
                        <span class="detail-value">${transaction.customer_name}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Type:</span>
                        <span class="detail-value">
                            <span class="type-chip type-chip--${transaction.transaction_type}">
                                ${capitalizeFirst(transaction.transaction_type)}
                            </span>
                            </span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Date:</span>
                        <span class="detail-value">${formatDate(transaction.transaction_date)}</span>
                </div>
            </div>
            
            <div class="transaction-detail-section">
                    <h4>Financial Details</h4>
                    <div class="detail-row">
                        <span class="detail-label">Amount:</span>
                        <span class="detail-value"><strong>${formatCurrency(transaction.amount)}</strong></span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Fee:</span>
                        <span class="detail-value ${transaction.fee > 0 ? 'text-warning' : 'text-success'}">
                            <strong>${formatCurrency(transaction.fee)}</strong>
                        </span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Net Amount:</span>
                        <span class="detail-value text-success">
                            <strong>${formatCurrency(transaction.net_amount)}</strong>
                        </span>
                    </div>
                </div>
                
                ${transaction.notes ? `
                <div class="transaction-detail-section" style="grid-column: 1 / -1;">
                    <h4>Notes</h4>
                    <div class="detail-notes">${transaction.notes}</div>
                </div>
                ` : ''}
            </div>
        `;

        document.getElementById('transaction-details-modal').style.display = 'flex';
    }

    function closeTransactionDetailsModal() {
        document.getElementById('transaction-details-modal').style.display = 'none';
    }

    function printTransactionDetails() {
        window.print();
    }

    // Delete transaction functions
    function deleteTransaction(transactionId) {
        const transaction = transactionsData.find(t => t.id === transactionId);
        if (!transaction) return;

        currentDeletingTransaction = transaction;
        document.getElementById('delete-transaction-info').innerHTML = `
            <strong>Transaction ID:</strong> ${transaction.transaction_id}<br>
            <strong>Customer:</strong> ${transaction.customer}<br>
            <strong>Amount:</strong> ${formatCurrency(transaction.amount)}
        `;
        
        document.getElementById('delete-transaction-modal').style.display = 'flex';
    }

    function closeDeleteModal() {
        document.getElementById('delete-transaction-modal').style.display = 'none';
        currentDeletingTransaction = null;
    }

    function confirmDeleteTransaction() {
        if (!currentDeletingTransaction) return;

        const index = transactionsData.findIndex(t => t.id === currentDeletingTransaction.id);
        if (index !== -1) {
            transactionsData.splice(index, 1);
            applyFilters();
            closeDeleteModal();
            showSuccessMessage('Transaction deleted successfully!');
        }
    }

    // Utility functions
    function closeAllModals() {
        document.getElementById('transaction-details-modal').style.display = 'none';
        document.getElementById('delete-transaction-modal').style.display = 'none';
    }

    function showLoading(show) {
        const loadingElement = document.getElementById('transactions-loading');
        if (loadingElement) {
            loadingElement.style.display = show ? 'flex' : 'none';
        }
    }

    function capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
            minimumFractionDigits: 2
    }).format(amount);
    }

    function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    function showSuccessMessage(message) {
        // You can implement a toast notification here
        console.log('Success:', message);
        // For now, just use alert
        alert(message);
    }

    // Export transactions data to CSV
    function exportTransactions() {
        console.log('Exporting transactions data...');
        
        // Prepare CSV headers
        const headers = [
            'Transaction ID',
            'Customer',
            'Type',
            'Amount',
            'Fee',
            'Net',
            'Date',
            'Notes'
        ];
        
        // Prepare CSV data
        const csvData = filteredTransactions.map(transaction => [
            transaction.transaction_number || transaction.transaction_id,
            transaction.customer_name,
            capitalizeFirst(transaction.transaction_type),
            transaction.amount,
            transaction.fee,
            transaction.net_amount,
            formatDate(transaction.transaction_date),
            transaction.notes || ''
        ]);
        
        // Create CSV content
        const csvContent = [
            headers.join(','),
            ...csvData.map(row => row.map(field => 
                typeof field === 'string' && field.includes(',') 
                    ? `"${field}"` 
                    : field
            ).join(','))
        ].join('\n');
        
        // Create and download file
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `transactions_export_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showSuccessMessage('Transactions data exported successfully!');
    }

    // Public API
    return {
        init,
        sortTable,
        goToPage,
        previousPage,
        nextPage,
        changePageSize,
        clearFilters,
        viewTransactionDetails,
        closeTransactionDetailsModal,
        printTransactionDetails,
        deleteTransaction,
        closeDeleteModal,
        confirmDeleteTransaction,
        exportTransactions
    };
})();

// Global function for router compatibility
window.dealerTransactions = function() {
    TransactionsManagement.init();
}; 