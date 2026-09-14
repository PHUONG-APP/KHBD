export async function generateLessonContent(prompt: string, section: string): Promise<string> {
  try {
    const response = await fetch('/api/generate-lesson-content', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt, section }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Lỗi khi gọi máy chủ.');
    }

    const data = await response.json();
    return data.result || 'Không có kết quả trả về.';
  } catch (error) {
    console.error('Error generating content:', error);
    return 'Đã có lỗi xảy ra khi gọi AI.';
  }
}

export async function generateFullLessonPlan(data: { subject: string; grade: string; topic: string; teacherGender: string }) {
  try {
    const response = await fetch('/api/generate-full-lesson-plan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      return null;
    }

    const resData = await response.json();
    return resData.result;
  } catch (error) {
    console.error('Error generating full plan:', error);
    return null;
  }
}
