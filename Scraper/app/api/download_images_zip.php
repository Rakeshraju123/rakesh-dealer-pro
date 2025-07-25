<?php

require_once __DIR__ . '/../controllers/openAiScraper.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new Exception('Only POST method is allowed');
    }
    
    // Get JSON input
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input) {
        throw new Exception('Invalid JSON input');
    }
    
    $images = $input['images'] ?? [];
    $zipName = $input['zipName'] ?? 'trailer_images_' . date('Y-m-d_H-i-s');
    
    if (empty($images) || !is_array($images)) {
        throw new Exception('Images array is required');
    }
    
    // Check if ZIP extension is available
    if (!class_exists('ZipArchive')) {
        throw new Exception('ZIP functionality is not available on this server');
    }
    
    // Initialize HTTP client
    $client = new GuzzleHttp\Client([
        'timeout' => 30,
        'headers' => [
            'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept' => 'image/webp,image/apng,image/*,*/*;q=0.8',
            'Accept-Language' => 'en-US,en;q=0.9',
        ],
        'verify' => true,
        'allow_redirects' => true
    ]);
    
    // Create temporary ZIP file
    $tempZipPath = sys_get_temp_dir() . '/' . uniqid('trailer_images_') . '.zip';
    $zip = new ZipArchive();
    
    if ($zip->open($tempZipPath, ZipArchive::CREATE) !== TRUE) {
        throw new Exception('Cannot create ZIP file');
    }
    
    $downloadedCount = 0;
    $errors = [];
    
    foreach ($images as $index => $image) {
        try {
            $imageUrl = $image['url'] ?? $image;
            $imageName = $image['name'] ?? $image['alt'] ?? '';
            
            if (empty($imageUrl)) {
                $errors[] = "Image #" . ($index + 1) . ": No URL provided";
                continue;
            }
            
            // Validate URL
            if (!filter_var($imageUrl, FILTER_VALIDATE_URL)) {
                $errors[] = "Image #" . ($index + 1) . ": Invalid URL";
                continue;
            }
            
            // Additional security check - only allow http/https URLs
            $urlParts = parse_url($imageUrl);
            if (!in_array($urlParts['scheme'] ?? '', ['http', 'https'])) {
                $errors[] = "Image #" . ($index + 1) . ": Only HTTP and HTTPS URLs are allowed";
                continue;
            }
            
            // Fetch the image with custom referer
            $referer = parse_url($imageUrl, PHP_URL_SCHEME) . '://' . parse_url($imageUrl, PHP_URL_HOST) . '/';
            $response = $client->get($imageUrl, [
                'headers' => [
                    'Referer' => $referer
                ]
            ]);
            
            if ($response->getStatusCode() !== 200) {
                $errors[] = "Image #" . ($index + 1) . ": HTTP " . $response->getStatusCode();
                continue;
            }
            
            $imageData = $response->getBody()->getContents();
            $contentType = $response->getHeader('Content-Type')[0] ?? 'application/octet-stream';
            
            // Determine file extension
            $extension = '';
            if (strpos($contentType, 'jpeg') !== false || strpos($contentType, 'jpg') !== false) {
                $extension = '.jpg';
            } elseif (strpos($contentType, 'png') !== false) {
                $extension = '.png';
            } elseif (strpos($contentType, 'gif') !== false) {
                $extension = '.gif';
            } elseif (strpos($contentType, 'webp') !== false) {
                $extension = '.webp';
            } else {
                // Try to get extension from URL
                $urlPath = parse_url($imageUrl, PHP_URL_PATH);
                $pathExtension = pathinfo($urlPath, PATHINFO_EXTENSION);
                if ($pathExtension) {
                    $extension = '.' . strtolower($pathExtension);
                } else {
                    $extension = '.jpg';
                }
            }
            
            // Generate filename
            if (empty($imageName)) {
                $filename = 'image_' . ($index + 1) . $extension;
            } else {
                // Clean the name and ensure it has proper extension
                $filename = preg_replace('/[^a-zA-Z0-9_\-\.]/', '_', $imageName);
                $filename = preg_replace('/\.[^.]+$/', '', $filename); // Remove existing extension
                $filename = $filename . $extension;
            }
            
            // Ensure unique filename in ZIP
            $originalFilename = $filename;
            $counter = 1;
            while ($zip->locateName($filename) !== false) {
                $filenameWithoutExt = preg_replace('/\.[^.]+$/', '', $originalFilename);
                $filename = $filenameWithoutExt . '_' . $counter . $extension;
                $counter++;
            }
            
            // Add to ZIP
            if ($zip->addFromString($filename, $imageData)) {
                $downloadedCount++;
            } else {
                $errors[] = "Image #" . ($index + 1) . ": Failed to add to ZIP";
            }
            
        } catch (Exception $e) {
            $errors[] = "Image #" . ($index + 1) . ": " . $e->getMessage();
        }
    }
    
    // Close the ZIP file
    if (!$zip->close()) {
        throw new Exception('Failed to finalize ZIP file');
    }
    
    if ($downloadedCount === 0) {
        unlink($tempZipPath);
        throw new Exception('No images could be downloaded. Errors: ' . implode('; ', $errors));
    }
    
    // Check if ZIP file was created and has content
    if (!file_exists($tempZipPath) || filesize($tempZipPath) === 0) {
        if (file_exists($tempZipPath)) {
            unlink($tempZipPath);
        }
        throw new Exception('Failed to create ZIP file with images');
    }
    
    $zipSize = filesize($tempZipPath);
    $zipName = preg_replace('/[^a-zA-Z0-9_\-]/', '_', $zipName);
    
    // Set headers for ZIP download
    header('Content-Type: application/zip');
    header('Content-Disposition: attachment; filename="' . $zipName . '.zip"');
    header('Content-Length: ' . $zipSize);
    header('Cache-Control: no-cache, must-revalidate');
    header('Expires: 0');
    
    // Output the ZIP file
    readfile($tempZipPath);
    
    // Clean up temporary file
    unlink($tempZipPath);
    
} catch (Exception $e) {
    // Clean up temp file if it exists
    if (isset($tempZipPath) && file_exists($tempZipPath)) {
        unlink($tempZipPath);
    }
    
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
} 