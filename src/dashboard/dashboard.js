// Dashboard UI Logic

let map;
let marker;
let selectedCoords = { lat: 37.7749, long: -122.4194 }; // Default SF
let isSpoofing = false;
let isIpSyncing = false;

// Custom Red Icon - Google Maps Style
// Custom Red Icon - Google Maps Style
const redIcon = new L.Icon({
    iconUrl: '../../icons/marker-icon-2x-red.png', // Local asset
    shadowUrl: '../../icons/marker-shadow.png',     // Local asset
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

document.addEventListener('DOMContentLoaded', () => {
    initMap();
    initControls();
    loadState();
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
}

function onMapClick(e) {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;

    selectedCoords = { lat, long: lng };

    // If user clicks map, disable IP Sync mode
    if (isIpSyncing) {
        isIpSyncing = false;
        toggleIpSync(false); // Update background
    }

    updateDisplay();

    if (marker) {
        marker.setLatLng(e.latlng);
        marker.setIcon(redIcon);
    } else {
        marker = L.marker(e.latlng, { icon: redIcon }).addTo(map);
    }

    // Notify background immediately if we want instant updates while active
    chrome.runtime.sendMessage({
        type: 'SET_LOCATION',
        payload: selectedCoords
    });
}

function initControls() {
    const btnActivate = document.getElementById('btn-activate');
    btnActivate.addEventListener('click', toggleSpoofing);

    const btnIpSync = document.getElementById('btn-ip-sync');
    if (btnIpSync) {
        btnIpSync.addEventListener('click', () => toggleIpSync(!isIpSyncing));
    }
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
