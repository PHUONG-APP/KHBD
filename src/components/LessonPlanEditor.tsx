import * as React from 'react';
import { useState, useEffect } from 'react';
import { LessonPlan, LessonPlanFormData } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sparkles, Save, X, Wand2, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { generateLessonContent, generateFullLessonPlan } from '../services/gemini';
import { toast } from 'sonner';

interface LessonPlanEditorProps {
  plan: LessonPlan | null;
  onSave: (plan: LessonPlan) => void;
  onCancel: () => void;
}

const GRADES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
const SUBJECTS = ['Toán học', 'Ngữ văn', 'Tiếng Anh', 'Vật lý', 'Hóa học', 'Sinh học', 'Lịch sử', 'Địa lý', 'GDCD', 'Tin học', 'Công nghệ', 'Âm nhạc', 'Mỹ thuật', 'Thể dục'];

export default function LessonPlanEditor({ plan, onSave, onCancel }: LessonPlanEditorProps) {
  const [formData, setFormData] = useState<LessonPlanFormData>({
    title: '',
    subject: '',
    grade: '',
    topic: '',
    teacherGender: 'Cô',
    objectives: '',
    materials: '',
    procedures: {
      introduction: '',
      activities: '',
      conclusion: '',
    },
    assessment: '',
  });

  const [isGenerating, setIsGenerating] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('info');

  useEffect(() => {
    if (plan) {
      setFormData({
        title: plan.title,
        subject: plan.subject,
        grade: plan.grade,
        topic: plan.topic,
        teacherGender: plan.teacherGender || 'Cô',
        objectives: plan.objectives,
        materials: plan.materials,
        procedures: { ...plan.procedures },
        assessment: plan.assessment,
      });
    }
  }, [plan]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name.startsWith('procedures.')) {
      const field = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        procedures: {
          ...prev.procedures,
          [field]: value
        }
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    if (!formData.title || !formData.subject || !formData.grade) {
      toast.error("Vui lòng điền đầy đủ thông tin cơ bản (Tiêu đề, Môn học, Lớp)");
      return;
    }

    const newPlan: LessonPlan = {
      ...formData,
      id: plan?.id || crypto.randomUUID(),
      createdAt: plan?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };
    onSave(newPlan);
  };

  const handleAIGenerate = async (section: string) => {
    if (!formData.subject || !formData.grade || !formData.topic) {
      toast.error("Vui lòng điền Môn học, Lớp và Chủ đề để AI có đủ thông tin.");
      return;
    }

    setIsGenerating(section);
    const prompt = `Danh xưng giáo viên: ${formData.teacherGender}. Môn: ${formData.subject}, Lớp: ${formData.grade}, Chủ đề: ${formData.topic}. ${formData.title ? `Tiêu đề: ${formData.title}` : ''}`;
    
    const result = await generateLessonContent(prompt, section);
    
    if (section.startsWith('procedures.')) {
      const field = section.split('.')[1];
      setFormData(prev => ({
        ...prev,
        procedures: {
          ...prev.procedures,
          [field]: result
        }
      }));
    } else {
      setFormData(prev => ({ ...prev, [section]: result }));
    }
    
    setIsGenerating(null);
    toast.success(`Đã tạo nội dung cho phần ${section}`);
  };

  const handleGenerateFull = async () => {
    if (!formData.subject || !formData.grade || !formData.topic) {
      toast.error("Vui lòng điền Môn học, Lớp và Chủ đề để AI có đủ thông tin.");
      return;
    }

    setIsGenerating('full');
    const result = await generateFullLessonPlan({
      subject: formData.subject,
      grade: formData.grade,
      topic: formData.topic,
      teacherGender: formData.teacherGender
    });

    if (result) {
      setFormData(prev => ({
        ...prev,
        objectives: result.objectives || prev.objectives,
        materials: result.materials || prev.materials,
        procedures: {
          introduction: result.introduction || prev.procedures.introduction,
          activities: result.activities || prev.procedures.activities,
          conclusion: result.conclusion || prev.procedures.conclusion,
        },
        assessment: result.assessment || prev.assessment,
      }));
      toast.success("Đã tạo toàn bộ kế hoạch bài dạy bằng AI!");
    } else {
      toast.error("Không thể tạo kế hoạch bài dạy. Vui lòng thử lại.");
    }
    setIsGenerating(null);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onCancel} className="rounded-full hover:bg-gray-100">
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{plan ? 'Chỉnh sửa kế hoạch bài dạy' : 'Soạn kế hoạch bài dạy mới'}</h2>
            <p className="text-sm text-gray-500">Hoàn thiện kế hoạch bài dạy của bạn.</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onCancel} className="border-gray-200">
            Hủy
          </Button>
          <Button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md">
            <Save className="w-4 h-4 mr-2" />
            Lưu kế hoạch bài dạy
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 flex flex-col gap-6">
          <Card className="border-none shadow-sm bg-white">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                Thông tin cơ bản
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Tiêu đề kế hoạch bài dạy</label>
                <Input 
                  name="title" 
                  value={formData.title} 
                  onChange={handleInputChange} 
                  placeholder="VD: Bài 1: Các số tự nhiên..."
                  className="border-gray-200 focus:ring-indigo-500"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Môn học</label>
                  <Select value={formData.subject} onValueChange={(v) => handleSelectChange('subject', v)}>
                    <SelectTrigger className="border-gray-200">
                      <SelectValue placeholder="Chọn môn" />
                    </SelectTrigger>
                    <SelectContent>
                      {SUBJECTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Lớp</label>
                  <Select value={formData.grade} onValueChange={(v) => handleSelectChange('grade', v)}>
                    <SelectTrigger className="border-gray-200">
                      <SelectValue placeholder="Chọn lớp" />
                    </SelectTrigger>
                    <SelectContent>
                      {GRADES.map(g => <SelectItem key={g} value={g}>Lớp {g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Chủ đề / Bài học</label>
                <Textarea 
                  name="topic" 
                  value={formData.topic} 
                  onChange={handleInputChange} 
                  placeholder="Mô tả ngắn gọn nội dung bài học..."
                  className="min-h-[100px] border-gray-200"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Danh xưng giáo viên</label>
                <Select value={formData.teacherGender} onValueChange={(v) => handleSelectChange('teacherGender', v)}>
                  <SelectTrigger className="border-gray-200">
                    <SelectValue placeholder="Chọn danh xưng" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cô">Cô</SelectItem>
                    <SelectItem value="Thầy">Thầy</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator className="my-2" />
              
              <Button 
                onClick={handleGenerateFull} 
                disabled={!!isGenerating}
                className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-lg"
              >
                {isGenerating === 'full' ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 mr-2" />
                )}
                Tạo toàn bộ bằng AI
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card className="border-none shadow-sm bg-white h-full min-h-[600px]">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
              <div className="px-6 pt-4 border-b border-gray-100">
                <TabsList className="bg-gray-50/50 p-1">
                  <TabsTrigger value="info" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Mục tiêu & Học liệu</TabsTrigger>
                  <TabsTrigger value="procedures" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Tiến trình dạy học</TabsTrigger>
                  <TabsTrigger value="assessment" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Đánh giá</TabsTrigger>
                </TabsList>
              </div>

              <ScrollArea className="flex-grow p-6">
                <TabsContent value="info" className="mt-0 space-y-6">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-semibold text-gray-900">1. Mục tiêu bài học</h3>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleAIGenerate('objectives')}
                        disabled={!!isGenerating}
                        className="text-indigo-600 hover:bg-indigo-50"
                      >
                        {isGenerating === 'objectives' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
                        Gợi ý bằng AI
                      </Button>
                    </div>
                    <Textarea 
                      name="objectives" 
                      value={formData.objectives} 
                      onChange={handleInputChange} 
                      placeholder="Mục tiêu về kiến thức, năng lực, phẩm chất..."
                      className="min-h-[200px] border-gray-200"
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-semibold text-gray-900">2. Thiết bị dạy học và học liệu</h3>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleAIGenerate('materials')}
                        disabled={!!isGenerating}
                        className="text-indigo-600 hover:bg-indigo-50"
                      >
                        {isGenerating === 'materials' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
                        Gợi ý bằng AI
                      </Button>
                    </div>
                    <Textarea 
                      name="materials" 
                      value={formData.materials} 
                      onChange={handleInputChange} 
                      placeholder="Sách giáo khoa, tranh ảnh, video, máy chiếu..."
                      className="min-h-[150px] border-gray-200"
                    />
                  </div>
                </TabsContent>

                <TabsContent value="procedures" className="mt-0 space-y-8">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-semibold text-indigo-900">Hoạt động 1: Mở đầu (Khởi động)</h3>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleAIGenerate('procedures.introduction')}
                        disabled={!!isGenerating}
                        className="text-indigo-600 hover:bg-indigo-50"
                      >
                        {isGenerating === 'procedures.introduction' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
                        Gợi ý bằng AI
                      </Button>
                    </div>
                    <Textarea 
                      name="procedures.introduction" 
                      value={formData.procedures.introduction} 
                      onChange={handleInputChange} 
                      placeholder="Các hoạt động dẫn dắt học sinh vào bài mới..."
                      className="min-h-[150px] border-gray-200"
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-semibold text-indigo-900">Hoạt động 2: Hình thành kiến thức / Luyện tập</h3>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleAIGenerate('procedures.activities')}
                        disabled={!!isGenerating}
                        className="text-indigo-600 hover:bg-indigo-50"
                      >
                        {isGenerating === 'procedures.activities' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
                        Gợi ý bằng AI
                      </Button>
                    </div>
                    <Textarea 
                      name="procedures.activities" 
                      value={formData.procedures.activities} 
                      onChange={handleInputChange} 
                      placeholder="Các hoạt động chính trong tiết học..."
                      className="min-h-[300px] border-gray-200"
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-semibold text-indigo-900">Hoạt động 3: Kết thúc / Củng cố</h3>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleAIGenerate('procedures.conclusion')}
                        disabled={!!isGenerating}
                        className="text-indigo-600 hover:bg-indigo-50"
                      >
                        {isGenerating === 'procedures.conclusion' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
                        Gợi ý bằng AI
                      </Button>
                    </div>
                    <Textarea 
                      name="procedures.conclusion" 
                      value={formData.procedures.conclusion} 
                      onChange={handleInputChange} 
                      placeholder="Tóm tắt bài học, dặn dò..."
                      className="min-h-[150px] border-gray-200"
                    />
                  </div>
                </TabsContent>

                <TabsContent value="assessment" className="mt-0 space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-gray-900">Đánh giá kết quả học tập</h3>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleAIGenerate('assessment')}
                      disabled={!!isGenerating}
                      className="text-indigo-600 hover:bg-indigo-50"
                    >
                      {isGenerating === 'assessment' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
                      Gợi ý bằng AI
                    </Button>
                  </div>
                  <Textarea 
                    name="assessment" 
                    value={formData.assessment} 
                    onChange={handleInputChange} 
                    placeholder="Các tiêu chí, hình thức đánh giá học sinh..."
                    className="min-h-[250px] border-gray-200"
                  />
                </TabsContent>
              </ScrollArea>
            </Tabs>
          </Card>
        </div>
      </div>
    </div>
  );
}
