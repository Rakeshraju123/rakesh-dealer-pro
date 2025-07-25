<?php
// ini_set('display_errors', 1);
// ini_set('display_startup_errors', 1);
// error_reporting(E_ALL);
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
        case 'PUT':
            handlePutRequest($action, $dealer_id);
            break;
        case 'DELETE':
            handleDeleteRequest($action, $dealer_id);
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
        case 'list':
            getCustomersList($dealer_id);
            break;
        case 'get':
            $customer_id = $_GET['id'] ?? '';
            getCustomer($dealer_id, $customer_id);
            break;
        case 'stats':
            getCustomersStats($dealer_id);
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
        case 'create':
            createCustomer($dealer_id, $input);
            break;
        default:
            http_response_code(400);
            echo json_encode(['error' => 'Invalid action']);
            break;
    }
}

function handlePutRequest($action, $dealer_id) {
    global $conn, $conn_write;
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid JSON in request body']);
        return;
    }
    
    switch ($action) {
        case 'update':
            $customer_id = $_GET['id'] ?? '';
            updateCustomer($dealer_id, $customer_id, $input);
            break;
        default:
            http_response_code(400);
            echo json_encode(['error' => 'Invalid action']);
            break;
    }
}

function handleDeleteRequest($action, $dealer_id) {
    global $conn, $conn_write;
    
    switch ($action) {
        case 'delete':
            $customer_id = $_GET['id'] ?? '';
            deleteCustomer($dealer_id, $customer_id);
            break;
        default:
            http_response_code(400);
            echo json_encode(['error' => 'Invalid action']);
            break;
    }
}

function getCustomersList($dealer_id) {
    global $conn, $conn_write;
    
    try {
        // Get pagination parameters
        $page = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 1;
        $pageSize = isset($_GET['pageSize']) ? max(1, min(100, (int)$_GET['pageSize'])) : 10;
        $offset = ($page - 1) * $pageSize;
        
        // Get search and filter parameters
        $search = isset($_GET['search']) ? trim($_GET['search']) : '';
        $status_filter = isset($_GET['status']) ? trim($_GET['status']) : '';
        $location_filter = isset($_GET['location']) ? trim($_GET['location']) : '';
        $purchases_filter = isset($_GET['purchases_range']) ? trim($_GET['purchases_range']) : '';
        
        // Build WHERE clause
        $where_conditions = ['dealer_id = ?'];
        $params = [$dealer_id];
        $param_types = 'i';
        
        if (!empty($search)) {
            $where_conditions[] = '(customer_name LIKE ? OR phone_number LIKE ? OR email LIKE ? OR location LIKE ?)';
            $search_param = "%{$search}%";
            $params[] = $search_param;
            $params[] = $search_param;
            $params[] = $search_param;
            $params[] = $search_param;
            $param_types .= 'ssss';
        }
        
        if (!empty($status_filter) && in_array($status_filter, ['active', 'inactive'])) {
            $where_conditions[] = 'status = ?';
            $params[] = $status_filter;
            $param_types .= 's';
        }
        
        if (!empty($location_filter)) {
            $where_conditions[] = 'location LIKE ?';
            $params[] = "%{$location_filter}%";
            $param_types .= 's';
        }
        
        if (!empty($purchases_filter)) {
            switch ($purchases_filter) {
                case '0':
                    $where_conditions[] = 'purchases_count = 0';
                    break;
                case '1-3':
                    $where_conditions[] = 'purchases_count BETWEEN 1 AND 3';
                    break;
                case '4-6':
                    $where_conditions[] = 'purchases_count BETWEEN 4 AND 6';
                    break;
                case '7+':
                    $where_conditions[] = 'purchases_count >= 7';
                    break;
            }
        }
        
        $where_clause = 'WHERE ' . implode(' AND ', $where_conditions);
        
        // Get total count
        $count_sql = "SELECT COUNT(*) as total FROM dealer_customers {$where_clause}";
        $count_stmt = $conn->prepare($count_sql);
        $count_stmt->bind_param($param_types, ...$params);
        $count_stmt->execute();
        $result = $count_stmt->get_result();
        $total_count = $result->fetch_assoc()['total'];
        
        // Get sort parameters
        $sort_field = isset($_GET['sort']) ? $_GET['sort'] : 'customer_name';
        $sort_direction = isset($_GET['direction']) && $_GET['direction'] === 'desc' ? 'DESC' : 'ASC';
        
        // Validate sort field
        $allowed_sort_fields = ['customer_name', 'phone_number', 'email', 'location', 'purchases_count', 'total_spent', 'last_purchase_date', 'status', 'created_at'];
        if (!in_array($sort_field, $allowed_sort_fields)) {
            $sort_field = 'customer_name';
        }
        
        // Get customers
        $sql = "SELECT customer_id, customer_name, phone_number, email, location, purchases_count, 
                       total_spent, last_purchase_date, status, notes, created_at, updated_at 
                FROM dealer_customers 
                {$where_clause} 
                ORDER BY {$sort_field} {$sort_direction} 
                LIMIT ? OFFSET ?";
        
        $params[] = $pageSize;
        $params[] = $offset;
        $param_types .= 'ii';
        
        $stmt = $conn->prepare($sql);
        $stmt->bind_param($param_types, ...$params);
        $stmt->execute();
        $result = $stmt->get_result();
        $customers = $result->fetch_all(MYSQLI_ASSOC);
        
        // Calculate pagination info
        $total_pages = ceil($total_count / $pageSize);
        
        echo json_encode([
            'success' => true,
            'data' => [
                'customers' => $customers,
                'pagination' => [
                    'current_page' => $page,
                    'page_size' => $pageSize,
                    'total_items' => $total_count,
                    'total_pages' => $total_pages,
                    'has_next' => $page < $total_pages,
                    'has_prev' => $page > 1
                ]
            ]
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch customers', 'message' => $e->getMessage()]);
    }
}

function getCustomer($dealer_id, $customer_id) {
    global $conn, $conn_write;
    
    try {
        if (empty($customer_id)) {
            http_response_code(400);
            echo json_encode(['error' => 'Customer ID is required']);
            return;
        }
        
        $sql = "SELECT * FROM dealer_customers WHERE dealer_id = ? AND customer_id = ?";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param('ii', $dealer_id, $customer_id);
        $stmt->execute();
        $result = $stmt->get_result();
        $customer = $result->fetch_assoc();
        
        if (!$customer) {
            http_response_code(404);
            echo json_encode(['error' => 'Customer not found']);
            return;
        }
        
        echo json_encode(['success' => true, 'data' => $customer]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch customer', 'message' => $e->getMessage()]);
    }
}

function getCustomersStats($dealer_id) {
    global $conn, $conn_write;
    
    try {
        $sql = "SELECT 
                    COUNT(*) as total_customers,
                    SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_customers,
                    SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) as inactive_customers,
                    SUM(purchases_count) as total_purchases,
                    SUM(total_spent) as total_spent,
                    AVG(total_spent) as avg_spent_per_customer,
                    AVG(purchases_count) as avg_purchases_per_customer,
                    SUM(CASE WHEN last_purchase_date >= DATE_SUB(NOW(), INTERVAL 6 MONTH) THEN 1 ELSE 0 END) as recent_customers
                FROM dealer_customers 
                WHERE dealer_id = ?";
        
        $stmt = $conn->prepare($sql);
        $stmt->bind_param('i', $dealer_id);
        $stmt->execute();
        $result = $stmt->get_result();
        $stats = $result->fetch_assoc();
        
        // Convert to appropriate data types
        $stats['total_customers'] = (int)$stats['total_customers'];
        $stats['active_customers'] = (int)$stats['active_customers'];
        $stats['inactive_customers'] = (int)$stats['inactive_customers'];
        $stats['total_purchases'] = (int)$stats['total_purchases'];
        $stats['total_spent'] = (float)$stats['total_spent'];
        $stats['avg_spent_per_customer'] = (float)$stats['avg_spent_per_customer'];
        $stats['avg_purchases_per_customer'] = (float)$stats['avg_purchases_per_customer'];
        $stats['recent_customers'] = (int)$stats['recent_customers'];
        
        echo json_encode(['success' => true, 'data' => $stats]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch stats', 'message' => $e->getMessage()]);
    }
}

function createCustomer($dealer_id, $data) {
    global $conn, $conn_write;
    
    try {
        // Debug: Log received data
        error_log("Received customer data: " . json_encode($data));
        error_log("Dealer ID: " . $dealer_id);
        
        // Validate required fields
        $required_fields = ['customer_name', 'phone_number', 'location'];
        $missing_fields = [];
        
        foreach ($required_fields as $field) {
            if (!isset($data[$field]) || trim($data[$field]) === '') {
                $missing_fields[] = $field;
            }
        }
        
        if (!empty($missing_fields)) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing required fields', 'fields' => $missing_fields]);
            return;
        }
        
        // Validate email format if provided
        if (!empty($data['email']) && !filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid email format']);
            return;
        }
        
        // Validate status if provided
        if (isset($data['status']) && !in_array($data['status'], ['active', 'inactive'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid status. Must be "active" or "inactive"']);
            return;
        }
        
        // Check for duplicate phone number for this dealer
        $check_sql = "SELECT customer_id FROM dealer_customers WHERE dealer_id = ? AND phone_number = ?";
        $check_stmt = $conn_write->prepare($check_sql);
        $check_stmt->bind_param('is', $dealer_id, $data['phone_number']);
        $check_stmt->execute();
        $result = $check_stmt->get_result();
        
        if ($result->fetch_assoc()) {
            http_response_code(409);
            echo json_encode(['error' => 'Phone number already exists for this dealer']);
            return;
        }
        
        // Insert new customer
        $sql = "INSERT INTO dealer_customers 
                (dealer_id, customer_name, phone_number, email, location, notes, status) 
                VALUES (?, ?, ?, ?, ?, ?, ?)";
        
        // Prepare variables for bind_param
        $email = $data['email'] ?? null;
        $notes = $data['notes'] ?? null;
        $status = $data['status'] ?? 'active';
        
        $stmt = $conn_write->prepare($sql);
        
        if (!$stmt) {
            http_response_code(500);
            echo json_encode(['error' => 'Database prepare failed: ' . $conn_write->error]);
            return;
        }
        
        $stmt->bind_param('issssss', 
            $dealer_id,
            $data['customer_name'],
            $data['phone_number'],
            $email,
            $data['location'],
            $notes,
            $status
        );
        
        $result = $stmt->execute();
        
        if ($result) {
            $customer_id = $conn_write->insert_id;
            echo json_encode([
                'success' => true,
                'message' => 'Customer created successfully',
                'data' => ['customer_id' => $customer_id]
            ]);
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to create customer: ' . $stmt->error]);
        }
        
    } catch (Exception $e) {
        if (strpos($e->getMessage(), 'Duplicate entry') !== false) {
            http_response_code(409);
            echo json_encode(['error' => 'Phone number already exists for this dealer']);
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to create customer', 'message' => $e->getMessage()]);
        }
    }
}

function updateCustomer($dealer_id, $customer_id, $data) {
    global $conn, $conn_write;
    
    try {
        if (empty($customer_id)) {
            http_response_code(400);
            echo json_encode(['error' => 'Customer ID is required']);
            return;
        }
        
        // Check if customer exists and belongs to dealer
        $check_sql = "SELECT customer_id FROM dealer_customers WHERE dealer_id = ? AND customer_id = ?";
        $check_stmt = $conn->prepare($check_sql);
        $check_stmt->bind_param('ii', $dealer_id, $customer_id);
        $check_stmt->execute();
        $result = $check_stmt->get_result();
        
        if (!$result->fetch_assoc()) {
            http_response_code(404);
            echo json_encode(['error' => 'Customer not found']);
            return;
        }
        
        // Validate required fields
        $required_fields = ['customer_name', 'phone_number', 'location'];
        $missing_fields = [];
        
        foreach ($required_fields as $field) {
            if (!isset($data[$field]) || trim($data[$field]) === '') {
                $missing_fields[] = $field;
            }
        }
        
        if (!empty($missing_fields)) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing required fields', 'fields' => $missing_fields]);
            return;
        }
        
        // Validate email format if provided
        if (!empty($data['email']) && !filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid email format']);
            return;
        }
        
        // Validate status if provided
        if (isset($data['status']) && !in_array($data['status'], ['active', 'inactive'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid status. Must be "active" or "inactive"']);
            return;
        }
        
        // Check for duplicate phone number (excluding current customer)
        $phone_check_sql = "SELECT customer_id FROM dealer_customers WHERE dealer_id = ? AND phone_number = ? AND customer_id != ?";
        $phone_check_stmt = $conn->prepare($phone_check_sql);
        $phone_check_stmt->bind_param('isi', $dealer_id, $data['phone_number'], $customer_id);
        $phone_check_stmt->execute();
        $phone_result = $phone_check_stmt->get_result();
        
        if ($phone_result->fetch_assoc()) {
            http_response_code(409);
            echo json_encode(['error' => 'Phone number already exists for this dealer']);
            return;
        }
        
        // Update customer
        $sql = "UPDATE dealer_customers 
                SET customer_name = ?, phone_number = ?, email = ?, location = ?, notes = ?, status = ?, updated_at = CURRENT_TIMESTAMP
                WHERE dealer_id = ? AND customer_id = ?";
        
        // Prepare variables for bind_param
        $email = $data['email'] ?? null;
        $notes = $data['notes'] ?? null;
        $status = $data['status'] ?? 'active';
        
        $stmt = $conn_write->prepare($sql);
        
        if (!$stmt) {
            http_response_code(500);
            echo json_encode(['error' => 'Database prepare failed: ' . $conn_write->error]);
            return;
        }
        
        $stmt->bind_param('ssssssii', 
            $data['customer_name'],
            $data['phone_number'],
            $email,
            $data['location'],
            $notes,
            $status,
            $dealer_id,
            $customer_id
        );
        
        $result = $stmt->execute();
        
        if ($result) {
            echo json_encode([
                'success' => true,
                'message' => 'Customer updated successfully'
            ]);
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to update customer: ' . $stmt->error]);
        }
        
    } catch (Exception $e) {
        if (strpos($e->getMessage(), 'Duplicate entry') !== false) {
            http_response_code(409);
            echo json_encode(['error' => 'Phone number already exists for this dealer']);
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to update customer', 'message' => $e->getMessage()]);
        }
    }
}

function deleteCustomer($dealer_id, $customer_id) {
    global $conn, $conn_write;
    
    try {
        if (empty($customer_id)) {
            http_response_code(400);
            echo json_encode(['error' => 'Customer ID is required']);
            return;
        }
        
        // Check if customer exists and belongs to dealer
        $check_sql = "SELECT customer_id FROM dealer_customers WHERE dealer_id = ? AND customer_id = ?";
        $check_stmt = $conn->prepare($check_sql);
        $check_stmt->bind_param('ii', $dealer_id, $customer_id);
        $check_stmt->execute();
        $result = $check_stmt->get_result();
        
        if (!$result->fetch_assoc()) {
            http_response_code(404);
            echo json_encode(['error' => 'Customer not found']);
            return;
        }
        
        // Delete customer
        $sql = "DELETE FROM dealer_customers WHERE dealer_id = ? AND customer_id = ?";
        $stmt = $conn_write->prepare($sql);
        $stmt->bind_param('ii', $dealer_id, $customer_id);
        $result = $stmt->execute();
        
        if ($result) {
            echo json_encode([
                'success' => true,
                'message' => 'Customer deleted successfully'
            ]);
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to delete customer']);
        }
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to delete customer', 'message' => $e->getMessage()]);
    }
}
?> 