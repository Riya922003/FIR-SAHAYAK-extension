from slowapi import Limiter
from slowapi.util import get_remote_address

# Single limiter instance shared across all routers.
# default_limits applies to every route unless overridden by @limiter.limit().
limiter = Limiter(key_func=get_remote_address, default_limits=["60/minute"])
