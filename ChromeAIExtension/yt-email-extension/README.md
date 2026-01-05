# AI Video Detector - Chrome Extension

Automatically detects specific content in videos using AI vision. Works with any video on any website!

## Features

- 🎥 **Automatic Detection** - Monitors videos every 3 seconds
- 🤖 **AI-Powered** - Uses Gemini AI for accurate detection
- 🔔 **Visual Notifications** - Shows overlay when target content is detected
- ⚡ **Smart Caching** - Caches results to reduce API calls
- 💰 **Free to Use** - No API key required from users
- 🚀 **Works Everywhere** - YouTube, Twitch, or any video site

## Installation

### Prerequisites

You need the Python API server running. See the API setup guide for details.

### Install Extension

1. Download/clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top-right)
4. Click **Load unpacked**
5. Select the extension folder

### Configure API Endpoint

Before using, update `background.js` with your API server URL:
```javascript
// Change this line:
const API_ENDPOINT = 'http://localhost:8000/api/analyze';

// To your deployed server:
const API_ENDPOINT = 'https://your-app.railway.app/api/analyze';
```

## Usage

### Automatic Mode

The extension automatically monitors all videos on web pages:

1. Visit any website with videos (YouTube, Twitch, etc.)
2. Play a video
3. If target content is detected, a green notification appears
4. Notification shows confidence level and auto-dismisses after 5 seconds

### Manual Check

1. Click the extension icon in Chrome toolbar
2. Click "Check Current Videos" button
3. Extension analyzes any playing videos immediately

## File Structure
```
ai-video-detector/
├── manifest.json          # Extension configuration
├── content.js            # Video monitoring & frame capture
├── background.js         # API communication
├── popup.html           # Extension popup UI
├── popup.js             # Popup functionality
└── README.md            # This file
```

## How It Works

1. **Content Script** monitors all `<video>` elements on web pages
2. **Frame Capture** captures video frames as JPEG images every 3 seconds
3. **Background Worker** sends frames to Python API server
4. **API Server** analyzes frames using Gemini AI
5. **Notification** shows overlay if target is detected

## Technical Details

### Detection Criteria

The AI looks for specific visual patterns defined in your backend prompt.

### Performance

- Checks every 3 seconds while video plays
- Caching reduces duplicate API calls
- Low CPU usage (~1-2%)
- Minimal memory footprint

## Troubleshooting

### Extension Not Working

- **Refresh the page** after installing
- **Check browser console** (F12) for errors
- **Verify API server** is running and accessible

### No Videos Detected

- Make sure videos are **actually playing** (not paused)
- Some embedded videos may not be accessible
- Try the **manual check** button

### API Connection Errors

- Verify `API_ENDPOINT` in `background.js` is correct
- Check API server is running: visit `/health` endpoint
- Look for CORS errors in browser console

### Rate Limit Exceeded

- API has rate limits (10/min, 100/hour per IP)
- Wait a few minutes before trying again
- Check your usage at `/api/stats` endpoint

## Privacy & Security

- ✓ Video frames sent only to your API server
- ✓ No data stored permanently
- ✓ No tracking or analytics
- ✓ Open source code
- ✓ API key hidden on server (not in extension)

## Development

### Debug Mode

Open browser DevTools (F12) to see console logs:
```javascript
// In content.js
console.log('📹 Capturing frame from video...');
console.log('🤖 Gemini response:', response);
```

### Modify Check Interval

In `content.js`, change:
```javascript
}, 3000); // Check every 3 seconds
```

### Customize Notification

Edit `showDetectionOverlay()` function in `content.js`

## API Server Required

This extension requires the Python API server to be running. The server:
- Handles Gemini API authentication
- Implements rate limiting
- Provides caching
- Protects your API key

See the API setup guide for deployment instructions.

## License

Open source - modify and use as needed.

## Support

For issues:
- Check browser console for errors
- Verify API server is running
- Test API endpoint manually
- Review server logs

## Credits

Built with:
- Chrome Extensions API
- FastAPI (Python backend)
- Google Gemini AI
- JavaScript/HTML/CSS

---

**Enjoy automatic AI video detection! 🤖**
```

---

## 📦 **Complete Folder Structure:**
```
ai-video-detector/
├── manifest.json          # Extension configuration
├── content.js            # Video monitoring (108 lines)
├── background.js         # API communication (64 lines)
├── popup.html           # Extension UI (85 lines)
├── popup.js             # Popup logic (38 lines)
└── README.md            # Documentation
```