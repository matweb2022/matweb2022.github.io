// Array of products, each product is an object with different fieldset
// A set of ingredients should be added to products		 

var products = [
	/*Product 1*/
	{
		name: "brocoli",
		vegetarian: true,
		glutenFree: true,
		price: 1.99,
		organique: true,
		dept: "Fruit et legume"
	},
	/*Product 2*/
	{
		name: "Pain",
		vegetarian: true,
		glutenFree: false,
		price: 2.35,
		organique: true,
		dept: "Boulangerie"
	},
	/*Product 3*/
	{
		name: "Saumon",
		vegetarian: false,
		glutenFree: true,
		price: 10.00,
		organique: false,
		dept: "Viande"
	},
	/*Product 4*/
	{
		name: "Tofu",
		vegetarian: true,
		glutenFree: false,
		price: 5.99,
		organique: false,
		dept: "Fruit et legume"
	},
	/*Product 5*/
	{
		name: "Romaine",
		vegetarian: true,
		glutenFree: false,
		price: 2.49,
		organique: true,
		dept: "Fruit et legume"
	},
	/*Product 6*/
	{
		name: "Gruau",
		vegetarian: true,
		glutenFree: false,
		price: 4.25,
		organique: false,
		dept: "Epicerie"
	},
	/*Product 7*/
	{
		name: "Oeuf",
		vegetarian: true,
		glutenFree: true,
		price: 3.99,
		organique: true,
		dept: "Epicerie"
	},
	/*Product 8*/
	{
		name: "Poulet",
		vegetarian: false,
		glutenFree: true,
		price: 11.99,
		organique: true,
		dept: "Viande"
	},
	/*Product 9*/
	{
		name: "Tourtière",
		vegetarian: false,
		glutenFree: false,
		price: 8.99,
		organique: false,
		dept: "Viande"
	},
	/*Product 10*/
	{
		name: "Tamari",
		vegetarian: true,
		glutenFree: true,
		price: 3.50,
		organique: true,
		dept: "Viande"
	}
	
];
//Create Matrix of array to store each departement item 
//matrix de sortie
/**							product1 product2
								0		1
	Viande 			-> 0		name	name
	Epicerie 		-> 1		.		.	
	Fruit et legume	-> 2		.		.
	Boulangerie		-> 3
**/

//matrix d'entree
/**
	product list 
	     
				0      	1			2
		 i
	item 0 ->  name  	price  		dept
	**/

function sortByDept(produit){
	let dept_Viande = [];
	let dept_Epicerie = [];
	let dept_Fruit_Leg = [];
	let dept_Boulangerie = [];
		
	for(i=0; i< produit[2].length; i++){
		//document.getElementById("demo").innerHTML = produit[1][0] ;
		if (produit[i][2] == "Viande"){
			dept_Viande.push(produit[i][0]); //push name of product
		}else if(produit[i][2] == 'Epicerie'){
			dept_Epicerie.push(produit[i][0]);
		}else if(produit[i][2] == 'Fruit et legume'){
			dept_Fruit_Leg.push(produit[i][0]);
		}else if(produit[i][2] == 'Boulangerie'){
			dept_Boulangerie.push(produit[i][0]);
		}
	}

	let departement = [dept_Viande,dept_Epicerie,dept_Fruit_Leg,dept_Boulangerie];
	return departement;
}

// given restrictions provided, make a reduced list of products
// prices should be included in this list, as well as a sort based on price

function restrictListProducts(prods, restriction) {
	let product_names = [];
	let product_prices = [];
	let product_dept = [];
	for (let i=0; i<prods.length; i+=1) {
		if ((restriction[0] == "vegOui") && (prods[i].vegetarian == true)){
			product_names.push(prods[i].name );
			product_prices.push(prods[i].price);
			product_dept.push(prods[i].dept);
		}
		 if ((restriction[1] == "celOui") && (prods[i].glutenFree == true)){
			product_names.push(prods[i].name);
			product_prices.push(prods[i].price);
			product_dept.push(prods[i].dept);
		}
		 if ((restriction[2] == "orgOui") && (prods[i].glutenFree == true)){
			product_names.push(prods[i].name);
			product_prices.push(prods[i].price);
			product_dept.push(prods[i].dept);
		}
		if((restriction[0] == "vegNon") && (restriction[1] == "celNon") && (restriction[2] == "orgNon") ) {
			product_names.push(prods[i].name);
			product_prices.push(prods[i].price);
			product_dept.push(prods[i].dept); 
		}
	}
	let product = [];
	
	for(let i=0; i<product_names.length; i+=1){
		var item = [product_names[i],product_prices[i], product_dept[i]];
		product.push(item);
	}
	/**
	product list 
	           0      	1			2
	item 0 ->  name  	price  		dept
	**/
	//let product = new Array(product_names, product_prices);
	return product;
}

// Calculate the total price of items, with received parameter being a list of products
function getTotalPrice(chosenProducts) {
	totalPrice = 0;
	for (let i=0; i<products.length; i+=1) {
		var details = products[i].name + " -> " + products[i].price;
		if (chosenProducts.indexOf(details ) > -1){
			totalPrice += products[i].price;
		}
	}
	return totalPrice;
}