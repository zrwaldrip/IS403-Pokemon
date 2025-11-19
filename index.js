// Zach Waldrip Section 3
// This project loads pokemon from a database and allows you to search for a pokemon

// Load environment variables from .env file
require("dotenv").config();
// Import required modules
const express = require("express");
const session = require("express-session");
let path = require("path");
let bodyParser = require("body-parser")
// Initialize Express application
let app = express();

// Set EJS as the template engine for rendering views
app.set("view engine", "ejs");

// Set the port from environment variable or use default port 3000
const port = process.env.PORT || 3000;

// Configure session middleware
// Sessions allow the server to maintain user state across requests
app.use(
    session(
        {
    secret: process.env.SESSION_SECRET || 'fallback-secret-key', // Secret key for signing session cookies
    resave: false, // Don't save session if it wasn't modified
    saveUninitialized: false, // Don't create session until something is stored
        }
    )
);

// Initialize Knex database connection
// Knex is a SQL query builder for PostgreSQL, MySQL, etc.
const knex = require("knex")({
    client: "pg", // PostgreSQL client
    connection: {
        host : process.env.DB_HOST || "localhost", // Database host
        user : process.env.DB_USER || "postgres", // Database user
        password : process.env.DB_PASSWORD || "admin", // Database password
        database : process.env.DB_NAME || "assignment3", // Database name
        port : process.env.DB_PORT || 5432  // Database port (PostgreSQL default is 5432)
    }
});

// Middleware to parse URL-encoded form data (from POST requests)
app.use(express.urlencoded({extended: true}));

// Function: getPokemon()
// Retrieves all Pokemon from the database, ordered by description
// Returns: Array of Pokemon objects
async function getPokemon() {
    let pokemon = await knex.select().from("pokemon")
            .orderBy("description");
    return pokemon;
}

// Route: GET / - Home page
// Renders the index page with empty pokemon array and no error message
app.get("/", async (req, res) => {
    if (req.session.isLoggedIn) {
        let pokemon = await getPokemon();
        // Render index page with pokemon data and no error message
        res.render("index", {pokemon: pokemon, errMessage: "", username: req.session.username, userLevel: req.session.level });
    }
    else {
        res.render("login", {errMessage: ""})
    }
});

// Route: GET /addUser - Display form to add a new user
// Only accessible if user is logged in, otherwise redirects to home page
app.get("/addUser", (req, res) => {
    if (req.session.isLoggedIn == true) {
        res.render("addUser");
    }
    else {
        res.redirect("/");
    }
});

// Route: POST /searchPokemon - Search for a specific Pokemon
// Takes a Pokemon name from the form, searches the database, and displays results
app.get("/searchPokemon", (req, res) => {
    // Get the Pokemon name from the form submission
    let pokemonName = req.query.pokemon;

    // Query database: select description and base_total columns
    // Use LOWER() to make the search case-insensitive
    knex.select("description", "base_total").from("pokemon")
        .whereRaw("LOWER(description) = ?", [pokemonName.toLowerCase()])
        .then(async foundPokemon => {
            // If Pokemon is found (array has items)
            if (foundPokemon.length != 0) {
                // Render search result page with the found Pokemon
                res.render("searchResult", {pokemon : foundPokemon[0]})
            }
            else {
                // If not found, render index page with error message
                let pokemon = await getPokemon();
                // Render index page with pokemon data and no error message
                res.render("index", {pokemon: pokemon, errMessage: `Cannot find ${pokemonName}`,
                    username: req.session.username, userLevel: req.session.level });
            }
        })
        .catch(async err => {
            // Handle any database errors
            console.error(err);
            let pokemon = await getPokemon();
            // Render index page with pokemon data and no error message
            res.render("index", {pokemon: pokemon, errMessage: "An error occurred while searching for the pokemon",
                    username: req.session.username, userLevel: req.session.level });
    });
});

// Route: POST /addUser - Create a new user in the database
// Receives user data from the form and inserts it into the users table
app.post("/addUser", (req, res) => {
        knex("users").insert(req.body).then(users => {
        res.redirect("/");
    })
});

// Route: GET /logout - Log out the current user
// Clears the session and redirects to the login page
app.get("/logout", (req, res) => {
    req.session.isLoggedIn = false;
    res.render("login", {errMessage: "Please log in"});
});

// Route: POST /login - Authenticate user login
// Validates username and password against the database
// If valid, creates a session and stores user info; otherwise shows error message
app.post("/login", (req, res) => {
    username = req.body.username;
    password = req.body.password;

    knex.select("username", "password", "level").from("users")
        .where("username", username).andWhere("password", password)
        .then(user => {
            if (user.length > 0) {
                req.session.isLoggedIn = true;
                req.session.username = username;
                req.session.level = user[0].level;
                res.redirect("/");
            }
            else {
                res.render("login", { errMessage: "Invalid Credentials" })
            }
        });
});

// Route: GET /editPokemon/:id - Display form to edit a specific Pokemon
// Retrieves the Pokemon by ID from the database and renders the edit form
app.get("/editPokemon/:id", (req, res) => {
    knex.select().from("pokemon").where("id", req.params.id)
        .then(pokemon => {
            res.render("editPokemon", { pokemon: pokemon[0] });
        })
});

// Route: POST /editPokemon/:id - Update a Pokemon in the database
// Receives updated Pokemon data from the form and updates the database record
// Redirects to home page on success, or shows error on failure
app.post("/editPokemon/:id", (req, res) => {
    let updatedData = { description: req.body.description, base_total: req.body.base_total};

    knex("pokemon").where({ id: req.params.id })
        .update(updatedData).then(() => {
            res.redirect("/")
        })
        .catch(err => {
            console.error(err);
            res.status(500).render("/editPokemon", {errMessage: "Error updating pokemon"});
        });
});

// Route: POST /deletePokemon/:id - Delete a Pokemon from the database
// Removes the Pokemon record with the specified ID
// Redirects to home page on success, or logs error on failure
app.post("/deletePokemon/:id", (req, res) => {
    knex("pokemon").where("id", req.params.id).del()
        .then(user => {
            res.redirect("/");
        })
        .catch(err => {
            console.error("Error deleting the pokemon:", fetchErr.message);
        })
});

// Route: GET /displayUsers - Display all users in the database
// Retrieves all users and renders the displayUsers page with user data and current user's level
app.get("/displayUsers", (req, res) => {
    knex("users").then((users) => {
        res.render("displayUsers", {users: users, userLevel: req.session.level})
    })
    .catch(err => {
        console.error(err);
        res.status(500).send("Error fetching users");
    })
});

// Route: GET /editUser/:id - Display form to edit a specific user
// Retrieves the user by ID from the database and renders the edit form
app.get("/editUser/:id", (req, res) => {
    knex.select().from("users").where("id", req.params.id)
        .then(user => {
            res.render("editUser", { user: user[0] });
        })
        .catch(err => {
            res.status(500).render("displayUsers", {users: [], errMessage: "Unable to edit user"})
        })
});

// Route: POST /editUser/:id - Update a user in the database
// Receives updated user data from the form and updates the database record
// Redirects to home page on success, or shows error on failure
app.post("/editUser/:id", (req, res) => {
    let updatedData = { username: req.body.username, password: req.body.password};

    knex("users").where({ id: req.params.id })
        .update(updatedData).then(() => {
            res.redirect("/")
        })
        .catch((fetchErr) => {
            console.error("Error fetching user after update failure:", fetchErr.message);
            res.status(500).render("displayUsers", {
                users: [],
                errMessage: "Unable to update user."
            });
        })
});

// Route: POST /deleteUser/:id - Delete a user from the database
// Removes the user record with the specified ID
// Redirects to home page on success, or shows error on failure
app.post("/deleteUser/:id", (req, res) => {
    knex("users").where("id", req.params.id).del()
        .then(user => {
            res.redirect("/");
        })
        .catch(err => {
            console.error("Error deleting the user:", fetchErr.message);
            res.status(500).render("displayUsers", {
                users: [],
                errMessage: "Unable to delete the user."
            });
        })
});

// Start the server and listen on the specified port
app.listen(port, () => {
    console.log("The server is listening");
});