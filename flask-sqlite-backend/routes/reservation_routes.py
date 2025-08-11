from flask import Blueprint, abort, current_app, jsonify, render_template, redirect, url_for, flash, request
from flask_login import current_user, login_required
import pytz
from sqlalchemy import delete, exists
from models import DeviceUsage, Reservation, Device, User, db
from datetime import datetime, timezone

reservation_bp = Blueprint('reservation', __name__)



def run_cleanup():
    current_time = datetime.utcnow()  # Use UTC for consistency
    expired_reservations = Reservation.query.filter(Reservation.end_time < current_time).all()
    
    for reservation in expired_reservations:
        db.session.delete(reservation)
    
    db.session.commit()
    
    return f"Cleaned up {len(expired_reservations)} expired reservations"


def make_naive(utc_dt):
    """Convert timezone-aware datetime to naive (for SQLite storage)"""
    return utc_dt.replace(tzinfo=None) if utc_dt.tzinfo else utc_dt


@reservation_bp.route('/dashboard')
@login_required
def dashboard():
    # Delete ALL expired reservations (not just current user's)
    expired_count = Reservation.delete_expired()
    if expired_count > 0:
        current_app.logger.info(f"Deleted {expired_count} total expired reservations")

    # Get current time in IST for display purposes
    ist = pytz.timezone('Asia/Kolkata')
    now_ist = datetime.now(ist)
    
    # Get all devices and reservations
    devices = Device.query.all()
    
    # Get non-expired reservations only
    all_reservations = Reservation.query.filter(
        Reservation.end_time >= now_ist.replace(tzinfo=None)  # Compare with naive datetime
    ).order_by(Reservation.start_time).all()
    
    # Separate reservations
    user_reservations = [
        r for r in all_reservations 
        if r.user_id == current_user.id
    ]
    other_reservations = [
        r for r in all_reservations 
        if r.user_id != current_user.id
    ]
    
    # Determine which template to use
    template_name = 'devices.html' if current_user.role == 'admin' else 'reservation.html'
    
    return render_template(
        template_name,
        devices=devices,
        user_reservations=user_reservations,
        other_reservations=other_reservations,
        now=now_ist,  # Pass IST time to template
        current_user=current_user
    )

@reservation_bp.route('/reservations')
@login_required
def view_reservations():
    """Endpoint specifically for viewing reservations (for both admins and regular users)"""
    # Delete expired reservations
    expired_count = Reservation.delete_expired()
    if expired_count > 0:
        current_app.logger.info(f"Deleted {expired_count} expired reservations")

    # Get current time in IST
    ist = pytz.timezone('Asia/Kolkata')
    now_ist = datetime.now(ist)
    
    # Get all devices and reservations
    devices = Device.query.all()
    
    # Get non-expired reservations
    all_reservations = Reservation.query.filter(
        Reservation.end_time >= now_ist.replace(tzinfo=None)
    ).order_by(Reservation.start_time).all()
    
    # Separate reservations
    user_reservations = [
        r for r in all_reservations 
        if r.user_id == current_user.id
    ]
    other_reservations = [
        r for r in all_reservations 
        if r.user_id != current_user.id
    ]
    
    if(current_user.role == 'admin') :
        return render_template(
        'admin_reservation.html',
        devices=devices,
        user_reservations=user_reservations,
        other_reservations=other_reservations,
        now=now_ist,
        current_user=current_user,
        is_admin=(current_user.role == 'admin')
    ) 
    else :
        return render_template(
        'reservation.html',
        devices=devices,
        user_reservations=user_reservations,
        other_reservations=other_reservations,
        now=now_ist,
        current_user=current_user,
        is_admin=(current_user.role == 'admin')
    )

@reservation_bp.route('/api/booked-devices', methods=['GET'])
def get_booked_devices():
    """Get all currently booked devices with their reservation details"""
    try:
        ist = pytz.timezone('Asia/Kolkata')
        current_time_ist = datetime.now(ist)
        
        # Get query parameters for filtering
        show_expired = request.args.get('show_expired', 'false').lower() == 'true'
        show_upcoming = request.args.get('show_upcoming', 'true').lower() == 'true'
        show_active = request.args.get('show_active', 'true').lower() == 'true'
        
        # Base query
        query = Reservation.query.options(
            db.joinedload(Reservation.device),
            db.joinedload(Reservation.user)
        ).order_by(Reservation.start_time.asc())
        
        # Apply filters based on status
        status_filters = []
        if show_active:
            status_filters.append(
                (Reservation.start_time <= current_time_ist) &
                (Reservation.end_time >= current_time_ist)
            )
        if show_upcoming:
            status_filters.append(Reservation.start_time > current_time_ist)
        if show_expired:
            status_filters.append(Reservation.end_time < current_time_ist)
        
        if status_filters:
            query = query.filter(db.or_(*status_filters))
        
        reservations = query.all()
        
        # Format the response
        result = []
        for reservation in reservations:
            # Convert times to IST for display
            start_ist = reservation.start_time.astimezone(ist)
            end_ist = reservation.end_time.astimezone(ist)
            
            result.append({
                'reservation_id': reservation.id,
                'device_id': reservation.device_id,
                'device_name': getattr(reservation.device, 'name', None) or reservation.device_id,
                'user_id': reservation.user_id,
                'user_name': getattr(reservation.user, 'username', None) or f"User {reservation.user_id}",
                'ip_type': reservation.ip_type,
                'start_time': start_ist.isoformat(),
                'end_time': end_ist.isoformat(),
                'duration_minutes': int((end_ist - start_ist).total_seconds() / 60),
                'status': reservation.status,
                'can_cancel': reservation.can_cancel(current_user) if current_user.is_authenticated else False,
                'device_details': {
                    'pc_ip': getattr(reservation.device, 'PC_IP', None),
                    'ct1_ip': getattr(reservation.device, 'CT1_ip', None),
                    'ct2_ip': getattr(reservation.device, 'CT2_ip', None),
                    'ct3_ip': getattr(reservation.device, 'CT3_ip', None),
                    'pulse1_ip': getattr(reservation.device, 'Pulse1_Ip', None),
                    'pulse2_ip': getattr(reservation.device, 'Pulse2_ip', None),
                    'pulse3_ip': getattr(reservation.device, 'Pulse3_ip', None),
                    'rutomatrix_ip': getattr(reservation.device, 'Rutomatrix_ip', None)
                }
            })
        
        return jsonify({
            'success': True,
            'count': len(result),
            'booked_devices': result,
            'current_time': current_time_ist.isoformat(),
            'timezone': 'Asia/Kolkata',
            'filters': {
                'show_expired': show_expired,
                'show_upcoming': show_upcoming,
                'show_active': show_active
            }
        })
        
    except Exception as e:
        current_app.logger.error(f"Failed to fetch booked devices: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'message': 'Failed to fetch booked devices',
            'error': str(e)
        }), 500

@reservation_bp.route('/api/reservations', methods=['POST'])
@login_required
def make_reservation():
    try:
        # Get JSON data from request
        data = request.get_json()
        if not data:
            return jsonify({'status': 'error', 'message': 'No data provided'}), 400

        # 1. Clean up expired reservations
        expired_count = Reservation.delete_expired()
        if expired_count > 0:
            current_app.logger.info(f"Deleted {expired_count} expired reservations")

        # 2. Process new reservation
        ist = pytz.timezone('Asia/Kolkata')
        current_time = datetime.now(ist)
        
        device_id = data.get('device_id')
        ip_type = data.get('ip_type', '').lower()
        start_time_str = data.get('start_time')
        end_time_str = data.get('end_time')
        
        if not all([device_id, ip_type, start_time_str, end_time_str]):
            return jsonify({'status': 'error', 'message': 'Missing required fields'}), 400

        # Parse times (convert from UTC to IST)
        start_time_utc = datetime.fromisoformat(start_time_str.replace('Z', '+00:00'))
        end_time_utc = datetime.fromisoformat(end_time_str.replace('Z', '+00:00'))
        
        # Convert to IST
        start_time = start_time_utc.astimezone(ist)
        end_time = end_time_utc.astimezone(ist)

        # Validation
        if end_time <= start_time:
            return jsonify({'status': 'error', 'message': 'End time must be after start time'}), 400
            
        if start_time < current_time:
            return jsonify({'status': 'error', 'message': 'Start time cannot be in the past'}), 400

        # Check availability
        max_users = {
            'pc': 1,
            'rutomatrix': 1,
            'pulseview': 1,
            'ct': 1
        }.get(ip_type.split('-')[0].lower(), 1)

        conflicts = Reservation.query.filter(
            Reservation.device_id == device_id,
            Reservation.ip_type.ilike(f'%{ip_type}%'),
            Reservation.end_time >= current_time.replace(tzinfo=None),
            Reservation.start_time < end_time.replace(tzinfo=None),
            Reservation.end_time > start_time.replace(tzinfo=None)
        ).count()

        if conflicts >= max_users:
            return jsonify({
                'status': 'error',
                'message': f'Maximum {max_users} user(s) allowed for {ip_type}'
            }), 400

        # Create records
        reservation = Reservation(
            device_id=device_id,
            user_id=current_user.id,
            ip_type=ip_type,
            start_time=start_time.replace(tzinfo=None),  # Store as naive datetime
            end_time=end_time.replace(tzinfo=None)        # Store as naive datetime
        )
        
        # Automatically create DeviceUsage record
        usage_record = DeviceUsage(
            device_id=device_id,
            user_id=current_user.id,
            reservation_id=reservation.id,
            ip_type=ip_type,
            actual_start_time=start_time.replace(tzinfo=None),
            actual_end_time=end_time.replace(tzinfo=None),
            status='completed',
            ip_address=request.remote_addr
        )

        db.session.add(reservation)
        db.session.add(usage_record)
        db.session.commit()

        return jsonify({
            'status': 'success',
            'message': 'Booking successful!',
            'reservation_id': reservation.id
        })

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Booking error: {str(e)}", exc_info=True)
        return jsonify({
            'status': 'error',
            'message': 'Booking failed',
            'error': str(e)
        }), 500
    

'''@reservation_bp.route('/reservation/cancel/<int:reservation_id>', methods=['POST'])
@login_required
def cancel_reservation(reservation_id):
    reservation = Reservation.query.get_or_404(reservation_id)

    try:
        db.session.delete(reservation)
        db.session.commit()
        return jsonify({
            'status': 'success',
            'message': 'Reservation cancelled successfully'
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500'''
    

@reservation_bp.route('/reservation/cancel/<int:reservation_id>', methods=['POST'])
@login_required
def cancel_reservation(reservation_id):
    reservation = Reservation.query.get_or_404(reservation_id)
    
    if reservation.user_id != current_user.id and not current_user.is_admin:
        return jsonify({'status': 'error', 'message': 'Unauthorized'}), 403

    try:
        # Create usage record before deletion
        usage_record = DeviceUsage(
            device_id=reservation.device_id,
            user_id=reservation.user_id,
            reservation_id=reservation.id,
            ip_type=reservation.ip_type,
            actual_start_time=reservation.start_time,
            actual_end_time=datetime.now(),
            status='cancelled',
            ip_address=request.remote_addr
        )
        db.session.add(usage_record)
        
        # Delete the reservation
        db.session.delete(reservation)
        db.session.commit()
        
        return jsonify({
            'status': 'success',
            'message': 'Reservation cancelled successfully'
        })
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Cancellation failed: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': 'Failed to cancel reservation'
        }), 500

@reservation_bp.route('/api/user-reservations', methods=['GET'])
@login_required
def get_user_reservations():
    """Get all reservations with user details and IP information"""
    try:
        # Get query parameters
        show_expired = request.args.get('show_expired', 'false').lower() == 'true'
        device_id = request.args.get('device_id', None)
        user_id = request.args.get('user_id', None)
        
        # Get current time in IST
        ist = pytz.timezone('Asia/Kolkata')
        current_time = datetime.now(ist)
        
        # Base query with joins
        query = db.session.query(
            Reservation,
            User,
            Device
        ).join(
            User, Reservation.user_id == User.id
        ).join(
            Device, Reservation.device_id == Device.device_id
        ).order_by(
            Reservation.start_time.asc()
        )
        
        # Apply filters
        if not show_expired:
            query = query.filter(Reservation.end_time >= current_time)
            
        if device_id:
            query = query.filter(Reservation.device_id == device_id)
            
        if user_id:
            query = query.filter(Reservation.user_id == user_id)
        
        # Execute query
        results = query.all()
        
        # Format response
        reservations = []
        for reservation, user, device in results:
            # Get device IP based on reservation type
            ip_mapping = {
                'pc': device.PC_IP,
                'rutomatrix': device.Rutomatrix_ip,
                'pulse1': device.Pulse1_Ip,
                'pulse2': device.Pulse2_ip,
                'pulse3': device.Pulse3_ip,
                'ct1': device.CT1_ip,
                'ct2': device.CT2_ip,
                'ct3': device.CT3_ip
            }
            
            # Determine which IP to use based on reservation type
            ip_type = reservation.ip_type.lower()
            device_ip = None
            
            if 'pc' in ip_type:
                device_ip = ip_mapping['pc']
            elif 'rutomatrix' in ip_type:
                device_ip = ip_mapping['rutomatrix']
            elif 'pulse1' in ip_type:
                device_ip = ip_mapping['pulse1']
            elif 'pulse2' in ip_type:
                device_ip = ip_mapping['pulse2']
            elif 'pulse3' in ip_type:
                device_ip = ip_mapping['pulse3']
            elif 'ct1' in ip_type:
                device_ip = ip_mapping['ct1']
            elif 'ct2' in ip_type:
                device_ip = ip_mapping['ct2']
            elif 'ct3' in ip_type:
                device_ip = ip_mapping['ct3']
            
            reservations.append({
                'reservation_id': reservation.id,
                'device_id': reservation.device_id,
                'device_name': device.device_id,  # Assuming device_id is the name
                'user_id': user.id,
                'username': user.user_name,
                'user_ip': user.user_ip,
                'device_ip': device_ip,
                'ip_type': reservation.ip_type,
                'start_time': reservation.start_time.astimezone(ist).isoformat(),
                'end_time': reservation.end_time.astimezone(ist).isoformat(),
                'status': reservation.status,
                'is_active': reservation.status == 'active',
                'can_manage': current_user.role == 'admin' or user.id == current_user.id
            })
        
        return jsonify({
            'success': True,
            'count': len(reservations),
            'reservations': reservations,
            'current_time': current_time.isoformat(),
            'filters': {
                'show_expired': show_expired,
                'device_id': device_id,
                'user_id': user_id
            }
        })
        
    except Exception as e:
        current_app.logger.error(f"Failed to fetch user reservations: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'message': 'Failed to fetch reservations',
            'error': str(e)
        }), 500
    

@reservation_bp.route('/api/user-reservations/<int:user_id>', methods=['GET'])
@login_required
def get_user_reservation_details(user_id):
    """Get all reservation details for a specific user"""
    try:
        # Verify the requesting user has permission
        

        # Get the user
        user = User.query.get_or_404(user_id)

        # Get current time in IST
        ist = pytz.timezone('Asia/Kolkata')
        current_time = datetime.now(ist)

        # Get all reservations for this user with device details
        reservations = db.session.query(
            Reservation,
            Device
        ).join(
            Device, Reservation.device_id == Device.device_id
        ).filter(
            Reservation.user_id == user_id
        ).order_by(
            Reservation.start_time.desc()
        ).all()

        # Format the response
        result = {
            'user_id': user.id,
            'username': user.user_name,
            'user_ip': user.user_ip,
            'role': user.role,
            'reservations': []
        }

        for reservation, device in reservations:
            # Determine which device IP to include based on reservation type
            ip_type = reservation.ip_type.lower()
            device_ip = None

            if 'pc' in ip_type:
                device_ip = device.PC_IP
            elif 'rutomatrix' in ip_type:
                device_ip = device.Rutomatrix_ip
            elif 'pulse1' in ip_type:
                device_ip = device.Pulse1_Ip
            elif 'pulse2' in ip_type:
                device_ip = device.Pulse2_ip
            elif 'pulse3' in ip_type:
                device_ip = device.Pulse3_ip
            elif 'ct1' in ip_type:
                device_ip = device.CT1_ip
            elif 'ct2' in ip_type:
                device_ip = device.CT2_ip
            elif 'ct3' in ip_type:
                device_ip = device.CT3_ip

            result['reservations'].append({
                'reservation_id': reservation.id,
                'device_id': device.device_id,
                'device_name': device.device_id,  # Assuming device_id is the name
                'ip_type': reservation.ip_type,
                'device_ip': device_ip,
                'start_time': reservation.start_time.astimezone(ist).isoformat(),
                'end_time': reservation.end_time.astimezone(ist).isoformat(),
                'status': reservation.status,
                'is_active': reservation.status == 'active',
                'duration_minutes': int((reservation.end_time - reservation.start_time).total_seconds() / 60)
            })

        return jsonify({
            'success': True,
            'data': result,
            'current_time': current_time.isoformat()
        })

    except Exception as e:
        current_app.logger.error(f"Failed to fetch user reservations: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'message': 'Failed to fetch user reservations',
            'error': str(e)
        }), 500
    
@reservation_bp.route('/api/user-reservations/<int:user_id>/time-filter', methods=['GET'])
@login_required
def get_user_reservations_with_time(user_id):
    """Get reservation details for a specific user with time filtering"""
    try:
        # Verify permissions
        if current_user.role != 'admin' and current_user.id != user_id:
            return jsonify({
                'success': False,
                'message': 'Unauthorized: You can only view your own reservations'
            }), 403

        # Get query parameters for time filtering
        start_time_str = request.args.get('start_time')
        end_time_str = request.args.get('end_time')
        timezone = request.args.get('timezone', 'Asia/Kolkata')
        
        # Get timezone object
        try:
            tz = pytz.timezone(timezone)
        except pytz.exceptions.UnknownTimeZoneError:
            return jsonify({
                'success': False,
                'message': f'Invalid timezone: {timezone}'
            }), 400

        # Parse time parameters
        current_time = datetime.now(tz)
        
        try:
            start_time = datetime.strptime(start_time_str, '%Y-%m-%dT%H:%M').replace(tzinfo=tz) if start_time_str else None
            end_time = datetime.strptime(end_time_str, '%Y-%m-%dT%H:%M').replace(tzinfo=tz) if end_time_str else None
        except ValueError:
            return jsonify({
                'success': False,
                'message': 'Invalid time format. Use YYYY-MM-DDTHH:MM'
            }), 400

        # Get user details
        user = User.query.get_or_404(user_id)

        # Base query
        query = db.session.query(Reservation, Device)\
            .join(Device, Reservation.device_id == Device.device_id)\
            .filter(Reservation.user_id == user_id)

        # Apply time filters
        if start_time:
            query = query.filter(Reservation.end_time >= start_time.astimezone(pytz.UTC).replace(tzinfo=None))
        if end_time:
            query = query.filter(Reservation.start_time <= end_time.astimezone(pytz.UTC).replace(tzinfo=None))

        # Execute query
        reservations = query.order_by(Reservation.start_time.desc()).all()

        # Format response
        result = {
            'user_id': user.id,
            'username': user.user_name,
            'user_ip': user.user_ip,
            'timezone': timezone,
            'current_time': current_time.isoformat(),
            'filters': {
                'start_time': start_time.isoformat() if start_time else None,
                'end_time': end_time.isoformat() if end_time else None
            },
            'reservations': []
        }

        for reservation, device in reservations:
            # Get device IP based on reservation type
            ip_mapping = {
                'pc': device.PC_IP,
                'rutomatrix': device.Rutomatrix_ip,
                'pulse1': device.Pulse1_Ip,
                'pulse2': device.Pulse2_ip,
                'pulse3': device.Pulse3_ip,
                'ct1': device.CT1_ip,
                'ct2': device.CT2_ip,
                'ct3': device.CT3_ip
            }
            
            ip_type = reservation.ip_type.lower()
            device_ip = next(
                (ip_mapping[key] for key in ip_mapping if key in ip_type),
                None
            )

            # Convert times to requested timezone
            start_local = reservation.start_time.replace(tzinfo=pytz.UTC).astimezone(tz)
            end_local = reservation.end_time.replace(tzinfo=pytz.UTC).astimezone(tz)

            result['reservations'].append({
                'reservation_id': reservation.id,
                'device_id': device.device_id,
                'device_name': device.device_id,
                'ip_type': reservation.ip_type,
                'device_ip': device_ip,
                'start_time': start_local.isoformat(),
                'end_time': end_local.isoformat(),
                'duration_minutes': int((end_local - start_local).total_seconds() / 60),
                'status': reservation.status,
                'is_active': (
                    start_local <= current_time <= end_local
                    if (start_time is None and end_time is None)
                    else None
                )
            })

        return jsonify({
            'success': True,
            'data': result
        })

    except Exception as e:
        current_app.logger.error(f"Error fetching reservations: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'message': 'Failed to fetch reservations',
            'error': str(e)
        }), 500
