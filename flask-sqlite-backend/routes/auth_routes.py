from datetime import datetime
from flask import Blueprint, render_template, redirect, url_for, flash, request, jsonify
from flask_login import login_user, logout_user, login_required
from models import User, db
from werkzeug.security import check_password_hash, generate_password_hash
from forms import LoginForm
from flask_wtf.csrf import generate_csrf

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/get-csrf', methods=['GET'])
def get_csrf():
    return jsonify({
        'success': True,
        'csrf_token': generate_csrf(),
        'csrf_header_name': 'X-CSRFToken'
    })

@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    form = LoginForm()
    
    if form.validate_on_submit():
        username = form.username.data
        password = form.password.data
        
        user = User.query.filter_by(user_name=username).first()
        
        if user and check_password_hash(user.password_hash, password):
            login_user(user)
            
            # Check if request wants JSON response (from React)
            if request.is_json:
                return jsonify({
                    'success': True,
<<<<<<< HEAD
                    #'message': 'Logged in successfully!',
=======
                    'message': 'Logged in successfully!',
>>>>>>> d807b41 (changes made in User)
                    'redirect': 'http://127.0.0.1:5000/reservations'  # Explicit Flask URL
                })
            
            flash('Logged in successfully!', 'success')
            next_page = request.args.get('next')
            return redirect(next_page or 'http://127.0.0.1:5000/reservations')  # Explicit redirect
        
        # Authentication failed
        if request.is_json:
            return jsonify({
                'success': False,
                'message': 'Invalid username or password'
            }), 401
            
        flash('Invalid username or password', 'danger')
    
    # For API requests, return JSON
    if request.is_json:
        return jsonify({'form_errors': form.errors}), 400
    
    # For regular web requests, render HTML
    return render_template('login.html', form=form)

@auth_bp.route('/logout')
@login_required
def logout():
    logout_user()
    flash('You have been logged out.', 'info')
    return redirect(url_for('auth.login'))

@auth_bp.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        ip_address = request.form.get('ip_address')
        
        if User.query.filter_by(user_name=username).first():
            flash('Username already exists', 'danger')
            return redirect(url_for('auth.register'))
        
        new_user = User(
            user_name=username,
            user_ip=ip_address,
            password_hash=generate_password_hash(password),
            role='user',
            created_at=datetime.utcnow()
        )
        
        db.session.add(new_user)
        db.session.commit()
        flash('Registration successful! Please login.', 'success')
        return redirect(url_for('auth.login'))
    
    return render_template('register.html')