// Background service worker - Connects to Python API server

// IMPORTANT: Change this to your deployed API URL
const API_ENDPOINT = 'http://localhost:8000/api/analyze';
// Example after deployment: 'https://your-app.railway.app/api/analyze'

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'analyzeFrame') {
        console.log('📦 BG: Received analyzeFrame request from tab:', sender.tab ? sender.tab.id : 'unknown');

        // Pass tab ID to analysis function
        const tabId = sender.tab ? sender.tab.id : null;

        analyzeFrameWithAPI(request.frameData, request.videoSrc, request.videoTitle, request.captions, tabId, request.sessionId)
            .then(result => {
                console.log('📦 BG: Analysis success, sending response');
                sendResponse(result);
            })
            .catch(error => {
                console.error('📦 BG: Analysis error:', error);
                sendResponse({ error: error.message });
            });
        console.log('📦 BG: Returning true for async response');
        return true; // Keep message channel open for async response
    }
});

// Clean up storage when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
    const storageKey = `prompt_${tabId}`;
    chrome.storage.local.remove(storageKey);
    console.log(`🧹 Cleaned up storage for closed tab ${tabId}`);
});

// Analyze frame using Python API server
async function analyzeFrameWithAPI(frameData, videoSrc = '', videoTitle = '', captions = '', tabId = null, sessionId = '') {
    // Remove data URL prefix to get base64 data
    const base64Data = frameData.split(',')[1];

    // Get saved prompt from storage (Tab-specific)
    let customPrompt = "";
    if (tabId) {
        const storageKey = `prompt_${tabId}`;
        const storageData = await chrome.storage.local.get([storageKey]);
        customPrompt = storageData[storageKey] || "";
    } else {
        // Fallback or legacy global
        const storageData = await chrome.storage.local.get(['customPrompt']);
        customPrompt = storageData.customPrompt || "";
    }

    try {
        console.log(`🌐 Calling API endpoint: ${API_ENDPOINT} with prompt: ${customPrompt ? customPrompt : 'DEFAULT'}, captions length: ${captions.length}, session: ${sessionId}`);
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                image: base64Data,
                video_url: videoSrc,
                video_title: videoTitle,
                prompt: customPrompt,
                captions: captions,
                session_id: sessionId
            })
        });

        if (!response.ok) {
            if (response.status === 429) {
                throw new Error('Rate limit exceeded. Please try again later.');
            }
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`API error: ${errorData.detail || response.statusText}`);
        }

        const data = await response.json();
        console.log('🤖 API Response:', data);

        return {
            isDetected: data.DETECTED, // Mapping proper backend response
            confidence: data.confidence,
            reasoning: data.reasoning,
            summary: data.summary || "",
            cached: data.cached || false
        };

    } catch (error) {
        console.error('API error:', error);

        // Provide user-friendly error messages
        if (error.message.includes('Failed to fetch')) {
            throw new Error('Cannot connect to API server. Make sure the server is running at: ' + API_ENDPOINT);
        }

        throw error;
    }
}

// Handle extension installation
chrome.runtime.onInstalled.addListener(() => {
    console.log('AI Video Detector installed (Python API version)');
    console.log('API Endpoint:', API_ENDPOINT);
});