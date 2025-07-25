<?php
// logout.php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require_once 'base-path.php';

// Start session if not already started
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Debug: Log current session data before logout
error_log("Logout attempt - Current session data: " . json_encode($_SESSION));

try {
    // Try to include AuthMiddleware but don't fail if it doesn't work
    if (file_exists('/var/www/dealer/includes/AuthMiddleware.php')) {
        require_once '/var/www/dealer/includes/AuthMiddleware.php';
        
        // Try to use AuthMiddleware logout
        if (class_exists('AuthMiddleware') && method_exists('AuthMiddleware', 'logout')) {
            AuthMiddleware::logout();
            error_log("AuthMiddleware logout called successfully");
        } else {
            error_log("AuthMiddleware logout method not found");
        }
    } else {
        error_log("AuthMiddleware file not found");
    }
    
} catch (Exception $e) {
    error_log("AuthMiddleware logout error: " . $e->getMessage());
}

// Manual session cleanup (always do this regardless of AuthMiddleware)
$_SESSION = array();

// Clear session cookie
if (isset($_COOKIE[session_name()])) {
    setcookie(session_name(), '', time() - 3600, '/');
    error_log("Session cookie cleared");
}

// Destroy session
session_destroy();
error_log("Session destroyed manually");

// Start a new clean session
session_start();
session_regenerate_id(true);
error_log("New session started with ID: " . session_id());

// Debug: Log after logout
error_log("Logout completed - New session data: " . json_encode($_SESSION));

// Clear browser cache
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');

// Add JavaScript to show logout is working
echo '<script>
console.log("Logout process completed successfully");
console.log("Session cleared and redirecting to login page");
</script>';

// Redirect to login page
$redirect_url = $base_path . 'login.php?logout=1&t=' . time();
error_log("Redirecting to: " . $redirect_url);

header('Location: ' . $redirect_url);
exit();
?>