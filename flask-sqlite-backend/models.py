from flask import app, current_app
from flask_sqlalchemy import SQLAlchemy
import re
from datetime import datetime, timezone
from werkzeug.security import generate_password_hash, check_password_hash
from sqlalchemy import TypeDecorator
import pytz


db = SQLAlchemy()

def validate_ip(ip):
    """Improved IPv4 validation"""
    if not ip:  # Allow empty values
        return True
    pattern = r'^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$'
    return re.match(pattern, ip) is not None

class Device(db.Model):
    __tablename__ = 'devices'
    
    device_id = db.Column(db.String(50), primary_key=True)
    PC_IP = db.Column(db.String(15))
    Rutomatrix_ip = db.Column(db.String(15))
    Pulse1_Ip = db.Column(db.String(15))
    Pulse2_ip = db.Column(db.String(15))
    Pulse3_ip = db.Column(db.String(15))
    CT1_ip = db.Column(db.String(15))
    CT2_ip = db.Column(db.String(15))
    CT3_ip = db.Column(db.String(15))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    
    def __init__(self, **kwargs):
        super(Device, self).__init__(**kwargs)
        self.validate_ips()
    
    def validate_ips(self):
        ip_fields = [
            'PC_IP', 'Rutomatrix_ip', 
            'Pulse1_Ip', 'Pulse2_ip', 'Pulse3_ip',
            'CT1_ip', 'CT2_ip', 'CT3_ip'
        ]
        for field in ip_fields:
            ip = getattr(self, field)
            if ip and not self.validate_ip(ip):
                raise ValueError(f"Invalid IP format in {field}")
    
    @staticmethod
    def validate_ip(ip):
        """Validate IPv4 address format"""
        parts = ip.split('.')
        if len(parts) != 4:
            return False
        try:
            return all(0 <= int(part) <= 255 for part in parts)
        except ValueError:
            return False
        
    def to_dict(self):
        return {
            'device_id': self.device_id,
            'PC_IP': self.PC_IP,
            'Rutomatrix_ip': self.Rutomatrix_ip,
            'Pulse1_Ip': self.Pulse1_Ip,
            'Pulse2_ip': self.Pulse2_ip,
            'Pulse3_ip': self.Pulse3_ip,
            'CT1_ip': self.CT1_ip,
            'CT2_ip': self.CT2_ip,
            'CT3_ip': self.CT3_ip,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
    
    def __repr__(self):
        return f"<Device {self.device_id}>"
    


class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    user_name = db.Column(db.String(80), unique=True, nullable=False)
    is_admin = db.Column(db.Boolean, default=False)
    user_ip = db.Column(db.String(15))
    password_hash = db.Column(db.String(128), nullable=False)  # NOT 'password'
    role = db.Column(db.String(20), default='user')
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_login = db.Column(db.DateTime)
    
    # Password hashing methods
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
    
    # For Flask-Login integration
    @property
    def is_authenticated(self):
        return True
    
    @property
    def is_anonymous(self):
        return False
    
    def get_id(self):
        return str(self.id)
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_name': self.user_name,
            'user_ip': self.user_ip,
            'role': self.role,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
    
    def __repr__(self):
        return f'<User {self.user_name}>'
    
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

class Reservation(db.Model):
    __tablename__ = 'reservations'
    
    id = db.Column(db.Integer, primary_key=True)
    device_id = db.Column(db.String(50), db.ForeignKey('devices.device_id'))
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    ip_type = db.Column(db.String(20))
    start_time = db.Column(ISTDateTime(), nullable=False)
    end_time = db.Column(ISTDateTime(), nullable=False)
    
    device = db.relationship('Device', backref='reservations')
    user = db.relationship('User', backref='reservations')

    def __init__(self, **kwargs):
        """Ensure all datetimes are in IST"""
        ist = pytz.timezone('Asia/Kolkata')
        
        for time_field in ['start_time', 'end_time']:
            if time_field in kwargs:
                if isinstance(kwargs[time_field], str):
                    # Parse string as IST
                    naive_dt = datetime.strptime(kwargs[time_field], '%Y-%m-%dT%H:%M')
                    kwargs[time_field] = ist.localize(naive_dt)
                elif kwargs[time_field].tzinfo is None:
                    # Assume naive is IST
                    kwargs[time_field] = ist.localize(kwargs[time_field])
                else:
                    # Convert to IST
                    kwargs[time_field] = kwargs[time_field].astimezone(ist)
        
        super().__init__(**kwargs)

    @classmethod
    def delete_expired(cls):
        """Delete all expired reservations immediately"""
        try:
            ist = pytz.timezone('Asia/Kolkata')
            current_time = datetime.now(ist)
            
            # Direct SQL delete for efficiency
            result = db.session.execute(
                db.delete(cls)
                .where(cls.end_time < current_time)
            )
            db.session.commit()
            return result.rowcount
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Failed to delete expired: {str(e)}")
            return 0

    @property
    def status(self):
        """Determine status based on current IST"""
        ist = pytz.timezone('Asia/Kolkata')
        now = datetime.now(ist)
        
        if self.end_time < now:
            return 'expired'
        elif self.start_time <= now <= self.end_time:
            return 'active'
        return 'upcoming'

    def can_cancel(self, user):
        """Check if user can cancel this reservation"""
        return self.user_id == user.id and self.status == 'upcoming'

    def __repr__(self):
        return f'<Reservation {self.id} for device {self.device_id}>'
    
    
    
class DeviceUsage(db.Model):
    __tablename__ = 'device_usage_history'
    
    id = db.Column(db.Integer, primary_key=True)
    device_id = db.Column(db.String(50), db.ForeignKey('devices.device_id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    reservation_id = db.Column(db.Integer, db.ForeignKey('reservations.id'), nullable=True)  # Link to original reservation if available
    user = db.relationship('User', backref='device_usage', lazy='joined')
    device = db.relationship('Device', backref='usage_history', lazy='joined')
    reservation = db.relationship('Reservation', backref='usage_records', lazy='joined')
    
    # Actual usage times (may differ from reservation times)
    actual_start_time = db.Column(ISTDateTime(), nullable=False)
    actual_end_time = db.Column(ISTDateTime(), nullable=True)  # Null means device is currently in use
    
    # Additional usage details
    ip_address = db.Column(db.String(45))  # IPv4 or IPv6
    ip_type = db.Column(db.String(20))  
    status = db.Column(db.String(20))  
    termination_reason = db.Column(db.String(100), nullable=True)  # If ended early
    
    # Relationships
    device = db.relationship('Device', backref='usage_history')
    user = db.relationship('User', backref='device_usage')
    reservation = db.relationship('Reservation', backref='usage_records')

    def __init__(self, **kwargs):
        """Ensure all datetimes are in IST"""
        ist = pytz.timezone('Asia/Kolkata')
        
        for time_field in ['actual_start_time', 'actual_end_time']:
            if time_field in kwargs and kwargs[time_field] is not None:
                if isinstance(kwargs[time_field], str):
                    # Parse string as IST
                    naive_dt = datetime.strptime(kwargs[time_field], '%Y-%m-%dT%H:%M')
                    kwargs[time_field] = ist.localize(naive_dt)
                elif kwargs[time_field].tzinfo is None:
                    # Assume naive is IST
                    kwargs[time_field] = ist.localize(kwargs[time_field])
                else:
                    # Convert to IST
                    kwargs[time_field] = kwargs[time_field].astimezone(ist)
        
        super().__init__(**kwargs)

    @property
    def duration(self):
        """Calculate duration in seconds"""
        if self.actual_end_time:
            return (self.actual_end_time - self.actual_start_time).total_seconds()
        return None

    '''@classmethod
    def close_active_sessions(cls, device_id=None, user_id=None):
        """Mark all active sessions as completed"""
        try:
            ist = pytz.timezone('Asia/Kolkata')
            current_time = datetime.now(ist)
            
            query = db.update(cls)\
                .where(cls.actual_end_time.is_(None))\
                .values(actual_end_time=current_time, status='completed')
            
            if device_id:
                query = query.where(cls.device_id == device_id)
            if user_id:
                query = query.where(cls.user_id == user_id)
                
            result = db.session.execute(query)
            db.session.commit()
            return result.rowcount
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Failed to close active sessions: {str(e)}")
            return 0'''
    

    @classmethod
    def get_active_sessions(cls, device_id=None, user_id=None):
        query = cls.query.filter(cls.actual_end_time.is_(None))
    
        if device_id:
            query = query.filter(cls.device_id == device_id)
        if user_id:
            query = query.filter(cls.user_id == user_id)
        
        return query.all()
    
    @classmethod
    def terminate_active_sessions(cls, device_id=None, user_id=None, reason=None):
        try:
            ist = pytz.timezone('Asia/Kolkata')
            current_time = datetime.now(ist)
        
            query = db.update(cls)\
                .where(cls.actual_end_time.is_(None))\
             .values(
                actual_end_time=current_time,
                status='terminated',
                termination_reason=reason or 'System terminated'
                 )
        
            if device_id:
                 query = query.where(cls.device_id == device_id)
            if user_id:
                query = query.where(cls.user_id == user_id)
            
            result = db.session.execute(query)
            db.session.commit()
            return result.rowcount
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Failed to terminate active sessions: {str(e)}")
            return 0



    def __repr__(self):
        return f'<DeviceUsage {self.id} - Device {self.device_id} by User {self.user_id}>'