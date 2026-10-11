"""Rate limiting configuration using slowapi."""

import os
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["120/minute"],
    enabled=os.getenv("RATE_LIMIT_ENABLED", "true").lower() != "false",
)
