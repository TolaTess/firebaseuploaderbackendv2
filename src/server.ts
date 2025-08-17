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

// Ingredient type update endpoints
app.post('/api/update-ingredient-type', async (req, res) => {
  try {
    console.log('Manual ingredient type update triggered');
    const { ingredientId } = req.body;
    
    if (!ingredientId) {
      return res.status(400).json({ success: false, error: 'ingredientId is required' });
    }
    
    const newType = await ingredientService.updateIngredientType(ingredientId);
    res.json({ success: true, newType, ingredientId });
  } catch (error) {
    console.error('Error updating ingredient type:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

app.post('/api/update-multiple-ingredient-types', async (req, res) => {
  try {
    console.log('Manual multiple ingredient type updates triggered');
    const { ingredientIds } = req.body;
    
    if (!ingredientIds || !Array.isArray(ingredientIds)) {
      return res.status(400).json({ success: false, error: 'ingredientIds array is required' });
    }
    
    const results = await ingredientService.updateMultipleIngredientTypes(ingredientIds);
    res.json({ success: true, results });
  } catch (error) {
    console.error('Error updating multiple ingredient types:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Data analysis and workflow endpoints
app.post('/api/analyze-data', async (req, res) => {
  try {
    console.log('Manual data analysis triggered');
    const { scope = 'all' } = req.body;
    
    const result = await mealService.performDataAnalysisWorkflow(scope);
    res.json({ success: true, result });
  } catch (error) {
    console.error('Error analyzing data:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

app.post('/api/check-meals-without-titles', async (req, res) => {
  try {
    console.log('Manual check for meals without titles triggered');
    const { scope = 'all' } = req.body;
    
    const result = await mealService.checkMealsWithoutTitles(scope);
    res.json({ success: true, result });
  } catch (error) {
    console.error('Error checking meals without titles:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

app.post('/api/add-titles-to-meals', async (req, res) => {
  try {
    console.log('Manual title addition to meals triggered');
    const { mealIds = [], scope = 'all' } = req.body;
    
    const result = await mealService.addTitlesToMeals(mealIds, scope);
    res.json({ success: true, result });
  } catch (error) {
    console.error('Error adding titles to meals:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

app.get('/api/workflow-status', async (req, res) => {
  try {
    console.log('Workflow status requested');
    const dataAnalysisService = new (await import('./services/dataAnalysisService')).DataAnalysisService();
    const workflowState = dataAnalysisService.getWorkflowState();
    const lastAnalysis = dataAnalysisService.getLastAnalysis();
    
    res.json({ 
      success: true, 
      workflowState, 
      lastAnalysis 
    });
  } catch (error) {
    console.error('Error getting workflow status:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Workflow orchestrator endpoints
app.post('/api/workflow/execute', async (req, res) => {
  try {
    console.log('Manual workflow execution triggered');
    const { scope = 'all' } = req.body;
    
    const { WorkflowOrchestrator } = await import('./services/workflowOrchestrator');
    const orchestrator = new WorkflowOrchestrator();
    const result = await orchestrator.executeCompleteWorkflow(scope);
    
    res.json({ success: true, result });
  } catch (error) {
    console.error('Error executing workflow:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

app.post('/api/workflow/step', async (req, res) => {
  try {
    console.log('Manual workflow step execution triggered');
    const { step, scope = 'all' } = req.body;
    
    if (!step) {
      return res.status(400).json({ success: false, error: 'step is required' });
    }
    
    const { WorkflowOrchestrator } = await import('./services/workflowOrchestrator');
    const orchestrator = new WorkflowOrchestrator();
    const result = await orchestrator.executeSpecificStep(step, scope);
    
    res.json({ success: true, result });
  } catch (error) {
    console.error('Error executing workflow step:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

app.get('/api/workflow/status', async (req, res) => {
  try {
    console.log('Workflow execution status requested');
    
    const { WorkflowOrchestrator } = await import('./services/workflowOrchestrator');
    const orchestrator = new WorkflowOrchestrator();
    const status = orchestrator.getWorkflowStatus();
    const recommendations = orchestrator.getWorkflowRecommendations();
    
    res.json({ 
      success: true, 
      status, 
      recommendations 
    });
  } catch (error) {
    console.error('Error getting workflow execution status:', error);
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

// Schedule cron jobs with new workflow system
const scheduleJobs = () => {
  // Step 1: Data Analysis and Duplicate Detection (1 AM)
  cron.schedule('0 1 * * *', async () => {
    try {
      console.log('🔄 Scheduled workflow step 1 started at:', new Date().toISOString());
      console.log('📊 Step 1: Data Analysis and Duplicate Detection');
      
      const { WorkflowOrchestrator } = await import('./services/workflowOrchestrator');
      const orchestrator = new WorkflowOrchestrator();
      
      // Execute data analysis and duplicate detection steps
      const analysisResult = await orchestrator.executeSpecificStep('data-analysis', 'all');
      console.log('✅ Data analysis completed:', analysisResult.summary);
      
      const duplicateResult = await orchestrator.executeSpecificStep('duplicate-detection', 'all');
      console.log('✅ Duplicate detection completed:', duplicateResult);
      
      console.log('🔄 Step 1 completed successfully');
    } catch (error) {
      console.error('❌ Scheduled workflow step 1 failed:', error);
    }
  });

  // Step 2: Title Validation and Addition (2 AM)
  cron.schedule('0 2 * * *', async () => {
    try {
      console.log('🔄 Scheduled workflow step 2 started at:', new Date().toISOString());
      console.log('📝 Step 2: Title Validation and Addition');
      
      const { WorkflowOrchestrator } = await import('./services/workflowOrchestrator');
      const orchestrator = new WorkflowOrchestrator();
      
      // Execute title validation and addition steps
      const titleValidationResult = await orchestrator.executeSpecificStep('title-validation', 'all');
      console.log('✅ Title validation completed:', titleValidationResult);
      
      const titleAdditionResult = await orchestrator.executeSpecificStep('title-addition', 'all');
      console.log('✅ Title addition completed:', titleAdditionResult);
      
      console.log('🔄 Step 2 completed successfully');
    } catch (error) {
      console.error('❌ Scheduled workflow step 2 failed:', error);
    }
  });

  // Step 3: Type Check and Fix (3 AM)
  cron.schedule('0 3 * * *', async () => {
    try {
      console.log('🔄 Scheduled workflow step 3 started at:', new Date().toISOString());
      console.log('🔧 Step 3: Type Check and Fix');
      
      const { WorkflowOrchestrator } = await import('./services/workflowOrchestrator');
      const orchestrator = new WorkflowOrchestrator();
      
      // Execute type check and fix
      const typeCheckResult = await orchestrator.executeSpecificStep('type-check-and-fix', 'all');
      console.log('✅ Type check and fix completed:', typeCheckResult);
      
      console.log('🔧 Step 3 completed successfully');
    } catch (error) {
      console.error('❌ Scheduled workflow step 3 failed:', error);
    }
  });

  // Step 3.5: Title and Duplication Fix (3:30 AM)
  cron.schedule('30 3 * * *', async () => {
    try {
      console.log('🔄 Scheduled workflow step 3.5 started at:', new Date().toISOString());
      console.log('📝 Step 3.5: Title and Duplication Fix');
      
      const { WorkflowOrchestrator } = await import('./services/workflowOrchestrator');
      const orchestrator = new WorkflowOrchestrator();
      
      // Execute title and duplication fix
      const titleDuplicationResult = await orchestrator.executeSpecificStep('title-and-duplication-fix', 'all');
      console.log('✅ Title and duplication fix completed:', titleDuplicationResult);
      
      console.log('📝 Step 3.5 completed successfully');
    } catch (error) {
      console.error('❌ Scheduled workflow step 3.5 failed:', error);
    }
  });

  // Step 4: Enhancement Execution (4 AM) - Overall enhancement checks
  cron.schedule('0 4 * * *', async () => {
    try {
      console.log('🔄 Scheduled workflow step 4 started at:', new Date().toISOString());
      console.log('✨ Step 4: Enhancement Execution (Overall enhancement checks)');
      
      const { WorkflowOrchestrator } = await import('./services/workflowOrchestrator');
      const orchestrator = new WorkflowOrchestrator();
      
      // Execute enhancement step with built-in rate limiting
      const enhancementResult = await orchestrator.executeSpecificStep('enhancement-execution', 'all');
      console.log('✅ Enhancement execution completed:', enhancementResult);
      
      // Additional enhancements with proper spacing
      console.log('🔄 Running additional enhancements with rate limiting...');
      
      const results = {
        cookingMethods: 0,
        dietCategories: 0
      };

      // Enhance cooking methods
      try {
        console.log('🔄 Enhancing cooking methods...');
        results.cookingMethods = await collectionsService.enhanceCookingMethods();
        console.log(`✅ Enhanced ${results.cookingMethods} cooking methods`);
      } catch (error) {
        console.error('❌ Error enhancing cooking methods:', error);
      }

      // Wait 30 minutes before diet categories
      console.log('⏳ Waiting 30 minutes before diet category enhancements...');
      await new Promise(resolve => setTimeout(resolve, 30 * 60 * 1000));

      // Enhance diet categories
      try {
        console.log('🔄 Enhancing diet categories...');
        results.dietCategories = await collectionsService.enhanceDietCategories();
        console.log(`✅ Enhanced ${results.dietCategories} diet categories`);
      } catch (error) {
        console.error('❌ Error enhancing diet categories:', error);
      }

      console.log('✨ Step 4 completed successfully:', results);
    } catch (error) {
      console.error('❌ Scheduled workflow step 4 failed:', error);
    }
  });

  // Step 5: Complete workflow execution (5 AM) - for comprehensive runs
  cron.schedule('0 5 * * *', async () => {
    try {
      console.log('🚀 Scheduled complete workflow execution started at:', new Date().toISOString());
      console.log('🎯 Complete Workflow: Full data quality check');
      
      const { WorkflowOrchestrator } = await import('./services/workflowOrchestrator');
      const orchestrator = new WorkflowOrchestrator();
      
      // Execute complete workflow with scope 'all'
      const completeResult = await orchestrator.executeCompleteWorkflow('all');
      console.log('🎉 Complete workflow execution finished:', completeResult.summary);
      
    } catch (error) {
      console.error('❌ Scheduled complete workflow execution failed:', error);
    }
  });

  console.log('✅ Cron jobs scheduled successfully with new workflow system');
  console.log('📅 Schedule:');
  console.log('   1 AM - Data Analysis & Duplicate Detection');
  console.log('   2 AM - Title Validation & Addition');
  console.log('   3 AM - Transformation Check & Execution (with 30min spacing)');
  console.log('   4 AM - Enhancement Execution (with 30min spacing)');
  console.log('   5 AM - Complete Workflow Execution (optional)');
};

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  scheduleJobs();
});