const QuestionController = require('../controllers/QuestionController')
const express = require('express')

const productsRouter = express.Router()

productsRouter.get('/', QuestionController.index)
productsRouter.post(
  '/',
  QuestionController.checkIfSwearing,
  QuestionController.create,
)
productsRouter.patch('/answer', QuestionController.answer)
productsRouter.get('/check-swearing', QuestionController.checkIfSwearing)

module.exports = productsRouter
