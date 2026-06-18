const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const authH = (token: string) => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`,
});

export interface ChatMsg {
  role: 'user' | 'model';
  text: string;
}

export async function sendChatMessage(
  token: string,
  message: string,
  history: ChatMsg[],
): Promise<string> {
  const res = await fetch(`${API_URL}/api/v1/ai/chat`, {
    method: 'POST',
    headers: authH(token),
    body: JSON.stringify({
      message,
      history: history.map(m => ({ role: m.role, text: m.text })),
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'AI chat failed');
  return data.reply as string;
}
