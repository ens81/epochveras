from fastapi import APIRouter, Request

clerk_router = APIRouter(prefix="/api")


def require_user(request: Request) -> dict:
    user_id = (
        request.headers.get("x-client-id")
        or request.headers.get("x-user-id")
        or "default_user"
    )[:64]
    return {
        "user_id": user_id,
        "session_id": "local_session",
        "claims": {"sub": user_id},
    }

