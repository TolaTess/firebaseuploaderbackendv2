import { collection, getDocs, updateDoc, doc, Timestamp, addDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { CookingMethod, DietCategory, Program, PortionDetail } from '../types/collections';
import { GeminiService } from './geminiService';

// Define the shape of data as it exists in Firestore
interface FirestoreCookingMethod {
  id?: string;
  name: string;
  description?: string;
  howItWorks?: string;
  equipment?: string[];
  bestFor?: string[];
  heatType?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface FirestoreDietCategory {
  id?: string;
  name: string;
  description?: string;
  kidsFriendly?: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface FirestoreProgram {
  id?: string;
  name: string;
  type: 'Balanced' | 'Intermittent fasting' | 'Gut health' | 'Hormonal health' | '8+8+8 rule' | 'No sugar Days challenge' | '1 salad a day' | 'juicing' | '75 hard';
  description: string;
  duration: string;
  goals: string[];
  mealPlan: {
    overview: string;
    dailyStructure: string;
    keyPrinciples: string[];
    sampleMeals: string[];
  };
  fitnessProgram: {
    overview: string;
    workoutTypes: string[];
    frequency: string;
    duration: string;
    exercises: string[];
  };
  guidelines: string[];
  benefits: string[];
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  tips: string[];
  routine?: any[];
  notAllowed?: string[];
  portionDetails?: Record<string, PortionDetail>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export class CollectionsService {
  private readonly cookingMethodsRef = collection(db, 'cookingMethods');
  private readonly dietCategoriesRef = collection(db, 'dietCategories');
  private readonly programsRef = collection(db, 'programs');
  private geminiService: GeminiService;

  constructor() {
    this.geminiService = new GeminiService();
  }

  /**
   * Enhances cooking methods with comprehensive details using Gemini AI
   * @returns Promise<number> Number of cooking methods updated
   */
  async enhanceCookingMethods(): Promise<number> {
    try {
      const cookingMethodsToUpdate = await this.getCookingMethodsNeedingEnhancement();
      let updatedCount = 0;

      for (const cookingMethod of cookingMethodsToUpdate) {
        try {
          console.log(`Enhancing cooking method: ${cookingMethod.name}`);
          
          // Use Gemini to enhance cooking method details
          const enhancedData = await this.geminiService.enhanceCookingMethod({
            name: cookingMethod.name,
            description: cookingMethod.description,
            howItWorks: cookingMethod.howItWorks,
            equipment: cookingMethod.equipment,
            bestFor: cookingMethod.bestFor,
            heatType: cookingMethod.heatType
          });

          const updates: Partial<FirestoreCookingMethod> = {
            updatedAt: Timestamp.now()
          };

          // Update fields with enhanced data
          if (enhancedData.description && !cookingMethod.description) {
            updates.description = enhancedData.description;
          }
          
          if (enhancedData.howItWorks && !cookingMethod.howItWorks) {
            updates.howItWorks = enhancedData.howItWorks;
          }
          
          if (enhancedData.equipment && (!cookingMethod.equipment || cookingMethod.equipment.length === 0)) {
            updates.equipment = enhancedData.equipment;
          }
          
          if (enhancedData.bestFor && (!cookingMethod.bestFor || cookingMethod.bestFor.length === 0)) {
            updates.bestFor = enhancedData.bestFor;
          }
          
          if (enhancedData.heatType && !cookingMethod.heatType) {
            updates.heatType = enhancedData.heatType;
          }

          // Update the cooking method if we have new information
          if (Object.keys(updates).length > 1 && cookingMethod.id) { // More than just updatedAt
            await updateDoc(doc(this.cookingMethodsRef, cookingMethod.id), updates);
            updatedCount++;
            console.log(`Successfully updated cooking method ${cookingMethod.id} with Gemini enhancements`);
          }
          
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (error) {
          console.error(`Error enhancing cooking method ${cookingMethod.id}:`, error);
          // Continue with other cooking methods even if one fails
        }
      }

      return updatedCount;
    } catch (error) {
      console.error('Error updating cooking methods with Gemini enhancement:', error);
      throw error;
    }
  }

  /**
   * Enhances diet categories with comprehensive details using Gemini AI
   * @returns Promise<number> Number of diet categories updated
   */
  async enhanceDietCategories(): Promise<number> {
    try {
      const dietCategoriesToUpdate = await this.getDietCategoriesNeedingEnhancement();
      let updatedCount = 0;

      for (const dietCategory of dietCategoriesToUpdate) {
        try {
          console.log(`Enhancing diet category: ${dietCategory.name}`);
          
          // Use Gemini to enhance diet category details
          const enhancedData = await this.geminiService.enhanceDietCategory({
            name: dietCategory.name,
            description: dietCategory.description,
            kidsFriendly: dietCategory.kidsFriendly
          });

          const updates: Partial<FirestoreDietCategory> = {
            updatedAt: Timestamp.now()
          };

          // Update fields with enhanced data
          if (enhancedData.description && !dietCategory.description) {
            updates.description = enhancedData.description;
          }
          
          if (enhancedData.kidsFriendly !== undefined && dietCategory.kidsFriendly === undefined) {
            updates.kidsFriendly = enhancedData.kidsFriendly;
          }

          // Update the diet category if we have new information
          if (Object.keys(updates).length > 1 && dietCategory.id) { // More than just updatedAt
            await updateDoc(doc(this.dietCategoriesRef, dietCategory.id), updates);
            updatedCount++;
            console.log(`Successfully updated diet category ${dietCategory.id} with Gemini enhancements`);
          }
          
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (error) {
          console.error(`Error enhancing diet category ${dietCategory.id}:`, error);
          // Continue with other diet categories even if one fails
        }
      }

      return updatedCount;
    } catch (error) {
      console.error('Error updating diet categories with Gemini enhancement:', error);
      throw error;
    }
  }

  /**
   * Updates programs with comprehensive details using Gemini AI
   * @returns Promise<number> Number of programs updated
   */
  async updateProgramsWithPortionDetails(): Promise<number> {
    try {
      const programsToUpdate = await this.getProgramsNeedingEnhancement();
      let updatedCount = 0;

      for (const program of programsToUpdate) {
        try {
          console.log(`Enhancing program: ${program.name}`);
          
          // Use Gemini to enhance program portion details
          const enhancedData = await this.geminiService.enhanceProgramPortionDetails(program);

          const updates: Partial<FirestoreProgram> = {
            updatedAt: Timestamp.now()
          };

          // Update fields with enhanced data
          if (enhancedData.notAllowed && (!program.notAllowed || program.notAllowed.length === 0)) {
            updates.notAllowed = enhancedData.notAllowed;
          }
          
          if (enhancedData.portionDetails && (!program.portionDetails || Object.keys(program.portionDetails).length === 0)) {
            updates.portionDetails = enhancedData.portionDetails;
          }

          // Update the program if we have new information
          if (Object.keys(updates).length > 1 && program.id) { // More than just updatedAt
            await updateDoc(doc(this.programsRef, program.id), updates);
            updatedCount++;
            console.log(`Successfully updated program ${program.id} with Gemini enhancements`);
          }
          
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (error) {
          console.error(`Error enhancing program ${program.id}:`, error);
          // Continue with other programs even if one fails
        }
      }

      return updatedCount;
    } catch (error) {
      console.error('Error updating programs with Gemini enhancement:', error);
      throw error;
    }
  }

  /**
   * Creates all program types using Gemini AI
   * @returns Promise<number> Number of programs created
   */
  async createAllPrograms(): Promise<number> {
    const programTypes: Program['type'][] = [
      'Balanced',
      'Intermittent fasting',
      'Gut health',
      'Hormonal health',
      '8+8+8 rule',
      'No sugar Days challenge',
      '1 salad a day',
      'juicing',
      '75 hard'
    ];

    let createdCount = 0;

    for (const programType of programTypes) {
      try {
        console.log(`Creating program: ${programType}`);
        
        // Check if program already exists
        const existingPrograms = await getDocs(this.programsRef);
        const exists = existingPrograms.docs.some(doc => {
          const data = doc.data() as FirestoreProgram;
          return data.type === programType;
        });

        if (exists) {
          console.log(`Program "${programType}" already exists, skipping...`);
          continue;
        }

        // Use Gemini to create program details
        const enhancedData = await this.geminiService.createProgram(programType);

        const programData: Omit<FirestoreProgram, 'id'> = {
          name: enhancedData.name,
          type: programType,
          description: enhancedData.description,
          duration: enhancedData.duration,
          goals: enhancedData.goals,
          mealPlan: enhancedData.mealPlan,
          fitnessProgram: enhancedData.fitnessProgram,
          guidelines: enhancedData.guidelines,
          benefits: enhancedData.benefits,
          difficulty: enhancedData.difficulty,
          tips: enhancedData.tips,
          notAllowed: enhancedData.notAllowed,
          portionDetails: enhancedData.portionDetails,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        };

        await addDoc(this.programsRef, programData);
        createdCount++;
        console.log(`Successfully created program: ${enhancedData.name}`);
        
        // Delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.error(`Error creating program ${programType}:`, error);
        // Continue with other programs even if one fails
      }
    }

    return createdCount;
  }

  /**
   * Creates routines for existing programs that don't have them
   * @returns Promise<number> Number of programs updated with routines
   */
  async createProgramRoutines(): Promise<number> {
    try {
      console.log('Fetching programs from Firebase collection: programs');
      const allPrograms = await getDocs(this.programsRef);
      console.log(`Found ${allPrograms.size} total programs in collection`);
      
      const programsToUpdate: (FirestoreProgram & { id: string })[] = [];

      allPrograms.forEach((doc) => {
        const data = doc.data() as FirestoreProgram;
        
        // Check if program needs a routine
        if (!data.routine || data.routine.length === 0) {
          console.log(`Program "${data.name}" needs a routine`);
          programsToUpdate.push({
            ...data,
            id: doc.id
          });
        }
      });

      console.log(`${programsToUpdate.length} programs need routines`);
      
      let updatedCount = 0;

      for (const program of programsToUpdate) {
        try {
          console.log(`Creating routine for program: ${program.name}`);
          
          // Convert Firestore program to Program type for Gemini
          const programForGemini: Program = {
            id: program.id,
            name: program.name,
            type: program.type,
            description: program.description,
            duration: program.duration,
            goals: program.goals,
            mealPlan: program.mealPlan,
            fitnessProgram: program.fitnessProgram,
            guidelines: program.guidelines,
            benefits: program.benefits,
            difficulty: program.difficulty,
            tips: program.tips,
            routine: program.routine,
            notAllowed: program.notAllowed,
            portionDetails: program.portionDetails,
            createdAt: program.createdAt.toDate(),
            updatedAt: program.updatedAt.toDate()
          };
          
          // Use Gemini to create routine
          const routine = await this.geminiService.createProgramRoutine(programForGemini);

          const updates: Partial<FirestoreProgram> = {
            routine: routine,
            updatedAt: Timestamp.now()
          };

          await updateDoc(doc(this.programsRef, program.id), updates);
          updatedCount++;
          console.log(`Successfully created routine for program "${program.name}" with ${routine.length} items`);
          
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 2000));
          
        } catch (error) {
          console.error(`Error creating routine for program ${program.id}:`, error);
          // Continue with other programs even if one fails
        }
      }

      return updatedCount;
    } catch (error) {
      console.error('Error creating program routines:', error);
      throw error;
    }
  }

  /**
   * Gets a summary of existing programs
   */
  async getProgramsSummary(): Promise<{total: number, programs: {name: string, type: Program['type']}[]}> {
    try {
      const allPrograms = await getDocs(this.programsRef);
      const programs: {name: string, type: Program['type']}[] = [];

      allPrograms.forEach((doc) => {
        const data = doc.data() as FirestoreProgram;
        programs.push({
          name: data.name,
          type: data.type
        });
      });

      return {
        total: allPrograms.size,
        programs: programs
      };
    } catch (error) {
      console.error('Error getting programs summary:', error);
      throw error;
    }
  }

  /**
   * Retrieves cooking methods that need enhancement with missing details
   * @returns Promise<FirestoreCookingMethod[]>
   */
  private async getCookingMethodsNeedingEnhancement(): Promise<FirestoreCookingMethod[]> {
    try {
      console.log('Fetching cooking methods from Firebase collection: cookingMethods');
      const allCookingMethods = await getDocs(this.cookingMethodsRef);
      console.log(`Found ${allCookingMethods.size} total cooking methods in collection`);
      
      const cookingMethods: FirestoreCookingMethod[] = [];

      allCookingMethods.forEach((doc) => {
        const data = doc.data() as FirestoreCookingMethod;
        const cookingMethodData = {
          ...data,
          id: doc.id
        };

        // Check if cooking method needs enhancement
        const needsEnhancement = 
          !cookingMethodData.description ||
          !cookingMethodData.howItWorks ||
          !cookingMethodData.equipment ||
          cookingMethodData.equipment.length === 0 ||
          !cookingMethodData.bestFor ||
          cookingMethodData.bestFor.length === 0 ||
          !cookingMethodData.heatType;

        if (needsEnhancement) {
          console.log(`Cooking method "${cookingMethodData.name}" needs enhancement`);
          cookingMethods.push(cookingMethodData);
        }
      });

      console.log(`${cookingMethods.length} cooking methods need enhancement`);
      return cookingMethods;
    } catch (error) {
      console.error('Error getting cooking methods needing enhancement:', error);
      throw error;
    }
  }

  /**
   * Retrieves diet categories that need enhancement with missing details
   * @returns Promise<FirestoreDietCategory[]>
   */
  private async getDietCategoriesNeedingEnhancement(): Promise<FirestoreDietCategory[]> {
    try {
      console.log('Fetching diet categories from Firebase collection: dietCategories');
      const allDietCategories = await getDocs(this.dietCategoriesRef);
      console.log(`Found ${allDietCategories.size} total diet categories in collection`);
      
      const dietCategories: FirestoreDietCategory[] = [];

      allDietCategories.forEach((doc) => {
        const data = doc.data() as FirestoreDietCategory;
        const dietCategoryData = {
          ...data,
          id: doc.id
        };

        // Check if diet category needs enhancement
        const needsEnhancement = 
          !dietCategoryData.description ||
          dietCategoryData.kidsFriendly === undefined;

        if (needsEnhancement) {
          console.log(`Diet category "${dietCategoryData.name}" needs enhancement`);
          dietCategories.push(dietCategoryData);
        }
      });

      console.log(`${dietCategories.length} diet categories need enhancement`);
      return dietCategories;
    } catch (error) {
      console.error('Error getting diet categories needing enhancement:', error);
      throw error;
    }
  }

  /**
   * Retrieves programs that need enhancement with missing details
   * @returns Promise<FirestoreProgram[]>
   */
  private async getProgramsNeedingEnhancement(): Promise<FirestoreProgram[]> {
    try {
      console.log('Fetching programs from Firebase collection: programs');
      const allPrograms = await getDocs(this.programsRef);
      console.log(`Found ${allPrograms.size} total programs in collection`);
      
      const programs: FirestoreProgram[] = [];

      allPrograms.forEach((doc) => {
        const data = doc.data() as FirestoreProgram;
        const programData = {
          ...data,
          id: doc.id
        };

        // Check if program needs enhancement (missing any major details)
        const needsEnhancement = 
          !programData.description ||
          !programData.duration ||
          !programData.goals ||
          programData.goals.length === 0 ||
          !programData.mealPlan ||
          !programData.mealPlan.overview ||
          !programData.fitnessProgram ||
          !programData.fitnessProgram.overview ||
          !programData.guidelines ||
          programData.guidelines.length === 0 ||
          !programData.benefits ||
          programData.benefits.length === 0 ||
          !programData.difficulty ||
          !programData.tips ||
          programData.tips.length === 0 ||
          !programData.notAllowed ||
          programData.notAllowed.length === 0 ||
          !programData.portionDetails ||
          Object.keys(programData.portionDetails).length === 0;

        if (needsEnhancement) {
          console.log(`Program "${programData.name}" needs enhancement:`, {
            hasDescription: !!programData.description,
            hasDuration: !!programData.duration,
            hasGoals: !!(programData.goals && programData.goals.length > 0),
            hasMealPlan: !!(programData.mealPlan && programData.mealPlan.overview),
            hasFitnessProgram: !!(programData.fitnessProgram && programData.fitnessProgram.overview),
            hasGuidelines: !!(programData.guidelines && programData.guidelines.length > 0),
            hasBenefits: !!(programData.benefits && programData.benefits.length > 0),
            hasDifficulty: !!programData.difficulty,
            hasTips: !!(programData.tips && programData.tips.length > 0),
            hasNotAllowed: !!(programData.notAllowed && programData.notAllowed.length > 0),
            hasPortionDetails: !!(programData.portionDetails && Object.keys(programData.portionDetails).length > 0)
          });
          programs.push(programData);
        }
      });

      console.log(`${programs.length} programs need enhancement`);
      return programs;
    } catch (error) {
      console.error('Error getting programs needing enhancement:', error);
      throw error;
    }
  }
}
