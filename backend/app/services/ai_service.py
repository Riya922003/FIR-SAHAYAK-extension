import google.generativeai as genai
from app.core.config import settings

genai.configure(api_key=settings.GOOGLE_API_KEY)

model = genai.GenerativeModel("gemini-1.5-flash")

SYSTEM_PROMPT = """You are a helpful legal assistant for FIR Sahayak, an online FIR filing platform in India.
Your role is to:
1. Guide citizens on how to file an FIR
2. Explain relevant IPC (Indian Penal Code) sections for their complaint
3. Help them describe their incident clearly
4. Suggest what evidence/documents to mention
5. Explain the FIR process step by step

Be empathetic, clear, and concise. Ask one question at a time to understand the situation better.
Always respond in the language the user writes in (Hindi or English).
Do NOT provide legal advice beyond FIR filing guidance.
"""


async def get_ai_response(user_message: str, history: list[dict]) -> str:
    """
    Get a response from Gemini with full conversation history.
    history format: [{"role": "user"|"model", "parts": [{"text": "..."}]}]
    """
    chat = model.start_chat(history=history)
    response = await chat.send_message_async(
        f"{SYSTEM_PROMPT}\n\nUser: {user_message}"
    )
    return response.text


async def suggest_ipc_sections(description: str) -> str:
    """
    Given a complaint description, suggest relevant IPC sections.
    Used during FIR filing to auto-suggest legal sections.
    """
    prompt = f"""
    Based on this FIR complaint description, suggest the most relevant IPC (Indian Penal Code) sections.
    Return ONLY the section numbers and brief descriptions, no other text.

    Complaint: {description}

    Format your response as:
    Section X - [brief description]
    Section Y - [brief description]
    """
    response = model.generate_content(prompt)
    return response.text
