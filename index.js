const express = require('express');
const app = express();

const sqlDatabase = require("./util/mysql");
const redisClient = require("./util/redis");

app.use(express.json());

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
    const ip = req.query.ip;

    // Redis enne
    redisClient.get(ip, (err, result) => {
        if (err) {
            return res.json({error: err.message});
        }
        if (result) {
            return res.json({method: "redis", data: JSON.parse(result)});
        } else {
            sqlDatabase.query("SELECT * FROM ips WHERE ip = ?", [ip], (err, results) => {
                if (err) {
                    return res.status(500).send(err.message);
                }
                if (results.length > 0) {
                    redisClient.set(ip, JSON.stringify(results[0]));
                    return res.json({method: "sql", data: results[0]});
                } else {
                    return res.json({error: "IP not found"});
                }
            });
        }
    });
});

app.post("/login", (req, res) => {

});

app.post("/register", (req, res) => {

});

app.listen(3000, () => {
    console.log("Server is running on port 3000");
});