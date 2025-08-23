export interface Ingredient {
  id?: string;
  title: string;
  type: 'protein' | 'grain' | 'vegetable' | 'fruit' | 'sweetener' | 'condiment' | 'pastry' | 'dairy' | 'oil' | 'herb' | 'spice' | 'liquid';
  mediaPaths: string[];
  calories: number;
  macros: {
    protein: string;
    carbs: string;
    fat: string;
  };
  categories: string[]; // keto, carnivore, healthy etc
  features: {
    fiber: string; // e.g., "10g"
    g_i: string; // glycemic index e.g., "40", "low", "medium", "high"
    season: 'spring' | 'summer' | 'autumn' | 'winter' | 'year-round' | 'fall/winter' | 'spring/summer';
    water: string; // e.g., "10%"
    rainbow: 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'white' | 'brown' | 'pink' | 'black';
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
