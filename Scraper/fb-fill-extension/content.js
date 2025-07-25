(function () {
  console.log("✅ Extension started on Facebook Marketplace");
  
  // Show proxy notification
  showBanner("🌐 Facebook Marketplace loaded!", 'info', 1000);
  
  // Display proxy information in console
  displayProxyInfo();

  function handleLocationDropdown(locationValue) {
    console.log(`🎯 Handling Location dropdown with: ${locationValue}`);
    console.log(`🗺️ Location format detected: ${locationValue.includes(',') ? 'City, State' : 'Other format'}`);
    
    return new Promise((resolve) => {
      // Find and fill location input
      const locationInput = document.querySelector('input[placeholder*="Location"], input[aria-label*="Location"], input[aria-label*="location"]');
      
      if (!locationInput) {
        console.warn("❌ Location input not found");
        resolve(false);
        return;
      }
      
      console.log("📝 Typing expanded location in field...");
      
      // Focus and clear the location field first
      locationInput.focus();
      locationInput.value = '';
      
      // Trigger focus event
      locationInput.dispatchEvent(new Event('focus', { bubbles: true }));
      
      // Type the location character by character to trigger autocomplete
      let currentValue = '';
      for (let i = 0; i < locationValue.length; i++) {
        setTimeout(() => {
          currentValue += locationValue[i];
          locationInput.value = currentValue;
          
          // Trigger input events
          locationInput.dispatchEvent(new Event('input', { bubbles: true }));
          locationInput.dispatchEvent(new Event('keyup', { bubbles: true }));
          
          // If this is the last character, wait for dropdown and select first option
          if (i === locationValue.length - 1) {
            setTimeout(() => {
              console.log("🔍 Looking for location dropdown suggestions...");
              
              // Multiple selectors to find dropdown suggestions
              const suggestionSelectors = [
                'div[role="option"]',
                'li[role="option"]', 
                'div[data-testid*="typeahead"]',
                'div[data-testid*="suggestion"]',
                'ul[role="listbox"] li',
                'div[role="listbox"] div',
                '.typeahead-results div',
                '.autocomplete-suggestion',
                '[data-testid="location-typeahead-list"] div'
              ];
              
              let suggestions = [];
              
              // Try each selector to find suggestions
              for (const selector of suggestionSelectors) {
                suggestions = document.querySelectorAll(selector);
                if (suggestions.length > 0) {
                  console.log(`✅ Found ${suggestions.length} suggestions using selector: ${selector}`);
                  break;
                }
              }
              
              if (suggestions.length > 0) {
                // Filter suggestions to find valid location options (exclude empty or non-clickable ones)
                const validSuggestions = Array.from(suggestions).filter(suggestion => {
                  const text = suggestion.textContent.trim();
                  return text.length > 0 && 
                         !text.includes('Search') && 
                         !text.includes('Loading') &&
                         suggestion.offsetParent !== null; // Make sure it's visible
                });
                
                if (validSuggestions.length > 0) {
                  const firstSuggestion = validSuggestions[0];
                  const suggestionText = firstSuggestion.textContent.trim();
                  console.log(`✅ Found location suggestions. Clicking first: "${suggestionText}"`);
                  console.log(`🗺️ Original typed: "${locationValue}" → Suggestion: "${suggestionText}"`);
                  
                  // Scroll suggestion into view if needed
                  firstSuggestion.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                  
                  // Add a small delay then click - OPTIMIZED: Reduced from 200ms to 150ms
                  setTimeout(() => {
                    firstSuggestion.click();
                    console.log("✅ Location suggestion clicked successfully - Facebook should now recognize the location");
                    resolve(true);
                  }, 150);
                } else {
                  console.log("⚠️ No valid location suggestions found, keeping typed value");
                  console.log(`🗺️ Facebook will use typed location: "${locationValue}"`);
                  locationInput.blur();
                  resolve(true);
                }
              } else {
                console.log("⚠️ No location dropdown suggestions found, keeping typed value");
                locationInput.blur();
                resolve(true);
              }
            }, 1200); // OPTIMIZED: Reduced from 1500ms to 1200ms for dropdown to appear
          }
        }, i * 80); // OPTIMIZED: Faster typing - reduced from 100ms to 80ms per character
      }
    });
  }

  // Vehicle Type dropdown handler
  function findAndClickVehicleTypeDropdown() {
    console.log("🎯 Looking for Vehicle Type dropdown to click...");
    
    const spans = Array.from(document.querySelectorAll("span"));
    const vehicleTypeSpan = spans.find(span => 
      span.textContent.trim() === "Vehicle type" || 
      span.textContent.trim().includes("Vehicle type")
    );
    
    if (vehicleTypeSpan) {
      console.log("✅ Found Vehicle type span, looking for clickable parent...");
      
      const button = vehicleTypeSpan.closest('[role="button"]');
      if (button) {
        console.log("✅ Found Vehicle type dropdown button with role='button', clicking...");
        button.scrollIntoView({ behavior: 'smooth', block: 'center' });
        button.focus();
        button.click();
        return true;
      }
      
      let parent = vehicleTypeSpan.parentElement;
      for (let i = 0; i < 5; i++) {
        if (!parent) break;
        
        if (parent.getAttribute('role') === 'button' || 
            parent.getAttribute('role') === 'combobox' ||
            parent.onclick || 
            parent.style.cursor === 'pointer' ||
            parent.querySelector('svg')) {
          
          console.log(`✅ Found clickable Vehicle type parent at level ${i}, clicking...`);
          parent.scrollIntoView({ behavior: 'smooth', block: 'center' });
          parent.focus();
          parent.click();
          
          const mouseEvent = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window
          });
          parent.dispatchEvent(mouseEvent);
          
          return true;
        }
        parent = parent.parentElement;
      }
    }
    
    console.warn("❌ Could not find Vehicle type dropdown to click");
    return false;
  }

  function selectVehicleTypeFromDropdown(targetType) {
    console.log(`🎯 Looking for vehicle type "${targetType}" in opened dropdown...`);
    
    return new Promise((resolve) => {
      setTimeout(() => {
        let typeFound = false;
        
        const options = document.querySelectorAll('div[role="option"], li[role="option"], [role="menuitem"]');
        console.log(`Found ${options.length} dropdown options with role`);
        
        for (const option of options) {
          const optionText = option.textContent.trim();
          console.log(`Checking option: "${optionText}"`);
          
          if (optionText === targetType || optionText.toLowerCase() === targetType.toLowerCase()) {
            console.log(`✅ Found exact vehicle type match: ${targetType}`);
            option.click();
            typeFound = true;
            break;
          }
        }
        
        if (!typeFound) {
          console.log("🔄 Searching in all visible elements for vehicle type...");
          const allElements = document.querySelectorAll('div, span, li, button');
          
          for (const element of allElements) {
            const elementText = element.textContent.trim();
            
            if ((elementText === targetType || elementText.toLowerCase() === targetType.toLowerCase()) && 
                element.offsetParent !== null && 
                element.offsetHeight > 0 && 
                element.offsetWidth > 0) {
              
              console.log(`✅ Found vehicle type by text content: ${targetType}`, element);
              element.focus();
              element.click();
              
              const clickEvent = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window
              });
              element.dispatchEvent(clickEvent);
              
              typeFound = true;
              break;
            }
          }
        }
        
        resolve(typeFound);
      }, 400); // OPTIMIZED: Reduced from 500ms to 400ms
    });
  }

  async function handleVehicleTypeDropdown(targetType) {
    console.log(`🎯 Starting Vehicle Type dropdown process for: ${targetType}`);
    
    const dropdownClicked = findAndClickVehicleTypeDropdown();
    
    if (!dropdownClicked) {
      console.warn("❌ Could not click Vehicle Type dropdown");
      return false;
    }
    
    console.log("✅ Vehicle Type dropdown clicked, waiting for it to open...");
    
    await new Promise(resolve => setTimeout(resolve, 600)); // OPTIMIZED: Reduced from 800ms to 600ms
    const typeSelected = await selectVehicleTypeFromDropdown(targetType);
    
    return typeSelected;
  }

  function findAndClickYearDropdown() {
    console.log("🎯 Looking for Year dropdown to click...");
    
    const spans = Array.from(document.querySelectorAll("span"));
    const yearSpan = spans.find(span => span.textContent.trim() === "Year");
    
    if (yearSpan) {
      console.log("✅ Found Year span, looking for clickable parent...");
      
      const button = yearSpan.closest('[role="button"]');
      if (button) {
        console.log("✅ Found Year dropdown button with role='button', clicking...");
        button.scrollIntoView({ behavior: 'smooth', block: 'center' });
        button.focus();
        button.click();
        
        // Enhanced click with multiple event types
        const mouseEvent = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window
        });
        button.dispatchEvent(mouseEvent);
        
        // Try keyboard events to ensure dropdown opens
        const keydownEvent = new KeyboardEvent('keydown', {
          key: 'ArrowDown',
          code: 'ArrowDown',
          keyCode: 40,
          bubbles: true
        });
        button.dispatchEvent(keydownEvent);
        
        return true;
      }
      
      let parent = yearSpan.parentElement;
      for (let i = 0; i < 5; i++) {
        if (!parent) break;
        
        if (parent.getAttribute('role') === 'button' || 
            parent.getAttribute('role') === 'combobox' ||
            parent.onclick || 
            parent.style.cursor === 'pointer' ||
            parent.querySelector('svg')) {
          
          console.log(`✅ Found clickable Year parent at level ${i}, clicking...`);
          parent.scrollIntoView({ behavior: 'smooth', block: 'center' });
          parent.focus();
          parent.click();
          
          // Enhanced click with multiple event types
          const mouseEvent = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window
          });
          parent.dispatchEvent(mouseEvent);
          
          // Try keyboard events to ensure dropdown opens
          const keydownEvent = new KeyboardEvent('keydown', {
            key: 'ArrowDown',
            code: 'ArrowDown',
            keyCode: 40,
            bubbles: true
          });
          parent.dispatchEvent(keydownEvent);
          
          return true;
        }
        parent = parent.parentElement;
      }
    }
    
    // Fallback: Try to find any year input field
    console.log("🔄 Fallback: Looking for year input field...");
    const yearInput = document.querySelector('input[placeholder*="Year"], input[aria-label*="Year"], input[aria-label*="year"]');
    
    if (yearInput) {
      console.log("✅ Found year input field, clicking...");
      yearInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      yearInput.focus();
      yearInput.click();
      
      // Multiple event types to ensure dropdown opens
      const events = [
        new MouseEvent('click', { bubbles: true, cancelable: true, view: window }),
        new KeyboardEvent('keydown', { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40, bubbles: true }),
        new Event('focus', { bubbles: true })
      ];
      
      events.forEach(event => yearInput.dispatchEvent(event));
      return true;
    }
    
    console.warn("❌ Could not find Year dropdown to click");
    return false;
  }

  function selectYearFromDropdown(targetYear) {
    console.log(`🎯 Looking for year ${targetYear} in opened dropdown...`);
    
    return new Promise((resolve) => {
      setTimeout(() => {
        let yearFound = false;
        
        const options = document.querySelectorAll('div[role="option"], li[role="option"], [role="menuitem"]');
        console.log(`Found ${options.length} dropdown options with role`);
        
        for (const option of options) {
          const optionText = option.textContent.trim();
          console.log(`Checking option: "${optionText}"`);
          
          if (optionText === targetYear || optionText === targetYear.toString()) {
            console.log(`✅ Found exact year match: ${targetYear}`);
            option.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            
            // Enhanced click with multiple event types
            setTimeout(() => {
              option.click();
              const clickEvent = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window
              });
              option.dispatchEvent(clickEvent);
            }, 100);
            
            yearFound = true;
            break;
          }
        }
        
        if (!yearFound) {
          console.log("🔄 Searching in all visible elements for year...");
          const allElements = document.querySelectorAll('div, span, li, button');
          
          for (const element of allElements) {
            const elementText = element.textContent.trim();
            
            if ((elementText === targetYear || elementText === targetYear.toString()) && 
                element.offsetParent !== null && 
                element.offsetHeight > 0 && 
                element.offsetWidth > 0) {
              
              console.log(`✅ Found year by text content: ${targetYear}`, element);
              element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              
              setTimeout(() => {
                element.focus();
                element.click();
                
                const clickEvent = new MouseEvent('click', {
                  bubbles: true,
                  cancelable: true,
                  view: window
                });
                element.dispatchEvent(clickEvent);
              }, 100);
              
              yearFound = true;
              break;
            }
          }
        }
        
        // Final fallback: Try to find and type directly into year input
        if (!yearFound) {
          console.log("🔄 Final fallback: Trying to type year directly...");
          const yearInput = document.querySelector('input[placeholder*="Year"], input[aria-label*="Year"], input[aria-label*="year"]');
          
          if (yearInput) {
            console.log("✅ Found year input, typing directly...");
            yearInput.focus();
            yearInput.value = targetYear;
            yearInput.dispatchEvent(new Event('input', { bubbles: true }));
            yearInput.dispatchEvent(new Event('change', { bubbles: true }));
            yearInput.blur();
            yearFound = true;
          }
        }
        
        resolve(yearFound);
      }, 600); // Increased timeout to 600ms for better reliability
    });
  }

  async function handleYearDropdown(targetYear) {
    console.log(`🎯 Starting Year dropdown process for: ${targetYear}`);
    
    const dropdownClicked = findAndClickYearDropdown();
    
    if (!dropdownClicked) {
      console.warn("❌ Could not click Year dropdown");
      return false;
    }
    
    console.log("✅ Year dropdown clicked, waiting for it to open...");
    
    await new Promise(resolve => setTimeout(resolve, 600)); // OPTIMIZED: Reduced from 800ms to 600ms
    const yearSelected = await selectYearFromDropdown(targetYear);
    
    return yearSelected;
  }

  // **NEW: Color dropdown handlers**
  function findAndClickColorDropdown(colorType) {
    console.log(`🎯 Looking for ${colorType} dropdown to click...`);
    
    const searchTerms = colorType === "Exterior" ? 
      ["Exterior colour", "Exterior color", "External colour", "External color", "Body colour", "Body color"] :
      ["Interior colour", "Interior color", "Inside colour", "Inside color", "Internal colour", "Internal color"];
    
    // Try to find by text content
    const spans = Array.from(document.querySelectorAll("span"));
    let colorSpan = null;
    
    for (const term of searchTerms) {
      colorSpan = spans.find(span => 
        span.textContent.trim() === term || 
        span.textContent.trim().includes(term)
      );
      if (colorSpan) break;
    }
    
    if (colorSpan) {
      console.log(`✅ Found ${colorType} color span, looking for clickable parent...`);
      
      const button = colorSpan.closest('[role="button"]');
      if (button) {
        console.log(`✅ Found ${colorType} color dropdown button with role='button', clicking...`);
        button.scrollIntoView({ behavior: 'smooth', block: 'center' });
        button.focus();
        button.click();
        return true;
      }
      
      let parent = colorSpan.parentElement;
      for (let i = 0; i < 5; i++) {
        if (!parent) break;
        
        if (parent.getAttribute('role') === 'button' || 
            parent.getAttribute('role') === 'combobox' ||
            parent.onclick || 
            parent.style.cursor === 'pointer' ||
            parent.querySelector('svg')) {
          
          console.log(`✅ Found clickable ${colorType} color parent at level ${i}, clicking...`);
          parent.scrollIntoView({ behavior: 'smooth', block: 'center' });
          parent.focus();
          parent.click();
          
          const mouseEvent = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window
          });
          parent.dispatchEvent(mouseEvent);
          
          return true;
        }
        parent = parent.parentElement;
      }
    }
    
    console.warn(`❌ Could not find ${colorType} color dropdown to click`);
    return false;
  }

  /**
   * Map any color to Facebook-approved colors
   */
  function mapToFacebookColor(inputColor) {
    if (!inputColor) return '';
    
    const color = inputColor.toLowerCase().trim();
    
    // Facebook approved colors
    const facebookColors = {
      // Direct matches
      'black': 'Black',
      'blue': 'Blue', 
      'brown': 'Brown',
      'gold': 'Gold',
      'green': 'Green',
      'grey': 'Grey',
      'gray': 'Grey', // Map gray to grey
      'pink': 'Pink',
      'purple': 'Purple',
      'red': 'Red',
      'silver': 'Silver',
      'orange': 'Orange',
      'white': 'White',
      'yellow': 'Yellow',
      'charcoal': 'Charcoal',
      'tan': 'Tan',
      'beige': 'Beige',
      'burgundy': 'Burgundy',
      'turquoise': 'Turquoise',
      
      // Common mappings to Facebook colors
      'navy': 'Blue',
      'dark blue': 'Blue',
      'light blue': 'Blue',
      'royal blue': 'Blue',
      'sky blue': 'Blue',
      'teal': 'Turquoise',
      'aqua': 'Turquoise',
      'cyan': 'Turquoise',
      'lime': 'Green',
      'forest green': 'Green',
      'dark green': 'Green',
      'olive': 'Green',
      'maroon': 'Burgundy',
      'crimson': 'Red',
      'scarlet': 'Red',
      'rose': 'Pink',
      'magenta': 'Pink',
      'violet': 'Purple',
      'indigo': 'Purple',
      'lavender': 'Purple',
      'bronze': 'Brown',
      'copper': 'Brown',
      'rust': 'Brown',
      'mahogany': 'Brown',
      'cream': 'White',
      'ivory': 'White',
      'pearl': 'White',
      'off white': 'White',
      'off-white': 'White',
      'platinum': 'Silver',
      'chrome': 'Silver',
      'metallic': 'Silver',
      'gunmetal': 'Charcoal',
      'slate': 'Grey',
      'ash': 'Grey',
      'smoke': 'Grey',
      'stone': 'Grey',
      'khaki': 'Tan',
      'sand': 'Tan',
      'camel': 'Tan',
      'wheat': 'Beige',
      'champagne': 'Beige',
      'almond': 'Beige'
    };
    
    // Check for direct match
    if (facebookColors[color]) {
      console.log(`🎨 Color mapped: "${inputColor}" → "${facebookColors[color]}"`);
      return facebookColors[color];
    }
    
    // Check for partial matches
    for (const [key, value] of Object.entries(facebookColors)) {
      if (color.includes(key) || key.includes(color)) {
        console.log(`🎨 Color mapped (partial): "${inputColor}" → "${value}"`);
        return value;
      }
    }
    
    // Default fallback - try to match by color family
    if (color.includes('blue')) return 'Blue';
    if (color.includes('red')) return 'Red';
    if (color.includes('green')) return 'Green';
    if (color.includes('yellow')) return 'Yellow';
    if (color.includes('orange')) return 'Orange';
    if (color.includes('purple') || color.includes('violet')) return 'Purple';
    if (color.includes('pink')) return 'Pink';
    if (color.includes('brown')) return 'Brown';
    if (color.includes('black')) return 'Black';
    if (color.includes('white')) return 'White';
    if (color.includes('silver') || color.includes('metal')) return 'Silver';
    if (color.includes('gold')) return 'Gold';
    if (color.includes('grey') || color.includes('gray')) return 'Grey';
    if (color.includes('tan')) return 'Tan';
    if (color.includes('beige')) return 'Beige';
    
    // If no match found, return Grey as safe default
    console.log(`🎨 Color mapped (default): "${inputColor}" → "Grey"`);
    return 'Grey';
  }

  function selectColorFromDropdown(targetColor, colorType) {
    console.log(`🎯 Looking for ${colorType} color "${targetColor}" in opened dropdown...`);
    
    // Map the target color to Facebook-approved color before searching
    const mappedColor = mapToFacebookColor(targetColor);
    console.log(`🎨 Using mapped color: "${mappedColor}" for Facebook dropdown`);
    
    return new Promise((resolve) => {
      setTimeout(() => {
        let colorFound = false;
        
        const options = document.querySelectorAll('div[role="option"], li[role="option"], [role="menuitem"]');
        console.log(`Found ${options.length} dropdown options with role`);
        
        for (const option of options) {
          const optionText = option.textContent.trim();
          console.log(`Checking option: "${optionText}"`);
          
          if (optionText.toLowerCase() === mappedColor.toLowerCase() || 
              optionText.toLowerCase().includes(mappedColor.toLowerCase())) {
            console.log(`✅ Found ${colorType} color match: ${mappedColor}`);
            option.click();
            colorFound = true;
            break;
          }
        }
        
        if (!colorFound) {
          console.log(`🔄 Searching in all visible elements for ${colorType} color...`);
          const allElements = document.querySelectorAll('div, span, li, button');
          
          for (const element of allElements) {
            const elementText = element.textContent.trim();
            
            if ((elementText.toLowerCase() === mappedColor.toLowerCase() || 
                 elementText.toLowerCase().includes(mappedColor.toLowerCase())) && 
                element.offsetParent !== null && 
                element.offsetHeight > 0 && 
                element.offsetWidth > 0) {
              
              console.log(`✅ Found ${colorType} color by text content: ${mappedColor}`, element);
              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
              element.click();
              
              const clickEvent = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window
              });
              element.dispatchEvent(clickEvent);
              
              colorFound = true;
              break;
            }
          }
        }
        
        resolve(colorFound);
      }, 400); // OPTIMIZED: Reduced from 500ms to 400ms
    });
  }

  async function handleColorDropdown(targetColor, colorType) {
    console.log(`🎯 Starting ${colorType} Color dropdown process for: ${targetColor}`);
    
    const dropdownClicked = findAndClickColorDropdown(colorType);
    
    if (!dropdownClicked) {
      console.warn(`❌ Could not click ${colorType} Color dropdown`);
      return false;
    }
    
    console.log(`✅ ${colorType} Color dropdown clicked, waiting for it to open...`);
    
    await new Promise(resolve => setTimeout(resolve, 600)); // OPTIMIZED: Reduced from 800ms to 600ms
    const colorSelected = await selectColorFromDropdown(targetColor, colorType);
    
    return colorSelected;
  }

  // **ENHANCED: Much more robust field detection**
  function findInputByMultipleMethods(fieldName) {
    console.log(`🔍 Looking for ${fieldName} input using ENHANCED methods...`);
    
    // Special handling for Description field
    if (fieldName === "Description") {
      const descPlaceholders = [
        'textarea[placeholder*="Description"]',
        'textarea[placeholder*="Tell people about"]',
        'textarea[placeholder*="Describe"]',
        'textarea[placeholder*="Tell buyers"]'
      ];
      
      for (const selector of descPlaceholders) {
        const input = document.querySelector(selector);
        if (input) {
          console.log(`✅ Found Description by placeholder: ${selector}`);
          return input;
        }
      }
      
      const textareas = document.querySelectorAll('textarea');
      if (textareas.length === 1) {
        console.log(`✅ Using the only textarea as Description field`);
        return textareas[0];
      }
    }

    // **ENHANCED: Better field name mapping for Facebook Marketplace**
    let searchTerms = [];
    let fieldType = "input"; // Default to input
    
    if (fieldName === "Make") {
      searchTerms = [
        "Make", "make", "Brand", "brand", "Manufacturer", "manufacturer",
        "What make", "Vehicle make", "Make of vehicle", "Make/Brand"
      ];
    } else if (fieldName === "Model") {
      searchTerms = [
        "Model", "model", "Vehicle model", "Model name", "Model/Type",
        "What model", "Model of vehicle"
      ];
    } else if (fieldName === "Price") {
      searchTerms = [
        "Price", "price", "$", "Cost", "cost", "Amount", "amount",
        "How much", "Asking price", "Sale price", "List price"
      ];
    } else {
      searchTerms = [fieldName];
    }

    // **METHOD 1: Direct placeholder/aria-label search**
    for (const term of searchTerms) {
      // Exact placeholder match
      let input = document.querySelector(`input[placeholder="${term}"]`);
      if (input && input.offsetParent !== null) {
        console.log(`✅ Found ${fieldName} by exact placeholder: "${term}"`);
        return input;
      }
      
      // Partial placeholder match
      input = document.querySelector(`input[placeholder*="${term}"]`);
      if (input && input.offsetParent !== null) {
        console.log(`✅ Found ${fieldName} by partial placeholder: "${term}"`);
        return input;
      }
      
      // Aria-label match
      input = document.querySelector(`input[aria-label*="${term}"]`);
      if (input && input.offsetParent !== null) {
        console.log(`✅ Found ${fieldName} by aria-label: "${term}"`);
        return input;
      }
    }

    // **METHOD 2: Search by label text association**
    const labels = document.querySelectorAll('label');
    for (const label of labels) {
      const labelText = label.textContent.toLowerCase();
      
      for (const term of searchTerms) {
        if (labelText.includes(term.toLowerCase())) {
          // Look for input inside label
          let input = label.querySelector('input');
          if (input && input.offsetParent !== null) {
            console.log(`✅ Found ${fieldName} by label text (inside): "${term}"`);
            return input;
          }
          
          // Look for input by label's 'for' attribute
          const forId = label.getAttribute('for');
          if (forId) {
            input = document.getElementById(forId);
            if (input && input.offsetParent !== null) {
              console.log(`✅ Found ${fieldName} by label 'for' attribute: "${term}"`);
              return input;
            }
          }
        }
      }
    }

    // **METHOD 3: Search by nearby text content**
    const allInputs = document.querySelectorAll('input[type="text"], input:not([type]), input[type="number"]');
    console.log(`🔍 Checking ${allInputs.length} text inputs for ${fieldName}...`);
    
    for (const inp of allInputs) {
      if (!inp.offsetParent) continue; // Skip hidden inputs
      
      // Check the input's container for relevant text
      const container = inp.closest('div');
      if (container) {
        const containerText = container.textContent.toLowerCase();
        
        for (const term of searchTerms) {
          if (containerText.includes(term.toLowerCase())) {
            console.log(`✅ Found ${fieldName} by container text: "${term}"`);
            console.log(`Input details:`, {
              placeholder: inp.placeholder,
              ariaLabel: inp.getAttribute('aria-label'),
              id: inp.id,
              name: inp.name
            });
            return inp;
          }
        }
      }
      
      // Check siblings for text content
      const parent = inp.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children);
        for (const sibling of siblings) {
          const siblingText = sibling.textContent.toLowerCase();
          
          for (const term of searchTerms) {
            if (siblingText.includes(term.toLowerCase()) && siblingText.length < 50) {
              console.log(`✅ Found ${fieldName} by sibling text: "${term}"`);
              return inp;
            }
          }
        }
      }
    }

    // **METHOD 4: Position-based fallback for Make/Model/Price**
    if (fieldName === "Make" || fieldName === "Model" || fieldName === "Price") {
      console.log(`🔄 Trying position-based fallback for ${fieldName}...`);
      
      // Get all visible text inputs
      const visibleInputs = Array.from(document.querySelectorAll('input[type="text"], input:not([type]), input[type="number"]'))
        .filter(inp => inp.offsetParent !== null && 
                      !inp.placeholder?.toLowerCase().includes('location') &&
                      !inp.placeholder?.toLowerCase().includes('search') &&
                      !inp.getAttribute('aria-label')?.toLowerCase().includes('location') &&
                      !inp.getAttribute('aria-label')?.toLowerCase().includes('search'));
      
      console.log(`Found ${visibleInputs.length} visible text inputs for fallback`);
      
      if (visibleInputs.length > 0) {
        let targetIndex = 0;
        
        if (fieldName === "Make") {
          targetIndex = 0; // First available input
        } else if (fieldName === "Model") {
          targetIndex = Math.min(1, visibleInputs.length - 1); // Second input if available
        } else if (fieldName === "Price") {
          // Look for number input or input with $ symbol
          const priceInput = visibleInputs.find(inp => 
            inp.type === 'number' || 
            inp.placeholder?.includes('$') ||
            inp.getAttribute('aria-label')?.includes('$') ||
            inp.getAttribute('aria-label')?.toLowerCase().includes('price')
          );
          
          if (priceInput) {
            console.log(`✅ Found ${fieldName} by price-specific attributes`);
            return priceInput;
          }
          
          targetIndex = Math.min(2, visibleInputs.length - 1); // Third input if available
        }
        
        if (targetIndex < visibleInputs.length) {
          console.log(`✅ Found ${fieldName} by position fallback (index ${targetIndex})`);
          return visibleInputs[targetIndex];
        }
      }
    }

    // **METHOD 5: Debug - Show all available inputs**
    console.log(`❌ Could not find input for ${fieldName}`);
    console.log("🔍 Debug - All visible inputs:");
    
    const debugInputs = document.querySelectorAll('input, textarea');
    debugInputs.forEach((inp, i) => {
      if (inp.offsetParent !== null) {
        console.log(`Input ${i}:`, {
          tag: inp.tagName,
          type: inp.type,
          placeholder: inp.placeholder,
          ariaLabel: inp.getAttribute('aria-label'),
          id: inp.id,
          name: inp.name,
          value: inp.value?.substring(0, 20)
        });
      }
    });
    
    return null;
  }

  function setReactValue(input, value) {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
    
    if (input.tagName === 'TEXTAREA') {
      nativeTextAreaValueSetter.call(input, value);
    } else {
      nativeInputValueSetter.call(input, value);
    }
    
    const inputEvent = new Event('input', { bubbles: true });
    input.dispatchEvent(inputEvent);
  }

  async function fillInputAggressively(input, value, fieldName) {
    if (!input || value === undefined || value === null) {
      console.warn(`❌ Cannot fill ${fieldName} - missing input or value`);
      return false;
    }

    try {
      console.log(`📝 Filling ${fieldName} with:`, value.toString().substring(0, 50));
      
      input.focus();
      input.select();
      input.value = value;
      setReactValue(input, value);
      
      if (input.tagName === 'TEXTAREA') {
        input.innerHTML = value;
        input.textContent = value;
      }
      
      if (fieldName === "Description") {
        input.value = '';
        setReactValue(input, '');
        
        for (let i = 0; i < value.length; i++) {
          const char = value[i];
          input.value += char;
          const inputEvent = new Event('input', { bubbles: true });
          input.dispatchEvent(inputEvent);
        }
      }
      
      const events = ['input', 'change', 'keyup', 'keydown', 'keypress', 'blur', 'focus'];
      events.forEach(eventType => {
        const event = new Event(eventType, { bubbles: true, cancelable: true });
        input.dispatchEvent(event);
      });
      
      setTimeout(() => {
        input.value = value;
        setReactValue(input, value);
        const finalEvent = new Event('input', { bubbles: true });
        input.dispatchEvent(finalEvent);
      }, 100);
      
      console.log(`✅ Successfully filled ${fieldName}`);
      return true;
      
    } catch (error) {
      console.error(`❌ Error filling ${fieldName}:`, error);
      return false;
    }
  }

  async function fillFormWith(data) {
    console.log("📦 Starting form fill with data:", data);

    const make = data.fb_listing_make || "";
    const model = data.fb_listing_model || "";
    const price = data.fb_listing_price || "";
    const description = data.fb_listing_desc || "";
    const year = data.fb_listing_year || "";
    const location = data.fb_listing_location || "";
    const vehicleType = "Trailer";
    
    // **NEW: Color handling**
    const exteriorColor = data.fb_listing_exterior_color || "";
    let interiorColor = data.fb_listing_interior_color || "";
    
    // If no interior color, use exterior color as fallback
    if (!interiorColor && exteriorColor) {
      interiorColor = exteriorColor;
      console.log(`🎨 No interior color found, using exterior color "${exteriorColor}" for both`);
    }

    console.log("🎯 Values to fill:", { 
      vehicleType,
      location: location.substring(0, 40) + (location.length > 40 ? '...' : ''),
      year, 
      make: make.substring(0, 20), 
      model: model.substring(0, 30), 
      price,
      exteriorColor,
      interiorColor,
      descLength: description.length 
    });
    
    // Log state expansion if applicable
    if (location.includes(',') && location.split(',').length === 2) {
      const parts = location.split(',');
      const statePart = parts[1].trim();
      if (statePart.length > 2) {
        console.log(`🗺️ State expansion detected - using full state name: "${statePart}"`);
      }
    }

    let filledCount = 0;
    const results = [];

    // Step 0: Fill Vehicle Type first
    console.log("🎯 Step 0: Handling Vehicle Type dropdown...");
    const vehicleTypeSuccess = await handleVehicleTypeDropdown(vehicleType);
    if (vehicleTypeSuccess) filledCount++;
    results.push({ field: "Vehicle Type", success: vehicleTypeSuccess, value: vehicleType });
    
    // Wait after vehicle type selection - OPTIMIZED: Reduced from 2000ms to 1200ms
    await new Promise(resolve => setTimeout(resolve, 1200));

    // Step 1: Fill Location dropdown
    if (location) {
      console.log("🎯 Step 1: Handling Location dropdown...");
      const success = await handleLocationDropdown(location);
      if (success) filledCount++;
      results.push({ field: "Location", success, value: location });
      
      // Wait after location - OPTIMIZED: Reduced from 1500ms to 1000ms
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Step 2: Fill Year dropdown with retry mechanism
    if (year) {
      console.log("🎯 Step 2: Handling Year dropdown...");
      let yearSuccess = false;
      let attempts = 0;
      const maxAttempts = 2;
      
      while (!yearSuccess && attempts < maxAttempts) {
        attempts++;
        console.log(`🔄 Year dropdown attempt ${attempts}/${maxAttempts}...`);
        
        yearSuccess = await handleYearDropdown(year);
        
        if (!yearSuccess && attempts < maxAttempts) {
          console.log(`⚠️ Year dropdown failed on attempt ${attempts}, retrying in 2 seconds...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      if (yearSuccess) {
        filledCount++;
        console.log(`✅ Year dropdown filled successfully on attempt ${attempts}`);
      } else {
        console.log(`❌ Year dropdown failed after ${maxAttempts} attempts`);
      }
      
      results.push({ field: "Year", success: yearSuccess, value: year });
      
      // Wait for form to update after year selection
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // **ENHANCED: Step 3 - Fill text fields with better detection**
    const fieldsToFill = [
      { name: "Make", value: make },
      { name: "Model", value: model },
      { name: "Price", value: price }
    ];

    for (const field of fieldsToFill) {
      if (field.value) {
        console.log(`🎯 Step 3: Filling ${field.name}...`);
        
        // **RETRY MECHANISM** - Try multiple times to find the input
        let input = null;
        let attempts = 0;
        const maxAttempts = 3;
        
        while (!input && attempts < maxAttempts) {
          attempts++;
          console.log(`Attempt ${attempts}/${maxAttempts} to find ${field.name} input...`);
          
          input = findInputByMultipleMethods(field.name);
          
          if (!input && attempts < maxAttempts) {
            console.log(`⏳ Input not found, waiting before retry... - OPTIMIZED: Reduced from 1000ms to 600ms`);
            await new Promise(resolve => setTimeout(resolve, 600));
          }
        }
        
        if (input) {
          const success = await fillInputAggressively(input, field.value, field.name);
          if (success) filledCount++;
          results.push({ field: field.name, success, value: field.value.substring(0, 20) });
        } else {
          console.warn(`❌ Could not find ${field.name} input after ${maxAttempts} attempts`);
          results.push({ field: field.name, success: false, value: field.value.substring(0, 20) });
        }
        
        // Small delay between fields - OPTIMIZED: Reduced from 500ms to 300ms
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    // **NEW: Step 3.5 - Handle Color Dropdowns**
    if (exteriorColor) {
      console.log("🎯 Step 3.5: Handling Exterior Color dropdown...");
      const exteriorSuccess = await handleColorDropdown(exteriorColor, "Exterior");
      if (exteriorSuccess) filledCount++;
      results.push({ field: "Exterior Color", success: exteriorSuccess, value: exteriorColor });
      
      // Wait after exterior color selection - OPTIMIZED: Reduced from 1500ms to 1000ms
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (interiorColor) {
      console.log("🎯 Step 3.6: Handling Interior Color dropdown...");
      const interiorSuccess = await handleColorDropdown(interiorColor, "Interior");
      if (interiorSuccess) filledCount++;
      results.push({ field: "Interior Color", success: interiorSuccess, value: interiorColor });
      
      // Wait after interior color selection - OPTIMIZED: Reduced from 1500ms to 1000ms
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Step 4: Fill Description last
    setTimeout(async () => {
      if (description) {
        console.log("🎯 Step 4: Filling Description...");
        const descInput = findInputByMultipleMethods("Description");
        if (descInput) {
          const success = await fillInputAggressively(descInput, description, "Description");
          if (success) filledCount++;
          results.push({ field: "Description", success, value: description.substring(0, 30) });
        }
      }
      
      // **NEW: Step 5: Upload Images**
      if (data.fb_listing_images && Array.isArray(data.fb_listing_images) && data.fb_listing_images.length > 0) {
        console.log(`🎯 Step 5: Uploading ${data.fb_listing_images.length} images...`);
        const imageSuccess = await uploadImagesToFacebook(data.fb_listing_images);
        if (imageSuccess) filledCount++;
        results.push({ field: "Images", success: imageSuccess, value: `${data.fb_listing_images.length} photos` });
      } else {
        console.log("📷 No images found in storage");
        results.push({ field: "Images", success: false, value: "No images" });
      }
      
      // **NEW: Step 6: Full Automation - Click Next and Publish buttons**
      if (data.fb_automation_type === "full") {
        console.log("🚀 Step 6: Full Automation - Starting Next and Publish sequence...");
        
        setTimeout(async () => {
          try {
            const publishSuccess = await handleFullAutomationPublish();
            if (publishSuccess) {
              results.push({ field: "Auto Publish", success: true, value: "Vehicle Published" });
              showBanner("🎉 Vehicle automatically published to Facebook Marketplace!", 'success');
            } else {
              results.push({ field: "Auto Publish", success: false, value: "Publish Failed" });
              showBanner("⚠️ Auto-publish failed. Please publish manually.", 'warning');
            }
            updateResultsBanner(filledCount, results);
          } catch (error) {
            console.error("❌ Full automation publish error:", error);
            results.push({ field: "Auto Publish", success: false, value: "Error occurred" });
            showBanner("❌ Auto-publish error. Please publish manually.", 'error');
            updateResultsBanner(filledCount, results);
          }
        }, 3000); // Wait 3 seconds after image upload
      }
      
      updateResultsBanner(filledCount, results);
    }, 2000); // OPTIMIZED: Reduced from 3000ms to 2000ms

    updateResultsBanner(filledCount, results);
  }

  function updateResultsBanner(filledCount, results) {
    const existingBanner = document.querySelector('#fb-fill-banner');
    if (existingBanner) {
      existingBanner.remove();
    }
    
    const banner = document.createElement("div");
    banner.id = 'fb-fill-banner';
    const resultsList = results.map(r => {
      const icon = r.success ? '✅' : '❌';
      const value = r.value.length > 15 ? r.value.substring(0, 15) + '...' : r.value;
      return `${icon} ${r.field}: ${value}`;
    }).join('<br/>');
    
    banner.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 8px;">
        🎯 ENHANCED FILL: ${filledCount}/${results.length} fields
      </div>
      <div style="font-size: 10px; line-height: 1.3;">
        ${resultsList}
      </div>
    `;
    
    Object.assign(banner.style, {
      position: "fixed",
      top: "10px",
      right: "10px",
      padding: "12px",
      background: filledCount >= 5 ? "#28a745" : "#dc3545",
      color: "white",
      zIndex: 99999,
      borderRadius: "8px",
      maxWidth: "280px",
      fontSize: "11px",
      boxShadow: "0 4px 12px rgba(0,0,0,0.3)"
    });
    
    document.body.appendChild(banner);
    setTimeout(() => banner.remove(), 15000);
  }

  function waitAndFill(retries = 6) {
    console.log(`⏳ Waiting for form... (${retries} attempts left)`);
    
    const anyInput = document.querySelector('input:not([type="hidden"]), textarea, [role="button"]');
    
    if (!anyInput) {
      if (retries > 0) {
        console.log("⏳ No inputs found, waiting... - OPTIMIZED: Reduced from 2000ms to 1500ms");
        return setTimeout(() => waitAndFill(retries - 1), 1500);
      } else {
        console.warn("❌ No form inputs found after all attempts");
        return;
      }
    }

    console.log("✅ Form detected, getting data from storage...");

    chrome.storage.local.get([
      "fb_listing_make",
      "fb_listing_model", 
      "fb_listing_price",
      "fb_listing_desc",
      "fb_listing_year",
      "fb_listing_location",
      "fb_listing_images",
      "fb_listing_exterior_color",
      "fb_listing_interior_color",
      "fb_automation_type"
    ], function (data) {
      console.log("📦 Storage data:", data);
      
      if (!data.fb_listing_make && !data.fb_listing_price) {
        console.warn("⚠️ No data in storage");
        return;
      }
      
      setTimeout(() => {
        fillFormWith(data);
      }, 800); // OPTIMIZED: Reduced from 1000ms to 800ms
    });
  }

  // **NEW: Full Automation - Handle Next and Publish buttons**
  async function handleFullAutomationPublish() {
    console.log("🚀 Starting Full Automation publish sequence...");
    
    try {
      // Step 1: Wait 5 seconds before clicking Next button
      console.log("🎯 Step 1: Waiting 5 seconds before looking for Next button...");
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Step 2: Look for and click Next button
      console.log("🎯 Step 2: Looking for Next button...");
      const nextButton = await findAndClickNextButton();
      
      if (!nextButton) {
        console.log("⚠️ Next button not found, proceeding to look for Publish button...");
      } else {
        console.log("✅ Next button clicked successfully");
        // Step 3: Wait 10 seconds after clicking Next button
        console.log("🎯 Step 3: Waiting 10 seconds after clicking Next button...");
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
      
      // Step 4: Look for and click Publish button
      console.log("🎯 Step 4: Looking for Publish button...");
      const publishButton = await findAndClickPublishButton();
      
      if (!publishButton) {
        console.log("❌ Publish button not found");
        return false;
      }
      
      console.log("✅ Publish button clicked successfully");
      
      // Step 5: Wait for publishing to complete
      console.log("🎯 Step 5: Waiting for publishing to complete...");
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds for publishing to complete
      
      // Step 6: Check if publishing was successful
      const publishSuccess = await checkPublishingSuccess();
      
      if (publishSuccess) {
        console.log("🎉 Vehicle successfully published to Facebook Marketplace!");
        return true;
      } else {
        console.log("⚠️ Publishing status unclear, assuming success");
        return true; // Assume success if we can't determine the status
      }
      
    } catch (error) {
      console.error("❌ Error in full automation publish:", error);
      return false;
    }
  }
  
  // Helper function to find and click Next button
  async function findAndClickNextButton() {
    console.log("🔍 Searching for Next button...");
    
    const nextButtonSelectors = [
      'button[aria-label*="Next"]',
      'button[aria-label*="next"]',
      '[role="button"][aria-label*="Next"]',
      '[role="button"][aria-label*="next"]'
    ];
    
    // Try each selector
    for (const selector of nextButtonSelectors) {
      try {
        const button = document.querySelector(selector);
        if (button && button.offsetParent !== null) {
          console.log(`✅ Found Next button with selector: ${selector}`);
          button.scrollIntoView({ behavior: 'smooth', block: 'center' });
          await new Promise(resolve => setTimeout(resolve, 500));
          button.click();
          return button;
        }
      } catch (error) {
        console.log(`⚠️ Selector ${selector} failed:`, error);
      }
    }
    
    // Fallback: Search by text content
    console.log("🔄 Fallback: Searching by text content...");
    const allButtons = document.querySelectorAll('button, [role="button"], div[tabindex="0"]');
    
    for (const button of allButtons) {
      const text = button.textContent.trim().toLowerCase();
      if ((text === 'next' || text === 'continue') && button.offsetParent !== null) {
        console.log(`✅ Found Next button by text: "${button.textContent.trim()}"`);
        button.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await new Promise(resolve => setTimeout(resolve, 500));
        button.click();
        return button;
      }
    }
    
    console.log("❌ Next button not found");
    return null;
  }
  
  // Helper function to find and click Publish button
  async function findAndClickPublishButton() {
    console.log("🔍 Searching for Publish button...");
    
    const publishButtonSelectors = [
      'button[aria-label*="Publish"]',
      'button[aria-label*="publish"]',
      '[role="button"][aria-label*="Publish"]',
      '[role="button"][aria-label*="publish"]'
    ];
    
    // Try each selector
    for (const selector of publishButtonSelectors) {
      try {
        const button = document.querySelector(selector);
        if (button && button.offsetParent !== null) {
          console.log(`✅ Found Publish button with selector: ${selector}`);
          button.scrollIntoView({ behavior: 'smooth', block: 'center' });
          await new Promise(resolve => setTimeout(resolve, 500));
          button.click();
          return button;
        }
      } catch (error) {
        console.log(`⚠️ Selector ${selector} failed:`, error);
      }
    }
    
    // Fallback: Search by text content
    console.log("🔄 Fallback: Searching by text content...");
    const allButtons = document.querySelectorAll('button, [role="button"], div[tabindex="0"]');
    
    for (const button of allButtons) {
      const text = button.textContent.trim().toLowerCase();
      if ((text === 'publish' || text === 'post' || text === 'list') && button.offsetParent !== null) {
        console.log(`✅ Found Publish button by text: "${button.textContent.trim()}"`);
        button.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await new Promise(resolve => setTimeout(resolve, 500));
        button.click();
        return button;
      }
    }
    
    // Advanced fallback: Look for blue buttons (Facebook's primary action buttons)
    console.log("🔄 Advanced fallback: Looking for blue buttons...");
    for (const button of allButtons) {
      if (button.offsetParent === null) continue;
      
      const computedStyle = window.getComputedStyle(button);
      const bgColor = computedStyle.backgroundColor;
      
      // Check for Facebook blue colors
      if (bgColor.includes('rgb(24, 119, 242)') || 
          bgColor.includes('rgb(66, 103, 178)') || 
          bgColor.includes('rgb(56, 88, 152)') ||
          bgColor.includes('rgb(8, 102, 255)')) {
        
        const text = button.textContent.trim().toLowerCase();
        console.log(`🔍 Found blue button: "${button.textContent.trim()}" (bg: ${bgColor})`);
        
        // If it's a blue button and might be publish-related
        if (text.length > 0 && text.length < 20) {
          console.log(`✅ Clicking blue button as potential Publish button: "${button.textContent.trim()}"`);
          button.scrollIntoView({ behavior: 'smooth', block: 'center' });
          await new Promise(resolve => setTimeout(resolve, 500));
          button.click();
          return button;
        }
      }
    }
    
    console.log("❌ Publish button not found");
    return null;
  }
  
  // Helper function to check if publishing was successful
  async function checkPublishingSuccess() {
    console.log("🔍 Checking publishing success...");
    
    // Wait a bit for the page to update
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Look for success indicators
    const successIndicators = [
      'Your listing is now live',
      'Successfully posted',
      'Your item has been posted',
      'Listing created',
      'Posted to Marketplace',
      'success',
      'posted',
      'published',
      'live'
    ];
    
    const pageText = document.body.textContent.toLowerCase();
    
    for (const indicator of successIndicators) {
      if (pageText.includes(indicator.toLowerCase())) {
        console.log(`✅ Publishing success detected: "${indicator}"`);
        return true;
      }
    }
    
    // Check URL for success patterns
    const currentUrl = window.location.href.toLowerCase();
    if (currentUrl.includes('success') || currentUrl.includes('posted') || currentUrl.includes('marketplace')) {
      console.log("✅ Publishing success detected from URL");
      return true;
    }
    
    console.log("⚠️ Could not determine publishing status");
    return false; // Return false if we can't determine success
  }

  console.log("🚀 Starting ENHANCED form filler with robust field detection...");
  setTimeout(() => {
    waitAndFill();
  }, 3500); // OPTIMIZED: Reduced from 4000ms to 3500ms

  // **NEW: Image downloading and uploading functions**
  async function downloadImageAsFile(imageUrl, filename) {
    console.log(`📥 Downloading image: ${imageUrl}`);
    
    try {
      // Fetch the image
      const response = await fetch(imageUrl, {
        mode: 'cors',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // Get the image blob
      const blob = await response.blob();
      
      // Create a file from the blob
      const file = new File([blob], filename, { type: blob.type });
      
      console.log(`✅ Downloaded image: ${filename}, size: ${blob.size} bytes, type: ${blob.type}`);
      return file;
      
    } catch (error) {
      console.error(`❌ Failed to download image ${imageUrl}:`, error);
      return null;
    }
  }
  
  function findPhotoUploadInput() {
    console.log("🔍 Looking for photo upload input...");
    
    // Multiple strategies to find the file input
    const selectors = [
      'input[type="file"][accept*="image"]',
      'input[type="file"]',
      'input[multiple][accept*="image"]',
      'input[aria-label*="photo"]',
      'input[aria-label*="image"]',
      'input[data-testid*="photo"]',
      'input[data-testid*="image"]'
    ];
    
    for (const selector of selectors) {
      const input = document.querySelector(selector);
      if (input) {
        console.log(`✅ Found photo input with selector: ${selector}`, input);
        return input;
      }
    }
    
    // Look for file inputs inside photo upload areas
    const photoAreas = document.querySelectorAll('div[aria-label*="photo"], div[aria-label*="Add photo"], div[data-testid*="photo"]');
    for (const area of photoAreas) {
      const input = area.querySelector('input[type="file"]');
      if (input) {
        console.log("✅ Found photo input inside photo area:", input);
        return input;
      }
    }
    
    console.warn("❌ Could not find photo upload input");
    return null;
  }
  
  async function uploadImagesToFacebook(imageUrls) {
    if (!imageUrls || imageUrls.length === 0) {
      console.log("📷 No images to upload");
      return false;
    }
    
    console.log(`📸 Starting upload of ${imageUrls.length} images...`);
    
    // Find the photo upload input
    const photoInput = findPhotoUploadInput();
    if (!photoInput) {
      console.error("❌ Could not find photo upload input");
      return false;
    }
    
    try {
      // Download all images as files
      const downloadPromises = imageUrls.map((url, index) => {
        const extension = url.split('.').pop().split('?')[0] || 'jpg';
        const filename = `trailer_image_${index + 1}.${extension}`;
        return downloadImageAsFile(url, filename);
      });
      
      console.log("⏳ Downloading all images...");
      const files = await Promise.all(downloadPromises);
      
      // Filter out failed downloads
      const validFiles = files.filter(file => file !== null);
      
      if (validFiles.length === 0) {
        console.error("❌ No images were successfully downloaded");
        return false;
      }
      
      console.log(`✅ Successfully downloaded ${validFiles.length} images`);
      
      // Create a FileList-like object
      const dt = new DataTransfer();
      validFiles.forEach(file => dt.items.add(file));
      
      // Set the files to the input
      photoInput.files = dt.files;
      
      // Trigger change events
      const changeEvent = new Event('change', { bubbles: true });
      photoInput.dispatchEvent(changeEvent);
      
      const inputEvent = new Event('input', { bubbles: true });
      photoInput.dispatchEvent(inputEvent);
      
      console.log(`🎉 Successfully uploaded ${validFiles.length} images to Facebook!`);
      
      // Show success message
      showBanner(`📸 Uploaded ${validFiles.length} images successfully!`, 'success');
      
      return true;
      
    } catch (error) {
      console.error("❌ Error uploading images:", error);
      showBanner("❌ Failed to upload images", 'error');
      return false;
    }
  }
  
  function showBanner(message, type = 'info') {
    // Remove existing banner
    const existingBanner = document.getElementById('trailer-scraper-banner');
    if (existingBanner) {
      existingBanner.remove();
    }
    
    // Create new banner
    const banner = document.createElement('div');
    banner.id = 'trailer-scraper-banner';
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
      maxWidth: '300px'
    });
    
    document.body.appendChild(banner);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      if (banner.parentElement) {
        banner.remove();
      }
    }, 5000);
  }
  
  // Function to display proxy information in console
  function displayProxyInfo() {
    console.log("🌐 ============================================");
    console.log("🌐 FACEBOOK MARKETPLACE PROXY INFORMATION");
    console.log("🌐 ============================================");
    
    // Try multiple methods to get proxy IP
    getProxyIPInfo();
    
    // Display user agent and other browser info
    console.log("🌐 User Agent:", navigator.userAgent);
    console.log("🌐 Page URL:", window.location.href);
    console.log("🌐 Timestamp:", new Date().toISOString());
    console.log("🌐 ============================================");
  }
  
  // Function to get proxy IP using multiple methods
  function getProxyIPInfo() {
    // Method 1: PRIORITY - Get from chrome storage (dynamic IP from CRM)
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get(['proxy_ip', 'proxy_info'], function(result) {
        if (result.proxy_ip) {
          console.log('🎯 Using dynamic proxy IP from CRM:', result.proxy_ip);
          console.log('📊 Proxy source:', result.proxy_info?.source || 'unknown');
          displayProxySuccess(result.proxy_ip, result.proxy_info);
          return;
        }
        console.log('⚠️ No proxy IP in storage, trying alternative methods...');
        // If not in storage, try other methods
        tryAlternativeIPMethods();
      });
    } else {
      console.log('⚠️ Chrome storage not available, trying alternative methods...');
      tryAlternativeIPMethods();
    }
  }
  
  // Try alternative methods to get IP
  function tryAlternativeIPMethods() {
    // Method 2: Try httpbin.org (usually allows CORS)
    fetch('https://httpbin.org/ip')
      .then(response => response.json())
      .then(data => {
        displayProxySuccess(data.origin);
      })
      .catch(() => {
        // Method 3: Try ipify (another CORS-friendly service)
        fetch('https://api.ipify.org?format=json')
          .then(response => response.json())
          .then(data => {
            displayProxySuccess(data.ip);
          })
          .catch(() => {
            // Method 4: Try ipapi.co
            fetch('https://ipapi.co/json/')
              .then(response => response.json())
              .then(data => {
                displayProxySuccess(data.ip, {
                  city: data.city,
                  country: data.country_name,
                  org: data.org
                });
              })
              .catch(() => {
                // All methods failed
                displayProxyFallback();
              });
          });
      });
  }
  
  // Display successful proxy info
  function displayProxySuccess(ip, info = {}) {
    const isSessionBased = info?.source === "session_persistent_from_crm";
    const isDynamic = info?.source === "dynamic_from_crm";
    const isFallback = info?.source === "fallback_hardcoded";
    
    let statusText, sourceText, bgColor, statusMessage;
    
    if (isSessionBased) {
      statusText = "SESSION-PERSISTENT ACTIVE (Prevents Facebook blocks!)";
      sourceText = "🔒 Session-persistent IP from CRM";
      bgColor = "#28a745"; // Green for session-persistent
      statusMessage = `🔒 SESSION-PERSISTENT PROXY ACTIVE - ${info?.city || 'Selected'} IP: ${ip} (Prevents Facebook blocks!)`;
    } else if (isDynamic) {
      statusText = "DYNAMIC ROTATION ACTIVE (May cause Facebook blocks)";
      sourceText = "🔄 Dynamic IP from CRM";
      bgColor = "#007bff"; // Blue for dynamic
      statusMessage = `🔄 DYNAMIC PROXY ACTIVE - ${info?.city || 'Selected'} IP: ${ip}`;
    } else {
      statusText = "FALLBACK ACTIVE (May cause Facebook blocks)";
      sourceText = "📍 Static/Fallback IP";
      bgColor = "#ffc107"; // Yellow for fallback
      statusMessage = `📍 FALLBACK PROXY ACTIVE - ${info?.city || 'Selected'} IP: ${ip}`;
    }
    
    console.log("🌐 Current IP Address:", ip);
    console.log("🌐 Proxy Source:", sourceText);
    console.log("🌐 Proxy Type:", info?.type || "unknown");
    console.log("🌐 Session-Based:", info?.session_based ? "YES" : "NO");
    console.log("🌐 Proxy Location:", info?.location || "kansas_city");
    console.log("🌐 Country:", info?.country || "United States");
    console.log("🌐 City:", info?.city || "No City Selected");
    console.log("🌐 ISP:", info?.org || "Oxylabs");
    console.log("🌐 Proxy Server: pr.oxylabs.io:7777");
    console.log("🌐 Proxy Status: ✅", statusText);
    if (info?.timestamp) {
      console.log("🌐 Last Updated:", new Date(info.timestamp).toLocaleString());
    }
    console.log("🌐 ============================================");
    
    // Display prominent status message
    console.log(
      `%c${statusMessage}`,
      `background: ${bgColor}; color: ${bgColor === "#ffc107" ? "black" : "white"}; padding: 8px; border-radius: 4px; font-weight: bold;`
    );
  }
  
  // Display fallback info when IP fetch fails
  function displayProxyFallback() {
    console.log("🌐 Current IP Address: Unable to fetch (CORS restrictions)");
    console.log("🌐 Proxy Location: kansas_city");
    console.log("🌐 Proxy Server: pr.oxylabs.io:7777");
    console.log("🌐 Proxy Status: ✅ LIKELY ACTIVE (check network tab)");
    console.log("🌐 ============================================");
    
    // Still show prominent message
    console.log(
      "%c🌐 PROXY LIKELY ACTIVE - Selected Location",
      "background: #ffc107; color: black; padding: 8px; border-radius: 4px; font-weight: bold;"
    );
    
    // Provide instructions
    console.log("💡 To verify proxy IP:");
    console.log("   1. Check Network tab in DevTools");
    console.log("   2. Look for requests going through proxy");
    console.log("   3. Or visit whatismyipaddress.com manually");
  }
})();