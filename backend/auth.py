from authlib.integrations.starlette_client import OAuth
from fastapi import APIRouter, Request, HTTPException, Depends
from starlette.config import Config
from starlette.responses import RedirectResponse
import os

import jwt
from datetime import datetime, timedelta

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

JWT_SECRET = os.getenv("SECRET_KEY", "jwt-secret")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_DAYS = 7

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=JWT_EXPIRATION_DAYS)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return encoded_jwt

async def get_current_user(request: Request):
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid token")
    
    token = auth_header.split(" ")[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

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
        
        # Prepare JWT payload: combine user info and access_token
        jwt_payload = {
            'sub': user_info['sub'],
            'email': user_info['email'],
            'name': user_info['name'],
            'given_name': user_info['given_name'],
            'family_name': user_info.get('family_name', ''),
            'picture': user_info['picture'],
            'access_token': token_data.get('access_token')
        }
        
        jwt_token = create_access_token(jwt_payload)

        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
        # Pass the token to the frontend via query param for the first time
        return RedirectResponse(url=f"{frontend_url}/dashboard?token={jwt_token}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/logout")
async def logout(request: Request):
    # Stateless logout: just redirect to frontend. 
    # Frontend will clear the cookie.
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

