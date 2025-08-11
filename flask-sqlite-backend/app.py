'''from flask import Flask
from flask_login import LoginManager
from flask_migrate import Migrate
from models import db, User
from datetime import datetime
from werkzeug.security import generate_password_hash
from flask_wtf.csrf import CSRFProtect, generate_csrf
from flask_cors import CORS  # Add this import

def create_app():
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///device_list.db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.secret_key = 'your-secret-key-here'
    
    # Configure CORS
    CORS(app, resources={
        r"/api/*": {"origins": "*"},
        r"/get-csrf": {"origins": "*"},
        r"/login": {"origins": "*"}
    }, supports_credentials=True)
    
    # Initialize extensions
    db.init_app(app)
    login_manager = LoginManager(app)
    login_manager.login_view = 'auth.login'
    migrate = Migrate(app, db)
    csrf = CSRFProtect(app)
    # Register blueprints
    from routes.auth_routes import auth_bp
    from routes.device_routes import device_bp
    from routes.user_routes import user_bp
    from routes.reservation_routes import reservation_bp
    from routes.history_routes import history_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(device_bp)
    app.register_blueprint(user_bp)
    app.register_blueprint(reservation_bp)
    app.register_blueprint(history_bp)
    

    @login_manager.user_loader
    def load_user(user_id):
        return User.query.get(int(user_id))

    # Create tables and admin user
    with app.app_context():
        db.create_all()
        if not User.query.filter_by(user_name='admin').first():
            admin = User(
                user_name='admin',
                user_ip='127.0.0.1',
                password_hash=generate_password_hash('admin123'),
                role='admin',
                created_at=datetime.utcnow()
            )
            db.session.add(admin)
            db.session.commit()

    return app

if __name__ == '__main__':
    app = create_app()
    app.run(host='0.0.0.0', port=5000, debug=True)'''

from flask import Flask
from flask_jwt_extended import (
    JWTManager, create_access_token,
    jwt_required, get_jwt_identity,
    verify_jwt_in_request, get_jwt
)
from functools import wraps
from flask_login import LoginManager
from flask_migrate import Migrate
from models import db, User
from datetime import datetime
from werkzeug.security import generate_password_hash
from flask_wtf.csrf import CSRFProtect, generate_csrf
from flask_cors import CORS
from apscheduler.schedulers.background import BackgroundScheduler
import os
import shutil
import atexit
from dotenv import load_dotenv

def create_app():
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///device_list.db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.secret_key = 'your-secret-key-here'
    
    # Configure backup settings
    app.config['BACKUP_DIR'] = os.path.join(os.path.expanduser("~"), "db_backups")
    app.config['BACKUP_FILENAME'] = "device_list_backup.db"  # Single filename that gets overwritten
    
    # Configure CORS
    CORS(app, resources={
        r"/api/*": {"origins": "*"},
        r"/get-csrf": {"origins": "*"},
        r"/login": {"origins": "*"}
    }, supports_credentials=True)
    
    # Initialize extensions
    db.init_app(app)
    login_manager = LoginManager(app)
    login_manager.login_view = 'auth.login'
    migrate = Migrate(app, db)
    csrf = CSRFProtect(app)
    load_dotenv() 
    
    # Register blueprints
    from routes.auth_routes import auth_bp
    from routes.device_routes import device_bp
    from routes.user_routes import user_bp
    from routes.reservation_routes import reservation_bp
    from routes.history_routes import history_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(device_bp)
    app.register_blueprint(user_bp)
    app.register_blueprint(reservation_bp)
    app.register_blueprint(history_bp)
    
    @login_manager.user_loader
    def load_user(user_id):
        return User.query.get(int(user_id))

    # Database backup function
    def backup_database():
        backup_path = os.path.join(app.config['BACKUP_DIR'], app.config['BACKUP_FILENAME'])
        
        # Create backup directory if it doesn't exist
        os.makedirs(app.config['BACKUP_DIR'], exist_ok=True)
        
        # Get the path to the current database
        db_path = os.path.join(app.instance_path, 'device_list.db')
        
        try:
            shutil.copy2(db_path, backup_path)
            app.logger.info(f"Database backed up to {backup_path}")
        except Exception as e:
            app.logger.error(f"Backup failed: {str(e)}")
    
    # Initialize scheduler
    scheduler = BackgroundScheduler()
    scheduler.add_job(func=backup_database, trigger='interval', minutes=5)
    scheduler.start()
    
    # Shut down the scheduler when exiting the app
    atexit.register(lambda: scheduler.shutdown())

    # Create tables and admin user
    with app.app_context():
        db.create_all()
        if not User.query.filter_by(user_name=os.getenv('ADMIN_USERNAME')).first():
            admin = User(
                user_name=os.getenv('ADMIN_USERNAME'),
                user_ip='127.0.0.1',
                password_hash=generate_password_hash(os.getenv('ADMIN_PASSWORD')),
                role='admin',
                created_at=datetime.utcnow()
            )
            db.session.add(admin)
            db.session.commit()
        
        # Create initial backup
        backup_database()

    return app

if __name__ == '__main__':
    app = create_app()
    app.run(host='0.0.0.0', port=5000, debug=True)