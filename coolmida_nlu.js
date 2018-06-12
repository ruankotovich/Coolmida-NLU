const natural = require('natural');
const fs = require('fs');
const diacritics = require('diacritics');
const Numbermap = require('./numbermap').Numbermap;
const requestPromise = require('request-promise');
let StemmedNumbermap = {};

const tokenizer = new natural.OrthographyTokenizer({ language: "pt" })
const classifier = new natural.BayesClassifier();
const stemmer = natural.PorterStemmerPt;
const str$distance = natural.LevenshteinDistance;
const SERVER_URL = process.env.ENVIRONMENT === "remote" ? `https://coolmida.onthewifi.com/api/recipe/` : "http://127.0.0.1:8000";
console.log("Using SERVER_URL = ", SERVER_URL);

String.prototype.replaceAll = function (search, replacement) {
	var target = this;
	return target.replace(new RegExp(search, 'g'), replacement);
};

function binarySearch(ar, el, comp) {
	let m = 0;
	let n = ar.length - 1;
	let k = -1;

	let offset = 0;

	while (m <= n) {
		k = (n + m) >> 1;

		let cmp = comp(el, ar[k]);

		if (cmp > 0) {
			m = k + 1;
			offset = 0;
		} else if (cmp < 0) {
			n = k - 1;
			offset = -1;
		} else {
			return k;
		}
	}

	return k + offset;
}

function bounds(ar, lb, ub, cmp) {
	let lBound = binarySearch(ar, lb, cmp);
	return { lowerBound: lBound >= 0 ? lBound : 0, upperBound: binarySearch(ar, ub, cmp) };
}

function getByInterval(ar, lb, ub, cmp) {
	let interval = bounds(ar, lb, ub, cmp);
	let elements = [];

	for (let i = interval.lowerBound; i < interval.upperBound; ++i) {
		elements.push(ar[i]);
	}

	return elements;
}

class CoolmidaNLU {

	recoverRecipesByPrice(upperBound, lowerBound = 0) {
		let elements = new Set();

		getByInterval(this.reverseRecipesByPrice, upperBound, lowerBound, (a, b) => { return a.price - b.price }).forEach((el) => {
			elements.add(el.recipeId);
		});

		return elements;
	}

	recoverRecipesByKcal(upperBound, lowerBound = 0) {
		let elements = new Set();

		getByInterval(this.reverseRecipesByKcal, upperBound, lowerBound, (a, b) => { return a.kcal - b.kcal }).forEach((el) => {
			elements.add(el.recipeId);
		});

		return elements;
	}

	recoverRecipesByTime(upperBound, lowerBound = 0) {
		let elements = new Set();

		getByInterval(this.reverseRecipesByTime, upperBound, lowerBound, (a, b) => { return a.time - b.time }).forEach((el) => {
			elements.add(el.recipeId);
		});

		return elements;
	}

	recoverRecipesByIngredients(ingredientArray) {
		let recipeSet = new Set();

		for (let ingredient of ingredientArray) {

			let recoveredRecipesFromIngredient = this.reverseRecipesByIngredients.get(ingredient);

			if (recoveredRecipesFromIngredient) {
				if (recipeSet.size > 0) {
					let currentSet = new Set();
					recoveredRecipesFromIngredient.forEach((el) => { currentSet.add(el); });

					currentSet = new Set([...currentSet].filter(x => recipeSet.has(x)));

					if (currentSet.size > 0) {
						recipeSet = currentSet;
					}

				} else {
					recoveredRecipesFromIngredient.forEach((el) => { recipeSet.add(el); });
				}
			}
		}
		return recipeSet;
	}

	recoverRecipesByTerm(termArray) {
		let recipeSet = new Set();
		for (let term of termArray) {

			let recoveredRecipesFromTerm = this.reverseRecipesByTerm.get(term);

			if (recoveredRecipesFromTerm) {
				if (recipeSet.size > 0) {
					let currentSet = new Set();
					recoveredRecipesFromTerm.forEach((el) => { currentSet.add(el); });

					currentSet = new Set([...currentSet].filter(x => recipeSet.has(x)));

					if (currentSet.size > 0) {
						recipeSet = currentSet;
					}

				} else {
					recoveredRecipesFromTerm.forEach((el) => { recipeSet.add(el); });
				}
			}
		}
		return recipeSet;
	}

	constructor(td, sws) {
		this.trainData = JSON.parse(fs.readFileSync(td, (e) => { console.error(e.toString()) }));
		this.stopwordSet = new Set(JSON.parse(fs.readFileSync(sws, (e) => { console.error(e.toString()); })));

		this.recipesMap = new Map();
		this.reverseRecipesByIngredients = new Map(); // <int>
		this.reverseRecipesByTerm = new Map(); // <int>
		this.reverseRecipesByTime = new Array(); // {recipeId : <int>, time: <float>}
		this.reverseRecipesByKcal = new Array(); // {recipeId : <int>, kcal : <float> }
		this.reverseRecipesByPrice = new Array(); // {recipeId : <int>, price : <float>}

		this.train();
	}

	async populateRecipes() {
		try {
			// let recipes = JSON.parse(fs.readFileSync(`recipes.json`));
			let recipes = await requestPromise(
				{
					method: 'GET',
					json: true,
					uri: SERVER_URL
				}
			);

			for (let recipe of recipes) {
				this.recipesMap.set(recipe.id, recipe);

				this.tokenizePhrase(recipe.name).forEach((el) => {
					let recoveredArray = this.reverseRecipesByTerm.get();

					if (!recoveredArray) {
						recoveredArray = this.reverseRecipesByTerm.set(el, []).get(el);
					}

					recoveredArray.push(recipe.id);

				});

				let accumulator = { price: 0, kcal: 0 };

				recipe.ingredients.forEach((el) => {

					this.tokenizePhrase(el.name).forEach((term) => {
						let recoveredIngArray = this.reverseRecipesByIngredients.get();

						if (!recoveredIngArray) {
							recoveredIngArray = this.reverseRecipesByIngredients.set(term, []).get(term);
						}

						recoveredIngArray.push(recipe.id);

						let recoveredTermArray = this.reverseRecipesByTerm.get();

						if (!recoveredTermArray) {
							recoveredTermArray = this.reverseRecipesByTerm.set(term, []).get(term);
						}

						recoveredTermArray.push(recipe.id);
					});


				});

				this.reverseRecipesByTime.push({ recipeId: recipe.id, time: recipe.avg_time });
				this.reverseRecipesByKcal.push({ recipeId: recipe.id, kcal: accumulator.kcal });
				this.reverseRecipesByPrice.push({ recipeId: recipe.i, price: accumulator.price });

			}


			this.reverseRecipesByTime.sort((a, b) => { return a.time - b.time; });
			this.reverseRecipesByKcal.sort((a, b) => { return a.kcal - b.kcal });
			this.reverseRecipesByPrice.sort((a, b) => { return a.price - b.price });

			return Promise.resolve();
		} catch (ex) {
			return Promise.reject(ex);
		}
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
		w = w.replace(/(\d+)/g, "0xbreakx0$10xbreakx0").replace(/ e /g, "0xbreakx0");
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
			timeMax: undefined,
			budget: undefined,
			budgetStyle: undefined,
			maxKcal: undefined,
			has: []
		};

		for (let tag of this.posTagging(w)) {

			if (tag.clazz.meaning && !tag.clazz.label.startsWith("value")) {
				user.has.push({ description: tag.clazz.meaning, quantity: lastMeasure.value, measureUnit: lastMeasure.measureUnit });
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
				case "specification.time.minute": { if (lastSched.clazz.label === "value.numeric") { user.timeValue = lastSched.clazz.meaning; } } break;
				case "specification.time.hour": { if (lastSched.clazz.label === "value.numeric") { user.timeValue = lastSched.clazz.meaning * 60; } } break;
			}
			lastSched = tag;
		}

		return user;
	}

	search(phrase) {
		let intentions = this.intentionDetect(phrase);
		console.log(`Intention : ${JSON.stringify(intentions)}`);
		let searchCriteria = [];

		intentions.has.forEach((ing) => {
			console.log(`Term : ${ing.description}`);
			searchCriteria.push(ing.description);

		});

		let recipeIds = this.recoverRecipesByTerm(this.tokenizePhrase(searchCriteria.join(" ")));
		let recipes = [];

		recipeIds.forEach((key) => {
			let recoveredRecipe = this.recipesMap.get(key);
			if (recoveredRecipe) {
				if (!intentions.timeValue || intentions.timeValue >= recoveredRecipe.avg_time) {
					recipes.push(recoveredRecipe);
				}
			}
		});

		return recipes;
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
		classifier.train();
	}
};

let nluModule = undefined;

module.exports.NLU = {
	train: async (trainData, stopwordSet) => { if (nluModule) { delete nluModule; } nluModule = new CoolmidaNLU(trainData, stopwordSet); await nluModule.populateRecipes(); },
	classify: (p) => { if (nluModule) { return nluModule.classify(p); } else { throw "Cannot classify without train."; } },
	posTagging: (p) => { if (nluModule) { return nluModule.posTagging(p); } else { throw "Cannot tag without train."; } },
	intentionDetect: (p) => { if (nluModule) { return nluModule.intentionDetect(p); } else { throw "Cannot detect intentions without train."; } },
	search: (p) => { if (nluModule) { return nluModule.search(p); } else { throw "Cannot search intentions without train."; } }
};
