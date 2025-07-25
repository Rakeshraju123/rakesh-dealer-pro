<?php
// inventory_management.php - API endpoint for CRUD operations on inventory
// ini_set('display_errors', 1);
// ini_set('display_startup_errors', 1);
// error_reporting(E_ALL);

// Include multi-tenant database connection and authentication
require_once '/var/www/dealer/dbConnect1.php';
require_once '/var/www/dealer/includes/AuthMiddleware.php';
require_once '/var/www/dealer/includes/TenantManager.php';
require_once '/var/www/dealer/config/database1.php';

// Start session if not already started
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Check if dealer is authenticated
if (!isset($_SESSION['dealer_id']) && !isset($_GET['dealer_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

$dealer_id = $_GET['dealer_id'] ?? $_SESSION['dealer_id'];

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
    echo json_encode(['success' => false, 'message' => 'Database connection failed']);
    exit;
}

header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    // READ: Get all or single inventory item
    if (isset($_GET['id'])) {
        $id = intval($_GET['id']);
        $stmt = $conn->prepare("SELECT * FROM dealer_inventory WHERE inventory_id = ? AND dealer_id = ?");
        $stmt->bind_param("ii", $id, $dealer_id);
        $stmt->execute();
        $result = $stmt->get_result();
        $item = $result->fetch_assoc();
        if ($item) {
            echo json_encode(['success' => true, 'data' => $item]);
        } else {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Item not found']);
        }
    } else {
        $stmt = $conn->prepare("SELECT * FROM dealer_inventory WHERE dealer_id = ? ORDER BY inventory_id DESC");
        $stmt->bind_param("i", $dealer_id);
        $stmt->execute();
        $result = $stmt->get_result();
        $items = [];
        while ($row = $result->fetch_assoc()) {
            $items[] = $row;
        }
        echo json_encode(['success' => true, 'data' => $items]);
    }
    exit;
}

// For POST, handle create, update, delete
$contentType = isset($_SERVER["CONTENT_TYPE"]) ? trim($_SERVER["CONTENT_TYPE"]) : '';
if (strpos($contentType, 'application/json') !== false) {
    $rawInput = file_get_contents('php://input');
    $data = json_decode($rawInput, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid JSON: ' . json_last_error_msg()]);
        exit;
    }
} else {
    $data = $_POST;
}

$action = isset($data['action']) ? $data['action'] : '';

if ($method === 'POST') {
    if ($action === 'create') {
        // CREATE
        $required = ['manufacturer', 'model', 'year', 'category', 'condition', 'cost_price', 'selling_price', 'status', 'date_added'];
        $missing = [];
        foreach ($required as $field) {
            if (empty($data[$field])) $missing[] = $field;
        }
        if ($missing) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Missing fields', 'fields' => $missing]);
            exit;
        }
        
        $stmt = $conn_write->prepare("INSERT INTO dealer_inventory (
            stock_id, dealer_id, manufacturer, model, year, category, `condition`, color, size,
            cost_price, selling_price, status, date_added, description
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        
        // Assign all values to variables first
        $stock_id       = !empty($data['stock_id']) ? $data['stock_id'] : null;
        $manufacturer   = $data['manufacturer'] ?? '';
        $model          = $data['model'] ?? '';
        $year           = $data['year'] ?? 0;
        $category       = $data['category'] ?? $data['type'] ?? '';
        $condition      = $data['condition'] ?? '';
        $color          = $data['color'] ?? '';
        $size           = $data['size'] ?? '';
        $cost_price     = $data['cost_price'] ?? 0;
        $selling_price  = $data['selling_price'] ?? 0;
        $status         = $data['status'] ?? '';
        $date_added     = $data['date_added'] ?? '';
        $description    = $data['description'] ?? '';
        
        // Now pass only variables to bind_param
        $stmt->bind_param(
            "sississssddsss",
            $stock_id,
            $dealer_id,
            $manufacturer,
            $model,
            $year,
            $category,
            $condition,
            $color,
            $size,
            $cost_price,
            $selling_price,
            $status,
            $date_added,
            $description
        );
        
        if ($stmt->execute()) {
            echo json_encode(['success' => true, 'message' => 'Inventory item created', 'id' => $conn_write->insert_id]);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'DB error: ' . $stmt->error]);
        }
        exit;
    } elseif ($action === 'update') {
        // UPDATE
        if (empty($data['id'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Missing id']);
            exit;
        }
        
        $fields = ['stock_id', 'manufacturer', 'model', 'year', 'category', 'condition', 'color', 'size', 'cost_price', 'selling_price', 'status', 'date_added', 'description'];
        $set = [];
        $params = [];
        $types = '';
        
        foreach ($fields as $field) {
            if (isset($data[$field])) {
                if ($field === 'stock_id') {
                    $set[] = "`$field` = ?";
                    $params[] = !empty($data[$field]) ? $data[$field] : null;
                    $types .= 's';
                } else {
                    $set[] = "`$field` = ?";
                    $params[] = $data[$field];
                    $types .= is_numeric($data[$field]) ? 'd' : 's';
                }
            }
        }
        
        $params[] = $data['id'];
        $types .= 'i';
        
        $sql = "UPDATE dealer_inventory SET " . implode(', ', $set) . ", updated_at = NOW() WHERE inventory_id = ? AND dealer_id = ?";
        $params[] = $dealer_id;
        $types .= 'i';
        $stmt = $conn_write->prepare($sql);
        $stmt->bind_param($types, ...$params);
        
        if ($stmt->execute()) {
            echo json_encode(['success' => true, 'message' => 'Inventory item updated']);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'DB error: ' . $stmt->error]);
        }
        exit;
    } elseif ($action === 'update_status') {
        // UPDATE STATUS ONLY
        if (empty($data['id'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Missing id']);
            exit;
        }
        
        if (empty($data['status'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Missing status']);
            exit;
        }
        
        // Validate status
        $valid_statuses = ['available', 'sold', 'reserved', 'maintenance'];
        if (!in_array($data['status'], $valid_statuses)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Invalid status']);
            exit;
        }
        
        $stmt = $conn_write->prepare("UPDATE dealer_inventory SET status = ?, updated_at = NOW() WHERE inventory_id = ? AND dealer_id = ?");
        $stmt->bind_param("sii", $data['status'], $data['id'], $dealer_id);
        
        if ($stmt->execute()) {
            echo json_encode(['success' => true, 'message' => 'Status updated successfully']);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'DB error: ' . $stmt->error]);
        }
        exit;
    } elseif ($action === 'delete') {
        // DELETE
        if (empty($data['id'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Missing id']);
            exit;
        }
        $stmt = $conn_write->prepare("DELETE FROM dealer_inventory WHERE inventory_id = ? AND dealer_id = ?");
        $stmt->bind_param("ii", $data['id'], $dealer_id);
        if ($stmt->execute()) {
            echo json_encode(['success' => true, 'message' => 'Inventory item deleted']);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'DB error: ' . $stmt->error]);
        }
        exit;
    } else {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid action']);
        exit;
    }
}

http_response_code(405);
echo json_encode(['success' => false, 'message' => 'Method not allowed']);
exit;
?>