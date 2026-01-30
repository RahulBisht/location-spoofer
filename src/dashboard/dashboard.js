// Dashboard UI Logic

let map;
let marker;
let selectedCoords = { lat: 37.7749, long: -122.4194 }; // Default SF
let isSpoofing = false;
let isIpSyncing = false;

// Custom Red Icon - Google Maps Style
// Custom Red Icon - Google Maps Style
// Custom Red Icon - Google Maps Style
const redIcon = new L.Icon({
    iconUrl: '/icons/marker-icon-2x-red.png', // Local asset (Root-relative)
    shadowUrl: '/icons/marker-shadow.png',     // Local asset (Root-relative)
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

document.addEventListener('DOMContentLoaded', () => {
    initMap();
    initControls();
    loadState();
    loadSavedLocations();
});

function initMap() {
    // Default to a neutral view (e.g., San Francisco).
    map = L.map('map', {
        scrollWheelZoom: true, // Enable zoom with mouse wheel/trackpad
        doubleClickZoom: true, // Enable zoom with double click
        dragging: true,        // Enable panning
        zoomControl: true,     // Show +/- buttons
        boxZoom: true,         // Shift+drag to zoom
        keyboard: true,        // Keyboard navigation
        touchZoom: true,       // Force enable touch/pinch zoom
        tap: true              // Fix for some touch devices
    }).setView([51.505, -0.09], 13);

    // Force enable handlers just in case
    map.scrollWheelZoom.enable();
    map.dragging.enable();
    map.touchZoom.enable();
    map.doubleClickZoom.enable();

    // Use OpenStreetMap Standard tiles (Light theme, similar to Google Maps)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
    }).addTo(map);

    map.on('click', onMapClick);

    // FIX: Leaflet sometimes renders 0x0 in Popups. Force update after short delay.
    setTimeout(() => {
        map.invalidateSize();
    }, 100);
}

function onMapClick(e) {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;

    const popupContent = document.createElement('div');
    popupContent.innerHTML = `
        <div style="text-align: center;">
            <p style="margin: 0 0 8px 0; font-weight: bold; color: #333;">Set Location Here?</p>
            <button id="btn-confirm-loc" style="
                background: #64b5f6; 
                color: #1e1e1e; 
                border: none; 
                padding: 6px 12px; 
                border-radius: 4px; 
                cursor: pointer; 
                font-weight: bold;
            ">Teleport</button>
        </div>
    `;

    // Handle Confirm Click
    popupContent.querySelector('#btn-confirm-loc').addEventListener('click', () => {
        map.closePopup();
        loadLocation({ lat, long: lng });
    });

    // Show Popup
    L.popup()
        .setLatLng(e.latlng)
        .setContent(popupContent)
        .openOn(map);
}

function initControls() {
    const btnActivate = document.getElementById('btn-activate');
    btnActivate.addEventListener('click', toggleSpoofing);

    const btnIpSync = document.getElementById('btn-ip-sync');
    if (btnIpSync) {
        btnIpSync.addEventListener('click', () => toggleIpSync(!isIpSyncing));
    }

    // Saved Locations Controls
    const btnSave = document.getElementById('btn-save-loc');
    if (btnSave) btnSave.addEventListener('click', saveLocation);

    const inputName = document.getElementById('input-loc-name');
    if (inputName) {
        inputName.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') saveLocation();
        });
    }

    // Search Controls
    const inputSearch = document.getElementById('input-search');
    if (inputSearch) {
        inputSearch.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') searchAddress(inputSearch.value);
        });
    }

    // Sidebar Toggle
    document.getElementById('btn-locations').addEventListener('click', toggleSidePanel);
    document.getElementById('btn-close-panel').addEventListener('click', toggleSidePanel);
}

function toggleSidePanel() {
    const panel = document.getElementById('locations-side-panel');
    panel.classList.toggle('open');
}

function toggleSpoofing() {
    isSpoofing = !isSpoofing;

    chrome.runtime.sendMessage({
        type: 'TOGGLE_SPOOFING',
        payload: { active: isSpoofing }
    }, (response) => {
        updateUIState();
    });
}

function toggleIpSync(forceState) {
    if (typeof forceState === 'boolean') {
        isIpSyncing = forceState;
    }

    chrome.runtime.sendMessage({
        type: 'TOGGLE_IP_SYNC',
        payload: { active: isIpSyncing }
    }, (response) => {
        if (response.status === 'Synced' && response.newCoords) {
            selectedCoords = response.newCoords;
            if (map) {
                map.setView([selectedCoords.lat, selectedCoords.long], 13);
                if (marker) {
                    marker.setLatLng([selectedCoords.lat, selectedCoords.long]);
                    marker.setIcon(redIcon);
                } else {
                    marker = L.marker([selectedCoords.lat, selectedCoords.long], { icon: redIcon }).addTo(map);
                }
            }
        }
        updateDisplay();
    });
}

function loadState() {
    chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
        if (response) {
            isSpoofing = response.active;
            isIpSyncing = response.ipSync || false;

            if (response.coords && response.coords.lat !== 0) {
                selectedCoords = response.coords;
                // Move map to saved location
                if (map) {
                    map.setView([selectedCoords.lat, selectedCoords.long], 13);
                    if (marker) {
                        marker.setLatLng([selectedCoords.lat, selectedCoords.long]);
                        marker.setIcon(redIcon);
                    } else {
                        marker = L.marker([selectedCoords.lat, selectedCoords.long], { icon: redIcon }).addTo(map);
                    }
                }
            }
            updateDisplay();
            updateUIState();
        }
    });
}

function updateDisplay() {
    document.getElementById('disp-lat').textContent = selectedCoords.lat.toFixed(4);
    document.getElementById('disp-lng').textContent = selectedCoords.long.toFixed(4);

    const ipSyncDisp = document.getElementById('disp-ip-sync');
    if (ipSyncDisp) {
        ipSyncDisp.textContent = isIpSyncing ? 'ON' : 'OFF';
        ipSyncDisp.style.color = isIpSyncing ? '#2ecc71' : '#888';
    }
}

function updateUIState() {
    const btn = document.getElementById('btn-activate');
    const stateDisp = document.getElementById('disp-state');

    if (isSpoofing) {
        btn.textContent = 'Stop Spoofing';
        btn.classList.add('active');
        stateDisp.textContent = 'Active (Debugging)';
        stateDisp.style.color = '#2ecc71';
    } else {
        btn.textContent = 'Start Spoofing';
        btn.classList.remove('active');
        stateDisp.textContent = 'Inactive';
        stateDisp.style.color = '#64b5f6';
    }
}

// -----------------------------------------------------------------------------
// Saved Locations Logic
// -----------------------------------------------------------------------------

function saveLocation() {
    const nameInput = document.getElementById('input-loc-name');
    const name = nameInput.value.trim();

    if (!name) {
        alert('Please enter a name for this location.');
        return;
    }

    const newLoc = {
        id: Date.now().toString(),
        name: name,
        coords: selectedCoords
    };

    chrome.storage.local.get(['savedLocations'], (result) => {
        const locations = result.savedLocations || [];
        locations.push(newLoc);

        chrome.storage.local.set({ savedLocations: locations }, () => {
            nameInput.value = ''; // Clear input
            loadSavedLocations(); // Refresh list
        });
    });
}

function loadSavedLocations() {
    chrome.storage.local.get(['savedLocations'], (result) => {
        const locations = result.savedLocations || [];
        // NOTE: The saved-list ID is the same, now inside the sidebar
        const container = document.getElementById('saved-list');
        container.innerHTML = ''; // Clear current list

        if (locations.length === 0) {
            container.innerHTML = '<div class="empty-msg">No saved locations</div>';
            return;
        }

        locations.forEach(loc => {
            const el = document.createElement('div');
            el.className = 'saved-item';

            // Name (Clickable to load)
            const nameSpan = document.createElement('span');
            nameSpan.className = 'saved-name';
            nameSpan.textContent = loc.name;
            nameSpan.title = `Load ${loc.name} (${loc.coords.lat.toFixed(2)}, ${loc.coords.long.toFixed(2)})`;
            nameSpan.addEventListener('click', () => loadLocation(loc.coords));

            // Delete Button
            const delBtn = document.createElement('button');
            delBtn.className = 'btn-delete-loc';
            delBtn.innerHTML = '&times;';
            delBtn.title = 'Delete';
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent clicking row
                deleteLocation(loc.id);
            });

            el.appendChild(nameSpan);
            el.appendChild(delBtn);
            container.appendChild(el);
        });
    });
}

function deleteLocation(id) {
    chrome.storage.local.get(['savedLocations'], (result) => {
        let locations = result.savedLocations || [];
        locations = locations.filter(loc => loc.id !== id);

        chrome.storage.local.set({ savedLocations: locations }, () => {
            loadSavedLocations();
        });
    });
}

function loadLocation(coords) {
    selectedCoords = coords;

    // Update Map
    if (map) {
        map.setView([selectedCoords.lat, selectedCoords.long], 13);
        if (marker) {
            marker.setLatLng([selectedCoords.lat, selectedCoords.long]);
            marker.setIcon(redIcon);
        } else {
            marker = L.marker([selectedCoords.lat, selectedCoords.long], { icon: redIcon }).addTo(map);
        }
    }

    // Disable IP Sync if active (since we are setting manual)
    if (isIpSyncing) {
        isIpSyncing = false;
        toggleIpSync(false);
    }

    updateDisplay();

    // If spoofing is active, apply immediately
    if (isSpoofing) {
        chrome.runtime.sendMessage({
            type: 'SET_LOCATION',
            payload: selectedCoords
        });
    }
}

// -----------------------------------------------------------------------------
// Address Search Logic
// -----------------------------------------------------------------------------

function searchAddress(query) {
    if (!query || query.trim() === '') return;

    const searchInput = document.getElementById('input-search');
    const resultsContainer = document.getElementById('search-results');

    // UI Loading State
    searchInput.classList.add('loading');
    searchInput.disabled = true;
    resultsContainer.innerHTML = ''; // Clear previous
    resultsContainer.classList.remove('visible');

    // Use OpenStreetMap Nominatim API
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`)
        .then(response => response.json())
        .then(data => {
            if (data && data.length > 0) {
                // Populate Dropdown
                data.forEach(result => {
                    const item = document.createElement('div');
                    item.className = 'search-result-item';
                    item.textContent = result.display_name; // Full address

                    item.addEventListener('click', () => {
                        // On Selection
                        const lat = parseFloat(result.lat);
                        const lon = parseFloat(result.lon);

                        // Auto-fill Saved Name (Short)
                        const nameInput = document.getElementById('input-loc-name');
                        if (nameInput) {
                            nameInput.value = result.display_name.split(',')[0];
                        }

                        // Load Location
                        loadLocation({ lat: lat, long: lon });

                        // Cleanup
                        resultsContainer.classList.remove('visible');
                        searchInput.value = '';
                    });

                    resultsContainer.appendChild(item);
                });

                resultsContainer.classList.add('visible');
            } else {
                alert('Location not found.');
            }
        })
        .catch(err => {
            console.error('Search Error:', err);
            alert('Error searching for address.');
        })
        .finally(() => {
            // Restore Input
            searchInput.classList.remove('loading');
            searchInput.disabled = false;
            searchInput.focus();
        });
}

// Close Dropdown when clicking outside
document.addEventListener('click', (e) => {
    const resultsContainer = document.getElementById('search-results');
    const searchInput = document.getElementById('input-search');

    if (resultsContainer && resultsContainer.classList.contains('visible')) {
        if (!resultsContainer.contains(e.target) && e.target !== searchInput) {
            resultsContainer.classList.remove('visible');
        }
    }
});
