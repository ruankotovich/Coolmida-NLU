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

	splitOnTerms(w){
		return diacritics.remove(w.toLowerCase()).replace(/\W/g, " ").split(this.phraseSplitterRegex);
	}

	posTagging(w) {
		let out = [];

		let brokenPieces = this.splitOnTerms(w);
		
		brokenPieces.forEach((phrase) => {
			let purifiedTokens = this.tokenizePhrase(phrase);
			let parsedInput = purifiedTokens.join(" ");

			if (parsedInput.trim().length > 0) {
				out.push({ original: `${phrase}`, purifyed: `${parsedInput}`, clazz: this.classify(purifiedTokens) });
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

	tokenizePhrase(ph) {
		let purifiedTokens = [];


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

					classifier.addDocument(this.tokenizePhrase(diacritics.remove(curPhrase)), `${intention}.${value}`);

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
