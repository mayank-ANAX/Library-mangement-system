"""
Database Seeding Script for Library Management System
Populates initial admin/librarian users, books, members, and transactions.
"""

try:
    from .app import create_app
    from .models import db, User, Book, Member, Issue
except ImportError:
    from app import create_app
    from models import db, User, Book, Member, Issue

def seed_data_in_context():
    if User.query.first():
        print("Database already contains data. Skipping seeding.")
        return

    print("Seeding database...")

    # 1. Staff accounts
    admin = User(username='admin', role='admin')
    admin.set_password('admin123')

    librarian = User(username='librarian', role='librarian')
    librarian.set_password('lib12345')

    db.session.add_all([admin, librarian])
    db.session.commit()

    # 2. Books
    books_data = [
        {'isbn': '9780134685991', 'title': 'Effective Java', 'author': 'Joshua Bloch', 'category': 'Computer Science', 'total': 6, 'avail': 4},
        {'isbn': '9780132350884', 'title': 'Clean Code', 'author': 'Robert C. Martin', 'category': 'Software Engineering', 'total': 8, 'avail': 5},
        {'isbn': '9780262033848', 'title': 'Introduction to Algorithms', 'author': 'Thomas H. Cormen', 'category': 'Computer Science', 'total': 10, 'avail': 7},
        {'isbn': '9781491957660', 'title': 'Fluent Python', 'author': 'Luciano Ramalho', 'category': 'Programming Languages', 'total': 5, 'avail': 3},
        {'isbn': '9780073523323', 'title': 'Database System Concepts', 'author': 'Abraham Silberschatz', 'category': 'Databases', 'total': 7, 'avail': 5},
        {'isbn': '9780133594140', 'title': 'Computer Networks', 'author': 'Andrew S. Tanenbaum', 'category': 'Networking', 'total': 6, 'avail': 4},
        {'isbn': '9781119456339', 'title': 'Operating System Concepts', 'author': 'Peter B. Galvin', 'category': 'Computer Science', 'total': 7, 'avail': 6},
        {'isbn': '9780136042594', 'title': 'Artificial Intelligence: A Modern Approach', 'author': 'Stuart Russell', 'category': 'Artificial Intelligence', 'total': 5, 'avail': 3},
        {'isbn': '9781119548041', 'title': 'Machine Learning with Python', 'author': 'Andreas C. Müller', 'category': 'Data Science', 'total': 6, 'avail': 5},
        {'isbn': '9780078022128', 'title': 'Software Engineering: A Practitioner’s Approach', 'author': 'Roger S. Pressman', 'category': 'Software Engineering', 'total': 8, 'avail': 8},
    ]
    for b in books_data:
        book = Book(
            isbn=b['isbn'],
            title=b['title'],
            author=b['author'],
            category=b['category'],
            total_copies=b['total'],
            available_copies=b['avail']
        )
        db.session.add(book)
    db.session.commit()

    # 3. Members
    members_data = [
        {'code': 'M001', 'name': 'Aarav Sharma', 'email': 'aarav.sharma@campus.edu', 'phone': '9876543210', 'type': 'Student', 'joined': '2026-08-01', 'active': 1},
        {'code': 'M002', 'name': 'Dr. Priya Venkatesh', 'email': 'priya.venkatesh@faculty.edu', 'phone': '9845123456', 'type': 'Faculty', 'joined': '2025-01-15', 'active': 1},
        {'code': 'M003', 'name': 'Rohan Deshmukh', 'email': 'rohan.d@campus.edu', 'phone': '8765432109', 'type': 'Student', 'joined': '2026-08-10', 'active': 1},
        {'code': 'M004', 'name': 'Ananya Iyer', 'email': 'ananya.iyer@campus.edu', 'phone': '9123456780', 'type': 'Student', 'joined': '2026-09-01', 'active': 1},
        {'code': 'M005', 'name': 'Prof. Rajesh Kulkarni', 'email': 'rajesh.k@faculty.edu', 'phone': '9988776655', 'type': 'Faculty', 'joined': '2024-07-20', 'active': 1},
        {'code': 'M006', 'name': 'Meera Nair', 'email': 'meera.nair@staff.edu', 'phone': '7890123456', 'type': 'Staff', 'joined': '2025-11-05', 'active': 1},
        {'code': 'M007', 'name': 'Kabir Patel', 'email': 'kabir.patel@campus.edu', 'phone': '6789012345', 'type': 'Student', 'joined': '2026-02-14', 'active': 0},
    ]
    for m in members_data:
        mem = Member(
            member_code=m['code'],
            name=m['name'],
            email=m['email'],
            phone=m['phone'],
            member_type=m['type'],
            joined_on=m['joined'],
            active=m['active']
        )
        db.session.add(mem)
    db.session.commit()

    # 4. Circulation records
    circulations = [
        Issue(book_id=1, member_id=1, issue_date='2026-10-01', due_date='2026-10-15', return_date=None, fine=0.0, status='Issued'),
        Issue(book_id=2, member_id=1, issue_date='2026-09-01', due_date='2026-09-15', return_date='2026-09-14', fine=0.0, status='Returned'),
        Issue(book_id=3, member_id=2, issue_date='2026-08-27', due_date='2026-09-10', return_date='2026-09-15', fine=10.0, status='Returned'),
        Issue(book_id=4, member_id=3, issue_date='2026-09-14', due_date='2026-09-28', return_date=None, fine=0.0, status='Issued'),
        Issue(book_id=5, member_id=4, issue_date='2026-10-02', due_date='2026-10-16', return_date=None, fine=0.0, status='Issued'),
        Issue(book_id=6, member_id=5, issue_date='2026-09-10', due_date='2026-09-24', return_date=None, fine=0.0, status='Issued'),
        Issue(book_id=8, member_id=5, issue_date='2026-10-05', due_date='2026-10-19', return_date=None, fine=0.0, status='Issued'),
        Issue(book_id=9, member_id=6, issue_date='2026-09-12', due_date='2026-09-26', return_date='2026-09-25', fine=0.0, status='Returned'),
    ]
    db.session.add_all(circulations)
    db.session.commit()
    print("Database seeding completed successfully.")

def seed_database():
    app = create_app()
    with app.app_context():
        db.create_all()
        seed_data_in_context()

if __name__ == '__main__':
    seed_database()
