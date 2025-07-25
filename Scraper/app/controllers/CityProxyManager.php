<?php

require_once __DIR__ . '/DotEnvLoader.php';

/**
 * CityProxyManager - Manages city-based proxy selection and preferences (Simplified)
 * 
 * This class provides intelligent city selection with:
 * - Autocomplete search functionality
 * - Smart city suggestions based on dealer preferences
 * - Simple city validation
 */
class CityProxyManager
{
    private static $conn = null;
    private static $conn_write = null;
    
    /**
     * Initialize database connections
     */
    private static function initializeDatabase()
    {
        if (self::$conn !== null) {
            return; // Already initialized
        }
        
        try {
            // Include multi-tenant database connection
            require_once '/var/www/dealer/dbConnect1.php';
            require_once '/var/www/dealer/includes/TenantManager.php';
            require_once '/var/www/dealer/config/database1.php';
            
            $currentTenant = TenantManager::getCurrentTenant();
            if (!$currentTenant) {
                error_log("No tenant context found for city proxy management - using fallback");
                self::$conn = null;
                self::$conn_write = null;
                return;
            }
            
            $schemaName = $currentTenant['schema_name'];
            
            // Create MySQLi connections for the tenant database
            self::$conn = new mysqli(
                DatabaseConfig::TENANT_DB_HOST,
                DatabaseConfig::TENANT_DB_USER,
                DatabaseConfig::TENANT_DB_PASS,
                $schemaName
            );
            
            self::$conn_write = new mysqli(
                DatabaseConfig::TENANT_DB_HOST,
                DatabaseConfig::TENANT_DB_USER,
                DatabaseConfig::TENANT_DB_PASS,
                $schemaName
            );
            
            // Check connections
            if (self::$conn->connect_error) {
                error_log("Read connection failed: " . self::$conn->connect_error);
                self::$conn = null;
                self::$conn_write = null;
                return;
            }
            
            if (self::$conn_write->connect_error) {
                error_log("Write connection failed: " . self::$conn_write->connect_error);
                self::$conn = null;
                self::$conn_write = null;
                return;
            }
            
            // Set charset
            self::$conn->set_charset("utf8mb4");
            self::$conn_write->set_charset("utf8mb4");
            
        } catch (Exception $e) {
            error_log("CityProxyManager database initialization error: " . $e->getMessage());
            self::$conn = null;
            self::$conn_write = null;
        }
    }
    
    /**
     * Get available US cities for proxy selection with search functionality
     * 
     * @param string $search Optional search term to filter cities
     * @param int $limit Maximum number of results to return
     * @return array Array of cities with metadata
     */
    public static function getAvailableCities($search = '', $limit = 50)
    {
        self::initializeDatabase();
        
        if (!self::$conn) {
            // Fallback to hardcoded popular cities if database is unavailable
            return self::getFallbackCities($search, $limit);
        }
        
        try {
            $sql = "SELECT 
                        city_name,
                        display_name,
                        country_code,
                        CASE 
                            WHEN city_name IN ('new_york', 'los_angeles', 'chicago', 'houston', 'miami') THEN 1
                            ELSE 2
                        END as priority_order
                    FROM available_proxy_cities 
                    WHERE country_code = 'US'";
            
            $params = [];
            $types = "";
            
            if (!empty($search)) {
                $sql .= " AND (city_name LIKE ? OR display_name LIKE ?)";
                $searchTerm = '%' . strtolower(str_replace(' ', '_', $search)) . '%';
                $displaySearchTerm = '%' . $search . '%';
                $params[] = $searchTerm;
                $params[] = $displaySearchTerm;
                $types .= "ss";
            }
            
            $sql .= " ORDER BY priority_order ASC, display_name ASC";
            
            if ($limit > 0) {
                $sql .= " LIMIT ?";
                $params[] = $limit;
                $types .= "i";
            }
            
            $stmt = self::$conn->prepare($sql);
            if (!empty($params)) {
                $stmt->bind_param($types, ...$params);
            }
            
            $stmt->execute();
            $result = $stmt->get_result();
            
            $cities = [];
            while ($row = $result->fetch_assoc()) {
                $cities[] = [
                    'city_name' => $row['city_name'],
                    'display_name' => $row['display_name'],
                    'country_code' => $row['country_code'],
                    'is_available' => true, // All cities in the table are available
                    'is_default' => false
                ];
            }
            
            return $cities;
            
        } catch (Exception $e) {
            error_log("Error fetching available cities: " . $e->getMessage());
            return self::getFallbackCities($search, $limit);
        }
    }
    
    /**
     * Get smart city suggestions for a dealer
     * 
     * @param int $dealerId The dealer ID
     * @return array Array of suggested cities
     */
    public static function getSmartSuggestions($dealerId)
    {
        self::initializeDatabase();
        
        $suggestions = [];
        
        if (self::$conn) {
            try {
                // Get dealer's favorite cities
                $sql = "SELECT dpc.city_name, dpc.usage_count, dpc.last_used, apc.display_name
                        FROM dealer_proxy_cities dpc
                        LEFT JOIN available_proxy_cities apc ON dpc.city_name = apc.city_name
                        WHERE dpc.dealer_id = ? AND dpc.is_favorite = TRUE 
                        ORDER BY dpc.usage_count DESC, dpc.last_used DESC 
                        LIMIT 3";
                
                $stmt = self::$conn->prepare($sql);
                $stmt->bind_param("i", $dealerId);
                $stmt->execute();
                $result = $stmt->get_result();
                
                while ($row = $result->fetch_assoc()) {
                    $suggestions[] = [
                        'city_name' => $row['city_name'],
                        'display_name' => $row['display_name'] ?: self::formatCityDisplayName($row['city_name']),
                        'reason' => 'Favorite',
                        'usage_count' => $row['usage_count'],
                        'type' => 'favorite'
                    ];
                }
                
                // Get recently used cities (not already in favorites)
                $favoriteCities = array_column($suggestions, 'city_name');
                if (!empty($favoriteCities)) {
                    $favoriteCitiesPlaceholder = str_repeat('?,', count($favoriteCities) - 1) . '?';
                    
                    $sql = "SELECT dpc.city_name, dpc.usage_count, dpc.last_used, apc.display_name
                            FROM dealer_proxy_cities dpc
                            LEFT JOIN available_proxy_cities apc ON dpc.city_name = apc.city_name
                            WHERE dpc.dealer_id = ? 
                            AND dpc.city_name NOT IN ($favoriteCitiesPlaceholder)
                            AND dpc.last_used IS NOT NULL 
                            ORDER BY dpc.last_used DESC 
                            LIMIT 2";
                    
                    $stmt = self::$conn->prepare($sql);
                    $params = array_merge([$dealerId], $favoriteCities);
                    $types = 'i' . str_repeat('s', count($favoriteCities));
                    $stmt->bind_param($types, ...$params);
                    $stmt->execute();
                    $result = $stmt->get_result();
                    
                    while ($row = $result->fetch_assoc()) {
                        $suggestions[] = [
                            'city_name' => $row['city_name'],
                            'display_name' => $row['display_name'] ?: self::formatCityDisplayName($row['city_name']),
                            'reason' => 'Recently Used',
                            'usage_count' => $row['usage_count'],
                            'type' => 'recent'
                        ];
                    }
                }
                
            } catch (Exception $e) {
                error_log("Error getting smart suggestions: " . $e->getMessage());
            }
        }
        
        // Add popular cities if we don't have enough suggestions
        if (count($suggestions) < 3) {
            $popularCities = [
                'new_york' => 'New York',
                'los_angeles' => 'Los Angeles',
                'chicago' => 'Chicago',
                'houston' => 'Houston',
                'miami' => 'Miami'
            ];
            $existingCities = array_column($suggestions, 'city_name');
            
            foreach ($popularCities as $cityName => $displayName) {
                if (!in_array($cityName, $existingCities) && count($suggestions) < 5) {
                    $suggestions[] = [
                        'city_name' => $cityName,
                        'display_name' => $displayName,
                        'reason' => 'Popular Choice',
                        'usage_count' => 0,
                        'type' => 'popular'
                    ];
                }
            }
        }
        
        // No default city - only show actual suggestions
        
        return $suggestions;
    }
    
    /**
     * Set dealer's preferred proxy city
     * 
     * @param int $dealerId The dealer ID
     * @param string $cityName The city name
     * @param bool $isFavorite Whether to mark as favorite
     * @return bool Success status
     */
    public static function setDealerCity($dealerId, $cityName, $isFavorite = false)
    {
        self::initializeDatabase();
        
        if (!self::$conn_write) {
            error_log("Cannot set dealer city: database connection unavailable");
            return false;
        }
        
        try {
            // Validate city exists and is available
            if (!self::validateCity($cityName)) {
                error_log("Invalid or unavailable city: $cityName");
                return false;
            }
            
            // Update or insert dealer city preference
            $sql = "INSERT INTO dealer_proxy_cities 
                        (dealer_id, city_name, is_favorite, usage_count, last_used) 
                    VALUES (?, ?, ?, 1, NOW()) 
                    ON DUPLICATE KEY UPDATE 
                        is_favorite = VALUES(is_favorite),
                        usage_count = usage_count + 1,
                        last_used = NOW(),
                        updated_at = CURRENT_TIMESTAMP";
            
            $stmt = self::$conn_write->prepare($sql);
            $stmt->bind_param("isi", $dealerId, $cityName, $isFavorite);
            
            $success = $stmt->execute();
            
            if ($success) {
                error_log("Successfully set city preference for dealer $dealerId: $cityName" . 
                         ($isFavorite ? " (favorite)" : ""));
                
                // Store in session for immediate use
                if (session_status() === PHP_SESSION_NONE) {
                    session_start();
                }
                $_SESSION['selected_proxy_city'] = $cityName;
            }
            
            return $success;
            
        } catch (Exception $e) {
            error_log("Error setting dealer city: " . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Get dealer's current selected city
     * 
     * @param int $dealerId The dealer ID
     * @return string The selected city name
     */
    public static function getDealerSelectedCity($dealerId)
    {
        // Check session first for immediate response
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        
        if (isset($_SESSION['selected_proxy_city'])) {
            return $_SESSION['selected_proxy_city'];
        }
        
        self::initializeDatabase();
        
        if (!self::$conn) {
            error_log("Warning: No dealer city found, returning null");
        return null; // No fallback
        }
        
        try {
            // Get most recently used city for this dealer
            $sql = "SELECT city_name 
                    FROM dealer_proxy_cities 
                    WHERE dealer_id = ? 
                    ORDER BY last_used DESC, is_favorite DESC 
                    LIMIT 1";
            
            $stmt = self::$conn->prepare($sql);
            $stmt->bind_param("i", $dealerId);
            $stmt->execute();
            $result = $stmt->get_result();
            
            if ($row = $result->fetch_assoc()) {
                $selectedCity = $row['city_name'];
                $_SESSION['selected_proxy_city'] = $selectedCity;
                return $selectedCity;
            }
            
        } catch (Exception $e) {
            error_log("Error getting dealer selected city: " . $e->getMessage());
        }
        
        error_log("Warning: getDealerSelectedCity fallback reached, returning null");
        return null; // No fallback
    }
    
    /**
     * Validate if a city is available for proxy use
     * 
     * @param string $cityName The city name to validate
     * @return bool Whether the city is valid and available
     */
    public static function validateCity($cityName)
    {
        self::initializeDatabase();
        
        if (!self::$conn) {
            // No fallback validation - require database
            error_log("Warning: City validation failed, no database connection");
            return false;
        }
        
        try {
            $sql = "SELECT COUNT(*) as count 
                    FROM available_proxy_cities 
                    WHERE city_name = ? AND country_code = 'US'";
            
            $stmt = self::$conn->prepare($sql);
            $stmt->bind_param("s", $cityName);
            $stmt->execute();
            $result = $stmt->get_result();
            $row = $result->fetch_assoc();
            
            return $row['count'] > 0;
            
        } catch (Exception $e) {
            error_log("Error validating city: " . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Get proxy configuration for a specific city
     * 
     * @param string $cityName The city name
     * @return array Proxy configuration
     */
    public static function getCityProxyConfig($cityName)
    {
        $baseConfig = DotEnvLoader::getOxylabsConfig();
        
        // Update username to include the specific city
        $baseConfig['username'] = str_replace('kansas_city', $cityName, $baseConfig['username']);
        $baseConfig['location'] = $cityName;
        
        return $baseConfig;
    }
    
    /**
     * Format city name for display (fallback method)
     * 
     * @param string $cityName The city name from database
     * @return string Formatted display name
     */
    public static function formatCityDisplayName($cityName)
    {
        // Convert underscores to spaces and capitalize each word
        $displayName = str_replace('_', ' ', $cityName);
        $displayName = ucwords($displayName);
        
        // Handle special cases
        $specialCases = [
            'St Louis' => 'St. Louis',
            'St Paul' => 'St. Paul',
            'New York' => 'New York',
            'Los Angeles' => 'Los Angeles',
            'San Francisco' => 'San Francisco',
            'San Diego' => 'San Diego',
            'San Jose' => 'San Jose',
            'San Antonio' => 'San Antonio',
            'San Ramon' => 'San Ramon',
            'Fort Worth' => 'Fort Worth',
            'Fort Lauderdale' => 'Fort Lauderdale',
            'Fort Wayne' => 'Fort Wayne',
            'Las Vegas' => 'Las Vegas',
            'Salt Lake City' => 'Salt Lake City',
            'Oklahoma City' => 'Oklahoma City',
            'Colorado Springs' => 'Colorado Springs',
            'Virginia Beach' => 'Virginia Beach',
            'Staten Island' => 'Staten Island',
            'New Orleans' => 'New Orleans',
            'Long Beach' => 'Long Beach',
            'Kansas City' => 'Kansas City'
        ];
        
        return $specialCases[$displayName] ?? $displayName;
    }
    
    /**
     * Get fallback cities when database is unavailable
     * 
     * @param string $search Search term
     * @param int $limit Result limit
     * @return array Fallback cities
     */
    private static function getFallbackCities($search = '', $limit = 50)
    {
        // No fallback cities - require database
        error_log("Warning: Database unavailable, no fallback cities");
        return [];
        
        $cities = [];
        foreach ($fallbackCities as $cityName => $displayName) {
            if (empty($search) || 
                strpos($cityName, strtolower(str_replace(' ', '_', $search))) !== false ||
                strpos(strtolower($displayName), strtolower($search)) !== false) {
                $cities[] = [
                    'city_name' => $cityName,
                    'display_name' => $displayName,
                    'country_code' => 'US',
                    'is_available' => true,
                    'is_default' => false
                ];
            }
        }
        
        return array_slice($cities, 0, $limit);
    }
    
    /**
     * Clear dealer's session city selection
     * 
     * @param int $dealerId The dealer ID
     */
    public static function clearDealerSession($dealerId)
    {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        
        unset($_SESSION['selected_proxy_city']);
        
        error_log("Cleared proxy city session for dealer: $dealerId");
    }
} 