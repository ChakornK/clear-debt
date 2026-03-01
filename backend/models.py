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
    is_income: Optional[bool] = False

class ChatMessage(BaseModel):
    role: str
    content: str

class ExchangeTokenRequest(BaseModel):
    public_token: str

class SaveDebtsRequest(BaseModel):
    debts: List[Debt]
    calendar_events: Optional[List[CalendarEvent]] = []
    monthly_income: Optional[float] = 0
    monthly_limit: Optional[float] = 0
    savings_pct: Optional[float] = 20

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

class PredictEventRequest(BaseModel):
    label: str
    date: str