# backend/milestones.py
from datetime import datetime, timedelta

MILESTONE_WEIGHTS = {
    "Budget Beater": 10,
    "Entered Top 10%": 9,
    "7-Day Spending Streak": 8,
    "Saved $200 This Month": 7,
    "No-Spend Weekend": 6,
    "First No-Spend Day": 5,
    "Joined First Challenge": 3,
}

def is_recent(timestamp: datetime, hours: int = 48) -> bool:
    return datetime.utcnow() - timestamp < timedelta(hours=hours)

def get_top_milestones(milestones: list[dict], top_n: int = 3) -> list[dict]:
    def score(milestone):
        weight = MILESTONE_WEIGHTS.get(milestone["title"], 1)
        recency_bonus = 5 if is_recent(milestone["timestamp"]) else 0
        return weight + recency_bonus

    return sorted(milestones, key=score, reverse=True)[:top_n]

def format_time(ts: datetime) -> str:
    diff = datetime.utcnow() - ts
    if diff.seconds < 60:     return "Just now"
    if diff.seconds < 3600:   return f"{diff.seconds // 60}m ago"
    if diff.seconds < 86400:  return f"{diff.seconds // 3600}h ago"
    if diff.days == 1:        return "Yesterday"
    if diff.days < 7:         return f"{diff.days} days ago"
    return f"{diff.days // 7} week{'s' if diff.days >= 14 else ''} ago"