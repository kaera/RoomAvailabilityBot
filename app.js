const axios = require('axios');
const express = require('express');
const tokens = require('./tokens');

const POLL_INTERVAL = 30;
const pollingData = {};
const app = express();

function sendMessage(chatId, text) {
	return axios.post(`https://api.telegram.org/bot${ tokens.botToken }/sendMessage`, {
		chat_id: chatId,
		text: text.replace(/^\s+/g, '')
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
				sendMessage(chatId, 'Unable to poll for date ' + date + ' as it\'s out of range.\n' +
					'Please specify another date.');
				clearData(chatId);
			} else if (data[date] === 0) {
				// Continue polling
				pollingData[chatId] = {
					date: date,
					timeout: setTimeout(poll, POLL_INTERVAL * 60 * 1000, chatId, date)
				};
				// sendMessage(chatId, `${ data[date] } places found for date ${ date }. Trying again in ${ POLL_INTERVAL } min.`);
			} else {
				// Places are found
				// Stop polling and send message
				sendMessage(chatId, data[date] + ' places found for date ' + date + '!\n\n' +
					'You can book them here: http://refugedugouter.ffcam.fr/resapublic.html.');
				clearData(chatId);
			}
		});
}

function handleStartPolling(chatId, date) {
	let responseText = '';
	if (pollingData[chatId]) {
		responseText = 'Polling cancelled for date ' + pollingData[chatId].date + '.\n\n';
		clearData(chatId);
	}
	responseText += 'Starting polling availability for date ' + date;
	poll(chatId, date);

	return sendMessage(chatId, responseText);
}

function handleStopCommand(chatId) {
	const date = pollingData[chatId] && pollingData[chatId].date;
	clearData(chatId);
	return sendMessage(chatId, date ? 'Polling cancelled for date ' + date : 'No polling process to stop.');
}

function clearData(chatId) {
	if (pollingData[chatId]) {
		clearTimeout(pollingData[chatId].timeout);
		delete pollingData[chatId];
	}
}

app.use(express.json());

app.get('/', (req, res) => {
	res.status(200).send('Hello, my bot!');
});

app.get('/getInfo', (req, res) => {
	const result = {};
	for (let chatId in pollingData) {
		result[chatId] = { date: pollingData[chatId].date };
	}
	res.status(200).send(result);
});

app.get('/start', (req, res) => {
	handleStartPolling(req.query.chatId, req.query.date)
		.then(function () {
			res.send({ status: 'ok'});
		})
		.catch(error => {
			console.log(error);
			res.status(500).send('Error');
		});
});

app.get('/stop', (req, res) => {
	handleStopCommand(req.query.chatId)
		.then(function () {
			res.send({ status: 'ok'});
		})
		.catch(error => {
			console.log(error);
			res.status(500).send('Error');
		});
});

app.post('/bot/' + tokens.webhookToken, (req, res) => {
	const message = req.body.message || req.body.edited_message;
	if (!message) {
		console.log(JSON.stringify(req.body));
		res.send({ status: 'OK' });
		return;
	}
	const chatId = message.chat.id;
	let handlerPromise;
	if (message.text === '/start') {
		handlerPromise = sendMessage(chatId, 'Hi. I\'m here to help you find available places in Refuge du Goûter.\n\n' +
		'I can understand the following commands:\n' +
		'	/poll: Init polling. This will ask you to type the date in format YYYY-MM-DD.\n' +
		'	/stop: Stop polling');
	} else if (message.text === '/poll') {
		handlerPromise = sendMessage(chatId, 'Please type the date in format YYYY-MM-DD, e.g. 2018-07-10');
	} else if (message.text.match(/20\d\d-\d\d-\d\d/)) {
		const date = message.text.match(/20\d\d-\d\d-\d\d/)[0];
		handlerPromise = handleStartPolling(chatId, date);
	} else if (message.text === '/stop') {
		handlerPromise = handleStopCommand(chatId);
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

const initData = require('./init_data');
for (let chatId in initData) {
	poll(chatId, initData[chatId].date);
}

if (module === require.main) {
	const server = app.listen(process.env.PORT || 8080, () => {
		const port = server.address().port;
		console.log(`App listening on port ${port}`);
	});
}

module.exports = app;