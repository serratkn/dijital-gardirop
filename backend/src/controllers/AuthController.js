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
