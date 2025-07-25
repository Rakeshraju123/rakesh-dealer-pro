#!/bin/bash

# WebDriver Cleanup Script
# Run this script after duplicating the project folder to prevent WebDriver conflicts

echo "🧹 Starting WebDriver cleanup..."

# 1. Kill all ChromeDriver processes
echo "🔪 Killing ChromeDriver processes..."
pkill -f chromedriver 2>/dev/null || true

# 2. Kill all Chrome processes with temp user data directories
echo "🔪 Killing Chrome processes with temp user data..."
pkill -f "chrome.*user-data-dir=/tmp/chrome_user_data" 2>/dev/null || true

# 3. Remove all temporary Chrome user data directories
echo "🗑️ Removing temporary Chrome user data directories..."
rm -rf /tmp/chrome_user_data_* 2>/dev/null || true
rm -rf /tmp/chrome_profile_* 2>/dev/null || true

# 4. Clean up project-specific cache directories
echo "🗑️ Cleaning project cache directories..."
rm -rf .cache .config .data .xdg_cache .xdg_config .xdg_data 2>/dev/null || true

# 5. Clear log files
echo "📝 Clearing log files..."
truncate -s 0 listing_log.txt 2>/dev/null || true
find logs -name "*.log" -type f -exec truncate -s 0 {} + 2>/dev/null || true

# 6. Check if port 9515 is free
echo "🔍 Checking if ChromeDriver port is free..."
if lsof -i :9515 >/dev/null 2>&1; then
    echo "⚠️ Port 9515 is still in use. You may need to restart Apache or the system."
else
    echo "✅ Port 9515 is free"
fi

# 7. Verify cleanup
CHROME_PROCESSES=$(ps aux | grep chrome | grep -v grep | wc -l)
CHROMEDRIVER_PROCESSES=$(ps aux | grep chromedriver | grep -v grep | wc -l)

echo ""
echo "🎉 Cleanup completed!"
echo "   Chrome processes: $CHROME_PROCESSES"
echo "   ChromeDriver processes: $CHROMEDRIVER_PROCESSES"
echo "   Temp directories cleaned: ✅"
echo "   Log files cleared: ✅"

if [ $CHROME_PROCESSES -eq 0 ] && [ $CHROMEDRIVER_PROCESSES -eq 0 ]; then
    echo "✅ All WebDriver resources cleaned successfully!"
    echo "🚀 Your scraper should now work without conflicts."
else
    echo "⚠️ Some processes are still running. You may need to restart Apache or the system."
fi

echo ""
echo "💡 Tip: Run this script whenever you duplicate the project folder." 