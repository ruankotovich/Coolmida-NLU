const coolmida = require('./coolmida_nlu').NLU;
const readline = require('readline');

let rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});

coolmida.train(`train.json`, `stopwords.json`);

function run() {
	rl.question('O que deseja? ', (answer) => {
		console.log("\n");
		for (let response of coolmida.posTagging(answer)) {
			console.log(`${JSON.stringify(response)}`);
		}
		console.log("\n---\n");
		run();
	});

}

run();