import { collection, getDocs, updateDoc, doc, Timestamp, addDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Ingredient } from '../types/ingredient';
import { GeminiService } from './geminiService';

// Define the shape of data as it exists in Firestore
interface FirestoreIngredient {
  id?: string;
  title?: string;
  type?: 'protein' | 'vegetable' | 'fruit' | 'grain' | 'sweetener' | 'condiment' | 'pastry';
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
   * @param ingredientIds Array of ingredient IDs to update
   * @returns Promise<{ success: number; failed: number; results: Array<{ id: string; oldType: string; newType: string; success: boolean }> }>
   */
  async updateMultipleIngredientTypes(ingredientIds: string[]): Promise<{
    success: number;
    failed: number;
    results: Array<{ id: string; oldType: string; newType: string; success: boolean; error?: string }>;
  }> {
    try {
      console.log(`Updating types for ${ingredientIds.length} ingredients...`);
      
      const results: Array<{ id: string; oldType: string; newType: string; success: boolean; error?: string }> = [];
      let successCount = 0;
      let failedCount = 0;
      
      for (const ingredientId of ingredientIds) {
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
      
      const allIngredients = await getDocs(this.collectionRef);
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

      console.log(`Found ${withoutTitles} ingredients without titles out of ${total} total ingredients`);
      
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
