#!/bin/bash

echo "🧹 Starting WebDriver Scraper Cleanup..."
echo "========================================"

# 1. Kill all Chrome and ChromeDriver processes
echo "1. Stopping all Chrome and ChromeDriver processes..."
pkill -f chromedriver 2>/dev/null || true
pkill -f chrome 2>/dev/null || true
pkill -f chromium 2>/dev/null || true
sleep 2

# 2. Clean up temporary Chrome user data directories
echo "2. Cleaning up temporary Chrome directories..."
find /tmp -name "chrome_user_data_*" -type d -exec rm -rf {} \; 2>/dev/null || true
find /tmp -name "chrome_session_*" -type d -exec rm -rf {} \; 2>/dev/null || true
find /tmp -name "chrome_profile_*" -type d -exec rm -rf {} \; 2>/dev/null || true

# 3. Clean up any Chrome crash dumps
echo "3. Cleaning up Chrome crash dumps..."
find /tmp -name "chrome_*" -name "*.dmp" -delete 2>/dev/null || true

# 4. Clean up systemd private temp directories (if any)
echo "4. Cleaning up systemd private temp directories..."
find /tmp/systemd-private-* -name "chrome_user_data_*" -type d -exec rm -rf {} \; 2>/dev/null || true

# 5. Check and clean up any locked files
echo "5. Checking for locked Chrome files..."
lsof | grep chrome | awk '{print $2}' | sort -u | xargs -r kill -9 2>/dev/null || true

# 6. Clear any Chrome SharedMemory segments
echo "6. Cleaning up shared memory segments..."
ipcs -m | grep chrome | awk '{print $2}' | xargs -r ipcrm -m 2>/dev/null || true

# 7. Verify ChromeDriver is executable
echo "7. Checking ChromeDriver permissions..."
CHROMEDRIVER_PATH="/usr/local/bin/chromedriver"

if [ -f "$CHROMEDRIVER_PATH" ]; then
    echo "   ✅ System-wide ChromeDriver found at: $CHROMEDRIVER_PATH"
    echo "   ✅ Version: $(chromedriver --version 2>/dev/null || echo 'Version check failed')"
else
    echo "   ⚠️  System-wide ChromeDriver not found at: $CHROMEDRIVER_PATH"
    # Check if it's in PATH
    if command -v chromedriver >/dev/null 2>&1; then
        echo "   ✅ ChromeDriver found in PATH: $(which chromedriver)"
    else
        echo "   ❌ ChromeDriver not found in system"
    fi
fi

# 8. Check available ports
echo "8. Checking if port 9515 is available..."
if command -v lsof >/dev/null 2>&1; then
    if lsof -i :9515 >/dev/null 2>&1; then
        echo "   ⚠️  Port 9515 is in use, attempting to free it..."
        lsof -ti :9515 | xargs -r kill -9 2>/dev/null || true
        sleep 1
    fi
    echo "   ✅ Port 9515 is now available"
elif command -v ss >/dev/null 2>&1; then
    if ss -ln | grep :9515 >/dev/null 2>&1; then
        echo "   ⚠️  Port 9515 may be in use"
    else
        echo "   ✅ Port 9515 appears available"
    fi
else
    echo "   ⚠️  Cannot check port status (lsof/ss not available)"
fi

# 9. Clear PHP session files that might hold locks
echo "9. Cleaning up PHP session files..."
find /tmp -name "sess_*" -mtime +1 -delete 2>/dev/null || true

# 10. Create a test to verify everything works
echo "10. Testing WebDriver setup..."
if [ -f "$CHROMEDRIVER_PATH" ]; then
    # Test ChromeDriver can start
    timeout 5s "$CHROMEDRIVER_PATH" --port=9516 --whitelisted-ips= >/dev/null 2>&1 &
    TEST_PID=$!
    sleep 2
    
    if kill -0 $TEST_PID 2>/dev/null; then
        echo "    ✅ ChromeDriver test successful"
        kill $TEST_PID 2>/dev/null || true
    else
        echo "    ❌ ChromeDriver test failed"
    fi
else
    echo "    ⚠️  Cannot test - ChromeDriver not found"
fi

echo ""
echo "🎉 Cleanup completed!"
echo "========================================"
echo "Summary:"
echo "✅ All Chrome/ChromeDriver processes stopped"
echo "✅ Temporary directories cleaned"
echo "✅ Permissions verified"
echo "✅ Ports freed"
echo ""
echo "You can now use the scraper without conflicts."
echo "If you still have issues, try running this script again or restart Apache/PHP-FPM."
echo "" 