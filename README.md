# StealthGeo - Advanced Location Spoofer

Bypass geo-restrictions and test location-based apps with precision. StealthGeo allows you to spoof your GPS location, timezone, and locale directly from your browser using the Chrome Debugging Protocol for maximum stealth.

## Features

*   **📍 Precision Spoofing**: Set any GPS coordinate accurately.
*   **🌍 Smart IP Sync**: Automatically align your GPS location with your public IP address to evade fraud detection.
*   **🔍 Address Search**: Search for any address, store, or landmark and teleport instantly.
*   **📂 Saved Locations**: Save and manage your frequently used locations in a convenient sidebar.
*   **🛡️ Stealth Mode**: Uses the Chrome Debugger API to override geolocation at a system level within the browser context, making it harder to detect than standard HTML5 overrides.
*   **🌗 Dark Mode UI**: A clean, developer-friendly interface.

## Installation

1.  Clone this repository or download the source code.
2.  Open Google Chrome and navigate to `chrome://extensions/`.
3.  Enable **Developer mode** in the top right corner.
4.  Click **Load unpacked**.
5.  Select the directory where you cloned/downloaded this project.
6.  The StealthGeo icon should appear in your toolbar.

## Usage

1.  **Click the Extension Icon** to open the dashboard.
2.  **Set Location**:
    *   **Click on the Map**: A popup will ask to confirm teleportation to that spot.
    *   **Search**: Use the search bar to find a specific address.
    *   **IP Sync**: Click "Sync with IP" to match your GPS to your internet connection.
    *   **Saved Locations**: Open the folder icon to access your saved spots.
3.  **Start Spoofing**: Click the "Start Spoofing" button. The status will change to Active.
4.  **Verify**: Visit a site like [mylocation.org](https://mylocation.org) to verify your new virtual location.

## Permissions

*   **Debugger**: Required to reliably override geolocation and timezone settings.
*   **Geolocation**: Required to read the overridden location.
*   **Storage**: Used to save your preferences and saved locations.
*   **Host Permissions**: Required to inject the spoofing logic into all websites.

## Development

This project is built with:
*   HTML/CSS/JavaScript (Vanilla)
*   Leaflet.js (Map interface)
*   OpenStreetMap (Map tiles)
*   Nominatim API (Address search)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
