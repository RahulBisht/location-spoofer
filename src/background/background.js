// StealthGeo Background Service Worker

let spoofingActive = false;
let ipSyncActive = false;
let currentCoords = { lat: 37.7749, long: -122.4194 }; // Default to SF (not 0,0)
const pendingAttachments = new Set();

// Ensure we don't try to debug these
const RESTRICTED_PREFIXES = [
    'chrome://',
    'chrome-extension://',
    'edge://',
    'about:',
    'view-source:',
    'devtools://'
];

function isValidTarget(tab) {
    if (!tab || !tab.url) return false;
    return !RESTRICTED_PREFIXES.some(prefix => tab.url.startsWith(prefix));
}

// -----------------------------------------------------------------------------
// Message Handling
// -----------------------------------------------------------------------------
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'SET_LOCATION') {
        currentCoords = request.payload;
        chrome.storage.local.set({ coords: currentCoords });
        console.log('StealthGeo: New coordinates:', currentCoords);
        if (spoofingActive) applySpoofingToExpectedTabs();
        sendResponse({ status: 'Updated' });

    } else if (request.type === 'TOGGLE_SPOOFING') {
        spoofingActive = request.payload.active;
        chrome.storage.local.set({ active: spoofingActive });

        if (spoofingActive) {
            console.log('StealthGeo: Activated');
            applySpoofingToExpectedTabs();
        } else {
            console.log('StealthGeo: Deactivated');
            detachFromAllTabs();
        }
        sendResponse({ status: spoofingActive ? 'Active' : 'Inactive' });

    } else if (request.type === 'TOGGLE_IP_SYNC') {
        ipSyncActive = request.payload.active;
        chrome.storage.local.set({ ipSync: ipSyncActive });

        if (ipSyncActive) {
            fetchIpLocation().then(coords => {
                if (coords) {
                    currentCoords = coords;
                    chrome.storage.local.set({ coords: currentCoords });
                    if (spoofingActive) applySpoofingToExpectedTabs();
                    sendResponse({ status: 'Synced', newCoords: coords });
                } else {
                    sendResponse({ status: 'Failed' });
                }
            });
            return true;
        } else {
            sendResponse({ status: 'Stopped Sync' });
        }
    } else if (request.type === 'GET_STATUS') {
        chrome.storage.local.get(['active', 'coords', 'ipSync'], (result) => {
            sendResponse({
                active: result.active || false,
                coords: result.coords || null,
                ipSync: result.ipSync || false
            });
        });
        return true;
    }
});

// -----------------------------------------------------------------------------
// Initialization
// -----------------------------------------------------------------------------
function initializeState() {
    chrome.storage.local.get(['active', 'coords', 'ipSync'], (result) => {
        if (result.active !== undefined) spoofingActive = result.active;
        if (result.coords) currentCoords = result.coords;
        if (result.ipSync !== undefined) ipSyncActive = result.ipSync;

        console.log('StealthGeo: State restored:', { spoofingActive, currentCoords, ipSyncActive });

        // If active, re-apply to ensure consistent state
        if (spoofingActive) {
            applySpoofingToExpectedTabs();
        }
    });
}

// Restore state immediately on load
initializeState();

// -----------------------------------------------------------------------------
// Lifecycle Listeners
// -----------------------------------------------------------------------------

// 1. Tab Activated: Immediate attach/spoof
chrome.tabs.onActivated.addListener((activeInfo) => {
    if (spoofingActive) {
        chrome.tabs.get(activeInfo.tabId, (tab) => {
            if (isValidTarget(tab)) attachAndSpoof(tab.id);
        });
    }
});

// 2. Tab Updated: Retry if status is loading or complete
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (spoofingActive && isValidTarget(tab)) {
        // We attach early (loading) to catch geolocation requests during page load
        if (changeInfo.status === 'loading' || changeInfo.status === 'complete') {
            attachAndSpoof(tabId);
        }
    }
});

function applySpoofingToExpectedTabs() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        tabs.forEach(tab => {
            if (isValidTarget(tab)) attachAndSpoof(tab.id);
        });
    });
}

// -----------------------------------------------------------------------------
// Debugger & Spoofing Logic
// -----------------------------------------------------------------------------

function attachAndSpoof(tabId) {
    if (pendingAttachments.has(tabId)) return;

    pendingAttachments.add(tabId);
    const target = { tabId: tabId };

    // Attempt attach
    console.log(`StealthGeo: Attempting to attach to ${tabId}`);
    chrome.debugger.attach(target, "1.3", () => {
        if (chrome.runtime.lastError) {
            if (chrome.runtime.lastError.message.includes("Already attached")) {
                console.log(`StealthGeo: Tab ${tabId} already attached. Enforcing override.`);
                setGeolocation(target);
            } else {
                console.warn(`StealthGeo: Attach failed for ${tabId}: ${chrome.runtime.lastError.message}`);
                pendingAttachments.delete(tabId);
            }
        } else {
            console.log(`StealthGeo: Successfully attached to ${tabId}. Granting permissions...`);

            // 1. Grant Permission
            chrome.debugger.sendCommand(target, "Browser.grantPermissions", {
                permissions: ["geolocation"]
            }, () => {
                if (chrome.runtime.lastError) {
                    console.warn(`StealthGeo: Permission grant warning for ${tabId}: ${chrome.runtime.lastError.message}`);
                } else {
                    console.log(`StealthGeo: Permissions granted for ${tabId}`);
                }

                // 2. Enable Page
                console.log(`StealthGeo: Enabling Page domain for ${tabId}...`);
                chrome.debugger.sendCommand(target, "Page.enable", {}, () => {
                    console.log(`StealthGeo: Page enabled for ${tabId}. Setting geolocation...`);
                    setGeolocation(target);
                    pendingAttachments.delete(tabId);
                });
            });
        }
    });
}

function setGeolocation(target) {
    if (!currentCoords) {
        console.warn('StealthGeo: No coordinates available to set.');
        return;
    }
    const lat = parseFloat(currentCoords.lat);
    const lng = parseFloat(currentCoords.long);

    if (isNaN(lat) || isNaN(lng)) {
        console.error('StealthGeo: Invalid coordinates:', currentCoords);
        return;
    }

    // Prevent "Null Island" (0,0) spoofing if uninitialized, unless explicitly intentional?
    // Usually 0,0 is a bug in initialization.
    if (Math.abs(lat) < 0.0001 && Math.abs(lng) < 0.0001) {
        console.warn('StealthGeo: Skipping spoof of 0,0 (Null Island). Defaulting to SF.');
        // Fallback or return? Let's return to avoid confusion.
        return;
    }

    const params = {
        latitude: lat,
        longitude: lng,
        accuracy: 1
    };

    console.log(`StealthGeo: Sending Emulation.setGeolocationOverride for ${target.tabId} with`, params);

    // Direct set without clear first
    chrome.debugger.sendCommand(target, "Emulation.setGeolocationOverride", params, () => {
        if (chrome.runtime.lastError) {
            console.error(`StealthGeo: Override FAILED for ${target.tabId}: ${chrome.runtime.lastError.message}`);
        } else {
            console.log(`StealthGeo: Override SUCCESS for ${target.tabId}`);
        }
    });
}

function detachFromAllTabs() {
    chrome.debugger.getTargets((targets) => {
        targets.forEach(target => {
            if (target.attached) {
                const debugTarget = { targetId: target.id };
                // Explicitly clear override before detaching to prevent "stuck" location
                chrome.debugger.sendCommand(debugTarget, "Emulation.clearGeolocationOverride", {}, () => {
                    chrome.debugger.detach(debugTarget, () => {
                        if (chrome.runtime.lastError) {
                            // Ignore errors on detach
                        }
                    });
                });
            }
        });
    });
}

// -----------------------------------------------------------------------------
// Utilities
// -----------------------------------------------------------------------------

function fetchIpLocation() {
    // Primary: ipwho.is (No key, HTTPS, 10k requests/month free)
    return fetch('https://ipwho.is/')
        .then(response => response.json())
        .then(data => {
            if (data && data.success && data.latitude && data.longitude) {
                console.log('StealthGeo: IP location fetched from ipwho.is');
                return { lat: data.latitude, long: data.longitude };
            }
            throw new Error(data.message || 'Invalid response');
        })
        .catch(error => {
            console.warn('StealthGeo: Primary IP fetch failed, trying fallback.', error);

            // Fallback: freeipapi.com (No key, HTTPS)
            return fetch('https://freeipapi.com/api/json')
                .then(res => res.json())
                .then(data => {
                    // freeipapi returns latitude/longitude
                    if (data && data.latitude && data.longitude) {
                        console.log('StealthGeo: IP location fetched from freeipapi.com');
                        return { lat: data.latitude, long: data.longitude };
                    }
                    return null;
                })
                .catch(err => {
                    console.error('StealthGeo: All IP fetch providers failed.', err);
                    return null;
                });
        });
}

chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        const url = chrome.runtime.getURL('src/dashboard/dashboard.html');
        chrome.tabs.create({ url: url });
    }
});
