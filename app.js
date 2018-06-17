const axios = require('axios');
const express = require('express');
const tokens = require('./tokens');
const POLL_INTERVAL = 1;
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

function poll(chatId, date) {
	return fetchAvailabilityData()
		.then(data => {
			if (data[date] === undefined) {
				// Date is invalid
				// Stop polling and send message
				sendMessage(chatId, `Unable to poll for date ${ date } as it's out of range. Please specify another date.`);
				delete pollingData[chatId];
			} else if (data[date] === 0) {
				// Continue polling
				timeouts[chatId] = setTimeout(poll, POLL_INTERVAL * 60 * 1000, chatId, date);
				sendMessage(chatId, `${ data[date] } places found for date ${ date }. Try again in ${ POLL_INTERVAL } min.`);
			} else {
				// Places are found
				// Stop polling and send message
				sendMessage(chatId, `${ data[date] } places found for date ${ date }! You can book them here: http://refugedugouter.ffcam.fr/resapublic.html.`);
			}
		});
}

function handleStartPolling(chatId, date) {
	let responseText = '';
	if (pollingData[chatId]) {
		responseText = 'Polling cancelled for date ' + pollingData[chatId] + '.\n\n';
	}
	pollingData[chatId] = date;
	responseText += 'Starting polling availability for date ' + date;
	poll(chatId, date);

	return sendMessage(chatId, responseText);
}

function handleStopCommand(chatId) {
	clearTimeout(timeouts[chatId]);
	delete pollingData[chatId];
	return sendMessage(chatId, 'Polling cancelled for date ' + pollingData[chatId]);
}

app.use(express.json());

app.get('/', (req, res) => {
	res.status(200).send('Hello, my bot!');
});

app.get('/getInfo', (req, res) => {
	res.status(200).send(pollingData);
});

app.get('/start', (req, res) => {
	handleStartPolling(Number(req.query.chatId), req.query.date)
		.then(function () {
			res.send({ status: 'ok'});
		})
		.catch(error => {
			console.log(error);
			res.status(500).send('Error');
		});
});

app.get('/stop', (req, res) => {
	handleStopCommand(Number(req.query.chatId))
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
	let handlerPromise;
	if (message.text === '/poll') {
		handlerPromise = sendMessage(chatId, 'Please enter the date in format YYYY-MM-DD, e.g. 2018-07-10');
	} else if (message.text.match(/20\d\d-\d\d-\d\d/)) {
		const date = message.text.match(/20\d\d-\d\d-\d\d/)[0];
		handlerPromise = handleStartPolling(chatId, date)
	} else if (message.text === '/stop') {
		handlerPromise = handleStopCommand(chatId)
	} else {
		console.log(message.text);
		handlerPromise = sendMessage(chatId, 'Couldn\'t recognize the message. Please, try again :)');
	}
    
	handlerPromise
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