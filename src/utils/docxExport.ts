import { asBlob } from 'html-docx-js-typescript';
import { marked } from 'marked';
import { buildSynchronizedPromptMarkdown } from '../components/PromptIllustrator';

/**
 * Clean and prepare HTML to ensure optimal rendering in Microsoft Word / DOCX format,
 * while strictly stripping out any interactive UI buttons, prompts, or web-only controls.
 */
function sanitizeHtmlForWord(html: string): string {
  if (!html) return '';

  // Remove script and button elements completely
  let cleaned = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<button\b[^<]*(?:(?!<\/button>)<[^<]*)*<\/button>/gi, '')
    // Remove any containers with classes indicating interactive/web-only elements
    .replace(/<div[^>]*class="[^"]*(?:not-prose|no-export|no-print)[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
    // Remove text matches for regeneration panels and action buttons if any
    .replace(/Tạo lại riêng từng hoạt động trong bài dạy[\s\S]*?Tạo lại:\s*Vận dụng/gi, '')
    .replace(/Tạo lại:\s*(?:Khởi động|Khám phá|Luyện tập|Vận dụng)/gi, '')
    // Replace any malformed line breaks
    .replace(/<br\s*[\/]?>/gi, '<br />')
    // Ensure styles with colors are preserved with inline styles Word understands
    .replace(/style="([^"]*color:\s*red[^"]*)"/gi, 'style="color: #dc2626; font-weight: bold;"')
    .replace(/style="([^"]*color:\s*blue[^"]*)"/gi, 'style="color: #1d4ed8; font-weight: bold;"');

  // TUYỆT ĐỐI KHÔNG để dấu * trong Kế hoạch bài dạy xuất Word theo yêu cầu:
  // 1. Chuyển đổi các thẻ span chứa **text** thành span có font-weight: bold
  cleaned = cleaned.replace(/<span([^>]*)>\s*\*+([^*<]+?)\*+\s*<\/span>/gi, (match, attr, content) => {
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
  cleaned = cleaned.replace(/\*\*\*([^*\n\r]+?)\*\*\*/g, '<b><em>$1</em></b>');

  // 3. Chuyển đổi markdown bold **text** thành <b>$1</b>
  cleaned = cleaned.replace(/\*\*([^*\n\r]+?)\*\*/g, '<b>$1</b>');

  // 4. Nếu có dấu * ở đầu dòng/sau thẻ br dùng làm bullet: "* text" -> "• text"
  cleaned = cleaned.replace(/(^|[\n\r]|<br\s*\/?>)\s*\*\s+/g, '$1• ');

  // 5. Nếu có dấu * trong phép tính nhân (tiểu học): "3 * 4" -> "3 × 4"
  cleaned = cleaned.replace(/(\d+)\s*\*\s*(\d+)/g, '$1 × $2');

  // 6. Chuyển đổi markdown italic *text* thành <em>text</em>
  cleaned = cleaned.replace(/(^|[\s>(])\*([^*\n\r<]+?)\*([\s<),.!]|$)/g, '$1<em>$2</em>$3');

  // 7. Xóa sạch mọi ký tự '*' còn sót lại ở bất kỳ vị trí nào
  cleaned = cleaned.replace(/\*/g, '');

  // 8. Đảm bảo loại bỏ tên học sinh cụ thể trong toàn bộ KHBD (kể cả lời thoại và Mục IV)
  // 8.1. Mời/gọi nhận xét bài làm của bạn (có hoặc không có Cô/Thầy/GV phía trước):
  cleaned = cleaned.replace(
    /(?:(Cô|Thầy|GV)\s+)?([Mm]ời|[Cc]ho)\s+(?:bạn|em)\s+[A-ZÀ-Ỹ][a-zà-ỹ]*\s+nhận xét(?:,?\s*bổ sung)?(?:\s+(?:cho\s+)?bài(?:\s+làm)?\s+của\s+(?:bạn|em)\s+[A-ZÀ-Ỹ][a-zà-ỹ]*)?(?:\s+trên\s+bảng)?/g,
    (m, p1, p2) => {
      if (p1) return `${p1} mời một bạn nhận xét bài làm của bạn trên bảng`;
      return `${p2.charAt(0).toUpperCase() + p2.slice(1)} một bạn nhận xét bài làm của bạn trên bảng`;
    }
  );

  // 8.2. Nhận xét bài làm của bạn [Tên]:
  cleaned = cleaned.replace(
    /nhận xét\s+(?:cho\s+)?(?:bài(?:\s+làm)?\s+của\s+)(?:bạn|em)\s+[A-ZÀ-Ỹ][a-zà-ỹ]*/g,
    'nhận xét bài làm của bạn trên bảng'
  );

  // 8.3. Bài làm / kết quả / đáp án của học sinh cụ thể:
  cleaned = cleaned.replace(
    /(bài(?:\s+làm)?|kết quả|đáp án|phần trình bày)\s+của\s+(?:bạn|em)\s+[A-ZÀ-Ỹ][a-zà-ỹ]*/g,
    '$1 của bạn'
  );

  // 8.4. Gọi từ 2 học sinh trở lên theo tên lên bảng:
  cleaned = cleaned.replace(
    /(?:(Cô|Thầy|GV)\s+)?([Gg]ọi|[Mm]ời)\s+(?:(?:\d+|hai|ba)\s+)?(?:em|bạn)\s+[A-ZÀ-Ỹ][a-zà-ỹ]*(?:\s*,\s*(?:bạn|em)?\s*[A-ZÀ-Ỹ][a-zà-ỹ]*)*\s+(?:và|với)\s+(?:bạn|em)?\s*[A-ZÀ-Ỹ][a-zà-ỹ]*\s+lên bảng(?:\s+chữa bài|\s+làm bài)?/g,
    'Gọi 2 HS lên bảng chữa bài'
  );

  // 8.5. Giáo viên gọi 1 học sinh theo tên làm hành động:
  cleaned = cleaned.replace(
    /(Cô|Thầy|GV)\s+([Mm]ời|[Gg]ọi)\s+(?:bạn|em)\s+[A-ZÀ-Ỹ][a-zà-ỹ]*\s+(lên bảng|trả lời|đọc|chia sẻ|chữa bài|trình bày|làm bài|thực hiện|phát biểu)/g,
    '$1 mời một bạn $3'
  );
  cleaned = cleaned.replace(
    /(?:^|[\n\r]|<br\s*\/?>|\s*-\s*)([Gg]ọi|[Mm]ời)\s+(?:bạn|em)\s+[A-ZÀ-Ỹ][a-zà-ỹ]*\s+(lên bảng|trả lời|đọc|chia sẻ|chữa bài|trình bày|làm bài|thực hiện|phát biểu)/gm,
    '- Gọi 1 HS $2'
  );

  // 8.6. Tuyên dương / khen ngợi học sinh theo tên:
  cleaned = cleaned.replace(
    /(khen ngợi|tuyên dương|động viên|khích lệ)\s+(?:bạn|em)\s+[A-ZÀ-Ỹ][a-zà-ỹ]*/gi,
    '$1 học sinh'
  );

  // 8.7. Trong dấu ngoặc kép lời thoại:
  cleaned = cleaned.replace(
    /(["'“])(Cô|Thầy|GV)\s+mời\s+(?:bạn|em)\s+[A-ZÀ-Ỹ][a-zà-ỹ]*/g,
    '$1$2 mời một bạn'
  );
  cleaned = cleaned.replace(
    /(["'“])([Mm]ời|[Gg]ọi)\s+(?:bạn|em)\s+[A-ZÀ-Ỹ][a-zà-ỹ]*/g,
    '$1Mời một bạn'
  );

  // 8.8. Loại bỏ ví dụ tên học sinh trong Mục IV nếu có (như em An, em Bình...)
  cleaned = cleaned.replace(
    /\s*\((?:ví dụ:?\s*)?(?:như\s+)?(?:các\s+)?(?:em|học sinh)\s+[A-ZÀ-Ỹ][a-zà-ỹ]+(?:\s*,\s*(?:em\s+)?[A-ZÀ-Ỹ][a-zà-ỹ]+)*(?:\s*(?:và|với|cùng)\s*(?:em\s+)?[A-ZÀ-Ỹ][a-zà-ỹ]+)?\)/gi,
    ''
  );
  cleaned = cleaned.replace(
    /(?:,\s*)?(?:ví dụ:?\s*)?(?:như\s+)(?:các\s+)?(?:em|học sinh)\s+[A-ZÀ-Ỹ][a-zà-ỹ]+(?:\s*,\s*(?:em\s+)?[A-ZÀ-Ỹ][a-zà-ỹ]+)*(?:\s*(?:và|với|cùng)\s*(?:em\s+)?[A-ZÀ-Ỹ][a-zà-ỹ]+)?/gi,
    ''
  );
  cleaned = cleaned.replace(
    /(giúp đỡ|hướng dẫn|hỗ trợ|kèm cặp|quan tâm|nhắc nhở)\s+(?:em|học sinh)\s+[A-ZÀ-Ỹ][a-zà-ỹ]+(?:\s*,\s*(?:em\s+)?[A-ZÀ-Ỹ][a-zà-ỹ]+)*/gi,
    '$1 học sinh tiếp thu chậm'
  );

  // 9. Đảm bảo "Môn" và "Lớp" cùng 1 dòng; "Tên bài học" và "Số tiết" cùng 1 dòng theo Công văn 2345
  // 9.1. Hợp nhất Môn và Lớp nếu đang ở 2 dòng riêng biệt
  cleaned = cleaned.replace(
    /(<span[^>]*>Môn:<\/span>[^<\n\r]*<\/span>)\s*(?:<br\s*\/?>|\n)+\s*(<span[^>]*>Lớp:<\/span>[^<\n\r]*?)(?=\s*<br|\s*[\r\n]|$)/gi,
    '$1; $2'
  );
  // 9.2. Hợp nhất Tên bài học và Số tiết nếu đang ở 2 dòng riêng biệt
  cleaned = cleaned.replace(
    /(<span[^>]*>Tên bài (?:học|dạy):<\/span>[^<\n\r]*<\/span>(?:\s*-\s*Tiết\s*\d+)?)\s*(?:<br\s*\/?>|\n)+\s*(<span[^>]*>Số tiết:<\/span>[^<\n\r]*?)(?=\s*<br|\s*[\r\n]|$)/gi,
    '$1; $2'
  );

  // 10. Loại bỏ hàng tr/th trùng lặp chứa tiêu đề "HOẠT ĐỘNG GIÁO VIÊN" / "HOẠT ĐỘNG HỌC SINH" trong bảng Mục III nếu xuất hiện 2 lần
  cleaned = cleaned.replace(
    /(<tr[^>]*>[\s\S]*?<t[hd][^>]*>[\s\S]*?Hoạt động\s*(?:dạy học\s*)?(?:của\s*)?Giáo viên[\s\S]*?<\/t[hd]>[\s\S]*?<t[hd][^>]*>[\s\S]*?Hoạt động\s*(?:học\s*)?(?:của\s*)?Học sinh[\s\S]*?<\/t[hd]>[\s\S]*?<\/tr>\s*)(?:<tbody[^>]*>\s*)?<tr[^>]*>[\s\S]*?<t[hd][^>]*>[\s\S]*?Hoạt động\s*(?:dạy học\s*)?(?:của\s*)?Giáo viên[\s\S]*?<\/t[hd]>[\s\S]*?<t[hd][^>]*>[\s\S]*?Hoạt động\s*(?:học\s*)?(?:của\s*)?Học sinh[\s\S]*?<\/t[hd]>[\s\S]*?<\/tr>/gi,
    '$1'
  );

  return cleaned;
}

/**
 * Automatically downloads a Blob directly to the user's Download directory with the exact filename.
 */
function downloadBlobDirectly(blob: Blob, filename: string): void {
  const cleanFileName = filename.replace(/\.docx$/i, "").trim();
  const fullFileName = `${cleanFileName}.docx`;

  const url = URL.createObjectURL(blob);
  const downloadLink = document.createElement('a');
  downloadLink.href = url;
  downloadLink.download = fullFileName;
  downloadLink.style.display = 'none';

  document.body.appendChild(downloadLink);
  downloadLink.click();

  setTimeout(() => {
    if (document.body.contains(downloadLink)) {
      document.body.removeChild(downloadLink);
    }
    URL.revokeObjectURL(url);
  }, 2000);
}

/**
 * Exports an HTML fragment (e.g. from DOM container) to a genuine Microsoft Word (.docx) document.
 */
export async function exportToDocx(
  elementHtml: string,
  filename: string,
  options?: {
    title?: string;
    isSlide?: boolean;
  }
): Promise<void> {
  const isSlide = options?.isSlide || false;
  const sanitizedContent = sanitizeHtmlForWord(elementHtml);

  const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${options?.title || 'Kế hoạch bài dạy'}</title>
  <style>
    @page {
      size: 210mm 297mm; /* A4 size standard */
      margin: 20mm 15mm 20mm 30mm; /* Top: 2cm, Right: 1.5cm, Bottom: 2cm, Left: 3cm */
    }
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 14pt;
      line-height: 1.25;
      color: #000000;
      background-color: #ffffff;
      text-align: left;
    }
    p, div, li {
      font-family: 'Times New Roman', Times, serif;
      font-size: 14pt;
      line-height: 1.25;
      margin-top: 0pt;
      margin-bottom: 4pt;
      padding: 0pt;
    }
    h1 {
      font-family: 'Times New Roman', Times, serif;
      font-size: 15pt;
      font-weight: bold;
      color: #dc2626;
      text-align: center;
      text-transform: uppercase;
      margin-top: 6pt;
      margin-bottom: 12pt;
    }
    h2, h3, h4 {
      font-family: 'Times New Roman', Times, serif;
      font-size: 14pt;
      font-weight: bold;
      color: #1e293b;
      margin-top: 10pt;
      margin-bottom: 4pt;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #000000;
      margin-top: 8pt;
      margin-bottom: 8pt;
    }
    table.header-meta-table {
      border: none !important;
      margin-top: 0pt !important;
      margin-bottom: 4pt !important;
    }
    table.header-meta-table td, table.header-meta-table tr {
      border: none !important;
      padding: 0pt !important;
    }
    table:not(.header-meta-table) th, table:not(.header-meta-table) td {
      width: 50% !important;
    }
    th, td {
      border: 1px solid #000000;
      padding: 6pt 8pt;
      vertical-align: top;
      font-family: 'Times New Roman', Times, serif;
      font-size: 14pt;
      line-height: 1.2;
      text-align: left;
    }
    th {
      background-color: #f1f5f9;
      font-weight: bold;
      text-align: center;
      color: #1d4ed8;
    }
    span[style*="color: red"], span[style*="color:red"], span[style*="color: #dc2626"], span[style*="color:#dc2626"] {
      color: #dc2626;
      font-weight: bold;
    }
    span[style*="color: blue"], span[style*="color:blue"], span[style*="color: #1d4ed8"], span[style*="color:#1d4ed8"], span[style*="color: #2563eb"] {
      color: #1d4ed8;
      font-weight: bold;
    }
    ul, ol {
      margin-top: 0pt;
      margin-bottom: 4pt;
      padding-left: 20pt;
    }
    li {
      margin-bottom: 2pt;
    }
    strong, b {
      font-weight: bold;
    }
    em, i {
      font-style: italic;
    }
    hr {
      border: 0;
      border-top: 1px solid #cbd5e1;
      margin: 12pt 0;
    }
  </style>
</head>
<body>
  ${sanitizedContent}
</body>
</html>`;

  // Standard margins in twips (1 mm = 56.7 twips)
  // Left: 30mm = 1701 twips, Top: 20mm = 1134 twips, Bottom: 20mm = 1134 twips, Right: 15mm = 850 twips
  const blob = await asBlob(fullHtml, {
    orientation: isSlide ? 'portrait' : 'portrait',
    margins: {
      top: 1134,
      bottom: 1134,
      left: 1701,
      right: 850,
    },
  });

  const finalBlob = blob instanceof Blob 
    ? blob 
    : new Blob([blob], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

  downloadBlobDirectly(finalBlob, filename);
}

/**
 * Converts Prompt Markdown content into a beautifully structured, comprehensive DOCX document.
 * Guarantees 100% 1-to-1 sync with slideContent.
 */
export async function exportPromptMarkdownToDocx(
  markdownContent: string,
  filename: string,
  options?: {
    title?: string;
    slideContent?: string;
    subject?: string;
    grade?: string;
  }
): Promise<void> {
  // Guarantee synchronized 1-to-1 markdown across all slides
  const completeMarkdown = buildSynchronizedPromptMarkdown(
    markdownContent,
    options?.slideContent || '',
    options?.subject || '',
    options?.grade || ''
  );

  // Convert Markdown into clean semantic HTML
  const parsedHtml = await marked.parse(completeMarkdown);
  
  // Format headings and containers for Word styling
  let formattedHtml = parsedHtml
    .replace(/<h3>Slide\s+(\d+)[:.]?\s*([^<]+)<\/h3>/gi, `
      <div style="page-break-inside: avoid; margin-top: 18pt; margin-bottom: 8pt; border-bottom: 2px solid #7c3aed; padding-bottom: 4pt;">
        <h2 style="color: #6b21a8; font-size: 15pt; font-weight: bold; margin: 0;">Slide $1: $2</h2>
      </div>
    `)
    .replace(/<h4>🎨\s*1\.\s*Prompt\s+tạo\s+hình\s+ảnh([^<]*)<\/h4>/gi, `
      <h3 style="color: #be185d; font-size: 14pt; font-weight: bold; margin-top: 10pt; margin-bottom: 4pt;">🖼️ 1. Prompt tạo hình ảnh minh họa (Canva / Bing Creator / Midjourney / DALL-E 3)</h3>
    `)
    .replace(/<h4>🎬\s*2\.\s*Prompt\s+tạo\s+video([^<]*)<\/h4>/gi, `
      <h3 style="color: #0369a1; font-size: 14pt; font-weight: bold; margin-top: 10pt; margin-bottom: 4pt;">🎬 2. Prompt tạo video / hoạt hình (Runway / Sora / HeyGen / Pika)</h3>
    `)
    .replace(/<h4>🎮\s*3\.\s*(?:Gợi\s+ý\s+trò\s+chơi|Trò\s+chơi\s+tương\s+tác)([^<]*)<\/h4>/gi, `
      <h3 style="color: #15803d; font-size: 14pt; font-weight: bold; margin-top: 10pt; margin-bottom: 4pt;">🎮 3. Gợi ý trò chơi tương tác (Quizizz / Kahoot / Wordwall / ChatGPT)</h3>
    `)
    .replace(/<code>([^<]+)<\/code>/gi, `
      <span style="font-family: 'Consolas', 'Courier New', monospace; background-color: #f1f5f9; padding: 2pt 4pt; font-size: 12pt; color: #0f172a; border: 1px solid #e2e8f0;">$1</span>
    `);

  const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${options?.title || 'Danh sách Prompt Minh Họa'}</title>
  <style>
    @page {
      size: 210mm 297mm; /* A4 size standard */
      margin: 20mm 15mm 20mm 30mm; /* Top: 2cm, Right: 1.5cm, Bottom: 2cm, Left: 3cm */
    }
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 14pt;
      line-height: 1.3;
      color: #000000;
      background-color: #ffffff;
      text-align: left;
    }
    p, div, li {
      font-family: 'Times New Roman', Times, serif;
      font-size: 14pt;
      line-height: 1.3;
      margin-top: 0pt;
      margin-bottom: 4pt;
    }
    h1 {
      font-family: 'Times New Roman', Times, serif;
      font-size: 16pt;
      font-weight: bold;
      color: #dc2626;
      text-align: center;
      text-transform: uppercase;
      margin-top: 6pt;
      margin-bottom: 14pt;
    }
    h2 {
      font-family: 'Times New Roman', Times, serif;
      font-size: 15pt;
      font-weight: bold;
      color: #6b21a8;
      margin-top: 14pt;
      margin-bottom: 6pt;
    }
    h3 {
      font-family: 'Times New Roman', Times, serif;
      font-size: 14pt;
      font-weight: bold;
      margin-top: 10pt;
      margin-bottom: 4pt;
    }
    ul, ol {
      margin-top: 0pt;
      margin-bottom: 6pt;
      padding-left: 22pt;
    }
    li {
      margin-bottom: 3pt;
    }
    strong, b {
      font-weight: bold;
      color: #0f172a;
    }
    em, i {
      font-style: italic;
    }
  </style>
</head>
<body>
  ${formattedHtml}
</body>
</html>`;

  const blob = await asBlob(fullHtml, {
    orientation: 'portrait',
    margins: {
      top: 1134,
      bottom: 1134,
      left: 1701,
      right: 850,
    },
  });

  const finalBlob = blob instanceof Blob 
    ? blob 
    : new Blob([blob], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

  downloadBlobDirectly(finalBlob, filename);
}
