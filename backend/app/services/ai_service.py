import httpx
from fastapi import HTTPException
from app.core.config import settings

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"

CHAT_SYSTEM = """You are a helpful legal assistant for FIR Sahayak, an online FIR filing platform in India.
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

INTERVIEW_SYSTEM_TEMPLATE = """You are a trained police interviewer conducting a structured intake interview to gather complete facts for a First Information Report (FIR) in India.

Incident Type: {incident_type}
Complainant's Initial Statement: {description}
Current question: {question_num} of maximum 10

Your task:
- Ask ONE focused follow-up question per turn to uncover missing facts.
- Be professional and empathetic.
- Respond in the same language the user uses (Hindi or English).
- Do NOT repeat information already provided.
- Do NOT give legal opinions.
- When you have gathered sufficient facts (or if this is question 10), output only the word: ###DONE###

For this incident type, prioritise questions about: {focus}"""

INCIDENT_FOCUS = {
    "theft": "exact items stolen (description, estimated value, serial numbers), how and when the theft was discovered, suspect descriptions, CCTV presence, point of entry",
    "assault": "nature and extent of injuries, weapon used if any, number of attackers, relationship with attacker, witnesses, medical treatment received",
    "missing_person": "last known location/time/clothing/appearance, any medical or mental health conditions, people already contacted, reason this is concerning",
    "sexual_assault": "time and location, relationship with accused, nature of assault, any witnesses, whether medical examination has been done, any communication records",
    "hit_and_run": "vehicle type/colour/number plate (full or partial), direction of travel, driver description, approximate speed, road and lighting conditions, injuries sustained",
    "fraud": "total amount lost, payment methods used, promises or guarantees made by fraudster, mode of contact (phone/email/app), whether communication records exist",
    "cyber_crime": "platform or website involved, type of incident (phishing/UPI fraud/fake profile/ransomware), total monetary loss, accounts compromised, screenshots or evidence available",
    "property_damage": "exact property damaged and its location, type and extent of damage, estimated repair cost, possible motive, witnesses present",
    "domestic_violence": "relationship with the accused, nature of violence (physical/verbal/economic/sexual), duration and frequency, children involved, prior complaints or injuries",
    "other": "full chronological sequence of events, all persons involved, any injuries or financial losses, evidence available, any prior incidents or threats",
}


async def _call_gemini(contents: list[dict], system_prompt: str = CHAT_SYSTEM) -> str:
    payload = {
        "system_instruction": {"parts": [{"text": system_prompt}]},
        "contents": contents,
    }
    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            response = await client.post(
                GEMINI_URL,
                params={"key": settings.GOOGLE_API_KEY},
                json=payload,
            )
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="AI service timed out. Please try again.")
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail=f"AI service unreachable: {exc}")

    if response.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"AI service error ({response.status_code}): {response.text[:200]}",
        )

    try:
        data = response.json()
        return data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError) as exc:
        raise HTTPException(status_code=502, detail=f"Unexpected AI response format: {exc}")


async def get_ai_response(user_message: str, history: list[dict]) -> str:
    contents = history + [{"role": "user", "parts": [{"text": user_message}]}]
    return await _call_gemini(contents)


async def suggest_ipc_sections(description: str) -> str:
    prompt = f"""Based on this FIR complaint description, suggest the most relevant IPC (Indian Penal Code) sections.
Return ONLY the section numbers and brief descriptions, no other text.

Complaint: {description}

Format your response as:
Section X - [brief description]
Section Y - [brief description]"""
    contents = [{"role": "user", "parts": [{"text": prompt}]}]
    return await _call_gemini(contents)


async def conduct_interview(
    incident_type: str,
    description: str,
    history: list[dict],
    question_num: int,
) -> dict:
    """
    Ask the next interview question.
    history: Gemini-format [{role, parts}] of all prior Q&As.
    Returns {"question": str, "done": bool}
    """
    if question_num >= 10:
        return {"question": "", "done": True}

    focus = INCIDENT_FOCUS.get(incident_type, INCIDENT_FOCUS["other"])
    system = INTERVIEW_SYSTEM_TEMPLATE.format(
        incident_type=incident_type.replace("_", " ").title(),
        description=description,
        question_num=question_num + 1,
        focus=focus,
    )

    # Append a trigger so Gemini produces the next question
    contents = history + [{
        "role": "user",
        "parts": [{"text": "Please ask your next question, or respond ###DONE### if you have enough information."}],
    }]

    response = await _call_gemini(contents, system_prompt=system)

    if "###DONE###" in response:
        clean = response.replace("###DONE###", "").strip()
        return {"question": clean, "done": True}

    return {"question": response.strip(), "done": False}


async def summarize_interview(
    incident_type: str,
    description: str,
    conversation: list[dict],  # [{"role": "model"|"user", "text": "..."}]
) -> dict:
    """
    Generate an officer-facing structured summary + IPC suggestions from the interview.
    Returns {"summary": str, "ipc_sections": str}
    """
    qa_text = "\n".join(
        f"{'Interviewer' if m['role'] == 'model' else 'Complainant'}: {m['text']}"
        for m in conversation
    )

    prompt = f"""You are a senior police officer preparing a structured FIR case summary.

Incident Type: {incident_type.replace('_', ' ').title()}
Initial Complaint: {description}

Interview Transcript:
{qa_text}

Produce the following in EXACTLY this format (English, professional, no extra text):

SUMMARY:
[3-5 sentences in third person. Cover: what happened, where, when, who was involved, key evidence mentioned, and what the complainant is seeking. Use "the complainant" to refer to the citizen.]

IPC_SECTIONS:
[List 3-5 IPC sections most applicable to the described facts. Format each as: Section X - Section Name]"""

    contents = [{"role": "user", "parts": [{"text": prompt}]}]
    response = await _call_gemini(contents)

    summary = ""
    ipc = ""
    if "SUMMARY:" in response and "IPC_SECTIONS:" in response:
        parts = response.split("IPC_SECTIONS:")
        summary = parts[0].replace("SUMMARY:", "").strip()
        ipc = parts[1].strip()
    else:
        summary = response.strip()

    return {"summary": summary, "ipc_sections": ipc}
