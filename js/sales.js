// Sales Management Module
window.SalesManagement = (function() {
    'use strict';

    // Private variables
    let salesData = [];
    let filteredSales = [];
    let currentPage = 1;
    let pageSize = 10;
    let sortField = 'sale_id';
    let sortDirection = 'desc';
    let currentEditingSale = null;
    let currentDeletingSale = null;

    // Sales data will be loaded from API

    // Initialize the sales management module
    function init() {
        console.log('Initializing Sales Management...');
        
        // Set initial sorting to DESC
        updateTableHeaderSorting(sortField, sortDirection);
        
        // Load initial data (this will handle rendering)
        loadSalesData();
        loadSalesmenData();
        
        // Setup event listeners
        setupEventListeners();
        
        // Update statistics (will be called again by loadSalesData, but that's ok)
        updateStatistics();
    }

    // Load salesmen data from API
    function loadSalesmenData() {
        fetch(`${window.baseKeyword}api/sales.php?action=salesmen&dealer_id=${window.DealerID}`)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    populateSalesmenDropdowns(data.data);
                } else {
                    console.error('Failed to load salesmen:', data.error);
                }
            })
            .catch(error => {
                console.error('Error loading salesmen:', error);
            });
    }

    // Populate salesman dropdowns
    function populateSalesmenDropdowns(salesmen) {
        // Update form dropdown (for create/edit)
        const formSelect = document.getElementById('sale-salesman');
        if (formSelect) {
            // Clear existing options except the first one
            while (formSelect.children.length > 1) {
                formSelect.removeChild(formSelect.lastChild);
            }
            
            // Add salesmen options
            salesmen.forEach(salesman => {
                const option = document.createElement('option');
                option.value = salesman.salesman_id;
                option.textContent = salesman.salesman_name;
                formSelect.appendChild(option);
            });
        }

        // Update filter dropdown
        const filterSelect = document.getElementById('salesman-filter');
        if (filterSelect) {
            // Clear existing options except the first one
            while (filterSelect.children.length > 1) {
                filterSelect.removeChild(filterSelect.lastChild);
            }
            
            // Add salesmen options
            salesmen.forEach(salesman => {
                const option = document.createElement('option');
                option.value = salesman.salesman_id;
                option.textContent = salesman.salesman_name;
                filterSelect.appendChild(option);
            });
        }
    }

    // Load sales data from API
    function loadSalesData() {
        showLoading(true);
        
        const params = new URLSearchParams({
            action: 'list',
            dealer_id: window.DealerID,
            page: currentPage,
            pageSize: pageSize,
            sort: sortField,
            direction: sortDirection
        });
        
        // Add search and filter parameters
        const searchInput = document.getElementById('sales-search');
        const statusFilter = document.getElementById('status-filter');
        const salesmanFilter = document.getElementById('salesman-filter');
        
        if (searchInput && searchInput.value.trim()) {
            params.append('search', searchInput.value.trim());
        }
        
        if (statusFilter && statusFilter.value) {
            params.append('status', statusFilter.value);
        }
        
        if (salesmanFilter && salesmanFilter.value) {
            params.append('salesman', salesmanFilter.value);
        }
        
        fetch(`${window.baseKeyword}api/sales.php?${params}`)
            .then(response => response.json())
            .then(data => {
                showLoading(false);
                
                if (data.success) {
                    salesData = data.data.sales || [];
                    filteredSales = [...salesData];
                    
                    // Update pagination info if available from API
                    if (data.data.pagination) {
                        updatePaginationFromAPI(data.data.pagination);
                        renderSalesTableWithoutPagination(); // Don't call updatePagination again
                    } else {
                        // Fallback to local pagination if API doesn't provide pagination data
                        renderSalesTable();
                    }
                    
                    updateStatistics();
                } else {
                    console.error('Failed to load sales:', data.error);
                    showErrorMessage('Failed to load sales data');
                    // Initialize empty data
                    salesData = [];
                    filteredSales = [];
                    renderSalesTable();
                    updateStatistics();
                }
            })
            .catch(error => {
                showLoading(false);
                console.error('Error loading sales:', error);
                showErrorMessage('Error loading sales data');
                // Initialize empty data
                salesData = [];
                filteredSales = [];
                renderSalesTable();
                updateStatistics();
            });
    }

    // Setup event listeners
    function setupEventListeners() {
        // Search functionality
        const searchInput = document.getElementById('sales-search');
        if (searchInput) {
            searchInput.addEventListener('input', debounce(handleSearch, 300));
        }

        // Filter functionality
        const statusFilter = document.getElementById('status-filter');
        const salesmanFilter = document.getElementById('salesman-filter');
        
        if (statusFilter) {
            statusFilter.addEventListener('change', handleFilter);
        }
        
        if (salesmanFilter) {
            salesmanFilter.addEventListener('change', handleFilter);
        }

        // Modal close events
        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('modal-overlay')) {
                closeAllModals();
            }
        });
    }

    // Handle search functionality
    function handleSearch() {
        currentPage = 1; // Reset to first page when searching
        loadSalesData(); // Reload data from server with search parameters
    }

    // Handle filter functionality
    function handleFilter() {
        currentPage = 1; // Reset to first page when filtering
        loadSalesData(); // Reload data from server with filter parameters
    }

    // Apply all filters and search (now reloads from server)
    function applyFilters() {
        currentPage = 1; // Reset to first page
        loadSalesData(); // Reload data from server with all parameters
    }

    // Apply sorting to filtered data (for local fallback only)
    function applySortToFiltered() {
        filteredSales.sort((a, b) => {
            let aVal = a[sortField];
            let bVal = b[sortField];

            // Handle numeric fields
            if (sortField === 'sale_id' || sortField === 'total_amount' || sortField === 'balance') {
                aVal = parseFloat(aVal);
                bVal = parseFloat(bVal);
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

        // Update table header visual feedback with a small delay to ensure DOM is ready
        setTimeout(() => {
            updateTableHeaderSorting(sortField, sortDirection);
        }, 10);
    }

    // Clear all filters
    function clearFilters() {
        document.getElementById('sales-search').value = '';
        document.getElementById('status-filter').value = '';
        document.getElementById('salesman-filter').value = '';
        
        currentPage = 1;
        loadSalesData(); // Reload data from server without filters
    }

    // Sort table by field
    function sortTable(field) {
        if (sortField === field) {
            sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            sortField = field;
            sortDirection = 'desc'; // Default to DESC for new fields
        }

        // Reload data from server with new sort parameters
        loadSalesData();
    }

    // Update table header sorting visual feedback
    function updateTableHeaderSorting(field, direction) {
        // Remove all existing sort classes
        const headers = document.querySelectorAll('.table th');
        headers.forEach(header => {
            header.classList.remove('sort-asc', 'sort-desc');
        });

        // Add sort class to current field
        const currentHeader = document.querySelector(`th[onclick="SalesManagement.sortTable('${field}')"]`);
        if (currentHeader) {
            currentHeader.classList.add(direction === 'asc' ? 'sort-asc' : 'sort-desc');
        }
    }

    // Render sales table
    function renderSalesTable() {
        const tableBody = document.getElementById('sales-table-body');
        const emptyState = document.getElementById('sales-empty-state');
        
        if (!tableBody) return;

        // Calculate pagination
        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const paginatedSales = filteredSales.slice(startIndex, endIndex);

        // Show empty state if no sales
        if (filteredSales.length === 0) {
            tableBody.innerHTML = '';
            if (emptyState) emptyState.style.display = 'block';
            updatePagination();
            return;
        }

        if (emptyState) emptyState.style.display = 'none';

        // Render table rows
        tableBody.innerHTML = paginatedSales.map(sale => `
            <tr>
                <td><strong>#${sale.sale_id}</strong></td>
                <td>
                    <div>${sale.customer_name}</div>
                    <div style="font-size: 0.8rem; color: var(--color-text-light);">${sale.phone_number || ''}</div>
                </td>
                <td>
                    <span class="chip ${getStatusChipClass(sale.status)}">
                        ${capitalizeFirst(sale.status)}
                    </span>
                </td>
                <td>${sale.salesman_name || ''}</td>
                <td>${sale.item_product}</td>
                <td><strong>${formatCurrency(sale.total_amount)}</strong></td>
                <td>
                    <span class="${sale.balance > 0 ? 'text-warning' : 'text-success'}">
                        ${formatCurrency(sale.balance)}
                    </span>
                </td>
                <td class="cell-icon">
                    <div class="table__actions">
                        <button class="btn btn--text btn--small" onclick="SalesManagement.viewSaleDetails(${sale.sale_id})" title="View Details">
                            <div class="icon icon--eye"></div>
                        </button>
                        <button class="btn btn--text btn--small" onclick="SalesManagement.editSale(${sale.sale_id})" title="Edit Sale">
                            <div class="icon icon--pen-to-square"></div>
                        </button>
                        <button class="btn btn--text-danger btn--small" onclick="SalesManagement.deleteSale(${sale.sale_id})" title="Delete Sale">
                            <div class="icon icon--trash"></div>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

        updatePagination();
    }

    // Render sales table without updating pagination (used when API provides pagination data)
    function renderSalesTableWithoutPagination() {
        const tableBody = document.getElementById('sales-table-body');
        const emptyState = document.getElementById('sales-empty-state');
        
        if (!tableBody) return;

        // Show empty state if no sales
        if (filteredSales.length === 0) {
            tableBody.innerHTML = '';
            if (emptyState) emptyState.style.display = 'block';
            return;
        }

        if (emptyState) emptyState.style.display = 'none';

        // Render all sales (API already handles pagination)
        tableBody.innerHTML = filteredSales.map(sale => `
            <tr>
                <td><strong>#${sale.sale_id}</strong></td>
                <td>
                    <div>${sale.customer_name}</div>
                    <div style="font-size: 0.8rem; color: var(--color-text-light);">${sale.phone_number || ''}</div>
                </td>
                <td>
                    <span class="chip ${getStatusChipClass(sale.status)}">
                        ${capitalizeFirst(sale.status)}
                    </span>
                </td>
                <td>${sale.salesman_name || ''}</td>
                <td>${sale.item_product}</td>
                <td><strong>${formatCurrency(sale.total_amount)}</strong></td>
                <td>
                    <span class="${sale.balance > 0 ? 'text-warning' : 'text-success'}">
                        ${formatCurrency(sale.balance)}
                    </span>
                </td>
                <td class="cell-icon">
                    <div class="table__actions">
                        <button class="btn btn--text btn--small" onclick="SalesManagement.viewSaleDetails(${sale.sale_id})" title="View Details">
                            <div class="icon icon--eye"></div>
                        </button>
                        <button class="btn btn--text btn--small" onclick="SalesManagement.editSale(${sale.sale_id})" title="Edit Sale">
                            <div class="icon icon--pen-to-square"></div>
                        </button>
                        <button class="btn btn--text-danger btn--small" onclick="SalesManagement.deleteSale(${sale.sale_id})" title="Delete Sale">
                            <div class="icon icon--trash"></div>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    // Update pagination
    function updatePagination() {
        const totalPages = Math.ceil(filteredSales.length / pageSize);
        const paginationInfo = document.getElementById('pagination-info-text');
        const paginationNumbers = document.getElementById('pagination-numbers');
        const prevBtn = document.getElementById('prev-page-btn');
        const nextBtn = document.getElementById('next-page-btn');
        const paginationContainer = document.getElementById('sales-pagination');

        // Show pagination container if there are items
        if (paginationContainer) {
            paginationContainer.style.display = filteredSales.length > 0 ? 'flex' : 'none';
        }

        // Update info text
        const startIndex = filteredSales.length > 0 ? (currentPage - 1) * pageSize + 1 : 0;
        const endIndex = Math.min(currentPage * pageSize, filteredSales.length);
        
        if (paginationInfo) {
            if (filteredSales.length > 0) {
            paginationInfo.textContent = `Showing ${startIndex}-${endIndex} of ${filteredSales.length} sales`;
            } else {
                paginationInfo.textContent = 'No sales found';
            }
        }

        // Update pagination buttons
        if (prevBtn) {
            prevBtn.disabled = currentPage === 1;
        }
        
        if (nextBtn) {
            nextBtn.disabled = currentPage === totalPages || totalPages === 0;
        }

        // Update page numbers - show even if only one page
        if (paginationNumbers) {
            if (totalPages > 0) {
            paginationNumbers.innerHTML = generatePageNumbers(currentPage, totalPages);
            } else {
                paginationNumbers.innerHTML = '';
            }
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
                        onclick="SalesManagement.goToPage(${i})">
                    ${i}
                </button>
            `;
        }

        return html;
    }

    // Navigation functions
    function goToPage(page) {
        currentPage = page;
        loadSalesData();
    }

    function previousPage() {
        if (currentPage > 1) {
            currentPage--;
            loadSalesData();
        }
    }

    function nextPage() {
        currentPage++;
        loadSalesData();
    }

    function changePageSize() {
        const pageSizeSelect = document.getElementById('page-size-select');
        pageSize = parseInt(pageSizeSelect.value);
        currentPage = 1;
        loadSalesData();
    }

    // Update statistics
    function updateStatistics() {
        // First update with local data for immediate feedback
        const totalSales = filteredSales.length;
        const completedSales = filteredSales.filter(sale => sale.status === 'completed').length;
        const pendingSales = filteredSales.filter(sale => sale.status === 'pending').length;
        const totalRevenue = filteredSales.reduce((sum, sale) => sum + parseFloat(sale.total_amount || 0), 0);

        // Calculate percentages
        const completedPercentage = totalSales > 0 ? ((completedSales / totalSales) * 100).toFixed(1) : 0;
        const pendingPercentage = totalSales > 0 ? ((pendingSales / totalSales) * 100).toFixed(1) : 0;
        
        // Growth percentages - these would be calculated based on previous period data
        const salesGrowthPercentage = "0.0"; // Will be calculated when historical data is available
        
        // Revenue growth percentage
        const revenueGrowthPercentage = "0.0"; // Will be calculated when historical data is available

        // Update main values
        document.getElementById('total-sales-count').textContent = totalSales;
        document.getElementById('completed-sales-count').textContent = completedSales;
        document.getElementById('pending-sales-count').textContent = pendingSales;
        document.getElementById('total-revenue-amount').textContent = formatCurrency(totalRevenue);

        // Update percentages with colors and arrows
        updatePercentageDisplay('total-sales', salesGrowthPercentage);
        updatePercentageDisplay('completed-sales', completedPercentage);
        updatePercentageDisplay('pending-sales', pendingPercentage);
        updatePercentageDisplay('total-revenue', revenueGrowthPercentage);

        // Then fetch comprehensive stats from API
        fetch(`${window.baseKeyword}api/sales.php?action=stats&dealer_id=${window.DealerID}`)
            .then(response => response.json())
            .then(data => {
                if (data.success && data.data) {
                    const stats = data.data;
                    document.getElementById('total-sales-count').textContent = stats.total_sales || 0;
                    document.getElementById('completed-sales-count').textContent = stats.completed_sales || 0;
                    document.getElementById('pending-sales-count').textContent = stats.pending_sales || 0;
                    document.getElementById('total-revenue-amount').textContent = formatCurrency(stats.total_revenue || 0);
                }
            })
            .catch(error => {
                console.error('Error fetching stats:', error);
                // Keep the local stats if API fails
            });
    }

    // Modal functions
    function openAddSaleModal() {
        currentEditingSale = null;
        document.getElementById('sale-modal-title').textContent = 'Add New Sale';
        document.getElementById('save-sale-btn-text').textContent = 'Save Sale';
        clearSaleForm();
        document.getElementById('sale-modal').style.display = 'flex';
    }

    function editSale(saleId) {
        const sale = salesData.find(s => s.sale_id === saleId);
        if (!sale) return;

        currentEditingSale = sale;
        document.getElementById('sale-modal-title').textContent = 'Edit Sale';
        document.getElementById('save-sale-btn-text').textContent = 'Update Sale';
        populateSaleForm(sale);
        document.getElementById('sale-modal').style.display = 'flex';
    }

    function closeSaleModal() {
        document.getElementById('sale-modal').style.display = 'none';
        currentEditingSale = null;
        clearSaleForm();
    }

    function populateSaleForm(sale) {
        document.getElementById('sale-customer').value = sale.customer_name;
        document.getElementById('sale-phone').value = sale.phone_number || '';
        document.getElementById('sale-item').value = sale.item_product;
        
        // Set salesman by ID if available
        const salesmanSelect = document.getElementById('sale-salesman');
        if (sale.salesman_id && salesmanSelect) {
            salesmanSelect.value = sale.salesman_id;
        } else {
            salesmanSelect.value = '';
        }
        
        document.getElementById('sale-total').value = sale.total_amount;
        document.getElementById('sale-balance').value = sale.balance;
        document.getElementById('sale-status').value = sale.status;
        document.getElementById('sale-notes').value = sale.notes || '';
    }

    function clearSaleForm() {
        document.getElementById('sale-form').reset();
    }

    function saveSale() {
        const salesmanSelect = document.getElementById('sale-salesman');
        const selectedSalesmanId = salesmanSelect.value;
        const selectedSalesmanText = salesmanSelect.options[salesmanSelect.selectedIndex]?.text || '';

        const formData = {
            customer_name: document.getElementById('sale-customer').value,
            phone_number: document.getElementById('sale-phone').value,
            item_product: document.getElementById('sale-item').value,
            salesman_id: selectedSalesmanId || null,
            salesman_name: selectedSalesmanText || null,
            total_amount: parseFloat(document.getElementById('sale-total').value),
            balance: parseFloat(document.getElementById('sale-balance').value) || 0,
            status: document.getElementById('sale-status').value,
            notes: document.getElementById('sale-notes').value
        };

        // Validate required fields
        if (!formData.customer_name || !formData.item_product || !formData.total_amount) {
            alert('Please fill in all required fields.');
            return;
        }

        // Show loading state
        const saveBtn = document.querySelector('#save-sale-btn-text');
        const originalText = saveBtn.textContent;
        saveBtn.textContent = 'Saving...';

        const isUpdate = currentEditingSale !== null;
        const url = `${window.baseKeyword}api/sales.php`;
        const method = isUpdate ? 'PUT' : 'POST';
        const action = isUpdate ? 'update' : 'create';
        
        let apiUrl = `${url}?action=${action}&dealer_id=${window.DealerID}`;
        if (isUpdate) {
            apiUrl += `&id=${currentEditingSale.sale_id}`;
        }

        fetch(apiUrl, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        })
        .then(response => {
            // Check if response is JSON
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                return response.text().then(text => {
                    console.error('Non-JSON response:', text);
                    throw new Error('Server returned non-JSON response: ' + text.substring(0, 200));
                });
            }
            
            return response.json();
        })
        .then(data => {
            saveBtn.textContent = originalText;
            
            if (data.success) {
                closeSaleModal();
                loadSalesData(); // Reload data from server
                showSuccessMessage(data.message || (isUpdate ? 'Sale updated successfully!' : 'Sale created successfully!'));
            } else {
                showErrorMessage(data.error || 'Failed to save sale');
            }
        })
        .catch(error => {
            saveBtn.textContent = originalText;
            console.error('Error saving sale:', error);
            showErrorMessage('Error saving sale. Please try again.');
        });
    }

    // Sale details modal
    function viewSaleDetails(saleId) {
        const sale = salesData.find(s => s.sale_id === saleId);
        if (!sale) return;

        document.getElementById('sale-details-title').textContent = `Sale Details - #${sale.sale_id}`;
        
        const detailsContent = document.getElementById('sale-details-content');
        detailsContent.innerHTML = `
            <div class="sale-details-grid">
                <div class="sale-detail-section">
                    <h4>Customer Information</h4>
                    <div class="detail-row">
                        <span class="detail-label">Name:</span>
                        <span class="detail-value">${sale.customer_name}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Phone:</span>
                        <span class="detail-value">${sale.phone_number || 'N/A'}</span>
                    </div>
                </div>
                
                <div class="sale-detail-section">
                    <h4>Sale Information</h4>
                    <div class="detail-row">
                        <span class="detail-label">Sale ID:</span>
                        <span class="detail-value">#${sale.sale_id}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Date:</span>
                        <span class="detail-value">${formatDate(sale.sale_date)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Salesman:</span>
                        <span class="detail-value">${sale.salesman_name || 'N/A'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Status:</span>
                        <span class="detail-value">
                            <span class="chip ${getStatusChipClass(sale.status)}">
                                ${capitalizeFirst(sale.status)}
                            </span>
                        </span>
                    </div>
                </div>
                
                <div class="sale-detail-section">
                    <h4>Product & Pricing</h4>
                    <div class="detail-row">
                        <span class="detail-label">Item:</span>
                        <span class="detail-value">${sale.item_product}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Total Amount:</span>
                        <span class="detail-value"><strong>${formatCurrency(sale.total_amount)}</strong></span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Balance Due:</span>
                        <span class="detail-value ${sale.balance > 0 ? 'text-warning' : 'text-success'}">
                            <strong>${formatCurrency(sale.balance)}</strong>
                        </span>
                    </div>
                </div>
                
                ${sale.notes ? `
                <div class="sale-detail-section">
                    <h4>Notes</h4>
                    <div class="detail-notes">${sale.notes}</div>
                </div>
                ` : ''}
            </div>
        `;

        document.getElementById('sale-details-modal').style.display = 'flex';
    }

    function closeSaleDetailsModal() {
        document.getElementById('sale-details-modal').style.display = 'none';
    }

    function printSaleDetails() {
        window.print();
    }

    // Delete sale functions
    function deleteSale(saleId) {
        const sale = salesData.find(s => s.sale_id === saleId);
        if (!sale) return;

        currentDeletingSale = sale;
        document.getElementById('delete-sale-info').innerHTML = `
            <strong>Sale ID:</strong> #${sale.sale_id}<br>
            <strong>Customer:</strong> ${sale.customer_name}<br>
            <strong>Amount:</strong> ${formatCurrency(sale.total_amount)}
        `;
        
        document.getElementById('delete-sale-modal').style.display = 'flex';
    }

    function closeDeleteModal() {
        document.getElementById('delete-sale-modal').style.display = 'none';
        currentDeletingSale = null;
    }

    function confirmDeleteSale() {
        if (!currentDeletingSale) return;

        const deleteBtn = document.querySelector('#delete-sale-modal .btn--danger');
        const originalText = deleteBtn.innerHTML;
        deleteBtn.innerHTML = '<div class="icon icon--spinner"></div>Deleting...';
        deleteBtn.disabled = true;

        const url = `${window.baseKeyword}api/sales.php?action=delete&dealer_id=${window.DealerID}&id=${currentDeletingSale.sale_id}`;

        fetch(url, {
            method: 'DELETE'
        })
        .then(response => response.json())
        .then(data => {
            deleteBtn.innerHTML = originalText;
            deleteBtn.disabled = false;
            
            if (data.success) {
                closeDeleteModal();
                loadSalesData(); // Reload data from server
                showSuccessMessage(data.message || 'Sale deleted successfully!');
            } else {
                showErrorMessage(data.error || 'Failed to delete sale');
            }
        })
        .catch(error => {
            deleteBtn.innerHTML = originalText;
            deleteBtn.disabled = false;
            console.error('Error deleting sale:', error);
            showErrorMessage('Error deleting sale. Please try again.');
        });
    }

    // Utility functions
    function closeAllModals() {
        document.getElementById('sale-modal').style.display = 'none';
        document.getElementById('sale-details-modal').style.display = 'none';
        document.getElementById('delete-sale-modal').style.display = 'none';
    }

    function showLoading(show) {
        const loadingElement = document.getElementById('sales-loading');
        if (loadingElement) {
            loadingElement.style.display = show ? 'flex' : 'none';
        }
    }

    function getStatusChipClass(status) {
        switch (status) {
            case 'completed': return 'chip--green';
            case 'pending': return 'chip--yellow';
            case 'partial': return 'chip--blue';
            case 'cancelled': return 'chip--red';
            case 'refunded': return 'chip--gray';
            default: return 'chip--gray';
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

    // Update percentage display with colors and arrows
    function updatePercentageDisplay(prefix, percentage) {
        const percentageContainer = document.getElementById(`${prefix}-percentage`);
        const percentageText = document.getElementById(`${prefix}-percent-text`);
        const arrow = document.getElementById(`${prefix}-arrow`);
        
        if (!percentageContainer || !percentageText || !arrow) return;
        
        // Update the percentage text
        percentageText.textContent = `${Math.abs(percentage).toFixed(1)}%`;
        
        // Remove all color classes
        percentageContainer.classList.remove('stat-percentage--positive', 'stat-percentage--negative', 'stat-percentage--neutral');
        
        // Add appropriate class and arrow based on percentage value
        if (percentage > 0) {
            percentageContainer.classList.add('stat-percentage--positive');
            arrow.className = 'icon icon--arrow-up';
            arrow.style.display = 'inline-block';
        } else if (percentage < 0) {
            percentageContainer.classList.add('stat-percentage--negative');
            arrow.className = 'icon icon--arrow-down';
            arrow.style.display = 'inline-block';
        } else {
            percentageContainer.classList.add('stat-percentage--neutral');
            arrow.style.display = 'none';
        }
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

    function showErrorMessage(message) {
        // You can implement a toast notification here
        console.error('Error:', message);
        // For now, just use alert
        alert('Error: ' + message);
    }

    function updatePaginationFromAPI(pagination) {
        // Update pagination variables from API response
        currentPage = pagination.current_page || 1;
        pageSize = pagination.page_size || 10;
        
        // Update pagination display
        const totalPages = pagination.total_pages || 0;
        const totalItems = pagination.total_items || 0;
        
        const paginationInfo = document.getElementById('pagination-info-text');
        const paginationNumbers = document.getElementById('pagination-numbers');
        const prevBtn = document.getElementById('prev-page-btn');
        const nextBtn = document.getElementById('next-page-btn');
        const paginationContainer = document.getElementById('sales-pagination');

        // Show pagination container if there are items
        if (paginationContainer) {
            paginationContainer.style.display = totalItems > 0 ? 'flex' : 'none';
        }

        // Update info text
        const startIndex = totalItems > 0 ? ((currentPage - 1) * pageSize) + 1 : 0;
        const endIndex = Math.min(currentPage * pageSize, totalItems);
        
        if (paginationInfo) {
            if (totalItems > 0) {
                const infoText = `Showing ${startIndex}-${endIndex} of ${totalItems} sales`;
                paginationInfo.textContent = infoText;
            } else {
                paginationInfo.textContent = 'No sales found';
            }
        }

        // Update pagination buttons
        if (prevBtn) {
            prevBtn.disabled = !pagination.has_prev || currentPage <= 1;
        }
        
        if (nextBtn) {
            nextBtn.disabled = !pagination.has_next || currentPage >= totalPages;
        }

        // Update page numbers - show even if only one page
        if (paginationNumbers) {
            if (totalPages > 0) {
                const pageNumbersHtml = generatePageNumbers(currentPage, totalPages);
                paginationNumbers.innerHTML = pageNumbersHtml;
            } else {
                paginationNumbers.innerHTML = '';
            }
        }
    }

    // Export sales data to CSV
    function exportSales() {
        console.log('Exporting sales data...');
        
        // Prepare CSV headers
        const headers = [
            'Sale ID',
            'Customer',
            'Phone',
            'Status',
            'Salesman',
            'Item',
            'Total',
            'Balance',
            'Date',
            'Notes'
        ];
        
        // Prepare CSV data
        const csvData = filteredSales.map(sale => [
            sale.sale_id,
            sale.customer,
            sale.phone,
            capitalizeFirst(sale.status),
            sale.salesman,
            sale.item,
            sale.total,
            sale.balance,
            formatDate(sale.date),
            sale.notes || ''
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
        link.setAttribute('download', `sales_export_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showSuccessMessage('Sales data exported successfully!');
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
        openAddSaleModal,
        editSale,
        closeSaleModal,
        saveSale,
        viewSaleDetails,
        closeSaleDetailsModal,
        printSaleDetails,
        deleteSale,
        closeDeleteModal,
        confirmDeleteSale,
        exportSales
    };
})();

// Global function for router compatibility
window.sales = function() {
    SalesManagement.init();
}; 