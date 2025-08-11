import os
import shutil
from datetime import datetime

# Configuration - Update these paths!
DB_PATH = "C:/Users/12600/Downloads/partial reservation/partial reservation/Ruto_Backend/Backend_dev/flask-sqlite-backend/instance/device_list.db"
BACKUP_DIR = os.path.join(os.path.expanduser("~"), "db_backups")

def create_backup():
    # Create backup directory if it doesn't exist
    os.makedirs(BACKUP_DIR, exist_ok=True)
    
    # Generate timestamp
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    backup_filename = f"device_list_backup_{timestamp}.db"
    backup_path = os.path.join(BACKUP_DIR, backup_filename)
    
    # Verify source database exists
    if not os.path.exists(DB_PATH):
        print(f"[ERROR] Database not found at: {DB_PATH}")
        return False
    
    # Perform the backup (simple file copy for SQLite)
    try:
        shutil.copy2(DB_PATH, backup_path)
        print(f"[SUCCESS] Backup created at: {backup_path}")
        return True
    except Exception as e:
        print(f"[ERROR] Backup failed: {str(e)}")
        return False

if __name__ == "__main__":
    create_backup()
    input("Press Enter to exit...")
    