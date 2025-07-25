/**
 * Proxy Status Checker for Dynamic City Proxy
 * Handles proxy configuration and status checking
 */
const ProxyStatus = {
    /**
     * Check proxy status for current selected city
     */
    async checkStatus() {
        try {
            // First get current city information
            const cityResponse = await fetch(`${window.baseKeyword || ''}Scraper/app/api/city_proxy_manager.php?action=get_current_city`);
            const cityData = await cityResponse.json();
            
                    let currentCity = null;
        let displayName = 'No City Selected';
            
            if (cityData.success) {
                currentCity = cityData.current_city.city_name;
                displayName = cityData.current_city.display_name;
            }
            
            // Test the current city proxy
            const response = await fetch(`${window.baseKeyword || ''}Scraper/app/api/city_proxy_manager.php?action=test_city&city=${encodeURIComponent(currentCity)}`);
            const data = await response.json();
            
            if (data.success && data.test_result.success) {
                console.log(`${displayName} Proxy Status:`, data);
                return {
                    success: true,
                    city_name: currentCity,
                    display_name: displayName,
                    ...data.test_result
                };
            } else {
                console.error('Proxy check failed:', data.test_result?.message || data.error);
                return {
                    success: false,
                    city_name: currentCity,
                    display_name: displayName,
                    message: data.test_result?.message || data.error || 'Connection failed'
                };
            }
        } catch (error) {
            console.error('Error checking proxy status:', error);
            return {
                success: false,
                city_name: 'unknown',
                display_name: 'Unknown',
                message: error.message
            };
        }
    },

    /**
     * Display proxy status in UI
     */
    async displayStatus() {
        const status = await this.checkStatus();
        
        // Create or update status indicator
        let statusElement = document.getElementById('proxy-status');
        if (!statusElement) {
            statusElement = document.createElement('div');
            statusElement.id = 'proxy-status';
            statusElement.className = 'alert alert-info mt-3';
            const container = document.querySelector('.container') || document.body;
            container.appendChild(statusElement);
        }
        
        if (status && status.success) {
            statusElement.className = 'alert alert-success mt-3';
            statusElement.innerHTML = `
                <strong>${status.display_name} Proxy Status:</strong> Active
                <br><small>IP: ${status.ip || 'Unknown'}</small>
                <br><small>Location: ${status.location || status.display_name}</small>
                <br><small>Host: ${status.proxy_config?.host || 'pr.oxylabs.io'}:${status.proxy_config?.port || '7777'}</small>
                <br><small>Response Time: ${status.response_time ? (status.response_time * 1000).toFixed(0) + 'ms' : 'Unknown'}</small>
            `;
        } else {
            statusElement.className = 'alert alert-warning mt-3';
            statusElement.innerHTML = `
                <strong>${status?.display_name || 'Unknown'} Proxy Status:</strong> ${status ? 'Error' : 'Disabled'}
                <br><small>${status ? status.message : 'Using direct connection'}</small>
            `;
        }
    },

    /**
     * Initialize proxy status checking
     */
    init() {
        // Check status on page load
        this.displayStatus();
        
        // Check status every 5 minutes
        setInterval(() => {
            this.displayStatus();
        }, 5 * 60 * 1000);
        
        // Listen for proxy city changes
        window.addEventListener('proxyCityChanged', () => {
            console.log('🔄 Proxy city changed, updating status...');
            setTimeout(() => {
                this.displayStatus();
            }, 1000); // Small delay to allow proxy to update
        });
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    ProxyStatus.init();
});