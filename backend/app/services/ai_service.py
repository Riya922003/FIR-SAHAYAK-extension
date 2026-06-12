import httpx
from app.core.config import settings

# Gemini REST API — no grpcio needed, fully async via httpx
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"

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


async def _call_gemini(contents: list[dict]) -> str:
    """Core helper — calls Gemini REST API via httpx (async, no grpcio)."""
    payload = {
        "system_instruction": {
            "parts": [{"text": SYSTEM_PROMPT}]
        },
        "contents": contents,
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            GEMINI_URL,
            params={"key": settings.GOOGLE_API_KEY},
            json=payload,
        )
        response.raise_for_status()
        data = response.json()
        return data["candidates"][0]["content"]["parts"][0]["text"]


async def get_ai_response(user_message: str, history: list[dict]) -> str:
    """
    Get a response from Gemini with full conversation history.
    history format: [{"role": "user"|"model", "parts": [{"text": "..."}]}]
    """
    # Append the new user message to history
    contents = history + [{"role": "user", "parts": [{"text": user_message}]}]
    return await _call_gemini(contents)


async def suggest_ipc_sections(description: str) -> str:
    """
    Given a complaint description, suggest relevant IPC sections.
    Used during FIR filing to auto-suggest legal sections.
    """
    prompt = f"""Based on this FIR complaint description, suggest the most relevant IPC (Indian Penal Code) sections.
Return ONLY the section numbers and brief descriptions, no other text.

Complaint: {description}

Format your response as:
Section X - [brief description]
Section Y - [brief description]"""

    contents = [{"role": "user", "parts": [{"text": prompt}]}]
    return await _call_gemini(contents)
