<?php
/**
 * Fix permissions for the scraper cache directory
 */

$cacheDir = __DIR__ . '/data';
$logsDir = __DIR__ . '/logs';

echo "=== Fixing Scraper Permissions ===\n";

// Create directories if they don't exist
$directories = [$cacheDir, $logsDir];

foreach ($directories as $dir) {
    if (!is_dir($dir)) {
        if (mkdir($dir, 0755, true)) {
            echo "✅ Created directory: $dir\n";
        } else {
            echo "❌ Failed to create directory: $dir\n";
        }
    } else {
        echo "📁 Directory exists: $dir\n";
    }
    
    // Fix permissions
    if (chmod($dir, 0755)) {
        echo "✅ Fixed permissions for: $dir\n";
    } else {
        echo "❌ Failed to fix permissions for: $dir\n";
    }
    
    // Check if writable
    if (is_writable($dir)) {
        echo "✅ Directory is writable: $dir\n";
    } else {
        echo "❌ Directory is not writable: $dir\n";
        echo "   Try running: sudo chown -R www-data:www-data $dir\n";
        echo "   Or: sudo chmod 777 $dir\n";
    }
    
    echo "\n";
}

echo "=== Permission Fix Complete ===\n";
echo "If you still see permission errors, run:\n";
echo "sudo chown -R www-data:www-data " . dirname(__DIR__) . "\n";
echo "sudo chmod -R 755 " . dirname(__DIR__) . "\n";
?> 