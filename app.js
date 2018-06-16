const axios = require('axios');
const tokens = require('./tokens');

function sendMessage(res, options) {
    const token = tokens.botToken;
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    axios.post(url, {
      chat_id: options.chatId,
      text: options.text
    })
    .then(function (response) {
      res.send({ status: 'OK' });
    })
    .catch(function (error) {
      console.log(error);
      res.sendStatus(500);
    });
}

const express = require('express');
const app = express();

app.use(express.json());

app.get('/', (req, res) => {
  res.status(200).send('Hello, my bot!');
});

app.post('/bot/' + tokens.webhookToken, (req, res) => {
	const message = req.body.message;
    const options = {
      text: `Hello ${message.from.first_name} ${message.from.last_name}!
      
      ${JSON.stringify(message, null, 2)}`,
      chatId: message.chat.id
    };
    sendMessage(res, options);
});

if (module === require.main) {
  const server = app.listen(process.env.PORT || 8080, () => {
    const port = server.address().port;
    console.log(`App listening on port ${port}`);
  });
}

module.exports = app;