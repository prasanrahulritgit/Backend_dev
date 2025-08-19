from flask import current_app
from .base import db, ISTDateTime
from datetime import datetime
import pytz

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