"""
Flask API Blueprint Routes for Library Management System
"""

import io
import csv
from functools import wraps
from flask import Blueprint, request, jsonify, make_response
import jwt

try:
    from .models import db, User, Book, Member, Issue
    from .config import Config
    from .services import (
        get_today_str,
        get_days_diff,
        is_valid_isbn,
        normalize_isbn,
        is_valid_indian_phone,
        normalize_phone,
        is_valid_email,
        issue_book_atomic,
        return_book_atomic,
        can_delete_book,
        validate_issue_eligibility
    )
except ImportError:
    from models import db, User, Book, Member, Issue
    from config import Config
    from services import (
        get_today_str,
        get_days_diff,
        is_valid_isbn,
        normalize_isbn,
        is_valid_indian_phone,
        normalize_phone,
        is_valid_email,
        issue_book_atomic,
        return_book_atomic,
        can_delete_book,
        validate_issue_eligibility
    )

api = Blueprint('api', __name__, url_prefix='/api')

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]

        if not token:
            return jsonify({'error': 'Authentication required. Please log in.'}), 401

        try:
            payload = jwt.decode(token, Config.JWT_SECRET_KEY, algorithms=['HS256'])
            current_user = User.query.get(payload['id'])
            if not current_user:
                return jsonify({'error': 'User not found.'}), 401
        except Exception:
            return jsonify({'error': 'Invalid or expired session token.'}), 401

        return f(current_user, *args, **kwargs)
    return decorated

def roles_required(*allowed_roles):
    def decorator(f):
        @wraps(f)
        def decorated(current_user, *args, **kwargs):
            if current_user.role not in allowed_roles:
                return jsonify({
                    'error': f"Permission denied. Access restricted to {list(allowed_roles)}. Your role is '{current_user.role}'."
                }), 403
            return f(current_user, *args, **kwargs)
        return decorated
    return decorator

# --- AUTH ---
@api.route('/auth/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    username = data.get('username', '').strip()
    password = data.get('password', '')

    if not username or not password:
        return jsonify({'error': 'Username and password are required.'}), 400

    u_lower = username.lower()
    user = User.query.filter(db.func.lower(User.username) == u_lower).first()

    # If users table is empty or demo user missing on fresh deployment, auto-seed
    if not user and u_lower in ['admin', 'librarian']:
        try:
            try:
                from .seed import seed_data_in_context
            except ImportError:
                from seed import seed_data_in_context
            seed_data_in_context()
            user = User.query.filter(db.func.lower(User.username) == u_lower).first()
        except Exception as e:
            print(f"On-demand seeding error: {e}")

    if not user or not user.check_password(password):
        return jsonify({'error': 'Invalid username or password.'}), 401

    token = jwt.encode(
        {'id': user.id, 'username': user.username, 'role': user.role},
        Config.JWT_SECRET_KEY,
        algorithm='HS256'
    )
    return jsonify({
        'message': 'Login successful',
        'token': token,
        'user': user.to_dict()
    })

@api.route('/auth/logout', methods=['POST'])
@token_required
def logout(current_user):
    return jsonify({'message': 'Logged out successfully.'})

@api.route('/auth/me', methods=['GET'])
@token_required
def get_current_user(current_user):
    return jsonify({'user': current_user.to_dict()})

# --- DASHBOARD ---
@api.route('/dashboard', methods=['GET'])
@token_required
def dashboard(current_user):
    today = get_today_str()

    titles_count = Book.query.count()
    all_books = Book.query.all()
    total_copies = sum(b.total_copies for b in all_books)
    available_copies = sum(b.available_copies for b in all_books)

    issued_count = Issue.query.filter_by(status='Issued').count()
    returned_count = Issue.query.filter_by(status='Returned').count()
    collected_fines = db.session.query(db.func.sum(Issue.fine)).scalar() or 0.0

    total_members = Member.query.count()
    active_members = Member.query.filter_by(active=1).count()

    overdue_issues = Issue.query.filter(Issue.status == 'Issued', Issue.due_date < today).all()
    pending_fines = 0.0
    overdue_alerts = []
    for o in overdue_issues:
        days_late = max(0, get_days_diff(o.due_date, today))
        fine_so_far = days_late * 2.0
        pending_fines += fine_so_far
        d = o.to_dict()
        d['days_late'] = days_late
        d['fine_so_far'] = fine_so_far
        overdue_alerts.append(d)

    recent = Issue.query.order_by(Issue.id.desc()).limit(6).all()

    # Most borrowed
    most_borrowed_q = db.session.query(
        Book, db.func.count(Issue.id).label('borrow_count')
    ).outerjoin(Issue, Book.id == Issue.book_id)\
     .group_by(Book.id)\
     .order_by(db.desc('borrow_count'), Book.title)\
     .limit(5).all()

    most_borrowed = [{
        'id': b.id, 'title': b.title, 'author': b.author,
        'category': b.category, 'borrow_count': count
    } for b, count in most_borrowed_q]

    categories_q = db.session.query(
        Book.category, db.func.count(Book.id), db.func.sum(Book.total_copies)
    ).group_by(Book.category).all()
    categories = [{'category': cat, 'book_count': c, 'total_copies': tc} for cat, c, tc in categories_q]

    member_types_q = db.session.query(
        Member.member_type, db.func.count(Member.id)
    ).group_by(Member.member_type).all()
    member_types = [{'member_type': t, 'count': c} for t, c in member_types_q]

    return jsonify({
        'stats': {
            'totalTitles': titles_count,
            'totalCopies': total_copies,
            'availableCopies': available_copies,
            'issuedBooks': issued_count,
            'returnedBooks': returned_count,
            'totalMembers': total_members,
            'activeMembers': active_members,
            'overdueBooks': len(overdue_alerts),
            'collectedFines': collected_fines,
            'pendingFines': pending_fines,
            'totalFines': collected_fines + pending_fines
        },
        'recentTransactions': [r.to_dict() for r in recent],
        'overdueAlerts': overdue_alerts[:5],
        'mostBorrowed': most_borrowed,
        'categories': categories,
        'memberTypes': member_types
    })

# --- BOOKS ---
@api.route('/books', methods=['GET'])
@token_required
def get_books(current_user):
    search = request.args.get('search', '').strip()
    category = request.args.get('category')
    availability = request.args.get('availability')

    q = Book.query
    if search:
        term = f"%{search.lower()}%"
        q = q.filter(
            db.or_(
                db.func.lower(Book.title).like(term),
                db.func.lower(Book.author).like(term),
                db.func.lower(Book.isbn).like(term)
            )
        )
    if category and category != 'All':
        q = q.filter(Book.category == category)

    books = q.order_by(Book.title.asc()).all()
    res = [b.to_dict() for b in books]
    if availability and availability != 'All':
        res = [b for b in res if b['status'] == availability]

    return jsonify({'books': res})

@api.route('/books', methods=['POST'])
@token_required
def create_book(current_user):
    data = request.get_json() or {}
    isbn = data.get('isbn', '')
    title = data.get('title', '').strip()
    author = data.get('author', '').strip()
    category = data.get('category', '').strip()
    total_copies = data.get('total_copies')

    if not is_valid_isbn(isbn):
        return jsonify({'error': 'Valid 10 or 13 digit ISBN is required.'}), 400
    if len(title) < 2:
        return jsonify({'error': 'Title must be at least 2 characters.'}), 400
    if len(author) < 2:
        return jsonify({'error': 'Author must be at least 2 characters.'}), 400
    if not category:
        return jsonify({'error': 'Category is required.'}), 400
    try:
        total = int(total_copies)
        if total < 1 or total > 500:
            raise ValueError()
    except Exception:
        return jsonify({'error': 'Total copies must be an integer between 1 and 500.'}), 400

    clean_isbn = normalize_isbn(isbn)
    if Book.query.filter_by(isbn=clean_isbn).first():
        return jsonify({'error': 'A book with this ISBN already exists in the catalog.'}), 409

    book = Book(
        isbn=clean_isbn,
        title=title,
        author=author,
        category=category,
        total_copies=total,
        available_copies=total
    )
    db.session.add(book)
    db.session.commit()
    return jsonify({'message': 'Book added successfully', 'book': book.to_dict()}), 201

@api.route('/books/<int:book_id>', methods=['GET'])
@token_required
def get_book(current_user, book_id):
    book = Book.query.get(book_id)
    if not book:
        return jsonify({'error': 'Book not found'}), 404
    can_del, reason = can_delete_book(book_id)
    d = book.to_dict()
    d['can_delete'] = can_del
    d['cannot_delete_reason'] = reason
    return jsonify({'book': d})

@api.route('/books/<int:book_id>', methods=['PUT'])
@token_required
def update_book(current_user, book_id):
    book = Book.query.get(book_id)
    if not book:
        return jsonify({'error': 'Book not found'}), 404

    data = request.get_json() or {}
    issued_copies = book.total_copies - book.available_copies

    if 'isbn' in data:
        if not is_valid_isbn(data['isbn']):
            return jsonify({'error': 'Valid 10 or 13 digit ISBN is required.'}), 400
        clean_isbn = normalize_isbn(data['isbn'])
        dup = Book.query.filter(Book.isbn == clean_isbn, Book.id != book_id).first()
        if dup:
            return jsonify({'error': 'Another book already exists with this ISBN.'}), 409
        book.isbn = clean_isbn

    if 'title' in data:
        if len(data['title'].strip()) < 2:
            return jsonify({'error': 'Title must be at least 2 characters.'}), 400
        book.title = data['title'].strip()

    if 'author' in data:
        if len(data['author'].strip()) < 2:
            return jsonify({'error': 'Author must be at least 2 characters.'}), 400
        book.author = data['author'].strip()

    if 'category' in data:
        if not data['category'].strip():
            return jsonify({'error': 'Category is required.'}), 400
        book.category = data['category'].strip()

    if 'total_copies' in data:
        try:
            total = int(data['total_copies'])
            if total < 1 or total > 500:
                raise ValueError()
            if total < issued_copies:
                return jsonify({'error': f'Total copies cannot be lower than currently issued copies ({issued_copies}).'}), 400
            book.total_copies = total
            book.available_copies = total - issued_copies
        except Exception:
            return jsonify({'error': 'Total copies must be an integer between 1 and 500.'}), 400

    db.session.commit()
    return jsonify({'message': 'Book updated successfully', 'book': book.to_dict()})

@api.route('/books/<int:book_id>', methods=['DELETE'])
@token_required
@roles_required('admin')
def delete_book(current_user, book_id):
    book = Book.query.get(book_id)
    if not book:
        return jsonify({'error': 'Book not found'}), 404
    can_del, reason = can_delete_book(book_id)
    if not can_del:
        return jsonify({'error': reason}), 400
    db.session.delete(book)
    db.session.commit()
    return jsonify({'message': f"Book '{book.title}' was deleted successfully."})

# --- MEMBERS ---
@api.route('/members', methods=['GET'])
@token_required
def get_members(current_user):
    search = request.args.get('search', '').strip()
    m_type = request.args.get('type')
    status = request.args.get('status')
    today = get_today_str()

    q = Member.query
    if search:
        term = f"%{search.lower()}%"
        q = q.filter(
            db.or_(
                db.func.lower(Member.name).like(term),
                db.func.lower(Member.email).like(term),
                db.func.lower(Member.phone).like(term),
                db.func.lower(Member.member_code).like(term)
            )
        )
    if m_type and m_type != 'All':
        q = q.filter(Member.member_type == m_type)
    if status and status != 'All':
        q = q.filter(Member.active == (1 if status == 'Active' else 0))

    members = q.order_by(Member.member_code.asc()).all()
    res = []
    for m in members:
        d = m.to_dict()
        active_count = Issue.query.filter_by(member_id=m.id, status='Issued').count()
        overdue_count = Issue.query.filter(Issue.member_id == m.id, Issue.status == 'Issued', Issue.due_date < today).count()
        d['active_loans_count'] = active_count
        d['has_overdue'] = overdue_count > 0
        res.append(d)

    return jsonify({'members': res})

@api.route('/members', methods=['POST'])
@token_required
def create_member(current_user):
    data = request.get_json() or {}
    name = data.get('name', '').strip()
    email = data.get('email', '').strip().lower()
    phone = data.get('phone', '').strip()
    member_type = data.get('member_type')

    if len(name) < 2 or len(name) > 60:
        return jsonify({'error': 'Name must be between 2 and 60 characters.'}), 400
    if not is_valid_email(email):
        return jsonify({'error': 'A valid email address is required.'}), 400
    if not is_valid_indian_phone(phone):
        return jsonify({'error': 'Phone must be a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.'}), 400
    if member_type not in ['Student', 'Faculty', 'Staff']:
        return jsonify({'error': 'Member type must be Student, Faculty, or Staff.'}), 400

    if Member.query.filter(db.func.lower(Member.email) == email).first():
        return jsonify({'error': 'A member with this email address already exists.'}), 409

    max_id = db.session.query(db.func.max(Member.id)).scalar() or 0
    member_code = f"M{str(max_id + 1).zfill(3)}"

    member = Member(
        member_code=member_code,
        name=name,
        email=email,
        phone=normalize_phone(phone),
        member_type=member_type,
        joined_on=get_today_str(),
        active=1
    )
    db.session.add(member)
    db.session.commit()
    return jsonify({'message': 'Member created successfully', 'member': member.to_dict()}), 201

@api.route('/members/<int:member_id>', methods=['GET'])
@token_required
def get_member(current_user, member_id):
    member = Member.query.get(member_id)
    if not member:
        return jsonify({'error': 'Member not found'}), 404

    today = get_today_str()
    issues = Issue.query.filter_by(member_id=member_id).order_by(Issue.id.desc()).all()
    active_loans = []
    history = []
    for i in issues:
        d = i.to_dict()
        if i.status == 'Issued':
            days_late = max(0, get_days_diff(i.due_date, today))
            d['is_overdue'] = today > i.due_date
            d['days_late'] = days_late
            d['fine_so_far'] = days_late * 2.0
            active_loans.append(d)
        else:
            history.append(d)

    m_dict = member.to_dict()
    m_dict['active_loans_count'] = len(active_loans)
    m_dict['remaining_capacity'] = max(0, 3 - len(active_loans))
    m_dict['has_overdue'] = any(l['is_overdue'] for l in active_loans)

    return jsonify({'member': m_dict, 'activeLoans': active_loans, 'history': history})

@api.route('/members/<int:member_id>/status', methods=['PATCH'])
@token_required
def toggle_member_status(current_user, member_id):
    member = Member.query.get(member_id)
    if not member:
        return jsonify({'error': 'Member not found'}), 404
    member.active = 0 if member.active == 1 else 1
    db.session.commit()
    return jsonify({'message': f"Member status updated to {'Active' if member.active == 1 else 'Inactive'}", 'active': member.active})

# --- ISSUES ---
@api.route('/issues', methods=['POST'])
@token_required
def issue_book_route(current_user):
    data = request.get_json() or {}
    book_id = data.get('book_id')
    member_id = data.get('member_id')
    issue_date = data.get('issue_date')

    if not book_id or not member_id:
        return jsonify({'error': 'Both Book ID and Member ID are required.'}), 400

    try:
        issue = issue_book_atomic(int(book_id), int(member_id), issue_date)
        return jsonify({
            'message': f"Book '{issue.book.title}' issued successfully. Due on {issue.due_date}.",
            'issue': issue.to_dict()
        }), 201
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to issue book'}), 500

@api.route('/issues', methods=['GET'])
@token_required
def get_issues(current_user):
    status = request.args.get('status')
    search = request.args.get('search', '').strip()
    today = get_today_str()

    q = Issue.query
    if status and status != 'All':
        if status == 'Overdue':
            q = q.filter(Issue.status == 'Issued', Issue.due_date < today)
        else:
            q = q.filter(Issue.status == status)

    issues = q.order_by(Issue.id.desc()).all()
    res = []
    for i in issues:
        d = i.to_dict()
        if i.status == 'Issued':
            days_late = max(0, get_days_diff(i.due_date, today))
            d['is_overdue'] = today > i.due_date
            d['days_late'] = days_late
            d['fine_so_far'] = days_late * 2.0
        else:
            d['is_overdue'] = False
            d['days_late'] = 0
            d['fine_so_far'] = 0.0

        if search:
            s_low = search.lower()
            matches = (
                s_low in (d['book_title'] or '').lower() or
                s_low in (d['book_isbn'] or '').lower() or
                s_low in (d['member_name'] or '').lower() or
                s_low in (d['member_code'] or '').lower()
            )
            if not matches:
                continue
        res.append(d)

    return jsonify({'issues': res})

@api.route('/issues/<int:issue_id>/return', methods=['POST'])
@token_required
def return_book_route(current_user, issue_id):
    data = request.get_json() or {}
    return_date = data.get('return_date')
    try:
        issue, late_days, fine = return_book_atomic(issue_id, return_date)
        msg = f"Book returned successfully. Late by {late_days} days. Fine calculated: ₹{fine:.2f}." if fine > 0 else "Book returned successfully with zero fine."
        return jsonify({'message': msg, 'issue': issue.to_dict(), 'lateDays': late_days, 'fine': fine})
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception:
        db.session.rollback()
        return jsonify({'error': 'Failed to process return.'}), 500

# --- REPORTS & CSV EXPORT ---
@api.route('/reports/overdue', methods=['GET'])
@token_required
def overdue_report(current_user):
    today = get_today_str()
    rows = Issue.query.filter(Issue.status == 'Issued', Issue.due_date < today).order_by(Issue.due_date.asc()).all()
    res = []
    for r in rows:
        d = r.to_dict()
        days_late = max(0, get_days_diff(r.due_date, today))
        d['days_late'] = days_late
        d['fine_so_far'] = days_late * 2.0
        res.append(d)
    return jsonify({'overdue': res})

@api.route('/reports/most-borrowed', methods=['GET'])
@token_required
def most_borrowed_report(current_user):
    q = db.session.query(Book, db.func.count(Issue.id).label('borrow_count'))\
        .outerjoin(Issue, Book.id == Issue.book_id)\
        .group_by(Book.id)\
        .order_by(db.desc('borrow_count'), Book.title)\
        .all()
    res = [{
        'id': b.id, 'title': b.title, 'author': b.author, 'category': b.category,
        'total_copies': b.total_copies, 'available_copies': b.available_copies,
        'borrow_count': count
    } for b, count in q]
    return jsonify({'mostBorrowed': res})

@api.route('/reports/transactions/export', methods=['GET'])
@token_required
def export_csv(current_user):
    issues = Issue.query.order_by(Issue.id.asc()).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['Issue ID', 'Book Title', 'ISBN', 'Member Code', 'Member Name', 'Issue Date', 'Due Date', 'Return Date', 'Fine (INR)', 'Status'])
    for i in issues:
        writer.writerow([
            i.id,
            i.book.title if i.book else 'N/A',
            i.book.isbn if i.book else 'N/A',
            i.member.member_code if i.member else 'N/A',
            i.member.name if i.member else 'N/A',
            i.issue_date,
            i.due_date,
            i.return_date or 'N/A',
            f"{i.fine:.2f}",
            i.status
        ])

    response = make_response(output.getvalue())
    response.headers['Content-Disposition'] = f'attachment; filename=library-transactions-{get_today_str()}.csv'
    response.headers['Content-Type'] = 'text/csv; charset=utf-8'
    return response
