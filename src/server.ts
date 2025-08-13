import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cron from 'node-cron';
import { MealService } from './services/mealService';
import { IngredientService } from './services/ingredientService';
import { CollectionsService } from './services/collectionsService';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Initialize services
const mealService = new MealService();
const ingredientService = new IngredientService();
const collectionsService = new CollectionsService();

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Manual trigger endpoints
app.post('/api/scan-duplicates', async (req, res) => {
  try {
    console.log('Manual duplicate scan triggered');
    const summary = await mealService.getDuplicatesSummary();
    res.json({ success: true, summary });
  } catch (error) {
    console.error('Error scanning duplicates:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

app.post('/api/transform-duplicates', async (req, res) => {
  try {
    console.log('Manual duplicate transformation triggered');
    const count = await mealService.transformDuplicatesIntoVariations();
    res.json({ success: true, transformedCount: count });
  } catch (error) {
    console.error('Error transforming duplicates:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

app.post('/api/enhance-meals', async (req, res) => {
  try {
    console.log('Manual meal enhancement triggered');
    const count = await mealService.updateMealsWithGeminiEnhancement();
    res.json({ success: true, enhancedCount: count });
  } catch (error) {
    console.error('Error enhancing meals:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Ingredient enhancement endpoints
app.post('/api/enhance-ingredients', async (req, res) => {
  try {
    console.log('Manual ingredient enhancement triggered');
    const count = await ingredientService.updateIngredientsWithGeminiEnhancement();
    res.json({ success: true, enhancedCount: count });
  } catch (error) {
    console.error('Error enhancing ingredients:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

app.post('/api/transform-ingredient-duplicates', async (req, res) => {
  try {
    console.log('Manual ingredient duplicate transformation triggered');
    const count = await ingredientService.transformDuplicatesIntoVariations();
    res.json({ success: true, transformedCount: count });
  } catch (error) {
    console.error('Error transforming ingredient duplicates:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

app.post('/api/generate-ingredients', async (req, res) => {
  try {
    console.log('Manual ingredient generation triggered');
    const { protein = 0, vegetable = 0, fruit = 0, grain = 0 } = req.body;
    const count = await ingredientService.generateNewIngredients({ protein, vegetable, fruit, grain });
    res.json({ success: true, generatedCount: count });
  } catch (error) {
    console.error('Error generating ingredients:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Collections enhancement endpoints
app.post('/api/enhance-cooking-methods', async (req, res) => {
  try {
    console.log('Manual cooking methods enhancement triggered');
    const count = await collectionsService.enhanceCookingMethods();
    res.json({ success: true, enhancedCount: count });
  } catch (error) {
    console.error('Error enhancing cooking methods:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

app.post('/api/enhance-diet-categories', async (req, res) => {
  try {
    console.log('Manual diet categories enhancement triggered');
    const count = await collectionsService.enhanceDietCategories();
    res.json({ success: true, enhancedCount: count });
  } catch (error) {
    console.error('Error enhancing diet categories:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

app.post('/api/enhance-programs', async (req, res) => {
  try {
    console.log('Manual programs enhancement triggered');
    const count = await collectionsService.updateProgramsWithPortionDetails();
    res.json({ success: true, enhancedCount: count });
  } catch (error) {
    console.error('Error enhancing programs:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

app.post('/api/create-programs', async (req, res) => {
  try {
    console.log('Manual program creation triggered');
    const count = await collectionsService.createAllPrograms();
    res.json({ success: true, createdCount: count });
  } catch (error) {
    console.error('Error creating programs:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

app.post('/api/create-routines', async (req, res) => {
  try {
    console.log('Manual routine creation triggered');
    const count = await collectionsService.createProgramRoutines();
    res.json({ success: true, updatedCount: count });
  } catch (error) {
    console.error('Error creating routines:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

app.get('/api/programs-summary', async (req, res) => {
  try {
    console.log('Programs summary requested');
    const summary = await collectionsService.getProgramsSummary();
    res.json({ success: true, summary });
  } catch (error) {
    console.error('Error getting programs summary:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Comprehensive enhancement endpoint
app.post('/api/enhance-all', async (req, res) => {
  try {
    console.log('Manual comprehensive enhancement triggered');
    
    const results = {
      meals: 0,
      ingredients: 0,
      cookingMethods: 0,
      dietCategories: 0,
      programs: 0,
      routines: 0
    };

    // Enhance meals
    try {
      results.meals = await mealService.updateMealsWithGeminiEnhancement();
      console.log(`Enhanced ${results.meals} meals`);
    } catch (error) {
      console.error('Error enhancing meals:', error);
    }

    // Enhance ingredients
    try {
      results.ingredients = await ingredientService.updateIngredientsWithGeminiEnhancement();
      console.log(`Enhanced ${results.ingredients} ingredients`);
    } catch (error) {
      console.error('Error enhancing ingredients:', error);
    }

    // Enhance cooking methods
    try {
      results.cookingMethods = await collectionsService.enhanceCookingMethods();
      console.log(`Enhanced ${results.cookingMethods} cooking methods`);
    } catch (error) {
      console.error('Error enhancing cooking methods:', error);
    }

    // Enhance diet categories
    try {
      results.dietCategories = await collectionsService.enhanceDietCategories();
      console.log(`Enhanced ${results.dietCategories} diet categories`);
    } catch (error) {
      console.error('Error enhancing diet categories:', error);
    }

          // Enhance programs
      try {
        results.programs = await collectionsService.updateProgramsWithPortionDetails();
        console.log(`Enhanced ${results.programs} programs`);
      } catch (error) {
        console.error('Error enhancing programs:', error);
      }

            // Create routines for programs
      try {
        results.routines = await collectionsService.createProgramRoutines();
        console.log(`Created routines for ${results.routines} programs`);
      } catch (error) {
        console.error('Error creating routines:', error);
      }

    res.json({ success: true, results });
  } catch (error) {
    console.error('Error in comprehensive enhancement:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Schedule cron jobs
const scheduleJobs = () => {
  // Run duplicate scan every day at 1 AM
  cron.schedule('0 1 * * *', async () => {
    try {
      console.log('Scheduled duplicate scan started at:', new Date().toISOString());
      const summary = await mealService.getDuplicatesSummary();
      console.log('Duplicate scan completed:', summary);
    } catch (error) {
      console.error('Scheduled duplicate scan failed:', error);
    }
  });

  // Run duplicate transformations every day at 2 AM
  cron.schedule('0 2 * * *', async () => {
    try {
      console.log('Scheduled duplicate transformations started at:', new Date().toISOString());
      
      // Transform meal duplicates
      try {
        const mealCount = await mealService.transformDuplicatesIntoVariations();
        console.log('Meal duplicate transformation completed:', mealCount, 'meals transformed');
      } catch (error) {
        console.error('Error transforming meal duplicates:', error);
      }

      // Transform ingredient duplicates
      try {
        const ingredientCount = await ingredientService.transformDuplicatesIntoVariations();
        console.log('Ingredient duplicate transformation completed:', ingredientCount, 'ingredients transformed');
      } catch (error) {
        console.error('Error transforming ingredient duplicates:', error);
      }

    } catch (error) {
      console.error('Scheduled duplicate transformations failed:', error);
    }
  });

  // Run program updates every day at 3 AM
  // COMMENTED OUT - Program scheduling disabled
  /*
  cron.schedule('0 3 * * *', async () => {
    try {
      console.log('Scheduled program updates started at:', new Date().toISOString());
      
      const results = {
        programs: 0,
        routines: 0
      };

      // Enhance programs
      try {
        results.programs = await collectionsService.updateProgramsWithPortionDetails();
        console.log(`Enhanced ${results.programs} programs`);
      } catch (error) {
        console.error('Error enhancing programs:', error);
      }

      // Create routines for programs
      try {
        results.routines = await collectionsService.createProgramRoutines();
        console.log(`Created routines for ${results.routines} programs`);
      } catch (error) {
        console.error('Error creating routines:', error);
      }

      console.log('Program updates completed:', results);
    } catch (error) {
      console.error('Scheduled program updates failed:', error);
    }
  });
  */

  // Run comprehensive enhancement (excluding programs) every day at 4 AM 
  cron.schedule('0 4 * * *', async () => {
    try {
      console.log('Scheduled comprehensive enhancement started at:', new Date().toISOString());
      
      const results = {
        meals: 0,
        ingredients: 0,
        cookingMethods: 0,
        dietCategories: 0
      };

      // Enhance meals
      try {
        results.meals = await mealService.updateMealsWithGeminiEnhancement();
        console.log(`Enhanced ${results.meals} meals`);
      } catch (error) {
        console.error('Error enhancing meals:', error);
      }

      // Enhance ingredients
      try {
        results.ingredients = await ingredientService.updateIngredientsWithGeminiEnhancement();
        console.log(`Enhanced ${results.ingredients} ingredients`);
      } catch (error) {
        console.error('Error enhancing ingredients:', error);
      }

      // Enhance cooking methods
      try {
        results.cookingMethods = await collectionsService.enhanceCookingMethods();
        console.log(`Enhanced ${results.cookingMethods} cooking methods`);
      } catch (error) {
        console.error('Error enhancing cooking methods:', error);
      }

      // Enhance diet categories
      try {
        results.dietCategories = await collectionsService.enhanceDietCategories();
        console.log(`Enhanced ${results.dietCategories} diet categories`);
      } catch (error) {
        console.error('Error enhancing diet categories:', error);
      }

      console.log('Comprehensive enhancement completed:', results);
    } catch (error) {
      console.error('Scheduled comprehensive enhancement failed:', error);
    }
  });

  console.log('Cron jobs scheduled successfully');
};

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  scheduleJobs();
});