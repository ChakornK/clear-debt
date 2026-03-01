from pydantic import BaseModel
from typing import List, Optional, Dict, Any

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

class DashboardResponse(BaseModel):
    debtProgress: Dict[str, Any]
    achievement: Dict[str, Any]
    upcomingEvents: List[Dict[str, Any]]
    weeklySpending: Dict[str, Any]
    dailyDistribution: List[Dict[str, Any]]
    spendingCategories: Dict[str, Any]
    milestone: Dict[str, Any]