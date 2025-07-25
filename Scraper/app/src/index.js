// Global scraper initialization function
window.scraperInit = function() {
    console.log('Scraper module initialized');
    initializeScraper();
};

// Also initialize when DOM is ready (for direct access)
$(document).ready(function() {
    // Check if we're on the scraper page
    if ($('#addToInventoryBtn').length > 0) {
        console.log('Scraper detected on page load, initializing...');
        initializeScraper();
    }
});

// Initialize scraper functionality
function initializeScraper() {
    let allTrailers = [];
    let processedTrailers = []; // Store processed trailer details
    let listedTrailers = []; // Store listed trailers data
    let selectedTrailers = new Set(); // Track selected trailers
    let suppressNextSuggestion = false;
    let manualAddress = ''; // Store manual address for Facebook listings
    
    // Initialize City Proxy Selector
    initializeCityProxySelector();

    // Automation control variables
    let automationState = {
        isRunning: false,
        isPaused: false,
        isStopped: false,
        observer: null,
        processedStocks: new Set(),
        stocksToProcess: [],
        totalProcessed: 0,
        marketplaceOpened: 0,
        pauseResolve: null, // For pausing mid-processing delays
        batchProcessing: false, // Track if batch processing is running
        currentTrailerIndex: 0, // Track current trailer being processed sequentially
        isSequentialMode: false // Track if we're in sequential processing mode
    };

    // Load listed trailers data on initialization
    // loadListedTrailers();

    // Handle initial scraper form submission
    $('#scraperForm').on('submit', function(e) {
        e.preventDefault();
        
        const url = $('#url').val().trim();
        if (!url) {
            showError('Please enter a valid website URL to scrape trailers from');
            return;
        }
        
        // Save URL to database
        saveUrlToDatabase(url);
        
        scrapeUrl(url, true);
    });

    // Handle new search form submission
    $('#newSearchForm').on('submit', function(e) {
        e.preventDefault();
        
        const url = $('#newUrl').val().trim();
        if (!url) {
            showError('Please enter a valid website URL to scrape trailers from');
            return;
        }
        
        scrapeUrl(url, false);
        $('#newUrl').val(''); // Clear the input
    });

    // Function to scrape URL
    function scrapeUrl(url, isInitialSearch = true) {
        showLoading();
        hideError();
        
        // Get scrolling preference first
        const enableScrolling = $('#enableScrolling').is(':checked');
        
        // Get manual address if provided
        const currentManualAddress = $('#manualAddress').val().trim();
        
        if (isInitialSearch) {
            const loadingText = enableScrolling ? 'Scraping, please wait...' : 'Scraping, please wait...';
            $('#submitBtn').prop('disabled', true).html('<div class="icon icon--clock-rotate-left"></div><span>' + loadingText + '</span>');
        }
        
        // Show appropriate loading message in the input card
        if (enableScrolling) {
            $('#loadingMessageArea .loading-text').text('Scraping deeply - this may take longer... please wait...');
        } else {
            $('#loadingMessageArea .loading-text').text('Scraping data...');
        }

        $.ajax({
            url: `${window.baseKeyword}Scraper/index.php`,
            method: 'POST',
            data: {
                action: 'scrape',
                url: url,
                enableScrolling: enableScrolling ? 'true' : 'false',
                manualAddress: currentManualAddress
            },
            dataType: 'json',
            success: function(response) {
                if (response.success) {
                    if (isInitialSearch) {
                        allTrailers = response.data.trailers || [];
                    } else {
                        // Add new trailers to existing ones
                        const newTrailers = response.data.trailers || [];
                        allTrailers = allTrailers.concat(newTrailers);
                    }
                    
                    // Store manual address if provided
                    if (response.data.manual_address) {
                        manualAddress = response.data.manual_address;
                        console.log('Manual address stored:', manualAddress);
                    }
                    
                    renderTrailers();
                    showResults();
                    
                    // Scroll to results section to show user the scraped trailers
                    setTimeout(() => {
                        const resultsSection = document.getElementById('results');
                        if (resultsSection) {
                            resultsSection.scrollIntoView({ 
                                behavior: 'smooth', 
                                block: 'start',
                                inline: 'nearest'
                            });
                        }
                    }, 500); // Small delay to ensure results are rendered
                    
                    // Show consolidated success message with all relevant info
                    const scrollingUsed = response.data.debug_info && response.data.debug_info.scrolling_enabled;
                    const baseMessage = isInitialSearch ? 
                        `Successfully scraped ${response.data.trailers.length} trailers from the URL!` : 
                        `Added ${response.data.trailers.length} more trailers!`;
                    
                    let finalMessage = scrollingUsed ? 
                        baseMessage + ' (Used dynamic content loading)' : 
                        baseMessage;
                    
                    // Add manual address info to the main success message if set
                    if (response.data.manual_address) {
                        finalMessage += ` | Manual address set: ${response.data.manual_address}`;
                    }
                    
                    showSuccess(finalMessage);
                } else {
                    showError(response.error || 'Unable to scrape trailers from this website. Please check the URL and try again.');
                }
            },
            error: function(xhr, status, error) {
                showError('Connection error: Unable to reach the website. Please check your internet connection and try again.');
            },
            complete: function() {
                hideLoading();
                if (isInitialSearch) {
                    $('#submitBtn').prop('disabled', false).html('<div class="icon icon--search"></div><span>Scrape Trailers</span>');
                }
            }
        });
    }

    $('#createListingBtn').on('click', function() {
        // openListingForm();
        openFacebookMarketplace();
    });
    // Add batch processing controls
    $('#selectAllBtn').on('click', function() {
        $('.trailer-checkbox').prop('checked', true);
        updateSelectedCount();
    });

    $('#deselectAllBtn').on('click', function() {
        $('.trailer-checkbox').prop('checked', false);
        updateSelectedCount();
    });

    $('#batchProcessBtn').on('click', function() {
        const selectedUrls = getSelectedTrailerUrls();
        if (selectedUrls.length === 0) {
            showError('Please select at least one trailer to process for batch extraction');
            return;
        }
        
        batchProcessTrailers(selectedUrls);
    });

    // Event delegation for checkbox changes
    $(document).on('change', '.trailer-checkbox', function() {
        updateSelectedCount();
    });

    // Function to update selected count
    function updateSelectedCount() {
        const count = $('.trailer-checkbox:checked').length;
        $('#selectedCount').text(count);
        
        // Show/hide batch controls based on selection
        if (count > 0) {
            $('.batch-controls').show();
        } else {
            $('.batch-controls').hide();
        }
    }

    // Function to get selected trailer URLs
    function getSelectedTrailerUrls() {
        const urls = [];
        $('.trailer-checkbox:checked').each(function() {
            const index = $(this).data('index');
            const trailer = allTrailers[index];
            if (
                trailer &&
                trailer.link &&
                trailer.link !== '#' &&
                !trailer.isProcessed
            ) {
                urls.push({
                    url: trailer.link,
                    index: index
                });
            }
        });
        return urls;
    }

    // 1. Add a global variable to track progress states
    let trailerProgressStates = {};

    // 2. Update batchProcessTrailers to store progress states and not call renderTrailers during processing
    async function batchProcessTrailers(selectedUrls) {
        const totalUrls = selectedUrls.length;

        console.log('🔍 Starting batch processing:', {
            totalUrls,
            automationState: { ...automationState },
            enableScrolling: $('#enableScrolling').is(':checked')
        });

        // Reset any leftover automation state that might interfere with manual processing
        if (automationState.isStopped || !automationState.isRunning) {
            console.log('🔧 Resetting leftover automation state');
            automationState.isStopped = false;
            automationState.isPaused = false;
        }

        // Set batch processing flag
        automationState.batchProcessing = true;

        // Show initial setup progress (no color, no percentage)
        $('#batchProgress').show();
        $('#progressTotal').text(totalUrls);
        $('#progressCurrent').text('0');
        $('#progressPercent').text('');
        $('#progressBar').css('width', '0%').removeClass('progress-fill-enhanced');
        $('#progressStatus').text('Preparing trailers for processing...');
        $('#batchProcessBtn').prop('disabled', true);
        
        // Hide the percentage display initially
        $('#progressPercent').text('');
        $('#progressPercentSymbol').hide();

        // **IMMEDIATE REORDER: Move selected trailers to top before processing starts**
        moveSelectedTrailersToTop(selectedUrls);

        // Set all selected trailers to "started" and show progress bar
        selectedUrls.forEach(({ index }) => {
            allTrailers[index].progressState = { status: 'started', errorMessage: '' };
            addTrailerProgressBar(index);
            updateTrailerProgress(index, 'started');
        });

        // Small delay to show the preparation phase
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Now show the enhanced progress bar with color and percentage for actual processing
        $('#progressBar').addClass('progress-fill-enhanced');
        $('#progressPercent').text('0');
        $('#progressCurrent').text('0');
        $('#progressStatus').text('Starting trailer processing...');
        
        // Show the percentage display
        $('#progressPercentSymbol').show();

        const results = [];
        const errors = [];
        let completedCount = 0;

        for (let i = 0; i < selectedUrls.length; i++) {
            // Check if automation is paused or stopped (only if automation is actually running)
            while (automationState.isPaused && automationState.isRunning) {
                $('#progressStatus').text(`Processing paused... (trailer ${i + 1} of ${totalUrls})`);
                await new Promise(resolve => {
                    automationState.pauseResolve = resolve;
                });
            }

            // Check if automation was stopped (only if automation was actually running)
            if (automationState.isStopped && automationState.isRunning) {
                $('#progressStatus').text('Processing stopped by user');
                break;
            }

            const { url, index } = selectedUrls[i];

            // Show which trailer is currently being processed (no progress bar fill yet)
            $('#progressStatus').text(`Processing trailer ${i + 1} of ${totalUrls}...`);

            updateTrailerProgress(index, 'started');

            try {
                const result = await processSingleTrailer(url, index);
                results.push(result);

                if (result.success) {
                    allTrailers[index].processedDetails = result.data;
                    allTrailers[index].isProcessed = true;
                    allTrailers[index].progressState = { status: 'completed', errorMessage: '' };
                    updateTrailerProgress(index, 'completed');
                    updateTrailerCard(index);
                    
                    // Increment completed count and update progress bar
                    completedCount++;
                    const percentage = Math.round((completedCount / totalUrls) * 100);
                    $('#progressCurrent').text(completedCount);
                    $('#progressPercent').text(percentage);
                    $('#progressBar').css('width', percentage + '%');
                } else {
                    allTrailers[index].progressState = { status: 'failed', errorMessage: result.error || 'Unknown error' };
                    updateTrailerProgress(index, 'failed', result.error || 'Unknown error');
                }
            } catch (error) {
                errors.push({ url, index, error: error.message });
                allTrailers[index].progressState = { status: 'failed', errorMessage: error.message };
                updateTrailerProgress(index, 'failed', error.message);
            }

            // Check if automation is paused before delay (only if automation is running)
            if (automationState.isPaused && automationState.isRunning) {
                $('#progressStatus').text(`Processing paused... (after trailer ${i + 1} of ${totalUrls})`);
                await new Promise(resolve => {
                    automationState.pauseResolve = resolve;
                });
            }

            // Check if automation was stopped (only if automation was running)
            if (automationState.isStopped && automationState.isRunning) {
                $('#progressStatus').text('Processing stopped by user');
                break;
            }

            // Small delay before processing next trailer (pausable)
            await pausableDelay(500);
        }

        $('#batchProgress').hide();
        $('#batchProcessBtn').prop('disabled', false);
        
        // Reset batch processing flag
        automationState.batchProcessing = false;

        const successCount = results.filter(r => r.success).length;
        const errorCount = errors.length;
        
        // Only show 100% if there are actually completed trailers
        if (successCount > 0) {
            $('#progressPercent').text('100');
            $('#progressBar').css('width', '100%');
            $('#progressStatus').text(`Processing completed! ${successCount} successful, ${errorCount} failed`);
            
            // Add completion animation
            $('#progressBar').addClass('progress-completed');
        } else {
            $('#progressStatus').text(`Processing completed! No trailers were successfully processed.`);
        }
        
        // Hide progress after a short delay
        setTimeout(() => {
            $('#batchProgress').hide();
            $('#progressBar').removeClass('progress-completed progress-fill-enhanced');
            $('#progressPercentSymbol').hide();
        }, 2000);
        
        $('#batchProcessBtn').prop('disabled', false);

        if (successCount > 0) {
            showSuccess(`Successfully extracted details for ${successCount} trailers${errorCount > 0 ? ` (${errorCount} failed)` : ''}`);
        } else {
            showError('Unable to extract details from any of the selected trailers. Please try again or check the URLs.');
        }

        if (errors.length > 0) {
            console.error('Batch processing errors:', errors);
        }
    }

    // 3. Fix the reorderTrailerCards function to properly sort based on trailer data
    function reorderTrailerCards() {
        console.log('🔍 Reordering trailer cards...');
        const grid = $('#trailersGrid');
        const cards = grid.find('.trailer-card').get();
        
        console.log('📋 Found cards:', cards.length);
        
        // Create a map of processed trailers by their original index
        const processedTrailers = [];
        const unprocessedTrailers = [];
        
        cards.forEach(card => {
            const index = parseInt($(card).data('index'));
            const trailer = allTrailers[index];
            
            console.log(`🔍 Card ${index}:`, { title: trailer?.title, isProcessed: trailer?.isProcessed });
            
            if (trailer && trailer.isProcessed) {
                processedTrailers.push(card);
            } else {
                unprocessedTrailers.push(card);
            }
        });
        
        console.log('✅ Processed trailers:', processedTrailers.length);
        console.log('⏳ Unprocessed trailers:', unprocessedTrailers.length);
        
        // Clear the grid
        grid.empty();
        
        // Add processed trailers first, then unprocessed
        processedTrailers.forEach(card => {
            grid.append(card);
        });
        
        unprocessedTrailers.forEach(card => {
            grid.append(card);
        });
        
        console.log('🔄 Reordering complete');
    }

    // Alternative: Use a simpler approach - just call renderTrailers but preserve progress
    function renderTrailersPreservingProgress() {
        console.log('🔍 Rendering trailers with progress preservation...');
        const grid = $('#trailersGrid');
        grid.empty();
        
        $('#trailerCount').text(allTrailers.length);

        allTrailers.forEach((trailer, index) => {
            const card = createTrailerCard(trailer, index);
            grid.append(card);
            
            // If this trailer was being processed, restore its progress bar
            if (trailer.progressState) {
                console.log(`🔍 Restoring progress for trailer ${index}:`, trailer.progressState.status);
                addTrailerProgressBar(index);
                updateTrailerProgress(index, trailer.progressState.status, trailer.progressState.errorMessage);
            }
        });
        
        // Update selected count after rendering
        updateSelectedCount();
        console.log('🔄 Rendering complete');
    }

    // Handle Add to Inventory button
    $(document).on('click', '#addToInventoryBtn', function() {
        console.log('Add to Inventory button clicked');
        addTrailersToInventory();
    });

    // Handle Delete Old Listings button
    $('#deleteOldListingsBtn').on('click', function() {
        console.log('Delete Old Listings button clicked');
        deleteOldFacebookListings();
    });
    


    // Handle Semi Automation button
    $('#semiAutomationBtn').on('click', function() {
        console.log('Semi Automation button clicked');
        startAutomation(false); // false = semi automation
    });

    // Handle Full Automation button
    $('#fullAutomationBtn').on('click', function() {
        console.log('Full Automation button clicked');
        startAutomation(true); // true = full automation
    });

    // Handle Pause/Resume Automation button
    $(document).on('click', '#pauseResumeBtn', function() {
        if (automationState.isPaused) {
            resumeAutomation();
        } else {
            pauseAutomation();
        }
    });

    // Handle Stop Automation button
    $(document).on('click', '#stopAutomationBtn', function() {
        stopAutomation();
    });

    // Function to create automation control buttons
    function createAutomationControls() {
        // Remove existing controls if any
        $('#automationControls').remove();
        
        const controlsHtml = `
            <div id="automationControls" class="automation-controls" style="
                position: fixed;
                top: 110px;
                right: 20px;
                z-index: 9999;
                display: flex;
                flex-direction: column;
                gap: 10px;
                background: rgba(255, 255, 255, 0.95);
                padding: 15px;
                border-radius: 10px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.2);
                min-width: 280px;
            ">
                <div style="display: flex; gap: 10px;">
                    <button id="pauseResumeBtn" class="btn btn--warning automation-control-btn" style="
                        padding: 10px 20px;
                        font-size: 14px;
                        font-weight: 600;
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                        transition: all 0.2s ease;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        background: #f59e0b;
                        color: white;
                        flex: 1;
                    ">
                        <span id="pauseResumeIcon">⏸️</span>
                        <span id="pauseResumeText">Pause</span>
                    </button>
                    <button id="stopAutomationBtn" class="btn btn--danger automation-control-btn" style="
                        padding: 10px 20px;
                        font-size: 14px;
                        font-weight: 600;
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                        transition: all 0.2s ease;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        background: #ef4444;
                        color: white;
                        flex: 1;
                    ">
                        <span>🛑</span>
                        <span>Stop</span>
                    </button>
                </div>
                <div id="automationStatus" style="
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 10px 15px;
                    background: rgba(34, 197, 94, 0.1);
                    border-radius: 6px;
                    color: #059669;
                    font-weight: 600;
                    font-size: 14px;
                    justify-content: center;
                ">
                    <span id="statusIcon">🚀</span>
                    <span id="statusText">Running</span>
                </div>
                <div id="automationProgress" style="
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 8px 12px;
                    background: rgba(59, 130, 246, 0.1);
                    border-radius: 6px;
                    color: #1d4ed8;
                    font-weight: 600;
                    font-size: 13px;
                ">
                    <span>📊 Progress:</span>
                    <span id="progressCount">0/0</span>
                </div>
                <div id="automationMarketplace" style="
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 8px 12px;
                    background: rgba(16, 185, 129, 0.1);
                    border-radius: 6px;
                    color: #047857;
                    font-weight: 600;
                    font-size: 13px;
                ">
                    <span>🌐 Marketplace:</span>
                    <span id="marketplaceCount">0 opened</span>
                </div>
            </div>
        `;
        
        $('body').append(controlsHtml);
    }

    // Function to remove automation controls
    function removeAutomationControls() {
        $('#automationControls').remove();
    }

    // Function to update automation status
    function updateAutomationStatus(status, icon, text) {
        $('#statusIcon').text(icon);
        $('#statusText').text(text);
        
        const statusDiv = $('#automationStatus');
        statusDiv.removeClass('running paused stopped');
        statusDiv.addClass(status);
        
        // Update colors based on status
        if (status === 'running') {
            statusDiv.css({
                'background': 'rgba(34, 197, 94, 0.1)',
                'color': '#059669'
            });
        } else if (status === 'paused') {
            statusDiv.css({
                'background': 'rgba(245, 158, 11, 0.1)',
                'color': '#d97706'
            });
        } else if (status === 'stopped') {
            statusDiv.css({
                'background': 'rgba(239, 68, 68, 0.1)',
                'color': '#dc2626'
            });
        }
    }

    // Function to update progress counters
    function updateProgressCounters() {
        $('#progressCount').text(`${automationState.totalProcessed}/${automationState.stocksToProcess.length}`);
        $('#marketplaceCount').text(`${automationState.marketplaceOpened} opened`);
    }

    // Function to create a pausable delay
    function pausableDelay(ms) {
        return new Promise((resolve) => {
            // Only apply pausable logic if automation is actually running
            if (automationState.isPaused && automationState.isRunning) {
                // Store the resolve function so we can call it when resumed
                automationState.pauseResolve = resolve;
            } else {
                setTimeout(() => {
                    // Check if we got paused during the delay (only if automation is running)
                    if (automationState.isPaused && automationState.isRunning) {
                        automationState.pauseResolve = resolve;
                    } else {
                        resolve();
                    }
                }, ms);
            }
        });
    }

    // Function to pause automation
    function pauseAutomation() {
        if (!automationState.isRunning) return;
        
        automationState.isPaused = true;
        console.log('[Automator] ⏸️ Automation paused');
        
        // Update UI
        $('#pauseResumeIcon').text('▶️');
        $('#pauseResumeText').text('Resume');
        updateAutomationStatus('paused', '⏸️', 'Paused');
        
        // Show appropriate message based on what's being paused
        if (automationState.batchProcessing) {
            showSuccess('Automation paused. Processing will pause after the current trailer. Click Resume to continue.');
        } else {
            showSuccess('Automation paused. Click Resume to continue processing.');
        }
    }

    // Function to resume automation
    function resumeAutomation() {
        if (!automationState.isRunning || !automationState.isPaused) return;
        
        automationState.isPaused = false;
        console.log('[Automator] ▶️ Automation resumed');
        
        // If there's a pending delay, resolve it
        if (automationState.pauseResolve) {
            automationState.pauseResolve();
            automationState.pauseResolve = null;
        }
        
        // Update UI
        $('#pauseResumeIcon').text('⏸️');
        $('#pauseResumeText').text('Pause');
        updateAutomationStatus('running', '🚀', 'Running');
        
        showSuccess('Automation resumed. Trailer processing will continue...');
    }

    // Function to stop automation
    function stopAutomation() {
        if (!automationState.isRunning) return;
        
        automationState.isStopped = true;
        automationState.isRunning = false;
        automationState.isPaused = false;
        
        // Disconnect observer if it exists
        if (automationState.observer) {
            automationState.observer.disconnect();
            automationState.observer = null;
        }
        
        console.log('[Automator] 🛑 Automation stopped');
        
        // Update UI and remove controls
        updateAutomationStatus('stopped', '🛑', 'Stopped');
        
        setTimeout(() => {
            removeAutomationControls();
        }, 3000);
        
        showSuccess(`Automation stopped! Successfully processed ${automationState.totalProcessed} of ${automationState.stocksToProcess.length} trailers.`);
        
        // Reset automation state
        automationState = {
            isRunning: false,
            isPaused: false,
            isStopped: false,
            observer: null,
            processedStocks: new Set(),
            stocksToProcess: [],
            totalProcessed: 0,
            marketplaceOpened: 0,
            pauseResolve: null,
            batchProcessing: false,
            currentTrailerIndex: 0,
            isSequentialMode: false
        };
    }

    // Main automation function
    async function startAutomation(isFullAutomation = false) {
        try {
            // Check if automation is already running
            if (automationState.isRunning) {
                showError('Automation is already in progress. Please stop the current automation before starting a new one.');
                return;
            }

            // Initialize automation state
            automationState = {
                isRunning: true,
                isPaused: false,
                isStopped: false,
                observer: null,
                processedStocks: new Set(),
                stocksToProcess: [],
                totalProcessed: 0,
                marketplaceOpened: 0,
                pauseResolve: null,
                batchProcessing: false,
                isFullAutomation: isFullAutomation,
                currentTrailerIndex: 0,
                isSequentialMode: true
            };

            console.log(`[Automator] 🚀 ${isFullAutomation ? 'Full' : 'Semi'} Automation started`);
            
            // Pre-cache proxy information for automation to avoid delays later
            console.log('[Automator] 🔄 Pre-caching proxy information for optimal performance...');
            const cachedProxyIP = await fetchCurrentProxyIP();
            console.log('[Automator] ✅ Proxy information cached:', {
                cachedIP: cachedProxyIP,
                windowCurrentProxyIP: window.currentProxyIP,
                windowCurrentProxyType: window.currentProxyType,
                windowCurrentProxySessionBased: window.currentProxySessionBased
            });
            console.log('[Automator] 🚀 Ready for fast Facebook tab opening');
            
            // Create automation control buttons
            createAutomationControls();
            
            // Show automation started notification
            const automationType = isFullAutomation ? 'Full Automation' : 'Semi Automation';
            const message = isFullAutomation ? 
                'Full Automation Started! Processing trailers, opening Facebook tabs, and preparing listings...' :
                'Semi Automation Started! Processing trailers and opening Facebook tabs (manual listing required)...';
            showSuccess(message);
            
            // Initialize progress counters
            updateProgressCounters();
    
            // 1. Click "Scrape Trailers"
            const scrapeBtn = document.querySelector('#submitBtn');
            if (!scrapeBtn) throw new Error('Scrape Trailers button not found');
            scrapeBtn.click();
            console.log('[Automator] Clicked Scrape Trailers');
            
            // Small delay to allow the loading process to start
            await new Promise(resolve => setTimeout(resolve, 1000));
    
            // 2. Wait for trailers to load (increased timeout for larger datasets)
            console.log('[Automator] Waiting for trailers to load...');
            let logCounter = 0;
            await waitForCondition(() => {
                // Check if automation was stopped
                if (automationState.isStopped) {
                    throw new Error('Automation was stopped by user');
                }
                
                const trailerCards = document.querySelectorAll('.trailer-card');
                const loadingElement = document.getElementById('loading');
                const resultsElement = document.getElementById('results');
                const isLoading = loadingElement && loadingElement.style.display !== 'none';
                const resultsVisible = resultsElement && resultsElement.style.display !== 'none';
                
                // Log every 25 checks (about every 5 seconds) to avoid console spam
                if (logCounter % 25 === 0) {
                    console.log(`[Automator] Current trailer count: ${trailerCards.length}, Loading: ${isLoading}, Results visible: ${resultsVisible}`);
                }
                logCounter++;
                
                // Wait for at least some trailers to load AND loading to be complete AND results to be visible
                return trailerCards.length > 0 && !isLoading && resultsVisible;
            }, 90000); // Increased to 90 seconds for large datasets with dynamic loading
            
            const finalCount = document.querySelectorAll('.trailer-card').length;
            console.log(`[Automator] Trailers loaded: ${finalCount}`);
    
            // 3. Find all trailer cards and checkboxes
            const cards = Array.from(document.querySelectorAll('.trailer-card'));
            let checkedCount = 0;
            for (const card of cards) {
                const stock = card.querySelector('.chip span')?.textContent?.replace('Stock: ', '').trim();
                if (!stock) continue;
                const listedKey = 'fb_listing_date_' + stock;
                if (!localStorage.getItem(listedKey)) {
                    // Not listed, check the box
                    const checkbox = card.querySelector('.trailer-checkbox');
                    if (checkbox && !checkbox.checked) {
                        checkbox.checked = true;
                        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
                        checkedCount++;
                        automationState.stocksToProcess.push(stock);
                        console.log(`[Automator] Checked trailer: ${stock}`);
                    }
                }
            }
            if (checkedCount === 0) {
                showError('No new trailers found to process. All trailers may already have been listed.');
                removeAutomationControls();
                automationState.isRunning = false;
                return;
            }
            console.log(`[Automator] Total trailers checked: ${checkedCount}`);
    
            // 4. Move selected trailers to the top (same as manual batch processing)
            console.log('[Automator] Moving selected trailers to top for better visibility...');
            const selectedUrls = [];
            for (let i = 0; i < cards.length; i++) {
                const card = cards[i];
                const stock = card.querySelector('.chip span')?.textContent?.replace('Stock: ', '').trim();
                if (stock && automationState.stocksToProcess.includes(stock)) {
                    selectedUrls.push({
                        url: allTrailers[i]?.link || '#',
                        index: i
                    });
                }
            }
            moveSelectedTrailersToTop(selectedUrls);
            
            // Small delay to let the reordering complete
            await new Promise(resolve => setTimeout(resolve, 500));
    
            // 5. Skip the batch processing button click and start sequential processing directly
            // We don't want to use the parallel batch processing in automation mode
            console.log('[Automator] Skipping batch processing button - using sequential processing instead');
    
            // 6. NEW SEQUENTIAL PROCESSING: Process trailers one by one completely
            // Show progress tracking
            showSuccess(`Sequential processing started! Processing trailers one by one: Extract Details → Get Proxy → Open Facebook → Complete (${automationState.stocksToProcess.length} total)`);
            
            // Update initial progress counter
            updateProgressCounters();
            
            // Start sequential processing (this will handle extraction sequentially too)
            await processTrailersSequentially();
    
        } catch (err) {
            console.error('[Automator] ❌ Error:', err);
            console.error('[Automator] Stack trace:', err.stack);
            
            // Reset automation state on error
            automationState.isRunning = false;
            removeAutomationControls();
            
            showError('Automation failed: ' + err.message + '\n\nPlease try again or contact support if the issue persists.');
        }
    }

    // NEW: Sequential processing function
    async function processTrailersSequentially() {
        try {
            automationState.isSequentialMode = true;
            automationState.currentTrailerIndex = 0;
            
            console.log(`[Automator] 🔄 Starting sequential processing of ${automationState.stocksToProcess.length} trailers`);
            
            // Process each trailer sequentially
            for (let i = 0; i < automationState.stocksToProcess.length; i++) {
                // Check if automation was stopped
                if (automationState.isStopped) {
                    console.log('[Automator] 🛑 Sequential processing stopped by user');
                    break;
                }
                
                // Check if automation is paused
                while (automationState.isPaused) {
                    console.log('[Automator] ⏸️ Sequential processing paused');
                    await new Promise(resolve => {
                        automationState.pauseResolve = resolve;
                    });
                }
                
                const stock = automationState.stocksToProcess[i];
                automationState.currentTrailerIndex = i;
                
                console.log(`[Automator] 📋 Processing trailer ${i + 1}/${automationState.stocksToProcess.length}: ${stock}`);
                
                // Step 1: Extract trailer details sequentially
                console.log(`[Automator] ⏳ Step 1: Extracting trailer ${stock} details...`);
                await extractSingleTrailerForAutomation(stock);
                
                // Check if stopped during extraction
                if (automationState.isStopped) break;
                
                console.log(`[Automator] ✅ Step 1 Complete: Trailer ${stock} extracted successfully`);
                
                // Add 2-second delay after extraction before opening Facebook
                console.log(`[Automator] ⏳ Waiting 2 seconds after extraction before opening Facebook...`);
                await pausableDelay(2000);
                
                // Step 2: Get trailer data and set current product
                    const card = Array.from(document.querySelectorAll('.trailer-card')).find(card =>
                        card.querySelector('.chip span')?.textContent?.replace('Stock: ', '').trim() === stock
                    );
                
                if (!card) {
                    console.warn(`[Automator] ⚠️ Card not found for stock ${stock}, skipping...`);
                    continue;
                }
                
                        const trailerIndex = parseInt(card.getAttribute('data-index'));
                        const trailer = allTrailers[trailerIndex];
                        
                if (!trailer || !trailer.processedDetails) {
                    console.warn(`[Automator] ⚠️ Trailer ${stock} not properly processed, skipping...`);
                    continue;
                }
                
                            // Mark as processed
                            automationState.processedStocks.add(stock);
                            automationState.totalProcessed++;
                            
                            // Update progress counter
                            updateProgressCounters();
                            
                            // Set current product data for the extension
                            setCurrentProduct(trailer.processedDetails.details, trailer.processedDetails.images || []);
                            
                            // Mark trailer as listed in localStorage
                            const listedKey = 'fb_listing_date_' + stock;
                            localStorage.setItem(listedKey, new Date().toISOString());
                            
                console.log(`[Automator] 📋 Step 2 Complete: Trailer ${stock} data prepared for Facebook`);
                
                // Step 3: Open Facebook Marketplace through proxy (with sequential timing)
                console.log(`[Automator] 🌐 Step 3: Opening Facebook Marketplace for ${stock}...`);
                
                // Open Facebook Marketplace through proxy (no additional delay needed, we already waited 2 seconds)
                await openFacebookMarketplace();
                            automationState.marketplaceOpened++;
                            
                            // Update counters after opening marketplace
                            updateProgressCounters();
                
                console.log(`[Automator] ✅ Step 3 Complete: Facebook tab opened for ${stock}`);
                            
                            // Show progress update
                showSuccess(`Progress Update: ${automationState.totalProcessed}/${automationState.stocksToProcess.length} trailers completed (${stock})`);
                
                // Small delay before next trailer to avoid overwhelming the system
                if (i < automationState.stocksToProcess.length - 1) {
                    await pausableDelay(1000);
                }
            }
            
            // All trailers processed
                    automationState.isRunning = false;
            automationState.isSequentialMode = false;
            
            console.log('[Automator] 🎉 Sequential processing complete!');
            showSuccess(`Automation Complete! All ${automationState.stocksToProcess.length} trailers processed and Facebook tabs opened successfully!`);
                    
                    // Remove automation controls
                    setTimeout(() => {
                        removeAutomationControls();
                showSuccess(`Processing Complete!\n\n${automationState.stocksToProcess.length} trailers processed\n${automationState.stocksToProcess.length} Facebook tabs opened\n\nPerfect timing - Extract Details → Get Proxy → Open Facebook → Complete!`);
                    }, 2000);
            
        } catch (error) {
            console.error('[Automator] ❌ Sequential processing error:', error);
            automationState.isRunning = false;
            automationState.isSequentialMode = false;
            removeAutomationControls();
            showError('Automation failed: ' + error.message + '. Please try again.');
        }
    }

    // NEW: Function to extract a single trailer for automation (sequential)
    async function extractSingleTrailerForAutomation(stock) {
        try {
            // Find the trailer card
            const card = Array.from(document.querySelectorAll('.trailer-card')).find(card =>
                card.querySelector('.chip span')?.textContent?.replace('Stock: ', '').trim() === stock
            );
            
            if (!card) {
                throw new Error(`Trailer card not found for stock ${stock}`);
            }
            
            const trailerIndex = parseInt(card.getAttribute('data-index'));
            const trailer = allTrailers[trailerIndex];
            
            if (!trailer || !trailer.link || trailer.link === '#') {
                throw new Error(`Trailer ${stock} has no valid link for extraction`);
            }
            
            console.log(`[Automator] 🔍 Extracting details for trailer ${stock}: ${trailer.title}`);
            
            // Show progress on the trailer card
            addTrailerProgressBar(trailerIndex);
            updateTrailerProgress(trailerIndex, 'started');
            
            // Get the current scrolling preference
            const enableScrolling = $('#enableScrolling').is(':checked');
            
            // Extract trailer details
            const response = await $.ajax({
                url: `${window.baseKeyword}Scraper/app/api/extract_trailer.php`,
                method: 'POST',
                data: JSON.stringify({ 
                    url: trailer.link,
                    enableScrolling: enableScrolling 
                }),
                contentType: 'application/json',
                dataType: 'json',
                timeout: 30000 // 30 second timeout per trailer
            });
            
            if (response.success && response.data && response.data.details) {
                // Update the trailer with processed details
                allTrailers[trailerIndex].processedDetails = response.data;
                allTrailers[trailerIndex].isProcessed = true;
                allTrailers[trailerIndex].progressState = { status: 'completed', errorMessage: '' };
                
                // Update progress display
                updateTrailerProgress(trailerIndex, 'completed');
                updateTrailerCard(trailerIndex);
                
                console.log(`[Automator] ✅ Successfully extracted details for trailer ${stock}`);
                return response.data;
            } else {
                throw new Error(response.error || 'Failed to extract trailer details');
            }
            
        } catch (error) {
            console.error(`[Automator] ❌ Error extracting trailer ${stock}:`, error);
            
            // Find trailer and update error state
            const card = Array.from(document.querySelectorAll('.trailer-card')).find(card =>
                card.querySelector('.chip span')?.textContent?.replace('Stock: ', '').trim() === stock
            );
            
            if (card) {
                const trailerIndex = parseInt(card.getAttribute('data-index'));
                if (allTrailers[trailerIndex]) {
                    allTrailers[trailerIndex].progressState = { status: 'failed', errorMessage: error.message };
                    updateTrailerProgress(trailerIndex, 'failed', error.message);
                }
            }
            
            throw error;
        }
    }

    // NEW: Function to wait for a specific trailer to be processed
    async function waitForTrailerToBeProcessed(stock) {
        return new Promise((resolve, reject) => {
            const checkInterval = 500; // Check every 500ms
            const maxWaitTime = 60000; // Maximum 60 seconds wait
            let waitedTime = 0;
            
            const checkProcessed = () => {
                // Check if automation was stopped
                if (automationState.isStopped) {
                    reject(new Error('Automation stopped by user'));
                    return;
                }
                
                // Find the trailer card
                const card = Array.from(document.querySelectorAll('.trailer-card')).find(card =>
                    card.querySelector('.chip span')?.textContent?.replace('Stock: ', '').trim() === stock
                );
                
                if (!card) {
                    console.log(`[Automator] ⏳ Waiting for card to appear for stock ${stock}...`);
                    waitedTime += checkInterval;
                    if (waitedTime >= maxWaitTime) {
                        reject(new Error(`Timeout waiting for trailer card ${stock}`));
                        return;
                    }
                    setTimeout(checkProcessed, checkInterval);
                    return;
                }
                
                // Check if the trailer has a Create Listing button (meaning it's processed)
                const createBtn = card.querySelector('.create-listing-btn');
                if (createBtn) {
                    console.log(`[Automator] ✅ Trailer ${stock} is ready with Create Listing button`);
                    resolve();
                    return;
                }
                
                // Not ready yet, keep waiting
                console.log(`[Automator] ⏳ Still waiting for trailer ${stock} to be processed... (${waitedTime/1000}s)`);
                waitedTime += checkInterval;
                if (waitedTime >= maxWaitTime) {
                    reject(new Error(`Timeout waiting for trailer ${stock} to be processed`));
                    return;
                }
                
                setTimeout(checkProcessed, checkInterval);
            };
            
            // Start checking
            checkProcessed();
        });
    }

    // Legacy functions kept for backward compatibility but no longer used in sequential processing
    // These functions are replaced by the new sequential processing approach in startAutomation()
    
    function showMasterCreateListingButton(processedTrailers) {
        console.log('[Legacy] showMasterCreateListingButton called but sequential processing is now used instead');
        // This function is no longer needed with sequential processing
    }

    async function startMasterListingProcess(processedTrailers) {
        console.log('[Legacy] startMasterListingProcess called but sequential processing is now used instead');
        // This function is no longer needed with sequential processing
    }

        // Legacy functions kept for backward compatibility but no longer used in sequential processing
    // These functions are replaced by the new sequential processing approach in startAutomation()
    
    function showMasterCreateListingButton(processedTrailers) {
        console.log('[Legacy] showMasterCreateListingButton called but parallel processing is now used instead');
        // This function is no longer needed with parallel processing
    }

    async function startMasterListingProcess(processedTrailers) {
        console.log('[Legacy] startMasterListingProcess called but parallel processing is now used instead');
        // This function is no longer needed with parallel processing
    }

    // Utility: Wait for a selector to appear
    function waitForSelector(selector, timeout = 30000) {
        return new Promise((resolve, reject) => {
            const interval = 100;
            let waited = 0;
            const check = () => {
                const el = document.querySelector(selector);
                if (el) return resolve(el);
                waited += interval;
                if (waited >= timeout) return reject('Timeout waiting for ' + selector);
                setTimeout(check, interval);
            };
            check();
        });
    }

    // Utility: Wait for a condition to be true
    function waitForCondition(fn, timeout = 45000) {
        return new Promise((resolve, reject) => {
            const interval = 200;
            let waited = 0;
            const check = () => {
                if (fn()) return resolve();
                waited += interval;
                if (waited >= timeout) return reject('Timeout waiting for condition');
                setTimeout(check, interval);
            };
            check();
        });
    }

    // Function to render trailers
    function renderTrailers() {
        const grid = $('#trailersGrid');
        grid.empty();
        
        $('#trailerCount').text(allTrailers.length);

        allTrailers.forEach((trailer, index) => {
            const card = createTrailerCard(trailer, index);
            grid.append(card);
            
            // If this trailer was being processed, restore its progress bar
            if (trailer.progressState) {
                addTrailerProgressBar(index);
                updateTrailerProgress(index, trailer.progressState.status, trailer.progressState.errorMessage);
            }
        });
        
        // Update selected count after rendering
        updateSelectedCount();
    }

    // 5. Update updateTrailerProgress to store the state and show better visual feedback
    function updateTrailerProgress(index, status, errorMessage = '') {
        const trailerCard = $(`.trailer-card[data-index="${index}"]`);
        if (trailerCard.length === 0) return;
        
        const progressContainer = trailerCard.find('.trailer-progress-container');
        if (progressContainer.length === 0) return;
        
        const statusElement = progressContainer.find('.trailer-progress-status');
        const iconElement = progressContainer.find('.trailer-progress-icon');
        const progressFill = progressContainer.find('.trailer-progress-fill');
        
        // Store the progress state in the trailer data
        allTrailers[index].progressState = { status, errorMessage };
        
        // Remove all state classes first
        progressFill.removeClass('progress-success progress-error processing');
        
        switch (status) {
            case 'started':
                statusElement.html('<div class="loading-spinner loading-spinner--inline"></div> Processing...');
                iconElement.text('⏳');
                progressFill.css('width', '60%'); // You can set to 60% or 80% for effect
                progressFill.addClass('processing');
                trailerCard.addClass('trailer-processing');
                break;
            case 'completed':
                statusElement.text('Completed!');
                iconElement.text('✅');
                progressFill.css('width', '100%');
                progressFill.addClass('progress-success');
                trailerCard.removeClass('trailer-processing').addClass('trailer-completed');
                break;
            case 'failed':
                statusElement.text(errorMessage || 'Failed');
                iconElement.text('❌');
                progressFill.css('width', '100%');
                progressFill.addClass('progress-error');
                trailerCard.removeClass('trailer-processing').addClass('trailer-failed');
                break;
        }
    }

    // Function to add progress bar to a specific trailer card
    function addTrailerProgressBar(index) {
        const trailerCard = $(`.trailer-card[data-index="${index}"]`);
        if (trailerCard.length === 0) return;
        
        // Remove existing progress bar if any
        trailerCard.find('.trailer-progress-container').remove();
        
        const progressHtml = `
            <div class="trailer-progress-container">
                <div class="trailer-progress-header">
                    <span class="trailer-progress-status">
                        <div class="loading-spinner loading-spinner--inline"></div>
                        Initializing...
                    </span>
                    <span class="trailer-progress-icon">⏳</span>
                </div>
                <div class="trailer-progress-bar">
                    <div class="trailer-progress-fill"></div>
                </div>
            </div>
        `;
        
        // Add progress bar after the trailer card content
        const cardContent = trailerCard.find('.trailer-card-content');
        cardContent.after(progressHtml);
        
        // Add processing class to the card
        trailerCard.addClass('trailer-processing');
    }

    // Function to process single trailer
    function processSingleTrailer(url, index) {
        return new Promise((resolve, reject) => {
            // Get the current scrolling preference
            const enableScrolling = $('#enableScrolling').is(':checked');
            
            console.log(`🔍 Processing trailer ${index}:`, {
                url,
                enableScrolling,
                automationState: { ...automationState }
            });
            
            $.ajax({
                url: `${window.baseKeyword}Scraper/app/api/extract_trailer.php`,
                method: 'POST',
                data: JSON.stringify({ 
                    url: url,
                    enableScrolling: enableScrolling 
                }),
                contentType: 'application/json',
                dataType: 'json',
                success: function(response) {
                    console.log(`✅ Trailer ${index} processed successfully:`, response);
                    if (response.success) {
                        resolve({
                            success: true,
                            data: response.data,
                            index: index
                        });
                    } else {
                        console.error(`❌ Trailer ${index} processing failed:`, response.error);
                        reject(new Error(response.error || 'Unknown error'));
                    }
                },
                error: function(xhr, status, error) {
                    console.error(`❌ Network error for trailer ${index}:`, {
                        status,
                        error,
                        response: xhr.responseJSON,
                        url
                    });
                    let errorMessage = 'Network error occurred';
                    if (xhr.responseJSON && xhr.responseJSON.error) {
                        errorMessage = xhr.responseJSON.error;
                    } else if (error) {
                        errorMessage = 'Error: ' + error;
                    }
                    reject(new Error(errorMessage));
                }
            });
        });
    }

    // Function to parse trailer title into components
    function parseTrailerTitle(title) {
        if (!title) return { year: "", make: "", model: "" };
        
        console.log("🔍 Parsing title:", title);
        
        // Remove common prefixes
        let cleanTitle = title.replace(/^(New|Used)\s+/i, "").trim();
        
        // Extract year (4 digits, usually at the beginning)
        const yearMatch = cleanTitle.match(/\b(19|20)\d{2}\b/);
        const year = yearMatch ? yearMatch[0] : "";
        
        // Remove year from title
        if (year) {
            cleanTitle = cleanTitle.replace(year, "").trim();
        }
        
        // Common trailer manufacturers
        const manufacturers = [
            'IRON BULL', 'IRONBULL', 'LOAD TRAIL', 'LOADTRAIL', 'BIG TEX', 'BIGTEX',
            'PJ TRAILERS', 'PJ', 'SURE-TRAC', 'SURETRAC', 'DIAMOND C', 'DIAMONDC',
            'LAMAR', 'GATORMADE', 'GATOR MADE', 'CARRY-ON', 'CARRYON', 'WELLS CARGO',
            'CARGO MATE', 'CARGOMATE', 'HAULMARK', 'CONTINENTAL CARGO', 'PACE AMERICAN',
            'HOMESTEADER', 'LOOK', 'UNITED', 'INTERSTATE', 'CROSS', 'FORMULA',
            'NEXHAUL', 'ALUMA', 'ALUMINUM', 'STEEL', 'UTILITY', 'DUMP', 'FLATBED',
            'ENCLOSED', 'GOOSENECK', 'BUMPER PULL'
        ];
        
        let make = "";
        let model = cleanTitle;
        
        // Try to find manufacturer in the title
        for (const manufacturer of manufacturers) {
            const regex = new RegExp(`\\b${manufacturer}\\b`, 'i');
            if (regex.test(cleanTitle)) {
                make = manufacturer;
                // Remove manufacturer from model
                model = cleanTitle.replace(regex, "").trim();
                break;
            }
        }
        
        // If no specific manufacturer found, try to extract first 1-2 words as make
        if (!make) {
            const words = cleanTitle.split(' ');
            if (words.length >= 2) {
                // Check if first two words might be a compound manufacturer name
                const firstTwo = words.slice(0, 2).join(' ');
                if (firstTwo.length <= 15) { // Reasonable manufacturer name length
                    make = firstTwo;
                    model = words.slice(2).join(' ');
                } else {
                    make = words[0];
                    model = words.slice(1).join(' ');
                }
            } else {
                make = cleanTitle;
                model = cleanTitle;
            }
        }
        
        // Clean up model - remove extra spaces
        model = model.replace(/\s+/g, ' ').trim();
        
        const result = {
            year: year,
            make: make.toUpperCase(),
            model: model
        };
        
        console.log("📋 Parsed components:", result);
        return result;
    }

    // **TEST FUNCTION: Verify state expansion works correctly**
    function testStateExpansion() {
        console.log("🧪 Testing State Expansion Function:");
        
        const testCases = [
            "Holt, MO",
            "San Ramon, CA", 
            "SanRamon, CA",
            "Dallas TX",
            "Miami FL 33101",
            "Phoenix AZ",
            "New York, NY",
            "Los Angeles CA",
            "Chicago, IL",
            "Houston TX 77001",
            "Philadelphia, PA",
            "San Antonio TX",
            "Boston, MA",
            "Invalid Location",
            "Some City, XX", // Invalid state
            "Just a City Name"
        ];
        
        testCases.forEach(testCase => {
            const result = expandStateAbbreviation(testCase);
            const changed = result !== testCase;
            console.log(`${changed ? '✅' : '➡️'} "${testCase}" → "${result}"`);
        });
        
        console.log("🧪 State expansion testing complete!");
    }

    // Function to expand state abbreviations to full state names
    function expandStateAbbreviation(location) {
        if (!location || typeof location !== 'string') {
            return location;
        }
        
        // State abbreviation mapping
        const stateMap = {
            'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
            'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia',
            'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
            'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
            'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri',
            'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
            'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
            'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
            'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont',
            'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming',
            'DC': 'District of Columbia'
        };
        
        // Pattern to match common location formats with state abbreviations
        // Examples: "Holt, MO", "San Ramon, CA", "Dallas TX", "Miami FL 33101"
        const patterns = [
            // Pattern 1: City, ST (with comma)
            /^(.+),\s*([A-Z]{2})(?:\s+\d{5})?$/,
            // Pattern 2: City ST (without comma)
            /^(.+)\s+([A-Z]{2})(?:\s+\d{5})?$/,
            // Pattern 3: Just the state abbreviation at the end
            /^(.+)\s+([A-Z]{2})$/
        ];
        
        for (const pattern of patterns) {
            const match = location.trim().match(pattern);
            if (match) {
                const cityPart = match[1].trim();
                const stateAbbr = match[2].toUpperCase();
                
                if (stateMap[stateAbbr]) {
                    const expandedLocation = `${cityPart}, ${stateMap[stateAbbr]}`;
                    console.log(`🗺️ Expanded location: "${location}" → "${expandedLocation}"`);
                    return expandedLocation;
                }
            }
        }
        
        // If no pattern matches, return original location
        console.log(`🗺️ No state abbreviation found in: "${location}"`);
        return location;
    }

    async function openFacebookMarketplace() {
        const product = window.currentProduct;
    
        if (!product || !product.title) {
            alert("⚠️ No product selected or incomplete product data. Please select a valid trailer first.");
            return;
        }
        
        // Smart proxy caching: Only fetch fresh proxy IP if we don't have one or in manual mode
        // In automation mode, reuse the cached proxy to avoid delays
        let fetchedProxyIP;
        
        if (automationState.isRunning && window.currentProxyIP && window.currentProxyIP !== "173.172.64.37") {
            // Automation mode with valid cached proxy - skip fetch to avoid delay
            console.log('⚡ Automation mode: Using cached proxy IP to avoid delay:', window.currentProxyIP);
            fetchedProxyIP = window.currentProxyIP;
        } else {
            // Manual mode or no cached proxy - fetch fresh proxy IP
        console.log('🔄 Fetching current session-based proxy IP for Facebook listing...');
            fetchedProxyIP = await fetchCurrentProxyIP();
        
        // Wait a moment to ensure variables are set
        await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Debug: Log current proxy state
        console.log('🎯 Current proxy state after fetch:', {
            fetchedProxyIP: fetchedProxyIP,
            currentProxyIP: window.currentProxyIP,
            currentProxyType: window.currentProxyType,
            currentProxySessionBased: window.currentProxySessionBased,
            variablesMatch: fetchedProxyIP === window.currentProxyIP,
            automationMode: automationState.isRunning,
            usedCache: automationState.isRunning && window.currentProxyIP && window.currentProxyIP !== "173.172.64.37"
        });
        
        // Ensure we have the correct proxy IP
        if (!window.currentProxyIP || window.currentProxyIP === "173.172.64.37") {
            console.warn('⚠️ Global proxy variables not set correctly, using fetched IP directly');
            window.currentProxyIP = fetchedProxyIP;
        }
    
        // Extract and clean the data
        const cleanPrice = (product.price || "").replace(/[$,]/g, ""); // Remove $ and commas
        
        // Get the best available location with fallback logic
        let location = "United States"; // default
        
        // **NEW: Use manual address first if provided**
        if (manualAddress && manualAddress.trim()) {
            location = manualAddress;
            console.log('🗺️ Using manual address:', location);
        } else if (product.location && product.location.trim() && product.location !== "N/A") {
            location = product.location;
        } else if (product.dealer_address && product.dealer_address.trim()) {
            location = product.dealer_address;
        } else if (product.dealer_name && product.dealer_name.trim() && product.dealer_name.includes(',')) {
            location = product.dealer_name;
        }
        
        // **NEW: Expand state abbreviations for better Facebook detection**
        location = expandStateAbbreviation(location);
        
        // Build comprehensive description similar to CRM modal
        let description = '';
        
        // Start with original description if available
        if (product.description && product.description.trim()) {
            description += product.description + '\n\n';
        }
        
        // Add additional info if different from description
        if (product.additional_info && product.additional_info !== product.description && product.additional_info.trim()) {
            description += 'Additional Information:\n' + product.additional_info + '\n\n';
        }
        
        // Parse the title to extract components
        const parsedTitle = parseTrailerTitle(product.title);
        
        // Build comprehensive specifications (similar to CRM modal)
        const specs = [];
        
        // Basic info
        if (product.brand || product.manufacturer || parsedTitle.make) {
            const rawMake = product.brand || product.manufacturer || parsedTitle.make;
            const makeWithCondition = product.condition && product.condition !== "N/A" ? 
                `${product.condition} ${rawMake}` : rawMake;
            specs.push(`Brand/Manufacturer: ${makeWithCondition}`);
        }
        if (product.model || parsedTitle.model) specs.push(`Model: ${product.model || parsedTitle.model}`);
        if (product.year || parsedTitle.year) specs.push(`Year: ${product.year || parsedTitle.year}`);
        if (product.condition && product.condition !== "N/A") specs.push(`Condition: ${product.condition}`);
        if (product.status) specs.push(`Status: ${product.status}`);
        if (product.type) specs.push(`Type: ${product.type}`);
        if (product.category) specs.push(`Category: ${product.category}`);
        if (product.vin) specs.push(`VIN: ${product.vin}`);
        if (product.stock_number) specs.push(`Stock: ${product.stock_number}`);
        
        // Dimensions
        if (product.floor_length) specs.push(`Floor Length: ${product.floor_length}`);
        if (product.floor_width) specs.push(`Floor Width: ${product.floor_width}`);
        if (product.length_total) specs.push(`Total Length: ${product.length_total}`);
        if (product.width_total) specs.push(`Total Width: ${product.width_total}`);
        if (product.floor_height) specs.push(`Floor Height: ${product.floor_height}`);
        if (product.dimensions && !product.floor_length) specs.push(`Dimensions: ${product.dimensions}`);
        
        // Weight & Capacity
        if (product.weight) specs.push(`Weight: ${product.weight}`);
        if (product.empty_weight && product.empty_weight !== product.weight) specs.push(`Empty Weight: ${product.empty_weight}`);
        if (product.axle_capacity) specs.push(`Axle Capacity: ${product.axle_capacity}`);
        if (product.axles) specs.push(`Number of Axles: ${product.axles}`);
        
        // Construction & Design
        if (product.construction) specs.push(`Construction: ${product.construction}`);
        if (product.color) specs.push(`Color: ${product.color}`);
        if (product.pull_type) specs.push(`Pull Type: ${product.pull_type}`);
        if (product.rental) specs.push(`Rental: ${product.rental}`);
        
        if (specs.length > 0) {
            description += 'Specifications:\n' + specs.join('\n') + '\n\n';
        }
        
        // Add features if available
        if (product.features && Array.isArray(product.features) && product.features.length > 0) {
            description += 'Features:\n' + product.features.map(f => `• ${f}`).join('\n');
        }
        
        // **FIXED: Collect image URLs for automatic download/upload**
        const imageUrls = [];
        
        // **PRIORITY 1: Check if product has images from processed details**
        if (product.images && Array.isArray(product.images) && product.images.length > 0) {
            console.log("📸 Found images in product.images:", product.images);
            product.images.forEach(img => {
                if (typeof img === 'string') {
                    // If images is an array of strings (URLs)
                    imageUrls.push(img);
                } else if (img && img.url) {
                    // If images is an array of objects with url property
                    imageUrls.push(img.url);
                }
            });
        }
        
        // **PRIORITY 2: Check if there are images in the DOM (from image gallery)**
        if (imageUrls.length === 0) {
            console.log("🔍 No images in product.images, checking DOM gallery...");
            const galleryImages = document.querySelectorAll('#imageGallery img');
            galleryImages.forEach(img => {
                const src = img.getAttribute('src');
                if (src && src.startsWith('http')) {
                    imageUrls.push(src);
                }
            });
        }
        
        // **PRIORITY 3: Check if there's a single image from the original trailer data**
        if (imageUrls.length === 0 && product.singleImage) {
            console.log("🔍 Using single image from trailer data:", product.singleImage);
            imageUrls.push(product.singleImage);
        }
        
        // Limit to 20 images (Facebook Marketplace limit)
        const limitedImages = imageUrls.slice(0, 20);
        
        console.log(`📸 Final image URLs for upload (${limitedImages.length}):`, limitedImages);
        
        // **NEW: Combine condition with make**
        const rawMake = parsedTitle.make || product.make || "Unknown";
        const condition = product.condition && product.condition !== "N/A" ? product.condition : "Used";
        const combinedMake = `${condition} ${rawMake}`;

        // Final proxy check - get fresh proxy info right before payload creation
        let finalProxyIP = window.currentProxyIP;
        let finalProxyType = window.currentProxyType;
        let finalSessionBased = window.currentProxySessionBased;
        
        // If we still have fallback AND not in automation mode, try one more direct API call
        if ((!finalProxyIP || finalProxyIP === "173.172.64.37" || finalProxyType === "fallback") && !automationState.isRunning) {
            console.log('🔄 Making direct API call for proxy info before payload creation...');
            try {
                const response = await fetch(`${window.baseKeyword}Scraper/app/api/get_proxy_ip.php`);
                const data = await response.json();
                if (data.success && data.proxy_info.ip) {
                    finalProxyIP = data.proxy_info.ip;
                    finalProxyType = data.proxy_info.type || 'unknown';
                    finalSessionBased = data.proxy_info.type === 'session_persistent';
                    
                    // Update global variables too
                    window.currentProxyIP = finalProxyIP;
                    window.currentProxyType = finalProxyType;
                    window.currentProxySessionBased = finalSessionBased;
                    
                    console.log('✅ Direct API call successful, updated proxy info:', {
                        finalProxyIP, finalProxyType, finalSessionBased
                    });
                }
            } catch (error) {
                console.warn('⚠️ Direct API call failed, using current values:', error);
            }
        } else if (automationState.isRunning) {
            console.log('⚡ Automation mode: Using cached proxy values');
            console.log('🔍 Initial proxy values:', {
                finalProxyIP, finalProxyType, finalSessionBased
            });
            console.log('🔍 Window proxy values:', {
                windowCurrentProxyIP: window.currentProxyIP,
                windowCurrentProxyType: window.currentProxyType,
                windowCurrentProxySessionBased: window.currentProxySessionBased
            });
            
            // In automation mode, always use the window values (which should be cached from startup)
            finalProxyIP = window.currentProxyIP || finalProxyIP || "173.172.64.37";
            finalProxyType = window.currentProxyType || finalProxyType || "fallback";
            finalSessionBased = window.currentProxySessionBased !== undefined ? window.currentProxySessionBased : finalSessionBased;
            
            console.log('🔍 Final proxy values after automation logic:', {
                finalProxyIP, finalProxyType, finalSessionBased
            });
        }

        // Debug: Log final proxy values before payload creation
        console.log('🔍 Final proxy values for payload:', {
            finalProxyIP,
            finalProxyType,
            finalSessionBased,
            automationMode: automationState.isRunning
        });

        const payload = {
            type: "FB_MARKETPLACE_DATA",
            title: product.title,
            price: cleanPrice,
            description: description.trim() || 'Quality trailer available for sale.',
            images: limitedImages, // **FIXED: Include image URLs**
            location: location,
            vehicle_type: product.vehicle_type || "Trailer",
            make: combinedMake,
            model: parsedTitle.model || product.model || product.title,
            year: parsedTitle.year || product.year || "",
            condition: condition,
            trailer_type: product.type || "Trailer",
            exterior_color: product.exterior_color || product.color || "",
            interior_color: product.interior_color || "",
            automation_type: automationState.isFullAutomation ? "full" : "semi",
            // Add proxy IP information - use final determined proxy values
            proxy_ip: finalProxyIP || "173.172.64.37",
            proxy_type: finalProxyType || "fallback",
            session_based: finalSessionBased || false
        };
        
        console.log("Sending payload to extension:", payload);
        console.log("📋 Parsed title components:", parsedTitle);
        console.log("🏷️ Combined make field:", combinedMake);
        console.log("🗺️ Final location (with state expansion):", location);
        console.log("📸 Images being sent:", limitedImages);
        console.log("🔒 Final proxy info used in payload:", {
            proxy_ip: payload.proxy_ip,
            proxy_type: payload.proxy_type,
            session_based: payload.session_based,
            is_session_persistent: payload.session_based && payload.proxy_type === "session_persistent",
            will_prevent_facebook_blocks: payload.session_based && payload.proxy_type === "session_persistent"
        });
        
        // Send data to extension
        window.postMessage(payload, "*");
        
        // Open Facebook Marketplace through proxy server
        openFacebookThroughProxy(payload);
    }
    
    // New function to open Facebook through proxy server
    function openFacebookThroughProxy(payload) {
        console.log('🌐 Opening Facebook Marketplace through selected proxy server...');
        
        // Call the proxy API to open Facebook
        $.ajax({
            url: `${window.baseKeyword}Scraper/app/api/open_facebook_proxy.php`,
            method: 'POST',
            data: JSON.stringify({
                facebook_url: 'https://www.facebook.com/marketplace/create/vehicle',
                trailer_data: payload
            }),
            contentType: 'application/json',
            dataType: 'json',
            success: function(response) {
                if (response.success) {
                    console.log('✅ Facebook proxy session created:', response);
                    
                    // Just open the Facebook tab without showing proxy notification
                    window.open("https://www.facebook.com/marketplace/create/vehicle", "_blank");
                    
                } else {
                    console.error('❌ Failed to create Facebook proxy session:', response.error);
                    showError('Unable to open Facebook Marketplace: ' + response.error);
                    
                    // Fallback to regular Facebook opening
                    window.open("https://www.facebook.com/marketplace/create/vehicle", "_blank");
                }
            },
            error: function(xhr, status, error) {
                console.error('❌ Error opening Facebook through proxy:', error);
                showError('Unable to open Facebook Marketplace: ' + error);
                
                // Fallback to regular Facebook opening
                window.open("https://www.facebook.com/marketplace/create/vehicle", "_blank");
            }
        });
    }
    

    function openListingForm() {
        const product = window.currentProduct;
        if (!product) {
            alert("No product selected.");
            return;
        }
    
        const username = prompt("Enter Facebook Username/email:");
        const password = prompt("Enter Facebook Password:");
        if (!username || !password) {
            alert("Please enter both username and password.");
            return;
        }
    
        const payload = {
            username,
            password,
            title: product.title,
            price: product.price,
            description: product.description,
            images: product.images
        };
    
        // Send to backend
        $.ajax({
            url: `${window.baseKeyword}Scraper/saveListingInput.php`,
            method: "POST",
            data: { payload: JSON.stringify(payload) },
            success: () => {
                console.log("Listing input saved.");
                $.get(`${window.baseKeyword}Scraper/runListingScript.php`, (response) => {
                    alert("Listing script executed. Check logs for details.");
                    console.log(response);
                });
            },
            error: (xhr, status, err) => {
                alert("Error saving listing input: " + err);
            }
        });
    }
    
    

    // Function to create trailer card HTML (updated with checkbox and Create Listing button)
    function createTrailerCard(trailer, index) {
        const title = trailer.title || 'Untitled Trailer';
        const price = trailer.price || 'Price not available';
        const description = trailer.description || 'No description available';
        const stock = trailer.stock || 'N/A';
        const link = trailer.link || '#';
        const isProcessed = trailer.isProcessed || false;

        // Handle image with better fallback
        let imageHtml;
        if (trailer.image && trailer.image.trim() !== '') {
            // Valid image URL provided
            imageHtml = `
                <img src="${escapeHtml(trailer.image)}" 
                     alt="${escapeHtml(title)}" 
                     class="trailer-card-image"
                     onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                <div class="trailer-image-placeholder" style="display: none;">
                    <div class="icon icon--eye"></div>
                    <div>No Image Available</div>
                </div>`;
        } else {
            // No image provided - show placeholder immediately
            imageHtml = `
                <div class="trailer-image-placeholder">
                    <div class="icon icon--eye"></div>
                    <div>No Image Available</div>
                </div>`;
        }

        // Create Listing button (only show if processed)
        const createListingBtn = isProcessed ? `
            <button onclick="createListingFromTrailer(${index})" 
                    class="btn btn--primary action-btn create-listing-btn">
                <div class="icon icon--plus"></div>
                <span>Create Listing</span>
            </button>
        ` : '';

        const daysListed = getDaysSinceListed(trailer);
        const listedBadge = daysListed !== null
            ? `<div class="listed-badge">
                    <span class="badge badge--success">
                        Listed ${daysListed} day${daysListed !== 1 ? 's' : ''} ago
                    </span>
               </div>`
            : '';

        return $(`
            <div class="trailer-card" data-index="${index}">
                <div class="trailer-card-checkbox">
                    <input type="checkbox" class="trailer-checkbox" data-index="${index}">
                </div>
                <div class="trailer-card-image-container">
                    ${imageHtml}
                    <div class="trailer-card-stock-badge">
                        <div class="chip chip--gray">
                            <div class="icon icon--contract"></div>
                            <span>Stock: ${escapeHtml(stock)}</span>
                        </div>
                    </div>
                </div>
                <div class="trailer-card-content">
                    <div class="trailer-card-header">
                        <h3 class="trailer-card-title" title="${escapeHtml(title)}">${escapeHtml(title)}</h3>
                        <div class="trailer-card-price">${escapeHtml(price)}</div>
                    </div>
                    <div class="trailer-card-details">
                        <p class="trailer-card-description">${escapeHtml(description)}</p>
                    </div>
                    ${listedBadge}
                    <div class="trailer-card-actions">
                        <button onclick="showTrailerDetails('${escapeHtml(link)}')" 
                                class="btn btn--primary action-btn">
                            <div class="icon icon--eye"></div>
                            <span>View Details</span>
                        </button>
                        ${createListingBtn}
                        <button onclick="removeTrailer(${index})" 
                                class="btn btn--outlined btn--text-danger action-btn">
                            <div class="icon icon--trash"></div>
                            <span>Remove</span>
                        </button>
                    </div>
                </div>
            </div>
        `);
    }

    // Function to remove trailer
    window.removeTrailer = function(index) {
        if (confirm('Are you sure you want to remove this trailer?')) {
            allTrailers.splice(index, 1);
            renderTrailers();
            showSuccess('Trailer removed from list successfully!');
        }
    };

    // Function to show loading
    function showLoading() {
        $('#loadingMessageArea').show();
        $('#loading').hide(); // Hide the old loading card
    }

    // Function to hide loading
    function hideLoading() {
        $('#loadingMessageArea').hide();
        $('#loading').hide();
    }

    // Function to show results
    function showResults() {
        $('#results').show();
    }

    // Function to show error
    function showError(message) {
        $('#errorText').text(message);
        $('#errorMessage').show();
        setTimeout(() => {
            hideError();
        }, 5000);
    }

    // Function to hide error
    function hideError() {
        $('#errorMessage').hide();
    }

    // Function to show success message
    function showSuccess(message) {
        // Create temporary success alert toast
        const toastHtml = `
            <div class="alert-toast alert-toast--success show" style="position: fixed; top: 20px; right: 20px; z-index: 9999;">
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
        $('body').append(toastElement);
        
        // Auto hide after 3 seconds
        setTimeout(() => {
            toastElement.removeClass('show');
            setTimeout(() => {
                toastElement.remove();
            }, 300);
        }, 3000);
        
        // Close button functionality
        toastElement.find('.alert-toast__close').on('click', function() {
            toastElement.removeClass('show');
            setTimeout(() => {
                toastElement.remove();
            }, 300);
        });
    }
    
    // Function to show warning message
    function showWarning(message) {
        // Create temporary warning alert toast
        const toastHtml = `
            <div class="alert-toast alert-toast--warning show" style="position: fixed; top: 20px; right: 20px; z-index: 9999; background: #fff3cd; border: 1px solid #ffeaa7; color: #856404;">
                <div class="alert-toast__icon" style="color: #f39c12;">⚠️</div>
                <div class="alert-toast__content">
                    <div class="alert-toast__title" style="color: #856404;">Warning</div>
                    <div class="alert-toast__message" style="color: #856404;">${escapeHtml(message)}</div>
                </div>
                <div class="alert-toast__close">
                    <div class="icon icon--close"></div>
                </div>
            </div>
        `;
        
        const toastElement = $(toastHtml);
        $('body').append(toastElement);
        
        // Auto hide after 8 seconds (longer for warnings)
        setTimeout(() => {
            toastElement.removeClass('show');
            setTimeout(() => {
                toastElement.remove();
            }, 300);
        }, 8000);
        
        // Close button functionality
        toastElement.find('.alert-toast__close').on('click', function() {
            toastElement.removeClass('show');
            setTimeout(() => {
                toastElement.remove();
            }, 300);
        });
    }

    // Function to escape HTML
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

    // Function to add scraped trailers to inventory with batch processing
    function addTrailersToInventory() {
        console.log('addTrailersToInventory called, allTrailers:', allTrailers);
        
        if (!allTrailers || allTrailers.length === 0) {
            showError('No trailers available to add to inventory. Please scrape some trailers first.');
            return;
        }

        // Show confirmation dialog
        const confirmed = confirm(`Are you sure you want to add all ${allTrailers.length} trailers to your inventory? This will extract detailed information for each trailer.`);
        if (!confirmed) {
            return;
        }

        // Disable the button and show loading state
        const $btn = $('#addToInventoryBtn');
        const originalHtml = $btn.html();
        $btn.prop('disabled', true).html('<div class="icon icon--clock-rotate-left"></div><span>Extracting Details...</span>');

        // **NEW: Extract detailed information for all trailers first**
        extractAllTrailerDetails(allTrailers)
            .then(detailedTrailers => {
                console.log('Detailed trailers extracted:', detailedTrailers);
                
                // Update button to show adding to inventory
                $btn.html('<div class="icon icon--clock-rotate-left"></div><span>Adding to Inventory...</span>');

                // **NEW: Send trailers in batches to avoid PHP max_input_vars limit**
                return addTrailersInBatches(detailedTrailers);
            })
            .then(finalResult => {
                console.log('Final batch processing result:', finalResult);
                
                if (finalResult.success_count > 0 || finalResult.updated_count > 0) {
                    // Build detailed success message
                    let messageParts = [];
                    if (finalResult.success_count > 0) {
                        messageParts.push(`${finalResult.success_count} new trailers added`);
                    }
                    if (finalResult.updated_count > 0) {
                        messageParts.push(`${finalResult.updated_count} trailers updated`);
                    }
                    if (finalResult.sold_count > 0) {
                        messageParts.push(`${finalResult.sold_count} trailers marked as sold`);
                    }
                    
                    let successMessage = `Inventory sync completed! ${messageParts.join(', ')}.`;
                    
                    if (finalResult.error_count > 0) {
                        successMessage += ` (${finalResult.error_count} failed)`;
                    }
                    
                    showSuccess(successMessage);
                    
                    // Refresh inventory if currently viewing it
                    if (window.InventoryManagement && typeof window.InventoryManagement.refreshInventory === 'function') {
                        window.InventoryManagement.refreshInventory();
                    }
                } else if (finalResult.sold_count > 0) {
                    showSuccess(`Inventory sync completed! ${finalResult.sold_count} trailers marked as sold.`);
                } else {
                    showError('No changes were made to inventory. All trailers may already be up to date.');
                }
            })
            .catch(error => {
                console.log('Error in addTrailersToInventory:', error);
                if (error.responseJSON) {
                    showError(error.responseJSON.error || 'Unable to add trailers to inventory. Please try again.');
                } else if (error.responseText) {
                    try {
                        const errorData = JSON.parse(error.responseText);
                        showError(errorData.error || 'Unable to add trailers to inventory. Please try again.');
                    } catch (e) {
                        showError('Connection error: ' + (error.statusText || 'Unable to connect to server'));
                    }
                } else {
                    showError('Connection error: ' + (error.message || 'Unable to connect to server'));
                }
            })
            .finally(() => {
                // Re-enable the button
                $btn.prop('disabled', false).html(originalHtml);
            });
    }

    // **NEW: Function to add trailers in batches to avoid PHP limits**
    async function addTrailersInBatches(detailedTrailers) {
        const batchSize = 15; // Send 15 trailers per batch (well under PHP limits)
        const totalTrailers = detailedTrailers.length;
        let totalSuccessCount = 0;
        let totalUpdatedCount = 0;
        let totalSoldCount = 0;
        let totalErrorCount = 0;
        const allErrors = [];
        
        // Collect all stock IDs for the final "mark as sold" operation
        const allScrapedStockIds = [];
        detailedTrailers.forEach(trailer => {
            const stockId = trailer.stock || trailer.stock_id || trailer.stock_number;
            if (stockId) {
                allScrapedStockIds.push(stockId);
            }
        });
        
        console.log(`📦 Starting batch processing: ${totalTrailers} trailers in batches of ${batchSize}`);
        console.log(`📋 Collected stock IDs for sold check:`, allScrapedStockIds);
        
        // Process trailers in batches
        for (let i = 0; i < totalTrailers; i += batchSize) {
            const batch = detailedTrailers.slice(i, i + batchSize);
            const batchNumber = Math.floor(i / batchSize) + 1;
            const totalBatches = Math.ceil(totalTrailers / batchSize);
            
            console.log(`📋 Processing batch ${batchNumber}/${totalBatches} (${batch.length} trailers)`);
            
            // Update progress indicator
            const progress = Math.round((i / totalTrailers) * 100);
            $('#addToInventoryBtn').html(`<div class="icon icon--clock-rotate-left"></div><span>Syncing Inventory... ${progress}% (Batch ${batchNumber}/${totalBatches})</span>`);
            
            try {
                const response = await $.ajax({
                    url: `${window.baseKeyword}Scraper/index.php`,
                    method: 'POST',
                    data: {
                        action: 'add_to_inventory',
                        trailers: batch,
                        dealer_id: window.DealerID || 1,
                        batch_info: {
                            batch_number: batchNumber,
                            total_batches: totalBatches,
                            batch_size: batch.length
                        }
                    },
                    dataType: 'json'
                });
                
                console.log(`✅ Batch ${batchNumber} completed:`, response);
                
                if (response.success) {
                    totalSuccessCount += response.success_count || 0;
                    totalUpdatedCount += response.updated_count || 0;
                    // Don't add sold_count from batches as it will be calculated separately
                    totalErrorCount += response.error_count || 0;
                    if (response.errors && response.errors.length > 0) {
                        allErrors.push(...response.errors);
                    }
                    
                    // Log sync details if available
                    if (response.sync_summary) {
                        console.log(`📊 Batch ${batchNumber} sync summary:`, response.sync_summary);
                    }
                } else {
                    console.error(`❌ Batch ${batchNumber} failed:`, response.error);
                    totalErrorCount += batch.length;
                    allErrors.push(`Batch ${batchNumber} failed: ${response.error}`);
                }
                
            } catch (error) {
                console.error(`❌ Batch ${batchNumber} error:`, error);
                totalErrorCount += batch.length;
                allErrors.push(`Batch ${batchNumber} error: ${error.message || 'Unknown error'}`);
            }
            
            // Small delay between batches to be respectful to the server
            if (i + batchSize < totalTrailers) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
        
        // **STEP 2: After all batches are processed, mark missing trailers as sold**
        console.log('🔍 Checking for missing trailers to mark as sold...');
        $('#addToInventoryBtn').html(`<div class="icon icon--clock-rotate-left"></div><span>Checking for sold trailers...</span>`);
        
        try {
            const soldResponse = await $.ajax({
                url: `${window.baseKeyword}Scraper/index.php`,
                method: 'POST',
                data: {
                    action: 'mark_missing_as_sold',
                    scraped_stock_ids: allScrapedStockIds,
                    dealer_id: window.DealerID || 1
                },
                dataType: 'json'
            });
            
            console.log('✅ Sold check completed:', soldResponse);
            
            if (soldResponse.success) {
                totalSoldCount = soldResponse.sold_count || 0;
            }
        } catch (error) {
            console.error('❌ Error checking for sold trailers:', error);
            allErrors.push('Failed to check for sold trailers: ' + (error.message || 'Unknown error'));
        }
        
        const finalResult = {
            success_count: totalSuccessCount,
            updated_count: totalUpdatedCount,
            sold_count: totalSoldCount,
            error_count: totalErrorCount,
            errors: allErrors,
            total_processed: totalTrailers
        };
        
        console.log('🏁 Complete inventory sync finished:', finalResult);
        return finalResult;
    }

    // **NEW: Function to extract detailed information for all trailers in parallel**
    async function extractAllTrailerDetails(trailers) {
        console.log('🔍 Starting parallel extraction for', trailers.length, 'trailers');
        
        const maxConcurrent = 5; // Limit concurrent requests to avoid overwhelming the server
        const detailedTrailers = [];
        
        // Process trailers in batches
        for (let i = 0; i < trailers.length; i += maxConcurrent) {
            const batch = trailers.slice(i, i + maxConcurrent);
            console.log(`📦 Processing batch ${Math.floor(i/maxConcurrent) + 1}/${Math.ceil(trailers.length/maxConcurrent)}`);
            
            // Update progress
            const progress = Math.round((i / trailers.length) * 100);
            $('#addToInventoryBtn').html(`<div class="icon icon--clock-rotate-left"></div><span>Extracting Details... ${progress}%</span>`);
            
            const batchPromises = batch.map(async (trailer, batchIndex) => {
                const globalIndex = i + batchIndex;
                try {
                    if (!trailer.link || trailer.link === '#') {
                        console.warn(`⚠️ Trailer ${globalIndex} has no detail link, using basic data`);
                        return enhanceBasicTrailerData(trailer);
                    }
                    
                    console.log(`🔍 Extracting details for trailer ${globalIndex}: ${trailer.title}`);
                    
                    // Get the current scrolling preference
                    const enableScrolling = $('#enableScrolling').is(':checked');
                    
                    const response = await $.ajax({
                        url: `${window.baseKeyword}Scraper/app/api/extract_trailer.php`,
                        method: 'POST',
                        data: JSON.stringify({ 
                            url: trailer.link,
                            enableScrolling: enableScrolling 
                        }),
                        contentType: 'application/json',
                        dataType: 'json',
                        timeout: 15000 // 15 second timeout per trailer
                    });
                    
                    if (response.success && response.data && response.data.details) {
                        const detailedData = mergeTrailerData(trailer, response.data.details);
                        console.log(`✅ Successfully extracted details for trailer ${globalIndex}`);
                        return detailedData;
                    } else {
                        console.warn(`⚠️ Failed to extract details for trailer ${globalIndex}, using basic data`);
                        return enhanceBasicTrailerData(trailer);
                    }
                } catch (error) {
                    console.error(`❌ Error extracting details for trailer ${globalIndex}:`, error);
                    return enhanceBasicTrailerData(trailer);
                }
            });
            
            const batchResults = await Promise.all(batchPromises);
            detailedTrailers.push(...batchResults);
            
            // Small delay between batches to be respectful to the server
            if (i + maxConcurrent < trailers.length) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
        
        console.log('✅ Completed extraction for all trailers');
        return detailedTrailers;
    }

    // **NEW: Function to enhance basic trailer data when detailed extraction fails**
    function enhanceBasicTrailerData(trailer) {
        const parsedTitle = parseTrailerTitle(trailer.title || '');
        
        return {
            // Original scraped data
            title: trailer.title || '',
            price: trailer.price || '',
            description: trailer.description || '',
            image: trailer.image || '',
            stock: trailer.stock || '',
            link: trailer.link || '',
            
            // Enhanced data from title parsing
            year: parsedTitle.year || extractYearFromText(trailer.title || ''),
            make: parsedTitle.make || 'Unknown',
            manufacturer: parsedTitle.make || 'Unknown',
            model: parsedTitle.model || (trailer.title || 'Unknown Model'),
            brand: parsedTitle.make || 'Unknown',
            
            // Determine condition from title
            condition: determineConditionFromText(trailer.title || '', trailer.description || ''),
            
            // Determine trailer type/category from title and description
            type: determineTrailerTypeFromText(trailer.title || '', trailer.description || ''),
            category: determineTrailerTypeFromText(trailer.title || '', trailer.description || ''),
            
            // Extract color from title and description
            color: extractColorFromText(trailer.title || '', trailer.description || ''),
            exterior_color: extractColorFromText(trailer.title || '', trailer.description || ''),
            
            // Extract size/dimensions
            size: extractSizeFromText(trailer.title || '', trailer.description || ''),
            dimensions: extractSizeFromText(trailer.title || '', trailer.description || ''),
            
            // Default values
            status: 'available',
            vin: '',
            features: [],
            images: trailer.image ? [{ url: trailer.image, alt: trailer.title || 'Trailer Image' }] : []
        };
    }

    // **NEW: Function to merge scraped data with detailed extracted data**
    function mergeTrailerData(basicTrailer, detailedData) {
        // Parse basic trailer title for fallback data
        const parsedTitle = parseTrailerTitle(basicTrailer.title || '');
        
        return {
            // Basic scraped info (keep original)
            title: basicTrailer.title || detailedData.title || '',
            price: basicTrailer.price || detailedData.price || '',
            description: detailedData.description || basicTrailer.description || '',
            image: basicTrailer.image || (detailedData.images && detailedData.images[0] ? detailedData.images[0].url : ''),
            stock: basicTrailer.stock || detailedData.stock_number || '',
            link: basicTrailer.link || '',
            
            // Detailed extracted info (prefer detailed over basic)
            year: detailedData.year || parsedTitle.year || extractYearFromText(basicTrailer.title || ''),
            make: detailedData.brand || detailedData.manufacturer || parsedTitle.make || 'Unknown',
            manufacturer: detailedData.manufacturer || detailedData.brand || parsedTitle.make || 'Unknown',
            model: detailedData.model || parsedTitle.model || (basicTrailer.title || 'Unknown Model'),
            brand: detailedData.brand || detailedData.manufacturer || parsedTitle.make || 'Unknown',
            
            // **ISSUE 3 FIX: Properly handle condition**
            condition: detailedData.condition || determineConditionFromText(basicTrailer.title || '', basicTrailer.description || ''),
            
            // **ISSUE 1 FIX: Use category for trailer type**
            type: detailedData.category || detailedData.type || determineTrailerTypeFromText(basicTrailer.title || '', basicTrailer.description || ''),
            category: detailedData.category || detailedData.type || determineTrailerTypeFromText(basicTrailer.title || '', basicTrailer.description || ''),
            
            // **ISSUE 2 FIX: Properly handle colors with Facebook mapping**
            color: mapToFacebookColor(detailedData.exterior_color || detailedData.color || extractColorFromText(basicTrailer.title || '', basicTrailer.description || '')),
            exterior_color: mapToFacebookColor(detailedData.exterior_color || detailedData.color || extractColorFromText(basicTrailer.title || '', basicTrailer.description || '')),
            interior_color: mapToFacebookColor(detailedData.interior_color || detailedData.exterior_color || detailedData.color || ''),
            
            // Additional detailed info
            vin: detailedData.vin || '',
            stock_number: detailedData.stock_number || basicTrailer.stock || '',
            status: detailedData.status || 'available',
            location: detailedData.location || '',
            dealer_name: detailedData.dealer_name || '',
            dealer_address: detailedData.dealer_address || '',
            dealer_phone: detailedData.dealer_phone || '',
            
            // Dimensions and specifications
            floor_length: detailedData.floor_length || '',
            floor_width: detailedData.floor_width || '',
            floor_height: detailedData.floor_height || '',
            length_total: detailedData.length_total || '',
            width_total: detailedData.width_total || '',
            dimensions: detailedData.dimensions || extractSizeFromText(basicTrailer.title || '', basicTrailer.description || ''),
            size: extractSizeFromText(basicTrailer.title || '', basicTrailer.description || '') || detailedData.dimensions || '',
            
            // Weight and capacity
            weight: detailedData.weight || '',
            empty_weight: detailedData.empty_weight || '',
            axle_capacity: detailedData.axle_capacity || '',
            axles: detailedData.axles || '',
            
            // Construction details
            construction: detailedData.construction || '',
            pull_type: detailedData.pull_type || '',
            rental: detailedData.rental || '',
            
            // Features and images
            features: detailedData.features || [],
            images: detailedData.images || (basicTrailer.image ? [{ url: basicTrailer.image, alt: basicTrailer.title || 'Trailer Image' }] : [])
        };
    }

    // **NEW: Helper functions for text analysis**
    function extractYearFromText(text) {
        const match = text.match(/\b(19|20)\d{2}\b/);
        return match ? match[0] : '';
    }

    function determineConditionFromText(title, description) {
        const text = (title + ' ' + description).toLowerCase();
        
        if (text.includes('new') && !text.includes('used')) {
            return 'new';
        } else if (text.includes('used') || text.includes('pre-owned') || text.includes('preowned')) {
            return 'used';
        } else if (text.includes('refurbished') || text.includes('rebuilt') || text.includes('restored')) {
            return 'refurbished';
        } else {
            // Default to 'used' but check for new indicators more carefully
            if (text.includes('brand new') || text.includes('factory new') || text.match(/\b20(2[4-9]|3[0-9])\b/)) {
                return 'new';
            }
            return 'used';
        }
    }

    function determineTrailerTypeFromText(title, description) {
        const text = (title + ' ' + description).toLowerCase();
        
        // More comprehensive trailer type detection
        if (text.includes('dump') || text.includes('tilt')) {
            return 'Dump Trailer';
        } else if (text.includes('enclosed') || text.includes('cargo') || text.includes('box trailer')) {
            return 'Enclosed Trailer';
        } else if (text.includes('car hauler') || text.includes('auto hauler') || text.includes('vehicle')) {
            return 'Car Hauler';
        } else if (text.includes('flatbed') || text.includes('flat bed') || text.includes('deck over')) {
            return 'Flatbed Trailer';
        } else if (text.includes('equipment') || text.includes('heavy duty') || text.includes('skid steer')) {
            return 'Equipment Trailer';
        } else if (text.includes('gooseneck') || text.includes('goose neck')) {
            return 'Gooseneck Trailer';
        } else if (text.includes('utility') || text.includes('landscape') || text.includes('mesh')) {
            return 'Utility Trailer';
        } else if (text.includes('boat') || text.includes('pontoon')) {
            return 'Boat Trailer';
        } else if (text.includes('motorcycle') || text.includes('atv') || text.includes('bike')) {
            return 'Motorcycle Trailer';
        } else {
            // Try to extract from title pattern
            const match = title.match(/(\w+)\s+trailer/i);
            if (match) {
                return match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase() + ' Trailer';
            }
            return 'Utility Trailer';
        }
    }

    function extractColorFromText(title, description) {
        const text = (title + ' ' + description).toLowerCase();
        const colors = ['white', 'black', 'gray', 'grey', 'blue', 'red', 'green', 'yellow', 'orange', 'brown', 'silver', 'tan', 'beige', 'charcoal', 'navy'];
        
        for (const color of colors) {
            if (text.includes(color)) {
                return mapToFacebookColor(color.charAt(0).toUpperCase() + color.slice(1));
            }
        }
        
        return '';
    }

    /**
     * Map any color to Facebook-approved colors
     */
    function mapToFacebookColor(inputColor) {
        if (!inputColor) return '';
        
        const color = inputColor.toLowerCase().trim();
        
        // Facebook approved colors
        const facebookColors = {
            // Direct matches
            'black': 'Black',
            'blue': 'Blue', 
            'brown': 'Brown',
            'gold': 'Gold',
            'green': 'Green',
            'grey': 'Grey',
            'gray': 'Grey', // Map gray to grey
            'pink': 'Pink',
            'purple': 'Purple',
            'red': 'Red',
            'silver': 'Silver',
            'orange': 'Orange',
            'white': 'White',
            'yellow': 'Yellow',
            'charcoal': 'Charcoal',
            'tan': 'Tan',
            'beige': 'Beige',
            'burgundy': 'Burgundy',
            'turquoise': 'Turquoise',
            
            // Common mappings to Facebook colors
            'navy': 'Blue',
            'dark blue': 'Blue',
            'light blue': 'Blue',
            'royal blue': 'Blue',
            'sky blue': 'Blue',
            'teal': 'Turquoise',
            'aqua': 'Turquoise',
            'cyan': 'Turquoise',
            'lime': 'Green',
            'forest green': 'Green',
            'dark green': 'Green',
            'olive': 'Green',
            'maroon': 'Burgundy',
            'crimson': 'Red',
            'scarlet': 'Red',
            'rose': 'Pink',
            'magenta': 'Pink',
            'violet': 'Purple',
            'indigo': 'Purple',
            'lavender': 'Purple',
            'bronze': 'Brown',
            'copper': 'Brown',
            'rust': 'Brown',
            'mahogany': 'Brown',
            'cream': 'White',
            'ivory': 'White',
            'pearl': 'White',
            'off white': 'White',
            'off-white': 'White',
            'platinum': 'Silver',
            'chrome': 'Silver',
            'metallic': 'Silver',
            'gunmetal': 'Charcoal',
            'slate': 'Grey',
            'ash': 'Grey',
            'smoke': 'Grey',
            'stone': 'Grey',
            'khaki': 'Tan',
            'sand': 'Tan',
            'camel': 'Tan',
            'wheat': 'Beige',
            'champagne': 'Beige',
            'almond': 'Beige'
        };
        
        // Check for direct match
        if (facebookColors[color]) {
            console.log(`🎨 Color mapped: "${inputColor}" → "${facebookColors[color]}"`);
            return facebookColors[color];
        }
        
        // Check for partial matches
        for (const [key, value] of Object.entries(facebookColors)) {
            if (color.includes(key) || key.includes(color)) {
                console.log(`🎨 Color mapped (partial): "${inputColor}" → "${value}"`);
                return value;
            }
        }
        
        // Default fallback - try to match by color family
        if (color.includes('blue')) return 'Blue';
        if (color.includes('red')) return 'Red';
        if (color.includes('green')) return 'Green';
        if (color.includes('yellow')) return 'Yellow';
        if (color.includes('orange')) return 'Orange';
        if (color.includes('purple') || color.includes('violet')) return 'Purple';
        if (color.includes('pink')) return 'Pink';
        if (color.includes('brown')) return 'Brown';
        if (color.includes('black')) return 'Black';
        if (color.includes('white')) return 'White';
        if (color.includes('silver') || color.includes('metal')) return 'Silver';
        if (color.includes('gold')) return 'Gold';
        if (color.includes('grey') || color.includes('gray')) return 'Grey';
        if (color.includes('tan')) return 'Tan';
        if (color.includes('beige')) return 'Beige';
        
        // If no match found, return Grey as safe default
        console.log(`🎨 Color mapped (default): "${inputColor}" → "Grey"`);
        return 'Grey';
    }

    function extractSizeFromText(title, description) {
        const text = title + ' ' + description;
        
        // Look for size patterns like 6x12, 8.5x20, etc.
        const match = text.match(/\b(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)\b/);
        if (match) {
            return `${match[1]}x${match[2]}`;
        }
        
        return '';
    }

    // Global function to close trailer modal
    window.closeTrailerModal = function() {
        $('#trailerDetailsModal').removeClass('modal-overlay--open').hide();
    }

    // Test modal function for debugging
    window.testModal = function() {
        console.log('🧪 Testing modal functionality...');
        
        // Show the test button
        $('#testModalBtn').show();
        
        // Check if modal exists
        const modal = $('#trailerDetailsModal');
        console.log('🎯 Modal element exists:', modal.length > 0);
        
        if (modal.length > 0) {
            console.log('📋 Opening modal...');
            modal.addClass('modal-overlay--open').show();
            
            // Test modal content
            $('#modalLoading').show();
            $('#modalContent').hide();
            $('#modalError').hide();
            
            setTimeout(() => {
                $('#modalLoading').hide();
                $('#modalContent').show();
                $('#detailTitle').text('Test Modal Title');
                $('#detailPrice').text('$1,000');
                $('#detailStock').text('TEST123');
                $('#detailCondition').text('Test');
                console.log('✅ Test modal content populated');
        }, 1000);
        } else {
            console.error('❌ Modal element not found');
        }
    }

    // Make addTrailersToInventory globally accessible
    window.addTrailersToInventory = addTrailersToInventory;

    // Global function to show trailer details (placeholder - real implementation below)
    // This is overridden by the full implementation later in the code

    // Add export functionality
    $('#exportBtn').on('click', function() {
        if (allTrailers.length === 0) {
            showError('No trailers available to export. Please scrape some trailers first.');
            return;
        }

        const dataStr = JSON.stringify(allTrailers, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'scraped_trailers_' + new Date().toISOString().split('T')[0] + '.json';
        link.click();
        
        showSuccess('Trailer data exported successfully!');
    });

    // Add keyboard shortcuts
    $(document).on('keydown', function(e) {
        // Ctrl+Enter to submit form
        if (e.ctrlKey && e.keyCode === 13) {
            if ($('#url').is(':focus')) {
                $('#scraperForm').submit();
            } else if ($('#newUrl').is(':focus')) {
                $('#newSearchForm').submit();
            }
        }
    });

    // Add filter functionality
    let filterTimeout;
    $('#filterInput').on('input', function() {
        clearTimeout(filterTimeout);
        const searchTerm = $(this).val().toLowerCase();
        
        filterTimeout = setTimeout(() => {
            $('.trailer-card').each(function() {
                const card = $(this);
                const title = $(this).find('.trailer-card-title').text().toLowerCase();
                const description = $(this).find('.trailer-card-description').text().toLowerCase();
                
                if (title.includes(searchTerm) || description.includes(searchTerm)) {
                    card.show();
                } else {
                    card.hide();
                }
            });
        }, 300);
    });

    // Initialize tooltips if any
    // Tooltips are handled by the dealer dashboard CSS system
    
    // **RUN STATE EXPANSION TEST ON PAGE LOAD**
    testStateExpansion();
    
    // Function to delete old Facebook listings
    function deleteOldFacebookListings() {
        console.log('🗑️ Opening Facebook Marketplace selling page for deletion...');
        
        // Show confirmation dialog
        const confirmed = confirm('This will open Facebook Marketplace "Your Selling" page where you can delete listings older than 14 days. Continue?');
        
        if (confirmed) {
            // Open Facebook Marketplace selling page in new tab
            const facebookUrl = 'https://www.facebook.com/marketplace/you/selling';
            window.open(facebookUrl, '_blank');
            
            // Show success message
            showSuccess('Facebook Marketplace opened! You can now manage your listings and delete older ones as needed.');
        }
    }
    

    
    // Modal functionality for trailer details
    window.showTrailerDetails = function(url) {
        if (!url || url === '#') {
            showError('No detail page available for this trailer');
            return;
        }

        // Show modal using dealer dashboard modal system
        $('#trailerDetailsModal').addClass('modal-overlay--open').show();
        
        // Reset modal content
        resetModal();
        showModalLoading();
        
        // Set verify link
        $('#verifyDetailsLink').attr('href', url);

        // Get the current scrolling preference
        const enableScrolling = $('#enableScrolling').is(':checked');
        
        // Update loading message based on scraping method (for modal)
        if (enableScrolling) {
            $('#modalLoading .loading-text').text('Extracting detailed information with dynamic loading...');
        } else {
            $('#modalLoading .loading-text').text('Extracting detailed information...');
        }

        // Call API to extract trailer details
        $.ajax({
            url: `${window.baseKeyword}Scraper/app/api/extract_trailer.php`,
            method: 'POST',
            data: JSON.stringify({ 
                url: url,
                enableScrolling: enableScrolling 
            }),
            contentType: 'application/json',
            dataType: 'json',
            success: function(response) {
                if (response.success) {
                    populateModal(response.data);
                    showModalContent();
                    setCurrentProduct(response.data.details);
                    
                    // Show success message with scraper type info
                    if (response.scraper_type) {
                        console.log(`✅ Details extracted using ${response.scraper_type} scraper`);
                    }
                } else {
                    showModalError(response.error || 'Failed to extract trailer details');
                }
            },
            error: function(xhr, status, error) {
                let errorMessage = 'Network error occurred';
                if (xhr.responseJSON && xhr.responseJSON.error) {
                    errorMessage = xhr.responseJSON.error;
                } else if (error) {
                    errorMessage = 'Error: ' + error;
                }
                showModalError(errorMessage);
            },
            complete: function() {
                hideModalLoading();
            }
        });
    };

    // Reset modal to initial state
    function resetModal() {
        $('#modalContent').hide();
        $('#modalError').hide();
        clearModalContent();
    }

    // Show modal loading state
    function showModalLoading() {
        $('#modalLoading').show();
    }

    // Hide modal loading state
    function hideModalLoading() {
        $('#modalLoading').hide();
    }

    // Show modal content
    function showModalContent() {
        $('#modalContent').show();
    }

    // Show modal error
    function showModalError(message) {
        $('#modalErrorText').text(message);
        $('#modalError').show();
    }

    function setCurrentProduct(product, images = []) {
        const type = product?.additional_info?.type;
        let vehicleType = type || "";
        if (typeof type === "string" && type.includes("Trailer")) {
            vehicleType = "Trailer";
        }
        
        // Extract location from multiple sources with priority
        let location = "United States"; // default
        
        // Priority 1: Direct location field
        if (product.location && product.location.trim() && product.location !== "N/A") {
            location = product.location;
        }
        // Priority 2: Dealer address or name with location
        else if (product.dealer_address && product.dealer_address.trim()) {
            location = product.dealer_address;
        }
        else if (product.dealer_name && product.dealer_name.trim() && product.dealer_name.includes(',')) {
            // If dealer name contains location info (e.g., "Trailer Town, Dallas TX")
            location = product.dealer_name;
        }
        // Priority 3: Extract from additional_info
        else if (product.additional_info) {
            if (typeof product.additional_info === 'string' && product.additional_info.trim()) {
                location = product.additional_info;
            } else if (typeof product.additional_info === 'object' && product.additional_info.location) {
                location = product.additional_info.location;
            }
        }
        
        // **NEW: Expand state abbreviations for better Facebook detection**
        location = expandStateAbbreviation(location);
        
        window.currentProduct = {
            // Basic info
            title: product.title || "Trailer",
            price: (product.price || "").replace(/\$/g, ""), // remove any $ sign
            description: product.description || "",
            additional_info: product.additional_info || "",
            images: images || [],  // **FIXED: Use passed images parameter**
            location: location,
            vehicle_type: vehicleType || "Trailer",
            
            // Location details
            dealer_name: product.dealer_name || "",
            dealer_address: product.dealer_address || "",
            dealer_phone: product.dealer_phone || "",
            
            // Detailed specifications
            year: product.year || "",
            model: product.model || "",
            make: product.brand || product.make || product.manufacturer || "",
            brand: product.brand || "",
            manufacturer: product.manufacturer || "",
            condition: product.condition || "Used",
            type: product.type || "Trailer",
            category: product.category || "",
            status: product.status || "",
            vin: product.vin || "",
            stock_number: product.stock_number || "",
            
            // Dimensions
            floor_length: product.floor_length || "",
            floor_width: product.floor_width || "",
            floor_height: product.floor_height || "",
            length_total: product.length_total || "",
            width_total: product.width_total || "",
            dimensions: product.dimensions || "",
            
            // Weight & Capacity
            weight: product.weight || "",
            empty_weight: product.empty_weight || "",
            axle_capacity: product.axle_capacity || "",
            axles: product.axles || "",
            
            // Construction & Design
            construction: product.construction || "",
            color: product.color || "",
            exterior_color: product.exterior_color || product.color || "",
            interior_color: product.interior_color || "",
            pull_type: product.pull_type || "",
            rental: product.rental || "",
            
            // Features
            features: product.features || []
        };
        
        console.log("Current product set:", window.currentProduct);
        console.log("Images in current product:", window.currentProduct.images);
    }

    // Clear modal content
    function clearModalContent() {
        $('#detailTitle').text('');
        $('#detailPrice').text('');
        $('#detailStock').text('');
        $('#detailCondition').text('');
        $('#specificationsGrid').empty();
        $('#featuresList').empty();
        $('#fullDescription').val('');
        $('#imageGallery').empty();
        $('#imageCount').text('0');
        $('#additionalInfo').text('');
        $('#additionalInfoContainer').hide();
    }

    // Function to populate specifications dynamically
    function populateSpecifications(details) {
        const specificationsGrid = $('#specificationsGrid');
        specificationsGrid.empty();

                 // Define specification fields with their display names
        const specFields = [
            { key: 'brand', label: 'Brand', fallback: 'manufacturer' },
            { key: 'manufacturer', label: 'Manufacturer', skipIf: 'brand' },
            { key: 'model', label: 'Model' },
            { key: 'year', label: 'Year' },
            { key: 'type', label: 'Type' },
            { key: 'category', label: 'Category' },
            { key: 'vin', label: 'VIN' },
            { key: 'stock_number', label: 'Stock #' },
            { key: 'status', label: 'Status' },
            { key: 'dimensions_combined', label: 'Dimensions', isComputed: true },
            { key: 'weight', label: 'Weight' },
            { key: 'empty_weight', label: 'Empty Weight', skipIf: 'weight' },
            { key: 'axle_capacity', label: 'Axle Capacity' },
            { key: 'axles', label: 'Axles' },
            { key: 'construction', label: 'Construction' },
            { key: 'color', label: 'Color' },
            { key: 'pull_type', label: 'Pull Type' },
            { key: 'rental', label: 'Rental' }
        ];

        let addedSpecs = 0;
        
        specFields.forEach(spec => {
            let value = details[spec.key];
            
            // Handle computed fields
            if (spec.isComputed && spec.key === 'dimensions_combined') {
                // Combine dimension information
                const dimensionParts = [];
                if (details.floor_length) dimensionParts.push(`Length: ${details.floor_length}`);
                if (details.floor_width) dimensionParts.push(`Width: ${details.floor_width}`);
                if (details.floor_height && details.floor_height !== '0in') dimensionParts.push(`Height: ${details.floor_height}`);
                if (details.length_total && !details.floor_length) dimensionParts.push(`Length: ${details.length_total}`);
                if (details.width_total && !details.floor_width) dimensionParts.push(`Width: ${details.width_total}`);
                if (details.dimensions && dimensionParts.length === 0) dimensionParts.push(details.dimensions);
                
                value = dimensionParts.length > 0 ? dimensionParts.join(' × ') : null;
            }
            
            // Use fallback if main value is empty
            if ((!value || value === 'N/A' || value === '-') && spec.fallback) {
                value = details[spec.fallback];
            }
            
            // Skip if value is empty or if skipIf condition is met
            if (!value || value === 'N/A' || value === '-' || value === 'null' || value === '[object Object]') {
                return;
            }
            
            // Check skipIf conditions
            if (spec.skipIf) {
                if (typeof spec.skipIf === 'string' && details[spec.skipIf]) {
                    return; // Skip this field if the skipIf field has a value
                }
                if (Array.isArray(spec.skipIf) && spec.skipIf.some(field => details[field])) {
                    return; // Skip if any of the skipIf fields have values
                }
            }
            
            // Add the specification to the grid
            const specHtml = `
                <div class="spec-item">
                    <div class="spec-label">${spec.label}:</div>
                    <div class="spec-value">${escapeHtml(value)}</div>
                </div>
            `;
            specificationsGrid.append(specHtml);
            addedSpecs++;
        });
        
        // If no specifications were added, show a message
        if (addedSpecs === 0) {
            specificationsGrid.append(`
                <div class="spec-item">
                    <div class="spec-label">Status:</div>
                    <div class="spec-value">No detailed specifications available</div>
                </div>
            `);
        }
    }

    // Populate modal with trailer details
    function populateModal(data) {
        const details = data.details || {};
        const images = data.images || [];

        // Basic information
        $('#detailTitle').text(details.title || 'N/A');
        $('#detailPrice').text(details.price || 'N/A');
        $('#detailStock').text(details.stock_number || 'N/A').addClass('text-black fw-semibold');
        $('#detailCondition').text(details.condition || 'N/A').addClass('text-black fw-semibold');

        // Populate specifications dynamically - only show fields with actual values
        populateSpecifications(details);

        // Features
        const features = details.features || [];
        const featuresList = $('#featuresList');
        featuresList.empty();
        
        if (features.length > 0) {
            features.forEach(feature => {
                featuresList.append(`<li>${escapeHtml(feature)}</li>`);
            });
        } else {
            featuresList.append('<li>No specific features listed</li>');
        }

        // Description - combine all available information
        let fullDescription = '';
        if (details.description) {
            fullDescription += details.description + '\n\n';
        }
        if (details.additional_info && details.additional_info !== details.description) {
            fullDescription += 'Additional Information:\n' + details.additional_info + '\n\n';
        }
        
        // Add comprehensive specifications to description
        const specs = [];
        
        // Basic info
        if (details.brand || details.manufacturer) specs.push(`Brand/Manufacturer: ${details.brand || details.manufacturer}`);
        if (details.model) specs.push(`Model: ${details.model}`);
        if (details.year) specs.push(`Year: ${details.year}`);
        if (details.condition && details.condition !== 'N/A') specs.push(`Condition: ${details.condition}`);
        if (details.status) specs.push(`Status: ${details.status}`);
        if (details.type) specs.push(`Type: ${details.type}`);
        if (details.category) specs.push(`Category: ${details.category}`);
        if (details.vin) specs.push(`VIN: ${details.vin}`);
        if (details.stock_number) specs.push(`Stock: ${details.stock_number}`);
        
        // Dimensions
        if (details.floor_length) specs.push(`Floor Length: ${details.floor_length}`);
        if (details.floor_width) specs.push(`Floor Width: ${details.floor_width}`);
        if (details.length_total) specs.push(`Total Length: ${details.length_total}`);
        if (details.width_total) specs.push(`Total Width: ${details.width_total}`);
        if (details.floor_height) specs.push(`Floor Height: ${details.floor_height}`);
        if (details.dimensions && !details.floor_length) specs.push(`Dimensions: ${details.dimensions}`);
        
        // Weight & Capacity
        if (details.weight) specs.push(`Weight: ${details.weight}`);
        if (details.empty_weight && details.empty_weight !== details.weight) specs.push(`Empty Weight: ${details.empty_weight}`);
        if (details.axle_capacity) specs.push(`Axle Capacity: ${details.axle_capacity}`);
        if (details.axles) specs.push(`Number of Axles: ${details.axles}`);
        
        // Construction & Design
        if (details.construction) specs.push(`Construction: ${details.construction}`);
        if (details.color) specs.push(`Color: ${details.color}`);
        if (details.pull_type) specs.push(`Pull Type: ${details.pull_type}`);
        if (details.rental) specs.push(`Rental: ${details.rental}`);
        
        if (specs.length > 0) {
            fullDescription += 'Specifications:\n' + specs.join('\n') + '\n\n';
        }
        
        // Add features to description
        if (features.length > 0) {
            fullDescription += 'Features:\n' + features.map(f => `• ${f}`).join('\n');
        }

        $('#fullDescription').val(fullDescription.trim() || 'No description available');

        // Images
        $('#imageCount').text(images.length);
        const imageGallery = $('#imageGallery');
        imageGallery.empty();

        if (images.length > 0) {
            images.forEach((image, index) => {
                const imageContainer = $(`
                    <div class="gallery-image-container">
                        <img src="${escapeHtml(image.url)}" 
                             class="gallery-image" 
                             alt="${escapeHtml(image.alt || 'Trailer Image')}"
                             onclick="openImageModal('${escapeHtml(image.url)}', '${escapeHtml(image.alt || 'Trailer Image')}')"
                             onerror="this.parentElement.remove()">
                        <button class="gallery-download-btn" 
                                onclick="event.stopPropagation(); downloadSingleImage('${escapeHtml(image.url)}', '${escapeHtml((image.alt || 'trailer_image').replace(/[^a-zA-Z0-9_\-]/g, '_'))}')"
                                title="Download Image">
                        </button>
                    </div>
                `);
                imageGallery.append(imageContainer);
            });
        } else {
            imageGallery.append('<div class="gallery-placeholder">No images found</div>');
        }

        // Additional info also check if its string
        if (details.additional_info && typeof details.additional_info === 'string' && details.additional_info.trim()) {
            $('#additionalInfo').text(details.additional_info);
            $('#additionalInfoContainer').show();
        }
    }

    // Copy description functionality
    $('#copyDescription').on('click', function() {
        const description = $('#fullDescription').val();
        if (description) {
            navigator.clipboard.writeText(description).then(function() {
                showSuccess('Trailer description copied to clipboard!');
            }).catch(function() {
                // Fallback for older browsers
                $('#fullDescription').select();
                document.execCommand('copy');
                showSuccess('Trailer description copied to clipboard!');
            });
        }
    });

    // Download all images functionality
    $('#downloadAllImages').on('click', function() {
        const images = $('#imageGallery .gallery-image');
        if (images.length === 0) {
            showError('No images available to download for this trailer');
            return;
        }

        // Disable button and show loading
        const $btn = $(this);
        const originalText = $btn.html();
        $btn.prop('disabled', true).html('<div class="icon icon--clock-rotate-left"></div><span>Preparing...</span>');

        // Collect all image URLs and names
        const imageData = [];
        images.each(function(index) {
            const img = $(this);
            const url = img.attr('src');
            const alt = img.attr('alt') || '';
            
            imageData.push({
                url: url,
                alt: alt,
                name: `trailer_image_${index + 1}`
            });
        });

        // Get trailer title for ZIP name
        const trailerTitle = $('#detailTitle').text() || 'trailer';
        const zipName = trailerTitle.replace(/[^a-zA-Z0-9_\-]/g, '_') + '_images';

        // Call the ZIP download API
        $.ajax({
            url: `${window.baseKeyword}Scraper/app/api/download_images_zip.php`,
            method: 'POST',
            data: JSON.stringify({
                images: imageData,
                zipName: zipName
            }),
            contentType: 'application/json',
            xhrFields: {
                responseType: 'blob'
            },
            success: function(data, status, xhr) {
                // Create blob URL and trigger download
                const blob = new Blob([data], { type: 'application/zip' });
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = zipName + '.zip';
                link.style.display = 'none';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
                
                showSuccess(`Successfully downloaded ${imageData.length} trailer images as ZIP file!`);
            },
            error: function(xhr, status, error) {
                let errorMessage = 'Failed to download images';
                
                // Handle different response types
                if (xhr.responseType === 'blob' && xhr.response instanceof Blob) {
                    // Convert blob to text to read error message
                    const reader = new FileReader();
                    reader.onload = function() {
                        try {
                            const errorData = JSON.parse(reader.result);
                            showError(errorData.error || errorMessage);
                        } catch (e) {
                            showError(errorMessage);
                        }
                    };
                    reader.readAsText(xhr.response);
                    return;
                }
                
                if (xhr.responseJSON && xhr.responseJSON.error) {
                    errorMessage = xhr.responseJSON.error;
                } else if (xhr.responseText) {
                    try {
                        const errorData = JSON.parse(xhr.responseText);
                        errorMessage = errorData.error || errorMessage;
                    } catch (e) {
                        // Response is not JSON, use default message
                        if (xhr.responseText.includes('ZIP functionality is not available')) {
                            errorMessage = 'ZIP functionality is not available on this server. Please contact your administrator.';
                        }
                    }
                }
                showError(errorMessage);
            },
            complete: function() {
                // Re-enable button
                $btn.prop('disabled', false).html(originalText);
            }
        });
    });

    // Function to download single image
    window.downloadSingleImage = function(imageUrl, filename) {
        if (!imageUrl) {
            showError('No image available to download');
            return;
        }

        // Create a temporary link to trigger download via our PHP endpoint
        const downloadUrl = `${window.baseKeyword}Scraper/app/api/download_image.php?url=` + encodeURIComponent(imageUrl) + '&filename=' + encodeURIComponent(filename || 'trailer_image');
        
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showSuccess('Trailer image download started!');
    };

    // Image modal functionality
    window.openImageModal = function(imageUrl, imageAlt) {
        const imageModal = $(`
            <div class="modal-overlay modal-overlay--open" id="imageViewModal">
                <div class="modal modal--lg">
                    <div class="modal__header">
                        <h2 class="modal__title">${escapeHtml(imageAlt)}</h2>
                        <button type="button" class="modal__close" onclick="closeImageModal()">
                            <div class="icon icon--close"></div>
                        </button>
                    </div>
                    <div class="modal__content">
                        <div class="text-center">
                            <img src="${escapeHtml(imageUrl)}" style="max-width: 100%; height: auto;" alt="${escapeHtml(imageAlt)}">
                        </div>
                    </div>
                    <div class="modal__footer">
                        <button onclick="downloadSingleImage('${escapeHtml(imageUrl)}', '${escapeHtml(imageAlt.replace(/[^a-zA-Z0-9_\-]/g, '_'))}')" class="btn btn--primary">
                            <div class="icon icon--download"></div>
                            <span>Download</span>
                        </button>
                        <button type="button" class="btn btn--outlined" onclick="closeImageModal()">
                            <span>Close</span>
                        </button>
                    </div>
                </div>
            </div>
        `);

        $('body').append(imageModal);
        
        // Close modal when clicking outside
        imageModal.on('click', function(e) {
            if (e.target === this) {
                closeImageModal();
            }
        });
    };

    // Close image modal function
    window.closeImageModal = function() {
        $('#imageViewModal').removeClass('modal-overlay--open');
        setTimeout(() => {
            $('#imageViewModal').remove();
        }, 300);
    };

    // Global function to create listing from processed trailer
    window.createListingFromTrailer = function(index) {
        const trailer = allTrailers[index];
        if (!trailer || !trailer.processedDetails) {
            showError('Trailer details not yet extracted. Please process this trailer first.');
            return;
        }
        setCurrentProduct(trailer.processedDetails.details, trailer.processedDetails.images);

        // This now only uses localStorage
        markTrailerAsListed(trailer);

        openFacebookMarketplace();
        renderTrailers();
    };

    function markTrailerAsListed(trailer) {
        const key = `fb_listing_date_${trailer.stock || trailer.title}`;
        localStorage.setItem(key, new Date().toISOString());
    }

    // Make updateSelectedCount globally accessible
    window.updateSelectedCount = updateSelectedCount;

    function getDaysSinceListed(trailer) {
        const key = `fb_listing_date_${trailer.stock || trailer.title}`;
        const dateStr = localStorage.getItem(key);
        if (!dateStr) return null;
        const listedDate = new Date(dateStr);
        const now = new Date();
        const diffTime = now - listedDate;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    }

    function markTrailerAsListedOnServer(trailer) {
        $.ajax({
            url: `${window.baseKeyword}Scraper/app/api/mark_as_listed.php`,
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({
                stock: trailer.stock || trailer.title,
                date: new Date().toISOString()
            })
        });
    }

    // Function to calculate days since listed
    function getDaysListed(listedDate) {
        const listed = new Date(listedDate);
        const now = new Date();
        const diffTime = Math.abs(now - listed);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    }

    // Function to check if trailer is listed
    function isTrailerListed(trailer) {
        return listedTrailers.find(lt => 
            lt.stock === (trailer.stock || trailer.stock_number) && 
            lt.title === trailer.title
        );
    }

    // Function to refresh a specific trailer card
    function refreshTrailerCard(trailer) {
        const index = allTrailers.findIndex(t => 
            t.stock === trailer.stock && t.title === trailer.title
        );
        if (index !== -1) {
            const card = $(`.trailer-card[data-index="${index}"]`);
            if (card.length) {
                card.replaceWith(createTrailerCard(allTrailers[index], index));
            }
        }
    }

    // **NEW: Function to immediately move selected trailers to top when processing starts**
    function moveSelectedTrailersToTop(selectedUrls) {
        console.log('🔄 Moving selected trailers to top immediately...');
        
        // Get the selected indices
        const selectedIndices = selectedUrls.map(item => item.index);
        console.log('📋 Selected indices:', selectedIndices);
        
        // Split trailers into selected and non-selected
        const selectedTrailers = [];
        const nonSelectedTrailers = [];
        
        allTrailers.forEach((trailer, index) => {
            if (selectedIndices.includes(index)) {
                selectedTrailers.push(trailer);
            } else {
                nonSelectedTrailers.push(trailer);
            }
        });
        
        // Reorder: selected trailers first, then non-selected
        allTrailers = [...selectedTrailers, ...nonSelectedTrailers];
        
        console.log('✅ Reordered trailers:', allTrailers.map((t, i) => ({ 
            index: i, 
            title: t.title?.substring(0, 30) + '...', 
            isSelected: selectedIndices.includes(i) 
        })));
        
        // Re-render the trailers with new order
        renderTrailers();
        
        // Show visual feedback that trailers have been moved to top
        showSuccess(`${selectedTrailers.length} selected trailers moved to top of list for processing!`);
        
        // Add temporary highlight to moved trailers
        setTimeout(() => {
            for (let i = 0; i < selectedTrailers.length; i++) {
                const card = $(`.trailer-card[data-index="${i}"]`);
                card.addClass('trailer-moved-to-top');
                setTimeout(() => {
                    card.removeClass('trailer-moved-to-top');
                }, 3000);
            }
        }, 100);
        
        // Update the selectedUrls with new indices after reordering
        selectedUrls.forEach((item, i) => {
            item.index = i; // Selected trailers are now at the top, so indices are 0, 1, 2, etc.
        });
        
        // Re-check the checkboxes for the moved trailers
        setTimeout(() => {
            for (let i = 0; i < selectedTrailers.length; i++) {
                const checkbox = $(`.trailer-card[data-index="${i}"] .trailer-checkbox`);
                checkbox.prop('checked', true);
            }
            updateSelectedCount();
        }, 200);
    }

    // Add a sorting function to move processed trailers to the top
    function sortTrailersByProcessed() {
        console.log('🔍 Before sorting:', allTrailers.map((t, i) => ({ index: i, title: t.title, isProcessed: t.isProcessed })));
        
        allTrailers.sort((a, b) => {
            // Processed first, then by original order if needed
            if (a.isProcessed && !b.isProcessed) return -1;
            if (!a.isProcessed && b.isProcessed) return 1;
            return 0;
        });
        
        console.log('🔍 After sorting:', allTrailers.map((t, i) => ({ index: i, title: t.title, isProcessed: t.isProcessed })));
    }

    function updateTrailerCard(index) {
        const trailer = allTrailers[index];
        if (!trailer) return;
        
        // Find the existing card
        const existingCard = $(`.trailer-card[data-index="${index}"]`);
        if (existingCard.length === 0) return;
        
        // Find the actions container
        const actionsContainer = existingCard.find('.trailer-card-actions');
        if (actionsContainer.length === 0) return;
        
        // Check if Create Listing button already exists
        if (actionsContainer.find('.create-listing-btn').length > 0) return;
        
        // Add Create Listing button after the View Details button
        const createListingBtn = $(`
            <button onclick="createListingFromTrailer(${index})" 
                    class="btn btn--primary action-btn create-listing-btn">
                <div class="icon icon--plus"></div>
                <span>Create Listing</span>
            </button>
        `);
        
        // Insert after the View Details button
        const viewDetailsBtn = actionsContainer.find('button').first();
        viewDetailsBtn.after(createListingBtn);
        
        // Add a subtle animation to highlight the new button
        createListingBtn.hide().fadeIn(300);
        
        // Add a temporary highlight effect
        existingCard.addClass('trailer-processed');
        setTimeout(() => {
            existingCard.removeClass('trailer-processed');
        }, 2000);
    }

    // Function to save URL to database
    function saveUrlToDatabase(url) {
        $.ajax({
            url: `${window.baseKeyword}Scraper/app/api/manage_scrape_urls.php`,
            method: 'POST',
            data: JSON.stringify({
                url: url,
                title: extractDomainFromUrl(url),
                description: 'Scraped on ' + new Date().toLocaleDateString()
            }),
            contentType: 'application/json',
            success: function(response) {
                if (response.success) {
                    console.log('URL saved to database:', response.message);
                    // Refresh suggestions
                    loadUrlSuggestions();
                }
            },
            error: function(xhr, status, error) {
                console.warn('Failed to save URL to database:', error);
                // Don't show error to user as this is not critical
            }
        });
    }

    // Function to extract domain from URL for title
    function extractDomainFromUrl(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname.replace('www.', '');
        } catch (e) {
            return 'Unknown Domain';
        }
    }

    // Function to load URL suggestions
    function loadUrlSuggestions() {
        $.ajax({
            url: `${window.baseKeyword}Scraper/app/api/manage_scrape_urls.php`,
            method: 'GET',
            success: function(response) {
                if (response.success && response.data.length > 0) {
                    populateUrlSuggestions(response.data);
                }
            },
            error: function(xhr, status, error) {
                console.warn('Failed to load URL suggestions:', error);
            }
        });
    }

    // Function to populate URL suggestions
    function populateUrlSuggestions(suggestions) {
        const suggestionsList = $('#suggestionsList');
        suggestionsList.empty();

        const trashIcon = `
            <svg class="scraper-url-suggestion-delete-icon" xmlns="http://www.w3.org/2000/svg" height="20" width="20" viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-2 14H7L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>
        `;

        suggestions.forEach(suggestion => {
            const html = `
                <div class="scraper-url-suggestion-row">
                    <span 
                        class="scraper-url-suggestion-link"
                        title="${escapeHtml(suggestion.url)}"
                        onclick="selectUrlSuggestion('${escapeHtml(suggestion.url)}')"
                    >
                        ${escapeHtml(suggestion.title || extractDomainFromUrl(suggestion.url))}
                    </span>
                    <button 
                        class="scraper-url-suggestion-delete"
                        title="Delete"
                        onclick="deleteUrlSuggestion(${suggestion.id})"
                    >${trashIcon}</button>
                </div>
            `;
            suggestionsList.append(html);
        });
    }

    // Global functions for URL suggestions
    window.selectUrlSuggestion = function(url) {
        $('#url').val(url);
        suppressNextSuggestion = true;
        $('#urlSuggestions').hide();
        $('#url').focus();
    };

    window.deleteUrlSuggestion = function(id) {
        if (confirm('Are you sure you want to delete this saved URL?')) {
            $.ajax({
                url: `${window.baseKeyword}Scraper/app/api/manage_scrape_urls.php`,
                method: 'DELETE',
                data: JSON.stringify({ id: id }),
                contentType: 'application/json',
                success: function(response) {
                    if (response.success) {
                        showSuccess('Saved URL deleted successfully');
                        loadUrlSuggestions();
                    } else {
                        showError('Unable to delete saved URL: ' + response.error);
                    }
                },
                error: function(xhr, status, error) {
                    showError('Unable to delete saved URL: ' + error);
                }
            });
        }
    };

    window.hideUrlSuggestions = function() {
        $('#urlSuggestions').hide();
    };

    // Show suggestions when URL input is focused
    $('#url').on('focus', function() {
        if (suppressNextSuggestion) {
            suppressNextSuggestion = false;
            return;
        }
        $('#urlSuggestions').show();
    });

    // Hide suggestions when clicking outside
    $(document).on('click', function(e) {
        if (!$(e.target).closest('.url-input-container').length) {
            $('#urlSuggestions').hide();
        }
    });

    // Load suggestions on page load
    loadUrlSuggestions();
}

// Function to manually refresh proxy information (for debugging)
window.refreshProxyInfo = async function() {
    console.log('🔄 Manually refreshing proxy information...');
    const ip = await fetchCurrentProxyIP();
    console.log('✅ Proxy refresh complete. Current state:', {
        currentProxyIP: window.currentProxyIP,
        currentProxyType: window.currentProxyType,
        currentProxySessionBased: window.currentProxySessionBased,
        fetchedIP: ip
    });
    return {
        currentProxyIP: window.currentProxyIP,
        currentProxyType: window.currentProxyType,
        currentProxySessionBased: window.currentProxySessionBased
    };
};

// Initialize when document is ready
$(document).ready(function() {
    // Only initialize if we're not in the dealer dashboard context
    if (typeof window.scraperInit === 'undefined') {
        window.scraperInit = function() {
            console.log('Scraper module initialized');
            initializeScraper();
        };
        
        // Auto-initialize if standalone
        initializeScraper();
        
        // Check proxy status and fetch current IP on page load
        checkProxyStatus();
        fetchCurrentProxyIP();
    }
});

// Function to fetch current dynamic proxy IP from Oxylabs (now with session-based proxy)
async function fetchCurrentProxyIP() {
    try {
        console.log('🌐 Fetching current proxy IP (session-based to prevent Facebook blocks)...');
        
        const response = await fetch(`${window.baseKeyword}Scraper/app/api/get_proxy_ip.php`);
        const data = await response.json();
        
        if (data.success && data.proxy_info.ip) {
            // Store the current proxy information globally
            window.currentProxyIP = data.proxy_info.ip;
            window.currentProxyType = data.proxy_info.type || 'unknown';
            window.currentProxySessionBased = data.proxy_info.type === 'session_persistent';
            
            const proxyType = data.proxy_info.type || 'unknown';
            const isSessionBased = proxyType === 'session_persistent';
            
            console.log(`✅ Current proxy IP fetched: ${data.proxy_info.ip}`);
            console.log(`🔒 Proxy type: ${proxyType} ${isSessionBased ? '(Prevents Facebook blocks!)' : '(May cause Facebook blocks)'}`);
            console.log('📊 Proxy details:', data.proxy_info);
            console.log(`🎯 Global proxy variables updated:`, {
                currentProxyIP: window.currentProxyIP,
                currentProxyType: window.currentProxyType,
                currentProxySessionBased: window.currentProxySessionBased
            });
            
            // Update proxy status display with enhanced information
            updateProxyStatusDisplay(data.proxy_info);
            
            // Show session-based proxy status (only if showSuccess is available)
            if (typeof showSuccess === 'function') {
                if (isSessionBased) {
                    showSuccess(`Secure proxy connection active! IP: ${data.proxy_info.ip} (Enhanced account protection)`);
                } else if (typeof showWarning === 'function') {
                    showWarning(`⚠️ Using standard proxy connection. For better account protection, please refresh your connection.`);
                } else {
                    console.warn(`⚠️ Using fallback rotating proxy. This may cause Facebook account blocks. Please login again to get session-persistent proxy.`);
                }
            } else {
                // Just log if UI functions are not available
                if (isSessionBased) {
                    console.log(`🔒 Session-persistent proxy active! IP: ${data.proxy_info.ip} (Prevents Facebook account blocks)`);
                } else {
                    console.warn(`⚠️ Using fallback rotating proxy. This may cause Facebook account blocks. Please login again to get session-persistent proxy.`);
                }
            }
            
            return data.proxy_info.ip;
        } else {
            console.warn('⚠️ Failed to fetch proxy IP, using fallback:', data.error || 'Unknown error');
            window.currentProxyIP = "173.172.64.37"; // fallback
            window.currentProxyType = "fallback";
            window.currentProxySessionBased = false;
            return window.currentProxyIP;
        }
    } catch (error) {
        console.error('❌ Error fetching proxy IP:', error);
        window.currentProxyIP = "173.172.64.37"; // fallback
        window.currentProxyType = "fallback";
        window.currentProxySessionBased = false;
        return window.currentProxyIP;
    }
}

// Function to update proxy status display
function updateProxyStatusDisplay(proxyInfo) {
    const statusHtml = `
        <div class="alert alert-success mt-2" style="font-size: 12px; padding: 8px;">
                            <strong>🌐 Proxy Active</strong><br>
            <small>IP: ${proxyInfo.ip} | Location: ${proxyInfo.city}, ${proxyInfo.country}</small><br>
            <small>Server: ${proxyInfo.host}:${proxyInfo.port} | Status: ${proxyInfo.status.toUpperCase()}</small><br>
            <small>Updated: ${proxyInfo.formatted_time}</small>
        </div>
    `;
    
    // Update or create proxy status element
    let proxyStatusElement = $('#dynamicProxyStatus');
    if (proxyStatusElement.length === 0) {
        // Create new status element
        $('.container').first().append(`<div id="dynamicProxyStatus">${statusHtml}</div>`);
    } else {
        // Update existing element
        proxyStatusElement.html(statusHtml);
    }
}

// Function to check and display proxy status
function checkProxyStatus() {
    // Simple proxy status check - just show indicator if proxy is likely enabled
    $('#proxyStatus').show();
    console.log('🌐 Proxy status indicator displayed');
}

// Initialize City Proxy Selector
function initializeCityProxySelector() {
    console.log('🌐 Initializing City Proxy Selector...');
    
    // Check if container exists
    const cityProxyContainer = document.getElementById('cityProxySelector');
    if (!cityProxyContainer) {
        console.log('🔍 City Proxy Selector container not found on this page');
        return;
    }
    
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
}

