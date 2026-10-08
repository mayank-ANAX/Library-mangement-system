/**
 * Server-side validation utilities for Library Management System
 */

export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Validates ISBN-10 or ISBN-13
 * Strips hyphens and spaces
 * ISBN-10: 10 chars, digits 0-9 except last can be 'X' or 'x'
 * ISBN-13: 13 chars, digits only (usually starts with 978 or 979)
 */
export function isValidISBN(isbn: string): boolean {
  if (!isbn || typeof isbn !== 'string') return false;
  const clean = isbn.replace(/[-\s]/g, '').toUpperCase();
  
  if (clean.length === 10) {
    return /^[0-9]{9}[0-9X]$/.test(clean);
  } else if (clean.length === 13) {
    return /^[0-9]{13}$/.test(clean);
  }
  return false;
}

export function normalizeISBN(isbn: string): string {
  return isbn.replace(/[-\s]/g, '').toUpperCase();
}

/**
 * Validates 10-digit Indian mobile number starting with 6, 7, 8, or 9
 */
export function isValidIndianPhone(phone: string): boolean {
  if (!phone || typeof phone !== 'string') return false;
  const clean = phone.replace(/[-\s+]/g, '');
  // If it starts with 91 followed by 10 digits
  if (clean.length === 12 && clean.startsWith('91')) {
    return /^[6-9][0-9]{9}$/.test(clean.substring(2));
  }
  return /^[6-9][0-9]{9}$/.test(clean);
}

export function normalizePhone(phone: string): string {
  const clean = phone.replace(/[-\s+]/g, '');
  if (clean.length === 12 && clean.startsWith('91')) {
    return clean.substring(2);
  }
  return clean;
}

/**
 * Validates standard email format
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const regex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return regex.test(email.trim());
}

/**
 * Validates Book input
 */
export function validateBookInput(data: {
  isbn?: string;
  title?: string;
  author?: string;
  category?: string;
  total_copies?: number | string;
  available_copies?: number | string;
}, isUpdate = false, currentBorrowed = 0): { valid: boolean; errors: ValidationError[] } {
  const errors: ValidationError[] = [];

  if (!isUpdate || data.isbn !== undefined) {
    if (!data.isbn || !isValidISBN(data.isbn)) {
      errors.push({ field: 'isbn', message: 'Valid 10 or 13 digit ISBN is required.' });
    }
  }

  if (!isUpdate || data.title !== undefined) {
    if (!data.title || typeof data.title !== 'string' || data.title.trim().length < 2) {
      errors.push({ field: 'title', message: 'Title must be at least 2 characters.' });
    }
  }

  if (!isUpdate || data.author !== undefined) {
    if (!data.author || typeof data.author !== 'string' || data.author.trim().length < 2) {
      errors.push({ field: 'author', message: 'Author must be at least 2 characters.' });
    }
  }

  if (!isUpdate || data.category !== undefined) {
    if (!data.category || typeof data.category !== 'string' || data.category.trim().length === 0) {
      errors.push({ field: 'category', message: 'Category is required.' });
    }
  }

  if (!isUpdate || data.total_copies !== undefined) {
    const total = Number(data.total_copies);
    if (!Number.isInteger(total) || total < 1 || total > 500) {
      errors.push({ field: 'total_copies', message: 'Total copies must be an integer between 1 and 500.' });
    } else if (isUpdate && total < currentBorrowed) {
      errors.push({ 
        field: 'total_copies', 
        message: `Total copies cannot be lower than currently issued copies (${currentBorrowed}).` 
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates Member input
 */
export function validateMemberInput(data: {
  name?: string;
  email?: string;
  phone?: string;
  member_type?: string;
  active?: boolean | number;
}, isUpdate = false): { valid: boolean; errors: ValidationError[] } {
  const errors: ValidationError[] = [];

  if (!isUpdate || data.name !== undefined) {
    if (!data.name || typeof data.name !== 'string' || data.name.trim().length < 2 || data.name.trim().length > 60) {
      errors.push({ field: 'name', message: 'Name must be between 2 and 60 characters.' });
    }
  }

  if (!isUpdate || data.email !== undefined) {
    if (!data.email || !isValidEmail(data.email)) {
      errors.push({ field: 'email', message: 'A valid email address is required.' });
    }
  }

  if (!isUpdate || data.phone !== undefined) {
    if (!data.phone || !isValidIndianPhone(data.phone)) {
      errors.push({ field: 'phone', message: 'Phone must be a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.' });
    }
  }

  if (!isUpdate || data.member_type !== undefined) {
    const validTypes = ['Student', 'Faculty', 'Staff'];
    if (!data.member_type || !validTypes.includes(data.member_type)) {
      errors.push({ field: 'member_type', message: 'Member type must be Student, Faculty, or Staff.' });
    }
  }

  return { valid: errors.length === 0, errors };
}
