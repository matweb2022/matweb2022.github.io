

// Function to verify that the phone number is correct.
// Here, I validate for (12345), but you have to change that for a phone validation
// Tutorials on Regular expressions
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions 
// https://flaviocopes.com/javascript-regular-expressions/ 
// Regular expressions can get complex, you can think in terms of a series of characters
// or numbers 
function validatePhone(txtPhone) {
    var a = document.getElementById(txtPhone).value;
    
    var filter = /^[(]{0,1}[0-9]{3}[)]{0,1}[-\s\.]{0,1}[0-9]{3}[-\s\.]{0,1}[0-9]{4}$/;
	if (filter.test(a)) {
        return true;
    }
    else {
        return false;
    }
    
}
/** Validate credit card**/

function validateCard(txtCard) {
    var a = document.getElementById(txtCard).value;
    // This filter asks for something like (12345), so parentheses with any number (at least 1)
    // of digits
    var filter = /((([0-9]{4})\s){3})[0-9]{4}/;
	if (filter.test(a)) {
        return true;
    }
    else {
        return false;
    }
    
}

/**Form submission details Global variable**/
var mecano = " "; //mecano selectionner
var service = " "; //Service selectionner
var pick_date = " ";//date du service selectionner
var nom = " " ;//nom du client
var prenom =" " ;// prenom du client

function submit(){
	alert("mecano:" + mecano );
}


// Using date restrictions on datepicker
// Document of datepicker is here: https://api.jqueryui.com/datepicker/ 
// The following code shows how to set specific dates to exclude, as well as Sundays (Day 0)
// Make sure in your version that you associate Days to remove with Experts (e.g. John doesn't work Mondays)
var unavailableDates = ["06/29/2020","07/07/2020","07/10/2020"]
let date_Off = []
var flag_button = false;
const setDateFormat = "mm/dd/yy";

/**mecano **/
/**
 Lundi Mardi Mercredi Jeudi Vendredi 
   1     2      3       4       5      
**/

//selection de Erdwin
function erdwin(){
	document.getElementById("E1").style.color = '#ff3300';
	flag_button =true;
	mecano = "Erdwin";
	let erdwin = [1,5]; //Lundi, Vendredi OFF
	date_Off = erdwin;
}

//supression des chois de mecano
function back_Selection(){
	mecano = " "; //retire mecano de la soumission
	document.getElementById("E1").style.color = '#cccccc';
}

/**Service**/

//Selection service entretien siasonier
function entr_Sai(){
	document.getElementById("E2").style.color = '#ff3300';
	service = "Entretien saisonnier";
}
//selection service de crevaison
function crevaison(){
	document.getElementById("E2").style.color = '#ff3300';
	service = "Service de crevaison";
}
//supression des choix service
function back_service(){
	service = " ";
	document.getElementById("E2").style.color = '#cccccc';
}

/**Canlandrier**/

function disableDates(date) {
    // Sunday is Day 0, disable all Sundays
    if (date.getDay() == 0 ){
        return [false];
	}
	  // Saturday is Day 6, disable all Saturday
	if (date.getDay() == 6 ){
        return [false];
	}
	if(flag_button){//true = selected mecano
		for(var i=0; i<date_Off.length; i++){
			if(date.getDay() == date_Off[i]){
				return [false];
			}
		}
	}
    var string = jQuery.datepicker.formatDate(setDateFormat, date);
    return [ unavailableDates.indexOf(string) == -1 ]
}

// HERE, JQuery "LISTENING" starts
$(document).ready(function(){

/** Service**/
	  	//Service disable button 
			//service entretien siasonnier
	$('.entr_Sai').on('click',function() {
		$(this).prop("disabled",true);
		$('.crevaison').prop("disabled",true); //disable other service
		$(this).css({"background-color":"#81F79F"});
	});
	
	$('.crevaison').on('click',function() {
		$(this).prop("disabled",true);
		$(".entr_Sai").prop("disabled",true); //disable other service
		$(this).css({"background-color":"#81F79F"});
	});
	
	//Service delete selection

	$('.back_service').on('click',function() {
		$('.entr_Sai').prop("disabled",false);
		$('.entr_Sai').css({"background-color":"#cccccc"});
		$('.crevaison').prop("disabled",false);
		$('.crevaison').css({"background-color":"#cccccc"});
	});

/**Mecano **/
	
	//Service disable button 

	$('.mecano').on('click',function() {
		$(this).prop("disabled",true);
		$(this).css({"background-color":"#81F79F"});
	});
	
	//Mecano delete selection

	$('.back_Sel').on('click',function() {
		$('#erdwin').prop("disabled",false);
		$('#erdwin').css({"background-color":"#cccccc"});
	});
	
	

    // phone validation, it calls validatePhone
    // and also some feedback as an Alert + putting a value in the input that shows the format required
    // the "addClass" will use the class "error" defined in style.css and add it to the phone input
    // The "error" class in style.css defines yellow background and red foreground
/**
prenom nom phone debit
   0    1    2     3
   False = not validate
   true = valid
**/
	
var allvalid = [false,false,false,false]; //table to check validation of filled
/** phone validation   2 **/

	var flagColorPhone = true;
    $("#phone").on("change", function(){
		flagColorPhone = false;
        if (!validatePhone("phone")){
			 $("#phone").css({"background-color":"#F7819F"});
            alert("Format invalide. Entrez ex: (613)525-1234");
            $("#phone").val("(613)XXX-XXXX");
			allvalid[2] = false;
          
        }
        else {
            $("#phone").css({"background-color":"#A9F5A9"});
			allvalid[2] = true;
        }
		if(allvalid[1] && allvalid[0] && allvalid[3]){
			$("#E4").css("color","#ff3300");
		}else{
			$("#E4").css("color","#cccccc");
		}
		
    });
	
	
/** Credit card validation  3  **/

	//validation
	var flagCoverDebit =true;
	 $("#debit").on("change", function(){
        flagCoverDebit = false;
		if (!validateCard("debit")){
			 $("#debit").css({"background-color":"#F7819F"});
            alert("Format invalide. Entrez ex: 1234 1234 1234 1234");
            $("#debit").val("XXXX XXXX XXXX XXXX");
			allvalid[3] = false;
       
        }
        else {
             $("#debit").css({"background-color":"#A9F5A9"});
			 allvalid[3] = true;
        }
		if(allvalid[1] && allvalid[2] && allvalid[0]){
			$("#E4").css("color","#ff3300");
		}else{
			$("#E4").css("color","#cccccc");
		}
	
    });
/**nom validation   1   **/ 
	$("#nom").on("change", function(){
		nom = $(this).val();
		allvalid[1] = true;
		if(allvalid[0] && allvalid[2] && allvalid[3]){
			$("#E4").css("color","#ff3300");
		}else{
			$("#E4").css("color","#cccccc");
		}
	});

/**prenom validation   0  **/ 
	$("#prenom").on("change", function(){
		prenom = $(this).val();
		allvalid[0] = true;
		if(allvalid[1] && allvalid[2] && allvalid[3]){
			$("#E4").css("color","#ff3300");
		}else{
			$("#E4").css("color","#cccccc");
		}
		
		});
    // To change the style of the calender, look in jqueryui.com, under Themes, in the ThemeRoller Gallery 
    // You can try different themes (the names are under the calendars) / This is Excite Bike 
    // To use a different theme you must include its css in your HTML file. 
    // The one I included in my HTML is the Excite Bike, but you can try others

    // Also, here is a good tutorial for playing with the datepicker in https://webkul.com/blog/jquery-datepicker/ 
    // Datepicker is also documented as one of the widgets here: https://api.jqueryui.com/category/widgets/ 
    $( "#dateInput" ).datepicker(
        {
            dateFormat: setDateFormat,
            // no calendar before June 1rst 2020
            minDate: new Date('06/01/2020'),  
            maxDate: '+4M',
            // used to disable some dates
            beforeShowDay: $.datepicker.noWeekends,
            beforeShowDay: disableDates
        }   
    );
	
	//triger for action when date selected
	$("#dateInput").on("change",function(){
        pick_date = $(this).val(); // date selected
		$("#E3").css("color","#ff3300");
		$(this).css("background-color","#81F79F")
    });
	
	
	
    // Look at the different events on which an action can be performed
    // https://www.w3schools.com/jquery/jquery_events.asp
    // Here, we put 
	
	$("#prenom").on("mouseenter", function(){
        $("#prenom").css({"background-color":"#FA8258"});
    });
	
	$("#prenom").on("mouseleave", function(){
        $("#prenom").css({"background-color":"white"});
    });
	
	$("#nom").on("mouseenter", function(){
        $("#nom").css({"background-color":"#FA8258"});
    });
	
	$("#nom").on("mouseleave", function(){
        $("#nom").css({"background-color":"white"});
    });
	
	
	$("#phone").on("mouseenter", function(){
		if(flagColorPhone){
			 $("#phone").css({"background-color":"#FA8258"});
		}
    });
	
	$("#phone").on("mouseleave", function(){
		if(flagColorPhone){
			$("#phone").css({"background-color":"white"});
		}
	});
	
    $("#debit").on("mouseenter", function(){
		if(flagCoverDebit){
			$("#debit").css({"background-color":"#FA8258"});
        }
    });

    $("#debit").on("mouseleave", function(){
		if(flagCoverDebit){
			$("#debit").css({"background-color":"white"});
		}
	});
  
    // https://jqueryui.com/tooltip/ 
    // The class "highlight" used here is predefined in JQuery UI
    // the message of the tooltip is encoded in the input (in the HTML file)
    $("#debit").tooltip({
        classes: {
          "ui-tooltip": "highlight"
        }
      });
	  
	   $("#phone").tooltip({
        classes: {
          "ui-tooltip": "highlight"
        }
      });

});