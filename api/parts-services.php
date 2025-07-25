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
            getPartsServicesList($dealer_id);
            break;
        case 'get':
            $item_id = $_GET['id'] ?? '';
            getPartsServiceItem($dealer_id, $item_id);
            break;
        case 'stats':
            getPartsServicesStats($dealer_id);
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
            createPartsServiceItem($dealer_id, $input);
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
            $item_id = $_GET['id'] ?? '';
            updatePartsServiceItem($dealer_id, $item_id, $input);
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
            $item_id = $_GET['id'] ?? '';
            deletePartsServiceItem($dealer_id, $item_id);
            break;
        default:
            http_response_code(400);
            echo json_encode(['error' => 'Invalid action']);
            break;
    }
}

function getPartsServicesList($dealer_id) {
    global $conn, $conn_write;
    
    try {
        // Get pagination parameters
        $page = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 1;
        $pageSize = isset($_GET['pageSize']) ? max(1, min(100, (int)$_GET['pageSize'])) : 10;
        $offset = ($page - 1) * $pageSize;
        
        // Get search and filter parameters
        $search = isset($_GET['search']) ? trim($_GET['search']) : '';
        $type_filter = isset($_GET['type']) ? trim($_GET['type']) : '';
        $price_filter = isset($_GET['price_range']) ? trim($_GET['price_range']) : '';
        
        // Build WHERE clause
        $where_conditions = ['dealer_id = ?'];
        $params = [$dealer_id];
        $param_types = 'i';
        
        if (!empty($search)) {
            $where_conditions[] = '(name LIKE ? OR sku LIKE ? OR description LIKE ?)';
            $search_param = "%{$search}%";
            $params[] = $search_param;
            $params[] = $search_param;
            $params[] = $search_param;
            $param_types .= 'sss';
        }
        
        if (!empty($type_filter) && in_array($type_filter, ['product', 'service'])) {
            $where_conditions[] = 'type = ?';
            $params[] = $type_filter;
            $param_types .= 's';
        }
        
        if (!empty($price_filter)) {
            switch ($price_filter) {
                case '0-50':
                    $where_conditions[] = 'price BETWEEN 0 AND 50';
                    break;
                case '50-100':
                    $where_conditions[] = 'price BETWEEN 50.01 AND 100';
                    break;
                case '100+':
                    $where_conditions[] = 'price > 100';
                    break;
            }
        }
        
        $where_clause = 'WHERE ' . implode(' AND ', $where_conditions);
        
        // Get total count
        $count_sql = "SELECT COUNT(*) as total FROM dealer_parts_service {$where_clause}";
        $count_stmt = $conn->prepare($count_sql);
        $count_stmt->bind_param($param_types, ...$params);
        $count_stmt->execute();
        $result = $count_stmt->get_result();
        $total_count = $result->fetch_assoc()['total'];
        
        // Get sort parameters
        $sort_field = isset($_GET['sort']) ? $_GET['sort'] : 'name';
        $sort_direction = isset($_GET['direction']) && $_GET['direction'] === 'desc' ? 'DESC' : 'ASC';
        
        // Validate sort field
        $allowed_sort_fields = ['name', 'sku', 'type', 'price', 'cost', 'created_at'];
        if (!in_array($sort_field, $allowed_sort_fields)) {
            $sort_field = 'name';
        }
        
        // Get items
        $sql = "SELECT parts_id, name, sku, type, price, cost, description, notes, created_at, updated_at 
                FROM dealer_parts_service 
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
        $items = $result->fetch_all(MYSQLI_ASSOC);
        
        // Calculate pagination info
        $total_pages = ceil($total_count / $pageSize);
        
        echo json_encode([
            'success' => true,
            'data' => [
                'items' => $items,
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
        echo json_encode(['error' => 'Failed to fetch parts/services', 'message' => $e->getMessage()]);
    }
}

function getPartsServiceItem($dealer_id, $item_id) {
    global $conn, $conn_write;
    
    try {
        if (empty($item_id)) {
            http_response_code(400);
            echo json_encode(['error' => 'Item ID is required']);
            return;
        }
        
        $sql = "SELECT * FROM dealer_parts_service WHERE dealer_id = ? AND parts_id = ?";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param('ii', $dealer_id, $item_id);
        $stmt->execute();
        $result = $stmt->get_result();
        $item = $result->fetch_assoc();
        
        if (!$item) {
            http_response_code(404);
            echo json_encode(['error' => 'Item not found']);
            return;
        }
        
        echo json_encode(['success' => true, 'data' => $item]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch item', 'message' => $e->getMessage()]);
    }
}

function getPartsServicesStats($dealer_id) {
    global $conn, $conn_write;
    
    try {
        $sql = "SELECT 
                    COUNT(*) as total_items,
                    SUM(CASE WHEN type = 'product' THEN 1 ELSE 0 END) as products_count,
                    SUM(CASE WHEN type = 'service' THEN 1 ELSE 0 END) as services_count,
                    SUM(price) as total_value,
                    AVG(price) as avg_price,
                    SUM(cost) as total_cost,
                    SUM(price - cost) as total_profit
                FROM dealer_parts_service 
                WHERE dealer_id = ?";
        
        $stmt = $conn->prepare($sql);
        $stmt->bind_param('i', $dealer_id);
        $stmt->execute();
        $result = $stmt->get_result();
        $stats = $result->fetch_assoc();
        
        // Convert to appropriate data types
        $stats['total_items'] = (int)$stats['total_items'];
        $stats['products_count'] = (int)$stats['products_count'];
        $stats['services_count'] = (int)$stats['services_count'];
        $stats['total_value'] = (float)$stats['total_value'];
        $stats['avg_price'] = (float)$stats['avg_price'];
        $stats['total_cost'] = (float)$stats['total_cost'];
        $stats['total_profit'] = (float)$stats['total_profit'];
        
        echo json_encode(['success' => true, 'data' => $stats]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch stats', 'message' => $e->getMessage()]);
    }
}

function createPartsServiceItem($dealer_id, $data) {
    global $conn, $conn_write;
    
    try {
        // Debug: Log received data
        error_log("Received data: " . json_encode($data));
        error_log("Dealer ID: " . $dealer_id);
        
        // Validate required fields
        $required_fields = ['name', 'sku', 'type', 'price', 'cost'];
        $missing_fields = [];
        
        foreach ($required_fields as $field) {
            if (!isset($data[$field]) || ($data[$field] === '' && $field !== 'cost')) {
                $missing_fields[] = $field;
            }
        }
        
        if (!empty($missing_fields)) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing required fields', 'fields' => $missing_fields]);
            return;
        }
        
        // Validate type
        if (!in_array($data['type'], ['product', 'service'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid type. Must be "product" or "service"']);
            return;
        }
        
        // Validate and convert numeric fields
        if (!is_numeric($data['price']) || $data['price'] < 0) {
            http_response_code(400);
            echo json_encode(['error' => 'Price must be a valid positive number']);
            return;
        }
        
        if (!is_numeric($data['cost']) || $data['cost'] < 0) {
            http_response_code(400);
            echo json_encode(['error' => 'Cost must be a valid positive number']);
            return;
        }
        
        // Convert to proper types
        $price = (float)$data['price'];
        $cost = (float)$data['cost'];
        
        // Check for duplicate SKU for this dealer
        $check_sql = "SELECT parts_id FROM dealer_parts_service WHERE dealer_id = ? AND sku = ?";
        $check_stmt = $conn_write->prepare($check_sql);
        $check_stmt->bind_param('is', $dealer_id, $data['sku']);
        $check_stmt->execute();
        $result = $check_stmt->get_result();
        
        if ($result->fetch_assoc()) {
            http_response_code(409);
            echo json_encode(['error' => 'SKU already exists for this dealer']);
            return;
        }
        
        // Insert new item
        $sql = "INSERT INTO dealer_parts_service 
                (dealer_id, name, sku, type, price, cost, description, notes) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
        
        // Prepare variables for bind_param (cannot pass temp values by reference)
        $description = $data['description'] ?? '';
        $notes = $data['notes'] ?? '';
        
        $stmt = $conn_write->prepare($sql);
        
        if (!$stmt) {
            http_response_code(500);
            echo json_encode(['error' => 'Database prepare failed: ' . $conn_write->error]);
            return;
        }
        
        $stmt->bind_param('isssddss', 
            $dealer_id,
            $data['name'],
            $data['sku'],
            $data['type'],
            $price,
            $cost,
            $description,
            $notes
        );
        
        $result = $stmt->execute();
        
        if ($result) {
            $item_id = $conn_write->insert_id;
            echo json_encode([
                'success' => true,
                'message' => 'Item created successfully',
                'data' => ['item_id' => $item_id]
            ]);
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to create item: ' . $stmt->error]);
        }
        
    } catch (Exception $e) {
        if (strpos($e->getMessage(), 'Duplicate entry') !== false) {
            http_response_code(409);
            echo json_encode(['error' => 'SKU already exists for this dealer']);
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to create item', 'message' => $e->getMessage()]);
        }
    }
}

function updatePartsServiceItem($dealer_id, $item_id, $data) {
    global $conn, $conn_write;
    
    try {
        if (empty($item_id)) {
            http_response_code(400);
            echo json_encode(['error' => 'Item ID is required']);
            return;
        }
        
        // Check if item exists and belongs to dealer
        $check_sql = "SELECT parts_id FROM dealer_parts_service WHERE dealer_id = ? AND parts_id = ?";
        $check_stmt = $conn->prepare($check_sql);
        $check_stmt->bind_param('ii', $dealer_id, $item_id);
        $check_stmt->execute();
        $result = $check_stmt->get_result();
        
        if (!$result->fetch_assoc()) {
            http_response_code(404);
            echo json_encode(['error' => 'Item not found']);
            return;
        }
        
        // Validate required fields
        $required_fields = ['name', 'sku', 'type', 'price', 'cost'];
        $missing_fields = [];
        
        foreach ($required_fields as $field) {
            if (!isset($data[$field]) || ($data[$field] === '' && $field !== 'cost')) {
                $missing_fields[] = $field;
            }
        }
        
        if (!empty($missing_fields)) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing required fields', 'fields' => $missing_fields]);
            return;
        }
        
        // Validate type
        if (!in_array($data['type'], ['product', 'service'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid type. Must be "product" or "service"']);
            return;
        }
        
        // Validate and convert numeric fields
        if (!is_numeric($data['price']) || $data['price'] < 0) {
            http_response_code(400);
            echo json_encode(['error' => 'Price must be a valid positive number']);
            return;
        }
        
        if (!is_numeric($data['cost']) || $data['cost'] < 0) {
            http_response_code(400);
            echo json_encode(['error' => 'Cost must be a valid positive number']);
            return;
        }
        
        // Convert to proper types
        $price = (float)$data['price'];
        $cost = (float)$data['cost'];
        
        // Check for duplicate SKU (excluding current item)
        $sku_check_sql = "SELECT parts_id FROM dealer_parts_service WHERE dealer_id = ? AND sku = ? AND parts_id != ?";
        $sku_check_stmt = $conn->prepare($sku_check_sql);
        $sku_check_stmt->bind_param('isi', $dealer_id, $data['sku'], $item_id);
        $sku_check_stmt->execute();
        $sku_result = $sku_check_stmt->get_result();
        
        if ($sku_result->fetch_assoc()) {
            http_response_code(409);
            echo json_encode(['error' => 'SKU already exists for this dealer']);
            return;
        }
        
        // Update item
        $sql = "UPDATE dealer_parts_service 
                SET name = ?, sku = ?, type = ?, price = ?, cost = ?, description = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
                WHERE dealer_id = ? AND parts_id = ?";
        
        // Prepare variables for bind_param (cannot pass temp values by reference)
        $description = $data['description'] ?? '';
        $notes = $data['notes'] ?? '';
        
        $stmt = $conn_write->prepare($sql);
        
        if (!$stmt) {
            http_response_code(500);
            echo json_encode(['error' => 'Database prepare failed: ' . $conn_write->error]);
            return;
        }
        
        $stmt->bind_param('sssddssii', 
            $data['name'],
            $data['sku'],
            $data['type'],
            $price,
            $cost,
            $description,
            $notes,
            $dealer_id,
            $item_id
        );
        
        
        $result = $stmt->execute();
        
        if ($result) {
            echo json_encode([
                'success' => true,
                'message' => 'Item updated successfully'
            ]);
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to update item: ' . $stmt->error]);
        }
        
    } catch (Exception $e) {
        if (strpos($e->getMessage(), 'Duplicate entry') !== false) {
            http_response_code(409);
            echo json_encode(['error' => 'SKU already exists for this dealer']);
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to update item', 'message' => $e->getMessage()]);
        }
    }
}

function deletePartsServiceItem($dealer_id, $item_id) {
    global $conn, $conn_write;
    
    try {
        if (empty($item_id)) {
            http_response_code(400);
            echo json_encode(['error' => 'Item ID is required']);
            return;
        }
        
        // Check if item exists and belongs to dealer
        $check_sql = "SELECT parts_id FROM dealer_parts_service WHERE dealer_id = ? AND parts_id = ?";
        $check_stmt = $conn->prepare($check_sql);
        $check_stmt->bind_param('ii', $dealer_id, $item_id);
        $check_stmt->execute();
        $result = $check_stmt->get_result();
        
        if (!$result->fetch_assoc()) {
            http_response_code(404);
            echo json_encode(['error' => 'Item not found']);
            return;
        }
        
        // Delete item
        $sql = "DELETE FROM dealer_parts_service WHERE dealer_id = ? AND parts_id = ?";
        $stmt = $conn_write->prepare($sql);
        $stmt->bind_param('ii', $dealer_id, $item_id);
        $result = $stmt->execute();
        
        if ($result) {
            echo json_encode([
                'success' => true,
                'message' => 'Item deleted successfully'
            ]);
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to delete item']);
        }
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to delete item', 'message' => $e->getMessage()]);
    }
}
?> 