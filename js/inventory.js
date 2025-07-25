// Inventory Management Module
window.InventoryManagement = (function() {
    'use strict';

    // Private variables
    let inventoryData = [];
    let filteredInventory = [];
    let currentPage = 1;
    let pageSize = 10;
    let sortField = 'id';
    let sortDirection = 'desc';
    let currentEditingItem = null;

    // Notification functions
    function ensureToastContainer() {
        let container = document.getElementById('alert-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'alert-toast-container';
            container.className = 'alert-toast-container';
            document.body.appendChild(container);
        }
        return container;
    }

    function showSuccess(message) {
        const container = ensureToastContainer();
        
        // Create success alert toast
        const toastHtml = `
            <div class="alert-toast alert-toast--success">
                <div class="alert-toast__icon icon--alert-success"></div>
                <div class="alert-toast__content">
                    <div class="alert-toast__title">Success</div>
                    <div class="alert-toast__message">${escapeHtml(message)}</div>
                </div>
                <div class="alert-toast__close">
                    <div class="icon icon--close"></div>
                </div>
            </div>
        `;
        
        const toastElement = $(toastHtml);
        $(container).append(toastElement);
        
        // Trigger show animation
        setTimeout(() => {
            toastElement.addClass('show');
        }, 10);
        
        // Auto hide after 3 seconds
        setTimeout(() => {
            hideToast(toastElement);
        }, 3000);
        
        // Close button functionality
        toastElement.find('.alert-toast__close').on('click', function() {
            hideToast(toastElement);
        });
    }

    function showError(message) {
        const container = ensureToastContainer();
        
        // Create error alert toast
        const toastHtml = `
            <div class="alert-toast alert-toast--error">
                <div class="alert-toast__icon icon--alert-error"></div>
                <div class="alert-toast__content">
                    <div class="alert-toast__title">Error</div>
                    <div class="alert-toast__message">${escapeHtml(message)}</div>
                </div>
                <div class="alert-toast__close">
                    <div class="icon icon--close"></div>
                </div>
            </div>
        `;
        
        const toastElement = $(toastHtml);
        $(container).append(toastElement);
        
        // Trigger show animation
        setTimeout(() => {
            toastElement.addClass('show');
        }, 10);
        
        // Auto hide after 5 seconds (longer for errors)
        setTimeout(() => {
            hideToast(toastElement);
        }, 5000);
        
        // Close button functionality
        toastElement.find('.alert-toast__close').on('click', function() {
            hideToast(toastElement);
        });
    }

    function showWarning(message) {
        const container = ensureToastContainer();
        
        // Create warning alert toast
        const toastHtml = `
            <div class="alert-toast alert-toast--warning">
                <div class="alert-toast__icon icon--alert-warning"></div>
                <div class="alert-toast__content">
                    <div class="alert-toast__title">Warning</div>
                    <div class="alert-toast__message">${escapeHtml(message)}</div>
                </div>
                <div class="alert-toast__close">
                    <div class="icon icon--close"></div>
                </div>
            </div>
        `;
        
        const toastElement = $(toastHtml);
        $(container).append(toastElement);
        
        // Trigger show animation
        setTimeout(() => {
            toastElement.addClass('show');
        }, 10);
        
        // Auto hide after 4 seconds
        setTimeout(() => {
            hideToast(toastElement);
        }, 4000);
        
        // Close button functionality
        toastElement.find('.alert-toast__close').on('click', function() {
            hideToast(toastElement);
        });
    }

    function hideToast(toastElement) {
        toastElement.removeClass('show');
        setTimeout(() => {
            toastElement.remove();
        }, 300);
    }

    function escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, function(m) { return map[m]; });
    }

    // Initialize the inventory management module
    function init() {
        console.log('Initializing Inventory Management...');
        
        // Load inventory data
        loadInventoryData();
        
        // Setup event listeners
        setupEventListeners();
        
        // Initial render with sorting
        applyInitialSort();
        renderInventoryTable();
        updateStatistics();
    }

    // Load inventory data (simulate API call)
    function loadInventoryData() {
        showLoading(true);
        fetch('api/get_dealer_inventory.php')
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    // Map inventory_id to id for each item
                    inventoryData = data.data.map(item => ({
                        ...item,
                        id: item.inventory_id,
                        stock_id: item.stock_id || '', // Handle null stock_id
                        selling_price: Number(item.selling_price),
                        cost_price: Number(item.cost_price),
                        year: Number(item.year),
                        profit_amount: Number(item.profit_amount),
                        profit_percentage: Number(item.profit_percentage)
                    }));
                    filteredInventory = [...inventoryData];
                    applyInitialSort();
                } else {
                    inventoryData = [];
                    filteredInventory = [];
                    showError('Failed to load inventory: ' + (data.message || 'Unknown error'));
                }
                showLoading(false);
                renderInventoryTable();
                updateStatistics();
            })
            .catch(err => {
                showLoading(false);
                showError('Error loading inventory: ' + err);
            });
    }

    // Setup event listeners
    function setupEventListeners() {
        // Search functionality
        const searchInput = document.getElementById('inventory-search');
        if (searchInput) {
            searchInput.addEventListener('input', debounce(handleSearch, 300));
        }

        // Filter functionality
        const statusFilter = document.getElementById('status-filter');
        const typeFilter = document.getElementById('type-filter');
        
        if (statusFilter) {
            statusFilter.addEventListener('change', handleFilter);
        }
        
        if (typeFilter) {
            typeFilter.addEventListener('change', handleFilter);
        }

        // Modal close events
        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('modal-overlay')) {
                // Close the specific modal that was clicked
                if (e.target.id === 'viewTrailerModal') {
                    closeViewModal();
                } else if (e.target.id === 'process-payment-modal') {
                    closeProcessPaymentModal();
                } else if (e.target.id === 'delete-trailer-modal') {
                    closeDeleteModal();
                } else {
                    closeAllModals();
                }
            }
        });

        // Close status dropdowns when clicking outside
        document.addEventListener('click', function(e) {
            if (!e.target.closest('.status-container')) {
                const dropdowns = document.querySelectorAll('.status-dropdown');
                dropdowns.forEach(dropdown => {
                    dropdown.style.display = 'none';
                });
            }
        });
        
        // Add event listeners for profit calculation
        document.addEventListener('input', function(e) {
            if (e.target.id === 'cost_price' || e.target.id === 'selling_price') {
                updateProfitCalculation();
            }
        });
    }

    // Handle search functionality
    function handleSearch() {
        applyFilters();
    }

    // Handle filter functionality
    function handleFilter() {
        applyFilters();
    }

    // Apply initial sort
    function applyInitialSort() {
        filteredInventory.sort((a, b) => {
            let aVal = a[sortField];
            let bVal = b[sortField];

            // Handle numeric fields
            if (sortField === 'cost_price' || sortField === 'selling_price' || sortField === 'profit_amount' || sortField === 'year' || sortField === 'id') {
                aVal = parseFloat(aVal);
                bVal = parseFloat(bVal);
            }

            // Handle string fields (including stock_id)
            if (typeof aVal === 'string') {
                aVal = aVal.toLowerCase();
                bVal = bVal.toLowerCase();
            }

            // Handle null/undefined values for stock_id
            if (sortField === 'stock_id') {
                if (!aVal && !bVal) return 0;
                if (!aVal) return sortDirection === 'asc' ? 1 : -1;
                if (!bVal) return sortDirection === 'asc' ? -1 : 1;
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

    // Apply all filters and search
    function applyFilters() {
        const searchTerm = document.getElementById('inventory-search').value.toLowerCase();
        const statusFilter = document.getElementById('status-filter').value;
        const typeFilter = document.getElementById('type-filter').value;

        filteredInventory = inventoryData.filter(item => {
            const matchesSearch = !searchTerm || 
                item.id.toString().includes(searchTerm) ||
                (item.stock_id && item.stock_id.toLowerCase().includes(searchTerm)) ||
                item.manufacturer.toLowerCase().includes(searchTerm) ||
                item.model.toLowerCase().includes(searchTerm) ||
                (item.category || item.type || '').toLowerCase().includes(searchTerm);

            const matchesStatus = !statusFilter || item.status === statusFilter;
            const matchesType = !typeFilter || (item.category || item.type) === typeFilter;

            return matchesSearch && matchesStatus && matchesType;
        });

        // Apply current sort order to filtered results
        applySortToFiltered();

        currentPage = 1;
        renderInventoryTable();
        updateStatistics();
    }

    // Apply current sort to filtered inventory
    function applySortToFiltered() {
        filteredInventory.sort((a, b) => {
            let aVal = a[sortField];
            let bVal = b[sortField];

            // Handle numeric fields
            if (sortField === 'cost_price' || sortField === 'selling_price' || sortField === 'profit_amount' || sortField === 'year' || sortField === 'id') {
                aVal = parseFloat(aVal);
                bVal = parseFloat(bVal);
            }

            // Handle string fields (including stock_id)
            if (typeof aVal === 'string') {
                aVal = aVal.toLowerCase();
                bVal = bVal.toLowerCase();
            }

            // Handle null/undefined values for stock_id
            if (sortField === 'stock_id') {
                if (!aVal && !bVal) return 0;
                if (!aVal) return sortDirection === 'asc' ? 1 : -1;
                if (!bVal) return sortDirection === 'asc' ? -1 : 1;
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
        document.getElementById('inventory-search').value = '';
        document.getElementById('status-filter').value = '';
        document.getElementById('type-filter').value = '';
        
        filteredInventory = [...inventoryData];
        // Apply current sort order to cleared filters
        applySortToFiltered();
        currentPage = 1;
        renderInventoryTable();
        updateStatistics();
    }

    // Sort table by field
    function sortTable(field) {
        // Map stock_number to stock_id for backward compatibility
        if (field === 'stock_number') {
            field = 'stock_id';
        }
        
        if (sortField === field) {
            sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            sortField = field;
            sortDirection = 'desc'; // Default to DESC for new field sorts
        }

        filteredInventory.sort((a, b) => {
            let aVal = a[field];
            let bVal = b[field];

            // Handle numeric fields
            if (field === 'cost_price' || field === 'selling_price' || field === 'profit_amount' || field === 'year' || field === 'id') {
                aVal = parseFloat(aVal);
                bVal = parseFloat(bVal);
            }

            // Handle string fields (including stock_id)
            if (typeof aVal === 'string') {
                aVal = aVal.toLowerCase();
                bVal = bVal.toLowerCase();
            }

            // Handle null/undefined values for stock_id
            if (field === 'stock_id') {
                if (!aVal && !bVal) return 0;
                if (!aVal) return sortDirection === 'asc' ? 1 : -1;
                if (!bVal) return sortDirection === 'asc' ? -1 : 1;
            }

            if (sortDirection === 'asc') {
                return aVal > bVal ? 1 : -1;
            } else {
                return aVal < bVal ? 1 : -1;
            }
        });

        // Update table header visual feedback
        updateTableHeaderSorting(field, sortDirection);
        
        renderInventoryTable();
    }

    // Update table header sorting visual feedback
    function updateTableHeaderSorting(field, direction) {
        // Remove all existing sort classes
        const headers = document.querySelectorAll('.table th');
        headers.forEach(header => {
            header.classList.remove('sort-asc', 'sort-desc');
        });

        // Add sort class to current field - try multiple selectors to ensure we find the header
        let currentHeader = document.querySelector(`th[onclick="InventoryManagement.sortTable('${field}')"]`);
        
        // If not found, try alternative field names (for backward compatibility)
        if (!currentHeader && field === 'stock_id') {
            currentHeader = document.querySelector(`th[onclick="InventoryManagement.sortTable('stock_number')"]`);
        }
        
        if (currentHeader) {
            currentHeader.classList.add(direction === 'asc' ? 'sort-asc' : 'sort-desc');
        }
    }

    // Render inventory table
    function renderInventoryTable() {
        const tableBody = document.getElementById('inventory-table-body');
        const emptyState = document.getElementById('inventory-empty-state');
        
        if (!tableBody) return;

        // Calculate pagination
        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const paginatedItems = filteredInventory.slice(startIndex, endIndex);

        // Show empty state if no items
        if (filteredInventory.length === 0) {
            tableBody.innerHTML = '';
            if (emptyState) emptyState.style.display = 'block';
            updatePagination();
            return;
        }

        if (emptyState) emptyState.style.display = 'none';

        // Render table rows
        tableBody.innerHTML = paginatedItems.map(item => `
            <tr>
                <td><strong># ${item.id}</strong></td>
                <td><strong>${item.stock_id || 'N/A'}</strong></td>
                <td>
                    <div class="inventory-detail-primary">${item.manufacturer} ${item.model}</div>
                    <div class="inventory-detail-secondary">${item.category || item.type} • ${item.size || 'N/A'} • ${item.color || 'N/A'} • ${capitalizeFirst(item.condition)}</div>
                </td>
                <td><strong>${item.year}</strong></td>
                <td>
                    <div class="status-container">
                        <span class="chip ${getStatusChipClass(item.status)}">
                            ${capitalizeFirst(item.status)}
                        </span>
                        <button class="btn btn--text btn--small status-edit-btn" onclick="InventoryManagement.showStatusEditor(${item.id}, this)" title="Edit Status">
                            <div class="icon icon--pen-to-square"></div>
                        </button>
                        <div class="status-dropdown" id="status-dropdown-${item.id}" style="display: none;">
                            <div class="status-dropdown-header">
                                <select class="status-select" onchange="InventoryManagement.updateStatus(${item.id}, this.value)">
                                    <option value="available" ${item.status === 'available' ? 'selected' : ''}>Available</option>
                                    <option value="sold" ${item.status === 'sold' ? 'selected' : ''}>Sold</option>
                                    <option value="reserved" ${item.status === 'reserved' ? 'selected' : ''}>Reserved</option>
                                    <option value="maintenance" ${item.status === 'maintenance' ? 'selected' : ''}>Maintenance</option>
                                </select>
                                <div class="status-actions">
                                    <button class="btn btn--text btn--small" onclick="InventoryManagement.cancelStatusEdit(${item.id})" title="Cancel">
                                        <div class="icon icon--close"></div>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </td>
                <td><strong>${formatCurrency(item.cost_price)}</strong></td>
                <td><strong>${formatCurrency(item.selling_price)}</strong></td>
                <td>
                    <div class="inventory-profit-amount">${formatCurrency(item.profit_amount)}</div>
                    <div class="inventory-profit-percentage">${item.profit_percentage.toFixed(1)}%</div>
                </td>
                <td>${formatDate(item.date_added)}</td>
                <td class="cell-icon">
                    <div class="table__actions">
                        <button class="btn btn--text btn--small" onclick="InventoryManagement.viewItemDetails(${item.id})" title="View Details">
                            <div class="icon icon--eye"></div>
                        </button>
                        <button class="btn btn--text btn--small" onclick="InventoryManagement.editItem(${item.id})" title="Edit Item">
                            <div class="icon icon--pen-to-square"></div>
                        </button>
                        <button class="btn btn--text btn--small" onclick="InventoryManagement.showProcessPaymentModal(${item.id})" title="Process Payment">
                            <div class="icon icon--payment"></div>
                        </button>
                        <button class="btn btn--text-danger btn--small" onclick="InventoryManagement.deleteItem(${item.id})" title="Delete Item">
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
        const totalPages = Math.ceil(filteredInventory.length / pageSize);
        const paginationInfo = document.getElementById('pagination-info-text');
        const paginationNumbers = document.getElementById('pagination-numbers');
        const prevBtn = document.getElementById('prev-page-btn');
        const nextBtn = document.getElementById('next-page-btn');

        // Update info text
        const startIndex = (currentPage - 1) * pageSize + 1;
        const endIndex = Math.min(currentPage * pageSize, filteredInventory.length);
        
        if (paginationInfo) {
            paginationInfo.textContent = `Showing ${startIndex}-${endIndex} of ${filteredInventory.length} trailers`;
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
                        onclick="InventoryManagement.goToPage(${i})">
                    ${i}
                </button>
            `;
        }

        return html;
    }

    // Navigation functions
    function goToPage(page) {
        currentPage = page;
        renderInventoryTable();
    }

    function previousPage() {
        if (currentPage > 1) {
            currentPage--;
            renderInventoryTable();
        }
    }

    function nextPage() {
        const totalPages = Math.ceil(filteredInventory.length / pageSize);
        if (currentPage < totalPages) {
            currentPage++;
            renderInventoryTable();
        }
    }

    function changePageSize() {
        const pageSizeSelect = document.getElementById('page-size-select');
        pageSize = parseInt(pageSizeSelect.value);
        currentPage = 1;
        renderInventoryTable();
    }

    // Update statistics
    function updateStatistics() {
        const totalTrailers = inventoryData.length;
        const availableTrailers = inventoryData.filter(item => item.status === 'available').length;
        const soldTrailers = inventoryData.filter(item => item.status === 'sold').length;
        const reservedTrailers = inventoryData.filter(item => item.status === 'reserved').length;
        const totalValue = inventoryData.reduce((sum, item) => sum + item.selling_price, 0);
        const monthlyProfit = inventoryData.reduce((sum, item) => sum + item.profit_amount, 0);

        // Calculate percentages
        const availablePercentage = totalTrailers > 0 ? ((availableTrailers / totalTrailers) * 100).toFixed(1) : 0;
        const soldPercentage = totalTrailers > 0 ? ((soldTrailers / totalTrailers) * 100).toFixed(1) : 0;
        
        // Calculate total value percentage change (based on sold vs available ratio)
        const valuePercentage = totalTrailers > 0 ? ((soldTrailers / totalTrailers) * 100).toFixed(1) : 0;
        
        // Calculate profit margin percentage
        const totalCost = inventoryData.reduce((sum, item) => sum + (item.cost_price || 0), 0);
        const profitMarginPercentage = totalCost > 0 ? ((monthlyProfit / totalCost) * 100).toFixed(1) : 0;

        // Update main values (with null checks to prevent errors when called from other pages)
        const totalTrailersEl = document.getElementById('total-trailers');
        const availableTrailersEl = document.getElementById('available-trailers');
        const totalValueEl = document.getElementById('total-value');
        const monthlyProfitEl = document.getElementById('monthly-profit');
        
        if (totalTrailersEl) totalTrailersEl.textContent = totalTrailers;
        if (availableTrailersEl) availableTrailersEl.textContent = availableTrailers;
        if (totalValueEl) totalValueEl.textContent = formatCurrency(totalValue);
        if (monthlyProfitEl) monthlyProfitEl.textContent = formatCurrency(monthlyProfit);

        // Update percentages with colors and arrows (only if elements exist)
        if (document.getElementById('total-trailers-percentage')) {
            updatePercentageDisplay('total-trailers', soldPercentage);
            updatePercentageDisplay('available-trailers', availablePercentage);
            updatePercentageDisplay('total-value', valuePercentage);
            updatePercentageDisplay('monthly-profit', profitMarginPercentage);
        }
    }

    // Utility functions
    function showLoading(show) {
        const loadingElement = document.getElementById('inventory-loading');
        if (loadingElement) {
            loadingElement.style.display = show ? 'flex' : 'none';
        }
    }

    function getStatusChipClass(status) {
        switch (status) {
            case 'available': return 'chip--green';
            case 'sold': return 'chip--blue';
            case 'reserved': return 'chip--yellow';
            case 'maintenance': return 'chip--orange';
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

    function formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    function formatTrailerType(type) {
        // Since we're now storing the display names directly, just return the type
        return type || 'Unknown Type';
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
        if (window.currentPaymentItem) {
            window.currentPaymentItem = null;
        }
        if (window.currentViewingItem) {
            window.currentViewingItem = null;
        }
        if (window.currentDeletingItem) {
            window.currentDeletingItem = null;
        }
    }

    // Modal operations
    function showNewInventoryModal() {
        console.log('Show new inventory modal');
        
        // Reset form for new entry
        resetInventoryForm();
        
        // Set modal title
        document.getElementById('inventoryModalTitle').textContent = 'Add New Trailer';
        
        // Set current date as default
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('date_added').value = today;
        
        // Show modal
        const modal = document.getElementById('inventoryModal');
        if (modal) {
            modal.style.display = 'flex';
        }
    }
    
    function resetInventoryForm() {
        const form = document.getElementById('inventoryForm');
        if (form) {
            form.reset();
        }
        
        // Clear hidden ID field
        document.getElementById('trailer_id').value = '';
        
        // Clear stock_id field
        document.getElementById('stock_id').value = '';
        
        // Set default values
        document.getElementById('status').value = 'available';
        
        // Clear calculated fields
        document.getElementById('profit_amount').value = '';
        document.getElementById('profit_percentage').value = '';
        
        currentEditingItem = null;
    }
    
    function closeModal() {
        const modal = document.getElementById('inventoryModal');
        if (modal) {
            modal.style.display = 'none';
        }
        resetInventoryForm();
    }
    
    function handleSubmit(event) {
        event.preventDefault();
        
        const formData = new FormData(event.target);
        const trailerData = {};
        
        // Convert form data to object
        for (let [key, value] of formData.entries()) {
            trailerData[key] = value;
        }
        
        // Map trailer_type to category for API compatibility
        if (trailerData.trailer_type) {
            trailerData.category = trailerData.trailer_type;
        }
        if (trailerData.category) {
            trailerData.category = trailerData.category;
        }
        
        // Calculate profit if cost and selling prices are provided
        if (trailerData.cost_price && trailerData.selling_price) {
            const costPrice = parseFloat(trailerData.cost_price);
            const sellingPrice = parseFloat(trailerData.selling_price);
            const profitAmount = sellingPrice - costPrice;
            const profitPercentage = (profitAmount / costPrice) * 100;
            
            trailerData.profit_amount = profitAmount;
            trailerData.profit_percentage = profitPercentage;
        }
        
        // Add or update trailer
        if (trailerData.trailer_id) {
            // Update existing trailer
            updateTrailer(trailerData);
        } else {
            // Add new trailer
            addNewTrailer(trailerData);
        }
    }
    
    function addNewTrailer(trailerData) {
        trailerData.action = 'create';
        fetch('api/get_dealer_inventory.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(trailerData)
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                loadInventoryData();
                closeModal();
                const trailerInfo = `${trailerData.manufacturer} ${trailerData.model}${trailerData.year ? ` (${trailerData.year})` : ''}`;
                showSuccess(`Trailer added successfully! ${trailerInfo}`);
            } else {
                showError('Failed to add trailer: ' + (data.message || 'Unknown error'));
            }
        })
        .catch(err => showError('Error: ' + err));
    }
    
    function updateTrailer(trailerData) {
        trailerData.action = 'update';
        trailerData.id = Number(trailerData.trailer_id); // Ensure id is a number
        fetch('api/get_dealer_inventory.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(trailerData)
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                loadInventoryData();
                closeModal();
                const trailerInfo = `${trailerData.manufacturer} ${trailerData.model}${trailerData.year ? ` (${trailerData.year})` : ''}`;
                showSuccess(`Trailer updated successfully! ${trailerInfo}`);
            } else {
                showError('Failed to update trailer: ' + (data.message || 'Unknown error'));
            }
        })
        .catch(err => showError('Error: ' + err));
    }

    function editItem(itemId) {
        itemId = Number(itemId);
        const item = inventoryData.find(trailer => trailer.id == itemId);
        if (!item) {
            showError('Trailer not found!');
            return;
        }
        
        // Close view modal if it's open
        const viewModal = document.getElementById('viewTrailerModal');
        if (viewModal && viewModal.style.display !== 'none') {
            closeViewModal();
        }
        
        // Populate form with existing data
        document.getElementById('trailer_id').value = item.id;
        document.getElementById('stock_id').value = item.stock_id || '';
        document.getElementById('manufacturer').value = item.manufacturer;
        document.getElementById('model').value = item.model;
        document.getElementById('year').value = item.year;
        document.getElementById('category').value = item.category || item.type;
        document.getElementById('condition').value = item.condition;
        document.getElementById('color').value = item.color || '';
        document.getElementById('size').value = item.size || '';
        document.getElementById('cost_price').value = item.cost_price;
        document.getElementById('selling_price').value = item.selling_price;
        document.getElementById('status').value = item.status;
        document.getElementById('date_added').value = item.date_added;
        document.getElementById('description').value = item.description || '';
        
        // Calculate and display profit
        updateProfitCalculation();
        
        // Set modal title
        document.getElementById('inventoryModalTitle').textContent = 'Edit Trailer';
        
        // Store current editing item
        currentEditingItem = item;
        
        // Show modal
        const modal = document.getElementById('inventoryModal');
        if (modal) {
            modal.style.display = 'flex';
        }
    }
    
    function updateProfitCalculation() {
        const costPrice = parseFloat(document.getElementById('cost_price').value) || 0;
        const sellingPrice = parseFloat(document.getElementById('selling_price').value) || 0;
        
        if (costPrice > 0 && sellingPrice > 0) {
            const profitAmount = sellingPrice - costPrice;
            const profitPercentage = (profitAmount / costPrice) * 100;
            
            document.getElementById('profit_amount').value = formatCurrency(profitAmount);
            document.getElementById('profit_percentage').value = profitPercentage.toFixed(2) + '%';
        } else {
            document.getElementById('profit_amount').value = '';
            document.getElementById('profit_percentage').value = '';
        }
    }

    function viewItemDetails(itemId) {
        itemId = Number(itemId);
        const item = inventoryData.find(trailer => trailer.id == itemId);
        if (!item) {
            showError('Trailer not found!');
            return;
        }

        // Set modal title
        document.getElementById('viewTrailerModalTitle').textContent = `Trailer Details - Inventory ID # ${item.id}`;
        
        // Populate modal content
        const detailsContent = document.getElementById('trailer-details-content');
        detailsContent.innerHTML = `
            <div class="trailer-details">
                <div class="detail-section">
                    <h4>Basic Information</h4>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <label>Inventory ID:</label>
                            <span># ${item.id}</span>
                        </div>
                        <div class="detail-item">
                            <label>Stock #:</label>
                            <span>${item.stock_id || 'Not assigned'}</span>
                        </div>
                        <div class="detail-item">
                            <label>Manufacturer:</label>
                            <span>${item.manufacturer}</span>
                        </div>
                        <div class="detail-item">
                            <label>Model:</label>
                            <span>${item.model}</span>
                        </div>
                        <div class="detail-item">
                            <label>Year:</label>
                            <span>${item.year}</span>
                        </div>
                        <div class="detail-item">
                                            <label>Category:</label>
                <span>${item.category || item.type}</span>
                        </div>
                        <div class="detail-item">
                            <label>Condition:</label>
                            <span>${capitalizeFirst(item.condition)}</span>
                        </div>
                        <div class="detail-item">
                            <label>Color:</label>
                            <span>${item.color || 'Not specified'}</span>
                        </div>
                        <div class="detail-item">
                            <label>Size:</label>
                            <span>${item.size || 'Not specified'}</span>
                        </div>
                    </div>
                </div>
                
                <div class="detail-section">
                    <h4>Pricing & Financial</h4>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <label>Cost Price:</label>
                            <span>${formatCurrency(item.cost_price)}</span>
                        </div>
                        <div class="detail-item">
                            <label>Selling Price:</label>
                            <span><strong>${formatCurrency(item.selling_price)}</strong></span>
                        </div>
                        <div class="detail-item">
                            <label>Profit Amount:</label>
                            <span class="text-success"><strong>${formatCurrency(item.profit_amount)}</strong></span>
                        </div>
                        <div class="detail-item">
                            <label>Profit Percentage:</label>
                            <span>${item.profit_percentage.toFixed(1)}%</span>
                        </div>
                    </div>
                </div>
                
                <div class="detail-section">
                    <h4>Status & Timeline</h4>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <label>Status:</label>
                            <span>
                                <span class="chip ${getStatusChipClass(item.status)}">
                                    ${capitalizeFirst(item.status)}
                                </span>
                            </span>
                        </div>
                        <div class="detail-item">
                            <label>Date Added:</label>
                            <span>${formatDate(item.date_added)}</span>
                        </div>
                    </div>
                </div>
                
                ${item.description ? `
                <div class="detail-section">
                    <h4>Description</h4>
                    <p>${item.description}</p>
                </div>
                ` : ''}
            </div>
        `;

        // Store current viewing item for edit button
        window.currentViewingItem = item;
        
        // Show modal
        document.getElementById('viewTrailerModal').style.display = 'flex';
    }

    function closeViewModal() {
        document.getElementById('viewTrailerModal').style.display = 'none';
        window.currentViewingItem = null;
    }

    function deleteItem(itemId) {
        itemId = Number(itemId);
        const item = inventoryData.find(trailer => trailer.id == itemId);
        if (!item) {
            showError('Trailer not found!');
            return;
        }

        // Store current deleting item
        window.currentDeletingItem = item;
        
        // Populate delete modal with item info
        document.getElementById('delete-trailer-info').innerHTML = `
            <strong>Inventory ID:</strong> # ${item.id}<br>
            <strong>Stock #:</strong> ${item.stock_id || 'Not assigned'}<br>
            <strong>Trailer:</strong> ${item.manufacturer} ${item.model}<br>
            <strong>Year:</strong> ${item.year}<br>
            <strong>Price:</strong> ${formatCurrency(item.selling_price)}
        `;
        
        // Show delete confirmation modal
        document.getElementById('delete-trailer-modal').style.display = 'flex';
    }

    function closeDeleteModal() {
        document.getElementById('delete-trailer-modal').style.display = 'none';
        window.currentDeletingItem = null;
    }

    function confirmDeleteTrailer() {
        if (!window.currentDeletingItem) return;
        
        const trailerInfo = `${window.currentDeletingItem.manufacturer} ${window.currentDeletingItem.model} (ID: ${window.currentDeletingItem.id})`;
        
        fetch('api/get_dealer_inventory.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete', id: Number(window.currentDeletingItem.id) }) // Ensure id is a number
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                loadInventoryData();
                closeDeleteModal();
                showSuccess(`Trailer deleted successfully! (${trailerInfo})`);
            } else {
                showError('Failed to delete trailer: ' + (data.message || 'Unknown error'));
            }
        })
        .catch(err => showError('Error: ' + err));
    }

    function exportInventory() {
        console.log('Exporting inventory data...');
        
        // Prepare CSV headers
        const headers = [
            'Inventory ID',
            'Stock #',
            'Manufacturer',
            'Model',
            'Year',
            'Category',
            'Condition',
            'Color',
            'Size',
            'Cost Price',
            'Selling Price',
            'Profit Amount',
            'Profit %',
            'Status',
            'Date Added',
            'Description'
        ];
        
        // Prepare CSV data
        const csvData = filteredInventory.map(item => [
            `# ${item.id}`,
            item.stock_id || '',
            item.manufacturer,
            item.model,
            item.year,
            item.category || item.type,
            capitalizeFirst(item.condition),
            item.color || '',
            item.size || '',
            item.cost_price,
            item.selling_price,
            item.profit_amount,
            item.profit_percentage.toFixed(1),
            capitalizeFirst(item.status),
            formatDate(item.date_added),
            item.description || ''
        ]);

        // Create CSV content
        const csvContent = [headers, ...csvData]
            .map(row => row.map(cell => `"${cell}"`).join(','))
            .join('\n');

        // Download CSV file
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `inventory_export_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // Process Payment Modal Functions
    function showProcessPaymentModal(itemId) {
        itemId = Number(itemId);
        const item = inventoryData.find(trailer => trailer.id == itemId);
        if (!item) {
            console.error('Item not found:', itemId);
            return;
        }

        // Populate modal with item data
        document.getElementById('payment-trailer-info').innerHTML = `
            <div class="payment-trailer-details">
                <h4>ID# ${item.id} ${item.stock_id ? `- Stock# ${item.stock_id}` : ''} - ${item.manufacturer} ${item.model}</h4>
                <p class="trailer-description">${item.category || item.type} • ${item.size || 'N/A'} • ${item.color || 'N/A'} • ${capitalizeFirst(item.condition)}</p>
                <div class="payment-price">
                    <span class="price-label">Sale Price:</span>
                    <span class="price-value">${formatCurrency(item.selling_price)}</span>
                </div>
            </div>
        `;

        // Set default values
        document.getElementById('payment-sale-amount').textContent = formatCurrency(item.selling_price);
        document.getElementById('payment-processing-fee').textContent = '-' + formatCurrency(item.selling_price * 0.02);
        document.getElementById('payment-net-amount').textContent = formatCurrency(item.selling_price * 0.98);

        // Store current item for processing
        window.currentPaymentItem = item;

        // Show modal
        document.getElementById('process-payment-modal').style.display = 'flex';
    }

    function closeProcessPaymentModal() {
        document.getElementById('process-payment-modal').style.display = 'none';
        // Reset form
        document.getElementById('payment-customer-select').value = '';
        document.getElementById('payment-method-select').value = 'credit_card';
        window.currentPaymentItem = null;
    }

    function updatePaymentCalculation() {
        if (!window.currentPaymentItem) return;

        const saleAmount = window.currentPaymentItem.selling_price;
        const processingFee = saleAmount * 0.02; // 2% processing fee
        const netAmount = saleAmount - processingFee;

        document.getElementById('payment-sale-amount').textContent = formatCurrency(saleAmount);
        document.getElementById('payment-processing-fee').textContent = '-' + formatCurrency(processingFee);
        document.getElementById('payment-net-amount').textContent = formatCurrency(netAmount);
    }

    function processPayment() {
        if (!window.currentPaymentItem) {
            showError('No item selected for payment processing');
            return;
        }

        const customerSelect = document.getElementById('payment-customer-select');
        const paymentMethod = document.getElementById('payment-method-select').value;

        if (!customerSelect.value) {
            showError('Please select a customer');
            return;
        }

        // Simulate payment processing
        const processingOverlay = document.createElement('div');
        processingOverlay.className = 'payment-processing-overlay';
        processingOverlay.innerHTML = `
            <div class="processing-content">
                <div class="loading-spinner"></div>
                <p>Processing payment...</p>
            </div>
        `;
        document.body.appendChild(processingOverlay);

        // Simulate API call delay
        setTimeout(() => {
            document.body.removeChild(processingOverlay);
            
            // Update item status to sold
            const itemIndex = inventoryData.findIndex(item => item.id === window.currentPaymentItem.id);
            if (itemIndex !== -1) {
                inventoryData[itemIndex].status = 'sold';
                filteredInventory = [...inventoryData];
                renderInventoryTable();
                updateStatistics();
            }

            // Show success message
            showSuccess(`Payment processed successfully for # ${window.currentPaymentItem.id}!`);
            
            // Close modal
            closeProcessPaymentModal();
        }, 2000);
    }

    // Status Editor Functions
    function showStatusEditor(itemId, button) {
        // First close any other open dropdowns
        const allDropdowns = document.querySelectorAll('.status-dropdown');
        allDropdowns.forEach(dropdown => {
            dropdown.style.display = 'none';
        });
        
        const dropdown = document.getElementById(`status-dropdown-${itemId}`);
        if (dropdown) {
            dropdown.style.display = 'block';
            
            // On mobile, center the dropdown
            if (window.innerWidth <= 768) {
                dropdown.style.position = 'fixed';
                dropdown.style.top = '50%';
                dropdown.style.left = '50%';
                dropdown.style.transform = 'translate(-50%, -50%)';
                dropdown.style.right = 'auto';
            } else {
                // On desktop, position relative to container
                dropdown.style.position = 'absolute';
                dropdown.style.top = '50%';
                dropdown.style.right = '-200px';
                dropdown.style.transform = 'translateY(-50%)';
                dropdown.style.left = 'auto';
            }
        }
    }

    function updateStatus(itemId, newStatus) {
        const item = inventoryData.find(trailer => trailer.id == itemId);
        if (!item) {
            showError('Trailer not found!');
            return;
        }

        // Show loading state
        const dropdown = document.getElementById(`status-dropdown-${itemId}`);
        if (dropdown) {
            dropdown.innerHTML = '<div class="status-loading">Updating...</div>';
        }

        // Update status via API
        fetch('api/get_dealer_inventory.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                action: 'update_status', 
                id: Number(itemId), 
                status: newStatus 
            })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                // Update local data
                item.status = newStatus;
                filteredInventory = [...inventoryData];
                renderInventoryTable();
                updateStatistics();
                
                // Show success message briefly
                if (dropdown) {
                    dropdown.innerHTML = '<div class="status-success">Updated!</div>';
                    setTimeout(() => {
                        dropdown.style.display = 'none';
                    }, 1000);
                }
                
                // Show toast notification
                showSuccess(`Status updated to "${capitalizeFirst(newStatus)}" successfully`);
            } else {
                showError('Failed to update status: ' + (data.message || 'Unknown error'));
                // Close dropdown on error
                if (dropdown) {
                    dropdown.style.display = 'none';
                }
            }
        })
        .catch(err => {
            showError('Error updating status: ' + err);
            // Close dropdown on error
            if (dropdown) {
                dropdown.style.display = 'none';
            }
        });
    }

    function cancelStatusEdit(itemId) {
        const dropdown = document.getElementById(`status-dropdown-${itemId}`);
        if (dropdown) {
            dropdown.style.display = 'none';
        }
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
        showNewInventoryModal,
        editItem,
        viewItemDetails,
        closeViewModal,
        deleteItem,
        closeDeleteModal,
        confirmDeleteTrailer,
        exportInventory,
        showProcessPaymentModal,
        closeProcessPaymentModal,
        processPayment,
        updatePaymentCalculation,
        closeModal,
        handleSubmit,
        updateProfitCalculation,
        refreshInventory: function() {
            loadInventoryData();
        },
        showStatusEditor,
        updateStatus,
        cancelStatusEdit,
        // Test functions for notifications (can be called from console)
        testNotifications: function() {
            showSuccess('This is a test success notification!');
            setTimeout(() => showError('This is a test error notification!'), 1000);
            setTimeout(() => showWarning('This is a test warning notification!'), 2000);
        },
        // Direct access to notification functions for debugging
        showSuccess,
        showError,
        showWarning
    };
})();

// Global function for router compatibility
window.inventory = function() {
    InventoryManagement.init();
};


