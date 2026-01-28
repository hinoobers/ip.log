const express = require('express');
const app = express();
const bcrypt = require('bcrypt');
const jsonwebtoken = require('jsonwebtoken');

const sqlDatabase = require("./util/mysql");
const redisClient = require("./util/redis");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('frontend'));

const ratelimit = [];

const startup = async () => {
    try {
        await sqlDatabase.query("SELECT 1 + 1 AS solution");

        // Automaatne tabeli loomine
        await sqlDatabase.query("CREATE TABLE IF NOT EXISTS ips (id INT AUTO_INCREMENT PRIMARY KEY, ip VARBINARY(16) NOT NULL, is_tor BOOLEAN DEFAULT FALSE, is_host BOOLEAN DEFAULT FALSE, asn INT DEFAULT NULL, isp VARCHAR(255) DEFAULT NULL, country_code CHAR(2) DEFAULT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)");
        await sqlDatabase.query("CREATE TABLE IF NOT EXISTS users (id INT AUTO_INCREMENT PRIMARY KEY, email VARCHAR(255) NOT NULL, password_hash VARCHAR(255) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)");
        await sqlDatabase.query("CREATE TABLE IF NOT EXISTS api_keys (id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, api_key VARCHAR(64) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id))");

        console.log("SQL database connection established!");

    } catch (err) {
        // Shut down
        console.error("Database connection failed:", err);
        process.exit(1);
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

    await sqlDatabase.query("CREATE TEMPORARY TABLE tor_ips (ip VARBINARY(16) PRIMARY KEY)");

    const values = torNodes.map(ip => [ip]);
    await sqlDatabase.query(
        "INSERT IGNORE INTO tor_ips (ip) VALUES " +
        values.map(() => "(INET6_ATON(?))").join(","),
        torNodes
    );

    await sqlDatabase.query(`
        UPDATE ips
        JOIN tor_ips ON ips.ip = tor_ips.ip
        SET ips.is_tor = TRUE
    `);
};
startup();

app.get("/checkip", async (req, res) => {
    if(req.headers['x-api-key']) {
        const apiKey = req.headers['x-api-key'];
        const a = await sqlDatabase.query("SELECT * FROM api_keys WHERE api_key = ?", [apiKey]);
        if(a[0].length === 0) {
            return res.status(403).json({error: "Invalid API key"});
        }
    } else {
        // Luba, aga piiratud ainult isiklikuks kasutamiseks
        // TODO: Rate limiit
        const userAgent = req.headers['user-agent'].toLowerCase() || '';
        if(userAgent.length < 15 || userAgent.includes("curl") || userAgent.includes("postmanruntime") || userAgent.includes("python-requests") || userAgent.includes("java") || userAgent.includes("go-http-client") || userAgent.includes("crawler") || userAgent.includes("spider") || userAgent.includes("bot")) {
            return res.status(403).json({error: "Forbidden"});
        }
    }

    const ip = req.query.ip;
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
                if(!data.asn) {
                    delete data.asn;
                }

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
                            
                            if(data.as) {
                                // Lisame enda andmebaasi
                                await sqlDatabase.query("INSERT INTO ips (ip, is_host, asn, isp, country_code) VALUES (INET6_ATON(?), ?, ?, ?, ?)", [
                                    ip,
                                    data.hosting,
                                    data.as.split(" ")[0].replace("AS", ""),
                                    data.isp,
                                    data.countryCode
                                ]);
                            } else {
                                // ASNI pole
                                await sqlDatabase.query("INSERT INTO ips (ip, is_host, isp, country_code) VALUES (INET6_ATON(?), ?, ?, ?)", [
                                    ip,
                                    data.hosting,
                                    data.isp,
                                    data.countryCode
                                ]);
                            }
                            
                            const json = JSON.stringify({
                                is_host: data.hosting,
                                asn: data.as.split(" ")[0].replace("AS", ""),
                                isp: data.isp,
                                country_code: data.countryCode
                            }, (key, value) => {
                              return (value === null || value === "") ? undefined : value;
                            });
                            return res.json({method: "external", data: JSON.parse(json)});
                        }
                    });
            }
        }
    });
});

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);

    jsonwebtoken.verify(token, "secret_key", (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

app.post("/createapikey", authenticateToken, async (req, res) => {
    const apiKey = require('crypto').randomBytes(16).toString('hex');
    const userId = req.user.userId;
    await sqlDatabase.query("INSERT INTO api_keys (user_id, api_key) VALUES (?, ?)", [userId, apiKey]);
    return res.json({apiKey});
});

app.post("/login", async (req, res) => {
    const {
        email,
        password
    } = req.body;

    if(!email || !password) {
        return res.status(400).json({error: "Email and password are required"});
    }

    const user = await sqlDatabase.query("SELECT * FROM users WHERE email = ?", [email]);
    if(user[0].length === 0) {
        return res.status(400).json({error: "Invalid email or password"});
    }

    const validPassword = await bcrypt.compare(password, user[0][0].password_hash);
    if(!validPassword) {
        return res.status(400).json({error: "Invalid email or password"});
    }

    const token = jsonwebtoken.sign({userId: user[0][0].id}, "secret_key", {expiresIn: '1h'});
    return res.json({token});
});

app.post("/register", async (req, res) => {
    const {
        email,
        password
    } = req.body;

    if(!email || !password) {
        return res.status(400).json({error: "Email and password are required"});
    }

    // Kontrollime, kas kasutaja on juba olemas
    const existingUser = await sqlDatabase.query("SELECT * FROM users WHERE email = ?", [email]);
    if(existingUser[0].length > 0) {
        return res.status(400).json({error: "User already exists"});
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    await sqlDatabase.query("INSERT INTO users (email, password_hash) VALUES (?, ?)", [email, passwordHash]);
    return res.json({message: "User registered successfully"});
});

app.listen(3000, () => {
    console.log("Server is running on port 3000");
});
