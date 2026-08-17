const { Router } = require('express')
const pool = require('../config/database')
const UserRepository = require('../repositories/UserRepository')
const UserService = require('../services/UserService')
const UserController = require('../controllers/UserController')

const userRepository = new UserRepository(pool)
const userService = new UserService(userRepository)
const userController = new UserController(userService)

const router = Router()

router.get('/users/:id', (req, res) => userController.getById(req, res))
router.post('/users', (req, res) => userController.create(req, res))
router.put('/users/:id', (req, res) => userController.update(req, res))
router.delete('/users/:id', (req, res) => userController.delete(req, res))

module.exports = router
