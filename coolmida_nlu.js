const natural = require('natural');
const fs = require('fs');
const diacritics = require('diacritics');
const Numbermap = require('./numbermap').Numbermap;
let StemmedNumbermap = {};

const tokenizer = new natural.OrthographyTokenizer({ language: "pt" })
const classifier = new natural.BayesClassifier();
const stemmer = natural.PorterStemmerPt;
const str$distance = natural.LevenshteinDistance;

String.prototype.replaceAll = function (search, replacement) {
	var target = this;
	return target.replace(new RegExp(search, 'g'), replacement);
};

class CoolmidaNLU {

	constructor(td, sws) {
		this.trainData = JSON.parse(fs.readFileSync(td, (e) => { console.error(e.toString()) }));
		this.stopwordSet = new Set(JSON.parse(fs.readFileSync(sws, (e) => { console.error(e.toString()); })));
		this.train();
	}

	tokenizePhrase(ph, mild = false) {
		let purifiedTokens = [];

		ph = diacritics.remove(ph.toLowerCase()).replace(/( ?[^\w|\s] ?)/g, mild ? "" : " ");

		tokenizer.tokenize(ph).forEach((token) => {

			if (!(this.stopwordSet.has(token))) {
				purifiedTokens.push(stemmer.stem(token.trim()));
			}
		})

		return purifiedTokens;
	}

	splitOnTerms(w) {
		w = w.replace(/(\d+)/,"0xbreakx0$10xbreakx0");
		return `${this.tokenizePhrase(w.replace(/[$-/:-?{-~!"^_`\[\]]/g, "0xbreakx0")).join(" ")} 0xbreakx0`.split(this.phraseSplitterRegex).filter((e) => {
			return e;
		});
	}

	classify(phrase) {

		if (parseInt(phrase)) {
			return { label: "value.numeric", value: 1.0, "meaning": parseInt(phrase) };
		} else {

			let seeker = { found: false, value: NaN, smallerDistance: Infinity };

			Object.keys(StemmedNumbermap).forEach((numb) => {

				let dist;

				if ((dist = str$distance(numb, phrase.join(" "))) <= 1) {
					if (dist < seeker.smallerDistance) {
						seeker = { found: true, value: StemmedNumbermap[numb], smallerDistance: dist };
					}
				}
			});

			if (seeker.found) {
				return { "label": "value.numeric", "value": seeker.smallerDistance, "meaning": seeker.value };
			}


			let outgoingClazz = classifier.getClassifications(phrase)[0];

			outgoingClazz.meaning = ` ${phrase.join(" ")} `.replace(this.phraseSplitterRegex, "").trim();

			if (outgoingClazz.meaning.length < 1) {
				delete outgoingClazz.meaning;
			}

			return outgoingClazz;
		}
	}

	wordCollectionToRegex(words) {
		let regexWords = [];

		Object.keys(Numbermap).forEach((k) => {
			let value = Numbermap[k];

			k = this.tokenizePhrase(k, true).join(" ");
			StemmedNumbermap[k] = value;

			if (k.length > 0) {
				regexWords.push(" " + k.replaceAll(" ", " +") + " ");
			}
		});

		words.forEach((e) => {
			let preparedWord = e.trim().replaceAll("\\$", "s").replaceAll("\\^", "\@").replaceAll(" ", " +");
			if (preparedWord.length > 0) {
				regexWords.push(" " + preparedWord + " ");
			}
		});

		regexWords.sort((a, b) => {
			return b.length - a.length;
		})

		return new RegExp("(" + regexWords.join("|") + ")+|0xbreakx0", "g");
	}

	posTagging(w) {
		let out = [];

		let brokenPieces = this.splitOnTerms(w.replaceAll("\\$", "s").replaceAll("\\^", "\@"));

		brokenPieces.forEach((phrase) => {
			let purifiedTokens = this.tokenizePhrase(phrase);
			let parsedInput = purifiedTokens.join(" ");

			if (parsedInput.trim().length > 0) {
				out.push({ poi: `${parsedInput}`, clazz: this.classify(purifiedTokens) });
			}
		});

		return out;
	}

	intentionDetect(w) {
		let lastSched;
		let lastMeasure = {};

		let user = {
			time: undefined,
			budget: undefined,
			budgetStyle: "UpperBound",
			maxKcal: undefined,
			has: []
		};

		for (let tag of this.posTagging(w)) {

			if (tag.clazz.meaning && !tag.clazz.label.startsWith("value")) {
				user.has.push({ ingredient: tag.clazz.meaning, quantity: lastMeasure.value, measureUnit: lastMeasure.measureUnit });
				lastMeasure = {};
			}

			switch (tag.clazz.label) {
				case "value.money":
					if (lastSched.clazz.label == "value.numeric") { user.budget = parseInt(lastSched.clazz.meaning); }
					break;

				case "value.volume.liter":
				case "value.volume.mililiter":
				case "value.weight.miligram":
				case "value.weight.kilogram":
				case "value.weight.gram":
				case "value.volume.tea_cup":
				case "value.volume.tea_spoon":
					if (lastSched.clazz.label == "value.numeric") {
						lastMeasure.measureUnit = tag.clazz.label;
						lastMeasure.value = lastSched.clazz.meaning;
					}
					break;

				case "speed.fast":
				case "speed.normal": {
					if (!user.time) {
						user.time = tag.clazz.label;
					}
				}
					break;
				case "specification.price_from": { user.budgetStyle = "LowerBound" } break;
				case "specification.price_until": { user.budgetStyle = "UpperBound" } break;
				case undefined: { } break;
			}

			lastSched = tag;
		}
		return user;
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
		console.log(this.phraseSplitterRegex);
		classifier.train();
	}
};

let nluModule = undefined;

module.exports.NLU = {
	train: (trainData, stopwordSet) => { if (nluModule) { delete nluModule; } nluModule = new CoolmidaNLU(trainData, stopwordSet); },
	classify: (p) => { if (nluModule) { return nluModule.classify(p); } else { throw "Cannot classify without train."; } },
	posTagging: (p) => { if (nluModule) { return nluModule.posTagging(p); } else { throw "Cannot tag without train."; } },
	intentionDetect: (p) => { if (nluModule) { return nluModule.intentionDetect(p); } else { throw "Cannot detect intentions without train."; } }
};
