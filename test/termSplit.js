let termSet = new Set([
    "quero",
    "duas",
    "uma"
]);

/**
 * 
 * @param {Array} k 
 */
function splitOnTerms(k) {
    let phraseList = [];

    let lastIndex = 0;

    for (let index = 0; index < k.length; ++index) {

        if (termSet.has(k[index])) {
            if (lastIndex < index) {
                phraseList.push(k.slice(lastIndex, index).join(" "));
            }
            phraseList.push(k[index]);
            lastIndex = index + 1;
        }

    }

    phraseList.push(k.slice(lastIndex, k.length).join(" "));
    console.log(phraseList);
}


splitOnTerms(process.argv[2].split(" "));