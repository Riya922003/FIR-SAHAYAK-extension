import { apiFetch } from './client';

export interface ChatMsg {
  role: 'user' | 'model';
  text: string;
}

export async function sendChatMessage(
  token: string,
  message: string,
  history: ChatMsg[],
): Promise<string> {
  const res = await apiFetch(token, '/api/v1/ai/chat', {
    method: 'POST',
    body: JSON.stringify({
      message,
      history: history.map(m => ({ role: m.role, text: m.text })),
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'AI chat failed');
  return data.reply as string;
}
