/**
 * City Proxy Selector - Simple integration with existing form
 * Provides autocomplete city selection for proxy configuration
 */
class CityProxySelector {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.selectedCity = null;
        this.cities = [];
        this.baseUrl = window.baseKeyword || '';
        
        if (!this.container) {
            console.error('City Proxy Selector: Container not found:', containerId);
            return;
        }
        
        console.log('🌐 City Proxy Selector: Initializing...');
        this.init();
    }
    
    async init() {
        try {
            // Load current selected city
            await this.loadCurrentCity();
            
            // Load available cities
            await this.loadCities();
            
            // Render the component
            this.render();
            
            // Attach event listeners
            this.attachEventListeners();
            
            console.log('✅ City Proxy Selector: Initialized successfully');
        } catch (error) {
            console.error('❌ City Proxy Selector: Initialization failed:', error);
            this.showError('Failed to initialize city selector: ' + error.message);
        }
    }
    
    async loadCurrentCity() {
        try {
            console.log('🔄 Loading current city from API...');
            const url = `${this.baseUrl}Scraper/app/api/city_proxy_manager.php?action=get_current_city`;
            console.log('API URL:', url);
            
            const response = await fetch(url);
            console.log('Response status:', response.status);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log('API Response:', data);
            
            if (data.success && data.current_city) {
                this.selectedCity = data.current_city;
                console.log('✅ Current city loaded:', this.selectedCity);
            } else {
                console.log('⚠️ No current city found');
                this.selectedCity = null;
            }
        } catch (error) {
            console.error('❌ Error loading current city:', error);
            this.selectedCity = null;
        }
    }
    
    async loadCities() {
        try {
            console.log('🔄 Loading cities from API...');
            const url = `${this.baseUrl}Scraper/app/api/city_proxy_manager.php?action=search_cities&search=&limit=5000`;
            console.log('API URL:', url);
            
            const response = await fetch(url);
            console.log('Response status:', response.status);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log('API Response:', data);
            
            if (data.success && data.cities) {
                this.cities = data.cities;
                console.log(`✅ Loaded ${this.cities.length} cities`);
            } else {
                console.log('⚠️ No cities found in response');
                this.cities = [];
            }
        } catch (error) {
            console.error('❌ Error loading cities:', error);
            this.cities = [];
        }
    }
    
    render() {
        const selectedDisplay = this.selectedCity ? this.selectedCity.display_name : 'Select a city for proxy';
        
        this.container.innerHTML = `
            <div class="city-proxy-selector">
                <!-- Selected City Display -->
                <div class="selected-city" id="selectedCityDisplay" style="
                    background: #e3f2fd; 
                    border: 2px solid #2196f3; 
                    border-radius: 8px; 
                    padding: 12px 16px; 
                    margin-bottom: 12px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    cursor: pointer;
                ">
                    <div>
                        <strong>🌐 Proxy Location: ${selectedDisplay}</strong>
                        <div style="font-size: 12px; color: #666; margin-top: 2px;">
                            Click to change location
                        </div>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        ${this.selectedCity ? `<button type="button" class="clear-city-btn" style="
                            background: #f44336; 
                            color: white; 
                            border: none; 
                            border-radius: 50%; 
                            width: 24px; 
                            height: 24px; 
                            cursor: pointer;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            font-size: 14px;
                        ">×</button>` : ''}
                    </div>
                </div>
                
                <!-- Search Box (Hidden by default) -->
                <div class="city-search-container" id="citySearchContainer" style="display: none;">
                    <div style="position: relative; margin-bottom: 12px;">
                        <input 
                            type="text" 
                            id="citySearchInput" 
                            placeholder="Search US cities (e.g., San Ramon, Houston)..."
                            style="
                                width: 100%; 
                                padding: 12px 16px; 
                                border: 2px solid #ddd; 
                                border-radius: 8px; 
                                font-size: 14px;
                                outline: none;
                            "
                        />
                        <div class="search-results" id="searchResults" style="
                            position: absolute;
                            top: 100%;
                            left: 0;
                            right: 0;
                            background: white;
                            border: 1px solid #ddd;
                            border-radius: 8px;
                            max-height: 200px;
                            overflow-y: auto;
                            z-index: 1000;
                            display: none;
                            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                        "></div>
                    </div>
                    <div style="text-align: right;">
                        <button type="button" id="cancelSearchBtn" style="
                            background: #666; 
                            color: white; 
                            border: none; 
                            padding: 8px 16px; 
                            border-radius: 4px; 
                            cursor: pointer;
                            font-size: 12px;
                        ">Cancel</button>
                    </div>
                </div>
            </div>
        `;
    }
    
    attachEventListeners() {
        const selectedDisplay = document.getElementById('selectedCityDisplay');
        const searchContainer = document.getElementById('citySearchContainer');
        const searchInput = document.getElementById('citySearchInput');
        const searchResults = document.getElementById('searchResults');
        const clearBtn = document.querySelector('.clear-city-btn');
        const cancelBtn = document.getElementById('cancelSearchBtn');
        
        // Show search when clicking selected city
        if (selectedDisplay) {
            selectedDisplay.addEventListener('click', () => {
                selectedDisplay.style.display = 'none';
                searchContainer.style.display = 'block';
                searchInput.focus();
            });
        }
        
        // Clear selected city
        if (clearBtn) {
            clearBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.clearSelection();
            });
        }
        
        // Cancel search
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.hideSearch();
            });
        }
        
        // Search as user types
        if (searchInput) {
            let searchTimeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                const query = e.target.value.trim();
                
                if (query.length < 2) {
                    searchResults.style.display = 'none';
                    return;
                }
                
                searchTimeout = setTimeout(() => {
                    this.searchCities(query);
                }, 300);
            });
            
            // Hide results when clicking outside
            document.addEventListener('click', (e) => {
                if (!searchContainer.contains(e.target)) {
                    searchResults.style.display = 'none';
                }
            });
        }
    }
    
    async searchCities(query) {
        const searchResults = document.getElementById('searchResults');
        
        try {
            const filteredCities = this.cities.filter(city => 
                city.display_name.toLowerCase().includes(query.toLowerCase()) ||
                city.city_name.toLowerCase().includes(query.toLowerCase())
            ).slice(0, 8);
            
            if (filteredCities.length === 0) {
                searchResults.innerHTML = '<div style="padding: 12px; color: #666; text-align: center;">No cities found</div>';
            } else {
                searchResults.innerHTML = filteredCities.map(city => `
                    <div class="city-result" data-city="${city.city_name}" data-display="${city.display_name}" style="
                        padding: 12px 16px;
                        cursor: pointer;
                        border-bottom: 1px solid #eee;
                        transition: background-color 0.2s;
                    " onmouseover="this.style.backgroundColor='#f5f5f5'" onmouseout="this.style.backgroundColor='white'">
                        <strong>${city.display_name}</strong>
                        <div style="font-size: 12px; color: #666;">United States</div>
                    </div>
                `).join('');
                
                // Add click listeners to results
                searchResults.querySelectorAll('.city-result').forEach(result => {
                    result.addEventListener('click', () => {
                        const cityName = result.dataset.city;
                        const displayName = result.dataset.display;
                        this.selectCity(cityName, displayName);
                    });
                });
            }
            
            searchResults.style.display = 'block';
        } catch (error) {
            console.error('Search error:', error);
            searchResults.innerHTML = '<div style="padding: 12px; color: #dc3545;">Search error</div>';
            searchResults.style.display = 'block';
        }
    }
    
    async clearProxySession() {
        try {
            console.log('🔄 Clearing proxy session...');
            
            const response = await fetch(`${this.baseUrl}Scraper/app/api/clear_proxy_session.php`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            const data = await response.json();
            
            if (data.success) {
                console.log('✅ Proxy session cleared:', data.cleared_data);
                return true;
            } else {
                console.warn('⚠️ Failed to clear proxy session:', data.error);
                return false;
            }
        } catch (error) {
            console.error('❌ Error clearing proxy session:', error);
            return false;
        }
    }

    async selectCity(cityName, displayName) {
        try {
            console.log(`Selecting city: ${displayName} (${cityName})`);
            
            // First clear the proxy session to ensure fresh IP
            await this.clearProxySession();
            
            // Call API to set the city
            const response = await fetch(`${this.baseUrl}Scraper/app/api/city_proxy_manager.php`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: `action=select_city&city=${encodeURIComponent(cityName)}`
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Update selected city
                this.selectedCity = {
                    city_name: cityName,
                    display_name: displayName,
                    country_code: 'US'
                };
                
                // Re-render
                this.render();
                this.attachEventListeners();
                
                // Dispatch event
                window.dispatchEvent(new CustomEvent('proxyCityChanged', {
                    detail: {
                        cityName: cityName,
                        displayName: displayName
                    }
                }));
                
                this.showMessage(`✅ Proxy location changed to ${displayName}`, 'success');
                
                console.log(`✅ City selected: ${displayName}`);
            } else {
                throw new Error(data.error || 'Failed to select city');
            }
        } catch (error) {
            console.error('Error selecting city:', error);
            this.showMessage(`❌ Error: ${error.message}`, 'error');
        }
    }
    
    async clearSelection() {
        try {
            // Clear proxy session first
            await this.clearProxySession();
            
            // Clear the selection completely
            this.selectedCity = null;
            this.render();
            this.attachEventListeners();
            
            // Clear from session
            if (typeof DotEnvLoader !== 'undefined' && DotEnvLoader.setSelectedProxyCity) {
                DotEnvLoader.setSelectedProxyCity(null);
            }
            
            this.showMessage('✅ Proxy city selection cleared', 'success');
        } catch (error) {
            console.error('Error clearing selection:', error);
            this.showMessage('⚠️ Selection cleared but proxy session may still be active', 'warning');
        }
    }
    
    hideSearch() {
        const selectedDisplay = document.getElementById('selectedCityDisplay');
        const searchContainer = document.getElementById('citySearchContainer');
        const searchResults = document.getElementById('searchResults');
        
        if (selectedDisplay && searchContainer) {
            selectedDisplay.style.display = 'flex';
            searchContainer.style.display = 'none';
            searchResults.style.display = 'none';
        }
    }
    
    showMessage(message, type = 'info') {
        // Create or update message element
        let messageEl = document.getElementById('cityProxyMessage');
        if (!messageEl) {
            messageEl = document.createElement('div');
            messageEl.id = 'cityProxyMessage';
            this.container.appendChild(messageEl);
        }
        
        const colors = {
            success: '#d4edda',
            error: '#f8d7da',
            info: '#d1ecf1'
        };
        
        messageEl.style.cssText = `
            padding: 8px 12px;
            margin-top: 8px;
            border-radius: 4px;
            font-size: 12px;
            background: ${colors[type] || colors.info};
            border: 1px solid ${type === 'success' ? '#c3e6cb' : type === 'error' ? '#f5c6cb' : '#bee5eb'};
        `;
        messageEl.textContent = message;
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            if (messageEl.parentNode) {
                messageEl.parentNode.removeChild(messageEl);
            }
        }, 3000);
    }
    
    showError(message) {
        this.container.innerHTML = `
            <div style="
                padding: 16px;
                background: #f8d7da;
                border: 1px solid #f5c6cb;
                border-radius: 8px;
                color: #721c24;
                text-align: center;
            ">
                <strong>⚠️ City Proxy Selector Error</strong><br>
                ${message}
            </div>
        `;
    }
}

// Make it available globally
window.CityProxySelector = CityProxySelector; 