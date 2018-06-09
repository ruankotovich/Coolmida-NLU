const natural = require('natural');
const fs = require('fs');
const diacritics = require('diacritics');
const Numbermap = require('./numbermap').Numbermap;
let StemmedNumbermap = {};

const tokenizer = new natural.OrthographyTokenizer({ language: "pt" })
const classifier = new natural.BayesClassifier();
const stemmer = natural.PorterStemmerPt;
const str$distance = natural.JaroWinklerDistance;

class CoolmidaNLU {

	constructor(td, sws) {
		this.trainData = JSON.parse(fs.readFileSync(td, (e) => { console.error(e.toString()) }));
		this.stopwordSet = new Set(JSON.parse(fs.readFileSync(sws, (e) => { console.error(e.toString()); })));
		this.train();
	}

	tokenizePhrase(ph, mild = false) {
		let purifiedTokens = [];

		ph = diacritics.remove(ph.toLowerCase().replace(/( ?[^\w|\s] ?)/g, mild ? "" : " "));

		tokenizer.tokenize(ph).forEach((token) => {
			
			if (!(this.stopwordSet.has(token))) {
				purifiedTokens.push(stemmer.stem(token.trim()));
			}
		})

		return purifiedTokens;
	}

	splitOnTerms(w) {
		return this.tokenizePhrase(w);
	}

	classify(phrase) {

		if (parseInt(phrase)) {
			return { label: "value.numeric", value: 1.0, "meaning": parseInt(phrase) };
		} else {

			let seeker = { found: false, value: NaN, smallerDistance: Infinity };

			Object.keys(StemmedNumbermap).forEach((numb) => {

				let dist;

				if ((dist = str$distance(numb, phrase.join(" "))) > .9) {
					if (dist < seeker.smallerDistance) {
						seeker = { found: true, value: StemmedNumbermap[numb], smallerDistance: dist };
					}
				}
			});

			if (seeker.found) {
				return { "label": "value.numeric", "value": seeker.smallerDistance, "meaning": seeker.value };
			}


			return classifier.getClassifications(phrase)[0];
		}
	}

	wordCollectionToRegex(words) {
		let regexWords = [];

		Object.keys(Numbermap).forEach((k) => {
			let value = Numbermap[k];

			k = this.tokenizePhrase(k, true).join(" ");
			StemmedNumbermap[k] = value;

			regexWords.push(" " + k + " ");
			regexWords.push("^" + k + " ");
			regexWords.push(" " + k + "$");
		});

		words.forEach((e) => {
			let preparedWord = e.trim().replace("$", "\\$").replace("^", "\\^");
			regexWords.push(" " + preparedWord + " ");
			regexWords.push("^" + preparedWord + " ");
			regexWords.push(" " + preparedWord + "$");
		});
		return new RegExp("(" + regexWords.join("|") + ")+");
	}

	posTagging(w) {
		let out = [];

		let brokenPieces = this.splitOnTerms(w.replace("$", "s").replace("^", "\\^"));

		brokenPieces.forEach((phrase) => {
			let purifiedTokens = this.tokenizePhrase(phrase);
			let parsedInput = purifiedTokens.join(" ");

			if (parsedInput.trim().length > 0) {
				out.push({ poi: `${parsedInput}`, clazz: this.classify(purifiedTokens) });
			}
		});

		return out;
	}

	train() {
		let phraseSeparators = [];

		Object.keys(this.trainData).forEach((intention) => {
			Object.keys(this.trainData[intention]).forEach((value) => {
				this.trainData[intention][value].forEach((phrase) => {
					let curTokenizedPhrase = this.tokenizePhrase(phrase);

					phraseSeparators.push(curTokenizedPhrase.join(" "));

					classifier.addDocument(curTokenizedPhrase, `${intention}.${value}`);

				});
			});
		});

		this.phraseSplitterRegex = this.wordCollectionToRegex(phraseSeparators);

		console.log(this.phraseSplitterRegex.toString());

		classifier.train();
	}
};

let nluModule = undefined;

module.exports.NLU = {
	train: (trainData, stopwordSet) => { if (nluModule) { delete nluModule; } nluModule = new CoolmidaNLU(trainData, stopwordSet); },
	classify: (p) => { if (nluModule) { return nluModule.classify(p); } else { throw "Cannot classify without train."; } },
	posTagging: (p) => { if (nluModule) { return nluModule.posTagging(p); } else { throw "Cannot tag without train."; } }
};
