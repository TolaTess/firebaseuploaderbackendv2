# TasteTurner Backend

This is the backend service for TasteTurner that handles scheduled enhancement tasks using Gemini AI.

## Features

- **Comprehensive Enhancement**: Automatically enhances meals, ingredients, cooking methods, diet categories, and programs
- **Duplicate Detection & Transformation**: Finds and transforms duplicate meals and ingredients into unique variations
- **Scheduled Tasks**: Runs enhancement tasks on a daily/weekly schedule
- **Manual Triggers**: API endpoints for manual enhancement triggers

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Create a `.env` file in the backend directory with the following variables:

```env
PORT=3001
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
VITE_FIREBASE_PROJECT_ID=your_firebase_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id
VITE_FIREBASE_APP_ID=your_firebase_app_id
VITE_GEMINI_API_KEY=your_gemini_api_key
```

### 3. Build and Run

```bash
# Build the project
npm run build

# Start the server
npm start

# For development
npm run dev
```

## API Endpoints

### Health Check
- `GET /health` - Check if the server is running

### Manual Enhancement Triggers
- `POST /api/scan-duplicates` - Scan for duplicate meals
- `POST /api/transform-duplicates` - Transform meal duplicates into variations
- `POST /api/enhance-meals` - Enhance meals with Gemini AI
- `POST /api/enhance-ingredients` - Enhance ingredients with Gemini AI
- `POST /api/transform-ingredient-duplicates` - Transform ingredient duplicates
- `POST /api/enhance-cooking-methods` - Enhance cooking methods
- `POST /api/enhance-diet-categories` - Enhance diet categories
- `POST /api/enhance-programs` - Enhance programs with portion details
- `POST /api/enhance-all` - Run all enhancement services

## Scheduled Tasks

### Daily Tasks (4 AM)
- **Comprehensive Enhancement**: Enhances all data types (meals, ingredients, cooking methods, diet categories, programs)

### Daily Tasks (2 AM)
- **Duplicate Scan**: Scans for duplicate meals and logs findings

### Weekly Tasks (Sunday 3 AM)
- **Duplicate Transformations**: Transforms duplicate meals and ingredients into unique variations

## Deployment on Render

1. **Create a new Web Service** on Render
2. **Connect your GitHub repository**
3. **Set the root directory** to `backend`
4. **Build command**: `npm install && npm run build`
5. **Start command**: `npm start`
6. **Add environment variables** in the Render dashboard

## Monitoring

The service logs all activities to the console, including:
- Enhancement progress and results
- Error messages and stack traces
- Scheduled task execution times
- API endpoint usage

## Error Handling

- Each enhancement service runs independently
- If one service fails, others continue to run
- All errors are logged with detailed information
- Rate limiting is implemented to avoid API quota issues
