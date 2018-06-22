const axios = require('axios');
const express = require('express');
const tokens = require('./tokens');

let pollInterval = 10 * 60;
let dataCache;
const pollingData = {};
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
			const data = response.data.match(/globalAvailability = (.*?);/)[1];
			//if (data === dataCache) {
			//	pollInterval = Math.min(pollInterval * 2, 30 * 60);
			//} else {
			//	pollInterval = Math.max(pollInterval / 2, 10);
			//}
			//dataCache = data;
			console.log('pollInterval', pollInterval);
			return JSON.parse(data);
		});
}

function addDate(chatId, date) {
	if (!pollingData[chatId]) {
		pollingData[chatId] = { dates: new Set() };
	}
	pollingData[chatId].dates.add(date);
}

function removeDate(chatId, date) {
	if (pollingData[chatId]) {
		pollingData[chatId].dates.delete(date);
	}
}

function poll(chatId) {
	return fetchAvailabilityData()
		.then(data => {
			const dates = [...pollingData[chatId].dates];
			const invalidDates = [];
			const pendingDates = [];
			const availableDates = [];
			dates.forEach(date => {
				if (data[date] === undefined) {
					invalidDates.push(date);
					removeDate(chatId, date);
				} else if (data[date] === 0) {
					pendingDates.push(date);
				} else {
					availableDates.push(date);
					removeDate(chatId, date);
				}
			});
			if (invalidDates.length) {
				sendMessage(chatId, 'Unable to poll for date ' + invalidDates.join(', ') + ' as it\'s out of range');
			}
			if (pendingDates.length) {
				pollingData[chatId].timeout = setTimeout(poll, pollInterval * 1000, chatId);
			}
			if (availableDates.length) {
				sendMessage(chatId, 'Places found for date ' + availableDates.join(', ') + '.\n\n' +
					'You can book them here: http://refugedugouter.ffcam.fr/resapublic.html.');
			}
		});
}

function handleStartPolling(chatId, date) {
	addDate(chatId, date);
	poll(chatId);
	return sendMessage(chatId, 'Starting polling availability for date ' + date);
}

function handleStopPolling(chatId, date) {
	let message;
	if (pollingData[chatId] && pollingData[chatId].dates.has(date)) {
		message = 'Polling cancelled for date ' + date;
		removeDate(chatId, date);
	} else {
		message = 'There were no polling processes for date ' + date;
	}
	return sendMessage(chatId, message);
}

function handleClearCommand(chatId) {
	const dates = pollingData[chatId] && [...pollingData[chatId].dates].sort() || [];
	let message;
	if (dates.length) {
		message = 'Polling processes for dates ' + dates.join(', ') + ' are stopped';
		pollingData[chatId].dates.clear();
	} else {
		message = 'No processes to stop';
	}
	return sendMessage(chatId, message);
}

function checkStatus(chatId) {
	const dates = pollingData[chatId] && [...pollingData[chatId].dates].sort() || [];
	let message;
	if (dates.length) {
		message = 'Polling processes are run for dates ' + dates.join(', ');
	} else {
		message = 'No processes running';
	}
	return sendMessage(chatId, message);
}

app.use(express.json());

app.get('/', (req, res) => {
	res.status(200).send('Hello, my bot!');
});

app.get('/getDataCache', (req, res) => {
	res.status(200).send(dataCache);
});

app.get('/getInfo', (req, res) => {
	const result = {};
	for (let chatId in pollingData) {
		result[chatId] = { dates: [...pollingData[chatId].dates].sort() };
	}
	res.status(200).send(result);
});

app.get('/status', (req, res) => {
	checkStatus(req.query.chatId)
		.then(function () {
			res.send({ status: 'ok'});
		})
		.catch(error => {
			console.log(error);
			res.status(500).send('Error');
		});
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
	handleStopPolling(req.query.chatId, req.query.date)
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
		'	/status: List current polling processes.\n' +
		'	poll [date]: Init polling for a date in format YYYY-MM-DD, e.g. "poll 2018-07-10".\n' +
		'	stop [date]: Stop polling for a date in format YYYY-MM-DD, e.g. "stop 2018-07-10".\n' +
		'	/clear: Stop all polling processes.');
	} else if (message.text === '/status') {
		handlerPromise = checkStatus(chatId);
	} else if (message.text === '/clear') {
		handlerPromise = handleClearCommand(chatId);
	} else if (message.text.match(/^poll/i)) {
		const date = message.text.match(/20\d\d-\d\d-\d\d/);
		if (date) {
			handlerPromise = handleStartPolling(chatId, date[0]);
		} else {
			handlerPromise = sendMessage(chatId, 'Couldn\'t parse the date. ' +
				'Please enter the date in format YYYY-MM-DD, e.g. "poll 2018-07-10".');
		}
	} else if (message.text.match(/^stop/i)) {
		const date = message.text.match(/20\d\d-\d\d-\d\d/);
		if (date) {
			handlerPromise = handleStopPolling(chatId, date[0]);
		} else {
			handlerPromise = sendMessage(chatId, 'Couldn\'t parse the date. ' +
				'Please enter the date in format YYYY-MM-DD, e.g. "stop 2018-07-10".');
		}
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
	initData[chatId].dates.forEach(date => addDate(chatId, date));
	poll(chatId);
}

if (module === require.main) {
	const server = app.listen(process.env.PORT || 8080, () => {
		const port = server.address().port;
		console.log(`App listening on port ${port}`);
	});
}

module.exports = app;