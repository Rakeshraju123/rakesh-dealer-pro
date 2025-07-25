// Parts & Services Management Module
window.PartsServicesManagement = (function() {
    'use strict';

    // Private variables
    let itemsData = [];
    let filteredItems = [];
    let currentPage = 1;
    let pageSize = 10;
    let sortField = 'parts_id';
    let sortDirection = 'desc';
    let currentEditingItem = null;
    let currentDeletingItem = null;

    // Parts & services data will be loaded from API

    // Initialize the parts & services management module
    function init() {
        console.log('Initializing Parts & Services Management...');
        
        // Load items data
        loadItemsData();
        
        // Setup event listeners
        setupEventListeners();
        
        // Initial render with sorting
        applyInitialSort();
        renderItemsTable();
        updateStatistics();
    }

    // Load items data from API
    function loadItemsData() {
        showLoading(true);
        
        // Get current filters for API call
        const searchTerm = document.getElementById('parts-services-search')?.value || '';
        const typeFilter = document.getElementById('type-filter')?.value || '';
        const priceFilter = document.getElementById('price-filter')?.value || '';
        
        // Build API URL with parameters
        const params = new URLSearchParams({
            action: 'list',
            dealer_id: window.DealerID,
            page: currentPage,
            pageSize: pageSize,
            search: searchTerm,
            type: typeFilter,
            price_range: priceFilter,
            sort: sortField,
            direction: sortDirection
        });
        
        fetch(`${window.baseKeyword}api/parts-services.php?${params}`)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    itemsData = data.data.items || [];
                    filteredItems = [...itemsData];
                    
                    // Update pagination info from API
                    if (data.data.pagination) {
                        updatePaginationFromAPI(data.data.pagination);
                        renderItemsTableWithoutPagination(); // Don't call updatePagination again
                    } else {
                        // Fallback to local pagination if API doesn't provide pagination data
                        applyInitialSort();
                        renderItemsTable();
                    }
                    
                    loadStatistics();
                } else {
                    itemsData = [];
                    filteredItems = [];
                    console.error('Failed to load items:', data.error);
                    alert('Failed to load parts and services data');
                }
            })
            .catch(error => {
                console.error('Error loading items:', error);
                alert('Failed to connect to server');
            })
            .finally(() => {
                showLoading(false);
            });
    }

    // Load statistics from API
    function loadStatistics() {
        fetch(`${window.baseKeyword}api/parts-services.php?action=stats&dealer_id=${window.DealerID}`)
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
        // Update pagination variables from API response
        currentPage = paginationData.current_page || 1;
        pageSize = paginationData.page_size || 10;
        
        // Update pagination display
        const totalPages = paginationData.total_pages || 0;
        const totalItems = paginationData.total_items || 0;
        
        const paginationInfo = document.getElementById('pagination-info-text');
        const paginationNumbers = document.getElementById('pagination-numbers');
        const prevBtn = document.getElementById('prev-page-btn');
        const nextBtn = document.getElementById('next-page-btn');
        const paginationContainer = document.getElementById('parts-services-pagination');

        // Show pagination container if there are items
        if (paginationContainer) {
            paginationContainer.style.display = totalItems > 0 ? 'flex' : 'none';
        }

        // Update info text
        const startIndex = totalItems > 0 ? ((currentPage - 1) * pageSize) + 1 : 0;
        const endIndex = Math.min(currentPage * pageSize, totalItems);
        
        if (paginationInfo) {
            paginationInfo.textContent = totalItems > 0 ? 
                `Showing ${startIndex}-${endIndex} of ${totalItems} items` : 
                'Showing 0 of 0 items';
        }

        // Update pagination buttons
        if (prevBtn) {
            prevBtn.disabled = !paginationData.has_prev || currentPage <= 1;
        }
        
        if (nextBtn) {
            nextBtn.disabled = !paginationData.has_next || currentPage >= totalPages;
        }

        // Update page numbers
        if (paginationNumbers) {
            paginationNumbers.innerHTML = totalPages > 1 ? 
                generatePageNumbers(currentPage, totalPages) : '';
        }
    }

    // Update statistics from API response with percentages
    function updateStatisticsFromAPI(statsData) {
        // Update main values
        document.getElementById('total-items-count').textContent = statsData.total_items || 0;
        document.getElementById('products-count').textContent = statsData.products_count || 0;
        document.getElementById('services-count').textContent = statsData.services_count || 0;
        document.getElementById('total-value-amount').textContent = formatCurrency(statsData.total_value || 0);

        // Calculate percentages for display
        const totalItems = statsData.total_items || 0;
        const productsCount = statsData.products_count || 0;
        const servicesCount = statsData.services_count || 0;
        
        // Calculate real percentages based on actual data
        const productRate = totalItems > 0 ? ((productsCount / totalItems) * 100).toFixed(1) : 0;
        const serviceRate = totalItems > 0 ? ((servicesCount / totalItems) * 100).toFixed(1) : 0;
        
        // Growth percentages - these would be calculated based on previous period data
        const itemsGrowthRate = "0.0";
        
        // Value growth percentage
        const valueGrowthRate = "0.0";

        // Update percentages with colors and arrows
        updatePercentageDisplay('total-items', itemsGrowthRate);
        updatePercentageDisplay('products', productRate);
        updatePercentageDisplay('services', serviceRate);
        updatePercentageDisplay('total-value', valueGrowthRate);
    }

    // Apply initial sort
    function applyInitialSort() {
        filteredItems.sort((a, b) => {
            let aVal = a[sortField];
            let bVal = b[sortField];

            // Handle numeric fields
            if (sortField === 'parts_id' || sortField === 'price' || sortField === 'cost') {
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

    // Handle search functionality
    function handleSearch() {
        currentPage = 1; // Reset to first page when searching
        loadItemsData(); // Reload data from server with search parameters
    }

    // Handle filter functionality
    function handleFilter() {
        currentPage = 1; // Reset to first page when filtering
        loadItemsData(); // Reload data from server with filter parameters
    }

    // Apply all filters and search (now reloads from server)
    function applyFilters() {
        currentPage = 1; // Reset to first page
        loadItemsData(); // Reload data from server with all parameters
    }

    // Apply current sort to filtered items
    function applySortToFiltered() {
        filteredItems.sort((a, b) => {
            let aVal = a[sortField];
            let bVal = b[sortField];

            // Handle numeric fields
            if (sortField === 'parts_id' || sortField === 'price' || sortField === 'cost') {
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
        document.getElementById('parts-services-search').value = '';
        document.getElementById('type-filter').value = '';
        document.getElementById('price-filter').value = '';
        
        currentPage = 1;
        loadItemsData(); // Reload data from server without filters
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
        loadItemsData();
    }

    // Update table header sorting visual feedback
    function updateTableHeaderSorting(field, direction) {
        // Remove all existing sort classes
        const headers = document.querySelectorAll('.table th');
        headers.forEach(header => {
            header.classList.remove('sort-asc', 'sort-desc');
        });

        // Add sort class to current field
        const currentHeader = document.querySelector(`th[onclick="PartsServicesManagement.sortTable('${field}')"]`);
        
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

    // Setup event listeners
    function setupEventListeners() {
        // Search functionality
        const searchInput = document.getElementById('parts-services-search');
        if (searchInput) {
            searchInput.addEventListener('input', debounce(handleSearch, 300));
        }

        // Filter functionality
        const typeFilter = document.getElementById('type-filter');
        const priceFilter = document.getElementById('price-filter');
        
        if (typeFilter) {
            typeFilter.addEventListener('change', handleFilter);
        }
        
        if (priceFilter) {
            priceFilter.addEventListener('change', handleFilter);
        }

        // Modal close events
        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('modal-overlay')) {
                closeAllModals();
            }
        });
    }

    // Render items table
    function renderItemsTable() {
        const tableBody = document.getElementById('parts-services-table-body');
        const emptyState = document.getElementById('parts-services-empty-state');
        
        if (!tableBody) return;

        // Calculate pagination
        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const paginatedItems = filteredItems.slice(startIndex, endIndex);

        // Show empty state if no items
        if (filteredItems.length === 0) {
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

        // Render items
        tableBody.innerHTML = paginatedItems.map(item => `
            <tr>
                <td><strong>${item.name}</strong></td>
                <td>${item.sku}</td>
                <td>
                    <span class="chip chip--${item.type}">
                        ${capitalizeFirst(item.type)}
                    </span>
                </td>
                <td><strong class="text-success">${formatCurrency(item.price)}</strong></td>
                <td>${formatCurrency(item.cost)}</td>
                <td class="cell-icon">
                    <div class="table__actions">
                        <button class="btn btn--text btn--small" onclick="PartsServicesManagement.viewItemDetails(${item.parts_id})" title="View Details">
                            <div class="icon icon--eye"></div>
                        </button>
                        <button class="btn btn--text btn--small" onclick="PartsServicesManagement.editItem(${item.parts_id})" title="Edit Item">
                            <div class="icon icon--pen-to-square"></div>
                        </button>
                        <button class="btn btn--text-danger btn--small" onclick="PartsServicesManagement.deleteItem(${item.parts_id})" title="Delete Item">
                            <div class="icon icon--trash"></div>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

        updatePagination();
    }

    // Render items table without updating pagination (used when API provides pagination data)
    function renderItemsTableWithoutPagination() {
        const tableBody = document.getElementById('parts-services-table-body');
        const emptyState = document.getElementById('parts-services-empty-state');
        
        if (!tableBody) return;

        // Show empty state if no items
        if (filteredItems.length === 0) {
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

        // Render all items (API already handles pagination)
        tableBody.innerHTML = filteredItems.map(item => `
            <tr>
                <td><strong>${item.name}</strong></td>
                <td>${item.sku}</td>
                <td>
                    <span class="chip chip--${item.type}">
                        ${capitalizeFirst(item.type)}
                    </span>
                </td>
                <td><strong class="text-success">${formatCurrency(item.price)}</strong></td>
                <td>${formatCurrency(item.cost)}</td>
                <td class="cell-icon">
                    <div class="table__actions">
                        <button class="btn btn--text btn--small" onclick="PartsServicesManagement.viewItemDetails(${item.parts_id})" title="View Details">
                            <div class="icon icon--eye"></div>
                        </button>
                        <button class="btn btn--text btn--small" onclick="PartsServicesManagement.editItem(${item.parts_id})" title="Edit Item">
                            <div class="icon icon--pen-to-square"></div>
                        </button>
                        <button class="btn btn--text-danger btn--small" onclick="PartsServicesManagement.deleteItem(${item.parts_id})" title="Delete Item">
                            <div class="icon icon--trash"></div>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    // Update pagination
    function updatePagination() {
        const totalPages = Math.ceil(filteredItems.length / pageSize);
        const paginationInfo = document.getElementById('pagination-info-text');
        const paginationNumbers = document.getElementById('pagination-numbers');
        const prevBtn = document.getElementById('prev-page-btn');
        const nextBtn = document.getElementById('next-page-btn');
        const paginationContainer = document.getElementById('parts-services-pagination');

        // Show pagination container if there are items
        if (paginationContainer) {
            paginationContainer.style.display = filteredItems.length > 0 ? 'flex' : 'none';
        }

        // Update info text
        const startIndex = filteredItems.length > 0 ? (currentPage - 1) * pageSize + 1 : 0;
        const endIndex = Math.min(currentPage * pageSize, filteredItems.length);
        
        if (paginationInfo) {
            paginationInfo.textContent = filteredItems.length > 0 ? 
                `Showing ${startIndex}-${endIndex} of ${filteredItems.length} items` : 
                'Showing 0 of 0 items';
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
            paginationNumbers.innerHTML = totalPages > 1 ? 
                generatePageNumbers(currentPage, totalPages) : '';
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
                        onclick="PartsServicesManagement.goToPage(${i})">
                    ${i}
                </button>
            `;
        }

        return html;
    }

    // Navigation functions
    function goToPage(page) {
        currentPage = page;
        loadItemsData();
    }

    function previousPage() {
        if (currentPage > 1) {
            currentPage--;
            loadItemsData();
        }
    }

    function nextPage() {
            currentPage++;
        loadItemsData();
    }

    function changePageSize() {
        const newPageSize = parseInt(document.getElementById('page-size-select').value);
        pageSize = newPageSize;
        currentPage = 1;
        loadItemsData();
    }

    // Update statistics (deprecated - now loaded from API)
    function updateStatistics() {
        // This function is now handled by loadStatistics() and updateStatisticsFromAPI()
        // Keeping for backward compatibility
        loadStatistics();
    }

    // Utility functions
    function showLoading(show) {
        const loadingElement = document.getElementById('parts-services-loading');
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

    function capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
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
        currentEditingItem = null;
        currentDeletingItem = null;
    }

    // Modal operations
    function openAddItemModal() {
        currentEditingItem = null;
        document.getElementById('item-modal-title').textContent = 'Add New Part/Service';
        document.getElementById('save-item-btn-text').textContent = 'Save Item';
        clearItemForm();
        document.getElementById('item-modal').style.display = 'flex';
    }

    function editItem(itemId) {
        const item = itemsData.find(i => i.parts_id === itemId);
        if (!item) return;

        currentEditingItem = item;
        document.getElementById('item-modal-title').textContent = 'Edit Item';
        document.getElementById('save-item-btn-text').textContent = 'Update Item';
        populateItemForm(item);
        document.getElementById('item-modal').style.display = 'flex';
    }

    function closeItemModal() {
        document.getElementById('item-modal').style.display = 'none';
        currentEditingItem = null;
        clearItemForm();
    }

    function populateItemForm(item) {
        document.getElementById('item-name').value = item.name;
        document.getElementById('item-sku').value = item.sku;
        document.getElementById('item-type').value = item.type;
        document.getElementById('item-price').value = item.price;
        document.getElementById('item-cost').value = item.cost;
        document.getElementById('item-description').value = item.description || '';
        document.getElementById('item-notes').value = item.notes || '';
    }

    function clearItemForm() {
        document.getElementById('item-form').reset();
    }

    function saveItem() {
        const formData = {
            name: document.getElementById('item-name').value,
            sku: document.getElementById('item-sku').value,
            type: document.getElementById('item-type').value,
            price: parseFloat(document.getElementById('item-price').value),
            cost: parseFloat(document.getElementById('item-cost').value),
            description: document.getElementById('item-description').value,
            notes: document.getElementById('item-notes').value
        };

        // Validate required fields
        if (!formData.name || !formData.sku || !formData.type || isNaN(formData.price) || isNaN(formData.cost)) {
            alert('Please fill in all required fields with valid values.');
            return;
        }

        const isEditing = currentEditingItem !== null;
        const url = isEditing ? 
            `${window.baseKeyword}api/parts-services.php?action=update&dealer_id=${window.DealerID}&id=${currentEditingItem.parts_id}` : 
            `${window.baseKeyword}api/parts-services.php?action=create&dealer_id=${window.DealerID}`;
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
                loadItemsData();
                closeItemModal();
                
                // Show success message
                alert(data.message || (isEditing ? 'Item updated successfully!' : 'Item created successfully!'));
            } else {
                alert(data.error || 'Failed to save item');
            }
        })
        .catch(error => {
            console.error('API Error:', error);
            alert('Failed to connect to server');
        });
    }

    // Item details modal
    function viewItemDetails(itemId) {
        const item = itemsData.find(i => i.parts_id === itemId);
        if (!item) return;

        document.getElementById('item-details-title').textContent = `Item Details - ${item.name}`;
        
        const detailsContent = document.getElementById('item-details-content');
        const profitMargin = ((item.price - item.cost) / item.price * 100).toFixed(1);
        
        detailsContent.innerHTML = `
            <div class="item-details-grid">
                <div class="item-detail-section">
                    <h4>Basic Information</h4>
                    <div class="detail-row">
                        <span class="detail-label">Name:</span>
                        <span class="detail-value">${item.name}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">SKU:</span>
                        <span class="detail-value">${item.sku}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Type:</span>
                        <span class="detail-value">
                            <span class="chip chip--${item.type}">
                                ${capitalizeFirst(item.type)}
                            </span>
                        </span>
                    </div>
                </div>
                
                <div class="item-detail-section">
                    <h4>Pricing Information</h4>
                    <div class="detail-row">
                        <span class="detail-label">Price:</span>
                        <span class="detail-value"><strong>${formatCurrency(item.price)}</strong></span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Cost:</span>
                        <span class="detail-value">${formatCurrency(item.cost)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Profit:</span>
                        <span class="detail-value text-success"><strong>${formatCurrency(item.price - item.cost)}</strong></span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Margin:</span>
                        <span class="detail-value text-success"><strong>${profitMargin}%</strong></span>
                    </div>
                </div>
                
                ${item.description ? `
                <div class="item-detail-section">
                    <h4>Description</h4>
                    <div class="detail-notes">${item.description}</div>
                </div>
                ` : ''}
                
                ${item.notes ? `
                <div class="item-detail-section">
                    <h4>Notes</h4>
                    <div class="detail-notes">${item.notes}</div>
                </div>
                ` : ''}
            </div>
        `;

        document.getElementById('item-details-modal').style.display = 'flex';
    }

    function closeItemDetailsModal() {
        document.getElementById('item-details-modal').style.display = 'none';
    }

    function printItemDetails() {
        window.print();
    }

    // Delete item functions
    function deleteItem(itemId) {
        const item = itemsData.find(i => i.parts_id === itemId);
        if (!item) return;

        currentDeletingItem = item;
        document.getElementById('delete-item-info').innerHTML = `
            <strong>Item Name:</strong> ${item.name}<br>
            <strong>SKU:</strong> ${item.sku}<br>
            <strong>Price:</strong> ${formatCurrency(item.price)}
        `;
        
        document.getElementById('delete-item-modal').style.display = 'flex';
    }

    function closeDeleteModal() {
        document.getElementById('delete-item-modal').style.display = 'none';
        currentDeletingItem = null;
    }

    function confirmDeleteItem() {
        if (!currentDeletingItem) return;

        const url = `${window.baseKeyword}api/parts-services.php?action=delete&dealer_id=${window.DealerID}&id=${currentDeletingItem.parts_id}`;

        fetch(url, {
            method: 'DELETE'
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                closeDeleteModal();
                loadItemsData(); // Reload data from server
                alert(data.message || 'Item deleted successfully!');
            } else {
                alert(data.error || 'Failed to delete item');
            }
        })
        .catch(error => {
            console.error('Error deleting item:', error);
            alert('Error deleting item. Please try again.');
        });
    }

    function exportPartsServices() {
        console.log('Exporting parts & services data...');
        
        // Prepare CSV headers
        const headers = [
            'Name',
            'SKU',
            'Type',
            'Price',
            'Cost',
            'Profit',
            'Margin %',
            'Description',
            'Notes'
        ];
        
        // Prepare CSV data
        const csvData = filteredItems.map(item => {
            const profit = item.price - item.cost;
            const margin = ((profit / item.price) * 100).toFixed(1);
            
            return [
                item.name,
                item.sku,
                capitalizeFirst(item.type),
                item.price,
                item.cost,
                profit,
                margin,
                item.description || '',
                item.notes || ''
            ];
        });
        
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
        link.setAttribute('download', `parts_services_export_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        alert('Parts & Services data exported successfully!');
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
        openAddItemModal,
        editItem,
        closeItemModal,
        saveItem,
        viewItemDetails,
        closeItemDetailsModal,
        printItemDetails,
        deleteItem,
        closeDeleteModal,
        confirmDeleteItem,
        exportPartsServices
    };
})();

// Global function for router compatibility
window.partsServices = function() {
    PartsServicesManagement.init();
}; 