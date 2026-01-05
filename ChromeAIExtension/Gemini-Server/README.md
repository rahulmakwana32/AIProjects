# Snake Game Detector API

Python FastAPI server that analyzes video frames to detect classic Snake game using Google Gemini AI.

## Features

- 🚀 **Fast & Async** - Built with FastAPI
- 🤖 **AI-Powered** - Uses Gemini 2.0 Flash Exp
- ⚡ **Smart Caching** - Reduces duplicate API calls
- 🛡️ **Rate Limiting** - 10/min, 100/hour per IP
- 📊 **Usage Stats** - Track your API usage
- 🐳 **Docker Ready** - Easy deployment
- 💰 **Free Tier** - Works with Gemini free tier

## Quick Start

### 1. Installation
```bash
# Clone or download files
cd snake-detector-api

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Configuration

Create `.env` file:
```env
GEMINI_API_KEY=your_key_here
MAX_REQUESTS_PER_MINUTE=10
MAX_REQUESTS_PER_HOUR=100
PORT=8000
```

Get your free API key: https://aistudio.google.com/app/apikey

### 3. Run Server
```bash
# Development mode
python main.py

# Or with uvicorn directly
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Visit:
- http://localhost:8000 - API info
- http://localhost:8000/docs - Interactive documentation
- http://localhost:8000/health - Health check

## API Endpoints

### `GET /`
API information and available endpoints

### `GET /health`
Health check endpoint
```json
{
  "status": "healthy",
  "timestamp": "2025-01-04T12:00:00",
  "api_key_configured": true,
  "cache_size": 5,
  "rate_limit_tracking": 3
}
```

### `POST /api/analyze`
Analyze video frame for Snake game

**Request:**
```json
{
  "image": "base64_encoded_jpeg_data",
  "video_url": "https://youtube.com/...",
  "video_title": "Classic Snake Game"
}
```

**Response:**
```json
{
  "isSnake": true,
  "confidence": 85,
  "reasoning": "Image shows segmented snake on grid with food items",
  "cached": false
}
```

### `GET /api/stats`
Get usage statistics for your IP
```json
{
  "your_ip": "123.456.789.0",
  "requests_last_hour": 15,
  "limit_per_hour": 100,
  "remaining": 85,
  "cache_entries": 10,
  "rate_limits": {
    "per_minute": 10,
    "per_hour": 100
  }
}
```

### `DELETE /api/cache`
Clear the cache (admin endpoint)

## Testing

### Manual Test with cURL
```bash
# Health check
curl http://localhost:8000/health

# Test with base64 image
curl -X POST http://localhost:8000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "image": "base64_image_data_here",
    "video_title": "Test Video"
  }'

# Check stats
curl http://localhost:8000/api/stats
```

### Test with Python Script

See `test_api.py` for automated testing.

## Deployment

### Option 1: Railway (Recommended)
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Deploy
railway up

# Set environment variable
railway variables set GEMINI_API_KEY=your_key_here

# Get URL
railway domain
```

### Option 2: Docker
```bash
# Build image
docker build -t snake-detector-api .

# Run container
docker run -p 8000:8000 \
  -e GEMINI_API_KEY=your_key_here \
  snake-detector-api

# Or with docker-compose
docker-compose up
```

### Option 3: Render

1. Create account at render.com
2. Connect GitHub repo
3. Configure:
   - Build: `pip install -r requirements.txt`
   - Start: `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Add environment variable: `GEMINI_API_KEY`
5. Deploy!

### Option 4: Google Cloud Run
```bash
# Build and submit
gcloud builds submit --tag gcr.io/PROJECT_ID/snake-detector

# Deploy
gcloud run deploy snake-detector \
  --image gcr.io/PROJECT_ID/snake-detector \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars GEMINI_API_KEY=your_key
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GEMINI_API_KEY` | Required | Your Gemini API key |
| `MAX_REQUESTS_PER_MINUTE` | 10 | Rate limit per minute |
| `MAX_REQUESTS_PER_HOUR` | 100 | Rate limit per hour |
| `PORT` | 8000 | Server port |

### Rate Limiting

Adjust in `.env`:
```env
MAX_REQUESTS_PER_MINUTE=20
MAX_REQUESTS_PER_HOUR=500
```

### Cache Duration

Modify in `main.py`:
```python
CACHE_DURATION = 300  # 5 minutes in seconds
```

## Performance

- **Response Time**: ~1-3 seconds per request
- **Caching**: Reduces API calls by ~40-60%
- **Rate Limiting**: Prevents abuse
- **Async**: Handles multiple requests efficiently

## Cost Estimation

### Gemini API (Free Tier)
- 1,500 requests/day
- ~$0 for moderate use

### Hosting
- Railway: Free tier (500 hours/month)
- Render: Free tier available
- Google Cloud Run: ~$0-5/month

**Total: $0-5/month** for personal use

## Troubleshooting

### API Key Not Working
```bash
# Check if key is set
echo $GEMINI_API_KEY

# Test key manually
curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=YOUR_KEY"
```

### Port Already in Use
```bash
# Change port in .env
PORT=8001

# Or kill existing process
# Windows:
netstat -ano | findstr :8000
taskkill /PID <PID> /F

# Mac/Linux:
lsof -ti:8000 | xargs kill -9
```

### CORS Errors
Update `main.py`:
```python
allow_origins=["chrome-extension://YOUR_EXTENSION_ID"]
```

### Rate Limit Issues
Increase limits in `.env` or wait for reset.

## Security

- ✅ API key stored as environment variable
- ✅ Rate limiting per IP
- ✅ CORS protection
- ✅ Input validation
- ✅ Error handling
- ⚠️ Consider adding authentication for production

## Monitoring

### View Logs
```bash
# Railway
railway logs

# Docker
docker logs <container_id>

# Local
# Logs print to console
```

### Add Custom Logging
```python
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Use in endpoints
logger.info(f"Request from {client_ip}")
```

## Development

### Run with Auto-Reload
```bash
uvicorn main:app --reload
```

### Run Tests
```bash
python test_api.py
```

### Format Code
```bash
pip install black
black main.py
```

## License

MIT License - Free to use and modify

## Support

For issues:
1. Check logs for errors
2. Verify API key is correct
3. Test endpoints with `/docs`
4. Check rate limits with `/api/stats`

## Contributing

Feel free to submit issues and pull requests!

---

**Built with FastAPI, Gemini AI, and ❤️**