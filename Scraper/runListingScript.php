<?php
$output = shell_exec("XDG_CACHE_HOME=/var/www/html/trailerScraper_s/.cache python3 create_listing.py 2>&1");
echo nl2br($output);
?>
