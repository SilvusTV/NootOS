import { ConfigRepository, CONFIG_KEYS, CustomCommandRepository } from '../../utils/db';
import { askNoot, chunks, transcribeAttachment } from '../../utils/noot/assistant';

export = {
  name: 'messageCreate',
  once: false,
  async execute(client: any, message: any) {
    if (!message.guild || message.author.bot) {
      return;
    }
    if (process.env.GUILD_ID && message.guild.id !== process.env.GUILD_ID) return;

    const configRepository = new ConfigRepository();
    configRepository.ensureDefaultGuildConfig(message.guild.id);

    const nootChannel = configRepository.getValue(message.guild.id, CONFIG_KEYS.nootChannel);
    if (message.channelId === nootChannel || message.mentions.users.has(client.user.id)) {
      try {
        await message.channel.sendTyping();
        let question = message.content.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim();
        const audio = message.attachments.find((a: any) => a.contentType?.startsWith('audio/') || /\.(ogg|mp3|wav|m4a|webm|mp4)$/i.test(a.name || ''));
        if (audio) question += `\n${await transcribeAttachment(audio)}`;
        if (!question.trim()) return;
        const answer = await askNoot({ guildId: message.guild.id, channelId: message.channelId, userId: message.author.id }, question);
        for (const content of chunks(answer)) await message.reply({ content, allowedMentions: { parse: [], repliedUser: false } });
      } catch (e) {
        await message.reply({ content: e instanceof Error ? e.message : 'Un souci est survenu, réessaie dans un instant.', allowedMentions: { parse: [], repliedUser: false } });
      }
      return;
    }

    const prefix = configRepository.getValue(message.guild.id, CONFIG_KEYS.customCommandPrefix) || '!';
    if (!message.content.startsWith(prefix)) {
      return;
    }

    const raw = message.content.slice(prefix.length).trim();
    if (!raw.length) {
      return;
    }

    const commandName = raw.split(/\s+/)[0];
    const customCommandRepository = new CustomCommandRepository();
    const command = customCommandRepository.findByCommand(message.guild.id, commandName);

    if (!command || !command.isActive) {
      return;
    }

    await message.reply({ content: command.response });
  },
};

