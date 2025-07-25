<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE');
header('Access-Control-Allow-Headers: Content-Type');

// Include multi-tenant database connection and authentication
require_once '/var/www/dealer/dbConnect1.php';
require_once '/var/www/dealer/includes/AuthMiddleware.php';
require_once '/var/www/dealer/includes/TenantManager.php';
require_once '/var/www/dealer/config/database1.php';

// Start session if not already started
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Get the request method and action
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
$dealer_id = $_GET['dealer_id'] ?? '';

// Check if dealer is authenticated
if (!isset($_SESSION['dealer_id']) && !$dealer_id) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

$dealer_id = $dealer_id ?: $_SESSION['dealer_id'];

// Get current tenant and establish MySQLi connections
try {
    $currentTenant = TenantManager::getCurrentTenant();
    if (!$currentTenant) {
        throw new Exception("No tenant context found");
    }
    
    $schemaName = $currentTenant['schema_name'];
    
    // Create MySQLi connections for the tenant database
    $conn = new mysqli(
        DatabaseConfig::TENANT_DB_HOST,
        DatabaseConfig::TENANT_DB_USER,
        DatabaseConfig::TENANT_DB_PASS,
        $schemaName
    );
    
    $conn_write = new mysqli(
        DatabaseConfig::TENANT_DB_HOST,
        DatabaseConfig::TENANT_DB_USER,
        DatabaseConfig::TENANT_DB_PASS,
        $schemaName
    );
    
    // Check connections
    if ($conn->connect_error) {
        throw new Exception("Read connection failed: " . $conn->connect_error);
    }
    
    if ($conn_write->connect_error) {
        throw new Exception("Write connection failed: " . $conn_write->connect_error);
    }
    
    // Set charset
    $conn->set_charset("utf8mb4");
    $conn_write->set_charset("utf8mb4");
    
} catch (Exception $e) {
    error_log("Database connection error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed', 'message' => $e->getMessage()]);
    exit;
}

try {
    switch ($method) {
        case 'GET':
            handleGetRequest($action, $dealer_id);
            break;
        case 'POST':
            handlePostRequest($action, $dealer_id);
            break;
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
            break;
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Internal server error', 'message' => $e->getMessage()]);
}

function handleGetRequest($action, $dealer_id) {
    global $conn, $conn_write;
    
    switch ($action) {
        case 'dealer_info':
            getDealerInfo($dealer_id);
            break;
        case 'quick_stats':
            getQuickStats($dealer_id);
            break;
        case 'inventory_overview':
            getInventoryOverview($dealer_id);
            break;
        case 'recent_transactions':
            getRecentTransactions($dealer_id);
            break;
        case 'recent_sales':
            getRecentSales($dealer_id);
            break;
        case 'inventory_alerts':
            getInventoryAlerts($dealer_id);
            break;
        case 'monthly_profits':
            getMonthlyProfits($dealer_id);
            break;
        default:
            http_response_code(400);
            echo json_encode(['error' => 'Invalid action']);
            break;
    }
}

function handlePostRequest($action, $dealer_id) {
    global $conn, $conn_write;
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    switch ($action) {
        case 'add_customer':
            addCustomer($dealer_id, $input);
            break;
        case 'add_inventory':
            addInventory($dealer_id, $input);
            break;
        case 'create_quote':
            createQuote($dealer_id, $input);
            break;
        default:
            http_response_code(400);
            echo json_encode(['error' => 'Invalid action']);
            break;
    }
}

function getDealerInfo($dealer_id) {
    global $conn, $conn_write;
    
    try {
        // Get real dealer info with calculated stats
        $sql = "SELECT 
                    d.dealer_id as id,
                    d.dealer_name as name,
                    d.email,
                    d.phone,
                    d.address,
                    d.city,
                    d.state,
                    d.zip_code,
                    d.region,
                    d.created_at as memberSince,
                    'active' as status,
                    COUNT(DISTINCT di.inventory_id) as totalInventory,
                    COUNT(DISTINCT ds.sale_id) as totalSales,
                    COALESCE(SUM(ds.total_amount), 0) as totalRevenue,
                    COUNT(DISTINCT dc.customer_id) as totalCustomers
                FROM dealers d
                LEFT JOIN dealer_inventory di ON d.dealer_id = di.dealer_id
                LEFT JOIN dealer_sales ds ON d.dealer_id = ds.dealer_id
                LEFT JOIN dealer_customers dc ON d.dealer_id = dc.dealer_id
                WHERE d.dealer_id = ?
                GROUP BY d.dealer_id";
        
        $stmt = $conn->prepare($sql);
        $stmt->bind_param('i', $dealer_id);
        $stmt->execute();
        $result = $stmt->get_result();
        
        if ($dealer = $result->fetch_assoc()) {
            echo json_encode(['success' => true, 'data' => $dealer]);
        } else {
            // Fallback to basic info if joins fail
            $basic_sql = "SELECT dealer_id as id, dealer_name as name, email, phone, address, city, state, zip_code, region, created_at as memberSince, 'active' as status FROM dealers WHERE dealer_id = ?";
            $basic_stmt = $conn->prepare($basic_sql);
            $basic_stmt->bind_param('i', $dealer_id);
            $basic_stmt->execute();
            $basic_result = $basic_stmt->get_result();
            
            if ($basic_dealer = $basic_result->fetch_assoc()) {
                $basic_dealer['totalInventory'] = 0;
                $basic_dealer['totalSales'] = 0;
                $basic_dealer['totalRevenue'] = 0;
                $basic_dealer['totalCustomers'] = 0;
                echo json_encode(['success' => true, 'data' => $basic_dealer]);
            } else {
                http_response_code(404);
                echo json_encode(['error' => 'Dealer not found']);
            }
        }
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch dealer info', 'message' => $e->getMessage()]);
    }
}

function getQuickStats($dealer_id) {
    global $conn, $conn_write;
    
    try {
        // Get real inventory stats with proper status handling
        $inventory_sql = "SELECT 
                            COUNT(CASE WHEN status IN ('available', 'in_stock') THEN 1 END) as inStockInventory,
                            COUNT(CASE WHEN status = 'pending' THEN 1 END) as pendingInventory
                          FROM dealer_inventory 
                          WHERE dealer_id = ?";
        
        $inventory_stmt = $conn->prepare($inventory_sql);
        $inventory_stmt->bind_param('i', $dealer_id);
        $inventory_stmt->execute();
        $inventory_result = $inventory_stmt->get_result();
        $inventory_data = $inventory_result->fetch_assoc();
        
        // Get real sales stats for current year
        $current_year = date('Y');
        $sales_sql = "SELECT 
                        COUNT(*) as count,
                        COALESCE(SUM(total_amount), 0) as amount
                      FROM dealer_sales 
                      WHERE dealer_id = ? AND YEAR(sale_date) = ?";
        
        $sales_stmt = $conn->prepare($sales_sql);
        $sales_stmt->bind_param('ii', $dealer_id, $current_year);
        $sales_stmt->execute();
        $sales_result = $sales_stmt->get_result();
        $sales_data = $sales_result->fetch_assoc();
        
        $stats = [
            'inStockInventory' => (int)$inventory_data['inStockInventory'],
            'pendingInventory' => (int)$inventory_data['pendingInventory'],
            'totalSalesYear' => [
                'count' => (int)$sales_data['count'],
                'amount' => (float)$sales_data['amount']
            ]
        ];
        
        echo json_encode(['success' => true, 'data' => $stats]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch quick stats', 'message' => $e->getMessage()]);
    }
}

function getInventoryOverview($dealer_id) {
    global $conn, $conn_write;
    
    try {
        // Get real inventory overview with proper calculations
        $sql = "SELECT 
                    COUNT(*) as totalInventory,
                    COUNT(CASE WHEN status IN ('available', 'in_stock') THEN 1 END) as availableInventory,
                    COALESCE(SUM(CASE WHEN status IN ('available', 'in_stock', 'pending') THEN selling_price ELSE 0 END), 0) as inventoryValue
                FROM dealer_inventory 
                WHERE dealer_id = ?";
        
        $stmt = $conn->prepare($sql);
        $stmt->bind_param('i', $dealer_id);
        $stmt->execute();
        $result = $stmt->get_result();
        $inventory_data = $result->fetch_assoc();
        
        // Get current month profit from sales (profit = selling_price - cost_price)
        $current_month = date('Y-m');
        $profit_sql = "SELECT 
                        COALESCE(SUM(
                            CASE 
                                WHEN di.cost_price IS NOT NULL AND di.selling_price IS NOT NULL 
                                THEN (di.selling_price - di.cost_price)
                                ELSE ds.total_amount * 0.25
                            END
                        ), 0) as monthProfit
                       FROM dealer_sales ds
                       LEFT JOIN dealer_inventory di ON ds.item_product LIKE CONCAT('%', di.manufacturer, '%', di.model, '%')
                       WHERE ds.dealer_id = ? 
                       AND DATE_FORMAT(ds.sale_date, '%Y-%m') = ?
                       AND ds.status = 'completed'";
        
        $profit_stmt = $conn->prepare($profit_sql);
        $profit_stmt->bind_param('is', $dealer_id, $current_month);
        $profit_stmt->execute();
        $profit_result = $profit_stmt->get_result();
        $profit_data = $profit_result->fetch_assoc();
        
        $inventory = [
            'totalInventory' => (int)$inventory_data['totalInventory'],
            'availableInventory' => (int)$inventory_data['availableInventory'],
            'inventoryValue' => (float)$inventory_data['inventoryValue'],
            'monthRevenue' => (float)$profit_data['monthProfit'] // This is actually monthly profit
        ];
        
        echo json_encode(['success' => true, 'data' => $inventory]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch inventory overview', 'message' => $e->getMessage()]);
    }
}

function getRecentTransactions($dealer_id) {
    global $conn, $conn_write;
    
    try {
        // Get recent sales as transactions
        $sql = "SELECT 
                    CONCAT('S', sale_id) as id,
                    customer_name as customer,
                    sale_date as date,
                    total_amount as amount,
                    0 as fee,
                    'Sale' as type,
                    status
                FROM dealer_sales 
                WHERE dealer_id = ? 
                ORDER BY created_at DESC 
                LIMIT 10";
        
        $stmt = $conn->prepare($sql);
        $stmt->bind_param('i', $dealer_id);
        $stmt->execute();
        $result = $stmt->get_result();
        
        $transactions = [];
        while ($row = $result->fetch_assoc()) {
            $transactions[] = $row;
        }
        
        echo json_encode(['success' => true, 'data' => $transactions]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch recent transactions', 'message' => $e->getMessage()]);
    }
}

function getRecentSales($dealer_id) {
    global $conn, $conn_write;
    
    try {
        // Get recent sales
        $sql = "SELECT 
                    sale_id as id,
                    customer_name as customer,
                    sale_date as date,
                    total_amount as amount,
                    item_product as product,
                    status
                FROM dealer_sales 
                WHERE dealer_id = ? 
                ORDER BY created_at DESC 
                LIMIT 10";
        
        $stmt = $conn->prepare($sql);
        $stmt->bind_param('i', $dealer_id);
        $stmt->execute();
        $result = $stmt->get_result();
        
        $sales = [];
        while ($row = $result->fetch_assoc()) {
            $sales[] = $row;
        }
        
        echo json_encode(['success' => true, 'data' => $sales]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch recent sales', 'message' => $e->getMessage()]);
    }
}

function getInventoryAlerts($dealer_id) {
    global $conn, $conn_write;
    
    try {
        // Get low stock alerts (items with status issues or old inventory)
        $alerts = [];
        
        // Check for items that haven't been sold for a long time
        $old_inventory_sql = "SELECT COUNT(*) as count
                             FROM dealer_inventory 
                             WHERE dealer_id = ? 
                             AND status = 'available' 
                             AND date_added < DATE_SUB(NOW(), INTERVAL 6 MONTH)";
        
        $stmt = $conn->prepare($old_inventory_sql);
        $stmt->bind_param('i', $dealer_id);
        $stmt->execute();
        $result = $stmt->get_result();
        $old_count = $result->fetch_assoc()['count'];
        
        if ($old_count > 0) {
            $alerts[] = [
                'type' => 'old_inventory',
                'title' => 'Old Inventory Alert',
                'description' => "$old_count items have been in inventory for over 6 months",
                'severity' => 'warning',
                'created_at' => date('Y-m-d H:i:s')
            ];
        }
        
        echo json_encode(['success' => true, 'data' => $alerts]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch inventory alerts', 'message' => $e->getMessage()]);
    }
}

function addCustomer($dealer_id, $data) {
    global $conn, $conn_write;
    
    try {
        // Validate required fields
        $required_fields = ['name', 'email', 'phone'];
        foreach ($required_fields as $field) {
            if (!isset($data[$field]) || empty($data[$field])) {
                http_response_code(400);
                echo json_encode(['error' => "Missing required field: $field"]);
                return;
            }
        }
        
        // Check if customer already exists
        $check_sql = "SELECT customer_id FROM dealer_customers WHERE dealer_id = ? AND email = ?";
        $check_stmt = $conn->prepare($check_sql);
        $check_stmt->bind_param('is', $dealer_id, $data['email']);
        $check_stmt->execute();
        $result = $check_stmt->get_result();
        
        if ($result->fetch_assoc()) {
            http_response_code(409);
            echo json_encode(['error' => 'Customer with this email already exists']);
            return;
        }
        
        // Insert new customer
        $sql = "INSERT INTO dealer_customers (dealer_id, name, email, phone, address, city, state, zip, notes) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
        
        $address = $data['address'] ?? '';
        $city = $data['city'] ?? '';
        $state = $data['state'] ?? '';
        $zip = $data['zip'] ?? '';
        $notes = $data['notes'] ?? '';
        
        $stmt = $conn_write->prepare($sql);
        $stmt->bind_param('issssssss', 
            $dealer_id,
            $data['name'],
            $data['email'],
            $data['phone'],
            $address,
            $city,
            $state,
            $zip,
            $notes
        );
        
        if ($stmt->execute()) {
            $customer_id = $conn_write->insert_id;
            echo json_encode([
                'success' => true,
                'message' => 'Customer added successfully',
                'data' => ['customer_id' => $customer_id]
            ]);
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to add customer: ' . $stmt->error]);
        }
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to add customer', 'message' => $e->getMessage()]);
    }
}

function addInventory($dealer_id, $data) {
    global $conn, $conn_write;
    
    try {
        // Validate required fields
        $required_fields = ['manufacturer', 'model', 'year', 'category', 'cost_price', 'selling_price'];
        foreach ($required_fields as $field) {
            if (!isset($data[$field]) || empty($data[$field])) {
                http_response_code(400);
                echo json_encode(['error' => "Missing required field: $field"]);
                return;
            }
        }
        
        // Validate numeric fields
        if (!is_numeric($data['cost_price']) || !is_numeric($data['selling_price'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Cost price and selling price must be numeric']);
            return;
        }
        
        // Insert new inventory item
        $sql = "INSERT INTO dealer_inventory (dealer_id, manufacturer, model, year, category, cost_price, selling_price, 
                                            description, color, condition_status, location, notes) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        
        $description = $data['description'] ?? '';
        $color = $data['color'] ?? '';
        $condition = $data['condition'] ?? 'good';
        $location = $data['location'] ?? '';
        $notes = $data['notes'] ?? '';
        
        $stmt = $conn_write->prepare($sql);
        $stmt->bind_param('issssddsssss', 
            $dealer_id,
            $data['manufacturer'],
            $data['model'],
            $data['year'],
            $data['category'],
            $data['cost_price'],
            $data['selling_price'],
            $description,
            $color,
            $condition,
            $location,
            $notes
        );
        
        if ($stmt->execute()) {
            $inventory_id = $conn_write->insert_id;
            echo json_encode([
                'success' => true,
                'message' => 'Inventory item added successfully',
                'data' => ['inventory_id' => $inventory_id]
            ]);
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to add inventory item: ' . $stmt->error]);
        }
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to add inventory item', 'message' => $e->getMessage()]);
    }
}

function createQuote($dealer_id, $data) {
    global $conn, $conn_write;
    
    try {
        // Validate required fields
        $required_fields = ['customer_name', 'customer_email', 'items'];
        foreach ($required_fields as $field) {
            if (!isset($data[$field]) || empty($data[$field])) {
                http_response_code(400);
                echo json_encode(['error' => "Missing required field: $field"]);
                return;
            }
        }
        
        // Validate items array
        if (!is_array($data['items']) || empty($data['items'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Items must be a non-empty array']);
            return;
        }
        
        // Calculate total amount
        $total_amount = 0;
        foreach ($data['items'] as $item) {
            if (!isset($item['quantity']) || !isset($item['price'])) {
                http_response_code(400);
                echo json_encode(['error' => 'Each item must have quantity and price']);
                return;
            }
            $total_amount += $item['quantity'] * $item['price'];
        }
        
        // Insert new quote
        $sql = "INSERT INTO dealer_quotes (dealer_id, customer_name, customer_email, customer_phone, 
                                         items, total_amount, status, notes, valid_until) 
                VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, DATE_ADD(NOW(), INTERVAL 30 DAY))";
        
        $customer_phone = $data['customer_phone'] ?? '';
        $notes = $data['notes'] ?? '';
        $items_json = json_encode($data['items']);
        
        $stmt = $conn_write->prepare($sql);
        $stmt->bind_param('issssds', 
            $dealer_id,
            $data['customer_name'],
            $data['customer_email'],
            $customer_phone,
            $items_json,
            $total_amount,
            $notes
        );
        
        if ($stmt->execute()) {
            $quote_id = $conn_write->insert_id;
            echo json_encode([
                'success' => true,
                'message' => 'Quote created successfully',
                'data' => ['quote_id' => $quote_id, 'total_amount' => $total_amount]
            ]);
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to create quote: ' . $stmt->error]);
        }
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to create quote', 'message' => $e->getMessage()]);
    }
}

function getMonthlyProfits($dealer_id) {
    global $conn, $conn_write;
    
    try {
        $current_year = date('Y');
        
        // Get monthly profit data for current year
        $sql = "SELECT 
                    MONTH(ds.sale_date) as month,
                    MONTHNAME(ds.sale_date) as month_name,
                    COALESCE(SUM(
                        CASE 
                            WHEN di.cost_price IS NOT NULL AND di.selling_price IS NOT NULL 
                            THEN (di.selling_price - di.cost_price)
                            ELSE ds.total_amount * 0.25
                        END
                    ), 0) as profit
                FROM dealer_sales ds
                LEFT JOIN dealer_inventory di ON ds.item_product LIKE CONCAT('%', di.manufacturer, '%', di.model, '%')
                WHERE ds.dealer_id = ? 
                AND YEAR(ds.sale_date) = ?
                AND ds.status = 'completed'
                GROUP BY MONTH(ds.sale_date), MONTHNAME(ds.sale_date)
                ORDER BY MONTH(ds.sale_date)";
        
        $stmt = $conn->prepare($sql);
        $stmt->bind_param('ii', $dealer_id, $current_year);
        $stmt->execute();
        $result = $stmt->get_result();
        
        // Initialize all months with 0 profit
        $months = [
            1 => 'January', 2 => 'February', 3 => 'March', 4 => 'April',
            5 => 'May', 6 => 'June', 7 => 'July', 8 => 'August',
            9 => 'September', 10 => 'October', 11 => 'November', 12 => 'December'
        ];
        
        $monthly_data = [];
        foreach ($months as $month_num => $month_name) {
            $monthly_data[] = [
                'month' => $month_num,
                'month_name' => $month_name,
                'profit' => 0
            ];
        }
        
        // Fill in actual data
        while ($row = $result->fetch_assoc()) {
            $month_index = (int)$row['month'] - 1; // Convert to 0-based index
            $monthly_data[$month_index]['profit'] = (float)$row['profit'];
        }
        
        echo json_encode(['success' => true, 'data' => $monthly_data]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch monthly profits', 'message' => $e->getMessage()]);
    }
}
?> 