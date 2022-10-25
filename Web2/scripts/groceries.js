// Array of products, each product is an object with different fieldset
// A set of ingredients should be added to products		 

var products = [
	/*Product 1*/
	{
		name: "brocoli",
		vegetarian: true,
		glutenFree: true,
		price: 1.99,
		organique: true
	},
	/*Product 2*/
	{
		name: "Pain",
		vegetarian: true,
		glutenFree: false,
		price: 2.35,
		organique: true
	},
	/*Product 3*/
	{
		name: "Saumon",
		vegetarian: false,
		glutenFree: true,
		price: 10.00,
		organique: false
	},
	/*Product 4*/
	{
		name: "Tofu",
		vegetarian: true,
		glutenFree: false,
		price: 5.99,
		organique: false
	},
	/*Product 5*/
	{
		name: "Romaine",
		vegetarian: true,
		glutenFree: false,
		price: 2.49,
		organique: true
	},
	/*Product 6*/
	{
		name: "Gruau",
		vegetarian: true,
		glutenFree: false,
		price: 4.25,
		organique: false
	},
	/*Product 7*/
	{
		name: "Oeuf",
		vegetarian: true,
		glutenFree: true,
		price: 3.99,
		organique: true
	},
	/*Product 8*/
	{
		name: "Poulet",
		vegetarian: false,
		glutenFree: true,
		price: 11.99,
		organique: true
	},
	/*Product 9*/
	{
		name: "Tourtière",
		vegetarian: false,
		glutenFree: false,
		price: 8.99,
		organique: false
	},
	/*Product 10*/
	{
		name: "Tamari",
		vegetarian: true,
		glutenFree: true,
		price: 3.50,
		organique: true
	}
	
];
	


// given restrictions provided, make a reduced list of products
// prices should be included in this list, as well as a sort based on price

function restrictListProducts(prods, restriction) {
	let product_names = [];
	let product_prices = [];
	for (let i=0; i<prods.length; i+=1) {
		if ((restriction == "Vegetarian") && (prods[i].vegetarian == true)){
			product_names.push(prods[i].name );
			product_prices.push(prods[i].price);
		}
		else if ((restriction == "GlutenFree") && (prods[i].glutenFree == true)){
			product_names.push(prods[i].name);
			product_prices.push(prods[i].price);
		}
		else if (restriction == "None"){
			product_names.push(prods[i].name);
			product_prices.push(prods[i].price);
		}
	}
	let product = [];
	
	for(let i=0; i<product_names.length; i+=1){
		var item = [product_names[i],product_prices[i]];
		product.push(item);
	}
	/**
	product list 
	           0      1
	item 0 ->  name  price  
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