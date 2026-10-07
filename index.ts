import { Client, Collection, GatewayIntentBits, Partials } from 'discord.js';
import dotenv from 'dotenv';
import CommandUtil from './utils/handlers/CommandUtil';
import EventUtil from './utils/handlers/EventUtil';
import SelectUtil from './utils/handlers/SelectUtil';
import { closeDb, ensureDatabaseInitialized } from './utils/db';

dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

// Extend client with custom collections (minimal typing)
(client as any).commands = new Collection();
['selects'].forEach((x) => ((client as any)[x] = new Collection()));

async function start() {
  if (!process.env.DISCORD_TOKEN) throw new Error('Renseigne DISCORD_TOKEN dans .env.');
  await ensureDatabaseInitialized();
  await CommandUtil(client);
  await EventUtil(client);
  await SelectUtil(client);
  await client.login(process.env.DISCORD_TOKEN);
}

process.on('exit', (code) => {
  closeDb();
  console.log(`le processus s'est arrêté avec le code ${code}!`);
});
process.on('uncaughtException', (err, origin) => {
  console.log(`UNCAUGHT_EXCEPTION: ${err}`, `Origine:${origin}`);
});
process.on('unhandledRejection', (reason, promise) => {
  console.log(`UNHANDLED_REJECTION: ${reason}\n------\n`, promise);
});
process.on('warning', (...args) => console.log(...args));

start().catch((error) => { console.error(error.message); process.exitCode = 1; });
