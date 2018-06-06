const natural = require('natural');
const fs = require('fs');
const diacritics = require('diacritics');

let tokenizer = new natural.OrthographyTokenizer({ language: "pt" })
let classifier = new natural.BayesClassifier();

class CoolmidaNLU {

	constructor(td, sws) {
		this.trainData = JSON.parse(fs.readFileSync(td, (e) => { console.error(e.toString()) }));
		this.stopwordSet = new Set(JSON.parse(fs.readFileSync(sws, (e) => { console.error(e.toString()); })));
		this.train();
	}

	posTagging(w) {
		let out = [];
		(w.toLowerCase().split(this.phraseSplitterRegex)).forEach((phrase) => {
			let purifiedTokens = this.purgePhrase(phrase);
			if (phrase.trim().length > 0) {
				out.push({ original: `${phrase}`, purifyed: `${purifiedTokens.join(" ")}`, clazz: this.classify(purifiedTokens) });
			}
		});

		return out;
	}

	classify(phrase) {

		if (parseInt(phrase)) {
			return { label: "value.numeric", value: 1 };
		} else {
			return classifier.getClassifications(phrase)[0];
		}
	}

	wordCollectionToRegex(words) {
		let regexWords = [];

		words.forEach((e) => {
			let preparedWord = e.trim().replace("\$", "\\\$").replace("\^", "\\\^");
			regexWords.push(" " + preparedWord + " ");
			regexWords.push("^" + preparedWord + " ");
			regexWords.push(" " + preparedWord + "$");
		});

		return new RegExp("(" + regexWords.join("|") + ")");
	}

	purgePhrase(ph) {
		let purifiedTokens = [];

		ph = diacritics.remove(ph);

		tokenizer.tokenize(ph).forEach((token) => {


			if (!(this.stopwordSet.has(token))) {
				purifiedTokens.push(token.trim());
			}
		})

		return purifiedTokens;
	}

	train() {
		let phraseSeparators = [];

		Object.keys(this.trainData).forEach((intention) => {
			Object.keys(this.trainData[intention]).forEach((value) => {
				this.trainData[intention][value].forEach((phrase) => {
					let curPhrase = phrase.toLowerCase();

					phraseSeparators.push(curPhrase);

					classifier.addDocument(this.purgePhrase(curPhrase), `${intention}.${value}`);
				});
			});
		});

		this.phraseSplitterRegex = this.wordCollectionToRegex(phraseSeparators);

		classifier.train();
	}
};

let nluModule = undefined;

module.exports.NLU = {
	train: (trainData, stopwordSet) => { if (nluModule) { delete nluModule; } nluModule = new CoolmidaNLU(trainData, stopwordSet); },
	classify: (p) => { if (nluModule) { return nluModule.classify(p); } else { throw "Cannot classify without train."; } },
	posTagging: (p) => { if (nluModule) { return nluModule.posTagging(p); } else { throw "Cannot tag without train."; } }
};
