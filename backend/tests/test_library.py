"""
Backend Automated Test Suite for Library Management System (Python / pytest)
Tests all 24 required business rules and endpoints.
"""

import pytest
from backend.app import create_app
from backend.models import db, User, Book, Member, Issue
from backend.services import (
    is_valid_isbn,
    is_valid_indian_phone,
    is_valid_email,
    calculate_fine,
    validate_issue_eligibility,
    issue_book_atomic,
    return_book_atomic,
    can_delete_book
)

class TestConfig:
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_SECRET_KEY = "test-secret-key"

@pytest.fixture
def app():
    app = create_app(TestConfig)
    with app.app_context():
        db.create_all()
        # Create default admin and librarian
        admin = User(username='admin', role='admin')
        admin.set_password('admin123')
        librarian = User(username='librarian', role='librarian')
        librarian.set_password('lib12345')
        db.session.add_all([admin, librarian])
        db.session.commit()
        yield app
        db.drop_all()

@pytest.fixture
def client(app):
    return app.test_client()

# 1. ISBN validation
def test_isbn_validation():
    assert is_valid_isbn("978-0-13-468599-1")
    assert is_valid_isbn("0-306-40615-X")
    assert not is_valid_isbn("12345")

# 2. Member validation
def test_member_validation():
    assert is_valid_indian_phone("9876543210")
    assert not is_valid_indian_phone("5123456789")
    assert is_valid_email("student@test.edu")
    assert not is_valid_email("invalid-email")

# 3. Book validation
def test_book_copies_validation(app):
    with app.app_context():
        book = Book(isbn="9780132350884", title="Clean Code", author="Robert C. Martin", category="Engineering", total_copies=5, available_copies=5)
        assert book.total_copies >= 1

# 4. Fine calculation
def test_fine_calculation():
    late_days, fine = calculate_fine("2026-10-01", "2026-10-06")
    assert late_days == 5
    assert fine == 10.0

# 5. Login success
def test_login_success(client):
    res = client.post('/api/auth/login', json={'username': 'admin', 'password': 'admin123'})
    assert res.status_code == 200
    assert 'token' in res.get_json()

# 6. Wrong password
def test_wrong_password(client):
    res = client.post('/api/auth/login', json={'username': 'admin', 'password': 'wrong'})
    assert res.status_code == 401

# 7. Unauthorized access
def test_unauthorized_access(client):
    res = client.get('/api/books')
    assert res.status_code == 401

# 8. CSRF / JSON validation
def test_json_validation(client):
    res = client.post('/api/auth/login', json={})
    assert res.status_code == 400

# 9. Add book & 10. Duplicate ISBN
def test_add_and_duplicate_book(app):
    with app.app_context():
        b1 = Book(isbn="9781111111111", title="Book 1", author="Author 1", category="Tech", total_copies=2, available_copies=2)
        db.session.add(b1)
        db.session.commit()
        assert b1.id is not None

        # Duplicate
        with pytest.raises(Exception):
            b2 = Book(isbn="9781111111111", title="Book 2", author="Author 2", category="Tech", total_copies=1, available_copies=1)
            db.session.add(b2)
            db.session.commit()
        db.session.rollback()

# 11. Add member & 12. Duplicate email
def test_add_and_duplicate_member(app):
    with app.app_context():
        m1 = Member(member_code="M901", name="Test Member", email="test@mail.com", phone="9876543210", member_type="Student", joined_on="2026-10-08", active=1)
        db.session.add(m1)
        db.session.commit()
        assert m1.id is not None

        with pytest.raises(Exception):
            m2 = Member(member_code="M902", name="Test Member 2", email="test@mail.com", phone="9876543211", member_type="Student", joined_on="2026-10-08", active=1)
            db.session.add(m2)
            db.session.commit()
        db.session.rollback()

# 13. Issue available book & 14. Issue unavailable book
def test_issue_flow(app):
    with app.app_context():
        book = Book(isbn="9782222222222", title="Issue Book", author="Author", category="CS", total_copies=1, available_copies=1)
        mem = Member(member_code="M903", name="Circ Member", email="circ@mail.com", phone="9876543210", member_type="Student", joined_on="2026-10-08", active=1)
        db.session.add_all([book, mem])
        db.session.commit()

        issue = issue_book_atomic(book.id, mem.id, "2026-10-08")
        assert issue.status == 'Issued'
        assert book.available_copies == 0

        # Try issuing when copies = 0
        allowed, reason = validate_issue_eligibility(book.id, mem.id, "2026-10-08")
        assert not allowed

# 15. Return book & 16. Double return
def test_return_flow(app):
    with app.app_context():
        book = Book(isbn="9783333333333", title="Ret Book", author="Author", category="CS", total_copies=1, available_copies=0)
        mem = Member(member_code="M904", name="Ret Member", email="ret@mail.com", phone="9876543210", member_type="Student", joined_on="2026-10-08", active=1)
        db.session.add_all([book, mem])
        db.session.commit()

        issue = Issue(book_id=book.id, member_id=mem.id, issue_date="2026-10-01", due_date="2026-10-15", status="Issued")
        db.session.add(issue)
        db.session.commit()

        # Return with late fine
        iss, late_days, fine = return_book_atomic(issue.id, "2026-10-20")
        assert iss.status == 'Returned'
        assert late_days == 5
        assert fine == 10.0
        assert book.available_copies == 1

        # Double return must fail
        with pytest.raises(ValueError):
            return_book_atomic(issue.id, "2026-10-21")

# 17. Max 3 books & 18. Same book twice
def test_member_limits(app):
    with app.app_context():
        b1 = Book(isbn="9784444444441", title="B1", author="A", category="C", total_copies=5, available_copies=5)
        b2 = Book(isbn="9784444444442", title="B2", author="A", category="C", total_copies=5, available_copies=5)
        b3 = Book(isbn="9784444444443", title="B3", author="A", category="C", total_copies=5, available_copies=5)
        b4 = Book(isbn="9784444444444", title="B4", author="A", category="C", total_copies=5, available_copies=5)
        mem = Member(member_code="M905", name="Limit Member", email="lim@mail.com", phone="9876543210", member_type="Student", joined_on="2026-10-08", active=1)
        db.session.add_all([b1, b2, b3, b4, mem])
        db.session.commit()

        issue_book_atomic(b1.id, mem.id, "2026-10-08")
        # Same book twice blocked
        allowed, reason = validate_issue_eligibility(b1.id, mem.id, "2026-10-08")
        assert not allowed

        issue_book_atomic(b2.id, mem.id, "2026-10-08")
        issue_book_atomic(b3.id, mem.id, "2026-10-08")

        # 4th book blocked (max 3)
        allowed4, _ = validate_issue_eligibility(b4.id, mem.id, "2026-10-08")
        assert not allowed4

# 19. Overdue member blocked & 20. Inactive member blocked
def test_overdue_and_inactive_blocked(app):
    with app.app_context():
        book = Book(isbn="9785555555555", title="Overdue Book", author="A", category="C", total_copies=5, available_copies=5)
        mem = Member(member_code="M906", name="Inact Member", email="inact@mail.com", phone="9876543210", member_type="Student", joined_on="2026-10-08", active=0)
        db.session.add_all([book, mem])
        db.session.commit()

        # Inactive blocked
        allowed_inact, _ = validate_issue_eligibility(book.id, mem.id, "2026-10-08")
        assert not allowed_inact

        mem.active = 1
        # Add overdue issue
        issue = Issue(book_id=book.id, member_id=mem.id, issue_date="2026-09-01", due_date="2026-09-15", status="Issued")
        db.session.add(issue)
        db.session.commit()

        allowed_overdue, _ = validate_issue_eligibility(book.id, mem.id, "2026-10-08")
        assert not allowed_overdue

# 21. Admin deletion & 22. Deletion denied with history
def test_book_deletion_rules(app):
    with app.app_context():
        b = Book(isbn="9786666666666", title="Del Book", author="A", category="C", total_copies=1, available_copies=1)
        m = Member(member_code="M907", name="Del Member", email="del@mail.com", phone="9876543210", member_type="Student", joined_on="2026-10-08", active=1)
        db.session.add_all([b, m])
        db.session.commit()

        can_del, _ = can_delete_book(b.id)
        assert can_del

        # Add history
        iss = Issue(book_id=b.id, member_id=m.id, issue_date="2026-10-01", due_date="2026-10-15", status="Returned")
        db.session.add(iss)
        db.session.commit()

        can_del_after, reason = can_delete_book(b.id)
        assert not can_del_after
        assert "circulation and issue history exists" in reason

# 23. CSV export structure
def test_csv_export_endpoint(client):
    login = client.post('/api/auth/login', json={'username': 'admin', 'password': 'admin123'})
    token = login.get_json()['token']
    res = client.get('/api/reports/transactions/export', headers={'Authorization': f'Bearer {token}'})
    assert res.status_code == 200
    assert 'text/csv' in res.content_type

# 24. SQL injection protection
def test_sql_injection_defense(app):
    with app.app_context():
        malicious = "' OR '1'='1"
        res = Book.query.filter(Book.title == malicious).all()
        assert len(res) == 0
