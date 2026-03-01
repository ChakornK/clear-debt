import httpx
from datetime import datetime, timedelta

async def get_google_calendar_events(access_token: str, days: int = 30):
    time_min = datetime.utcnow().isoformat() + 'Z'
    time_max = (datetime.utcnow() + timedelta(days=days)).isoformat() + 'Z'
    
    url = "https://www.googleapis.com/calendar/v3/calendars/primary/events"
    params = {
        "timeMin": time_min,
        "timeMax": time_max,
        "singleEvents": "true",
        "orderBy": "startTime",
    }
    
    headers = {
        "Authorization": f"Bearer {access_token}"
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.get(url, params=params, headers=headers)
        if response.status_code != 200:
            raise Exception(f"Google Calendar API error: {response.text}")
        
        data = response.json()
        events = []
        for item in data.get('items', []):
            start = item.get('start', {})
            date_str = start.get('dateTime') or start.get('date')
            events.append({
                "label": item.get('summary', 'No Title'),
                "date": date_str,
                "type": "Calendar Event"
            })
        return events
