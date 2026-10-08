"""
Business logic and validation service for Flask backend
"""

import re
from datetime import datetime, timedelta
from .models import db, Book, Member, Issue

def get_today_str() -> str:
    return datetime.utcnow().strftime('%Y-%m-%d')

def add_days(date_str: str, days: int) -> str:
    dt = datetime.strptime(date_str, '%Y-%m-%d')
    return (dt + timedelta(days=days)).strftime('%Y-%m-%d')

def get_days_diff(date_a: str, date_b: str) -> int:
    dt_a = datetime.strptime(date_a, '%Y-%m-%d')
    dt_b = datetime.strptime(date_b, '%Y-%m-%d')
    return (dt_b - dt_a).days

def calculate_fine(due_date_str: str, return_date_str: str):
    late_days = max(0, get_days_diff(due_date_str, return_date_str))
    fine = late_days * 2.0
    return late_days, fine

def is_valid_isbn(isbn: str) -> bool:
    if not isbn or not isinstance(isbn, str):
        return False
    clean = re.sub(r'[-\s]', '', isbn).upper()
    if len(clean) == 10:
        return bool(re.match(r'^[0-9]{9}[0-9X]$', clean))
    elif len(clean) == 13:
        return bool(re.match(r'^[0-9]{13}$', clean))
    return False

def normalize_isbn(isbn: str) -> str:
    return re.sub(r'[-\s]', '', isbn).upper()

def is_valid_indian_phone(phone: str) -> bool:
    if not phone or not isinstance(phone, str):
        return False
    clean = re.sub(r'[-\s+]', '', phone)
    if len(clean) == 12 and clean.startswith('91'):
        clean = clean[2:]
    return bool(re.match(r'^[6-9][0-9]{9}$', clean))

def normalize_phone(phone: str) -> str:
    clean = re.sub(r'[-\s+]', '', phone)
    if len(clean) == 12 and clean.startswith('91'):
        return clean[2:]
    return clean

def is_valid_email(email: str) -> bool:
    if not email or not isinstance(email, str):
        return False
    pattern = r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$'
    return bool(re.match(pattern, email.strip()))

def validate_issue_eligibility(book_id: int, member_id: int, as_of_date: str = None):
    as_of = as_of_date or get_today_str()
    book = Book.query.get(book_id)
    if not book:
        return False, "Book not found"
    
    member = Member.query.get(member_id)
    if not member:
        return False, "Member not found"

    # Rule 5: Inactive members cannot borrow books
    if not member.active:
        return False, "Member account is inactive. Inactive members cannot borrow books."

    # Rule 1: A book cannot be issued if available_copies < 1
    if book.available_copies < 1:
        return False, "No copies available for this book."

    # Rule 4: Overdue check
    overdue_count = Issue.query.filter(
        Issue.member_id == member_id,
        Issue.status == 'Issued',
        Issue.due_date < as_of
    ).count()
    if overdue_count > 0:
        return False, "Member has overdue books. Overdue accounts cannot borrow additional books until returns are settled."

    # Rule 3: Borrowing limit of 3 books
    active_loans_count = Issue.query.filter(
        Issue.member_id == member_id,
        Issue.status == 'Issued'
    ).count()
    if active_loans_count >= 3:
        return False, "Borrowing limit reached. A member cannot hold more than 3 active books simultaneously."

    # Rule 2: Member cannot hold same book twice simultaneously
    duplicate_holding = Issue.query.filter(
        Issue.member_id == member_id,
        Issue.book_id == book_id,
        Issue.status == 'Issued'
    ).count()
    if duplicate_holding > 0:
        return False, "Member already currently holds an issued copy of this book."

    return True, None

def issue_book_atomic(book_id: int, member_id: int, custom_date: str = None):
    issue_date = custom_date or get_today_str()
    due_date = add_days(issue_date, 14)

    allowed, reason = validate_issue_eligibility(book_id, member_id, issue_date)
    if not allowed:
        raise ValueError(reason)

    book = Book.query.get(book_id)
    book.available_copies -= 1

    issue = Issue(
        book_id=book_id,
        member_id=member_id,
        issue_date=issue_date,
        due_date=due_date,
        return_date=None,
        fine=0.0,
        status='Issued'
    )
    db.session.add(issue)
    db.session.commit()
    return issue

def return_book_atomic(issue_id: int, custom_return_date: str = None):
    issue = Issue.query.get(issue_id)
    if not issue:
        raise ValueError("Transaction not found")

    if issue.status == 'Returned':
        raise ValueError("This book has already been returned.")

    return_date = custom_return_date or get_today_str()
    late_days, fine = calculate_fine(issue.due_date, return_date)

    issue.status = 'Returned'
    issue.return_date = return_date
    issue.fine = fine

    book = Book.query.get(issue.book_id)
    if book:
        book.available_copies += 1

    db.session.commit()
    return issue, late_days, fine

def can_delete_book(book_id: int):
    history_count = Issue.query.filter_by(book_id=book_id).count()
    if history_count > 0:
        return False, "Book cannot be deleted because circulation and issue history exists for this title."
    return True, None
