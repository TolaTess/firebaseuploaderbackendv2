export interface CookingMethod {
  id?: string;
  name: string;
  description?: string;
  howItWorks?: string;
  equipment?: string[];
  bestFor?: string[];
  heatType?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DietCategory {
  id?: string;
  name: string;
  description?: string;
  kidsFriendly?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface RoutineItem {
  title: string;
  duration: string;
  description: string;
}

export interface PortionDetail {
  palmPercentage: string;
  spatulaSize: string;
  examples: string[];
  calories: string;
}

export interface Program {
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
  routine?: RoutineItem[];
  notAllowed?: string[];
  portionDetails?: Record<string, PortionDetail>;
  createdAt: Date;
  updatedAt: Date;
}
