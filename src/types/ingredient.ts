export interface Ingredient {
  id?: string;
  title: string;
  type: 'protein' | 'vegetable' | 'fruit' | 'grain' | 'sweetener' | 'condiment' | 'pastry';
  mediaPaths: string[];
  calories: number;
  macros: {
    protein: string;
    carbs: string;
    fat: string;
  };
  categories: string[]; // keto, carnivore, healthy etc
  features: {
    fiber: string;
    g_i: string; // glycemic index
    season: string;
    water: string;
    rainbow: string;
  };
  techniques: string[]; // cooking methods - baking, grilling etc
  storageOptions: {
    countertop: string;
    fridge: string;
    freezer: string;
  };
  isAntiInflammatory: boolean;
  isSelected: boolean;
  alt: string[]; // healthier alternatives
  image: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface FirestoreIngredient extends Omit<Ingredient, 'createdAt' | 'updatedAt'> {
  createdAt: import('firebase/firestore').Timestamp;
  updatedAt: import('firebase/firestore').Timestamp;
}
