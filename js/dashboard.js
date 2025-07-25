// Initialize namespace for dealerDashboard
window.dealerDashboard = window.dealerDashboard || {};

// Current dealer data
dealerDashboard.currentDealer = null;
dealerDashboard.currentSales = [];
dealerDashboard.currentInventory = [];
dealerDashboard.currentTransactions = [];

// Global init function that router expects
window.dealerDashboard = function () {
    // Wait for DOM to be ready
    setTimeout(() => {
        dealerDashboard.init();
    }, 100);
};

// Initialize the dealer dashboard page
dealerDashboard.init = function () {
    try {
        console.log('Initializing Dealer Dashboard...');
        console.log('DOM ready state:', document.readyState);
        console.log('Main content element:', document.querySelector('main'));
        
        // Get dealer ID from URL parameters
        const dealerId = window.DealerID;
        console.log('Dealer ID:', dealerId);

        if (!dealerId) {
            console.error('No dealer ID found in window.DealerID');
            dealerDashboard.showError('No dealer ID provided');
            return;
        }

        // Check if dashboard content exists
        const dashboardContent = document.querySelector('.dashboard-content') || document.querySelector('main');
        if (!dashboardContent) {
            console.error('Dashboard content container not found');
            dealerDashboard.showError('Dashboard content not loaded properly');
            return;
        }

        console.log('Loading dashboard data for dealer:', dealerId);
        
        // Hide loading overlay immediately since template is loaded
        dealerDashboard.hideLoading();
        
        // Load dealer data (each section will handle its own loading state)
        dealerDashboard.loadDealerData(dealerId);
        dealerDashboard.loadQuickStats(dealerId);
        dealerDashboard.loadInventoryOverview(dealerId);
        dealerDashboard.loadRecentTransactions(dealerId);
        dealerDashboard.loadRecentSales(dealerId);
        dealerDashboard.loadInventoryAlerts(dealerId);
        dealerDashboard.loadMonthlyProfitChart(dealerId);

    } catch (error) {
        console.error('Error initializing dealer dashboard:', error);
        dealerDashboard.hideLoading(); // Make sure to hide loading overlay on error
        dealerDashboard.showError('Failed to initialize dashboard: ' + error.message);
    }
};


// Load dealer basic information
dealerDashboard.loadDealerData = function (dealerId) {
    // Check if elements exist before trying to update them
    const dealerNameEl = document.getElementById('dealer-name');
    const dealerIdEl = document.getElementById('dealer-display-id');
    const dealerEmailEl = document.getElementById('dealer-email');
    const dealerPhoneEl = document.getElementById('dealer-phone');
    const dealerAddressEl = document.getElementById('dealer-address');
    const dealerSinceEl = document.getElementById('dealer-since');

    // Show loading state only if elements exist
    if (dealerNameEl) dealerNameEl.textContent = 'Loading Dealer...';
    if (dealerIdEl) dealerIdEl.textContent = '--';
    if (dealerEmailEl) dealerEmailEl.textContent = '--';
    if (dealerPhoneEl) dealerPhoneEl.textContent = '--';
    if (dealerAddressEl) dealerAddressEl.textContent = '--';
    if (dealerSinceEl) dealerSinceEl.textContent = '--';

    // Use real API call
    fetch(`api/dashboard.php?action=dealer_info&dealer_id=${dealerId}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                dealerDashboard.currentDealer = data.data;
                dealerDashboard.updateDealerInfo(data.data);
            } else {
                console.error('Failed to load dealer data:', data.error);
                // Fallback to basic info
                const fallbackData = {
                    id: dealerId,
                    name: 'Dealer Dashboard',
                    email: 'N/A',
                    phone: 'N/A',
                    address: 'N/A',
                    memberSince: new Date().toISOString().split('T')[0],
                    totalInventory: 0,
                    totalSales: 0,
                    totalRevenue: 0,
                    totalCustomers: 0
                };
                dealerDashboard.updateDealerInfo(fallbackData);
            }
        })
        .catch(error => {
            console.error('Error loading dealer data:', error);
            // Fallback to basic info
            const fallbackData = {
                id: dealerId,
                name: 'Dealer Dashboard',
                email: 'N/A',
                phone: 'N/A',
                address: 'N/A',
                memberSince: new Date().toISOString().split('T')[0],
                totalInventory: 0,
                totalSales: 0,
                totalRevenue: 0,
                totalCustomers: 0
            };
            dealerDashboard.updateDealerInfo(fallbackData);
        });
};

// Update dealer information in the UI
dealerDashboard.updateDealerInfo = function (dealer) {
    // Safely update elements only if they exist
    const dealerNameEl = document.getElementById('dealer-name');
    const dealerIdEl = document.getElementById('dealer-display-id');
    const dealerEmailEl = document.getElementById('dealer-email');
    const dealerPhoneEl = document.getElementById('dealer-phone');
    const dealerAddressEl = document.getElementById('dealer-address');
    const dealerSinceEl = document.getElementById('dealer-since');
    const totalInventoryEl = document.getElementById('total-inventory');
    const totalSalesEl = document.getElementById('total-sales');
    const totalRevenueEl = document.getElementById('total-revenue');
    const totalCustomersEl = document.getElementById('total-customers');

    if (dealerNameEl) dealerNameEl.textContent = dealer.name || 'N/A';
    if (dealerIdEl) dealerIdEl.textContent = dealer.id || 'N/A';
    if (dealerEmailEl) dealerEmailEl.textContent = dealer.email || 'N/A';
    if (dealerPhoneEl) dealerPhoneEl.textContent = dealer.phone || 'N/A';
    if (dealerAddressEl) dealerAddressEl.textContent = dealer.address || 'N/A';
    
    // Format member since date
    if (dealerSinceEl && dealer.memberSince) {
        const memberDate = new Date(dealer.memberSince);
        dealerSinceEl.textContent = memberDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    // Update header stats
    if (totalInventoryEl) totalInventoryEl.textContent = dealer.totalInventory || 0;
    if (totalSalesEl) totalSalesEl.textContent = dealer.totalSales || 0;
    if (totalRevenueEl) totalRevenueEl.textContent = dealerDashboard.formatCurrency(dealer.totalRevenue || 0);
    if (totalCustomersEl) totalCustomersEl.textContent = dealer.totalCustomers || 0;
};

// Load quick stats data
dealerDashboard.loadQuickStats = function (dealerId) {
    fetch(`api/dashboard.php?action=quick_stats&dealer_id=${dealerId}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const quickStats = data.data;
                const inStockEl = document.getElementById('in-stock-inventory');
                const pendingEl = document.getElementById('pending-inventory');
                const totalSalesYearEl = document.getElementById('total-sales-year');
                
                if (inStockEl) inStockEl.textContent = quickStats.inStockInventory;
                if (pendingEl) pendingEl.textContent = quickStats.pendingInventory;
                if (totalSalesYearEl) {
                    totalSalesYearEl.textContent = `${quickStats.totalSalesYear.count} | ${dealerDashboard.formatCurrency(quickStats.totalSalesYear.amount)}`;
                }
            } else {
                console.error('Failed to load quick stats:', data.error);
            }
        })
        .catch(error => {
            console.error('Error loading quick stats:', error);
        });
};

// Load inventory overview cards
dealerDashboard.loadInventoryOverview = function (dealerId) {
    fetch(`api/dashboard.php?action=inventory_overview&dealer_id=${dealerId}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const inventoryData = data.data;
                const totalInventoryEl = document.getElementById('total-inventory-count');
                const availableEl = document.getElementById('available-inventory');
                const inventoryValueEl = document.getElementById('inventory-value');
                const monthRevenueEl = document.getElementById('month-revenue');
                
                if (totalInventoryEl) totalInventoryEl.textContent = inventoryData.totalInventory;
                if (availableEl) availableEl.textContent = inventoryData.availableInventory;
                if (inventoryValueEl) inventoryValueEl.textContent = dealerDashboard.formatCurrency(inventoryData.inventoryValue);
                if (monthRevenueEl) monthRevenueEl.textContent = dealerDashboard.formatCurrency(inventoryData.monthRevenue);
            } else {
                console.error('Failed to load inventory overview:', data.error);
            }
        })
        .catch(error => {
            console.error('Error loading inventory overview:', error);
        });
};

// Load recent transactions
dealerDashboard.loadRecentTransactions = function (dealerId) {
    const transactionsList = document.getElementById('recent-transactions-list');
    
    if (!transactionsList) {
        console.warn('Recent transactions list element not found');
        return;
    }
    
    // Show loading state
    transactionsList.innerHTML = `
        <div class="transaction-item">
            <div class="transaction-info">
                <div class="transaction-customer">Loading transactions...</div>
                <div class="transaction-details">--</div>
            </div>
            <div class="transaction-amount">
                <div class="transaction-total">$0.00</div>
                <div class="transaction-fee">Fee: $0</div>
            </div>
        </div>
    `;

    fetch(`api/dashboard.php?action=recent_transactions&dealer_id=${dealerId}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                dealerDashboard.currentTransactions = data.data;
                dealerDashboard.updateTransactionsList(data.data);
            } else {
                console.error('Failed to load recent transactions:', data.error);
            }
        })
        .catch(error => {
            console.error('Error loading recent transactions:', error);
        });
};

// Update transactions list in UI
dealerDashboard.updateTransactionsList = function (transactions) {
    const transactionsList = document.getElementById('recent-transactions-list');
    
    if (transactions.length === 0) {
        transactionsList.innerHTML = `
            <div class="transaction-item">
                <div class="transaction-info">
                    <div class="transaction-customer">No recent transactions</div>
                    <div class="transaction-details">No transactions found</div>
                </div>
                <div class="transaction-amount">
                    <div class="transaction-total">$0.00</div>
                    <div class="transaction-fee">Fee: $0</div>
                </div>
            </div>
        `;
        return;
    }

    const transactionsHtml = transactions.map(transaction => `
        <div class="transaction-item">
            <div class="transaction-info">
                <div class="transaction-customer">${transaction.customer}</div>
                <div class="transaction-details">${transaction.id} • ${transaction.date}</div>
            </div>
            <div class="transaction-amount">
                <div class="transaction-total">${dealerDashboard.formatCurrency(transaction.amount)}</div>
                <div class="transaction-fee">Fee: ${dealerDashboard.formatCurrency(transaction.fee)}</div>
            </div>
        </div>
    `).join('');

    transactionsList.innerHTML = transactionsHtml;
};

// Load recent sales
dealerDashboard.loadRecentSales = function (dealerId) {
    const salesList = document.getElementById('recent-sales-summary');
    
    if (!salesList) {
        console.warn('Recent sales list element not found');
        return;
    }
    
    // Show loading state
    salesList.innerHTML = `
        <div class="sales-summary-item">
            <div class="sales-summary-info">
                <div class="sales-summary-customer">Loading sales...</div>
                <div class="sales-summary-date">--</div>
            </div>
            <div class="sales-summary-amount">$0.00</div>
        </div>
    `;

    fetch(`api/dashboard.php?action=recent_sales&dealer_id=${dealerId}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                dealerDashboard.currentSales = data.data;
                dealerDashboard.updateSalesList(data.data);
            } else {
                console.error('Failed to load recent sales:', data.error);
            }  
        })
        .catch(error => {
            console.error('Error loading recent sales:', error);
        });
};

// Update sales list in UI
dealerDashboard.updateSalesList = function (sales) {
    const salesList = document.getElementById('recent-sales-summary');
    
    if (sales.length === 0) {
        salesList.innerHTML = `
            <div class="sales-summary-item">
                <div class="sales-summary-info">
                    <div class="sales-summary-customer">No recent sales</div>
                    <div class="sales-summary-date">No sales found</div>
                </div>
                <div class="sales-summary-amount">$0.00</div>
            </div>
        `;
        return;
    }

    const salesHtml = sales.slice(0, 5).map(sale => `
        <div class="sales-summary-item">
            <div class="sales-summary-info">
                <div class="sales-summary-customer">${sale.customer}</div>
                <div class="sales-summary-date">${sale.date}</div>
            </div>
            <div class="sales-summary-amount">${dealerDashboard.formatCurrency(sale.amount)}</div>
        </div>
    `).join('');

    salesList.innerHTML = salesHtml;
};

// Load inventory alerts
dealerDashboard.loadInventoryAlerts = function (dealerId) {
    // This function can be called but doesn't need to update UI elements that might not exist
    fetch(`api/dashboard.php?action=inventory_alerts&dealer_id=${dealerId}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Handle alerts if needed
                console.log('Inventory alerts loaded:', data.data);
            } else {
                console.error('Failed to load inventory alerts:', data.error);
            }
        })
        .catch(error => {
            console.error('Error loading inventory alerts:', error);
        });
};

// Quick Actions Functions
dealerDashboard.addCustomer = function () {
    // Navigate to customers page or open add customer modal
    console.log('Add Customer clicked');
    // You can implement navigation or modal opening here
    alert('Add Customer functionality - to be implemented');
};

dealerDashboard.addNewTrailer = function () {
    // Navigate to inventory page or open add trailer modal
    console.log('Add New Trailer clicked');
    alert('Add New Trailer functionality - to be implemented');
};

dealerDashboard.createQuote = function () {
    // Navigate to quotes page or open create quote modal
    console.log('Create Quote clicked');
    alert('Create Quote functionality - to be implemented');
};

dealerDashboard.viewAllSales = function () {
    // Navigate to sales page
    console.log('View All Sales clicked');
    // You can use the router to navigate to sales page
    if (window.navigateTo) {
        window.navigateTo('sales');
    } else {
        alert('View All Sales functionality - to be implemented');
    }
};

// Modal Functions
dealerDashboard.closeSaleDetailsModal = function () {
    const modal = document.getElementById('sale-details-modal');
    if (modal) {
        modal.style.display = 'none';
    }
};

// Utility Functions
dealerDashboard.formatCurrency = function (amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    }).format(amount);
};

dealerDashboard.formatDate = function (dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
};

dealerDashboard.showError = function (message) {
    console.error('Dealer Dashboard Error:', message);
    
    // Show error in the main content area
    const mainContent = document.querySelector('main') || document.querySelector('.main-content') || document.body;
    if (mainContent) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.style.cssText = `
            background: #fee;
            border: 1px solid #fcc;
            color: #c66;
            padding: 15px;
            margin: 20px;
            border-radius: 5px;
            text-align: center;
        `;
        errorDiv.innerHTML = `
            <h3>Dashboard Error</h3>
            <p>${message}</p>
            <button onclick="location.reload()" style="margin-top: 10px; padding: 5px 15px; background: #c66; color: white; border: none; border-radius: 3px; cursor: pointer;">
                Reload Page
            </button>
        `;
        mainContent.appendChild(errorDiv);
    }
    
    // Also show an alert for immediate feedback
    alert('Dashboard Error: ' + message);
};

dealerDashboard.showLoading = function () {
    console.log('Showing loading overlay');
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'flex';
        loadingOverlay.classList.add('active');
        console.log('Loading overlay shown');
    } else {
        console.warn('Loading overlay element not found');
    }
};

dealerDashboard.hideLoading = function () {
    console.log('Hiding loading overlay');
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
        loadingOverlay.classList.remove('active');
        console.log('Loading overlay hidden');
    } else {
        console.warn('Loading overlay element not found');
    }
};

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function () {
    // Hide loading overlay after initial load
    setTimeout(() => {
        dealerDashboard.hideLoading();
    }, 2500);
});

// Dashboard Management Module
window.DashboardManagement = (function() {
    'use strict';

    // Private variables
    let dashboardData = {};
    let dealerId = 1; // This should be set from session or login

    // Initialize the dashboard
    function init() {
        console.log('Initializing Dashboard Management...');
        
        // Show loading overlay
        showLoading(true);
        
        // Load dashboard data from API
        loadDashboardData();
        
        // Setup event listeners
        setupEventListeners();
    }

    // Load all dashboard data from APIs
    function loadDashboardData() {
        // Load all data in parallel
        Promise.all([
            loadQuickStats(),
            loadInventoryOverview(),
            loadRecentTransactions(),
            loadRecentSales()
        ]).then(() => {
            // Hide loading overlay after all data loads
            showLoading(false);
        }).catch(error => {
            console.error('Error loading dashboard data:', error);
            showLoading(false);
        });
    }

    // Load Quick Stats from API
    function loadQuickStats() {
            return fetch(`api/dashboard.php?action=quick_stats&dealer_id=${dealerId}`)
        .then(response => response.json())
        .then(data => {
                if (data.success) {
                    updateQuickStats(data.data);
                } else {
                    console.error('Failed to load quick stats:', data.error);
                }
            })
            .catch(error => {
                console.error('Error loading quick stats:', error);
            });
    }

    // Load Inventory Overview from API
    function loadInventoryOverview() {
            return fetch(`api/dashboard.php?action=inventory_overview&dealer_id=${dealerId}`)
        .then(response => response.json())
        .then(data => {
                if (data.success) {
                    updateInventoryMetrics(data.data);
                } else {
                    console.error('Failed to load inventory overview:', data.error);
                }
            })
            .catch(error => {
                console.error('Error loading inventory overview:', error);
            });
    }

    // Load Recent Transactions from API
    function loadRecentTransactions() {
            return fetch(`api/dashboard.php?action=recent_transactions&dealer_id=${dealerId}`)
        .then(response => response.json())
        .then(data => {
                if (data.success) {
                    updateRecentTransactions(data.data);
                } else {
                    console.error('Failed to load recent transactions:', data.error);
                }
            })
            .catch(error => {
                console.error('Error loading recent transactions:', error);
            });
    }

    // Load Recent Sales from API
    function loadRecentSales() {
            return fetch(`api/dashboard.php?action=recent_sales&dealer_id=${dealerId}`)
        .then(response => response.json())
        .then(data => {
                if (data.success) {
                    updateRecentSales(data.data);
                } else {
                    console.error('Failed to load recent sales:', data.error);
                }
            })
            .catch(error => {
                console.error('Error loading recent sales:', error);
            });
    }

    // Setup event listeners
    function setupEventListeners() {
        // Add any global event listeners here
        console.log('Dashboard event listeners setup complete');
    }

    // Update Quick Stats section
    function updateQuickStats(stats) {
        document.getElementById('in-stock-inventory').textContent = stats.inStockInventory;
        document.getElementById('pending-inventory').textContent = stats.pendingInventory;
        document.getElementById('total-sales-year').textContent = 
            `${stats.totalSalesYear.count} | ${formatCurrency(stats.totalSalesYear.amount)}`;
    }

    // Update Inventory Metrics
    function updateInventoryMetrics(metrics) {
        document.getElementById('total-inventory-count').textContent = metrics.totalInventory;
        document.getElementById('available-inventory').textContent = metrics.availableInventory;
        document.getElementById('inventory-value').textContent = formatCurrency(metrics.inventoryValue);
        document.getElementById('month-revenue').textContent = formatCurrency(metrics.monthRevenue);
    }

    // Update Recent Transactions
    function updateRecentTransactions(transactions) {
        const transactionsList = document.getElementById('recent-transactions-list');
        
        if (transactions.length === 0) {
            transactionsList.innerHTML = `
                <div class="transaction-item">
                    <div class="transaction-info">
                        <div class="transaction-customer">No recent transactions</div>
                        <div class="transaction-details">No transactions found</div>
                    </div>
                    <div class="transaction-amount">
                        <div class="transaction-total">$0.00</div>
                        <div class="transaction-fee">Fee: $0</div>
                    </div>
                </div>
            `;
            return;
        }

        const transactionsHtml = transactions.map(transaction => `
            <div class="transaction-item">
                <div class="transaction-info">
                    <div class="transaction-customer">${transaction.customer}</div>
                    <div class="transaction-details">${transaction.id} • ${transaction.date}</div>
                </div>
                <div class="transaction-amount">
                    <div class="transaction-total">${formatCurrency(transaction.amount)}</div>
                    <div class="transaction-fee">Fee: ${formatCurrency(transaction.fee)}</div>
                </div>
            </div>
        `).join('');

        transactionsList.innerHTML = transactionsHtml;
    }

    // Update Recent Sales
    function updateRecentSales(sales) {
        const salesList = document.getElementById('recent-sales-summary');
        
        if (sales.length === 0) {
            salesList.innerHTML = `
                <div class="sales-summary-item">
                    <div class="sales-summary-info">
                        <div class="sales-summary-customer">No recent sales</div>
                        <div class="sales-summary-date">No sales found</div>
                    </div>
                    <div class="sales-summary-amount">$0.00</div>
                </div>
            `;
            return;
        }

        const salesHtml = sales.slice(0, 5).map(sale => `
            <div class="sales-summary-item">
                <div class="sales-summary-info">
                    <div class="sales-summary-customer">${sale.customer}</div>
                    <div class="sales-summary-date">${sale.date}</div>
                </div>
                <div class="sales-summary-amount">${formatCurrency(sale.amount)}</div>
            </div>
        `).join('');

        salesList.innerHTML = salesHtml;
    }

    // Quick Action Functions
    function addCustomer() {
        // Navigate to customers page and open add modal
        if (window.navigateTo) {
            window.navigateTo('customers');
            // Wait for page to load then open add customer modal
            setTimeout(() => {
                if (window.CustomersManagement && window.CustomersManagement.openAddCustomerModal) {
                    window.CustomersManagement.openAddCustomerModal();
                }
            }, 500);
        } else {
            showSuccessMessage('Add Customer functionality will be available when customers module is loaded.');
        }
    }

    function addNewTrailer() {
        // Navigate to inventory page and open add modal
        if (window.navigateTo) {
            window.navigateTo('inventory');
            // Wait for page to load then open add inventory modal
            setTimeout(() => {
                if (window.InventoryManagement && window.InventoryManagement.showNewInventoryModal) {
                    window.InventoryManagement.showNewInventoryModal();
                }
            }, 500);
        } else {
            showSuccessMessage('Add New Trailer functionality will be available when inventory module is loaded.');
        }
    }

    function createQuote() {
        // Navigate to quotes page and open add modal
        if (window.navigateTo) {
            window.navigateTo('quotes');
            // Wait for page to load then open add quote modal
            setTimeout(() => {
                if (window.QuotesManagement && window.QuotesManagement.openAddQuoteModal) {
                    window.QuotesManagement.openAddQuoteModal();
                }
            }, 500);
        } else {
            showSuccessMessage('Create Quote functionality will be available when quotes module is loaded.');
        }
    }

    // Utility Functions
    function showLoading(show) {
        const loadingElement = document.getElementById('loading-overlay');
        if (loadingElement) {
            if (show) {
                loadingElement.style.display = 'flex';
                loadingElement.classList.add('active');
            } else {
                loadingElement.style.display = 'none';
                loadingElement.classList.remove('active');
            }
        }
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

    function showSuccessMessage(message) {
        // You can implement a toast notification here
        console.log('Success:', message);
        // For now, just use alert
        alert(message);
    }

    function showError(message) {
        console.error('Dashboard Error:', message);
        alert('Error: ' + message);
    }

    // Refresh dashboard data
    function refreshDashboard() {
        showLoading(true);
        
        // Simulate API call to refresh data
        setTimeout(() => {
            loadDashboardData();
            showLoading(false);
            showSuccessMessage('Dashboard data refreshed successfully!');
        }, 1000);
    }

    // Public API
    return {
        init,
        addCustomer,
        addNewTrailer,
        createQuote,
        refreshDashboard,
        updateQuickStats,
        updateInventoryMetrics,
        updateRecentTransactions,
        updateRecentSales
    };
})();

// Load monthly profit chart
dealerDashboard.loadMonthlyProfitChart = function (dealerId) {
    fetch(`api/dashboard.php?action=monthly_profits&dealer_id=${dealerId}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                dealerDashboard.createProfitChart(data.data);
            } else {
                console.error('Failed to load monthly profits:', data.error);
            }
        })
        .catch(error => {
            console.error('Error loading monthly profits:', error);
        });
};

// Create profit chart
dealerDashboard.createProfitChart = function (monthlyData) {
    const chartCanvas = document.getElementById('sales-volume-chart');
    
    if (!chartCanvas) {
        console.warn('Sales volume chart canvas not found');
        return;
    }

    // Destroy existing chart if it exists
    if (dealerDashboard.profitChart) {
        dealerDashboard.profitChart.destroy();
    }

    const ctx = chartCanvas.getContext('2d');
    
    // Prepare data for Chart.js
    const labels = monthlyData.map(item => item.month_name.substring(0, 3)); // Jan, Feb, etc.
    const profits = monthlyData.map(item => item.profit);
    
    // Create gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.8)');
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0.1)');

    dealerDashboard.profitChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Monthly Profit',
                data: profits,
                borderColor: '#3b82f6',
                backgroundColor: gradient,
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#3b82f6',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 6,
                pointHoverRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    borderColor: '#3b82f6',
                    borderWidth: 1,
                    callbacks: {
                        label: function(context) {
                            return 'Profit: ' + dealerDashboard.formatCurrency(context.parsed.y);
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#6b7280'
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(107, 114, 128, 0.1)'
                    },
                    ticks: {
                        color: '#6b7280',
                        callback: function(value) {
                            return dealerDashboard.formatCurrency(value);
                        }
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    });
};
