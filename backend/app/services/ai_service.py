import asyncio
import httpx
from fastapi import HTTPException
from app.core.config import settings
from app.core.circuit_breaker import groq_breaker

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.3-70b-versatile"

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


async def _attempt_groq(messages: list[dict]) -> str:
    """Single raw attempt — no retry, no circuit breaker logic here."""
    payload = {
        "model": GROQ_MODEL,
        "messages": messages,
        "temperature": 0.7,
    }
    headers = {
        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient(timeout=45.0) as client:
        response = await client.post(GROQ_URL, json=payload, headers=headers)

    if response.status_code != 200:
        raise httpx.HTTPStatusError(
            f"Groq {response.status_code}: {response.text[:200]}",
            request=response.request,
            response=response,
        )

    try:
        return response.json()["choices"][0]["message"]["content"]
    except (KeyError, IndexError) as exc:
        raise ValueError(f"Unexpected Groq response format: {exc}")


async def _call_groq(messages: list[dict]) -> str:
    """
    Call Groq with circuit-breaker protection and one retry.

    Flow:
      1. Check breaker — raises 503 immediately if open
      2. Try the call
      3. On failure, retry once
      4. If retry also fails, record failure to breaker, raise 502/504
      5. On success, record success to breaker (resets failure count)
    """
    groq_breaker.check()

    last_exc: Exception | None = None
    for attempt in range(2):  # attempt 0 = first try, attempt 1 = one retry
        try:
            result = await _attempt_groq(messages)
            groq_breaker.record_success()
            return result
        except httpx.TimeoutException as exc:
            last_exc = exc
        except httpx.RequestError as exc:
            last_exc = exc
        except httpx.HTTPStatusError as exc:
            last_exc = exc
        except ValueError as exc:
            # Malformed response — retrying won't help, fail immediately
            groq_breaker.record_failure()
            raise HTTPException(status_code=502, detail=str(exc))

        if attempt == 0:
            # Brief backoff before retry — gives an overloaded Groq a moment to breathe.
            # Retrying instantly under load just adds to the problem.
            await asyncio.sleep(0.5)

    # Both attempts failed
    groq_breaker.record_failure()

    if isinstance(last_exc, httpx.TimeoutException):
        raise HTTPException(
            status_code=504,
            detail="AI service timed out. Your progress is saved — please try again shortly.",
        )
    raise HTTPException(
        status_code=502,
        detail="AI service is unreachable. Your progress is saved — please try again shortly.",
    )


def _gemini_to_openai(history: list[dict]) -> list[dict]:
    """Convert Gemini-format history [{role, parts}] to OpenAI format [{role, content}]."""
    result = []
    for msg in history:
        role = "assistant" if msg.get("role") == "model" else msg.get("role", "user")
        # Gemini format: parts=[{text: ...}]
        if "parts" in msg:
            content = msg["parts"][0].get("text", "")
        else:
            content = msg.get("text", "")
        result.append({"role": role, "content": content})
    return result


async def get_ai_response(user_message: str, history: list[dict]) -> str:
    messages = [{"role": "system", "content": CHAT_SYSTEM}]
    messages += _gemini_to_openai(history)
    messages.append({"role": "user", "content": user_message})
    return await _call_groq(messages)


async def suggest_ipc_sections(description: str) -> str:
    prompt = f"""Based on this FIR complaint description, suggest the most relevant IPC (Indian Penal Code) sections.
Return ONLY the section numbers and brief descriptions, no other text.

Complaint: {description}

Format your response as:
Section X - [brief description]
Section Y - [brief description]"""
    messages = [
        {"role": "system", "content": "You are a legal expert specializing in Indian criminal law."},
        {"role": "user", "content": prompt},
    ]
    return await _call_groq(messages)


async def conduct_interview(
    incident_type: str,
    description: str,
    history: list[dict],
    question_num: int,
) -> dict:
    if question_num >= 10:
        return {"question": "", "done": True}

    focus = INCIDENT_FOCUS.get(incident_type, INCIDENT_FOCUS["other"])
    system = INTERVIEW_SYSTEM_TEMPLATE.format(
        incident_type=incident_type.replace("_", " ").title(),
        description=description,
        question_num=question_num + 1,
        focus=focus,
    )

    messages = [{"role": "system", "content": system}]
    messages += _gemini_to_openai(history)
    messages.append({
        "role": "user",
        "content": "Please ask your next question, or respond ###DONE### if you have enough information.",
    })

    response = await _call_groq(messages)

    if "###DONE###" in response:
        clean = response.replace("###DONE###", "").strip()
        return {"question": clean, "done": True}

    return {"question": response.strip(), "done": False}


async def enrichment_next_question(
    incident_type: str,
    description: str,
    messages: list[dict],  # OpenAI format: [{role, content}]
    turn_count: int,
) -> str:
    """Ask Groq for the next interview question given the conversation so far.
    Messages must be in OpenAI format (role: assistant|user, content: str).
    turn_count = number of citizen answers already saved.
    """
    focus = INCIDENT_FOCUS.get(incident_type, INCIDENT_FOCUS["other"])
    system = INTERVIEW_SYSTEM_TEMPLATE.format(
        incident_type=incident_type.replace("_", " ").title(),
        description=description,
        question_num=turn_count + 1,
        focus=focus,
    )
    groq_messages = [{"role": "system", "content": system}]
    groq_messages += messages  # already in OpenAI format — no conversion needed
    groq_messages.append({
        "role": "user",
        "content": "Please ask your next question, or respond ###DONE### if you have enough information.",
    })
    response = await _call_groq(groq_messages)
    return response.replace("###DONE###", "").strip()


async def enrichment_synthesize(
    incident_type: str,
    description: str,
    messages: list[dict],  # OpenAI format: [{role, content}]
) -> dict:
    """Generate enriched FIR summary + IPC sections from the completed 10-turn conversation."""
    qa_text = "\n".join(
        f"{'Interviewer' if m['role'] == 'assistant' else 'Complainant'}: {m['content']}"
        for m in messages
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

    groq_messages = [
        {"role": "system", "content": "You are a senior police officer writing official FIR documentation."},
        {"role": "user", "content": prompt},
    ]
    response = await _call_groq(groq_messages)

    summary = ""
    ipc = ""
    if "SUMMARY:" in response and "IPC_SECTIONS:" in response:
        parts = response.split("IPC_SECTIONS:")
        summary = parts[0].replace("SUMMARY:", "").strip()
        ipc = parts[1].strip()
    else:
        summary = response.strip()

    return {"summary": summary, "ipc_sections": ipc}


async def summarize_interview(
    incident_type: str,
    description: str,
    conversation: list[dict],
) -> dict:
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

    messages = [
        {"role": "system", "content": "You are a senior police officer writing official FIR documentation."},
        {"role": "user", "content": prompt},
    ]
    response = await _call_groq(messages)

    summary = ""
    ipc = ""
    if "SUMMARY:" in response and "IPC_SECTIONS:" in response:
        parts = response.split("IPC_SECTIONS:")
        summary = parts[0].replace("SUMMARY:", "").strip()
        ipc = parts[1].strip()
    else:
        summary = response.strip()

    return {"summary": summary, "ipc_sections": ipc}
