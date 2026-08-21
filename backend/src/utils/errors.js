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

// NOT: Kaynak okuma/silme uçlarında sahiplik ihlali için 404 kullanıyoruz
// (kaydın varlığını gizlemek için). Fotoğraf yükleme ucu bilinçli olarak 403
// döner — istenen davranış buydu ve dosya yükleme zaten var olan bir kayda
// yapıldığı için varlık bilgisi ek bir sızıntı sayılmaz.
class ForbiddenError extends AppError {
  constructor(message = 'Bu işlem için yetkiniz yok') {
    super(message, 403)
  }
}

// Dış servis (Gemini gibi) erişilemediğinde veya anlamsız yanıt verdiğinde.
// 500 DEĞİL: 500 "bizim kodumuz patladı" demektir ve kullanıcıya hiçbir şey
// anlatmaz. 503 "bağımlı olduğumuz servis şu an kullanılamıyor" demektir ve
// mesajı da açıklayıcıdır. /health uç noktası da veritabanı için 503 kullanır.
class ServiceUnavailableError extends AppError {
  constructor(message = 'Servis şu anda kullanılamıyor') {
    super(message, 503)
  }
}

module.exports = {
  AppError,
  ValidationError,
  NotFoundError,
  ConflictError,
  ForbiddenError,
  ServiceUnavailableError,
}
