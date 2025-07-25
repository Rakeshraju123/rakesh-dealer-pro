// Reports Management Module
window.ReportsManagement = (function() {
    'use strict';

    // Private variables
    let currentDateRange = {
        start: null,
        end: null
    };
    let reportData = {};
    let currentReportType = null;

    // Initialize the reports management module
    function init() {
        console.log('Initializing Reports Management...');
        
        // Set default date range (last 30 days)
        setDefaultDateRange();
        
        // Load initial data
        loadReportData();
        
        // Setup event listeners
        setupEventListeners();
    }

    // Set default date range
    function setDefaultDateRange() {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        
        currentDateRange.start = startDate;
        currentDateRange.end = endDate;
        
        // Update form inputs
        document.getElementById('report-start-date').value = formatDateForInput(startDate);
        document.getElementById('report-end-date').value = formatDateForInput(endDate);
    }

    // Setup event listeners
    function setupEventListeners() {
        // Date range inputs
        const startDateInput = document.getElementById('report-start-date');
        const endDateInput = document.getElementById('report-end-date');
        
        if (startDateInput) {
            startDateInput.addEventListener('change', updateDateRange);
        }
        
        if (endDateInput) {
            endDateInput.addEventListener('change', updateDateRange);
        }

        // Modal close events
        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('modal-overlay')) {
                closeAllModals();
            }
        });
    }

    // Update date range from inputs
    function updateDateRange() {
        const startDate = document.getElementById('report-start-date').value;
        const endDate = document.getElementById('report-end-date').value;
        
        if (startDate && endDate) {
            currentDateRange.start = new Date(startDate);
            currentDateRange.end = new Date(endDate);
            
            // Reset period select
            document.getElementById('report-period').value = '';
        }
    }

    // Set predefined date ranges
    function setDateRange() {
        const period = document.getElementById('report-period').value;
        const today = new Date();
        let startDate, endDate;

        switch (period) {
            case 'today':
                startDate = new Date(today);
                endDate = new Date(today);
                break;
            case 'yesterday':
                startDate = new Date(today);
                startDate.setDate(today.getDate() - 1);
                endDate = new Date(startDate);
                break;
            case 'this-week':
                startDate = new Date(today);
                startDate.setDate(today.getDate() - today.getDay());
                endDate = new Date(today);
                break;
            case 'last-week':
                startDate = new Date(today);
                startDate.setDate(today.getDate() - today.getDay() - 7);
                endDate = new Date(startDate);
                endDate.setDate(startDate.getDate() + 6);
                break;
            case 'this-month':
                startDate = new Date(today.getFullYear(), today.getMonth(), 1);
                endDate = new Date(today);
                break;
            case 'last-month':
                startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                endDate = new Date(today.getFullYear(), today.getMonth(), 0);
                break;
            case 'this-quarter':
                const quarter = Math.floor(today.getMonth() / 3);
                startDate = new Date(today.getFullYear(), quarter * 3, 1);
                endDate = new Date(today);
                break;
            case 'this-year':
                startDate = new Date(today.getFullYear(), 0, 1);
                endDate = new Date(today);
                break;
            default:
                return;
        }

        currentDateRange.start = startDate;
        currentDateRange.end = endDate;

        // Update form inputs
        document.getElementById('report-start-date').value = formatDateForInput(startDate);
        document.getElementById('report-end-date').value = formatDateForInput(endDate);
    }

    // Apply filters and reload data
    function applyFilters() {
        updateDateRange();
        loadReportData();
        showSuccessMessage('Filters applied successfully!');
    }

    // Reset filters to default
    function resetFilters() {
        setDefaultDateRange();
        document.getElementById('report-period').value = 'this-month';
        loadReportData();
        showSuccessMessage('Filters reset to default!');
    }

    // Load report data (simulate API calls)
    function loadReportData() {
        showLoading(true);
        
        // Simulate API delay
        setTimeout(() => {
            // Generate mock data based on date range
            reportData = generateMockReportData();
            updateReportCards();
            showLoading(false);
        }, 1000);
    }

    // Generate mock report data
    function generateMockReportData() {
        const daysDiff = Math.ceil((currentDateRange.end - currentDateRange.start) / (1000 * 60 * 60 * 24));
        const multiplier = Math.max(1, daysDiff / 30); // Scale based on date range
        
        return {
            sales: {
                totalCount: Math.floor(45 * multiplier),
                totalRevenue: Math.floor(125000 * multiplier),
                avgValue: Math.floor(2777 * multiplier),
                completedSales: Math.floor(32 * multiplier),
                pendingSales: Math.floor(13 * multiplier)
            },
            inventory: {
                totalItems: 156,
                lowStock: 12,
                totalValue: Math.floor(450000 * multiplier),
                outOfStock: 3,
                categories: 8
            },
            customers: {
                totalCount: Math.floor(89 * multiplier),
                activeCount: Math.floor(67 * multiplier),
                avgSpent: Math.floor(1850 * multiplier),
                newCustomers: Math.floor(8 * multiplier),
                returningCustomers: Math.floor(59 * multiplier)
            },
            financial: {
                revenue: Math.floor(125000 * multiplier),
                expenses: Math.floor(78000 * multiplier),
                profit: Math.floor(47000 * multiplier),
                profitMargin: 37.6,
                taxesPaid: Math.floor(12000 * multiplier)
            },
            transactions: {
                totalCount: Math.floor(156 * multiplier),
                totalAmount: Math.floor(98500 * multiplier),
                avgAmount: Math.floor(631 * multiplier),
                successfulTransactions: Math.floor(148 * multiplier),
                failedTransactions: Math.floor(8 * multiplier)
            },
            performance: {
                growthRate: 12.5,
                conversion: 23.8,
                roi: 45.2,
                customerSatisfaction: 94.5,
                repeatCustomerRate: 68.3
            }
        };
    }

    // Update report cards with current data
    function updateReportCards() {
        // Sales Report
        document.getElementById('sales-total-count').textContent = reportData.sales.totalCount;
        document.getElementById('sales-total-revenue').textContent = formatCurrency(reportData.sales.totalRevenue);
        document.getElementById('sales-avg-value').textContent = formatCurrency(reportData.sales.avgValue);

        // Inventory Report
        document.getElementById('inventory-total-items').textContent = reportData.inventory.totalItems;
        document.getElementById('inventory-low-stock').textContent = reportData.inventory.lowStock;
        document.getElementById('inventory-total-value').textContent = formatCurrency(reportData.inventory.totalValue);

        // Customer Report
        document.getElementById('customers-total-count').textContent = reportData.customers.totalCount;
        document.getElementById('customers-active-count').textContent = reportData.customers.activeCount;
        document.getElementById('customers-avg-spent').textContent = formatCurrency(reportData.customers.avgSpent);

        // Financial Report
        document.getElementById('financial-revenue').textContent = formatCurrency(reportData.financial.revenue);
        document.getElementById('financial-expenses').textContent = formatCurrency(reportData.financial.expenses);
        document.getElementById('financial-profit').textContent = formatCurrency(reportData.financial.profit);

        // Transaction Report
        document.getElementById('transactions-total-count').textContent = reportData.transactions.totalCount;
        document.getElementById('transactions-total-amount').textContent = formatCurrency(reportData.transactions.totalAmount);
        document.getElementById('transactions-avg-amount').textContent = formatCurrency(reportData.transactions.avgAmount);

        // Performance Report
        document.getElementById('performance-growth-rate').textContent = reportData.performance.growthRate + '%';
        document.getElementById('performance-conversion').textContent = reportData.performance.conversion + '%';
        document.getElementById('performance-roi').textContent = reportData.performance.roi + '%';
    }

    // View detailed report
    function viewReport(reportType) {
        currentReportType = reportType;
        const reportTitle = getReportTitle(reportType);
        
        document.getElementById('report-details-title').textContent = `${reportTitle} - Detailed View`;
        
        const detailsContent = document.getElementById('report-details-content');
        detailsContent.innerHTML = generateReportDetailsHTML(reportType);
        
        document.getElementById('report-details-modal').style.display = 'flex';
    }

    // Generate report details HTML
    function generateReportDetailsHTML(reportType) {
        const data = reportData[reportType];
        const dateRangeText = `${formatDate(currentDateRange.start)} - ${formatDate(currentDateRange.end)}`;
        
        let html = `
            <div class="report-summary">
                <h4>${getReportTitle(reportType)} Summary</h4>
                <p class="text-muted">Report Period: ${dateRangeText}</p>
                <div class="summary-stats">
        `;

        // Generate summary stats based on report type
        switch (reportType) {
            case 'sales':
                html += `
                    <div class="summary-stat">
                        <div class="summary-stat-value">${data.totalCount}</div>
                        <div class="summary-stat-label">Total Sales</div>
                    </div>
                    <div class="summary-stat">
                        <div class="summary-stat-value">${formatCurrency(data.totalRevenue)}</div>
                        <div class="summary-stat-label">Revenue</div>
                    </div>
                    <div class="summary-stat">
                        <div class="summary-stat-value">${data.completedSales}</div>
                        <div class="summary-stat-label">Completed</div>
                    </div>
                    <div class="summary-stat">
                        <div class="summary-stat-value">${data.pendingSales}</div>
                        <div class="summary-stat-label">Pending</div>
                    </div>
                `;
                break;
            case 'inventory':
                html += `
                    <div class="summary-stat">
                        <div class="summary-stat-value">${data.totalItems}</div>
                        <div class="summary-stat-label">Total Items</div>
                    </div>
                    <div class="summary-stat">
                        <div class="summary-stat-value">${formatCurrency(data.totalValue)}</div>
                        <div class="summary-stat-label">Total Value</div>
                    </div>
                    <div class="summary-stat">
                        <div class="summary-stat-value">${data.lowStock}</div>
                        <div class="summary-stat-label">Low Stock</div>
                    </div>
                    <div class="summary-stat">
                        <div class="summary-stat-value">${data.outOfStock}</div>
                        <div class="summary-stat-label">Out of Stock</div>
                    </div>
                `;
                break;
            case 'customers':
                html += `
                    <div class="summary-stat">
                        <div class="summary-stat-value">${data.totalCount}</div>
                        <div class="summary-stat-label">Total Customers</div>
                    </div>
                    <div class="summary-stat">
                        <div class="summary-stat-value">${data.activeCount}</div>
                        <div class="summary-stat-label">Active</div>
                    </div>
                    <div class="summary-stat">
                        <div class="summary-stat-value">${data.newCustomers}</div>
                        <div class="summary-stat-label">New</div>
                    </div>
                    <div class="summary-stat">
                        <div class="summary-stat-value">${formatCurrency(data.avgSpent)}</div>
                        <div class="summary-stat-label">Avg. Spent</div>
                    </div>
                `;
                break;
            case 'financial':
                html += `
                    <div class="summary-stat">
                        <div class="summary-stat-value">${formatCurrency(data.revenue)}</div>
                        <div class="summary-stat-label">Revenue</div>
                    </div>
                    <div class="summary-stat">
                        <div class="summary-stat-value">${formatCurrency(data.expenses)}</div>
                        <div class="summary-stat-label">Expenses</div>
                    </div>
                    <div class="summary-stat">
                        <div class="summary-stat-value">${formatCurrency(data.profit)}</div>
                        <div class="summary-stat-label">Profit</div>
                    </div>
                    <div class="summary-stat">
                        <div class="summary-stat-value">${data.profitMargin}%</div>
                        <div class="summary-stat-label">Margin</div>
                    </div>
                `;
                break;
            case 'transactions':
                html += `
                    <div class="summary-stat">
                        <div class="summary-stat-value">${data.totalCount}</div>
                        <div class="summary-stat-label">Transactions</div>
                    </div>
                    <div class="summary-stat">
                        <div class="summary-stat-value">${formatCurrency(data.totalAmount)}</div>
                        <div class="summary-stat-label">Total Amount</div>
                    </div>
                    <div class="summary-stat">
                        <div class="summary-stat-value">${data.successfulTransactions}</div>
                        <div class="summary-stat-label">Successful</div>
                    </div>
                    <div class="summary-stat">
                        <div class="summary-stat-value">${data.failedTransactions}</div>
                        <div class="summary-stat-label">Failed</div>
                    </div>
                `;
                break;
            case 'performance':
                html += `
                    <div class="summary-stat">
                        <div class="summary-stat-value">${data.growthRate}%</div>
                        <div class="summary-stat-label">Growth Rate</div>
                    </div>
                    <div class="summary-stat">
                        <div class="summary-stat-value">${data.conversion}%</div>
                        <div class="summary-stat-label">Conversion</div>
                    </div>
                    <div class="summary-stat">
                        <div class="summary-stat-value">${data.roi}%</div>
                        <div class="summary-stat-label">ROI</div>
                    </div>
                    <div class="summary-stat">
                        <div class="summary-stat-value">${data.customerSatisfaction}%</div>
                        <div class="summary-stat-label">Satisfaction</div>
                    </div>
                `;
                break;
        }

        html += `
                </div>
            </div>
            
            <div class="report-chart-container">
                <div class="chart-placeholder">
                    <div class="icon icon--chart-bar"></div>
                    <h4>Chart Visualization</h4>
                    <p>Chart data would be displayed here</p>
                </div>
            </div>
            
            <div class="report-table-container">
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Description</th>
                            <th>Amount</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${generateSampleTableRows(reportType)}
                    </tbody>
                </table>
            </div>
        `;

        return html;
    }

    // Generate sample table rows
    function generateSampleTableRows(reportType) {
        const rows = [];
        const sampleCount = 5;
        
        for (let i = 0; i < sampleCount; i++) {
            const date = new Date(currentDateRange.end);
            date.setDate(date.getDate() - i);
            
            rows.push(`
                <tr>
                    <td>${formatDate(date)}</td>
                    <td>Sample ${reportType} entry ${i + 1}</td>
                    <td>${formatCurrency(Math.floor(Math.random() * 5000) + 500)}</td>
                    <td><span class="chip chip--green">Complete</span></td>
                </tr>
            `);
        }
        
        return rows.join('');
    }

    // Export specific report
    function exportReport(reportType) {
        showSuccessMessage(`Exporting ${getReportTitle(reportType)}...`);
        
        // Simulate export process
        setTimeout(() => {
            showSuccessMessage(`${getReportTitle(reportType)} exported successfully!`);
        }, 2000);
    }

    // Export all reports
    function exportAllReports() {
        showSuccessMessage('Exporting all reports...');
        
        // Simulate export process
        setTimeout(() => {
            showSuccessMessage('All reports exported successfully!');
        }, 3000);
    }

    // Custom report modal functions
    function openCustomReportModal() {
        // Set default dates
        const today = new Date();
        const lastMonth = new Date();
        lastMonth.setMonth(today.getMonth() - 1);
        
        document.getElementById('custom-start-date').value = formatDateForInput(lastMonth);
        document.getElementById('custom-end-date').value = formatDateForInput(today);
        
        document.getElementById('custom-report-modal').style.display = 'flex';
    }

    function closeCustomReportModal() {
        document.getElementById('custom-report-modal').style.display = 'none';
        document.getElementById('custom-report-form').reset();
    }

    function previewCustomReport() {
        const formData = getCustomReportFormData();
        
        if (!validateCustomReportForm(formData)) {
            return;
        }
        
        showSuccessMessage('Generating preview...');
        
        // Simulate preview generation
        setTimeout(() => {
            showSuccessMessage('Preview ready! Check the report details.');
        }, 1500);
    }

    function generateCustomReport() {
        const formData = getCustomReportFormData();
        
        if (!validateCustomReportForm(formData)) {
            return;
        }
        
        showSuccessMessage(`Generating custom ${formData.name} report...`);
        
        // Simulate report generation
        setTimeout(() => {
            showSuccessMessage('Custom report generated successfully!');
            closeCustomReportModal();
        }, 2500);
    }

    // Get custom report form data
    function getCustomReportFormData() {
        return {
            name: document.getElementById('custom-report-name').value,
            type: document.getElementById('custom-report-type').value,
            format: document.getElementById('custom-report-format').value,
            startDate: document.getElementById('custom-start-date').value,
            endDate: document.getElementById('custom-end-date').value,
            includeTotals: document.getElementById('include-totals').checked,
            includeCharts: document.getElementById('include-charts').checked,
            includeDetails: document.getElementById('include-details').checked,
            includeTrends: document.getElementById('include-trends').checked,
            notes: document.getElementById('custom-report-notes').value
        };
    }

    // Validate custom report form
    function validateCustomReportForm(formData) {
        if (!formData.name) {
            alert('Please enter a report name.');
            return false;
        }
        
        if (!formData.type) {
            alert('Please select a report type.');
            return false;
        }
        
        if (!formData.startDate || !formData.endDate) {
            alert('Please select both start and end dates.');
            return false;
        }
        
        if (new Date(formData.startDate) > new Date(formData.endDate)) {
            alert('Start date must be before end date.');
            return false;
        }
        
        return true;
    }

    // Modal functions
    function closeReportDetailsModal() {
        document.getElementById('report-details-modal').style.display = 'none';
        currentReportType = null;
    }

    function printReport() {
        window.print();
    }

    function exportCurrentReport() {
        if (currentReportType) {
            exportReport(currentReportType);
        }
    }

    function closeAllModals() {
        document.getElementById('report-details-modal').style.display = 'none';
        document.getElementById('custom-report-modal').style.display = 'none';
    }

    // Utility functions
    function getReportTitle(reportType) {
        const titles = {
            sales: 'Sales Report',
            inventory: 'Inventory Report',
            customers: 'Customer Report',
            financial: 'Financial Report',
            transactions: 'Transaction Report',
            performance: 'Performance Report'
        };
        return titles[reportType] || 'Report';
    }

    function showLoading(show) {
        // You can implement a loading overlay here
        console.log(show ? 'Loading...' : 'Loading complete');
    }

    function formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    }

    function formatDate(date) {
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    function formatDateForInput(date) {
        return date.toISOString().split('T')[0];
    }

    function showSuccessMessage(message) {
        // You can implement a toast notification here
        console.log('Success:', message);
        // For now, just use alert
        alert(message);
    }

    // Public API
    return {
        init,
        setDateRange,
        applyFilters,
        resetFilters,
        viewReport,
        exportReport,
        exportAllReports,
        openCustomReportModal,
        closeCustomReportModal,
        previewCustomReport,
        generateCustomReport,
        closeReportDetailsModal,
        printReport,
        exportCurrentReport
    };
})();

// Global function for router compatibility
window.reports = function() {
    ReportsManagement.init();
}; 