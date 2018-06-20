const natural = require('natural');
const requestPromise = require('request-promise');
const fs = require('fs');
const priceClassifier = new natural.BayesClassifier();
const kcalClassifier = new natural.BayesClassifier();
const unitClassifier = {
    classify: (input) => {
        let regexes = [
            /(\d+) ?(g|G|grama|gramas|Grama|Gramas|gm|gms|Gm|Gms)( |$)/, //grama
            /(\d+) ?(ml|ML|mL|Ml|Mls|mls|MLS|MLs|mililitro|mililitros|Mililitro|Mililitros|mls|Mls|mlts|Mlts)( |$)/, //mililitro
            /(\d+) ?(³|cubo)( |$)/, //cubo
            /(\d+) ?(l|L|ls|Ls|litro|litros|Litro|Litros|lts|Lts|ls|Ls)( |$)/, //litros
            /(\d+) ?(colher|colheres|colher|clr|chá|colher de chá|xícara|xícaras|cha|xicaras|xicara)( |$)/, //colher
            /(\d+) ?(unidade|unidades|)/
        ];

        let index = 1;

        let matchProfile = {
            value: 1,
            unit: 6
        }

        for (let reg of regexes) {
            let regProfile = reg.exec(input);
            if (regProfile) {
                matchProfile.value = parseFloat(regProfile[1]);
                matchProfile.unit = index;
                break;
            }
            ++index;
        }

        return matchProfile; //unidade
    }
};

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

async function start() {
    // recipes.forEach((recipe) => {
    let stepRecipe = 1;
    for (let recipe of recipes) {
        // recipe.ingredients.forEach((ingredient) => {
        let stepIngredient = 1;
        for (let ingredient of recipe.ingredients) {
            let realName = ingredient;
            ingredient = removeAtrocities(ingredient);
            let currentItem = { name: realName, price: parseFloat(priceClassifier.classify(ingredient)), kcal: parseFloat(kcalClassifier.classify(ingredient)), unit: unitClassifier.classify(realName) };
            // process.stdout.write('\033c');
            console.log(`\nRecipes : ${stepRecipe} of ${recipes.length}\nIngredients : ${stepIngredient} of ${recipe.ingredients.length}\nSending ${JSON.stringify(currentItem)}`);
            pushAPI(currentItem, recipe);
            ++stepIngredient;
        }
        ++stepRecipe;
    }
}

async function pushAPI(currentItem, recipe) {
    let options = {
        method: 'POST',
        uri: 'https://coolmida.onthewifi.com/api/ingredient/',
        body: {
            name: currentItem.name,
            avg_price: currentItem.price.toFixed(2),
            calorific_value: currentItem.kcal,
            unit: currentItem.unit.unit
        },
        json: true
    };

    let ingredientReturn = await requestPromise(options);

    let innerOptions = {
        method: 'POST',
        uri: 'https://coolmida.onthewifi.com/api/recipe-ingredient/',
        body: {
            ingredient: ingredientReturn.id,
            recipe: recipe.id,
            quantity: currentItem.unit.value
        },
        json: true
    };

    let relationReturn = await requestPromise(innerOptions);


    console.log("Successfull added relation.");
}

start();