import { LessonPlan } from '../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit2, Trash2, Calendar, BookOpen, GraduationCap } from 'lucide-react';
import { motion } from 'motion/react';

interface LessonPlanListProps {
  plans: LessonPlan[];
  onEdit: (plan: LessonPlan) => void;
  onDelete: (id: string) => void;
}

export default function LessonPlanList({ plans, onEdit, onDelete }: LessonPlanListProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {plans.map((plan, index) => (
        <motion.div
          key={plan.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
        >
          <Card className="group h-full flex flex-col border-none shadow-sm hover:shadow-xl transition-all duration-300 bg-white overflow-hidden">
            <div className="h-2 bg-indigo-500 w-full" />
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start mb-2">
                <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-none">
                  Lớp {plan.grade}
                </Badge>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" onClick={() => onEdit(plan)} className="h-8 w-8 text-gray-400 hover:text-indigo-600">
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => onDelete(plan.id)} className="h-8 w-8 text-gray-400 hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <CardTitle className="text-xl font-bold text-gray-900 group-hover:text-indigo-600 transition-colors line-clamp-2">
                {plan.title}
              </CardTitle>
              <CardDescription className="flex items-center gap-1 mt-1">
                <BookOpen className="w-3 h-3" />
                {plan.subject}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
              <p className="text-sm text-gray-600 line-clamp-3 italic">
                {plan.topic}
              </p>
            </CardContent>
            <CardFooter className="pt-0 pb-6 flex justify-between items-center border-t border-gray-50 mt-4 pt-4">
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <Calendar className="w-3 h-3" />
                {new Date(plan.updatedAt).toLocaleDateString('vi-VN')}
              </div>
              <Button variant="ghost" size="sm" onClick={() => onEdit(plan)} className="text-indigo-600 hover:bg-indigo-50 font-medium">
                Chi tiết
              </Button>
            </CardFooter>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
