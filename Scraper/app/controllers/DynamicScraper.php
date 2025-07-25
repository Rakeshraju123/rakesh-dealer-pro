<?php

require_once __DIR__ . '/../../vendor/autoload.php';
require_once __DIR__ . '/openAiScraper.php';

use Facebook\WebDriver\Remote\RemoteWebDriver;
use Facebook\WebDriver\Remote\DesiredCapabilities;
use Facebook\WebDriver\WebDriverBy;
use Facebook\WebDriver\WebDriverExpectedCondition;
use Facebook\WebDriver\WebDriverWait;
use Facebook\WebDriver\Chrome\ChromeOptions;
use Facebook\WebDriver\WebDriverDimension;
use Facebook\WebDriver\Exception\TimeoutException;
use Facebook\WebDriver\Exception\NoSuchElementException;

/**
 * DynamicScraper - Enhanced scraper that handles dynamic content loading with scrolling
 */
class DynamicScraper extends OpenAiScraper
{
    /**
     * @var RemoteWebDriver WebDriver instance
     */
    private $driver;
    
    /**
     * @var string Path to ChromeDriver executable
     */
    private $chromedriverPath;
    
    /**
     * @var string User data directory for this session
     */
    private $userDataDir;
    
    /**
     * @var int Maximum scroll attempts
     */
    private $maxScrollAttempts = 4;
    
    /**
     * @var int Scroll wait time in seconds
     */
    private $scrollWaitTime = 2;
    
    /**
     * @var array Scroll position thresholds (multiple positions to scroll to)
     */
    private $scrollThreshold = [0.75, 0.8, 0.9, 1];

    /**
     * Constructor
     */
    public function __construct()
    {
        parent::__construct();
        
        // Get ChromeDriver path from environment configuration
        $this->chromedriverPath = DotEnvLoader::getChromedriverPath();
        
        // Verify the configured path exists
        if (!file_exists($this->chromedriverPath)) {
            // Fallback to which command to find ChromeDriver in PATH
            $chromedriverFromPath = trim(shell_exec('which chromedriver 2>/dev/null'));
            if (!empty($chromedriverFromPath) && file_exists($chromedriverFromPath)) {
                $this->chromedriverPath = $chromedriverFromPath;
            }
        }
        
        // Final fallback to local paths (for backward compatibility)
        if (!file_exists($this->chromedriverPath)) {
            // Try local chromedriver folder
            $this->chromedriverPath = __DIR__ . '/../../chromedriver/chromedriver-linux64/chromedriver';
        }
        
        if (!file_exists($this->chromedriverPath)) {
            // Try direct path in Scraper directory
            $this->chromedriverPath = __DIR__ . '/../../chromedriver';
        }
        
        if (!file_exists($this->chromedriverPath)) {
            throw new \RuntimeException('ChromeDriver not found. Please ensure ChromeDriver is installed system-wide or locally.');
        }
        
        // Make executable (if we have permission)
        if (is_writable($this->chromedriverPath)) {
            chmod($this->chromedriverPath, 0755);
        }
        
        $this->logger->info('DynamicScraper initialized', [
            'chromedriver_path' => $this->chromedriverPath
        ]);
    }

    /**
     * Start WebDriver session
     */
    private function startWebDriver()
    {
        if ($this->driver) {
            return; // Already started
        }

        $this->logger->info('Starting WebDriver session');

        try {
            // Clean up any orphaned resources first
            $this->cleanupOrphanedResources();
            
            // Start ChromeDriver service
            $this->startChromeDriverService();
            
            // Create unique user data directory for this session with multiple entropy sources
            $timestamp = time();
            $microtime = microtime(true);
            $processId = getmypid();
            $randomId = uniqid();
            $randomBytes = bin2hex(random_bytes(8));
            $sessionId = md5($timestamp . $microtime . $processId . $randomId . $randomBytes);
            
            // Use a more unique directory name with session ID
            $this->userDataDir = sys_get_temp_dir() . '/chrome_session_' . $sessionId;
            
            // Ensure the user data directory exists and is clean
            if (is_dir($this->userDataDir)) {
                $this->removeDirectory($this->userDataDir);
            }
            
            // Create directory with proper permissions for apache user
            mkdir($this->userDataDir, 0755, true);
            
            // Ensure the directory is writable by the current user (apache when running via web)
            if (function_exists('posix_getpwuid') && function_exists('posix_geteuid')) {
                $currentUser = posix_getpwuid(posix_geteuid());
                $this->logger->info('Creating user data directory', [
                    'user' => $currentUser['name'] ?? 'unknown',
                    'directory' => $this->userDataDir
                ]);
            }
            
            // Get proxy configuration
            $proxyConfig = DotEnvLoader::getOxylabsConfig();
            
            // Configure Chrome options for stable multi-session usage
            $chromeOptions = new ChromeOptions();
            $chromeOptions->addArguments([
                '--headless=new',
                '--no-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor',
                '--window-size=1920,1080',
                '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
                '--user-data-dir=' . $this->userDataDir,
                '--remote-debugging-port=0',
                '--disable-extensions',
                '--disable-plugins',
                '--disable-default-apps',
                '--disable-sync',
                '--disable-translate',
                '--no-first-run',
                '--disable-notifications',
                '--disable-popup-blocking',
                '--disable-hang-monitor',
                '--disable-client-side-phishing-detection',
                '--disable-background-networking',
                '--disable-domain-reliability',
                '--disable-features=MediaRouter',
                '--disable-speech-api',
                '--disable-permissions-api',
                '--no-default-browser-check',
                '--disable-logging',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding',
                '--disable-background-timer-throttling',
                '--disable-ipc-flooding-protection',
                '--disable-blink-features=AutomationControlled',
                '--disable-blink-features=AutomationControlled',
                '--exclude-switches=enable-automation',
                '--use-fake-ui-for-media-stream',
                '--use-fake-device-for-media-stream'
            ]);

            // Add proxy configuration if enabled
            if ($proxyConfig['enabled']) {
                // Format: protocol://username:password@host:port
                $proxyString = 'http://' . $proxyConfig['username'] . ':' . $proxyConfig['password'] . '@' . $proxyConfig['host'] . ':' . $proxyConfig['port'];
                
                $chromeOptions->addArguments([
                    '--proxy-server=' . $proxyString
                ]);
                
                // Set proxy authentication via preferences
                $prefs = [
                    'credentials_enable_service' => false,
                    'profile.password_manager_enabled' => false,
                    'profile.default_content_setting_values.notifications' => 2,
                    'profile.default_content_settings.popups' => 0,
                    'profile.managed_default_content_settings.images' => 2
                ];
                
                $chromeOptions->setExperimentalOption('prefs', $prefs);
                
                $this->logger->info('Chrome configured with Kansas City proxy', [
                    'proxy_host' => $proxyConfig['host'],
                    'proxy_port' => $proxyConfig['port'],
                    'proxy_username' => $proxyConfig['username'],
                    'proxy_location' => $proxyConfig['location'],
                    'user_data_dir' => $this->userDataDir
                ]);
            }

            $capabilities = DesiredCapabilities::chrome();
            $capabilities->setCapability(ChromeOptions::CAPABILITY, $chromeOptions);

            // Connect to WebDriver with retry logic
            $maxRetries = 3;
            $retryCount = 0;
            
            while ($retryCount < $maxRetries) {
                try {
                    $this->driver = RemoteWebDriver::create('http://localhost:9515', $capabilities);
                    break; // Success, exit retry loop
                } catch (\Exception $e) {
                    $retryCount++;
                    $this->logger->warning('WebDriver connection attempt failed', [
                        'attempt' => $retryCount,
                        'error' => $e->getMessage()
                    ]);
                    
                    if ($retryCount >= $maxRetries) {
                        throw $e; // Re-throw if all retries failed
                    }
                    
                    // Wait before retry
                    sleep(2);
                }
            }
            
            // Set window size
            $this->driver->manage()->window()->setSize(new WebDriverDimension(1920, 1080));
            
            // Handle proxy authentication if needed
            if ($proxyConfig['enabled']) {
                $this->handleProxyAuthentication($proxyConfig);
            }
            
            $this->logger->info('WebDriver session started successfully', [
                'user_data_dir' => $this->userDataDir,
                'proxy_enabled' => $proxyConfig['enabled'],
                'proxy_location' => $proxyConfig['location'],
                'session_id' => $this->driver->getSessionID()
            ]);
            
        } catch (\Exception $e) {
            $this->logger->error('Failed to start WebDriver session', [
                'error' => $e->getMessage(),
                'user_data_dir' => $this->userDataDir ?? 'not set'
            ]);
            
            // Clean up user data directory on failure
            if (isset($this->userDataDir) && is_dir($this->userDataDir)) {
                $this->removeDirectory($this->userDataDir);
            }
            
            throw new \RuntimeException('Failed to start WebDriver: ' . $e->getMessage());
        }
    }

    /**
     * Start ChromeDriver service
     */
    private function startChromeDriverService()
    {
        // Check if ChromeDriver is already running and responsive
        if ($this->isChromeDriverResponsive()) {
            $this->logger->info('ChromeDriver service already running and responsive on port 9515');
            return;
        }

        // Kill any ChromeDriver processes that might be using port 9515 but not responding
        $portCheck = shell_exec('lsof -ti :9515 2>/dev/null');
        if (!empty($portCheck)) {
            $pids = array_filter(explode("\n", trim($portCheck)));
            foreach ($pids as $pid) {
                if (is_numeric($pid)) {
                    $this->logger->info('Killing unresponsive process on port 9515', ['pid' => $pid]);
                    shell_exec("kill -9 $pid 2>/dev/null");
                }
            }
            sleep(1); // Give time for cleanup
        }

        $this->logger->info('Starting ChromeDriver service', [
            'chromedriver_path' => $this->chromedriverPath,
            'port' => 9515
        ]);

        // Start ChromeDriver service with proper error handling
        $logFile = '/tmp/chromedriver_' . getmypid() . '_' . time() . '.log';
        $command = $this->chromedriverPath . ' --port=9515 --whitelisted-ips=127.0.0.1 --log-level=INFO > ' . $logFile . ' 2>&1 &';
        $output = shell_exec($command);
        
        // Wait longer for service to start and verify it's running
        $maxWaitTime = 10; // seconds
        $waitInterval = 0.5; // seconds
        $totalWaited = 0;
        
        while ($totalWaited < $maxWaitTime) {
            usleep($waitInterval * 1000000); // Convert to microseconds
            $totalWaited += $waitInterval;
            
            // Check if ChromeDriver is running and responsive
            if ($this->isChromeDriverResponsive()) {
                $this->logger->info('ChromeDriver service started successfully', [
                    'port' => 9515,
                    'wait_time' => $totalWaited . 's'
                ]);
                return;
            }
        }
        
        // If we get here, ChromeDriver failed to start
        $logContent = @file_get_contents($logFile);
        $this->logger->error('ChromeDriver failed to start within timeout', [
            'timeout' => $maxWaitTime . 's',
            'chromedriver_log' => $logContent ?: 'No log available',
            'log_file' => $logFile
        ]);
        
        throw new \RuntimeException('ChromeDriver service failed to start on port 9515');
    }

    /**
     * Check if ChromeDriver service is responsive
     */
    private function isChromeDriverResponsive()
    {
        try {
            $ch = curl_init();
            curl_setopt($ch, CURLOPT_URL, 'http://localhost:9515/status');
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_TIMEOUT, 2);
            curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 2);
            
            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            
            if ($httpCode === 200 && $response) {
                $data = json_decode($response, true);
                if (isset($data['value']['ready']) && $data['value']['ready']) {
                    return true;
                }
            }
            
            return false;
        } catch (\Exception $e) {
            return false;
        }
    }

    /**
     * Stop WebDriver session
     */
    private function stopWebDriver()
    {
        if ($this->driver) {
            try {
                $this->driver->quit();
                $this->logger->info('WebDriver session stopped');
            } catch (\Exception $e) {
                $this->logger->warning('Error stopping WebDriver', [
                    'error' => $e->getMessage()
                ]);
            }
            $this->driver = null;
        }
        
        // Clean up user data directory
        if ($this->userDataDir && is_dir($this->userDataDir)) {
            try {
                $this->removeDirectory($this->userDataDir);
                $this->logger->info('User data directory cleaned up', [
                    'directory' => $this->userDataDir
                ]);
            } catch (\Exception $e) {
                $this->logger->warning('Error cleaning up user data directory', [
                    'directory' => $this->userDataDir,
                    'error' => $e->getMessage()
                ]);
            }
            $this->userDataDir = null;
        }
    }

    /**
     * Enhanced cleanup of orphaned resources
     */
    private function cleanupOrphanedResources()
    {
        $this->logger->info('Cleaning up orphaned Chrome resources');
        
        try {
            // Only kill Chrome processes with our specific user data patterns (not ChromeDriver)
            exec('pkill -f "chrome.*user-data-dir=/tmp/chrome_user_data" 2>/dev/null', $output, $returnCode);
            exec('pkill -f "chrome.*user-data-dir=/tmp/chrome_session" 2>/dev/null', $output, $returnCode);
            
            // Clean up old user data directories (older than 1 hour)
            $tempDir = sys_get_temp_dir();
            $patterns = [
                $tempDir . '/chrome_user_data_*',
                $tempDir . '/chrome_session_*'
            ];
            $directories = [];
            foreach ($patterns as $pattern) {
                $directories = array_merge($directories, glob($pattern));
            }
            
            $oneHourAgo = time() - 3600;
            $cleanedCount = 0;
            
            foreach ($directories as $dir) {
                if (is_dir($dir)) {
                    $dirTime = filemtime($dir);
                    if ($dirTime < $oneHourAgo) {
                        $this->removeDirectory($dir);
                        $cleanedCount++;
                    }
                }
            }
            
            $this->logger->info('Cleanup completed', [
                'old_directories_removed' => $cleanedCount
            ]);
            
        } catch (\Exception $e) {
            $this->logger->warning('Error during cleanup', [
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * Enhanced directory removal
     */
    private function removeDirectory($dir)
    {
        if (!is_dir($dir)) {
            return;
        }
        
        try {
            $files = new \RecursiveIteratorIterator(
                new \RecursiveDirectoryIterator($dir, \RecursiveDirectoryIterator::SKIP_DOTS),
                \RecursiveIteratorIterator::CHILD_FIRST
            );
            
            foreach ($files as $fileinfo) {
                $todo = ($fileinfo->isDir() ? 'rmdir' : 'unlink');
                @$todo($fileinfo->getRealPath());
            }
            
            @rmdir($dir);
            
        } catch (\Exception $e) {
            $this->logger->warning('Error removing directory', [
                'dir' => $dir,
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * Handle proxy authentication for Chrome WebDriver
     * 
     * @param array $proxyConfig Proxy configuration
     */
    private function handleProxyAuthentication($proxyConfig)
    {
        $this->logger->info('Handling proxy authentication for WebDriver', [
            'proxy_host' => $proxyConfig['host'],
            'proxy_port' => $proxyConfig['port'],
            'proxy_location' => $proxyConfig['location']
        ]);

        try {
            // Navigate to a simple page to trigger proxy authentication
            $this->driver->get('https://ip.oxylabs.io/location');
            
            // Wait for page to load
            $wait = new WebDriverWait($this->driver, 10);
            $wait->until(WebDriverExpectedCondition::presenceOfElementLocated(WebDriverBy::tagName('body')));
            
            // Get the page content to verify proxy is working
            $pageSource = $this->driver->getPageSource();
            
            // Check if we got a valid response (should contain JSON with IP info)
            if (strpos($pageSource, 'ip') !== false && strpos($pageSource, 'location') !== false) {
                $this->logger->info('Proxy authentication successful - IP verification page loaded');
                
                // Extract IP from response if possible
                if (preg_match('/"ip"\s*:\s*"([^"]+)"/', $pageSource, $matches)) {
                    $proxyIp = $matches[1];
                    $this->logger->info('Proxy IP detected', [
                        'proxy_ip' => $proxyIp,
                        'proxy_location' => $proxyConfig['location']
                    ]);
                }
            } else {
                $this->logger->warning('Proxy authentication may have failed - unexpected page content');
            }
            
        } catch (\Exception $e) {
            $this->logger->error('Error during proxy authentication', [
                'error' => $e->getMessage(),
                'proxy_host' => $proxyConfig['host'],
                'proxy_port' => $proxyConfig['port']
            ]);
            
            // Don't throw the exception - proxy might still work for the main scraping
            // Just log the warning
        }
    }

    /**
     * Verify proxy is working by checking current IP
     */
    private function verifyProxyIP()
    {
        try {
            $this->driver->get('https://ip.oxylabs.io/location');
            $pageSource = $this->driver->getPageSource();
            
            if (preg_match('/"ip"\s*:\s*"([^"]+)"/', $pageSource, $matches)) {
                $currentIP = $matches[1];
                $this->logger->info('Current IP through proxy', [
                    'ip' => $currentIP,
                    'proxy_location' => 'kansas_city'
                ]);
                return $currentIP;
            }
        } catch (\Exception $e) {
            $this->logger->error('Failed to verify proxy IP', [
                'error' => $e->getMessage()
            ]);
        }
        return null;
    }

    /**
     * Fetch URL content with dynamic loading support
     * 
     * @param string $url The URL to fetch
     * @param bool $enableScrolling Whether to enable scrolling for dynamic content
     * @return string The HTML content after all dynamic content is loaded
     */
    public function fetchUrlWithScrolling($url, $enableScrolling = true)
    {
        $this->logger->info('Fetching URL with dynamic content support', [
            'url' => $url,
            'scrolling_enabled' => $enableScrolling
        ]);

        try {
            // Start WebDriver if not already started
            $this->startWebDriver();
            
            // Navigate to the URL
            $this->driver->get($url);
            
            // Wait for initial page load
            $wait = new WebDriverWait($this->driver, 10);
            $wait->until(WebDriverExpectedCondition::presenceOfElementLocated(WebDriverBy::tagName('body')));
            
            $this->logger->info('Page loaded, waiting for initial content');
            
            // Wait a bit for initial content to load
            sleep(3);
            
            if ($enableScrolling) {
                $this->performScrolling();
            }
            
            // Get the final HTML content
            $html = $this->driver->getPageSource();
            
            $this->logger->info('Successfully fetched dynamic content', [
                'url' => $url,
                'html_length' => strlen($html)
            ]);
            
            return $html;
            
        } catch (\Exception $e) {
            $this->logger->error('Error fetching URL with scrolling', [
                'url' => $url,
                'error' => $e->getMessage()
            ]);
            throw $e;
        }
    }

    /**
     * Perform scrolling to load dynamic content
     */
    private function performScrolling()
    {
        $this->logger->info('Starting dynamic content loading with scrolling');
        
        $attempt = 0;
        $previousHeight = 0;
        $stableCount = 0;
        
        while ($attempt < $this->maxScrollAttempts) {
            $attempt++;
            
            // Get current page height
            $currentHeight = $this->driver->executeScript('return document.body.scrollHeight;');
            
            $this->logger->info('Scroll attempt', [
                'attempt' => $attempt,
                'current_height' => $currentHeight,
                'previous_height' => $previousHeight
            ]);
            
            // Check if we have new content
            if ($currentHeight > $previousHeight) {
                $stableCount = 0; // Reset stable count
                $this->logger->info('New content detected, continuing scroll');
            } else {
                $stableCount++;
                $this->logger->info('No new content detected', [
                    'stable_count' => $stableCount
                ]);
                
                // If height hasn't changed for 2 attempts, we're probably done
                if ($stableCount >= 2) {
                    $this->logger->info('Content appears to be fully loaded');
                    break;
                }
            }
            
            // Scroll to multiple threshold positions
            foreach ($this->scrollThreshold as $threshold) {
                $scrollPosition = $currentHeight * $threshold;
                $this->driver->executeScript("window.scrollTo(0, {$scrollPosition});");
                
                $this->logger->info('Scrolled to position', [
                    'scroll_position' => $scrollPosition,
                    'threshold' => $threshold
                ]);
                
                // Wait a bit between scrolls to allow content to load
                sleep(1);
            }
            
            // Wait for content to load
            sleep($this->scrollWaitTime);
            
            // Check for loading indicators and wait for them to disappear
            $this->waitForLoadingToComplete();
            
            $previousHeight = $currentHeight;
        }
        
        // Final scroll to bottom to ensure we got everything
        $this->driver->executeScript('window.scrollTo(0, document.body.scrollHeight);');
        sleep(2);
        
        $finalHeight = $this->driver->executeScript('return document.body.scrollHeight;');
        
        $this->logger->info('Scrolling completed', [
            'total_attempts' => $attempt,
            'final_height' => $finalHeight,
            'content_loaded' => $finalHeight > 0
        ]);
    }

    /**
     * Wait for loading indicators to disappear
     */
    private function waitForLoadingToComplete()
    {
        $this->logger->debug('Checking for loading indicators');
        
        // Common loading indicator selectors
        $loadingSelectors = [
            '.loading',
            '.spinner',
            '.loader',
            '[class*="loading"]',
            '[class*="spinner"]',
            '[class*="loader"]',
            '[data-testid*="loading"]',
            '.fa-spinner',
            '.fa-circle-o-notch'
        ];
        
        foreach ($loadingSelectors as $selector) {
            try {
                $elements = $this->driver->findElements(WebDriverBy::cssSelector($selector));
                
                if (!empty($elements)) {
                    $this->logger->info('Found loading indicator, waiting for it to disappear', [
                        'selector' => $selector,
                        'count' => count($elements)
                    ]);
                    
                    // Wait for loading indicator to disappear (max 10 seconds)
                    $wait = new WebDriverWait($this->driver, 10);
                    try {
                        $wait->until(WebDriverExpectedCondition::invisibilityOfElementLocated(WebDriverBy::cssSelector($selector)));
                        $this->logger->info('Loading indicator disappeared');
                    } catch (TimeoutException $e) {
                        $this->logger->warning('Loading indicator did not disappear within timeout');
                    }
                    
                    break; // Found and handled one loading indicator
                }
            } catch (NoSuchElementException $e) {
                // No loading indicator found with this selector, continue
                continue;
            }
        }
    }

    /**
     * Count visible products on the page
     * 
     * @return int Number of visible products
     */
    private function countVisibleProducts()
    {
        // Common product container selectors
        $productSelectors = [
            '.product',
            '.item',
            '.listing',
            '.card',
            '[class*="product"]',
            '[class*="item"]',
            '[class*="listing"]',
            '[class*="trailer"]',
            'article'
        ];
        
        $maxCount = 0;
        $bestSelector = '';
        
        foreach ($productSelectors as $selector) {
            try {
                $elements = $this->driver->findElements(WebDriverBy::cssSelector($selector));
                $count = count($elements);
                
                if ($count > $maxCount) {
                    $maxCount = $count;
                    $bestSelector = $selector;
                }
            } catch (\Exception $e) {
                continue;
            }
        }
        
        $this->logger->info('Product count check', [
            'best_selector' => $bestSelector,
            'count' => $maxCount
        ]);
        
        return $maxCount;
    }

    /**
     * Enhanced processUrl method that uses dynamic content loading
     * 
     * @param string $url The URL to process
     * @param bool $useCache Whether to use cached selectors
     * @param bool $enableScrolling Whether to enable scrolling
     * @return array The extracted trailer data and selectors
     */
    public function processUrlWithScrolling($url, $useCache = false, $enableScrolling = true)
    {
        // Store current URL for relative URL resolution
        $this->currentUrl = $url;
        
        $this->logger->info('Processing URL with dynamic content support', [
            'url' => $url,
            'use_cache' => $useCache,
            'scrolling_enabled' => $enableScrolling
        ]);

        try {
            // Use dynamic content loading
            $html = $this->fetchUrlWithScrolling($url, $enableScrolling);
            
            // Count products before processing
            $productCount = $this->countVisibleProducts();
            $this->logger->info('Products found on page', ['count' => $productCount]);
            
            // Process the HTML using the parent class logic
            $cacheKey = md5($url);
            $cacheFile = __DIR__ . '/../../data/selectors_' . $cacheKey . '.json';
            
            // Check if we have cached selectors
            $selectors = null;
            if ($useCache && file_exists($cacheFile)) {
                $this->logger->info('Using cached selectors', ['cache_file' => $cacheFile]);
                $cachedData = json_decode(file_get_contents($cacheFile), true);
                if (isset($cachedData['selectors']) && is_array($cachedData['selectors'])) {
                    $selectors = $cachedData['selectors'];
                }
            }
            
            // If no cached selectors, extract them using OpenAI
            if (!$selectors) {
                $this->logger->info('No cached selectors found, extracting using OpenAI');
                
                // For dynamic content, we need to be more selective about what HTML we send to AI
                // Try to find the main content area first
                $reducedHtml = $this->extractMainContentForAI($html);
                
                // Extract selectors using OpenAI
                $selectors = $this->extractSelectors($reducedHtml);
                
                // Cache the selectors for future use
                if ($useCache) {
                    if (!is_dir(dirname($cacheFile))) {
                        mkdir(dirname($cacheFile), 0755, true);
                    }
                    file_put_contents($cacheFile, json_encode(['selectors' => $selectors], JSON_PRETTY_PRINT));
                    $this->logger->info('Cached selectors for future use', ['cache_file' => $cacheFile]);
                }
            }
            
            $this->logger->info('Using selectors', ['selectors' => $selectors]);
            
            // Test selectors
            $this->testSelectors($html, $selectors);
            
            // Parse trailer data using the selectors
            $trailers = $this->parseTrailerData($html, $selectors);
            
            // If no trailers found, try alternative approaches
            if (empty($trailers)) {
                $this->logger->warning('No trailers found with initial selectors, trying fallback strategies');
                
                // Strategy 1: Try alternative OpenAI extraction
                $alternativeSelectors = $this->extractSelectorsWithFallback($html);
                if ($alternativeSelectors) {
                    $this->logger->info('Trying alternative AI selectors', ['alt_selectors' => $alternativeSelectors]);
                    $trailers = $this->parseTrailerData($html, $alternativeSelectors);
                    if (!empty($trailers)) {
                        $selectors = $alternativeSelectors;
                        $this->logger->info('Alternative AI selectors worked', ['trailers_found' => count($trailers)]);
                        
                        // Update cache with working selectors
                        if ($useCache) {
                            $cacheData = [
                                'selectors' => $selectors,
                                'domain' => parse_url($url)['host'] ?? 'unknown',
                                'created_at' => date('Y-m-d H:i:s'),
                                'sample_url' => $url,
                                'note' => 'fallback_selectors_dynamic'
                            ];
                            
                            // Use error suppression to prevent warnings from corrupting JSON output
                            $cacheWritten = @file_put_contents($cacheFile, json_encode($cacheData, JSON_PRETTY_PRINT));
                            if ($cacheWritten !== false) {
                                $this->logger->info('Updated cache with fallback selectors', ['domain' => parse_url($url)['host'] ?? 'unknown']);
                            } else {
                                $this->logger->warning('Failed to update cache file', ['cache_file' => $cacheFile]);
                            }
                        }
                    }
                }
                
                // Strategy 2: Try known working patterns for common trailer sites
                if (empty($trailers)) {
                    $this->logger->info('Trying known trailer site patterns');
                    $knownPatterns = $this->getKnownTrailerSitePatterns();
                    
                    foreach ($knownPatterns as $patternName => $pattern) {
                        $this->logger->info('Testing pattern', ['pattern_name' => $patternName]);
                        $trailers = $this->parseTrailerData($html, $pattern);
                        if (!empty($trailers)) {
                            $selectors = $pattern;
                            $this->logger->info('Known pattern worked', [
                                'pattern_name' => $patternName,
                                'trailers_found' => count($trailers)
                            ]);
                            break;
                        }
                    }
                }
                
                // Strategy 3: Try the original hardcoded selectors (legacy support)
                if (empty($trailers)) {
                    $this->logger->info('Trying legacy hardcoded selectors');
                    $knownGoodSelectors = [
                        "container" => ".item-wrapper",
                        "title" => ".item-info .item-title .label",
                        "image" => ".item-img img[src]",
                        "price" => ".item-info .price span:last-child",
                        "link" => ".item-link",
                        "description" => ".item-info .item-title .prefix",
                        "stock" => ".item-stock .stock span:last-child"
                    ];
                    
                    $trailers = $this->parseTrailerData($html, $knownGoodSelectors);
                    if (!empty($trailers)) {
                        $selectors = $knownGoodSelectors;
                        $this->logger->info('Legacy selectors worked', ['trailers_found' => count($trailers)]);
                    }
                }
            }
            
            $result = [
                'trailers' => $trailers,
                'selectors' => $selectors,
                'url' => $url,
                'timestamp' => date('Y-m-d H:i:s'),
                'debug_info' => [
                    'html_length' => strlen($html),
                    'products_detected' => $productCount,
                    'scrolling_enabled' => $enableScrolling,
                    'cache_used' => $useCache && isset($cachedData),
                    'trailers_found' => count($trailers),
                    'method_used' => $enableScrolling ? 'Dynamic Content Loading (WebDriver)' : 'Static Content (HTTP)'
                ]
            ];
            
            $this->logger->info('Dynamic URL processing complete', [
                'url' => $url,
                'trailers_count' => count($trailers),
                'products_detected' => $productCount,
                'scrolling_used' => $enableScrolling
            ]);
            
            return $result;
            
        } catch (\Exception $e) {
            $this->logger->error('Error processing URL with scrolling', [
                'url' => $url,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            throw $e;
        } finally {
            // Clean up WebDriver session
            $this->stopWebDriver();
        }
    }

    /**
     * Extract main content area for AI analysis, focusing on product listings
     * 
     * @param string $html The full HTML content
     * @return string Reduced HTML focused on product content
     */
    private function extractMainContentForAI($html)
    {
        $this->logger->info('Extracting main content area for AI analysis');
        
        try {
            $crawler = new \Symfony\Component\DomCrawler\Crawler($html);
            
            // Look for common product listing container patterns
            $productContainerSelectors = [
                // Common inventory/product listing patterns
                '[class*="inventory"]',
                '[class*="product"]',
                '[class*="item"]',
                '[class*="listing"]',
                '[class*="catalog"]',
                '[class*="grid"]',
                '[id*="inventory"]',
                '[id*="product"]',
                '[id*="listing"]',
                '[id*="catalog"]',
                // Main content areas
                'main',
                '.main',
                '#main',
                '.content',
                '#content',
                '.container',
                // Specific to trailer sites
                '[class*="trailer"]',
                '[class*="unit"]',
                '[class*="vehicle"]'
            ];
            
            $bestContent = '';
            $bestScore = 0;
            
            foreach ($productContainerSelectors as $selector) {
                try {
                    $elements = $crawler->filter($selector);
                    
                    foreach ($elements as $element) {
                        $elementCrawler = new \Symfony\Component\DomCrawler\Crawler($element);
                        $elementHtml = $elementCrawler->outerHtml();
                        
                        // Score this element based on content indicators
                        $score = $this->scoreContentForProducts($elementHtml);
                        
                        if ($score > $bestScore && strlen($elementHtml) > 1000) {
                            $bestScore = $score;
                            $bestContent = $elementHtml;
                            
                            $this->logger->info('Found better content section', [
                                'selector' => $selector,
                                'score' => $score,
                                'length' => strlen($elementHtml)
                            ]);
                        }
                    }
                } catch (\Exception $e) {
                    continue;
                }
            }
            
            // If we found good content, use it; otherwise fall back to standard reduction
            if (!empty($bestContent) && $bestScore > 5) {
                $this->logger->info('Using targeted content section', [
                    'score' => $bestScore,
                    'length' => strlen($bestContent)
                ]);
                
                // Still reduce if it's too large
                return $this->reduceHtmlContent($bestContent, 40000);
            } else {
                $this->logger->info('No good content section found, using standard reduction');
                return $this->reduceHtmlContent($html, 40000);
            }
            
        } catch (\Exception $e) {
            $this->logger->warning('Error extracting main content, falling back to standard reduction', [
                'error' => $e->getMessage()
            ]);
            return $this->reduceHtmlContent($html, 40000);
        }
    }
    
    /**
     * Score HTML content based on product listing indicators
     * 
     * @param string $html The HTML content to score
     * @return int Score indicating likelihood of containing product listings
     */
    private function scoreContentForProducts($html)
    {
        $score = 0;
        $htmlLower = strtolower($html);
        
        // Product-related keywords (higher weight)
        $productKeywords = [
            'price' => 3,
            'trailer' => 3,
            'inventory' => 3,
            'stock' => 2,
            'model' => 2,
            'year' => 2,
            'condition' => 2,
            'new' => 1,
            'used' => 1,
            'sale' => 1,
            'item' => 1,
            'product' => 1
        ];
        
        foreach ($productKeywords as $keyword => $weight) {
            $count = substr_count($htmlLower, $keyword);
            $score += $count * $weight;
        }
        
        // Look for repeating patterns (indicates listings)
        $patterns = [
            'class="item' => 2,
            'class="product' => 2,
            'class="listing' => 2,
            'class="trailer' => 3,
            'data-item' => 2,
            'data-product' => 2
        ];
        
        foreach ($patterns as $pattern => $weight) {
            $count = substr_count($htmlLower, $pattern);
            $score += $count * $weight;
        }
        
        // Penalty for header/footer content
        $penalties = [
            'header' => -5,
            'footer' => -5,
            'navigation' => -3,
            'menu' => -3,
            'logo' => -5,
            'copyright' => -3
        ];
        
        foreach ($penalties as $penalty => $weight) {
            if (strpos($htmlLower, $penalty) !== false) {
                $score += $weight;
            }
        }
        
        return max(0, $score); // Don't return negative scores
    }

    /**
     * Get known working patterns for common trailer websites
     * 
     * @return array Array of known selector patterns
     */
    private function getKnownTrailerSitePatterns()
    {
        return [
            'generic_product_grid' => [
                'container' => '.product, .item, .listing',
                'title' => '.title, .name, .product-title, .item-title, h2, h3',
                'image' => 'img',
                'price' => '.price, .cost, .amount, [class*="price"]',
                'link' => 'a',
                'description' => '.description, .desc, .details, p',
                'stock' => '.stock, .sku, .item-number, [class*="stock"]'
            ],
            'card_layout' => [
                'container' => '.card, .card-body, .item-card',
                'title' => '.card-title, .title, h3, h4',
                'image' => '.card-img, .card-image, img',
                'price' => '.price, .card-price, .amount',
                'link' => 'a, .card-link',
                'description' => '.card-text, .description, p',
                'stock' => '.stock, .item-id, .card-stock'
            ],
            'table_row_layout' => [
                'container' => 'tr, .table-row, .row',
                'title' => 'td:first-child, .title-cell, .name',
                'image' => 'img',
                'price' => 'td:last-child, .price-cell, .price',
                'link' => 'a',
                'description' => 'td:nth-child(2), .desc-cell',
                'stock' => '.stock, .id, .item-number'
            ],
            'list_item_layout' => [
                'container' => '.list-item, .item, li',
                'title' => '.item-title, .title, h3',
                'image' => '.item-image, img',
                'price' => '.item-price, .price',
                'link' => 'a, .item-link',
                'description' => '.item-description, .description',
                'stock' => '.item-stock, .stock'
            ],
            'trailer_specific' => [
                'container' => '[class*="trailer"], [class*="vehicle"], [class*="unit"]',
                'title' => '[class*="title"], [class*="name"], [class*="model"]',
                'image' => 'img',
                'price' => '[class*="price"], [class*="cost"]',
                'link' => 'a',
                'description' => '[class*="desc"], [class*="detail"]',
                'stock' => '[class*="stock"], [class*="sku"], [class*="id"]'
            ],
            'bootstrap_grid' => [
                'container' => '.col, .col-md-4, .col-lg-3, .col-sm-6',
                'title' => 'h3, h4, .title',
                'image' => 'img',
                'price' => '.price, .badge, .text-primary',
                'link' => 'a',
                'description' => 'p, .description',
                'stock' => '.badge, .label, .stock'
            ],
            'inventory_layout' => [
                'container' => '[class*="inventory"], [class*="stock"], .item-wrapper',
                'title' => '.item-title, .inventory-title, .title',
                'image' => '.item-img, .inventory-img, img',
                'price' => '.item-price, .inventory-price, .price',
                'link' => '.item-link, .inventory-link, a',
                'description' => '.item-desc, .inventory-desc, .description',
                'stock' => '.item-stock, .inventory-stock, .stock'
            ]
        ];
    }

    /**
     * Destructor - Clean up resources
     */
    public function __destruct()
    {
        $this->stopWebDriver();
        $this->cleanupOrphanedResources();
    }
} 