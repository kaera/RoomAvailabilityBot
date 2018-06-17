const axios = require('axios');
const express = require('express');
const tokens = require('./tokens');
const pollingData = {};

const app = express();

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

app.use(express.json());

app.get('/', (req, res) => {
  res.status(200).send('Hello, my bot!');
});

app.post('/bot/' + tokens.webhookToken, (req, res) => {
	const message = req.body.message;
	let responseText;
	if (message.text === '/poll') {
		// 1. Init polling
		responseText = 'Please enter the date in format YYYY-MM-DD, e.g. 2018-07-10';
	} else if (message.text.match(/20\d\d-\d\d-\d\d/)) {
		const date = message.text.match(/20\d\d-\d\d-\d\d/)[0];
		pollingData[message.from.username] = date;
		responseText = 'Starting polling availability for date ' + date;
	} else if (message.text === '/stop') {
		responseText = 'Polling cancelled for date ' + pollingData[message.from.username];
	} else {
		responseText = `Hello ${message.from.first_name} ${message.from.last_name}!
      
      ${JSON.stringify(message, null, 2)}`;
	}
	
    const options = {
      text: responseText,
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