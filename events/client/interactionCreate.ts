export = {
  name: 'interactionCreate',
  once: false,
  async execute(client: any, interaction: any) {
    if (process.env.GUILD_ID && interaction.guildId !== process.env.GUILD_ID) {
      if (interaction.isAutocomplete()) return interaction.respond([]);
      if (interaction.isRepliable()) return interaction.reply({ content: 'NootOS est configuré pour votre serveur privé.', ephemeral: true });
      return;
    }
    if (interaction.isAutocomplete()) {
      const cmd = client.commands.get(interaction.commandName);
      if (cmd?.runAutocomplete) await cmd.runAutocomplete(client, interaction);
      else await interaction.respond([]);
      return;
    }
    if (interaction.isMessageComponent()) {
      const { handleNotebookDeleteComponent } = await import('../../utils/noot/delete');
      if (await handleNotebookDeleteComponent(client, interaction)) return;
      const { handleRecommendationComponent } = await import('../../utils/recommendations');
      if (await handleRecommendationComponent(client, interaction)) return;
      const { handleRecommendationListComponent } = await import('../../utils/recommendations/list');
      if (await handleRecommendationListComponent(client, interaction)) return;
    }
    if (interaction.isCommand() || interaction.isContextMenuCommand()) {
      const cmd = client.commands.get(interaction.commandName);
      if (!cmd) return interaction.reply("Cette commande n'existe pas !");

      // @ts-ignore ownerID may be defined globally elsewhere
      if (cmd.ownerOnly) {
        // @ts-ignore
        if (interaction.user.id !== ownerID)
          return interaction.reply("La seule personne pouvant taper cette commande est l'owner du bot!");
      }

      await cmd.runInteraction(client, interaction);
    } else if (interaction.isStringSelectMenu()) {
      const selectMenu = client.selects.get(interaction.customId);
      if (!selectMenu) return interaction.reply("ce menu n'existe pas.");
      await selectMenu.runInteraction(client, interaction);
    }
  },
};
