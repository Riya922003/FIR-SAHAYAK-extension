from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from app.core.limiter import limiter
from app.core.security import get_current_user
from app.core.circuit_breaker import groq_breaker
from app.models.user import User
from app.models.fir import AIConversation
from app.models.enums import EnrichmentStatus, FIRStatus
from app.repositories import FIRRepository, get_fir_repo
from app.repositories.ai_conversation_repository import AIConversationRepository, get_conv_repo
from app.services.ai_service import enrichment_next_question, enrichment_synthesize

router = APIRouter(prefix="/fir", tags=["Enrichment"])


# ── Guards ────────────────────────────────────────────────────────────────────

def _assert_owns(fir, user: User) -> None:
    if fir.citizen_id != user.id:
        raise HTTPException(status_code=403, detail="Not your FIR.")


def _assert_not_locked(fir) -> None:
    """Enrichment is locked once an officer acknowledges the FIR."""
    if fir.status == FIRStatus.ACKNOWLEDGED:
        raise HTTPException(
            status_code=409,
            detail="Enrichment is locked — an officer has acknowledged this FIR.",
        )


# ── Schemas ───────────────────────────────────────────────────────────────────

class EnrichmentStartResponse(BaseModel):
    question: str
    turn_count: int   # always 0 when a fresh session starts


class EnrichmentMessageRequest(BaseModel):
    answer: str


class EnrichmentMessageResponse(BaseModel):
    question: Optional[str] = None   # next Groq question; None when done=True
    turn_count: int
    done: bool


class EnrichmentStatusResponse(BaseModel):
    enrichment_status: str
    turn_count: int
    last_question: Optional[str] = None  # last assistant message so UI can resume mid-chat
    is_locked: bool                       # True once FIR is acknowledged by officer


# ── POST /fir/{fir_id}/enrichment/start ───────────────────────────────────────

@router.post("/{fir_id}/enrichment/start", response_model=EnrichmentStartResponse)
@limiter.limit("10/minute")
async def enrichment_start(
    request: Request,
    fir_id: str,
    fir_repo: FIRRepository = Depends(get_fir_repo),
    conv_repo: AIConversationRepository = Depends(get_conv_repo),
    current_user: User = Depends(get_current_user),
):
    """
    Begin the AI enrichment interview for a filed FIR.
    Returns the first Groq question. Creates the AIConversation row.
    Can only be called when enrichment_status is pending (or unavailable — retry allowed).
    """
    fir = await fir_repo.get_by_id(fir_id)
    if not fir:
        raise HTTPException(status_code=404, detail="FIR not found.")
    _assert_owns(fir, current_user)
    _assert_not_locked(fir)

    if fir.enrichment_status == EnrichmentStatus.IN_PROGRESS:
        raise HTTPException(
            status_code=409,
            detail="Enrichment already in progress. Use GET /enrichment/status to resume.",
        )
    if fir.enrichment_status == EnrichmentStatus.COMPLETE:
        raise HTTPException(status_code=409, detail="Enrichment is already complete.")

    # Raises 503 immediately if Groq circuit is open
    groq_breaker.check()

    q1 = await enrichment_next_question(
        incident_type=fir.incident_type,
        description=fir.description,
        messages=[],
        turn_count=0,
    )

    # Persist conversation with Q1 as the first message
    conv = AIConversation(
        fir_id=fir_id,
        messages=[{"role": "assistant", "content": q1}],
        turn_count=0,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    await conv_repo.create(conv)

    fir.enrichment_status = EnrichmentStatus.IN_PROGRESS
    fir.updated_at = datetime.utcnow()
    await fir_repo.update(fir)

    return EnrichmentStartResponse(question=q1, turn_count=0)


# ── POST /fir/{fir_id}/enrichment/message ─────────────────────────────────────

@router.post("/{fir_id}/enrichment/message", response_model=EnrichmentMessageResponse)
@limiter.limit("30/minute")
async def enrichment_message(
    request: Request,
    fir_id: str,
    payload: EnrichmentMessageRequest,
    fir_repo: FIRRepository = Depends(get_fir_repo),
    conv_repo: AIConversationRepository = Depends(get_conv_repo),
    current_user: User = Depends(get_current_user),
):
    """
    Submit one citizen answer and receive the next Groq question.

    On the 10th answer, synthesis runs automatically:
      - description_enriched and suggested_ipc_sections are saved on the FIR
      - enrichment_status → complete
      - Response: { done: true, question: null }

    If synthesis previously failed (turn_count already 10, status still in_progress),
    calling this endpoint again retries the synthesis — the answer payload is ignored.
    """
    fir = await fir_repo.get_by_id(fir_id)
    if not fir:
        raise HTTPException(status_code=404, detail="FIR not found.")
    _assert_owns(fir, current_user)
    _assert_not_locked(fir)

    if fir.enrichment_status != EnrichmentStatus.IN_PROGRESS:
        raise HTTPException(
            status_code=409,
            detail="No enrichment session in progress. Call /enrichment/start first.",
        )

    conv = await conv_repo.get_by_fir_id(fir_id)
    if not conv:
        raise HTTPException(
            status_code=404,
            detail="Conversation record missing. Call /enrichment/start.",
        )

    messages = list(conv.messages)

    # ── Synthesis retry path ──────────────────────────────────────────────────
    # turn_count already 10 means all answers saved but synthesis failed last time.
    # Retry synthesis without touching the messages.
    if conv.turn_count >= 10:
        result = await enrichment_synthesize(
            incident_type=fir.incident_type,
            description=fir.description,
            messages=messages,
        )
        fir.description_enriched = result["summary"]
        fir.suggested_ipc_sections = result["ipc_sections"]
        fir.ai_interview_summary = result["summary"]
        fir.enrichment_status = EnrichmentStatus.COMPLETE
        fir.updated_at = datetime.utcnow()
        await fir_repo.update(fir)
        return EnrichmentMessageResponse(question=None, turn_count=conv.turn_count, done=True)

    # ── Normal path: save answer BEFORE calling Groq ──────────────────────────
    # This ensures no citizen answer is ever lost due to a Groq failure.
    messages.append({"role": "user", "content": payload.answer.strip()})
    new_turn_count = conv.turn_count + 1
    conv.messages = messages
    conv.turn_count = new_turn_count
    await conv_repo.update(conv)

    # ── Auto-complete at turn 10 ──────────────────────────────────────────────
    if new_turn_count >= 10:
        result = await enrichment_synthesize(
            incident_type=fir.incident_type,
            description=fir.description,
            messages=messages,
        )
        fir.description_enriched = result["summary"]
        fir.suggested_ipc_sections = result["ipc_sections"]
        fir.ai_interview_summary = result["summary"]
        fir.enrichment_status = EnrichmentStatus.COMPLETE
        fir.updated_at = datetime.utcnow()
        await fir_repo.update(fir)
        return EnrichmentMessageResponse(question=None, turn_count=new_turn_count, done=True)

    # ── Ask Groq for next question ────────────────────────────────────────────
    groq_breaker.check()
    next_q = await enrichment_next_question(
        incident_type=fir.incident_type,
        description=fir.description,
        messages=messages,
        turn_count=new_turn_count,
    )

    messages.append({"role": "assistant", "content": next_q})
    conv.messages = messages
    await conv_repo.update(conv)

    return EnrichmentMessageResponse(question=next_q, turn_count=new_turn_count, done=False)


# ── GET /fir/{fir_id}/enrichment/status ───────────────────────────────────────

@router.get("/{fir_id}/enrichment/status", response_model=EnrichmentStatusResponse)
async def enrichment_status(
    fir_id: str,
    fir_repo: FIRRepository = Depends(get_fir_repo),
    conv_repo: AIConversationRepository = Depends(get_conv_repo),
    current_user: User = Depends(get_current_user),
):
    """
    Returns the current enrichment state for a FIR.
    The frontend calls this on page load to decide whether to show:
      - "Start enrichment" (pending)
      - "Resume enrichment" (in_progress) — last_question lets the UI repopulate the chat
      - "Enrichment complete" (complete)
      - "Enrichment expired" (expired)
      - "Locked" (is_locked=True)
    """
    fir = await fir_repo.get_by_id(fir_id)
    if not fir:
        raise HTTPException(status_code=404, detail="FIR not found.")
    _assert_owns(fir, current_user)

    last_question = None
    turn_count = 0

    conv = await conv_repo.get_by_fir_id(fir_id)
    if conv:
        turn_count = conv.turn_count
        # Last assistant message = the question the citizen should answer next
        for msg in reversed(conv.messages):
            if msg.get("role") == "assistant":
                last_question = msg["content"]
                break

    return EnrichmentStatusResponse(
        enrichment_status=fir.enrichment_status,
        turn_count=turn_count,
        last_question=last_question,
        is_locked=fir.status == FIRStatus.ACKNOWLEDGED,
    )
