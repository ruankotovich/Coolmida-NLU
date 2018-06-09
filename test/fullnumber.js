function extendWithTen(name, initialNumber){
	
	let a = {"1" : "um", "2" : "dois", "3" : "três", "4":"quatro", "5" : "cinco", "6" :  "seis", "7": "sete", "8": "oito", "9":"nove"};

	console.log(`${initialNumber}0 - ${name}`);
	Object.keys(a).forEach((k)=>{
		console.log(`${initialNumber}${k} - ${name} e ${a[k]}`);		
	});
}

let numb = {"vinte" : 2, "trinta" : 3, "quarenta" : 4, "cinquenta": 5, "sessenta" : 6, "setenta" : 7, "oitenta" : 8, "noventa" : 9, "cento" : 10};

Object.keys(numb).forEach((o)=>{
	extendWithTen(o, numb[o]);
});
