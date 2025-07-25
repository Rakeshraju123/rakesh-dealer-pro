// Initialize the router
document.addEventListener('DOMContentLoaded', function() {
    // Get all navigation buttons
    const navButtons = document.querySelectorAll('.navbar__button');
    
    // Add click event to each button
    navButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            // Check if this is a real link (like logout) - if so, don't prevent default
            if (this.hasAttribute('href') && this.getAttribute('href') !== '#') {
                // This is a real link (like logout), let it navigate normally
                console.log('Allowing navigation to:', this.getAttribute('href'));
                return;
            }
            
            // This is a router button, prevent default and handle routing
            e.preventDefault();
            const route = this.getAttribute('data-route');
            console.log('Router navigating to route:', route);
            navigateTo(route);
        });
    });
    
    // Initial route handling
    handleRoute();
    
    // Handle browser back/forward
    window.addEventListener('popstate', handleRoute);
});

// Navigate to a specific route
function navigateTo(route) {
    // Update URL without reloading page
    const url = window.location.pathname.split('?')[0] + (route ? `?page=${route}` : '');
    window.history.pushState({}, '', url);
    
    // Handle the route change
    handleRoute();
}

// Handle current route
async function handleRoute() {
    // Get current route from URL
    const urlParams = new URLSearchParams(window.location.search);
    const route = urlParams.get('page') || '';
    
    // Update active state in navigation
    updateActiveNav(route);
    
    // Load content based on route
    await loadContent(route);
}

// Update active navigation button
function updateActiveNav(route) {
    const navButtons = document.querySelectorAll('.navbar__button');
    
    navButtons.forEach(button => {
        const buttonRoute = button.getAttribute('data-route');
        
        if (buttonRoute === route) {
            button.classList.add('navbar__button--active');
        } else {
            button.classList.remove('navbar__button--active');
        }
    });
}

// Load content based on route
async function loadContent(route) {
    const mainContent = document.querySelector('main');
    
    try {
        // Determine which content to load
        let content;
        let initFunction;
        
        switch (route) {
            case 'inventory':
                content = await fetchTemplate('inventory');
                initFunction = window.inventory;
                break;
            case 'sales':
                content = await fetchTemplate('sales');
                initFunction = window.sales;
                break;
            case 'quotes':
                content = await fetchTemplate('quotes');
                initFunction = window.quotes;
                break;
            case 'customers':
                content = await fetchTemplate('customers');
                initFunction = window.customers;
                break;
            case 'parts-services':
                content = await fetchTemplate('parts-services');
                initFunction = window.partsServices;
                break;
            case 'transactions':
                content = await fetchTemplate('transactions');
                initFunction = window.dealerTransactions;
                break;
            case 'invoices':
                content = await fetchTemplate('invoices');
                initFunction = window.dealerInvoices;
                break;
            case 'reports':
                content = await fetchTemplate('reports');
                initFunction = window.reports;
                break;
            case 'scraper':
                // Load scraper content from existing index.php
                content = await fetchScraperContent();
                initFunction = window.scraperInit;
                break;
            case 'calendar':
                content = await fetchTemplate('calendar');
                initFunction = window.calendar;
                break;
            default:
                // Default to dashboard
                content = await fetchTemplate('dashboard');
                initFunction = window.dealerDashboard;
        }
        
        // Update the content
        console.log(`Setting content for route: ${route}, content length: ${content.length}`);
        mainContent.innerHTML = content;
        console.log(`Content set successfully`);
        
        // Initialize the page if a function is available
        console.log(`Init function for ${route}:`, typeof initFunction);
        if (typeof initFunction === 'function') {
            console.log(`Calling init function for ${route}`);
            initFunction();
        } else {
            console.warn(`No init function found for ${route}`);
        }
        
    } catch (error) {
        console.error('Error loading content:', error);
        
        mainContent.innerHTML = `
            <div class="error-message">
                <h2>Error Loading Content</h2>
                <p>Sorry, we couldn't load the requested page. Please try again later.</p>
                <p>Error: ${error.message}</p>
            </div>
        `;
    }
}

// Fetch template HTML
async function fetchTemplate(templateName) {
    try {
        console.log(`Fetching template: ${templateName}`);
        // Updated path to match the actual directory structure
        const templateUrl = `${window.baseKeyword}pages/${templateName}.html`;
        console.log(`Template URL: ${templateUrl}`);
        
        const response = await fetch(templateUrl);
        
        if (!response.ok) {
            throw new Error(`Failed to load template: ${response.status} ${response.statusText}`);
        }
        
        const templateContent = await response.text();
        console.log(`Template ${templateName} loaded successfully, length: ${templateContent.length}`);
        return templateContent;
    } catch (error) {
        console.error(`Error fetching template ${templateName}:`, error);
        throw error;
    }
}

// Fetch scraper content from existing index.php
async function fetchScraperContent() {
    try {
        // Updated path to match the actual directory structure
        const response = await fetch(`${window.baseKeyword}Scraper/index.php`);
        
        if (!response.ok) {
            throw new Error(`Failed to load scraper: ${response.status} ${response.statusText}`);
        }
        
        const htmlContent = await response.text();
        
        // Extract only the body content from the scraper page
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');
        const bodyContent = doc.body.innerHTML;
        
        return bodyContent;
    } catch (error) {
        console.error('Error fetching scraper content:', error);
        throw error;
    }
}

// Make navigateTo globally available
window.navigateTo = navigateTo; 