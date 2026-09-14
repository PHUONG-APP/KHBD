import React, { useState, useMemo } from 'react';
import { 
  Copy, 
  Check, 
  Sparkles, 
  Image as ImageIcon, 
  Video, 
  Gamepad2, 
  Layers, 
  FileText, 
  Search, 
  CheckCircle2, 
  HelpCircle, 
  Palette, 
  Bot, 
  Terminal, 
  Code2, 
  Film,
  ListOrdered
} from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeRaw from 'rehype-raw';
import rehypeKatex from 'rehype-katex';

export interface ImagePromptData {
  purpose: string;
  vietnamesePrompt: string;
  englishPrompt: string;
  rawText?: string;
}

export interface VideoPromptData {
  tools: string;
  vietnameseScript: string;
  englishPrompt: string;
  rawText?: string;
}

export interface GamePromptData {
  platform: string;
  gameType: string;
  chatGptCommand: string;
  question: string;
  options: string;
  correctAnswer: string;
  rawText?: string;
}

export interface SlidePromptData {
  slideNumber: number;
  slideTitle: string;
  periodLabel?: string;
  rawText: string;
  image: ImagePromptData;
  video: VideoPromptData;
  game: GamePromptData;
}

interface PromptIllustratorProps {
  content: string;
  slideContent?: string;
  subject?: string;
  grade?: string;
}

/**
 * Extracts list of slides defined in tab "Thiết kế Slide" (slideContent)
 */
function extractSlidesFromSlideDesign(slideContent: string): Array<{
  slideNumber: number;
  slideTitle: string;
  periodLabel?: string;
  detailsText: string;
  imageDesc?: string;
  dialogue?: string;
  interaction?: string;
}> {
  if (!slideContent || !slideContent.trim()) return [];

  const results: Array<{
    slideNumber: number;
    slideTitle: string;
    periodLabel?: string;
    detailsText: string;
    imageDesc?: string;
    dialogue?: string;
    interaction?: string;
  }> = [];

  // Look for periods if present (e.g., ### TIẾT 1, ### TIẾT 2)
  const periodBlocks = slideContent.split(/(?=(?:###|##|\*\*)\s*TIẾT\s+\d+)/i);
  let globalSlideCounter = 1;

  periodBlocks.forEach((block) => {
    const periodMatch = block.match(/(?:###|##|\*\*)\s*TIẾT\s+(\d+)/i);
    const periodLabel = periodMatch ? `Tiết ${periodMatch[1]}` : undefined;

    // Match each slide within this block: **Slide X: ...** or ### Slide X: ... or Slide X: ...
    const slideMatches = block.split(/(?=(?:###|\*\*|##)?\s*Slide\s+\d+[:.])/i);

    slideMatches.forEach((sMatch) => {
      const trimmed = sMatch.trim();
      if (!trimmed) return;

      const headerMatch = trimmed.match(/(?:###|\*\*|##)?\s*Slide\s+(\d+)[:.]?\s*([^\n\r*#]+)/i);
      if (!headerMatch) return;

      const rawTitle = headerMatch[2].replace(/\*\*/g, '').replace(/^[:-]\s*/, '').trim();
      const slideTitle = rawTitle || `Hoạt động Slide ${globalSlideCounter}`;

      // Extract specific subfields if present in slide design
      const imgMatch = trimmed.match(/(?:-\s*\*\*Mô\s+tả\s+hình\s+ảnh:\*\*|Mô\s+tả\s+hình\s+ảnh:)\s*([^\n\r]+)/i);
      const dialogueMatch = trimmed.match(/(?:-\s*\*\*Lời\s+thoại\s+giáo\s+viên:\*\*|Lời\s+thoại:)\s*([^\n\r]+)/i);
      const interMatch = trimmed.match(/(?:-\s*\*\*Tính\s+tương\s+tác:\*\*|Tính\s+tương\s+tác:)\s*([^\n\r]+)/i);

      results.push({
        slideNumber: globalSlideCounter,
        slideTitle,
        periodLabel,
        detailsText: trimmed,
        imageDesc: imgMatch ? imgMatch[1].trim() : undefined,
        dialogue: dialogueMatch ? dialogueMatch[1].trim() : undefined,
        interaction: interMatch ? interMatch[1].trim() : undefined,
      });

      globalSlideCounter++;
    });
  });

  return results;
}

/**
 * Extracts prompt blocks from tab "Prompt minh họa" (content)
 */
function extractPromptBlocks(content: string): Array<{
  rawSlideNumber?: number;
  slideTitle: string;
  rawText: string;
  image?: Partial<ImagePromptData>;
  video?: Partial<VideoPromptData>;
  game?: Partial<GamePromptData>;
}> {
  if (!content || !content.trim()) return [];

  // Remove the H1 title if present
  const cleaned = content.replace(/<h1[^>]*>[\s\S]*?<\/h1>/gi, '').trim();

  // Split by slide headers
  const blocks = cleaned.split(/(?=(?:###|\*\*|##)?\s*Slide\s+\d+[:.])/i);
  const results: Array<{
    rawSlideNumber?: number;
    slideTitle: string;
    rawText: string;
    image?: Partial<ImagePromptData>;
    video?: Partial<VideoPromptData>;
    game?: Partial<GamePromptData>;
  }> = [];

  blocks.forEach((block, idx) => {
    const trimmed = block.trim();
    if (!trimmed) return;

    const headerMatch = trimmed.match(/(?:###|\*\*|##)?\s*Slide\s+(\d+)[:.]?\s*([^\n\r*#]+)/i);
    const rawSlideNumber = headerMatch ? parseInt(headerMatch[1], 10) : idx + 1;
    const slideTitle = headerMatch 
      ? headerMatch[2].replace(/\*\*/g, '').replace(/^[:-]\s*/, '').trim() 
      : `Slide ${rawSlideNumber}`;

    // --- 1. Image Prompt ---
    let image: Partial<ImagePromptData> | undefined = undefined;
    const imageMatch = trimmed.match(/(?:####?\s*(?:🎨|🖼️|1\.)?\s*Prompt\s+tạo\s+hình\s+ảnh|####?\s*🖼️\s*Ảnh)[\s\S]*?(?=(?:####?\s*(?:🎬|🎥|🎮|2\.|3\.)|$))/i);
    if (imageMatch) {
      const imgText = imageMatch[0];
      const purposeMatch = imgText.match(/-\s*\*\*Mục\s+đích:\*\*\s*([^\n\r]+)/i);
      const vnPromptMatch = imgText.match(/(?:-\s*\*\*Prompt\s+Tiếng\s+Việt[^:]*:\*\*|-\s*\*\*Câu\s+lệnh\s+tiếng\s+Việt[^:]*:\*\*)\s*([^\n\r]+)/i);
      const enPromptMatch = imgText.match(/(?:-\s*\*\*Prompt\s+Tiếng\s+Anh[^:]*:\*\*|-\s*\*\*Câu\s+lệnh\s+tiếng\s+Anh[^:]*:\*\*)\s*`?([^\n\r`]+)`?/i);

      let vnPrompt = vnPromptMatch ? vnPromptMatch[1].replace(/^[“"']|[”"']$/g, '').trim() : '';
      let enPrompt = enPromptMatch ? enPromptMatch[1].replace(/^[“"`']|[”"`']$/g, '').trim() : '';

      if (!vnPrompt) {
        const vnBlockMatch = imgText.match(/Tiếng\s+Việt[^:]*:\s*([^\n]+)/i);
        if (vnBlockMatch) vnPrompt = vnBlockMatch[1].trim();
      }
      if (!enPrompt) {
        const enBlockMatch = imgText.match(/Tiếng\s+Anh[^:]*:\s*`?([^`\n]+)`?/i);
        if (enBlockMatch) enPrompt = enBlockMatch[1].trim();
      }

      image = {
        purpose: purposeMatch ? purposeMatch[1].trim() : undefined,
        vietnamesePrompt: vnPrompt || undefined,
        englishPrompt: enPrompt || undefined,
        rawText: imgText,
      };
    }

    // --- 2. Video Prompt ---
    let video: Partial<VideoPromptData> | undefined = undefined;
    const videoMatch = trimmed.match(/(?:####?\s*(?:🎬|🎥|2\.)?\s*Prompt\s+tạo\s+video|####?\s*🎬\s*Video)[\s\S]*?(?=(?:####?\s*(?:🎮|🎲|3\.)|$))/i);
    if (videoMatch) {
      const vidText = videoMatch[0];
      const toolMatch = vidText.match(/-\s*\*\*Công\s+cụ\s+gợi\s+ý:\*\*\s*([^\n\r]+)/i);
      const vnScriptMatch = vidText.match(/(?:-\s*\*\*Kịch\s+bản\s+chuyển\s+động[^:]*:\*\*|-\s*\*\*Kịch\s+bản\s+tiếng\s+Việt[^:]*:\*\*)\s*([^\n\r]+)/i);
      let vnScript = vnScriptMatch ? vnScriptMatch[1].replace(/^[“"']|[”"']$/g, '').trim() : '';
      if (!vnScript) {
        const generalVnMatch = vidText.match(/(?:Kịch bản chuyển động|Prompt Video|chuyển động)[^:]*:\s*([^\n]+)/i);
        if (generalVnMatch) vnScript = generalVnMatch[1].trim();
      }

      const enVideoMatch = vidText.match(/(?:-\s*\*\*Prompt\s+Tiếng\s+Anh[^:]*:\*\*|-\s*\*\*Video\s+Prompt\s+English[^:]*:\*\*)\s*`?([^\n\r`]+)`?/i);
      let enVideoPrompt = enVideoMatch ? enVideoMatch[1].replace(/^[“"`']|[”"`']$/g, '').trim() : '';
      if (!enVideoPrompt) {
        const generalEnMatch = vidText.match(/Prompt\s+Tiếng\s+Anh[^:]*:\s*`?([^`\n]+)`?/i);
        if (generalEnMatch) enVideoPrompt = generalEnMatch[1].trim();
      }

      video = {
        tools: toolMatch ? toolMatch[1].trim() : undefined,
        vietnameseScript: vnScript || undefined,
        englishPrompt: enVideoPrompt || undefined,
        rawText: vidText,
      };
    }

    // --- 3. Game Prompt ---
    let game: Partial<GamePromptData> | undefined = undefined;
    const gameMatch = trimmed.match(/(?:####?\s*(?:🎮|🎲|3\.)?\s*(?:Gợi\s+ý\s+trò\s+chơi|Trò\s+chơi\s+tương\s+tác)|####?\s*🎮\s*Game)[\s\S]*$/i);
    if (gameMatch) {
      const gameText = gameMatch[0];
      const platformMatch = gameText.match(/-\s*\*\*Nền\s+tảng:\*\*\s*([^\n\r]+)/i);
      const gameTypeMatch = gameText.match(/-\s*\*\*Dạng\s+trò\s+chơi:\*\*\s*([^\n\r]+)/i);

      const chatGptMatch = gameText.match(/(?:-\s*\*\*Câu\s+lệnh\s+dán\s+vào\s+ChatGPT[^:]*:\*\*|-\s*\*\*Lệnh\s+ChatGPT[^:]*:\*\*)\s*`?([^\n\r`]+)`?/i);
      let chatGptCommand = chatGptMatch ? chatGptMatch[1].replace(/^[“"`']|[”"`']$/g, '').trim() : '';
      if (!chatGptCommand) {
        const generalGptMatch = gameText.match(/ChatGPT[^:]*:\s*`?([^`\n]+)`?/i);
        if (generalGptMatch) chatGptCommand = generalGptMatch[1].trim();
      }

      const qMatch = gameText.match(/•\s*\*\*Câu\s+hỏi:\*\*\s*([^\n\r]+)/i);
      const optMatch = gameText.match(/•\s*\*\*Lựa\s+chọn:\*\*\s*([^\n\r]+)/i);
      const ansMatch = gameText.match(/•\s*\*\*Đáp\s+án\s+đúng:\*\*\s*([^\n\r]+)/i);

      game = {
        platform: platformMatch ? platformMatch[1].trim() : undefined,
        gameType: gameTypeMatch ? gameTypeMatch[1].trim() : undefined,
        chatGptCommand: chatGptCommand || undefined,
        question: qMatch ? qMatch[1].trim() : undefined,
        options: optMatch ? optMatch[1].trim() : undefined,
        correctAnswer: ansMatch ? ansMatch[1].trim() : undefined,
        rawText: gameText,
      };
    }

    results.push({
      rawSlideNumber,
      slideTitle,
      rawText: trimmed,
      image,
      video,
      game,
    });
  });

  return results;
}

/**
 * Builds rich, fully filled, pedagogically sound fallback prompts if AI output lacked any field.
 * Guaranteed: ZERO BLANK CARDS.
 */
function buildCompleteSlidePrompt(
  slideNum: number,
  title: string,
  subject: string,
  grade: string,
  existingImage?: Partial<ImagePromptData>,
  existingVideo?: Partial<VideoPromptData>,
  existingGame?: Partial<GamePromptData>,
  periodLabel?: string
): SlidePromptData {
  const cleanSubject = subject || 'Tiểu học';
  const cleanGrade = grade || '1';
  const cleanTitle = title || `Hoạt động Slide ${slideNum}`;

  // 1. Image
  const purpose = existingImage?.purpose || `Minh họa trực quan, sinh động cho nội dung: ${cleanTitle} (Môn ${cleanSubject} Lớp ${cleanGrade}).`;
  const vietnamesePrompt = existingImage?.vietnamesePrompt || 
    `Tranh minh họa 3D phong cách hoạt hình Pixar/chibi dễ thương cho học sinh Lớp ${cleanGrade} môn ${cleanSubject}: Chủ đề "${cleanTitle}", không gian lớp học vui tươi, các bạn học sinh tiểu học Việt Nam tương tác hào hứng, màu sắc tươi sáng pastel, độ nét cao 4k, tỉ lệ khung hình 16:9.`;
  const englishPrompt = existingImage?.englishPrompt || 
    `3D Pixar style cute cartoon educational illustration for primary school students grade ${cleanGrade} ${cleanSubject}: theme "${cleanTitle}", cute friendly Vietnamese primary school children learning happily, vibrant warm pastel classroom background, soft studio lighting, cinematic composition, high resolution 8k, aspect ratio 16:9 --ar 16:9 --v 6.0`;

  // 2. Video
  const tools = existingVideo?.tools || 'Runway Gen-3 Alpha, OpenAI Sora, HeyGen, Pika';
  const vietnameseScript = existingVideo?.vietnameseScript || 
    `Đoạn video hoạt hình chuyển động 5-10s giới thiệu ${cleanTitle}: Nhân vật hoạt hình học sinh tiểu học chuyển động mượt mà, vẫy tay chào vui vẻ, hiệu ứng tương tác sinh động thu hút sự chú ý của học sinh đầu giờ học.`;
  const enVideoPrompt = existingVideo?.englishPrompt || 
    `Cinematic 3D animation of primary school students exploring ${cleanTitle}, smooth camera motion 4k 60fps, cute friendly characters moving happily in vibrant educational classroom, soft volumetric lighting.`;

  // 3. Game
  const platform = existingGame?.platform || 'Quizizz / Kahoot / Wordwall / Blooket';
  const gameType = existingGame?.gameType || 'Trắc nghiệm nhanh tương tác / Vòng quay may mắn';
  const question = existingGame?.question || `Câu hỏi tương tác củng cố cho hoạt động "${cleanTitle}": Hãy chọn phương án đúng nhất?`;
  const options = existingGame?.options || 'A. Lựa chọn đúng | B. Lựa chọn 2 | C. Lựa chọn 3 | D. Lựa chọn 4';
  const correctAnswer = existingGame?.correctAnswer || 'A. Lựa chọn đúng (Rất tốt, em đã hiểu bài rất xuất sắc!)';
  
  const chatGptCommand = existingGame?.chatGptCommand || 
    `Hãy tạo bảng 5 câu hỏi trắc nghiệm dạng Table/CSV gồm các cột: Question, Option 1, Option 2, Option 3, Option 4, Correct Answer dựa trên chủ đề "${cleanTitle}" môn ${cleanSubject} Lớp ${cleanGrade} (Câu hỏi mẫu: "${question}", Đáp án: "${correctAnswer}") để tôi tải lên Quizizz/Kahoot.`;

  // Assemble canonical Raw Text for copying
  const rawText = `### Slide ${slideNum}: ${cleanTitle}${periodLabel ? ` (${periodLabel})` : ''}

#### 🎨 1. Prompt tạo hình ảnh minh họa (Canva / Bing Creator / Midjourney / DALL-E 3)
- **Mục đích:** ${purpose}
- **Prompt Tiếng Việt (Canva / Bing):** ${vietnamesePrompt}
- **Prompt Tiếng Anh (Midjourney / DALL-E 3):** \`${englishPrompt}\`

#### 🎬 2. Prompt tạo video / hoạt hình (Runway / Sora / HeyGen / Pika)
- **Công cụ gợi ý:** ${tools}
- **Kịch bản chuyển động (Tiếng Việt):** ${vietnameseScript}
- **Prompt Tiếng Anh (Runway / Sora / Pika):** \`${enVideoPrompt}\`

#### 🎮 3. Gợi ý trò chơi tương tác (Quizizz / Kahoot / Wordwall / Blooket)
- **Nền tảng:** ${platform}
- **Dạng trò chơi:** ${gameType}
- **Câu lệnh dán vào ChatGPT (Tạo Quizizz / Kahoot):** \`${chatGptCommand}\`
- **Kịch bản câu hỏi & đáp án mẫu:**
  • **Câu hỏi:** ${question}
  • **Lựa chọn:** ${options}
  • **Đáp án đúng:** ${correctAnswer}`;

  return {
    slideNumber: slideNum,
    slideTitle: cleanTitle,
    periodLabel,
    rawText,
    image: {
      purpose,
      vietnamesePrompt,
      englishPrompt,
      rawText: existingImage?.rawText,
    },
    video: {
      tools,
      vietnameseScript,
      englishPrompt: enVideoPrompt,
      rawText: existingVideo?.rawText,
    },
    game: {
      platform,
      gameType,
      chatGptCommand,
      question,
      options,
      correctAnswer,
      rawText: existingGame?.rawText,
    },
  };
}

export function getSynchronizedSlides(
  content: string,
  slideContent: string = '',
  subject: string = '',
  grade: string = ''
): SlidePromptData[] {
  const promptsArray: SlidePromptData[] = [];
  const seenSlideKeys = new Set<number>();

  // 1. Parse slide list from Thiết kế Slide (canonical ground truth for 1-to-1 sync)
  const slidesFromDesign = extractSlidesFromSlideDesign(slideContent);
  // 2. Parse prompt blocks from Prompt minh họa
  const promptBlocks = extractPromptBlocks(content);

  if (slidesFromDesign.length > 0) {
    // Sync 100% with the exact number and titles of slides from "Thiết kế Slide"
    slidesFromDesign.forEach((slideItem, index) => {
      const slideNum = index + 1;
      if (seenSlideKeys.has(slideNum)) return;
      seenSlideKeys.add(slideNum);

      // Find corresponding prompt block:
      // Try by exact index, or by matching slide number, or by title similarity
      let matchedPrompt = promptBlocks.find((p) => p.rawSlideNumber === slideNum);
      if (!matchedPrompt && promptBlocks[index]) {
        matchedPrompt = promptBlocks[index];
      }
      if (!matchedPrompt) {
        matchedPrompt = promptBlocks.find((p) => 
          p.slideTitle && slideItem.slideTitle && (
            p.slideTitle.toLowerCase().includes(slideItem.slideTitle.toLowerCase().slice(0, 10)) ||
            slideItem.slideTitle.toLowerCase().includes(p.slideTitle.toLowerCase().slice(0, 10))
          )
        );
      }

      const completeSlide = buildCompleteSlidePrompt(
        slideNum,
        slideItem.slideTitle,
        subject,
        grade,
        matchedPrompt?.image,
        matchedPrompt?.video,
        matchedPrompt?.game,
        slideItem.periodLabel
      );

      promptsArray.push(completeSlide);
    });
  } else if (promptBlocks.length > 0) {
    // If slideContent was not provided or not parsed, use promptBlocks directly with strict re-indexing 1..N
    promptBlocks.forEach((pBlock, index) => {
      const slideNum = index + 1;
      if (seenSlideKeys.has(slideNum)) return;
      seenSlideKeys.add(slideNum);

      const completeSlide = buildCompleteSlidePrompt(
        slideNum,
        pBlock.slideTitle,
        subject,
        grade,
        pBlock.image,
        pBlock.video,
        pBlock.game
      );

      promptsArray.push(completeSlide);
    });
  }

  // Strict ascending sort: Slide 1 -> Slide 2 -> ... -> Slide N
  promptsArray.sort((a, b) => a.slideNumber - b.slideNumber);

  return promptsArray;
}

export function buildSynchronizedPromptMarkdown(
  content: string,
  slideContent: string = '',
  subject: string = '',
  grade: string = ''
): string {
  const slides = getSynchronizedSlides(content, slideContent, subject, grade);
  if (slides.length === 0) return content || '';

  const cleanSubject = subject ? subject.toUpperCase() : 'TIỂU HỌC';
  const cleanGrade = grade || '1';

  let md = `<h1 style="text-align: center; color: red;">DANH SÁCH PROMPT MINH HỌA & TƯƠNG TÁC CHO TỪNG SLIDE</h1>\n\n<p style="text-align: center; color: #6b21a8; font-weight: bold;">Môn: ${cleanSubject} - Lớp: ${cleanGrade} (Đồng bộ đầy đủ ${slides.length} Slide từ Slide 1 đến Slide ${slides.length})</p>\n\n`;

  slides.forEach((slide) => {
    md += `${slide.rawText}\n\n---\n\n`;
  });

  return md;
}

export const PromptIllustrator: React.FC<PromptIllustratorProps> = ({ 
  content, 
  slideContent = '', 
  subject = '', 
  grade = '' 
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'markdown'>('cards');
  const [searchQuery, setSearchQuery] = useState('');

  // Pure clean text copy helper
  const copyPureText = (text: string, id: string) => {
    if (!text) return;
    const cleaned = text
      .trim()
      .replace(/^[`"“'‘]+|[`"”'’]+$/g, '')
      .trim();
    
    navigator.clipboard.writeText(cleaned);
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId((prev) => (prev === id ? null : prev));
    }, 2000);
  };

  /**
   * SYNCHRONIZED, DEDUPLICATED & STRICTLY ORDERED SLIDES PARSER:
   * 1. Resets promptsArray on every execution
   * 2. Extracts slides from "Thiết kế Slide" (tab Thiết kế Slide) to ensure 100% sync
   * 3. Matches prompt blocks from "Prompt minh họa" (tab Prompt minh họa)
   * 4. Enforces ascending order: Slide 1 -> Slide 2 -> ... -> Slide N
   * 5. Fills 100% complete content (Zero blank/empty cards)
   */
  const parsedSlides = useMemo<SlidePromptData[]>(() => {
    return getSynchronizedSlides(content, slideContent, subject, grade);
  }, [content, slideContent, subject, grade]);

  // Filter slides based on search query
  const filteredSlides = useMemo(() => {
    if (!searchQuery.trim()) return parsedSlides;
    const query = searchQuery.toLowerCase();
    return parsedSlides.filter(
      (s) =>
        s.slideTitle.toLowerCase().includes(query) ||
        `slide ${s.slideNumber}`.includes(query) ||
        s.rawText.toLowerCase().includes(query)
    );
  }, [parsedSlides, searchQuery]);

  // Helper to copy entire slide
  const handleCopyFullSlide = (slide: SlidePromptData) => {
    copyPureText(slide.rawText, `full_slide_${slide.slideNumber}`);
  };

  return (
    <div className="space-y-6">
      {/* Header Bar within Tab */}
      <div className="bg-linear-to-r from-violet-50 via-purple-50 to-pink-50 p-4 sm:p-5 rounded-2xl border border-purple-100/80 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-purple-600 text-white rounded-xl shadow-md shadow-purple-200">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-base sm:text-lg flex items-center gap-2">
              <span>Bộ Prompt Minh Họa & Tương Tác</span>
              <span className="text-xs px-2.5 py-0.5 bg-purple-100 text-purple-700 font-semibold rounded-full border border-purple-200 flex items-center gap-1">
                <ListOrdered className="w-3 h-3 text-purple-600" />
                {parsedSlides.length > 0 ? `Đầy đủ ${parsedSlides.length} Slide (Sắp xếp 1 → ${parsedSlides.length})` : 'Đang xử lý'}
              </span>
            </h3>
            <p className="text-xs sm:text-sm text-slate-500">
              Đồng bộ 100% với Thiết kế Slide. Định dạng chuẩn copy là dùng ngay trên Canva, Midjourney, Bing Creator, Runway, Sora, Quizizz, Kahoot...
            </p>
          </div>
        </div>

        {/* View mode toggle & search */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {parsedSlides.length > 0 && (
            <div className="relative flex-1 sm:w-56">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm Slide, từ khóa..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-white border border-purple-200/80 rounded-xl text-xs sm:text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
          )}

          <div className="flex bg-purple-100/70 p-1 rounded-xl border border-purple-200/60">
            <button
              onClick={() => setViewMode('cards')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'cards'
                  ? 'bg-white text-purple-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Xem Thẻ Slide</span>
            </button>
            <button
              onClick={() => setViewMode('markdown')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'markdown'
                  ? 'bg-white text-purple-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Văn bản gốc</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {viewMode === 'markdown' || parsedSlides.length === 0 ? (
        <div className="markdown-body p-5 bg-white rounded-2xl border border-slate-200">
          <Markdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeRaw, rehypeKatex]}
          >
            {content || 'Chưa có dữ liệu Prompt minh họa. Vui lòng nhấn Tạo kế hoạch bài dạy.'}
          </Markdown>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredSlides.map((slide) => (
            <div
              key={`slide-card-${slide.slideNumber}`}
              id={`slide-prompt-card-${slide.slideNumber}`}
              className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all overflow-hidden"
            >
              {/* Slide Card Header */}
              <div className="bg-slate-50/90 px-5 py-3.5 border-b border-slate-200/90 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-xl bg-purple-600 text-white font-bold text-sm flex items-center justify-center shadow-xs">
                    {slide.slideNumber}
                  </span>
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm sm:text-base flex items-center gap-2">
                      <span>Slide {slide.slideNumber}: {slide.slideTitle}</span>
                      {slide.periodLabel && (
                        <span className="text-[11px] px-2 py-0.5 bg-blue-50 text-blue-700 font-semibold rounded-md border border-blue-200">
                          {slide.periodLabel}
                        </span>
                      )}
                    </h4>
                  </div>
                </div>

                <button
                  id={`btn-copy-full-slide-${slide.slideNumber}`}
                  onClick={() => handleCopyFullSlide(slide)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 shadow-2xs transition-all active:scale-95 ml-auto"
                  title="Sao chép toàn bộ Prompt của Slide này"
                >
                  {copiedId === `full_slide_${slide.slideNumber}` ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-green-600" />
                      <span className="text-green-700 font-semibold">Đã chép Slide!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                      <span>Chép toàn bộ Slide</span>
                    </>
                  )}
                </button>
              </div>

              {/* Slide Prompts Body */}
              <div className="p-5 space-y-5">
                {/* ---------------------------------------------------------------- */}
                {/* 1. SECTION: 🖼️ ẢNH (CANVA / BING / MIDJOURNEY / DALL-E 3)         */}
                {/* ---------------------------------------------------------------- */}
                <div className="rounded-xl border border-pink-100 bg-linear-to-b from-pink-50/40 via-white to-pink-50/20 p-4 sm:p-4.5 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-pink-500 text-white rounded-lg shadow-2xs">
                        <ImageIcon className="w-4 h-4" />
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-800 text-sm sm:text-base">
                          🖼️ Ảnh (Canva / Bing / Midjourney)
                        </span>
                        <span className="text-[11px] text-pink-700 font-medium bg-pink-100/90 px-2 py-0.5 rounded-md border border-pink-200/60">
                          Tạo ảnh minh họa
                        </span>
                      </div>
                    </div>
                  </div>

                  {slide.image.purpose && (
                    <p className="text-xs text-slate-600 bg-white/90 p-2.5 rounded-lg border border-pink-100">
                      <strong className="text-pink-900">Mục đích:</strong> {slide.image.purpose}
                    </p>
                  )}

                  {/* Vietnamese Prompt for Canva / Bing */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                      <span className="flex items-center gap-1.5 text-slate-800">
                        <Palette className="w-3.5 h-3.5 text-pink-600" />
                        <span>Prompt Tiếng Việt (Canva / Bing Creator):</span>
                      </span>
                      <button
                        onClick={() =>
                          copyPureText(slide.image.vietnamesePrompt, `img_vn_${slide.slideNumber}`)
                        }
                        className="flex items-center gap-1 text-[11px] text-pink-700 hover:text-pink-900 bg-pink-50 hover:bg-pink-100 border border-pink-200 px-2.5 py-1 rounded-md transition-colors font-semibold shadow-2xs active:scale-95"
                        title="Sao chép chỉ câu lệnh tiếng Việt dán vào Canva/Bing"
                      >
                        {copiedId === `img_vn_${slide.slideNumber}` ? (
                          <>
                            <Check className="w-3 h-3 text-green-600" />
                            <span className="text-green-700 font-semibold">Đã chép câu lệnh!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy Tiếng Việt</span>
                          </>
                        )}
                      </button>
                    </div>
                    <div className="p-3 bg-white rounded-lg border border-pink-200 text-xs text-slate-800 leading-relaxed select-all shadow-2xs font-sans">
                      {slide.image.vietnamesePrompt}
                    </div>
                  </div>

                  {/* English Prompt Code Block (Midjourney / DALL-E 3) */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                      <span className="flex items-center gap-1.5 text-slate-800">
                        <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                        <span>Prompt Tiếng Anh (Midjourney / DALL-E 3):</span>
                      </span>
                      <button
                        onClick={() =>
                          copyPureText(slide.image.englishPrompt, `img_en_${slide.slideNumber}`)
                        }
                        className="flex items-center gap-1 text-[11px] text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 px-2.5 py-1 rounded-md transition-colors font-semibold shadow-2xs active:scale-95"
                        title="Sao chép chuẩn 100% câu lệnh tiếng Anh dán vào Midjourney/DALL-E 3"
                      >
                        {copiedId === `img_en_${slide.slideNumber}` ? (
                          <>
                            <Check className="w-3 h-3 text-green-600" />
                            <span className="text-green-700 font-semibold">Đã chép câu lệnh!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy Tiếng Anh</span>
                          </>
                        )}
                      </button>
                    </div>
                    
                    {/* Dedicated Code Block for English Image Prompt */}
                    <div className="relative group rounded-xl overflow-hidden border border-slate-800 bg-slate-950 shadow-xs">
                      <div className="bg-slate-900/90 px-3 py-1.5 border-b border-slate-800 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                        <span className="flex items-center gap-1.5 text-emerald-400">
                          <Code2 className="w-3 h-3" />
                          <span>Midjourney / DALL-E Prompt</span>
                        </span>
                        <span className="text-[10px] text-slate-500">100% Ready-to-use</span>
                      </div>
                      <div className="p-3.5 text-emerald-300 font-mono text-xs leading-relaxed select-all overflow-x-auto whitespace-pre-wrap">
                        {slide.image.englishPrompt}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ---------------------------------------------------------------- */}
                {/* 2. SECTION: 🎬 VIDEO (RUNWAY / SORA / HEYGEN / PIKA)              */}
                {/* ---------------------------------------------------------------- */}
                <div className="rounded-xl border border-sky-100 bg-linear-to-b from-sky-50/40 via-white to-sky-50/20 p-4 sm:p-4.5 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-sky-500 text-white rounded-lg shadow-2xs">
                        <Video className="w-4 h-4" />
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-800 text-sm sm:text-base">
                          🎬 Video (Runway / Sora / HeyGen / Pika)
                        </span>
                        <span className="text-[11px] text-sky-700 font-medium bg-sky-100/90 px-2 py-0.5 rounded-md border border-sky-200/60">
                          {slide.video.tools || 'Runway • Sora • Pika'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Vietnamese Motion Script */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                      <span className="flex items-center gap-1.5 text-slate-800">
                        <Film className="w-3.5 h-3.5 text-sky-600" />
                        <span>Kịch bản chuyển động (Tiếng Việt):</span>
                      </span>
                      <button
                        onClick={() =>
                          copyPureText(slide.video.vietnameseScript, `vid_vn_${slide.slideNumber}`)
                        }
                        className="flex items-center gap-1 text-[11px] text-sky-700 hover:text-sky-900 bg-sky-50 hover:bg-sky-100 border border-sky-200 px-2.5 py-1 rounded-md transition-colors font-semibold shadow-2xs active:scale-95"
                        title="Sao chép kịch bản chuyển động tiếng Việt"
                      >
                        {copiedId === `vid_vn_${slide.slideNumber}` ? (
                          <>
                            <Check className="w-3 h-3 text-green-600" />
                            <span className="text-green-700 font-semibold">Đã chép kịch bản!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy Kịch bản</span>
                          </>
                        )}
                      </button>
                    </div>
                    <div className="p-3 bg-white rounded-lg border border-sky-200 text-xs text-slate-800 leading-relaxed font-sans select-all shadow-2xs whitespace-pre-line">
                      {slide.video.vietnameseScript}
                    </div>
                  </div>

                  {/* English Video Prompt (Runway / Sora / Pika) */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                      <span className="flex items-center gap-1.5 text-slate-800">
                        <Terminal className="w-3.5 h-3.5 text-sky-600" />
                        <span>Prompt Tiếng Anh (Runway Gen-3 / Sora / Pika):</span>
                      </span>
                      <button
                        onClick={() =>
                          copyPureText(slide.video.englishPrompt, `vid_en_${slide.slideNumber}`)
                        }
                        className="flex items-center gap-1 text-[11px] text-sky-800 hover:text-sky-950 bg-sky-100 hover:bg-sky-200 border border-sky-300 px-2.5 py-1 rounded-md transition-colors font-bold shadow-2xs active:scale-95"
                        title="Sao chép chuẩn 100% câu lệnh tiếng Anh dán vào Runway/Sora/Pika"
                      >
                        {copiedId === `vid_en_${slide.slideNumber}` ? (
                          <>
                            <Check className="w-3 h-3 text-green-600" />
                            <span className="text-green-700 font-semibold">Đã chép câu lệnh!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy Prompt Tiếng Anh (Runway/Sora)</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Dedicated Code Block for English Video Prompt */}
                    <div className="relative group rounded-xl overflow-hidden border border-slate-800 bg-slate-950 shadow-xs">
                      <div className="bg-slate-900/90 px-3 py-1.5 border-b border-slate-800 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                        <span className="flex items-center gap-1.5 text-sky-400">
                          <Code2 className="w-3 h-3" />
                          <span>Runway / Sora English Video Prompt</span>
                        </span>
                        <span className="text-[10px] text-slate-500">100% Ready-to-use</span>
                      </div>
                      <div className="p-3.5 text-sky-300 font-mono text-xs leading-relaxed select-all overflow-x-auto whitespace-pre-wrap">
                        {slide.video.englishPrompt}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ---------------------------------------------------------------- */}
                {/* 3. SECTION: 🎮 GAME (QUIZIZZ / KAHOOT / WORDWALL / CHATGPT)       */}
                {/* ---------------------------------------------------------------- */}
                <div className="rounded-xl border border-emerald-100 bg-linear-to-b from-emerald-50/40 via-white to-emerald-50/20 p-4 sm:p-4.5 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-emerald-600 text-white rounded-lg shadow-2xs">
                        <Gamepad2 className="w-4 h-4" />
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-800 text-sm sm:text-base">
                          🎮 Game (Quizizz / Kahoot / Wordwall)
                        </span>
                        <span className="text-[11px] text-emerald-700 font-medium bg-emerald-100/90 px-2 py-0.5 rounded-md border border-emerald-200/60">
                          {slide.game.platform || 'Quizizz • Kahoot • Wordwall'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* ChatGPT Ready-to-paste Command */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                      <span className="flex items-center gap-1.5 text-purple-900">
                        <Bot className="w-3.5 h-3.5 text-purple-600" />
                        <span>Câu lệnh dán vào ChatGPT (Tạo bảng Quizizz/Kahoot):</span>
                      </span>
                      <button
                        onClick={() =>
                          copyPureText(slide.game.chatGptCommand, `game_gpt_${slide.slideNumber}`)
                        }
                        className="flex items-center gap-1 text-[11px] text-purple-800 hover:text-purple-950 bg-purple-100 hover:bg-purple-200 border border-purple-300 px-2.5 py-1 rounded-md transition-colors font-bold shadow-2xs active:scale-95"
                        title="Sao chép toàn bộ lệnh ChatGPT để tự động tạo file tải lên Quizizz/Kahoot"
                      >
                        {copiedId === `game_gpt_${slide.slideNumber}` ? (
                          <>
                            <Check className="w-3 h-3 text-green-600" />
                            <span className="text-green-700 font-semibold">Đã chép lệnh ChatGPT!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy Lệnh ChatGPT (Quizizz/Kahoot)</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Dedicated Code Block for ChatGPT Command */}
                    <div className="relative group rounded-xl overflow-hidden border border-purple-200 bg-purple-50/80 shadow-2xs">
                      <div className="bg-purple-100/80 px-3 py-1.5 border-b border-purple-200 flex items-center justify-between text-[11px] text-purple-800 font-medium">
                        <span className="flex items-center gap-1.5">
                          <Bot className="w-3.5 h-3.5 text-purple-600" />
                          <span>ChatGPT Prompt for Quizizz CSV / Table Generator</span>
                        </span>
                        <span className="text-[10px] text-purple-600 font-semibold">Dán vào ChatGPT để nhận bảng câu hỏi</span>
                      </div>
                      <div className="p-3.5 text-purple-950 font-sans text-xs leading-relaxed select-all overflow-x-auto whitespace-pre-wrap font-medium">
                        {slide.game.chatGptCommand}
                      </div>
                    </div>
                  </div>

                  {/* Question & Answer Details */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                      <span className="flex items-center gap-1.5 text-emerald-900">
                        <HelpCircle className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Câu hỏi & Đáp án mẫu:</span>
                      </span>
                      <button
                        onClick={() => {
                          const qBlock = [
                            slide.game.gameType ? `Dạng trò chơi: ${slide.game.gameType}` : '',
                            `Câu hỏi: ${slide.game.question}`,
                            `Lựa chọn: ${slide.game.options}`,
                            `Đáp án đúng: ${slide.game.correctAnswer}`
                          ].filter(Boolean).join('\n');
                          copyPureText(qBlock, `game_qa_${slide.slideNumber}`);
                        }}
                        className="flex items-center gap-1 text-[11px] text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-md transition-colors font-medium shadow-2xs active:scale-95"
                      >
                        {copiedId === `game_qa_${slide.slideNumber}` ? (
                          <>
                            <Check className="w-3 h-3 text-green-600" />
                            <span className="text-green-700 font-semibold">Đã chép!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy Câu hỏi & Đáp án</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="p-3.5 bg-white rounded-lg border border-emerald-200/90 text-xs space-y-2 shadow-2xs">
                      {slide.game.gameType && (
                        <div className="text-slate-600">
                          <strong className="text-slate-700">Dạng trò chơi:</strong> {slide.game.gameType}
                        </div>
                      )}
                      <div className="text-slate-900 font-semibold flex items-start gap-1.5">
                        <HelpCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <span>Câu hỏi: {slide.game.question}</span>
                      </div>
                      {slide.game.options && (
                        <div className="pl-5 text-slate-700 font-mono text-[11px] bg-slate-50 p-2 rounded border border-slate-200/60">
                          {slide.game.options}
                        </div>
                      )}
                      {slide.game.correctAnswer && (
                        <div className="pl-5 text-emerald-700 font-semibold flex items-center gap-1 bg-emerald-50/80 p-2 rounded border border-emerald-100">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>Đáp án đúng: {slide.game.correctAnswer}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
