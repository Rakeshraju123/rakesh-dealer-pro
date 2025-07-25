<?php

require_once __DIR__ . '/../../vendor/autoload.php';
require_once __DIR__ . '/DotEnvLoader.php';

DotEnvLoader::load();

use GuzzleHttp\Client;
use GuzzleHttp\Cookie\CookieJar;
use GuzzleHttp\Exception\GuzzleException;
use Symfony\Component\DomCrawler\Crawler;
use Monolog\Logger;
use Monolog\Handler\StreamHandler;
use Monolog\Handler\RotatingFileHandler;
use Monolog\Formatter\LineFormatter;
use Monolog\Level;

/**
 * OpenAiScraper - A class for scraping websites using OpenAI to identify selectors
 */
class OpenAiScraper
{
    /**
     * @var string OpenAI API key
     */
    private $apiKey;
    
    /**
     * @var Client HTTP client for web requests
     */
    private $httpClient;
    
    /**
     * @var CookieJar Cookie jar for handling cookies
     */
    private $cookieJar;
    
    /**
     * @var Logger Monolog logger instance
     */
    protected $logger;

    /**
     * Constructor
     * 
     * @param string|null $apiKey OpenAI API key (if null, will try to get from env)
     */
    public function __construct()
    {
        // Set up logger
        $this->initializeLogger();
        
        // Set API key from parameter or env
        $this->apiKey = DotEnvLoader::getOpenAiApiKey();
        if (!$this->apiKey) {
            $this->logger->error('OpenAI API key not provided or found in environment');
            throw new \RuntimeException('OpenAI API key not provided or found in environment');
        }
        
        $this->logger->info('OpenAiScraper initialized with API key');
        
        // Initialize HTTP client with default options for web scraping
        $this->initializeHttpClient();
        
        // Initialize cookie jar for handling cookies across requests
        $this->cookieJar = new CookieJar();
    }

    private function initializeHttpClient(){
        $proxyConfig = DotEnvLoader::getOxylabsConfig();
        
        $clientConfig = [
            'timeout' => 30,
            'headers' => [
                'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept' => 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'Accept-Language' => 'en-US,en;q=0.9',
                'Accept-Encoding' => 'gzip, deflate, br',
                'Referer' => 'https://www.google.com/',
                'DNT' => '1',
                'Connection' => 'keep-alive',
                'Upgrade-Insecure-Requests' => '1',
                'Sec-Fetch-Dest' => 'document',
                'Sec-Fetch-Mode' => 'navigate',
                'Sec-Fetch-Site' => 'cross-site',
                'Sec-Fetch-User' => '?1',
                'Cache-Control' => 'max-age=0',
            ],
            'cookies' => true,
            'allow_redirects' => true,
            'verify' => true,
        ];

        // Add proxy configuration if enabled
        if ($proxyConfig['enabled']) {
            $proxyUrl = 'http://' . $proxyConfig['username'] . ':' . $proxyConfig['password'] . '@' . $proxyConfig['host'] . ':' . $proxyConfig['port'];
            $clientConfig['proxy'] = $proxyUrl;
            
            // Get current proxy IP for logging
            $proxyIp = DotEnvLoader::getProxyIp();
            
            $this->logger->info('Initializing HTTP client with Oxylabs Kansas City proxy', [
                'proxy_host' => $proxyConfig['host'],
                'proxy_port' => $proxyConfig['port'],
                'proxy_username' => $proxyConfig['username'],
                'proxy_location' => $proxyConfig['location'],
                'proxy_ip' => $proxyIp ?? 'Unable to fetch IP',
                'proxy_ip_status' => $proxyIp ? 'Active' : 'Failed to fetch'
            ]);
        } else {
            $this->logger->info('Initializing HTTP client without proxy');
        }

        $this->httpClient = new Client($clientConfig);
    }
    
    /**
     * Initialize the logger with console output only (no file logging)
     */
    private function initializeLogger()
    {
        $this->logger = new Logger('openai_scraper');
        
        // Create log directory if it doesn't exist
        $logDir = __DIR__ . '/../../logs';
        if (!is_dir($logDir)) {
            mkdir($logDir, 0755, true);
        }
        
        // Format for console and file output
        $dateFormat = "Y-m-d H:i:s";
        $output = "[%datetime%] %level_name%: %message% %context% %extra%\n";
        $formatter = new LineFormatter($output, $dateFormat);
        
        // Console handler only - outputs to stderr
        $consoleHandler = new StreamHandler('php://stderr', Level::Debug);
        $consoleHandler->setFormatter($formatter);
        
        // File handler - daily rotating file with 14 days retention
        $fileHandler = new RotatingFileHandler(
            $logDir . '/scraper.log',
            14,
            Level::Info
        );
        $fileHandler->setFormatter($formatter);
        
        // Error handler - separate file for errors only
        $errorHandler = new StreamHandler(
            $logDir . '/scraper_error.log',
            Level::Error
        );
        $errorHandler->setFormatter($formatter);
        
        // Add all handlers to logger
        $this->logger->pushHandler($consoleHandler);
        $this->logger->pushHandler($fileHandler);
        $this->logger->pushHandler($errorHandler);
        
        // Add processor to enrich log records
        $this->logger->pushProcessor(function ($record) {
            $record->extra['memory_usage'] = $this->getMemoryUsage();
            return $record;
        });
    }
    
    /**
     * Get formatted memory usage
     * 
     * @return string Formatted memory usage
     */
    private function getMemoryUsage()
    {
        $mem = memory_get_usage(true);
        if ($mem < 1024) {
            return $mem . ' B';
        } elseif ($mem < 1048576) {
            return round($mem / 1024, 2) . ' KB';
        } else {
            return round($mem / 1048576, 2) . ' MB';
        }
    }

    /**
     * Fetch content from a URL with cookie handling and bot detection bypass
     * 
     * @param string $url The URL to fetch
     * @return string The HTML content
     * @throws GuzzleException
     */
    public function fetchUrl($url)
    {
        $this->logger->info('Fetching URL content', ['url' => $url]);
        
        try {
            $response = $this->httpClient->request('GET', $url, [
                'cookies' => $this->cookieJar,
                'allow_redirects' => true
            ]);
            
            $content = $response->getBody()->getContents();
            $contentLength = strlen($content);
            
            $this->logger->info('Successfully fetched URL content', [
                'url' => $url,
                'status_code' => $response->getStatusCode(),
                'content_length' => $contentLength
            ]);
            
            return $content;
        } catch (GuzzleException $e) {
            $this->logger->error('Error fetching URL', [
                'url' => $url,
                'error' => $e->getMessage(),
                'code' => $e->getCode()
            ]);
            throw $e;
        }
    }
    
    /**
     * Reduce HTML content to fit within token limits for OpenAI
     * 
     * @param string $html The HTML content to reduce
     * @param int $maxTokens Approximate maximum tokens to target
     * @return string The reduced HTML
     */
    public function reduceHtmlContent($html, $maxTokens = 50000)
    {
        $this->logger->info('Reducing HTML content', [
            'original_size' => strlen($html),
            'max_tokens' => $maxTokens
        ]);
        
        // First attempt: Remove scripts, styles, and comments
        $cleanHtml = preg_replace('/<script\b[^>]*>(.*?)<\/script>/is', '', $html);
        $cleanHtml = preg_replace('/<style\b[^>]*>(.*?)<\/style>/is', '', $cleanHtml);
        $cleanHtml = preg_replace('/<!--(.*?)-->/s', '', $cleanHtml);
        $cleanHtml = preg_replace('/<noscript\b[^>]*>(.*?)<\/noscript>/is', '', $cleanHtml);
        
        $initialReduction = strlen($html) - strlen($cleanHtml);
        $this->logger->debug('Initial reduction', [
            'removed_bytes' => $initialReduction,
            'percent' => round(($initialReduction / strlen($html)) * 100, 2) . '%'
        ]);
        
        // Approximate character to token ratio (rough estimate)
        $charToTokenRatio = 4;
        $maxChars = $maxTokens * $charToTokenRatio;
        
        // Try to extract meaningful content sections first
        if (strlen($cleanHtml) > $maxChars) {
            $this->logger->info('HTML still too large, attempting smart reduction');
            $smartReduced = $this->smartHtmlReduction($cleanHtml, $maxChars);
            if ($smartReduced) {
                $cleanHtml = $smartReduced;
                $this->logger->info('Smart reduction successful', [
                    'final_size' => strlen($cleanHtml)
                ]);
            }
        }
        
        // If still too large, iteratively reduce by removing sections
        $iterations = 0;
        $maxIterations = 10; // Prevent infinite loops
        
        while (strlen($cleanHtml) > $maxChars && $iterations < $maxIterations) {
            $iterations++;
            
            $originalLength = strlen($cleanHtml);
            
            // Find the midpoint of the HTML
            $midpoint = (int) (strlen($cleanHtml) / 2);
            
            // Find the nearest closing tag after the midpoint
            $closingTagPos = strpos($cleanHtml, '>', $midpoint);
            if ($closingTagPos === false) {
                // Fallback if no closing tag found
                $cleanHtml = substr($cleanHtml, 0, $maxChars);
                $this->logger->debug('No closing tag found, truncating content', [
                    'iteration' => $iterations,
                    'truncated_to' => $maxChars . ' chars'
                ]);
                break;
            }
            
            // Cut the content in half, keeping the structure intact
            $cleanHtml = substr($cleanHtml, 0, $closingTagPos + 1);
            
            $reductionAmount = $originalLength - strlen($cleanHtml);
            $this->logger->debug('Iterative reduction', [
                'iteration' => $iterations,
                'removed_bytes' => $reductionAmount,
                'percent' => round(($reductionAmount / $originalLength) * 100, 2) . '%',
                'current_size' => strlen($cleanHtml)
            ]);
        }
        
        $totalReduction = strlen($html) - strlen($cleanHtml);
        $this->logger->info('HTML reduction complete', [
            'original_size' => strlen($html),
            'final_size' => strlen($cleanHtml),
            'total_reduction' => $totalReduction,
            'percent' => round(($totalReduction / strlen($html)) * 100, 2) . '%',
            'iterations' => $iterations
        ]);
        
        return $cleanHtml;
    }
    
    /**
     * Smart HTML reduction that tries to preserve content sections
     * 
     * @param string $html The HTML content to reduce
     * @param int $maxChars Maximum characters to target
     * @return string|null The reduced HTML or null if unsuccessful
     */
    private function smartHtmlReduction($html, $maxChars)
    {
        try {
            $crawler = new Crawler($html);
            
            // Look for potential content containers
            $contentSelectors = [
                'main',
                '[class*="content"]',
                '[class*="product"]',
                '[class*="inventory"]',
                '[class*="listing"]',
                '[class*="collection"]',
                '[class*="catalog"]',
                '[id*="content"]',
                '[id*="products"]',
                '[id*="inventory"]'
            ];
            
            foreach ($contentSelectors as $selector) {
                try {
                    $elements = $crawler->filter($selector);
                    if ($elements->count() > 0) {
                        $contentHtml = $elements->first()->outerHtml();
                        if (strlen($contentHtml) < $maxChars * 1.2) { // Allow some buffer
                            $this->logger->info('Found suitable content section', [
                                'selector' => $selector,
                                'content_size' => strlen($contentHtml)
                            ]);
                            return $contentHtml;
                        }
                    }
                } catch (\Exception $e) {
                    continue;
                }
            }
            
            // If no single section works, try to get multiple smaller sections
            $combinedContent = '';
            $patterns = ['article', '.item, .product', '[class*="card"]'];
            
            foreach ($patterns as $pattern) {
                try {
                    $elements = $crawler->filter($pattern);
                    $sampleCount = min(5, $elements->count()); // Take up to 5 samples
                    
                    for ($i = 0; $i < $sampleCount; $i++) {
                        $element = $elements->eq($i);
                        $elementHtml = $element->outerHtml();
                        
                        if (strlen($combinedContent . $elementHtml) < $maxChars) {
                            $combinedContent .= $elementHtml . "\n";
                        } else {
                            break;
                        }
                    }
                    
                    if (strlen($combinedContent) > $maxChars * 0.3) { // At least 30% of target
                        $this->logger->info('Created combined content section', [
                            'pattern' => $pattern,
                            'elements_used' => $sampleCount,
                            'content_size' => strlen($combinedContent)
                        ]);
                        return $combinedContent;
                    }
                } catch (\Exception $e) {
                    continue;
                }
            }
            
            return null;
        } catch (\Exception $e) {
            $this->logger->warning('Smart reduction failed', ['error' => $e->getMessage()]);
            return null;
        }
    }

    /**
     * Extract CSS selectors using OpenAI
     * 
     * @param string $sampleHtml A sample of the HTML content
     * @return array Extracted selectors
     */
    public function extractSelectors($sampleHtml)
    {
        $this->logger->info('Extracting selectors using OpenAI', [
            'sample_size' => strlen($sampleHtml)
        ]);
        
        $prompt = "You are an expert web scraper. Analyze this HTML from a trailer/vehicle listing website and identify CSS selectors for extracting trailer data.

CRITICAL REQUIREMENTS:
1. Look for REPEATING PATTERNS that represent individual trailers/vehicles
2. Find the CONTAINER element that wraps each trailer item
3. Use SPECIFIC selectors that won't match navigation, headers, or unrelated elements
4. Test selectors work with the provided HTML structure
5. For images: use 'img' for the element or 'img[src]' for the src attribute
6. For links: use 'a' for the element or 'a[href]' for the href attribute
7. Make all selectors RELATIVE to the container element
8. Avoid generic selectors like 'div' or 'span' - be specific

COMMON TRAILER WEBSITE PATTERNS TO LOOK FOR:
- Container classes: .product, .item, .listing, .card, .trailer, .vehicle, .inventory-item
- Title classes: .title, .name, .product-title, .item-title, .trailer-title
- Price classes: .price, .cost, .amount, .pricing
- Image classes: .image, .photo, .thumbnail, .product-image
- Stock classes: .stock, .sku, .item-number, .inventory-id
- Link patterns: Links that go to detail pages (not pagination or categories)

HTML Sample:
```html
{$sampleHtml}
```

ANALYZE THE HTML STRUCTURE:
1. Find repeating elements that represent individual trailers
2. Identify the most specific container selector
3. Find child elements within each container for title, price, image, etc.
4. Ensure selectors are unique and won't match unwanted elements

Return ONLY a JSON object with CSS selectors:
{
  \"container\": \"CSS selector for the repeating trailer container element\",
  \"title\": \"CSS selector for trailer title/name (relative to container)\",
  \"image\": \"CSS selector for trailer image (relative to container)\",
  \"price\": \"CSS selector for price (relative to container)\",
  \"link\": \"CSS selector for detail page link (relative to container)\",
  \"description\": \"CSS selector for trailer description (relative to container)\",
  \"stock\": \"CSS selector for stock/inventory number (relative to container)\"
}

IMPORTANT: Make sure the container selector finds multiple elements (one per trailer) and the child selectors find the correct data within each container. Test your selectors against the provided HTML structure.";

        try {
            $response = $this->callOpenAi($prompt);
            
            // Clean response - remove any markdown formatting
            $cleanResponse = preg_replace('/^```(?:json)?\s*\n?/', '', trim($response));
            $cleanResponse = preg_replace('/\n?```\s*$/', '', $cleanResponse);
            $cleanResponse = trim($cleanResponse);
            
            $this->logger->info('OpenAI response received', [
                'response_length' => strlen($response),
                'cleaned_response_length' => strlen($cleanResponse)
            ]);
            
            // Parse JSON response
            $selectors = json_decode($cleanResponse, true);
            
            if (!$selectors || json_last_error() !== JSON_ERROR_NONE) {
                $this->logger->error('Failed to parse OpenAI response as JSON', [
                    'json_error' => json_last_error_msg(),
                    'response' => $response,
                    'cleaned_response' => $cleanResponse
                ]);
                throw new \Exception('Failed to parse OpenAI response as JSON: ' . json_last_error_msg());
            }
            
            // Validate required selectors
            $requiredSelectors = ['container', 'title', 'image', 'price', 'link'];
            foreach ($requiredSelectors as $required) {
                if (empty($selectors[$required])) {
                    $this->logger->warning('Missing required selector', ['selector' => $required]);
                }
            }
            
            $this->logger->info('Successfully extracted selectors', [
                'selectors' => $selectors
            ]);
            
            return $selectors;
        } catch (\Exception $e) {
            $this->logger->error('Error extracting selectors', [
                'error' => $e->getMessage()
            ]);
            throw $e;
        }
    }
    
    /**
     * Parse trailer data using the provided selectors
     * 
     * @param string $html The full HTML content
     * @param array $selectors The CSS selectors for trailer elements
     * @return array Extracted trailer data
     */
    public function parseTrailerData($html, $selectors)
    {
        $this->logger->info('Parsing trailer data with selectors', [
            'html_size' => strlen($html),
            'selectors' => $selectors
        ]);
        
        try {
            // Validate selectors
            if (empty($selectors) || !is_array($selectors)) {
                $this->logger->error('Invalid selectors provided');
                return [];
            }
            
            if (empty($selectors['container']) || !is_string($selectors['container'])) {
                $this->logger->error('Invalid or missing container selector');
                return [];
            }
            
            $crawler = new Crawler($html);
            $trailers = [];
            
            // Find all trailer container elements
            $containerSelector = $selectors['container'];
            $trailerElements = $crawler->filter($containerSelector);
            
            $count = $trailerElements->count();
            $this->logger->info('Found trailer elements', ['count' => $count]);
            
            if ($count === 0) {
                $this->logger->warning('No trailer elements found with container selector', [
                    'container_selector' => $containerSelector
                ]);
                return [];
            }
            
            // Process each trailer element
            foreach ($trailerElements as $index => $trailerElement) {
                $this->logger->debug('Processing trailer element', ['index' => $index]);
                
                $trailerCrawler = new Crawler($trailerElement);
                
                $trailer = [
                    'title' => $this->extractData($trailerCrawler, $selectors['title'] ?? null, 'text'),
                    'image' => $this->resolveUrl($this->extractData($trailerCrawler, $selectors['image'] ?? null, 'src'), $this->currentUrl),
                    'price' => $this->extractData($trailerCrawler, $selectors['price'] ?? null, 'text'),
                    'link' => $this->resolveUrl($this->extractData($trailerCrawler, $selectors['link'] ?? null, 'href'), $this->currentUrl),
                    'description' => $this->extractData($trailerCrawler, $selectors['description'] ?? null, 'text'),
                    'stock' => $this->extractData($trailerCrawler, $selectors['stock'] ?? null, 'text'),
                ];
                
                // Enhanced link extraction - try multiple approaches if primary fails
                if (empty($trailer['link']) || $trailer['link'] === '#' || !filter_var($trailer['link'], FILTER_VALIDATE_URL)) {
                    $trailer['link'] = $this->findBestLink($trailerCrawler, $this->currentUrl);
                }
                
                $trailers[] = $trailer;
                
                // Log first few and last few for debugging
                if ($index < 2 || $index >= $count - 2) {
                    $this->logger->debug('Extracted trailer data', [
                        'index' => $index,
                        'data' => array_map(function($val) {
                            return is_string($val) ? 
                                (strlen($val) > 50 ? substr($val, 0, 50) . '...' : $val) : 
                                $val;
                        }, $trailer)
                    ]);
                }
            }
            
            $this->logger->info('Successfully parsed trailer data', [
                'trailers_count' => count($trailers)
            ]);
            
            return $trailers;
        } catch (\Exception $e) {
            $this->logger->error('Error parsing trailer data', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            throw $e;
        }
    }
    
    /**
     * Extract specific data from a crawler element using a selector
     * 
     * @param Crawler $crawler The crawler instance
     * @param string|null $selector The CSS selector
     * @param string $type The type of data to extract (text, src, href, etc.)
     * @return string|null The extracted data or null if not found
     */
    private function extractData(Crawler $crawler, $selector, $type = 'text')
    {
        try {
            // Handle null or empty selectors
            if (empty($selector) || !is_string($selector)) {
                $this->logger->debug('Empty or invalid selector provided', [
                    'selector' => $selector,
                    'selector_type' => gettype($selector),
                    'extraction_type' => $type
                ]);
                return null;
            }
            
            $element = $crawler->filter($selector);
            
            if ($element->count() === 0) {
                $this->logger->debug('No elements found for selector', [
                    'selector' => $selector,
                    'type' => $type
                ]);
                return null;
            }
            
            $result = null;
            
            switch ($type) {
                case 'text':
                    $result = trim($element->text());
                    break;
                case 'html':
                    $result = trim($element->html());
                    break;
                case 'src':
                    $result = $element->attr('src');
                    break;
                case 'href':
                    $result = $element->attr('href');
                    break;
                default:
                    $result = $element->attr($type);
            }
            
            return $result;
        } catch (\Exception $e) {
            $this->logger->warning('Error extracting data with selector', [
                'selector' => $selector,
                'type' => $type,
                'error' => $e->getMessage()
            ]);
            return null;
        }
    }
    
        /**
     * Store current URL for relative URL resolution
     */
    private $currentUrl;
    
    /**
     * Process a URL to extract trailer data
     * 
     * @param string $url The URL to process
     * @param bool $useCache Whether to use cached selectors if available
     * @param bool $enableScrolling Whether to enable scrolling for dynamic content
     * @return array The extracted trailer data and selectors
     */
    public function processUrl($url, $useCache = true, $enableScrolling = false, $manualAddress = '')
    {
        $this->logger->info('Processing URL to extract trailer data', [
            'url' => $url,
            'use_cache' => $useCache,
            'scrolling_enabled' => $enableScrolling,
            'manual_address' => $manualAddress
        ]);
        
        try {
            // Store current URL for relative URL resolution
            $this->currentUrl = $url;
            
            // If scrolling is enabled, use the dynamic scraper
            if ($enableScrolling) {
                require_once __DIR__ . '/DynamicScraper.php';
                $dynamicScraper = new DynamicScraper();
                $result = $dynamicScraper->processUrlWithScrolling($url, $useCache, $enableScrolling);
                
                // Add manual address to result if provided
                if (!empty($manualAddress)) {
                    $result['manual_address'] = $manualAddress;
                }
                
                return $result;
            }
            
            // Generate cache key based on URL domain for better reusability
            $parsedUrl = parse_url($url);
            $domain = $parsedUrl['host'] ?? 'unknown';
            $cacheKey = md5($domain);
            $cacheFile = __DIR__ . '/../../data/selectors_' . $cacheKey . '.json';
            
            // Fetch the URL content
            $html = $this->fetchUrl($url);
            $this->logger->info('Fetched HTML content', [
                'url' => $url,
                'html_length' => strlen($html),
                'html_preview' => substr(strip_tags($html), 0, 200) . '...'
            ]);
            
            // Check if we have cached selectors for this domain
            $selectors = null;
            if ($useCache && file_exists($cacheFile)) {
                $this->logger->info('Checking cached selectors', ['cache_file' => $cacheFile]);
                $cachedData = json_decode(file_get_contents($cacheFile), true);
                if (isset($cachedData['selectors']) && is_array($cachedData['selectors'])) {
                    $selectors = $cachedData['selectors'];
                    $this->logger->info('Using cached selectors for domain', ['domain' => $domain]);
                }
            }
            
            // If no cached selectors, extract them using OpenAI
            if (!$selectors) {
                $this->logger->info('No cached selectors found, extracting using OpenAI');
                
                // Reduce HTML to fit within token limits
                $reducedHtml = $this->reduceHtmlContent($html, 4000000);
                
                // Extract selectors using OpenAI
                $selectors = $this->extractSelectors($reducedHtml);
                
                // Cache the selectors for this domain (not just this URL)
                if ($useCache && $selectors) {
                    $cacheData = [
                        'selectors' => $selectors,
                        'domain' => $domain,
                        'created_at' => date('Y-m-d H:i:s'),
                        'sample_url' => $url
                    ];
                    
                    // Ensure cache directory exists and is writable
                    if ($this->ensureCacheDirectory($cacheFile)) {
                        $cacheWritten = @file_put_contents($cacheFile, json_encode($cacheData, JSON_PRETTY_PRINT));
                        if ($cacheWritten !== false) {
                            $this->logger->info('Cached selectors for domain', ['domain' => $domain, 'cache_file' => $cacheFile]);
                        } else {
                            $this->logger->warning('Failed to write cache file', ['cache_file' => $cacheFile]);
                        }
                    }
                }
            }
            
            if (!$selectors) {
                throw new \Exception('Failed to extract selectors from the webpage');
            }
            
            $this->logger->info('Using selectors', ['selectors' => $selectors]);
            
            // Test selectors before parsing
            $this->testSelectors($html, $selectors);
            
            // Parse trailer data using the selectors
            $trailers = $this->parseTrailerData($html, $selectors);
            
            // If no trailers found, try multiple fallback strategies
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
                                'domain' => $domain,
                                'created_at' => date('Y-m-d H:i:s'),
                                'sample_url' => $url,
                                'note' => 'fallback_selectors'
                            ];
                            
                            // Ensure cache directory exists and is writable
                            if ($this->ensureCacheDirectory($cacheFile)) {
                                $cacheWritten = @file_put_contents($cacheFile, json_encode($cacheData, JSON_PRETTY_PRINT));
                                if ($cacheWritten !== false) {
                                    $this->logger->info('Updated cache with fallback selectors', ['domain' => $domain]);
                                } else {
                                    $this->logger->warning('Failed to update cache file', ['cache_file' => $cacheFile]);
                                }
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
            }
            
            // If still no trailers, provide helpful error information
            if (empty($trailers)) {
                $this->logger->error('No trailers found with any extraction method', [
                    'url' => $url,
                    'selectors_tried' => $selectors,
                    'html_sample' => substr(strip_tags($html), 0, 500)
                ]);
            }
            
            $result = [
                'trailers' => $trailers,
                'selectors' => $selectors,
                'url' => $url,
                'domain' => $domain,
                'timestamp' => date('Y-m-d H:i:s'),
                'debug_info' => [
                    'html_length' => strlen($html),
                    'reduced_html_length' => isset($reducedHtml) ? strlen($reducedHtml) : 0,
                    'cache_used' => $useCache && isset($cachedData),
                    'trailers_found' => count($trailers),
                    'scrolling_enabled' => $enableScrolling
                ]
            ];
            
            // Add manual address to result if provided
            if (!empty($manualAddress)) {
                $result['manual_address'] = $manualAddress;
            }
            
            $this->logger->info('URL processing complete', [
                'url' => $url,
                'domain' => $domain,
                'trailers_count' => count($trailers),
                'selectors_used' => $selectors
            ]);
            
            return $result;
        } catch (\Exception $e) {
            $this->logger->error('Error processing URL', [
                'url' => $url,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            throw $e;
        }
    }
    
    /**
     * Test selectors against HTML to see what they find
     * 
     * @param string $html The HTML content
     * @param array $selectors The selectors to test
     */
    protected function testSelectors($html, $selectors)
    {
        $this->logger->info('Testing selectors against HTML');
        
        try {
            if (empty($selectors) || !is_array($selectors)) {
                $this->logger->warning('No selectors provided for testing');
                return;
            }
            
            $crawler = new Crawler($html);
            
            foreach ($selectors as $key => $selector) {
                // Skip empty, null, or non-string selectors
                if (empty($selector) || !is_string($selector)) {
                    $this->logger->warning('Invalid selector', [
                        'selector_name' => $key,
                        'selector_value' => $selector,
                        'selector_type' => gettype($selector)
                    ]);
                    continue;
                }
                
                try {
                    $elements = $crawler->filter($selector);
                    $count = $elements->count();
                    
                    $sampleText = 'N/A';
                    if ($count > 0) {
                        try {
                            $firstElement = $elements->first();
                            $sampleText = substr(trim($firstElement->text()), 0, 100);
                        } catch (\Exception $e) {
                            $sampleText = 'Error getting text: ' . $e->getMessage();
                        }
                    }
                    
                    $this->logger->info('Selector test result', [
                        'selector_name' => $key,
                        'selector' => $selector,
                        'elements_found' => $count,
                        'sample_text' => $sampleText
                    ]);
                    
                    if ($key === 'container' && $count === 0) {
                        $this->logger->warning('Container selector found no elements - this will result in no trailers');
                    }
                } catch (\Exception $e) {
                    $this->logger->warning('Selector test failed', [
                        'selector_name' => $key,
                        'selector' => $selector,
                        'error' => $e->getMessage()
                    ]);
                }
            }
        } catch (\Exception $e) {
            $this->logger->error('Error testing selectors', ['error' => $e->getMessage()]);
        }
    }
    
    /**
     * Extract selectors with fallback approach
     * 
     * @param string $html The HTML content
     * @return array|null Alternative selectors
     */
    protected function extractSelectorsWithFallback($html)
    {
        $this->logger->info('Trying fallback selector extraction');
        
        try {
            // Create a more focused sample for OpenAI
            $crawler = new Crawler($html);
            
            // Enhanced patterns for trailer websites
            $patterns = [
                // Specific trailer/vehicle patterns
                '[class*="trailer"]',
                '[class*="vehicle"]',
                '[class*="unit"]',
                '[class*="inventory"]',
                '[class*="stock"]',
                // Common product patterns
                '.product',
                '.item',
                '.listing',
                '.card',
                'article',
                // ID-based patterns
                '[id*="inventory"]',
                '[id*="product"]',
                '[id*="listing"]',
                '[id*="item"]',
                // Data attribute patterns
                '[data-product]',
                '[data-item]',
                '[data-listing]',
                // Generic but common patterns
                '.row .col',
                '.grid-item',
                '.list-item'
            ];
            
            $bestSample = '';
            $bestCount = 0;
            $bestPattern = '';
            
            foreach ($patterns as $pattern) {
                try {
                    $elements = $crawler->filter($pattern);
                    $count = $elements->count();
                    
                    // Look for reasonable count (not too few, not too many)
                    if ($count > 1 && $count < 100 && $count > $bestCount) {
                        $bestCount = $count;
                        $bestPattern = $pattern;
                        
                        // Get first 3 elements as sample
                        $sampleElements = $elements->slice(0, min(3, $count));
                        $bestSample = '';
                        
                        foreach ($sampleElements as $element) {
                            $elementHtml = $element->ownerDocument->saveHTML($element);
                            $bestSample .= $elementHtml . "\n\n";
                        }
                    }
                } catch (\Exception $e) {
                    $this->logger->debug('Pattern failed', ['pattern' => $pattern, 'error' => $e->getMessage()]);
                    continue;
                }
            }
            
            if (empty($bestSample)) {
                $this->logger->warning('No suitable sample found for fallback extraction');
                return null;
            }
            
            $this->logger->info('Using fallback sample', [
                'best_pattern' => $bestPattern,
                'best_pattern_count' => $bestCount,
                'sample_length' => strlen($bestSample)
            ]);
            
            // Enhanced prompt for fallback extraction
            $prompt = "You are an expert web scraper analyzing trailer/vehicle listing HTML. The initial selector extraction failed, so I need you to be more flexible and creative.

ANALYZE THIS HTML SAMPLE:
```html
{$bestSample}
```

EXTRACTION STRATEGY:
1. These are {$bestCount} similar elements from a trailer listing page
2. Find the MOST SPECIFIC container selector that matches all these elements
3. Look inside each container for trailer information
4. Be flexible - data might be in nested elements or have unusual class names
5. Focus on finding ANY text that looks like titles, prices, stock numbers

FLEXIBLE PATTERNS TO CONSIDER:
- Titles: Any text that looks like a trailer name/model
- Prices: Any text with $, dollar amounts, or pricing keywords
- Stock: Any numbers that could be inventory/stock IDs
- Images: Any img tags within the containers
- Links: Any clickable elements that might lead to detail pages

Return ONLY a JSON object with the most reliable selectors you can find:
{
  \"container\": \"Selector for the repeating element (found {$bestCount} times)\",
  \"title\": \"Selector for trailer title/name (relative to container)\",
  \"image\": \"Selector for image (relative to container)\",
  \"price\": \"Selector for price (relative to container)\",
  \"link\": \"Selector for detail link (relative to container)\",
  \"description\": \"Selector for description (relative to container)\",
  \"stock\": \"Selector for stock/ID (relative to container)\"
}

IMPORTANT: Use the most specific selectors possible. If you can't find a perfect match for a field, use the closest approximation or leave it as a generic selector like 'a' or 'span'.";

            $response = $this->callOpenAi($prompt);
            
            // Clean and parse response
            $cleanResponse = preg_replace('/^```(?:json)?\s*\n?/', '', trim($response));
            $cleanResponse = preg_replace('/\n?```\s*$/', '', $cleanResponse);
            $cleanResponse = trim($cleanResponse);
            
            $selectors = json_decode($cleanResponse, true);
            
            if (!$selectors || json_last_error() !== JSON_ERROR_NONE) {
                $this->logger->error('Failed to parse fallback selectors', [
                    'json_error' => json_last_error_msg(),
                    'response' => $response,
                    'cleaned_response' => $cleanResponse
                ]);
                return null;
            }
            
            $this->logger->info('Successfully extracted fallback selectors', [
                'selectors' => $selectors,
                'pattern_used' => $bestPattern,
                'elements_found' => $bestCount
            ]);
            
            return $selectors;
        } catch (\Exception $e) {
            $this->logger->error('Error in fallback selector extraction', [
                'error' => $e->getMessage()
            ]);
            return null;
        }
    }
    
    /**
     * Call OpenAI API with a prompt
     * 
     * @param string $prompt The prompt to send to OpenAI
     * @return string The response from OpenAI
     */
    private function callOpenAi($prompt)
    {
        $this->logger->info('Calling OpenAI API', [
            'prompt_length' => strlen($prompt)
        ]);
        
        $client = new Client();
        
        try {
            $startTime = microtime(true);
            
            $response = $client->post('https://api.openai.com/v1/chat/completions', [
                'headers' => [
                    'Authorization' => 'Bearer ' . $this->apiKey,
                    'Content-Type' => 'application/json',
                ],
                'json' => [
                    'model' => 'gpt-4o-mini',
                    'messages' => [
                        ['role' => 'system', 'content' => 'You are a web scraping assistant that analyzes HTML and extracts structured data.'],
                        ['role' => 'user', 'content' => $prompt],
                    ],
                    'temperature' => 0.3,
                ],
            ]);
            
            $responseTime = microtime(true) - $startTime;
            
            $result = json_decode($response->getBody()->getContents(), true);
            
            $this->logger->info('OpenAI API call successful', [
                'response_time' => round($responseTime, 2) . 's',
                'model' => $result['model'] ?? 'unknown',
                'tokens' => [
                    'prompt' => $result['usage']['prompt_tokens'] ?? 'unknown',
                    'completion' => $result['usage']['completion_tokens'] ?? 'unknown',
                    'total' => $result['usage']['total_tokens'] ?? 'unknown'
                ]
            ]);
            
            return $result['choices'][0]['message']['content'];
        } catch (\Exception $e) {
            $this->logger->error('Error calling OpenAI API', [
                'error' => $e->getMessage(),
                'response' => $e->getResponse() ? $e->getResponse()->getBody()->getContents() : 'No response body'
            ]);
            throw new \RuntimeException("Error calling OpenAI API: " . $e->getMessage());
        }
    }
    
    /**
     * Generate HTML to display the trailer data
     * 
     * @param array $trailers The extracted trailer data
     * @return string HTML representation of the trailer data
     */
    public function generateHtml($trailers)
    {
        $this->logger->info('Generating HTML for trailer data', [
            'trailers_count' => count($trailers)
        ]);
        
        try {
            $html = '<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Trailer Listings</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <style>
        .trailer-card {
            height: 100%;
            transition: transform 0.3s;
        }
        .trailer-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 10px 20px rgba(0,0,0,0.1);
        }
        .trailer-image {
            height: 200px;
            object-fit: cover;
        }
        .price {
            font-size: 1.2rem;
            font-weight: bold;
            color: #28a745;
        }
        .stock {
            font-size: 0.8rem;
            color: #6c757d;
        }
    </style>
</head>
<body>
    <div class="container py-5">
        <h1 class="mb-4">Trailer Listings</h1>
        
        <div class="row row-cols-1 row-cols-md-3 g-4">';
            
            foreach ($trailers as $index => $trailer) {
                $html .= '
            <div class="col">
                <div class="card trailer-card">
                    <img src="' . htmlspecialchars($trailer['image'] ?? '', ENT_QUOTES) . '" class="card-img-top trailer-image" alt="' . htmlspecialchars($trailer['title'] ?? 'Trailer', ENT_QUOTES) . '">
                    <div class="card-body">
                        <h5 class="card-title">' . htmlspecialchars($trailer['title'] ?? '', ENT_QUOTES) . '</h5>
                        <p class="price">' . htmlspecialchars($trailer['price'] ?? '', ENT_QUOTES) . '</p>
                        <p class="stock">Stock #: ' . htmlspecialchars($trailer['stock'] ?? '', ENT_QUOTES) . '</p>
                        <p class="card-text">' . htmlspecialchars($trailer['description'] ?? '', ENT_QUOTES) . '</p>
                        <a href="' . htmlspecialchars($trailer['link'] ?? '#', ENT_QUOTES) . '" class="btn btn-primary" target="_blank">View Details</a>
                    </div>
                </div>
            </div>';
            }
            
            $html .= '
        </div>
    </div>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>';
            
            $this->logger->info('HTML generation complete', [
                'html_size' => strlen($html)
            ]);
            
            return $html;
        } catch (\Exception $e) {
            $this->logger->error('Error generating HTML', [
                'error' => $e->getMessage()
            ]);
            throw $e;
        }
    }
    
    /**
     * Save the extracted trailer data to a JSON file
     * 
     * @param array $data The data to save
     * @param string $filename The filename to save to
     * @return bool Success status
     */
    public function saveDataToJson($data, $filename = 'trailers.json')
    {
        $this->logger->info('Saving data to JSON file', [
            'filename' => $filename,
            'data_size' => is_array($data) ? count($data) : 'not an array'
        ]);
        
        try {
            // Ensure directory exists
            $dir = dirname($filename);
            if (!is_dir($dir)) {
                mkdir($dir, 0755, true);
            }
            
            $json = json_encode($data, JSON_PRETTY_PRINT);
            $result = file_put_contents($filename, $json) !== false;
            
            if ($result) {
                $this->logger->info('Data successfully saved to JSON', [
                    'filename' => $filename,
                    'file_size' => filesize($filename)
                ]);
            } else {
                $this->logger->error('Failed to save data to JSON', [
                    'filename' => $filename
                ]);
            }
            
            return $result;
        } catch (\Exception $e) {
            $this->logger->error('Error saving data to JSON', [
                'filename' => $filename,
                'error' => $e->getMessage()
            ]);
            return false;
        }
    }
    
    /**
     * Load trailer data from a JSON file
     * 
     * @param string $filename The filename to load from
     * @return array|null The loaded data or null if file not found
     */
    public function loadDataFromJson($filename = 'trailers.json')
    {
        $this->logger->info('Loading data from JSON file', [
            'filename' => $filename
        ]);
        
        try {
            if (!file_exists($filename)) {
                $this->logger->warning('JSON file not found', [
                    'filename' => $filename
                ]);
                return null;
            }
            
            $json = file_get_contents($filename);
            $data = json_decode($json, true);
            
            if (json_last_error() !== JSON_ERROR_NONE) {
                $this->logger->error('Error parsing JSON file', [
                    'filename' => $filename,
                    'error' => json_last_error_msg()
                ]);
                return null;
            }
            
            $this->logger->info('Successfully loaded data from JSON', [
                'filename' => $filename,
                'data_size' => is_array($data) ? count($data) : 'not an array'
            ]);
            
            return $data;
        } catch (\Exception $e) {
            $this->logger->error('Error loading data from JSON', [
                'filename' => $filename,
                'error' => $e->getMessage()
            ]);
            return null;
        }
    }

    /**
     * Extract detailed information from a trailer detail page
     * 
     * @param string $url The URL of the trailer detail page
     * @return array Detailed trailer information including description, features, and images
     */
    public function extractTrailerDetails($url)
    {
        $this->logger->info('Extracting detailed trailer information', [
            'url' => $url
        ]);
        
        try {
            // Fetch the detail page content
            $html = $this->fetchUrl($url);
            $this->logger->info('Fetched detail page content', [
                'url' => $url,
                'html_length' => strlen($html)
            ]);
            
            // Reduce HTML for OpenAI processing
            $reducedHtml = $this->reduceHtmlContent($html, 40000);
            
            // Extract images from the page
            $images = $this->extractImages($html, $url);
            
            // Use OpenAI to extract detailed information
            $details = $this->extractDetailedInfo($reducedHtml);
            
            $result = [
                'url' => $url,
                'details' => $details,
                'images' => $images,
                'timestamp' => date('Y-m-d H:i:s'),
                'debug_info' => [
                    'html_length' => strlen($html),
                    'reduced_html_length' => strlen($reducedHtml),
                    'images_found' => count($images)
                ]
            ];
            
            $this->logger->info('Trailer details extraction complete', [
                'url' => $url,
                'images_count' => count($images),
                'details_extracted' => !empty($details)
            ]);
            
            return $result;
        } catch (\Exception $e) {
            $this->logger->error('Error extracting trailer details', [
                'url' => $url,
                'error' => $e->getMessage()
            ]);
            throw $e;
        }
    }
    
    /**
     * Extract all images from HTML content
     * 
     * @param string $html The HTML content
     * @param string $baseUrl The base URL for resolving relative URLs
     * @return array Array of image URLs
     */
    private function extractImages($html, $baseUrl)
    {
        $this->logger->info('Extracting images from HTML');
        
        try {
            $crawler = new Crawler($html);
            $images = [];
            
            // Find all img tags
            $crawler->filter('img')->each(function (Crawler $node) use (&$images, $baseUrl) {
                $src = $node->attr('src');
                $alt = $node->attr('alt') ?: '';
                
                if ($src) {
                    // Convert relative URLs to absolute
                    if (!filter_var($src, FILTER_VALIDATE_URL)) {
                        $parsedBase = parse_url($baseUrl);
                        $baseScheme = $parsedBase['scheme'] ?? 'https';
                        $baseHost = $parsedBase['host'] ?? '';
                        
                        if (strpos($src, '//') === 0) {
                            // Protocol-relative URL
                            $src = $baseScheme . ':' . $src;
                        } elseif (strpos($src, '/') === 0) {
                            // Root-relative URL
                            $src = $baseScheme . '://' . $baseHost . $src;
                        } else {
                            // Relative URL
                            $basePath = dirname(parse_url($baseUrl, PHP_URL_PATH) ?: '/');
                            $src = $baseScheme . '://' . $baseHost . $basePath . '/' . $src;
                        }
                    }
                    
                    // Filter out logo.png and thumbnail images
                    $srcLower = strtolower($src);
                    if (strpos($srcLower, 'logo.png') !== false || 
                        strpos($srcLower, '/thumbnail') !== false || 
                        strpos($srcLower, '/thumbnails') !== false ||
                        strpos($srcLower, 'thumb') !== false) {
                        $this->logger->debug('Filtering out logo/thumbnail image', ['url' => $src]);
                        return; // Skip this image
                    }
                    
                    // Prefer images/ directory over thumbnails/
                    // Skip if this is a thumbnail version and we might have the full version
                    if (strpos($srcLower, '/thumb') !== false && 
                        (strpos($srcLower, '/images/') === false)) {
                        $this->logger->debug('Filtering out thumbnail (not in images directory)', ['url' => $src]);
                        return; // Skip thumbnail if not in images directory
                    }
                    
                    // Filter out very small images (likely icons/logos)
                    $width = $node->attr('width');
                    $height = $node->attr('height');
                    
                    if ((!$width || $width > 100) && (!$height || $height > 100)) {
                        $images[] = [
                            'url' => $src,
                            'alt' => $alt,
                            'width' => $width,
                            'height' => $height
                        ];
                    }
                }
            });
            
            // Remove duplicates
            $uniqueImages = [];
            $seenUrls = [];
            foreach ($images as $image) {
                if (!in_array($image['url'], $seenUrls)) {
                    $uniqueImages[] = $image;
                    $seenUrls[] = $image['url'];
                }
            }
            
            $this->logger->info('Images extracted', [
                'total_found' => count($images),
                'unique_images' => count($uniqueImages),
                'filtered_out' => 'logo.png and thumbnail images excluded'
            ]);
            
            return $uniqueImages;
        } catch (\Exception $e) {
            $this->logger->error('Error extracting images', [
                'error' => $e->getMessage()
            ]);
            return [];
        }
    }
    
    /**
     * Use OpenAI to extract detailed trailer information
     * 
     * @param string $html The HTML content
     * @return array Detailed trailer information
     */
    private function extractDetailedInfo($html)
    {
        $this->logger->info('Extracting detailed info using OpenAI');
        
        $prompt = "Analyze this HTML from a trailer/vehicle detail page and extract comprehensive information. Extract ALL available specifications and details, including location information.

HTML Content:
```html
{$html}
```

Extract and return ONLY a JSON object with the following structure. Only include fields that have actual values - do not include fields with null, empty, or 'N/A' values:

{
  \"title\": \"Main title/name of the trailer\",
  \"description\": \"Detailed description of the trailer (combine all relevant descriptive text)\",
  \"features\": [\"List of key features, specifications, and highlights\"],
  \"price\": \"Price information if available\",
  \"stock_number\": \"Stock or inventory number\",
  \"condition\": \"New/Used/condition information\",
  \"status\": \"Available/Sold/status information\",
  \"brand\": \"Brand or manufacturer (e.g., Iron Bull)\",
  \"manufacturer\": \"Manufacturer name\",
  \"model\": \"Model name/number (e.g., Tilt Equipment Hauler)\",
  \"year\": \"Year (e.g., 2026)\",
  \"type\": \"Type (e.g., Trailer, Truck Bed)\",
  \"category\": \"Category (e.g., Tilt Trailer, Utility Trailer)\",
  \"vin\": \"VIN number\",
  \"location\": \"Dealer location, city, state, or address (e.g., Dallas, TX or New York, NY)\",
  \"dealer_name\": \"Dealer or company name\",
  \"dealer_address\": \"Full dealer address if available\",
  \"dealer_phone\": \"Dealer phone number\",
  \"floor_length\": \"Floor length with units (e.g., 288in / 24ft)\",
  \"floor_width\": \"Floor width with units (e.g., 102in / 8ft 6in)\",
  \"length_total\": \"Total length with units\",
  \"width_total\": \"Total width with units\",
  \"floor_height\": \"Floor height with units\",
  \"weight\": \"Weight specifications (e.g., 4766 lb)\",
  \"empty_weight\": \"Empty weight with units\",
  \"axle_capacity\": \"Axle capacity (e.g., 16000 lb)\",
  \"axles\": \"Number of axles\",
  \"color\": \"Primary color information\",
  \"exterior_color\": \"Exterior/body color (e.g., Black, White, Red)\",
  \"interior_color\": \"Interior color if different from exterior\",
  \"construction\": \"Construction material (e.g., Steel, Aluminum)\",
  \"pull_type\": \"Pull type (e.g., Bumper, Gooseneck)\",
  \"rental\": \"Rental availability information\",
  \"dimensions\": \"Combined dimension information if not separately available\",
  \"additional_info\": \"Any other relevant specifications or information\"
}

IMPORTANT: 
- Only include fields that have actual meaningful values
- Do not include fields with null, empty strings, 'N/A', 'Not Available', or similar placeholder values
- Extract measurements with their units (inches, feet, pounds, etc.)
- Combine similar information intelligently (e.g., if both floor_length and length_total exist, keep the more specific one)
- LOCATION IS CRITICAL: Look for dealer location, company address, city/state information in headers, footers, contact sections, or anywhere in the HTML
- Look for location clues in: business names, addresses, phone numbers, contact info, dealer information
- If you find a business name, try to extract the location associated with it
- Extract ALL available technical specifications from the HTML";

        try {
            $response = $this->callOpenAi($prompt);
            
            // Clean the response
            $cleanResponse = preg_replace('/^```(?:json)?\s*\n?/', '', trim($response));
            $cleanResponse = preg_replace('/\n?```\s*$/', '', $cleanResponse);
            $cleanResponse = trim($cleanResponse);
            
            $details = json_decode($cleanResponse, true);
            
            if (!$details || json_last_error() !== JSON_ERROR_NONE) {
                $this->logger->error('Failed to parse detailed info from OpenAI response', [
                    'error' => json_last_error_msg(),
                    'response' => $response
                ]);
                return [
                    'title' => 'Information extraction failed',
                    'description' => 'Could not extract detailed information from the page',
                    'features' => [],
                    'error' => 'Failed to parse OpenAI response'
                ];
            }
            
            $this->logger->info('Successfully extracted detailed info', [
                'fields_extracted' => array_keys($details)
            ]);
            
            return $details;
        } catch (\Exception $e) {
            $this->logger->error('Error extracting detailed info', [
                'error' => $e->getMessage()
            ]);
            return [
                'title' => 'Information extraction failed',
                'description' => 'Error occurred while extracting information: ' . $e->getMessage(),
                'features' => [],
                'error' => $e->getMessage()
            ];
        }
    }

    /**
     * Save scraped trailers to dealer inventory database
     * 
     * @param array $trailers Array of trailer data from scraping
     * @param int $dealer_id The dealer ID to associate with inventory
     * @return array Result with success status and details
     */
    public function saveToInventory($trailers, $dealer_id)
    {
        $this->logger->info('Starting smart inventory sync', [
            'dealer_id' => $dealer_id,
            'scraped_trailer_count' => count($trailers)
        ]);

        try {
            // Initialize tenant database connections (same pattern as other APIs)
            $conn = null;
            $conn_write = null;
            
            // Include required files for tenant management
            require_once '/var/www/dealer/includes/TenantManager.php';
            require_once '/var/www/dealer/config/database1.php';
            
            $currentTenant = TenantManager::getCurrentTenant();
            if (!$currentTenant) {
                throw new Exception("No tenant context found - scraper must be accessed through proper tenant context");
            }
            
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
                throw new Exception("Read connection failed: " . $conn->connect_error);
            }
            
            if ($conn_write->connect_error) {
                throw new Exception("Write connection failed: " . $conn_write->connect_error);
            }
            
            // Set charset
            $conn->set_charset("utf8mb4");
            $conn_write->set_charset("utf8mb4");
            
            $this->logger->info('Tenant database connections established', [
                'tenant_schema' => $schemaName,
                'conn_available' => 'yes',
                'conn_write_available' => 'yes'
            ]);

            $successCount = 0;
            $updatedCount = 0;
            $soldCount = 0;
            $errorCount = 0;
            $errors = [];

            // **STEP 1: Process each scraped trailer (add new or update existing)**
            foreach ($trailers as $index => $trailer) {
                try {
                    $inventoryData = $this->mapTrailerToInventory($trailer, $dealer_id);
                    $stockId = $inventoryData['stock_id'];
                    
                    if (!$stockId) {
                        $errors[] = "Trailer {$index}: No stock ID found";
                        $errorCount++;
                        continue;
                    }

                    // Check if this trailer already exists in database
                    $stmt = $conn->prepare("SELECT inventory_id FROM dealer_inventory WHERE dealer_id = ? AND stock_id = ?");
                    $stmt->bind_param("is", $dealer_id, $stockId);
                    $stmt->execute();
                    $existingResult = $stmt->get_result();
                    
                    if ($existingResult->num_rows > 0) {
                        // **UPDATE existing trailer**
                        $stmt = $conn_write->prepare("
                            UPDATE dealer_inventory SET 
                                manufacturer = ?, model = ?, year = ?, category = ?, `condition` = ?,
                                color = ?, size = ?, selling_price = ?, status = 'available',
                                description = ?, images = ?, location = ?, vin = ?, features = ?,
                                updated_at = CURRENT_TIMESTAMP
                            WHERE stock_id = ? AND dealer_id = ?
                        ");
                        
                        $stmt->bind_param(
                            "ssissssdssssssi",
                            $inventoryData['manufacturer'],
                            $inventoryData['model'],
                            $inventoryData['year'],
                            $inventoryData['category'],
                            $inventoryData['condition'],
                            $inventoryData['color'],
                            $inventoryData['size'],
                            $inventoryData['selling_price'],
                            $inventoryData['description'],
                            $inventoryData['images'],
                            $inventoryData['location'],
                            $inventoryData['vin'],
                            $inventoryData['features'],
                            $stockId,
                            $dealer_id
                        );

                        if ($stmt->execute()) {
                            $updatedCount++;
                            $this->logger->info('Trailer updated in inventory', [
                                'stock_id' => $stockId,
                                'manufacturer' => $inventoryData['manufacturer'],
                                'model' => $inventoryData['model']
                            ]);
                        } else {
                            $errorCount++;
                            $error = "Failed to update trailer {$stockId}: " . $stmt->error;
                            $errors[] = $error;
                            $this->logger->error($error);
                        }
                    } else {
                        // **INSERT new trailer**
                        $stmt = $conn_write->prepare("
                            INSERT INTO dealer_inventory (
                                stock_id, dealer_id, manufacturer, model, year, category, `condition`, 
                                color, size, cost_price, selling_price, status, date_added, 
                                description, images, location, vin, features
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ");

                        $stmt->bind_param(
                            "sississssddsssssss",
                            $inventoryData['stock_id'],
                            $inventoryData['dealer_id'],
                            $inventoryData['manufacturer'],
                            $inventoryData['model'],
                            $inventoryData['year'],
                            $inventoryData['category'],
                            $inventoryData['condition'],
                            $inventoryData['color'],
                            $inventoryData['size'],
                            $inventoryData['cost_price'],
                            $inventoryData['selling_price'],
                            $inventoryData['status'],
                            $inventoryData['date_added'],
                            $inventoryData['description'],
                            $inventoryData['images'],
                            $inventoryData['location'],
                            $inventoryData['vin'],
                            $inventoryData['features']
                        );

                        if ($stmt->execute()) {
                            $successCount++;
                            $this->logger->info('New trailer added to inventory', [
                                'inventory_id' => $conn_write->insert_id,
                                'stock_id' => $stockId,
                                'manufacturer' => $inventoryData['manufacturer'],
                                'model' => $inventoryData['model']
                            ]);
                        } else {
                            $errorCount++;
                            $error = "Failed to insert trailer {$stockId}: " . $stmt->error;
                            $errors[] = $error;
                            $this->logger->error($error);
                        }
                    }

                } catch (Exception $e) {
                    $errorCount++;
                    $error = "Error processing trailer {$index}: " . $e->getMessage();
                    $errors[] = $error;
                    $this->logger->error($error);
                }
            }

            $result = [
                'success' => ($successCount + $updatedCount) > 0,
                'total_processed' => count($trailers),
                'success_count' => $successCount,
                'updated_count' => $updatedCount,
                'sold_count' => $soldCount,
                'error_count' => $errorCount,
                'errors' => $errors,
                'sync_summary' => [
                    'new_trailers' => $successCount,
                    'updated_trailers' => $updatedCount,
                    'sold_trailers' => $soldCount,
                    'existing_inventory_count' => 0, // Will be calculated in mark sold function
                    'scraped_trailer_count' => count($trailers)
                ]
            ];

            $this->logger->info('Batch inventory sync completed', $result);
            return $result;

        } catch (Exception $e) {
            $this->logger->error('Failed to sync trailers to inventory', [
                'error' => $e->getMessage()
            ]);
            
            return [
                'success' => false,
                'error' => $e->getMessage(),
                'total_processed' => 0,
                'success_count' => 0,
                'updated_count' => 0,
                'sold_count' => 0,
                'error_count' => count($trailers)
            ];
        }
    }

    /**
     * Mark trailers as sold if they're no longer on the website
     * This should be called once after all batches are processed
     * 
     * @param array $allScrapedStockIds All stock IDs from the current scraping session
     * @param int $dealer_id The dealer ID
     * @return array Result with sold count and details
     */
    public function markMissingTrailersAsSold($allScrapedStockIds, $dealer_id)
    {
        $this->logger->info('Starting mark missing trailers as sold process', [
            'dealer_id' => $dealer_id,
            'scraped_stock_ids_count' => count($allScrapedStockIds)
        ]);

        try {
            // Initialize tenant database connections
            require_once '/var/www/dealer/includes/TenantManager.php';
            require_once '/var/www/dealer/config/database1.php';
            
            $currentTenant = TenantManager::getCurrentTenant();
            if (!$currentTenant) {
                throw new Exception("No tenant context found");
            }
            
            $schemaName = $currentTenant['schema_name'];
            
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
            
            if ($conn->connect_error || $conn_write->connect_error) {
                throw new Exception("Database connection failed");
            }
            
            $conn->set_charset("utf8mb4");
            $conn_write->set_charset("utf8mb4");

            // **Get all existing stock_ids for this dealer (excluding already sold items)**
            $existingStockIds = [];
            $stmt = $conn->prepare("SELECT stock_id, status FROM dealer_inventory WHERE dealer_id = ? AND status != 'sold'");
            $stmt->bind_param("i", $dealer_id);
            $stmt->execute();
            $result = $stmt->get_result();
            
            while ($row = $result->fetch_assoc()) {
                $existingStockIds[] = $row['stock_id'];
            }
            
            $this->logger->info('Found existing inventory for sold check', [
                'existing_count' => count($existingStockIds),
                'existing_stock_ids' => $existingStockIds
            ]);

            // **Find missing trailers (in database but not in scraped data)**
            $missingStockIds = array_diff($existingStockIds, $allScrapedStockIds);
            $soldCount = 0;
            
            if (!empty($missingStockIds)) {
                $placeholders = str_repeat('?,', count($missingStockIds) - 1) . '?';
                $stmt = $conn_write->prepare("
                    UPDATE dealer_inventory 
                    SET status = 'sold', sale_date = CURDATE(), updated_at = CURRENT_TIMESTAMP 
                    WHERE dealer_id = ? AND stock_id IN ($placeholders) AND status != 'sold'
                ");
                
                $types = "i" . str_repeat('s', count($missingStockIds));
                $params = array_merge([$dealer_id], $missingStockIds);
                $stmt->bind_param($types, ...$params);
                
                if ($stmt->execute()) {
                    $soldCount = $stmt->affected_rows;
                    $this->logger->info('Marked missing trailers as sold', [
                        'sold_count' => $soldCount,
                        'sold_stock_ids' => $missingStockIds
                    ]);
                }
            }

            return [
                'success' => true,
                'sold_count' => $soldCount,
                'missing_stock_ids' => $missingStockIds,
                'existing_inventory_count' => count($existingStockIds)
            ];

        } catch (Exception $e) {
            $this->logger->error('Failed to mark missing trailers as sold', [
                'error' => $e->getMessage()
            ]);
            
            return [
                'success' => false,
                'error' => $e->getMessage(),
                'sold_count' => 0
            ];
        }
    }

    /**
     * Extract stock ID from trailer data
     * 
     * @param array $trailer Scraped trailer data
     * @return string|null Stock ID if found, null otherwise
     */
    private function extractStockId($trailer)
    {
        // Try different possible stock ID fields
        $stockId = $trailer['stock'] ?? $trailer['stock_id'] ?? $trailer['stock_number'] ?? null;
        
        // If no direct stock field, try to extract from title or description
        if (!$stockId && isset($trailer['title'])) {
            // Look for patterns like "Stock: B1234", "Stock #B1234", etc.
            if (preg_match('/(?:stock|#)\s*:?\s*([A-Z0-9]+)/i', $trailer['title'], $matches)) {
                $stockId = $matches[1];
            }
        }
        
        // Clean and validate stock ID
        if ($stockId) {
            $stockId = trim($stockId);
            // Ensure it's not empty after trimming
            if (empty($stockId)) {
                $stockId = null;
            }
        }
        
        return $stockId;
    }

    /**
     * Map scraped trailer data to inventory table structure
     * 
     * @param array $trailer Scraped trailer data
     * @param int $dealer_id Dealer ID
     * @return array Mapped inventory data
     */
    private function mapTrailerToInventory($trailer, $dealer_id)
    {
        $this->logger->info('Mapping trailer to inventory', [
            'title' => $trailer['title'] ?? 'N/A',
            'has_detailed_data' => isset($trailer['category']) || isset($trailer['color']) || isset($trailer['condition'])
        ]);

        // **ENHANCED: Use detailed data if available, fallback to parsing**
        
        // Year - prefer detailed data
        $year = $trailer['year'] ?? '';
        if (!$year) {
            $parsedTitle = $this->parseTrailerTitle($trailer['title'] ?? '');
            $year = $parsedTitle['year'] ?: $this->extractYearFromText($trailer['title'] ?? '');
        }
        
        // Parse title first to get accurate manufacturer and model
        $parsedTitle = $this->parseTrailerTitle($trailer['title'] ?? '');
        
        // Manufacturer/Make - prefer parsed title over structured data
        $manufacturer = '';
        if ($parsedTitle['make']) {
            $manufacturer = $parsedTitle['make'];
        } else {
            $manufacturer = $trailer['manufacturer'] ?? $trailer['make'] ?? $trailer['brand'] ?? 'Unknown';
        }
        
        // Model - prefer parsed title over structured data (since structured data often has generic values)
        $model = '';
        if ($parsedTitle['model']) {
            $model = $parsedTitle['model'];
        } else {
            $model = $trailer['model'] ?? ($trailer['title'] ?? 'Unknown Model');
        }
        
        // **ISSUE 1 FIX: Use category for trailer type**
        $category = $trailer['category'] ?? $trailer['type'] ?? '';
        if (!$category) {
            $category = $this->determineTrailerType($trailer['title'] ?? '', $trailer['description'] ?? '');
        }
        
        // **ISSUE 3 FIX: Properly handle condition**
        $condition = $trailer['condition'] ?? '';
        if (!$condition) {
            $condition = $this->determineCondition($trailer['title'] ?? '', $trailer['description'] ?? '');
        }
        // Normalize condition to lowercase for database ENUM
        $condition = strtolower($condition);
        
        // **ISSUE 2 FIX: Properly handle colors with Facebook mapping**
        $color = $trailer['exterior_color'] ?? $trailer['color'] ?? '';
        if (!$color) {
            $color = $this->extractColor($trailer['title'] ?? '', $trailer['description'] ?? '');
        }
        // Apply Facebook color mapping
        $color = $this->mapToFacebookColor($color);
        
        // Size/Dimensions - prefer detailed data
        $size = $trailer['size'] ?? $trailer['dimensions'] ?? '';
        if (!$size) {
            $size = $this->extractSize($trailer['title'] ?? '', $trailer['description'] ?? '');
        }
        
        // **ISSUE 4 FIX: Better cost price handling**
        $price = $this->parsePrice($trailer['price'] ?? '0');
        
        // Try to find actual cost price from detailed data
        $costPrice = 0;
        if (isset($trailer['cost_price']) && $trailer['cost_price'] > 0) {
            $costPrice = $this->parsePrice($trailer['cost_price']);
        } elseif (isset($trailer['discount_price']) && $trailer['discount_price'] > 0) {
            $costPrice = $this->parsePrice($trailer['discount_price']);
        } else {
            // Fallback: Use selling price as cost (no markup)
            $costPrice = $price;
        }
        
        // Prepare images JSON
        $images = null;
        if (!empty($trailer['images']) && is_array($trailer['images'])) {
            $images = json_encode($trailer['images']);
        } elseif (!empty($trailer['image'])) {
            // Single image from basic scraping
            $images = json_encode([['url' => $trailer['image'], 'alt' => $trailer['title'] ?? 'Trailer Image']]);
        }
        
        // Enhanced description with features
        $description = $trailer['description'] ?? $trailer['title'] ?? '';
        if (!empty($trailer['features']) && is_array($trailer['features'])) {
            $description .= "\n\nFeatures:\n• " . implode("\n• ", $trailer['features']);
        }

        // Extract stock_id from various possible fields - don't add STK prefix
        $stock_id = $trailer['stock_id'] ?? 
                   $trailer['stock'] ?? 
                   $trailer['stock_number'] ?? 
                   $trailer['item_number'] ?? 
                   $trailer['sku'] ?? 
                   $trailer['inventory_number'] ?? 
                   '';

        $mappedData = [
            'stock_id' => $stock_id, // Use whatever stock_id is found from scraping, no STK prefix
            'dealer_id' => $dealer_id,
            'manufacturer' => $manufacturer,
            'model' => $model,
            'year' => intval($year) ?: date('Y'),
            'category' => $category,
            'condition' => $condition,
            'color' => $color,
            'size' => $size,
            'cost_price' => $costPrice,
            'selling_price' => $price,
            'status' => 'available',
            'date_added' => date('Y-m-d'),
            'description' => $description,
            'images' => $images,
            'location' => $trailer['location'] ?? '',
            'vin' => $trailer['vin'] ?? '',
            'features' => is_array($trailer['features'] ?? '') ? implode(', ', $trailer['features']) : ($trailer['features'] ?? '')
        ];

        $this->logger->info('Mapped trailer data', [
            'stock_id' => $mappedData['stock_id'],
            'manufacturer' => $mappedData['manufacturer'],
            'model' => $mappedData['model'],
            'category' => $mappedData['category'],
            'category_type' => gettype($mappedData['category']),
            'category_length' => strlen($mappedData['category']),
            'condition' => $mappedData['condition'],
            'color' => $mappedData['color'],
            'cost_price' => $mappedData['cost_price'],
            'selling_price' => $mappedData['selling_price']
        ]);

        return $mappedData;
    }

    /**
     * Parse trailer title to extract make, model, year
     */
    private function parseTrailerTitle($title)
    {
        if (!$title) return ['make' => '', 'model' => '', 'year' => ''];
        
        // Remove common prefixes
        $cleanTitle = preg_replace('/^(New|Used|Pre-owned)\s+/i', '', trim($title));
        
        // Extract year (4 digits)
        $year = '';
        if (preg_match('/\b(19|20)\d{2}\b/', $cleanTitle, $matches)) {
            $year = $matches[0];
            $cleanTitle = str_replace($year, '', $cleanTitle);
        }
        
        // Common trailer manufacturers
        $manufacturers = [
            'IRON BULL', 'IRONBULL', 'LOAD TRAIL', 'LOADTRAIL', 'BIG TEX', 'BIGTEX',
            'PJ TRAILERS', 'PJ', 'SURE-TRAC', 'SURETRAC', 'DIAMOND C', 'DIAMONDC',
            'LAMAR', 'GATORMADE', 'GATOR MADE', 'CARRY-ON', 'CARRYON', 'WELLS CARGO',
            'CARGO MATE', 'CARGOMATE', 'HAULMARK', 'CONTINENTAL CARGO', 'PACE AMERICAN',
            'HOMESTEADER', 'LOOK', 'UNITED', 'INTERSTATE', 'CROSS', 'FORMULA',
            'NEXHAUL', 'ALUMA', 'ECHO', 'IRON PANTHER'
        ];
        
        $make = '';
        $model = trim($cleanTitle);
        
        // Find manufacturer in title
        foreach ($manufacturers as $manufacturer) {
            if (preg_match('/\b' . preg_quote($manufacturer, '/') . '\b/i', $cleanTitle)) {
                $make = $manufacturer;
                $model = trim(preg_replace('/\b' . preg_quote($manufacturer, '/') . '\b/i', '', $cleanTitle));
                break;
            }
        }
        
        // If no manufacturer found, try to extract first 1-2 words
        if (!$make && $model) {
            $words = explode(' ', $model);
            if (count($words) >= 2) {
                $make = $words[0];
                $model = implode(' ', array_slice($words, 1));
            }
        }
        
        return [
            'make' => strtoupper(trim($make)),
            'model' => trim($model),
            'year' => $year
        ];
    }

    /**
     * Extract year from text
     */
    private function extractYearFromText($text)
    {
        if (preg_match('/\b(19|20)\d{2}\b/', $text, $matches)) {
            return intval($matches[0]);
        }
        return 0;
    }

    /**
     * Parse price from string
     */
    private function parsePrice($priceString)
    {
        // Remove currency symbols, commas, and spaces
        $cleaned = preg_replace('/[^\d.]/', '', $priceString);
        return floatval($cleaned) ?: 0;
    }

    /**
     * Determine trailer type from title/description
     */
    private function determineTrailerType($title, $description)
    {
        $text = strtolower($title . ' ' . $description);
        
        // More comprehensive matching patterns
        if (preg_match('/\b(dump|dumping|dump bed|tilt)\b/', $text)) {
            return 'Dump Trailer';
        } elseif (preg_match('/\b(enclosed|cargo|box trailer|vnose|v-nose)\b/', $text)) {
            return 'Enclosed Trailer';
        } elseif (preg_match('/\b(car hauler|auto|vehicle|car trailer|auto hauler)\b/', $text)) {
            return 'Car Hauler';
        } elseif (preg_match('/\b(flatbed|flat bed|deck over|deckover)\b/', $text)) {
            return 'Flatbed Trailer';
        } elseif (preg_match('/\b(equipment|skid steer|bobcat|excavator|heavy duty)\b/', $text)) {
            return 'Equipment Trailer';
        } elseif (preg_match('/\b(gooseneck|goose neck)\b/', $text)) {
            return 'Gooseneck Trailer';
        } elseif (preg_match('/\b(utility|single axle|dual axle|landscape|mesh|rail|ramp)\b/', $text)) {
            return 'Utility Trailer';
        } elseif (preg_match('/\b(boat|pontoon|watercraft)\b/', $text)) {
            return 'Boat Trailer';
        } elseif (preg_match('/\b(motorcycle|bike|atv|quad)\b/', $text)) {
            return 'Motorcycle Trailer';
        } else {
            // Try to extract type from title if it contains "trailer"
            if (preg_match('/(\w+)\s+trailer/i', $title, $matches)) {
                $extractedType = ucfirst(strtolower($matches[1])) . ' Trailer';
                return $extractedType;
            }
            return 'Utility Trailer'; // Default
        }
    }

    /**
     * Determine condition from title/description
     */
    private function determineCondition($title, $description)
    {
        $text = strtolower($title . ' ' . $description);
        
        // **ISSUE 3 FIX: Better condition detection**
        if (preg_match('/\b(brand new|factory new|new)\b/', $text) && !preg_match('/\b(used|pre-owned|preowned)\b/', $text)) {
            return 'new';
        } elseif (preg_match('/\b(used|pre-owned|preowned)\b/', $text)) {
            return 'used';
        } elseif (preg_match('/\b(refurbished|rebuilt|restored)\b/', $text)) {
            return 'refurbished';
        } else {
            // Check for recent years that indicate new trailers
            if (preg_match('/\b20(2[4-9]|3[0-9])\b/', $text)) {
                return 'new';
            }
            return 'used'; // Default assumption
        }
    }

    /**
     * Extract color from title/description
     */
    private function extractColor($title, $description)
    {
        $text = strtolower($title . ' ' . $description);
        
        // **ISSUE 2 FIX: Enhanced color detection**
        $colors = [
            'white', 'black', 'gray', 'grey', 'blue', 'red', 'green', 'yellow', 
            'orange', 'brown', 'silver', 'tan', 'beige', 'charcoal', 'navy', 
            'purple', 'pink', 'gold', 'bronze', 'maroon', 'teal', 'olive'
        ];
        
        foreach ($colors as $color) {
            if (preg_match('/\b' . preg_quote($color, '/') . '\b/', $text)) {
                return $this->mapToFacebookColor(ucfirst($color));
            }
        }
        
        return '';
    }

    /**
     * Map any color to Facebook-approved colors
     */
    private function mapToFacebookColor($inputColor)
    {
        if (empty($inputColor)) return '';
        
        $color = strtolower(trim($inputColor));
        
        // Facebook approved colors mapping
        $facebookColors = [
            // Direct matches
            'black' => 'Black',
            'blue' => 'Blue', 
            'brown' => 'Brown',
            'gold' => 'Gold',
            'green' => 'Green',
            'grey' => 'Grey',
            'gray' => 'Grey', // Map gray to grey
            'pink' => 'Pink',
            'purple' => 'Purple',
            'red' => 'Red',
            'silver' => 'Silver',
            'orange' => 'Orange',
            'white' => 'White',
            'yellow' => 'Yellow',
            'charcoal' => 'Charcoal',
            'tan' => 'Tan',
            'beige' => 'Beige',
            'burgundy' => 'Burgundy',
            'turquoise' => 'Turquoise',
            
            // Common mappings to Facebook colors
            'navy' => 'Blue',
            'dark blue' => 'Blue',
            'light blue' => 'Blue',
            'royal blue' => 'Blue',
            'sky blue' => 'Blue',
            'teal' => 'Turquoise',
            'aqua' => 'Turquoise',
            'cyan' => 'Turquoise',
            'lime' => 'Green',
            'forest green' => 'Green',
            'dark green' => 'Green',
            'olive' => 'Green',
            'maroon' => 'Burgundy',
            'crimson' => 'Red',
            'scarlet' => 'Red',
            'rose' => 'Pink',
            'magenta' => 'Pink',
            'violet' => 'Purple',
            'indigo' => 'Purple',
            'lavender' => 'Purple',
            'bronze' => 'Brown',
            'copper' => 'Brown',
            'rust' => 'Brown',
            'mahogany' => 'Brown',
            'cream' => 'White',
            'ivory' => 'White',
            'pearl' => 'White',
            'off white' => 'White',
            'off-white' => 'White',
            'platinum' => 'Silver',
            'chrome' => 'Silver',
            'metallic' => 'Silver',
            'gunmetal' => 'Charcoal',
            'slate' => 'Grey',
            'ash' => 'Grey',
            'smoke' => 'Grey',
            'stone' => 'Grey',
            'khaki' => 'Tan',
            'sand' => 'Tan',
            'camel' => 'Tan',
            'wheat' => 'Beige',
            'champagne' => 'Beige',
            'almond' => 'Beige'
        ];
        
        // Check for direct match
        if (isset($facebookColors[$color])) {
            $this->logger->info("Color mapped: \"{$inputColor}\" → \"{$facebookColors[$color]}\"");
            return $facebookColors[$color];
        }
        
        // Check for partial matches
        foreach ($facebookColors as $key => $value) {
            if (strpos($color, $key) !== false || strpos($key, $color) !== false) {
                $this->logger->info("Color mapped (partial): \"{$inputColor}\" → \"{$value}\"");
                return $value;
            }
        }
        
        // Default fallback - try to match by color family
        if (strpos($color, 'blue') !== false) return 'Blue';
        if (strpos($color, 'red') !== false) return 'Red';
        if (strpos($color, 'green') !== false) return 'Green';
        if (strpos($color, 'yellow') !== false) return 'Yellow';
        if (strpos($color, 'orange') !== false) return 'Orange';
        if (strpos($color, 'purple') !== false || strpos($color, 'violet') !== false) return 'Purple';
        if (strpos($color, 'pink') !== false) return 'Pink';
        if (strpos($color, 'brown') !== false) return 'Brown';
        if (strpos($color, 'black') !== false) return 'Black';
        if (strpos($color, 'white') !== false) return 'White';
        if (strpos($color, 'silver') !== false || strpos($color, 'metal') !== false) return 'Silver';
        if (strpos($color, 'gold') !== false) return 'Gold';
        if (strpos($color, 'grey') !== false || strpos($color, 'gray') !== false) return 'Grey';
        if (strpos($color, 'tan') !== false) return 'Tan';
        if (strpos($color, 'beige') !== false) return 'Beige';
        
        // If no match found, return Grey as safe default
        $this->logger->info("Color mapped (default): \"{$inputColor}\" → \"Grey\"");
        return 'Grey';
    }

    /**
     * Extract size from title/description
     */
    private function extractSize($title, $description)
    {
        $text = $title . ' ' . $description;
        
        // Look for size patterns like 6x12, 8.5x20, etc.
        if (preg_match('/\b(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)\b/', $text, $matches)) {
            return $matches[1] . 'x' . $matches[2];
        }
        
        return null;
    }

    /**
     * Resolve relative URLs to absolute URLs
     * 
     * @param string $url The URL to resolve (could be relative or absolute)
     * @param string $baseUrl The base URL to resolve against
     * @return string The resolved absolute URL
     */
    private function resolveUrl($url, $baseUrl)
    {
        if (empty($url)) {
            return '';
        }
        
        // Already absolute URL
        if (filter_var($url, FILTER_VALIDATE_URL)) {
            return $url;
        }
        
        // Parse base URL
        $baseParts = parse_url($baseUrl);
        if (!$baseParts) {
            return $url;
        }
        
        // Handle protocol-relative URLs
        if (substr($url, 0, 2) === '//') {
            return ($baseParts['scheme'] ?? 'https') . ':' . $url;
        }
        
        // Handle absolute paths
        if (substr($url, 0, 1) === '/') {
            return $baseParts['scheme'] . '://' . $baseParts['host'] . 
                   (isset($baseParts['port']) ? ':' . $baseParts['port'] : '') . $url;
        }
        
        // Handle relative paths
        $basePath = isset($baseParts['path']) ? dirname($baseParts['path']) : '';
        if ($basePath === '.') {
            $basePath = '';
        }
        
        return $baseParts['scheme'] . '://' . $baseParts['host'] . 
               (isset($baseParts['port']) ? ':' . $baseParts['port'] : '') . 
               $basePath . '/' . $url;
    }

    /**
     * Find the best link for a trailer element using multiple strategies
     * 
     * @param Crawler $trailerCrawler The crawler for the trailer element
     * @param string $baseUrl The base URL for resolving relative URLs
     * @return string The best link found or empty string
     */
    private function findBestLink($trailerCrawler, $baseUrl)
    {
        $this->logger->info('Finding best link using multiple strategies');
        
        try {
            // Strategy 1: Look for any anchor tag with href
            $links = $trailerCrawler->filter('a[href]');
            if ($links->count() > 0) {
                foreach ($links as $link) {
                    $href = $link->getAttribute('href');
                    if (!empty($href) && $href !== '#') {
                        $resolvedUrl = $this->resolveUrl($href, $baseUrl);
                        if (filter_var($resolvedUrl, FILTER_VALIDATE_URL)) {
                            $this->logger->info('Found link via anchor tag', ['url' => $resolvedUrl]);
                            return $resolvedUrl;
                        }
                    }
                }
            }
            
            // Strategy 2: Look for clickable elements with data attributes
            $dataLinks = $trailerCrawler->filter('[data-url], [data-href], [data-link]');
            if ($dataLinks->count() > 0) {
                foreach ($dataLinks as $element) {
                    $dataUrl = $element->getAttribute('data-url') ?: 
                              $element->getAttribute('data-href') ?: 
                              $element->getAttribute('data-link');
                    if (!empty($dataUrl)) {
                        $resolvedUrl = $this->resolveUrl($dataUrl, $baseUrl);
                        if (filter_var($resolvedUrl, FILTER_VALIDATE_URL)) {
                            $this->logger->info('Found link via data attribute', ['url' => $resolvedUrl]);
                            return $resolvedUrl;
                        }
                    }
                }
            }
            
            // Strategy 3: Look for onclick handlers with URLs
            $clickableElements = $trailerCrawler->filter('[onclick]');
            if ($clickableElements->count() > 0) {
                foreach ($clickableElements as $element) {
                    $onclick = $element->getAttribute('onclick');
                    if (preg_match('/(?:location\.href|window\.open|navigate)\s*=\s*[\'"]([^\'"]+)[\'"]/', $onclick, $matches)) {
                        $extractedUrl = $matches[1];
                        $resolvedUrl = $this->resolveUrl($extractedUrl, $baseUrl);
                        if (filter_var($resolvedUrl, FILTER_VALIDATE_URL)) {
                            $this->logger->info('Found link via onclick handler', ['url' => $resolvedUrl]);
                            return $resolvedUrl;
                        }
                    }
                }
            }
            
            // Strategy 4: Look for parent elements that might be clickable
            // Get the DOM node and traverse up to find parent links
            if ($trailerCrawler->count() > 0) {
                $domNode = $trailerCrawler->getNode(0);
            } else {
                $domNode = null;
            }
            
            if ($domNode) {
                $parentNode = $domNode->parentNode;
                while ($parentNode && $parentNode->nodeType === XML_ELEMENT_NODE) {
                    if ($parentNode->nodeName === 'a' && $parentNode->hasAttribute('href')) {
                        $href = $parentNode->getAttribute('href');
                        if (!empty($href) && $href !== '#') {
                            $resolvedUrl = $this->resolveUrl($href, $baseUrl);
                            if (filter_var($resolvedUrl, FILTER_VALIDATE_URL)) {
                                $this->logger->info('Found link via parent element', ['url' => $resolvedUrl]);
                                return $resolvedUrl;
                            }
                        }
                    }
                    $parentNode = $parentNode->parentNode;
                }
            }
            
            $this->logger->warning('No valid link found for trailer element');
            return '';
            
        } catch (\Exception $e) {
            $this->logger->error('Error finding best link', ['error' => $e->getMessage()]);
            return '';
        }
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
     * Ensure cache directory exists with proper permissions
     * 
     * @param string $cacheFile The cache file path
     * @return bool Whether the directory is ready for writing
     */
    private function ensureCacheDirectory($cacheFile)
    {
        $cacheDir = dirname($cacheFile);
        
        if (is_dir($cacheDir) && is_writable($cacheDir)) {
            return true;
        }
        
        if (!is_dir($cacheDir)) {
            if (@mkdir($cacheDir, 0755, true)) {
                $this->logger->info('Created cache directory', ['dir' => $cacheDir]);
                return true;
            } else {
                $this->logger->warning('Failed to create cache directory', ['dir' => $cacheDir]);
                return false;
            }
        }
        
        if (!is_writable($cacheDir)) {
            if (@chmod($cacheDir, 0755)) {
                $this->logger->info('Fixed cache directory permissions', ['dir' => $cacheDir]);
                return true;
            } else {
                $this->logger->warning('Cache directory not writable', ['dir' => $cacheDir]);
                return false;
            }
        }
        
        return true;
    }
}