<?php
session_start();

require_once __DIR__ . '/app/controllers/DotEnvLoader.php';
require_once __DIR__ . '/app/controllers/SessionProxyManager.php';
require_once __DIR__ . '/app/controllers/CityProxyManager.php';

// Set test session if not exists
if (!isset($_SESSION['dealer_id'])) {
    $_SESSION['dealer_id'] = 1;
    $_SESSION['is_authenticated'] = true;
    $_SESSION['login_time'] = time();
}

echo "<h2>🧹 Proxy Data Cleanup</h2>";

// Handle cleanup actions
if (isset($_GET['action'])) {
    switch ($_GET['action']) {
        case 'clear_all':
            // Use the new clear proxy API approach
            try {
                SessionProxyManager::clearSessionProxyInfo();
                unset($_SESSION['selected_proxy_city']);
                $_SESSION['login_time'] = time();
                echo "<div style='background: #d4edda; padding: 10px; border-radius: 4px; margin: 10px 0;'>✅ Cleared all session proxy data using new method</div>";
            } catch (Exception $e) {
                echo "<div style='background: #f8d7da; padding: 10px; border-radius: 4px; margin: 10px 0;'>❌ Error: " . $e->getMessage() . "</div>";
            }
            break;
            
        case 'clear_db':
            try {
                $manager = new CityProxyManager();
                // This will clear dealer proxy preferences - you might want to be more selective
                echo "<div style='background: #fff3cd; padding: 10px; border-radius: 4px; margin: 10px 0;'>⚠️ Database cleanup not implemented - would be too destructive</div>";
            } catch (Exception $e) {
                echo "<div style='background: #f8d7da; padding: 10px; border-radius: 4px; margin: 10px 0;'>❌ Error: " . $e->getMessage() . "</div>";
            }
            break;
            
        case 'reset_to_city':
            $city = $_GET['city'] ?? '';
            if ($city) {
                // Clear everything first
                SessionProxyManager::clearSessionProxyInfo();
                unset($_SESSION['selected_proxy_city']);
                
                // Set new city
                DotEnvLoader::setSelectedProxyCity($city);
                
                // Force new proxy
                $newIP = SessionProxyManager::forceRefreshSessionProxy();
                
                echo "<div style='background: #d4edda; padding: 10px; border-radius: 4px; margin: 10px 0;'>✅ Reset to $city, new IP: " . ($newIP ?? 'null') . "</div>";
            }
            break;
            
        case 'force_new_ip':
            $city = $_GET['city'] ?? $_SESSION['selected_proxy_city'] ?? 'dallas';
            
            // Clear everything multiple times to ensure clean state
            SessionProxyManager::clearSessionProxyInfo();
            unset($_SESSION['selected_proxy_city']);
            sleep(1); // Wait a second
            
            // Set city and force completely new session
            DotEnvLoader::setSelectedProxyCity($city);
            
            // Force multiple refreshes to get truly new IP
            $ip1 = SessionProxyManager::forceRefreshSessionProxy();
            SessionProxyManager::clearSessionProxyInfo();
            sleep(1);
            $ip2 = SessionProxyManager::forceRefreshSessionProxy();
            
            echo "<div style='background: #d1ecf1; padding: 10px; border-radius: 4px; margin: 10px 0;'>🔄 Forced new IP for $city: $ip1 → $ip2</div>";
            break;
    }
}

// Current state
echo "<h3>Current State</h3>";
echo "<div style='background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 10px 0;'>";

echo "<strong>Selected City:</strong> " . ($_SESSION['selected_proxy_city'] ?? 'not set') . "<br>";
echo "<strong>Login Time:</strong> " . ($_SESSION['login_time'] ?? 'not set') . "<br>";

$sessionProxy = SessionProxyManager::getSessionProxyInfo();
echo "<strong>Session Proxy Info:</strong><br>";
if ($sessionProxy) {
    echo "<pre>" . print_r($sessionProxy, true) . "</pre>";
} else {
    echo "No session proxy info<br>";
}

$proxyConfig = DotEnvLoader::getOxylabsConfig();
echo "<strong>Current Proxy Config:</strong><br>";
echo "<pre>" . print_r($proxyConfig, true) . "</pre>";

echo "</div>";

// Cleanup actions
echo "<h3>Cleanup Actions</h3>";
echo "<div style='background: #fff3cd; padding: 15px; border-radius: 8px; margin: 10px 0;'>";

echo "<a href='?action=clear_all' style='display: inline-block; margin: 5px; padding: 8px 12px; background: #dc3545; color: white; text-decoration: none; border-radius: 4px;'>Clear All Session Data</a>";
echo "<a href='?action=force_new_ip' style='display: inline-block; margin: 5px; padding: 8px 12px; background: #fd7e14; color: white; text-decoration: none; border-radius: 4px;'>🔄 Force New IP</a>";

$testCities = ['dallas', 'san_ramon', 'new_york', 'miami', 'washington'];
foreach ($testCities as $city) {
    echo "<a href='?action=reset_to_city&city=$city' style='display: inline-block; margin: 5px; padding: 8px 12px; background: #007bff; color: white; text-decoration: none; border-radius: 4px;'>Reset to $city</a>";
    echo "<a href='?action=force_new_ip&city=$city' style='display: inline-block; margin: 2px; padding: 6px 10px; background: #fd7e14; color: white; text-decoration: none; border-radius: 4px; font-size: 0.9em;'>🔄 Force $city IP</a>";
}

echo "<br><br>";
echo "<a href='?' style='display: inline-block; margin: 5px; padding: 8px 12px; background: #28a745; color: white; text-decoration: none; border-radius: 4px;'>Refresh Page</a>";

echo "</div>";

// Test current proxy
echo "<h3>Test Current Proxy</h3>";
echo "<div style='background: #e3f2fd; padding: 15px; border-radius: 8px; margin: 10px 0;'>";
echo "<button onclick='testCurrentProxy()' style='padding: 8px 16px; background: #17a2b8; color: white; border: none; border-radius: 4px; cursor: pointer;'>Test Current Proxy</button>";
echo "<div id='proxyTestResult' style='margin-top: 10px;'></div>";
echo "</div>";

echo "<script>
async function testCurrentProxy() {
    const result = document.getElementById('proxyTestResult');
    result.innerHTML = '🔄 Testing current proxy...';
    
    try {
        const response = await fetch('/dealer-pro/Scraper/app/api/get_proxy_ip.php');
        const data = await response.json();
        
        if (data.success) {
            const info = data.proxy_info;
            const sessionLocation = info.session_info?.location || 'N/A';
            const match = info.location === sessionLocation;
            
            result.innerHTML = `
                <div style='background: \${match ? '#d4edda' : '#f8d7da'}; padding: 10px; border-radius: 4px; margin: 5px 0;'>
                    <strong>\${match ? '✅' : '❌'} Proxy Test Results</strong><br>
                    <strong>Current IP:</strong> \${info.ip}<br>
                    <strong>Config Location:</strong> \${info.location}<br>
                    <strong>Session Location:</strong> \${sessionLocation}<br>
                    <strong>Display City:</strong> \${info.city}<br>
                    <strong>Match Status:</strong> \${match ? 'GOOD - Locations match' : 'BAD - Location mismatch!'}<br>
                    <strong>Type:</strong> \${info.type}<br>
                    <strong>Response Time:</strong> \${info.response_time}s<br>
                </div>
            `;
        } else {
            result.innerHTML = `
                <div style='background: #f8d7da; padding: 10px; border-radius: 4px; margin: 5px 0;'>
                    <strong>❌ Error:</strong> \${data.error || 'Unknown error'}
                </div>
            `;
        }
    } catch (error) {
        result.innerHTML = `
            <div style='background: #f8d7da; padding: 10px; border-radius: 4px; margin: 5px 0;'>
                <strong>❌ Network Error:</strong> \${error.message}
            </div>
        `;
    }
}

// Auto-test on page load
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(testCurrentProxy, 500);
});
</script>";
?> 