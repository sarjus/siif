import { randomBytes, randomUUID, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';
import mysql from 'mysql2/promise';
import nextEnv from '@next/env';

nextEnv.loadEnvConfig(process.cwd());

const email = (process.env.ADMIN_BOOTSTRAP_EMAIL || '').trim().toLowerCase();
const password = process.env.ADMIN_BOOTSTRAP_PASSWORD || '';
delete process.env.ADMIN_BOOTSTRAP_EMAIL;
delete process.env.ADMIN_BOOTSTRAP_PASSWORD;

if (!email || !password) {
  throw new Error('Set ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD before running this command.');
}
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  throw new Error('ADMIN_BOOTSTRAP_EMAIL must be a valid email address.');
}
if (password.length < 12) {
  throw new Error('The initial admin password must be at least 12 characters.');
}
const missingMysqlConfig = ['MYSQL_HOST', 'MYSQL_USER', 'MYSQL_DATABASE']
  .filter((name) => !process.env[name]?.trim());
if (missingMysqlConfig.length) {
  throw new Error(`Missing MySQL configuration: ${missingMysqlConfig.join(', ')}.`);
}
const port = Number(process.env.MYSQL_PORT || 3306);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('MYSQL_PORT must be a valid TCP port.');
}

const scrypt = promisify(scryptCallback);
const salt = randomBytes(16).toString('hex');
const key = await scrypt(password, salt, 64);
const passwordHash = `scrypt$${salt}$${key.toString('hex')}`;
const connection = await mysql.createConnection({
  host: process.env.MYSQL_HOST || 'localhost',
  port,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
});

try {
  const [rows] = await connection.execute(
    'SELECT `id` FROM `auth_users` WHERE `role` = ? AND `is_active` = TRUE LIMIT 1',
    ['admin']
  );
  if (rows.length) {
    throw new Error('An active admin account already exists; bootstrap is only for the first admin.');
  }
  await connection.execute(
    'INSERT INTO `auth_users` (`id`, `email`, `role`, `password_hash`, `metadata`) VALUES (?, ?, ?, ?, ?)',
    [randomUUID(), email, 'admin', passwordHash, JSON.stringify({})]
  );
  console.log(`Created the initial admin account for ${email}.`);
} finally {
  await connection.end();
}
