# System Architecture: AI Video Detector

This document outlines the high-level architecture and data flow of the Context-Aware AI Video Detector.

## High-Level Architecture

The system consists of three main parts:
1.  **Chrome Extension (Frontend)**: Handles user interaction, video capture, and checks.
2.  **Python API Server (Backend)**: Handles logic, caching, state management, and AI processing.
3.  **Google Gemini API (External)**: Provides the multimodal AI intelligence.

 ![AI Video Detector Architecture](Flow.png)

 
## Component Breakdown

### 1. Chrome Extension (Frontend)
*   **Manifest V3**: Uses modern service worker architecture.
*   **Content Script (`content.js`)**:
    *   **Observer**: Monitors video state every 3 seconds (configurable).
    *   **Main Video Filter**: Strictly targets the main player (`.html5-main-video`) and ignores thumbnails/previews.
    *   **Capture**: Uses HTML5 Canvas to snapshot video frames.
    *   **Scraper**: Extracts text from `.ytp-caption-segment` for context.
    *   **Ad Intelligence**: Detects YouTube ad classes to pause analysis, saving tokens.
    *   **UI**: Injects a DOM overlay when content is detected.
*   **Background Script (`background.js`)**:
    *   **Bridge**: Facilitates communication between the secure content script and the external local server.
    *   **State**: Manages tab-specific storage (`prompt_{tabId}`) to allow different detection goals in different tabs.

### 2. Python Backend (Server)
*   **FastAPI**: Async web server for high performance.
*   **Context Awareness (Session Manager)**:
    *   Solves the "single frame problem" (visuals without context are ambiguous).
    *   **NAT Handling**: Uses Client IP + Unique Session ID to separate users behind the same router.
    *   **Deduping**: Intelligently merges overlapping subtitle segments to form a coherent transcript history.
*   **Smart Caching**:
    *   Reduces API costs and latency.
    *   Key = `MD5(Image_Data + Prompt + Full_Caption_History)`.
    *   Ensures that if the video pauses or loops, we don't re-bill for the same analysis.

### 3. AI Layer
*   **Model**: Google Gemini 2.0 Flash.
*   **Prompt Engineering**:
    *   **Action/Noise Cleaning**: Strips non-visual commands ("redirect", "block") to focus on the subject.
    *   **Semantic Expansion**: Expands concepts (e.g., "K-pop" -> look for style/groups) and supports multi-subject detection.
*   **Input**: Multimodal (Video Frame Image + Text Transcript).
*   **Output**: Structured JSON (`DETECTED`, `confidence`, `summary`, `reasoning`).

## Data Flow Details

1.  **User Configuration**: User sets a prompt (e.g., "violence") for the current tab.
2.  **Sampling**: Every few seconds, the extension checks if the video is playing and not an ad.
3.  **Payload Creation**: It captures a 0.8 quality JPEG and scrapes current subtitles.
4.  **Transmission**: Data is sent to `localhost:8000`.
5.  **Context Construction**: Server looks up the session, appends new subtitles to the history, and retrieves the full conversation context.
6.  **Intelligence**: Server asks Gemini: *"Given this image and this conversation history, is 'violence' present?"*
7.  **Feedback**: Result is returned. If positive, the user sees a red overlay on the video.
