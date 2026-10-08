"""
Flask Application Factory and Server Entry Point
"""

import os
from flask import Flask, jsonify
from flask_cors import CORS
from .config import Config
from .models import db
from .routes import api

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

    return app

app = create_app()

if __name__ == '__main__':
    port = int(os.getenv('FLASK_PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
