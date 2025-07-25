<?php

require_once __DIR__ . '/DotEnvLoader.php';

/**
 * SessionProxyManager - Manages session-based proxy IP assignment
 * 
 * This class ensures that each dealer gets a consistent proxy IP during their entire session.
 * The proxy IP only changes when the dealer logs out and logs back in.
 * This prevents Facebook from detecting suspicious IP rotations during a single session.
 */
class SessionProxyManager
{
    private static $sessionKey = 'dealer_proxy_session';
    private static $proxyPoolKey = 'proxy_ip_pool';
    
    /**
     * Get or assign a consistent proxy IP for the current dealer session
     * 
     * @return string|null The assigned proxy IP for this session
     */
    public static function getSessionProxyIP()
    {
        // Start session if not already started
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        
        // Check if dealer is authenticated
        if (!isset($_SESSION['dealer_id']) || !isset($_SESSION['is_authenticated'])) {
            error_log("SessionProxyManager: No authenticated dealer session found");
            return null;
        }
        
        $dealerId = $_SESSION['dealer_id'];
        $loginTime = $_SESSION['login_time'] ?? time();
        
        // Check if we already have a proxy IP assigned for this session
        if (isset($_SESSION[self::$sessionKey])) {
            $sessionProxy = $_SESSION[self::$sessionKey];
            
            // Verify the session proxy is still valid for this login session
            if ($sessionProxy['dealer_id'] === $dealerId && 
                $sessionProxy['login_time'] === $loginTime) {
                
                error_log("SessionProxyManager: Using existing session proxy IP: " . $sessionProxy['ip']);
                return $sessionProxy['ip'];
            }
        }
        
        // Assign a new proxy IP for this session
        $proxyIP = self::assignNewSessionProxy($dealerId, $loginTime);
        
        if ($proxyIP) {
            error_log("SessionProxyManager: Assigned new session proxy IP: $proxyIP for dealer: $dealerId");
        } else {
            error_log("SessionProxyManager: Failed to assign proxy IP for dealer: $dealerId");
        }
        
        return $proxyIP;
    }
    
    /**
     * Assign a new proxy IP for the current session
     * 
     * @param int $dealerId The dealer ID
     * @param int $loginTime The login timestamp
     * @return string|null The assigned proxy IP
     */
    private static function assignNewSessionProxy($dealerId, $loginTime)
    {
        try {
            // Get proxy configuration
            $proxyConfig = DotEnvLoader::getOxylabsConfig();
            
            if (!$proxyConfig['enabled']) {
                error_log("SessionProxyManager: Proxy is not enabled in configuration");
                return null;
            }
            
            // Generate unique session identifier for this proxy request
            $sessionId = 'session-' . time() . '-' . rand(1000, 9999);
            $uniqueUsername = $proxyConfig['username'] . '-' . $sessionId;
            
            // Get a fresh proxy IP from Oxylabs
            $proxyIP = self::fetchFreshProxyIP($proxyConfig, $uniqueUsername);
            
            if (!$proxyIP) {
                error_log("SessionProxyManager: Failed to fetch fresh proxy IP");
                return null;
            }
            
            // Store the proxy IP in session
            $_SESSION[self::$sessionKey] = [
                'ip' => $proxyIP,
                'dealer_id' => $dealerId,
                'login_time' => $loginTime,
                'assigned_at' => time(),
                'location' => $proxyConfig['location'],
                'host' => $proxyConfig['host'],
                'port' => $proxyConfig['port'],
                'unique_username' => $uniqueUsername
            ];
            
            // Also store in a more persistent way (database or file) for tracking
            self::logProxyAssignment($dealerId, $proxyIP, $loginTime);
            
            return $proxyIP;
            
        } catch (Exception $e) {
            error_log("SessionProxyManager: Error assigning new session proxy: " . $e->getMessage());
            return null;
        }
    }
    
    /**
     * Fetch a fresh proxy IP from Oxylabs
     * 
     * @param array $proxyConfig Proxy configuration
     * @return string|null The fetched proxy IP
     */
    private static function fetchFreshProxyIP($proxyConfig, $uniqueUsername = null)
    {
        try {
            // Use provided unique username or generate one
            if (!$uniqueUsername) {
                $sessionId = 'session-' . time() . '-' . rand(1000, 9999);
                $uniqueUsername = $proxyConfig['username'] . '-' . $sessionId;
            }
            
            error_log("SessionProxyManager: Requesting fresh proxy with username: " . $uniqueUsername);
            
            $ch = curl_init();
            curl_setopt_array($ch, [
                CURLOPT_URL => 'https://ip.oxylabs.io/location',
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => 15,
                CURLOPT_PROXY => $proxyConfig['host'] . ':' . $proxyConfig['port'],
                CURLOPT_PROXYUSERPWD => $uniqueUsername . ':' . $proxyConfig['password'],
                CURLOPT_PROXYTYPE => CURLPROXY_HTTP,
                CURLOPT_HTTPPROXYTUNNEL => true,
                CURLOPT_SSL_VERIFYPEER => false,
                CURLOPT_SSL_VERIFYHOST => false,
                CURLOPT_USERAGENT => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            ]);

            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $error = curl_error($ch);
            curl_close($ch);

            if ($error) {
                error_log("SessionProxyManager: cURL error fetching proxy IP: " . $error);
                return null;
            }

            if ($httpCode !== 200) {
                error_log("SessionProxyManager: HTTP error fetching proxy IP. Code: " . $httpCode);
                return null;
            }

            $data = json_decode($response, true);
            if (!$data || !isset($data['ip'])) {
                error_log("SessionProxyManager: Invalid response when fetching proxy IP: " . $response);
                return null;
            }

            return $data['ip'];

        } catch (Exception $e) {
            error_log("SessionProxyManager: Exception fetching proxy IP: " . $e->getMessage());
            return null;
        }
    }
    
    /**
     * Get the current session proxy information
     * 
     * @return array|null The session proxy information
     */
    public static function getSessionProxyInfo()
    {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        
        if (!isset($_SESSION[self::$sessionKey])) {
            return null;
        }
        
        return $_SESSION[self::$sessionKey];
    }
    
    /**
     * Clear the session proxy (called on logout)
     */
    public static function clearSessionProxy()
    {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        
        $sessionProxy = $_SESSION[self::$sessionKey] ?? null;
        
        if ($sessionProxy) {
            error_log("SessionProxyManager: Clearing session proxy IP: " . $sessionProxy['ip'] . 
                     " for dealer: " . $sessionProxy['dealer_id']);
            
            // Log the proxy release
            self::logProxyRelease($sessionProxy['dealer_id'], $sessionProxy['ip'], $sessionProxy['login_time']);
        }
        
        unset($_SESSION[self::$sessionKey]);
    }
    
    /**
     * Log proxy assignment for tracking and debugging
     * 
     * @param int $dealerId The dealer ID
     * @param string $proxyIP The assigned proxy IP
     * @param int $loginTime The login timestamp
     */
    private static function logProxyAssignment($dealerId, $proxyIP, $loginTime)
    {
        try {
            $logDir = __DIR__ . '/../data/proxy_logs';
            if (!is_dir($logDir)) {
                mkdir($logDir, 0755, true);
            }
            
            $logFile = $logDir . '/proxy_assignments.log';
            $logEntry = [
                'timestamp' => date('Y-m-d H:i:s'),
                'action' => 'ASSIGN',
                'dealer_id' => $dealerId,
                'proxy_ip' => $proxyIP,
                'login_time' => $loginTime,
                'session_id' => session_id()
            ];
            
            file_put_contents($logFile, json_encode($logEntry) . "\n", FILE_APPEND | LOCK_EX);
            
        } catch (Exception $e) {
            error_log("SessionProxyManager: Error logging proxy assignment: " . $e->getMessage());
        }
    }
    
    /**
     * Log proxy release for tracking and debugging
     * 
     * @param int $dealerId The dealer ID
     * @param string $proxyIP The released proxy IP
     * @param int $loginTime The login timestamp
     */
    private static function logProxyRelease($dealerId, $proxyIP, $loginTime)
    {
        try {
            $logDir = __DIR__ . '/../data/proxy_logs';
            if (!is_dir($logDir)) {
                mkdir($logDir, 0755, true);
            }
            
            $logFile = $logDir . '/proxy_assignments.log';
            $logEntry = [
                'timestamp' => date('Y-m-d H:i:s'),
                'action' => 'RELEASE',
                'dealer_id' => $dealerId,
                'proxy_ip' => $proxyIP,
                'login_time' => $loginTime,
                'session_id' => session_id()
            ];
            
            file_put_contents($logFile, json_encode($logEntry) . "\n", FILE_APPEND | LOCK_EX);
            
        } catch (Exception $e) {
            error_log("SessionProxyManager: Error logging proxy release: " . $e->getMessage());
        }
    }
    
    /**
     * Test the session proxy connection
     * 
     * @return array Test result with success status and details
     */
    public static function testSessionProxy()
    {
        $proxyInfo = self::getSessionProxyInfo();
        
        if (!$proxyInfo) {
            return [
                'success' => false,
                'message' => 'No session proxy assigned'
            ];
        }
        
        try {
            $proxyConfig = DotEnvLoader::getOxylabsConfig();
            
            $ch = curl_init();
            curl_setopt_array($ch, [
                CURLOPT_URL => 'https://ip.oxylabs.io/location',
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => 15,
                CURLOPT_PROXY => $proxyConfig['host'] . ':' . $proxyConfig['port'],
                CURLOPT_PROXYUSERPWD => $proxyConfig['username'] . ':' . $proxyConfig['password'],
                CURLOPT_PROXYTYPE => CURLPROXY_HTTP,
                CURLOPT_HTTPPROXYTUNNEL => true,
                CURLOPT_SSL_VERIFYPEER => false,
                CURLOPT_SSL_VERIFYHOST => false,
                CURLOPT_USERAGENT => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            ]);

            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $error = curl_error($ch);
            $info = curl_getinfo($ch);
            curl_close($ch);

            if ($error) {
                return [
                    'success' => false,
                    'message' => 'Proxy connection failed: ' . $error,
                    'proxy_info' => $proxyInfo
                ];
            }

            if ($httpCode !== 200) {
                return [
                    'success' => false,
                    'message' => 'Proxy returned HTTP ' . $httpCode,
                    'proxy_info' => $proxyInfo
                ];
            }

            $data = json_decode($response, true);
            $currentIP = $data['ip'] ?? 'unknown';
            
            return [
                'success' => true,
                'message' => 'Session proxy is working correctly',
                'proxy_info' => $proxyInfo,
                'current_ip' => $currentIP,
                'response_time' => $info['total_time'] ?? 0
            ];

        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => 'Error testing proxy: ' . $e->getMessage(),
                'proxy_info' => $proxyInfo
            ];
        }
    }
    
    /**
     * Clear session proxy information (used when city changes)
     */
    public static function clearSessionProxyInfo()
    {
        // Start session if not already started
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        
        // Clear the session proxy data
        unset($_SESSION[self::$sessionKey]);
        
        // Force a new login time to ensure we get a fresh proxy
        $_SESSION['login_time'] = time();
        
        error_log("SessionProxyManager: Cleared session proxy info and reset login time");
    }
    
    /**
     * Force refresh of session proxy (clears and immediately reassigns)
     */
    public static function forceRefreshSessionProxy()
    {
        // Clear current session
        self::clearSessionProxyInfo();
        
        // Immediately get a new proxy IP which will trigger assignNewSessionProxy
        $newIP = self::getSessionProxyIP();
        
        error_log("SessionProxyManager: Force refreshed session proxy, new IP: " . ($newIP ?? 'null'));
        
        return $newIP;
    }
} 