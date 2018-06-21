const axios = require('axios');
const express = require('express');
const tokens = require('./tokens');

const POLL_INTERVAL = 10;
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
			return JSON.parse(response.data.match(/globalAvailability = (.*?);/)[1]);
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

function poll(chatId, date) {
	return fetchAvailabilityData()
		.then(data => {
			if (data[date] === undefined) {
				// Date is invalid
				// Stop polling and send message
				sendMessage(chatId, 'Unable to poll for date ' + date + ' as it\'s out of range.\n' +
					'Please specify another date.');
				removeDate(chatId, date);
			} else if (data[date] === 0) {
				// Continue polling
				addDate(chatId, date);
				pollingData[chatId].timeout = setTimeout(poll, POLL_INTERVAL * 60 * 1000, chatId, date);
				// sendMessage(chatId, `${ data[date] } places found for date ${ date }. Trying again in ${ POLL_INTERVAL } min.`);
			} else {
				// Places are found
				// Stop polling and send message
				sendMessage(chatId, data[date] + ' places found for date ' + date + '!\n\n' +
					'You can book them here: http://refugedugouter.ffcam.fr/resapublic.html.');
				removeDate(chatId, date);
			}
		});
}

function handleStartPolling(chatId, date) {
	poll(chatId, date);
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

function clearData(chatId) {
	if (pollingData[chatId]) {
		clearTimeout(pollingData[chatId].timeout);
		delete pollingData[chatId];
	}
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
		'	/poll: Init polling. This will ask you to type the date in format YYYY-MM-DD.\n' +
		'	/stop: Stop polling');
	} else if (message.text === '/poll') {
		handlerPromise = sendMessage(chatId, 'Please type the date in format YYYY-MM-DD, e.g. 2018-07-10');
	} else if (message.text.match(/20\d\d-\d\d-\d\d/)) {
		const date = message.text.match(/20\d\d-\d\d-\d\d/)[0];
		handlerPromise = handleStartPolling(chatId, date);
	} else if (message.text === '/stop') {
		handlerPromise = handleStopPolling(chatId);
	} else if (message.text === '/status') {
		handlerPromise = checkStatus(chatId);
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
	poll(chatId, initData[chatId].dates);
}

if (module === require.main) {
	const server = app.listen(process.env.PORT || 8080, () => {
		const port = server.address().port;
		console.log(`App listening on port ${port}`);
	});
}

module.exports = app;