const connection = require('../database/connection')
const fs = require('fs')
const path = require('path')
const { asyncForEach } = require('../utils/functions')
const dir = path.join(__dirname, '..', 'python_files', 'teste.py')
const loc = path.join(__dirname, '..', 'python_files')

module.exports = {
  async index(request, response) {
    try {
      const product_id = request.query.product_id

      const questions = await connection('questions')
        .where('product_id', product_id)
        .select('*')

      return response.json(questions)
    } catch (err) {
      return response.json(`ERRO: ${err}`)
    }
  },

  async index_all(request, response) {
    try {
      const resPerPage = request.query.resPerPage
      const questions = await connection('questions')
        .select('*')
        .limit(resPerPage || 10)

      return response.json(questions)
    } catch (err) {
      return response.json(`ERRO: ${err}`)
    }
  },

  async create(request, response) {
    try {
      const product_id = request.query.product_id
      const { user, question, is_good, status, answer } = request.body
      const errorMsg = request.body.err

      const id = await connection('questions').insert(
        {
          user,
          answer,
          question,
          status,
          product_id,
          is_good,
        },
        'id',
      )
      return response.json({ id, status, question, errorMsg })
    } catch (err) {
      return response.json(`ERRO: ${err}`)
    }
  },

  async verify(request, response, next) {
    try {
      const product_id = request.query.product_id
      const { is_good, tag } = request.body
      if (is_good === 1) {
        next()
      } else if (is_good === 0) {
        if (tag === 'frete') {
          request.body.answer =
            'Todos os fretes são calculados automaticamente. Obrigado !'
        } else if (tag === 'pagamento') {
          request.body.answer =
            'Olá. Aceitamos todos os pagamentos via plataforma'
        } else if (tag === 'valor') {
          const price = await connection('products')
            .where('product_id', product_id)
            .select('price')
          request.body.answer = `Olá. O preço da unidade do produto é de ${price}. Qualquer dúvida estamos a disposição.`
        } else if (tag === 'tamanho') {
          const size = await connection('products')
            .where('product_id', product_id)
            .select('height', 'lenght', 'width')
          request.body.answer = `Olá. As dimensão do produto são: Altura: ${size[0]}, Comprimento: ${size[1]}, Largura: ${size[2]}`
        } else if (tag === 'peso') {
          const weigth = await connection('products')
            .where('product_id', product_id)
            .select('weight')
          request.body.answer = `Olá. O peso do produto é aproximadamente ${weigth} kg`
        } else if (tag === 'cor') {
          const color = await connection('products')
            .where('product_id', product_id)
            .select('color')
          request.body.answer = `Olá. Temos disponivel na(s) cor(es) ${color}`
        } else if (tag === 'estoque') {
          const quantity = await connection('products')
            .where('product_id', product_id)
            .select('quantity')
          request.body.answer = `Olá. Temos disponivel ${quantity} produto(s)`
        }
      }
      next()
    } catch (err) {
      return response.json(err)
    }
  },

  async answer(request, response) {
    try {
      const product_id = request.query.product_id
      const question_id = request.query.question_id

      const { answer } = request.body
      const status = 'manual'

      await connection('questions')
        .where('product_id', product_id)
        .where('id', question_id)
        .update('status', status)
        .update('answer', answer)

      return response.json({ status, answer })
    } catch (err) {
      return response.status(400).send(err)
    }
  },

  async checkIfSwearing(request, response, next) {
    const { question } = request.body
    let swearing = false
    let errorMsg = 'This question has swearing. Marking as spam...'

    const dataSet = fs
      .readFileSync(path.join(__dirname, '..', 'python', 'palavroes.csv'))
      .toString()
      .split(/[\n\r\;]+[^a-z]+/gi) // Read CSV as array
    const firstItem = dataSet[0].substr(2) // Fix bug at first item
    dataSet[0] = firstItem
    // console.dir(dataSet);

    await asyncForEach(dataSet, async (element, index) => {
      // const regexp = new RegExp(element, "g");
      // const regexp = /\b(\w*${element}\w*)\b/g;
      if (
        question.toLowerCase().includes(element.toLowerCase()) &&
        index !== dataSet.length // May be improved for Regex usage
      ) {
        // if (question.toLowerCase().match(regexp) && index !== (dataSet.length-1)) {
        swearing = true
        errorMsg += element
        // console.log(`${errorMsg} at ${index}`)
      }
    })

    if (swearing) {
      request.body.status = 'deleted'
      request.body.err = errorMsg
      return next()
    } else {
      request.body.status = 'new'
      next()
    }
  },

  async getAwaitingCount(request, response) {
    try {
      const questions = await connection('questions')
        .where('status', 'waiting')
        .countDistinct()

      return response.json(questions)
    } catch (err) {
      return response.json(`ERRO: ${err}`)
    }
  },

  async getPredictions(request, response, next) {
    try {
      const status = request.body.status
      console.log(status)

      if (status === 'new') {
        console.log('oi gente')
        const product_id = request.query.product_id
        const question = request.body.question
        const spawn = require('child_process').spawn
        const pythonProcess = spawn('python3', [dir, product_id, question, loc])

        await pythonProcess.stdout.on('data', data => {
          const str_data = data.toString().trim()

          const array_data = str_data.split('\n')

          const results_json = JSON.parse(array_data[array_data.length - 1])

          request.is_good = results_json.is_good
          request.status = results_json.status
          request.tag = results_json.tag
          console.log(results_json)
        })
      }
      next()
    } catch (err) {
      response.json(err)
    }
  },
}
