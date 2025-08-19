from .base import db, ISTDateTime
from datetime import datetime
import re

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
    