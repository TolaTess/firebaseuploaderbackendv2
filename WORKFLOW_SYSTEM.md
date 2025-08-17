# Data Analysis and Workflow System

This document describes the comprehensive data analysis and workflow system that automatically checks for data integrity issues, missing titles, duplicates, and ensures all items have the right information.

## Overview

The system implements a scheduled workflow that:
1. **Checks duplicates** and saves duplicate info to JSON
2. **Checks titles** and adds missing titles to JSON
3. **Checks transformations** to ensure all items have right information
4. **Runs enhancements** for a full data quality check

## Analysis Scope

The system supports different analysis scopes to control the amount of data processed:

- **`all`** - Analyze all data in the database
- **`last24hours`** - Analyze only data from the last 24 hours
- **`last7days`** - Analyze only data from the last 7 days
- **`last30days`** - Analyze only data from the last 30 days
- **`custom`** - Analyze data within a custom date range

## Workflow Steps

### 1. Data Analysis
- Performs comprehensive analysis of meals and ingredients
- Identifies missing titles, duplicates, and enhancement needs
- Saves results to JSON files for tracking

### 2. Duplicate Detection
- Scans for duplicate meals and ingredients
- Provides summary of duplicate groups
- Prepares data for transformation

### 3. Title Validation
- Checks for meals and ingredients without titles
- Logs detailed information about items missing titles
- Identifies critical data integrity issues

### 4. Title Addition
- Uses Gemini AI to generate appropriate titles
- Updates items in Firestore with new titles
- Provides detailed results of the process

### 5. Transformation Check
- Reviews pending transformations from analysis
- Ensures all items are properly categorized
- Prepares for enhancement execution

### 6. Enhancement Execution
- Runs comprehensive enhancements on meals and ingredients
- Fills in missing details using Gemini AI
- Ensures data completeness and quality

## API Endpoints

### Data Analysis Endpoints

#### Analyze Data
```http
POST /api/analyze-data
Content-Type: application/json

{
  "scope": "all" | "last24hours" | "last7days" | "last30days" | "custom"
}
```

#### Check Meals Without Titles
```http
POST /api/check-meals-without-titles
Content-Type: application/json

{
  "scope": "all" | "last24hours" | "last7days" | "last30days" | "custom"
}
```

#### Add Titles to Meals
```http
POST /api/add-titles-to-meals
Content-Type: application/json

{
  "mealIds": ["id1", "id2"], // Optional: specific IDs to process
  "scope": "all" | "last24hours" | "last7days" | "last30days" | "custom"
}
```

### Workflow Orchestrator Endpoints

#### Execute Complete Workflow
```http
POST /api/workflow/execute
Content-Type: application/json

{
  "scope": "all" | "last24hours" | "last7days" | "last30days" | "custom"
}
```

**Response:**
```json
{
  "success": true,
  "result": {
    "id": "workflow-1234567890",
    "timestamp": "2025-01-17T01:00:00.000Z",
    "scope": "all",
    "steps": [
      {
        "name": "data-analysis",
        "status": "completed",
        "startTime": "2025-01-17T01:00:00.000Z",
        "endTime": "2025-01-17T01:00:05.000Z",
        "result": { /* analysis results */ }
      }
    ],
    "summary": {
      "totalSteps": 6,
      "completedSteps": 6,
      "failedSteps": 0,
      "totalIssues": 15,
      "criticalIssues": 2
    }
  }
}
```

#### Execute Specific Step
```http
POST /api/workflow/step
Content-Type: application/json

{
  "step": "data-analysis" | "duplicate-detection" | "title-validation" | "title-addition" | "transformation-check" | "enhancement-execution",
  "scope": "all" | "last24hours" | "last7days" | "last30days" | "custom"
}
```

#### Get Workflow Status
```http
GET /api/workflow/status
```

**Response:**
```json
{
  "success": true,
  "status": {
    "id": "workflow-1234567890",
    "timestamp": "2025-01-17T01:00:00.000Z",
    "scope": "all",
    "steps": [ /* step details */ ],
    "summary": { /* summary details */ }
  },
  "recommendations": [
    "Add titles to 2 meals",
    "Transform 5 duplicate meals",
    "Enhance 10 meals with missing details"
  ]
}
```

### Ingredient Type Update Endpoints

#### Update Single Ingredient Type
```http
POST /api/update-ingredient-type
Content-Type: application/json

{
  "ingredientId": "your-ingredient-id"
}
```

#### Update Multiple Ingredient Types
```http
POST /api/update-multiple-ingredient-types
Content-Type: application/json

{
  "ingredientIds": ["id1", "id2", "id3"]
}
```

## Usage Examples

### Running Complete Workflow
```bash
# Execute complete workflow for all data
curl -X POST http://localhost:3001/api/workflow/execute \
  -H "Content-Type: application/json" \
  -d '{"scope": "all"}'

# Execute workflow for last 24 hours only
curl -X POST http://localhost:3001/api/workflow/execute \
  -H "Content-Type: application/json" \
  -d '{"scope": "last24hours"}'
```

### Checking Specific Issues
```bash
# Check for meals without titles
curl -X POST http://localhost:3001/api/check-meals-without-titles \
  -H "Content-Type: application/json" \
  -d '{"scope": "all"}'

# Add titles to specific meals
curl -X POST http://localhost:3001/api/add-titles-to-meals \
  -H "Content-Type: application/json" \
  -d '{"mealIds": ["meal1", "meal2"]}'
```

### Running Individual Steps
```bash
# Run just the data analysis step
curl -X POST http://localhost:3001/api/workflow/step \
  -H "Content-Type: application/json" \
  -d '{"step": "data-analysis", "scope": "all"}'

# Run just the title validation step
curl -X POST http://localhost:3001/api/workflow/step \
  -H "Content-Type: application/json" \
  -d '{"step": "title-validation", "scope": "last24hours"}'
```

## Data Files

The system creates and manages several JSON files in the `data/` directory:

### `analysis-results.json`
Contains the latest comprehensive analysis results including:
- Total counts of meals and ingredients
- Items without titles
- Items needing transformation
- Items needing enhancement
- Recommendations

### `workflow-state.json`
Tracks the current state of the workflow including:
- Pending transformations
- Processing queue
- Completed items
- Last analysis timestamp

### `workflow-execution.json`
Contains detailed information about the latest workflow execution:
- Step-by-step progress
- Execution times
- Results and errors
- Summary statistics

## Error Handling

The system includes comprehensive error handling:

1. **Step-level errors**: Individual steps can fail without stopping the entire workflow
2. **Retry logic**: API calls include retry mechanisms with exponential backoff
3. **Fallback mechanisms**: AI failures fall back to rule-based processing
4. **Detailed logging**: All operations are logged with timestamps and error details
5. **Progress tracking**: Workflow state is saved after each step

## Monitoring and Logging

### Console Output
The system provides detailed console output for monitoring:

```
🚀 Starting complete workflow execution (ID: workflow-1234567890, Scope: all)
📊 Step 1: Performing comprehensive data analysis...
✅ Data analysis completed. Found 15 total issues, 2 critical issues
🔍 Step 2: Detecting duplicates...
✅ Duplicate detection completed. Found 5 meal duplicates, 3 ingredient duplicates
📝 Step 3: Validating titles...
✅ Title validation completed. Found 2 meals without titles, 1 ingredient without titles
✏️ Step 4: Adding missing titles...
✅ Title addition completed. Added 2 meal titles, 1 ingredient title
🔄 Step 5: Checking transformations...
✅ Transformation check completed. Found 5 meals and 3 ingredients pending transformation
✨ Step 6: Running enhancements...
✅ Enhancement execution completed. Enhanced 10 meals, 8 ingredients
🎉 Complete workflow execution finished successfully!
📈 Summary: 6/6 steps completed, 0 failed
🔧 Issues: 15 total, 2 critical
```

### Status Monitoring
```bash
# Check current workflow status
curl http://localhost:3001/api/workflow/status

# Check workflow execution status
curl http://localhost:3001/api/workflow-status
```

## Benefits

1. **Automated Data Quality**: Ensures all data meets quality standards
2. **Scalable Processing**: Supports different scopes for efficient processing
3. **Comprehensive Tracking**: Detailed logging and state management
4. **Flexible Execution**: Can run complete workflow or individual steps
5. **Error Resilience**: Continues processing even when individual steps fail
6. **AI-Powered Enhancement**: Uses Gemini AI for intelligent data improvement
7. **JSON State Management**: Persistent state tracking for long-running operations

## Implementation Details

### Services
- **`DataAnalysisService`**: Core analysis functionality
- **`WorkflowOrchestrator`**: Workflow execution and coordination
- **`MealService`**: Meal-specific operations
- **`IngredientService`**: Ingredient-specific operations

### Key Features
- Scope-based analysis for performance optimization
- AI-powered title generation and enhancement
- Comprehensive error handling and retry logic
- Detailed progress tracking and state management
- RESTful API endpoints for all operations
- JSON-based state persistence

This system provides a robust, scalable solution for maintaining data quality across your meal and ingredient database.
