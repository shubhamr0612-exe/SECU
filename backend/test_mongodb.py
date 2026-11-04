import os
from pathlib import Path

import pytest
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv(Path(__file__).resolve().parent / ".env")


@pytest.mark.integration
@pytest.mark.asyncio
async def test_connection():
    mongo_url = os.getenv("MONGO_URL")
    db_name = os.getenv("DB_NAME")

    assert mongo_url, "MONGO_URL is missing from backend/.env"
    assert db_name, "DB_NAME is missing from backend/.env"

    client = AsyncIOMotorClient(
        mongo_url,
        serverSelectionTimeoutMS=10000,
    )

    try:
        await client.admin.command("ping")

        db = client[db_name]
        collections = await db.list_collection_names()

        print("SUCCESS: Connected to MongoDB!")
        print("Database selected:", db.name)
        print("Existing collections:", collections)

    finally:
        client.close()