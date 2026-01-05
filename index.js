const express = require('express');
const app = express();

const sqlDatabase = require("./util/mysql");

app.get("/", async (req, res) => {
    // Andmebaasi test
    try {
        const [rows, fields] = await sqlDatabase.query("SELECT 1 + 1 AS solution");
        res.send(`The solution is: ${rows[0].solution}`);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.get("/checkip", (req, res) => {

});

app.post("/login", (req, res) => {

});

app.post("/register", (req, res) => {

});

app.listen(3000, () => {
    console.log("Server is running on port 3000");
});