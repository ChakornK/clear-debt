from authlib.integrations.starlette_client import OAuth
from fastapi import APIRouter, Request, HTTPException, Depends
from starlette.config import Config
from starlette.responses import RedirectResponse
import os, uuid

# Load config from .env or environment variables
config = Config(".env")
oauth = OAuth(config)

oauth.register(
    name='google',
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_id=os.getenv('GOOGLE_CLIENT_ID'),
    client_secret=os.getenv('GOOGLE_CLIENT_SECRET'),
    client_kwargs={
        'scope': 'openid email profile https://www.googleapis.com/auth/calendar.events.readonly'
    }
)

# In-memory session store: {token: {"user": ..., "access_token": ...}}
SESSION_CACHE = {}

async def get_current_user(request: Request):
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid token")
    
    token = auth_header.split(" ")[1]
    session = SESSION_CACHE.get(token)
    
    if not session:
        raise HTTPException(status_code=401, detail="Session expired or invalid")
    
    # Attach access_token to the user dict for ease of use in other routes
    user = session['user'].copy()
    user['access_token'] = session['access_token']
    return user

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.get("/login")
async def login(request: Request):
    redirect_uri = request.url_for('auth_callback')
    return await oauth.google.authorize_redirect(request, str(redirect_uri))

@router.get("/callback", name="auth_callback")
async def auth_callback(request: Request):
    try:
        token_data = await oauth.google.authorize_access_token(request)
        user_info = token_data.get('userinfo')
        if not user_info:
            raise HTTPException(status_code=400, detail="Failed to fetch user info")
        
        # Generate our own session token
        session_token = str(uuid.uuid4())
        SESSION_CACHE[session_token] = {
            'user': user_info,
            'access_token': token_data.get('access_token')
        }

        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
        # Pass the token to the frontend via query param for the first time
        return RedirectResponse(url=f"{frontend_url}/dashboard?token={session_token}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/logout")
async def logout(request: Request):
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        SESSION_CACHE.pop(token, None)
    
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
    return RedirectResponse(url=frontend_url)

@router.get("/me")
async def get_me(user: dict = Depends(get_current_user)):
    return {
        'id': user['sub'],
        'email': user['email'],
        'name': user['name'],
        'given_name': user['given_name'],
        'picture': user['picture']
    }

