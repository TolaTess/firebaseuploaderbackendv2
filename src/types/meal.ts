export enum Categories {
  Mexican = 'Mexican',
  Italian = 'Italian',
  Korean = 'Korean',
  Indian = 'Indian',
  Japanese = 'Japanese',
  Chinese = 'Chinese',
  Mediterranean = 'Mediterranean',
  French = 'French',
  African = 'African',
  American = 'American',
}

export interface Nutrition {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface Meal {
  id?: string;
  title: string;
  description?: string;
  type?: 'protein' | 'grain' | 'vegetable' | 'fruit';
  cookingTime?: string;
  cookingMethod?: 'raw' | 'frying' | 'grilling' | 'boiling' | 'smoothie' | 'roasting' | 'mashing' | 'baking' | 'sautéing' | 'soup' | 'poaching' | 'braising' | 'other';  // Added 'other' to the list
  ingredients: {
    [key: string]: string; // amount with unit (e.g., '1 cup', '200g')
  };
  instructions?: string[];
  nutritionalInfo?: Nutrition;
  categories?: string[];
  serveQty?: number;
  mediaType?: string;
  mediaPaths?: string[];
  userId?: string;
  mealId?: string;
  suggestions?: {
    improvements: string[];
    alternatives: string[];
    additions: string[];
  };
  createdAt: Date;
  updatedAt: Date;
  
  // Legacy fields for backward compatibility
  cuisineTypes?: Categories[];
  nutrition?: Nutrition;
  macros?: {
    protein: string;
    carbs: string;
    fat: string;
  };
}
