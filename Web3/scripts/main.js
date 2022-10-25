// This function is called when any of the tab is clicked
// It is adapted from https://www.w3schools.com/howto/howto_js_tabs.asp


//number of page in menu 


var  page_Count_Abs = 0;
document.getElementById("remplir").style.display = "block";
function openInfo(evt, direction) {
	if(page_Count_Abs < 2 || page_Count_Abs > 0 ){
		page_Count_Abs = page_Count_Abs + direction;
	}
	if(page_Count_Abs < 0 ){
		page_Count_Abs = 0;
	}
	if(page_Count_Abs > 2 ){
		page_Count_Abs = 2;
	}
	var m_Verifier = document.getElementById("m_Verifier");
	var m_Confirmer = document.getElementById("m_Confirmer");
	
	// Get all elements with class="tabcontent" and hide them
	tabcontent = document.getElementsByClassName("tabcontent");
	for (i = 0; i < tabcontent.length; i++) {
		tabcontent[i].style.display = "none";
	}
	
	//page Remplir sont panier
	if(page_Count_Abs == 0){
		m_Verifier.className =  "1";
		m_Confirmer.className =  "2";
		document.getElementById("remplir").style.display = "block";
		
		
	}else if(page_Count_Abs == 1){  //page m_Verifier
		if (direction == 1){
			m_Verifier.className = m_Verifier.className.replace("1", "completed");
		}
		if(direction == -1){
			m_Confirmer.className = m_Confirmer.className.replace("completed", "2");
			
		}
		document.getElementById("verifier").style.display = "block";
		
	}else if(page_Count_Abs == 2){  //page mode de payment
		if (direction == 1){
			m_Confirmer.className = m_Confirmer.className.replace("2", "completed");
		}
		if(direction == -1){
			m_Confirmer.className = m_Confirmer.className.replace("completed", "2");
			
		}
		document.getElementById("confirmer").style.display = "block";
	}
}
/**
	/**tableau de restriction
		veg       -> 0
		Celiac 	  -> 1
		Organique -> 2
	**/

	let restriction = [];
	let optionArray = [];
	
	// generate a checkbox list from a list of products
	// it makes each product name as the label for the checkbos
	function populateListProductChoices(slct1, slct2) {
		
		
		if(slct1.substring(0, 3) == "veg"){
			restriction[0] = slct1;
		}
		if(slct1.substring(0, 3) == "cel"){
			restriction[1] = slct1;
		}
		if(slct1.substring(0, 3) == "org"){
			restriction[2] = slct1;
		}
		
		
		
		
		// s2 represents the <div> in the Products tab, which shows the product list, so we first set it empty
		var s2 = document.getElementById(slct2);
		s2.innerHTML = "";
		
		// obtain a reduced list of products based on restrictions
		optionArray = restrictListProducts(products, restriction);
		
		optionArray.sort(function(x,y){return x[1]-y[1]});
		// for each item in the array, create a checkbox element, each containing information such as:
		// <input type="checkbox" name="product" value="Bread -> $$$">
		// <label for="Bread">Bread/label><br>
			
		for (i = 0; i < optionArray.length; i++) {
				
			var productName = optionArray[i][0];
			var productPrice = optionArray[i][1];
			var details = productName + " -> " + productPrice;
			// create the checkbox and add in HTML DOM
			var checkbox = document.createElement("input");
			checkbox.type = "checkbox";
			checkbox.name = "product";
			checkbox.value = details ;
			s2.appendChild(checkbox);
			
			// create a label for the checkbox, and also add in HTML DOM
			var label = document.createElement('label')
			label.htmlFor = details;
			label.appendChild(document.createTextNode(details));
			s2.appendChild(label);
			
			// create a breakline node and add in HTML DOM
			s2.appendChild(document.createElement("br"));    
		}
	}
	
function selectedItems(){
	
	//for cart
	
	var ele = document.getElementsByName("product");
	var chosenProducts = [];
	
	var c = document.getElementById('displayCart');
	c.innerHTML = "";
	
	// build list of selected item
	var para  = document.createElement("P");
	para.innerHTML = "Vous avez sélectionner " + ele.length + " item.";
	para.appendChild(document.createElement("br"));
	para.appendChild(document.createElement("br"));
	for (i = 0; i < ele.length; i++) { 
		if (ele[i].checked) {
			para.appendChild(document.createTextNode(ele[i].value));
			para.appendChild(document.createElement("br"));
			chosenProducts.push(ele[i].value);
		}
	}
		
	// add paragraph and total price
	c.appendChild(para);
	c.appendChild(document.createTextNode("Total:  " + getTotalPrice(chosenProducts) + " $"));
	
	//for each departement 
	var dept = document.getElementsByClassName("list");
	
	//matrix d'item par departement
	let item_Dept = sortByDept(optionArray);
	
		for(i=0; i<dept.length; i++){
			//dept[i].innerHTML = "";
			var para1  = document.createElement("P");
			for (y = 0; y < item_Dept[i].length; y++) { 
				para1.appendChild(document.createTextNode(item_Dept[i][y]));
				para1.appendChild(document.createElement("br"));
			}
		
			dept[i].appendChild(para1);
		}
		
	
	
	
}

	




		