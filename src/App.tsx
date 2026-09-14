/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useMemo } from 'react';
import { 
  BookOpen, 
  BookMarked,
  Upload, 
  FileText, 
  Sparkles, 
  Loader2, 
  Download, 
  Copy, 
  Check,
  ChevronRight,
  GraduationCap,
  Image as ImageIcon,
  X,
  File as FileIcon,
  Presentation,
  RotateCcw,
  Plus,
  Trash2,
  Files,
  RefreshCw,
  Layers,
  Wand2,
  Save,
  Share2,
  Cloud,
  HardDrive,
  ExternalLink,
  CheckCircle2,
  Send,
  MessageSquarePlus,
  Key,
  Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import mammoth from 'mammoth';
import { generateLessonPlan, regenerateActivitySection, LessonPlanRequest, hasGeminiApiKey, getGeminiApiKeyStatus, setGeminiApiKey, formatVietnameseDate } from './services/geminiService';
import { exportToDocx, exportPromptMarkdownToDocx } from './utils/docxExport';
import { PromptIllustrator } from './components/PromptIllustrator';
import { ApiKeyModal } from './components/ApiKeyModal';

interface AttachedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  data: string; // base64 for images/pdf, or extracted text for word
  preview?: string; // for images
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function removeAsterisksFromPlan(text: string): string {
  if (!text) return text;

  // 1. Chuyển đổi các thẻ span chứa **text** thành span có font-weight: bold
  text = text.replace(/<span([^>]*)>\s*\*+([^*<]+?)\*+\s*<\/span>/gi, (match, attr, content) => {
    let style = attr;
    if (!/font-weight/i.test(style)) {
      if (/style\s*=\s*"([^"]*)"/i.test(style)) {
        style = style.replace(/style\s*=\s*"([^"]*)"/i, 'style="$1; font-weight: bold;"');
      } else {
        style = `${style} style="font-weight: bold;"`;
      }
    }
    return `<span${style}>${content.trim()}</span>`;
  });

  // 2. Chuyển đổi markdown bold ***text*** thành <b><em>text</em></b>
  text = text.replace(/\*\*\*([^*\n\r]+?)\*\*\*/g, '<b><em>$1</em></b>');

  // 3. Chuyển đổi markdown bold **text** thành <b>text</b>
  text = text.replace(/\*\*([^*\n\r]+?)\*\*/g, '<b>$1</b>');

  // 4. Nếu có dấu * ở đầu dòng dùng làm bullet: "* text" -> "• text"
  text = text.replace(/(^|[\n\r]|<br\s*\/?>)\s*\*\s+/g, '$1• ');

  // 5. Nếu có dấu * trong phép tính nhân (tiểu học): "3 * 4" -> "3 × 4"
  text = text.replace(/(\d+)\s*\*\s*(\d+)/g, '$1 × $2');

  // 6. Chuyển đổi markdown italic *text* thành <em>text</em>
  text = text.replace(/(^|[\s>(])\*([^*\n\r<]+?)\*([\s<),.!]|$)/g, '$1<em>$2</em>$3');

  // 7. Xóa sạch mọi ký tự '*' còn sót lại ở bất kỳ vị trí nào trong Kế hoạch bài dạy
  text = text.replace(/\*/g, '');

  return text;
}

export function formatSectionI(text: string, teacherGender: string = 'Thầy'): string {
  if (!text) return text;

  // 1. Chuẩn hóa tiêu đề Mục I và XÓA BỎ HOÀN TOÀN câu mô tả trong ngoặc đơn bên dưới
  text = text.replace(
    /(<span style="color:\s*red[^"]*">[\s\S]*?I\.\s*YÊU CẦU CẦN ĐẠT:[\s\S]*?<\/span>)(?:\s*<br\s*\/?>|\s*[\r\n])*(?:\s*\([^)]*\)\s*(?:<br\s*\/?>|\n)*)*/gi,
    '$1<br />\n'
  );

  text = text.replace(
    /(^|[\n\r]|<br\s*\/?>)(\s*\*?\*?I\.\s*YÊU CẦU CẦN ĐẠT:\*?\*?)(?:\s*<br\s*\/?>|\s*[\r\n])*(?:\s*\([^)]*\)\s*(?:<br\s*\/?>|\n)*)*/gi,
    (match, p1, p2) => {
      if (p2.includes('<span style="color: red')) return match;
      return `${p1}<span style="color: red; font-weight: bold;">I. YÊU CẦU CẦN ĐẠT:</span><br />\n`;
    }
  );

  // Xóa triệt để câu chú thích người dùng yêu cầu bỏ nếu còn sót ở bất kỳ vị trí nào
  text = text.replace(
    /\(Nêu cụ thể học sinh thực hiện được việc gì[^)]*\)\s*(?:<br\s*\/?>|\n)?/gi,
    ''
  );

  // 2. Chuẩn hóa 6 đề mục con theo đúng cấu trúc ảnh mẫu:
  // Mục 1: - Qua bài học, học sinh thực hiện được:
  text = text.replace(
    /(^|[\n\r]|<br\s*\/?>)(?:<span[^>]*>)?(?:\*\*)?(?:-\s*)?(?:Qua bài học,\s*học sinh thực hiện được|Học sinh thực hiện được|Yêu cầu cần đạt về kiến thức,?\s*kỹ năng)(?::)?(?:\*\*)?(?:<\/span>)?(?:\s*<br\s*\/?>|\s*[\r\n])+/gim,
    `$1<span style="color: blue; font-weight: bold;">- Qua bài học, học sinh thực hiện được:</span><br />\n`
  );

  // Mục 2: - Học sinh vận dụng bài học trong thực tế cuộc sống:
  text = text.replace(
    /(^|[\n\r]|<br\s*\/?>)(?:<span[^>]*>)?(?:\*\*)?(?:-\s*)?(?:Học sinh vận dụng bài học trong thực tế cuộc sống|Vận dụng bài học trong thực tế cuộc sống|Học sinh vận dụng thực tế|Vận dụng thực tế cuộc sống)(?::)?(?:\*\*)?(?:<\/span>)?(?:\s*<br\s*\/?>|\s*[\r\n])+/gim,
    `$1<span style="color: blue; font-weight: bold;">- Học sinh vận dụng bài học trong thực tế cuộc sống:</span><br />\n`
  );

  // Mục 3: - Giúp các em hình thành và phát triển phẩm chất:
  text = text.replace(
    /(^|[\n\r]|<br\s*\/?>)(?:<span[^>]*>)?(?:\*\*)?(?:-\s*)?(?:Giúp các em hình thành và phát triển phẩm chất|Hình thành và phát triển phẩm chất|Phẩm chất chủ yếu|3\.\s*Phẩm chất)(?::)?(?:\*\*)?(?:<\/span>)?(?:\s*<br\s*\/?>|\s*[\r\n])+/gim,
    `$1<span style="color: blue; font-weight: bold;">- Giúp các em hình thành và phát triển phẩm chất:</span><br />\n`
  );

  // Mục 4: - Giúp các em hình thành và phát triển năng lực:
  text = text.replace(
    /(^|[\n\r]|<br\s*\/?>)(?:<span[^>]*>)?(?:\*\*)?(?:-\s*)?(?:Giúp các em hình thành và phát triển năng lực|Hình thành và phát triển năng lực|Phát triển năng lực)(?::)?(?:\*\*)?(?:<\/span>)?(?:\s*<br\s*\/?>|\s*[\r\n])+/gim,
    `$1<span style="color: blue; font-weight: bold;">- Giúp các em hình thành và phát triển năng lực:</span><br />\n`
  );

  // Xóa bỏ hoàn toàn mục "- Định hướng cụ thể mức độ đạt được cho học sinh tiếp thu chậm:" nếu còn sót lại ở dạng riêng biệt
  // (vì đã được gộp thành dấu bullet trong mục "- Qua bài học, học sinh thực hiện được:")
  text = text.replace(
    /(?:<br\s*\/?>|\n|^)(?:<span[^>]*>)?(?:\*\*)?(?:-\s*)?Định hướng cụ thể mức độ đạt được cho học sinh tiếp thu chậm(?::)?(?:\*\*)?(?:<\/span>)?(?:\s*<br\s*\/?>|\s*[\r\n])*(?:•[^\n\r<]*(?:<br\s*\/?>|\n)?)*(?=(?:<br\s*\/?>|\n)*(?:<span[^>]*>)?(?:\*\*)?(?:-\s*)?(?:Tích hợp|Học sinh vận dụng|Giúp các em|II\.))/gi,
    '\n'
  );

  // Mục 5: - Tích hợp:
  text = text.replace(
    /(^|[\n\r]|<br\s*\/?>)(?:<span[^>]*>)?(?:\*\*)?(?:-\s*)?Tích hợp(?::)?(?:\*\*)?(?:<\/span>)?(?:\s*<br\s*\/?>|\s*[\r\n])+/gim,
    `$1<span style="color: blue; font-weight: bold;">- Tích hợp:</span><br />\n`
  );

  // 3. SỬA LỖI KHOẢNG CÁCH BÊN DƯỚI MỤC "- Tích hợp:":
  // Xóa triệt để mọi thẻ <br>, dòng trống thừa giữa "- Tích hợp:" và các dấu bullet • bên dưới
  text = text.replace(
    /(<span style="color:\s*blue[^"]*">\s*(?:\*\*)?-\s*Tích hợp:(?:\*\*)?\s*<\/span>)(?:\s*<br\s*\/?>|\s*<p>\s*<\/p>|\s*[\r\n])+(?=(?:•|-|\*|\w))/gi,
    '$1<br />\n'
  );

  // Đảm bảo khoảng cách phía trước "- Tích hợp:" cũng không bị trống thừa
  text = text.replace(
    /(?:\s*<br\s*\/?>|\s*[\r\n]){2,}(?=<span style="color:\s*blue[^"]*">\s*(?:\*\*)?-\s*Tích hợp:(?:\*\*)?\s*<\/span>)/gi,
    '<br />\n'
  );

  // Xóa các câu chú thích thừa dạng gợi ý prompt nếu còn sót trong Mục I
  text = text.replace(
    /\((?:Soạn cụ thể|QUY TẮC BẮT BUỘC|Chi tiết yêu cầu|Lưu ý sư phạm)[^)]*\)\s*(?:<br\s*\/?>|\n)?/gi,
    ''
  );

  // Chuẩn hóa mục "Nội dung giáo dục AI:": Đảm bảo chỉ ghi nguyên văn cột "YCCĐ AI theo khung 2422" (Mã + Nội dung)
  // 1. Đảo lại thứ tự nếu AI ghi ngược: "Nội dung giáo dục AI: [Nội dung] (Mã)" -> "Nội dung giáo dục AI: Mã [Nội dung]"
  text = text.replace(
    /(•\s*Nội dung giáo dục AI:\s*)([^(<\n\r]+?)\s*\((2\.[A-Z]\d+\.\d+)\)\.?/gi,
    '$1$3 $2'
  );
  // 2. Loại bỏ tiền tố lời dẫn thừa nếu có dạng "• Nội dung giáo dục AI: Nhận diện / Tìm hiểu: 2.C1.1..."
  text = text.replace(
    /(•\s*Nội dung giáo dục AI:\s*)[^<\n\r]*?(2\.[A-Z]\d+\.\d+[\s\S]*?)(?=(?:<br\s*\/?>|•|\n|$))/gi,
    '$1$2'
  );

  // Dọn sạch chuỗi các thẻ <br> liên tiếp trong Mục I để các dòng cách nhau vừa vặn, không bị khoảng trắng lớn
  text = text.replace(
    /(I\.\s*YÊU CẦU CẦN ĐẠT:[\s\S]*?)(II\.\s*ĐỒ DÙNG DẠY HỌC)/gi,
    (match, sec1, sec2) => {
      let cleaned = sec1.replace(/(?:<br\s*\/?>\s*){2,}/gi, '<br />\n');
      cleaned = cleaned.replace(/\n\s*\n+/g, '\n');
      return cleaned + sec2;
    }
  );

  return text;
}

export function cleanSectionI(text: string, teacherGender: string = 'Thầy'): string {
  return formatSectionI(text, teacherGender);
}

export function cleanVBTContent(text: string): string {
  if (!text) return text;

  // 1. Loại bỏ hoàn toàn mục "2. Hoạt động Hình thành kiến thức mới..." nếu xuất hiện trong bảng markdown hoặc text
  text = text.replace(
    /\|[^\n\r|]*(?:2\.\s*)?Hoạt động Hình thành kiến thức mới[^\n\r|]*\|[^\n\r|]*\|(?:\r?\n)*/gim,
    ''
  );

  text = text.replace(
    /(?:<br\s*\/?>|\n|^)(?:[#*>\s-])*(?:2\.\s*)?Hoạt động Hình thành kiến thức mới[^\n\r<]*(?:<br\s*\/?>|\n)(?:[\s\S]*?)(?=(?:<br\s*\/?>|\n)(?:[#*>\s-])*(?:[23]\.\s*)?Hoạt động Luyện tập)/gim,
    '\n'
  );

  // 2. Loại bỏ dòng "ĐÁP ÁN / KẾT QUẢ ĐÚNG" nếu nằm ở Hàng 1 / ngay dưới tên bài tập trước Bước 1 hoặc trước Bước 2
  // Vì ở Bước 4: Kết luận, nhận định / Chốt kiến thức đã có phần ĐÁP ÁN chi tiết này
  text = text.replace(
    /(🔴\s*(?:\*\*)?BÀI TẬP\s*\d+:[^\n\r<*]+(?:\*\*|:)?)\s*(?:<br\s*\/?>|\n)\s*[-*•]?\s*(?:\*\*)?[-*•]?\s*ĐÁP ÁN\s*(?:\/|\s*-\s*)?\s*KẾT QUẢ ĐÚNG:?(?:\*\*)?[^\n\r<]*(?:<br\s*\/?>|\n)*/gim,
    '$1<br /><br />'
  );
  text = text.replace(
    /(🔴\s*(?:\*\*)?BÀI TẬP[^\n\r|]*?)\s*(?:<br\s*\/?>|\n)\s*[-*•]?\s*(?:\*\*)?ĐÁP ÁN\s*(?:\/|\s*-\s*)?\s*KẾT QUẢ ĐÚNG:?(?:\*\*)?[^\n\r<|]*?(?=(?:<br\s*\/?>|\n)*\s*(?:\*\*)?Bước 1:)/gim,
    '$1<br /><br />'
  );

  // 3. Loại bỏ các dấu ngoặc vuông trong nội dung tích hợp (NLS, AI, QCN, QP-AN, PCCC, Mizuiku, ĐĐLS)
  text = text.replace(/(•\s*Tích hợp[^\n\r<]*)/gi, (m) => m.replace(/\[/g, '').replace(/\]/g, ''));
  text = text.replace(/(•\s*Nội dung giáo dục AI:[^\n\r<]*)/gi, (m) => m.replace(/\[/g, '').replace(/\]/g, ''));
  text = text.replace(/\[(Tích hợp\s*[^\]]+)\]/gi, '$1');
  text = text.replace(/\[(Nội dung giáo dục AI\s*[^\]]+)\]/gi, '$1');

  // 4. Chuẩn hóa đánh số: Hoạt động Luyện tập VBT luôn mang số 2 (do bỏ qua mục 2 Hình thành kiến thức mới)
  text = text.replace(
    /(\|\s*(?:\*\*)?)3\.\s*Hoạt động Luyện tập - Thực hành VBT/gim,
    '$12. Hoạt động Luyện tập - Thực hành VBT'
  );

  // Hoạt động Vận dụng & Đánh giá luôn mang số 3
  text = text.replace(
    /(\|\s*(?:\*\*)?)4\.\s*Hoạt động Vận dụng & Đánh giá/gim,
    '$13. Hoạt động Vận dụng & Đánh giá'
  );

  // 5. Chuẩn hóa mục Phẩm chất theo TT 27/2020/TT-BGDĐT:
  // - Tuyệt đối không được ghi "Không có", loại bỏ bất kỳ dòng nào ghi "Không có" ở mục phẩm chất
  // - Bỏ các dòng chú thích trong ngoặc đơn nếu có
  text = text.replace(
    /(<span style="color:\s*blue[^"]*">\s*(?:\*\*)?-\s*Giúp các em hình thành và phát triển phẩm chất:(?:\*\*)?\s*<\/span>[\s\S]*?)(?=(?:<span style="color:\s*blue[^"]*">\s*(?:\*\*)?-\s*Giúp các em hình thành và phát triển năng lực:|<span style="color:\s*blue[^"]*">\s*(?:\*\*)?-\s*Tích hợp:|<span style="color:\s*red[^"]*">[\s\S]*?II\.|$))/gi,
    (section) => {
      let cleaned = section.replace(
        /\((?:QUY ĐỊNH BẮT BUỘC THEO THÔNG TƯ 27|QUY ĐỊNH VỀ PHẨM CHẤT|LÀM RÕ CÁC PHẨM CHẤT)[^)]*\)\s*(?:<br\s*\/?>|\n)?/gi,
        ''
      );
      // Xóa triệt để các dòng phẩm chất ghi "không có" hoặc "không áp dụng"
      cleaned = cleaned.replace(
        /(?:<br\s*\/?>|\n)?\s*•\s*(?:(?:Yêu nước|Nhân ái|Chăm chỉ|Trung thực|Trách nhiệm)[^:\n\r<]*:\s*(?:không có|Không có|không|Không|không áp dụng|Không áp dụng|chưa có|Chưa có)|(?:không có|Không có|không áp dụng))[^\n\r<]*/gi,
        ''
      );
      // Nếu là mẫu cũ 1 dòng gộp, nâng cấp chuẩn hóa thành từng phẩm chất theo TT 27 (bỏ qua Yêu nước nếu bài không có)
      if (cleaned.includes('Chăm chỉ làm bài, trung thực trong học tập, cẩn thận, trách nhiệm')) {
        cleaned = `<span style="color: blue; font-weight: bold;">- Giúp các em hình thành và phát triển phẩm chất:</span><br />\n• Chăm chỉ: Tự giác hoàn thành các bài tập trong VBT, kiên trì và tích cực rèn luyện kỹ năng.<br />\n• Trung thực: Thật thà trong học tập, tự giác làm bài và đối chiếu kết quả chữa bài trung thực.<br />\n• Trách nhiệm: Có ý thức giữ gìn Vở bài tập sạch đẹp, cẩn thận khi tính toán và hoàn thành nhiệm vụ được giao.<br />\n• Nhân ái: Biết lắng nghe, tôn trọng và hỗ trợ bạn trong hoạt động đôi bạn cùng tiến khi chữa bài.<br />\n`;
      }
      return cleaned;
    }
  );

  text = repairSectionIIITable(text);
  text = applyVBTQuestionAnswerColors(text);
  return text;
}

export function applyVBTQuestionAnswerColors(text: string): string {
  if (!text) return text;

  // 1. TẤT CẢ CÁC ĐÁP ÁN / KẾT QUẢ ĐÚNG CỦA BÀI TẬP VBT -> TÔ MÀU ĐỎ
  // Tìm khối: **ĐÁP ÁN / KẾT QUẢ ĐÚNG:** ... (hoặc **ĐÁP ÁN:**, **KẾT QUẢ:**...)
  text = text.replace(
    /((?:[-*•]\s*)?\*\*(?:[-*•]\s*)?(?:ĐÁP ÁN\s*(?:\/|\s*-\s*)?\s*KẾT QUẢ(?:\s*ĐÚNG)?|ĐÁP ÁN(?:\s*ĐÚNG)?|KẾT QUẢ(?:\s*ĐÚNG)?):?\*\*[:\s]*)([\s\S]*?)(?=(?:<br\s*\/?>|\n)\s*[-*•]\s*(?:\*\*)?[A-ZÀ-Ỹ0-9]|(?:<br\s*\/?>|\n)*\s*\||$)/gi,
    (match, prefix, ansContent) => {
      // Nếu đã có màu đỏ thì giữ nguyên
      if (/style=["'][^"']*color:\s*(?:red|#dc2626)/i.test(ansContent)) {
        return match;
      }
      const leadMatch = ansContent.match(/^(\s*(?:<br\s*\/?>|\n)\s*)+/);
      const leading = leadMatch ? leadMatch[0] : '';
      const trailMatch = ansContent.match(/(\s*(?:<br\s*\/?>|\n)\s*)+$/);
      const trailing = trailMatch ? trailMatch[0] : '';
      let body = ansContent.slice(leading.length, ansContent.length - (trailing ? trailing.length : 0)).trim();
      if (!body) return match;
      // Loại bỏ thẻ span blue nếu lỡ bị bọc màu xanh trước đó
      body = body.replace(/<span style="color:\s*blue">([\s\S]*?)<\/span>/gi, '$1');
      return `${prefix}${leading}<span style="color: red; font-weight: bold;">${body}</span>${trailing}`;
    }
  );

  // Tô màu đỏ cho kết quả khi viết bảng con của HS (VD: - Viết bảng con kết quả: 39 hoặc - Viết bảng con: 39)
  text = text.replace(
    /((?:viết|ghi)\s*bảng con(?:\s*kết quả)?:\s*)([^\n\r<|]+)/gi,
    (match, p1, p2) => {
      if (/style=["'][^"']*color:/i.test(p2)) return match;
      const trimmed = p2.trim();
      if (!trimmed) return match;
      return `${p1}<span style="color: red; font-weight: bold;">${trimmed}</span>`;
    }
  );

  // 2. CÂU HỎI CỦA GIÁO VIÊN -> TÔ MÀU XANH
  // 2.1. Đặt câu hỏi, đọc câu hỏi, đưa câu hỏi, nêu câu hỏi: "..."
  text = text.replace(
    /((?:đặt|nêu|đọc|đưa|hỏi)?\s*câu hỏi(?:\s*cụ thể|\s*phân tích|\s*gợi mở|\s*củng cố)?:\s*)(["“][^"”\n\r<|]+["”])/gi,
    (match, p1, p2) => {
      if (/style=["'][^"']*color:/i.test(p2)) return match;
      return `${p1}<span style="color: blue">${p2}</span>`;
    }
  );

  // 2.2. GV / Thầy / Cô hỏi, đặt câu hỏi...: "..."
  text = text.replace(
    /((?:(?:[A-ZÀ-Ỹa-zà-ỹ]+|\bGV|\bGiáo viên|\bThầy|\bCô)\s+)?(?:đặt câu hỏi|hỏi|hỏi học sinh|đọc câu hỏi|nêu câu hỏi):\s*)(["“][^"”\n\r<|]+["”])/gi,
    (match, p1, p2) => {
      if (/style=["'][^"']*color:/i.test(p2)) return match;
      return `${p1}<span style="color: blue">${p2}</span>`;
    }
  );

  // 2.3. Củng cố bài học: "..."
  text = text.replace(
    /(Củng cố bài học:\s*)(["“][^"”\n\r<|]+["”])/gi,
    (match, p1, p2) => {
      if (/style=["'][^"']*color:/i.test(p2)) return match;
      return `${p1}<span style="color: blue">${p2}</span>`;
    }
  );

  // 2.4. Câu hỏi kết thúc bằng dấu hỏi (?) trong ngoặc kép sau dấu hai chấm
  text = text.replace(
    /(:\s*)(["“][^"”\n\r<|]*\?[^"”\n\r<|]*["”])/gi,
    (match, p1, p2) => {
      if (/style=["'][^"']*color:/i.test(p2)) return match;
      return `${p1}<span style="color: blue">${p2}</span>`;
    }
  );

  // 3. CÂU TRẢ LỜI CỦA HỌC SINH -> TÔ MÀU XANH
  // 3.1. Trả lời: "..." hoặc Trả lời câu hỏi...: "..."
  text = text.replace(
    /((?:[-*•]\s*)?(?:(?:1-2\s*)?HS|(?:1-2\s*)?Học sinh)?\s*Trả lời(?:\s*câu hỏi(?:\s*của\s*[^:\n\r<|]+)?)?:\s*)(["“][^"”\n\r<|]+["”])/gi,
    (match, p1, p2) => {
      if (/style=["'][^"']*color:/i.test(p2)) return match;
      return `${p1}<span style="color: blue">${p2}</span>`;
    }
  );

  // 3.2. Trả lời không có ngoặc kép: Trả lời: [nội dung trả lời]
  text = text.replace(
    /((?:[-*•]\s*)?(?:(?:1-2\s*)?HS|(?:1-2\s*)?Học sinh)?\s*Trả lời(?:\s*câu hỏi(?:\s*của\s*[^:\n\r<|]+)?)?:\s*)([^\n\r<|"]+?)(?=\s*<br|\s*[\r\n]|\s*\||$)/gi,
    (match, p1, p2) => {
      if (/style=["'][^"']*color:/i.test(p2)) return match;
      const trimmed = p2.trim();
      if (!trimmed || trimmed.startsWith('<')) return match;
      return `${p1}<span style="color: blue">${trimmed}</span>`;
    }
  );

  // 3.3. HS trình bày: "..."
  text = text.replace(
    /((?:[-*•]\s*)?(?:1-2\s*)?HS\s*trình bày(?:\s*kết quả)?:\s*)(["“][^"”\n\r<|]+["”])/gi,
    (match, p1, p2) => {
      if (/style=["'][^"']*color:/i.test(p2)) return match;
      return `${p1}<span style="color: blue">${p2}</span>`;
    }
  );

  // 3.4. Nhận xét của học sinh về bài bạn: "..."
  text = text.replace(
    /((?:nhận xét bài làm của bạn|nhận xét bài của bạn|nhận xét bạn):\s*)(["“][^"”\n\r<|]+["”])/gi,
    (match, p1, p2) => {
      if (/style=["'][^"']*color:/i.test(p2)) return match;
      return `${p1}<span style="color: blue">${p2}</span>`;
    }
  );

  // 3.5. Trả lời câu hỏi liên hệ thực tế
  text = text.replace(
    /((?:Trả lời câu hỏi liên hệ thực tế|liên hệ thực tế):\s*)(["“]?[^"”\n\r<|]+["”]?)(?=\s*<br|\s*[\r\n]|\s*\||$)/gi,
    (match, p1, p2) => {
      if (/style=["'][^"']*color:/i.test(p2)) return match;
      const trimmed = p2.trim();
      if (!trimmed || trimmed.startsWith('<')) return match;
      return `${p1}<span style="color: blue">${trimmed}</span>`;
    }
  );

  return text;
}

function isTableHeaderRow(cell1: string, cell2: string): boolean {
  if (!cell1 && !cell2) return false;
  const c1 = (cell1 || '').replace(/<[^>]+>/g, '').replace(/[*_#:`~-]/g, '').trim().toLowerCase();
  const c2 = (cell2 || '').replace(/<[^>]+>/g, '').replace(/[*_#:`~-]/g, '').trim().toLowerCase();

  const isTeacherCol = (
    c1.includes('giáo viên') || 
    c1.includes('hoạt động gv') || 
    c1 === 'gv' ||
    c1 === 'hoạt động dạy' ||
    c1.includes('hoạt động dạy học của giáo viên') ||
    c1.includes('hoạt động của giáo viên') ||
    c1.includes('hoạt động giáo viên') ||
    c1.includes('hoạt động của thầy') ||
    c1.includes('hoạt động của cô')
  );
  
  const isStudentCol = (
    c2.includes('học sinh') || 
    c2.includes('hoạt động hs') || 
    c2 === 'hs' ||
    c2 === 'hoạt động học' ||
    c2.includes('hoạt động học của học sinh') ||
    c2.includes('hoạt động của học sinh') ||
    c2.includes('hoạt động học sinh')
  );

  return isTeacherCol && isStudentCol;
}

function isSeparatorRow(line: string): boolean {
  const stripped = (line || '').replace(/<[^>]+>/g, '').replace(/[|\s:-]/g, '');
  return stripped.length === 0;
}

export function fixSectionIIITableBlock(block: string): string {
  // 1. Tách dòng tiêu đề của Mục III
  const headerMatch = block.match(/^((?:<span[^>]*>\s*\*?\*?|###\s*|\*\*\s*|\n)*\s*III\.\s*CÁC HOẠT ĐỘNG DẠY HỌC CHỦ YẾU:?(?:<\/span>|\*\*)*(?:<br\s*\/?>|\n)*)/i);
  const secTitle = '<span style="color: red; font-weight: bold;">III. CÁC HOẠT ĐỘNG DẠY HỌC CHỦ YẾU:</span><br />\n';
  let body = headerMatch ? block.slice(headerMatch[0].length) : block;

  const tableHeader = '| <span style="color: blue">**Hoạt động của Giáo viên**</span> | <span style="color: blue">**Hoạt động của Học sinh**</span> |\n| :--- | :--- |';

  // Lọc bỏ bất kỳ tiêu đề bảng cũ bị trùng lặp hoặc phân cách cũ (bất kể chữ hoa/thường, có hay không có từ "của", thẻ span)
  body = body.replace(/\|\s*(?:<[^>]*>)?\s*\*?\*?Hoạt động\s*(?:dạy học\s*)?(?:của\s*)?(?:Giáo viên|GV|Thầy|Cô)[\s\S]*?\|\s*(?:<[^>]*>)?\s*\*?\*?Hoạt động\s*(?:học\s*)?(?:của\s*)?(?:Học sinh|HS)[\s\S]*?\|(?:\r?\n)*/gi, '');
  body = body.replace(/\|\s*(?:<[^>]*>)?\s*\*?\*?(?:Giáo viên|GV)\s*\*?\*?(?:<\/[^>]*>)?\s*\|\s*(?:<[^>]*>)?\s*\*?\*?(?:Học sinh|HS)\s*\*?\*?(?:<\/[^>]*>)?\s*\|(?:\r?\n)*/gi, '');
  body = body.replace(/\|\s*:?-+:?\s*\|\s*:?-+:?\s*\|(?:\r?\n)*/gi, '');

  // Sửa lỗi dính liền '| |' giữa hai hàng của bảng khi thiếu dấu xuống dòng
  body = body.replace(/\|\s*\|\s*(?=(?:<b>|\*\*|<span|<div|\d+\.))/gi, '|\n| ');

  const rawLines = body.split('\n').map(l => l.trim()).filter(Boolean);
  const processedRows: string[] = [];

  let currentRowCells: string[] = [];

  const flushCurrentRow = () => {
    if (currentRowCells.length === 0) return;
    if (currentRowCells.length === 1) {
      processedRows.push(`| ${currentRowCells[0]} | |`);
    } else {
      const left = currentRowCells[0];
      const right = currentRowCells.slice(1).join('<br />');
      if (!isTableHeaderRow(left, right)) {
        processedRows.push(`| ${left} | ${right} |`);
      }
    }
    currentRowCells = [];
  };

  for (let i = 0; i < rawLines.length; i++) {
    let line = rawLines[i];

    // Bỏ qua dòng phân cách bảng markdown (ví dụ: | :--- | :--- |)
    if (isSeparatorRow(line)) {
      continue;
    }

    // Dòng bắt đầu bằng '|' và kết thúc bằng '|'
    if (line.startsWith('|') && line.endsWith('|')) {
      flushCurrentRow();
      const rawCells = line.split('|').map(c => c.trim());
      const contentCells = rawCells.slice(1, -1);

      if (contentCells.length >= 2) {
        const left = contentCells[0];
        const right = contentCells.slice(1).filter(c => c.length > 0).join('<br />');

        // Bỏ qua tiêu đề cột bị lặp lại (ví dụ: HOẠT ĐỘNG GIÁO VIÊN | HOẠT ĐỘNG HỌC SINH)
        if (isTableHeaderRow(left, right)) {
          continue;
        }

        processedRows.push(`| ${left} | ${right} |`);
      } else if (contentCells.length === 1) {
        currentRowCells = [contentCells[0]];
      }
    } else if (line.startsWith('|')) {
      // Dòng bắt đầu bằng '|' nhưng không kết thúc bằng '|'
      flushCurrentRow();
      const rawCells = line.split('|').map(c => c.trim()).filter(Boolean);
      if (rawCells.length >= 2 && isTableHeaderRow(rawCells[0], rawCells[1])) {
        continue;
      }
      currentRowCells = rawCells;
    } else if (line.endsWith('|')) {
      // Dòng kết thúc bằng '|' nhưng không bắt đầu bằng '|' (nối tiếp vào cột Học sinh)
      const cleaned = line.replace(/\|+$/, '').trim();
      if (currentRowCells.length === 1) {
        currentRowCells.push(cleaned);
        flushCurrentRow();
      } else if (currentRowCells.length > 1) {
        currentRowCells[currentRowCells.length - 1] += `<br />${cleaned}`;
        flushCurrentRow();
      } else {
        processedRows.push(`| | ${cleaned} |`);
      }
    } else {
      // Dòng text thường không có '|'
      if (/^(?:\*\*|<b>|<span[^>]*>)?\s*\d+\.\s*(?:Hoạt động|Khởi động|Khám phá|Luyện tập|Vận dụng|Mở đầu|Hình thành)/i.test(line)) {
        flushCurrentRow();
        processedRows.push(`| ${line} | |`);
      } else if (currentRowCells.length === 1) {
        currentRowCells.push(line);
      } else if (currentRowCells.length >= 2) {
        currentRowCells[currentRowCells.length - 1] += `<br />${line}`;
      } else {
        if (/^(?:GV|•\s*GV|-\s*GV|\+\s*GV)/i.test(line)) {
          currentRowCells = [line];
        } else if (/^(?:HS|•\s*HS|-\s*HS|\+\s*HS)/i.test(line)) {
          processedRows.push(`| | ${line} |`);
        } else {
          if (processedRows.length > 0) {
            const lastIdx = processedRows.length - 1;
            const lastRow = processedRows[lastIdx];
            const parts = lastRow.split('|').map(c => c.trim());
            if (parts.length >= 4) {
              if (parts[2]) {
                parts[2] += `<br />${line}`;
              } else {
                parts[2] = line;
              }
              processedRows[lastIdx] = `| ${parts[1]} | ${parts[2]} |`;
            } else {
              processedRows.push(`| ${line} | |`);
            }
          } else {
            processedRows.push(`| ${line} | |`);
          }
        }
      }
    }
  }

  flushCurrentRow();

  return `${secTitle.trim()}\n${tableHeader}\n${processedRows.join('\n')}\n\n`;
}

export function repairSectionIIITable(text: string): string {
  if (!text || !text.includes('III. CÁC HOẠT ĐỘNG DẠY HỌC CHỦ YẾU')) return text;

  // 1. Sửa lỗi dính liền '| |' giữa hai hàng của bảng khi thiếu dấu xuống dòng
  text = text.replace(/\|\s*\|\s*(?=(?:<b>|\*\*|<span|<div|\d+\.))/gi, '|\n| ');

  // 2. Tìm các phân đoạn Mục III (hỗ trợ nhiều tiết có TIET_SEPARATOR hoặc SLIDE_SEPARATOR)
  const sec3Regex = /(?:<span[^>]*>\s*\*?\*?|###\s*|\*\*\s*|^|\n)\s*III\.\s*CÁC HOẠT ĐỘNG DẠY HỌC CHỦ YẾU[\s\S]*?(?=(?:<span[^>]*>\s*\*?\*?IV\.\s*ĐIỀU CHỈNH|IV\.\s*ĐIỀU CHỈNH|---TIET_SEPARATOR---|---SLIDE_SEPARATOR---|$))/gi;

  return text.replace(sec3Regex, (sec3Match) => {
    return fixSectionIIITableBlock(sec3Match);
  });
}

export function cleanSGKContent(text: string): string {
  if (!text) return text;

  // 1. Loại bỏ triệt để nội dung phân hóa đối tượng học sinh (Học sinh tiếp thu chậm chỉ cần...) ở Mục I
  text = text.replace(
    /(?:^|[\n\r]|<br\s*\/?>)\s*(?:<span[^>]*>)?\s*[•\-*]?\s*Học sinh tiếp thu chậm[^\n\r<]*(?:<br\s*\/?>|\n|$)/gim,
    ''
  );
  text = text.replace(
    /(?:^|[\n\r]|<br\s*\/?>)\s*(?:<span[^>]*>)?\s*[•\-*]?\s*(?:-\s*)?Định hướng cụ thể mức độ đạt được cho học sinh tiếp thu chậm:[^<\n\r]*(?:<br\s*\/?>|\n)*(?:[•\-*]\s*[^<\n\r]*(?:<br\s*\/?>|\n)*)*/gim,
    ''
  );
  text = text.replace(
    /\(Học sinh tiếp thu chậm[^\)]*\)/gi,
    ''
  );

  // 2. Loại bỏ các từ khóa phân cấp rườm rà như "Bước 1, Bước 2, Bước 3, Bước 4..." trong phần III
  // Diễn tả các hoạt động liền mạch theo trình tự sư phạm thực chiến
  text = text.replace(
    /(?:\*\*)?Bước\s*\d+\s*(?:\([^)]*\))?\s*[:.-]?\s*(?:Chuyển giao nhiệm vụ|Giao nhiệm vụ|Thực hiện nhiệm vụ|Báo cáo,?\s*thảo luận|Kết luận,?\s*(?:nhận định|chốt kiến thức)[^:<\n\r|]*)?\s*(?::|-|\.)?\s*(?:\*\*)?\s*/gim,
    ''
  );
  text = text.replace(
    /\((?:Chia\s*4\s*bước|Triển khai\s*(?:chi tiết\s*)?tương tác\s*2\s*chiều\s*4\s*bước)[^\)]*\)/gim,
    ''
  );

  // 3. Loại bỏ các dấu ngoặc vuông trong nội dung tích hợp
  text = text.replace(/(•\s*Tích hợp[^\n\r<]*)/gi, (m) => m.replace(/\[/g, '').replace(/\]/g, ''));
  text = text.replace(/(•\s*Nội dung giáo dục AI:[^\n\r<]*)/gi, (m) => m.replace(/\[/g, '').replace(/\]/g, ''));
  text = text.replace(/\[(Tích hợp\s*[^\]]+)\]/gi, '$1');
  text = text.replace(/\[(Nội dung giáo dục AI\s*[^\]]+)\]/gi, '$1');

  // Dọn sạch khoảng cách thẻ <br> liên tiếp thừa (không thêm ký tự \n làm vỡ bảng)
  text = text.replace(/(<br\s*\/?>\s*){3,}/gi, '<br /><br />');

  // Sửa chữa cấu trúc bảng Mục III
  text = repairSectionIIITable(text);

  return text;
}

export function syncHeaderSubjectAndGrade(
  text: string,
  selectedSubject: string,
  selectedGrade?: string,
  currentPeriod?: string,
  totalPeriods?: string,
  mode?: 'new' | 'vbt' | 'upgrade',
  lessonDate?: string
): string {
  if (!text || !selectedSubject) return text;

  // 1. Trường hợp Môn trong thẻ td hoặc bảng header-meta-table
  const styledTdMonRegex = /(<td[^>]*>[\s\S]*?<span style="color:\s*blue">Môn:<\/span>\s*)(?:<span[^>]*>)?(?:\*\*)?([^<;*\n\r]+)(?:\*\*)?(?:<\/span>)?(?=\s*<\/td>)/gi;
  if (styledTdMonRegex.test(text)) {
    text = text.replace(styledTdMonRegex, `$1<span style="color: red; font-weight: bold;">${selectedSubject}</span>`);
  }

  // 2. Hợp nhất "Môn" và "Lớp" cùng 1 dòng theo chuẩn Công văn 2345: Môn: ...; Lớp: ...
  // A. Trường hợp Môn và Lớp trên 2 dòng riêng biệt (thẻ span):
  text = text.replace(
    /(<span style="color:\s*blue">Môn:<\/span>\s*(?:<span[^>]*>)?(?:\*\*)?)([^<\n\r]+?)(?:\*\*)?(?:<\/span>)?\s*(?:<br\s*\/?>|\n)+\s*(?:<span style="color:\s*blue">)?Lớp:(?:<\/span>)?\s*(?:<span[^>]*>)?(?:\*\*)?([^<\n\r]+?)(?:\*\*)?(?:<\/span>)?(?=\s*<br|\s*[\r\n]|$)/gi,
    (m, p1, oldMon, oldLop) => {
      const mon = (selectedSubject || oldMon).trim();
      const lop = (selectedGrade || oldLop).trim();
      return `<span style="color: blue">Môn:</span> <span style="color: red; font-weight: bold;">${mon}</span>; <span style="color: blue">Lớp:</span> ${lop}`;
    }
  );

  // B. Trường hợp Môn và Lớp trên 2 dòng riêng biệt (markdown thuần):
  text = text.replace(
    /(^|[\n\r]|<br\s*\/?>)\s*\*?\*?Môn\s*:\*?\*?\s*(?:<span[^>]*>)?\s*\*?\*?([^<\n\r;,]+?)(?:\*\*)?(?:<\/span>)?\s*(?:<br\s*\/?>|\n)+\s*\*?\*?Lớp\s*:\*?\*?\s*(?:<span[^>]*>)?\s*\*?\*?([^<\n\r]+?)(?:\*\*)?(?:<\/span>)?(?=\s*<br|\s*[\r\n]|$)/gim,
    (m, prefix, oldMon, oldLop) => {
      const mon = (selectedSubject || oldMon).trim();
      const lop = (selectedGrade || oldLop).trim();
      return `${prefix}<span style="color: blue">Môn:</span> <span style="color: red; font-weight: bold;">${mon}</span>; <span style="color: blue">Lớp:</span> ${lop}`;
    }
  );

  // C. Trường hợp Môn và Lớp đã cùng 1 dòng (với dấu , hoặc ;):
  text = text.replace(
    /(<span style="color:\s*blue">Môn:<\/span>\s*)(?:<span[^>]*>)?(?:\*\*)?([^<;*,\n\r]+)(?:\*\*)?(?:<\/span>)?(\s*[,;]\s*<span style="color:\s*blue">Lớp:<\/span>\s*)(?:<span[^>]*>)?(?:\*\*)?([^<\n\r]*?)(?:\*\*)?(?:<\/span>)?(?=\s*<br|\s*[\r\n]|$)/gi,
    (m, p1, oldMon, sep, oldLop) => {
      const mon = (selectedSubject || oldMon).trim();
      const lop = (selectedGrade || oldLop).trim();
      return `<span style="color: blue">Môn:</span> <span style="color: red; font-weight: bold;">${mon}</span>; <span style="color: blue">Lớp:</span> ${lop}`;
    }
  );

  text = text.replace(
    /(^|[\n\r]|<br\s*\/?>)\s*\*?\*?Môn\s*:\*?\*?\s*(?:<span[^>]*>)?\s*\*?\*?([^<;*,\n\r]+?)(?:\*\*)?(?:<\/span>)?\s*[,;]\s*\*?\*?Lớp\s*:\*?\*?\s*(?:<span[^>]*>)?\s*\*?\*?([^<\n\r]+?)(?:\*\*)?(?:<\/span>)?(?=\s*<br|\s*[\r\n]|$)/gim,
    (m, prefix, oldMon, oldLop) => {
      const mon = (selectedSubject || oldMon).trim();
      const lop = (selectedGrade || oldLop).trim();
      return `${prefix}<span style="color: blue">Môn:</span> <span style="color: red; font-weight: bold;">${mon}</span>; <span style="color: blue">Lớp:</span> ${lop}`;
    }
  );

  // D. Nếu còn dòng Môn riêng lẻ (chưa ghép được với Lớp):
  const styledSeparateMonRegex = /(<span style="color:\s*blue">Môn:<\/span>\s*)(?:<span[^>]*>)?(?:\*\*)?([^<;*,\n\r]+)(?:\*\*)?(?:<\/span>)?(?=\s*<br|\s*<\/td|\s*[\r\n]|$)/gi;
  if (styledSeparateMonRegex.test(text) && !text.includes('Lớp:</span>')) {
    text = text.replace(styledSeparateMonRegex, `$1<span style="color: red; font-weight: bold;">${selectedSubject}</span>${selectedGrade ? `; <span style="color: blue">Lớp:</span> ${selectedGrade}` : ''}`);
  }

  // E. Chuẩn hóa khối lớp nếu còn tồn tại dòng Lớp đơn lẻ:
  if (selectedGrade) {
    text = text.replace(
      /(<span style="color:\s*blue">Lớp:<\/span>\s*)(?:\.{3,}|(?:\*\*)?\d+(?:\*\*)?)/gi,
      `$1${selectedGrade}`
    );
    text = text.replace(
      /(Lớp:\s*)(?:\.{3,}|\d+)/gi,
      `$1${selectedGrade}`
    );
  }

  // 3. Hợp nhất "Tên bài học" và "Số tiết" cùng 1 dòng theo chuẩn Công văn 2345: Tên bài học: ...; Số tiết: ...
  if (currentPeriod) {
    const cur = currentPeriod;
    const tot = totalPeriods || cur;
    const soTietSnippet = `; <span style="color: blue">Số tiết:</span> ${cur} / ${tot} tiết`;

    // A. Thẻ span có tên bài học:
    text = text.replace(
      /(<span style="color:\s*blue">Tên bài (?:học|dạy):<\/span>\s*<span style="color:\s*red[^"]*">\s*(?:\*\*)?)([^<*\n\r]+?)(?:\*\*)?(\s*<\/span>)(?:\s*-\s*Tiết\s*\d+)?(?:\s*[,;]?\s*(?:<span[^>]*>)?\s*Số tiết:[^<\n\r]*(?:<\/span>)?)*(?=\s*<br|\s*[\r\n]|$)/gi,
      (match, p1, p2, p3) => `${p1}${p2.trim()}${p3} - Tiết ${cur}${soTietSnippet}`
    );

    // B. Dự phòng markdown không có thẻ span:
    text = text.replace(
      /(^|[\n\r]|<br\s*\/?>)(\s*\*?\*?Tên bài (?:học|dạy):\*?\*?\s*(?:<[^>]+>)*\s*\*?\*?)([^*,\n\r<;]+?)(?:\*\*)?(?:<\/[^>]+>)*(?:\s*-\s*Tiết\s*\d+)?(?:\s*[,;]?\s*Số tiết:[^<\n\r]*)?(?=\s*<br|\s*[\r\n]|$)/gim,
      (match, p1, p2, p3) => `${p1}<span style="color: blue">Tên bài học:</span> <span style="color: red; font-weight: bold;">${p3.trim()}</span> - Tiết ${cur}${soTietSnippet}`
    );

    // C. Xóa triệt để mọi dòng "Số tiết:" đứng riêng biệt bên dưới:
    text = text.replace(
      /(?:^|[\n\r]|<br\s*\/?>)\s*(?:<span[^>]*>)?\s*\*?\*?Số tiết:\*?\*?\s*(?:<\/span>)?\s*(?:<[^>]+>)*\s*[^<\n\r]+?(?:<\/[^>]+>)?(?=\s*<br|\s*[\r\n]|$)/gim,
      ''
    );
  } else {
    // Nếu chưa xác định currentPeriod: kéo dòng "Số tiết:" lên cùng dòng "Tên bài học" nếu đang ở 2 dòng riêng biệt
    // A. Thẻ span trên 2 dòng riêng biệt:
    text = text.replace(
      /(<span style="color:\s*blue">Tên bài (?:học|dạy):<\/span>[^<\n\r]*<\/span>(?:\s*-\s*Tiết\s*\d+)?)\s*(?:<br\s*\/?>|\n)+\s*(?:<span style="color:\s*blue">)?Số tiết:(?:<\/span>)?\s*([^<\n\r]+?)(?:<\/[^>]+>)?(?=\s*<br|\s*[\r\n]|$)/gi,
      (match, p1, p2) => `${p1}; <span style="color: blue">Số tiết:</span> ${p2.trim()}`
    );

    // B. Markdown thuần trên 2 dòng riêng biệt:
    text = text.replace(
      /(^|[\n\r]|<br\s*\/?>)(\s*\*?\*?Tên bài (?:học|dạy):\*?\*?[^<\n\r;]+?)\s*(?:<br\s*\/?>|\n)+\s*\*?\*?Số tiết:\*?\*?\s*([^<\n\r]+?)(?=\s*<br|\s*[\r\n]|$)/gim,
      (match, prefix, p1, p2) => `${prefix}${p1}; <span style="color: blue">Số tiết:</span> ${p2.trim()}`
    );
  }

  // Dọn dẹp các thẻ <br /> liên tiếp thừa do việc xóa dòng tạo ra
  text = text.replace(/(<br\s*\/?>\s*){3,}/gi, '<br />\n<br />\n');

  // 4. Chuẩn hóa dòng "Thời gian thực hiện:"
  const thoiGianText = lessonDate && lessonDate.trim()
    ? (lessonDate.includes('ngày') ? lessonDate.trim() : formatVietnameseDate(lessonDate))
    : 'ngày ... tháng ... năm 202...';

  const styledThoiGianRegex = /(<span style="color:\s*blue">Thời gian thực hiện:<\/span>\s*)(?:<span[^>]*>)?(?:\*\*)?(?:ngày\s*[\d\.]+\s*tháng\s*[\d\.]+\s*năm\s*[\d\.]+|[^\n\r<;]+)(?:\*\*)?(?:<\/span>)?(?=\s*<br|\s*<\/td|\s*[\r\n]|$)/gi;
  if (styledThoiGianRegex.test(text)) {
    text = text.replace(styledThoiGianRegex, `$1${thoiGianText}`);
  } else {
    const generalThoiGianRegex = /(^|[\n\r]|<br\s*\/?>)\s*\*?\*?(?:<span[^>]*>)?Thời gian thực hiện:\s*(?:<\/span>)?\*?\*?\s*(?:<[^>]+>)*\s*\*?\*?(?:ngày\s*[\d\.]+\s*tháng\s*[\d\.]+\s*năm\s*[\d\.]+|[^\n\r<]+?)(?:\*\*)?(?:<\/[^>]+>)*(?=\s*<br|\s*[\r\n]|$)/gim;
    if (generalThoiGianRegex.test(text)) {
      text = text.replace(generalThoiGianRegex, `$1<span style="color: blue">Thời gian thực hiện:</span> ${thoiGianText}`);
    } else if (text.includes('KẾ HOẠCH BÀI DẠY')) {
      // Nếu chưa có dòng Thời gian thực hiện, bổ sung ngay dưới dòng Tên bài học / Số tiết
      text = text.replace(
        /(<span style="color:\s*blue">Tên bài (?:học|dạy):<\/span>[^<\n\r]+?(?:<\/span>)?(?: - Tiết \d+)?(?:; <span style="color:\s*blue">Số tiết:<\/span>[^<\n\r]+?)?(?:\s*<br\s*\/?>)?)/i,
        `$1<br />\n<span style="color: blue">Thời gian thực hiện:</span> ${thoiGianText}`
      );
    }
  }

  // Làm sạch các câu chú thích trong ngoặc đơn ở Mục I
  text = cleanSectionI(text);

  // Tự động làm sạch đối với bài dạy VBT
  if (mode === 'vbt' || text.includes('Hoạt động Luyện tập - Thực hành VBT') || text.includes('Vở bài tập') || text.includes('VBT')) {
    text = cleanVBTContent(text);
  } else if (mode === 'new' || (!text.includes('CHẾ ĐỘ YÊU CẦU: NÂNG CẤP') && !text.includes('NÂNG CẤP VÀ BỔ SUNG') && mode !== 'upgrade')) {
    // Tự động làm sạch đối với bài dạy SGK (dạy kiến thức mới: không phân hóa tiếp thu chậm, không Bước 1, Bước 2...)
    text = cleanSGKContent(text);
  }

  // Làm sạch mục IV: Tuyệt đối không để tên học sinh cụ thể
  text = cleanSectionIV(text);

  // Làm sạch toàn bộ lời thoại, gọi chữa bài, nhận xét của GV & HS: Tuyệt đối không để tên học sinh cụ thể
  text = cleanStudentNamesFromPlan(text);

  // Đảm bảo không chứa bất kỳ ký tự '*' nào trong KHBD
  text = removeAsterisksFromPlan(text);

  return text;
}

export function cleanStudentNamesFromPlan(text: string): string {
  if (!text) return text;

  // 1. Mời/gọi nhận xét bài làm của bạn (có hoặc không có Cô/Thầy/GV phía trước):
  // Ví dụ: "Cô mời bạn Nam nhận xét bài làm của bạn An." -> "Cô mời một bạn nhận xét bài làm của bạn trên bảng."
  // Ví dụ: "Mời bạn Lan nhận xét bài của bạn Nam trên bảng." -> "Mời một bạn nhận xét bài làm của bạn trên bảng."
  text = text.replace(
    /(?:(Cô|Thầy|GV)\s+)?([Mm]ời|[Cc]ho)\s+(?:bạn|em)\s+[A-ZÀ-Ỹ][a-zà-ỹ]*\s+nhận xét(?:,?\s*bổ sung)?(?:\s+(?:cho\s+)?bài(?:\s+làm)?\s+của\s+(?:bạn|em)\s+[A-ZÀ-Ỹ][a-zà-ỹ]*)?(?:\s+trên\s+bảng)?/g,
    (m, p1, p2) => {
      if (p1) return `${p1} mời một bạn nhận xét bài làm của bạn trên bảng`;
      return `${p2.charAt(0).toUpperCase() + p2.slice(1)} một bạn nhận xét bài làm của bạn trên bảng`;
    }
  );

  // 2. Nhận xét bài làm của bạn [Tên]:
  // Ví dụ: "nhận xét bài làm của bạn An" -> "nhận xét bài làm của bạn trên bảng"
  text = text.replace(
    /nhận xét\s+(?:cho\s+)?(?:bài(?:\s+làm)?\s+của\s+)(?:bạn|em)\s+[A-ZÀ-Ỹ][a-zà-ỹ]*/g,
    'nhận xét bài làm của bạn trên bảng'
  );

  // 3. Bài làm / kết quả / đáp án của học sinh cụ thể:
  // Ví dụ: "bài làm của bạn An" -> "bài làm của bạn"
  text = text.replace(
    /(bài(?:\s+làm)?|kết quả|đáp án|phần trình bày)\s+của\s+(?:bạn|em)\s+[A-ZÀ-Ỹ][a-zà-ỹ]*/g,
    '$1 của bạn'
  );

  // 4. Gọi từ 2 học sinh trở lên theo tên lên bảng:
  // Ví dụ: "Gọi bạn An và bạn Bình lên bảng chữa bài" -> "Gọi 2 HS lên bảng chữa bài"
  text = text.replace(
    /(?:(Cô|Thầy|GV)\s+)?([Gg]ọi|[Mm]ời)\s+(?:(?:\d+|hai|ba)\s+)?(?:em|bạn)\s+[A-ZÀ-Ỹ][a-zà-ỹ]*(?:\s*,\s*(?:bạn|em)?\s*[A-ZÀ-Ỹ][a-zà-ỹ]*)*\s+(?:và|với)\s+(?:bạn|em)?\s*[A-ZÀ-Ỹ][a-zà-ỹ]*\s+lên bảng(?:\s+chữa bài|\s+làm bài)?/g,
    'Gọi 2 HS lên bảng chữa bài'
  );

  // 5. Giáo viên gọi 1 học sinh theo tên làm hành động:
  // Ví dụ: "Cô mời bạn Nam lên bảng", "GV gọi bạn Hoa đọc đề bài" -> "Cô mời một bạn lên bảng", "GV gọi 1 HS đọc đề bài"
  text = text.replace(
    /(Cô|Thầy|GV)\s+([Mm]ời|[Gg]ọi)\s+(?:bạn|em)\s+[A-ZÀ-Ỹ][a-zà-ỹ]*\s+(lên bảng|trả lời|đọc|chia sẻ|chữa bài|trình bày|làm bài|thực hiện|phát biểu)/g,
    '$1 mời một bạn $3'
  );
  text = text.replace(
    /(?:^|[\n\r]|<br\s*\/?>|\s*-\s*)([Gg]ọi|[Mm]ời)\s+(?:bạn|em)\s+[A-ZÀ-Ỹ][a-zà-ỹ]*\s+(lên bảng|trả lời|đọc|chia sẻ|chữa bài|trình bày|làm bài|thực hiện|phát biểu)/gm,
    '- Gọi 1 HS $2'
  );

  // 6. Tuyên dương / khen ngợi học sinh theo tên:
  // Ví dụ: "Khen ngợi bạn An", "Tuyên dương em Nam" -> "Khen ngợi học sinh", "Tuyên dương học sinh"
  text = text.replace(
    /(khen ngợi|tuyên dương|động viên|khích lệ)\s+(?:bạn|em)\s+[A-ZÀ-Ỹ][a-zà-ỹ]*/gi,
    '$1 học sinh'
  );

  // 7. Cột hoạt động học sinh:
  // Ví dụ: "Bạn Nam nhận xét: ..." -> "- Một bạn nhận xét: ..."
  // "Bạn An trả lời: ..." -> "- Học sinh trả lời: ..."
  text = text.replace(
    /(?:^|[\n\r]|<br\s*\/?>|\s*-\s*)(?:Bạn|Em)\s+[A-ZÀ-Ỹ][a-zà-ỹ]*\s+(nhận xét|bổ sung)/gm,
    '- Một bạn $1'
  );
  text = text.replace(
    /(?:^|[\n\r]|<br\s*\/?>|\s*-\s*)(?:Bạn|Em)\s+[A-ZÀ-Ỹ][a-zà-ỹ]*\s+(trả lời|trình bày|chia sẻ|lên bảng|thực hiện|chữa bài)/gm,
    '- Học sinh $1'
  );

  // 8. Trong dấu ngoặc kép lời thoại: "Cô mời bạn Nam...", "Thầy mời bạn An..."
  text = text.replace(
    /(["'“])(Cô|Thầy|GV)\s+mời\s+(?:bạn|em)\s+[A-ZÀ-Ỹ][a-zà-ỹ]*/g,
    '$1$2 mời một bạn'
  );
  text = text.replace(
    /(["'“])([Mm]ời|[Gg]ọi)\s+(?:bạn|em)\s+[A-ZÀ-Ỹ][a-zà-ỹ]*/g,
    '$1Mời một bạn'
  );

  return text;
}

export function cleanSectionIV(text: string): string {
  if (!text) return text;

  // 1. Loại bỏ các ví dụ tên học sinh trong ngoặc đơn:
  // Ví dụ: (như em An, em Bình), (ví dụ: em An, em Bình), (như em A, em B)...
  text = text.replace(
    /\s*\((?:ví dụ:?\s*)?(?:như\s+)?(?:các\s+)?(?:em|học sinh)\s+[A-ZÀ-Ỹ][a-zà-ỹ]+(?:\s*,\s*(?:em\s+)?[A-ZÀ-Ỹ][a-zà-ỹ]+)*(?:\s*(?:và|với|cùng)\s*(?:em\s+)?[A-ZÀ-Ỹ][a-zà-ỹ]+)?\)/gi,
    ''
  );

  // 2. Loại bỏ các cụm tên học sinh đứng sau "như":
  // , như em An, em Bình...
  text = text.replace(
    /(?:,\s*)?(?:ví dụ:?\s*)?(?:như\s+)(?:các\s+)?(?:em|học sinh)\s+[A-ZÀ-Ỹ][a-zà-ỹ]+(?:\s*,\s*(?:em\s+)?[A-ZÀ-Ỹ][a-zà-ỹ]+)*(?:\s*(?:và|với|cùng)\s*(?:em\s+)?[A-ZÀ-Ỹ][a-zà-ỹ]+)?/gi,
    ''
  );

  // 3. Thay thế các câu nhắc trực tiếp tên học sinh cụ thể thành danh từ chung chuẩn sư phạm:
  text = text.replace(
    /(giúp đỡ|hướng dẫn|hỗ trợ|kèm cặp|quan tâm|nhắc nhở)\s+(?:em|học sinh)\s+[A-ZÀ-Ỹ][a-zà-ỹ]+(?:\s*,\s*(?:em\s+)?[A-ZÀ-Ỹ][a-zà-ỹ]+)*/gi,
    '$1 học sinh tiếp thu chậm'
  );

  // 4. Nếu Mục IV chứa placeholder ngoặc vuông hoặc chỉ có hướng dẫn AI:
  text = text.replace(
    /(<span style="color:\s*red[^"]*">\s*(?:\*\*)?IV\.\s*ĐIỀU CHỈNH SAU BÀI DẠY:?(?:\*\*)?\s*<\/span>)(?:\s*<br\s*\/?>|\s*[\r\n])+(?:\[[^\]]*\]|\([^)]*\))/gi,
    '$1<br />\n- Kế hoạch bài dạy thực hiện đúng tiến độ, học sinh tham gia tích cực và nắm chắc kiến thức.<br />\n- Tiếp tục theo dõi, tăng cường đồ dùng trực quan hỗ trợ nhóm học sinh tiếp thu chậm trong các tiết luyện tập tiếp theo.'
  );

  return text;
}

export default function App() {
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [apiKeyStatus, setApiKeyStatus] = useState(getGeminiApiKeyStatus());
  const [inlineApiKeyInput, setInlineApiKeyInput] = useState('');

  const refreshApiKeyStatus = () => {
    setApiKeyStatus(getGeminiApiKeyStatus());
  };

  const handleSaveInlineApiKey = () => {
    const trimmed = inlineApiKeyInput.trim();
    if (!trimmed) {
      alert('Vui lòng dán mã Google Gemini API Key.');
      return;
    }
    setGeminiApiKey(trimmed);
    refreshApiKeyStatus();
    setInlineApiKeyInput('');
  };

  const [mode, setMode] = useState<'new' | 'vbt' | 'upgrade'>('new');
  const [subject, setSubject] = useState('Toán');
  const [grade, setGrade] = useState('1');
  const [teacherGender, setTeacherGender] = useState<'Thầy' | 'Cô'>('Cô');

  // Bộ lưu trữ kết quả KHBD độc lập cho 3 chế độ soạn bài (SGK: null, VBT: null, NANG_CAO: null)
  const [results, setResults] = useState<{
    new: string | null;      // Từ SGK
    vbt: string | null;      // Từ VBT
    upgrade: string | null;  // Nâng cao
  }>({
    new: null,
    vbt: null,
    upgrade: null,
  });

  // Quản lý trạng thái đang tạo (generating) riêng cho từng chế độ
  const [generatingModes, setGeneratingModes] = useState<{
    new: boolean;
    vbt: boolean;
    upgrade: boolean;
  }>({
    new: false,
    vbt: false,
    upgrade: false,
  });

  // Quản lý tệp đính kèm độc lập cho từng chế độ
  const [modeFiles, setModeFiles] = useState<{
    new: AttachedFile[];
    vbt: AttachedFile[];
    upgrade: AttachedFile[];
  }>({
    new: [],
    vbt: [],
    upgrade: [],
  });

  // Quản lý thông tin bổ sung độc lập cho từng chế độ
  const [modeAdditionalInfo, setModeAdditionalInfo] = useState<{
    new: string;
    vbt: string;
    upgrade: string;
  }>({
    new: '',
    vbt: '',
    upgrade: '',
  });

  // Quản lý ngày dạy / thời gian thực hiện độc lập cho từng chế độ
  const [modeLessonDate, setModeLessonDate] = useState<{
    new: string;
    vbt: string;
    upgrade: string;
  }>({
    new: '',
    vbt: '',
    upgrade: '',
  });

  // Quản lý số tiết cần soạn và tổng số tiết độc lập cho từng chế độ
  const [modePeriods, setModePeriods] = useState<{
    new: { periods: string; totalPeriods: string };
    vbt: { periods: string; totalPeriods: string };
    upgrade: { periods: string; totalPeriods: string };
  }>({
    new: { periods: '1', totalPeriods: '1' },
    vbt: { periods: '1', totalPeriods: '1' },
    upgrade: { periods: '1', totalPeriods: '1' },
  });

  // Quản lý tiết đang chọn hiển thị độc lập cho từng chế độ
  const [modeSelectedPeriod, setModeSelectedPeriod] = useState<{
    new: string;
    vbt: string;
    upgrade: string;
  }>({
    new: '1',
    vbt: '1',
    upgrade: '1',
  });

  // Quản lý tab đang chọn (plan, slide, prompt) độc lập cho từng chế độ
  const [modeActiveTab, setModeActiveTab] = useState<{
    new: 'plan' | 'slide' | 'prompt';
    vbt: 'plan' | 'slide' | 'prompt';
    upgrade: 'plan' | 'slide' | 'prompt';
  }>({
    new: 'plan',
    vbt: 'plan',
    upgrade: 'plan',
  });

  // Các biến truy cập thuận tiện cho chế độ đang chọn hiện tại:
  const result = results[mode];
  const isGenerating = generatingModes[mode];
  const attachedFiles = modeFiles[mode];
  const additionalInfo = modeAdditionalInfo[mode];
  const lessonDate = modeLessonDate[mode];
  const periods = modePeriods[mode].periods;
  const totalPeriods = modePeriods[mode].totalPeriods;
  const selectedPeriod = modeSelectedPeriod[mode];
  const activeTab = modeActiveTab[mode];

  const setAttachedFiles = (updater: AttachedFile[] | ((prev: AttachedFile[]) => AttachedFile[])) => {
    setModeFiles(prev => ({
      ...prev,
      [mode]: typeof updater === 'function' ? updater(prev[mode]) : updater,
    }));
  };

  const setAdditionalInfo = (val: string) => {
    setModeAdditionalInfo(prev => ({ ...prev, [mode]: val }));
  };

  const setLessonDate = (val: string) => {
    setModeLessonDate(prev => ({ ...prev, [mode]: val }));
  };

  const setPeriods = (val: string) => {
    setModePeriods(prev => ({
      ...prev,
      [mode]: { ...prev[mode], periods: val },
    }));
  };

  const setTotalPeriods = (val: string) => {
    setModePeriods(prev => ({
      ...prev,
      [mode]: { ...prev[mode], totalPeriods: val },
    }));
  };

  const setSelectedPeriod = (val: string) => {
    setModeSelectedPeriod(prev => ({ ...prev, [mode]: val }));
  };

  const setActiveTab = (tab: 'plan' | 'slide' | 'prompt') => {
    setModeActiveTab(prev => ({ ...prev, [mode]: tab }));
  };

  const setResult = (val: string | null | ((prev: string | null) => string | null)) => {
    setResults(prev => ({
      ...prev,
      [mode]: typeof val === 'function' ? val(prev[mode]) : val,
    }));
  };

  const [isReadingFiles, setIsReadingFiles] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showShareToast, setShowShareToast] = useState(false);
  const [regeneratingActivity, setRegeneratingActivity] = useState<string | null>(null);
  const [activityToast, setActivityToast] = useState<string | null>(null);
  const [activityModal, setActivityModal] = useState<{
    isOpen: boolean;
    activityName: string;
    shortLabel: string;
  } | null>(null);
  const [customPrompt, setCustomPrompt] = useState<string>('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Nút 'Làm mới' chỉ xóa dữ liệu của chế độ đang chọn hiện tại
  const handleReset = () => {
    setModeAdditionalInfo(prev => ({ ...prev, [mode]: '' }));
    setModeFiles(prev => ({ ...prev, [mode]: [] }));
    setResults(prev => ({ ...prev, [mode]: null }));
    setModeLessonDate(prev => ({ ...prev, [mode]: '' }));
    setModePeriods(prev => ({ ...prev, [mode]: { periods: '1', totalPeriods: '1' } }));
    setModeSelectedPeriod(prev => ({ ...prev, [mode]: '1' }));
    setModeActiveTab(prev => ({ ...prev, [mode]: 'plan' }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Nút 'Bắt đầu Soạn bài' từ Empty State
  const handleStartDrafting = () => {
    if (attachedFiles.length === 0 && !additionalInfo.trim()) {
      alert(
        mode === 'upgrade' 
          ? "Vui lòng tải lên tệp Kế hoạch bài dạy cũ (Word, PDF hoặc Ảnh)." 
          : mode === 'vbt'
          ? "Vui lòng tải lên tài liệu Vở bài tập (VBT) hoặc nhập nội dung bài tập."
          : "Vui lòng tải lên ít nhất một tệp tài liệu bài học (Ảnh, PDF hoặc Word)."
      );
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
      return;
    }
    if (formRef.current) {
      formRef.current.requestSubmit();
    }
  };

  const processFile = (file: File): Promise<AttachedFile> => {
    return new Promise((resolve, reject) => {
      const fileType = file.type;
      const fileName = file.name;
      const fileId = `${fileName}_${file.size}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      if (fileType.startsWith('image/') || fileType === 'application/pdf') {
        const reader = new FileReader();
        reader.onloadend = () => {
          const resultStr = reader.result as string;
          const base64Data = resultStr.split(',')[1];
          resolve({
            id: fileId,
            name: fileName,
            size: file.size,
            type: fileType,
            data: base64Data,
            preview: fileType.startsWith('image/') ? resultStr : undefined
          });
        };
        reader.onerror = () => reject(new Error(`Lỗi khi đọc file "${fileName}"`));
        reader.readAsDataURL(file);
      } else if (
        fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        fileName.endsWith('.docx')
      ) {
        const reader = new FileReader();
        reader.onload = async (event) => {
          const arrayBuffer = event.target?.result as ArrayBuffer;
          try {
            const result = await mammoth.extractRawText({ arrayBuffer });
            resolve({
              id: fileId,
              name: fileName,
              size: file.size,
              type: 'text/plain', // Word extracted text
              data: result.value
            });
          } catch (error) {
            reject(new Error(`Không thể trích xuất văn bản từ file Word "${fileName}".`));
          }
        };
        reader.onerror = () => reject(new Error(`Lỗi khi đọc file Word "${fileName}"`));
        reader.readAsArrayBuffer(file);
      } else {
        reject(new Error(`Định dạng "${fileName}" không được hỗ trợ. Vui lòng chọn Ảnh, PDF hoặc Word (.docx).`));
      }
    });
  };

  const handleFiles = async (newFilesList: File[]) => {
    if (!newFilesList || newFilesList.length === 0) return;

    setIsReadingFiles(true);
    const existingSignatures = new Set(attachedFiles.map(f => `${f.name}_${f.size}`));
    const filesToProcess = newFilesList.filter(f => !existingSignatures.has(`${f.name}_${f.size}`));

    if (filesToProcess.length === 0) {
      setIsReadingFiles(false);
      return;
    }

    const results = await Promise.allSettled(filesToProcess.map(processFile));
    const successfullyAdded: AttachedFile[] = [];
    const errors: string[] = [];

    results.forEach((res) => {
      if (res.status === 'fulfilled') {
        successfullyAdded.push(res.value);
      } else {
        errors.push(res.reason?.message || 'Lỗi không xác định khi đọc tệp');
      }
    });

    if (successfullyAdded.length > 0) {
      setAttachedFiles(prev => [...prev, ...successfullyAdded]);
    }

    if (errors.length > 0) {
      alert(`Một số tệp không thể tải lên:\n${errors.join('\n')}`);
    }

    setIsReadingFiles(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await handleFiles(Array.from(e.target.files));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  const removeFile = (id: string) => {
    setAttachedFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject) {
      alert("Vui lòng chọn Môn học trước khi tiếp tục.");
      return;
    }
    if (!grade) {
      alert("Vui lòng chọn Khối lớp trước khi tiếp tục.");
      return;
    }
    if (attachedFiles.length === 0 && !additionalInfo.trim()) {
      alert(
        mode === 'upgrade' 
          ? "Vui lòng tải lên tệp Kế hoạch bài dạy cũ (Word, PDF hoặc Ảnh)." 
          : mode === 'vbt'
          ? "Vui lòng tải lên tài liệu Vở bài tập (VBT) hoặc nhập nội dung bài tập."
          : "Vui lòng tải lên ít nhất một tệp tài liệu bài học (Ảnh, PDF hoặc Word)."
      );
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
      return;
    }

    const currentMode = mode;
    setGeneratingModes(prev => ({ ...prev, [currentMode]: true }));
    setResults(prev => ({ ...prev, [currentMode]: null }));
    setModeActiveTab(prev => ({ ...prev, [currentMode]: 'plan' }));

    try {
      let finalAdditionalInfo = additionalInfo;

      // Extract Word documents text
      const wordFiles = attachedFiles.filter(f => f.type === 'text/plain');
      if (wordFiles.length > 0) {
        const wordTextSections = wordFiles.map((f, idx) => 
          `[Tài liệu Word ${idx + 1}: ${f.name}]\n${f.data}`
        ).join('\n\n');
        finalAdditionalInfo = `Nội dung trích xuất từ các tệp Word:\n${wordTextSections}\n\n${finalAdditionalInfo}`;
      }

      // Collect image/PDF payloads
      const mediaFiles = attachedFiles
        .filter(f => f.type !== 'text/plain')
        .map(f => ({
          mimeType: f.type,
          data: f.data,
          name: f.name
        }));

      const numPeriodsValue = periods || '1';
      const totalPeriodsValue = totalPeriods || numPeriodsValue;
      const request: LessonPlanRequest = {
        subject,
        grade,
        topic: '', // Will be extracted from files by AI
        periods: numPeriodsValue,
        currentPeriod: '1',
        totalPeriods: totalPeriodsValue,
        teacherGender,
        additionalInfo: finalAdditionalInfo,
        mode: currentMode,
        files: mediaFiles.length > 0 ? mediaFiles : undefined,
        file: mediaFiles.length > 0 ? mediaFiles[0] : undefined, // fallback
        lessonDate: lessonDate ? formatVietnameseDate(lessonDate) : undefined
      };

      // Kiểm tra API Key trước khi gọi trực tiếp Google Gemini API
      if (!hasGeminiApiKey()) {
        setShowApiKeyModal(true);
        alert("⚠️ Chưa có Google Gemini API Key!\n\nVui lòng bấm vào nút 'Cài đặt API Key' ở góc trên để nhập API Key của bạn (hoặc cấu hình biến môi trường GEMINI_API_KEY trên Vercel).");
        setGeneratingModes(prev => ({ ...prev, [currentMode]: false }));
        return;
      }

      const plan = await generateLessonPlan(request);
      setModeSelectedPeriod(prev => ({ ...prev, [currentMode]: '1' }));
      setResults(prev => ({ ...prev, [currentMode]: plan }));
    } catch (error: any) {
      console.error(error);
      const errMsg = error?.message || "";
      if (
        errMsg.includes("API Key") ||
        errMsg.includes("GEMINI_API_KEY") ||
        errMsg.includes("403") ||
        errMsg.includes("API_KEY_INVALID")
      ) {
        setShowApiKeyModal(true);
      }
      alert(errMsg || (currentMode === 'upgrade' 
        ? "Có lỗi xảy ra khi nâng cấp kế hoạch bài dạy. Vui lòng kiểm tra lại và thử lại." 
        : currentMode === 'vbt'
        ? "Có lỗi xảy ra khi soạn kế hoạch bài dạy từ Vở bài tập. Vui lòng kiểm tra lại và thử lại."
        : "Có lỗi xảy ra khi tạo kế hoạch bài dạy. Vui lòng kiểm tra lại kết nối và thử lại."));
    } finally {
      setGeneratingModes(prev => ({ ...prev, [currentMode]: false }));
    }
  };

  const planContent = useMemo(() => {
    if (!result) return '';
    let raw = result.split('---SLIDE_SEPARATOR---')[0].trim();
    if (mode === 'new') {
      raw = cleanSGKContent(raw);
    } else if (mode === 'vbt') {
      raw = cleanVBTContent(raw);
    } else {
      raw = repairSectionIIITable(raw);
    }
    return syncHeaderSubjectAndGrade(raw, subject, grade, undefined, undefined, mode, lessonDate);
  }, [result, subject, grade, mode, lessonDate]);

  // Cấu trúc danh sách từng tiết của bài học (Đảm bảo mỗi tiết đầy đủ từ I -> IV)
  const parsedPeriods = useMemo(() => {
    if (!planContent || !planContent.trim()) return [];

    const parsedTotalCount = totalPeriods ? parseInt(totalPeriods, 10) : 0;

    // Cách 1: Phân tách theo chuỗi phân cách chuẩn ---TIET_SEPARATOR---
    if (planContent.includes('---TIET_SEPARATOR---')) {
      const parts = planContent
        .split('---TIET_SEPARATOR---')
        .map(p => p.trim())
        .filter(Boolean);

      if (parts.length > 0) {
        const total = parsedTotalCount && parsedTotalCount >= parts.length ? parsedTotalCount : parts.length;
        return parts.map((part, idx) => {
          const num = idx + 1;
          let adjusted = part;

          return {
            id: `${num}`,
            label: `Tiết ${num}`,
            content: syncHeaderSubjectAndGrade(adjusted, subject, grade, `${num}`, `${total}`, mode, lessonDate),
          };
        });
      }
    }

    // Cách 1b: Phân tách nếu có 2 hoặc nhiều lần xuất hiện KẾ HOẠCH BÀI DẠY
    const h1Regex = /(?:<h1[^>]*>[\s\S]*?KẾ HOẠCH BÀI DẠY[\s\S]*?<\/h1>|#\s*KẾ HOẠCH BÀI DẠY)/gi;
    const h1Indices: number[] = [];
    let hm: RegExpExecArray | null;
    while ((hm = h1Regex.exec(planContent)) !== null) {
      h1Indices.push(hm.index);
    }
    if (h1Indices.length >= 2) {
      const parts: string[] = [];
      for (let i = 0; i < h1Indices.length; i++) {
        const start = h1Indices[i];
        const end = i < h1Indices.length - 1 ? h1Indices[i + 1] : planContent.length;
        const slice = planContent.slice(start, end).trim();
        if (slice) parts.push(slice);
      }
      if (parts.length >= 2) {
        const total = parsedTotalCount && parsedTotalCount >= parts.length ? parsedTotalCount : parts.length;
        return parts.map((part, idx) => {
          const num = idx + 1;
          return {
            id: `${num}`,
            label: `Tiết ${num}`,
            content: syncHeaderSubjectAndGrade(part, subject, grade, `${num}`, `${total}`, mode, lessonDate),
          };
        });
      }
    }

    // Cách 2: Tự động bóc tách thông minh khi tài liệu có định dạng ### TIẾT 1, ### TIẾT 2...
    const regex = /(?:###|##|\*\*)\s*TIẾT\s*([0-9]+)|(?:\n|\r\n)\s*TIẾT\s*([0-9]+)[:\s]/gi;
    const matches: { index: number; num: number; matchStr: string }[] = [];
    let match: RegExpExecArray | null;
    while ((match = regex.exec(planContent)) !== null) {
      const num = parseInt(match[1] || match[2], 10);
      if (!isNaN(num) && num > 0) {
        if (!matches.some(m => m.num === num)) {
          matches.push({ index: match.index, num, matchStr: match[0] });
        }
      }
    }

    if (matches.length >= 2) {
      matches.sort((a, b) => a.index - b.index);
      const firstIdx = matches[0].index;
      const preContent = planContent.slice(0, firstIdx).trim();

      const ivMatch = planContent.match(/(?:<span[^>]*>\s*\*?\*?IV\.\s*ĐIỀU CHỈNH SAU BÀI DẠY[\s\S]*|(?:\n|\r\n)\s*IV\.\s*ĐIỀU CHỈNH SAU BÀI DẠY[\s\S]*)/i);
      const ivSection = ivMatch ? ivMatch[0].trim() : '';
      const ivIndex = ivMatch ? ivMatch.index! : planContent.length;
      const totalMatches = parsedTotalCount && parsedTotalCount >= matches.length ? parsedTotalCount : matches.length;

      return matches.map((m, idx) => {
        const num = m.num;
        const start = m.index;
        const end = idx < matches.length - 1 ? matches[idx + 1].index : Math.min(ivIndex, planContent.length);
        const activitiesSection = planContent.slice(start, end).trim();

        let periodHeader = preContent;

        let completePeriodText = '';
        if (activitiesSection.includes('I. YÊU CẦU CẦN ĐẠT') || activitiesSection.includes('KẾ HOẠCH BÀI DẠY')) {
          completePeriodText = activitiesSection;
        } else {
          const adjustmentForThisPeriod = ivSection
            ? ivSection.replace(/IV\.\s*ĐIỀU CHỈNH SAU BÀI DẠY/i, `IV. ĐIỀU CHỈNH SAU BÀI DẠY (TIẾT ${num})`)
            : `<span style="color: red; font-weight: bold;">IV. ĐIỀU CHỈNH SAU BÀI DẠY:</span><br />- Học sinh tham gia tích cực, tiếp thu bài tốt, hoàn thành các mục tiêu của Tiết ${num}.`;

          completePeriodText = `${periodHeader}\n\n${activitiesSection}\n\n${adjustmentForThisPeriod}`;
        }

        return {
          id: `${num}`,
          label: `Tiết ${num}`,
          content: syncHeaderSubjectAndGrade(completePeriodText, subject, grade, `${num}`, `${totalMatches}`, mode, lessonDate),
        };
      });
    }

    // Cách 3: Nếu người dùng đã chọn số tiết > 1 ở thông tin bài dạy
    const numFormPeriods = parseInt(periods, 10);
    const effectiveTotal = parsedTotalCount && parsedTotalCount >= numFormPeriods ? parsedTotalCount : (numFormPeriods || 1);
    if (numFormPeriods > 1) {
      const list = [];
      for (let i = 1; i <= numFormPeriods; i++) {
        list.push({
          id: `${i}`,
          label: `Tiết ${i}`,
          content: syncHeaderSubjectAndGrade(planContent, subject, grade, `${i}`, `${effectiveTotal}`, mode, lessonDate),
        });
      }
      return list;
    }

    // Mặc định: 1 tiết duy nhất
    return [
      {
        id: '1',
        label: 'Tiết 1',
        content: syncHeaderSubjectAndGrade(planContent, subject, grade, '1', `${effectiveTotal}`, mode, lessonDate),
      },
    ];
  }, [planContent, periods, totalPeriods, subject, grade, mode, lessonDate]);

  // Nội dung KHBD hiển thị theo Tiết đã chọn (hoặc tất cả các tiết)
  const currentPlanToDisplay = useMemo(() => {
    if (!planContent) return '';
    let content = planContent;
    if (selectedPeriod !== 'all') {
      const found = parsedPeriods.find(p => p.id === selectedPeriod);
      content = found ? found.content : (parsedPeriods[0]?.content || planContent);
    }
    return repairSectionIIITable(content);
  }, [planContent, selectedPeriod, parsedPeriods]);

  const slideContent = useMemo(() => {
    if (!result) return '';
    const afterSlide = result.split('---SLIDE_SEPARATOR---')[1] || '';
    return afterSlide.split('---PROMPT_SEPARATOR---')[0].trim();
  }, [result]);

  const promptContent = useMemo(() => {
    if (!result) return '';
    const afterPrompt = result.split('---PROMPT_SEPARATOR---')[1];
    if (afterPrompt) return afterPrompt.trim();
    return '';
  }, [result]);

  // Trích xuất tên bài học sạch từ planContent hoặc thông tin bổ sung
  const extractedLessonTitle = useMemo(() => {
    let title = '';

    if (planContent) {
      // 1. Tìm span có màu đỏ: <span style="color: blue">Tên bài học:</span> <span style="color: red">**...**</span>
      const spanMatch = planContent.match(/Tên bài (?:học|dạy)\s*:[^\n\r<]*<span[^>]*>\s*\*?\*?([^<*\n\r]+)\*?\*?\s*<\/span>/i);
      if (spanMatch && spanMatch[1]?.trim()) {
        title = spanMatch[1].trim();
      }
      
      // 2. Tìm dòng Tên bài học: ...
      if (!title) {
        const lineMatch = planContent.match(/Tên bài (?:học|dạy)\s*:\s*\*?\*?([^<\n\r|;]+?)(?:\*?\*|\s*<br|\s*\||;\s*Số tiết|\n|$)/i);
        if (lineMatch && lineMatch[1]?.trim()) {
          title = lineMatch[1].trim();
        }
      }

      // 3. Tìm Bài [Số]: ...
      if (!title) {
        const baiMatch = planContent.match(/(?:Bài\s+\d+[:\s\.\-][^\n\r<*|]+)/i);
        if (baiMatch && baiMatch[0]?.trim()) {
          title = baiMatch[0].trim();
        }
      }
    }

    // 4. Tìm trong additionalInfo nếu người dùng nhập
    if (!title && additionalInfo) {
      const firstLine = additionalInfo.trim().split('\n')[0].trim();
      if (firstLine.length > 2 && firstLine.length < 80) {
        title = firstLine;
      }
    }

    if (title) {
      title = title
        .replace(/<[^>]*>/g, '')
        .replace(/[*_#`]/g, '')
        .replace(/\s*-\s*Tiết\s*[\d,\s]+/gi, '')
        .replace(/\s*\(\s*Tiết\s*[\d,\s]+\s*\)/gi, '')
        // Chuẩn hóa "Bài 1: Ôn tập" hoặc "Bài 1. Ôn tập" -> "Bài 1 Ôn tập"
        .replace(/(Bài\s+\d+)[\.:]\s*/gi, '$1 ')
        .replace(/:\s*/g, ' ')
        .replace(/[\\/*?:"<>|]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    }

    return title || 'Bài học';
  }, [planContent, additionalInfo]);

  // Cấu trúc đặt tên tệp xuất Word chuẩn theo yêu cầu:
  // Môn học?_Tên bài?_tiết?
  // Ví dụ:
  // + Tiết 1: Toán_Bài 1 Ôn tập các số đến 100_tiết 1.docx
  // + Gộp cả 3 tiết: Toán_Bài 1 Ôn tập các số đến 100_tiết 1, 2, 3.docx
  const getWordExportFileName = (periodId?: string) => {
    // 1. Môn học
    let monHoc = (subject || 'Môn học').trim();
    if (mode === 'vbt') {
      if (!monHoc.startsWith('TC ') && (monHoc === 'Toán' || monHoc === 'Tiếng Việt')) {
        monHoc = `TC ${monHoc}`;
      }
    }
    monHoc = monHoc.replace(/[\\/*?:"<>|]/g, '').trim();

    // 2. Tên bài
    let tenBaiHoc = extractedLessonTitle.replace(/[\\/*?:"<>|]/g, '').trim() || 'Bài học';
    tenBaiHoc = tenBaiHoc.replace(/^[-_\s]+|[-_\s]+$/g, '').trim() || 'Bài học';

    // 3. tiết
    const targetPeriod = periodId !== undefined ? periodId : selectedPeriod;
    let tietPart = 'tiết 1';

    if (targetPeriod === 'all') {
      if (parsedPeriods.length > 1) {
        const nums = parsedPeriods.map(p => p.id).join(', ');
        tietPart = `tiết ${nums}`;
      } else {
        const numCount = parseInt(periods, 10);
        if (numCount > 1) {
          const nums = Array.from({ length: numCount }, (_, i) => i + 1).join(', ');
          tietPart = `tiết ${nums}`;
        } else {
          tietPart = 'tiết 1';
        }
      }
    } else {
      tietPart = `tiết ${targetPeriod || '1'}`;
    }

    // Kết hợp theo định dạng: Môn học_Tên bài_tiết
    return `${monHoc}_${tenBaiHoc}_${tietPart}`;
  };

  const lessonPlanFileName = useMemo(() => {
    return getWordExportFileName();
  }, [getWordExportFileName]);

  const copyToClipboard = () => {
    if (!result) return;
    let textToCopy = result;
    if (activeTab === 'plan') {
      textToCopy = currentPlanToDisplay || planContent;
    } else if (activeTab === 'slide') {
      textToCopy = slideContent;
    } else if (activeTab === 'prompt') {
      textToCopy = promptContent || result;
    }
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    if (!result) return;
    try {
      const shareUrl = window.location.href;
      navigator.clipboard.writeText(shareUrl);
      setShowShareToast(true);
      setTimeout(() => setShowShareToast(false), 3000);
    } catch (e) {
      console.error(e);
      alert('Đã tạo liên kết chia sẻ!');
    }
  };

  const handleSaveToPC = async () => {
    if (!result) return;
    try {
      setIsExporting(true);
      const planElement = document.querySelector('.plan-doc-content') || document.querySelector('.markdown-body');
      let htmlContent = '';
      if (planElement) {
        const clone = planElement.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('.no-export, .no-print, .not-prose, button').forEach(el => el.remove());
        htmlContent = clone.innerHTML;
      }
      
      const finalFileName = getWordExportFileName();
      const periodTitle = selectedPeriod && selectedPeriod !== 'all' ? ` (Tiết ${selectedPeriod})` : '';

      await exportToDocx(htmlContent, finalFileName, {
        title: `Kế hoạch bài dạy: ${subject} - Lớp ${grade}${periodTitle}`,
        isSlide: false,
      });
      setShowSaveModal(false);
    } catch (error) {
      console.error('Lỗi khi xuất tệp DOCX:', error);
      alert('Không thể tạo tệp Word (.docx). Vui lòng thử lại.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleSaveToGoogleDrive = async () => {
    if (!result) return;
    try {
      setIsExporting(true);
      const planElement = document.querySelector('.plan-doc-content') || document.querySelector('.markdown-body');
      let htmlContent = '';
      if (planElement) {
        const clone = planElement.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('.no-export, .no-print, .not-prose, button').forEach(el => el.remove());
        htmlContent = clone.innerHTML;
      }
      
      const finalFileName = getWordExportFileName();
      const periodTitle = selectedPeriod && selectedPeriod !== 'all' ? ` (Tiết ${selectedPeriod})` : '';

      await exportToDocx(htmlContent, finalFileName, {
        title: `Kế hoạch bài dạy: ${subject} - Lớp ${grade}${periodTitle}`,
        isSlide: false,
      });
      
      window.open('https://drive.google.com/drive/my-drive', '_blank');
      setShowSaveModal(false);
    } catch (error) {
      console.error('Lỗi khi chuẩn bị tệp cho Google Drive:', error);
      alert('Không thể tạo tệp Word (.docx). Vui lòng thử lại.');
    } finally {
      setIsExporting(false);
    }
  };

  const openActivityModal = (activityName: string, shortLabel: string) => {
    setActivityModal({
      isOpen: true,
      activityName,
      shortLabel,
    });
    setCustomPrompt('');
  };

  const handleRegenerateActivityWithPrompt = async () => {
    if (!result || !activityModal || regeneratingActivity) return;

    if (!hasGeminiApiKey()) {
      setShowApiKeyModal(true);
      alert("⚠️ Chưa có Google Gemini API Key!\n\nVui lòng bấm vào nút 'Cài đặt API Key' ở góc trên để nhập API Key của bạn (hoặc cấu hình biến môi trường GEMINI_API_KEY trên Vercel).");
      return;
    }

    const { activityName, shortLabel } = activityModal;
    setRegeneratingActivity(activityName);

    try {
      // Trích xuất nội dung hoạt động cũ từ planContent
      const lines = planContent.split('\n');
      const searchTerms = [
        shortLabel.toLowerCase(),
        activityName.toLowerCase().slice(0, 15),
        shortLabel === 'Khởi động' ? 'mở đầu' : shortLabel === 'Khám phá' ? 'hình thành kiến thức' : shortLabel === 'Luyện tập' ? 'luyện tập' : 'vận dụng'
      ];
      
      let oldActivityContent = '';
      let targetIndex = -1;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith('|') && !line.includes('Hoạt động của Giáo viên') && !line.includes(':---')) {
          const lower = line.toLowerCase();
          if (searchTerms.some(term => lower.includes(term))) {
            oldActivityContent = line;
            targetIndex = i;
            break;
          }
        }
      }

      if (targetIndex === -1) {
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (searchTerms.some(term => line.toLowerCase().includes(term)) && (line.includes('**') || line.startsWith('#'))) {
            oldActivityContent = line;
            targetIndex = i;
            break;
          }
        }
      }

      const newRow = await regenerateActivitySection({
        subject,
        grade,
        topic: lessonPlanFileName.replace('KHBD_', ''),
        activityName,
        shortLabel,
        teacherGender,
        currentActivityContent: oldActivityContent,
        userCustomPrompt: customPrompt,
        lessonSummary: `Kế hoạch bài dạy môn ${subject} lớp ${grade}`
      });

      if (newRow && newRow.trim()) {
        let updatedPlan = planContent;
        if (targetIndex !== -1) {
          lines[targetIndex] = newRow;
          updatedPlan = lines.join('\n');
        } else {
          // Nếu không tìm thấy dòng khớp, tìm bảng để chèn hoặc nối thêm
          let tableInsertIdx = -1;
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('Hoạt động của Giáo viên') && lines[i].startsWith('|')) {
              tableInsertIdx = i + 2;
              break;
            }
          }
          if (tableInsertIdx !== -1) {
            lines.splice(tableInsertIdx, 0, newRow);
            updatedPlan = lines.join('\n');
          } else {
            updatedPlan = updatedPlan + '\n\n' + newRow;
          }
        }

        const afterSlide = result.includes('---SLIDE_SEPARATOR---')
          ? '---SLIDE_SEPARATOR---' + result.split('---SLIDE_SEPARATOR---')[1]
          : '';

        setResult(updatedPlan + afterSlide);
        setActivityToast(`Đã điều chỉnh và tạo lại "${shortLabel}" thành công!`);
        setActivityModal(null);
        setCustomPrompt('');
        setTimeout(() => setActivityToast(null), 3500);
      }
    } catch (error: any) {
      console.error('Lỗi khi tạo lại hoạt động:', error);
      const msg = error?.message || '';
      if (
        msg.includes('API Key') ||
        msg.includes('GEMINI_API_KEY') ||
        msg.includes('403') ||
        msg.includes('API_KEY_INVALID')
      ) {
        setShowApiKeyModal(true);
      }
      alert(msg || 'Không thể tạo lại phần này. Vui lòng thử lại.');
    } finally {
      setRegeneratingActivity(null);
    }
  };

  const handleDownloadWord = async () => {
    if (!result) return;
    
    try {
      setIsExporting(true);
      const planElement = document.querySelector('.plan-doc-content') || document.querySelector('.markdown-body');
      let htmlContent = '';
      if (planElement) {
        const clone = planElement.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('.no-export, .no-print, .not-prose, button').forEach(el => el.remove());
        htmlContent = clone.innerHTML;
      }
      
      const finalFileName = getWordExportFileName();
      const periodTitle = selectedPeriod && selectedPeriod !== 'all' ? ` (Tiết ${selectedPeriod})` : '';

      await exportToDocx(htmlContent, finalFileName, {
        title: `Kế hoạch bài dạy: ${subject} - Lớp ${grade}${periodTitle}`,
        isSlide: false,
      });
    } catch (error) {
      console.error('Lỗi khi xuất tệp DOCX:', error);
      alert('Không thể tạo tệp Word (.docx). Vui lòng thử lại.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadSlide = async () => {
    if (!result) return;
    
    if (!slideContent) {
      alert("Không tìm thấy nội dung slide để tải về.");
      return;
    }

    try {
      setIsExporting(true);
      const slideElement = document.querySelector('.slide-content');
      let htmlContent = '';
      if (slideElement) {
        const clone = slideElement.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('.no-export, .no-print, .not-prose, button').forEach(el => el.remove());
        htmlContent = clone.innerHTML;
      }
      
      const slideFileName = `Slide_${getWordExportFileName()}`;
      
      await exportToDocx(htmlContent, slideFileName, {
        title: `Thiết kế Slide: ${subject} - Lớp ${grade}`,
        isSlide: true,
      });
    } catch (error) {
      console.error('Lỗi khi xuất tệp DOCX:', error);
      alert('Không thể tạo tệp Word (.docx). Vui lòng thử lại.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadPrompt = async () => {
    if (!result) return;
    
    if (!promptContent) {
      alert("Không tìm thấy nội dung Prompt minh họa để tải về.");
      return;
    }

    try {
      setIsExporting(true);
      const promptFileName = `Prompt_${getWordExportFileName()}`;
      
      await exportPromptMarkdownToDocx(promptContent, promptFileName, {
        title: `DANH SÁCH PROMPT MINH HỌA & TƯƠNG TÁC: ${subject.toUpperCase()} - LỚP ${grade}`,
        slideContent: slideContent,
        subject: subject,
        grade: grade,
      });
    } catch (error) {
      console.error('Lỗi khi xuất tệp DOCX:', error);
      alert('Không thể tạo tệp Word (.docx). Vui lòng thử lại.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-[1400px] mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-lg shadow-lg shadow-blue-100">
              <GraduationCap className="text-white w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold text-slate-800 hidden sm:block">Trợ Lý Giáo Viên Tiểu Học</h1>
            <h1 className="text-xl font-bold text-slate-800 sm:hidden">Trợ Lý Kế Hoạch Bài Dạy</h1>
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            <span className="text-sm text-slate-500 hidden lg:block">Soạn kế hoạch bài dạy thông minh với AI</span>

            {/* Nút Cài đặt Google Gemini API Key */}
            <button
              onClick={() => setShowApiKeyModal(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all shadow-xs ${
                apiKeyStatus.hasKey
                  ? "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100"
                  : "bg-amber-50 text-amber-900 border-amber-400 hover:bg-amber-100 ring-2 ring-amber-400/50"
              }`}
              title="Cài đặt Google Gemini API Key để chạy trên Vercel"
            >
              <Key className={`w-3.5 h-3.5 ${apiKeyStatus.hasKey ? "text-emerald-600" : "text-amber-600"}`} />
              <span className="hidden sm:inline">{apiKeyStatus.hasKey ? "API Key: Đã kết nối" : "Cài đặt API Key"}</span>
              <span className="sm:hidden">{apiKeyStatus.hasKey ? "API Key" : "Cài API Key"}</span>
              <span className={`w-2 h-2 rounded-full shrink-0 ${apiKeyStatus.hasKey ? "bg-emerald-500" : "bg-amber-500 animate-ping"}`} />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1400px] w-full mx-auto p-4 md:p-6 grid grid-cols-12 gap-4 md:gap-6">
        {/* Input Section */}
        <div className="col-span-4 lg:col-span-3 space-y-6">
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Sparkles className="text-blue-600 w-5 h-5" />
                <h2 className="text-lg font-semibold text-slate-800">Thông tin bài dạy</h2>
              </div>
              {result && (
                <button 
                  onClick={handleReset}
                  className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors bg-blue-50 px-2 py-1 rounded-md"
                  title="Soạn bài mới"
                >
                  <RotateCcw className="w-3 h-3" />
                  Làm mới
                </button>
              )}
            </div>

            {/* Ô nhập API Key trực tiếp trên giao diện khi chưa cấu hình */}
            {!apiKeyStatus.hasKey && (
              <div className="mb-4 bg-amber-50/90 border border-amber-300 rounded-xl p-3 text-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-semibold text-amber-900">
                    <Key className="w-4 h-4 text-amber-600" />
                    <span>Google Gemini API Key:</span>
                  </div>
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] font-medium text-blue-600 hover:underline inline-flex items-center gap-0.5"
                  >
                    <span>Lấy key miễn phí</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="password"
                    placeholder="Dán mã API Key (AIzaSy...)"
                    value={inlineApiKeyInput}
                    onChange={(e) => setInlineApiKeyInput(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-mono text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <button
                    type="button"
                    onClick={handleSaveInlineApiKey}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-semibold rounded-lg text-xs transition-colors shrink-0 shadow-xs"
                  >
                    Lưu
                  </button>
                </div>
                <p className="text-[10px] text-amber-700 leading-tight">
                  Khóa sẽ được lưu an toàn trong trình duyệt (localStorage) để gọi trực tiếp Google Gemini khi chạy trên Vercel.
                </p>
              </div>
            )}

            <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
              {/* Chế độ soạn */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                  <span>Chế độ soạn</span>
                  <span className="text-[11px] font-normal text-blue-600 lowercase">
                    {mode === 'new' ? 'Từ SGK' : mode === 'vbt' ? 'Từ Vở bài tập' : 'Nâng cấp'}
                  </span>
                </label>
                <div className="grid grid-cols-3 p-1 bg-slate-100/90 rounded-xl border border-slate-200/80 gap-1">
                  <button
                    type="button"
                    onClick={() => setMode('new')}
                    className={`flex items-center justify-center gap-1 py-2 px-1 rounded-lg text-xs font-semibold transition-all relative ${
                      mode === 'new'
                        ? 'bg-white text-blue-700 shadow-xs border border-slate-200/60'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                    }`}
                    title="Soạn mới từ Sách giáo khoa"
                  >
                    {generatingModes.new ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600 shrink-0" />
                    ) : (
                      <BookOpen className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span className="truncate">Từ SGK</span>
                    {results.new && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" title="Đã có KHBD" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('vbt')}
                    className={`flex items-center justify-center gap-1 py-2 px-1 rounded-lg text-xs font-semibold transition-all relative ${
                      mode === 'vbt'
                        ? 'bg-white text-emerald-700 shadow-xs border border-slate-200/60'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                    }`}
                    title="Soạn từ Vở bài tập (VBT) - Tiết Luyện tập / Thực hành / Phụ đạo"
                  >
                    {generatingModes.vbt ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600 shrink-0" />
                    ) : (
                      <BookMarked className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    )}
                    <span className="truncate">Từ VBT</span>
                    {results.vbt && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" title="Đã có KHBD" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('upgrade')}
                    className={`flex items-center justify-center gap-1 py-2 px-1 rounded-lg text-xs font-semibold transition-all relative ${
                      mode === 'upgrade'
                        ? 'bg-white text-amber-700 shadow-xs border border-slate-200/60'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                    }`}
                    title="Nâng cấp KHBD cũ có sẵn và chèn tích hợp"
                  >
                    {generatingModes.upgrade ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600 shrink-0" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    )}
                    <span className="truncate">Nâng cấp</span>
                    {results.upgrade && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" title="Đã có KHBD" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Môn học</label>
                  <select
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 hover:border-blue-500 hover:border-2 hover:bg-blue-50 hover:shadow-md focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none transition-all duration-300"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    required
                  >
                    <option value="" disabled>Chọn môn học</option>
                    <option value="Tiếng Việt">Tiếng Việt</option>
                    <option value="Toán">Toán</option>
                    <option value="TC Toán">TC Toán</option>
                    <option value="TC Tiếng Việt">TC Tiếng Việt</option>
                    <option value="HĐTN">HĐTN</option>
                    <option value="TN-XH">TN-XH</option>
                    <option value="Đạo đức">Đạo đức</option>
                    <option value="Khoa học">Khoa học</option>
                    <option value="LS-ĐL">LS-ĐL</option>
                    <option value="Âm nhạc">Âm nhạc</option>
                    <option value="Mĩ thuật">Mĩ thuật</option>
                    <option value="GDTC">GDTC</option>
                    <option value="TA">TA</option>
                  </select>
                </div>

                {mode === 'vbt' ? (
                  <div>
                    <div className="grid grid-cols-3 gap-2.5">
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700">Lớp</label>
                        <select
                          className="w-full px-2 py-2 rounded-lg border border-slate-300 hover:border-emerald-500 hover:border-2 hover:bg-emerald-50/30 hover:shadow-md focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 outline-none transition-all duration-300 text-sm font-medium text-center"
                          value={grade}
                          onChange={(e) => setGrade(e.target.value)}
                          required
                        >
                          <option value="1">Lớp 1</option>
                          <option value="2">Lớp 2</option>
                          <option value="3">Lớp 3</option>
                          <option value="4">Lớp 4</option>
                          <option value="5">Lớp 5</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700 block truncate" title="Số tiết cần soạn">
                          Số tiết
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="10"
                          className="w-full px-2 py-2 rounded-lg border border-emerald-300 bg-emerald-50/30 hover:border-emerald-500 hover:bg-emerald-50 hover:shadow-sm focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 outline-none transition-all duration-300 text-sm font-bold text-center text-emerald-800"
                          value={periods}
                          onChange={(e) => {
                            const val = e.target.value;
                            setPeriods(val);
                            if (!totalPeriods || parseInt(totalPeriods, 10) < parseInt(val, 10)) {
                              setTotalPeriods(val);
                            }
                          }}
                          title="Số tiết app phải soạn (Ví dụ: 1 là soạn 1 tiết, 2 là soạn 2 tiết, 3 là soạn 3 tiết...)"
                          placeholder="1"
                          required
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700 block truncate" title="Tổng số tiết của bài">
                          Tổng tiết
                        </label>
                        <input
                          type="number"
                          min={periods || "1"}
                          max="20"
                          className="w-full px-2 py-2 rounded-lg border border-slate-300 hover:border-emerald-500 hover:bg-emerald-50/20 hover:shadow-sm focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 outline-none transition-all duration-300 text-sm font-semibold text-center text-slate-800"
                          value={totalPeriods}
                          onChange={(e) => setTotalPeriods(e.target.value)}
                          title="Tổng số tiết của bài học (Ví dụ: bài 3 tiết thì nhập 3 để ghi Số tiết: 1 / 3 tiết)"
                          placeholder={periods || "1"}
                          required
                        />
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-emerald-800 bg-emerald-50/90 px-2.5 py-1.5 rounded-md flex items-center justify-between border border-emerald-200/80">
                      <span>Tiến trình & Thẻ/Tab:</span>
                      <span className="font-bold text-emerald-950">
                        {parseInt(periods, 10) > 1
                          ? `Soạn ${periods} tiết (${Array.from({ length: Math.min(parseInt(periods, 10), 4) }, (_, i) => `Tiết ${i + 1}`).join(', ')}${parseInt(periods, 10) > 4 ? '...' : ''}) / Tổng ${totalPeriods || periods} tiết`
                          : `Soạn Tiết 1 / Tổng ${totalPeriods || '1'} tiết`}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2.5">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700">Lớp</label>
                      <select
                        className="w-full px-2 py-2 rounded-lg border border-slate-300 hover:border-blue-500 hover:border-2 hover:bg-blue-50 hover:shadow-md focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none transition-all duration-300 text-sm"
                        value={grade}
                        onChange={(e) => setGrade(e.target.value)}
                        required
                      >
                        <option value="1">Lớp 1</option>
                        <option value="2">Lớp 2</option>
                        <option value="3">Lớp 3</option>
                        <option value="4">Lớp 4</option>
                        <option value="5">Lớp 5</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700 block truncate" title="Số tiết cần soạn">
                        Số tiết
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        className="w-full px-2 py-2 rounded-lg border border-slate-300 hover:border-blue-500 hover:border-2 hover:bg-blue-50 hover:shadow-md focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none transition-all duration-300 text-sm font-medium text-center"
                        value={periods}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPeriods(val);
                          if (!totalPeriods || parseInt(totalPeriods, 10) < parseInt(val, 10)) {
                            setTotalPeriods(val);
                          }
                        }}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700 block truncate" title="Tổng số tiết của bài">
                        Tổng tiết
                      </label>
                      <input
                        type="number"
                        min={periods || "1"}
                        max="20"
                        className="w-full px-2 py-2 rounded-lg border border-slate-300 hover:border-blue-500 hover:bg-blue-50 hover:shadow-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none transition-all duration-300 text-sm font-medium text-center"
                        value={totalPeriods}
                        onChange={(e) => setTotalPeriods(e.target.value)}
                        placeholder={periods || "1"}
                        required
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Nút chọn ngày (dạng lịch tháng) đưa vào KHBD */}
              <div className="space-y-1.5" id="lesson-date-section">
                <div className="flex items-center justify-between">
                  <label htmlFor="lesson-date-input" className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    <span>Thời gian thực hiện (Chọn ngày)</span>
                  </label>
                  {lessonDate ? (
                    <button
                      type="button"
                      onClick={() => setLessonDate('')}
                      className="text-xs text-rose-500 hover:text-rose-700 hover:underline font-medium transition-colors"
                      title="Xóa ngày đã chọn, quay về dạng mặc định (ngày ... tháng ... năm 202...)"
                    >
                      Xóa ngày
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        const today = new Date();
                        const y = today.getFullYear();
                        const m = String(today.getMonth() + 1).padStart(2, '0');
                        const d = String(today.getDate()).padStart(2, '0');
                        setLessonDate(`${y}-${m}-${d}`);
                      }}
                      className="text-xs text-blue-600 hover:text-blue-800 hover:underline font-medium transition-colors"
                      title="Chọn nhanh ngày hôm nay"
                    >
                      Hôm nay
                    </button>
                  )}
                </div>

                <div className="relative flex items-center">
                  <input
                    type="date"
                    id="lesson-date-input"
                    value={lessonDate}
                    onChange={(e) => setLessonDate(e.target.value)}
                    onClick={(e) => {
                      try {
                        (e.currentTarget as any).showPicker?.();
                      } catch (err) {
                        // fallback nếu trình duyệt không hỗ trợ showPicker
                      }
                    }}
                    className="w-full px-3 py-2 pl-10 rounded-lg border border-slate-300 hover:border-blue-500 hover:border-2 hover:bg-blue-50/40 hover:shadow-md focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none transition-all duration-300 text-sm font-medium text-slate-800 cursor-pointer"
                    title="Bấm để mở lịch tháng chọn ngày"
                  />
                  <Calendar className="w-4 h-4 text-blue-600 absolute left-3 pointer-events-none" />
                </div>

                <div className="text-xs text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded-md flex items-center justify-between border border-slate-200">
                  <span>Thời gian đưa vào KHBD:</span>
                  <span className="font-semibold text-blue-800">
                    {lessonDate ? formatVietnameseDate(lessonDate) : 'ngày ... tháng ... năm 202...'}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Danh xưng giáo viên</label>
                <select
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 hover:border-blue-500 hover:border-2 hover:bg-blue-50 hover:shadow-md focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none transition-all duration-300"
                  value={teacherGender}
                  onChange={(e) => setTeacherGender(e.target.value as 'Thầy' | 'Cô')}
                  required
                >
                  <option value="Cô">Cô</option>
                  <option value="Thầy">Thầy</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Yêu cầu bổ sung đặc thù (không bắt buộc)</label>
                <textarea
                  placeholder={
                    mode === 'vbt'
                      ? "VD: Khai thác Bài 1, 2, 3 trong trang VBT; chú ý hỗ trợ nhóm chậm ở Bài 2; chốt đáp án rõ ràng và không thêm câu hỏi phụ ngoài VBT..."
                      : mode === 'upgrade'
                      ? "VD: Tích hợp sâu Năng lực số và Quyền con người, giữ nguyên các câu hỏi khởi động..."
                      : "VD: Bám sát bài học SGK, làm rõ các phẩm chất theo Thông tư 27/2020/TT-BGDĐT, tổ chức hoạt động bảng 2 cột đối xứng thực chiến..."
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 hover:border-blue-500 hover:border-2 hover:bg-blue-50 hover:shadow-md focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none transition-all duration-300 min-h-[90px] resize-none text-sm"
                  value={additionalInfo}
                  onChange={(e) => setAdditionalInfo(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-700">
                    {mode === 'upgrade' 
                      ? "Tải lên KHBD cũ (PDF, Word, Ảnh)" 
                      : mode === 'vbt'
                      ? "Tài liệu Vở bài tập (VBT) (Ảnh, PDF, Word)"
                      : "Tài liệu SGK (Ảnh, PDF, Word)"}
                  </label>
                  {attachedFiles.length > 0 && (
                    <span className="text-xs font-semibold px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                      {attachedFiles.length} tệp đã chọn
                    </span>
                  )}
                </div>

                {attachedFiles.length === 0 ? (
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-xl p-5 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all duration-300 ${isDragging ? 'border-blue-600 bg-blue-100/70 scale-[1.01]' : 'border-slate-300 hover:border-blue-500 hover:bg-blue-50 hover:shadow-md'}`}
                  >
                    <div className="bg-blue-50 text-blue-600 p-3 rounded-full">
                      {isReadingFiles ? (
                        <Loader2 className="text-blue-600 w-6 h-6 animate-spin" />
                      ) : mode === 'upgrade' ? (
                        <RefreshCw className="text-amber-500 w-6 h-6" />
                      ) : mode === 'vbt' ? (
                        <BookMarked className="text-emerald-600 w-6 h-6" />
                      ) : (
                        <Upload className="text-blue-600 w-6 h-6" />
                      )}
                    </div>
                    <p className="text-sm font-medium text-slate-700 text-center">
                      {isReadingFiles 
                        ? 'Đang đọc các tệp...' 
                        : mode === 'upgrade'
                        ? 'Tải lên KHBD cũ (.docx, .pdf, ảnh bài dạy)'
                        : mode === 'vbt'
                        ? 'Tải lên trang VBT (.docx, .pdf, ảnh bài tập)'
                        : 'Nhấn hoặc kéo thả để chọn nhiều tệp SGK'}
                    </p>
                    <p className="text-xs text-slate-400 text-center">
                      {mode === 'upgrade'
                        ? 'AI giữ nguyên tiến trình & tự động bổ sung tích hợp'
                        : mode === 'vbt'
                        ? 'Trục chính là hệ thống bài tập VBT, phân hóa và chữa bài'
                        : 'Hỗ trợ chọn nhiều tệp cùng lúc: .docx, .pdf, .jpg, .png'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* List of uploaded files */}
                    <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                      {attachedFiles.map((file) => (
                        <div 
                          key={file.id} 
                          className="flex items-center gap-2.5 bg-slate-50 hover:bg-white p-2 rounded-lg border border-slate-200 hover:border-blue-300 transition-all shadow-2xs"
                        >
                          {file.preview ? (
                            <img src={file.preview} alt={file.name} className="w-9 h-9 object-cover rounded border border-slate-200 shrink-0" />
                          ) : file.type === 'application/pdf' ? (
                            <div className="bg-red-100 p-2 rounded text-red-600 shrink-0">
                              <FileText className="w-5 h-5" />
                            </div>
                          ) : (
                            <div className="bg-blue-100 p-2 rounded text-blue-600 shrink-0">
                              <FileIcon className="w-5 h-5" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-slate-800 truncate" title={file.name}>{file.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[9px] font-bold px-1.5 py-0.5 bg-slate-200/80 text-slate-700 rounded uppercase">
                                {file.type.startsWith('image/') ? 'ẢNH' : file.type === 'application/pdf' ? 'PDF' : 'WORD'}
                              </span>
                              <span className="text-[10px] text-slate-400">{formatFileSize(file.size)}</span>
                            </div>
                          </div>
                          <button 
                            type="button"
                            onClick={() => removeFile(file.id)}
                            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors shrink-0"
                            title="Xóa tệp này"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Quick Action buttons */}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isReadingFiles}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 border border-dashed border-blue-400 hover:border-blue-600 hover:bg-blue-50 text-blue-700 rounded-lg text-xs font-medium transition-colors"
                      >
                        {isReadingFiles ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Plus className="w-3.5 h-3.5" />
                        )}
                        Thêm tệp khác
                      </button>
                      {attachedFiles.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setAttachedFiles([])}
                          className="flex items-center gap-1 py-2 px-2.5 text-xs text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-slate-200"
                          title="Xóa tất cả các tệp"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Xóa hết
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  multiple
                  accept="image/*,application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" 
                  className="hidden" 
                />
              </div>

              <button
                type="submit"
                disabled={isGenerating || isReadingFiles}
                className="w-full bg-blue-600 hover:bg-blue-700 hover:scale-[1.02] active:scale-[0.98] disabled:bg-slate-300 disabled:scale-100 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-all duration-300 shadow-lg shadow-blue-200 hover:shadow-blue-400/50"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {mode === 'upgrade' 
                      ? 'Đang phân tích & nâng cấp KHBD...' 
                      : mode === 'vbt'
                      ? 'Đang soạn KHBD từ VBT...'
                      : 'Đang soạn kế hoạch bài dạy...'}
                  </>
                ) : (
                  <>
                    {mode === 'upgrade' ? (
                      <>
                        <RefreshCw className="w-5 h-5" />
                        Nâng cấp & Bổ sung tích hợp vào KHBD
                      </>
                    ) : mode === 'vbt' ? (
                      <>
                        <BookMarked className="w-5 h-5" />
                        Soạn KHBD từ Vở bài tập (VBT)
                      </>
                    ) : (
                      <>
                        <FileText className="w-5 h-5" />
                        Bắt đầu soạn kế hoạch bài dạy
                      </>
                    )}
                  </>
                )}
              </button>

              {result && !isGenerating && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="w-full bg-white border-2 border-blue-600 text-blue-600 hover:bg-blue-50 hover:scale-[1.02] active:scale-[0.98] font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-all duration-300 shadow-sm"
                >
                  <Sparkles className="w-5 h-5" />
                  {mode === 'upgrade' ? 'Nâng cấp bài khác' : 'Soạn tiếp bài khác'}
                </button>
              )}
            </form>
          </section>

          {/* Tips */}
          {mode !== 'vbt' && (
            <section className="bg-blue-50 rounded-2xl p-6 border border-blue-100">
              <h3 className="text-blue-900 font-semibold mb-2 flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                {mode === 'upgrade' ? 'Mẹo nâng cấp KHBD cũ' : 'Mẹo nhỏ cho thầy cô'}
              </h3>
              <ul className="text-sm text-blue-800/80 space-y-2">
                {mode === 'upgrade' ? (
                  <>
                    <li className="flex gap-2">
                      <ChevronRight className="w-4 h-4 shrink-0 mt-0.5" />
                      Thầy cô chỉ cần tải lên tệp Word (.docx), PDF hoặc ảnh giáo án cũ, AI sẽ tự động phân tích và giữ trọn vẹn tiến trình dạy học gốc.
                    </li>
                    <li className="flex gap-2">
                      <ChevronRight className="w-4 h-4 shrink-0 mt-0.5" />
                      Các nội dung tích hợp (Năng lực số, Quyền con người, QP-AN, PCCC, ĐĐLS, Mizuiku, AI Khung 3439) được chèn tự động vào mục YCCĐ và Hoạt động dạy học với chữ đỏ nổi bật.
                    </li>
                  </>
                ) : (
                  <>
                    <li className="flex gap-2">
                      <ChevronRight className="w-4 h-4 shrink-0 mt-0.5" />
                      Thầy cô có thể chọn nhiều ảnh các trang sách giáo khoa, nhiều tệp PDF hoặc Word cùng lúc để AI tổng hợp đầy đủ.
                    </li>
                    <li className="flex gap-2">
                      <ChevronRight className="w-4 h-4 shrink-0 mt-0.5" />
                      Ghi rõ các yêu cầu đặc biệt về phương pháp dạy học, phân hóa đối tượng hoặc tích hợp liên môn nếu cần.
                    </li>
                  </>
                )}
              </ul>
            </section>
          )}
        </div>

        {/* Result Section */}
        <div className="col-span-8 lg:col-span-9">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 h-full flex flex-col min-h-[600px]">
            {/* Top Level Tabs */}
            <div className="border-b border-slate-200 px-4 py-3 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                <button 
                  id="tab-btn-plan"
                  onClick={() => setActiveTab('plan')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all text-xs sm:text-sm font-semibold ${
                    activeTab === 'plan' 
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-200 ring-2 ring-blue-300' 
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>Kế hoạch bài dạy</span>
                </button>
                <button 
                  id="tab-btn-slide"
                  onClick={() => setActiveTab('slide')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all text-xs sm:text-sm font-semibold ${
                    activeTab === 'slide' 
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200 ring-2 ring-indigo-300' 
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Presentation className="w-4 h-4" />
                  <span>Thiết kế Slide</span>
                </button>
                <button 
                  id="tab-btn-prompt"
                  onClick={() => setActiveTab('prompt')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all text-xs sm:text-sm font-semibold ${
                    activeTab === 'prompt' 
                      ? 'bg-purple-600 text-white shadow-sm shadow-purple-200 ring-2 ring-purple-300' 
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Wand2 className="w-4 h-4" />
                  <span>Prompt minh họa</span>
                </button>
              </div>

              {/* Status info */}
              <div className="text-xs text-slate-400 font-medium hidden md:block">
                {activeTab === 'plan' && 'Chuẩn Công văn 2345 / TT 27'}
                {activeTab === 'slide' && 'PowerPoint bài giảng tương tác'}
                {activeTab === 'prompt' && 'Prompt hình ảnh, video & game AI'}
              </div>
            </div>

            {/* Sub-bar: Periods & Actions */}
            {result && (
              <div className="border-b border-slate-200 px-4 py-2.5 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Left side: [ Tiết 1 ] [ Tiết 2 ] [ Tiết 3 ] */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {activeTab === 'plan' ? (
                    <>
                      {parsedPeriods.length > 0 ? (
                        parsedPeriods.map(p => (
                          <button
                            key={p.id}
                            id={`period-btn-${p.id}`}
                            onClick={() => setSelectedPeriod(p.id)}
                            className={`px-3 py-1.5 text-xs rounded-lg transition-all border font-semibold ${
                              selectedPeriod === p.id
                                ? 'bg-blue-600 text-white border-blue-600 shadow-2xs ring-2 ring-blue-200'
                                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'
                            }`}
                            title={`Xem riêng ${p.label} (đầy đủ từ I -> IV)`}
                          >
                            {p.label}
                          </button>
                        ))
                      ) : (
                        <button
                          id="period-btn-1"
                          onClick={() => setSelectedPeriod('1')}
                          className="px-3 py-1.5 text-xs rounded-lg bg-blue-600 text-white font-bold border border-blue-600 shadow-2xs"
                        >
                          Tiết 1
                        </button>
                      )}

                      {parsedPeriods.length > 1 && (
                        <button
                          id="period-btn-all"
                          onClick={() => setSelectedPeriod('all')}
                          className={`px-3 py-1.5 text-xs rounded-lg transition-all border font-semibold ${
                            selectedPeriod === 'all'
                              ? 'bg-blue-600 text-white border-blue-600 shadow-2xs ring-2 ring-blue-200'
                              : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'
                          }`}
                          title="Xem toàn bộ các tiết cùng lúc"
                        >
                          Tất cả các tiết
                        </button>
                      )}
                    </>
                  ) : activeTab === 'slide' ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100 flex items-center gap-1.5">
                        <Presentation className="w-3.5 h-3.5" />
                        Thiết kế Slide trình chiếu
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-md border border-purple-100 flex items-center gap-1.5">
                        <Wand2 className="w-3.5 h-3.5" />
                        Bộ Prompt minh họa & Game tương tác
                      </span>
                    </div>
                  )}
                </div>

                {/* Right side: [ Copy ] [ Lưu ] [ Tải về Word (.docx) ] */}
                <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
                  <button 
                    id="btn-copy-tab"
                    onClick={copyToClipboard}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs rounded-lg transition-all border border-slate-200 shadow-2xs active:scale-95"
                    title="Sao chép nội dung đang hiển thị"
                  >
                    {copied ? <Check className="text-green-600 w-3.5 h-3.5" /> : <Copy className="text-slate-600 w-3.5 h-3.5" />}
                    <span>{copied ? 'Đã chép' : 'Copy'}</span>
                  </button>

                  <button 
                    id="btn-share-plan"
                    onClick={handleShare}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs rounded-lg transition-all border border-slate-200 shadow-2xs active:scale-95"
                    title="Chia sẻ liên kết bài dạy"
                  >
                    <Share2 className="text-slate-600 w-3.5 h-3.5" />
                    <span>Chia sẻ</span>
                  </button>

                  <button 
                    id="btn-save-plan"
                    onClick={() => setShowSaveModal(true)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-xs rounded-lg transition-all border border-emerald-200 shadow-2xs active:scale-95"
                    title="Lưu bài dạy vào Google Drive hoặc Máy tính (PC)"
                  >
                    <Save className="text-emerald-600 w-3.5 h-3.5" />
                    <span>Lưu</span>
                  </button>

                  {activeTab === 'plan' && (
                    <button 
                      id="btn-download-docx-plan"
                      onClick={handleDownloadWord}
                      disabled={isExporting}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg transition-all shadow-2xs active:scale-95 disabled:opacity-50"
                      title={`Tải về tệp Word (.docx) ${selectedPeriod !== 'all' ? `cho Tiết ${selectedPeriod}` : 'cho bài dạy'}`}
                    >
                      {isExporting ? (
                        <Loader2 className="text-white w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Download className="text-white w-3.5 h-3.5" />
                      )}
                      <span>{isExporting ? 'Đang tạo .docx...' : 'Tải về Word (.docx)'}</span>
                    </button>
                  )}

                  {activeTab === 'slide' && (
                    <button 
                      id="btn-download-docx-slide"
                      onClick={handleDownloadSlide}
                      disabled={isExporting}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg transition-all shadow-2xs active:scale-95 disabled:opacity-50"
                      title="Tải về tệp Slide Word (.docx)"
                    >
                      {isExporting ? (
                        <Loader2 className="text-white w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Download className="text-white w-3.5 h-3.5" />
                      )}
                      <span>{isExporting ? 'Đang tạo .docx...' : 'Tải về Slide (.docx)'}</span>
                    </button>
                  )}

                  {activeTab === 'prompt' && (
                    <button 
                      id="btn-download-docx-prompt"
                      onClick={handleDownloadPrompt}
                      disabled={isExporting}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs rounded-lg transition-all shadow-2xs active:scale-95 disabled:opacity-50"
                      title="Tải về tệp Prompt Word (.docx)"
                    >
                      {isExporting ? (
                        <Loader2 className="text-white w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Download className="text-white w-3.5 h-3.5" />
                      )}
                      <span>{isExporting ? 'Đang tạo .docx...' : 'Tải về Prompt (.docx)'}</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="flex-1 p-6 overflow-y-auto">
              <AnimatePresence mode="wait">
                {isGenerating ? (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4"
                  >
                    <div className="relative">
                      <div className="w-16 h-16 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
                      <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-blue-600 w-6 h-6" />
                    </div>
                    <p className="text-lg font-medium animate-pulse">AI đang phân tích và soạn thảo...</p>
                    <p className="text-sm max-w-xs text-center">Quá trình này có thể mất 10-20 giây tùy vào độ phức tạp của bài học.</p>
                  </motion.div>
                ) : result ? (
                  <motion.div 
                    key={`${activeTab}_${selectedPeriod}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={activeTab === 'slide' ? 'markdown-body slide-content' : activeTab === 'prompt' ? 'prompt-container' : 'markdown-body'}
                  >
                    {activeTab === 'plan' && (
                      <div>
                        <div className="plan-doc-content">
                          <Markdown 
                            remarkPlugins={[remarkGfm, remarkMath]} 
                            rehypePlugins={[rehypeRaw, rehypeKatex]}
                          >
                            {currentPlanToDisplay}
                          </Markdown>
                        </div>

                        {/* Nút Tạo lại phần này cho từng hoạt động - Chỉ hiển thị trên giao diện Web, ẩn hoàn toàn khi xuất file/in */}
                        <div className="mt-8 pt-5 border-t border-slate-200/90 not-prose no-print no-export">
                          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs">
                            <div>
                              <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                <RefreshCw className="w-3.5 h-3.5 text-blue-600" />
                                Tạo lại riêng từng hoạt động trong bài dạy
                              </p>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                Nhấn nút bên dưới để AI tự động sinh lại chi tiết tương tác 2 chiều cho hoạt động tương ứng:
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {(mode === 'vbt'
                                ? [
                                    { name: '1. Hoạt động Khởi động (3 - 5 phút)', label: 'Khởi động (3-5p)' },
                                    { name: '2. Hoạt động Luyện tập - Thực hành VBT (22 - 25 phút)', label: 'Luyện tập VBT (22-25p)' },
                                    { name: '3. Hoạt động Vận dụng & Đánh giá (3 - 5 phút)', label: 'Vận dụng & Đánh giá (3-5p)' }
                                  ]
                                : [
                                    { name: '1. Hoạt động Mở đầu (Khởi động, kết nối)', label: 'Khởi động' },
                                    { name: '2. Hoạt động Hình thành kiến thức mới (Khám phá)', label: 'Khám phá' },
                                    { name: '3. Hoạt động Luyện tập, thực hành', label: 'Luyện tập' },
                                    { name: '4. Hoạt động Vận dụng, trải nghiệm', label: 'Vận dụng' }
                                  ]
                              ).map((act) => (
                                <button
                                  key={act.name}
                                  type="button"
                                  onClick={() => openActivityModal(act.name, act.label)}
                                  disabled={!!regeneratingActivity}
                                  className="flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 font-medium text-xs rounded-lg border border-slate-200 hover:border-blue-300 transition-all shadow-2xs active:scale-95 disabled:opacity-50"
                                  title={`Tùy chỉnh & Tạo lại phần ${act.label}`}
                                >
                                  {regeneratingActivity === act.name ? (
                                    <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                                  ) : (
                                    <RefreshCw className="w-3.5 h-3.5 text-blue-600" />
                                  )}
                                  <span>Tạo lại: {act.label}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    {activeTab === 'slide' && (
                      <Markdown 
                        remarkPlugins={[remarkGfm, remarkMath]} 
                        rehypePlugins={[rehypeRaw, rehypeKatex]}
                      >
                        {slideContent || "AI đang hoàn thiện phần Slide, vui lòng đợi hoặc thử lại."}
                      </Markdown>
                    )}
                    {activeTab === 'prompt' && (
                      <PromptIllustrator 
                        content={promptContent || "AI đang hoàn thiện phần Prompt minh họa, vui lòng đợi hoặc thử lại."} 
                        slideContent={slideContent}
                        subject={subject}
                        grade={grade}
                      />
                    )}
                  </motion.div>
                ) : (
                  <motion.div 
                    key={`empty_${mode}`}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="h-full flex flex-col items-center justify-center text-center px-4 py-16 max-w-md mx-auto"
                  >
                    <div className={`p-5 rounded-2xl mb-4 ${
                      mode === 'vbt' 
                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                        : mode === 'upgrade'
                        ? 'bg-amber-50 text-amber-600 border border-amber-100'
                        : 'bg-blue-50 text-blue-600 border border-blue-100'
                    }`}>
                      {mode === 'vbt' ? (
                        <BookMarked className="w-12 h-12 stroke-[1.5]" />
                      ) : mode === 'upgrade' ? (
                        <RefreshCw className="w-12 h-12 stroke-[1.5]" />
                      ) : (
                        <BookOpen className="w-12 h-12 stroke-[1.5]" />
                      )}
                    </div>

                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold mb-2.5 ${
                      mode === 'vbt'
                        ? 'bg-emerald-100 text-emerald-800'
                        : mode === 'upgrade'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {mode === 'vbt' ? 'Chế độ: Từ Vở bài tập (VBT)' : mode === 'upgrade' ? 'Chế độ: Nâng cấp KHBD cũ' : 'Chế độ: Từ Sách giáo khoa (SGK)'}
                    </span>

                    <h3 className="text-lg font-bold text-slate-800 mb-1.5">
                      Chưa có kế hoạch bài dạy cho chế độ này
                    </h3>

                    <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                      {mode === 'vbt'
                        ? 'Tải lên trang VBT và bấm nút bên dưới để AI thiết kế bài dạy tăng cường luyện tập & phân hóa đối tượng.'
                        : mode === 'upgrade'
                        ? 'Tải lên tệp KHBD cũ và bấm nút bên dưới để AI tự động bổ sung các tích hợp chuẩn quy định.'
                        : 'Tải lên ảnh hoặc tài liệu SGK và bấm nút bên dưới để AI soạn kế hoạch bài dạy chuẩn Công văn 2345.'}
                    </p>

                    <button
                      id="btn-start-drafting-empty"
                      type="button"
                      onClick={handleStartDrafting}
                      className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm text-white shadow-md transition-all duration-200 active:scale-95 hover:scale-[1.02] cursor-pointer ${
                        mode === 'vbt'
                          ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'
                          : mode === 'upgrade'
                          ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-200'
                          : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'
                      }`}
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Bắt đầu Soạn bài</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </main>

      {/* Modal Lưu bài dạy (Google Drive hoặc Máy tính) */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="bg-emerald-100 p-2 rounded-lg text-emerald-600">
                  <Save className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Lưu kế hoạch bài dạy</h3>
                  <p className="text-xs text-slate-400">Chọn nơi lưu trữ bài dạy của thầy cô</p>
                </div>
              </div>
              <button 
                onClick={() => setShowSaveModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                title="Đóng"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* File name preview */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Tên file tự động:</p>
              <p className="text-xs font-mono font-medium text-blue-700 break-all bg-white px-2.5 py-1.5 rounded border border-slate-200">
                {getWordExportFileName()}.docx
              </p>
            </div>

            {/* 2 Manual Save Options */}
            <div className="space-y-3 mb-5">
              {/* Option 1: Lưu về Máy tính (PC) */}
              <button
                onClick={handleSaveToPC}
                disabled={isExporting}
                className="w-full text-left p-3.5 rounded-xl border-2 border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/40 transition-all flex items-start gap-3 group"
              >
                <div className="bg-emerald-100 text-emerald-700 p-2.5 rounded-lg group-hover:scale-105 transition-transform shrink-0">
                  <HardDrive className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-slate-800 group-hover:text-emerald-700">Lưu về Máy tính (PC)</h4>
                  <p className="text-xs text-slate-500 mt-0.5">Tải tệp Word (.docx) chuẩn hóa trực tiếp về máy tính.</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all mt-2 shrink-0" />
              </button>

              {/* Option 2: Lưu vào Google Drive */}
              <button
                onClick={handleSaveToGoogleDrive}
                disabled={isExporting}
                className="w-full text-left p-3.5 rounded-xl border-2 border-slate-200 hover:border-blue-500 hover:bg-blue-50/40 transition-all flex items-start gap-3 group"
              >
                <div className="bg-blue-100 text-blue-700 p-2.5 rounded-lg group-hover:scale-105 transition-transform shrink-0">
                  <Cloud className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-slate-800 group-hover:text-blue-700">Lưu vào Google Drive</h4>
                  <p className="text-xs text-slate-500 mt-0.5">Tải tệp và mở Google Drive để lưu trữ đám mây & đồng bộ.</p>
                </div>
                <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all mt-2 shrink-0" />
              </button>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Toast */}
      {showShareToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 text-xs font-medium border border-slate-700 animate-in fade-in slide-in-from-bottom-5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Đã tạo và sao chép liên kết chia sẻ bài dạy thành công!</span>
        </div>
      )}

      {/* Activity Regeneration Toast */}
      {activityToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-blue-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 text-xs font-medium border border-blue-700 animate-in fade-in slide-in-from-bottom-5">
          <CheckCircle2 className="w-4 h-4 text-blue-300 shrink-0" />
          <span>{activityToast}</span>
        </div>
      )}

      {/* Modal Nhập yêu cầu điều chỉnh hoạt động */}
      {activityModal?.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                  <RefreshCw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">
                    Tạo lại: {activityModal.shortLabel}
                  </h3>
                  <p className="text-xs text-slate-400">Tùy chỉnh và sinh lại chi tiết tương tác 2 chiều cho riêng hoạt động này</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  if (!regeneratingActivity) {
                    setActivityModal(null);
                    setCustomPrompt('');
                  }
                }}
                disabled={!!regeneratingActivity}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50"
                title="Đóng"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Target Activity Badge */}
            <div className="bg-blue-50/60 border border-blue-100 rounded-xl px-3.5 py-2.5 mb-4 flex items-center gap-2">
              <span className="text-xs font-semibold text-blue-600">Hoạt động mục tiêu:</span>
              <span className="text-xs font-bold text-slate-700 truncate">{activityModal.activityName}</span>
            </div>

            {/* Input prompt */}
            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Yêu cầu điều chỉnh của giáo viên:
              </label>
              <textarea
                rows={4}
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Nhập yêu cầu điều chỉnh (VD: Đổi sang trò chơi sắm vai, sử dụng video ngắn, tập trung thảo luận nhóm...)"
                disabled={!!regeneratingActivity}
                className="w-full text-xs text-slate-800 bg-slate-50 border border-slate-300 rounded-xl p-3 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none disabled:bg-slate-100"
              />
              
              {/* Quick suggestion tags */}
              <div className="mt-2.5">
                <p className="text-[11px] font-medium text-slate-400 mb-1.5">Gợi ý nhanh (nhấn để thêm):</p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'Đổi sang trò chơi sắm vai',
                    'Sử dụng video ngắn / tư liệu số',
                    'Tập trung thảo luận nhóm 4',
                    'Tăng cường câu hỏi gợi mở',
                    'Tổ chức trò chơi đố vui sôi động'
                  ].map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => {
                        setCustomPrompt((prev) => prev ? `${prev}, ${sug.toLowerCase()}` : sug);
                      }}
                      disabled={!!regeneratingActivity}
                      className="text-[11px] bg-slate-100 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 text-slate-600 px-2.5 py-1 rounded-lg border border-slate-200 transition-all active:scale-95 disabled:opacity-50"
                    >
                      + {sug}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <p className="text-[11px] text-slate-400 italic">
                * Chỉ tạo lại hoạt động này, giữ nguyên toàn bộ các phần khác.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setActivityModal(null);
                    setCustomPrompt('');
                  }}
                  disabled={!!regeneratingActivity}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors disabled:opacity-50"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleRegenerateActivityWithPrompt}
                  disabled={!!regeneratingActivity}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl transition-all shadow-md shadow-blue-500/20 active:scale-95 disabled:opacity-50"
                >
                  {regeneratingActivity ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Đang tạo lại...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Gửi yêu cầu</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6">
        <div className="max-w-6xl mx-auto px-4 text-center text-slate-500 text-sm">
          <p className="text-blue-600">Công cụ hỗ trợ giảng dạy thông minh. Tác giả Nguyễn Thanh Phương</p>
        </div>
      </footer>

      {/* Modal Cài đặt Google Gemini API Key */}
      <ApiKeyModal
        isOpen={showApiKeyModal}
        onClose={() => setShowApiKeyModal(false)}
        onKeySaved={refreshApiKeyStatus}
      />
    </div>
  );
}
