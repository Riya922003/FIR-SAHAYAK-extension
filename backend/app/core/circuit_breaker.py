import time
from fastapi import HTTPException


class CircuitBreaker:
    """
    Three states:
      CLOSED    — normal, all calls go through
      OPEN      — too many failures, all calls rejected immediately
      HALF-OPEN — recovery_timeout passed; exactly ONE probe request is allowed
                  through. Every other concurrent request still gets 503 until
                  the probe settles (success → closed, failure → open again).

    failure_threshold : failures within the rolling window before opening
    window_seconds    : rolling window duration
    recovery_timeout  : seconds before allowing a single probe call
    """

    def __init__(
        self,
        failure_threshold: int = 5,
        window_seconds: int = 60,
        recovery_timeout: int = 60,
    ):
        self.failure_threshold = failure_threshold
        self.window_seconds = window_seconds
        self.recovery_timeout = recovery_timeout

        self._failures: list[float] = []   # timestamps of recent failures
        self._open_since: float = 0.0
        self._is_open: bool = False
        self._probe_in_flight: bool = False  # True while a half-open test is running

    # ── internal ──────────────────────────────────────────────────────────────

    def _recovery_elapsed(self) -> bool:
        return self._is_open and (time.monotonic() - self._open_since >= self.recovery_timeout)

    # ── public ────────────────────────────────────────────────────────────────

    def check(self) -> None:
        """
        Raise 503 if the circuit should block this request.

        Half-open gatekeeper: when recovery_timeout elapses, the FIRST caller
        atomically claims _probe_in_flight and is let through. Every other
        concurrent caller still gets 503 until that probe resolves.
        This prevents the thundering herd — 10 simultaneous requests after a
        60-second wait don't all slam Groq at once; only 1 does.
        """
        if not self._is_open:
            return  # closed — pass through

        if self._recovery_elapsed():
            if self._probe_in_flight:
                # A probe is already running — block every other concurrent caller
                raise HTTPException(
                    status_code=503,
                    detail=(
                        "AI enrichment is temporarily unavailable. "
                        "Your FIR is saved — please try enrichment again in a few minutes."
                    ),
                )
            # First caller through — claim the probe slot
            self._probe_in_flight = True
            return

        # Still within the open window
        raise HTTPException(
            status_code=503,
            detail=(
                "AI enrichment is temporarily unavailable. "
                "Your FIR is saved — please try enrichment again in a few minutes."
            ),
        )

    def record_success(self) -> None:
        """
        Call after a successful Groq response.

        Closes the circuit and releases the probe flag. Does NOT wipe the failure
        history — old failures expire naturally from the rolling window on their own.
        Wiping on success would allow a flaky Groq (e.g. 80% failure rate) to keep
        resetting the counter and never trip the breaker.
        """
        self._is_open = False
        self._open_since = 0.0
        self._probe_in_flight = False

    def record_failure(self) -> None:
        """
        Call after both retry attempts fail.

        Appends to the rolling window, opens the circuit if threshold is crossed,
        and releases _probe_in_flight so the next recovery cycle can start fresh.
        """
        now = time.monotonic()
        # Expire failures outside the rolling window
        self._failures = [t for t in self._failures if now - t < self.window_seconds]
        self._failures.append(now)
        # Release probe so the next recovery attempt is possible
        self._probe_in_flight = False
        if len(self._failures) >= self.failure_threshold:
            self._is_open = True
            self._open_since = now

    # ── debug / health ────────────────────────────────────────────────────────

    def state(self) -> str:
        if not self._is_open:
            return "closed"
        if self._recovery_elapsed():
            return "half-open"
        return "open"


# Module-level singleton — shared across all requests in this process.
# asyncio is single-threaded, so plain boolean flags are safe without locks.
groq_breaker = CircuitBreaker(
    failure_threshold=5,
    window_seconds=60,
    recovery_timeout=60,
)
