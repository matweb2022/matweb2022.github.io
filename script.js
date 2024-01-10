  <!-- Firebase Configuration -->
import { initializeApp } from 'firebase/app';

function initializeApp(){
    var firebaseConfig = {
        apiKey: "AIzaSyC5ZZ27DGEtodhZH7z_lSqH7cMzw8NEdwo",
        authDomain: "expenses-database-bb5a9.firebaseapp.com",
        projectId: "expenses-database-bb5a9",
        storageBucket: "expenses-database-bb5a9.appspot.com",
        messagingSenderId: "280596988005",
        appId: "1:280596988005:web:c8dac944aed1402c4e068c",
        measurementId: "G-E19HELLGVC"
      };

    // Initialize Firebase
    firebase.initializeApp(firebaseConfig);
}
