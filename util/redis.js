const ioredis = require('ioredis');
require("dotenv").config();

const redis = new ioredis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || ''
});

module.exports = redis;