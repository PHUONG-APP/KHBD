export interface LessonPlan {
  id: string;
  title: string;
  subject: string;
  grade: string;
  topic: string;
  teacherGender: 'Thầy' | 'Cô';
  objectives: string;
  materials: string;
  procedures: {
    introduction: string;
    activities: string;
    conclusion: string;
  };
  assessment: string;
  createdAt: number;
  updatedAt: number;
}

export type LessonPlanFormData = Omit<LessonPlan, 'id' | 'createdAt' | 'updatedAt'>;
