<?php
// Include Composer autoloader first
require_once __DIR__ . '/vendor/autoload.php';

// Include multi-tenant database connection and authentication
require_once '/var/www/dealer/dbConnect1.php';
require_once '/var/www/dealer/includes/AuthMiddleware.php';
require_once '/var/www/dealer/includes/TenantManager.php';
require_once '/var/www/dealer/config/database1.php';

// Start session if not already started
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Initialize tenant database connections
$conn = null;
$conn_write = null;

try {
    $currentTenant = TenantManager::getCurrentTenant();
    if ($currentTenant) {
        $schemaName = $currentTenant['schema_name'];
        
        // Create MySQLi connections for the tenant database
        $conn = new mysqli(
            DatabaseConfig::TENANT_DB_HOST,
            DatabaseConfig::TENANT_DB_USER,
            DatabaseConfig::TENANT_DB_PASS,
            $schemaName
        );
        
        $conn_write = new mysqli(
            DatabaseConfig::TENANT_DB_HOST,
            DatabaseConfig::TENANT_DB_USER,
            DatabaseConfig::TENANT_DB_PASS,
            $schemaName
        );
        
        // Check connections
        if ($conn->connect_error) {
            error_log("Scraper read connection failed: " . $conn->connect_error);
            $conn = null;
        } else {
            $conn->set_charset("utf8mb4");
        }
        
        if ($conn_write->connect_error) {
            error_log("Scraper write connection failed: " . $conn_write->connect_error);
            $conn_write = null;
        } else {
            $conn_write->set_charset("utf8mb4");
        }
    }
} catch (Exception $e) {
    error_log("Scraper database connection error: " . $e->getMessage());
    $conn = null;
    $conn_write = null;
}

// Handle AJAX requests - MUST be at the top before any HTML output
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action'])) {
    // Start output buffering to prevent any warnings from corrupting JSON
    ob_start();
    
    require_once __DIR__ . '/app/controllers/openAiScraper.php';
    require_once __DIR__ . '/app/controllers/DynamicScraper.php';
    require_once __DIR__ . '/app/controllers/DotEnvLoader.php';
    
    // Clean any previous output and set proper headers
    ob_clean();
    header('Content-Type: application/json');
    
    try {
        if ($_POST['action'] === 'scrape') {
            $url = $_POST['url'] ?? '';
            $enableScrolling = isset($_POST['enableScrolling']) && $_POST['enableScrolling'] === 'true';
            $manualAddress = $_POST['manualAddress'] ?? '';
            
            if (empty($url)) {
                throw new Exception('URL is required');
            }
            
            // Validate URL
            if (!filter_var($url, FILTER_VALIDATE_URL)) {
                throw new Exception('Invalid URL format');
            }
            
            // Get proxy information
            $proxyConfig = DotEnvLoader::getOxylabsConfig();
            $proxyIp = DotEnvLoader::getProxyIp();
            
            // Initialize the appropriate scraper based on scrolling preference
            if ($enableScrolling) {
                $scraper = new DynamicScraper();
            } else {
                $scraper = new OpenAiScraper();
            }
            
            // Process the URL using the scraper
            $result = $scraper->processUrl($url, true, $enableScrolling, $manualAddress);
            
            // Add proxy information to the result
            $result['proxy_info'] = [
                'enabled' => $proxyConfig['enabled'],
                'ip' => $proxyIp,
                'host' => $proxyConfig['host'],
                'port' => $proxyConfig['port'],
                'location' => $proxyConfig['location']
            ];
            
            echo json_encode([
                'success' => true,
                'data' => $result,
                'scraper_type' => $enableScrolling ? 'dynamic' : 'static',
                'proxy_used' => $proxyConfig['enabled'],
                'proxy_location' => $proxyConfig['location']
            ]);
            
        } elseif ($_POST['action'] === 'add_to_inventory') {
            $trailers = $_POST['trailers'] ?? [];
            $dealer_id = $_POST['dealer_id'] ?? $_SESSION['dealer_id'] ?? 1;
            $batch_info = $_POST['batch_info'] ?? null;
            
            // Debug logging with batch information
            if ($batch_info) {
                error_log("Add to inventory BATCH request - Batch {$batch_info['batch_number']}/{$batch_info['total_batches']} - Trailers count: " . count($trailers));
            } else {
                error_log("Add to inventory request - Trailers count: " . count($trailers));
            }
            error_log("Dealer ID: " . $dealer_id);
            error_log("Session dealer_id: " . ($_SESSION['dealer_id'] ?? 'not set'));
            
            if (empty($trailers)) {
                throw new Exception('No trailers data provided');
            }
            
            $scraper = new OpenAiScraper();
            $result = $scraper->saveToInventory($trailers, $dealer_id);
            
            // Add batch info to response for logging
            if ($batch_info) {
                $result['batch_info'] = $batch_info;
            }
            
            echo json_encode($result);
            
        } elseif ($_POST['action'] === 'mark_missing_as_sold') {
            $scraped_stock_ids = $_POST['scraped_stock_ids'] ?? [];
            $dealer_id = $_POST['dealer_id'] ?? $_SESSION['dealer_id'] ?? 1;
            
            error_log("Mark missing as sold request - Stock IDs count: " . count($scraped_stock_ids));
            error_log("Dealer ID: " . $dealer_id);
            
            if (empty($scraped_stock_ids)) {
                throw new Exception('No scraped stock IDs provided');
            }
            
            $scraper = new OpenAiScraper();
            $result = $scraper->markMissingTrailersAsSold($scraped_stock_ids, $dealer_id);
            
            echo json_encode($result);
            
        } else {
            throw new Exception('Invalid action');
        }
    } catch (Exception $e) {
        // Clean any output that might have been generated
        ob_clean();
        echo json_encode([
            'success' => false,
            'error' => $e->getMessage()
        ]);
    }
    
    // End output buffering and exit
    ob_end_flush();
    exit;
}
?>

<!-- Scraper Dashboard -->
<div class="scraper-overview">
    <!-- Page Header -->
    <div class="main-header">
        <div>
            <h1 class="header-title">Web Scraper</h1>
            <p class="header-subtitle">Extract trailer data from websites</p>
            <div id="proxyStatus" class="proxy-status" style="display: none; margin-top: 10px;">
                <span class="proxy-indicator" style="background: #28a745; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
                    🌐 Kansas City Proxy Active
                </span>
            </div>
        </div>
    </div>



    <!-- Scraper Grid Layout -->
    <div class="scraper-grid">
        <!-- URL Input Section -->
        <div class="card scraper-input-card" style="max-width: 800px; margin: 0 auto; width: 90%; display: flex; flex-direction: column; align-items: center;">
            <!-- Loading Message Area (at top of card) -->
            <div id="loadingMessageArea" class="loading-message-area" style="display: none; width: 100%; text-align: center; margin-bottom: 20px; padding: 15px; background: #e3f2fd; border: 1px solid #90caf9; border-radius: 8px;">
                <div class="loading-content" style="display: flex; flex-direction: column; align-items: center; gap: 10px;">
                    <div class="loading-spinner"></div>
                    <div class="loading-text" style="color: #1976d2; font-weight: 500; font-size: 1rem;">Scraping data...</div>
                </div>
            </div>
            
            <div class="section-header" style="width: 100%; text-align: center;">
                <h2 class="section-title">URL Input</h2>
            </div>
            
            <form id="scraperForm" class="scraper-form" style="width: 100%; max-width: 600px;">
                <div class="form-group">
                    <label for="url" class="form-label">Enter URL to scrape:</label>
                    <div class="url-input-container">
                        <input 
                            type="url" 
                            id="url" 
                            name="url" 
                            required 
                            placeholder="https://example.com/trailers"
                            class="form-input"
                            autocomplete="off"
                        >
                        <div id="urlSuggestions" class="url-suggestions">
                            <div class="suggestions-header">
                                <span>Recent URLs</span>
                                <button type="button" class="btn btn--icon" onclick="hideUrlSuggestions()">
                                    <!-- <span aria-label="Close">&times;</span> -->
                                </button>
                            </div>
                            <div id="suggestionsList" class="scraper-url-suggestions-list">
                                <div class="suggestion-item">
                                    <span class="suggestion-url-main">trailertown.com</span>
                                    <span class="suggestion-meta">(1×, 7/4/2025)</span>
                                    <button class="btn btn--icon" title="Use" onclick="selectUrlSuggestion('https://www.trailertown.com/all-inventory/')">&#8593;</button>
                                    <button class="btn btn--icon btn--danger" title="Delete" onclick="deleteUrlSuggestion(1)">
                                        <svg class="scraper-url-suggestion-delete-icon" xmlns="http://www.w3.org/2000/svg" height="20" width="20" viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-2 14H7L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>
                                    </button>
                                    <button class="btn btn--icon" title="Remove from list" onclick="deleteUrlSuggestion(1)">&times;</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- City Proxy Selector -->
                <div id="cityProxySelector">
                    <div style="text-align: center; color: #666; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
                        <span>🌐 Loading City Proxy Selector...</span>
                    </div>
                </div>
                
                <div class="form-group">
                    <label for="manualAddress" class="form-label" style="color: #2563eb; font-weight: 600;">
                        🗺️ Enter City, State (Optional):
                    </label>
                    <input 
                        type="text" 
                        id="manualAddress" 
                        name="manualAddress" 
                        placeholder="e.g., San Ramon, California or Houston, Texas"
                        class="form-input"
                        autocomplete="off"
                        style="border: 2px solid #3b82f6; border-radius: 6px; padding: 0.75rem;"
                    >
                    <div class="form-help" style="font-size: 0.85rem; color: #1e40af; margin-top: 0.5rem; font-weight: 500;">
                        💡 If provided, this address will be used for Facebook listings instead of scraped addresses
                    </div>
                </div>
                <div class="form-group" style="display: none !important; visibility: hidden !important; position: absolute !important; left: -9999px !important;">
                    <label class="form-label" style="display: none !important;">
                        <input
                            type="checkbox"
                            id="enableScrolling"
                            name="enableScrolling"
                            checked
                            style="display: none !important; visibility: hidden !important; position: absolute !important; left: -9999px !important;"
                        >
                        Enable Dynamic Content Loading (Recommended for sites with lazy loading)
                    </label>
                </div>
 
                <button 
                    type="submit" 
                    class="btn btn--primary scraper-submit-btn"
                    id="submitBtn"
                >
                    <div class="icon icon--search"></div>
                    <span>Scrape</span>
                </button>
                
                <!-- Automation Buttons -->
                <div style="display: flex; gap: 10px; margin-top: 1rem;">
                    <button 
                        type="button" 
                        class="btn btn--success scraper-automation-btn"
                        id="fullAutomationBtn"
                        style="flex: 1;"
                        title="Processes trailers, opens Facebook Marketplace tabs, fills forms, and automatically publishes vehicles"
                    >
                        <span>🚀 Full Automation</span>
                    </button>
                    <button 
                        type="button" 
                        class="btn btn--warning scraper-automation-btn"
                        id="semiAutomationBtn"
                        style="flex: 1;"
                        title="Processes trailers and opens Facebook Marketplace tabs - fills forms but requires manual publishing"
                    >
                        <span>⚡ Semi Automation</span>
                    </button>
                </div>
                <!-- Delete Old Listings Button -->
                <button 
                    type="button" 
                    class="btn btn--danger scraper-delete-btn"
                    id="deleteOldListingsBtn"
                    style="margin-top: 1rem;"
                >
                    <div class="icon icon--trash"></div>
                    <span>Delete Old FB Listings (older than 14 days)</span>
                </button>
                

            </form>
        </div>

        <!-- Loading Section -->
        <div id="loading" class="card scraper-loading-card" style="display: none;">
            <div class="loading-content">
                <div class="loading-spinner"></div>
                <div class="loading-text">Scraping data...</div>
            </div>
        </div>

        <!-- Results Section -->
        <div id="results" class="scraper-results" style="display: none;">
            <!-- Results Header -->
            <div class="card results-header-card">
                <div class="results-header">
                    <div class="results-title">
                        <h2 class="section-title">Scraped Trailers</h2>
                        <div class="results-count">
                            <div class="icon icon--contract"></div>
                            <span id="trailerCount">0</span> found
                        </div>
                    </div>
                </div>
                
                <!-- Additional Search Form -->
                <form id="newSearchForm" class="new-search-form">
                    <div class="search-input-group">
                        <input 
                            type="url" 
                            id="newUrl" 
                            name="newUrl" 
                            required 
                            placeholder="Enter another URL to scrape more trailers"
                            class="form-input"
                        >
                        <button type="submit" class="btn btn--primary">
                            <div class="icon icon--plus"></div>
                            <span>Add More</span>
                        </button>
                    </div>
                </form>
                
                <!-- Filter and Export Controls -->
                <div class="results-controls">
                    <div class="search-bar">
                        <input 
                            type="text" 
                            id="filterInput" 
                            placeholder="Filter trailers by title or description..."
                        >
                        <div class="icon icon--search"></div>
                    </div>
                    
                    <!-- Batch Processing Controls -->
                    <div class="batch-controls" style="display: none;">
                        <button id="selectAllBtn" type="button" class="btn btn--outlined btn--small">
                            <div class="icon icon--check-mark"></div>
                            <span>Select All</span>
                        </button>
                        <button id="deselectAllBtn" type="button" class="btn btn--outlined btn--small">
                            <div class="icon icon--close"></div>
                            <span>Deselect All</span>
                        </button>
                        <button id="batchProcessBtn" type="button" class="btn btn--primary btn--small">
                            <div class="icon icon--ai-communications"></div>
                            <span>Extract Details (<span id="selectedCount">0</span>)</span>
                        </button>
                    </div>
                    
                    <button id="exportBtn" type="button" class="btn btn--secondary">
                        <div class="icon icon--upload"></div>
                        <span>Export JSON</span>
                    </button>
                    <button id="addToInventoryBtn" type="button" class="btn btn--primary">
                        <div class="icon icon--plus"></div>
                        <span>Add to Inventory</span>
                    </button>
                </div>
            </div>

            <!-- Batch Processing Progress -->
            <div id="batchProgress" class="batch-progress-enhanced" style="display: none;">
                <div class="progress-container-enhanced">
                    <div class="progress-header-enhanced">
                        <div class="progress-title-section">
                            <h3 class="progress-title">Extracting Trailer Details</h3>
                            <div class="progress-stats-enhanced">
                                <span id="progressCurrent">0</span> / <span id="progressTotal">0</span> completed
                            </div>
                        </div>
                        <div class="progress-percentage">
                            <span id="progressPercent"></span><span id="progressPercentSymbol">%</span>
                        </div>
                    </div>
                    <div class="progress-bar-enhanced">
                        <div id="progressBar" class="progress-fill-enhanced"></div>
                    </div>
                    <div id="progressStatus" class="progress-status-enhanced">Initializing...</div>
                </div>
            </div>

            <!-- Trailers Grid -->
            <div id="trailersGrid" class="trailers-grid">
                <!-- Trailer cards will be inserted here by JavaScript -->
            </div>
        </div>

        <!-- Error Messages -->
        <div id="errorMessage" class="alert alert--danger" style="display: none;">
            <div class="alert__icon">
                <div class="icon icon--alert-error"></div>
            </div>
            <div class="alert__content">
                <div class="alert__content-title">Error</div>
                <div class="alert__content-subtitle" id="errorText"></div>
            </div>
        </div>
    </div>
</div>

<!-- Trailer Details Modal -->
<div class="modal-overlay" id="trailerDetailsModal">
    <div class="modal-container modal-container--large">
        <div class="modal-header">
            <h3>
                <div class="icon icon--contract"></div>
                Trailer Details
            </h3>
            <div class="modal-header-actions">
                <a id="verifyDetailsLink" href="#" target="_blank" class="btn btn--outlined">
                    <div class="icon icon--globe-filled"></div>
                    <span>Verify Details</span>
                </a>
                <button class="btn btn--primary" id="createListingBtn">
                    <div class="icon icon--plus"></div>
                    <span>Create Listing</span>
                </button>
                <button type="button" class="btn btn--icon modal-close" onclick="closeTrailerModal()">
                    <div class="icon icon--close"></div>
                </button>
            </div>
        </div>
        
        <div class="modal-body">
            <!-- Loading State -->
            <div id="modalLoading" class="modal-loading">
                <div class="loading-spinner"></div>
                <div class="loading-text">Extracting detailed information...</div>
            </div>

            <!-- Content Container -->
            <div id="modalContent" class="modal-content-container" style="display: none;">
                <!-- Basic Info -->
                <div class="modal-basic-info">
                    <div class="basic-info-header">
                        <h4 id="detailTitle" class="detail-title"></h4>
                        <div class="basic-info-details">
                            <div class="info-item">
                                <span class="info-label">Price:</span>
                                <span id="detailPrice" class="info-value price-value"></span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Stock #:</span>
                                <span id="detailStock" class="info-value"></span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Condition:</span>
                                <span id="detailCondition" class="info-value"></span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Specifications and Images Row -->
                <div class="modal-details-row">
                    <div class="card specifications-card">
                        <div class="section-header">
                            <h3 class="section-title">
                                <div class="icon icon--contract"></div>
                                Specifications
                            </h3>
                        </div>
                        <div id="specificationsGrid" class="specifications-grid">
                            <!-- Specifications will be populated dynamically -->
                        </div>
                    </div>
                    
                    <div class="card images-card">
                        <div class="section-header">
                            <h3 class="section-title">
                                <div class="icon icon--eye"></div>
                                Images (<span id="imageCount">0</span>)
                            </h3>
                            <button id="downloadAllImages" class="btn btn--outlined btn--small">
                                <div class="icon icon--upload"></div>
                                <span>Download All</span>
                            </button>
                        </div>
                        <div id="imageGallery" class="image-gallery">
                            <!-- Images will be populated here -->
                        </div>
                    </div>
                </div>

                <!-- Features -->
                <div class="card features-card">
                    <div class="section-header">
                        <h3 class="section-title">
                            <div class="icon icon--check-mark"></div>
                            Features & Highlights
                        </h3>
                    </div>
                    <ul id="featuresList" class="features-list">
                        <!-- Features will be populated here -->
                    </ul>
                </div>

                <!-- Description -->
                <div class="card description-card">
                    <div class="section-header">
                        <h3 class="section-title">
                            <div class="icon icon--reports"></div>
                            Complete Description
                        </h3>
                        <button id="copyDescription" class="btn btn--outlined btn--small">
                            <div class="icon icon--contract"></div>
                            <span>Copy All Text</span>
                        </button>
                    </div>
                    <textarea id="fullDescription" class="description-textarea" rows="8" readonly></textarea>
                </div>

                <!-- Additional Info -->
                <div id="additionalInfoContainer" class="card additional-info-card" style="display: none;">
                    <div class="section-header">
                        <h3 class="section-title">
                            <div class="icon icon--alert-info"></div>
                            Additional Information
                        </h3>
                    </div>
                    <div id="additionalInfo" class="additional-info-content"></div>
                </div>
            </div>

            <!-- Error State -->
            <div id="modalError" class="alert alert--danger" style="display: none;">
                <div class="alert__icon">
                    <div class="icon icon--alert-error"></div>
                </div>
                <div class="alert__content">
                    <div class="alert__content-title">Error Loading Details</div>
                    <div class="alert__content-subtitle" id="modalErrorText"></div>
                </div>
            </div>
        </div>
    </div>
</div>

<!-- Loading Overlay -->
<div id="loading-overlay" class="loading-overlay" style="display: none;">
    <div class="loading-spinner"></div>
</div>

<!-- Include City Proxy Selector -->
<script>
// Debug script loading
console.log('🔍 Loading City Proxy Selector script...');
console.log('Base path:', '<?php echo isset($base_path) ? $base_path : ''; ?>');
</script>
<script src="<?php echo isset($base_path) ? $base_path : ''; ?>Scraper/app/src/city-proxy-selector.js?r=<?php echo time(); ?>" 
        onload="console.log('✅ City Proxy Selector script loaded successfully')" 
        onerror="console.error('❌ Failed to load City Proxy Selector script')"></script>

<script>
// Initialize City Proxy Selector when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Only initialize if we're on the scraper page
    const cityProxyContainer = document.getElementById('cityProxySelector');
    if (cityProxyContainer) {
        console.log('🌐 City Proxy Selector container found, checking for CityProxySelector class...');
        
        if (typeof CityProxySelector !== 'undefined') {
            console.log('🌐 CityProxySelector class available, initializing...');
            
            try {
                // Initialize the city proxy selector
                window.citySelector = new CityProxySelector('cityProxySelector');
                
                // Listen for proxy city changes to update other components
                window.addEventListener('proxyCityChanged', function(event) {
                    console.log('🌐 Proxy city changed:', event.detail);
                    
                    // Update the proxy status indicator
                    updateProxyStatusDisplay(event.detail);
                    
                    // Refresh proxy information for the scraper
                    if (typeof window.refreshProxyInfo === 'function') {
                        window.refreshProxyInfo();
                    }
                    
                    // Update any cached proxy information
                    if (window.currentProxyIP) {
                        console.log('🔄 Clearing cached proxy IP due to city change');
                        window.currentProxyIP = null;
                        window.currentProxyType = null;
                        window.currentProxySessionBased = null;
                    }
                });
                
                // Function to update proxy status display
                function updateProxyStatusDisplay(cityDetails) {
                    const proxyStatus = document.getElementById('proxyStatus');
                    if (proxyStatus) {
                        const indicator = proxyStatus.querySelector('.proxy-indicator');
                        if (indicator) {
                            indicator.innerHTML = `🌐 ${cityDetails.displayName} Proxy Active`;
                            proxyStatus.style.display = 'block';
                        }
                    }
                }
                
                console.log('✅ City Proxy Selector initialized successfully');
            } catch (error) {
                console.error('❌ Error initializing City Proxy Selector:', error);
                
                // Show error message in the container
                cityProxyContainer.innerHTML = `
                    <div style="text-align: center; color: #dc3545; padding: 20px; border: 1px solid #dc3545; border-radius: 4px; background: #f8d7da;">
                        <strong>⚠️ City Proxy Selector Error:</strong><br>
                        ${error.message}<br>
                        <small>Check console for details</small>
                    </div>
                `;
            }
        } else {
            console.error('❌ CityProxySelector class not found!');
            
            // Show error message in the container
            cityProxyContainer.innerHTML = `
                <div style="text-align: center; color: #856404; padding: 20px; border: 1px solid #856404; border-radius: 4px; background: #fff3cd;">
                    <strong>⚠️ City Proxy Selector Not Available</strong><br>
                    JavaScript class not loaded<br>
                    <small>Check if city-proxy-selector.js is loaded</small>
                </div>
            `;
        }
    } else {
        console.log('🔍 City Proxy Selector container not found on this page');
    }
});
</script>
