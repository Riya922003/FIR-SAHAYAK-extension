from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from typing import List

from app.core.limiter import limiter
from app.core.security import get_current_user
from app.models.user import User
from app.models.fir import ChatLog
from app.repositories import get_chat_log_repo
from app.repositories.chat_log_repository import ChatLogRepository
from app.services.ai_service import (
    get_ai_response,
    suggest_ipc_sections,
    conduct_interview,
    summarize_interview,
)

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


class InterviewRequest(BaseModel):
    incident_type: str
    description: str
    history: List[ChatMessage] = []
    question_count: int = 0


class InterviewResponse(BaseModel):
    question: str
    done: bool


class SummarizeRequest(BaseModel):
    incident_type: str
    description: str
    conversation: List[ChatMessage]


class SummarizeResponse(BaseModel):
    summary: str
    ipc_sections: str


@router.post("/chat", response_model=ChatResponse)
@limiter.limit("20/minute")
async def chat(
    request: Request,
    payload: ChatRequest,
    chat_log_repo: ChatLogRepository = Depends(get_chat_log_repo),
    current_user: User = Depends(get_current_user),
):
    gemini_history = [
        {"role": msg.role, "parts": [{"text": msg.text}]}
        for msg in payload.history
    ]
    reply = await get_ai_response(payload.message, gemini_history)

    await chat_log_repo.create(ChatLog(
        user_id=current_user.id,
        user_message=payload.message,
        bot_response=reply,
    ))
    return ChatResponse(reply=reply)


@router.post("/suggest-ipc", response_model=IPCSuggestResponse)
@limiter.limit("20/minute")
async def suggest_ipc(
    request: Request,
    payload: IPCSuggestRequest,
    current_user: User = Depends(get_current_user),
):
    if len(payload.description) < 30:
        raise HTTPException(status_code=400, detail="Description too short for IPC suggestion")
    suggestions = await suggest_ipc_sections(payload.description)
    return IPCSuggestResponse(suggestions=suggestions)


@router.post("/interview", response_model=InterviewResponse)
@limiter.limit("30/minute")
async def interview(
    request: Request,
    payload: InterviewRequest,
    current_user: User = Depends(get_current_user),
):
    """Conduct one turn of the AI-guided FIR interview. Returns the next question or done=True."""
    gemini_history = [
        {"role": msg.role, "parts": [{"text": msg.text}]}
        for msg in payload.history
    ]
    result = await conduct_interview(
        incident_type=payload.incident_type,
        description=payload.description,
        history=gemini_history,
        question_num=payload.question_count,
    )
    return InterviewResponse(**result)


@router.post("/summarize-interview", response_model=SummarizeResponse)
@limiter.limit("10/minute")
async def summarize_interview_endpoint(
    request: Request,
    payload: SummarizeRequest,
    current_user: User = Depends(get_current_user),
):
    """Generate a structured officer summary + IPC suggestions from the completed interview."""
    conversation = [{"role": m.role, "text": m.text} for m in payload.conversation]
    result = await summarize_interview(
        incident_type=payload.incident_type,
        description=payload.description,
        conversation=conversation,
    )
    return SummarizeResponse(**result)
