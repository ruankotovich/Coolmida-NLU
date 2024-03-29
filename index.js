const Coolmida = require('./coolmida_nlu').NLU;
const Joi = require('joi');

// const readline = require('readline');
const app = require('express')();
const port = 6666;

// let rl = readline.createInterface({
// 	input: process.stdin,
// 	output: process.stdout
// });

(() => {
	console.log("Training classifier...");
	Coolmida.train(`train.json`, `stopwords.json`).then(() => {
		console.log("Successfully trained classifier!");

		console.log("Setting up routes...");

		app.get('/nlu/intention', (req, res) => {

			console.log(`/nlu/intention/`, req.query);

			const input = Joi.validate(req.query, Joi.object().keys({
				query: Joi.string().required()
			}));

			if (input.error) {
				console.error(input.error.toString());
				return res.status(422).send(input.error.toString());
			} else {
				try {
					let processedInput = Coolmida.intentionDetect(input.value.query);
					console.log(`Successfully returned`);
					return res.status(200).send(processedInput);
				} catch (err) {
					console.error(err);
					return res.status(500).send(err.toString());
				}
			}

		});

		app.get('/nlu/search', (req, res) => {

			console.log(`/nlu/search/`, req.query);

			const input = Joi.validate(req.query, Joi.object().keys({
				query: Joi.string().required()
			}));

			if (input.error) {
				console.error(input.error.toString());
				return res.status(422).send(input.error.toString());
			} else {
				try {
					let processedInput = Coolmida.search(input.value.query);
					console.log(`Successfully returned`);
					return res.status(200).send(processedInput);
				} catch (err) {
					console.error(err);
					return res.status(500).send(err.toString());
				}
			}

		});

		app.get('/nlu/postag', (req, res) => {

			console.log(`/nlu/postag/`, req.query);

			const input = Joi.validate(req.query, Joi.object().keys({
				query: Joi.string().required()
			}));

			if (input.error) {
				console.error(input.error.toString());
				return res.status(422).send(input.error.toString());
			} else {
				try {
					let processedInput = Coolmida.posTagging(input.value.query);
					console.log(`Successfully returned`);
					return res.status(200).send(processedInput);
				} catch (err) {
					console.error(err);
					return res.status(500).send(err.toString());
				}
			}

		});

		console.log(`Preparing to listen port ${port}...`);
		app.listen(port, () => {
			console.log(`Coolmida NLU module is listening on port ${port}\nAll done.`);
		});

	});
})();
