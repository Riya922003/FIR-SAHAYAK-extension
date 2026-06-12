from fastapi import APIRouter, Depends, HTTPException
from sqlmodel.ext.asyncio.session import AsyncSession
from pydantic import BaseModel
from typing import List, Optional

from app.core.database import get_session
from app.core.security import get_current_user
from app.models.user import User
from app.models.fir import ChatLog
from app.services.ai_service import get_ai_response, suggest_ipc_sections

router = APIRouter(prefix="/ai", tags=["AI Assistant"])


class ChatMessage(BaseModel):
    role: str   # "user" or "model"
    text: str


class ChatRequest(BaseModel):
    message: str
    history: List[ChatMessage] = []


class ChatResponse(BaseModel):
    reply: str


class IPCSuggestRequest(BaseModel):
    description: str


class IPCSuggestResponse(BaseModel):
    suggestions: str


@router.post("/chat", response_model=ChatResponse)
async def chat(
    payload: ChatRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    # Convert history to Gemini format
    gemini_history = [
        {"role": msg.role, "parts": [{"text": msg.text}]}
        for msg in payload.history
    ]

    reply = await get_ai_response(payload.message, gemini_history)

    # Log conversation to DB (background-safe since session is already async)
    log = ChatLog(
        user_id=current_user.id,
        user_message=payload.message,
        bot_response=reply,
    )
    session.add(log)
    await session.commit()

    return ChatResponse(reply=reply)


@router.post("/suggest-ipc", response_model=IPCSuggestResponse)
async def suggest_ipc(
    payload: IPCSuggestRequest,
    current_user: User = Depends(get_current_user),
):
    if len(payload.description) < 30:
        raise HTTPException(status_code=400, detail="Description too short for IPC suggestion")

    suggestions = await suggest_ipc_sections(payload.description)
    return IPCSuggestResponse(suggestions=suggestions)
