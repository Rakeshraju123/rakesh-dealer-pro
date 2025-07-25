<?php
// ini_set('display_errors', 1);
// ini_set('display_startup_errors', 1);
// error_reporting(E_ALL);
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
            getSalesList($dealer_id);
            break;
        case 'get':
            $sale_id = $_GET['id'] ?? '';
            getSaleDetails($dealer_id, $sale_id);
            break;
        case 'stats':
            getSalesStats($dealer_id);
            break;
        case 'salesmen':
            getSalesmenList($dealer_id);
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
            createSale($dealer_id, $input);
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
            $sale_id = $_GET['id'] ?? '';
            updateSale($dealer_id, $sale_id, $input);
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
            $sale_id = $_GET['id'] ?? '';
            deleteSale($dealer_id, $sale_id);
            break;
        default:
            http_response_code(400);
            echo json_encode(['error' => 'Invalid action']);
            break;
    }
}

function getSalesList($dealer_id) {
    global $conn;
    
    try {
        // Get pagination parameters
        $page = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 1;
        $pageSize = isset($_GET['pageSize']) ? max(1, min(100, (int)$_GET['pageSize'])) : 10;
        $offset = ($page - 1) * $pageSize;
        
        // Get search and filter parameters
        $search = isset($_GET['search']) ? trim($_GET['search']) : '';
        $status_filter = isset($_GET['status']) ? trim($_GET['status']) : '';
        $salesman_filter = isset($_GET['salesman']) ? trim($_GET['salesman']) : '';
        $date_from = isset($_GET['date_from']) ? trim($_GET['date_from']) : '';
        $date_to = isset($_GET['date_to']) ? trim($_GET['date_to']) : '';
        
        // Build WHERE clause
        $where_conditions = ['ds.dealer_id = ?'];
        $params = [$dealer_id];
        $param_types = 'i';
        
        if (!empty($search)) {
            $where_conditions[] = '(ds.sale_id LIKE ? OR ds.customer_name LIKE ? OR ds.item_product LIKE ? OR ds.salesman_name LIKE ?)';
            $search_param = "%{$search}%";
            $params[] = $search_param;
            $params[] = $search_param;
            $params[] = $search_param;
            $params[] = $search_param;
            $param_types .= 'ssss';
        }
        
        if (!empty($status_filter) && in_array($status_filter, ['pending', 'completed', 'cancelled', 'refunded', 'partial'])) {
            $where_conditions[] = 'ds.status = ?';
            $params[] = $status_filter;
            $param_types .= 's';
        }
        
        if (!empty($salesman_filter)) {
            $where_conditions[] = 'dsm.salesman_id = ?';
            $params[] = $salesman_filter;
            $param_types .= 'i';
        }
        
        if (!empty($date_from)) {
            $where_conditions[] = 'ds.sale_date >= ?';
            $params[] = $date_from;
            $param_types .= 's';
        }
        
        if (!empty($date_to)) {
            $where_conditions[] = 'ds.sale_date <= ?';
            $params[] = $date_to;
            $param_types .= 's';
        }
        
        $where_clause = 'WHERE ' . implode(' AND ', $where_conditions);
        
        // Get total count
        $count_sql = "SELECT COUNT(*) as total 
                     FROM dealer_sales ds 
                     LEFT JOIN dealer_salesman dsm ON ds.salesman_id = dsm.salesman_id 
                     {$where_clause}";
        $count_stmt = $conn->prepare($count_sql);
        $count_stmt->bind_param($param_types, ...$params);
        $count_stmt->execute();
        $result = $count_stmt->get_result();
        $total_count = $result->fetch_assoc()['total'];
        
        // Get sort parameters
        $sort_field = isset($_GET['sort']) ? $_GET['sort'] : 'ds.created_at';
        $sort_direction = isset($_GET['direction']) && $_GET['direction'] === 'desc' ? 'DESC' : 'ASC';
        
        // Validate sort field
        $allowed_sort_fields = ['ds.sale_id', 'ds.customer_name', 'ds.total_amount', 'ds.balance', 'ds.status', 'ds.sale_date', 'ds.created_at'];
        if (!in_array($sort_field, $allowed_sort_fields)) {
            $sort_field = 'ds.created_at';
        }
        
        // Get sales
        $sql = "SELECT ds.sale_id, ds.customer_name, ds.phone_number, 
                       ds.item_product, ds.total_amount, ds.balance, ds.paid_amount, ds.status, 
                       ds.sale_date, ds.due_date, ds.payment_method, ds.tax_amount, ds.discount_amount,
                       ds.notes, ds.created_at, ds.updated_at, ds.salesman_id,
                       COALESCE(dsm.salesman_name, ds.salesman_name) as salesman_name
                FROM dealer_sales ds 
                LEFT JOIN dealer_salesman dsm ON ds.salesman_id = dsm.salesman_id 
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
        
        $sales = [];
        while ($row = $result->fetch_assoc()) {
            $sales[] = $row;
        }
        
        // Calculate pagination info
        $total_pages = ceil($total_count / $pageSize);
        $has_prev = $page > 1;
        $has_next = $page < $total_pages;
        
        echo json_encode([
            'success' => true,
            'data' => [
                'sales' => $sales,
                'pagination' => [
                    'current_page' => $page,
                    'page_size' => $pageSize,
                    'total_items' => $total_count,
                    'total_pages' => $total_pages,
                    'has_prev' => $has_prev,
                    'has_next' => $has_next
                ]
            ]
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch sales', 'message' => $e->getMessage()]);
    }
}

function getSaleDetails($dealer_id, $sale_id) {
    global $conn;
    
    if (empty($sale_id)) {
        http_response_code(400);
        echo json_encode(['error' => 'Sale ID is required']);
        return;
    }
    
    try {
        $sql = "SELECT ds.*, dsm.salesman_name, dsm.employee_id, dsm.phone_number as salesman_phone, dsm.email as salesman_email
                FROM dealer_sales ds 
                LEFT JOIN dealer_salesman dsm ON ds.salesman_id = dsm.salesman_id 
                WHERE ds.dealer_id = ? AND ds.sale_id = ?";
        
        $stmt = $conn->prepare($sql);
        $stmt->bind_param('ii', $dealer_id, $sale_id);
        $stmt->execute();
        $result = $stmt->get_result();
        
        if ($sale = $result->fetch_assoc()) {
            echo json_encode(['success' => true, 'data' => $sale]);
        } else {
            http_response_code(404);
            echo json_encode(['error' => 'Sale not found']);
        }
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch sale details', 'message' => $e->getMessage()]);
    }
}

function getSalesStats($dealer_id) {
    global $conn;
    
    try {
        $sql = "SELECT 
                    COUNT(*) as total_sales,
                    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_sales,
                    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_sales,
                    COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_sales,
                    COUNT(CASE WHEN status = 'partial' THEN 1 END) as partial_sales,
                    COALESCE(SUM(total_amount), 0) as total_revenue,
                    COALESCE(SUM(paid_amount), 0) as total_paid,
                    COALESCE(SUM(balance), 0) as total_outstanding,
                    COALESCE(AVG(total_amount), 0) as average_sale_amount
                FROM dealer_sales 
                WHERE dealer_id = ?";
        
        $stmt = $conn->prepare($sql);
        $stmt->bind_param('i', $dealer_id);
        $stmt->execute();
        $result = $stmt->get_result();
        $stats = $result->fetch_assoc();
        
        echo json_encode(['success' => true, 'data' => $stats]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch sales statistics', 'message' => $e->getMessage()]);
    }
}

function getSalesmenList($dealer_id) {
    global $conn;
    
    try {
        $sql = "SELECT salesman_id, salesman_name, employee_id, phone_number, email, commission_rate, status
                FROM dealer_salesman 
                WHERE dealer_id = ? AND status = 'active' 
                ORDER BY salesman_name";
        
        $stmt = $conn->prepare($sql);
        $stmt->bind_param('i', $dealer_id);
        $stmt->execute();
        $result = $stmt->get_result();
        
        $salesmen = [];
        while ($row = $result->fetch_assoc()) {
            $salesmen[] = $row;
        }
        
        echo json_encode(['success' => true, 'data' => $salesmen]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch salesmen', 'message' => $e->getMessage()]);
    }
}

function createSale($dealer_id, $data) {
    global $conn_write;
    
    try {
        error_log("createSale called for dealer_id: $dealer_id");
        error_log("Input data: " . json_encode($data));
        
        // Validate required fields
        if (empty($data['customer_name']) || empty($data['item_product']) || 
            !isset($data['total_amount'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing required fields: customer_name, item_product, total_amount']);
            return;
        }
        
        // Validate status if provided
        if (isset($data['status']) && !in_array($data['status'], ['pending', 'completed', 'cancelled', 'refunded', 'partial'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid status']);
            return;
        }
        
        $conn_write->begin_transaction();
        
        // Use provided status or default to 'pending'
        $status = isset($data['status']) && in_array($data['status'], ['pending', 'completed', 'cancelled', 'refunded', 'partial']) 
                 ? $data['status'] : 'pending';
        
        // Simplified approach - use minimal required fields only
        $sql = "INSERT INTO dealer_sales (
                    dealer_id, customer_name, phone_number, 
                    item_product, total_amount, balance, status, notes, sale_date
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
        
        // Prepare safe values
        $customer_name = trim($data['customer_name']);
        $phone_number = trim($data['phone_number'] ?? '');
        $item_product = trim($data['item_product']);
        $total_amount = (float)$data['total_amount'];
        $balance = isset($data['balance']) ? (float)$data['balance'] : $total_amount;
        $notes = trim($data['notes'] ?? '');
        $sale_date = $data['sale_date'] ?? date('Y-m-d');
        
        error_log("Inserting with values: dealer_id=$dealer_id, customer=$customer_name, amount=$total_amount, status=$status");
        
        $stmt = $conn_write->prepare($sql);
        
        if (!$stmt) {
            error_log("Database prepare failed: " . $conn_write->error);
            $conn_write->rollback();
            http_response_code(500);
            echo json_encode(['error' => 'Database prepare failed: ' . $conn_write->error]);
            return;
        }
        
        $stmt->bind_param('isssddsss', 
            $dealer_id,
            $customer_name,
            $phone_number,
            $item_product,
            $total_amount,
            $balance,
            $status,
            $notes,
            $sale_date
        );
        
        if ($stmt->execute()) {
            $sale_id = $conn_write->insert_id;
            
            // Now update with salesman info if provided
            if (!empty($data['salesman_id']) && $data['salesman_id'] !== 'null') {
                $salesman_id = (int)$data['salesman_id'];
                $update_sql = "UPDATE dealer_sales SET salesman_id = ? WHERE sale_id = ?";
                $update_stmt = $conn_write->prepare($update_sql);
                $update_stmt->bind_param('ii', $salesman_id, $sale_id);
                $update_stmt->execute();
                error_log("Updated sale $sale_id with salesman_id $salesman_id");
            }
            
            $conn_write->commit();
            
            error_log("Sale created successfully with ID: $sale_id");
            echo json_encode([
                'success' => true, 
                'message' => 'Sale created successfully',
                'data' => ['sale_id' => $sale_id]
            ]);
        } else {
            error_log("Execute failed: " . $stmt->error);
            $conn_write->rollback();
            http_response_code(500);
            echo json_encode(['error' => 'Failed to create sale', 'message' => $stmt->error]);
        }
        
    } catch (Exception $e) {
        error_log("Exception in createSale: " . $e->getMessage());
        $conn_write->rollback();
        http_response_code(500);
        echo json_encode(['error' => 'Failed to create sale', 'message' => $e->getMessage()]);
    }
}

function updateSale($dealer_id, $sale_id, $data) {
    global $conn_write;
    
    if (empty($sale_id)) {
        http_response_code(400);
        echo json_encode(['error' => 'Sale ID is required']);
        return;
    }
    
    // Validate required fields
    if (empty($data['customer_name']) || empty($data['item_product']) || 
        !isset($data['total_amount'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing required fields: customer_name, item_product, total_amount']);
        return;
    }
    
    // Validate status if provided
    if (isset($data['status']) && !in_array($data['status'], ['pending', 'completed', 'cancelled', 'refunded', 'partial'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid status']);
        return;
    }
    
    try {
        $conn_write->begin_transaction();
        
        // Check if sale exists and belongs to dealer
        $check_sql = "SELECT sale_id FROM dealer_sales WHERE dealer_id = ? AND sale_id = ?";
        $check_stmt = $conn_write->prepare($check_sql);
        $check_stmt->bind_param('ii', $dealer_id, $sale_id);
        $check_stmt->execute();
        $check_result = $check_stmt->get_result();
        
        if (!$check_result->fetch_assoc()) {
            $conn_write->rollback();
            http_response_code(404);
            echo json_encode(['error' => 'Sale not found']);
            return;
        }
        
        // Update sale - use provided status or default to 'pending'
        $status = isset($data['status']) && in_array($data['status'], ['pending', 'completed', 'cancelled', 'refunded', 'partial']) 
                 ? $data['status'] : 'pending';
        
        $sql = "UPDATE dealer_sales SET 
                    customer_name = ?, phone_number = ?, item_product = ?, 
                    total_amount = ?, balance = ?, status = ?, notes = ?
                WHERE dealer_id = ? AND sale_id = ?";
        
        $stmt = $conn_write->prepare($sql);
        
        // Prepare safe values
        $customer_name = trim($data['customer_name']);
        $phone_number = trim($data['phone_number'] ?? '');
        $item_product = trim($data['item_product']);
        $total_amount = (float)$data['total_amount'];
        $balance = isset($data['balance']) ? (float)$data['balance'] : $total_amount;
        $notes = trim($data['notes'] ?? '');
        
        $stmt->bind_param('sssddssii', 
            $customer_name, $phone_number, $item_product,
            $total_amount, $balance, $status, $notes, $dealer_id, $sale_id
        );
        
        if ($stmt->execute()) {
            // Handle salesman assignment separately after main update
            if (!empty($data['salesman_id']) && $data['salesman_id'] !== 'null') {
                $salesman_id = (int)$data['salesman_id'];
                $salesman_update_sql = "UPDATE dealer_sales SET salesman_id = ? WHERE sale_id = ? AND dealer_id = ?";
                $salesman_update_stmt = $conn_write->prepare($salesman_update_sql);
                $salesman_update_stmt->bind_param('iii', $salesman_id, $sale_id, $dealer_id);
                $salesman_update_stmt->execute();
            }
            
            $conn_write->commit();
            echo json_encode(['success' => true, 'message' => 'Sale updated successfully']);
        } else {
            $conn_write->rollback();
            http_response_code(500);
            echo json_encode(['error' => 'Failed to update sale', 'message' => $stmt->error]);
        }
        
    } catch (Exception $e) {
        $conn_write->rollback();
        http_response_code(500);
        echo json_encode(['error' => 'Failed to update sale', 'message' => $e->getMessage()]);
    }
}

function deleteSale($dealer_id, $sale_id) {
    global $conn_write;
    
    if (empty($sale_id)) {
        http_response_code(400);
        echo json_encode(['error' => 'Sale ID is required']);
        return;
    }
    
    try {
        $conn_write->begin_transaction();
        
        // Check if sale exists and belongs to dealer
        $check_sql = "SELECT sale_id FROM dealer_sales WHERE dealer_id = ? AND sale_id = ?";
        $check_stmt = $conn_write->prepare($check_sql);
        $check_stmt->bind_param('ii', $dealer_id, $sale_id);
        $check_stmt->execute();
        $check_result = $check_stmt->get_result();
        
        if (!$check_result->fetch_assoc()) {
            $conn_write->rollback();
            http_response_code(404);
            echo json_encode(['error' => 'Sale not found']);
            return;
        }
        
        // Delete sale
        $delete_sql = "DELETE FROM dealer_sales WHERE dealer_id = ? AND sale_id = ?";
        $delete_stmt = $conn_write->prepare($delete_sql);
        $delete_stmt->bind_param('ii', $dealer_id, $sale_id);
        
        if ($delete_stmt->execute()) {
            $conn_write->commit();
            echo json_encode(['success' => true, 'message' => 'Sale deleted successfully']);
        } else {
            $conn_write->rollback();
            http_response_code(500);
            echo json_encode(['error' => 'Failed to delete sale', 'message' => $delete_stmt->error]);
        }
        
    } catch (Exception $e) {
        $conn_write->rollback();
        http_response_code(500);
        echo json_encode(['error' => 'Failed to delete sale', 'message' => $e->getMessage()]);
    }
}



?> 