class AppError extends Error {
  constructor(message, statusCode) {
    super(message)
    this.name = this.constructor.name
    this.statusCode = statusCode
  }
}

class ValidationError extends AppError {
  constructor(message = 'Geçersiz istek') {
    super(message, 400)
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Kayıt bulunamadı') {
    super(message, 404)
  }
}

class ConflictError extends AppError {
  constructor(message = 'Kayıt zaten mevcut') {
    super(message, 409)
  }
}

module.exports = { AppError, ValidationError, NotFoundError, ConflictError }
