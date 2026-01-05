# AI Video Detector (Context-Aware)

A powerful Chrome Extension that uses Multimodal AI (Gemini 2.0 Flash) to analyze YouTube videos in real-time. It can visually detect specific objects/actions AND understand the conversation context using subtitles.


## ✨ Key Features & Technical Details

### 1. Tab-Specific Dynamic Prompting
*   **What**: You can open Tab A and search for "Snakes", and Tab B and search for "Cars". They run completely independently.
*   **Technical**: We switched from global `chrome.storage` to **Tab-Specific Storage Keys** (`prompt_{tabId}`).
*   **Why**: To prevent state pollution between parallel detection tasks.

### 2. Context Awareness (Stateful Memory)
*   **What**: The AI knows what was discussed *minutes ago*, not just what is on screen right now.
*   **Technical**:
    *   **Scraping**: We extract text from `.ytp-caption-segment`.
    *   **Auto-CC**: We automatically click the "CC" button if it's off.
    *   **Session ID**: We generate a unique `sess_{random}` ID for every tab. This fixes **NAT Collisions** (e.g., users in the same office sharing the same IP won't mix their histories).
    *   **Smart Accumulation**: The backend intelligently merges overlapping subtitles (Deduping) to create a clean, running transcript.
*   **Why**: Visuals alone can be misleading. "Killing a process" vs "Killing a person" looks different in context.

### 3. Smart Caching
*   **What**: Reduces API costs by 90% for repeated frames.
*   **Technical**:
    *   Key = `MD5(Image_Data + Prompt + Full_Caption_History)`
    *   If the exact same visual and conversation state repeats, we return the cached result instantly.
*   **Why**: Video frames often repeat (static scenes).

### 4. Ad Intelligence
*   **What**: The system pauses analysis when YouTube ads play.
*   **Technical**: Detects `.ad-showing`, `.ad-interrupting`, or `.ytp-ad-player-overlay` classes.
*   **Why**: Analyzing ads wastes tokens/money and produces false positives irrelevant to the actual video content.

## 🛠 Technology Stack

### Frontend (Chrome Extension)
*   **Manifest V3**: Modern, secure extension architecture.
*   **Canvas API**: Used to capture efficient JPEG snapshots of the video element.
*   **DOM Mutation/Query**: Used for robust caption scraping and ad detection.

### Backend (Python Server)
*   **FastAPI**: For high-performance async HTTP handling.
*   **Uvicorn**: ASGI server implementation.
*   **Pydantic**: Data validation for robust API contracts (`AnalyzeRequest` / `AnalyzeResponse`).
*   **Google Gemini 2.0 Flash**: Selected for its **Sub-second latency** and **Multimodal** capabilities (Images + Text).

## 📂 Project Structure

*   **/yt-email-extension**: The Chrome Extension source code.
    *   `content.js`: The "eyes" (Capture, Overlay, Scraper).
    *   `background.js`: The "bridge" (Tab management, API calls).
    *   `popup.js`: The "controls" (User settings).
*   **/Gemini-Server**: The Brain.
    *   `main.py`: The single-file powerhouse server.

## 🚀 Setup & Usage

### 1. Backend Setup
```bash
cd Gemini-Server
# Install dependencies
pip install fastapi uvicorn httpx pydantic python-dotenv

# Set your API Key in .env (or environment)
export GEMINI_API_KEY="your_key_here"

# Run server
python3 main.py
```

### 2. Extension Setup
1.  Open Chrome and tag `chrome://extensions`.
2.  Enable **Developer Mode** (top right).
3.  Click **Load Unpacked**.
4.  Select the `yt-email-extension` folder.

### 3. Operations
1.  Go to YouTube.
2.  Click the Extension Icon.
3.  Type what you want to detect (e.g., "violence", "cats", "coding tutorial").
4.  Click **Save**.
5.  Watch the video.
    *   **Red Overlay**: Target detected.
    *   **Summary**: Shows context of the discussion.
