// Popup script - Simplified (no API key management)
document.addEventListener('DOMContentLoaded', () => {
    const checkNowBtn = document.getElementById('checkNow');
    const statusDiv = document.getElementById('status');
    const promptInput = document.getElementById('customPrompt');
    const saveBtn = document.getElementById('savePrompt');
    const saveStatus = document.getElementById('saveStatus');
    const clearBlockedBtn = document.getElementById('clearBlocked');
    const clearStatus = document.getElementById('clearStatus');

    // Get current tab ID first
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0]) return;

        const currentTabId = tabs[0].id;
        const storageKey = `prompt_${currentTabId}`;

        // Load saved settings for this specific tab
        chrome.storage.local.get([storageKey, 'blockedChannels'], (result) => {
            if (result[storageKey]) {
                promptInput.value = result[storageKey];
            }
            if (result.blockedChannels && result.blockedChannels.length > 0) {
                clearBlockedBtn.textContent = `Clear Blocked Channels (${result.blockedChannels.length})`;
            }
        });

        // Save settings for this specific tab
        saveBtn.addEventListener('click', () => {
            const prompt = promptInput.value.trim();
            const data = {};
            data[storageKey] = prompt;

            chrome.storage.local.set(data, () => {
                saveStatus.style.display = 'block';
                setTimeout(() => {
                    saveStatus.style.display = 'none';
                }, 2000);
            });
        });
    });

    // Clear blocked channels
    clearBlockedBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to unblock all channels?')) {
            chrome.storage.local.set({ blockedChannels: [] }, () => {
                clearBlockedBtn.textContent = 'Clear Blocked Channels';
                clearStatus.style.display = 'block';
                setTimeout(() => {
                    clearStatus.style.display = 'none';
                }, 2000);
            });
        }
    });

    // Show initial status
    showStatus('✓ Extension is monitoring videos automatically', 'success');

    // Check videos now button
    checkNowBtn.addEventListener('click', async () => {
        showStatus('🔍 Checking for videos...', 'info');

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (!tab) {
                showStatus('Error: No active tab found', 'error');
                return;
            }

            chrome.tabs.sendMessage(tab.id, { action: 'checkVideos' }, (response) => {
                if (chrome.runtime.lastError) {
                    showStatus('Error: Could not connect to page. Try refreshing the page.', 'error');
                    return;
                }

                if (response.status === 'analyzing') {
                    showStatus(`✓ Analyzing ${response.count} video(s)...`, 'info');
                } else if (response.status === 'no_videos') {
                    showStatus('ℹ No playing videos found on this page', 'info');
                }
            });
        } catch (error) {
            showStatus('Error: ' + error.message, 'error');
        }
    });

    function showStatus(message, type) {
        statusDiv.textContent = message;
        statusDiv.className = 'status ' + type;

        // Auto-hide success/info messages after 3 seconds
        if (type === 'success' || type === 'info') {
            setTimeout(() => {
                statusDiv.className = 'status';
            }, 3000);
        }
    }
});