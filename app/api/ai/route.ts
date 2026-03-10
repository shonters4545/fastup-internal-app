import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { action, data } = await request.json();

    switch (action) {
      case 'learning-plan': {
        // Analyze student progress and suggest optimal learning order
        const message = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          system: 'あなたは塾の学習アドバイザーです。生徒の学習データを分析し、最適な学習プランを日本語で提案してください。',
          messages: [
            {
              role: 'user',
              content: `以下の生徒の学習データに基づいて、最適な学習順序を提案してください:\n\n${JSON.stringify(data)}`,
            },
          ],
        });
        const textContent = message.content.find(c => c.type === 'text');
        return NextResponse.json({ result: textContent?.text ?? '' });
      }

      case 'progress-summary': {
        // Generate natural language progress summary for admins
        const message = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          system: 'あなたは塾の管理者向けレポートジェネレーターです。生徒の進捗データを分かりやすい日本語のサマリーにまとめてください。',
          messages: [
            {
              role: 'user',
              content: `以下の進捗データからサマリーレポートを作成してください:\n\n${JSON.stringify(data)}`,
            },
          ],
        });
        const textContent = message.content.find(c => c.type === 'text');
        return NextResponse.json({ result: textContent?.text ?? '' });
      }

      case 'survey-analysis': {
        // Analyze free-text survey responses
        const message = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          system: 'あなたはアンケート分析の専門家です。自由記述の回答からテーマを抽出し、感情分析を行ってください。',
          messages: [
            {
              role: 'user',
              content: `以下のアンケート回答を分析してください:\n\n${JSON.stringify(data)}`,
            },
          ],
        });
        const textContent = message.content.find(c => c.type === 'text');
        return NextResponse.json({ result: textContent?.text ?? '' });
      }

      case 'quiz-generate': {
        // Auto-generate quiz questions from task content
        const message = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 2048,
          system: 'あなたは教育コンテンツ作成の専門家です。与えられたタスク内容に基づいて、クイズ問題を生成してください。JSON形式で出力してください。',
          messages: [
            {
              role: 'user',
              content: `以下のタスク内容に基づいて、4択クイズを3問生成してください。JSON形式で返してください:\n\n${JSON.stringify(data)}`,
            },
          ],
        });
        const textContent = message.content.find(c => c.type === 'text');
        return NextResponse.json({ result: textContent?.text ?? '' });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('AI API error:', error);
    return NextResponse.json({ error: 'AI processing failed' }, { status: 500 });
  }
}
