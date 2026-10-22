
import { auth, db } from "./firebase.js";


import {
  onAuthStateChanged,
  signOut,
  deleteUser
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";


import {
  doc,
  setDoc,
  getDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

const SEARCH_API_URL =
  "https://www.themealdb.com/api/json/v1/1/search.php?s=";

const RANDOM_API_URL =
  "https://www.themealdb.com/api/json/v1/1/random.php";

const LOOKUP_API_URL =
  "https://www.themealdb.com/api/json/v1/1/lookup.php?i=";

// -------------------------------------
// 1. AUTHENTICATION
// -------------------------------------


let currentUser = null;
let resolveAuthReady;
let authInitialized = false;

const authReady = new Promise((resolve) => {
  resolveAuthReady = resolve;
});

onAuthStateChanged(auth, (user) => {
  currentUser = user;

  const guestMenu = document.getElementById("guest-menu");
  const userMenu = document.getElementById("user-menu");
  const userEmail = document.getElementById("user-email");

  if (guestMenu && userMenu) {
    guestMenu.classList.toggle("hidden", !!user);
    userMenu.classList.toggle("hidden", !user);
  }

  if (userEmail) {
    userEmail.textContent = user ? user.email : "";
  }

  if (!authInitialized) {
    authInitialized = true;
    resolveAuthReady(user);
  }

  refreshBookmarkButtons();
});


// -------------------------------------
// 2. HTML ELEMENTS
// -------------------------------------

const searchForm = document.getElementById("search-form");
const searchInput = document.getElementById("search-input");
const resultsGrid = document.getElementById("results-grid");
const messageArea = document.getElementById("message-area");
const randomButton = document.getElementById("random-button");
const modal = document.getElementById("recipe-modal");
const modalContent = document.getElementById("recipe-details-content");
const modalCloseBtn = document.getElementById("modal-close-btn");

const logoutButton = document.getElementById("logout-button");
const deleteAccountButton = document.getElementById("delete-account-button");

if (logoutButton) {
  logoutButton.addEventListener("click", async () => {
    try {
      await signOut(auth);
      window.location.href = "index.html";
    } catch (error) {
      console.error("Logout error:", error);
      alert("Could not log out. Please try again.");
    }
  });
}

if (deleteAccountButton) {
  deleteAccountButton.addEventListener("click", async () => {
    await authReady;

    if (!currentUser) {
      alert("Please log in first.");
      window.location.href = "login.html";
      return;
    }

    const confirmed = confirm(
      "Are you sure you want to permanently delete your account and all your saved recipes? This cannot be undone."
    );

    if (!confirmed) return;

    try {
      const bookmarksRef = collection(
        db,
        "users",
        currentUser.uid,
        "bookmarks"
      );

      const bookmarksSnapshot = await getDocs(bookmarksRef);

      for (const bookmark of bookmarksSnapshot.docs) {
        await deleteDoc(bookmark.ref);
      }

      await deleteUser(currentUser);

      alert("Your account has been deleted.");
      window.location.href = "signup.html";
    } catch (error) {
      console.error("Account deletion error:", error);

      if (error.code === "auth/requires-recent-login") {
        alert(
          "For security, please log out, log back in, and try deleting your account again."
        );
      } else {
        alert(
          "Account deletion failed. Please try again. Your account may still exist."
        );
      }
    }
  });
}

// -------------------------------------
// 3. BOOKMARK FUNCTIONS
// -------------------------------------

function getBookmarkRef(recipeId) {
  return doc(
    db,
    "users",
    currentUser.uid,
    "bookmarks",
    String(recipeId)
  );
}

// Update the bookmark button label
async function updateBookmarkButton(recipe, button) {
  await authReady;

  if (!currentUser) {
    button.textContent = "♡ Bookmark";
    return;
  }

  try {
    const snapshot = await getDoc(getBookmarkRef(recipe.idMeal));

    button.textContent = snapshot.exists()
      ? "♥ Bookmarked"
      : "♡ Bookmark";
  } catch (error) {
    console.error("Could not check bookmark:", error);
  }
}

// Refresh all visible bookmark buttons
function refreshBookmarkButtons() {
  document.querySelectorAll(".bookmark-button").forEach((button) => {
    const card = button.closest(".recipe-item");
    if (!card) return;

    const recipe = {
      idMeal: card.dataset.id
    };

    updateBookmarkButton(recipe, button);
  });
}

// Save or remove a bookmark
async function toggleBookmark(recipe, button) {
  // Wait for Firebase to finish checking login status
  await authReady;

  if (!currentUser) {
    alert("Please log in to bookmark recipes.");
    window.location.href = "login.html";
    return;
  }

  button.disabled = true;

  try {
    const bookmarkRef = getBookmarkRef(recipe.idMeal);
    const snapshot = await getDoc(bookmarkRef);

    if (snapshot.exists()) {
      await deleteDoc(bookmarkRef);
      button.textContent = "♡ Bookmark";
    } else {
      await setDoc(bookmarkRef, {
        recipeId: String(recipe.idMeal),
        name: recipe.strMeal,
        image: recipe.strMealThumb,
        savedAt: Date.now()
      });

      button.textContent = "♥ Bookmarked";
    }
  } catch (error) {
    console.error("Bookmark error:", error);
    alert("Could not update bookmark. Please try again.");
  } finally {
    button.disabled = false;
  }
}

// -------------------------------------
// 4. SEARCH RECIPES
// -------------------------------------

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const searchTerm = searchInput.value.trim();

  if (searchTerm) {
    searchRecipes(searchTerm);
  } else {
    showMessage("Please enter a search term.", true);
  }
});

async function searchRecipes(query) {
  showMessage(`Searching for "${query}"...`, false, true);
  resultsGrid.innerHTML = "";

  try {
    const response = await fetch(
      `${SEARCH_API_URL}${encodeURIComponent(query)}`
    );

    if (!response.ok) {
      throw new Error("Network error");
    }

    const data = await response.json();
    clearMessage();

    if (data.meals) {
      displayRecipes(data.meals);
    } else {
      showMessage(`No recipes found for "${query}".`);
    }
  } catch (error) {
    console.error("Search error:", error);
    showMessage("Something went wrong. Please try again.", true);
  }
}

// -------------------------------------
// 5. MESSAGES
// -------------------------------------

function showMessage(message, isError = false, isLoading = false) {
  messageArea.textContent = message;
  messageArea.className = "message";

  if (isError) {
    messageArea.classList.add("error");
  }

  if (isLoading) {
    messageArea.classList.add("loading");
  }
}

function clearMessage() {
  messageArea.textContent = "";
  messageArea.className = "message";
}

// -------------------------------------
// 6. DISPLAY RECIPE CARDS
// -------------------------------------

function displayRecipes(recipes) {
  if (!recipes || recipes.length === 0) {
    showMessage("No recipes to display.");
    return;
  }

  resultsGrid.innerHTML = "";

  recipes.forEach((recipe) => {
    const recipeDiv = document.createElement("div");

    recipeDiv.classList.add("recipe-item");
    recipeDiv.dataset.id = recipe.idMeal;

    recipeDiv.innerHTML = `
      <img
        src="${recipe.strMealThumb}"
        alt="${recipe.strMeal}"
        loading="lazy"
      >

      <h3></h3>

      <button type="button" class="bookmark-button">
        ♡ Bookmark
      </button>
    `;

    // Insert the recipe title safely
    recipeDiv.querySelector("h3").textContent = recipe.strMeal;

    const bookmarkButton =
      recipeDiv.querySelector(".bookmark-button");

    // Clicking the bookmark should not open the recipe modal
    bookmarkButton.addEventListener("click", async (event) => {
      event.stopPropagation();
      await toggleBookmark(recipe, bookmarkButton);
    });

    resultsGrid.appendChild(recipeDiv);

    // Load the correct bookmark status
    updateBookmarkButton(recipe, bookmarkButton);
  });
}

// -------------------------------------
// 7. RANDOM RECIPE
// -------------------------------------

randomButton.addEventListener("click", getRandomRecipe);

async function getRandomRecipe() {
  showMessage("Fetching a random recipe...", false, true);
  resultsGrid.innerHTML = "";

  try {
    const response = await fetch(RANDOM_API_URL);

    if (!response.ok) {
      throw new Error("Request failed");
    }

    const data = await response.json();
    clearMessage();

    if (data.meals && data.meals.length > 0) {
      displayRecipes(data.meals);
    } else {
      showMessage(
        "Could not fetch a random recipe. Please try again.",
        true
      );
    }
  } catch (error) {
    console.error("Random recipe error:", error);

    showMessage(
      "Failed to fetch a random recipe. Check your connection.",
      true
    );
  }
}

// -------------------------------------
// 8. RECIPE DETAILS MODAL
// -------------------------------------

function showModal() {
  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeModal() {
  modal.classList.add("hidden");
  document.body.style.overflow = "";
}

resultsGrid.addEventListener("click", (event) => {
  if (event.target.closest(".bookmark-button")) {
    return;
  }

  const card = event.target.closest(".recipe-item");

  if (card) {
    getRecipeDetails(card.dataset.id);
  }
});

async function getRecipeDetails(id) {
  modalContent.innerHTML =
    '<p class="message loading">Loading details...</p>';

  showModal();

  try {
    const response = await fetch(`${LOOKUP_API_URL}${id}`);

    if (!response.ok) {
      throw new Error("Failed to fetch recipe details");
    }

    const data = await response.json();

    if (data.meals && data.meals.length > 0) {
      displayRecipeDetails(data.meals[0]);
    } else {
      modalContent.innerHTML =
        '<p class="message error">Could not load recipe details.</p>';
    }
  } catch (error) {
    console.error("Recipe details error:", error);

    modalContent.innerHTML =
      '<p class="message error">Failed to load recipe details. Check your connection or try again.</p>';
  }
}

modalCloseBtn.addEventListener("click", closeModal);

modal.addEventListener("click", (event) => {
  if (event.target === modal) {
    closeModal();
  }
});

// -------------------------------------
// 9. RECIPE INGREDIENTS AND INSTRUCTIONS
// -------------------------------------

function displayRecipeDetails(recipe) {
  const ingredients = [];

  for (let i = 1; i <= 20; i++) {
    const ingredient = recipe[`strIngredient${i}`]?.trim();
    const measure = recipe[`strMeasure${i}`]?.trim();

    if (ingredient) {
      ingredients.push(
        `<li>${measure ? `${measure} ` : ""}${ingredient}</li>`
      );
    } else {
      break;
    }
  }

  const categoryHTML = recipe.strCategory
    ? `<h3>Category: ${recipe.strCategory}</h3>`
    : "";

  const areaHTML = recipe.strArea
    ? `<h3>Area: ${recipe.strArea}</h3>`
    : "";

  const ingredientsHTML = ingredients.length
    ? `<h3>Ingredients</h3><ul>${ingredients.join("")}</ul>`
    : "";

  const instructionsHTML = `<h3>Instructions</h3><p>${
    recipe.strInstructions
      ? recipe.strInstructions.replace(/\r?\n/g, "<br>")
      : "Instructions not available."
  }</p>`;

  const youtubeHTML = recipe.strYoutube
    ? `<h3>Video Recipe</h3>
       <div class="video-wrapper">
         <a href="${recipe.strYoutube}" target="_blank"
            rel="noopener noreferrer">Watch on YouTube</a>
       </div>`
    : "";

  const sourceHTML = recipe.strSource
    ? `<div class="source-wrapper">
         <a href="${recipe.strSource}" target="_blank"
            rel="noopener noreferrer">View Original Source</a>
       </div>`
    : "";

  modalContent.innerHTML = `
    <h2></h2>
    <img alt="">
    ${categoryHTML}
    ${areaHTML}
    ${ingredientsHTML}
    ${instructionsHTML}
    ${youtubeHTML}
    ${sourceHTML}
  `;

  modalContent.querySelector("h2").textContent = recipe.strMeal;

  const image = modalContent.querySelector("img");
  image.src = recipe.strMealThumb;
  image.alt = recipe.strMeal;
}
