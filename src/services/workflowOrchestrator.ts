import { MealService } from './mealService';
import { IngredientService } from './ingredientService';
import { DataAnalysisService } from './dataAnalysisService';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

interface WorkflowStep {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: string;
  endTime?: string;
  result?: any;
  error?: string;
}

interface WorkflowExecution {
  id: string;
  timestamp: string;
  scope: 'all' | 'last24hours' | 'last7days' | 'last30days' | 'custom';
  steps: WorkflowStep[];
  summary: {
    totalSteps: number;
    completedSteps: number;
    failedSteps: number;
    totalIssues: number;
    criticalIssues: number;
  };
}

export class WorkflowOrchestrator {
  private mealService: MealService;
  private ingredientService: IngredientService;
  private dataAnalysisService: DataAnalysisService;
  private readonly dataDir = join(process.cwd(), 'data');
  private readonly workflowFile = join(this.dataDir, 'workflow-execution.json');
  private scheduleInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.mealService = new MealService();
    this.ingredientService = new IngredientService();
    this.dataAnalysisService = new DataAnalysisService();
    this.ensureDataDirectory();
  }

  /**
   * Ensures the data directory exists
   */
  private ensureDataDirectory(): void {
    if (!existsSync(this.dataDir)) {
      const fs = require('fs');
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  /**
   * Starts the weekly workflow scheduler (runs every Sunday)
   */
  startWeeklyScheduler(): void {
    if (this.scheduleInterval) {
      console.log('⚠️ Weekly scheduler is already running');
      return;
    }

    console.log('📅 Starting weekly workflow scheduler (Sundays)');
    
    // Calculate time until next Sunday
    const now = new Date();
    const daysUntilSunday = (7 - now.getDay()) % 7;
    const nextSunday = new Date(now);
    nextSunday.setDate(now.getDate() + daysUntilSunday);
    nextSunday.setHours(2, 0, 0, 0); // Run at 2 AM on Sunday

    const timeUntilNextSunday = nextSunday.getTime() - now.getTime();
    
    console.log(`⏰ Next scheduled run: ${nextSunday.toLocaleString()}`);
    
    // Schedule the first run
    setTimeout(() => {
      this.runScheduledWorkflow();
      this.scheduleNextSunday();
    }, timeUntilNextSunday);
  }

  /**
   * Schedules the next Sunday run
   */
  private scheduleNextSunday(): void {
    // Schedule for next Sunday at 2 AM
    const nextSunday = new Date();
    nextSunday.setDate(nextSunday.getDate() + 7);
    nextSunday.setHours(2, 0, 0, 0);
    
    const timeUntilNextSunday = nextSunday.getTime() - Date.now();
    
    this.scheduleInterval = setTimeout(() => {
      this.runScheduledWorkflow();
      this.scheduleNextSunday(); // Schedule the next one
    }, timeUntilNextSunday);
    
    console.log(`⏰ Next scheduled run: ${nextSunday.toLocaleString()}`);
  }

  /**
   * Stops the weekly workflow scheduler
   */
  stopWeeklyScheduler(): void {
    if (this.scheduleInterval) {
      clearTimeout(this.scheduleInterval);
      this.scheduleInterval = null;
      console.log('⏹️ Weekly workflow scheduler stopped');
    } else {
      console.log('⚠️ No scheduler running');
    }
  }

  /**
   * Runs the scheduled workflow
   */
  private async runScheduledWorkflow(): Promise<void> {
    console.log('🕐 Running scheduled weekly workflow...');
    try {
      await this.executeCompleteWorkflow('last7days');
      console.log('✅ Scheduled weekly workflow completed successfully');
    } catch (error) {
      console.error('❌ Scheduled weekly workflow failed:', error);
    }
  }

  /**
   * Gets the current scheduler status
   */
  getSchedulerStatus(): { isRunning: boolean; nextRun?: string } {
    if (!this.scheduleInterval) {
      return { isRunning: false };
    }

    // Calculate next Sunday
    const now = new Date();
    const daysUntilSunday = (7 - now.getDay()) % 7;
    const nextSunday = new Date(now);
    nextSunday.setDate(now.getDate() + daysUntilSunday);
    nextSunday.setHours(2, 0, 0, 0);

    return {
      isRunning: true,
      nextRun: nextSunday.toLocaleString()
    };
  }

  /**
   * Saves workflow execution to JSON file
   */
  private saveWorkflowExecution(execution: WorkflowExecution): void {
    try {
      writeFileSync(this.workflowFile, JSON.stringify(execution, null, 2));
      console.log(`Workflow execution saved to ${this.workflowFile}`);
    } catch (error) {
      console.error('Error saving workflow execution:', error);
    }
  }

  /**
   * Loads workflow execution from JSON file
   */
  private loadWorkflowExecution(): WorkflowExecution | null {
    try {
      if (existsSync(this.workflowFile)) {
        const data = readFileSync(this.workflowFile, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Error loading workflow execution:', error);
    }
    return null;
  }

  /**
   * Executes the complete workflow as described:
   * 1. Check duplicates, save dup info in JSON
   * 2. Check titles, add missing titles to JSON
   * 3. Check transformations, ensure all items have right information
   * 4. Run enhancements for full check
   */
  async executeCompleteWorkflow(scope: 'all' | 'last24hours' | 'last7days' | 'last30days' | 'custom' = 'all'): Promise<WorkflowExecution> {
    const executionId = `workflow-${Date.now()}`;
    const execution: WorkflowExecution = {
      id: executionId,
      timestamp: new Date().toISOString(),
      scope,
      steps: [
        { name: 'data-analysis', status: 'pending' },
        { name: 'duplicate-detection', status: 'pending' },
        { name: 'title-validation', status: 'pending' },
        { name: 'title-addition', status: 'pending' },
        { name: 'transformation-check', status: 'pending' },
        { name: 'meal-structure-fix', status: 'pending' },
        { name: 'enhancement-execution', status: 'pending' },
        { name: 'enhanced-ingredient-enhancement', status: 'pending' },
        { name: 'ingredient-structure-fix', status: 'pending' }
      ],
      summary: {
        totalSteps: 6,
        completedSteps: 0,
        failedSteps: 0,
        totalIssues: 0,
        criticalIssues: 0
      }
    };

    console.log(`🚀 Starting complete workflow execution (ID: ${executionId}, Scope: ${scope})`);
    this.saveWorkflowExecution(execution);

    try {
      // Step 1: Data Analysis
      await this.executeStep(execution, 'data-analysis', async () => {
        console.log('📊 Step 1: Performing comprehensive data analysis...');
        const result = await this.dataAnalysisService.performComprehensiveAnalysis({ type: scope as any });
        console.log(`✅ Data analysis completed. Found ${result.summary.totalIssues} total issues, ${result.summary.criticalIssues} critical issues`);
        return result;
      });

      // Step 2: Duplicate Detection
      await this.executeStep(execution, 'duplicate-detection', async () => {
        console.log('🔍 Step 2: Detecting duplicates...');
        const mealDuplicates = await this.mealService.getDuplicatesSummary();
        const ingredientDuplicates = await this.ingredientService.getDuplicatesSummary();
        
        console.log(`✅ Duplicate detection completed. Found ${mealDuplicates.totalDuplicates} meal duplicates, ${ingredientDuplicates.totalDuplicates} ingredient duplicates`);
        return { mealDuplicates, ingredientDuplicates };
      });

      // Step 3: Title Validation
      await this.executeStep(execution, 'title-validation', async () => {
        console.log('📝 Step 3: Validating titles...');
        const mealTitleCheck = await this.mealService.checkMealsWithoutTitles(scope);
        const ingredientTitleCheck = await this.ingredientService.checkIngredientsWithoutTitles(scope);
        
        console.log(`✅ Title validation completed. Found ${mealTitleCheck.withoutTitles} meals without titles, ${ingredientTitleCheck.withoutTitles} ingredients without titles`);
        return { mealTitleCheck, ingredientTitleCheck };
      });

      // Step 4: Title Addition
      await this.executeStep(execution, 'title-addition', async () => {
        console.log('✏️ Step 4: Adding missing titles...');
        const mealTitleResults = await this.mealService.addTitlesToMeals([], scope);
        const ingredientTitleResults = await this.ingredientService.addTitlesToIngredients([], scope);
        
        console.log(`✅ Title addition completed. Added ${mealTitleResults.success} meal titles, ${ingredientTitleResults.success} ingredient titles`);
        return { mealTitleResults, ingredientTitleResults };
      });

      // Step 5: Transformation Check
      await this.executeStep(execution, 'transformation-check', async () => {
        console.log('🔄 Step 5: Checking transformations...');
        const workflowState = this.dataAnalysisService.getWorkflowState();
        
        console.log(`✅ Transformation check completed. Found ${workflowState.pendingTransformations.meals.length} meals and ${workflowState.pendingTransformations.ingredients.length} ingredients pending transformation`);
        return workflowState;
      });

      // Step 6: Enhancement Execution
      await this.executeStep(execution, 'enhancement-execution', async () => {
        console.log('✨ Step 6: Running enhancements...');
        const mealEnhancements = await this.mealService.updateMealsWithGeminiEnhancement();
        const ingredientEnhancements = await this.ingredientService.updateIngredientsWithGeminiEnhancement();
        
        console.log(`✅ Enhancement execution completed. Enhanced ${mealEnhancements} meals, ${ingredientEnhancements} ingredients`);
        return { mealEnhancements, ingredientEnhancements };
      });

      // Update final summary
      execution.summary.completedSteps = execution.steps.filter(s => s.status === 'completed').length;
      execution.summary.failedSteps = execution.steps.filter(s => s.status === 'failed').length;
      
      const lastAnalysis = this.dataAnalysisService.getLastAnalysis();
      if (lastAnalysis) {
        execution.summary.totalIssues = lastAnalysis.summary.totalIssues;
        execution.summary.criticalIssues = lastAnalysis.summary.criticalIssues;
      }

      console.log(`🎉 Complete workflow execution finished successfully!`);
      console.log(`📈 Summary: ${execution.summary.completedSteps}/${execution.summary.totalSteps} steps completed, ${execution.summary.failedSteps} failed`);
      console.log(`🔧 Issues: ${execution.summary.totalIssues} total, ${execution.summary.criticalIssues} critical`);

    } catch (error) {
      console.error('❌ Workflow execution failed:', error);
      execution.summary.failedSteps = execution.steps.filter(s => s.status === 'failed').length;
    }

    this.saveWorkflowExecution(execution);
    return execution;
  }

  /**
   * Executes a single workflow step
   */
  private async executeStep(execution: WorkflowExecution, stepName: string, stepFunction: () => Promise<any>): Promise<void> {
    const step = execution.steps.find(s => s.name === stepName);
    if (!step) {
      throw new Error(`Step ${stepName} not found`);
    }

    try {
      step.status = 'running';
      step.startTime = new Date().toISOString();
      this.saveWorkflowExecution(execution);

      console.log(`🔄 Executing step: ${stepName}`);
      const result = await stepFunction();
      
      step.status = 'completed';
      step.endTime = new Date().toISOString();
      step.result = result;
      
      console.log(`✅ Step ${stepName} completed successfully`);
      
    } catch (error) {
      step.status = 'failed';
      step.endTime = new Date().toISOString();
      step.error = error instanceof Error ? error.message : 'Unknown error';
      
      console.error(`❌ Step ${stepName} failed:`, error);
      
      // Continue with next steps even if one fails
    }

    this.saveWorkflowExecution(execution);
  }

  /**
   * Gets the current workflow execution status
   */
  getWorkflowStatus(): WorkflowExecution | null {
    return this.loadWorkflowExecution();
  }

  /**
   * Executes a specific step of the workflow
   */
  async executeSpecificStep(stepName: string, scope: 'all' | 'last24hours' | 'last7days' | 'last30days' | 'custom' = 'all'): Promise<any> {
    console.log(`🎯 Executing specific step: ${stepName} (scope: ${scope})`);

    switch (stepName) {
      case 'data-analysis':
        return await this.dataAnalysisService.performComprehensiveAnalysis({ type: scope as any });
      
      case 'duplicate-detection':
        const mealDuplicates = await this.mealService.getDuplicatesSummary();
        const ingredientDuplicates = await this.ingredientService.getDuplicatesSummary();
        return { mealDuplicates, ingredientDuplicates };
      
      case 'title-validation':
        const mealTitleCheck = await this.mealService.checkMealsWithoutTitles(scope);
        const ingredientTitleCheck = await this.ingredientService.checkIngredientsWithoutTitles(scope);
        return { mealTitleCheck, ingredientTitleCheck };
      
      case 'title-addition':
        const mealTitleResults = await this.mealService.addTitlesToMeals([], scope);
        const ingredientTitleResults = await this.ingredientService.addTitlesToIngredients([], scope);
        return { mealTitleResults, ingredientTitleResults };
      
      case 'type-check-and-fix':
        return await this.executeTypeCheckAndFix(scope);
      
      case 'title-and-duplication-fix':
        return await this.executeTitleAndDuplicationFix(scope);
      
      case 'meal-structure-fix':
        const mealStructureFix = await this.mealService.fixMealStructure();
        return { mealStructureFix };
      
      case 'enhancement-execution':
        const mealEnhancements = await this.mealService.updateMealsWithGeminiEnhancement();
        const ingredientEnhancements = await this.ingredientService.updateIngredientsWithGeminiEnhancement();
        return { mealEnhancements, ingredientEnhancements };
      
      case 'enhanced-ingredient-enhancement':
        const enhancedIngredientEnhancements = await this.ingredientService.updateIngredientsWithEnhancedGeminiEnhancement();
        return { enhancedIngredientEnhancements };
      
      case 'ingredient-structure-fix':
        const ingredientStructureFix = await this.ingredientService.fixIngredientStructure();
        return { ingredientStructureFix };
      
      default:
        throw new Error(`Unknown step: ${stepName}`);
    }
  }

  /**
   * Gets workflow recommendations based on current state
   */
  getWorkflowRecommendations(): string[] {
    const lastAnalysis = this.dataAnalysisService.getLastAnalysis();
    const workflowState = this.dataAnalysisService.getWorkflowState();
    const recommendations: string[] = [];

    if (!lastAnalysis) {
      recommendations.push('Run data analysis to identify issues');
      return recommendations;
    }

    if (lastAnalysis.meals.withoutTitles > 0) {
      recommendations.push(`Add titles to ${lastAnalysis.meals.withoutTitles} meals`);
    }

    if (lastAnalysis.ingredients.withoutTitles > 0) {
      recommendations.push(`Add titles to ${lastAnalysis.ingredients.withoutTitles} ingredients`);
    }

    if (workflowState.pendingTransformations.meals.length > 0) {
      recommendations.push(`Transform ${workflowState.pendingTransformations.meals.length} duplicate meals`);
    }

    if (workflowState.pendingTransformations.ingredients.length > 0) {
      recommendations.push(`Update types for ${workflowState.pendingTransformations.ingredients.length} ingredients`);
    }

    if (lastAnalysis.meals.needsEnhancement.length > 0) {
      recommendations.push(`Enhance ${lastAnalysis.meals.needsEnhancement.length} meals with missing details`);
    }

    if (lastAnalysis.ingredients.needsEnhancement.length > 0) {
      recommendations.push(`Enhance ${lastAnalysis.ingredients.needsEnhancement.length} ingredients with missing details`);
    }

    // Always recommend meal structure fix to ensure consistency
    recommendations.push('Fix meal structure to match new format (ingredients with units, cookingMethod values, suggestions structure)');

    if (recommendations.length === 0) {
      recommendations.push('All data appears to be in good condition');
    }

    return recommendations;
  }

  /**
   * Executes type check and fix for ingredients
   * Reads from workflow state and immediately updates ingredient types
   */
  private async executeTypeCheckAndFix(scope: 'all' | 'last24hours' | 'last7days' | 'last30days' | 'custom' = 'last24hours'): Promise<any> {
    console.log('🔧 Executing type check and fix for ingredients...');
    
    const workflowState = this.dataAnalysisService.getWorkflowState();
    const ingredientsNeedingTypeUpdate = workflowState.pendingTransformations.ingredients;
    
    if (ingredientsNeedingTypeUpdate.length === 0) {
      console.log('✅ No ingredients need type updates');
      return { success: true, message: 'No ingredients need type updates', updated: 0 };
    }
    
    console.log(`🔄 Updating types for ${ingredientsNeedingTypeUpdate.length} ingredients (scope: ${scope})...`);
    
    const results = await this.ingredientService.updateMultipleIngredientTypes(ingredientsNeedingTypeUpdate, scope);
    
    console.log(`✅ Type update completed: ${results.success} successful, ${results.failed} failed`);
    
    return {
      success: true,
      message: `Updated types for ${results.success} ingredients`,
      results: results
    };
  }

  /**
   * Executes title and duplication fixes
   * Reads from saved JSON analysis results and fixes titles and duplicates
   */
  private async executeTitleAndDuplicationFix(scope: 'all' | 'last24hours' | 'last7days' | 'last30days' | 'custom' = 'all'): Promise<any> {
    console.log('🔧 Executing title and duplication fixes...');
    
    const lastAnalysis = this.dataAnalysisService.getLastAnalysis();
    if (!lastAnalysis) {
      console.log('❌ No analysis results found. Run data analysis first.');
      return { success: false, message: 'No analysis results found. Run data analysis first.' };
    }
    
    const results: {
      titleFixes: { 
        meals: any; 
        ingredients: any; 
      };
      duplicationFixes: { 
        meals: any; 
        ingredients: any; 
      };
    } = {
      titleFixes: { meals: null, ingredients: null },
      duplicationFixes: { meals: null, ingredients: null }
    };
    
    // Fix missing titles
    if (lastAnalysis.meals.withoutTitles > 0) {
      console.log(`📝 Adding titles to ${lastAnalysis.meals.withoutTitles} meals...`);
      results.titleFixes.meals = await this.mealService.addTitlesToMeals([], scope);
    }
    
    if (lastAnalysis.ingredients.withoutTitles > 0) {
      console.log(`📝 Adding titles to ${lastAnalysis.ingredients.withoutTitles} ingredients...`);
      results.titleFixes.ingredients = await this.ingredientService.addTitlesToIngredients([], 'all');
    }
    
    // Handle duplicates (transform into variations)
    const workflowState = this.dataAnalysisService.getWorkflowState();
    if (workflowState.pendingTransformations.meals.length > 0) {
      console.log(`🔄 Transforming ${workflowState.pendingTransformations.meals.length} duplicate meals...`);
      // Note: This would need to be implemented in mealService
      results.duplicationFixes.meals = { message: 'Duplicate meal transformation not yet implemented' };
    }
    
    if (workflowState.pendingTransformations.ingredients.length > 0) {
      console.log(`🔄 Transforming ${workflowState.pendingTransformations.ingredients.length} duplicate ingredients...`);
      // Note: This would need to be implemented in ingredientService
      results.duplicationFixes.ingredients = { message: 'Duplicate ingredient transformation not yet implemented' };
    }
    
    console.log('✅ Title and duplication fixes completed');
    
    return {
      success: true,
      message: 'Title and duplication fixes completed',
      results: results
    };
  }
}
