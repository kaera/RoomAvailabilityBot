const axios = require('axios');
const express = require('express');
const tokens = require('./tokens');
const pollingData = {};
const timeouts = {};

const app = express();

function sendMessage(chatId, text) {
	return axios.post(`https://api.telegram.org/bot${ tokens.botToken }/sendMessage`, {
		chat_id: chatId,
		text: text
	});
}

function fetchAvailabilityData() {
	return axios({
		    method: 'post',
		    url: 'https://centrale.ffcam.fr/index.php',
		    data: 'structure=BK_STRUCTURE:30'
		})
		.then(function (response) {
			return JSON.parse(response.data.match(/globalAvailability = (.*?);/)[1]);
		});
}

function poll(date, chatId) {
	return fetchAvailabilityData()
		.then(data => {
			if (data[date] === undefined) {
				// Date is invalid
				// Stop polling and send message
				sendMessage(chatId, `Unable to poll for date ${ date } as it's out of range. Please specify new date.`);
			} else if (data[date] === 0) {
				// Continue polling
				timeouts[chatId] = setTimeout(poll, 30 * 60 * 1000, date, chatId);
				sendMessage(chatId, `${ data[date] } places found for date ${ date }. Try again in 1 min.`);
			} else {
				// Places are found
				// Stop polling and send message
				sendMessage(chatId, `${ data[date] } places found for date ${ date }! You can book them here: http://refugedugouter.ffcam.fr/resapublic.html.`);
			}
		});
}

app.use(express.json());

app.get('/', (req, res) => {
  res.status(200).send('Hello, my bot!');
});

app.get('/start', (req, res) => {
	poll('2018-06-25', 174442510)
		.then(function () {
			res.send({ status: 'ok'});
		})
		.catch(error => {
			console.log(error);
			res.status(500).send('Error');
		});
});

app.get('/stop', (req, res) => {
	const chatId = 174442510;
	clearTimeout(timeouts[chatId]);
	sendMessage(chatId, 'Polling cancelled for date ' + pollingData[chatId])
		.then(function () {
			res.send({ status: 'ok'});
		})
		.catch(error => {
			console.log(error);
			res.status(500).send('Error');
		});
});

app.get('/debug', (req, res) => {
	// poll('2017-01-01', 174442510)
	poll('2018-09-25', 174442510)
		.then(function () {
			res.send({ status: 'ok'});
		})
		.catch(error => {
			console.log(error);
			res.status(500).send('Error');
		});
});

app.post('/bot/' + tokens.webhookToken, (req, res) => {
	const message = req.body.message;
	const chatId = message.chat.id;
	let responseText = '';
	if (message.text === '/poll') {
		responseText = 'Please enter the date in format YYYY-MM-DD, e.g. 2018-07-10';
	} else if (message.text.match(/20\d\d-\d\d-\d\d/)) {
		const date = message.text.match(/20\d\d-\d\d-\d\d/)[0];
		if (pollingData[chatId]) {
			responseText = 'Polling cancelled for date ' + pollingData[chatId] + '.\n\n';
		}
		pollingData[chatId] = date;
		responseText += 'Starting polling availability for date ' + date;
		poll(date, chatId);
	} else if (message.text === '/stop') {
		responseText = 'Polling cancelled for date ' + pollingData[chatId];
		clearTimeout(timeouts[chatId]);
	} else {
		responseText = 'Couldn\'t recognize the message. Please, try again :)';
		console.log(message.text);
	}
    
	sendMessage(chatId, responseText)
		.then(function () {
			res.send({ status: 'OK' });
		})
		.catch(function (error) {
			console.log(error);
			res.sendStatus(500);
		});
});

if (module === require.main) {
  const server = app.listen(process.env.PORT || 8080, () => {
    const port = server.address().port;
    console.log(`App listening on port ${port}`);
  });
}

module.exports = app;