import fastifyPostgres from '@fastify/postgres';
import axios from 'axios';
import dotenv from 'dotenv';
import Fastify from 'fastify';
import { SkinportItem } from './interfaces/item.interface';

dotenv.config();

const fastify = Fastify();

fastify.register(fastifyPostgres, {
  connectionString: process.env.DATABASE_URL,
});

// Имитирую кэш.
const cache: {
  data: Record<string, { cachedTime: number; ttl: number; value: any }>;
  set: (key: string, value: any, ttl: number) => void;
  get: (key: string) => any | null;
} = {
  data: {},
  set(key: string, value: any, ttl: number) {
    this.data[key] = { cachedTime: Date.now(), ttl, value };
  },
  get(key: string) {
    const cachedItem = this.data?.[key];
    if (cachedItem && Date.now() - cachedItem.cachedTime < cachedItem.ttl) {
      return cachedItem.value;
    }
    delete this.data[key];
    return null;
  },
};

fastify.get('/items', async (request, reply) => {
  const cacheKey = 'items';
  const cachedData = await cache.get(cacheKey);
  if (cachedData) return reply.send(cachedData.item);
  try {
    const [{ data: tradables }, { data: nonTradables }] = await Promise.all([
      axios.get('https://api.skinport.com/v1/items?tradable=true', {
        headers: {
          'Accept-Encoding': 'br',
        },
      }),
      axios.get('https://api.skinport.com/v1/items', {
        headers: {
          'Accept-Encoding': 'br',
        },
      }),
    ]);
    const merged: Record<string, SkinportItem> = {};
    for (const item of [...tradables, ...nonTradables]) {
      if (!merged[item['market_hash_name']]) {
        merged[item['market_hash_name']] = {
          ...item,
          tradable_min_price: item.min_price,
        };
      } else {
        merged[item['market_hash_name']].non_tradable_min_price = item.min_price;
      }
    }
    const result = Object.values(merged);
    cache.set(cacheKey, result, 300000);
    return result;
  } catch (error) {
    return reply.status(500).send({ error: 'Failed to fetch items' });
  }
});

fastify.post('/purchase', async (request, reply) => {
  const { userId, amount } = request.body as { userId: number; amount: number };
  if (!userId || !amount || amount <= 0) return reply.status(400).send({ error: 'Invalid input' });
  const client = await fastify.pg.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT balance FROM users WHERE id = $1 FOR UPDATE', [userId]);
    if (rows.length === 0) return reply.status(400).send({ error: 'User not found' });
    if (rows[0].balance < amount) return reply.status(400).send({ error: 'Insufficient balance' });
    await client.query('UPDATE users SET balance = balance - $1 WHERE id = $2', [amount, userId]);
    await client.query('COMMIT');
    return reply.send({ success: true });
  } catch (error: any) {
    await client.query('ROLLBACK');
    return reply.status(500).send({ error: 'Internal Server Error' });
  } finally {
    client.release();
  }
});

const start = async () => {
  try {
    await fastify.ready();
    const client = await fastify.pg.connect();
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        balance DECIMAL NOT NULL DEFAULT 0
      );
    `);
    await client.query(`
      INSERT INTO users (id, balance)
      VALUES (1, 100)
      ON CONFLICT (id) DO NOTHING;
    `);
    client.release();

    await fastify.listen({ port: 3000 });
    console.log(`Server running on port ${process.env.PORT || 3000}`);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

start();
