require('dotenv').config()
const { STICKER, BOT_API, MONGODB_URI } = process.env

const { MongoClient } = require('mongodb')
const client = new MongoClient(MONGODB_URI)

client.connect()
const db = client.db('holidays-bot')

const users = db.collection('users')
const info = db.collection('info')

const axios = require("axios")
const cheerio = require("cheerio")

const TelegramApi = require('node-telegram-bot-api')

const token = BOT_API
const bot = new TelegramApi(token, { polling: true })

const option = {
    reply_markup: JSON.stringify({
        keyboard: [
            [{text: '🎂 Какой сегодня праздник?', callback_data: '0'}]
        ],
        resize_keyboard: true
    })
}

let isPost = false

bot.on('message', async (msg) => {
    const text = msg.text
    const chatId = msg.chat.id

    if (text === '/start') {
        await bot.sendSticker(chatId, STICKER)
        await bot.sendMessage(chatId,
            `👋🏻 Привет ${msg.from.first_name}${(msg.from.last_name === undefined) ? '': ` ${msg.from.last_name}`}!\n` +
            '🎂 Это Holidays Bot.\n' +
            '👨🏻‍💻 Автор: @SmartMainnet',
            option
        )
        await bot.sendMessage(chatId,
            'С помощью этого бота\n' +
            'ты можешь узнать\n' +
            'какой сегодня праздник!'
        )

        await users.findOne({ id: chatId }).then(async res => {
            if (res === null) {
                await users.insertOne({
                    id: chatId,
                    username: msg.from.username,
                    first_name: msg.from.first_name,
                    last_name: msg.from.last_name,
                    start_date: new Date(),
                    calls: 0
                })

                await info.findOne().then(async res => {
                    if (res === null) {
                        await info.insertOne({ users: 1 })
                    } else {
                        await info.updateOne({}, { $inc: { users: 1 } })
                    }
                })
            }
        })
    } else if (text === '/post' && msg.from.username === 'SmartMainnet') {
        await bot.sendMessage(chatId, 'Отправь мне пост')
        isPost = true
    } else if (isPost === true && msg.from.username === 'SmartMainnet') {
        users.find().toArray(async (err, res) => {
            for (let user of res) {
                let chatId = user.id
                await bot.sendMessage(chatId, text)
            }
        })
        isPost = false
    } else if (text === '🎂 Какой сегодня праздник?') {
        try {
            axios.get('https://my-calend.ru/holidays').then(html => {
                const $ = cheerio.load(html.data)
                let selector = 'body > div.wrapper > main > div.holidays.main > article > section:nth-child(5) > ul > li > a'
                let text = ''
                $(selector).each((i, elem) => {
                    let name = $(elem).text()
                    let url = $(elem).attr('href')
                    let message = `${i+1}: <a href="${url}">${name}</a>\n`
                    text += message
                })
                bot.sendMessage(chatId, text, {parse_mode: 'HTML', disable_web_page_preview: true})
            })

            await users.updateOne({ id: chatId },
                {
                    $set: {
                        username: msg.from.username,
                        first_name: msg.from.first_name,
                        last_name: msg.from.last_name,
                        date_last_call: new Date()
                    },
                    $inc: { calls: 1 }
                }
            )
            await info.updateOne({}, { $inc: { calls: 1 } })
        } catch {
            await bot.sendMessage(chatId, 'Error')
        }
    }
})