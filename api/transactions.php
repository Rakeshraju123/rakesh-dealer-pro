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
            getTransactionsList($dealer_id);
            break;
        case 'get':
            $transaction_id = $_GET['id'] ?? '';
            getTransaction($dealer_id, $transaction_id);
            break;
        case 'stats':
            getTransactionsStats($dealer_id);
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
            createTransaction($dealer_id, $input);
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
            $transaction_id = $_GET['id'] ?? '';
            updateTransaction($dealer_id, $transaction_id, $input);
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
            $transaction_id = $_GET['id'] ?? '';
            deleteTransaction($dealer_id, $transaction_id);
            break;
        default:
            http_response_code(400);
            echo json_encode(['error' => 'Invalid action']);
            break;
    }
}

function getTransactionsList($dealer_id) {
    global $conn, $conn_write;
    
    try {
        // Get pagination parameters
        $page = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 1;
        $pageSize = isset($_GET['pageSize']) ? max(1, min(100, (int)$_GET['pageSize'])) : 10;
        $offset = ($page - 1) * $pageSize;
        
        // Get search and filter parameters
        $search = isset($_GET['search']) ? trim($_GET['search']) : '';
        $type_filter = isset($_GET['type']) ? trim($_GET['type']) : '';
        $date_from = isset($_GET['date_from']) ? trim($_GET['date_from']) : '';
        $date_to = isset($_GET['date_to']) ? trim($_GET['date_to']) : '';
        
        // Build WHERE clause
        $where_conditions = ['dealer_id = ?'];
        $params = [$dealer_id];
        $param_types = 'i';
        
        if (!empty($search)) {
            $where_conditions[] = '(transaction_number LIKE ? OR customer_name LIKE ? OR notes LIKE ?)';
            $search_param = "%{$search}%";
            $params[] = $search_param;
            $params[] = $search_param;
            $params[] = $search_param;
            $param_types .= 'sss';
        }
        
        if (!empty($type_filter) && in_array($type_filter, ['sale', 'service'])) {
            $where_conditions[] = 'transaction_type = ?';
            $params[] = $type_filter;
            $param_types .= 's';
        }
        
        if (!empty($date_from)) {
            $where_conditions[] = 'transaction_date >= ?';
            $params[] = $date_from;
            $param_types .= 's';
        }
        
        if (!empty($date_to)) {
            $where_conditions[] = 'transaction_date <= ?';
            $params[] = $date_to;
            $param_types .= 's';
        }
        
        $where_clause = 'WHERE ' . implode(' AND ', $where_conditions);
        
        // Get total count
        $count_sql = "SELECT COUNT(*) as total FROM dealer_transactions {$where_clause}";
        $count_stmt = $conn->prepare($count_sql);
        $count_stmt->bind_param($param_types, ...$params);
        $count_stmt->execute();
        $result = $count_stmt->get_result();
        $total_count = $result->fetch_assoc()['total'];
        
        // Get sort parameters
        $sort_field = isset($_GET['sort']) ? $_GET['sort'] : 'transaction_date';
        $sort_direction = isset($_GET['direction']) && $_GET['direction'] === 'desc' ? 'DESC' : 'ASC';
        
        // Validate sort field
        $allowed_sort_fields = ['transaction_id', 'customer_name', 'transaction_type', 'amount', 'fee', 'net_amount', 'transaction_date'];
        if (!in_array($sort_field, $allowed_sort_fields)) {
            $sort_field = 'transaction_date';
        }
        
        // Get transactions
        $sql = "SELECT transaction_id, transaction_number, customer_name, transaction_type, amount, fee, net_amount, 
                       transaction_date, notes, status, created_at, updated_at 
                FROM dealer_transactions 
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
        $transactions = $result->fetch_all(MYSQLI_ASSOC);
        
        // Calculate pagination info
        $total_pages = ceil($total_count / $pageSize);
        
        echo json_encode([
            'success' => true,
            'data' => [
                'transactions' => $transactions,
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
        echo json_encode(['error' => 'Failed to fetch transactions', 'message' => $e->getMessage()]);
    }
}

function getTransaction($dealer_id, $transaction_id) {
    global $conn, $conn_write;
    
    try {
        if (empty($transaction_id)) {
            http_response_code(400);
            echo json_encode(['error' => 'Transaction ID is required']);
            return;
        }
        
        $sql = "SELECT * FROM dealer_transactions WHERE dealer_id = ? AND transaction_id = ?";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param('is', $dealer_id, $transaction_id);
        $stmt->execute();
        $result = $stmt->get_result();
        $transaction = $result->fetch_assoc();
        
        if (!$transaction) {
            http_response_code(404);
            echo json_encode(['error' => 'Transaction not found']);
            return;
        }
        
        echo json_encode(['success' => true, 'data' => $transaction]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch transaction', 'message' => $e->getMessage()]);
    }
}

function getTransactionsStats($dealer_id) {
    global $conn, $conn_write;
    
    try {
        $sql = "SELECT 
                    COUNT(*) as total_transactions,
                    SUM(CASE WHEN transaction_type = 'sale' THEN 1 ELSE 0 END) as sales_count,
                    SUM(CASE WHEN transaction_type = 'service' THEN 1 ELSE 0 END) as services_count,
                    SUM(amount) as total_amount,
                    SUM(fee) as total_fees,
                    SUM(net_amount) as total_net
                FROM dealer_transactions 
                WHERE dealer_id = ?";
        
        $stmt = $conn->prepare($sql);
        $stmt->bind_param('i', $dealer_id);
        $stmt->execute();
        $result = $stmt->get_result();
        $stats = $result->fetch_assoc();
        
        // Convert to appropriate data types
        $stats['total_transactions'] = (int)$stats['total_transactions'];
        $stats['sales_count'] = (int)$stats['sales_count'];
        $stats['services_count'] = (int)$stats['services_count'];
        $stats['total_amount'] = (float)$stats['total_amount'];
        $stats['total_fees'] = (float)$stats['total_fees'];
        $stats['total_net'] = (float)$stats['total_net'];
        
        echo json_encode(['success' => true, 'data' => $stats]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch stats', 'message' => $e->getMessage()]);
    }
}

function createTransaction($dealer_id, $data) {
    global $conn, $conn_write;
    
    try {
        // Validate required fields
        $required_fields = ['customer_name', 'transaction_type', 'amount'];
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
        
        // Validate type
        if (!in_array($data['transaction_type'], ['sale', 'service'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid type. Must be "sale" or "service"']);
            return;
        }
        
        // Validate and convert numeric fields
        if (!is_numeric($data['amount']) || $data['amount'] < 0) {
            http_response_code(400);
            echo json_encode(['error' => 'Amount must be a valid positive number']);
            return;
        }
        
        $amount = (float)$data['amount'];
        $fee = isset($data['fee']) ? (float)$data['fee'] : 0;
        $net_amount = $amount - $fee;
        
        // Generate transaction number
        $transaction_number = 'TXN' . date('YmdHis') . rand(100, 999);
        
        // Insert new transaction
        $sql = "INSERT INTO dealer_transactions 
                (dealer_id, transaction_number, customer_name, transaction_type, amount, fee, net_amount, transaction_date, notes, status) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed')";
        
        $transaction_date = $data['transaction_date'] ?? date('Y-m-d');
        $notes = $data['notes'] ?? '';
        
        $stmt = $conn_write->prepare($sql);
        
        if (!$stmt) {
            http_response_code(500);
            echo json_encode(['error' => 'Database prepare failed: ' . $conn_write->error]);
            return;
        }
        
        $stmt->bind_param('isssddss', 
            $dealer_id,
            $transaction_number,
            $data['customer_name'],
            $data['transaction_type'],
            $amount,
            $fee,
            $net_amount,
            $transaction_date,
            $notes
        );
        
        $result = $stmt->execute();
        
        if ($result) {
            $transaction_id = $conn_write->insert_id;
            echo json_encode([
                'success' => true,
                'message' => 'Transaction created successfully',
                'data' => ['transaction_id' => $transaction_id, 'transaction_number' => $transaction_number]
            ]);
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to create transaction: ' . $stmt->error]);
        }
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to create transaction', 'message' => $e->getMessage()]);
    }
}

function updateTransaction($dealer_id, $transaction_id, $data) {
    global $conn, $conn_write;
    
    try {
        if (empty($transaction_id)) {
            http_response_code(400);
            echo json_encode(['error' => 'Transaction ID is required']);
            return;
        }
        
        // Check if transaction exists and belongs to dealer
        $check_sql = "SELECT transaction_id FROM dealer_transactions WHERE dealer_id = ? AND transaction_id = ?";
        $check_stmt = $conn->prepare($check_sql);
        $check_stmt->bind_param('is', $dealer_id, $transaction_id);
        $check_stmt->execute();
        $result = $check_stmt->get_result();
        
        if (!$result->fetch_assoc()) {
            http_response_code(404);
            echo json_encode(['error' => 'Transaction not found']);
            return;
        }
        
        // Build update query dynamically
        $update_fields = [];
        $params = [];
        $param_types = '';
        
        if (isset($data['customer_name']) && trim($data['customer_name']) !== '') {
            $update_fields[] = 'customer_name = ?';
            $params[] = trim($data['customer_name']);
            $param_types .= 's';
        }
        
        if (isset($data['transaction_type']) && in_array($data['transaction_type'], ['sale', 'service'])) {
            $update_fields[] = 'transaction_type = ?';
            $params[] = $data['transaction_type'];
            $param_types .= 's';
        }
        
        if (isset($data['amount']) && is_numeric($data['amount']) && $data['amount'] >= 0) {
            $amount = (float)$data['amount'];
            $fee = isset($data['fee']) && is_numeric($data['fee']) ? (float)$data['fee'] : 0;
            $net_amount = $amount - $fee;
            
            $update_fields[] = 'amount = ?';
            $update_fields[] = 'fee = ?';
            $update_fields[] = 'net_amount = ?';
            $params[] = $amount;
            $params[] = $fee;
            $params[] = $net_amount;
            $param_types .= 'ddd';
        }
        
        if (isset($data['transaction_date']) && !empty($data['transaction_date'])) {
            $update_fields[] = 'transaction_date = ?';
            $params[] = $data['transaction_date'];
            $param_types .= 's';
        }
        
        if (isset($data['notes'])) {
            $update_fields[] = 'notes = ?';
            $params[] = $data['notes'];
            $param_types .= 's';
        }
        
        if (empty($update_fields)) {
            http_response_code(400);
            echo json_encode(['error' => 'No valid fields to update']);
            return;
        }
        
        // Add updated_at timestamp
        $update_fields[] = 'updated_at = NOW()';
        
        // Add dealer_id and transaction_id for WHERE clause
        $params[] = $dealer_id;
        $params[] = $transaction_id;
        $param_types .= 'is';
        
        $sql = "UPDATE dealer_transactions SET " . implode(', ', $update_fields) . " WHERE dealer_id = ? AND transaction_id = ?";
        
        $stmt = $conn_write->prepare($sql);
        $stmt->bind_param($param_types, ...$params);
        
        if ($stmt->execute()) {
            echo json_encode(['success' => true, 'message' => 'Transaction updated successfully']);
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to update transaction: ' . $stmt->error]);
        }
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to update transaction', 'message' => $e->getMessage()]);
    }
}

function deleteTransaction($dealer_id, $transaction_id) {
    global $conn, $conn_write;
    
    try {
        if (empty($transaction_id)) {
            http_response_code(400);
            echo json_encode(['error' => 'Transaction ID is required']);
            return;
        }
        
        // Check if transaction exists and belongs to dealer
        $check_sql = "SELECT transaction_id FROM dealer_transactions WHERE dealer_id = ? AND transaction_id = ?";
        $check_stmt = $conn->prepare($check_sql);
        $check_stmt->bind_param('is', $dealer_id, $transaction_id);
        $check_stmt->execute();
        $result = $check_stmt->get_result();
        
        if (!$result->fetch_assoc()) {
            http_response_code(404);
            echo json_encode(['error' => 'Transaction not found']);
            return;
        }
        
        // Delete transaction
        $sql = "DELETE FROM dealer_transactions WHERE dealer_id = ? AND transaction_id = ?";
        $stmt = $conn_write->prepare($sql);
        $stmt->bind_param('is', $dealer_id, $transaction_id);
        
        if ($stmt->execute()) {
            echo json_encode(['success' => true, 'message' => 'Transaction deleted successfully']);
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to delete transaction: ' . $stmt->error]);
        }
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to delete transaction', 'message' => $e->getMessage()]);
    }
}
?> 