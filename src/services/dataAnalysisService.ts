import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Define the shape of data as it exists in Firestore
interface FirestoreMeal {
  id?: string;
  title?: string;
  description?: string;
  type?: 'protein' | 'grain' | 'vegetable' | 'fruit';
  cookingTime?: string;
  cookingMethod?: string;
  ingredients: Record<string, string>;
  instructions?: string[];
  nutritionalInfo?: any;
  categories?: string[];
  serveQty?: number;
  nutrition?: any;
  macros?: {
    protein: string;
    carbs: string;
    fat: string;
  };
  calories?: number;
  suggestions?: {
    improvements: string[];
    alternatives: string[];
    additions: string[];
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface FirestoreIngredient {
  id?: string;
  title?: string;
  type?: 'protein' | 'vegetable' | 'fruit' | 'grain' | 'sweetener' | 'condiment' | 'pastry';
  calories?: number;
  macros?: {
    protein: string;
    carbs: string;
    fat: string;
  };
  categories?: string[];
  features?: {
    fiber: string;
    g_i: string;
    season: string;
    water: string;
    rainbow: string;
  };
  techniques?: string[];
  storageOptions?: {
    countertop: string;
    fridge: string;
    freezer: string;
  };
  isAntiInflammatory?: boolean;
  isSelected?: boolean;
  alt?: string[];
  image?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface AnalysisScope {
  type: 'all' | 'last24hours' | 'last7days' | 'last30days' | 'custom';
  startDate?: Date;
  endDate?: Date;
}

interface DataAnalysisResult {
  timestamp: string;
  scope: AnalysisScope;
  meals: {
    total: number;
    withTitles: number;
    withoutTitles: number;
    duplicates: number;
    needsTransformation: string[];
    needsEnhancement: string[];
  };
  ingredients: {
    total: number;
    withTitles: number;
    withoutTitles: number;
    duplicates: number;
    needsTypeUpdate: string[];
    needsEnhancement: string[];
  };
  summary: {
    totalIssues: number;
    criticalIssues: number;
    recommendations: string[];
  };
}

interface WorkflowState {
  lastAnalysis: DataAnalysisResult | null;
  pendingTransformations: {
    meals: string[];
    ingredients: string[];
  };
  processingQueue: {
    meals: string[];
    ingredients: string[];
  };
  completed: {
    meals: string[];
    ingredients: string[];
  };
}

export class DataAnalysisService {
  private readonly mealsCollectionRef = collection(db, 'meals');
  private readonly ingredientsCollectionRef = collection(db, 'ingredients');
  private readonly dataDir = join(process.cwd(), 'data');
  private readonly analysisFile = join(this.dataDir, 'analysis-results.json');
  private readonly workflowFile = join(this.dataDir, 'workflow-state.json');

  constructor() {
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
   * Saves analysis results to JSON file
   */
  private saveAnalysisResults(results: DataAnalysisResult): void {
    try {
      writeFileSync(this.analysisFile, JSON.stringify(results, null, 2));
      console.log(`Analysis results saved to ${this.analysisFile}`);
    } catch (error) {
      console.error('Error saving analysis results:', error);
    }
  }

  /**
   * Loads analysis results from JSON file
   */
  private loadAnalysisResults(): DataAnalysisResult | null {
    try {
      if (existsSync(this.analysisFile)) {
        const data = readFileSync(this.analysisFile, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Error loading analysis results:', error);
    }
    return null;
  }

  /**
   * Saves workflow state to JSON file
   */
  private saveWorkflowState(state: WorkflowState): void {
    try {
      writeFileSync(this.workflowFile, JSON.stringify(state, null, 2));
      console.log(`Workflow state saved to ${this.workflowFile}`);
    } catch (error) {
      console.error('Error saving workflow state:', error);
    }
  }

  /**
   * Loads workflow state from JSON file
   */
  private loadWorkflowState(): WorkflowState {
    try {
      if (existsSync(this.workflowFile)) {
        const data = readFileSync(this.workflowFile, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Error loading workflow state:', error);
    }
    
    // Return default state
    return {
      lastAnalysis: null,
      pendingTransformations: { meals: [], ingredients: [] },
      processingQueue: { meals: [], ingredients: [] },
      completed: { meals: [], ingredients: [] }
    };
  }

  /**
   * Creates a query based on analysis scope
   */
  private createScopeQuery(scope: AnalysisScope) {
    const now = new Date();
    let startDate: Date;

    switch (scope.type) {
      case 'last24hours':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'last7days':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'last30days':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'custom':
        startDate = scope.startDate || new Date(0);
        break;
      default: // 'all'
        return null;
    }

    return where('createdAt', '>=', Timestamp.fromDate(startDate));
  }

  /**
   * Analyzes meals data based on scope
   */
  async analyzeMeals(scope: AnalysisScope = { type: 'all' }): Promise<{
    total: number;
    withTitles: number;
    withoutTitles: number;
    duplicates: number;
    needsTransformation: string[];
    needsEnhancement: string[];
    mealsWithoutTitles: FirestoreMeal[];
  }> {
    try {
      console.log(`Analyzing meals with scope: ${scope.type}`);
      
      const scopeQuery = this.createScopeQuery(scope);
      const mealsQuery = scopeQuery 
        ? query(this.mealsCollectionRef, scopeQuery)
        : this.mealsCollectionRef;
      
      const mealsSnapshot = await getDocs(mealsQuery);
      const meals: FirestoreMeal[] = [];
      const mealsWithoutTitles: FirestoreMeal[] = [];
      const needsTransformation: string[] = [];
      const needsEnhancement: string[] = [];

      mealsSnapshot.forEach((doc) => {
        const data = doc.data() as FirestoreMeal;
        const meal = { ...data, id: doc.id };

        if (!meal.title || meal.title.trim().length === 0) {
          mealsWithoutTitles.push(meal);
          console.log(`Meal with ID ${doc.id} has no title:`, meal);
        } else {
          meals.push(meal);
        }

        // Check if meal needs transformation (duplicate)
        if (meal.title && this.isDuplicateCandidate(meal)) {
          needsTransformation.push(doc.id);
        }

        // Check if meal needs enhancement
        if (this.needsEnhancement(meal)) {
          needsEnhancement.push(doc.id);
        }
      });

      const withTitles = meals.length;
      const withoutTitles = mealsWithoutTitles.length;
      const total = withTitles + withoutTitles;

      console.log(`Meal Analysis Results:`);
      console.log(`- Total meals: ${total}`);
      console.log(`- With titles: ${withTitles}`);
      console.log(`- Without titles: ${withoutTitles}`);
      console.log(`- Need transformation: ${needsTransformation.length}`);
      console.log(`- Need enhancement: ${needsEnhancement.length}`);

      return {
        total,
        withTitles,
        withoutTitles,
        duplicates: needsTransformation.length,
        needsTransformation,
        needsEnhancement,
        mealsWithoutTitles
      };
    } catch (error) {
      console.error('Error analyzing meals:', error);
      throw error;
    }
  }

  /**
   * Analyzes ingredients data based on scope
   */
  async analyzeIngredients(scope: AnalysisScope = { type: 'all' }): Promise<{
    total: number;
    withTitles: number;
    withoutTitles: number;
    duplicates: number;
    needsTypeUpdate: string[];
    needsEnhancement: string[];
    ingredientsWithoutTitles: FirestoreIngredient[];
  }> {
    try {
      console.log(`Analyzing ingredients with scope: ${scope.type}`);
      
      const scopeQuery = this.createScopeQuery(scope);
      const ingredientsQuery = scopeQuery 
        ? query(this.ingredientsCollectionRef, scopeQuery)
        : this.ingredientsCollectionRef;
      
      const ingredientsSnapshot = await getDocs(ingredientsQuery);
      const ingredients: FirestoreIngredient[] = [];
      const ingredientsWithoutTitles: FirestoreIngredient[] = [];
      const needsTypeUpdate: string[] = [];
      const needsEnhancement: string[] = [];

      ingredientsSnapshot.forEach((doc) => {
        const data = doc.data() as FirestoreIngredient;
        const ingredient = { ...data, id: doc.id };

        if (!ingredient.title || ingredient.title.trim().length === 0) {
          ingredientsWithoutTitles.push(ingredient);
          console.log(`Ingredient with ID ${doc.id} has no title:`, ingredient);
        } else {
          ingredients.push(ingredient);
        }

        // Check if ingredient needs type update
        if (ingredient.title && this.needsTypeUpdate(ingredient)) {
          needsTypeUpdate.push(doc.id);
        }

        // Check if ingredient needs enhancement
        if (this.needsEnhancement(ingredient)) {
          needsEnhancement.push(doc.id);
        }
      });

      const withTitles = ingredients.length;
      const withoutTitles = ingredientsWithoutTitles.length;
      const total = withTitles + withoutTitles;

      console.log(`Ingredient Analysis Results:`);
      console.log(`- Total ingredients: ${total}`);
      console.log(`- With titles: ${withTitles}`);
      console.log(`- Without titles: ${withoutTitles}`);
      console.log(`- Need type update: ${needsTypeUpdate.length}`);
      console.log(`- Need enhancement: ${needsEnhancement.length}`);

      return {
        total,
        withTitles,
        withoutTitles,
        duplicates: 0, // Will be calculated by duplicate detection
        needsTypeUpdate,
        needsEnhancement,
        ingredientsWithoutTitles
      };
    } catch (error) {
      console.error('Error analyzing ingredients:', error);
      throw error;
    }
  }

  /**
   * Performs comprehensive data analysis
   */
  async performComprehensiveAnalysis(scope: AnalysisScope = { type: 'all' }): Promise<DataAnalysisResult> {
    try {
      console.log('Starting comprehensive data analysis...');
      
      const [mealsAnalysis, ingredientsAnalysis] = await Promise.all([
        this.analyzeMeals(scope),
        this.analyzeIngredients(scope)
      ]);

      const result: DataAnalysisResult = {
        timestamp: new Date().toISOString(),
        scope,
        meals: {
          total: mealsAnalysis.total,
          withTitles: mealsAnalysis.withTitles,
          withoutTitles: mealsAnalysis.withoutTitles,
          duplicates: mealsAnalysis.duplicates,
          needsTransformation: mealsAnalysis.needsTransformation,
          needsEnhancement: mealsAnalysis.needsEnhancement
        },
        ingredients: {
          total: ingredientsAnalysis.total,
          withTitles: ingredientsAnalysis.withTitles,
          withoutTitles: ingredientsAnalysis.withoutTitles,
          duplicates: ingredientsAnalysis.duplicates,
          needsTypeUpdate: ingredientsAnalysis.needsTypeUpdate,
          needsEnhancement: ingredientsAnalysis.needsEnhancement
        },
        summary: {
          totalIssues: mealsAnalysis.withoutTitles + ingredientsAnalysis.withoutTitles + 
                      mealsAnalysis.needsTransformation.length + ingredientsAnalysis.needsTypeUpdate.length,
          criticalIssues: mealsAnalysis.withoutTitles + ingredientsAnalysis.withoutTitles,
          recommendations: this.generateRecommendations(mealsAnalysis, ingredientsAnalysis)
        }
      };

      // Save results
      this.saveAnalysisResults(result);

      // Update workflow state
      const workflowState = this.loadWorkflowState();
      workflowState.lastAnalysis = result;
      workflowState.pendingTransformations = {
        meals: mealsAnalysis.needsTransformation,
        ingredients: ingredientsAnalysis.needsTypeUpdate
      };
      this.saveWorkflowState(workflowState);

      console.log('Comprehensive analysis completed and saved.');
      return result;
    } catch (error) {
      console.error('Error performing comprehensive analysis:', error);
      throw error;
    }
  }

  /**
   * Checks if a meal is a duplicate candidate
   */
  private isDuplicateCandidate(meal: FirestoreMeal): boolean {
    // This is a simplified check - actual duplicate detection should be done by MealService
    return false;
  }

  /**
   * Checks if a meal needs enhancement
   */
  private needsEnhancement(meal: FirestoreMeal): boolean {
    return !meal.description ||
           !meal.type ||
           !meal.cookingTime ||
           !meal.cookingMethod ||
           !meal.instructions ||
           meal.instructions.length === 0 ||
           !meal.categories ||
           meal.categories.length === 0 ||
           !meal.serveQty ||
           (!meal.nutritionalInfo && !meal.nutrition) ||
           Object.keys(meal.ingredients || {}).length === 0;
  }

  /**
   * Checks if an ingredient needs type update
   */
  private needsTypeUpdate(ingredient: FirestoreIngredient): boolean {
    return !ingredient.type || 
           !['protein', 'grain', 'vegetable', 'fruit'].includes(ingredient.type);
  }

  /**
   * Checks if an ingredient needs enhancement
   */
  private needsEnhancement(ingredient: FirestoreIngredient): boolean {
    return !ingredient.calories ||
           !ingredient.macros ||
           !ingredient.categories ||
           ingredient.categories.length === 0 ||
           !ingredient.features ||
           !ingredient.techniques ||
           ingredient.techniques.length === 0 ||
           !ingredient.storageOptions;
  }

  /**
   * Generates recommendations based on analysis
   */
  private generateRecommendations(mealsAnalysis: any, ingredientsAnalysis: any): string[] {
    const recommendations: string[] = [];

    if (mealsAnalysis.withoutTitles > 0) {
      recommendations.push(`Add titles to ${mealsAnalysis.withoutTitles} meals`);
    }

    if (ingredientsAnalysis.withoutTitles > 0) {
      recommendations.push(`Add titles to ${ingredientsAnalysis.withoutTitles} ingredients`);
    }

    if (mealsAnalysis.needsTransformation.length > 0) {
      recommendations.push(`Transform ${mealsAnalysis.needsTransformation.length} duplicate meals`);
    }

    if (ingredientsAnalysis.needsTypeUpdate.length > 0) {
      recommendations.push(`Update types for ${ingredientsAnalysis.needsTypeUpdate.length} ingredients`);
    }

    if (mealsAnalysis.needsEnhancement.length > 0) {
      recommendations.push(`Enhance ${mealsAnalysis.needsEnhancement.length} meals with missing details`);
    }

    if (ingredientsAnalysis.needsEnhancement.length > 0) {
      recommendations.push(`Enhance ${ingredientsAnalysis.needsEnhancement.length} ingredients with missing details`);
    }

    return recommendations;
  }

  /**
   * Gets the current workflow state
   */
  getWorkflowState(): WorkflowState {
    return this.loadWorkflowState();
  }

  /**
   * Gets the last analysis results
   */
  getLastAnalysis(): DataAnalysisResult | null {
    return this.loadAnalysisResults();
  }

  /**
   * Updates workflow state when items are processed
   */
  updateWorkflowProgress(type: 'meals' | 'ingredients', action: 'start' | 'complete', ids: string[]): void {
    const state = this.loadWorkflowState();
    
    if (action === 'start') {
      state.processingQueue[type] = [...state.processingQueue[type], ...ids];
      state.pendingTransformations[type] = state.pendingTransformations[type].filter(id => !ids.includes(id));
    } else if (action === 'complete') {
      state.completed[type] = [...state.completed[type], ...ids];
      state.processingQueue[type] = state.processingQueue[type].filter(id => !ids.includes(id));
    }
    
    this.saveWorkflowState(state);
  }
}
