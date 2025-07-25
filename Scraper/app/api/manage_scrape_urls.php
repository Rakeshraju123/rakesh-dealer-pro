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

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Get the request method and action
$method = $_SERVER['REQUEST_METHOD'];
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
            handleGetRequest($dealer_id);
            break;
        case 'POST':
            handlePostRequest($dealer_id);
            break;
        case 'DELETE':
            handleDeleteRequest($dealer_id);
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

function handleGetRequest($dealer_id) {
    global $conn;
    
    // Get all saved URLs for suggestions
    try {
        $stmt = $conn->prepare("
            SELECT id, url, title, description, last_used, use_count, created_at 
            FROM dealer_scrape_urls 
            WHERE dealer_id = ? 
            ORDER BY use_count DESC, last_used DESC 
            LIMIT 20
        ");
        $stmt->bind_param("i", $dealer_id);
        $stmt->execute();
        $result = $stmt->get_result();
        
        $urls = [];
        while ($row = $result->fetch_assoc()) {
            $urls[] = $row;
        }
        
        echo json_encode([
            'success' => true,
            'data' => $urls
        ]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error' => 'Database error: ' . $e->getMessage()
        ]);
    }
}

function handlePostRequest($dealer_id) {
    global $conn, $conn_write;
    
    // Save or update a URL
    try {
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (!$input) {
            $input = $_POST;
        }
        
        $url = $input['url'] ?? '';
        $title = $input['title'] ?? '';
        $description = $input['description'] ?? '';
        
        if (empty($url)) {
            throw new Exception('URL is required');
        }
        
        // Check if URL already exists
        $check_stmt = $conn->prepare("SELECT id, use_count FROM dealer_scrape_urls WHERE url = ? AND dealer_id = ?");
        $check_stmt->bind_param("si", $url, $dealer_id);
        $check_stmt->execute();
        $existing = $check_stmt->get_result()->fetch_assoc();
        
        if ($existing) {
            // Update existing URL
            $new_count = $existing['use_count'] + 1;
            $update_stmt = $conn_write->prepare("
                UPDATE dealer_scrape_urls 
                SET use_count = ?, last_used = CURRENT_TIMESTAMP, 
                    title = COALESCE(NULLIF(?, ''), title),
                    description = COALESCE(NULLIF(?, ''), description)
                WHERE id = ?
            ");
            $update_stmt->bind_param("issi", $new_count, $title, $description, $existing['id']);
            $update_stmt->execute();
            
            echo json_encode([
                'success' => true,
                'message' => 'URL updated',
                'id' => $existing['id'],
                'use_count' => $new_count
            ]);
        } else {
            // Insert new URL
            $insert_stmt = $conn_write->prepare("
                INSERT INTO dealer_scrape_urls (dealer_id, url, title, description, use_count) 
                VALUES (?, ?, ?, ?, 1)
            ");
            $insert_stmt->bind_param("isss", $dealer_id, $url, $title, $description);
            $insert_stmt->execute();
            
            echo json_encode([
                'success' => true,
                'message' => 'URL saved',
                'id' => $conn_write->insert_id
            ]);
        }
    } catch (Exception $e) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => $e->getMessage()
        ]);
    }
}

function handleDeleteRequest($dealer_id) {
    global $conn_write;
    
    // Delete a saved URL
    try {
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (!$input) {
            $input = $_POST;
        }
        
        $id = $input['id'] ?? '';
        
        if (empty($id)) {
            throw new Exception('ID is required');
        }
        
        $stmt = $conn_write->prepare("DELETE FROM dealer_scrape_urls WHERE id = ? AND dealer_id = ?");
        $stmt->bind_param("ii", $id, $dealer_id);
        $stmt->execute();
        
        if ($stmt->affected_rows > 0) {
            echo json_encode([
                'success' => true,
                'message' => 'URL deleted'
            ]);
        } else {
            http_response_code(404);
            echo json_encode([
                'success' => false,
                'error' => 'URL not found'
            ]);
        }
    } catch (Exception $e) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => $e->getMessage()
        ]);
    }
}
?> 