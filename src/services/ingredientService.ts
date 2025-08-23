import { collection, getDocs, updateDoc, doc, Timestamp, addDoc, query, where, or } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Ingredient } from '../types/ingredient';
import { GeminiService } from './geminiService';

// Define the shape of data as it exists in Firestore
interface FirestoreIngredient {
  id?: string;
  title?: string;
  type?: 'protein' | 'grain' | 'vegetable' | 'fruit' | 'sweetener' | 'condiment' | 'pastry' | 'dairy' | 'oil' | 'herb' | 'spice' | 'liquid';
  mediaPaths: string[];
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
    season: 'spring' | 'summer' | 'autumn' | 'winter' | 'year-round' | 'fall/winter' | 'spring/summer';
    water: string;
    rainbow: 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'white' | 'brown' | 'pink' | 'black';
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

interface DuplicateIngredientGroup {
  original: FirestoreIngredient;
  duplicates: FirestoreIngredient[];
}

export class IngredientService {
  private readonly collectionRef = collection(db, 'ingredients');
  private geminiService: GeminiService;

  constructor() {
    this.geminiService = new GeminiService();
  }

  /**
   * Detects and transforms duplicate ingredients into unique variations
   * @returns Promise<number> Number of duplicates transformed
   */
  async transformDuplicatesIntoVariations(): Promise<number> {
    try {
      console.log('Starting ingredient duplicate detection and transformation...');
      
      const duplicateGroups = await this.findDuplicateIngredients();
      console.log(`Found ${duplicateGroups.length} groups of duplicate ingredients`);
      
      if (duplicateGroups.length === 0) {
        return 0;
      }

      // Get all existing titles to avoid creating new duplicates
      const allIngredients = await getDocs(this.collectionRef);
      const existingTitles = Array.from(allIngredients.docs.map(doc => doc.data().title));
      
      let transformedCount = 0;

      for (const group of duplicateGroups) {
        console.log(`Processing duplicates for: "${group.original.title}"`);
        console.log(`Found ${group.duplicates.length} duplicates`);

        // Transform each duplicate (keep the original)
        for (const duplicate of group.duplicates) {
          try {
            console.log(`Transforming duplicate ingredient: ${duplicate.id}`);
            
            // Create variation using Gemini
            const variation = await this.geminiService.createIngredientVariation(
              {
                title: duplicate.title,
                type: duplicate.type,
                calories: duplicate.calories,
                macros: duplicate.macros,
                categories: duplicate.categories,
                features: duplicate.features,
                storageOptions: duplicate.storageOptions
              },
              existingTitles
            );

            // Update the duplicate with the variation
            const updates: Partial<FirestoreIngredient> = {
              title: variation.title,
              type: variation.type,
              calories: variation.calories,
              macros: variation.macros || duplicate.macros,
              categories: variation.categories || duplicate.categories,
              features: variation.features || duplicate.features,
              techniques: variation.techniques || duplicate.techniques,
              storageOptions: variation.storageOptions || duplicate.storageOptions,
              isAntiInflammatory: variation.isAntiInflammatory ?? duplicate.isAntiInflammatory,
              alt: variation.alt || duplicate.alt,
              updatedAt: Timestamp.now()
            };

            if (duplicate.id) {
              await updateDoc(doc(this.collectionRef, duplicate.id), updates);
              console.log(`Successfully transformed "${duplicate.title}" to "${variation.title}"`);
              
              // Add the new title to existing titles to avoid future duplicates
              existingTitles.push(variation.title);
              transformedCount++;
            }

            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 2000));

          } catch (error) {
            console.error(`Error transforming duplicate ingredient ${duplicate.id}:`, error);
            // Continue with other duplicates even if one fails
          }
        }
      }

      console.log(`Ingredient transformation complete. ${transformedCount} duplicates transformed.`);
      return transformedCount;
    } catch (error) {
      console.error('Error transforming ingredient duplicates:', error);
      throw error;
    }
  }

  /**
   * Finds duplicate ingredients based on title similarity
   * @returns Promise<DuplicateIngredientGroup[]>
   */
  async findDuplicateIngredients(): Promise<DuplicateIngredientGroup[]> {
    try {
      console.log('Scanning for duplicate ingredients...');
      const allIngredients = await getDocs(this.collectionRef);
      const ingredients: FirestoreIngredient[] = [];

      allIngredients.forEach((doc) => {
        const data = doc.data() as FirestoreIngredient;
        ingredients.push({
          ...data,
          id: doc.id
        });
      });

      // Filter out ingredients without titles
      const ingredientsWithTitles = ingredients.filter(ingredient => ingredient.title && ingredient.title.trim().length > 0);
      console.log(`Analyzing ${ingredientsWithTitles.length} ingredients with titles for duplicates`);

      const duplicateGroups: DuplicateIngredientGroup[] = [];
      const processedIds = new Set<string>();

      for (let i = 0; i < ingredientsWithTitles.length; i++) {
        const currentIngredient = ingredientsWithTitles[i];
        
        if (processedIds.has(currentIngredient.id!)) {
          continue;
        }

        const duplicates: FirestoreIngredient[] = [];

        // Find ingredients with similar titles
        for (let j = i + 1; j < ingredientsWithTitles.length; j++) {
          const compareIngredient = ingredientsWithTitles[j];
          
          if (processedIds.has(compareIngredient.id!)) {
            continue;
          }

          if (currentIngredient.title && compareIngredient.title && this.areIngredientTitlesSimilar(currentIngredient.title, compareIngredient.title)) {
            duplicates.push(compareIngredient);
            processedIds.add(compareIngredient.id!);
          }
        }

        // If we found duplicates, create a group
        if (duplicates.length > 0) {
          duplicateGroups.push({
            original: currentIngredient,
            duplicates: duplicates
          });
          processedIds.add(currentIngredient.id!);
          
          console.log(`Found duplicate group for "${currentIngredient.title}":`, 
            duplicates.map(d => d.title));
        }
      }

      return duplicateGroups;
    } catch (error) {
      console.error('Error finding duplicate ingredients:', error);
      throw error;
    }
  }

  /**
   * Updates ingredients with comprehensive details using Gemini AI
   * @returns Promise<number> Number of ingredients updated
   */
  async updateIngredientsWithGeminiEnhancement(): Promise<number> {
    try {
      const ingredientsToUpdate = await this.getIngredientsNeedingEnhancement();
      let updatedCount = 0;

      for (const ingredient of ingredientsToUpdate) {
        try {
          console.log(`Enhancing ingredient: ${ingredient.title}`);
          
          // Use Gemini to enhance ingredient details
          const enhancedData = await this.geminiService.enhanceIngredientDetails({
            title: ingredient.title,
            type: ingredient.type,
            calories: ingredient.calories,
            macros: ingredient.macros,
            categories: ingredient.categories,
            features: ingredient.features,
            techniques: ingredient.techniques,
            storageOptions: ingredient.storageOptions
          });

          const updates: Partial<FirestoreIngredient> = {
            updatedAt: Timestamp.now()
          };

          // Update fields with enhanced data
          if (enhancedData.title && !ingredient.title) {
            updates.title = enhancedData.title;
          }
          
          if (enhancedData.type && !ingredient.type) {
            updates.type = enhancedData.type;
          }
          
          if (enhancedData.calories && !ingredient.calories) {
            updates.calories = enhancedData.calories;
          }
          
          if (enhancedData.macros && (!ingredient.macros || Object.keys(ingredient.macros).length === 0)) {
            updates.macros = enhancedData.macros;
          }
          
          if (enhancedData.categories && (!ingredient.categories || ingredient.categories.length === 0)) {
            updates.categories = enhancedData.categories;
          }
          
          if (enhancedData.features && (!ingredient.features || Object.keys(ingredient.features).length === 0)) {
            updates.features = enhancedData.features;
          }
          
          if (enhancedData.techniques && (!ingredient.techniques || ingredient.techniques.length === 0)) {
            updates.techniques = enhancedData.techniques;
          }
          
          if (enhancedData.storageOptions && (!ingredient.storageOptions || Object.keys(ingredient.storageOptions).length === 0)) {
            updates.storageOptions = enhancedData.storageOptions;
          }
          
          if (enhancedData.isAntiInflammatory !== undefined && ingredient.isAntiInflammatory === undefined) {
            updates.isAntiInflammatory = enhancedData.isAntiInflammatory;
          }
          
          if (enhancedData.alt && (!ingredient.alt || ingredient.alt.length === 0)) {
            updates.alt = enhancedData.alt;
          }
          
          if (enhancedData.image && !ingredient.image) {
            updates.image = enhancedData.image;
          }

          // Update the ingredient if we have new information
          if (Object.keys(updates).length > 1 && ingredient.id) { // More than just updatedAt
            await updateDoc(doc(this.collectionRef, ingredient.id), updates);
            updatedCount++;
            console.log(`Successfully updated ingredient ${ingredient.id} with Gemini enhancements`);
          }
          
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (error) {
          console.error(`Error enhancing ingredient ${ingredient.id}:`, error);
          // Continue with other ingredients even if one fails
        }
      }

      return updatedCount;
    } catch (error) {
      console.error('Error updating ingredients with Gemini enhancement:', error);
      throw error;
    }
  }

  /**
   * Enhanced ingredient enhancement with improved features mapping
   * @returns Promise<number> Number of ingredients enhanced
   */
  async updateIngredientsWithEnhancedGeminiEnhancement(): Promise<number> {
    try {
      const ingredientsToUpdate = await this.getIngredientsNeedingEnhancement();
      let updatedCount = 0;

      for (const ingredient of ingredientsToUpdate) {
        try {
          console.log(`🔧 Enhanced enhancement for ingredient: ${ingredient.title}`);
          
          // Use Gemini to enhance ingredient details with improved features
          const enhancedData = await this.geminiService.enhanceIngredientDetails({
            title: ingredient.title,
            type: ingredient.type,
            calories: ingredient.calories,
            macros: ingredient.macros,
            categories: ingredient.categories,
            features: ingredient.features,
            techniques: ingredient.techniques,
            storageOptions: ingredient.storageOptions
          });

          const updates: Partial<FirestoreIngredient> = {
            updatedAt: Timestamp.now()
          };

          // Enhanced features mapping with validation
          if (enhancedData.features) {
            const validatedFeatures = this.validateAndCorrectIngredientFeatures(enhancedData.features);
            updates.features = validatedFeatures;
            console.log(`✅ Enhanced features for ${ingredient.title}:`, validatedFeatures);
          }

          // Update other fields with enhanced data
          if (enhancedData.title && !ingredient.title) {
            updates.title = enhancedData.title;
          }
          
          if (enhancedData.type && !ingredient.type) {
            updates.type = enhancedData.type;
          }
          
          if (enhancedData.calories && !ingredient.calories) {
            updates.calories = enhancedData.calories;
          }
          
          if (enhancedData.macros && (!ingredient.macros || Object.keys(ingredient.macros).length === 0)) {
            updates.macros = enhancedData.macros;
          }
          
          if (enhancedData.categories && (!ingredient.categories || ingredient.categories.length === 0)) {
            updates.categories = enhancedData.categories;
          }
          
          if (enhancedData.techniques && (!ingredient.techniques || ingredient.techniques.length === 0)) {
            updates.techniques = enhancedData.techniques;
          }
          
          if (enhancedData.storageOptions && (!ingredient.storageOptions || Object.keys(ingredient.storageOptions).length === 0)) {
            updates.storageOptions = enhancedData.storageOptions;
          }
          
          if (enhancedData.isAntiInflammatory !== undefined && ingredient.isAntiInflammatory === undefined) {
            updates.isAntiInflammatory = enhancedData.isAntiInflammatory;
          }
          
          if (enhancedData.alt && (!ingredient.alt || ingredient.alt.length === 0)) {
            updates.alt = enhancedData.alt;
          }
          
          if (enhancedData.image && !ingredient.image) {
            updates.image = enhancedData.image;
          }

          // Update the ingredient if we have new information
          if (Object.keys(updates).length > 1 && ingredient.id) { // More than just updatedAt
            await updateDoc(doc(this.collectionRef, ingredient.id), updates);
            updatedCount++;
            console.log(`✅ Successfully enhanced ingredient ${ingredient.id} with improved features`);
          }
          
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (error) {
          console.error(`❌ Error enhancing ingredient ${ingredient.id}:`, error);
          // Continue with other ingredients even if one fails
        }
      }

      return updatedCount;
    } catch (error) {
      console.error('Error updating ingredients with enhanced Gemini enhancement:', error);
      throw error;
    }
  }

  /**
   * Fixes existing ingredients that don't match the new structure
   * @returns Promise<{success: number, failed: number, results: Array<{id: string, oldStructure: any, newStructure: any, success: boolean, error?: string}>}>
   */
  async fixIngredientStructure(): Promise<{
    success: number;
    failed: number;
    results: Array<{
      id: string;
      oldStructure: any;
      newStructure: any;
      success: boolean;
      error?: string;
    }>;
  }> {
    try {
      console.log('🔧 Starting ingredient structure fix process...');
      
      const allIngredients = await getDocs(this.collectionRef);
      console.log(`Found ${allIngredients.size} total ingredients to check`);
      
      const results: Array<{
        id: string;
        oldStructure: any;
        newStructure: any;
        success: boolean;
        error?: string;
      }> = [];
      
      let successCount = 0;
      let failedCount = 0;

      for (const docSnapshot of allIngredients.docs) {
        const ingredientData = docSnapshot.data() as FirestoreIngredient;
        const ingredientId = docSnapshot.id;
        
        try {
          console.log(`Checking ingredient structure for: ${ingredientData.title || ingredientId}`);
          
          const oldStructure = { ...ingredientData };
          const updates: Partial<FirestoreIngredient> = {};
          let hasChanges = false;

          // Fix features structure if it's missing or incorrect
          if (!ingredientData.features || 
              !ingredientData.features.fiber || 
              !ingredientData.features.g_i || 
              !ingredientData.features.season || 
              !ingredientData.features.water || 
              !ingredientData.features.rainbow) {
            
            const fixedFeatures = this.validateAndCorrectIngredientFeatures(ingredientData.features || {});
            updates.features = fixedFeatures;
            hasChanges = true;
            console.log(`Fixed features structure for ingredient: ${ingredientData.title || ingredientId}`);
          } else {
            // Validate existing features and fix if needed
            const validatedFeatures = this.validateAndCorrectIngredientFeatures(ingredientData.features);
            if (JSON.stringify(validatedFeatures) !== JSON.stringify(ingredientData.features)) {
              updates.features = validatedFeatures;
              hasChanges = true;
              console.log(`Validated and fixed features for ingredient: ${ingredientData.title || ingredientId}`);
            }
          }

          // Fix techniques if missing
          if (!ingredientData.techniques || ingredientData.techniques.length === 0) {
            updates.techniques = ['raw']; // Default to raw as safe fallback
            hasChanges = true;
            console.log(`Added default techniques for ingredient: ${ingredientData.title || ingredientId}`);
          }

          // Fix storage options if missing
          if (!ingredientData.storageOptions || 
              !ingredientData.storageOptions.countertop || 
              !ingredientData.storageOptions.fridge || 
              !ingredientData.storageOptions.freezer) {
            
            const fixedStorageOptions = {
              countertop: 'not recommended',
              fridge: 'recommended',
              freezer: 'not recommended'
            };
            updates.storageOptions = fixedStorageOptions;
            hasChanges = true;
            console.log(`Fixed storage options for ingredient: ${ingredientData.title || ingredientId}`);
          }

          // Update the ingredient if we have changes
          if (hasChanges) {
            updates.updatedAt = Timestamp.now();
            
            await updateDoc(doc(this.collectionRef, ingredientId), updates);
            
            const newStructure = { ...oldStructure, ...updates };
            
            results.push({
              id: ingredientId,
              oldStructure,
              newStructure,
              success: true
            });
            
            successCount++;
            console.log(`✅ Successfully fixed structure for ingredient: ${ingredientData.title || ingredientId}`);
          } else {
            // No changes needed
            results.push({
              id: ingredientId,
              oldStructure,
              newStructure: oldStructure,
              success: true
            });
            successCount++;
          }
          
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          console.error(`❌ Error fixing ingredient ${ingredientId}:`, error);
          results.push({
            id: ingredientId,
            oldStructure: ingredientData,
            newStructure: ingredientData,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          failedCount++;
        }
      }

      console.log(`🔧 Ingredient structure fix completed. Success: ${successCount}, Failed: ${failedCount}`);
      
      return {
        success: successCount,
        failed: failedCount,
        results
      };
      
    } catch (error) {
      console.error('Error fixing ingredient structure:', error);
      throw error;
    }
  }

  /**
   * Validates and corrects ingredient features to match the new structure
   * @param features The features to validate
   * @returns Validated features object
   */
  private validateAndCorrectIngredientFeatures(features: any): {
    fiber: string;
    g_i: string;
    season: 'spring' | 'summer' | 'autumn' | 'winter' | 'year-round' | 'fall/winter' | 'spring/summer';
    water: string;
    rainbow: 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'white' | 'brown' | 'pink' | 'black';
  } {
    const fallbackFeatures = {
      fiber: '0',
      g_i: '0',
      season: 'year-round' as const,
      water: '0',
      rainbow: 'white' as const
    };

    if (!features || typeof features !== 'object') {
      console.log('Features is not an object, using fallback');
      return fallbackFeatures;
    }

    const correctedFeatures = { ...fallbackFeatures } as {
      fiber: string;
      g_i: string;
      season: 'spring' | 'summer' | 'autumn' | 'winter' | 'year-round' | 'fall/winter' | 'spring/summer';
      water: string;
      rainbow: 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'white' | 'brown' | 'pink' | 'black';
    };
    
    // Validate and correct fiber
    if (features.fiber && typeof features.fiber === 'string') {
      correctedFeatures.fiber = features.fiber;
    }
    
    // Validate and correct g_i (glycemic index)
    if (features.g_i && typeof features.g_i === 'string') {
      correctedFeatures.g_i = features.g_i;
    }
    
    // Validate and correct season
    if (features.season && typeof features.season === 'string') {
      const seasonValue = features.season.toLowerCase();
      if (['spring', 'summer', 'autumn', 'winter', 'year-round', 'fall/winter', 'spring/summer'].includes(seasonValue)) {
        correctedFeatures.season = seasonValue as any;
      }
    }
    
    // Validate and correct water
    if (features.water && typeof features.water === 'string') {
      correctedFeatures.water = features.water;
    }
    
    // Validate and correct rainbow (must be a color, not a number)
    if (features.rainbow && typeof features.rainbow === 'string') {
      const rainbowValue = features.rainbow.toLowerCase();
      if (['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'white', 'brown', 'pink', 'black'].includes(rainbowValue)) {
        correctedFeatures.rainbow = rainbowValue as any;
      } else {
        // If it's a number or invalid value, try to map it to a color based on common patterns
        const mappedColor = this.mapNumberToColor(features.rainbow);
        correctedFeatures.rainbow = mappedColor;
      }
    }

    return correctedFeatures;
  }

  /**
   * Maps numeric or invalid rainbow values to appropriate colors
   * @param value The value to map
   * @returns A valid color or null if no mapping found
   */
  private mapNumberToColor(value: string): 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'white' | 'brown' | 'pink' | 'black' {
    const numValue = parseInt(value);
    
    if (isNaN(numValue)) {
      // Try to extract color from text
      const colorMatch = value.toLowerCase().match(/(red|orange|yellow|green|blue|purple|white|brown|pink|black)/);
      if (colorMatch) {
        return colorMatch[1] as any;
      }
      return 'white'; // Default fallback
    }
    
    // Map numbers to colors based on common patterns
    if (numValue <= 10) return 'white';
    if (numValue <= 20) return 'yellow';
    if (numValue <= 30) return 'orange';
    if (numValue <= 40) return 'red';
    if (numValue <= 50) return 'pink';
    if (numValue <= 60) return 'purple';
    if (numValue <= 70) return 'blue';
    if (numValue <= 80) return 'green';
    if (numValue <= 90) return 'brown';
    return 'black';
  }

  /**
   * Retrieves ingredients that need enhancement with missing details
   * @returns Promise<FirestoreIngredient[]>
   */
  private async getIngredientsNeedingEnhancement(): Promise<FirestoreIngredient[]> {
    try {
      console.log('Fetching ingredients from Firebase collection: ingredients');
      const allIngredients = await getDocs(this.collectionRef);
      console.log(`Found ${allIngredients.size} total ingredients in collection`);
      
      const ingredients: FirestoreIngredient[] = [];

      allIngredients.forEach((doc) => {
        const data = doc.data() as FirestoreIngredient;
        const ingredientData = {
          ...data,
          id: doc.id
        };

        // Check if ingredient needs enhancement
        const needsEnhancement = 
          !ingredientData.title ||
          !ingredientData.type ||
          !ingredientData.calories ||
          !ingredientData.macros ||
          Object.keys(ingredientData.macros || {}).length === 0 ||
          !ingredientData.categories ||
          ingredientData.categories.length === 0 ||
          !ingredientData.features ||
          Object.keys(ingredientData.features || {}).length === 0 ||
          !ingredientData.techniques ||
          ingredientData.techniques.length === 0 ||
          !ingredientData.storageOptions ||
          Object.keys(ingredientData.storageOptions || {}).length === 0 ||
          ingredientData.isAntiInflammatory === undefined ||
          !ingredientData.alt ||
          ingredientData.alt.length === 0 ||
          !ingredientData.image;

        if (needsEnhancement) {
          console.log(`Ingredient "${ingredientData.title}" needs enhancement`);
          ingredients.push(ingredientData);
        }
      });

      console.log(`${ingredients.length} ingredients need enhancement`);
      return ingredients;
    } catch (error) {
      console.error('Error getting ingredients needing enhancement:', error);
      throw error;
    }
  }

  /**
   * Determines if two ingredient titles are exact duplicates
   */
  private areIngredientTitlesSimilar(title1: string, title2: string): boolean {
    // Handle null/undefined titles
    if (!title1 || !title2) {
      return false;
    }

    // Normalize titles for comparison
    const normalize = (title: string): string => {
      return title.toLowerCase()
        .trim()
        .replace(/[^\w\s]/g, '') // Remove punctuation
        .replace(/\s+/g, ' ') // Normalize spaces
        .replace(/\s+$/, ''); // Remove trailing spaces
    };

    const norm1 = normalize(title1);
    const norm2 = normalize(title2);

    // Only exact match after normalization
    return norm1 === norm2 && norm1.length > 0;
  }

  /**
   * Updates the type of an ingredient based on its title and macros
   * Only allows 4 types: protein, grain, vegetable, fruit
   * @param ingredientId The ID of the ingredient to update
   * @returns Promise<string> The new type assigned to the ingredient
   */
  async updateIngredientType(ingredientId: string): Promise<string> {
    try {
      console.log(`Updating ingredient type for ID: ${ingredientId}`);
      
      // Get the ingredient from Firestore
      const ingredientDoc = doc(this.collectionRef, ingredientId);
      const ingredientSnapshot = await getDocs(this.collectionRef);
      const ingredient = ingredientSnapshot.docs.find(doc => doc.id === ingredientId);
      
      if (!ingredient) {
        throw new Error(`Ingredient with ID ${ingredientId} not found`);
      }
      
      const ingredientData = ingredient.data() as FirestoreIngredient;
      
      // Use Gemini to classify the ingredient type
      const newType = await this.geminiService.updateIngredientType({
        title: ingredientData.title,
        calories: ingredientData.calories,
        macros: ingredientData.macros
      });
      
      // Update the ingredient in Firestore
      await updateDoc(ingredientDoc, {
        type: newType,
        updatedAt: Timestamp.now()
      });
      
      console.log(`Updated ingredient "${ingredientData.title}" type from "${ingredientData.type}" to "${newType}"`);
      return newType;
    } catch (error) {
      console.error('Error updating ingredient type:', error);
      throw error;
    }
  }

  /**
   * Updates types for multiple ingredients based on their titles and macros
   * @param ingredientIds Array of ingredient IDs to update (if empty, processes ingredients needing type updates based on scope)
   * @param scope Analysis scope for finding ingredients needing type updates (defaults to last24hours)
   * @returns Promise<{ success: number; failed: number; results: Array<{ id: string; oldType: string; newType: string; success: boolean }> }>
   */
  async updateMultipleIngredientTypes(ingredientIds: string[] = [], scope: 'all' | 'last24hours' | 'last7days' | 'last30days' | 'custom' = 'last24hours'): Promise<{
    success: number;
    failed: number;
    results: Array<{ id: string; oldType: string; newType: string; success: boolean; error?: string }>;
  }> {
    try {
      let ingredientsToProcess: string[] = [];
      
      if (ingredientIds.length > 0) {
        // Process specific ingredient IDs
        ingredientsToProcess = ingredientIds;
        console.log(`Updating types for ${ingredientIds.length} specific ingredients...`);
      } else {
        // Get ingredients needing type updates based on scope
        const { ingredientsNeedingTypeUpdate } = await this.getIngredientsNeedingTypeUpdates(scope);
        ingredientsToProcess = ingredientsNeedingTypeUpdate.map(ingredient => ingredient.id!);
        console.log(`Updating types for ${ingredientsToProcess.length} ingredients needing type updates (scope: ${scope})...`);
      }
      
      const results: Array<{ id: string; oldType: string; newType: string; success: boolean; error?: string }> = [];
      let successCount = 0;
      let failedCount = 0;
      
      for (const ingredientId of ingredientsToProcess) {
        try {
          // Add delay to prevent API rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          const ingredientDoc = doc(this.collectionRef, ingredientId);
          const ingredientSnapshot = await getDocs(this.collectionRef);
          const ingredient = ingredientSnapshot.docs.find(doc => doc.id === ingredientId);
          
          if (!ingredient) {
            results.push({
              id: ingredientId,
              oldType: 'unknown',
              newType: 'unknown',
              success: false,
              error: 'Ingredient not found'
            });
            failedCount++;
            continue;
          }
          
          const ingredientData = ingredient.data() as FirestoreIngredient;
          const oldType = ingredientData.type || 'unknown';
          
          // Use Gemini to classify the ingredient type
          const newType = await this.geminiService.updateIngredientType({
            title: ingredientData.title,
            calories: ingredientData.calories,
            macros: ingredientData.macros
          });
          
          // Update the ingredient in Firestore
          await updateDoc(ingredientDoc, {
            type: newType,
            updatedAt: Timestamp.now()
          });
          
          results.push({
            id: ingredientId,
            oldType,
            newType,
            success: true
          });
          successCount++;
          
        } catch (error) {
          console.error(`Error updating ingredient type for ID ${ingredientId}:`, error);
          results.push({
            id: ingredientId,
            oldType: 'unknown',
            newType: 'unknown',
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          failedCount++;
        }
      }
      
      console.log(`Ingredient type updates complete. Success: ${successCount}, Failed: ${failedCount}`);
      return {
        success: successCount,
        failed: failedCount,
        results
      };
    } catch (error) {
      console.error('Error updating multiple ingredient types:', error);
      throw error;
    }
  }

  /**
   * Gets ingredients that need type updates based on scope
   * @param scope Analysis scope (all, last24hours, last7days, last30days, custom)
   * @returns Promise<{ingredientsNeedingTypeUpdate: FirestoreIngredient[], total: number, withValidTypes: number, needingTypeUpdate: number}>
   */
  async getIngredientsNeedingTypeUpdates(scope: 'all' | 'last24hours' | 'last7days' | 'last30days' | 'custom' = 'last24hours'): Promise<{
    ingredientsNeedingTypeUpdate: FirestoreIngredient[];
    total: number;
    withValidTypes: number;
    needingTypeUpdate: number;
  }> {
    try {
      console.log(`Getting ingredients needing type updates (scope: ${scope})...`);
      
      // Create scope query based on createdAt and updatedAt
      const scopeQuery = this.createScopeQuery(scope);
      const ingredientsQuery = scopeQuery 
        ? query(this.collectionRef, scopeQuery)
        : this.collectionRef;
      
      const allIngredients = await getDocs(ingredientsQuery);
      const ingredients: FirestoreIngredient[] = [];
      const ingredientsNeedingTypeUpdate: FirestoreIngredient[] = [];

      allIngredients.forEach((doc) => {
        const data = doc.data() as FirestoreIngredient;
        const ingredient = { ...data, id: doc.id };

        // Check if ingredient needs type update (missing type or invalid type)
        const needsTypeUpdate = !ingredient.type || 
          !['protein', 'grain', 'vegetable', 'fruit', 'sweetener', 'condiment', 'pastry', 'dairy', 'oil', 'herb', 'spice', 'liquid'].includes(ingredient.type);

        if (needsTypeUpdate) {
          ingredientsNeedingTypeUpdate.push(ingredient);
          console.log(`Ingredient "${ingredient.title}" (ID: ${doc.id}) needs type update. Current type: ${ingredient.type || 'missing'}`);
        } else {
          ingredients.push(ingredient);
        }
      });

      const withValidTypes = ingredients.length;
      const needingTypeUpdate = ingredientsNeedingTypeUpdate.length;
      const total = withValidTypes + needingTypeUpdate;

      console.log(`Found ${needingTypeUpdate} ingredients needing type updates out of ${total} total ingredients (scope: ${scope})`);
      
      return {
        ingredientsNeedingTypeUpdate,
        total,
        withValidTypes,
        needingTypeUpdate
      };
    } catch (error) {
      console.error('Error getting ingredients needing type updates:', error);
      throw error;
    }
  }

  /**
   * Creates a scope query for filtering ingredients by time
   * @param scope Analysis scope
   * @returns Firestore query constraint or null for 'all' scope
   */
  private createScopeQuery(scope: 'all' | 'last24hours' | 'last7days' | 'last30days' | 'custom'): any {
    const now = new Date();
    let startDate: Date;

    switch (scope) {
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
        // For custom, we'll use last 24 hours as default
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      default: // 'all'
        return null;
    }

    // Query by both createdAt and updatedAt to catch both new and recently updated ingredients
    return or(
      where('createdAt', '>=', Timestamp.fromDate(startDate)),
      where('updatedAt', '>=', Timestamp.fromDate(startDate))
    );
  }

  /**
   * Checks for ingredients without titles and returns them
   * @param scope Analysis scope (all, last24hours, last7days, last30days, custom)
   * @returns Promise<{ingredientsWithoutTitles: FirestoreIngredient[], total: number, withTitles: number, withoutTitles: number}>
   */
  async checkIngredientsWithoutTitles(scope: 'all' | 'last24hours' | 'last7days' | 'last30days' | 'custom' = 'all'): Promise<{
    ingredientsWithoutTitles: FirestoreIngredient[];
    total: number;
    withTitles: number;
    withoutTitles: number;
  }> {
    try {
      console.log(`Checking for ingredients without titles (scope: ${scope})...`);
      
      // Create scope query based on createdAt and updatedAt
      const scopeQuery = this.createScopeQuery(scope);
      const ingredientsQuery = scopeQuery 
        ? query(this.collectionRef, scopeQuery)
        : this.collectionRef;
      
      const allIngredients = await getDocs(ingredientsQuery);
      const ingredients: FirestoreIngredient[] = [];
      const ingredientsWithoutTitles: FirestoreIngredient[] = [];

      allIngredients.forEach((doc) => {
        const data = doc.data() as FirestoreIngredient;
        const ingredient = { ...data, id: doc.id };

        if (!ingredient.title || ingredient.title.trim().length === 0) {
          ingredientsWithoutTitles.push(ingredient);
          console.log(`Ingredient with ID ${doc.id} has no title:`, ingredient);
        } else {
          ingredients.push(ingredient);
        }
      });

      const withTitles = ingredients.length;
      const withoutTitles = ingredientsWithoutTitles.length;
      const total = withTitles + withoutTitles;

      console.log(`Found ${withoutTitles} ingredients without titles out of ${total} total ingredients (scope: ${scope})`);
      
      return {
        ingredientsWithoutTitles,
        total,
        withTitles,
        withoutTitles
      };
    } catch (error) {
      console.error('Error checking ingredients without titles:', error);
      throw error;
    }
  }

  /**
   * Adds titles to ingredients that are missing them using Gemini AI
   * @param ingredientIds Array of ingredient IDs to add titles to (if empty, processes all ingredients without titles)
   * @param scope Analysis scope for finding ingredients without titles
   * @returns Promise<{success: number; failed: number; results: Array<{id: string; oldTitle: string; newTitle: string; success: boolean; error?: string}>}>
   */
  async addTitlesToIngredients(ingredientIds: string[] = [], scope: 'all' | 'last24hours' | 'last7days' | 'last30days' | 'custom' = 'all'): Promise<{
    success: number;
    failed: number;
    results: Array<{id: string; oldTitle: string; newTitle: string; success: boolean; error?: string}>;
  }> {
    try {
      console.log('Starting to add titles to ingredients...');
      
      let ingredientsToProcess: FirestoreIngredient[];
      
      if (ingredientIds.length > 0) {
        // Process specific ingredient IDs
        const allIngredients = await getDocs(this.collectionRef);
        ingredientsToProcess = allIngredients.docs
          .map(doc => ({ ...doc.data() as FirestoreIngredient, id: doc.id }))
          .filter(ingredient => ingredientIds.includes(ingredient.id!) && (!ingredient.title || ingredient.title.trim().length === 0));
      } else {
        // Process all ingredients without titles based on scope
        const { ingredientsWithoutTitles } = await this.checkIngredientsWithoutTitles(scope);
        ingredientsToProcess = ingredientsWithoutTitles;
      }
      
      console.log(`Processing ${ingredientsToProcess.length} ingredients for title addition`);
      
      const results: Array<{id: string; oldTitle: string; newTitle: string; success: boolean; error?: string}> = [];
      let successCount = 0;
      let failedCount = 0;
      
      for (const ingredient of ingredientsToProcess) {
        try {
          console.log(`Adding title to ingredient: ${ingredient.id}`);
          
          // Generate title using Gemini based on ingredient content
          const newTitle = await this.generateIngredientTitle(ingredient);
          
          if (newTitle && newTitle.trim().length > 0) {
            // Update the ingredient in Firestore
            await updateDoc(doc(this.collectionRef, ingredient.id!), {
              title: newTitle,
              updatedAt: Timestamp.now()
            });
            
            results.push({
              id: ingredient.id!,
              oldTitle: ingredient.title || '',
              newTitle,
              success: true
            });
            successCount++;
            
            console.log(`Successfully added title "${newTitle}" to ingredient ${ingredient.id}`);
          } else {
            throw new Error('Generated title is empty');
          }
          
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (error) {
          console.error(`Error adding title to ingredient ${ingredient.id}:`, error);
          results.push({
            id: ingredient.id!,
            oldTitle: ingredient.title || '',
            newTitle: '',
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          failedCount++;
        }
      }
      
      console.log(`Title addition complete. Success: ${successCount}, Failed: ${failedCount}`);
      return {
        success: successCount,
        failed: failedCount,
        results
      };
    } catch (error) {
      console.error('Error adding titles to ingredients:', error);
      throw error;
    }
  }

  /**
   * Generates a title for an ingredient using Gemini AI based on its content
   * @param ingredient The ingredient to generate a title for
   * @returns Promise<string> The generated title
   */
  private async generateIngredientTitle(ingredient: FirestoreIngredient): Promise<string> {
    try {
      // Create a prompt for title generation based on available ingredient data
      const prompt = this.createIngredientTitleGenerationPrompt(ingredient);
      
      const response = await fetch(`${this.geminiService['baseUrl']}?key=${this.geminiService['apiKey']}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }]
        })
      });

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!generatedText) {
        throw new Error('No response generated by Gemini');
      }

      // Clean and validate the generated title
      const title = generatedText.trim().replace(/['"]/g, '');
      
      if (title.length === 0 || title.length > 100) {
        throw new Error('Generated title is invalid');
      }

      return title;
    } catch (error) {
      console.error('Error generating ingredient title:', error);
      throw error;
    }
  }

  /**
   * Creates a prompt for ingredient title generation
   * @param ingredient The ingredient to generate a title for
   * @returns string The prompt for Gemini
   */
  private createIngredientTitleGenerationPrompt(ingredient: FirestoreIngredient): string {
    const type = ingredient.type || '';
    const calories = ingredient.calories || 0;
    const macros = ingredient.macros ? `${ingredient.macros.protein}g protein, ${ingredient.macros.carbs}g carbs, ${ingredient.macros.fat}g fat` : '';
    const categories = ingredient.categories ? ingredient.categories.join(', ') : '';
    
    return `Generate a concise, descriptive title for this ingredient based on the available information.

Ingredient Information:
- Type: ${type}
- Calories: ${calories}
- Macros: ${macros}
- Categories: ${categories}

Requirements:
1. Title should be 1-4 words maximum
2. Should be descriptive and recognizable
3. Should reflect the ingredient type and main characteristics
4. Should not include measurements or quantities
5. Should be in lowercase (e.g., "chicken breast", "brown rice", "broccoli")

Return ONLY the title. Do not include quotes, explanations, or additional text.`;
  }

  /**
   * Gets a summary of duplicate ingredients for preview
   * @returns Promise<{totalDuplicates: number, groups: Array<{original: string | undefined, duplicates: (string | undefined)[], count: number}>}>
   */
  async getDuplicatesSummary(): Promise<{totalDuplicates: number, groups: Array<{original: string | undefined, duplicates: (string | undefined)[], count: number}>}> {
    try {
      const duplicateGroups = await this.findDuplicateIngredients();
      
      const summary = {
        totalDuplicates: duplicateGroups.reduce((sum, group) => sum + group.duplicates.length, 0),
        groups: duplicateGroups.map(group => ({
          original: group.original.title,
          duplicates: group.duplicates.map(d => d.title),
          count: group.duplicates.length
        }))
      };

      return summary;
    } catch (error) {
      console.error('Error getting duplicates summary:', error);
      throw error;
    }
  }

  /**
   * Generates new ingredients of specified types using Gemini AI
   * @returns Promise<number> Number of ingredients generated
   */
  async generateNewIngredients(quantities: {
    protein: number;
    vegetable: number;
    fruit: number;
    grain: number;
  }): Promise<number> {
    try {
      console.log('Starting new ingredient generation...');
      
      // Get all existing titles to avoid duplicates
      const allIngredients = await getDocs(this.collectionRef);
      const existingTitles = Array.from(allIngredients.docs.map(doc => doc.data().title));
      
      let totalAdded = 0;

      // Generate ingredients for each type
      for (const [ingredientType, quantity] of Object.entries(quantities)) {
        if (quantity <= 0) continue;

        console.log(`Generating ${quantity} new ${ingredientType} ingredients...`);

        for (let i = 0; i < quantity; i++) {
          try {
            // Add delay to prevent API rate limiting
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Generate a new unique ingredient
            const newIngredient = await this.geminiService.generateNewIngredient(
              ingredientType as 'protein' | 'vegetable' | 'fruit' | 'grain',
              existingTitles
            );
            
            // Add to Firebase
            await addDoc(this.collectionRef, {
              title: newIngredient.title || `New ${ingredientType}`,
              type: newIngredient.type,
              mediaPaths: [],
              calories: newIngredient.calories || 0,
              macros: newIngredient.macros || { protein: '0g', carbs: '0g', fat: '0g' },
              categories: newIngredient.categories || [],
              features: newIngredient.features || { fiber: '0g', g_i: '0', season: 'all year', water: '0%', rainbow: 'white' },
              techniques: newIngredient.techniques || [],
              storageOptions: newIngredient.storageOptions || { countertop: 'Not recommended', fridge: '1 week', freezer: '1 month' },
              isAntiInflammatory: newIngredient.isAntiInflammatory || false,
              isSelected: false,
              alt: newIngredient.alt || [],
              image: newIngredient.image || '',
              createdAt: Timestamp.now(),
              updatedAt: Timestamp.now()
            });
            
            // Add the new title to existing titles to avoid duplicates in the same batch
            if (newIngredient.title) {
              existingTitles.push(newIngredient.title);
            }
            totalAdded++;
            
          } catch (error) {
            console.error(`Error generating ${ingredientType} ingredient ${i + 1}:`, error);
            // Continue with the next ingredient
          }
        }
      }
      
      console.log(`Ingredient generation complete. ${totalAdded} new ingredients added.`);
      return totalAdded;
    } catch (error) {
      console.error('Error generating new ingredients:', error);
      throw error;
    }
  }
}
