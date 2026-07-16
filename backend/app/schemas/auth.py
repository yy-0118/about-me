from pydantic import BaseModel, Field
from typing import Optional


class AdminLoginRequest(BaseModel):
    password: str = Field(..., min_length=1, max_length=128)


class AdminLoginResponse(BaseModel):
    token: str
    expires_at: str
