// Content script that monitors video players - Auto-reconnect version
let videoCheckInterval = null;
let lastCheckTime = {};
let extensionDisconnected = false;
const RECHECK_INTERVAL = 15000;  // Re-check every 15 seconds

// Function to capture video frame
function captureVideoFrame(video) {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.8);
}

// Function to check if video is playing
function isVideoPlaying(video) {
    return !video.paused && !video.ended && video.readyState > 2;
}

// Find all video elements on the page
function findVideoElements() {
    // Priority 1: Main YouTube player class
    const mainVideo = document.querySelector('.html5-main-video');
    if (mainVideo) {
        return [mainVideo];
    }

    // Fallback: Filter all videos by size (ignore small previews)
    const videos = Array.from(document.querySelectorAll('video'));
    return videos.filter(v => {
        const rect = v.getBoundingClientRect();
        // Ignore videos smaller than 300x200 (likely thumbnails/previews)
        return rect.width > 300 && rect.height > 200;
    });
}

// Check if extension is connected
function checkExtensionConnection() {
    try {
        // Try to access chrome.runtime
        if (chrome.runtime && chrome.runtime.id) {
            return true;
        }
    } catch (e) {
        return false;
    }
    return false;
}

// Generate a unique session ID for this tab instance
function generateSessionId() {
    return 'sess_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
}

const SESSION_ID = generateSessionId();
console.log('🆔 AI Detector: Initialized with Session ID:', SESSION_ID);

// Check if an ad is playing
function isAdPlaying() {
    return !!(document.querySelector('.ad-showing') ||
        document.querySelector('.ad-interrupting') ||
        document.querySelector('.ytp-ad-player-overlay'));
}

// Get current captions text (with fallbacks)
function getCaptions() {
    const segments = document.querySelectorAll('.ytp-caption-segment');
    if (segments && segments.length > 0) {
        return Array.from(segments).map(s => s.textContent).join(' ').trim();
    }

    // Fallback: Try to find transcript text if available (less reliable but fallback)
    return '';
}

// Ensure captions are enabled
function ensureCaptionsEnabled() {
    const ccButton = document.querySelector('.ytp-subtitles-button');
    if (ccButton && ccButton.getAttribute('aria-pressed') === 'false') {
        console.log('🔄 AI Detector: Auto-enabling captions for context...');
        ccButton.click();
        return true; // We toggled it
    }
    return false;
}

// Send frame to background script for analysis
async function analyzeVideo(video) {
    if (!isVideoPlaying(video)) return;

    // Skip ads to save API costs and avoid false positives
    if (isAdPlaying()) {
        console.log('🚫 AI Detector: Skipping analysis (Ad playing)');
        return;
    }

    console.log('Analyse Video');

    // Try to enable captions if they are off
    ensureCaptionsEnabled();

    // Check if extension is still connected
    if (!checkExtensionConnection()) {
        if (!extensionDisconnected) {
            console.warn('⚠️ AI Detector: Extension disconnected. Waiting for reconnection...');
            extensionDisconnected = true;
            showReloadNotification();
        }
        return;
    }

    // If we were disconnected but now connected, clear the flag
    if (extensionDisconnected) {
        console.log('✅ AI Detector: Extension reconnected!');
        extensionDisconnected = false;
        hideReloadNotification();
    }

    try {
        const frameData = captureVideoFrame(video);
        const captionText = getCaptions();
        console.log('📝 Captions captured:', captionText);

        // Send to background script
        console.log('📤 Sending frame to background for analysis...');
        chrome.runtime.sendMessage({
            action: 'analyzeFrame',
            frameData: frameData,
            videoSrc: video.src || video.currentSrc,
            videoTitle: document.title,
            captions: captionText,
            sessionId: SESSION_ID
        }, (response) => {
            if (chrome.runtime.lastError) {
                // Check if extension context was invalidated
                if (chrome.runtime.lastError.message.includes('Extension context invalidated') ||
                    chrome.runtime.lastError.message.includes('message port closed')) {
                    if (!extensionDisconnected) {
                        console.warn('⚠️ AI Detector: Extension was reloaded. Will retry automatically...');
                        extensionDisconnected = true;
                        showReloadNotification();
                    }
                    return;
                }
                console.error('Chrome runtime error:', chrome.runtime.lastError);
                return;
            }

            console.log('🤖 Full Backend Response:', response);

            if (response && response.isDetected) {
                console.log('RESPONSE DETECTED Let\'s go to Homepage');
                console.log('RESPONSE DETECTED Let\'s go to Homepage');

                // Stop video and redirect as requested
                video.pause();
                showSafetyMessage("Video does not look appropriate. Let's go to Homepage to watch something else.");
                console.log('🛑 unsafe content detected. Redirecting in 5s...');
                console.log('Redirecting to Homepage');

                setTimeout(() => {
                    window.location.replace("https://www.youtube.com");
                }, 5000);
            }
        });
    } catch (error) {
        if (error.message && (error.message.includes('Extension context invalidated') ||
            error.message.includes('message port closed'))) {
            if (!extensionDisconnected) {
                console.warn('⚠️ AI Detector: Extension disconnected. Will retry automatically...');
                extensionDisconnected = true;
                showReloadNotification();
            }
            return;
        }
        console.error('Error analyzing video:', error);
    }
}

// Show overlay when content is detected
function showDetectionOverlay(confidence, cached = false, summary = '') {
    const existing = document.getElementById('ai-detector-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'ai-detector-overlay';
    overlay.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: rgba(220, 0, 0, 0.95);
    color: white;
    padding: 15px 20px;
    border-radius: 8px;
    z-index: 2147483647;
    font-family: Arial, sans-serif;
    font-size: 16px;
    box-shadow: 0 4px 6px rgba(0,0,0,0.3);
    animation: slideIn 0.3s ease-out;
    max-width: 300px;
  `;
    console.log('🤖 Displaying detection overlay:', { confidence, cached, summary });
    overlay.innerHTML = `
    <strong>🤖 Target Detected!</strong><br>
    <small>Confidence: ${confidence}%</small>
    ${summary ? `<br><div style="margin-top:5px; font-size:12px; font-style:italic; border-top:1px solid rgba(255,255,255,0.3); padding-top:5px;">"${summary}"</div>` : ''}
    ${cached ? '<br><small style="opacity: 0.8;">⚡ Cached result</small>' : ''}
  `;

    document.body.appendChild(overlay);

    setTimeout(() => {
        overlay.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => overlay.remove(), 300);
    }, 5000);
}

// Show safety warning message
function showSafetyMessage(message) {
    const existing = document.getElementById('ai-safety-overlay');
    if (existing) return;

    const overlay = document.createElement('div');
    overlay.id = 'ai-safety-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 40px;
        border-radius: 12px;
        z-index: 2147483647;
        font-family: Arial, sans-serif;
        font-size: 24px;
        text-align: center;
        box-shadow: 0 0 20px rgba(255, 0, 0, 0.5);
        border: 2px solid #ff4444;
        max-width: 80%;
    `;

    overlay.innerHTML = `
        <div style="font-size: 48px; margin-bottom: 20px;">🛡️</div>
        <div style="margin-bottom: 20px;">${message}</div>
        <div style="font-size: 16px; opacity: 0.7;">Redirecting to safe zone in 5 seconds...</div>
    `;

    document.body.appendChild(overlay);
}

// Get current channel name
function getChannelName() {
    // Try standard video page selector
    const channelElement = document.querySelector('ytd-video-owner-renderer ytd-channel-name a') ||
        document.querySelector('#owner #channel-name a') ||
        document.querySelector('.ytd-channel-name a');

    return channelElement ? channelElement.textContent.trim() : null;
}

// Block channel and redirect
function blockChannelAndRedirect() {
    const channelName = getChannelName();

    if (channelName) {
        chrome.storage.local.get(['blockedChannels'], (result) => {
            const blocked = result.blockedChannels || [];
            if (!blocked.includes(channelName)) {
                blocked.push(channelName);
                chrome.storage.local.set({ blockedChannels: blocked }, () => {
                    console.log(`🚫 Blocked channel: ${channelName}`);
                    window.location.href = "https://www.youtube.com";
                });
            } else {
                window.location.href = "https://www.youtube.com";
            }
        });
    } else {
        console.warn('⚠️ Could not identify channel name to block.');
        // Optional: Still redirect even if specific channel not found? 
        // User asked to block channel, so maybe just redirect.
        window.location.href = "https://www.youtube.com";
    }
}

// Check if current channel is blocked
function checkBlockedChannel() {
    const channelName = getChannelName();
    if (!channelName) return;

    chrome.storage.local.get(['blockedChannels'], (result) => {
        const blocked = result.blockedChannels || [];
        if (blocked.includes(channelName)) {
            console.log(`🚫 Channel '${channelName}' is blocked. Redirecting...`);
            window.location.href = "https://www.youtube.com";
        }
    });
}

// Show notification when extension needs reload
function showReloadNotification() {
    const existing = document.getElementById('ai-detector-reload-notification');
    if (existing) return;

    const notification = document.createElement('div');
    notification.id = 'ai-detector-reload-notification';
    notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: rgba(255, 152, 0, 0.95);
    color: white;
    padding: 15px 20px;
    border-radius: 8px;
    z-index: 999999;
    font-family: Arial, sans-serif;
    font-size: 14px;
    box-shadow: 0 4px 6px rgba(0,0,0,0.3);
    animation: slideIn 0.3s ease-out;
    max-width: 300px;
    cursor: pointer;
  `;
    notification.innerHTML = `
    <strong>⚠️ Extension Reconnecting...</strong><br>
    <small>Detection paused. Refresh page for best results.</small><br>
    <small style="opacity: 0.8; font-size: 11px;">Click to dismiss</small>
  `;

    notification.onclick = () => notification.remove();
    document.body.appendChild(notification);
}

// Hide reload notification
function hideReloadNotification() {
    const existing = document.getElementById('ai-detector-reload-notification');
    if (existing) existing.remove();
}

// Add CSS animation
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from { transform: translateX(400px); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  @keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(400px); opacity: 0; }
  }
`;
document.head.appendChild(style);

// Start monitoring videos
function startMonitoring() {
    if (videoCheckInterval) clearInterval(videoCheckInterval);

    videoCheckInterval = setInterval(() => {
        const videos = findVideoElements();
        videos.forEach(video => {
            if (isVideoPlaying(video)) {
                const videoId = video.src || video.currentSrc || 'unknown';
                const rect = video.getBoundingClientRect();

                // Double check size in loop
                if (rect.width < 300) return;

                const now = Date.now();
                const lastCheck = lastCheckTime[videoId] || 0;

                if (now - lastCheck > RECHECK_INTERVAL) {
                    const timeSinceLastCheck = ((now - lastCheck) / 1000).toFixed(0);
                    console.log(`🔄 AI Detector: Re-checking video (${timeSinceLastCheck}s since last check) | Size: ${Math.round(rect.width)}x${Math.round(rect.height)}`);

                    lastCheckTime[videoId] = now;
                    analyzeVideo(video);
                }
            }
        });
    }, 3000);
}

// Stop monitoring
function stopMonitoring() {
    if (videoCheckInterval) {
        clearInterval(videoCheckInterval);
        videoCheckInterval = null;
        console.log('🛑 AI Detector: Monitoring stopped');
    }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'checkVideos') {
        const videos = findVideoElements();
        const playingVideos = videos.filter(isVideoPlaying);

        if (playingVideos.length > 0) {
            const videoId = playingVideos[0].src || playingVideos[0].currentSrc || 'unknown';
            lastCheckTime[videoId] = 0;

            analyzeVideo(playingVideos[0]);
            sendResponse({ status: 'analyzing', count: playingVideos.length });
        } else {
            sendResponse({ status: 'no_videos', count: videos.length });
        }
    }
    return true;
});

// Initialize
startMonitoring();
console.log(`🤖 AI Video Detector: Monitoring started (re-checking every ${RECHECK_INTERVAL / 1000}s)`);