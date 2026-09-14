import { GoogleGenAI } from "@google/genai";

let aiClient: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Chưa cấu hình GEMINI_API_KEY trên máy chủ.");
    }
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

export async function generateLessonContent(prompt: string, section: string) {
  try {
    const ai = getAI();
    let response;
    try {
      response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: `Bạn là một chuyên gia giáo dục Việt Nam. Hãy giúp tôi soạn nội dung cho phần "${section}" của kế hoạch bài dạy dựa trên thông tin sau: ${prompt}. Hãy viết chi tiết, sư phạm và phù hợp với chương trình giáo dục phổ thông mới. 
        LƯU Ý: Nếu đây là phần hoạt động dạy học, hãy sử dụng "GV" hoặc lược bỏ chủ ngữ cho các mô tả hành động. Tránh các cụm từ lặp lại như "Cô nói:", "Cô hỏi:". Sử dụng đúng danh xưng giáo viên trong các câu nói trực tiếp với học sinh.`,
      });
    } catch (modelErr: any) {
      const msg = modelErr?.message || "";
      if (msg.includes("404") || msg.includes("not available") || msg.includes("NOT_FOUND")) {
        response = await ai.models.generateContent({
          model: "gemini-3.8-flash",
          contents: `Bạn là một chuyên gia giáo dục Việt Nam. Hãy giúp tôi soạn nội dung cho phần "${section}" của kế hoạch bài dạy dựa trên thông tin sau: ${prompt}. Hãy viết chi tiết, sư phạm và phù hợp với chương trình giáo dục phổ thông mới. 
          LƯU Ý: Nếu đây là phần hoạt động dạy học, hãy sử dụng "GV" hoặc lược bỏ chủ ngữ cho các mô tả hành động. Tránh các cụm từ lặp lại như "Cô nói:", "Cô hỏi:". Sử dụng đúng danh xưng giáo viên trong các câu nói trực tiếp với học sinh.`,
        });
      } else {
        throw modelErr;
      }
    }
    return response.text || "Không có kết quả trả về.";
  } catch (error) {
    console.error("Error generating content:", error);
    return "Đã có lỗi xảy ra khi gọi AI.";
  }
}

export async function generateFullLessonPlan(data: { subject: string; grade: string; topic: string; teacherGender: string }) {
  try {
    const ai = getAI();
    const contents = `Bạn là một chuyên gia giáo dục Việt Nam. Hãy soạn một kế hoạch bài dạy chi tiết cho môn ${data.subject}, lớp ${data.grade}. ${data.topic ? `Chủ đề: ${data.topic}.` : 'Hãy xác định chủ đề từ nội dung tài liệu.'} Danh xưng giáo viên: ${data.teacherGender}.
      LƯU Ý QUAN TRỌNG: 
      - Trong các hoạt động dạy học, hãy sử dụng "GV" hoặc lược bỏ chủ ngữ cho các mô tả hành động. 
      - Tránh các cụm từ lặp lại như "Cô nói:", "Cô hỏi:", "Cô kết luận:". 
      - Sử dụng đúng danh xưng "${data.teacherGender}" trong các câu nói trực tiếp với học sinh (Ví dụ: "${data.teacherGender} mời các em...", "${data.teacherGender} hãy cùng các em..."). 
      - Tuyệt đối không sử dụng "thầy/cô", hãy sử dụng đúng danh xưng "${data.teacherGender}".
      Trả về kết quả dưới dạng JSON với cấu trúc sau:
      {
        "objectives": "Mục tiêu bài học (Kiến thức, Năng lực, Phẩm chất)",
        "materials": "Thiết bị dạy học và học liệu",
        "introduction": "Hoạt động Mở đầu (Khởi động)",
        "activities": "Hoạt động Hình thành kiến thức mới / Luyện tập / Vận dụng",
        "conclusion": "Hoạt động Kết thúc / Củng cố",
        "assessment": "Đánh giá kết quả học tập"
      }`;
    let response;
    try {
      response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents,
        config: {
          responseMimeType: "application/json"
        }
      });
    } catch (modelErr: any) {
      const msg = modelErr?.message || "";
      if (msg.includes("404") || msg.includes("not available") || msg.includes("NOT_FOUND")) {
        response = await ai.models.generateContent({
          model: "gemini-3.8-flash",
          contents,
          config: {
            responseMimeType: "application/json"
          }
        });
      } else {
        throw modelErr;
      }
    }
    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Error generating full plan:", error);
    return null;
  }
}
