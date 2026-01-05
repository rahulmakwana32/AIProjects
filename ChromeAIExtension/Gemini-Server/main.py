from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx
import os
import json
from datetime import datetime, timedelta
from collections import defaultdict
import asyncio
import re
from dotenv import load_dotenv
import os

load_dotenv()

app = FastAPI(title="Snake Game Detector API", version="1.0")

# CORS configuration - allow extension to call API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your extension ID
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Get Gemini API key from environment variable
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent"

# Simple in-memory rate limiting
rate_limit_store = defaultdict(list)
MAX_REQUESTS_PER_MINUTE = int(os.getenv("MAX_REQUESTS_PER_MINUTE", 10))
MAX_REQUESTS_PER_HOUR = int(os.getenv("MAX_REQUESTS_PER_HOUR", 100))

# Cache for analyzed frames (reduces API calls)
cache_store = {}
CACHE_DURATION = 300  # 5 minutes

# Store caption history per user/video
# Key: f"{client_ip}:{video_url}"
# Value: {"last_update": datetime, "text": "accumulated text"}
caption_sessions = {}
SESSION_TTL = 3600  # 1 hour


class AnalyzeRequest(BaseModel):
    image: str  # base64 encoded image data
    video_url: str = ""
    video_title: str = ""
    prompt: str = ""  # Custom prompt from extension
    captions: str = ""  # Captions/subtitles from video
    session_id: str = ""  # Unique session ID from client (fixes NAT collision)


class AnalyzeResponse(BaseModel):
    DETECTED: bool
    confidence: int
    DETECTED: bool
    confidence: int
    reasoning: str
    summary: str = ""  # Context summary
    cached: bool = False


def get_client_ip(request: Request) -> str:
    """Get client IP for rate limiting"""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0]
    return request.client.host


def check_rate_limit(client_ip: str) -> bool:
    """Check if client has exceeded rate limits"""
    now = datetime.now()
    
    # Clean old entries
    rate_limit_store[client_ip] = [
        timestamp for timestamp in rate_limit_store[client_ip]
        if now - timestamp < timedelta(hours=1)
    ]
    
    # Check hourly limit
    if len(rate_limit_store[client_ip]) >= MAX_REQUESTS_PER_HOUR:
        return False
    
    # Check per-minute limit
    recent_requests = [
        timestamp for timestamp in rate_limit_store[client_ip]
        if now - timestamp < timedelta(minutes=1)
    ]
    if len(recent_requests) >= MAX_REQUESTS_PER_MINUTE:
        return False
    
    # Add current request
    rate_limit_store[client_ip].append(now)
    return True


import hashlib

def get_cache_key(image_data: str, prompt: str = "", captions: str = "") -> str:
    """Generate cache key using MD5 hash of image data + prompt + captions"""
    Combined_data = f"{image_data}:{prompt}:{captions}"
    return hashlib.md5(Combined_data.encode('utf-8')).hexdigest()


def get_from_cache(cache_key: str) -> dict | None:
    """Get cached result if still valid"""
    if cache_key in cache_store:
        cached_data, timestamp = cache_store[cache_key]
        age = (datetime.now() - timestamp).total_seconds()
        if age < CACHE_DURATION:
            print(f"[CACHE DETAIL] Hit - Valid entry found (Age: {age:.2f}s, TTL: {CACHE_DURATION}s)")
            return cached_data
        else:
            print(f"[CACHE DETAIL] Miss - Entry expired (Age: {age:.2f}s > {CACHE_DURATION}s)")
            # Remove expired cache
            del cache_store[cache_key]
            return None
    
    print(f"[CACHE DETAIL] Miss - Key not found in store (Total entries: {len(cache_store)})")
    return None


def save_to_cache(cache_key: str, data: dict):
    """Save result to cache"""
    cache_store[cache_key] = (data, datetime.now())


def merge_captions(existing_text: str, new_text: str) -> str:
    """
    Merge new caption text with existing history, handling overlaps.
    Simple approach: Find the longest common suffix of existing and prefix of new.
    """
    if not existing_text:
        return new_text
    
    # Normalize
    existing = existing_text.strip()
    new = new_text.strip()
    
    # If new text is already fully inside the end of existing text, ignore it
    if new in existing[-len(new)-50:]: 
        return existing
        
    # Check for overlap
    # Try to find the largest overlap from the end of existing and start of new
    max_overlap = 0
    overlap_len = min(len(existing), len(new))
    
    # Check from largest possible overlap down to 5 chars
    for i in range(overlap_len, 4, -1):
        if existing.endswith(new[:i]):
            max_overlap = i
            break
            
    if max_overlap > 0:
        return existing + new[max_overlap:]
    else:
        return existing + " " + new


async def call_gemini_api(image_base64: str, custom_prompt: str = "", captions: str = "") -> dict:
    """Call Gemini API to analyze image"""
    
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="Gemini API key not configured")
    
    # Use custom prompt if provided, otherwise use default
    if custom_prompt and len(custom_prompt.strip()) > 0:
        base_prompt = custom_prompt
        # Append formatting instructions
        prompt = f"""Analyze this image and the provided audio context (subtitles).
        
Accumulated Audio/Subtitle History: "{captions}"

Determine if: {base_prompt}.

Please respond with a JSON object in this exact format:
{{
  "DETECTED": true/false,
  "confidence": 0-100,
  "reasoning": "brief explanation",
  "summary": "Summary of the ENTIRE discussion history irrespective of detection"
}}

Look for characteristics like:
- Visual cues related to: {base_prompt}
- Context clues from the subtitle history: "{captions}"
- Overall appearance and context

Only respond with the JSON object, nothing else. "summary" field is MANDATORY even if DETECTED is false."""
    else:
        # Default prompt logic
        prompt = """Analyze this image and determine if MAJORITY of the people visible in the image appear to be above 30 years old.

Please respond with a JSON object in this exact format:
{
  "DETECTED": true/false,
  "confidence": 0-100,
  "reasoning": "brief explanation including approximate age ranges observed",
  "summary": "1-sentence summary of any audio context or visual context"
}

Look for characteristics like:
- Facial features indicating maturity (wrinkles, skin texture, facial structure)
- Overall appearance and physical characteristics
- If multiple people are present, majority must appear above 30 for true
 
Only respond with the JSON object, nothing else."""

    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt},
                    {
                        "inline_data": {
                            "mime_type": "image/jpeg",
                            "data": image_base64
                        }
                    }
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.4,
            "topK": 32,
            "topP": 1,
            "maxOutputTokens": 1024
        }
    }
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.post(
                f"{GEMINI_API_URL}?key={GEMINI_API_KEY}",
                json=payload
            )
            response.raise_for_status()
            data = response.json()
            
            # Extract text response
            text_content = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
            
            # Parse JSON from response
            json_match = re.search(r'\{[\s\S]*\}', text_content)
            if json_match:
                result = json.loads(json_match.group(0))
                return {
                    "DETECTED": result.get("DETECTED", False),
                    "confidence": result.get("confidence", 0),
                    "reasoning": result.get("reasoning", "No reasoning provided"),
                    "summary": result.get("summary", "")
                }
            else:
                raise ValueError("Could not parse JSON from Gemini response")
                
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=e.response.status_code, detail=f"Gemini API error: {str(e)}")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error calling Gemini API: {str(e)}")


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "online",
        "service": "Snake Game Detector API",
        "version": "1.0",
        "endpoints": {
            "analyze": "/api/analyze",
            "health": "/health",
            "stats": "/api/stats",
            "docs": "/docs"
        }
    }


@app.get("/health")
async def health_check():
    """Health check for monitoring"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "api_key_configured": bool(GEMINI_API_KEY),
        "cache_size": len(cache_store),
        "rate_limit_tracking": len(rate_limit_store)
    }


@app.post("/api/analyze", response_model=AnalyzeResponse)
async def analyze_frame(request: Request, data: AnalyzeRequest):
    """
    Analyze video frame to detect Snake game
    
    - **image**: Base64 encoded JPEG image data (without data:image/jpeg;base64, prefix)
    - **video_url**: Optional URL of the video being analyzed
    - **video_title**: Optional title of the video
    """
    
    # Get client IP
    client_ip = get_client_ip(request)
    
    # Check rate limiting
    if not check_rate_limit(client_ip):
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded. Please try again later."
        )
    
    # Manage Caption History
    full_captions_context = data.captions
    
    if data.video_url:
        # Use session_id if available, otherwise fallback to IP (backward compatibility)
        # Fixes NAT collision bug where multiple users on same IP shared history
        user_identifier = data.session_id if data.session_id else client_ip
        session_key = f"{user_identifier}:{data.video_url}"
        
        # Initialize or retrieve session
        if session_key not in caption_sessions:
            caption_sessions[session_key] = {"last_update": datetime.now(), "text": ""}
            
        session = caption_sessions[session_key]
        
        # Cleanup old sessions? (Simple TTL check on access)
        if (datetime.now() - session["last_update"]).total_seconds() > SESSION_TTL:
            session["text"] = ""
            
        # Append new captions with smart deduplication
        normalized_new = data.captions.strip()
        if normalized_new:
             session["text"] = merge_captions(session["text"], normalized_new)
             session["last_update"] = datetime.now()
             
        full_captions_context = session["text"].strip()
        print(f"[SESSION] History length: {len(full_captions_context)} chars")

    # # Check cache first
    print(f"[CACHE CHECK] Client: {client_ip}")
    # IMPORTANT: Cache key now depends on FULL history, not just current frame caption
    cache_key = get_cache_key(data.image, data.prompt, full_captions_context)
    cached_result = get_from_cache(cache_key)
    if cached_result:
        print(f"[CACHE HIT] Client: {client_ip}")
        return AnalyzeResponse(**cached_result, cached=True)
    
    # Call Gemini API
    try:
        print(f"[API CALL] Client: {client_ip}, Video: {data.video_title[:50] if data.video_title else 'N/A'}, Prompt: {data.prompt[:50] if data.prompt else 'DEFAULT'}, History: {len(full_captions_context)} chars")
        result = await call_gemini_api(data.image, data.prompt, full_captions_context)
        
        # Save to cache
        save_to_cache(cache_key, result)
        
        print(f"[RESULT] DETECTED: {result['DETECTED']}, Confidence: {result['confidence']}%")
        
        return AnalyzeResponse(**result, cached=False)
        
    except Exception as e:
        print(f"[ERROR] {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/stats")
async def get_stats(request: Request):
    """Get API usage statistics"""
    client_ip = get_client_ip(request)
    
    # Count requests in last hour
    now = datetime.now()
    recent_requests = [
        ts for ts in rate_limit_store.get(client_ip, [])
        if now - ts < timedelta(hours=1)
    ]
    
    return {
        "your_ip": client_ip,
        "requests_last_hour": len(recent_requests),
        "limit_per_hour": MAX_REQUESTS_PER_HOUR,
        "remaining": MAX_REQUESTS_PER_HOUR - len(recent_requests),
        "cache_entries": len(cache_store),
        "rate_limits": {
            "per_minute": MAX_REQUESTS_PER_MINUTE,
            "per_hour": MAX_REQUESTS_PER_HOUR
        },
        "total_tracked_ips": len(rate_limit_store)
    }


@app.delete("/api/cache")
async def clear_cache():
    """Clear the cache (admin endpoint)"""
    cache_store.clear()
    return {"status": "cache cleared", "entries_removed": len(cache_store)}


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)