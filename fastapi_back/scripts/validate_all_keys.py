import os
import asyncio
from dotenv import load_dotenv
import cloudinary
import cloudinary.api
import razorpay
import google.generativeai as genai
from openai import OpenAI
from sqlalchemy import create_engine, text

load_dotenv()

def p(service, status, message):
    print(f"[{status}] {service}: {message}")

async def validate_database():
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        p("DATABASE", "FAIL", "DATABASE_URL is not set")
        return
    try:
        engine = create_engine(db_url)
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        p("DATABASE", "PASS", "Successfully connected to Neon Cloud")
    except Exception as e:
        p("DATABASE", "FAIL", f"Connection failed: {str(e)}")

def validate_cloudinary():
    name = os.getenv("CLOUDINARY_NAME")
    key = os.getenv("CLOUDINARY_API_KEY")
    secret = os.getenv("CLOUDINARY_SECRET_KEY")
    if not all([name, key, secret]):
        p("CLOUDINARY", "FAIL", "Missing credentials")
        return
    try:
        cloudinary.config(cloud_name=name, api_key=key, api_secret=secret)
        cloudinary.api.ping()
        p("CLOUDINARY", "PASS", "Configuration is valid")
    except Exception as e:
        p("CLOUDINARY", "FAIL", f"Error: {str(e)}")

def validate_razorpay():
    kid = os.getenv("RAZORPAY_KEY_ID")
    ksec = os.getenv("RAZORPAY_KEY_SECRET")
    if not all([kid, ksec]):
        p("RAZORPAY", "FAIL", "Missing keys")
        return
    try:
        client = razorpay.Client(auth=(kid, ksec))
        client.order.all({'count': 1})
        p("RAZORPAY", "PASS", f"Keys are valid ({kid[:8]}...)")
    except Exception as e:
        p("RAZORPAY", "FAIL", f"Error: {str(e)}")

def validate_gemini():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        p("GEMINI", "FAIL", "API KEY is not set")
        return
    try:
        genai.configure(api_key=api_key)
        models = genai.list_models()
        p("GEMINI", "PASS", "API Key is valid")
    except Exception as e:
        p("GEMINI", "FAIL", f"Error: {str(e)}")

def validate_openai():
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        p("OPENAI", "FAIL", "API KEY is not set")
        return
    try:
        client = OpenAI(api_key=api_key)
        client.models.list()
        p("OPENAI", "PASS", "API Key is valid")
    except Exception as e:
        p("OPENAI", "FAIL", f"Error: {str(e)}")

async def main():
    print("-" * 50)
    print("MEDICHAIN+ API KEY VALIDATION")
    print("-" * 50)
    await validate_database()
    validate_cloudinary()
    validate_razorpay()
    validate_gemini()
    validate_openai()
    
    brevo_key = os.getenv("BERVO_API_KEY") or os.getenv("BREVO_API_KEY")
    if brevo_key:
        p("BREVO", "INFO", "API Key found")
    else:
        p("BREVO", "FAIL", "API Key not found")
    print("-" * 50)

if __name__ == "__main__":
    asyncio.run(main())
