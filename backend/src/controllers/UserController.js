const BaseController = require('./BaseController')

class UserController extends BaseController {
  constructor(userService) {
    super()
    this.userService = userService
  }

  async getById(req, res) {
    try {
      const user = await this.userService.getUserById(req.params.id)
      res.status(200).json(user)
    } catch (error) {
      this.handleError(error, res)
    }
  }

  async create(req, res) {
    try {
      const user = await this.userService.createUser(req.body)
      res.status(201).json(user)
    } catch (error) {
      this.handleError(error, res)
    }
  }

  async update(req, res) {
    try {
      const user = await this.userService.updateUser(req.params.id, req.body)
      res.status(200).json(user)
    } catch (error) {
      this.handleError(error, res)
    }
  }

  async delete(req, res) {
    try {
      await this.userService.deleteUser(req.params.id)
      res.status(204).send()
    } catch (error) {
      this.handleError(error, res)
    }
  }
}

module.exports = UserController
