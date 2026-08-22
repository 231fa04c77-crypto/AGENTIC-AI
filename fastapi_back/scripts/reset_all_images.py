import asyncio
from app.config.db import db

async def reset_all_images():
    await db.connect()
    try:
        # Clear all standalone doctor images
        await db.execute("UPDATE doctors SET image = NULL")
        # Clear all hospital tie-up doctor images
        await db.execute("UPDATE hospital_tieup_doctors SET image = NULL")
        print("SUCCESS: All doctor image links have been cleared from the database.")
    except Exception as e:
        print(f"ERROR: {e}")
    finally:
        await db.disconnect()

if __name__ == "__main__":
    asyncio.run(reset_all_images())
