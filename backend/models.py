from pydantic import BaseModel
from typing import List, Optional

class User(BaseModel):
    id: str
    email: str
    name: Optional[str] = None
    picture: Optional[str] = None

class Debt(BaseModel):
    id: str
    name: str
    type: str
    balance: float
    apr: float
    minimum: float
    due: int
    source: Optional[str] = 'manual'

class CalendarEvent(BaseModel):
    date: str
    type: str
    label: str
    amount: float

class ChatMessage(BaseModel):
    role: str
    content: str

class ExchangeTokenRequest(BaseModel):
    public_token: str

class SaveDebtsRequest(BaseModel):
    debts: List[Debt]
    calendar_events: Optional[List[CalendarEvent]] = []

class GeneratePlanRequest(BaseModel):
    extra_payment: Optional[float] = 200

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[ChatMessage]] = []