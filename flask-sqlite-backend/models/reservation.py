from flask import current_app
from .base import db, ISTDateTime
from datetime import datetime
import pytz

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
