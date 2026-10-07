import { ActivityType } from 'discord.js';
import Logger from '../../utils/Logger';
import { ConfigRepository, ensureDatabaseInitialized } from '../../utils/db';
import { Notebook } from '../../utils/noot/notebook';

export = {
  name: 'clientReady',
  once: true,
  async execute(client: any) {
    // Ensure DB exists and is initialized from schema if missing
    await ensureDatabaseInitialized();
    const configRepository = new ConfigRepository();
    const guildsCount = await client.guilds.fetch();

    guildsCount.forEach((guild: any) => {
      configRepository.ensureDefaultGuildConfig(guild.id);
      new Notebook().syncRecommendations(guild.id);
    });

    client.user.setPresence({ activities: [{ name: 'vos prochaines soirées 🐧 | /aide', type: ActivityType.Watching }], status: 'online' });

    const commands = client.commands.map((cmd: any) => ({ name: cmd.name, description: cmd.description, options: cmd.options || [], type: cmd.type || 1, defaultMemberPermissions: cmd.defaultMemberPermissions }));
    if (process.env.GUILD_ID) {
      const guild = await client.guilds.fetch(process.env.GUILD_ID);
      await guild.commands.set(commands);
      // Remove legacy global /reco commands when using the private guild registration.
      await client.application.commands.set([]);
    } else await client.application.commands.set(commands);
    Logger.client(
      `Bot ready on ${guildsCount.size} servers\n\n--------\n${process.env.DISCORD_BOT_NAME} ©2025\n--------\nAuthor:\n-Silvus\n--------\n`,
    );
  },
};
