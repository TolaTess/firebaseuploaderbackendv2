import { collection, getDocs, updateDoc, doc, Timestamp, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Nutrition } from '../types/meal';
import { GeminiService } from '../services/geminiService';
import { DataAnalysisService } from './dataAnalysisService';

// Define the shape of data as it exists in Firestore
interface FirestoreMeal {
  id?: string;
  title?: string; // Made optional to handle data integrity issues where some meals might not have titles
  description?: string;
  type?: 'protein' | 'grain' | 'vegetable' | 'fruit';
  cookingTime?: string;
  cookingMethod?: string;
  ingredients: Record<string, string>;
  instructions?: string[];
  nutritionalInfo?: Nutrition;
  categories?: string[];
  serveQty?: number;
  nutrition?: Nutrition;
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

interface DuplicateGroup {
  original: FirestoreMeal;
  duplicates: FirestoreMeal[];
}

export class MealService {
  private readonly collectionRef = collection(db, 'meals');
  private geminiService: GeminiService;

  constructor() {
    this.geminiService = new GeminiService();
  }

  /**
   * Detects and transforms duplicate meals into unique variations
   * @returns Promise<number> Number of duplicates transformed
   */
  async transformDuplicatesIntoVariations(): Promise<number> {
    try {
      console.log('Starting duplicate detection and transformation...');
      
      const duplicateGroups = await this.findDuplicateMeals();
      console.log(`Found ${duplicateGroups.length} groups of duplicates`);
      
      if (duplicateGroups.length === 0) {
        return 0;
      }

      // Get all existing titles to avoid creating new duplicates
      const allMeals = await getDocs(this.collectionRef);
      const existingTitles = Array.from(allMeals.docs.map(doc => doc.data().title));
      
      let transformedCount = 0;

      for (const group of duplicateGroups) {
        console.log(`Processing duplicates for: "${group.original.title}"`);
        console.log(`Found ${group.duplicates.length} duplicates`);

        // Transform each duplicate (keep the original)
        for (const duplicate of group.duplicates) {
          try {
            console.log(`Transforming duplicate meal: ${duplicate.id}`);
            
            // Create variation using Gemini
            const variation = await this.geminiService.createMealVariation(
              {
                title: duplicate.title,
                description: duplicate.description,
                ingredients: duplicate.ingredients,
                type: duplicate.type,
                cookingMethod: duplicate.cookingMethod,
                instructions: duplicate.instructions
              },
              existingTitles
            );

            // Update the duplicate with the variation
            const updates: Partial<FirestoreMeal> = {
              title: variation.title,
              description: variation.description,
              type: variation.type,
              cookingTime: variation.cookingTime,
              cookingMethod: variation.cookingMethod,
              ingredients: variation.ingredients || duplicate.ingredients,
              instructions: variation.instructions,
              categories: variation.categories,
              serveQty: variation.serveQty,
              nutritionalInfo: variation.nutritionalInfo,
              suggestions: variation.suggestions,
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
            console.error(`Error transforming duplicate ${duplicate.id}:`, error);
            // Continue with other duplicates even if one fails
          }
        }
      }

      console.log(`Transformation complete. ${transformedCount} duplicates transformed.`);
      return transformedCount;
    } catch (error) {
      console.error('Error transforming duplicates:', error);
      throw error;
    }
  }

  /**
   * Finds duplicate meals based on title similarity
   * @returns Promise<DuplicateGroup[]>
   */
  async findDuplicateMeals(): Promise<DuplicateGroup[]> {
    try {
      console.log('Scanning for duplicate meals...');
      const allMeals = await getDocs(this.collectionRef);
      const meals: FirestoreMeal[] = [];

      allMeals.forEach((doc) => {
        const data = doc.data() as FirestoreMeal;
        
        // Log meals with missing titles for debugging
        if (!data.title) {
          console.warn(`Meal with ID ${doc.id} has no title:`, data);
        }
        
        meals.push({
          ...data,
          id: doc.id
        });
      });

      // Filter out meals without titles
      const mealsWithTitles = meals.filter(meal => meal.title && meal.title.trim().length > 0);
      console.log(`Analyzing ${mealsWithTitles.length} meals with titles for duplicates (${meals.length - mealsWithTitles.length} meals without titles excluded)`);

      const duplicateGroups: DuplicateGroup[] = [];
      const processedIds = new Set<string>();

      for (let i = 0; i < mealsWithTitles.length; i++) {
        const currentMeal = mealsWithTitles[i];
        
        if (processedIds.has(currentMeal.id!)) {
          continue;
        }

        const duplicates: FirestoreMeal[] = [];

        // Find meals with similar titles
        for (let j = i + 1; j < mealsWithTitles.length; j++) {
          const compareMeal = mealsWithTitles[j];
          
          if (processedIds.has(compareMeal.id!)) {
            continue;
          }

          if (currentMeal.title && compareMeal.title && this.areMealTitlesSimilar(currentMeal.title, compareMeal.title)) {
            duplicates.push(compareMeal);
            processedIds.add(compareMeal.id!);
          }
        }

        // If we found duplicates, create a group
        if (duplicates.length > 0) {
          duplicateGroups.push({
            original: currentMeal,
            duplicates: duplicates
          });
          processedIds.add(currentMeal.id!);
          
          console.log(`Found duplicate group for "${currentMeal.title}":`, 
            duplicates.map(d => d.title));
        }
      }

      return duplicateGroups;
    } catch (error) {
      console.error('Error finding duplicate meals:', error);
      throw error;
    }
  }

  /**
   * Gets a summary of duplicate meals for preview
   * @returns Promise<{totalDuplicates: number, groups: Array<{original: string, duplicates: string[], count: number}>}>
   */
  async getDuplicatesSummary(): Promise<{totalDuplicates: number, groups: Array<{original: string | undefined, duplicates: (string | undefined)[], count: number}>}> {
    try {
      const duplicateGroups = await this.findDuplicateMeals();
      
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
   * Determines if two meal titles are exact duplicates
   * Only considers exact matches after normalization to avoid false positives
   */
  private areMealTitlesSimilar(title1: string, title2: string): boolean {
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
   * Updates meals with comprehensive details using Gemini AI
   * @returns Promise<number> Number of meals updated
   */
  async updateMealsWithGeminiEnhancement(): Promise<number> {
    try {
      const mealsToUpdate = await this.getMealsNeedingEnhancement();
      let updatedCount = 0;

      for (const meal of mealsToUpdate) {
        try {
          console.log(`Enhancing meal: ${meal.title}`);
          
          // Use Gemini to enhance meal details
          const enhancedData = await this.geminiService.enhanceMealDetails({
            title: meal.title,
            description: meal.description,
            ingredients: meal.ingredients,
            instructions: meal.instructions
          });

          const updates: Partial<FirestoreMeal> = {
            updatedAt: Timestamp.now()
          };

          // Update fields with enhanced data
          if (enhancedData.description && !meal.description) {
            updates.description = enhancedData.description;
          }
          
          if (enhancedData.type && !meal.type) {
            updates.type = enhancedData.type;
          }
          
          if (enhancedData.cookingTime && !meal.cookingTime) {
            updates.cookingTime = enhancedData.cookingTime;
          }
          
          if (enhancedData.cookingMethod && !meal.cookingMethod) {
            updates.cookingMethod = enhancedData.cookingMethod;
          }
          
          if (enhancedData.instructions && (!meal.instructions || meal.instructions.length === 0)) {
            updates.instructions = enhancedData.instructions;
          }
          
          if (enhancedData.categories && (!meal.categories || meal.categories.length === 0)) {
            updates.categories = enhancedData.categories;
          }
          
          if (enhancedData.serveQty && !meal.serveQty) {
            updates.serveQty = enhancedData.serveQty;
          }
          
          // Enhanced ingredients (merge with existing)
          if (enhancedData.ingredients && Object.keys(enhancedData.ingredients).length > 0) {
            updates.ingredients = {
              ...meal.ingredients,
              ...enhancedData.ingredients
            };
          }
          
          // Enhanced nutrition information
          if (enhancedData.nutritionalInfo && !meal.nutritionalInfo && !meal.nutrition) {
            updates.nutritionalInfo = enhancedData.nutritionalInfo;
          }

          // Enhanced suggestions (always add/update suggestions)
          if (enhancedData.suggestions) {
            updates.suggestions = enhancedData.suggestions;
          }

          // Update the meal if we have new information
          if (Object.keys(updates).length > 1 && meal.id) { // More than just updatedAt
            await updateDoc(doc(this.collectionRef, meal.id), updates);
            updatedCount++;
            console.log(`Successfully updated meal ${meal.id} with Gemini enhancements`);
          }
          
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (error) {
          console.error(`Error enhancing meal ${meal.id}:`, error);
          // Continue with other meals even if one fails
        }
      }

      return updatedCount;
    } catch (error) {
      console.error('Error updating meals with Gemini enhancement:', error);
      throw error;
    }
  }

  /**
   * Retrieves meals that need enhancement with missing details
   * @returns Promise<FirestoreMeal[]>
   */
  private async getMealsNeedingEnhancement(): Promise<FirestoreMeal[]> {
    try {
      console.log('Fetching meals from Firebase collection: meals');
      const allMeals = await getDocs(this.collectionRef);
      console.log(`Found ${allMeals.size} total meals in collection`);
      
      const meals: FirestoreMeal[] = [];

      allMeals.forEach((doc) => {
        const data = doc.data() as FirestoreMeal;
        const mealData = {
          ...data,
          id: doc.id
        };

        // Check if meal needs enhancement
        const needsEnhancement = 
          !mealData.description ||
          !mealData.type ||
          !mealData.cookingTime ||
          !mealData.cookingMethod ||
          !mealData.instructions ||
          mealData.instructions.length === 0 ||
          !mealData.categories ||
          mealData.categories.length === 0 ||
          !mealData.serveQty ||
          (!mealData.nutritionalInfo && !mealData.nutrition) ||
          Object.keys(mealData.ingredients || {}).length === 0;

        if (needsEnhancement) {
          console.log(`Meal "${mealData.title}" needs enhancement:`, {
            hasDescription: !!mealData.description,
            hasType: !!mealData.type,
            hasCookingTime: !!mealData.cookingTime,
            hasCookingMethod: !!mealData.cookingMethod,
            hasInstructions: !!(mealData.instructions && mealData.instructions.length > 0),
            hasCategories: !!(mealData.categories && mealData.categories.length > 0),
            hasServeQty: !!mealData.serveQty,
            hasNutrition: !!(mealData.nutritionalInfo || mealData.nutrition),
            hasIngredients: Object.keys(mealData.ingredients || {}).length > 0
          });
          meals.push(mealData);
        }
      });

      console.log(`${meals.length} meals need enhancement`);
      return meals;
    } catch (error) {
      console.error('Error getting meals needing enhancement:', error);
      throw error;
    }
  }


}