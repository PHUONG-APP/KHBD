import { getGeminiApiKey } from './geminiService';

export async function generateLessonContent(prompt: string, section: string): Promise<string> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('Chưa cấu hình Google Gemini API Key. Vui lòng nhập API Key để tiếp tục.');
  }

  const systemPrompt = `Bạn là một chuyên gia giáo dục Tiểu học Việt Nam. Hãy giúp tôi soạn nội dung cho phần "${section}" của kế hoạch bài dạy dựa trên thông tin sau: ${prompt}. Hãy viết chi tiết, sư phạm và phù hợp với chương trình giáo dục phổ thông mới.
LƯU Ý: Nếu đây là phần hoạt động dạy học, hãy sử dụng "GV" hoặc lược bỏ chủ ngữ cho các mô tả hành động. Tránh các cụm từ lặp lại như "Cô nói:", "Cô hỏi:". Sử dụng đúng danh xưng giáo viên trong các câu nói trực tiếp với học sinh.`;

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: systemPrompt }] }],
        generationConfig: {
          temperature: 0.7,
        },
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `Lỗi HTTP ${res.status}`);
    }

    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || 'Không có kết quả trả về.';
  } catch (error: any) {
    console.error('Error generating content:', error);
    return 'Đã có lỗi xảy ra khi gọi AI: ' + (error?.message || '');
  }
}

export async function generateFullLessonPlan(data: { subject: string; grade: string; topic: string; teacherGender: string }) {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('Chưa cấu hình Google Gemini API Key. Vui lòng nhập API Key để tiếp tục.');
  }

  const prompt = `Bạn là một chuyên gia giáo dục Việt Nam. Hãy soạn một kế hoạch bài dạy chi tiết cho môn ${data.subject}, lớp ${data.grade}. ${data.topic ? `Chủ đề: ${data.topic}.` : 'Hãy xác định chủ đề từ nội dung tài liệu.'} Danh xưng giáo viên: ${data.teacherGender}.
LƯU Ý QUAN TRỌNG:
- Trong các hoạt động dạy học, hãy sử dụng "GV" hoặc lược bỏ chủ ngữ cho các mô tả hành động.
- Tránh các cụm từ lặp lại như "Cô nói:", "Cô hỏi:", "Cô kết luận:".
- Sử dụng đúng danh xưng "${data.teacherGender}" trong các câu nói trực tiếp với học sinh.
- Trả về kết quả dưới dạng JSON với cấu trúc:
{
  "objectives": "Mục tiêu bài học",
  "materials": "Thiết bị dạy học và học liệu",
  "introduction": "Hoạt động Mở đầu",
  "activities": "Hoạt động Hình thành kiến thức mới / Luyện tập / Vận dụng",
  "conclusion": "Hoạt động Kết thúc",
  "assessment": "Đánh giá kết quả học tập"
}`;

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `Lỗi HTTP ${res.status}`);
    }

    const resJson = await res.json();
    const rawText = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return null;
    return JSON.parse(rawText);
  } catch (error) {
    console.error('Error generating full plan:', error);
    return null;
  }
}

