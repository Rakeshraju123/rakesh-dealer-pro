<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require_once 'base-path.php';

session_start();
$error = '';
$logout_success = '';

// Check if user was logged out
if (isset($_GET['logout']) && $_GET['logout'] == '1') {
    $logout_success = 'You have been successfully logged out.';
    error_log("Logout success message set");
}

// Debug: Log session data on login page
error_log("Login page - Session data: " . json_encode($_SESSION));
error_log("Login page - dealer_id: " . ($_SESSION['dealer_id'] ?? 'not set'));
error_log("Login page - is_authenticated: " . ($_SESSION['is_authenticated'] ?? 'not set'));

// if dealer is already logged in, redirect to dealer.php
if (isset($_SESSION['dealer_id']) && isset($_SESSION['is_authenticated'])) {
    error_log("User appears to be already logged in - redirecting to dealer.php");
    header('Location: dealer.php');
    exit;
}

// Include multi-tenant database connection and authentication
require_once '/var/www/dealer/dbConnect1.php';
require_once '/var/www/dealer/includes/AuthMiddleware.php';
require_once '/var/www/dealer/includes/TenantManager.php';

// Process login form submission
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = $_POST['email'];
    $password = $_POST['password'];
    
    // Debug: Check domain detection
    $domain = $_SERVER['HTTP_HOST'] ?? '';
    error_log("Login attempt - Domain: $domain, Email: $email");
    
    // Debug: Check if domain is in mapping
    require_once '/var/www/dealer/config/database1.php';
    $domainMapping = DatabaseConfig::DOMAIN_MAPPING[$domain] ?? null;
    error_log("Domain mapping result: " . json_encode($domainMapping));
    
    // Continue with authentication...
    $authResult = AuthMiddleware::authenticateDealer($email, $password);
    
    if ($authResult['success']) {
        // Login successful - redirect to dealer.php
        header('Location: dealer.php');
        exit;
    } else {
        // Login failed
        $error = $authResult['message'];
        error_log("Dealer login failed: " . $error . " for email: " . $email);
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dealer Login - Cipher CRM</title>
    <link rel="stylesheet" href="login.css">
    <!-- Google Sign In API -->
    <script src="https://accounts.google.com/gsi/client" async defer></script>
<script src="https://code.jquery.com/jquery-3.5.1.min.js"></script>
</head>
<body class="login-body">
    <div class="login-wrapper">
        <div class="welcome-section">
            <div class="welcome-content">
                <div class="welcome-logo">
                    <h1>Dealer Pro</h1>
                </div>
                <h2>Welcome to Dealer Portal</h2>
                <p>The complete solution for managing your dealer operations</p>
                <div class="welcome-features">
                    <div class="feature-item">
                        <div class="feature-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path fill="none" d="M0 0h24v24H0z"/><path d="M12 14v8H4a8 8 0 0 1 8-8zm0-1c-3.315 0-6-2.685-6-6s2.685-6 6-6 6 2.685 6 6-2.685 6-6 6zm9 4h1v5h-8v-5h1v-1a3 3 0 0 1 6 0v1zm-2 0v-1a1 1 0 0 0-2 0v1h2z" fill="rgba(39,185,205,1)"/></svg>
                        </div>
                        <div class="feature-text">
                            <h3>Secure Access</h3>
                            <p>Advanced security for dealer portal access</p>
                        </div>
                    </div>
                    <div class="feature-item">
                        <div class="feature-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path fill="none" d="M0 0h24v24H0z"/><path d="M21 8v12.993A1 1 0 0 1 20.007 22H3.993A.993.993 0 0 1 3 21.008V2.992C3 2.455 3.449 2 4.002 2h10.995L21 8zm-2 1h-5V4H5v16h14V9z" fill="rgba(39,185,205,1)"/></svg>
                        </div>
                        <div class="feature-text">
                            <h3>Inventory Management</h3>
                            <p>Track and manage your inventory efficiently</p>
                        </div>
                    </div>
                    <div class="feature-item">
                        <div class="feature-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path fill="none" d="M0 0h24v24H0z"/><path d="M14 14.252v2.09A6 6 0 0 0 6 22l-2-.001a8 8 0 0 1 10-7.748zM12 13c-3.315 0-6-2.685-6-6s2.685-6 6-6 6 2.685 6 6-2.685 6-6 6zm0-2c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm6 6v-3h2v3h3v2h-3v3h-2v-3h-3v-2h3z" fill="rgba(39,185,205,1)"/></svg>
                        </div>
                        <div class="feature-text">
                            <h3>Sales & Reports</h3>
                            <p>Comprehensive sales tracking and reporting</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="login-section">
            <div class="login-card">
                <div class="login-header">
                    <h2>Dealer Sign In</h2>
                    <p>Please enter your dealer credentials</p>
                </div>
                
                <form id="loginForm" class="login-form" method="POST" action="">
                    <div class="dealer-notice">
                        <div class="notice-icon">🏢</div>
                        <div class="notice-text">
                            <strong>Dealer Portal Access</strong>
                            <p>This portal is exclusively for authorized dealers</p>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="email">Dealer Email Address</label>
                        <input type="email" id="email" name="email" required value="<?php echo htmlspecialchars($_POST['email'] ?? ''); ?>">
                    </div>
                    
                    <div class="form-group">
                        <label for="password">Password</label>
                        <input type="password" id="password" name="password" required>
                    </div>
                    
                    <div class="form-group">
                        <label class="checkbox-label">
                            <input type="checkbox" id="remember" name="remember">
                            <span class="checkmark"></span>
                            Remember me
                        </label>
                    </div>
                    
                    <button type="submit" class="btn btn-primary btn-login">Sign In to Dealer Portal</button>
                    <button type="button" class="btn btn-secondary google-btn">
                          <img  alt="Google" width="20" height="20">
                          Sign in with Google
                    </button>
                    
                    <!-- Alert container for all messages -->
                    <div id="alert-container" class="alert-container" style="display: none;">
                        <div class="alert-content">
                            <span class="alert-message"></span>
                            <button type="button" class="alert-close" onclick="hideAlert()">&times;</button>
                        </div>
                    </div>
                    
                </form>
                
                <div class="login-footer">
                    <p>Need help? <a href="mailto:support@cipher.dev">Contact Dealer Support</a></p>
                </div>
            </div>
        </div>
    </div>
    
    <style>
        .dealer-notice {
            background: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 12px;
        }
        
        .notice-icon {
            font-size: 24px;
            flex-shrink: 0;
        }
        
        .notice-text strong {
            display: block;
            color: #333;
            font-size: 14px;
            margin-bottom: 4px;
        }
        
        .notice-text p {
            margin: 0;
            font-size: 12px;
            color: #666;
        }
    </style>
    
    <script>
        // Alert System Functions
        // Usage Examples:
        // showSuccess('Login successful!');
        // showError('Invalid credentials');
        // showWarning('Session will expire soon');
        // showInfo('Please verify your email');
        // showAlert('Custom message', 'success', 3000);
        
        function showAlert(message, type = 'info', duration = 5000) {
            const alertContainer = document.getElementById('alert-container');
            const alertMessage = alertContainer.querySelector('.alert-message');
            
            // Clear previous alert classes
            alertContainer.className = 'alert-container';
            
            // Add new alert type class
            alertContainer.classList.add('alert-' + type);
            
            // Set message and show
            alertMessage.innerHTML = message;
            alertContainer.style.display = 'block';
            
            // Auto hide after duration (if duration > 0)
            if (duration > 0) {
                setTimeout(() => {
                    hideAlert();
                }, duration);
            }
        }
        
        function hideAlert() {
            const alertContainer = document.getElementById('alert-container');
            alertContainer.style.display = 'none';
        }
        
        // Shorthand functions for different alert types
        function showSuccess(message, duration = 3000) {
            showAlert(message, 'success', duration);
        }
        
        function showError(message, duration = 5000) {
            showAlert(message, 'error', duration);
        }
        
        function showWarning(message, duration = 4000) {
            showAlert(message, 'warning', duration);
        }
        
        function showInfo(message, duration = 4000) {
            showAlert(message, 'info', duration);
        }

        document.addEventListener('DOMContentLoaded', function() {
            // Show PHP error if exists
            <?php if ($error): ?>
            showError('<?php echo addslashes($error); ?>');
            <?php endif; ?>
            
            // Show logout success message if exists
            <?php if ($logout_success): ?>
            showSuccess('<?php echo addslashes($logout_success); ?>');
            <?php endif; ?>
            
            // Form validation
            const loginForm = document.getElementById('loginForm');
            
            loginForm.addEventListener('submit', function(e) {
                const email = document.getElementById('email').value;
                const password = document.getElementById('password').value;
                
                if (!email || !password) {
                    e.preventDefault();
                    showError('Please fill in all required fields');
                }
            });
        });

        window.onload = function() {
            google.accounts.id.initialize({
                client_id: '765912127734-shi749fmjbdvni0e3d1kcrh29fseb06t.apps.googleusercontent.com',
                callback: handleGoogleSignIn,
                // Request additional scopes for email, profile, and openid
                scope: 'openid email profile',
                // Enable automatic sign-in
                auto_select: false,
                // Cancel on tap outside
                cancel_on_tap_outside: true
            });

            // Attach click handler to custom button
            document.querySelector('.google-btn').addEventListener('click', () => {
                google.accounts.id.prompt();
            });
        };

        function handleGoogleSignIn(response) {
            console.log('Google Sign-In Response:', response);
            
            // Show loading state
            $('.google-btn').prop('disabled', true);
            $('.google-btn').html('<span class="spinner-border spinner-border-sm mr-2"></span>Signing in...');

            // Send the credential to your backend
            $.ajax({
                type: "POST",
                url: "./api/google_signin.php",
                data: { 
                    credential: response.credential,
                    // Include client ID for verification
                    client_id: '765912127734-shi749fmjbdvni0e3d1kcrh29fseb06t.apps.googleusercontent.com'
                },
                dataType: "json",
                success: function(result) {
                    console.log('Backend Response:', result);
                    
                    if(result.status) {
                        // Log the user data received from Google
                        if(result.user_data) {
                            console.log('User Data from Google:', {
                                email: result.user_data.email,
                                name: result.user_data.name,
                                given_name: result.user_data.given_name,
                                family_name: result.user_data.family_name,
                                picture: result.user_data.picture,
                                google_id: result.user_data.google_id
                            });
                        }
                        
                        // Show success message
                        showSuccess(`<strong>Success!</strong> ${result.message}`, 2000);
                        
                        // Redirect after a short delay
                        setTimeout(function() {
                            window.location.href = result.url;
                        }, 1500);
                    } else {
                        showError(`<strong>Error!</strong> ${result.message}`);
                        resetGoogleButton();
                    }
                },
                error: function(xhr, status, error) {
                    console.error('Google Sign-In Error:', {
                        status: status,
                        error: error,
                        response: xhr.responseText
                    });
                    
                    let errorMessage = 'Authentication failed. Please try again.';
                    
                    // Try to parse error response
                    try {
                        const errorData = JSON.parse(xhr.responseText);
                        if(errorData.message) {
                            errorMessage = errorData.message;
                        }
                    } catch(e) {
                        // Use default error message
                    }
                    
                    showError(`<strong>Error!</strong> ${errorMessage}`);
                    resetGoogleButton();
                }
            });
        }

        function resetGoogleButton() {
            $('.google-btn').prop('disabled', false);
            $('.google-btn').html('<img  alt="Google" width="20" height="20">Sign in with Google');
        }
    </script>
</body>
</html> 
