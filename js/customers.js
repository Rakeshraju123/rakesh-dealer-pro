// Customers Management Module
window.CustomersManagement = (function() {
    'use strict';

    // Private variables
    let customersData = [];
    let filteredCustomers = [];
    let currentPage = 1;
    let pageSize = 10;
    let sortField = 'customer_id';
    let sortDirection = 'desc';
    let currentEditingCustomer = null;
    let currentDeletingCustomer = null;

    // Initialize the customers management module
    function init() {
        console.log('Initializing Customers Management...');
        
        // Load customers data
        loadCustomersData();
        
        // Setup event listeners
        setupEventListeners();
        
        // Initial render with sorting
        applyInitialSort();
        renderCustomersTable();
        updateStatistics();
    }

    // Load customers data from API
    function loadCustomersData() {
        showLoading(true);
        
        // Get current filters for API call
        const searchTerm = document.getElementById('customers-search')?.value || '';
        const locationFilter = document.getElementById('location-filter')?.value || '';
        const purchasesFilter = document.getElementById('purchases-filter')?.value || '';
        
        // Build API URL with parameters
        const params = new URLSearchParams({
            action: 'list',
            dealer_id: window.DealerID,
            page: currentPage,
            pageSize: pageSize,
            search: searchTerm,
            location: locationFilter,
            purchases_range: purchasesFilter,
            sort: sortField,
            direction: sortDirection
        });
        
        fetch(`${window.baseKeyword}api/customers.php?${params}`)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    customersData = data.data.customers;
                    filteredCustomers = [...customersData];
                    
                    // Update pagination info from API
                    if (data.data.pagination) {
                    updatePaginationFromAPI(data.data.pagination);
                        renderCustomersTableWithoutPagination(); // Don't call updatePagination again
                    } else {
                        // Fallback to local pagination if API doesn't provide pagination data
                        applyInitialSort();
                    renderCustomersTable();
                    }
                    
                    loadStatistics();
                } else {
                    customersData = [];
                    filteredCustomers = [];
                    console.error('Error loading customers:', data.error);
                    alert('Failed to load customers data');
                }
            })
            .catch(error => {
                console.error('API Error:', error);
                alert('Failed to connect to server');
            })
            .finally(() => {
                showLoading(false);
            });
    }
    
    // Load statistics from API
    function loadStatistics() {
        fetch(`${window.baseKeyword}api/customers.php?action=stats&dealer_id=${window.DealerID}`)
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
    
    // Update pagination from API response
    function updatePaginationFromAPI(paginationData) {
        const paginationInfo = document.getElementById('pagination-info-text');
        const paginationNumbers = document.getElementById('pagination-numbers');
        const prevBtn = document.getElementById('prev-page-btn');
        const nextBtn = document.getElementById('next-page-btn');
        const paginationContainer = document.getElementById('customers-pagination');

        const totalItems = paginationData.total_items || 0;
        const totalPages = paginationData.total_pages || 0;
        const currentPageNum = paginationData.current_page || 1;
        const pageSize = paginationData.page_size || 10;

        // Show pagination container if there are items
        if (paginationContainer) {
            paginationContainer.style.display = totalItems > 0 ? 'flex' : 'none';
        }

        // Update info text
        const startIndex = totalItems > 0 ? ((currentPageNum - 1) * pageSize) + 1 : 0;
        const endIndex = Math.min(currentPageNum * pageSize, totalItems);
        
        if (paginationInfo) {
            if (totalItems > 0) {
                paginationInfo.textContent = `Showing ${startIndex}-${endIndex} of ${totalItems} customers`;
            } else {
                paginationInfo.textContent = 'No customers found';
            }
        }

        // Update pagination buttons
        if (prevBtn) {
            prevBtn.disabled = !paginationData.has_prev || currentPageNum <= 1;
        }
        
        if (nextBtn) {
            nextBtn.disabled = !paginationData.has_next || currentPageNum >= totalPages;
        }

        // Update page numbers - show even if only one page
        if (paginationNumbers) {
            if (totalPages > 0) {
                paginationNumbers.innerHTML = generatePageNumbers(currentPageNum, totalPages);
            } else {
                paginationNumbers.innerHTML = '';
            }
        }
    }
    
    // Update statistics from API response with percentages
    function updateStatisticsFromAPI(statsData) {
        // Update main values
        document.getElementById('total-customers-count').textContent = statsData.total_customers || 0;
        document.getElementById('active-customers-count').textContent = statsData.active_customers || 0;
        document.getElementById('total-purchases-count').textContent = statsData.total_purchases || 0;
        document.getElementById('total-spent-amount').textContent = formatCurrency(statsData.total_spent || 0);

        // Calculate percentages for display
        const totalCustomers = statsData.total_customers || 0;
        const activeCustomers = statsData.active_customers || 0;
        const activePercentage = totalCustomers > 0 ? ((activeCustomers / totalCustomers) * 100).toFixed(1) : 0;
        
        // Growth percentages - these would be calculated based on previous period data
        const customerGrowth = "0.0";
        const purchaseGrowth = "0.0";
        const spentGrowth = "0.0";

        // Update percentages with colors and arrows
        updatePercentageDisplay('total-customers', customerGrowth);
        updatePercentageDisplay('active-customers', activePercentage);
        updatePercentageDisplay('total-purchases', purchaseGrowth);
        updatePercentageDisplay('total-spent', spentGrowth);
    }

    // Setup event listeners
    function setupEventListeners() {
        // Search functionality
        const searchInput = document.getElementById('customers-search');
        if (searchInput) {
            searchInput.addEventListener('input', debounce(handleSearch, 300));
        }

        // Filter functionality
        const locationFilter = document.getElementById('location-filter');
        const purchasesFilter = document.getElementById('purchases-filter');
        
        if (locationFilter) {
            locationFilter.addEventListener('change', handleFilter);
        }
        
        if (purchasesFilter) {
            purchasesFilter.addEventListener('change', handleFilter);
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
        loadCustomersData(); // Reload data from server with search parameters
    }

    // Handle filter functionality
    function handleFilter() {
        currentPage = 1; // Reset to first page when filtering
        loadCustomersData(); // Reload data from server with filter parameters
    }

    // Apply initial sort
    function applyInitialSort() {
        filteredCustomers.sort((a, b) => {
            let aVal = a[sortField];
            let bVal = b[sortField];

            // Handle numeric fields
            if (sortField === 'total_spent' || sortField === 'purchases_count' || sortField === 'customer_id' || sortField === 'id') {
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

        // Update table header visual feedback
        updateTableHeaderSorting(sortField, sortDirection);
    }

    // Apply all filters and search (now reloads from server)
    function applyFilters() {
        currentPage = 1; // Reset to first page
        loadCustomersData(); // Reload data from server with all parameters
    }

    // Apply current sort to filtered customers
    function applySortToFiltered() {
        filteredCustomers.sort((a, b) => {
            let aVal = a[sortField];
            let bVal = b[sortField];

            // Handle numeric fields
            if (sortField === 'total_spent' || sortField === 'purchases_count' || sortField === 'customer_id' || sortField === 'id') {
                aVal = parseFloat(aVal);
                bVal = parseFloat(bVal);
            }

            // Handle date fields
            if (sortField === 'last_purchase_date') {
                aVal = aVal ? new Date(aVal) : new Date(0);
                bVal = bVal ? new Date(bVal) : new Date(0);
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
        document.getElementById('customers-search').value = '';
        document.getElementById('location-filter').value = '';
        document.getElementById('purchases-filter').value = '';
        
        currentPage = 1;
        loadCustomersData(); // Reload data from server without filters
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
        loadCustomersData();
    }

    // Update table header sorting visual feedback
    function updateTableHeaderSorting(field, direction) {
        // Remove all existing sort classes
        const headers = document.querySelectorAll('.table th');
        headers.forEach(header => {
            header.classList.remove('sort-asc', 'sort-desc');
        });

        // Add sort class to current field - try multiple selectors to ensure we find the header
        let currentHeader = document.querySelector(`th[onclick="CustomersManagement.sortTable('${field}')"]`);
        
        // If not found, try alternative field names (for backward compatibility)
        if (!currentHeader && field === 'customer_name') {
            currentHeader = document.querySelector(`th[onclick="CustomersManagement.sortTable('customer')"]`);
        }
        
        if (currentHeader) {
            currentHeader.classList.add(direction === 'asc' ? 'sort-asc' : 'sort-desc');
        }
    }

    // Get color class for total spent amount
    function getTotalSpentColorClass(amount) {
        const numericAmount = parseFloat(amount) || 0;
        
        if (numericAmount === 0) {
            return 'total-spent-zero';
        } else if (numericAmount < 1000) {
            return 'total-spent-low';
        } else if (numericAmount < 5000) {
            return 'total-spent-medium';
        } else if (numericAmount < 15000) {
            return 'total-spent-high';
        } else {
            return 'total-spent-premium';
        }
    }

    // Render customers table
    function renderCustomersTable() {
        const tableBody = document.getElementById('customers-table-body');
        const emptyState = document.getElementById('customers-empty-state');
        
        if (!tableBody) return;

        // Calculate pagination
        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const paginatedCustomers = filteredCustomers.slice(startIndex, endIndex);

        // Show empty state if no customers
        if (filteredCustomers.length === 0) {
            tableBody.innerHTML = '';
            if (emptyState) emptyState.style.display = 'block';
            updatePagination();
            return;
        }

        if (emptyState) emptyState.style.display = 'none';

        // Render table rows
        tableBody.innerHTML = paginatedCustomers.map(customer => `
            <tr>
                <td>
                    <div><strong>${customer.customer_name}</strong></div>
                </td>
                <td>
                    <div>${customer.phone_number}</div>
                    <div style="font-size: 0.8rem; color: var(--color-text-light);">${customer.email || 'No email'}</div>
                </td>
                <td>${customer.location}</td>
                <td><strong>${customer.purchases_count || 0}</strong></td>
                <td><strong class="${getTotalSpentColorClass(customer.total_spent || 0)}">${formatCurrency(customer.total_spent || 0)}</strong></td>
                <td>${customer.last_purchase_date ? formatDate(customer.last_purchase_date) : 'No purchases'}</td>
                <td class="cell-icon">
                    <div class="table__actions">
                        <button class="btn btn--text btn--small" onclick="CustomersManagement.viewCustomerDetails(${customer.customer_id})" title="View Details">
                            <div class="icon icon--eye"></div>
                        </button>
                        <button class="btn btn--text btn--small" onclick="CustomersManagement.editCustomer(${customer.customer_id})" title="Edit Customer">
                            <div class="icon icon--pen-to-square"></div>
                        </button>
                        <button class="btn btn--text-danger btn--small" onclick="CustomersManagement.deleteCustomer(${customer.customer_id})" title="Delete Customer">
                            <div class="icon icon--trash"></div>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

        updatePagination();
    }

    // Render customers table without updating pagination (used when API provides pagination data)
    function renderCustomersTableWithoutPagination() {
        const tableBody = document.getElementById('customers-table-body');
        const emptyState = document.getElementById('customers-empty-state');
        
        if (!tableBody) return;

        // Show empty state if no customers
        if (filteredCustomers.length === 0) {
            tableBody.innerHTML = '';
            if (emptyState) emptyState.style.display = 'block';
            return;
        }

        if (emptyState) emptyState.style.display = 'none';

        // Render all customers (API already handles pagination)
        tableBody.innerHTML = filteredCustomers.map(customer => `
            <tr>
                <td>
                    <div><strong>${customer.customer_name}</strong></div>
                </td>
                <td>
                    <div>${customer.phone_number}</div>
                    <div style="font-size: 0.8rem; color: var(--color-text-light);">${customer.email || 'No email'}</div>
                </td>
                <td>${customer.location}</td>
                <td><strong>${customer.purchases_count || 0}</strong></td>
                <td><strong class="${getTotalSpentColorClass(customer.total_spent || 0)}">${formatCurrency(customer.total_spent || 0)}</strong></td>
                <td>${customer.last_purchase_date ? formatDate(customer.last_purchase_date) : 'No purchases'}</td>
                <td class="cell-icon">
                    <div class="table__actions">
                        <button class="btn btn--text btn--small" onclick="CustomersManagement.viewCustomerDetails(${customer.customer_id})" title="View Details">
                            <div class="icon icon--eye"></div>
                        </button>
                        <button class="btn btn--text btn--small" onclick="CustomersManagement.editCustomer(${customer.customer_id})" title="Edit Customer">
                            <div class="icon icon--pen-to-square"></div>
                        </button>
                        <button class="btn btn--text-danger btn--small" onclick="CustomersManagement.deleteCustomer(${customer.customer_id})" title="Delete Customer">
                            <div class="icon icon--trash"></div>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    // Update pagination
    function updatePagination() {
        const totalPages = Math.ceil(filteredCustomers.length / pageSize);
        const paginationInfo = document.getElementById('pagination-info-text');
        const paginationNumbers = document.getElementById('pagination-numbers');
        const prevBtn = document.getElementById('prev-page-btn');
        const nextBtn = document.getElementById('next-page-btn');
        const paginationContainer = document.getElementById('customers-pagination');

        // Show pagination container if there are items
        if (paginationContainer) {
            paginationContainer.style.display = filteredCustomers.length > 0 ? 'flex' : 'none';
        }

        // Update info text
        const startIndex = filteredCustomers.length > 0 ? (currentPage - 1) * pageSize + 1 : 0;
        const endIndex = Math.min(currentPage * pageSize, filteredCustomers.length);
        
        if (paginationInfo) {
            if (filteredCustomers.length > 0) {
            paginationInfo.textContent = `Showing ${startIndex}-${endIndex} of ${filteredCustomers.length} customers`;
            } else {
                paginationInfo.textContent = 'No customers found';
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
                        onclick="CustomersManagement.goToPage(${i})">
                    ${i}
                </button>
            `;
        }

        return html;
    }

    // Navigation functions
    function goToPage(page) {
        currentPage = page;
        loadCustomersData();
    }

    function previousPage() {
        if (currentPage > 1) {
            currentPage--;
            loadCustomersData();
        }
    }

    function nextPage() {
            currentPage++;
        loadCustomersData();
    }

    function changePageSize() {
        const pageSizeSelect = document.getElementById('page-size-select');
        pageSize = parseInt(pageSizeSelect.value);
        currentPage = 1;
        loadCustomersData();
    }

    // Update statistics (deprecated - now loaded from API)
    function updateStatistics() {
        // This function is now handled by loadStatistics() and updateStatisticsFromAPI()
        // Keeping for backward compatibility
        loadStatistics();
    }

    // Update percentage display with colors and arrows
    function updatePercentageDisplay(prefix, percentage) {
        const percentageContainer = document.getElementById(`${prefix}-percentage`);
        const percentageText = document.getElementById(`${prefix}-percent-text`);
        const arrow = document.getElementById(`${prefix}-arrow`);
        
        if (!percentageContainer || !percentageText || !arrow) return;
        
        // Update the percentage text
        const numericValue = parseFloat(percentage.toString().replace('%', '').replace('+', ''));
        percentageText.textContent = `${Math.abs(numericValue).toFixed(1)}%`;
        
        // Remove all color classes
        percentageContainer.classList.remove('stat-percentage--positive', 'stat-percentage--negative', 'stat-percentage--neutral');
        
        // Add appropriate class and arrow based on percentage value
        if (numericValue > 0) {
            percentageContainer.classList.add('stat-percentage--positive');
            arrow.className = 'icon icon--arrow-up';
            arrow.style.display = 'inline-block';
        } else if (numericValue < 0) {
            percentageContainer.classList.add('stat-percentage--negative');
            arrow.className = 'icon icon--arrow-down';
            arrow.style.display = 'inline-block';
        } else {
            percentageContainer.classList.add('stat-percentage--neutral');
            arrow.style.display = 'none';
        }
    }

    // Modal functions
    function openAddCustomerModal() {
        currentEditingCustomer = null;
        document.getElementById('customer-modal-title').textContent = 'Add New Customer';
        document.getElementById('save-customer-btn-text').textContent = 'Save Customer';
        clearCustomerForm();
        document.getElementById('customer-modal').style.display = 'flex';
    }

    function editCustomer(customerId) {
        const customer = customersData.find(c => c.customer_id === customerId);
        if (!customer) return;

        currentEditingCustomer = customer;
        document.getElementById('customer-modal-title').textContent = 'Edit Customer';
        document.getElementById('save-customer-btn-text').textContent = 'Update Customer';
        populateCustomerForm(customer);
        document.getElementById('customer-modal').style.display = 'flex';
    }

    function closeCustomerModal() {
        document.getElementById('customer-modal').style.display = 'none';
        currentEditingCustomer = null;
        clearCustomerForm();
    }

    function populateCustomerForm(customer) {
        document.getElementById('customer-name').value = customer.customer_name;
        document.getElementById('customer-phone').value = customer.phone_number;
        document.getElementById('customer-email').value = customer.email || '';
        document.getElementById('customer-location').value = customer.location;
        document.getElementById('customer-notes').value = customer.notes || '';
    }

    function clearCustomerForm() {
        document.getElementById('customer-form').reset();
    }

    function saveCustomer() {
        const formData = {
            customer_name: document.getElementById('customer-name').value,
            phone_number: document.getElementById('customer-phone').value,
            email: document.getElementById('customer-email').value,
            location: document.getElementById('customer-location').value,
            notes: document.getElementById('customer-notes').value
        };

        // Validate required fields
        if (!formData.customer_name || !formData.phone_number || !formData.location) {
            alert('Please fill in all required fields.');
            return;
        }

        const isEditing = currentEditingCustomer !== null;
        const url = isEditing ? 
            `${window.baseKeyword}api/customers.php?action=update&dealer_id=${window.DealerID}&id=${currentEditingCustomer.customer_id}` : 
            `${window.baseKeyword}api/customers.php?action=create&dealer_id=${window.DealerID}`;
        const method = isEditing ? 'PUT' : 'POST';

        fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Refresh display
                loadCustomersData();
                closeCustomerModal();
                
                // Show success message
                alert(data.message || (isEditing ? 'Customer updated successfully!' : 'Customer created successfully!'));
            } else {
                alert(data.error || 'Failed to save customer');
            }
        })
        .catch(error => {
            console.error('API Error:', error);
            alert('Failed to connect to server');
        });
    }

    // Customer details modal
    function viewCustomerDetails(customerId) {
        const customer = customersData.find(c => c.customer_id === customerId);
        if (!customer) return;

        document.getElementById('customer-details-title').textContent = `Customer Details - ${customer.customer_name}`;
        
        const detailsContent = document.getElementById('customer-details-content');
        detailsContent.innerHTML = `
            <div class="customer-details-grid">
                <div class="customer-detail-section">
                    <h4>Customer Information</h4>
                    <div class="detail-row">
                        <span class="detail-label">Name:</span>
                        <span class="detail-value">${customer.customer_name}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Phone:</span>
                        <span class="detail-value">${customer.phone_number}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Email:</span>
                        <span class="detail-value">${customer.email || 'Not provided'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Location:</span>
                        <span class="detail-value" style="white-space: pre-line;">${customer.location}</span>
                    </div>
                </div>
                
                <div class="customer-detail-section">
                    <h4>Purchase History</h4>
                    <div class="detail-row">
                        <span class="detail-label">Total Purchases:</span>
                        <span class="detail-value"><strong>${customer.purchases_count || 0}</strong></span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Total Spent:</span>
                        <span class="detail-value"><strong>${formatCurrency(customer.total_spent || 0)}</strong></span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Last Purchase:</span>
                        <span class="detail-value">${customer.last_purchase_date ? formatDate(customer.last_purchase_date) : 'No purchases yet'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Average Order:</span>
                        <span class="detail-value">${formatCurrency((customer.total_spent || 0) / (customer.purchases_count || 1))}</span>
                    </div>
                </div>
                
                ${customer.notes ? `
                <div class="customer-detail-section">
                    <h4>Notes</h4>
                    <div class="detail-notes">${customer.notes}</div>
                </div>
                ` : ''}
            </div>
        `;

        document.getElementById('customer-details-modal').style.display = 'flex';
    }

    function closeCustomerDetailsModal() {
        document.getElementById('customer-details-modal').style.display = 'none';
    }

    function printCustomerDetails() {
        window.print();
    }

    // Delete customer functions
    function deleteCustomer(customerId) {
        const customer = customersData.find(c => c.customer_id === customerId);
        if (!customer) return;

        currentDeletingCustomer = customer;
        document.getElementById('delete-customer-info').innerHTML = `
            <strong>Customer:</strong> ${customer.customer_name}<br>
            <strong>Phone:</strong> ${customer.phone_number}<br>
            <strong>Total Spent:</strong> ${formatCurrency(customer.total_spent || 0)}
        `;
        
        document.getElementById('delete-customer-modal').style.display = 'flex';
    }

    function closeDeleteModal() {
        document.getElementById('delete-customer-modal').style.display = 'none';
        currentDeletingCustomer = null;
    }

    function confirmDeleteCustomer() {
        if (!currentDeletingCustomer) return;

        fetch(`${window.baseKeyword}api/customers.php?action=delete&dealer_id=${window.DealerID}&id=${currentDeletingCustomer.customer_id}`, {
            method: 'DELETE'
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                loadCustomersData();
                closeDeleteModal();
                alert(data.message || 'Customer deleted successfully!');
            } else {
                alert(data.error || 'Failed to delete customer');
            }
        })
        .catch(error => {
            console.error('API Error:', error);
            alert('Failed to connect to server');
        });
    }

    // Utility functions
    function showLoading(show) {
        const loadingElement = document.getElementById('customers-loading');
        if (loadingElement) {
            loadingElement.style.display = show ? 'flex' : 'none';
        }
    }

    function formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0
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

    function closeAllModals() {
        // Close any open modals
        const modals = document.querySelectorAll('.modal-overlay, .modal');
        modals.forEach(modal => {
            modal.style.display = 'none';
        });
        
        // Reset modal states
        currentEditingCustomer = null;
        currentDeletingCustomer = null;
    }

    // Export customers data to CSV
    function exportCustomers() {
        console.log('Exporting customers data...');
        
        // Prepare CSV headers
        const headers = [
            'Customer Name',
            'Phone',
            'Email',
            'Location',
            'Purchases',
            'Total Spent',
            'Last Purchase',
            'Notes'
        ];
        
        // Prepare CSV data
        const csvData = filteredCustomers.map(customer => [
            customer.customer_name,
            customer.phone_number,
            customer.email || '',
            customer.location,
            customer.purchases_count || 0,
            customer.total_spent || 0,
            customer.last_purchase_date ? formatDate(customer.last_purchase_date) : '',
            customer.notes || ''
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
        link.setAttribute('download', `customers_export_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        alert('Customers data exported successfully!');
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
        openAddCustomerModal,
        editCustomer,
        closeCustomerModal,
        saveCustomer,
        viewCustomerDetails,
        closeCustomerDetailsModal,
        printCustomerDetails,
        deleteCustomer,
        closeDeleteModal,
        confirmDeleteCustomer,
        exportCustomers
    };
})();

// Global function for router compatibility
window.customers = function() {
    CustomersManagement.init();
}; 