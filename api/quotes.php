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

// Debug: Log request details
error_log("REQUEST_METHOD: " . $_SERVER['REQUEST_METHOD']);
error_log("GET params: " . json_encode($_GET));
error_log("POST data: " . file_get_contents('php://input'));

// Debug: Log session and authentication
error_log("Session dealer_id: " . ($_SESSION['dealer_id'] ?? 'not set'));
error_log("GET dealer_id: " . $dealer_id);
error_log("Using dealer_id: " . $dealer_id);

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
    error_log("Exception: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Internal server error', 'message' => $e->getMessage()]);
}

function handleGetRequest($action, $dealer_id) {
    global $conn, $conn_write;
    
    error_log("handleGetRequest called with action: $action, dealer_id: $dealer_id");
    switch ($action) {
        case 'list':
            getQuotesList($dealer_id);
            break;
        case 'get':
            $quote_id = $_GET['id'] ?? '';
            getQuoteItem($dealer_id, $quote_id);
            break;
        case 'stats':
            getQuotesStats($dealer_id);
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
    
    error_log("handlePostRequest called with action: $action, dealer_id: $dealer_id");
    $input = json_decode(file_get_contents('php://input'), true);
    error_log("Decoded input: " . json_encode($input));
    
    switch ($action) {
        case 'create':
            createQuoteItem($dealer_id, $input);
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
            $quote_id = $_GET['id'] ?? '';
            updateQuoteItem($dealer_id, $quote_id, $input);
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
            $quote_id = $_GET['id'] ?? '';
            deleteQuoteItem($dealer_id, $quote_id);
            break;
        default:
            http_response_code(400);
            echo json_encode(['error' => 'Invalid action']);
            break;
    }
}

function getQuotesList($dealer_id) {
    global $conn, $conn_write;
    
    try {
        error_log("getQuotesList called for dealer_id: $dealer_id");
        
        // Get pagination parameters
        $page = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 1;
        $pageSize = isset($_GET['pageSize']) ? max(1, min(100, (int)$_GET['pageSize'])) : 10;
        $offset = ($page - 1) * $pageSize;
        
        // Get search and filter parameters
        $search = isset($_GET['search']) ? trim($_GET['search']) : '';
        $status_filter = isset($_GET['status']) ? trim($_GET['status']) : '';
        $salesman_filter = isset($_GET['salesman']) ? trim($_GET['salesman']) : '';
        
        // Build WHERE clause
        $where_conditions = ['q.dealer_id = ?'];
        $params = [$dealer_id];
        $param_types = 'i';
        
        if (!empty($search)) {
            $where_conditions[] = '(q.quote_id LIKE ? OR q.customer_name LIKE ? OR q.item_product LIKE ? OR COALESCE(s.salesman_name, q.salesman_name, "") LIKE ?)';
            $search_param = "%{$search}%";
            $params[] = $search_param;
            $params[] = $search_param;
            $params[] = $search_param;
            $params[] = $search_param;
            $param_types .= 'ssss';
        }
        
        if (!empty($status_filter) && in_array($status_filter, ['draft', 'sent', 'accepted', 'declined', 'expired', 'converted'])) {
            $where_conditions[] = 'q.status = ?';
            $params[] = $status_filter;
            $param_types .= 's';
        }
        
        if (!empty($salesman_filter)) {
            $where_conditions[] = 'q.salesman_id = ?';
            $params[] = $salesman_filter;
            $param_types .= 'i';
        }
        
        $where_clause = 'WHERE ' . implode(' AND ', $where_conditions);
        
        // Get total count
        $count_sql = "SELECT COUNT(*) as total FROM dealer_quotes q {$where_clause}";
        $count_stmt = $conn->prepare($count_sql);
        $count_stmt->bind_param($param_types, ...$params);
        $count_stmt->execute();
        $result = $count_stmt->get_result();
        $total_count = $result->fetch_assoc()['total'];
        
        error_log("Found $total_count quotes for dealer $dealer_id");
        
        // Get sort parameters
        $sort_field = isset($_GET['sort']) ? $_GET['sort'] : 'quote_date';
        $sort_direction = isset($_GET['direction']) && $_GET['direction'] === 'desc' ? 'DESC' : 'ASC';
        
        // Validate sort field - use q. prefix for quote table fields
        $allowed_sort_fields = ['quote_id', 'customer_name', 'status', 'total_amount', 'expiry_date', 'quote_date'];
        if (!in_array($sort_field, $allowed_sort_fields)) {
            $sort_field = 'quote_date';
        }
        
        // Get quotes with salesman info
        $sql = "SELECT q.quote_id, q.customer_name, q.phone_number, q.email, q.item_product, 
                       q.status, q.quote_amount, q.tax_amount, q.discount_amount, q.total_amount, 
                       q.expiry_date, q.quote_date, q.notes, q.terms_conditions,
                       q.salesman_id, COALESCE(s.salesman_name, q.salesman_name) as salesman_name,
                       q.created_at, q.updated_at 
                FROM dealer_quotes q
                LEFT JOIN dealer_salesman s ON q.salesman_id = s.salesman_id AND q.dealer_id = s.dealer_id
                {$where_clause} 
                ORDER BY q.{$sort_field} {$sort_direction} 
                LIMIT ? OFFSET ?";
        
        $params[] = $pageSize;
        $params[] = $offset;
        $param_types .= 'ii';
        
        $stmt = $conn->prepare($sql);
        $stmt->bind_param($param_types, ...$params);
        $stmt->execute();
        $result = $stmt->get_result();
        
        $quotes = [];
        while ($row = $result->fetch_assoc()) {
            $quotes[] = $row;
        }
        
        $total_pages = ceil($total_count / $pageSize);
        
        echo json_encode([
            'success' => true,
            'data' => [
                'items' => $quotes,
                'pagination' => [
                    'current_page' => $page,
                    'total_pages' => $total_pages,
                    'total_items' => $total_count,
                    'items_per_page' => $pageSize,
                    'page_size' => $pageSize,
                    'has_prev' => $page > 1,
                    'has_next' => $page < $total_pages
                ]
            ]
        ]);
        
    } catch (Exception $e) {
        error_log("Error in getQuotesList: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch quotes', 'message' => $e->getMessage()]);
    }
}

function getQuoteItem($dealer_id, $quote_id) {
    global $conn, $conn_write;
    
    try {
        if (empty($quote_id)) {
            http_response_code(400);
            echo json_encode(['error' => 'Quote ID is required']);
            return;
        }
        
        $sql = "SELECT q.*, COALESCE(s.salesman_name, q.salesman_name) as salesman_name
                FROM dealer_quotes q
                LEFT JOIN dealer_salesman s ON q.salesman_id = s.salesman_id AND q.dealer_id = s.dealer_id
                WHERE q.dealer_id = ? AND q.quote_id = ?";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param('ii', $dealer_id, $quote_id);
        $stmt->execute();
        $result = $stmt->get_result();
        $quote = $result->fetch_assoc();
        
        if (!$quote) {
            http_response_code(404);
            echo json_encode(['error' => 'Quote not found']);
            return;
        }
        
        echo json_encode(['success' => true, 'data' => $quote]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch quote', 'message' => $e->getMessage()]);
    }
}

function getQuotesStats($dealer_id) {
    global $conn, $conn_write;
    
    try {
        $sql = "SELECT 
                    COUNT(*) as total_quotes,
                    SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft_quotes,
                    SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent_quotes,
                    SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) as accepted_quotes,
                    SUM(CASE WHEN status = 'declined' THEN 1 ELSE 0 END) as declined_quotes,
                    SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired_quotes,
                    SUM(CASE WHEN status = 'converted' THEN 1 ELSE 0 END) as converted_quotes,
                    SUM(CASE WHEN status IN ('draft', 'sent') THEN 1 ELSE 0 END) as pending_quotes,
                    SUM(total_amount) as total_value,
                    AVG(total_amount) as avg_value,
                    SUM(CASE WHEN status IN ('draft', 'sent') THEN total_amount ELSE 0 END) as pending_value,
                    SUM(CASE WHEN status = 'accepted' THEN total_amount ELSE 0 END) as accepted_value
                FROM dealer_quotes 
                WHERE dealer_id = ?";
        
        $stmt = $conn->prepare($sql);
        $stmt->bind_param('i', $dealer_id);
        $stmt->execute();
        $result = $stmt->get_result();
        $stats = $result->fetch_assoc();
        
        // Convert to appropriate data types
        $stats['total_quotes'] = (int)$stats['total_quotes'];
        $stats['draft_quotes'] = (int)$stats['draft_quotes'];
        $stats['sent_quotes'] = (int)$stats['sent_quotes'];
        $stats['accepted_quotes'] = (int)$stats['accepted_quotes'];
        $stats['declined_quotes'] = (int)$stats['declined_quotes'];
        $stats['expired_quotes'] = (int)$stats['expired_quotes'];
        $stats['converted_quotes'] = (int)$stats['converted_quotes'];
        $stats['pending_quotes'] = (int)$stats['pending_quotes'];
        $stats['total_value'] = (float)$stats['total_value'];
        $stats['avg_value'] = (float)$stats['avg_value'];
        $stats['pending_value'] = (float)$stats['pending_value'];
        $stats['accepted_value'] = (float)$stats['accepted_value'];
        
        echo json_encode(['success' => true, 'data' => $stats]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch stats', 'message' => $e->getMessage()]);
    }
}

function getSalesmenList($dealer_id) {
    global $conn, $conn_write;
    
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

function createQuoteItem($dealer_id, $data) {
    global $conn, $conn_write;
    
    try {
        error_log("createQuoteItem called for dealer_id: $dealer_id");
        error_log("Input data: " . json_encode($data));
        
        // Validate required fields
        if (empty($data['customer_name']) || empty($data['item_product']) || 
            !isset($data['quote_amount']) || empty($data['expiry_date'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing required fields: customer_name, item_product, quote_amount, expiry_date']);
            return;
        }
        
        // Validate status if provided
        if (isset($data['status']) && !in_array($data['status'], ['draft', 'sent', 'accepted', 'declined', 'expired', 'converted'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid status']);
            return;
        }
        
        // Simplified approach - use minimal required fields only
        $sql = "INSERT INTO dealer_quotes 
                (dealer_id, customer_name, phone_number, email, item_product, 
                 quote_amount, tax_amount, discount_amount, status, 
                 expiry_date, quote_date, notes, terms_conditions) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        
        // Prepare safe values
        $customer_name = trim($data['customer_name']);
        $phone_number = trim($data['phone_number'] ?? '');
        $email = trim($data['email'] ?? '');
        $item_product = trim($data['item_product']);
        $quote_amount = (float)$data['quote_amount'];
        $tax_amount = (float)($data['tax_amount'] ?? 0);
        $discount_amount = (float)($data['discount_amount'] ?? 0);
        $status = $data['status'] ?? 'draft'; // Use status from form data, default to 'draft'
        $expiry_date = $data['expiry_date'];
        $quote_date = date('Y-m-d');
        $notes = trim($data['notes'] ?? '');
        $terms_conditions = trim($data['terms_conditions'] ?? '');
        
        error_log("Inserting with values: dealer_id=$dealer_id, customer=$customer_name, amount=$quote_amount, status=$status");
        
        $stmt = $conn_write->prepare($sql);
        
        if (!$stmt) {
            error_log("Database prepare failed: " . $conn_write->error);
            http_response_code(500);
            echo json_encode(['error' => 'Database prepare failed: ' . $conn_write->error]);
            return;
        }
        
        $stmt->bind_param('issssdddsssss', 
            $dealer_id,
            $customer_name,
            $phone_number,
            $email,
            $item_product,
            $quote_amount,
            $tax_amount,
            $discount_amount,
            $status,
            $expiry_date,
            $quote_date,
            $notes,
            $terms_conditions
        );
        
        $result = $stmt->execute();
        
        if ($result) {
            $quote_id = $conn_write->insert_id;
            
            // Now update with salesman info if provided
            if (!empty($data['salesman_id']) && $data['salesman_id'] !== 'null') {
                $salesman_id = (int)$data['salesman_id'];
                $update_sql = "UPDATE dealer_quotes SET salesman_id = ? WHERE quote_id = ?";
                $update_stmt = $conn_write->prepare($update_sql);
                $update_stmt->bind_param('ii', $salesman_id, $quote_id);
                $update_stmt->execute();
                error_log("Updated quote $quote_id with salesman_id $salesman_id");
            }
            
            error_log("Quote created successfully with ID: $quote_id");
            echo json_encode([
                'success' => true,
                'message' => 'Quote created successfully',
                'data' => ['quote_id' => $quote_id]
            ]);
        } else {
            error_log("Execute failed: " . $stmt->error);
            http_response_code(500);
            echo json_encode(['error' => 'Failed to create quote: ' . $stmt->error]);
        }
        
    } catch (Exception $e) {
        error_log("Exception in createQuoteItem: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Failed to create quote', 'message' => $e->getMessage()]);
    }
}

function updateQuoteItem($dealer_id, $quote_id, $data) {
    global $conn, $conn_write;
    
    try {
        if (empty($quote_id)) {
            http_response_code(400);
            echo json_encode(['error' => 'Quote ID is required']);
            return;
        }
        
        // Check if quote exists and belongs to dealer
        $check_sql = "SELECT quote_id FROM dealer_quotes WHERE dealer_id = ? AND quote_id = ?";
        $check_stmt = $conn->prepare($check_sql);
        $check_stmt->bind_param('ii', $dealer_id, $quote_id);
        $check_stmt->execute();
        $result = $check_stmt->get_result();
        
        if (!$result->fetch_assoc()) {
            http_response_code(404);
            echo json_encode(['error' => 'Quote not found']);
            return;
        }
        
        // Validate required fields if provided
        if (isset($data['quote_amount']) && (!is_numeric($data['quote_amount']) || $data['quote_amount'] < 0)) {
            http_response_code(400);
            echo json_encode(['error' => 'Quote amount must be a valid positive number']);
            return;
        }
        
        if (isset($data['status']) && !in_array($data['status'], ['draft', 'sent', 'accepted', 'declined', 'expired', 'converted'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid status']);
            return;
        }
        
        // Handle salesman assignment if provided
        if (isset($data['salesman_id']) && $data['salesman_id'] !== '') {
            $salesman_id = (int)$data['salesman_id'];
            $salesman_sql = "SELECT salesman_name FROM dealer_salesman WHERE dealer_id = ? AND salesman_id = ? AND status = 'active'";
            $salesman_stmt = $conn->prepare($salesman_sql);
            $salesman_stmt->bind_param('ii', $dealer_id, $salesman_id);
            $salesman_stmt->execute();
            $salesman_result = $salesman_stmt->get_result();
            
            if ($salesman_row = $salesman_result->fetch_assoc()) {
                $data['salesman_name'] = $salesman_row['salesman_name'];
                $data['salesman_id'] = $salesman_id;
            } else {
                unset($data['salesman_id']);
                unset($data['salesman_name']);
            }
        } elseif (isset($data['salesman_id']) && $data['salesman_id'] === '') {
            // Clear salesman assignment
            $data['salesman_id'] = null;
            $data['salesman_name'] = null;
        }
        
        // Build update query dynamically
        $update_fields = [];
        $params = [];
        $param_types = '';
        
        $allowed_fields = ['customer_name', 'phone_number', 'email', 'item_product', 'salesman_id', 'salesman_name', 
                          'quote_amount', 'tax_amount', 'discount_amount', 'status', 'expiry_date', 'notes', 'terms_conditions'];
        
        foreach ($allowed_fields as $field) {
            if (array_key_exists($field, $data)) {
                $update_fields[] = "{$field} = ?";
                $params[] = $data[$field];
                
                if (in_array($field, ['quote_amount', 'tax_amount', 'discount_amount'])) {
                    $param_types .= 'd';
                } elseif ($field === 'salesman_id') {
                    $param_types .= 'i';
                } else {
                    $param_types .= 's';
                }
            }
        }
        
        if (empty($update_fields)) {
            http_response_code(400);
            echo json_encode(['error' => 'No valid fields to update']);
            return;
        }
        
        // Add updated_at timestamp
        $update_fields[] = 'updated_at = NOW()';
        
        // Add dealer_id and quote_id for WHERE clause
        $params[] = $dealer_id;
        $params[] = $quote_id;
        $param_types .= 'ii';
        
        $sql = "UPDATE dealer_quotes SET " . implode(', ', $update_fields) . " WHERE dealer_id = ? AND quote_id = ?";
        
        $stmt = $conn_write->prepare($sql);
        $stmt->bind_param($param_types, ...$params);
        
        if ($stmt->execute()) {
            echo json_encode(['success' => true, 'message' => 'Quote updated successfully']);
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to update quote: ' . $stmt->error]);
        }
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to update quote', 'message' => $e->getMessage()]);
    }
}

function deleteQuoteItem($dealer_id, $quote_id) {
    global $conn, $conn_write;
    
    try {
        if (empty($quote_id)) {
            http_response_code(400);
            echo json_encode(['error' => 'Quote ID is required']);
            return;
        }
        
        // Check if quote exists and belongs to dealer
        $check_sql = "SELECT quote_id FROM dealer_quotes WHERE dealer_id = ? AND quote_id = ?";
        $check_stmt = $conn->prepare($check_sql);
        $check_stmt->bind_param('ii', $dealer_id, $quote_id);
        $check_stmt->execute();
        $result = $check_stmt->get_result();
        
        if (!$result->fetch_assoc()) {
            http_response_code(404);
            echo json_encode(['error' => 'Quote not found']);
            return;
        }
        
        // Delete the quote
        $delete_sql = "DELETE FROM dealer_quotes WHERE dealer_id = ? AND quote_id = ?";
        $delete_stmt = $conn_write->prepare($delete_sql);
        $delete_stmt->bind_param('ii', $dealer_id, $quote_id);
        
        if ($delete_stmt->execute()) {
            echo json_encode(['success' => true, 'message' => 'Quote deleted successfully']);
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to delete quote: ' . $delete_stmt->error]);
        }
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to delete quote', 'message' => $e->getMessage()]);
    }
}

?> 