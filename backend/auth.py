from authlib.integrations.starlette_client import OAuth
from fastapi import APIRouter, Request, HTTPException
from starlette.config import Config
from starlette.responses import RedirectResponse
import os
from models import User

# Load config from .env or environment variables
config = Config(".env")
oauth = OAuth(config)

oauth.register(
    name='google',
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_id=os.getenv('GOOGLE_CLIENT_ID'),
    client_secret=os.getenv('GOOGLE_CLIENT_SECRET'),
    client_kwargs={
        'scope': 'openid email profile'
    }
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.get("/login")
async def login(request: Request):
    redirect_uri = request.url_for('auth_callback')
    return await oauth.google.authorize_redirect(request, str(redirect_uri))

@router.get("/callback", name="auth_callback")
async def auth_callback(request: Request):
    try:
        token = await oauth.google.authorize_access_token(request)
        user_info = token.get('userinfo')
        if not user_info:
            raise HTTPException(status_code=400, detail="Failed to fetch user info")
        
        # For session-based auth:
        request.session['user'] = user_info

        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
        return RedirectResponse(url=f"{frontend_url}/dashboard")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/logout")
async def logout(request: Request):
    request.session.pop('user', None)
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
    return RedirectResponse(url=frontend_url)

@router.get("/me")
async def get_me(request: Request):
    user = request.session.get('user')
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return {
        'id': user['sub'],
        'email': user['email'],
        'name': user['name'],
        'given_name': user['given_name'],
        'picture': user['picture']
    }

async def get_current_user(request: Request):
    user = request.session.get('user')
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user
