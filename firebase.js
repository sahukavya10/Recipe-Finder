
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey:"AIzaSyAqiYLuEJfoVqkew7A-0WybLsbiGujHIMU",
  authDomain:"recipe-finder-2efcb.firebaseapp.com",
  projectId:"recipe-finder-2efcb",
  appId:"1:403226736986:web:36df848349a12746ed9b63",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
