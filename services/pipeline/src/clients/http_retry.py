"""Retry policy shared by the pipeline's HTTP clients.

Only transient failures are retried: network errors, timeouts, 408/425/429 and
5xx. Permanent ones — 400/401/403/404 — fail immediately. The old policy
retried every HTTPStatusError, so a CelesTrak 403 (its "you're polling too
often" answer, which won't change for hours) burned five attempts and ~3
minutes per group on every sync.

Waits are exponential with full jitter (so parallel runs don't retry in
lockstep), and a server's ``Retry-After`` is honoured, capped so one header
can't stall the whole sync.
"""
from __future__ import annotations

import email.utils
import random
import time

import httpx
from tenacity import RetryCallState, retry, retry_if_exception, stop_after_attempt

TRANSIENT_STATUS = {408, 425, 429, 500, 502, 503, 504}
MAX_RETRY_AFTER_S = 120.0


def is_transient(exc: BaseException) -> bool:
    if isinstance(exc, httpx.HTTPStatusError):
        return exc.response.status_code in TRANSIENT_STATUS
    return isinstance(exc, httpx.TransportError)  # connect/read errors, timeouts


def retry_after_seconds(resp: httpx.Response) -> float | None:
    """Seconds requested by a Retry-After header (delta or HTTP date)."""
    raw = resp.headers.get("Retry-After")
    if not raw:
        return None
    try:
        return max(0.0, float(raw))
    except ValueError:
        pass
    try:
        when = email.utils.parsedate_to_datetime(raw)
        return max(0.0, when.timestamp() - time.time())
    except (TypeError, ValueError):
        return None


def make_wait(base: float = 2.0, cap: float = 60.0):
    def wait(state: RetryCallState) -> float:
        exc = state.outcome.exception() if state.outcome else None
        if isinstance(exc, httpx.HTTPStatusError):
            ra = retry_after_seconds(exc.response)
            if ra is not None:
                return min(ra, MAX_RETRY_AFTER_S)
        # Full jitter: uniform in [0, min(cap, base * 2^attempt)].
        return random.uniform(0, min(cap, base * (2 ** state.attempt_number)))

    return wait


def http_retry(attempts: int = 5, base: float = 2.0, cap: float = 60.0):
    """Decorator for a function that performs one HTTP request and calls
    ``raise_for_status()``."""
    return retry(
        retry=retry_if_exception(is_transient),
        wait=make_wait(base, cap),
        stop=stop_after_attempt(attempts),
        reraise=True,
    )
