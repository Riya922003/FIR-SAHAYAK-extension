import time
from fastapi import HTTPException


class CircuitBreaker:
    """
    Three states:
      CLOSED   — normal, calls go through
      OPEN     — too many failures, calls rejected immediately
      HALF-OPEN — recovery_timeout passed, one call allowed through to test

    failure_threshold : how many failures inside the window before opening
    window_seconds    : rolling window in which failures are counted
    recovery_timeout  : seconds to wait before allowing a test call (half-open)
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

        self._failures: list[float] = []  # timestamps of recent failures
        self._open_since: float = 0.0
        self._is_open: bool = False

    # ── public ────────────────────────────────────────────────────────────────

    @property
    def is_open(self) -> bool:
        if not self._is_open:
            return False
        # half-open: recovery window has passed — let one test call through
        if time.monotonic() - self._open_since >= self.recovery_timeout:
            return False
        return True

    def check(self) -> None:
        """Raise 503 if the circuit is open. Call before every Groq request."""
        if self.is_open:
            raise HTTPException(
                status_code=503,
                detail=(
                    "AI enrichment is temporarily unavailable. "
                    "Your FIR is saved — please try enrichment again in a few minutes."
                ),
            )

    def record_success(self) -> None:
        """Call after a successful Groq response. Resets the breaker."""
        self._failures.clear()
        self._is_open = False
        self._open_since = 0.0

    def record_failure(self) -> None:
        """Call after a failed Groq attempt (post-retry). May open the circuit."""
        now = time.monotonic()
        # drop failures outside the rolling window
        self._failures = [t for t in self._failures if now - t < self.window_seconds]
        self._failures.append(now)
        if len(self._failures) >= self.failure_threshold:
            self._is_open = True
            self._open_since = now

    # ── debug / health ────────────────────────────────────────────────────────

    def state(self) -> str:
        if self._is_open:
            if time.monotonic() - self._open_since >= self.recovery_timeout:
                return "half-open"
            return "open"
        return "closed"


# module-level singleton — shared across all requests in this process
groq_breaker = CircuitBreaker(
    failure_threshold=5,
    window_seconds=60,
    recovery_timeout=60,
)
