const natural = require('natural');
const requestPromise = require('request-promise');
const fs = require('fs');
const priceClassifier = new natural.BayesClassifier();
const kcalClassifier = new natural.BayesClassifier();

const tokenizer = new natural.OrthographyTokenizer({ language: "fi" });
const diacritics = require('diacritics');

const ingredients = {};
const recipes = JSON.parse(fs.readFileSync('recipes.json', 'utf8'));

function removeAtrocities(atrocity) {
    return tokenizer.tokenize(diacritics.remove(atrocity).replace(/(\d+)/g, ' ')).join(" ").replace(/ (\w) |^(\w) | (\w)$/g, ' ').trim();
}

fs.readFileSync('prices.csv', 'utf8').split(`\n`).forEach((el) => {
    let ingredient = el.split("|");

    if (ingredient.length > 1) {
        let name = ingredient[0].trim();
        let price = parseFloat(ingredient[1].trim());
        if (price < 15) {
            priceClassifier.addDocument(name, price);
        } else {
            let divisor = name.match(/(\d+)/);
            if (divisor) {
                divisor = parseFloat(divisor[1]);
                console.log("[Warning] High price:", ingredient, ", dividing price by ", divisor);
                let newValue = (price / divisor);
                if (newValue < 15) {
                    priceClassifier.addDocument(removeAtrocities(name), newValue);
                } else {
                    console.log("Not low enough");
                }
            }
        }
    }
});

fs.readFileSync('kcal.csv', 'utf8').split(`\n`).forEach((el) => {
    let ingredient = el.split("|");

    if (ingredient.length > 1) {
        let name = ingredient[0].trim();
        let kcal = parseFloat(ingredient[1].trim());
        kcalClassifier.addDocument(removeAtrocities(name), kcal);
    }
});


priceClassifier.train();
kcalClassifier.train();

recipes.forEach((recipe) => {
    recipe.ingredients.forEach((ingredient) => {
        let realName = ingredient;
        ingredient = removeAtrocities(ingredient);
        let currentItem = { name: realName, price: priceClassifier.classify(ingredient), kcal: kcalClassifier.classify(ingredient) };
        // console.log(JSON.stringify(currentItem));

        var options = {
            method: 'POST',
            uri: 'https://coolmida.onthewifi.com/api/ingredient/',
            body: {
                name: currentItem.realName,
                avg_price: currentItem.price,
                calorific_value: currentItem.kcal,
                unit: 1
            },
            json: true
        };

        requestPromise(options).then(function (parsedBody) {
            console.log(parsedBody);
        }).catch(function (err) {
            console.error(err);
        });

    });
});
