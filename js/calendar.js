// Calendar Management Module
window.CalendarManagement = (function() {
    'use strict';

    function init() {
        // Wait for the DOM to have the scheduler container
        setTimeout(() => {
            if (window.scheduler && document.getElementById('scheduler_here')) {
                // Load config, then init scheduler
                loadEnabledFields(() => {
                    scheduler.init('scheduler_here', new Date(), "month");
                    configureLightbox();

                    // Attach the Modify Form button event here
                    const modifyBtn = document.getElementById('modifyFormBtn');
                    if (modifyBtn) {
                        modifyBtn.onclick = openModifyFormModal;
                    }

                    // Optional: load events from a static array or API
                    // scheduler.parse([
                    //     { id:1, start_date:"2024-06-20 09:00", end_date:"2024-06-20 12:00", text:"Sample Event" }
                    // ], "json");

                    // Attach a basic event save handler
                    scheduler.attachEvent("onEventSave", function(id, event, is_new) {
                        // This is called when the user clicks "Save" in the default lightbox
                        // event: { id, start_date, end_date, text }
                        console.log("Saving event:", event);

                        // Here you would send the event to your backend API
                        // Example (uncomment and adapt when you have an API):
                        /*
                        fetch('/your/api/save_event.php', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(event)
                        })
                        .then(res => res.json())
                        .then(data => {
                            if (data.success) {
                                alert('Event saved!');
                            } else {
                                alert('Failed to save event');
                            }
                        })
                        .catch(err => alert('Error: ' + err));
                        */

                        // For now, just allow the event to be saved in the scheduler UI
                        return true;
                    });
                });
            }
        }, 100);
    }

    return { init };
})();

// For router compatibility
window.calendar = function() {
    CalendarManagement.init();
};

let enabledFields = {
    jobName: true,
    customerName: true,
    customerEmail: true,
    customerMobile: true,
    customerAddress: true,
    customerInstructions: true
};

// Load config from server
function loadEnabledFields(callback) {
    fetch('app/modules/dealer/api/get_lightbox_config.php')
        .then(res => res.json())
        .then(data => {
            enabledFields = data;
            if (callback) callback();
        })
        .catch(() => {
            // fallback to default if error
            if (callback) callback();
        });
}

// Save config to server
function saveEnabledFields() {
    fetch('app/modules/dealer/api/save_lightbox_config.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(enabledFields)
    });
}

function openModifyFormModal() {
    // Set checkboxes based on enabledFields
    for (const key in enabledFields) {
        document.querySelector(`#modifyFormFieldsForm input[name="${key}"]`).checked = enabledFields[key];
    }
    document.getElementById('modifyFormModal').style.display = 'flex';
}

function closeModifyFormModal() {
    document.getElementById('modifyFormModal').style.display = 'none';
}

function saveModifyFormFields() {
    // Update enabledFields from checkboxes
    for (const key in enabledFields) {
        enabledFields[key] = document.querySelector(`#modifyFormFieldsForm input[name="${key}"]`).checked;
    }
    saveEnabledFields(); // Save to server
    closeModifyFormModal();
    configureLightbox(); // Rebuild the lightbox with new fields
}

// Dynamically build the lightbox config
function configureLightbox() {
    let sections = [];
    if (enabledFields.jobName) {
        sections.push({ name: "Job Name", height: 2, map_to: "jobName", type: "textarea" });
    }
    if (enabledFields.customerName) {
        sections.push({ name: "Customer Name", height: 2, map_to: "customerName", type: "textarea" });
    }
    if (enabledFields.customerEmail) {
        sections.push({ name: "Customer Email", height: 2, map_to: "customerEmail", type: "textarea" });
    }
    if (enabledFields.customerMobile) {
        sections.push({ name: "Customer Mobile", height: 2, map_to: "customerMobile", type: "textarea" });
    }
    if (enabledFields.customerAddress) {
        sections.push({ name: "Customer Address", height: 4, map_to: "customerAddress", type: "textarea" });
    }
    if (enabledFields.customerInstructions) {
        sections.push({ name: "Customer Instructions", height: 4, map_to: "customerInstructions", type: "textarea" });
    }
    // Always add the time section at the end (required by DHTMLX)
    sections.push({ name: "Time", height: 21, map_to: "auto", type: "time" });

    scheduler.config.lightbox.sections = sections;
    scheduler.resetLightbox();
}
