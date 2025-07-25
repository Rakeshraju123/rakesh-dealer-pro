<?php
require_once 'base-path.php';

// Include multi-tenant authentication middleware
require_once '/var/www/dealer/includes/AuthMiddleware.php';
require_once '/var/www/dealer/includes/TenantManager.php';

// Start session if not already started
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Require authentication - redirect to login if not authenticated
AuthMiddleware::requireAuth($base_path . 'login.php');

// Get current dealer info
$currentDealer = AuthMiddleware::getCurrentDealer();
$dealer_id = $currentDealer['dealer_id'];

// Get dealer details from tenant database
$dealerDetails = AuthMiddleware::getDealerDetails($dealer_id);

// Get current tenant info
$currentTenant = TenantManager::getCurrentTenant();

// Get the current path
$request_uri = $_SERVER['REQUEST_URI'];
$path = str_replace($base_path, '', $request_uri);

// Remove trailing slashes and query parameters
$path = rtrim($path, '/');
$path = preg_replace('/\?.*$/', '', $path);

?>
<!DOCTYPE html>
<html lang="en">

<head>
    <script>
        window.baseKeyword = "<?php echo $base_path; ?>";
        window.DealerID = <?php echo $dealer_id; ?>;
        window.TenantInfo = <?php echo json_encode($currentTenant); ?>;
        window.DealerInfo = <?php echo json_encode($dealerDetails); ?>;
        
        // Debug logging
        console.log('Dealer page loaded');
        console.log('Base path:', window.baseKeyword);
        console.log('Dealer ID:', window.DealerID);
        console.log('Tenant Info:', window.TenantInfo);
        console.log('Dealer Info:', window.DealerInfo);
        console.log('Current URL:', window.location.href);
        console.log('Referrer:', document.referrer);
    </script>
    <!-- Meta -->
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Dealer Dashboard - <?php echo htmlspecialchars($currentTenant['formatted_name'] ?? 'Cipher CRM'); ?></title>
    <link rel="icon" href="favicon.png" />

    <!-- Google Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="crossorigin" />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />

    <!-- Assets - Updated paths to match current structure -->
    <link rel="stylesheet" href="<?php echo $base_path; ?>assets/main.css?r=2">
    <link rel="stylesheet" href="<?php echo $base_path; ?>styles/dealer-details.css?r=2">
    <link rel="stylesheet" href="<?php echo $base_path; ?>styles/inventory.css?r=2">
    <link rel="stylesheet" href="<?php echo $base_path; ?>styles/transactions.css?r=2">
    <link rel="stylesheet" href="<?php echo $base_path; ?>styles/invoices.css?r=2">
    <link rel="stylesheet" href="<?php echo $base_path; ?>styles/sales.css?r=2">
    <link rel="stylesheet" href="<?php echo $base_path; ?>styles/quotes.css?r=2">
    <link rel="stylesheet" href="<?php echo $base_path; ?>styles/customers.css?r=2">
    <link rel="stylesheet" href="<?php echo $base_path; ?>styles/parts-services.css?r=2">
    <link rel="stylesheet" href="<?php echo $base_path; ?>styles/reports.css?r=2">
    <link rel="stylesheet" href="<?php echo $base_path; ?>Scraper/index.css?r=2">
    <link rel="stylesheet" href="<?php echo $base_path; ?>Scraper/app/css/scraper.css?r=2">
    
    <!-- DHTMLX Scheduler CSS -->
    <link rel="stylesheet" href="https://cdn.dhtmlx.com/scheduler/7.1/dhtmlxscheduler.css">

    <!-- HERE Maps CSS -->
    <link rel="stylesheet" type="text/css" href="https://js.api.here.com/v3/3.1/mapsjs-ui.css" />
    
    <!-- Flatpickr CSS -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css">

    <!-- jQuery -->
    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>

    <!-- jQuery UI CSS -->
    <link rel="stylesheet" href="https://code.jquery.com/ui/1.13.2/themes/base/jquery-ui.css">
    <!-- jQuery UI JS -->
    <script src="https://code.jquery.com/ui/1.13.2/jquery-ui.min.js"></script>

    <!-- Twilio Voice SDK -->
    <script src="https://cdn.jsdelivr.net/npm/@twilio/voice-sdk@2.0.1/dist/twilio.min.js"></script>
</head>

<body>
    <!-- Navbar -->
    <nav id="navbar" class="navbar">
        <div class="navbar__logo">
            <div class="navbar__logo__image"></div>
            <div class="navbar__logo__text-container">
                <span class="navbar__logo__text">Dealer</span>
                <span class="navbar__logo__text navbar__logo__text--secondary">PRO</span>
            </div>
        </div>

        <ul>
            <li>
                <a class="navbar__button navbar__button--active" data-route="">
                    <div class="navbar__button__icon icon icon--dashboard"></div>
                    <div class="navbar__button__label">Overview</div>
                </a>
            </li>

            <li>
                <a class="navbar__button" data-route="inventory">
                    <div class="navbar__button__icon icon icon--contract"></div>
                    <div class="navbar__button__label">Inventory</div>
                </a>
            </li>

            <li>
                <a class="navbar__button" data-route="sales">
                    <div class="navbar__button__icon icon icon--payment"></div>
                    <div class="navbar__button__label">Sales</div>
                </a>
            </li>

            <li>
                <a class="navbar__button" data-route="quotes">
                    <div class="navbar__button__icon icon icon--reports"></div>
                    <div class="navbar__button__label">Quotes</div>
                </a>
            </li>

            <li>
                <a class="navbar__button" data-route="customers">
                    <div class="navbar__button__icon icon icon--ai-communications"></div>
                    <div class="navbar__button__label">Customers</div>
                </a>
            </li>

            <li>
                <a class="navbar__button" data-route="parts-services">
                    <div class="navbar__button__icon icon icon--repossession"></div>
                    <div class="navbar__button__label">Parts/Services</div>
                </a>
            </li>

            <li>
                <a class="navbar__button" data-route="transactions">
                    <div class="navbar__button__icon icon icon--card-filled"></div>
                    <div class="navbar__button__label">Transactions</div>
                </a>
            </li>

            <li>
                <a class="navbar__button" data-route="invoices">
                    <div class="navbar__button__icon icon icon--payment-fill"></div>
                    <div class="navbar__button__label">Invoices</div>
                </a>
            </li>

            <li>
                <a class="navbar__button" data-route="reports">
                    <div class="navbar__button__icon icon icon--chart-bar"></div>
                    <div class="navbar__button__label">Reports</div>
                </a>
            </li>

            <li>
                <a class="navbar__button" data-route="scraper">
                    <div class="navbar__button__icon icon icon--search"></div>
                    <div class="navbar__button__label">Ad Magic</div>
                </a>
            </li>

            <li>
                <a class="navbar__button" data-route="calendar">
                    <div class="navbar__button__icon">
                        <svg class="sidebar-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="16" y1="2" x2="16" y2="6"></line>
                            <line x1="8" y1="2" x2="8" y2="6"></line>
                            <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                    </div>
                    <div class="navbar__button__label">Calendar</div>
                </a>
            </li>

            <li class="spacer"></li>

            <!-- Dealer Info Section
            <li>
                <div class="dealer-info-section">
                    <div class="dealer-avatar">
                        <span><?php echo strtoupper(substr($dealerDetails['name'] ?? 'D', 0, 1)); ?></span>
                    </div>
                    <div class="dealer-details">
                        <div class="dealer-name"><?php echo htmlspecialchars($dealerDetails['name'] ?? 'Dealer'); ?></div>
                        <div class="dealer-email"><?php echo htmlspecialchars($currentDealer['email'] ?? ''); ?></div>
                        <div class="tenant-name"><?php echo htmlspecialchars($currentTenant['formatted_name'] ?? ''); ?></div>
                    </div>
                </div>
            </li> -->

            <li>
                <a class="navbar__button" href="<?php echo $base_path; ?>logout.php" onclick="return confirm('Are you sure you want to logout?')">
                    <div class="navbar__button__icon icon icon--log-out"></div>
                    <div class="navbar__button__label">Logout</div>
                </a>
            </li>
        </ul>
    </nav>

    <!-- Main Content -->
    <main>
        <!-- Content will be loaded dynamically here -->
    </main>

    <!-- Scripts - Updated paths to match current structure -->
    <script src="https://cdn.jsdelivr.net/npm/chart.js@3.7.1/dist/chart.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/flatpickr"></script>
    
    <!-- Updated JavaScript paths -->
    <script src="<?php echo $base_path; ?>js/dashboard.js?r=<?php echo time(); ?>"></script>
    <script src="<?php echo $base_path; ?>js/inventory.js?r=<?php echo time(); ?>"></script>
    <script src="<?php echo $base_path; ?>js/transactions.js?r=<?php echo time(); ?>"></script>
    <script src="<?php echo $base_path; ?>js/invoices.js?r=<?php echo time(); ?>"></script>
    <script src="<?php echo $base_path; ?>js/sales.js?r=<?php echo time(); ?>"></script>
    <script src="<?php echo $base_path; ?>js/quotes.js?r=<?php echo time(); ?>"></script>
    <script src="<?php echo $base_path; ?>js/customers.js?r=<?php echo time(); ?>"></script>
    <script src="<?php echo $base_path; ?>js/parts-services.js?r=<?php echo time(); ?>"></script>
    <script src="<?php echo $base_path; ?>js/reports.js?r=<?php echo time(); ?>"></script>
    <script src="<?php echo $base_path; ?>Scraper/app/src/index.js?r=<?php echo time(); ?>"></script>
    <script src="<?php echo $base_path; ?>Scraper/app/src/city-proxy-selector.js?r=<?php echo time(); ?>"></script>
    <script src="<?php echo $base_path; ?>js/router.js?r=<?php echo time(); ?>"></script>
    
    <!-- DHTMLX Scheduler JS -->
    <script src="https://cdn.dhtmlx.com/scheduler/7.1/dhtmlxscheduler.js"></script>
    <script src="<?php echo $base_path; ?>js/calendar.js?r=<?php echo time(); ?>"></script>
    
    <!-- Bootstrap JS for modals -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js"></script>

    <style>
        .dealer-info-section {
            display: flex;
            align-items: center;
            padding: 15px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            margin: 10px 0;
        }
        
        .dealer-avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: 600;
            margin-right: 12px;
        }
        
        .dealer-details {
            flex: 1;
        }
        
        .dealer-name {
            font-weight: 600;
            color: white;
            font-size: 14px;
            margin-bottom: 2px;
        }
        
        .dealer-email {
            font-size: 12px;
            color: rgba(255, 255, 255, 0.8);
            margin-bottom: 2px;
        }
        
        .tenant-name {
            font-size: 11px;
            color: rgba(255, 255, 255, 0.6);
        }
        
        .error-message {
            padding: 40px;
            text-align: center;
            color: #666;
        }
        
        .error-message h2 {
            color: #e74c3c;
            margin-bottom: 20px;
        }
    </style>

</body> 

</html>
