# Ingredient Type Update Functionality

This document describes the new functionality for updating ingredient types based on their title and nutritional macros.

## Overview

The system now includes intelligent ingredient type classification that analyzes an ingredient's title and nutritional information to determine the correct type from the 4 allowed categories:

- **protein** - High protein foods (meat, fish, eggs, legumes, dairy)
- **grain** - Carbohydrate-rich foods (rice, wheat, oats, quinoa, bread, pasta)
- **vegetable** - Non-sweet plant foods (broccoli, spinach, carrots, peppers)
- **fruit** - Sweet plant foods (apples, bananas, berries, oranges)

## Features

### 1. AI-Powered Classification
- Uses Gemini AI to analyze ingredient titles and macros
- Considers both the ingredient name and nutritional composition
- Provides intelligent fallback logic if AI classification fails

### 2. Fallback Logic
- Calculates macronutrient percentages
- Uses keyword matching for common ingredients
- Defaults to 'vegetable' for unknown ingredients

### 3. Batch Processing
- Update single ingredients or multiple ingredients at once
- Includes error handling and detailed results reporting
- Rate limiting to prevent API overload

## API Endpoints

### Update Single Ingredient Type
```http
POST /api/update-ingredient-type
Content-Type: application/json

{
  "ingredientId": "your-ingredient-id"
}
```

**Response:**
```json
{
  "success": true,
  "newType": "protein",
  "ingredientId": "your-ingredient-id"
}
```

### Update Multiple Ingredient Types
```http
POST /api/update-multiple-ingredient-types
Content-Type: application/json

{
  "ingredientIds": ["id1", "id2", "id3"]
}
```

**Response:**
```json
{
  "success": true,
  "results": {
    "success": 2,
    "failed": 1,
    "results": [
      {
        "id": "id1",
        "oldType": "unknown",
        "newType": "protein",
        "success": true
      },
      {
        "id": "id2",
        "oldType": "unknown",
        "newType": "grain",
        "success": true
      },
      {
        "id": "id3",
        "oldType": "unknown",
        "newType": "unknown",
        "success": false,
        "error": "Ingredient not found"
      }
    ]
  }
}
```

## Classification Rules

### AI Classification
The Gemini AI analyzes ingredients using these rules:
1. If protein content is highest (>50% of calories from protein) → **protein**
2. If carbs content is highest (>60% of calories from carbs) and it's a grain/starch → **grain**
3. If it's a sweet plant food → **fruit**
4. If it's a non-sweet plant food → **vegetable**

### Fallback Classification
When AI classification fails, the system uses these rules:

**Protein Classification:**
- Protein percentage > 50% of total calories
- Keywords: chicken, beef, pork, fish, salmon, tuna, egg, tofu, tempeh, lentil, bean, chickpea

**Grain Classification:**
- Carbs percentage > 60% of total calories
- Keywords: rice, pasta, bread, quinoa, oats, wheat, corn, potato, sweet potato

**Fruit Classification:**
- Keywords: apple, banana, berry, orange, grape, mango, pineapple, strawberry, blueberry, peach, pear, plum

**Vegetable Classification:**
- Default for all other plant-based foods

## Usage Examples

### Using the Service Directly
```typescript
import { IngredientService } from './services/ingredientService';

const ingredientService = new IngredientService();

// Update single ingredient
const newType = await ingredientService.updateIngredientType('ingredient-id');
console.log(`Updated type: ${newType}`);

// Update multiple ingredients
const results = await ingredientService.updateMultipleIngredientTypes(['id1', 'id2', 'id3']);
console.log(`Success: ${results.success}, Failed: ${results.failed}`);
```

### Using the Gemini Service Directly
```typescript
import { GeminiService } from './services/geminiService';

const geminiService = new GeminiService();

const ingredient = {
  title: 'Chicken Breast',
  calories: 165,
  macros: { protein: '31g', carbs: '0g', fat: '3.6g' }
};

const type = await geminiService.updateIngredientType(ingredient);
console.log(`Classified as: ${type}`); // Output: protein
```

## Error Handling

The system includes comprehensive error handling:

1. **API Failures**: Retries with exponential backoff
2. **Invalid Responses**: Falls back to rule-based classification
3. **Missing Ingredients**: Reports detailed error messages
4. **Rate Limiting**: Includes delays between API calls

## Testing

Run the test script to see examples:
```bash
node test-ingredient-type-update.js
```

This will show test data and example API usage.

## Implementation Details

### Files Modified
- `src/services/geminiService.ts` - Added AI classification methods
- `src/services/ingredientService.ts` - Added service methods for updating types
- `src/server.ts` - Added API endpoints

### Key Methods
- `updateIngredientType()` - Main classification method
- `createIngredientTypeClassificationPrompt()` - AI prompt generation
- `parseIngredientTypeResponse()` - Response parsing
- `fallbackIngredientTypeClassification()` - Rule-based fallback
- `updateMultipleIngredientTypes()` - Batch processing

## Benefits

1. **Consistency**: Ensures all ingredients are properly categorized
2. **Accuracy**: Uses both AI and rule-based classification
3. **Efficiency**: Supports batch processing for large datasets
4. **Reliability**: Includes fallback mechanisms for robustness
5. **Flexibility**: Can be used programmatically or via API
