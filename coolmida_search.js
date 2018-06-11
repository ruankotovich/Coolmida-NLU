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

class CoolmidaSearch {

    constructor() {
        this.recipesMap = new Map();
        this.reverseRecipesByIngredients = new Map(); // <int>
        this.reverseRecipesByTime = new Array(); // {recipeId : <int>, time: <float>}
        this.reverseRecipesByKcal = new Array(); // {recipeId : <int>, kcal : <float> }
        this.reverseRecipesByPrice = new Array(); // {recipeId : <int>, price : <float>}
        // POPULATE

        // END POPULATE
        this.reverseRecipesByTime.sort((a, b) => { return a.time - b.time; });
        this.reverseRecipesByKcal.sort((a, b) => { return a.kcal - b.kcal });
        this.reverseRecipesByPrice.sort((a, b) => { return a.price - b.price });
    }

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
}