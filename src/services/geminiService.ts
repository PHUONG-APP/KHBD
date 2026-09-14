export interface LessonPlanRequest {
  subject: string;
  grade: string;
  topic?: string;
  periods: string;
  currentPeriod?: string;
  totalPeriods?: string;
  teacherGender: 'Thầy' | 'Cô';
  additionalInfo: string;
  mode?: 'new' | 'vbt' | 'upgrade';
  file?: {
    mimeType: string;
    data: string; // base64
  };
  files?: Array<{
    mimeType: string;
    data: string; // base64
    name?: string;
  }>;
}

export interface RegenerateSectionParams {
  subject: string;
  grade: string;
  topic?: string;
  activityName: string;
  shortLabel?: string;
  teacherGender: 'Thầy' | 'Cô';
  currentActivityContent?: string;
  userCustomPrompt?: string;
  lessonSummary?: string;
}

export async function generateLessonPlan(request: LessonPlanRequest): Promise<string> {
  const response = await fetch('/api/generate-lesson-plan', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Lỗi máy chủ (${response.status}) khi tạo kế hoạch bài dạy.`);
  }

  const data = await response.json();
  return data.result || 'Không thể tạo kế hoạch bài dạy. Vui lòng thử lại.';
}

export async function regenerateActivitySection(params: RegenerateSectionParams): Promise<string> {
  const response = await fetch('/api/regenerate-activity', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Lỗi máy chủ (${response.status}) khi soạn lại hoạt động.`);
  }

  const data = await response.json();
  return data.result || '';
}
