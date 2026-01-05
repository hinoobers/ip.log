const express = require('express');
const app = express();
const fs = require('fs');

const sqlDatabase = require("./util/mysql");
const redisClient = require("./util/redis");

app.use(express.json());

const startup = async () => {
    try {
        await sqlDatabase.query("SELECT 1 + 1 AS solution");

        // Automaatne tabeli loomine
        await sqlDatabase.query("CREATE TABLE IF NOT EXISTS ips (id INT AUTO_INCREMENT PRIMARY KEY, ip VARBINARY(16) NOT NULL, is_tor BOOLEAN DEFAULT FALSE, is_host BOOLEAN DEFAULT FALSE, asn INT DEFAULT NULL, isp VARCHAR(255) DEFAULT NULL, country_code CHAR(2) DEFAULT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)");

        console.log("SQL database connection established!");

    } catch (err) {
        // Shut down
        console.error("Database connection failed:", err);
        process.exit(1);
        return;
    }

    const response = await fetch('https://onionoo.torproject.org/summary?type=relay&running=true&fields=or_addresses');
    const data = await response.json();
    const torNodes = data.relays
    .map((relay) => relay.a) 
    .flat()
    .map((addr) => {
        if (addr.startsWith("[") && addr.includes("]")) {
            return addr.slice(1, addr.indexOf("]"));
        }
        return addr.split(":")[0];
    });

    // Salvesta andmebaasi
    for(const node of torNodes) {
        console.log(node);
        await sqlDatabase.query("UPDATE ips SET is_tor = TRUE WHERE ip = INET6_ATON(?)", [node]);
    }
    console.log("Tor nodes updated in database.");
};
startup();

app.get("/checkip", async (req, res) => {
    const ip = req.query.ip;
    console.log(ip);
    if(!ip) {
        return res.status(400).json({error: "IP parameter is required"});
    }

    if(typeof ip !== 'string') {
        return res.status(400).json({error: "IP must be a string"});
    }


    const ipv4 = ip.match(/^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/);
    const ipv6 = ip.match(/^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|(::([0-9a-fA-F]{1,4}:){0,5}[0-9a-fA-F]{1,4})|([0-9a-fA-F]{1,4}::([0-9a-fA-F]{1,4}:){0,5}[0-9a-fA-F]{1,4}))$/);

    if(!ipv4 && !ipv6) {
        return res.status(400).json({error: "Invalid IP format"});
    }

    // Redis enne
    redisClient.get(ip, async (err, result) => {
        if (err) {
            return res.json({error: err.message});
        }
        if (result) {
            return res.json({method: "redis", data: JSON.parse(result)});
        } else {
            const a = await sqlDatabase.query("SELECT * FROM ips WHERE ip = INET6_ATON(?)", [ip]);
            if(a[0].length > 0) {
                // Salvestame redisesse
                const data = a[0][0];
                // vÕtame ära id ja ip (kliendid ei pea seda nägema)
                delete data.id;
                delete data.ip;
                delete data.created_at;

                redisClient.set(ip, JSON.stringify(data), 'EX', 3600); // 1 hour expiration
                return res.json({method: "mysql", data: data});
            } else {
                // Pole andmebaasis, kasutame ip-apit, et selle endale lisada
                const url = `http://ip-api.com/json/${ip}?fields=status,message,as,isp,countryCode,proxy,hosting`;
                fetch(url)
                    .then(response => response.json())
                    .then(async data => {
                        if(data.status !== "success") {
                            return res.status(500).json({error: "IP not found"});
                        } else {
                            // Lisame enda andmebaasi
                            await sqlDatabase.query("INSERT INTO ips (ip, is_host, asn, isp, country_code) VALUES (INET6_ATON(?), ?, ?, ?, ?)", [
                                ip,
                                data.hosting,
                                data.as.split(" ")[0].replace("AS", ""),
                                data.isp,
                                data.countryCode
                            ]);
                            return res.json({method: "external", data: {
                                is_host: data.hosting,
                                asn: data.as.split(" ")[0].replace("AS", ""),
                                isp: data.isp,
                                country_code: data.countryCode
                            }});
                        }
                    });
            }
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