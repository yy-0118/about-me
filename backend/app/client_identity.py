import re
from fastapi import Request


CLIENT_ID_HEADER = "x-client-id"
_CLIENT_ID_RE = re.compile(r"^[A-Za-z0-9._:-]{8,128}$")


def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",", 1)[0].strip()[:64]
    if request.client and request.client.host:
        return request.client.host[:64]
    return "unknown"


def get_client_identity(request: Request) -> tuple[str, str]:
    client_ip = get_client_ip(request)
    raw_client_id = (request.headers.get(CLIENT_ID_HEADER) or "").strip()
    if _CLIENT_ID_RE.match(raw_client_id):
        return raw_client_id, client_ip
    return f"ip:{client_ip}", client_ip
