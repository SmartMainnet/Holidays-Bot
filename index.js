import 'dotenv/config'
import { MongoClient } from 'mongodb'
import TelegramApi from 'node-telegram-bot-api'
import axios from 'axios'
import cheerio from 'cheerio'

const { BOT_TOKEN, MONGODB_URI, STICKER } = process.env

const client = new MongoClient(MONGODB_URI)

client.connect()

const db = client.db('holidays-bot')
const users = db.collection('users')

const bot = new TelegramApi(BOT_TOKEN, { polling: true })

const reply_markup = JSON.stringify({
  keyboard: [
    [{text: '🎂 Какой сегодня праздник?', callback_data: '0'}]
  ],
  resize_keyboard: true
})

bot.on('message', async msg => {
  const text = msg.text
  const chatId = msg.chat.id

  try {
    if (text === '/start') {
      await bot.sendSticker(chatId, STICKER)
      await bot.sendMessage(chatId,
        `👋🏻 Привет ${msg.from.first_name}${(msg.from.last_name === undefined) ? '': ` ${msg.from.last_name}`}!\n` +
        '🎂 Это Holidays Bot.\n' +
        '👨🏻‍💻 Автор: @SmartMainnet',
        { reply_markup }
      )
      await bot.sendMessage(chatId,
        'С помощью этого бота\n' +
        'ты можешь узнать\n' +
        'какой сегодня праздник!'
      )

      await users.findOne({ id: chatId }).then(async res => {
        if (!res) {
          await users.insertOne({
            id: chatId,
            username: msg.from.username,
            first_name: msg.from.first_name,
            last_name: msg.from.last_name,
            start_date: new Date(),
            calls: 0
          })
        }
      })
    } else if (text === '🎂 Какой сегодня праздник?') {
      axios.get('https://my-calend.ru/holidays').then(html => {
        const $ = cheerio.load(html.data)
        let selector = 'body > div.wrapper > main > div.holidays.main > article > section:nth-child(5) > ul > li > a'
        let text = ''
        $(selector).each((i, elem) => {
          let name = $(elem).text()
          let url = $(elem).attr('href')
          let message = `${i+1}: <a href='${url}'>${name}</a>\n`
          text += message
        })
        bot.sendMessage(chatId, text, { parse_mode: 'HTML', disable_web_page_preview: true, reply_markup })
      })

      await users.updateOne({ id: chatId },
        {
          $set: {
            username: msg.from.username,
            first_name: msg.from.first_name,
            last_name: msg.from.last_name,
            date_last_call: new Date()
          },
          $inc: { number_calls: 1 },
          $push: { calls: new Date() }
        }
      )
    } else {
      await bot.sendMessage(chatId, 'Нажмите на кнопоку ниже\nчтобы узнать какой сегодня праздник 👇🏻', { reply_markup })

      await users.updateOne({ id: chatId },
        {
          $set: {
            username: msg.from.username,
            first_name: msg.from.first_name,
            last_name: msg.from.last_name,
            date_last_bad_call: new Date(),
            last_bad_call: text
          },
          $inc: { number_bad_calls: 1 },
          $push: {
            bad_calls: {
              call: text,
              date: new Date()
            }
          }
        }
      )
    }
  } catch {
    await bot.sendMessage(chatId, 'Что-то пошло не так')
  }
})