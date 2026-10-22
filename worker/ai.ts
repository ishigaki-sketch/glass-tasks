import type { Env } from './types';

/**
 * Workers AI でタスクをサブタスクに分解する。
 * AI_MODEL=mock（E2E 環境）または AI バインディングが無い場合は決定的なモック応答を返す。
 */
export async function breakdownTask(env: Env, title: string, note: string): Promise<string[]> {
  if (env.AI_MODEL === 'mock' || !env.AI) {
    return [`「${title}」の目的を整理する`, '必要な情報を集める', '最初の一歩を15分で着手する'];
  }

  const messages = [
    {
      role: 'system',
      content:
        'あなたはタスク分解のアシスタントです。ユーザーのタスクを、すぐ着手できる具体的なサブタスク3〜6個に分解してください。' +
        '各サブタスクは日本語で30文字以内、動詞で終わる形にしてください。JSON のみを返してください。',
    },
    { role: 'user', content: `タスク: ${title}${note ? `\nメモ: ${note}` : ''}` },
  ];

  const result = (await env.AI.run(env.AI_MODEL as keyof AiModels, {
    messages,
    max_tokens: 512,
    response_format: {
      type: 'json_schema',
      json_schema: {
        type: 'object',
        properties: { subtasks: { type: 'array', items: { type: 'string' } } },
        required: ['subtasks'],
      },
    },
  } as never)) as { response?: unknown };

  return normalize(result?.response);
}

function normalize(response: unknown): string[] {
  let data: unknown = response;
  if (typeof data === 'string') {
    const text: string = data;
    const match = text.match(/\{[\s\S]*\}/);
    try {
      data = JSON.parse(match ? match[0] : text);
    } catch {
      // JSON でなければ行単位で拾う
      return text.split('\n').map((l: string) => l.replace(/^[-*・\d.)\s]+/, '').trim()).filter(Boolean).slice(0, 6);
    }
  }
  const list = (data as { subtasks?: unknown })?.subtasks;
  if (!Array.isArray(list)) return [];
  return list.filter((s): s is string => typeof s === 'string').map((s) => s.trim().slice(0, 60)).filter(Boolean).slice(0, 6);
}
