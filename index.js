const express = require('express');
const app = express();

const sqlDatabase = require("./util/mysql");
const redisClient = require("./util/redis");

app.use(express.json());

const test = async () => {
    try {
        await sqlDatabase.query("SELECT 1 + 1 AS solution");

        // Automaatne tabeli loomine
        await sqlDatabase.query("CREATE TABLE IF NOT EXISTS ips (id INT AUTO_INCREMENT PRIMARY KEY, ip VARBINARY(16) NOT NULL, is_tor BOOLEAN DEFAULT FALSE, is_host BOOLEAN DEFAULT FALSE, asn INT DEFAULT NULL, isp VARCHAR(255) DEFAULT NULL, country_code CHAR(2) DEFAULT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)");
        
        console.log("SQL database connection established!");

    } catch (err) {
        // Shut down
        console.error("Database connection failed:", err);
        process.exit(1);
    }
};
test();

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