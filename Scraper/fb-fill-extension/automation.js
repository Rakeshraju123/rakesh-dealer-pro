(function() {
    console.log('[Automation Extension] Loaded on CRM scraper page');
    
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
        pauseResolve: null
    };
    
    // Wait for DOM to be ready
    function onReady(fn) {
        if (document.readyState !== 'loading') fn();
        else document.addEventListener('DOMContentLoaded', fn);
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

    // Main automation function
    async function startAutomation(isFullAutomation = false) {
        try {
            // Check if automation is already running
            if (automationState.isRunning) {
                alert('Automation is already running! Please stop the current automation before starting a new one.');
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
                isFullAutomation: isFullAutomation
            };

            console.log(`[Automator] 🚀 ${isFullAutomation ? 'Full' : 'Semi'} Automation started`);
            
            // Show automation started notification
            const message = isFullAutomation ? 
                '[Automator] 🚀 Full Automation Started! Processing trailers, opening Facebook tabs, and automatically publishing vehicles...' :
                '[Automator] ⚡ Semi Automation Started! Processing trailers and opening Facebook tabs (manual publishing required)...';
            console.log(message);
    
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
                alert('No unlisted trailers found!');
                automationState.isRunning = false;
                return;
            }
            console.log(`[Automator] Total trailers checked: ${checkedCount}`);
    
            // 4. Wait for "Extract Details" button to appear and click it (increased timeout)
            await waitForSelector('#batchProcessBtn', 20000);
            const extractBtn = document.querySelector('#batchProcessBtn');
            if (!extractBtn) throw new Error('Extract Details button not found');
            extractBtn.click();
            console.log('[Automator] Clicked Extract Details');
    
            // 5. NEW PARALLEL PROCESSING: Track each trailer and open Facebook immediately when ready
            // Show progress tracking
            console.log(`[Automator] 🚀 Parallel processing started! Facebook tabs will open as trailers are processed (${automationState.stocksToProcess.length} total)`);
            
            const observer = new MutationObserver(async () => {
                // Check if automation is stopped
                if (automationState.isStopped) {
                    observer.disconnect();
                    return;
                }
                
                // Check if automation is paused
                if (automationState.isPaused) {
                    return; // Skip processing while paused
                }
                
                for (const stock of automationState.stocksToProcess) {
                    if (automationState.processedStocks.has(stock)) continue;
                    
                    const card = Array.from(document.querySelectorAll('.trailer-card')).find(card =>
                        card.querySelector('.chip span')?.textContent?.replace('Stock: ', '').trim() === stock
                    );
                    if (!card) continue;
                    
                    const createBtn = card.querySelector('.create-listing-btn');
                    if (createBtn) {
                        // Get trailer data
                        const trailerIndex = parseInt(card.getAttribute('data-index'));
                        const trailer = window.allTrailers ? window.allTrailers[trailerIndex] : null;
                        
                        if (trailer && trailer.processedDetails) {
                            // Mark as processed
                            automationState.processedStocks.add(stock);
                            automationState.totalProcessed++;
                            
                            console.log(`[Automator] ✅ Trailer ${stock} processed (${automationState.totalProcessed}/${automationState.stocksToProcess.length})`);
                            
                            // Set current product data for the extension (if the function exists)
                            if (window.setCurrentProduct && trailer.processedDetails.details) {
                                // Add automation type to the product data
                                const productData = {
                                    ...trailer.processedDetails.details,
                                    automation_type: automationState.isFullAutomation ? "full" : "semi"
                                };
                                window.setCurrentProduct(productData, trailer.processedDetails.images || []);
                            }
                            
                            // Mark trailer as listed in localStorage
                            const listedKey = 'fb_listing_date_' + stock;
                            localStorage.setItem(listedKey, new Date().toISOString());
                            
                            // Add 2-second delay for items after the first one (pausable)
                            if (automationState.totalProcessed > 1) {
                                console.log(`[Automator] ⏳ Waiting 2 seconds before opening Facebook tab for ${stock}...`);
                                await new Promise(resolve => {
                                    if (automationState.isPaused) {
                                        automationState.pauseResolve = resolve;
                                    } else {
                                        setTimeout(() => {
                                            // Check if we got paused during the delay
                                            if (automationState.isPaused) {
                                                automationState.pauseResolve = resolve;
                                            } else {
                                                resolve();
                                            }
                                        }, 2000);
                                    }
                                });
                                
                                // Check if automation was stopped during delay
                                if (automationState.isStopped) {
                                    return;
                                }
                            }
                            
                            // Open Facebook Marketplace through proxy
                            console.log(`[Automator] 🌐 Opening Facebook Marketplace through selected proxy for ${stock}`);
                            if (window.openFacebookMarketplace) {
                                window.openFacebookMarketplace();
                            } else {
                                // Fallback to proxy-enabled opening
                                if (window.openFacebookThroughProxy) {
                                    window.openFacebookThroughProxy({
                                        type: "FB_MARKETPLACE_DATA",
                                        title: trailer.processedDetails?.details?.title || trailer.title,
                                        stock: stock
                                    });
                                } else {
                                    window.open("https://www.facebook.com/marketplace/create/vehicle", "_blank");
                                }
                            }
                            automationState.marketplaceOpened++;
                            
                            // Show progress update
                            console.log(`[Automator] 📈 Progress: ${automationState.totalProcessed}/${automationState.stocksToProcess.length} trailers processed and Facebook tabs opened`);
                        }
                    }
                }
                
                // Check if all trailers are processed
                if (automationState.processedStocks.size === automationState.stocksToProcess.length) {
                    observer.disconnect();
                    automationState.isRunning = false;
                    console.log('[Automator] 🎉 All trailers processed and Facebook tabs opened!');
                    console.log(`[Automator] 🎉 Automation Complete! All ${automationState.stocksToProcess.length} trailers processed and Facebook Marketplace tabs opened!`);
                    
                    // Optional: Show final summary
                    setTimeout(() => {
                        alert(`🎉 Parallel Processing Complete!\n\n✅ ${automationState.stocksToProcess.length} trailers processed\n🌐 ${automationState.stocksToProcess.length} Facebook Marketplace tabs opened\n\n⚡ Optimized timing - first tab immediate, others with 2-second intervals!`);
                    }, 2000);
                }
            });
    
            // Store observer reference for stopping
            automationState.observer = observer;
    
            // Observe the trailers grid for changes
            const grid = document.getElementById('trailersGrid') || document.body;
            observer.observe(grid, { childList: true, subtree: true });
    
            // Also trigger the observer immediately in case some are already ready
            setTimeout(() => observer.takeRecords() && observer.callback && observer.callback(), 1000);
    
        } catch (err) {
            console.error('[Automator] ❌ Error:', err);
            console.error('[Automator] Stack trace:', err.stack);
            
            // Reset automation state on error
            automationState.isRunning = false;
            
            // More detailed error information
            const trailerCount = document.querySelectorAll('.trailer-card').length;
            const isLoading = document.getElementById('loading')?.style.display !== 'none';
            const batchBtn = document.querySelector('#batchProcessBtn');
            
            console.error('[Automator] Debug info:', {
                trailerCount,
                isLoading,
                hasBatchBtn: !!batchBtn,
                batchBtnVisible: batchBtn?.style.display !== 'none'
            });
            
            alert('Automation failed: ' + err.message + '\n\nCheck console for more details.');
        }
    }

    // Legacy functions kept for backward compatibility but no longer used in parallel processing
    // These functions are replaced by the new parallel processing approach in startAutomation()
    
    function showMasterCreateListingButton(processedTrailers) {
        console.log('[Legacy] showMasterCreateListingButton called but parallel processing is now used instead');
        // This function is no longer needed with parallel processing
    }

    async function startMasterListingProcess(processedTrailers) {
        console.log('[Legacy] startMasterListingProcess called but parallel processing is now used instead');
        // This function is no longer needed with parallel processing
    }

    // Function to pause automation
    function pauseAutomation() {
        if (!automationState.isRunning) return;
        
        automationState.isPaused = true;
        console.log('[Automator] ⏸️ Automation paused');
        
        alert('⏸️ Automation paused. Use resumeAutomation() to continue processing.');
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
        
        alert('▶️ Automation resumed. Processing will continue...');
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
        
        alert(`🛑 Automation stopped! Processed ${automationState.totalProcessed}/${automationState.stocksToProcess.length} trailers before stopping.`);
        
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
            pauseResolve: null
        };
    }

    // Make automation functions globally available
    window.startAutomation = startAutomation;
    window.pauseAutomation = pauseAutomation;
    window.resumeAutomation = resumeAutomation;
    window.stopAutomation = stopAutomation;
    window.waitForSelector = waitForSelector;
    window.waitForCondition = waitForCondition;
    window.showMasterCreateListingButton = showMasterCreateListingButton;
    window.startMasterListingProcess = startMasterListingProcess;

    console.log('[Automation Extension] Automation functions loaded and ready');
})();