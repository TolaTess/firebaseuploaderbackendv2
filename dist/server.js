"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const mealService_1 = require("./services/mealService");
const ingredientService_1 = require("./services/ingredientService");
const collectionsService_1 = require("./services/collectionsService");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Initialize services
const mealService = new mealService_1.MealService();
const ingredientService = new ingredientService_1.IngredientService();
const collectionsService = new collectionsService_1.CollectionsService();
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
    }
    catch (error) {
        console.error('Error scanning duplicates:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
app.post('/api/transform-duplicates', async (req, res) => {
    try {
        console.log('Manual duplicate transformation triggered');
        const count = await mealService.transformDuplicatesIntoVariations();
        res.json({ success: true, transformedCount: count });
    }
    catch (error) {
        console.error('Error transforming duplicates:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
app.post('/api/enhance-meals', async (req, res) => {
    try {
        console.log('Manual meal enhancement triggered');
        const count = await mealService.updateMealsWithGeminiEnhancement();
        res.json({ success: true, enhancedCount: count });
    }
    catch (error) {
        console.error('Error enhancing meals:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
// Ingredient enhancement endpoints
app.post('/api/enhance-ingredients', async (req, res) => {
    try {
        console.log('Manual ingredient enhancement triggered');
        const count = await ingredientService.updateIngredientsWithGeminiEnhancement();
        res.json({ success: true, enhancedCount: count });
    }
    catch (error) {
        console.error('Error enhancing ingredients:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
app.post('/api/transform-ingredient-duplicates', async (req, res) => {
    try {
        console.log('Manual ingredient duplicate transformation triggered');
        const count = await ingredientService.transformDuplicatesIntoVariations();
        res.json({ success: true, transformedCount: count });
    }
    catch (error) {
        console.error('Error transforming ingredient duplicates:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
app.post('/api/generate-ingredients', async (req, res) => {
    try {
        console.log('Manual ingredient generation triggered');
        const { protein = 0, vegetable = 0, fruit = 0, grain = 0 } = req.body;
        const count = await ingredientService.generateNewIngredients({ protein, vegetable, fruit, grain });
        res.json({ success: true, generatedCount: count });
    }
    catch (error) {
        console.error('Error generating ingredients:', error);
        res.status(500).json({ success: false, error: error.message });
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
    }
    catch (error) {
        console.error('Error updating ingredient type:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
app.post('/api/update-multiple-ingredient-types', async (req, res) => {
    try {
        console.log('Manual multiple ingredient type updates triggered');
        const { ingredientIds = [], scope = 'last24hours' } = req.body;
        if (ingredientIds.length > 0 && !Array.isArray(ingredientIds)) {
            return res.status(400).json({ success: false, error: 'ingredientIds must be an array' });
        }
        const results = await ingredientService.updateMultipleIngredientTypes(ingredientIds, scope);
        res.json({ success: true, results });
    }
    catch (error) {
        console.error('Error updating multiple ingredient types:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
// Data analysis and workflow endpoints
app.post('/api/analyze-data', async (req, res) => {
    try {
        console.log('Manual data analysis triggered');
        const { scope = 'all' } = req.body;
        const result = await mealService.performDataAnalysisWorkflow(scope);
        res.json({ success: true, result });
    }
    catch (error) {
        console.error('Error analyzing data:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
app.post('/api/check-meals-without-titles', async (req, res) => {
    try {
        console.log('Manual check for meals without titles triggered');
        const { scope = 'all' } = req.body;
        const result = await mealService.checkMealsWithoutTitles(scope);
        res.json({ success: true, result });
    }
    catch (error) {
        console.error('Error checking meals without titles:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
app.post('/api/add-titles-to-meals', async (req, res) => {
    try {
        console.log('Manual title addition to meals triggered');
        const { mealIds = [], scope = 'all' } = req.body;
        const result = await mealService.addTitlesToMeals(mealIds, scope);
        res.json({ success: true, result });
    }
    catch (error) {
        console.error('Error adding titles to meals:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
app.get('/api/workflow-status', async (req, res) => {
    try {
        console.log('Workflow status requested');
        const dataAnalysisService = new (await Promise.resolve().then(() => __importStar(require('./services/dataAnalysisService')))).DataAnalysisService();
        const workflowState = dataAnalysisService.getWorkflowState();
        const lastAnalysis = dataAnalysisService.getLastAnalysis();
        res.json({
            success: true,
            workflowState,
            lastAnalysis
        });
    }
    catch (error) {
        console.error('Error getting workflow status:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
// Workflow orchestrator endpoints
app.post('/api/workflow/execute', async (req, res) => {
    try {
        console.log('Manual workflow execution triggered');
        const { scope = 'all' } = req.body;
        const { WorkflowOrchestrator } = await Promise.resolve().then(() => __importStar(require('./services/workflowOrchestrator')));
        const orchestrator = new WorkflowOrchestrator();
        const result = await orchestrator.executeCompleteWorkflow(scope);
        res.json({ success: true, result });
    }
    catch (error) {
        console.error('Error executing workflow:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
app.post('/api/workflow/step', async (req, res) => {
    try {
        console.log('Manual workflow step execution triggered');
        const { step, scope = 'all' } = req.body;
        if (!step) {
            return res.status(400).json({ success: false, error: 'step is required' });
        }
        const { WorkflowOrchestrator } = await Promise.resolve().then(() => __importStar(require('./services/workflowOrchestrator')));
        const orchestrator = new WorkflowOrchestrator();
        const result = await orchestrator.executeSpecificStep(step, scope);
        res.json({ success: true, result });
    }
    catch (error) {
        console.error('Error executing workflow step:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
app.get('/api/workflow/status', async (req, res) => {
    try {
        console.log('Workflow execution status requested');
        const { WorkflowOrchestrator } = await Promise.resolve().then(() => __importStar(require('./services/workflowOrchestrator')));
        const orchestrator = new WorkflowOrchestrator();
        const status = orchestrator.getWorkflowStatus();
        const recommendations = orchestrator.getWorkflowRecommendations();
        res.json({
            success: true,
            status,
            recommendations
        });
    }
    catch (error) {
        console.error('Error getting workflow execution status:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
// Collections enhancement endpoints
app.post('/api/enhance-cooking-methods', async (req, res) => {
    try {
        console.log('Manual cooking methods enhancement triggered');
        const count = await collectionsService.enhanceCookingMethods();
        res.json({ success: true, enhancedCount: count });
    }
    catch (error) {
        console.error('Error enhancing cooking methods:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
app.post('/api/enhance-diet-categories', async (req, res) => {
    try {
        console.log('Manual diet categories enhancement triggered');
        const count = await collectionsService.enhanceDietCategories();
        res.json({ success: true, enhancedCount: count });
    }
    catch (error) {
        console.error('Error enhancing diet categories:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
app.post('/api/enhance-programs', async (req, res) => {
    try {
        console.log('Manual programs enhancement triggered');
        const count = await collectionsService.updateProgramsWithPortionDetails();
        res.json({ success: true, enhancedCount: count });
    }
    catch (error) {
        console.error('Error enhancing programs:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
app.post('/api/create-programs', async (req, res) => {
    try {
        console.log('Manual program creation triggered');
        const count = await collectionsService.createAllPrograms();
        res.json({ success: true, createdCount: count });
    }
    catch (error) {
        console.error('Error creating programs:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
app.post('/api/create-routines', async (req, res) => {
    try {
        console.log('Manual routine creation triggered');
        const count = await collectionsService.createProgramRoutines();
        res.json({ success: true, updatedCount: count });
    }
    catch (error) {
        console.error('Error creating routines:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
app.post('/api/fix-meal-structure', async (req, res) => {
    try {
        console.log('Manual meal structure fix triggered');
        const result = await mealService.fixMealStructure();
        res.json({
            success: true,
            message: `Fixed meal structure: ${result.success} successful, ${result.failed} failed`,
            result
        });
    }
    catch (error) {
        console.error('Error fixing meal structure:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
app.post('/api/fix-ingredient-structure', async (req, res) => {
    try {
        console.log('Manual ingredient structure fix triggered');
        const result = await ingredientService.fixIngredientStructure();
        res.json({
            success: true,
            message: `Fixed ingredient structure: ${result.success} successful, ${result.failed} failed`,
            result
        });
    }
    catch (error) {
        console.error('Error fixing ingredient structure:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
app.post('/api/enhanced-ingredient-enhancement', async (req, res) => {
    try {
        console.log('Manual enhanced ingredient enhancement triggered');
        const count = await ingredientService.updateIngredientsWithEnhancedGeminiEnhancement();
        res.json({
            success: true,
            message: `Enhanced ${count} ingredients with improved features`,
            enhancedCount: count
        });
    }
    catch (error) {
        console.error('Error with enhanced ingredient enhancement:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
app.get('/api/programs-summary', async (req, res) => {
    try {
        console.log('Programs summary requested');
        const summary = await collectionsService.getProgramsSummary();
        res.json({ success: true, summary });
    }
    catch (error) {
        console.error('Error getting programs summary:', error);
        res.status(500).json({ success: false, error: error.message });
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
        // Fix meal structure
        try {
            const mealStructureFix = await mealService.fixMealStructure();
            console.log(`Fixed meal structure: ${mealStructureFix.success} successful, ${mealStructureFix.failed} failed`);
        }
        catch (error) {
            console.error('Error fixing meal structure:', error);
        }
        // Fix ingredient structure
        try {
            const ingredientStructureFix = await ingredientService.fixIngredientStructure();
            console.log(`Fixed ingredient structure: ${ingredientStructureFix.success} successful, ${ingredientStructureFix.failed} failed`);
        }
        catch (error) {
            console.error('Error fixing ingredient structure:', error);
        }
        // Enhance meals
        try {
            results.meals = await mealService.updateMealsWithGeminiEnhancement();
            console.log(`Enhanced ${results.meals} meals`);
        }
        catch (error) {
            console.error('Error enhancing meals:', error);
        }
        // Enhance ingredients
        try {
            results.ingredients = await ingredientService.updateIngredientsWithGeminiEnhancement();
            console.log(`Enhanced ${results.ingredients} ingredients`);
        }
        catch (error) {
            console.error('Error enhancing ingredients:', error);
        }
        // Enhanced ingredient enhancement with improved features
        try {
            const enhancedIngredientEnhancements = await ingredientService.updateIngredientsWithEnhancedGeminiEnhancement();
            console.log(`Enhanced ${enhancedIngredientEnhancements} ingredients with improved features`);
        }
        catch (error) {
            console.error('Error with enhanced ingredient enhancement:', error);
        }
        // Enhance cooking methods
        try {
            results.cookingMethods = await collectionsService.enhanceCookingMethods();
            console.log(`Enhanced ${results.cookingMethods} cooking methods`);
        }
        catch (error) {
            console.error('Error enhancing cooking methods:', error);
        }
        // Enhance diet categories
        try {
            results.dietCategories = await collectionsService.enhanceDietCategories();
            console.log(`Enhanced ${results.dietCategories} diet categories`);
        }
        catch (error) {
            console.error('Error enhancing diet categories:', error);
        }
        // Enhance programs
        try {
            results.programs = await collectionsService.updateProgramsWithPortionDetails();
            console.log(`Enhanced ${results.programs} programs`);
        }
        catch (error) {
            console.error('Error enhancing programs:', error);
        }
        // Create routines for programs
        try {
            results.routines = await collectionsService.createProgramRoutines();
            console.log(`Created routines for ${results.routines} programs`);
        }
        catch (error) {
            console.error('Error creating routines:', error);
        }
        res.json({ success: true, results });
    }
    catch (error) {
        console.error('Error in comprehensive enhancement:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
// Schedule cron jobs with new workflow system
const scheduleJobs = () => {
    // Initialize the weekly workflow scheduler
    try {
        const { WorkflowOrchestrator } = require('./services/workflowOrchestrator');
        const orchestrator = new WorkflowOrchestrator();
        // Start the weekly scheduler (runs every Sunday at 2 AM)
        orchestrator.startWeeklyScheduler();
        console.log('✅ Weekly workflow scheduler started successfully');
        console.log('📅 Schedule: Every Sunday at 2 AM');
        console.log('🎯 Scope: Weekly workflow execution with scope "last7days"');
    }
    catch (error) {
        console.error('❌ Failed to start weekly workflow scheduler:', error);
        console.log('⚠️ Falling back to manual workflow execution only');
    }
};
// Add scheduler control endpoints
app.post('/api/scheduler/start', async (req, res) => {
    try {
        console.log('Manual scheduler start requested');
        const { WorkflowOrchestrator } = await Promise.resolve().then(() => __importStar(require('./services/workflowOrchestrator')));
        const orchestrator = new WorkflowOrchestrator();
        orchestrator.startWeeklyScheduler();
        res.json({
            success: true,
            message: 'Weekly scheduler started successfully',
            schedule: 'Every Sunday at 2 AM',
            scope: 'last7days'
        });
    }
    catch (error) {
        console.error('Error starting scheduler:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
app.post('/api/scheduler/stop', async (req, res) => {
    try {
        console.log('Manual scheduler stop requested');
        const { WorkflowOrchestrator } = await Promise.resolve().then(() => __importStar(require('./services/workflowOrchestrator')));
        const orchestrator = new WorkflowOrchestrator();
        orchestrator.stopWeeklyScheduler();
        res.json({
            success: true,
            message: 'Weekly scheduler stopped successfully'
        });
    }
    catch (error) {
        console.error('Error stopping scheduler:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
app.get('/api/scheduler/status', async (req, res) => {
    try {
        console.log('Scheduler status requested');
        const { WorkflowOrchestrator } = await Promise.resolve().then(() => __importStar(require('./services/workflowOrchestrator')));
        const orchestrator = new WorkflowOrchestrator();
        const status = orchestrator.getSchedulerStatus();
        res.json({
            success: true,
            scheduler: status,
            message: status.isRunning
                ? `Scheduler is running. Next run: ${status.nextRun}`
                : 'Scheduler is not running'
        });
    }
    catch (error) {
        console.error('Error getting scheduler status:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
app.post('/api/scheduler/run-now', async (req, res) => {
    try {
        console.log('Manual weekly workflow execution requested');
        const { WorkflowOrchestrator } = await Promise.resolve().then(() => __importStar(require('./services/workflowOrchestrator')));
        const orchestrator = new WorkflowOrchestrator();
        // Execute the weekly workflow immediately with last7days scope
        const result = await orchestrator.executeCompleteWorkflow('last7days');
        res.json({
            success: true,
            message: 'Weekly workflow executed successfully',
            scope: 'last7days',
            result: result.summary,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('Error executing weekly workflow:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    scheduleJobs();
});
