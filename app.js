const axios = require('axios');
const express = require('express');
const tokens = require('./tokens');
const db = require('./db-client');

let pollInterval = 5 * 60 * 1000;
let requestTimeoutId;
let dataCache;
const pollingData = {};
const app = express();

function sendMessage(chatId, text) {
	return axios.post(`https://api.telegram.org/bot${ tokens.botToken }/sendMessage`, {
		chat_id: chatId,
		text: text
	});
}

const PubSub = {
	subscribers: {
		update: {}
	},
	subscribe: function(event, id, f) {
		this.subscribers[event][id] = f;
	},
	unsubscribe: function(event, id) {
		delete this.subscribers[event][id];
	},
	isSubscribed: function(event, id) {
		return this.subscribers[event][id];
	},
	trigger: function(event, data) {
		for (let f of Object.values(this.subscribers[event])) {
			f(data);
		}
	}
};

function requestUpdate() {
	if (Object.values(PubSub.subscribers.update).length === 0) {
		console.log('No subscribers registered. Halting the polling process.');
		return;
	}

	const url = 'https://centrale.ffcam.fr/index.php';
	console.log('Sending request to', url);
	clearTimeout(requestTimeoutId);
	axios({
		    method: 'post',
		    url: url,
		    data: 'structure=BK_STRUCTURE:30'
		})
		.then(function (response) {
			const data = response.data.match(/globalAvailability = (.*?);/)[1];
			PubSub.trigger('update', JSON.parse(data));
			requestTimeoutId = setTimeout(requestUpdate, pollInterval);
		})
		.catch(function (error) {
			console.log(error);
			requestTimeoutId = setTimeout(requestUpdate, pollInterval);
		});
}

function addDate(chatId, date) {
	if (!pollingData[chatId]) {
		pollingData[chatId] = { dates: new Set() };
	}
	pollingData[chatId].dates.add(date);
	console.log('Date', date, 'added for chat id', chatId);
	if (!PubSub.isSubscribed('update', chatId)) {
		console.log('Chat id', chatId, 'has subscribed for data updates');
		PubSub.subscribe('update', chatId, function(data) {
			const dates = [...pollingData[chatId].dates];
			const invalidDates = [];
			const availableDates = [];
			console.log('Checking data for chat id:', chatId, 'dates: ', dates.join(', '));
			dates.forEach(date => {
				if (data[date] === undefined) {
					invalidDates.push(date);
					removeDate(chatId, date);
				} else if (data[date] > 0) {
					availableDates.push(date);
					//removeDate(chatId, date);
				}
			});
			if (invalidDates.length) {
				sendMessage(chatId, 'Unable to poll for date ' + invalidDates.join(', ') + ' as it\'s out of range');
			}
			if (availableDates.length) {
				sendMessage(chatId, 'Places found for date ' + availableDates.join(', ') + '.\n\n' +
					'You can book them here: http://refugedugouter.ffcam.fr/resapublic.html.');
				console.log('Sending success message for chat id:', chatId, 'date:', availableDates.join(', '));
			}
		});
	}
}

function removeDate(chatId, date) {
	if (pollingData[chatId]) {
		pollingData[chatId].dates.delete(date);
		if (pollingData[chatId].dates.size === 0) {
			PubSub.unsubscribe('update', chatId);
			console.log('Chat id', chatId, 'has unsubscribed from data updates');
		}
	}
}

function handleStartPolling(chatId, date) {
	addDate(chatId, date);
	requestUpdate();
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

app.get('/set', (req, res) => {
	db.updateDate(req.query.chatId, req.query.date)
		.then(_ => {
			res.status(200).send('ok');
		});
});
app.get('/del', (req, res) => {
	db.removeDate(req.query.chatId, req.query.date)
		.then(_ => {
			res.status(200).send('ok');
		});
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
		'	poll [date]: Init polling for a date in format YYYY-MM-DD, e.g. poll 2018-07-10.\n' +
		'	stop [date]: Stop polling for a date in format YYYY-MM-DD, e.g. stop 2018-07-10.\n' +
		'	/clear: Stop all polling processes.');
	} else if (message.text === '/status') {
		handlerPromise = checkStatus(chatId);
	} else if (message.text === '/clear') {
		handlerPromise = handleClearCommand(chatId);
	} else if (message.text.match(/^\/?poll/i)) {
		const date = message.text.match(/20\d\d-\d\d-\d\d/);
		if (date) {
			handlerPromise = handleStartPolling(chatId, date[0]);
		} else {
			handlerPromise = sendMessage(chatId, 'Couldn\'t parse the date. ' +
				'Please enter the date in format YYYY-MM-DD, e.g. "poll 2018-07-10".');
		}
	} else if (message.text.match(/^\/?stop/i)) {
		const date = message.text.match(/20\d\d-\d\d-\d\d/);
		if (date) {
			handlerPromise = handleStopPolling(chatId, date[0]);
		} else {
			handlerPromise = sendMessage(chatId, 'Couldn\'t parse the date. ' +
				'Please enter the date in format YYYY-MM-DD, e.g. "stop 2018-07-10".');
		}
	} else {
		console.log(message.text);
		handlerPromise = sendMessage(chatId, 'I can understand the following commands:\n' +
		'	/status: List current polling processes.\n' +
		'	poll [date]: Init polling for a date in format YYYY-MM-DD, e.g. poll 2018-07-10.\n' +
		'	stop [date]: Stop polling for a date in format YYYY-MM-DD, e.g. stop 2018-07-10.\n' +
		'	/clear: Stop all polling processes.');
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