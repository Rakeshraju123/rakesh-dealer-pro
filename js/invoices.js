// Invoices Management Module
window.InvoicesManagement = (function() {
    'use strict';

    // Private variables
    let invoicesData = [];
    let filteredInvoices = [];
    let currentEditingInvoice = null;
    let currentDeletingInvoice = null;
    let uploadedTemplate = null;

    // Mock invoices data based on the image
    const mockInvoicesData = [
        {
            id: 1,
            invoice_number: 'INV-TXN001',
            customer: 'Betty Jean Hayes',
            customer_email: 'betty@example.com',
            customer_address: '123 Main St, Louisville, KY 40202',
            amount: 8900,
            subtotal: 8900,
            tax: 0,
            status: 'generated',
            date: '2024-05-28',
            due_date: '2024-06-28',
            description: '7x14 Iron Bull Dump Trailer',
            notes: 'Payment terms: Net 30 days',
            created_at: '2024-05-28T10:30:00Z'
        },
        {
            id: 2,
            invoice_number: 'INV-TXN002',
            customer: 'Johnson Construction',
            customer_email: 'billing@johnsonconstruction.com',
            customer_address: '456 Industrial Blvd, Louisville, KY 40203',
            amount: 485.5,
            subtotal: 485.5,
            tax: 0,
            status: 'signed',
            date: '2024-06-06',
            due_date: '2024-07-06',
            description: 'Service maintenance and inspection',
            notes: 'Commercial account - Net 30 terms',
            created_at: '2024-06-06T14:15:00Z'
        },
        {
            id: 3,
            invoice_number: 'INV-TXN003',
            customer: 'Mike Thompson',
            customer_email: 'mike.thompson@email.com',
            customer_address: '789 Oak Street, Louisville, KY 40204',
            amount: 12500,
            subtotal: 11500,
            tax: 1000,
            status: 'generated',
            date: '2024-06-10',
            due_date: '2024-07-10',
            description: '8.5x24 Haulmark Edge Enclosed Trailer',
            notes: 'Financing available',
            created_at: '2024-06-10T09:45:00Z'
        },
        {
            id: 4,
            invoice_number: 'INV-TXN004',
            customer: 'Sarah Williams',
            customer_email: 'sarah.williams@email.com',
            customer_address: '321 Pine Ave, Louisville, KY 40205',
            amount: 6750,
            subtotal: 6750,
            tax: 0,
            status: 'sent',
            date: '2024-06-12',
            due_date: '2024-07-12',
            description: '5x8 Enclosed Cargo Trailer',
            notes: 'First-time customer discount applied',
            created_at: '2024-06-12T16:20:00Z'
        }
    ];

    // Initialize the invoices management module
    function init() {
        console.log('Initializing Invoices Management...');
        
        // Load invoices data
        loadInvoicesData();
        
        // Setup event listeners
        setupEventListeners();
        
        // Initial render
        renderInvoicesList();
    }

    // Load invoices data (simulate API call)
    function loadInvoicesData() {
        showLoading(true);
        
        // Simulate API delay
        setTimeout(() => {
            invoicesData = [...mockInvoicesData];
            filteredInvoices = [...invoicesData];
            showLoading(false);
            renderInvoicesList();
        }, 1000);
    }

    // Setup event listeners
    function setupEventListeners() {
        // Template file upload
        const templateFileInput = document.getElementById('template-file-input');
        if (templateFileInput) {
            templateFileInput.addEventListener('change', handleTemplateUpload);
        }

        // Drag and drop for template upload
        const uploadArea = document.getElementById('template-upload-area');
        if (uploadArea) {
            uploadArea.addEventListener('dragover', handleDragOver);
            uploadArea.addEventListener('dragleave', handleDragLeave);
            uploadArea.addEventListener('drop', handleDrop);
        }

        // Modal close events
        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('modal-overlay')) {
                closeAllModals();
            }
        });

        // Set default invoice date to today
        const invoiceDateInput = document.getElementById('invoice-date');
        if (invoiceDateInput) {
            invoiceDateInput.value = new Date().toISOString().split('T')[0];
        }

        // Set default due date to 30 days from today
        const dueDateInput = document.getElementById('invoice-due-date');
        if (dueDateInput) {
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + 30);
            dueDateInput.value = dueDate.toISOString().split('T')[0];
        }
    }

    // Handle template file upload
    function handleTemplateUpload(event) {
        const file = event.target.files[0];
        if (file) {
            processTemplateFile(file);
        }
    }

    // Handle drag and drop events
    function handleDragOver(event) {
        event.preventDefault();
        event.currentTarget.classList.add('dragover');
    }

    function handleDragLeave(event) {
        event.currentTarget.classList.remove('dragover');
    }

    function handleDrop(event) {
        event.preventDefault();
        event.currentTarget.classList.remove('dragover');
        
        const files = event.dataTransfer.files;
        if (files.length > 0) {
            processTemplateFile(files[0]);
        }
    }

    // Process uploaded template file
    function processTemplateFile(file) {
        // Validate file type
        const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/jpg', 'image/png'];
        if (!allowedTypes.includes(file.type)) {
            alert('Please upload a PDF, DOC, or image file.');
            return;
        }

        // Validate file size (10MB limit)
        if (file.size > 10 * 1024 * 1024) {
            alert('File size must be less than 10MB.');
            return;
        }

        // Store template info
        uploadedTemplate = {
            name: file.name,
            size: formatFileSize(file.size),
            type: file.type,
            file: file
        };

        // Show template status
        showTemplateStatus();
        showSuccessMessage('Template uploaded successfully!');
    }

    // Show template upload status
    function showTemplateStatus() {
        const uploadArea = document.getElementById('template-upload-area');
        const templateStatus = document.getElementById('template-status');
        const templateName = document.getElementById('template-name');
        const templateSize = document.getElementById('template-size');

        if (uploadedTemplate) {
            uploadArea.style.display = 'none';
            templateStatus.style.display = 'flex';
            templateName.textContent = uploadedTemplate.name;
            templateSize.textContent = uploadedTemplate.size;
        }
    }

    // Remove uploaded template
    function removeTemplate() {
        uploadedTemplate = null;
        const uploadArea = document.getElementById('template-upload-area');
        const templateStatus = document.getElementById('template-status');
        const templateFileInput = document.getElementById('template-file-input');

        uploadArea.style.display = 'block';
        templateStatus.style.display = 'none';
        templateFileInput.value = '';
    }

    // Filter invoices
    function filterInvoices() {
        const statusFilter = document.getElementById('invoice-filter').value;

        filteredInvoices = invoicesData.filter(invoice => {
            return !statusFilter || invoice.status === statusFilter;
        });

        renderInvoicesList();
    }

    // Render invoices list
    function renderInvoicesList() {
        const invoicesList = document.getElementById('recent-invoices-list');
        const emptyState = document.getElementById('invoices-empty-state');
        
        if (!invoicesList) return;

        // Show empty state if no invoices
        if (filteredInvoices.length === 0) {
            invoicesList.innerHTML = '';
            if (emptyState) emptyState.style.display = 'block';
            return;
        }

        if (emptyState) emptyState.style.display = 'none';

        // Sort invoices by creation date (newest first)
        const sortedInvoices = [...filteredInvoices].sort((a, b) => 
            new Date(b.created_at) - new Date(a.created_at)
        );

        // Render invoice items
        invoicesList.innerHTML = sortedInvoices.map(invoice => `
            <div class="invoice-item">
                <div class="invoice-item-info">
                    <div class="invoice-item-number">${invoice.invoice_number}</div>
                    <div class="invoice-item-customer">${invoice.customer} • ${formatCurrency(invoice.amount)}</div>
                </div>
                <div class="invoice-item-status">
                    <span class="invoice-status-chip invoice-status-chip--${invoice.status}">
                        ${capitalizeFirst(invoice.status)}
                    </span>
                    <div class="invoice-item-actions">
                        <button class="btn btn--text btn--small" onclick="InvoicesManagement.viewInvoiceDetails(${invoice.id})" title="View Details">
                            <div class="icon icon--eye"></div>
                        </button>
                        <button class="btn btn--text btn--small" onclick="InvoicesManagement.downloadInvoice(${invoice.id})" title="Download">
                            <div class="icon icon--arrow-down"></div>
                        </button>
                        <button class="btn btn--text btn--small" onclick="InvoicesManagement.editInvoice(${invoice.id})" title="Edit">
                            <div class="icon icon--pen-to-square"></div>
                        </button>
                        <button class="btn btn--text-danger btn--small" onclick="InvoicesManagement.deleteInvoice(${invoice.id})" title="Delete">
                            <div class="icon icon--trash"></div>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    // Modal functions
    function openGenerateInvoiceModal() {
        currentEditingInvoice = null;
        document.getElementById('generate-invoice-modal').style.display = 'flex';
        clearInvoiceForm();
        generateInvoiceNumber();
    }

    function closeGenerateInvoiceModal() {
        document.getElementById('generate-invoice-modal').style.display = 'none';
        currentEditingInvoice = null;
        clearInvoiceForm();
    }

    function editInvoice(invoiceId) {
        const invoice = invoicesData.find(i => i.id === invoiceId);
        if (!invoice) return;

        currentEditingInvoice = invoice;
        populateInvoiceForm(invoice);
        document.getElementById('generate-invoice-modal').style.display = 'flex';
    }

    function populateInvoiceForm(invoice) {
        document.getElementById('invoice-customer').value = invoice.customer;
        document.getElementById('invoice-customer-email').value = invoice.customer_email;
        document.getElementById('invoice-customer-address').value = invoice.customer_address;
        document.getElementById('invoice-number').value = invoice.invoice_number;
        document.getElementById('invoice-date').value = invoice.date;
        document.getElementById('invoice-due-date').value = invoice.due_date;
        document.getElementById('invoice-description').value = invoice.description;
        document.getElementById('invoice-subtotal').value = invoice.subtotal;
        document.getElementById('invoice-tax').value = invoice.tax;
        document.getElementById('invoice-total').value = invoice.amount;
        document.getElementById('invoice-notes').value = invoice.notes;
    }

    function clearInvoiceForm() {
        document.getElementById('generate-invoice-form').reset();
        
        // Set default dates
        const today = new Date().toISOString().split('T')[0];
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30);
        
        document.getElementById('invoice-date').value = today;
        document.getElementById('invoice-due-date').value = dueDate.toISOString().split('T')[0];
    }

    function generateInvoiceNumber() {
        if (!currentEditingInvoice) {
            const lastInvoice = invoicesData.length > 0 ? 
                Math.max(...invoicesData.map(i => parseInt(i.invoice_number.split('-')[1].replace('TXN', '')))) : 0;
            const nextNumber = String(lastInvoice + 1).padStart(3, '0');
            document.getElementById('invoice-number').value = `INV-TXN${nextNumber}`;
        }
    }

    function calculateTotal() {
        const subtotal = parseFloat(document.getElementById('invoice-subtotal').value) || 0;
        const taxPercent = parseFloat(document.getElementById('invoice-tax').value) || 0;
        const taxAmount = (subtotal * taxPercent) / 100;
        const total = subtotal + taxAmount;
        
        document.getElementById('invoice-total').value = total.toFixed(2);
    }

    function generateInvoice() {
        const formData = {
            customer: document.getElementById('invoice-customer').value,
            customer_email: document.getElementById('invoice-customer-email').value,
            customer_address: document.getElementById('invoice-customer-address').value,
            invoice_number: document.getElementById('invoice-number').value,
            date: document.getElementById('invoice-date').value,
            due_date: document.getElementById('invoice-due-date').value,
            description: document.getElementById('invoice-description').value,
            subtotal: parseFloat(document.getElementById('invoice-subtotal').value),
            tax: parseFloat(document.getElementById('invoice-tax').value) || 0,
            amount: parseFloat(document.getElementById('invoice-total').value),
            notes: document.getElementById('invoice-notes').value
        };

        // Validate required fields
        if (!formData.customer || !formData.invoice_number || !formData.date || !formData.subtotal) {
            alert('Please fill in all required fields.');
            return;
        }

        if (currentEditingInvoice) {
            // Update existing invoice
            const index = invoicesData.findIndex(i => i.id === currentEditingInvoice.id);
            if (index !== -1) {
                invoicesData[index] = { 
                    ...invoicesData[index], 
                    ...formData,
                    status: 'generated'
                };
            }
        } else {
            // Add new invoice
            const newInvoice = {
                id: Date.now(),
                ...formData,
                status: 'generated',
                created_at: new Date().toISOString()
            };
            invoicesData.unshift(newInvoice);
        }

        // Refresh display
        filterInvoices();
        closeGenerateInvoiceModal();
        
        // Show success message
        showSuccessMessage(currentEditingInvoice ? 'Invoice updated successfully!' : 'Invoice generated successfully!');
    }

    // Invoice details modal
    function viewInvoiceDetails(invoiceId) {
        const invoice = invoicesData.find(i => i.id === invoiceId);
        if (!invoice) return;

        document.getElementById('invoice-details-title').textContent = `Invoice Details - ${invoice.invoice_number}`;
        
        const detailsContent = document.getElementById('invoice-details-content');
        detailsContent.innerHTML = `
            <div class="invoice-details-grid">
                <div class="invoice-detail-section">
                    <h4>Customer Information</h4>
                    <div class="detail-row">
                        <span class="detail-label">Customer:</span>
                        <span class="detail-value">${invoice.customer}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Email:</span>
                        <span class="detail-value">${invoice.customer_email}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Address:</span>
                        <span class="detail-value">${invoice.customer_address}</span>
                    </div>
                </div>
                
                <div class="invoice-detail-section">
                    <h4>Invoice Information</h4>
                    <div class="detail-row">
                        <span class="detail-label">Invoice #:</span>
                        <span class="detail-value">${invoice.invoice_number}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Date:</span>
                        <span class="detail-value">${formatDate(invoice.date)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Due Date:</span>
                        <span class="detail-value">${formatDate(invoice.due_date)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Status:</span>
                        <span class="detail-value">
                            <span class="invoice-status-chip invoice-status-chip--${invoice.status}">
                                ${capitalizeFirst(invoice.status)}
                            </span>
                        </span>
                    </div>
                </div>
                
                <div class="invoice-detail-section">
                    <h4>Amount Details</h4>
                    <div class="detail-row">
                        <span class="detail-label">Subtotal:</span>
                        <span class="detail-value">${formatCurrency(invoice.subtotal)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Tax:</span>
                        <span class="detail-value">${formatCurrency(invoice.tax)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Total:</span>
                        <span class="detail-value"><strong>${formatCurrency(invoice.amount)}</strong></span>
                    </div>
                </div>
                
                <div class="invoice-detail-section">
                    <h4>Description</h4>
                    <div class="detail-notes">${invoice.description}</div>
                    ${invoice.notes ? `
                        <h4 style="margin-top: 1rem;">Notes</h4>
                        <div class="detail-notes">${invoice.notes}</div>
                    ` : ''}
                </div>
            </div>
        `;

        document.getElementById('invoice-details-modal').style.display = 'flex';
    }

    function closeInvoiceDetailsModal() {
        document.getElementById('invoice-details-modal').style.display = 'none';
    }

    function downloadInvoice(invoiceId) {
        const invoice = invoicesData.find(i => i.id === invoiceId);
        if (!invoice) return;

        // Simulate download
        showSuccessMessage(`Downloading invoice ${invoice.invoice_number}...`);
        console.log('Download invoice:', invoice);
    }

    function sendInvoice() {
        showSuccessMessage('Invoice sent successfully!');
        closeInvoiceDetailsModal();
    }

    // Delete invoice functions
    function deleteInvoice(invoiceId) {
        const invoice = invoicesData.find(i => i.id === invoiceId);
        if (!invoice) return;

        currentDeletingInvoice = invoice;
        document.getElementById('delete-invoice-info').innerHTML = `
            <strong>Invoice:</strong> ${invoice.invoice_number}<br>
            <strong>Customer:</strong> ${invoice.customer}<br>
            <strong>Amount:</strong> ${formatCurrency(invoice.amount)}
        `;
        
        document.getElementById('delete-invoice-modal').style.display = 'flex';
    }

    function closeDeleteModal() {
        document.getElementById('delete-invoice-modal').style.display = 'none';
        currentDeletingInvoice = null;
    }

    function confirmDeleteInvoice() {
        if (!currentDeletingInvoice) return;

        const index = invoicesData.findIndex(i => i.id === currentDeletingInvoice.id);
        if (index !== -1) {
            invoicesData.splice(index, 1);
            filterInvoices();
            closeDeleteModal();
            showSuccessMessage('Invoice deleted successfully!');
        }
    }

    // Utility functions
    function closeAllModals() {
        document.getElementById('generate-invoice-modal').style.display = 'none';
        document.getElementById('invoice-details-modal').style.display = 'none';
        document.getElementById('delete-invoice-modal').style.display = 'none';
    }

    function showLoading(show) {
        const loadingElement = document.getElementById('invoices-loading');
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

    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
        filterInvoices,
        openGenerateInvoiceModal,
        closeGenerateInvoiceModal,
        editInvoice,
        generateInvoice,
        calculateTotal,
        viewInvoiceDetails,
        closeInvoiceDetailsModal,
        downloadInvoice,
        sendInvoice,
        deleteInvoice,
        closeDeleteModal,
        confirmDeleteInvoice,
        removeTemplate
    };
})();

// Global function for router compatibility
window.dealerInvoices = function() {
    InvoicesManagement.init();
}; 