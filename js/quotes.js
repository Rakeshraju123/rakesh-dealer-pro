// Quotes Management Module
window.QuotesManagement = (function() {
    'use strict';

    // Private variables
    let quotesData = [];
    let filteredQuotes = [];
    let currentPage = 1;
    let pageSize = 10;
    let sortField = 'quote_id';
    let sortDirection = 'desc';
    let currentEditingQuote = null;
    let currentDeletingQuote = null;

    // Quotes data will be loaded from API

    // Initialize the quotes management module
    function init() {
        console.log('Initializing Quotes Management...');
        
        // Set initial sorting to DESC
        updateTableHeaderSorting(sortField, sortDirection);
        
        // Load initial data (this will handle rendering)
        loadQuotesData();
        loadSalesmenData();
        
        // Setup event listeners
        setupEventListeners();
        
        // Update statistics (will be called again by loadQuotesData, but that's ok)
        updateStatistics();
    }

    // Load salesmen data from API
    function loadSalesmenData() {
        fetch(`${window.baseKeyword}api/quotes.php?action=salesmen&dealer_id=${window.DealerID}`)
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

    function populateSalesmenDropdowns(salesmen) {
        const filterDropdown = document.getElementById('salesman-filter');
        const formDropdown = document.getElementById('quote-salesman');
        
        if (filterDropdown) {
            filterDropdown.innerHTML = '<option value="">All Salesmen</option>';
            salesmen.forEach(salesman => {
                const option = document.createElement('option');
                option.value = salesman.salesman_id;
                option.textContent = salesman.salesman_name;
                filterDropdown.appendChild(option);
            });
        }
        
        if (formDropdown) {
            formDropdown.innerHTML = '<option value="">Select Salesman</option>';
            salesmen.forEach(salesman => {
                const option = document.createElement('option');
                option.value = salesman.salesman_id;
                option.textContent = salesman.salesman_name;
                formDropdown.appendChild(option);
            });
        }
    }

    // Setup event listeners
    function setupEventListeners() {
        // Search functionality
        const searchInput = document.getElementById('quotes-search');
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
        loadQuotesData(); // Reload data from server with search parameters
    }

    // Handle filter functionality
    function handleFilter() {
        currentPage = 1; // Reset to first page when filtering
        loadQuotesData(); // Reload data from server with filter parameters
    }

    // Load quotes data from API
    function loadQuotesData() {
        showLoading(true);
        
        // Get current filters for API call
        const searchTerm = document.getElementById('quotes-search')?.value || '';
        const statusFilter = document.getElementById('status-filter')?.value || '';
        const salesmanFilter = document.getElementById('salesman-filter')?.value || '';
        
        // Build API URL with parameters
        const params = new URLSearchParams({
            action: 'list',
            dealer_id: window.DealerID,
            page: currentPage,
            pageSize: pageSize,
            search: searchTerm,
            status: statusFilter,
            salesman: salesmanFilter,
            sort: sortField,
            direction: sortDirection
        });
        
        fetch(`${window.baseKeyword}api/quotes.php?${params}`)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    quotesData = data.data.items || [];
                    filteredQuotes = [...quotesData];
                    
                    // Update pagination info from API
                    if (data.data.pagination) {
                        updatePaginationFromAPI(data.data.pagination);
                        renderQuotesTableWithoutPagination(); // Don't call updatePagination again
                    } else {
                        // Fallback to local pagination if API doesn't provide pagination data
                        applyInitialSort();
                        renderQuotesTable();
                    }
                    
                    loadStatistics();
                } else {
                    quotesData = [];
                    filteredQuotes = [];
                    console.error('Failed to load quotes:', data.error);
                    alert('Failed to load quotes data');
                }
            })
            .catch(error => {
                console.error('Error loading quotes:', error);
                alert('Failed to connect to server');
            })
            .finally(() => {
                showLoading(false);
            });
    }
    
    // Load statistics from API
    function loadStatistics() {
        fetch(`${window.baseKeyword}api/quotes.php?action=stats&dealer_id=${window.DealerID}`)
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
        const paginationContainer = document.getElementById('quotes-pagination');

        const totalItems = paginationData.total_items || 0;
        const totalPages = paginationData.total_pages || 0;
        const currentPageNum = paginationData.current_page || 1;
        const pageSize = paginationData.items_per_page || 10;

        // Show pagination container if there are items
        if (paginationContainer) {
            paginationContainer.style.display = totalItems > 0 ? 'flex' : 'none';
        }

        // Update info text
        const startIndex = totalItems > 0 ? ((currentPageNum - 1) * pageSize) + 1 : 0;
        const endIndex = Math.min(currentPageNum * pageSize, totalItems);
        
        if (paginationInfo) {
            if (totalItems > 0) {
                paginationInfo.textContent = `Showing ${startIndex}-${endIndex} of ${totalItems} quotes`;
            } else {
                paginationInfo.textContent = 'No quotes found';
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
        document.getElementById('total-quotes').textContent = statsData.total_quotes || 0;
        document.getElementById('pending-quotes').textContent = statsData.pending_quotes || 0;
        document.getElementById('accepted-quotes').textContent = statsData.accepted_quotes || 0;
        document.getElementById('total-quotes-value').textContent = formatCurrency(statsData.total_value || 0);

        // Calculate percentages for display
        const totalQuotes = statsData.total_quotes || 0;
        const pendingQuotes = statsData.pending_quotes || 0;
        const acceptedQuotes = statsData.accepted_quotes || 0;
        
        // Calculate real percentages based on actual data
        const acceptanceRate = totalQuotes > 0 ? ((acceptedQuotes / totalQuotes) * 100).toFixed(1) : 0;
        const pendingRate = totalQuotes > 0 ? ((pendingQuotes / totalQuotes) * 100).toFixed(1) : 0;
        
        // Growth percentages - these would be calculated based on previous period data
        const quotesGrowthRate = "0.0";
        
        // Value growth percentage
        const valueGrowthRate = "0.0";

        // Update percentages with colors and arrows
        updatePercentageDisplay('total-quotes', quotesGrowthRate);
        updatePercentageDisplay('pending-quotes', pendingRate);
        updatePercentageDisplay('accepted-quotes', acceptanceRate);
        updatePercentageDisplay('total-quotes-value', valueGrowthRate);
    }

    // Apply initial sort
    function applyInitialSort() {
        filteredQuotes.sort((a, b) => {
            let aVal = a[sortField];
            let bVal = b[sortField];

            // Handle numeric fields
            if (sortField === 'quote_id' || sortField === 'total_amount') {
                aVal = parseFloat(aVal);
                bVal = parseFloat(bVal);
            }

            // Handle date fields
            if (sortField === 'quote_date' || sortField === 'expiry_date') {
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
        updateTableHeaderSorting(sortField, sortDirection);
    }

    // Apply all filters and search (now reloads from server)
    function applyFilters() {
        currentPage = 1; // Reset to first page
        loadQuotesData(); // Reload data from server with all parameters
    }

    // Apply current sort to filtered quotes (for local fallback only)
    function applySortToFiltered() {
        filteredQuotes.sort((a, b) => {
            let aVal = a[sortField];
            let bVal = b[sortField];

            // Handle numeric fields
            if (sortField === 'quote_id' || sortField === 'total_amount') {
                aVal = parseFloat(aVal);
                bVal = parseFloat(bVal);
            }

            // Handle date fields
            if (sortField === 'quote_date' || sortField === 'expiry_date') {
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

        // Update table header visual feedback with a small delay to ensure DOM is ready
        setTimeout(() => {
            updateTableHeaderSorting(sortField, sortDirection);
        }, 10);
    }

    // Clear all filters
    function clearFilters() {
        document.getElementById('quotes-search').value = '';
        document.getElementById('status-filter').value = '';
        document.getElementById('salesman-filter').value = '';
        
        currentPage = 1;
        loadQuotesData(); // Reload data from server without filters
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
        loadQuotesData();
    }

    // Update table header sorting visual feedback
    function updateTableHeaderSorting(field, direction) {
        // Remove all existing sort classes
        const headers = document.querySelectorAll('.table th');
        headers.forEach(header => {
            header.classList.remove('sort-asc', 'sort-desc');
        });

        // Add sort class to current field
        const currentHeader = document.querySelector(`th[onclick="QuotesManagement.sortTable('${field}')"]`);
        if (currentHeader) {
            currentHeader.classList.add(direction === 'asc' ? 'sort-asc' : 'sort-desc');
        }
    }

    // Update percentage display with colors and arrows
    function updatePercentageDisplay(prefix, percentage) {
        const percentageContainer = document.getElementById(`${prefix}-percentage`);
        const percentageText = percentageContainer?.querySelector('span:last-child') || percentageContainer;
        const arrow = percentageContainer?.querySelector('.icon');
        
        if (!percentageContainer || !percentageText) return;
        
        // Update the percentage text
        const numericValue = parseFloat(percentage.toString().replace('%', '').replace('+', ''));
        if (percentageText.tagName === 'SPAN' || percentageText.tagName === 'DIV') {
            percentageText.textContent = `${Math.abs(numericValue).toFixed(1)}%`;
        } else {
            percentageContainer.innerHTML = `
                <span class="icon icon--arrow-up" style="display: ${numericValue !== 0 ? 'inline-block' : 'none'};"></span>
                <span>${Math.abs(numericValue).toFixed(1)}%</span>
            `;
        }
        
        // Remove all color classes
        percentageContainer.classList.remove('stat-percentage--positive', 'stat-percentage--negative', 'stat-percentage--neutral');
        
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

    // Render quotes table
    function renderQuotesTable() {
        const tableBody = document.getElementById('quotes-table-body');
        const emptyState = document.getElementById('quotes-empty-state');
        
        if (!tableBody) return;

        // Calculate pagination
        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const paginatedQuotes = filteredQuotes.slice(startIndex, endIndex);

        // Show empty state if no quotes
        if (filteredQuotes.length === 0) {
            tableBody.innerHTML = '';
            if (emptyState) {
                emptyState.style.display = 'block';
            }
            updatePagination();
            return;
        }

        // Hide empty state
        if (emptyState) {
            emptyState.style.display = 'none';
        }

        // Render quotes
        tableBody.innerHTML = paginatedQuotes.map(quote => `
            <tr>
                <td><strong>#${quote.quote_id}</strong></td>
                <td>
                    <div>${quote.customer_name}</div>
                    <div style="font-size: 0.8rem; color: var(--color-text-light);">${quote.phone_number || ''}</div>
                </td>
                <td>${quote.salesman_name || ''}</td>
                <td>${quote.item_product}</td>
                <td>
                    <span class="chip ${getStatusChipClass(quote.status)}">
                        ${capitalizeFirst(quote.status)}
                    </span>
                </td>
                <td><strong>${formatCurrency(quote.total_amount)}</strong></td>
                <td>${formatDate(quote.expiry_date)}</td>
                <td class="cell-icon">
                    <div class="table__actions">
                        <button class="btn btn--text btn--small" onclick="QuotesManagement.viewQuoteDetails(${quote.quote_id})" title="View Details">
                            <div class="icon icon--eye"></div>
                        </button>
                        <button class="btn btn--text btn--small" onclick="QuotesManagement.editQuote(${quote.quote_id})" title="Edit Quote">
                            <div class="icon icon--pen-to-square"></div>
                        </button>
                        <button class="btn btn--text-danger btn--small" onclick="QuotesManagement.deleteQuote(${quote.quote_id})" title="Delete Quote">
                            <div class="icon icon--trash"></div>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

        updatePagination();
    }

    // Render quotes table without updating pagination (used when API provides pagination data)
    function renderQuotesTableWithoutPagination() {
        const tableBody = document.getElementById('quotes-table-body');
        const emptyState = document.getElementById('quotes-empty-state');
        
        if (!tableBody) return;

        // Show empty state if no quotes
        if (filteredQuotes.length === 0) {
            tableBody.innerHTML = '';
            if (emptyState) {
                emptyState.style.display = 'block';
            }
            return;
        }

        // Hide empty state
        if (emptyState) {
            emptyState.style.display = 'none';
        }

        // Render all quotes (API already handles pagination)
        tableBody.innerHTML = filteredQuotes.map(quote => `
            <tr>
                <td><strong>#${quote.quote_id}</strong></td>
                <td>
                    <div>${quote.customer_name}</div>
                    <div style="font-size: 0.8rem; color: var(--color-text-light);">${quote.phone_number || ''}</div>
                </td>
                <td>${quote.salesman_name || ''}</td>
                <td>${quote.item_product}</td>
                <td>
                    <span class="chip ${getStatusChipClass(quote.status)}">
                        ${capitalizeFirst(quote.status)}
                    </span>
                </td>
                <td><strong>${formatCurrency(quote.total_amount)}</strong></td>
                <td>${formatDate(quote.expiry_date)}</td>
                <td class="cell-icon">
                    <div class="table__actions">
                        <button class="btn btn--text btn--small" onclick="QuotesManagement.viewQuoteDetails(${quote.quote_id})" title="View Details">
                            <div class="icon icon--eye"></div>
                        </button>
                        <button class="btn btn--text btn--small" onclick="QuotesManagement.editQuote(${quote.quote_id})" title="Edit Quote">
                            <div class="icon icon--pen-to-square"></div>
                        </button>
                        <button class="btn btn--text-danger btn--small" onclick="QuotesManagement.deleteQuote(${quote.quote_id})" title="Delete Quote">
                            <div class="icon icon--trash"></div>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    // Update pagination
    function updatePagination() {
        const totalPages = Math.ceil(filteredQuotes.length / pageSize);
        const paginationInfo = document.getElementById('pagination-info-text');
        const paginationNumbers = document.getElementById('pagination-numbers');
        const prevBtn = document.getElementById('prev-page-btn');
        const nextBtn = document.getElementById('next-page-btn');
        const paginationContainer = document.getElementById('quotes-pagination');

        // Show pagination container if there are items
        if (paginationContainer) {
            paginationContainer.style.display = filteredQuotes.length > 0 ? 'flex' : 'none';
        }

        // Update info text
        const startIndex = filteredQuotes.length > 0 ? ((currentPage - 1) * pageSize) + 1 : 0;
        const endIndex = Math.min(currentPage * pageSize, filteredQuotes.length);
        
        if (paginationInfo) {
            if (filteredQuotes.length > 0) {
                paginationInfo.textContent = `Showing ${startIndex}-${endIndex} of ${filteredQuotes.length} quotes`;
            } else {
                paginationInfo.textContent = 'No quotes found';
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
                        onclick="QuotesManagement.goToPage(${i})">
                    ${i}
                </button>
            `;
        }

        return html;
    }

    // Navigation functions
    function goToPage(page) {
        currentPage = page;
        loadQuotesData();
    }

    function previousPage() {
        if (currentPage > 1) {
            currentPage--;
            loadQuotesData();
        }
    }

    function nextPage() {
        currentPage++;
        loadQuotesData();
    }

    function changePageSize() {
        const newPageSize = parseInt(document.getElementById('page-size-select').value);
        pageSize = newPageSize;
        currentPage = 1;
        loadQuotesData();
    }

    // Update statistics (deprecated - now loaded from API)
    function updateStatistics() {
        // This function is now handled by loadStatistics() and updateStatisticsFromAPI()
        // Keeping for backward compatibility
        loadStatistics();
    }

    // Utility functions
    function showLoading(show) {
        const loadingSpinner = document.getElementById('quotes-loading');
        if (loadingSpinner) {
            loadingSpinner.style.display = show ? 'flex' : 'none';
        }
    }

    function getStatusChipClass(status) {
        switch (status) {
            case 'accepted': return 'chip--green';
            case 'draft': return 'chip--gray';
            case 'sent': return 'chip--blue';
            case 'declined': return 'chip--red';
            case 'expired': return 'chip--orange';
            case 'converted': return 'chip--purple';
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
        currentEditingQuote = null;
        currentDeletingQuote = null;
    }

    // Modal operations
    function openAddQuoteModal() {
        currentEditingQuote = null;
        document.getElementById('quote-modal-title').textContent = 'Add New Quote';
        document.getElementById('save-quote-btn-text').textContent = 'Save Quote';
        clearQuoteForm();
        document.getElementById('quote-modal').style.display = 'flex';
    }

    function editQuote(quoteId) {
        const quote = quotesData.find(q => q.quote_id === quoteId);
        if (!quote) return;

        currentEditingQuote = quote;
        document.getElementById('quote-modal-title').textContent = 'Edit Quote';
        document.getElementById('save-quote-btn-text').textContent = 'Update Quote';
        populateQuoteForm(quote);
        document.getElementById('quote-modal').style.display = 'flex';
    }

    function closeQuoteModal() {
        document.getElementById('quote-modal').style.display = 'none';
        currentEditingQuote = null;
        clearQuoteForm();
    }

    function populateQuoteForm(quote) {
        document.getElementById('quote-customer-name').value = quote.customer_name;
        document.getElementById('quote-phone').value = quote.phone_number || '';
        document.getElementById('quote-email').value = quote.email || '';
        document.getElementById('quote-salesman').value = quote.salesman_id || '';
        document.getElementById('quote-item').value = quote.item_product;
        document.getElementById('quote-amount').value = quote.quote_amount || quote.total_amount;
        document.getElementById('quote-tax').value = quote.tax_amount || '';
        document.getElementById('quote-discount').value = quote.discount_amount || '';
        document.getElementById('quote-status').value = quote.status;
        document.getElementById('quote-expiry-date').value = quote.expiry_date;
        document.getElementById('quote-notes').value = quote.notes || '';
        document.getElementById('quote-terms').value = quote.terms_conditions || '';
    }

    function clearQuoteForm() {
        document.getElementById('quote-form').reset();
        // Set default expiry date (30 days from now)
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 30);
        document.getElementById('quote-expiry-date').value = expiryDate.toISOString().split('T')[0];
    }

    function saveQuote() {
        const formData = {
            customer_name: document.getElementById('quote-customer-name').value,
            phone_number: document.getElementById('quote-phone').value,
            email: document.getElementById('quote-email').value,
            salesman_id: document.getElementById('quote-salesman').value,
            item_product: document.getElementById('quote-item').value,
            quote_amount: document.getElementById('quote-amount').value,
            tax_amount: document.getElementById('quote-tax').value,
            discount_amount: document.getElementById('quote-discount').value,
            status: document.getElementById('quote-status').value,
            expiry_date: document.getElementById('quote-expiry-date').value,
            notes: document.getElementById('quote-notes').value,
            terms_conditions: document.getElementById('quote-terms').value
        };

        // Validate required fields
        if (!formData.customer_name || !formData.item_product || !formData.quote_amount || !formData.expiry_date) {
            alert('Please fill in all required fields.');
            return;
        }

        const isEditing = currentEditingQuote !== null;
        const url = isEditing ? 
            `${window.baseKeyword}api/quotes.php?action=update&dealer_id=${window.DealerID}&id=${currentEditingQuote.quote_id}` : 
            `${window.baseKeyword}api/quotes.php?action=create&dealer_id=${window.DealerID}`;
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
                loadQuotesData();
                closeQuoteModal();
                
                // Show success message
                alert(data.message || (isEditing ? 'Quote updated successfully!' : 'Quote created successfully!'));
            } else {
                alert(data.error || 'Failed to save quote');
            }
        })
        .catch(error => {
            console.error('API Error:', error);
            alert('Failed to connect to server');
        });
    }

    // Quote details modal
    function viewQuoteDetails(quoteId) {
        const quote = quotesData.find(q => q.quote_id === quoteId);
        if (!quote) return;

        document.getElementById('quote-details-title').textContent = `Quote Details - #${quote.quote_id}`;
        
        const detailsContent = document.getElementById('quote-details-content');
        
        detailsContent.innerHTML = `
            <div class="quote-details-grid">
                <div class="quote-detail-section">
                    <h4>Quote Information</h4>
                    <div class="detail-row">
                        <span class="detail-label">Quote Number:</span>
                        <span class="detail-value">#${quote.quote_id}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Status:</span>
                        <span class="detail-value">
                            <span class="chip ${getStatusChipClass(quote.status)}">
                                ${capitalizeFirst(quote.status)}
                            </span>
                        </span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Quote Date:</span>
                        <span class="detail-value">${formatDate(quote.quote_date)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Expiry Date:</span>
                        <span class="detail-value">${formatDate(quote.expiry_date)}</span>
                    </div>
                </div>
                
                <div class="quote-detail-section">
                    <h4>Customer Information</h4>
                    <div class="detail-row">
                        <span class="detail-label">Name:</span>
                        <span class="detail-value">${quote.customer_name}</span>
                    </div>
                    ${quote.phone_number ? `
                    <div class="detail-row">
                        <span class="detail-label">Phone:</span>
                        <span class="detail-value">${quote.phone_number}</span>
                    </div>
                    ` : ''}
                    ${quote.email ? `
                    <div class="detail-row">
                        <span class="detail-label">Email:</span>
                        <span class="detail-value">${quote.email}</span>
                    </div>
                    ` : ''}
                </div>
                
                <div class="quote-detail-section">
                    <h4>Product Information</h4>
                    <div class="detail-row">
                        <span class="detail-label">Item/Product:</span>
                        <span class="detail-value">${quote.item_product}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Quote Amount:</span>
                        <span class="detail-value">${formatCurrency(quote.quote_amount || quote.total_amount)}</span>
                    </div>
                    ${quote.tax_amount && quote.tax_amount > 0 ? `
                    <div class="detail-row">
                        <span class="detail-label">Tax Amount:</span>
                        <span class="detail-value">${formatCurrency(quote.tax_amount)}</span>
                    </div>
                    ` : ''}
                    ${quote.discount_amount && quote.discount_amount > 0 ? `
                    <div class="detail-row">
                        <span class="detail-label">Discount Amount:</span>
                        <span class="detail-value">-${formatCurrency(quote.discount_amount)}</span>
                    </div>
                    ` : ''}
                    <div class="detail-row">
                        <span class="detail-label">Total Amount:</span>
                        <span class="detail-value"><strong>${formatCurrency(quote.total_amount)}</strong></span>
                    </div>
                </div>
                
                ${quote.salesman_name ? `
                <div class="quote-detail-section">
                    <h4>Salesman Information</h4>
                    <div class="detail-row">
                        <span class="detail-label">Assigned Salesman:</span>
                        <span class="detail-value">${quote.salesman_name}</span>
                    </div>
                </div>
                ` : ''}
                
                ${quote.notes ? `
                <div class="quote-detail-section">
                    <h4>Notes</h4>
                    <div class="detail-notes">${quote.notes}</div>
                </div>
                ` : ''}
                
                ${quote.terms_conditions ? `
                <div class="quote-detail-section">
                    <h4>Terms & Conditions</h4>
                    <div class="detail-notes">${quote.terms_conditions}</div>
                </div>
                ` : ''}
            </div>
        `;

        document.getElementById('quote-details-modal').style.display = 'flex';
    }

    function closeQuoteDetailsModal() {
        document.getElementById('quote-details-modal').style.display = 'none';
    }

    function printQuoteDetails() {
        window.print();
    }

    // Delete quote functions
    function deleteQuote(quoteId) {
        const quote = quotesData.find(q => q.quote_id === quoteId);
        if (!quote) return;

        currentDeletingQuote = quote;
        document.getElementById('delete-quote-info').innerHTML = `
            <strong>Quote Number:</strong> #${quote.quote_id}<br>
            <strong>Customer:</strong> ${quote.customer_name}<br>
            <strong>Amount:</strong> ${formatCurrency(quote.total_amount)}
        `;
        
        document.getElementById('delete-quote-modal').style.display = 'flex';
    }

    function closeDeleteModal() {
        document.getElementById('delete-quote-modal').style.display = 'none';
        currentDeletingQuote = null;
    }

    function confirmDeleteQuote() {
        if (!currentDeletingQuote) return;

        const url = `${window.baseKeyword}api/quotes.php?action=delete&dealer_id=${window.DealerID}&id=${currentDeletingQuote.quote_id}`;

        fetch(url, {
            method: 'DELETE'
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                closeDeleteModal();
                loadQuotesData(); // Reload data from server
                alert(data.message || 'Quote deleted successfully!');
            } else {
                alert(data.error || 'Failed to delete quote');
            }
        })
        .catch(error => {
            console.error('Error deleting quote:', error);
            alert('Error deleting quote. Please try again.');
        });
    }

    function exportQuotes() {
        // Export functionality
        const csvContent = "data:text/csv;charset=utf-8," 
            + "Quote ID,Customer Name,Phone,Email,Item/Product,Salesman,Status,Quote Amount,Tax,Discount,Total Amount,Quote Date,Expiry Date,Notes\n"
            + filteredQuotes.map(quote => 
                `"${quote.quote_id}","${quote.customer_name}","${quote.phone_number || ''}","${quote.email || ''}","${quote.item_product}","${quote.salesman_name || ''}","${quote.status}","${quote.quote_amount || quote.total_amount}","${quote.tax_amount || 0}","${quote.discount_amount || 0}","${quote.total_amount}","${quote.quote_date}","${quote.expiry_date}","${quote.notes || ''}"`
            ).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `quotes_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        alert('Quotes data exported successfully!');
    }

    // Public API
    return {
        init,
        loadQuotesData,
        sortTable,
        goToPage,
        previousPage,
        nextPage,
        changePageSize,
        clearFilters,
        openAddQuoteModal,
        editQuote,
        closeQuoteModal,
        saveQuote,
        viewQuoteDetails,
        closeQuoteDetailsModal,
        printQuoteDetails,
        deleteQuote,
        closeDeleteModal,
        confirmDeleteQuote,
        exportQuotes
    };
})();

// Global function for router compatibility
window.quotes = function() {
    QuotesManagement.init();
}; 