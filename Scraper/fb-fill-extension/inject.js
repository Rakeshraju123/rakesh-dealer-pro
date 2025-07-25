(function () {
  console.log("🚀 Inject script running on CRM page");

  window.addEventListener("message", function (event) {
    console.log("📨 Message received:", event.data);
    
    if (!event.data || event.data.type !== "FB_MARKETPLACE_DATA") {
      console.log("❌ Invalid message type. Expected: FB_MARKETPLACE_DATA, Got:", event.data?.type);
      return;
    }

    const {
      title,
      price,
      description,
      images,
      location,
      vehicle_type,
      make,
      model,
      year,
      condition,
      trailer_type,
      exterior_color,
      interior_color,
      automation_type
    } = event.data;

    console.log("📦 Received trailer data from CRM:", {
      title, price, location, make, model, year, condition
    });
    
    console.log("🌐 Proxy IP information received from CRM:", {
      proxy_ip: event.data.proxy_ip,
      proxy_type: event.data.proxy_type,
      session_based: event.data.session_based,
      is_session_persistent: event.data.session_based && event.data.proxy_type === "session_persistent",
      is_fallback: !event.data.proxy_ip || event.data.proxy_ip === "173.172.64.37"
    });

    // ✅ Store in chrome.storage with proper error handling (including dynamic proxy info)
    chrome.storage.local.set({
      fb_listing_title: title || "",
      fb_listing_price: price || "",
      fb_listing_desc: description || "",
      fb_listing_images: images || [],
      fb_listing_location: location || "United States",
      fb_listing_vehicleType: vehicle_type || "Trailer",
      fb_listing_make: make || "",
      fb_listing_model: model || "",
      fb_listing_year: year || "",
      fb_listing_condition: condition || "Used",
      fb_listing_categoryType: trailer_type || "Trailer",
      fb_listing_exterior_color: exterior_color || "",
      fb_listing_interior_color: interior_color || "",
      fb_automation_type: automation_type || "semi",
      // Store session-based proxy information from CRM
      proxy_ip: event.data.proxy_ip || "173.172.64.37",
      proxy_info: {
        location: null,
        country: "United States", 
        city: "No City Selected",
        org: "Oxylabs",
        timestamp: new Date().toISOString(),
        source: event.data.session_based ? "session_persistent_from_crm" : 
                (event.data.proxy_ip && event.data.proxy_ip !== "173.172.64.37" ? "dynamic_from_crm" : "fallback_hardcoded"),
        type: event.data.proxy_type || "unknown",
        session_based: event.data.session_based || false
      }
    }, () => {
      if (chrome.runtime.lastError) {
        console.error("❌ Error saving to storage:", chrome.runtime.lastError);
        return;
      }
      
      console.log("✅ Successfully saved real trailer data to chrome.storage.local");
      
      // Verify the data was saved
      chrome.storage.local.get(null, (allData) => {
        console.log("🔍 All data in storage:", allData);
      });
    });
  });
})();