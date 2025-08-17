"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataAnalysisService = void 0;
const firestore_1 = require("firebase/firestore");
const firebase_1 = require("../config/firebase");
const fs_1 = require("fs");
const path_1 = require("path");
class DataAnalysisService {
    constructor() {
        this.mealsCollectionRef = (0, firestore_1.collection)(firebase_1.db, 'meals');
        this.ingredientsCollectionRef = (0, firestore_1.collection)(firebase_1.db, 'ingredients');
        this.dataDir = (0, path_1.join)(process.cwd(), 'data');
        this.analysisFile = (0, path_1.join)(this.dataDir, 'analysis-results.json');
        this.workflowFile = (0, path_1.join)(this.dataDir, 'workflow-state.json');
        this.ensureDataDirectory();
    }
    /**
     * Ensures the data directory exists
     */
    ensureDataDirectory() {
        if (!(0, fs_1.existsSync)(this.dataDir)) {
            const fs = require('fs');
            fs.mkdirSync(this.dataDir, { recursive: true });
        }
    }
    /**
     * Saves analysis results to JSON file
     */
    saveAnalysisResults(results) {
        try {
            (0, fs_1.writeFileSync)(this.analysisFile, JSON.stringify(results, null, 2));
            console.log(`Analysis results saved to ${this.analysisFile}`);
        }
        catch (error) {
            console.error('Error saving analysis results:', error);
        }
    }
    /**
     * Loads analysis results from JSON file
     */
    loadAnalysisResults() {
        try {
            if ((0, fs_1.existsSync)(this.analysisFile)) {
                const data = (0, fs_1.readFileSync)(this.analysisFile, 'utf8');
                return JSON.parse(data);
            }
        }
        catch (error) {
            console.error('Error loading analysis results:', error);
        }
        return null;
    }
    /**
     * Saves workflow state to JSON file
     */
    saveWorkflowState(state) {
        try {
            (0, fs_1.writeFileSync)(this.workflowFile, JSON.stringify(state, null, 2));
            console.log(`Workflow state saved to ${this.workflowFile}`);
        }
        catch (error) {
            console.error('Error saving workflow state:', error);
        }
    }
    /**
     * Loads workflow state from JSON file
     */
    loadWorkflowState() {
        try {
            if ((0, fs_1.existsSync)(this.workflowFile)) {
                const data = (0, fs_1.readFileSync)(this.workflowFile, 'utf8');
                return JSON.parse(data);
            }
        }
        catch (error) {
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
    createScopeQuery(scope) {
        const now = new Date();
        let startDate;
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
        return (0, firestore_1.where)('createdAt', '>=', firestore_1.Timestamp.fromDate(startDate));
    }
    /**
     * Analyzes meals data based on scope
     */
    async analyzeMeals(scope = { type: 'all' }) {
        try {
            console.log(`Analyzing meals with scope: ${scope.type}`);
            const scopeQuery = this.createScopeQuery(scope);
            const mealsQuery = scopeQuery
                ? (0, firestore_1.query)(this.mealsCollectionRef, scopeQuery)
                : this.mealsCollectionRef;
            const mealsSnapshot = await (0, firestore_1.getDocs)(mealsQuery);
            const meals = [];
            const mealsWithoutTitles = [];
            const needsTransformation = [];
            const needsEnhancement = [];
            mealsSnapshot.forEach((doc) => {
                const data = doc.data();
                const meal = { ...data, id: doc.id };
                if (!meal.title || meal.title.trim().length === 0) {
                    mealsWithoutTitles.push(meal);
                    console.log(`Meal with ID ${doc.id} has no title:`, meal);
                }
                else {
                    meals.push(meal);
                }
                // Check if meal needs transformation (duplicate)
                if (meal.title && this.isDuplicateCandidate(meal)) {
                    needsTransformation.push(doc.id);
                }
                // Check if meal needs enhancement
                if (this.mealNeedsEnhancement(meal)) {
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
        }
        catch (error) {
            console.error('Error analyzing meals:', error);
            throw error;
        }
    }
    /**
     * Analyzes ingredients data based on scope
     */
    async analyzeIngredients(scope = { type: 'all' }) {
        try {
            console.log(`Analyzing ingredients with scope: ${scope.type}`);
            const scopeQuery = this.createScopeQuery(scope);
            const ingredientsQuery = scopeQuery
                ? (0, firestore_1.query)(this.ingredientsCollectionRef, scopeQuery)
                : this.ingredientsCollectionRef;
            const ingredientsSnapshot = await (0, firestore_1.getDocs)(ingredientsQuery);
            const ingredients = [];
            const ingredientsWithoutTitles = [];
            const needsTypeUpdate = [];
            const needsEnhancement = [];
            ingredientsSnapshot.forEach((doc) => {
                const data = doc.data();
                const ingredient = { ...data, id: doc.id };
                if (!ingredient.title || ingredient.title.trim().length === 0) {
                    ingredientsWithoutTitles.push(ingredient);
                    console.log(`Ingredient with ID ${doc.id} has no title:`, ingredient);
                }
                else {
                    ingredients.push(ingredient);
                }
                // Check if ingredient needs type update
                if (ingredient.title && this.needsTypeUpdate(ingredient)) {
                    needsTypeUpdate.push(doc.id);
                }
                // Check if ingredient needs enhancement
                if (this.ingredientNeedsEnhancement(ingredient)) {
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
        }
        catch (error) {
            console.error('Error analyzing ingredients:', error);
            throw error;
        }
    }
    /**
     * Performs comprehensive data analysis
     */
    async performComprehensiveAnalysis(scope = { type: 'all' }) {
        try {
            console.log('Starting comprehensive data analysis...');
            const [mealsAnalysis, ingredientsAnalysis] = await Promise.all([
                this.analyzeMeals(scope),
                this.analyzeIngredients(scope)
            ]);
            const result = {
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
        }
        catch (error) {
            console.error('Error performing comprehensive analysis:', error);
            throw error;
        }
    }
    /**
     * Checks if a meal is a duplicate candidate
     */
    isDuplicateCandidate(meal) {
        // This is a simplified check - actual duplicate detection should be done by MealService
        return false;
    }
    /**
     * Checks if a meal needs enhancement
     */
    mealNeedsEnhancement(meal) {
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
    needsTypeUpdate(ingredient) {
        return !ingredient.type ||
            !['protein', 'grain', 'vegetable', 'fruit', 'sweetener', 'condiment', 'pastry', 'dairy', 'oil', 'herb', 'spice', 'liquid'].includes(ingredient.type);
    }
    /**
     * Checks if an ingredient needs enhancement
     */
    ingredientNeedsEnhancement(ingredient) {
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
    generateRecommendations(mealsAnalysis, ingredientsAnalysis) {
        const recommendations = [];
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
    getWorkflowState() {
        return this.loadWorkflowState();
    }
    /**
     * Gets the last analysis results
     */
    getLastAnalysis() {
        return this.loadAnalysisResults();
    }
    /**
     * Updates workflow state when items are processed
     */
    updateWorkflowProgress(type, action, ids) {
        const state = this.loadWorkflowState();
        if (action === 'start') {
            state.processingQueue[type] = [...state.processingQueue[type], ...ids];
            state.pendingTransformations[type] = state.pendingTransformations[type].filter(id => !ids.includes(id));
        }
        else if (action === 'complete') {
            state.completed[type] = [...state.completed[type], ...ids];
            state.processingQueue[type] = state.processingQueue[type].filter(id => !ids.includes(id));
        }
        this.saveWorkflowState(state);
    }
}
exports.DataAnalysisService = DataAnalysisService;
