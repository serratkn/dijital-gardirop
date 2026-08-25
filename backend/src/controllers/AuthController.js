const BaseController = require('./BaseController')

class AuthController extends BaseController {
  constructor(authService) {
    super()
    this.authService = authService
  }

  async register(req, res) {
    try {
      const result = await this.authService.register(req.body)
      res.status(201).json(result)
    } catch (error) {
      this.handleError(error, res)
    }
  }

  async login(req, res) {
    try {
      const result = await this.authService.login(req.body)
      res.status(200).json(result)
    } catch (error) {
      this.handleError(error, res)
    }
  }

  // Korumasız — access token'ın SÜRESİ ZATEN DOLDUĞU için buraya bir Bearer
  // token'la gelinmez; kimlik body'deki refresh token'ın İÇİNE gömülüdür
  // (bkz. AuthService.refresh > #extractUserIdFromRefreshToken).
  async refresh(req, res) {
    try {
      const tokens = await this.authService.refresh(req.body?.refreshToken)
      res.status(200).json(tokens)
    } catch (error) {
      this.handleError(error, res)
    }
  }

  // Korumalı: req.userId auth middleware tarafından doldurulur. Body'de
  // refresh token GEREKMEZ — kullanıcının HANGİ refresh token'ı sakladığını
  // bilmemize gerek yok, DB'de o kullanıcı için ne varsa temizlenir.
  async logout(req, res) {
    try {
      await this.authService.logout(req.userId)
      res.status(204).send()
    } catch (error) {
      this.handleError(error, res)
    }
  }

  // Korumalı: req.userId auth middleware tarafından doldurulur.
  async me(req, res) {
    try {
      const user = await this.authService.getCurrentUser(req.userId)
      res.status(200).json(user)
    } catch (error) {
      this.handleError(error, res)
    }
  }

  async changePassword(req, res) {
    try {
      await this.authService.changePassword(req.userId, req.body)
      res.status(204).send()
    } catch (error) {
      this.handleError(error, res)
    }
  }
}

module.exports = AuthController
