<?php

// show all errors
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . '/openAiScraper.php';

$scraper = new OpenAiScraper();

$result = $scraper->processUrl('https://www.trailertown.com/all-inventory/');

print_r($result);