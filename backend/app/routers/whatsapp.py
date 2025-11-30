"""
WhatsApp API Router (Twilio)
Handles webhooks, incoming messages, and subscriptions via Twilio WhatsApp
"""
from fastapi import APIRouter, Query, Request, HTTPException, Depends, Form
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
import logging

from ..config import get_settings
from ..database import get_db
from ..models import Subscriber
from ..services.whatsapp_service import whatsapp_service

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter(prefix="/api/whatsapp", tags=["whatsapp"])


# Request/Response models
class WhatsAppSubscribeRequest(BaseModel):
    phone_number: str
    districts: list[str]
    language: str = "en"


class WhatsAppTestRequest(BaseModel):
    phone_number: str
    message: str


# ============================================================
# Twilio Webhook Endpoint
# ============================================================

@router.post("/webhook")
async def handle_twilio_webhook(
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Webhook handler for incoming WhatsApp messages via Twilio.

    Twilio sends form data with:
    - From: whatsapp:+XXXXXXXXXXX
    - To: whatsapp:+XXXXXXXXXXX
    - Body: message text
    - MessageSid: unique message ID

    Users can text commands like:
    - "subscribe colombo" - Subscribe to Colombo alerts
    - "subscribe colombo, gampaha" - Subscribe to multiple districts
    - "unsubscribe" - Unsubscribe from all alerts
    - "status" - Check subscription status
    - "help" - Get help message
    """
    try:
        # Parse form data from Twilio
        form_data = await request.form()

        from_phone = form_data.get("From", "")
        body = form_data.get("Body", "")
        message_sid = form_data.get("MessageSid", "")

        logger.info(f"WhatsApp webhook received: From={from_phone}, Body={body[:50]}, SID={message_sid}")

        # Extract phone number (remove whatsapp: prefix)
        phone = from_phone.replace("whatsapp:", "").replace("+", "").strip()
        text = body.strip().lower()

        if not phone or not text:
            # Return empty TwiML response
            return PlainTextResponse(
                content='<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
                media_type="application/xml"
            )

        # Process command
        response = await process_command(phone, text, db)

        # Send response via Twilio
        if response:
            await whatsapp_service.send_text_message(phone, response)

        # Return empty TwiML response (we send reply separately)
        return PlainTextResponse(
            content='<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
            media_type="application/xml"
        )

    except Exception as e:
        logger.error(f"Error processing webhook: {e}")
        return PlainTextResponse(
            content='<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
            media_type="application/xml"
        )


async def process_command(phone: str, text: str, db: Session) -> str:
    """Process user command and return response"""

    # Normalize phone (ensure it doesn't have extra characters)
    phone = phone.replace("+", "").replace(" ", "").replace("-", "")

    if text.startswith("subscribe"):
        return await handle_subscribe(phone, text, db)
    elif text == "unsubscribe" or text == "stop":
        return await handle_unsubscribe(phone, db)
    elif text == "status":
        return await handle_status(phone, db)
    elif text == "help" or text == "?":
        return get_help_message()
    elif text == "hi" or text == "hello":
        return get_welcome_message()
    else:
        # Default: show help
        return get_help_message()


async def handle_subscribe(phone: str, text: str, db: Session) -> str:
    """Handle subscribe command"""
    # Parse districts from command: "subscribe colombo, gampaha"
    parts = text.replace("subscribe", "").strip()

    if not parts:
        return (
            "Please specify districts to subscribe to.\n\n"
            "Example: *subscribe Colombo, Gampaha*\n\n"
            "Available districts: Colombo, Gampaha, Kalutara, Kandy, Matale, "
            "Nuwara Eliya, Galle, Matara, Hambantota, Jaffna, Kilinochchi, "
            "Mannar, Vavuniya, Mullaitivu, Batticaloa, Ampara, Trincomalee, "
            "Kurunegala, Puttalam, Anuradhapura, Polonnaruwa, Badulla, "
            "Monaragala, Ratnapura, Kegalle"
        )

    # Parse comma-separated districts
    districts = [d.strip().title() for d in parts.split(",")]

    # Validate districts
    valid_districts = {
        "Colombo", "Gampaha", "Kalutara", "Kandy", "Matale", "Nuwara Eliya",
        "Galle", "Matara", "Hambantota", "Jaffna", "Kilinochchi", "Mannar",
        "Vavuniya", "Mullaitivu", "Batticaloa", "Ampara", "Trincomalee",
        "Kurunegala", "Puttalam", "Anuradhapura", "Polonnaruwa", "Badulla",
        "Monaragala", "Ratnapura", "Kegalle"
    }

    invalid = [d for d in districts if d not in valid_districts]
    if invalid:
        return f"Invalid districts: {', '.join(invalid)}\n\nPlease use valid Sri Lankan district names."

    # Find or create subscriber
    subscriber = db.query(Subscriber).filter(Subscriber.phone_number == phone).first()

    if subscriber:
        subscriber.districts = districts
        subscriber.active = True
        subscriber.whatsapp_opted_in = True
        subscriber.channel = "whatsapp"
    else:
        subscriber = Subscriber(
            phone_number=phone,
            channel="whatsapp",
            whatsapp_opted_in=True,
            active=True,
        )
        subscriber.districts = districts
        db.add(subscriber)

    db.commit()

    return (
        f"*Subscribed successfully!*\n\n"
        f"You will receive flood alerts for:\n"
        f"{', '.join(districts)}\n\n"
        f"Reply *unsubscribe* to stop alerts.\n"
        f"Reply *status* to check your subscription."
    )


async def handle_unsubscribe(phone: str, db: Session) -> str:
    """Handle unsubscribe command"""
    subscriber = db.query(Subscriber).filter(Subscriber.phone_number == phone).first()

    if subscriber:
        subscriber.active = False
        db.commit()
        return "You have been unsubscribed from flood alerts.\n\nReply *subscribe [districts]* to re-subscribe."
    else:
        return "You are not currently subscribed to any alerts."


async def handle_status(phone: str, db: Session) -> str:
    """Handle status command"""
    subscriber = db.query(Subscriber).filter(Subscriber.phone_number == phone).first()

    if subscriber and subscriber.active:
        districts = subscriber.districts
        return (
            f"*Your Subscription Status*\n\n"
            f"Status: Active\n"
            f"Districts: {', '.join(districts)}\n"
            f"Language: {subscriber.language}\n\n"
            f"Reply *unsubscribe* to stop alerts."
        )
    else:
        return (
            "You are not currently subscribed.\n\n"
            "Reply *subscribe [districts]* to start receiving alerts.\n"
            "Example: *subscribe Colombo, Gampaha*"
        )


def get_help_message() -> str:
    """Return help message"""
    return (
        "*FloodWatch Sri Lanka*\n\n"
        "Get real-time flood alerts for your district.\n\n"
        "*Commands:*\n"
        "- *subscribe [districts]* - Subscribe to alerts\n"
        "  Example: subscribe Colombo, Gampaha\n\n"
        "- *unsubscribe* - Stop receiving alerts\n\n"
        "- *status* - Check your subscription\n\n"
        "- *help* - Show this message\n\n"
        "Visit frontend-iklxt07wf-thaaarus-projects.vercel.app for the full map"
    )


def get_welcome_message() -> str:
    """Return welcome message"""
    return (
        "Welcome to *FloodWatch Sri Lanka*!\n\n"
        "I can help you stay informed about flood conditions in your area.\n\n"
        "To get started, subscribe to alerts for your district:\n"
        "*subscribe Colombo*\n\n"
        "Or reply *help* for more options."
    )


# ============================================================
# Management Endpoints
# ============================================================

@router.post("/subscribe")
async def api_subscribe(
    request: WhatsAppSubscribeRequest,
    db: Session = Depends(get_db),
):
    """
    Subscribe a phone number to WhatsApp alerts via API.

    Note: User must first message the WhatsApp number to opt-in
    before they can receive messages (WhatsApp/Twilio policy).
    """
    phone = request.phone_number.replace("+", "").replace(" ", "")

    subscriber = db.query(Subscriber).filter(Subscriber.phone_number == phone).first()

    if subscriber:
        subscriber.districts = request.districts
        subscriber.language = request.language
        subscriber.channel = "whatsapp"
        subscriber.active = True
    else:
        subscriber = Subscriber(
            phone_number=phone,
            language=request.language,
            channel="whatsapp",
            active=True,
        )
        subscriber.districts = request.districts
        db.add(subscriber)

    db.commit()
    db.refresh(subscriber)

    # Send confirmation message via WhatsApp
    message_sent = False
    if whatsapp_service.is_configured():
        confirmation_message = (
            f"*Successfully subscribed to FloodWatch!*\n\n"
            f"You will receive flood alerts for:\n"
            f"{', '.join(request.districts)}\n\n"
            f"Reply *unsubscribe* to stop alerts.\n"
            f"Reply *status* to check your subscription.\n\n"
            f"Visit frontend-iklxt07wf-thaaarus-projects.vercel.app for the full map."
        )
        result = await whatsapp_service.send_text_message(phone, confirmation_message)
        message_sent = result.get("success", False)

    return {
        "success": True,
        "message": "Subscribed successfully",
        "subscriber": {
            "phone_number": subscriber.phone_number,
            "districts": subscriber.districts,
            "language": subscriber.language,
            "whatsapp_opted_in": subscriber.whatsapp_opted_in,
        },
        "confirmation_sent": message_sent,
        "note": "User must first message the WhatsApp number to opt-in before receiving alerts." if not message_sent else "Confirmation message sent via WhatsApp."
    }


@router.post("/test")
async def send_test_message(request: WhatsAppTestRequest):
    """
    Send a test message to verify WhatsApp integration.

    Requires Twilio credentials and WhatsApp number to be configured.
    """
    if not whatsapp_service.is_configured():
        raise HTTPException(
            status_code=503,
            detail="WhatsApp not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_WHATSAPP_NUMBER."
        )

    result = await whatsapp_service.send_text_message(
        to_phone=request.phone_number,
        message=request.message,
    )

    if result.get("success"):
        return {"success": True, "message_id": result.get("message_id")}
    else:
        raise HTTPException(status_code=500, detail=result.get("error"))


@router.get("/status")
async def get_whatsapp_status(db: Session = Depends(get_db)):
    """
    Get WhatsApp service status and subscriber stats.
    """
    # Use raw SQL to handle missing columns gracefully
    from sqlalchemy import text
    try:
        # Try new schema with channel column
        result = db.execute(text("SELECT COUNT(*) FROM subscribers WHERE channel = 'whatsapp' AND active = 1"))
        total_subscribers = result.scalar() or 0

        result = db.execute(text("SELECT COUNT(*) FROM subscribers WHERE channel = 'whatsapp' AND whatsapp_opted_in = 1 AND active = 1"))
        opted_in = result.scalar() or 0
    except Exception:
        # Fall back to counting all active subscribers (old schema)
        try:
            result = db.execute(text("SELECT COUNT(*) FROM subscribers WHERE active = 1"))
            total_subscribers = result.scalar() or 0
        except Exception:
            total_subscribers = 0
        opted_in = 0

    return {
        "configured": whatsapp_service.is_configured(),
        "twilio_whatsapp_number": settings.twilio_whatsapp_number or "Not set",
        "subscribers": {
            "total": total_subscribers,
            "opted_in": opted_in,
        },
        "recent_messages": whatsapp_service.get_message_log()[-10:],
    }


@router.post("/broadcast")
async def broadcast_alert(
    district: str = Query(..., description="District to broadcast to"),
    alert_level: str = Query(..., description="Alert level: GREEN, YELLOW, ORANGE, RED"),
    rainfall_mm: float = Query(..., description="Rainfall in mm"),
    db: Session = Depends(get_db),
):
    """
    Broadcast flood alert to all opted-in subscribers for a district.

    Only sends to users who have:
    1. Subscribed to the specified district
    2. Opted-in via WhatsApp (sent first message)
    3. Have active subscription
    """
    if not whatsapp_service.is_configured():
        raise HTTPException(
            status_code=503,
            detail="WhatsApp not configured"
        )

    # Get subscribers for this district who are opted-in
    subscribers = db.query(Subscriber).filter(
        Subscriber.channel == "whatsapp",
        Subscriber.whatsapp_opted_in == True,
        Subscriber.active == True,
    ).all()

    # Filter by district (stored as JSON array)
    eligible = []
    for sub in subscribers:
        if district in sub.districts:
            eligible.append({
                "phone_number": sub.phone_number,
                "language": sub.language,
            })

    if not eligible:
        return {
            "success": True,
            "message": f"No opted-in subscribers for {district}",
            "sent": 0,
        }

    # Send bulk alerts
    result = await whatsapp_service.send_bulk_alerts(
        subscribers=eligible,
        district=district,
        alert_level=alert_level,
        rainfall_mm=rainfall_mm,
    )

    return {
        "success": True,
        "district": district,
        "alert_level": alert_level,
        **result,
    }
