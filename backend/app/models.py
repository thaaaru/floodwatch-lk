from sqlalchemy import Column, Integer, String, Boolean, DECIMAL, TIMESTAMP, Text
from sqlalchemy.sql import func
import json
from .database import Base


class Subscriber(Base):
    __tablename__ = "subscribers"

    id = Column(Integer, primary_key=True, index=True)
    phone_number = Column(String(15), unique=True, nullable=False, index=True)
    _districts = Column("districts", Text, default='["Colombo"]')

    @property
    def districts(self):
        return json.loads(self._districts) if self._districts else ["Colombo"]

    @districts.setter
    def districts(self, value):
        self._districts = json.dumps(value) if value else '["Colombo"]'
    language = Column(String(10), default="en")
    channel = Column(String(10), default="whatsapp")  # whatsapp, sms
    whatsapp_opted_in = Column(Boolean, default=False)  # True when user sends first message
    active = Column(Boolean, default=True, index=True)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    updated_at = Column(TIMESTAMP, server_default=func.current_timestamp(), onupdate=func.current_timestamp())


class AlertHistory(Base):
    __tablename__ = "alert_history"

    id = Column(Integer, primary_key=True, index=True)
    district = Column(String(50), nullable=False, index=True)
    alert_level = Column(String(20), nullable=False)
    rainfall_mm = Column(DECIMAL(10, 2))
    source = Column(String(50))
    message = Column(Text)
    sent_at = Column(TIMESTAMP, server_default=func.current_timestamp(), index=True)


class WeatherLog(Base):
    __tablename__ = "weather_logs"

    id = Column(Integer, primary_key=True, index=True)
    district = Column(String(50), nullable=False, index=True)
    rainfall_mm = Column(DECIMAL(10, 2))
    temperature_c = Column(DECIMAL(5, 2))
    humidity_percent = Column(Integer)
    recorded_at = Column(TIMESTAMP, server_default=func.current_timestamp(), index=True)
