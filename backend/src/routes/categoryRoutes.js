const { Router } = require('express')
const pool = require('../config/database')
const CategoryRepository = require('../repositories/CategoryRepository')
const CategoryService = require('../services/CategoryService')
const CategoryController = require('../controllers/CategoryController')

const categoryRepository = new CategoryRepository(pool)
const categoryService = new CategoryService(categoryRepository)
const categoryController = new CategoryController(categoryService)

const router = Router()

router.get('/categories', (req, res) => categoryController.getAll(req, res))
router.get('/categories/:id', (req, res) => categoryController.getById(req, res))

module.exports = router
