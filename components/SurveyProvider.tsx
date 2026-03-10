'use client';

import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import { SurveyModal } from './SurveyModal';

interface SurveyContextType {
  checkSurvey: () => Promise<boolean>;
}

const SurveyContext = createContext<SurveyContextType>({
  checkSurvey: async () => false,
});

export const useSurvey = () => useContext(SurveyContext);

export function SurveyProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  const pathname = usePathname();
  const supabase = createClient();

  const [surveyRequest, setSurveyRequest] = useState<any>(null);
  const [surveyModel, setSurveyModel] = useState<any>(null);
  const [surveyClass, setSurveyClass] = useState<any>(null);
  const [isSurveyModalOpen, setIsSurveyModalOpen] = useState(false);
  const [isSubmittingSurvey, setIsSubmittingSurvey] = useState(false);

  const checkSurvey = useCallback(async (): Promise<boolean> => {
    if (!currentUser) return false;
    try {
      const { data: requests } = await supabase
        .from('survey_requests')
        .select('*')
        .eq('user_id', currentUser.id)
        .eq('status', 'pending')
        .order('requested_at', { ascending: true }) as { data: any[] | null };

      if (!requests || requests.length === 0) {
        setIsSurveyModalOpen(false);
        return false;
      }

      for (const request of requests) {
        if (request.type === 'general') {
          const { data: model } = await supabase
            .from('survey_models')
            .select('*')
            .eq('id', request.survey_model_id)
            .single() as { data: any };

          if (model) {
            setSurveyRequest(request);
            setSurveyModel(model);
            setSurveyClass(null);
            setIsSurveyModalOpen(true);
            return true;
          }
        } else {
          const [{ data: model }, { data: classData }] = await Promise.all([
            supabase
              .from('survey_models')
              .select('*')
              .eq('id', request.survey_model_id)
              .single() as unknown as Promise<{ data: any }>,
            supabase
              .from('classes')
              .select('*')
              .eq('id', request.class_id)
              .single() as unknown as Promise<{ data: any }>,
          ]);

          if (model && classData) {
            setSurveyRequest(request);
            setSurveyModel(model);
            setSurveyClass(classData);
            setIsSurveyModalOpen(true);
            return true;
          }
        }
      }
      setIsSurveyModalOpen(false);
      return false;
    } catch (err) {
      console.error('Error checking for surveys:', err);
      setIsSurveyModalOpen(false);
      return false;
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      const timeoutId = setTimeout(() => checkSurvey(), 1500);
      return () => clearTimeout(timeoutId);
    }
  }, [currentUser, checkSurvey, pathname]);

  const handleSubmitSurvey = async (responses: Record<string, string | string[]>) => {
    if (!currentUser || !surveyRequest) return;
    setIsSubmittingSurvey(true);
    try {
      await (supabase.from('survey_responses') as any).insert({
        user_id: currentUser.id,
        class_id: surveyRequest.class_id || null,
        survey_model_id: surveyRequest.survey_model_id,
        request_id: surveyRequest.id,
        type: surveyRequest.type,
        responses: responses,
      });

      await (supabase.from('survey_requests') as any)
        .update({ status: 'completed' })
        .eq('id', surveyRequest.id);

      const foundNextSurvey = await checkSurvey();
      if (!foundNextSurvey) {
        alert('アンケートにご協力いただき、ありがとうございました。');
        setSurveyRequest(null);
        setSurveyModel(null);
        setSurveyClass(null);
      }
    } catch (err) {
      console.error('Error submitting survey:', err);
      alert('アンケートの送信に失敗しました。時間をおいて再度お試しください。');
    } finally {
      setIsSubmittingSurvey(false);
    }
  };

  return (
    <SurveyContext.Provider value={{ checkSurvey }}>
      {children}
      {isSurveyModalOpen && surveyModel && (
        <SurveyModal
          isOpen={isSurveyModalOpen}
          onClose={() => setIsSurveyModalOpen(false)}
          onSubmit={handleSubmitSurvey}
          classTitle={surveyClass?.title}
          classStartTime={surveyClass?.start_time}
          classEndTime={surveyClass?.end_time}
          surveyTitle={surveyModel.title}
          formFields={surveyModel.form_fields}
          isSubmitting={isSubmittingSurvey}
        />
      )}
    </SurveyContext.Provider>
  );
}
