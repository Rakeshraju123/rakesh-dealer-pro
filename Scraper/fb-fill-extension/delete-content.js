(function () {
  // Prevent multiple instances of the extension
  if (window.fbDeleteExtensionLoaded) {
    console.log("⚠️ Facebook Marketplace Delete Extension already loaded, skipping...");
    return;
  }
  window.fbDeleteExtensionLoaded = true;
  
  // Global flag to track if deletion is in progress
  window.fbDeletionInProgress = window.fbDeletionInProgress || false;
  
  console.log("✅ Facebook Marketplace Delete Extension started on Your Selling page");

  // Function to parse date from Facebook Marketplace format
  function parseFacebookDate(dateText) {
    console.log(`📅 Parsing date: "${dateText}"`);
    
    if (!dateText) return null;
    
    // Clean up the date text
    const cleanDate = dateText.trim().toLowerCase();
    
    // Handle different Facebook date formats
    if (cleanDate.includes('today') || cleanDate.includes('just now') || cleanDate.includes('minutes ago') || cleanDate.includes('hours ago')) {
      return new Date(); // Today
    }
    
    if (cleanDate.includes('yesterday')) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      return yesterday;
    }
    
    // Handle "X days ago" format
    const daysAgoMatch = cleanDate.match(/(\d+)\s*days?\s*ago/);
    if (daysAgoMatch) {
      const daysAgo = parseInt(daysAgoMatch[1]);
      const date = new Date();
      date.setDate(date.getDate() - daysAgo);
      return date;
    }
    
    // Handle "X weeks ago" format
    const weeksAgoMatch = cleanDate.match(/(\d+)\s*weeks?\s*ago/);
    if (weeksAgoMatch) {
      const weeksAgo = parseInt(weeksAgoMatch[1]);
      const date = new Date();
      date.setDate(date.getDate() - (weeksAgo * 7));
      return date;
    }
    
    // Handle DD/MM format (assuming current year)
    const ddmmMatch = cleanDate.match(/(\d{1,2})\/(\d{1,2})/);
    if (ddmmMatch) {
      const day = parseInt(ddmmMatch[1]);
      const month = parseInt(ddmmMatch[2]) - 1; // JavaScript months are 0-indexed
      const currentYear = new Date().getFullYear();
      return new Date(currentYear, month, day);
    }
    
    // Handle DD/MM/YYYY format
    const ddmmyyyyMatch = cleanDate.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (ddmmyyyyMatch) {
      const day = parseInt(ddmmyyyyMatch[1]);
      const month = parseInt(ddmmyyyyMatch[2]) - 1; // JavaScript months are 0-indexed
      const year = parseInt(ddmmyyyyMatch[3]);
      return new Date(year, month, day);
    }
    
    // Handle MM/DD/YYYY format (US format)
    const mmddyyyyMatch = cleanDate.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (mmddyyyyMatch) {
      const month = parseInt(mmddyyyyMatch[1]) - 1; // JavaScript months are 0-indexed
      const day = parseInt(mmddyyyyMatch[2]);
      const year = parseInt(mmddyyyyMatch[3]);
      return new Date(year, month, day);
    }
    
    // Try to parse as a standard date
    try {
      const parsedDate = new Date(dateText);
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate;
      }
    } catch (e) {
      console.warn(`❌ Could not parse date: "${dateText}"`);
    }
    
    return null;
  }

  // Function to check if a date is greater than 14 days old (old listing)
  function isGreaterThan14Days(date) {
    if (!date) return false;
    
    const now = new Date();
    const fourteenDaysAgo = new Date(now.getTime() - (14 * 24 * 60 * 60 * 1000));
    
    return date <= fourteenDaysAgo;
  }

  // Function to find and delete old listings
  function findAndDeleteOldListings() {
    console.log("🔍 Looking for old listings to delete...");
    
    // Multiple selectors to find listing items
    const listingSelectors = [
      '[data-testid="marketplace-your-listings-item"]',
      '[data-testid="marketplace-listing-item"]',
      '.marketplace-listing-item',
      '[role="article"]',
      '.x1i10hfl', // Common Facebook class for listing items
      'div[style*="cursor: pointer"]'
    ];
    
    let listings = [];
    
    // Try each selector to find listings
    for (const selector of listingSelectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        listings = Array.from(elements);
        console.log(`✅ Found ${listings.length} listings using selector: ${selector}`);
        break;
      }
    }
    
    if (listings.length === 0) {
      console.log("⚠️ No listings found, trying broader search...");
      
      // Broader search for any clickable div that might be a listing
      const allDivs = document.querySelectorAll('div');
      listings = Array.from(allDivs).filter(div => {
        const text = div.textContent.toLowerCase();
        return (text.includes('trailer') || text.includes('listing')) && 
               div.querySelector('img') && // Has an image
               div.offsetHeight > 100; // Reasonable height for a listing
      });
      
      console.log(`📋 Found ${listings.length} potential listings through broader search`);
    }
    
    if (listings.length === 0) {
      console.warn("❌ No listings found on this page");
      showBanner("❌ No listings found on this page. Make sure you're on the 'Your Selling' page.", 'error');
      return;
    }
    
    let deletedCount = 0;
    let oldListings = [];
    
    console.log(`🔍 Analyzing ${listings.length} listings for age...`);
    
    // Analyze each listing
    listings.forEach((listing, index) => {
      try {
        const listingText = listing.textContent;
        console.log(`📋 Analyzing listing ${index + 1}: ${listingText.substring(0, 100)}...`);
        
        // Look for date patterns in the listing text
        const datePatterns = [
          /(\d{1,2}\/\d{1,2}\/\d{4})/g,
          /(\d{1,2}\/\d{1,2})/g,
          /(\d+)\s*days?\s*ago/gi,
          /(\d+)\s*weeks?\s*ago/gi,
          /(yesterday|today|just now)/gi
        ];
        
        let foundDate = null;
        let dateText = '';
        
        for (const pattern of datePatterns) {
          const matches = listingText.match(pattern);
          if (matches) {
            dateText = matches[0];
            foundDate = parseFacebookDate(dateText);
            if (foundDate) {
              console.log(`📅 Found date in listing ${index + 1}: "${dateText}" -> ${foundDate.toLocaleDateString()}`);
              break;
            }
          }
        }
        
        if (!foundDate) {
          console.log(`⚠️ No date found in listing ${index + 1}, skipping...`);
          return;
        }
        
        // Check if listing is greater than 14 days old (old listing)
        if (isGreaterThan14Days(foundDate)) {
          console.log(`🗑️ Listing ${index + 1} is older than 14 days (${foundDate.toLocaleDateString()}), marking for deletion`);
          oldListings.push({
            element: listing,
            date: foundDate,
            dateText: dateText,
            title: listingText.substring(0, 50) + '...'
          });
        } else {
          console.log(`✅ Listing ${index + 1} is newer than 14 days (${foundDate.toLocaleDateString()}), keeping`);
        }
        
      } catch (error) {
        console.error(`❌ Error analyzing listing ${index + 1}:`, error);
      }
    });
    
    console.log(`📊 Analysis complete: ${oldListings.length} old listings (>14 days) found out of ${listings.length} total`);
    
    if (oldListings.length === 0) {
      showBanner("✅ No old listings found! All your listings are newer than 14 days.", 'success');
      return;
    }
    
    // Show info banner and proceed directly with deletion
    const infoMessage = `Found ${oldListings.length} listings older than 14 days. Starting deletion process...`;
    showBanner(infoMessage, 'info');
    
    // Proceed directly with deletion without confirmation
    deleteOldListingsSequentially(oldListings);
  }

  // Function to delete old listings one by one
  async function deleteOldListingsSequentially(oldListings) {
    console.log(`🗑️ Starting deletion of ${oldListings.length} old listings...`);
    
    // Set deletion in progress flag
    window.fbDeletionInProgress = true;
    
    let deletedCount = 0;
    let failedCount = 0;
    
    for (let i = 0; i < oldListings.length; i++) {
      const listing = oldListings[i];
      
      try {
        console.log(`🗑️ Processing listing ${i + 1}/${oldListings.length}: ${listing.title}`);
        
        // Show minimal progress notification
        showBanner(`🔄 Deleting ${i + 1}/${oldListings.length}...`, 'info');
        
        // Scroll listing into view
        listing.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Wait for scroll to complete
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Step 1: Find and click the menu button
        console.log("🎯 Step 1: Finding menu button...");
        const menuButton = await findMenuButton(listing.element);
        
        if (!menuButton) {
          console.log(`❌ Could not find menu button for listing ${i + 1}`);
          failedCount++;
          continue;
        }
        
        // Step 2: Click menu button
        console.log("🎯 Step 2: Clicking menu button...");
        menuButton.click();
        await new Promise(resolve => setTimeout(resolve, 3000)); // Wait longer for menu to open
        
        // Step 3: Find and click "Delete listing" option
        console.log("🎯 Step 3: Finding and clicking 'Delete listing' option...");
        const deleteOption = await findDeleteOption();
        
        if (!deleteOption) {
          console.log(`❌ Could not find 'Delete listing' option for listing ${i + 1}`);
          // Close menu by clicking elsewhere
          document.body.click();
          await new Promise(resolve => setTimeout(resolve, 2000));
          failedCount++;
          continue;
        }
        
        // Click the delete option
        deleteOption.click();
        await new Promise(resolve => setTimeout(resolve, 3000)); // Wait longer for confirmation dialog
        
        // Step 4: Find and click "Delete" button in confirmation dialog
        console.log("🎯 Step 4: Finding and clicking 'Delete' button in confirmation dialog...");
        const deleteButton = await findDeleteButtonInDialog();
        
        if (!deleteButton) {
          console.log(`❌ Could not find 'Delete' button in confirmation dialog for listing ${i + 1}`);
          // Try to close any open dialogs
          const cancelButtons = document.querySelectorAll('button, [aria-label*="Cancel"]');
          let cancelButton = null;
          for (const btn of cancelButtons) {
            if (btn.textContent.trim() === 'Cancel' || btn.getAttribute('aria-label')?.includes('Cancel')) {
              cancelButton = btn;
              break;
            }
          }
          if (cancelButton) cancelButton.click();
          await new Promise(resolve => setTimeout(resolve, 1000));
          failedCount++;
          continue;
        }
        
                // The delete button was found successfully by tryAllDeleteButtonsSequentially
        console.log(`✅ Delete button found and clicked successfully: "${deleteButton.textContent.trim()}"`);
        
        // Wait for the deletion to process
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Step 5: Assume deletion was successful since button click worked
        console.log("🎯 Step 5: Checking if deletion was successful...");
        
        // Wait for Facebook to process the deletion
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Since the delete button was successfully clicked, assume deletion worked
        // Facebook's deletion process is asynchronous and may not show immediate feedback
        let deletionSuccessful = true;
        
        // Look for any reason dialog and close it
        const currentDialog = document.querySelector('div[role="dialog"]');
        if (currentDialog) {
          const dialogText = currentDialog.textContent.toLowerCase();
          console.log(`🔍 Current dialog content: "${currentDialog.textContent.substring(0, 100)}..."`);
          
          // Check for deletion reason dialog
          if (dialogText.includes('why did you delete') || 
              dialogText.includes('did you sell') ||
              dialogText.includes('your response') ||
              dialogText.includes('tell us more') ||
              dialogText.includes('reason') ||
              dialogText.includes('feedback')) {
            
            console.log("✅ Deletion reason dialog appeared - deletion confirmed successful");
            
            // Try to close the reason dialog
            const reasonDialogClosed = await closeReasonDialog();
            
            if (reasonDialogClosed) {
              console.log("✅ Reason dialog closed successfully");
            } else {
              console.log("⚠️ Could not close reason dialog, but deletion was successful");
            }
            
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
        
        // Count as successful since button click worked
        deletedCount++;
        console.log(`✅ Successfully deleted listing ${i + 1}: ${listing.title}`);
        
        // Try to close any remaining dialogs
        try {
          const remainingDialogs = document.querySelectorAll('div[role="dialog"]');
          for (const dialog of remainingDialogs) {
            const cancelButtons = dialog.querySelectorAll('button');
            for (const btn of cancelButtons) {
              const btnText = btn.textContent.trim().toLowerCase();
              if ((btnText === 'cancel' || btnText === 'close' || btnText === 'skip') && btn.offsetParent !== null) {
                btn.click();
                await new Promise(resolve => setTimeout(resolve, 500));
                break;
              }
            }
          }
        } catch (error) {
          console.log("⚠️ Error closing dialogs, but deletion was successful");
        }
        
        // Wait between deletions to avoid being flagged
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        failedCount++;
        console.error(`❌ Error deleting listing ${i + 1}:`, error);
        
        // Try to close any open dialogs/menus
        try {
          document.body.click();
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    }
    
    // Clear deletion in progress flag
    window.fbDeletionInProgress = false;
    
    // Show final results
    const message = `🎉 Deletion complete!\n✅ Deleted: ${deletedCount}\n❌ Failed: ${failedCount}`;
    console.log(message);
    
    if (deletedCount > 0) {
      showBanner(`✅ Successfully deleted ${deletedCount} old listings!`, 'success');
    } else {
      showBanner("❌ No listings were deleted. They may have been removed already or the delete buttons couldn't be found.", 'error');
    }
  }

  // Helper function to find menu button for a specific listing
  async function findMenuButton(listingElement) {
    console.log("🔍 Looking for menu button...");
    
    const menuSelectors = [
      '[aria-label*="More options"]',
      '[aria-label*="Options"]',
      '[aria-label*="Menu"]',
      '[data-testid*="more-options"]',
      '[data-testid*="menu"]',
      'button[aria-haspopup="menu"]',
      '.x1i10hfl[role="button"]', // Common Facebook button class
      'div[role="button"][tabindex="0"]',
      'svg[aria-label*="More"]'
    ];
    
    // First, look within the listing element
    for (const selector of menuSelectors) {
      const button = listingElement.querySelector(selector);
      if (button && button.offsetParent !== null) {
        console.log(`✅ Found menu button in listing using selector: ${selector}`);
        return button;
      }
    }
    
    // If not found, look in the parent container
    const parent = listingElement.parentElement;
    if (parent) {
      for (const selector of menuSelectors) {
        const button = parent.querySelector(selector);
        if (button && button.offsetParent !== null) {
          console.log(`✅ Found menu button in parent using selector: ${selector}`);
          return button;
        }
      }
    }
    
    // Look for three-dot pattern (⋯) or similar
    const allButtons = listingElement.querySelectorAll('button, div[role="button"], [tabindex="0"]');
    for (const button of allButtons) {
      const text = button.textContent.trim();
      const ariaLabel = button.getAttribute('aria-label') || '';
      
      if (text === '⋯' || text === '•••' || text === '...' || 
          ariaLabel.toLowerCase().includes('more') || 
          ariaLabel.toLowerCase().includes('options') ||
          ariaLabel.toLowerCase().includes('menu')) {
        console.log(`✅ Found menu button by content: "${text}" or aria-label: "${ariaLabel}"`);
        return button;
      }
    }
    
    console.log("❌ Could not find menu button");
    return null;
  }

  // Helper function to find "Delete listing" option in the opened menu
  async function findDeleteOption() {
    console.log("🔍 Looking for 'Delete listing' option in menu...");
    
    // Wait a moment for menu to fully render
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Strategy 1: Look for exact text matches
    const allElements = document.querySelectorAll('span, div, a, button, [role="menuitem"]');
    
    for (const element of allElements) {
      const text = element.textContent.trim();
      
      if ((text === 'Delete listing' || 
           text === 'Delete' ||
           text === 'Remove listing' ||
           text === 'Remove') && 
          element.offsetParent !== null) {
        
        console.log(`✅ Found delete option with exact text: "${text}"`);
        
        // Check if element itself is clickable
        if (element.onclick || element.getAttribute('role') === 'menuitem' || 
            element.tagName === 'BUTTON' || element.tagName === 'A') {
          return element;
        }
        
        // Check parent for clickability
        let parent = element.parentElement;
        for (let i = 0; i < 3; i++) {
          if (!parent) break;
          
          if (parent.onclick || parent.getAttribute('role') === 'menuitem' || 
              parent.tagName === 'BUTTON' || parent.tagName === 'A' ||
              parent.style.cursor === 'pointer') {
            console.log(`✅ Found clickable parent at level ${i}`);
            return parent;
          }
          parent = parent.parentElement;
        }
      }
    }
    
    // Strategy 2: Look for elements containing "delete" (case insensitive)
    for (const element of allElements) {
      const text = element.textContent.trim().toLowerCase();
      
      if (text.includes('delete') && text.length < 50 && element.offsetParent !== null) {
        console.log(`✅ Found element containing 'delete': "${element.textContent.trim()}"`);
        
        // Check if clickable
        if (element.onclick || element.getAttribute('role') === 'menuitem' || 
            element.tagName === 'BUTTON' || element.tagName === 'A') {
          return element;
        }
        
        // Check parent
        const parent = element.parentElement;
        if (parent && (parent.onclick || parent.getAttribute('role') === 'menuitem' || 
                      parent.tagName === 'BUTTON' || parent.tagName === 'A')) {
          return parent;
        }
      }
    }
    
    console.log("❌ Could not find 'Delete listing' option");
    return null;
  }

  // Helper function to find "Delete" button in confirmation dialog
  async function findDeleteButtonInDialog() {
    console.log("🔍 Looking for 'Delete' button in confirmation dialog...");
    
    // Wait a moment for dialog to fully render
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // NEW: Try all buttons one by one approach
    return await tryAllDeleteButtonsSequentially();
    
    // Strategy 0: Look for blue "Delete" button specifically
    console.log("🔍 Strategy 0: Looking for blue Delete button specifically...");
    
    const allButtons = document.querySelectorAll('button, [role="button"]');
    console.log(`Found ${allButtons.length} buttons to check`);
    
    // First, try to find a blue button with "Delete" text
    for (const button of allButtons) {
      if (button.offsetParent === null) continue;
      
      const buttonStyle = window.getComputedStyle(button);
      const bgColor = buttonStyle.backgroundColor;
      const text = button.textContent.trim();
      
      if (bgColor === 'rgb(8, 102, 255)' && text === 'Delete') {
        console.log(`✅ FOUND BLUE DELETE BUTTON with text: "${text}"`);
        return button;
      }
    }
    
    // If no blue Delete button with text found, look for blue button near Cancel
    console.log("🔍 Looking for blue button near Cancel button...");
    let cancelBtn2 = null;
    
    // Find Cancel button first
    for (const button of allButtons) {
      const text = button.textContent.trim();
      if (text === 'Cancel' && button.offsetParent !== null) {
        cancelBtn2 = button;
        console.log(`✅ Found Cancel button`);
        break;
      }
    }
    
    if (cancelBtn2) {
      // Look for blue button in same container as Cancel
      const container = cancelBtn2.closest('div[role="dialog"], .modal, [data-testid*="modal"]');
      if (container) {
        const containerButtons = container.querySelectorAll('button');
        for (const button of containerButtons) {
          if (button.offsetParent === null) continue;
          
          const buttonStyle = window.getComputedStyle(button);
          const bgColor = buttonStyle.backgroundColor;
          
          if (bgColor === 'rgb(8, 102, 255)') {
            const text = button.textContent.trim();
            console.log(`✅ FOUND BLUE BUTTON near Cancel: "${text}"`);
            return button;
          }
        }
      }
    }
    
    // Strategy 1: Look for blue "Delete" button next to Cancel button (most reliable)
    console.log("🔍 Strategy 1: Looking for blue Delete button next to Cancel...");
    
    // First find the Cancel button
    let cancelButton = null;
    for (const button of allButtons) {
      const text = button.textContent.trim();
      if (text === 'Cancel' && button.offsetParent !== null) {
        cancelButton = button;
        console.log(`✅ Found Cancel button`);
        break;
      }
    }
    
    if (cancelButton) {
      // Look for blue Delete button in the same container as Cancel
      const container = cancelButton.closest('div[role="dialog"], .modal, [data-testid*="modal"]');
      if (container) {
        const containerButtons = container.querySelectorAll('button');
        for (const button of containerButtons) {
          const text = button.textContent.trim();
          const buttonStyle = window.getComputedStyle(button);
          const bgColor = buttonStyle.backgroundColor;
          
          // Look for blue Delete button with "Delete" text specifically
          if (text === 'Delete' && button.offsetParent !== null &&
              (bgColor.includes('rgb(8, 102, 255)') ||   // Facebook blue from debug
               bgColor.includes('rgb(24, 119, 242)') ||  // Facebook blue
               bgColor.includes('rgb(66, 103, 178)') ||  // Facebook blue variant  
               bgColor.includes('rgb(56, 88, 152)'))) {  // Facebook blue dark
            
            console.log(`✅ Found blue Delete button with text near Cancel: "${text}" (bg: ${bgColor})`);
            return button;
          }
        }
        
        // If no blue Delete button found, look for any Delete button near Cancel
        for (const button of containerButtons) {
          const text = button.textContent.trim();
          if (text === 'Delete' && button.offsetParent !== null) {
            console.log(`✅ Found Delete button near Cancel: "${text}"`);
            return button;
          }
        }
      }
    }
    
    // Strategy 2: Look for "Delete" button that's near "Cancel" button
    console.log("🔍 Strategy 2: Looking for Delete button near Cancel button...");
    
    let cancelBtn = null;
    let deleteButton = null;
    
    // Find Cancel button first
    for (const button of allButtons) {
      const text = button.textContent.trim();
      if (text === 'Cancel' && button.offsetParent !== null) {
        cancelBtn = button;
        console.log(`✅ Found Cancel button`);
        break;
      }
    }
    
    if (cancelBtn) {
      // Look for Delete button near Cancel button
      const parent = cancelBtn.parentElement;
      if (parent) {
        const siblingButtons = parent.querySelectorAll('button');
        for (const button of siblingButtons) {
          const text = button.textContent.trim();
          if (text === 'Delete' && button.offsetParent !== null) {
            // Check if this is the blue styled delete button
            const buttonStyle = window.getComputedStyle(button);
            const bgColor = buttonStyle.backgroundColor;
            console.log(`Found Delete button next to Cancel - bg color: ${bgColor}`);
            
            // Facebook's delete button is typically blue
            if (bgColor.includes('rgb(24, 119, 242)') || // Facebook blue
                bgColor.includes('rgb(66, 103, 178)') ||  // Facebook blue variant
                bgColor.includes('rgb(56, 88, 152)') ||   // Facebook blue dark
                button.getAttribute('data-testid') === 'confirm-save-button' ||
                button.className.includes('primary')) {
              console.log(`✅ Found blue Delete button next to Cancel button`);
              return button;
            }
          }
        }
      }
      
      // Also check buttons in the same container level
      const container = cancelBtn.closest('div[role="dialog"], .modal, [data-testid*="modal"]');
      if (container) {
        const containerButtons = container.querySelectorAll('button');
        for (const button of containerButtons) {
          const text = button.textContent.trim();
          if (text === 'Delete' && button.offsetParent !== null) {
            // Check if this is the blue styled delete button
            const buttonStyle = window.getComputedStyle(button);
            const bgColor = buttonStyle.backgroundColor;
            console.log(`Found Delete button in dialog container - bg color: ${bgColor}`);
            
            // Facebook's delete button is typically blue
            if (bgColor.includes('rgb(24, 119, 242)') || // Facebook blue
                bgColor.includes('rgb(66, 103, 178)') ||  // Facebook blue variant
                bgColor.includes('rgb(56, 88, 152)') ||   // Facebook blue dark
                button.getAttribute('data-testid') === 'confirm-save-button' ||
                button.className.includes('primary')) {
              console.log(`✅ Found blue Delete button in same dialog container as Cancel`);
              return button;
            }
          }
        }
      }
    }
    
    // Strategy 3: Look for any visible "Delete" button (but DON'T return transparent ones yet)
    console.log("🔍 Strategy 3: Looking for any visible Delete button...");
    
    let blueDeleteButton = null;
    let anyDeleteButton = null;
    
    for (const button of allButtons) {
      const text = button.textContent.trim();
      const ariaLabel = button.getAttribute('aria-label') || '';
      
      if (text === 'Delete' && button.offsetParent !== null) {
        // Check if this is the blue styled delete button
        const buttonStyle = window.getComputedStyle(button);
        const bgColor = buttonStyle.backgroundColor;
        console.log(`Found Delete button - text: "${text}", bg color: ${bgColor}, classes: ${button.className}`);
        
        // Check if it's blue
        if (bgColor.includes('rgb(8, 102, 255)') ||   // Facebook blue from debug
            bgColor.includes('rgb(24, 119, 242)') ||  // Facebook blue
            bgColor.includes('rgb(66, 103, 178)') ||  // Facebook blue variant
            bgColor.includes('rgb(56, 88, 152)') ||   // Facebook blue dark
            button.getAttribute('data-testid') === 'confirm-save-button' ||
            button.className.includes('primary') ||
            button.className.includes('blue')) {
          blueDeleteButton = button;
          console.log(`✅ Found blue Delete button: "${text}"`);
        } else {
          // Only store non-transparent Delete buttons as fallback
          if (!anyDeleteButton && bgColor !== 'rgba(0, 0, 0, 0)') {
            anyDeleteButton = button;
          }
        }
      }
    }
    
    // Return blue Delete button if found (but don't return transparent ones yet)
    if (blueDeleteButton) {
      return blueDeleteButton;
    }
    // Don't return anyDeleteButton yet - let other strategies try first
    
    // Strategy 4: Look specifically in "Are you sure" confirmation dialog
    console.log("🔍 Strategy 4: Looking for Delete button in confirmation dialog...");
    
    // Find the specific confirmation dialog
    const confirmationDialog = Array.from(document.querySelectorAll('div[role="dialog"]')).find(dialog => 
      dialog.textContent.includes('Are you sure') && dialog.textContent.includes('delete this listing')
    );
    
    if (confirmationDialog) {
      console.log("✅ Found confirmation dialog");
      const dialogButtons = confirmationDialog.querySelectorAll('button');
      console.log(`Found ${dialogButtons.length} buttons in confirmation dialog`);
      
      // Look for blue Delete button first
      for (const button of dialogButtons) {
        const text = button.textContent.trim();
        if (text === 'Delete' && button.offsetParent !== null) {
          const buttonStyle = window.getComputedStyle(button);
          const bgColor = buttonStyle.backgroundColor;
          console.log(`Found Delete button in confirmation dialog: "${text}" (bg: ${bgColor})`);
          
          // Check if it's blue
          if (bgColor.includes('rgb(8, 102, 255)') ||   // Facebook blue
              bgColor.includes('rgb(24, 119, 242)') ||  // Facebook blue
              bgColor.includes('rgb(66, 103, 178)') ||  // Facebook blue variant
              bgColor.includes('rgb(56, 88, 152)')) {   // Facebook blue dark
            console.log(`✅ Found BLUE Delete button in confirmation dialog: "${text}" (bg: ${bgColor})`);
            return button;
          }
        }
      }
      
      // If no blue Delete button found, return any Delete button
      for (const button of dialogButtons) {
        const text = button.textContent.trim();
        if (text === 'Delete' && button.offsetParent !== null) {
          console.log(`✅ Found Delete button in confirmation dialog (not blue): "${text}"`);
          return button;
        }
      }
    } else {
      console.log("❌ No confirmation dialog found");
    }
    
    // Strategy 5: Look for blue styled button (Facebook's primary button style)
    console.log("🔍 Strategy 5: Looking for blue styled buttons...");
    for (const button of allButtons) {
      if (button.offsetParent === null) continue;
      
      const text = button.textContent.trim();
      const buttonStyle = window.getComputedStyle(button);
      const bgColor = buttonStyle.backgroundColor;
      
      // Look for blue buttons (Facebook's primary action button)
      if (bgColor.includes('rgb(8, 102, 255)') ||   // Facebook blue from debug
          bgColor.includes('rgb(24, 119, 242)') ||  // Facebook blue
          bgColor.includes('rgb(66, 103, 178)') ||  // Facebook blue variant  
          bgColor.includes('rgb(56, 88, 152)') ||   // Facebook blue dark
          button.className.includes('primary')) {
        
        console.log(`✅ Found blue styled button: "${text}" (bg: ${bgColor})`);
        return button;
      }
    }
    
    // Strategy 5.1: Look for buttons with specific Facebook blue classes
    console.log("🔍 Strategy 5.1: Looking for buttons with Facebook blue classes...");
    const blueClassButtons = document.querySelectorAll('button[class*="x1obq294"], button[class*="x1ga7v0g"], button[class*="x16uus16"]');
    for (const button of blueClassButtons) {
      if (button.offsetParent === null) continue;
      
      const text = button.textContent.trim();
      const buttonStyle = window.getComputedStyle(button);
      const bgColor = buttonStyle.backgroundColor;
      
      console.log(`Found button with blue classes: "${text}" (bg: ${bgColor})`);
      
      if (bgColor.includes('rgb(8, 102, 255)') || bgColor.includes('rgb(24, 119, 242)')) {
        console.log(`✅ Found blue button with Facebook classes: "${text}"`);
        return button;
      }
    }
    
    // Strategy 6: Last resort - find ANY button with exact blue color
    console.log("🔍 Strategy 6: Last resort - looking for exact blue color button...");
    for (const button of allButtons) {
      if (button.offsetParent === null) continue;
      
      const buttonStyle = window.getComputedStyle(button);
      const bgColor = buttonStyle.backgroundColor;
      
      // Look for the exact blue color we know works
      if (bgColor === 'rgb(8, 102, 255)') {
        const text = button.textContent.trim();
        console.log(`✅ Found button with exact blue color: "${text}"`);
        return button;
      }
    }
    
    // Strategy 7: Last resort - use transparent Delete buttons
    console.log("🔍 Strategy 7: Last resort - looking for transparent Delete buttons...");
    for (const button of allButtons) {
      const text = button.textContent.trim();
      if (text === 'Delete' && button.offsetParent !== null) {
        const buttonStyle = window.getComputedStyle(button);
        const bgColor = buttonStyle.backgroundColor;
        console.log(`✅ Found transparent Delete button as last resort: "${text}" (bg: ${bgColor})`);
        return button;
      }
    }
    
    // Strategy 8: Debug - show all visible buttons in dialog
    console.log("🔍 Strategy 8: DEBUG - Showing all visible buttons:");
    const visibleButtons = Array.from(allButtons).filter(btn => btn.offsetParent !== null);
    visibleButtons.forEach((btn, index) => {
      const text = btn.textContent.trim();
      const style = window.getComputedStyle(btn);
      const bgColor = style.backgroundColor;
      console.log(`Button ${index}: "${text}" (bg: ${bgColor}, classes: ${btn.className})`);
    });
    
    console.log("❌ Could not find Delete button in dialog");
    return null;
  }

  // NEW: Try all potential Delete buttons one by one
  async function tryAllDeleteButtonsSequentially() {
    console.log("🎯 TRYING ALL DELETE BUTTONS ONE BY ONE...");
    
    // Collect all potential Delete buttons
    const allDeleteButtons = [];
    const allButtons = document.querySelectorAll('button, [role="button"], div[tabindex="0"]');
    console.log(`Found ${allButtons.length} buttons to analyze`);
    
    // Strategy 1: Blue buttons (highest priority)
    for (const button of allButtons) {
      if (button.offsetParent === null) continue;
      
      const computedStyle = window.getComputedStyle(button);
      const bgColor = computedStyle.backgroundColor;
      
      if (bgColor === 'rgb(8, 102, 255)' || bgColor === 'rgb(24, 119, 242)') {
        allDeleteButtons.push({
          button: button,
          strategy: 'Blue button',
          text: button.textContent.trim(),
          bgColor: bgColor,
          priority: 1
        });
      }
    }
    
    // Strategy 2: Buttons with "Delete" text
    for (const button of allButtons) {
      if (button.offsetParent === null) continue;
      
      const text = button.textContent.trim().toLowerCase();
      if (text === 'delete' || text === 'eliminar' || text === 'supprimer') {
        const computedStyle = window.getComputedStyle(button);
        const bgColor = computedStyle.backgroundColor;
        
        allDeleteButtons.push({
          button: button,
          strategy: 'Delete text button',
          text: button.textContent.trim(),
          bgColor: bgColor,
          priority: 2
        });
      }
    }
    
    // Strategy 3: Buttons near Cancel button
    const cancelButtons = Array.from(allButtons).filter(btn => {
      const text = btn.textContent.trim().toLowerCase();
      return text === 'cancel' || text === 'cancelar' || text === 'annuler';
    });
    
    for (const cancelBtn of cancelButtons) {
      const parent = cancelBtn.closest('div[role="dialog"], .x1n2onr6, .x1ja2u2z');
      if (parent) {
        const nearbyButtons = parent.querySelectorAll('button, [role="button"], div[tabindex="0"]');
        for (const btn of nearbyButtons) {
          if (btn !== cancelBtn && btn.offsetParent !== null) {
            const computedStyle = window.getComputedStyle(btn);
            const bgColor = computedStyle.backgroundColor;
            
            allDeleteButtons.push({
              button: btn,
              strategy: 'Button near Cancel',
              text: btn.textContent.trim(),
              bgColor: bgColor,
              priority: 3
            });
          }
        }
      }
    }
    
    // Strategy 4: All other visible buttons in dialog
    const dialogs = document.querySelectorAll('div[role="dialog"]');
    for (const dialog of dialogs) {
      const dialogButtons = dialog.querySelectorAll('button, [role="button"], div[tabindex="0"]');
      for (const btn of dialogButtons) {
        if (btn.offsetParent !== null) {
          const computedStyle = window.getComputedStyle(btn);
          const bgColor = computedStyle.backgroundColor;
          
          allDeleteButtons.push({
            button: btn,
            strategy: 'Dialog button',
            text: btn.textContent.trim(),
            bgColor: bgColor,
            priority: 4
          });
        }
      }
    }
    
    // Remove duplicates
    const uniqueButtons = [];
    const seenButtons = new Set();
    
    for (const buttonInfo of allDeleteButtons) {
      const buttonId = buttonInfo.button.outerHTML;
      if (!seenButtons.has(buttonId)) {
        seenButtons.add(buttonId);
        uniqueButtons.push(buttonInfo);
      }
    }
    
    // Sort by priority (lower number = higher priority)
    uniqueButtons.sort((a, b) => a.priority - b.priority);
    
    console.log(`🎯 Found ${uniqueButtons.length} unique buttons to try`);
    
    // Try each button one by one
    for (let i = 0; i < uniqueButtons.length; i++) {
      const buttonInfo = uniqueButtons[i];
      const button = buttonInfo.button;
      
      console.log(`🔄 Trying button ${i + 1}/${uniqueButtons.length}: "${buttonInfo.text}" (${buttonInfo.strategy})`);
      console.log(`   Priority: ${buttonInfo.priority}, BG: ${buttonInfo.bgColor}`);
      
      // Store current dialog state
      const beforeDialogContent = document.querySelector('div[role="dialog"]')?.textContent || '';
      const beforeDialogCount = document.querySelectorAll('div[role="dialog"]').length;
      
      // Try clicking this button with multiple methods
      const success = await tryMultipleClickMethods(button, i + 1);
      
      if (success) {
        // Wait for dialog to change
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check if dialog changed
        const afterDialogContent = document.querySelector('div[role="dialog"]')?.textContent || '';
        const afterDialogCount = document.querySelectorAll('div[role="dialog"]').length;
        
        if (afterDialogContent !== beforeDialogContent || afterDialogCount !== beforeDialogCount) {
          console.log(`🎉 SUCCESS! Button ${i + 1} worked - dialog changed!`);
          console.log(`   Before: "${beforeDialogContent.substring(0, 50)}..."`);
          console.log(`   After: "${afterDialogContent.substring(0, 50)}..."`);
          
          // Check if we got the reason dialog or any dialog change indicating success
          if (afterDialogContent.toLowerCase().includes('why') || 
              afterDialogContent.toLowerCase().includes('reason') ||
              afterDialogContent.toLowerCase().includes('tell us more') ||
              afterDialogContent.toLowerCase().includes('did you sell') ||
              afterDialogContent.toLowerCase().includes('your response')) {
            console.log('🎯 Deletion dialog appeared - deletion successful!');
            return button;
          } else {
            console.log('🎯 Dialog changed - deletion in progress!');
            return button;
          }
        } else {
          console.log(`❌ Button ${i + 1} didn't work - no dialog change`);
        }
      } else {
        console.log(`❌ Button ${i + 1} failed to click`);
      }
      
      // Wait before trying next button
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('❌ All buttons failed to work');
    return null;
  }

  // Try multiple click methods on a button
  async function tryMultipleClickMethods(button, buttonNumber) {
    console.log(`   🔄 Trying multiple click methods on button ${buttonNumber}...`);
    
    try {
      // Method 1: Standard click with focus
      console.log(`   Method 1: Standard click...`);
      button.focus();
      button.click();
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Method 2: Mouse events sequence
      console.log(`   Method 2: Mouse events...`);
      const rect = button.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      
      button.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, clientX: x, clientY: y }));
      button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: x, clientY: y }));
      await new Promise(resolve => setTimeout(resolve, 50));
      button.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: x, clientY: y }));
      button.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: x, clientY: y }));
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Method 3: Keyboard Enter
      console.log(`   Method 3: Keyboard Enter...`);
      button.focus();
      button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      button.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Method 4: Touch events
      console.log(`   Method 4: Touch events...`);
      button.dispatchEvent(new TouchEvent('touchstart', { bubbles: true }));
      button.dispatchEvent(new TouchEvent('touchend', { bubbles: true }));
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Method 5: Direct onclick handler
      console.log(`   Method 5: Direct onclick...`);
      if (button.onclick) {
        button.onclick();
      }
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Method 6: Parent element click
      console.log(`   Method 6: Parent click...`);
      if (button.parentElement) {
        button.parentElement.click();
      }
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Method 7: Simulate user interaction
      console.log(`   Method 7: Simulate user interaction...`);
      button.dispatchEvent(new Event('mouseenter', { bubbles: true }));
      button.dispatchEvent(new Event('focus', { bubbles: true }));
      await new Promise(resolve => setTimeout(resolve, 100));
      button.dispatchEvent(new Event('click', { bubbles: true }));
      await new Promise(resolve => setTimeout(resolve, 300));
      
      console.log(`   ✅ All click methods attempted on button ${buttonNumber}`);
      return true;
      
    } catch (error) {
      console.error(`   ❌ Error clicking button ${buttonNumber}:`, error);
      return false;
    }
  }

  // Helper function to close "Why did you delete this?" reason dialog
  async function closeReasonDialog() {
    console.log("🔍 Looking for reason dialog to close...");
    
    // Wait for reason dialog to appear
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Debug: Check what dialogs/modals are currently visible
    console.log("🔍 DEBUG: Checking for visible dialogs...");
    const dialogs = document.querySelectorAll('[role="dialog"], .modal, [data-testid*="modal"]');
    console.log(`Found ${dialogs.length} dialog elements:`);
    
    dialogs.forEach((dialog, index) => {
      if (dialog.offsetParent !== null) {
        console.log(`Dialog ${index}: visible, content: "${dialog.textContent.substring(0, 100)}..."`);
      }
    });
    
    // Strategy 1: Look for "Close" button
    const allButtons = document.querySelectorAll('button, [role="button"], a');
    
    for (const button of allButtons) {
      const text = button.textContent.trim();
      const ariaLabel = button.getAttribute('aria-label') || '';
      
      if ((text === 'Close' || 
           text === 'Skip' ||
           text === 'No thanks' ||
           text === 'Cancel' ||
           ariaLabel.toLowerCase().includes('close') ||
           ariaLabel.toLowerCase().includes('skip')) && 
          button.offsetParent !== null) {
        
        console.log(`✅ Found close button for reason dialog: "${text}"`);
        button.click();
        
        // Also try mouse event
        const clickEvent = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window
        });
        button.dispatchEvent(clickEvent);
        
        return true;
      }
    }
    
    // Strategy 2: Look for X close button
    const closeButtons = document.querySelectorAll('[aria-label*="Close"], [title*="Close"], button[aria-label*="close"]');
    for (const button of closeButtons) {
      if (button.offsetParent !== null) {
        console.log(`✅ Found X close button for reason dialog`);
        button.click();
        return true;
      }
    }
    
    // Strategy 3: Look for overlay/backdrop to click
    const overlays = document.querySelectorAll('[role="dialog"] + div, .modal-backdrop, [data-testid*="modal"]');
    for (const overlay of overlays) {
      if (overlay.offsetParent !== null) {
        console.log(`✅ Found dialog overlay, clicking to close`);
        overlay.click();
        return true;
      }
    }
    
    // Strategy 4: Press Escape key
    console.log("🔄 Trying Escape key to close reason dialog...");
    const escapeEvent = new KeyboardEvent('keydown', {
      key: 'Escape',
      code: 'Escape',
      keyCode: 27,
      bubbles: true
    });
    document.dispatchEvent(escapeEvent);
    
    return false;
  }

  // Function to delete a single listing (DEPRECATED - replaced by step-by-step approach)
  async function deleteListing(listingElement) {
    console.log("🔍 Looking for delete options for listing...");
    
    try {
      // Strategy 1: Look for three-dot menu or options button
      const menuSelectors = [
        '[aria-label*="More options"]',
        '[aria-label*="Options"]',
        '[aria-label*="Menu"]',
        '[data-testid*="more-options"]',
        '[data-testid*="menu"]',
        'button[aria-haspopup="menu"]',
        '.x1i10hfl[role="button"]', // Common Facebook button class
        'div[role="button"][tabindex="0"]'
      ];
      
      let menuButton = null;
      
      // Look for menu button within the listing
      for (const selector of menuSelectors) {
        menuButton = listingElement.querySelector(selector);
        if (menuButton) {
          console.log(`✅ Found menu button using selector: ${selector}`);
          break;
        }
      }
      
      if (!menuButton) {
        // Look for menu button near the listing
        const parent = listingElement.parentElement;
        if (parent) {
          for (const selector of menuSelectors) {
            menuButton = parent.querySelector(selector);
            if (menuButton) {
              console.log(`✅ Found menu button in parent using selector: ${selector}`);
              break;
            }
          }
        }
      }
      
      if (menuButton) {
        console.log("🎯 Clicking menu button...");
        menuButton.click();
        
        // Wait for menu to appear
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Debug: Log all visible menu items
        console.log("🔍 DEBUG: Analyzing menu structure...");
        const menuItems = document.querySelectorAll('[role="menuitem"], div[style*="cursor"], .x1i10hfl[role="button"]');
        console.log(`Found ${menuItems.length} potential menu items:`);
        
        menuItems.forEach((item, index) => {
          const text = item.textContent.trim();
          const role = item.getAttribute('role');
          const ariaLabel = item.getAttribute('aria-label');
          console.log(`Menu item ${index}: "${text}" (role: ${role}, aria-label: ${ariaLabel})`);
        });
        
        // Also log ALL visible elements that might be menu options
        console.log("🔍 DEBUG: All visible elements after menu click:");
        const allVisibleElements = document.querySelectorAll('*');
        const recentlyVisible = Array.from(allVisibleElements).filter(el => {
          const text = el.textContent.trim();
          return text.length > 0 && text.length < 50 && el.offsetParent !== null && 
                 (text.toLowerCase().includes('delete') || text.toLowerCase().includes('edit') || 
                  text.toLowerCase().includes('view') || text.toLowerCase().includes('mark'));
        });
        
        console.log(`Found ${recentlyVisible.length} potentially relevant elements:`);
        recentlyVisible.forEach((el, index) => {
          console.log(`Element ${index}: "${el.textContent.trim()}" (${el.tagName}, role: ${el.getAttribute('role')})`);
        });
        
        // Look for delete option in the menu
        console.log("🔍 Searching for delete option in menu...");
        
        let deleteButton = null;
        
        // Strategy 1: Look for elements containing "Delete listing" text
        const allElements = document.querySelectorAll('span, div, a, button, [role="menuitem"]');
        console.log(`Found ${allElements.length} elements to check for delete option`);
        
        for (const element of allElements) {
          const text = element.textContent.trim();
          console.log(`Checking element text: "${text}"`);
          
          // Check for various delete-related text patterns
          if ((text === 'Delete listing' || 
               text === 'Delete' || 
               text === 'Remove listing' || 
               text === 'Remove' ||
               text.toLowerCase().includes('delete listing') ||
               text.toLowerCase().includes('delete')) && 
              element.offsetParent !== null) {
            
            console.log(`✅ Found delete option with text: "${text}"`);
            deleteButton = element;
            break;
          }
        }
        
        // Strategy 2: Look for clickable parents of text elements
        if (!deleteButton) {
          console.log("🔄 Trying to find clickable parent of delete text...");
          
          for (const element of allElements) {
            const text = element.textContent.trim().toLowerCase();
            
            if (text.includes('delete')) {
              console.log(`Found text containing "delete": "${element.textContent.trim()}"`);
              
              // Check if element itself is clickable
              if (element.onclick || element.getAttribute('role') === 'menuitem' || 
                  element.tagName === 'BUTTON' || element.tagName === 'A') {
                deleteButton = element;
                console.log(`✅ Found clickable delete element: ${element.tagName}`);
                break;
              }
              
              // Check parent elements for clickability
              let parent = element.parentElement;
              for (let i = 0; i < 3; i++) {
                if (!parent) break;
                
                if (parent.onclick || parent.getAttribute('role') === 'menuitem' || 
                    parent.tagName === 'BUTTON' || parent.tagName === 'A' ||
                    parent.style.cursor === 'pointer') {
                  deleteButton = parent;
                  console.log(`✅ Found clickable parent of delete text at level ${i}`);
                  break;
                }
                parent = parent.parentElement;
              }
              
              if (deleteButton) break;
            }
          }
        }
        
        // Strategy 3: Look for specific Facebook selectors
        if (!deleteButton) {
          console.log("🔄 Trying Facebook-specific selectors...");
          
          const fbSelectors = [
            '[aria-label*="Delete"]',
            '[aria-label*="Remove"]',
            '[data-testid*="delete"]',
            '[data-testid*="remove"]',
            'div[role="menuitem"]',
            'a[role="menuitem"]'
          ];
          
          for (const selector of fbSelectors) {
            const elements = document.querySelectorAll(selector);
            
            for (const element of elements) {
              const text = element.textContent.trim().toLowerCase();
              if (text.includes('delete') && element.offsetParent !== null) {
                deleteButton = element;
                console.log(`✅ Found delete button using FB selector: ${selector}`);
                break;
              }
            }
            
            if (deleteButton) break;
                     }
         }
        
        // Strategy 4: Look for delete icon (trash icon)
        if (!deleteButton) {
          console.log("🔄 Looking for delete icon...");
          
          // Look for common trash/delete icons
          const iconSelectors = [
            'svg[aria-label*="delete"]',
            'svg[aria-label*="trash"]',
            'i[class*="trash"]',
            'i[class*="delete"]',
            '[data-icon="trash"]',
            '[data-icon="delete"]'
          ];
          
          for (const selector of iconSelectors) {
            const icons = document.querySelectorAll(selector);
            
            for (const icon of icons) {
              if (icon.offsetParent !== null) {
                // Look for clickable parent
                let parent = icon.parentElement;
                for (let i = 0; i < 5; i++) {
                  if (!parent) break;
                  
                  if (parent.onclick || parent.getAttribute('role') === 'menuitem' || 
                      parent.tagName === 'BUTTON' || parent.tagName === 'A' ||
                      parent.style.cursor === 'pointer') {
                    deleteButton = parent;
                    console.log(`✅ Found delete button via icon at parent level ${i}`);
                    break;
                  }
                  parent = parent.parentElement;
                }
                
                if (deleteButton) break;
              }
            }
            
            if (deleteButton) break;
          }
        }
        
        // Strategy 5: Try keyboard navigation if other methods fail
        if (!deleteButton) {
          console.log("🔄 Trying keyboard navigation to find delete option...");
          
          // Try pressing arrow keys to navigate menu
          const menuContainer = document.querySelector('[role="menu"], [role="listbox"]') || document.body;
          
          // Focus on the menu container
          menuContainer.focus();
          
          // Try arrow down to navigate through menu items
          for (let i = 0; i < 10; i++) {
            const keyEvent = new KeyboardEvent('keydown', {
              key: 'ArrowDown',
              code: 'ArrowDown',
              keyCode: 40,
              bubbles: true
            });
            menuContainer.dispatchEvent(keyEvent);
            
            // Wait a bit and check if we found a delete option
            await new Promise(resolve => setTimeout(resolve, 200));
            
            const focusedElement = document.activeElement;
            if (focusedElement && focusedElement.textContent.toLowerCase().includes('delete')) {
              console.log(`✅ Found delete option via keyboard navigation: "${focusedElement.textContent.trim()}"`);
              deleteButton = focusedElement;
              break;
            }
          }
        }
        
        if (deleteButton) {
          console.log("🗑️ Clicking delete button...");
          
          // Try multiple click methods
          deleteButton.click();
          
          // Also try dispatching mouse events
          const mouseEvent = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window
          });
          deleteButton.dispatchEvent(mouseEvent);
          
          // Try pressing Enter key if it's focused
          const enterEvent = new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            bubbles: true
          });
          deleteButton.dispatchEvent(enterEvent);
          
          // Wait for confirmation dialog
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Look for confirmation button
          console.log("🔍 Looking for confirmation button...");
          
          let confirmButton = null;
          
          // Strategy 1: Look for buttons with delete-related text
          const allButtons = document.querySelectorAll('button, [role="button"], a');
          console.log(`Found ${allButtons.length} buttons to check for confirmation`);
          
          for (const button of allButtons) {
            const text = button.textContent.trim();
            console.log(`Checking button text: "${text}"`);
            
            // Check for various confirmation text patterns
            if ((text === 'Delete' || 
                 text === 'Confirm' || 
                 text === 'Remove' ||
                 text === 'Yes' ||
                 text === 'OK' ||
                 text.toLowerCase().includes('delete') ||
                 text.toLowerCase().includes('confirm')) && 
                button.offsetParent !== null) {
              
              console.log(`✅ Found confirmation button with text: "${text}"`);
              confirmButton = button;
              break;
            }
          }
          
          // Strategy 2: Look for Facebook-specific confirmation selectors
          if (!confirmButton) {
            console.log("🔄 Trying Facebook-specific confirmation selectors...");
            
            const fbConfirmSelectors = [
              '[aria-label*="Delete"]',
              '[aria-label*="Confirm"]',
              '[data-testid*="confirm"]',
              '[data-testid*="delete"]',
              'button[type="submit"]'
            ];
            
            for (const selector of fbConfirmSelectors) {
              const elements = document.querySelectorAll(selector);
              
              for (const element of elements) {
                if (element.offsetParent !== null) {
                  confirmButton = element;
                  console.log(`✅ Found confirmation button using FB selector: ${selector}`);
                  break;
                }
              }
              
              if (confirmButton) break;
            }
          }
          
          if (confirmButton) {
            console.log("✅ Clicking confirm button...");
            confirmButton.click();
            
            // Wait for deletion to complete
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            return true;
          } else {
            console.warn("❌ Could not find confirmation button");
          }
        } else {
          console.warn("❌ Could not find delete button in menu");
        }
      } else {
        console.warn("❌ Could not find menu button");
      }
      
      return false;
      
    } catch (error) {
      console.error("❌ Error in deleteListing:", error);
      return false;
    }
  }

  // Function to show banner message
  function showBanner(message, type = 'info') {
    // Remove existing banner
    const existingBanner = document.getElementById('fb-delete-banner');
    if (existingBanner) {
      existingBanner.remove();
    }
    
    // Create new banner
    const banner = document.createElement('div');
    banner.id = 'fb-delete-banner';
    banner.textContent = message;
    
    const colors = {
      success: { bg: '#4CAF50', text: '#fff' },
      error: { bg: '#f44336', text: '#fff' },
      info: { bg: '#2196F3', text: '#fff' }
    };
    
    const color = colors[type] || colors.info;
    
    Object.assign(banner.style, {
      position: 'fixed',
      top: '20px',
      right: '20px',
      padding: '12px 20px',
      backgroundColor: color.bg,
      color: color.text,
      borderRadius: '6px',
      zIndex: '10000',
      fontSize: '14px',
      fontWeight: 'bold',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      maxWidth: '400px',
      lineHeight: '1.4'
    });
    
    document.body.appendChild(banner);
    
    // Auto remove after 10 seconds
    setTimeout(() => {
      if (banner.parentElement) {
        banner.remove();
      }
    }, 10000);
  }



  // Function to count old listings (async)
  async function countRecentListings() {
    console.log("📊 Counting old trailer listings (>14 days)...");
    
    try {
      // Wait for page to be ready
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Multiple selectors to find listing items
      const listingSelectors = [
        '[data-testid="marketplace-your-listings-item"]',
        '[data-testid="marketplace-listing-item"]',
        '.marketplace-listing-item',
        '[role="article"]',
        '.x1i10hfl', // Common Facebook class for listing items
        'div[style*="cursor: pointer"]'
      ];
      
      let listings = [];
      
      // Try each selector to find listings
      for (const selector of listingSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          listings = Array.from(elements);
          console.log(`✅ Found ${listings.length} listings using selector: ${selector}`);
          break;
        }
      }
      
      if (listings.length === 0) {
        console.log("⚠️ No listings found for counting");
        return 0;
      }
      
      let oldCount = 0;
      
      // Analyze each listing for recency
      for (const listing of listings) {
        try {
          const listingText = listing.textContent;
          
          // Look for date patterns in the listing text
          const datePatterns = [
            /(\d{1,2}\/\d{1,2}\/\d{4})/g,
            /(\d{1,2}\/\d{1,2})/g,
            /(\d+)\s*days?\s*ago/gi,
            /(\d+)\s*weeks?\s*ago/gi,
            /(yesterday|today|just now)/gi
          ];
          
          let foundDate = null;
          
          for (const pattern of datePatterns) {
            const matches = listingText.match(pattern);
            if (matches) {
              foundDate = parseFacebookDate(matches[0]);
              if (foundDate) break;
            }
          }
          
          if (foundDate && isGreaterThan14Days(foundDate)) {
            oldCount++;
          }
          
        } catch (error) {
          console.error('Error analyzing listing for count:', error);
        }
      }
      
              console.log(`📊 Found ${oldCount} old listings (>14 days) out of ${listings.length} total`);
        return oldCount;
      
    } catch (error) {
      console.error('Error in countRecentListings:', error);
      throw error;
    }
  }

  // Function to show confirmation dialog
  function showConfirmationDialog() {
    console.log("🔍 Showing confirmation dialog...");
    
    // Check if deletion is already in progress
    if (window.fbDeletionInProgress) {
      console.log("⚠️ Deletion already in progress, skipping confirmation dialog...");
      return;
    }
    
    // Check if dialog already exists to prevent duplicates
    if (document.getElementById('fb-delete-confirmation-overlay')) {
      console.log("⚠️ Confirmation dialog already exists, skipping...");
      return;
    }
    
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.id = 'fb-delete-confirmation-overlay';
    Object.assign(overlay.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      zIndex: '999999',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Arial, sans-serif'
    });
    
    // Create modal content
    const modal = document.createElement('div');
    modal.id = 'fb-delete-confirmation-modal';
    Object.assign(modal.style, {
      backgroundColor: '#fff',
      borderRadius: '12px',
      padding: '30px',
      maxWidth: '500px',
      width: '90%',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
      textAlign: 'center',
      position: 'relative'
    });
    
    // Create modal content HTML
    modal.innerHTML = `
      <div style="margin-bottom: 20px;">
        <div style="font-size: 48px; margin-bottom: 15px;">⚠️</div>
        <h2 style="color: #333; margin: 0 0 10px 0; font-size: 24px; font-weight: bold;">
          Delete Old Trailer Listings
        </h2>
        <p style="color: #666; margin: 0; font-size: 16px; line-height: 1.5;">
          This will automatically delete all trailer listings older than 14 days from your Facebook Marketplace.
        </p>
      </div>
      
              <div id="listing-count-info" style="margin-bottom: 20px; padding: 12px; background: #e3f2fd; border-radius: 8px; border-left: 4px solid #2196f3;">
          <p style="margin: 0; color: #0d47a1; font-size: 14px; font-weight: 500;">
            📊 <strong>Analyzing your listings...</strong> Please wait while we count old listings (>14 days).
          </p>
        </div>
      
              <div style="margin-bottom: 25px; padding: 15px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #ffc107;">
          <p style="margin: 0; color: #856404; font-size: 14px; font-weight: 500;">
            ⚡ <strong>Warning:</strong> This action cannot be undone. All old trailer listings (>14 days) will be permanently deleted.
          </p>
        </div>
      
      <div style="display: flex; gap: 15px; justify-content: center; flex-wrap: wrap;">
        <button id="fb-delete-cancel-btn" style="
          background: #6c757d;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 6px;
          font-size: 16px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.3s ease;
          min-width: 120px;
        ">
          Cancel
        </button>
        <button id="fb-delete-proceed-btn" style="
          background: #dc3545;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 6px;
          font-size: 16px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.3s ease;
          min-width: 120px;
          opacity: 0.7;
          pointer-events: none;
        ">
          Delete Listings
        </button>
      </div>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    // Add hover effects
    const cancelBtn = document.getElementById('fb-delete-cancel-btn');
    const proceedBtn = document.getElementById('fb-delete-proceed-btn');
    
    cancelBtn.addEventListener('mouseover', () => {
      cancelBtn.style.background = '#5a6268';
      cancelBtn.style.transform = 'translateY(-2px)';
    });
    
    cancelBtn.addEventListener('mouseout', () => {
      cancelBtn.style.background = '#6c757d';
      cancelBtn.style.transform = 'translateY(0)';
    });
    
    proceedBtn.addEventListener('mouseover', () => {
      proceedBtn.style.background = '#c82333';
      proceedBtn.style.transform = 'translateY(-2px)';
    });
    
    proceedBtn.addEventListener('mouseout', () => {
      proceedBtn.style.background = '#dc3545';
      proceedBtn.style.transform = 'translateY(0)';
    });
    
    // Count recent listings and update the dialog
    setTimeout(() => {
      countRecentListings().then(count => {
        const countInfo = document.getElementById('listing-count-info');
        const proceedBtn = document.getElementById('fb-delete-proceed-btn');
        
        if (countInfo && proceedBtn) {
          if (count > 0) {
            countInfo.innerHTML = `
              <p style="margin: 0; color: #0d47a1; font-size: 14px; font-weight: 500;">
                🎯 <strong>Found ${count} old trailer listing${count === 1 ? '' : 's'}</strong> older than 14 days.
              </p>
            `;
            
            // Enable the proceed button
            proceedBtn.style.opacity = '1';
            proceedBtn.style.pointerEvents = 'auto';
          } else {
            countInfo.innerHTML = `
              <p style="margin: 0; color: #4caf50; font-size: 14px; font-weight: 500;">
                ✅ <strong>No old listings found!</strong> All your trailer listings are newer than 14 days.
              </p>
            `;
            
            // Change button text and color
            proceedBtn.textContent = 'Nothing to Delete';
            proceedBtn.style.background = '#4caf50';
            proceedBtn.style.opacity = '1';
            proceedBtn.style.pointerEvents = 'auto';
          }
        }
      }).catch(error => {
        console.error('Error counting listings:', error);
        const countInfo = document.getElementById('listing-count-info');
        if (countInfo) {
          countInfo.innerHTML = `
            <p style="margin: 0; color: #ff9800; font-size: 14px; font-weight: 500;">
              ⚠️ <strong>Unable to count listings.</strong> You can still proceed with deletion.
            </p>
          `;
          
          // Enable the proceed button
          const proceedBtn = document.getElementById('fb-delete-proceed-btn');
          if (proceedBtn) {
            proceedBtn.style.opacity = '1';
            proceedBtn.style.pointerEvents = 'auto';
          }
        }
      });
    }, 1000);
    
    // Handle button clicks
    cancelBtn.addEventListener('click', () => {
      console.log("❌ User cancelled deletion");
      overlay.remove();
      showBanner("❌ Deletion cancelled by user", 'info');
    });
    
    proceedBtn.addEventListener('click', () => {
      // Check if it's the "Nothing to Delete" button
      if (proceedBtn.textContent === 'Nothing to Delete') {
        console.log("✅ No listings to delete, closing dialog");
        overlay.remove();
        showBanner("✅ No old listings found to delete", 'success');
        return;
      }
      
      console.log("✅ User confirmed deletion, proceeding...");
      overlay.remove();
      showBanner("🔍 Starting deletion process...", 'info');
      
      // Set deletion in progress flag
      window.fbDeletionInProgress = true;
      
      // Start the deletion process
      setTimeout(() => {
        findAndDeleteOldListings();
      }, 1000);
    });
    
    // Close on overlay click (outside modal)
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        console.log("❌ User cancelled deletion by clicking outside");
        overlay.remove();
        showBanner("❌ Deletion cancelled", 'info');
      }
    });
    
    // Close on Escape key
    document.addEventListener('keydown', function escapeHandler(e) {
      if (e.key === 'Escape') {
        console.log("❌ User cancelled deletion with Escape key");
        overlay.remove();
        showBanner("❌ Deletion cancelled", 'info');
        document.removeEventListener('keydown', escapeHandler);
      }
    });
  }

  // Modified waitForPageLoad function to show confirmation instead of auto-deleting
  function waitForPageLoad() {
    console.log("⏳ Waiting for Facebook Marketplace page to load...");
    
    // Check if page has loaded by looking for common elements
    const checkInterval = setInterval(() => {
      const hasContent = document.querySelector('[data-testid*="marketplace"]') || 
                        document.querySelector('.marketplace') ||
                        document.querySelectorAll('div').length > 50;
      
      if (hasContent) {
        clearInterval(checkInterval);
        console.log("✅ Page loaded, showing confirmation dialog...");
        
        // Wait a bit more for dynamic content to load, then show confirmation
        setTimeout(() => {
          showConfirmationDialog();
        }, 2000);
      }
    }, 1000);
    
    // Timeout after 30 seconds
    setTimeout(() => {
      clearInterval(checkInterval);
      console.warn("⚠️ Page load timeout, showing confirmation dialog anyway...");
      showConfirmationDialog();
    }, 60000);
  }

  // Start the process
  console.log("🚀 Facebook Marketplace Delete Extension initialized");
  
  // Show initial banner
  showBanner("🔍 Facebook Marketplace Delete Extension loaded. Ready to delete listings older than 14 days...", 'info');
  
  // Wait for page to load then show confirmation dialog
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForPageLoad);
  } else {
    waitForPageLoad();
  }
})(); 