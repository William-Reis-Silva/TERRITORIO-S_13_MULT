(function () {
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCjfTEj0R-xN-dETz7egAUDsGO3gmffulQ",
  authDomain: "territorio-s-13.firebaseapp.com",
  projectId: "territorio-s-13",
  storageBucket: "territorio-s-13.firebasestorage.app",
  messagingSenderId: "402430942513",
  appId: "1:402430942513:web:53f7f1b5caf95fbd61a410",
  measurementId: "G-6P3ENR5HTL"
};

  // Initialize Firebase
  firebase.initializeApp(firebaseConfig);

window.db = firebase.firestore();
window.storage = firebase.storage();
window.auth = firebase.auth();
window.database = firebase.database();
})();


