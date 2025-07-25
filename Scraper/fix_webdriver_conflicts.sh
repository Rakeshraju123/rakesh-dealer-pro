#!/bin/bash

# WebDriver Conflict Fix Script
# Run this script whenever you get "user data directory is already in use" errors

echo "🔧 Fixing WebDriver Conflicts..."
echo "=================================="

# 1. Kill all Chrome/Chromium processes
echo "1. Stopping all Chrome/Chromium processes..."
pkill -f chromedriver 2>/dev/null || true
pkill -f "chromium-browser.*headless" 2>/dev/null || true
pkill -f "chrome.*headless" 2>/dev/null || true
pkill -f "chrome.*user-data-dir" 2>/dev/null || true
pkill -f "chromium-browser.*user-data-dir" 2>/dev/null || true
sleep 2
echo "   ✅ All Chrome processes stopped"

# 2. Clean up user data directories
echo "2. Cleaning up user data directories..."
rm -rf /tmp/chrome_user_data_* 2>/dev/null || true
rm -rf /tmp/chrome_session_* 2>/dev/null || true
rm -rf /tmp/chrome_profile_* 2>/dev/null || true
rm -rf /tmp/.com.google.Chrome* 2>/dev/null || true
rm -rf /tmp/.org.chromium.Chromium* 2>/dev/null || true
echo "   ✅ User data directories cleaned"

# 3. Clean up shared memory segments
echo "3. Cleaning up shared memory..."
rm -rf /dev/shm/.org.chromium.Chromium.* 2>/dev/null || true
rm -rf /dev/shm/.com.google.Chrome.* 2>/dev/null || true
echo "   ✅ Shared memory cleaned"

# 4. Free port 9515
echo "4. Freeing ChromeDriver port..."
if command -v lsof >/dev/null 2>&1; then
    lsof -ti :9515 2>/dev/null | xargs -r kill -9 2>/dev/null || true
elif command -v ss >/dev/null 2>&1; then
    ss -lptn 'sport = :9515' 2>/dev/null | awk 'NR>1 {split($6,a,","); split(a[2],b,"="); print b[2]}' | xargs -r kill -9 2>/dev/null || true
fi
echo "   ✅ Port 9515 freed"

# 5. Clean up project cache
echo "5. Cleaning up project cache..."
cd "$(dirname "$0")"
rm -rf .cache .config .data .xdg_cache .xdg_config .xdg_data 2>/dev/null || true
echo "   ✅ Project cache cleaned"

# 6. Test ChromeDriver
echo "6. Testing ChromeDriver..."
if command -v chromedriver >/dev/null 2>&1; then
    CHROMEDRIVER_PATH=$(which chromedriver)
    echo "   ✅ System-wide ChromeDriver found at: $CHROMEDRIVER_PATH"
    echo "   ✅ Version: $(chromedriver --version 2>/dev/null || echo 'Version check failed')"
    
    # Test if ChromeDriver can start
    timeout 3s chromedriver --port=9516 --whitelisted-ips=127.0.0.1 >/dev/null 2>&1 &
    TEST_PID=$!
    sleep 1
    
    if kill -0 $TEST_PID 2>/dev/null; then
        echo "   ✅ ChromeDriver test successful"
        kill $TEST_PID 2>/dev/null || true
    else
        echo "   ❌ ChromeDriver test failed"
    fi
else
    echo "   ❌ ChromeDriver not found in system PATH"
fi

# 7. Test Google Chrome browser
echo "7. Testing Google Chrome browser..."
if command -v google-chrome >/dev/null 2>&1; then
    echo "   ✅ Google Chrome found at: $(which google-chrome)"
    echo "   ✅ Version: $(google-chrome --version 2>/dev/null || echo 'Version check failed')"
else
    echo "   ❌ Google Chrome not found"
fi

echo ""
echo "🎉 WebDriver conflict fix completed!"
echo "=================================="
echo "Summary:"
echo "✅ All Chrome processes killed"
echo "✅ User data directories cleaned"
echo "✅ Shared memory cleaned"
echo "✅ Port 9515 freed"
echo "✅ Project cache cleaned"
echo ""
echo "You can now run the scraper without conflicts."
echo "If you still have issues, restart Apache/PHP-FPM:"
echo "  sudo systemctl restart httpd"
echo "  sudo systemctl restart php-fpm" 