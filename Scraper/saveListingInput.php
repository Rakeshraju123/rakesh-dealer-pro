<?php
$data = $_POST['payload'];
file_put_contents("listing_input.json", $data);
echo "Saved";
?>
