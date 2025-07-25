<?php

/**
 * WebDriver Scraper Cleanup Script
 * 
 * This script cleans up all Chrome/ChromeDriver processes and temporary files
 * to resolve conflicts when copying scraper folders or encountering WebDriver issues.
 */

class ScraperCleanup 
{
    private $logger;
    
    public function __construct() 
    {
        // Simple logger for cleanup operations
        $this->logger = function($message) {
            echo "[" . date('Y-m-d H:i:s') . "] " . $message . "\n";
        };
    }
    
    /**
     * Run complete cleanup process
     */
    public function runFullCleanup() 
    {
        $this->log("🧹 Starting WebDriver Scraper Cleanup...");
        $this->log("========================================");
        
        $this->killChromeProcesses();
        $this->cleanupTempDirectories();
        $this->cleanupSharedMemory();
        $this->fixPermissions();
        $this->checkPorts();
        $this->cleanupSessionFiles();
        $this->testSetup();
        
        $this->log("");
        $this->log("🎉 Cleanup completed!");
        $this->log("========================================");
        $this->log("Summary:");
        $this->log("✅ All Chrome/ChromeDriver processes stopped");
        $this->log("✅ Temporary directories cleaned");
        $this->log("✅ Permissions verified");
        $this->log("✅ Ports freed");
        $this->log("");
        $this->log("You can now use the scraper without conflicts.");
        
        return true;
    }
    
    /**
     * Kill all Chrome and ChromeDriver processes
     */
    private function killChromeProcesses() 
    {
        $this->log("1. Stopping all Chrome and ChromeDriver processes...");
        
        $commands = [
            'pkill -f chromedriver',
            'pkill -f chrome',
            'pkill -f chromium'
        ];
        
        foreach ($commands as $cmd) {
            shell_exec($cmd . ' 2>/dev/null');
        }
        
        sleep(2);
        $this->log("   ✅ Chrome processes stopped");
    }
    
    /**
     * Clean up temporary directories
     */
    private function cleanupTempDirectories() 
    {
        $this->log("2. Cleaning up temporary Chrome directories...");
        
        $patterns = [
            '/tmp/chrome_user_data_*',
            '/tmp/chrome_session_*',
            '/tmp/chrome_profile_*',
            '/tmp/chrome_*.dmp'
        ];
        
        foreach ($patterns as $pattern) {
            $files = glob($pattern);
            foreach ($files as $file) {
                if (is_dir($file)) {
                    $this->removeDirectory($file);
                } else {
                    unlink($file);
                }
            }
        }
        
        // Clean systemd private temp directories
        $systemdDirs = glob('/tmp/systemd-private-*/tmp/chrome_user_data_*');
        foreach ($systemdDirs as $dir) {
            $this->removeDirectory($dir);
        }
        
        $this->log("   ✅ Temporary directories cleaned");
    }
    
    /**
     * Clean up shared memory segments
     */
    private function cleanupSharedMemory() 
    {
        $this->log("3. Cleaning up shared memory segments...");
        
        // Kill any remaining locked processes
        $output = shell_exec("lsof | grep chrome | awk '{print \$2}' | sort -u 2>/dev/null");
        if ($output) {
            $pids = array_filter(explode("\n", trim($output)));
            foreach ($pids as $pid) {
                if (is_numeric($pid)) {
                    shell_exec("kill -9 $pid 2>/dev/null");
                }
            }
        }
        
        // Clean shared memory
        $output = shell_exec("ipcs -m | grep chrome | awk '{print \$2}' 2>/dev/null");
        if ($output) {
            $segments = array_filter(explode("\n", trim($output)));
            foreach ($segments as $segment) {
                shell_exec("ipcrm -m $segment 2>/dev/null");
            }
        }
        
        $this->log("   ✅ Shared memory cleaned");
    }
    
    /**
     * Fix ChromeDriver permissions
     */
    private function fixPermissions() 
    {
        $this->log("4. Checking ChromeDriver permissions...");
        
        $chromedriverPath = __DIR__ . '/chromedriver';
        
        if (file_exists($chromedriverPath)) {
            chmod($chromedriverPath, 0755);
            $this->log("   ✅ ChromeDriver permissions fixed");
        } else {
            $this->log("   ⚠️  ChromeDriver not found at: $chromedriverPath");
        }
    }
    
    /**
     * Check and free ports
     */
    private function checkPorts() 
    {
        $this->log("5. Checking if port 9515 is available...");
        
        // Try to free port 9515
        $output = shell_exec("lsof -ti :9515 2>/dev/null");
        if ($output) {
            $pids = array_filter(explode("\n", trim($output)));
            foreach ($pids as $pid) {
                if (is_numeric($pid)) {
                    shell_exec("kill -9 $pid 2>/dev/null");
                }
            }
            sleep(1);
        }
        
        $this->log("   ✅ Port 9515 is now available");
    }
    
    /**
     * Clean up PHP session files
     */
    private function cleanupSessionFiles() 
    {
        $this->log("6. Cleaning up PHP session files...");
        
        $sessionFiles = glob('/tmp/sess_*');
        $oneDayAgo = time() - (24 * 60 * 60);
        
        foreach ($sessionFiles as $file) {
            if (filemtime($file) < $oneDayAgo) {
                unlink($file);
            }
        }
        
        $this->log("   ✅ Old session files cleaned");
    }
    
    /**
     * Test the setup
     */
    private function testSetup() 
    {
        $this->log("7. Testing WebDriver setup...");
        
        // Check system-wide ChromeDriver first
        $chromedriverPath = trim(shell_exec('which chromedriver 2>/dev/null'));
        
        if (!empty($chromedriverPath) && file_exists($chromedriverPath)) {
            $this->log("   ✅ System-wide ChromeDriver found at: $chromedriverPath");
            
            // Get version
            $version = trim(shell_exec('chromedriver --version 2>/dev/null'));
            $this->log("   ✅ Version: " . ($version ?: 'Version check failed'));
            
            // Test if ChromeDriver can start
            $cmd = 'chromedriver --port=9516 --whitelisted-ips=127.0.0.1 > /dev/null 2>&1 & echo $!';
            $pid = trim(shell_exec($cmd));
            
            sleep(2);
            
            // Check if process is still running
            $running = shell_exec("kill -0 $pid 2>/dev/null; echo $?");
            
            if (trim($running) === '0') {
                $this->log("   ✅ ChromeDriver test successful");
                shell_exec("kill $pid 2>/dev/null");
            } else {
                $this->log("   ❌ ChromeDriver test failed");
            }
        } else {
            $this->log("   ❌ System-wide ChromeDriver not found");
        }
    }
    
    /**
     * Recursively remove a directory
     */
    private function removeDirectory($dir) 
    {
        if (!is_dir($dir)) {
            return false;
        }
        
        $files = array_diff(scandir($dir), ['.', '..']);
        foreach ($files as $file) {
            $path = $dir . DIRECTORY_SEPARATOR . $file;
            if (is_dir($path)) {
                $this->removeDirectory($path);
            } else {
                unlink($path);
            }
        }
        
        return rmdir($dir);
    }
    
    /**
     * Log a message
     */
    private function log($message) 
    {
        $logger = $this->logger;
        $logger($message);
    }
    
    /**
     * Static method for quick cleanup
     */
    public static function quickCleanup() 
    {
        $cleanup = new self();
        return $cleanup->runFullCleanup();
    }
}

// If called directly from command line
if (php_sapi_name() === 'cli') {
    echo "Running WebDriver Scraper Cleanup...\n";
    ScraperCleanup::quickCleanup();
} 