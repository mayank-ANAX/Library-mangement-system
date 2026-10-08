"""
Flask Application Factory and Server Entry Point
Supports both module execution (backend.app) and service root execution (app)
"""

import os
from flask import Flask, jsonify
from flask_cors import CORS

try:
    from .config import Config
    from .models import db
    from .routes import api
except ImportError:
    from config import Config
    from models import db
    from routes import api

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    # Enable CORS for frontend integration
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    # Initialize SQLAlchemy ORM
    db.init_app(app)

    # Register API blueprint
    app.register_blueprint(api)

    @app.route('/api/health', methods=['GET'])
    def health_check():
        return jsonify({'status': 'healthy', 'service': 'Library Management System API'}), 200

    with app.app_context():
        db.create_all()
        try:
            try:
                from .seed import seed_data_in_context
            except ImportError:
                from seed import seed_data_in_context
            seed_data_in_context()
        except Exception as e:
            print(f"Auto-seeding status: {e}")

    return app

app = create_app()

if __name__ == '__main__':
    port = int(os.getenv('FLASK_PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
