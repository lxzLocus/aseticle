from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    # login by email OR username
    identifier: str
    password: str


class UserOut(BaseModel):
    id: int
    email: EmailStr
    username: str
    search_source: str
    has_llm_key: bool = False
    llm_base_url: str | None = None
    llm_model: str | None = None
    has_serpapi_key: bool = False

    class Config:
        from_attributes = True


class MessageOut(BaseModel):
    message: str
