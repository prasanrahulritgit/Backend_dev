from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import TypeDecorator
import pytz
from datetime import datetime

db = SQLAlchemy()

class ISTDateTime(TypeDecorator):
    """Handles datetime conversion for Indian Standard Time (IST)"""
    impl = db.DateTime
    cache_ok = True

    def process_bind_param(self, value, dialect):
        """Convert to naive datetime for storage (assumes input is IST)"""
        if value is None:
            return None
        if isinstance(value, datetime):
            if value.tzinfo is not None:
                # Convert to IST and make naive
                ist = pytz.timezone('Asia/Kolkata')
                return value.astimezone(ist).replace(tzinfo=None)
            return value  # Assume naive datetime is already IST
        raise ValueError("Expected datetime object")

    def process_result_value(self, value, dialect):
        """Attach IST timezone when loading from DB"""
        if value is not None:
            return pytz.timezone('Asia/Kolkata').localize(value)
        return value