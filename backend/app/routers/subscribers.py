from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address
import logging

from ..database import get_db
from ..models import Subscriber
from ..schemas import SubscriberCreate, SubscriberResponse, UnsubscribeRequest
from ..services.whatsapp_service import whatsapp_service

router = APIRouter(prefix="/api", tags=["subscribers"])
logger = logging.getLogger(__name__)

# 25 main districts of Sri Lanka
VALID_DISTRICTS = {
    "Colombo", "Gampaha", "Kalutara", "Kandy", "Matale", "Nuwara Eliya",
    "Galle", "Matara", "Hambantota", "Jaffna", "Kilinochchi", "Mannar",
    "Vavuniya", "Mullaitivu", "Batticaloa", "Ampara", "Trincomalee",
    "Kurunegala", "Puttalam", "Anuradhapura", "Polonnaruwa", "Badulla",
    "Monaragala", "Ratnapura", "Kegalle"
}


@router.post("/subscribe", response_model=SubscriberResponse)
async def subscribe(request: SubscriberCreate, db: Session = Depends(get_db)):
    """Subscribe a phone number to flood alerts."""
    # Validate districts
    for district in request.districts:
        if district not in VALID_DISTRICTS:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid district: {district}. Valid districts: {', '.join(sorted(VALID_DISTRICTS))}"
            )

    # Check if already subscribed
    existing = db.query(Subscriber).filter(
        Subscriber.phone_number == request.phone_number
    ).first()

    if existing:
        if existing.active:
            raise HTTPException(status_code=400, detail="Phone number already subscribed")
        # Reactivate subscription
        existing.active = True
        existing.districts = request.districts
        existing.language = request.language
        db.commit()
        db.refresh(existing)
        logger.info(f"Reactivated subscription for {request.phone_number}")
        # Send confirmation for reactivated subscription
        await _send_subscription_confirmation(request.phone_number, request.districts, request.language)
        return existing

    # Create new subscriber
    subscriber = Subscriber(
        phone_number=request.phone_number,
        districts=request.districts,
        language=request.language
    )
    db.add(subscriber)
    db.commit()
    db.refresh(subscriber)

    logger.info(f"New subscription created for {request.phone_number}")

    # Send WhatsApp confirmation message
    await _send_subscription_confirmation(request.phone_number, request.districts, request.language)

    return subscriber


async def _send_subscription_confirmation(phone: str, districts: list[str], language: str):
    """Send WhatsApp confirmation message to new subscriber"""
    if not whatsapp_service.is_configured():
        logger.warning("WhatsApp not configured - confirmation not sent")
        return

    # Build message based on language
    if language == "si":
        message = (
            f"*FloodWatch Sri Lanka වෙත සාදරයෙන් පිළිගනිමු!*\n\n"
            f"ඔබ පහත දිස්ත්‍රික්ක සඳහා ජල ආපදා අනතුරු ඇඟවීම් ලබා ගැනීමට ලියාපදිංචි වී ඇත:\n"
            f"{', '.join(districts)}\n\n"
            f"Reply *unsubscribe* to stop alerts.\n"
            f"Reply *status* to check your subscription.\n\n"
            f"frontend-iklxt07wf-thaaarus-projects.vercel.app වෙත පිවිසෙන්න"
        )
    elif language == "ta":
        message = (
            f"*FloodWatch Sri Lanka க்கு வரவேற்கிறோம்!*\n\n"
            f"நீங்கள் பின்வரும் மாவட்டங்களுக்கு வெள்ள எச்சரிக்கைகளைப் பெற பதிவு செய்துள்ளீர்கள்:\n"
            f"{', '.join(districts)}\n\n"
            f"Reply *unsubscribe* to stop alerts.\n"
            f"Reply *status* to check your subscription.\n\n"
            f"frontend-iklxt07wf-thaaarus-projects.vercel.app ஐ பார்வையிடவும்"
        )
    else:
        message = (
            f"*Welcome to FloodWatch Sri Lanka!*\n\n"
            f"You are now subscribed to flood alerts for:\n"
            f"{', '.join(districts)}\n\n"
            f"Reply *unsubscribe* to stop alerts.\n"
            f"Reply *status* to check your subscription.\n\n"
            f"Visit frontend-iklxt07wf-thaaarus-projects.vercel.app for the full map"
        )

    phone_clean = phone.replace("+", "").replace(" ", "")
    result = await whatsapp_service.send_text_message(phone_clean, message)
    if result.get("success"):
        logger.info(f"Confirmation message sent to {phone}")
    else:
        logger.warning(f"Failed to send confirmation to {phone}: {result.get('error')}")


@router.post("/unsubscribe")
async def unsubscribe(request: UnsubscribeRequest, db: Session = Depends(get_db)):
    """Unsubscribe a phone number from flood alerts."""
    subscriber = db.query(Subscriber).filter(
        Subscriber.phone_number == request.phone_number
    ).first()

    if not subscriber:
        raise HTTPException(status_code=404, detail="Phone number not found")

    subscriber.active = False
    db.commit()

    logger.info(f"Unsubscribed {request.phone_number}")

    return {"message": "Successfully unsubscribed", "phone_number": request.phone_number}


@router.get("/subscribers/{phone_number}", response_model=SubscriberResponse)
async def get_subscriber(phone_number: str, db: Session = Depends(get_db)):
    """Get subscriber details by phone number."""
    subscriber = db.query(Subscriber).filter(
        Subscriber.phone_number == phone_number
    ).first()

    if not subscriber:
        raise HTTPException(status_code=404, detail="Subscriber not found")

    return subscriber


@router.put("/subscribers/{phone_number}", response_model=SubscriberResponse)
async def update_subscriber(
    phone_number: str,
    request: SubscriberCreate,
    db: Session = Depends(get_db)
):
    """Update subscriber preferences."""
    subscriber = db.query(Subscriber).filter(
        Subscriber.phone_number == phone_number
    ).first()

    if not subscriber:
        raise HTTPException(status_code=404, detail="Subscriber not found")

    # Validate districts
    for district in request.districts:
        if district not in VALID_DISTRICTS:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid district: {district}. Valid districts: {', '.join(sorted(VALID_DISTRICTS))}"
            )

    subscriber.districts = request.districts
    subscriber.language = request.language
    db.commit()
    db.refresh(subscriber)

    return subscriber
