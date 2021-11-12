const { Client, Intents, MessageEmbed } = require('discord.js');
let Portal;
let Matchmaker;

const config = require("./config.json");
const PortalUser = require("./PortalUser");

const msg_help = "**Usage:**\n" +
	"`" + config.prefix + "open <\"victim\"> [anonymous]`: Request a portal connection\n" +
	"    `\"victim\"`: The user that is partway through the portal. Username, ID, or ping may be used for this.\n" +
	"    `anonymous`: Optionally type `true` here to make your portal request anonymous.\n" +
	"`" + config.prefix + "close`: End a portal connection\n" +
	"`" + config.prefix + "queue [victim]`: Queues the user up for matchmaking.\n" +
	"    `victim`: If \"victim\", then user will be queued as a victim.\n" +
	"    [WORK IN PROGRESS]\n" +
	"`" + config.prefix + "unqueue`: Removes user from queue\n" +
	"    [WORK IN PROGRESS]\n";

module.exports = class Bot {
	static #client = new Client({intents: [
		Intents.FLAGS.GUILDS,
		Intents.FLAGS.GUILD_MEMBERS,
		Intents.FLAGS.GUILD_MESSAGES,
		Intents.FLAGS.GUILD_MESSAGE_TYPING,
		Intents.FLAGS.DIRECT_MESSAGES,
		Intents.FLAGS.DIRECT_MESSAGE_TYPING
	]});
	static get client() { return Bot.#client; }
	#portals = {};
	#pendingPortals = {};
	#matchmaker;

	static #instance;
	static get instance() { return Bot.#instance; }

	constructor() {
	}

	static async create() {
		let creatingMatchmaker = Matchmaker.create();

		let bot = new Bot();

		Bot.client.on('ready', async () => {
			console.info(`Successfully logged in as ${Bot.client.user.tag}`);

			let guilds = Bot.client.guilds.cache.map(g => g);
			for (const guild of guilds) {
				let members = await guild.members.fetch({ force: true });
			}
		});

		process.on('SIGINT', bot.shutdown.bind(bot));

		Bot.client.on('messageCreate', bot.handleMessage.bind(bot));
		Bot.client.on('messageUpdate', bot.handleEdit.bind(bot));
		Bot.client.on('messageDelete', bot.handleDelete.bind(bot));
		Bot.client.on('interactionCreate', bot.handleButton.bind(bot));
		Bot.client.on('threadUpdate', bot.handleThreadUpdate.bind(bot));
		Bot.client.on('threadDelete', bot.handleThreadDelete.bind(bot));

		console.info("Logging in...");
		Bot.client.login(config.token);

		bot.#matchmaker = await creatingMatchmaker;

		Bot.#instance = bot;
		return Bot.#instance;
	}

	async shutdown() {
		let closingPortals = [];
		for (const p in this.#portals) {
			if (!Object.hasOwnProperty.call(this.#portals, p)) { continue; }

			const portal = this.#portals[p];
			if (portal.closing) continue;
			closingPortals.push(portal.destroy({ shutdown: true }));
		}
		await Promise.all(closingPortals);

		Bot.client.destroy();
		process.exit();
	}

	async handleMessage(msg) {
		if (msg.author.bot) { return; }

		if (msg.content.startsWith(config.prefix)) { this.handleCommand(msg); return; }

		for (const p in this.#portals) {
			if (!Object.hasOwnProperty.call(this.#portals, p)) { continue; }

			const portal = this.#portals[p];
			if (portal.closing) continue;

			portal.handleMessage(msg);
		}
	}

	async handleCommand(msg) {
		if (msg.author.bot) { return; }

		console.info(msg.author.tag + " in " + msg.channel.name + ": " + msg.content);

		const args = msg.content.slice(config.prefix.length).trim().split(' ');
		const comm = args.shift().toLowerCase();

		if (this.#commands[comm]) {
			this.#commands[comm].bind(this)(msg, args);
		}
	}

	async handleEdit(oldMsg, newMsg) {
		if (oldMsg.author.bot) { return; }

		for (const p in this.#portals) {
			if (!Object.hasOwnProperty.call(this.#portals, p)) { continue; }

			const portal = this.#portals[p];
			if (portal.closing) continue;

			if (oldMsg.channel.id == portal.channel.id || oldMsg.channel.id == portal.victimChannel.id) {
				portal.handleEdit(oldMsg, newMsg);
			}
		}
	}

	async handleDelete(msg) {
		if (msg.author.bot) { return; }

		for (const p in this.#portals) {
			if (!Object.hasOwnProperty.call(this.#portals, p)) { continue; }

			const portal = this.#portals[p];
			if (portal.closing) continue;

			if (msg.channel.id == portal.channel.id || msg.channel.id == portal.victimChannel.id) {
				portal.handleDelete(msg);
			}
		}
	}

	async handleButton(interaction) {
		if (!interaction.isButton()) return;

		let btn = interaction.component;

		for (const p in this.#pendingPortals) {
			if (!Object.hasOwnProperty.call(this.#pendingPortals, p)) { continue; }

			const portal = this.#pendingPortals[p];
			if (interaction.user.id != portal.victim.id &&
				interaction.channelId != portal.channel.id) { continue; }

			let status;
			switch (await portal.handleButton(btn)) {
				case 'accept': {
					this.#portals[p] = portal;
					status = 'accepted';
					break;
				}
				case 'deny': {
					status = 'denied';
					break;
				}
				case 'cancel': {
					status = 'cancelled';
					break;
				}
				case 'error': {
					console.error("ERROR: Unknown button clicked!");
					status = 'errored';
					break;
				}
			}
			delete this.#pendingPortals[p];

			console.info(
				`Portal request ${status}\n` +
				`  Request count: ${Object.keys(this.#pendingPortals).length}\n` +
				`  Portal count:  ${Object.keys(this.#portals).length}\n`
			);
			return;
		}

		for (const p in this.#portals) {
			if (!Object.hasOwnProperty.call(this.#portals, p)) { continue; }

			const portal = this.#portals[p];
			if (interaction.user.id != portal.victim.id &&
				interaction.channelId != portal.channel.id) { continue; }

			let status;
			switch (await portal.handleButton(btn)) {
				case 'close': {
					status = 'closed';
					this.closePortal(p);
					break;
				}
			}

			console.info(
				`Portal request ${status}\n` +
				`  Request count: ${Object.keys(this.#pendingPortals).length}\n` +
				`  Portal count:  ${Object.keys(this.#portals).length}\n`
			);
		}
	}

	async handleThreadUpdate(oldThread, newThread) {
		if (newThread.archived) {
			for (const p in this.#portals) {
				if (!Object.hasOwnProperty.call(this.#portals, p)) { continue; }

				const portal = this.#portals[p];
				if (portal.closing) continue;

				if (newThread.id == portal.channel.id) {
					await portal.destroy({ timeout: true });
					delete this.#portals[p];
				}
			}
		}
	}

	async handleThreadDelete(thread) {
		for (const p in this.#portals) {
			if (!Object.hasOwnProperty.call(this.#portals, p)) { continue; }

			const portal = this.#portals[p];
			if (portal.closing) continue;

			if (thread.id == portal.channel.id) {
				await portal.destroy({ deleted: true });
				delete this.#portals[p];
			}
		}
	}

	getUser(userInfo) {
		return Bot.client.users.cache.find(u =>
			u.id == userInfo ||
			u.tag.toLowerCase() == userInfo.toLowerCase() ||
			u.username.toLowerCase() == userInfo.toLowerCase() ||
			u.id == userInfo.replace(/<@!?/, "").replace(/>+/, "")
		);
	}

	async createPortal(user, victim, channel, anon = false) {
		let portal = await Portal.create(user, victim, channel, anon);
		if (!portal) {
			return;
		} else {
			this.#pendingPortals[channel.id] = portal;
			console.info(`New portal request opened\n` +
						`  Request count: ${Object.keys(this.#pendingPortals).length}\n` +
						`  Portal count:  ${Object.keys(this.#portals).length}\n`);
		}
	}

	async closePortal(p)
	{
		if (!Object.hasOwnProperty.call(this.#portals, p)) {
			console.info(`ERROR! Cannot close portal ${p}\n\tDoesn't exist!`)
			return;
		}

		const portal = this.#portals[p];
		if (portal.closing) {
			console.info(`ERROR! Cannot close portal ${p}\n\tAlready closing!`)
			return;
		}

		await portal.destroy();
		delete this.#portals[p];

		console.info(
			`Portal closed.\n` +
			`  Request count: ${Object.keys(this.#pendingPortals).length}\n` +
			`  Portal count: ${Object.keys(this.#portals).length}\n`
		);
	}

	#commands = {
		help: async function(msg) {
			msg.channel.send(msg_help);
		},

		status: async function(msg) {
			let sent = await msg.channel.send("Checking status...");

			let statusEmbed = new MessageEmbed()
				.setTitle("Status")
				.setColor(0x000000)
				.setTimestamp(Date.now())
				.setAuthor(Bot.client.user.username, "", "https://github.com/ThalinsGenohan/portal-bot")
				.addFields([
					{ name: "Heartbeat",         value: `${Bot.client.ws.ping}ms` },
					{ name: "Latency",           value: `${sent.createdTimestamp - msg.createdTimestamp}ms` },
					{ name: "Portal Requests",   value: Object.keys(this.#pendingPortals).length.toString() },
					{ name: "Active Portals",    value: Object.keys(this.#portals).length.toString() },
					{ name: "Matchmaking Users", value: this.#matchmaker.totalCount.toString() },
				])
				.setFooter("Created by Thalins#0502", Bot.client.user.displayAvatarURL());

			sent.edit({ content: null, embeds: [statusEmbed] });
		},

		stop: async function(msg) {
			if (msg.author.id != config.owner) { return; }

			Bot.client.destroy();
			process.exit();
		},

		open: async function(msg, args) {
			if (this.#portals[msg.channel.id]) {
				msg.reply("There's already a portal open here!");
				return;
			}
			if (this.#pendingPortals[msg.channel.id]) {
				msg.reply("There's already a portal request open here!");
				return;
			}

			let victim = await PortalUser.create(this.getUser(args[0]));

			if (!victim) {
				msg.reply("User not found!");
				return;
			}

			if (victim.bot) {
				msg.reply("Can't open a portal for a bot!");
				return;
			}

			this.createPortal(msg.author, victim, msg.channel, args[1]?.toLowerCase() == 'true')
		},

		close: async function(msg) {
			for (const p in this.#portals) {
				if (!Object.hasOwnProperty.call(this.#portals, p)) { continue; }

				const portal = this.#portals[p];
				if (portal.closing) continue;

				if (p == msg.channel.id || portal.victimChannel.id == msg.channel.id) {
					closePortal(p);
				}
				msg.reply("There is no portal bound to this channel!");
			}
		},

		queue: async function(msg, args) {
			switch (await this.#matchmaker.addUser(msg.author, msg.channel, args[0]?.toLowerCase() == 'victim')) {
				case 'dupe': {
					msg.reply("You're already queued!");
					break;
				}
				case 'success': {
					msg.reply("You've been added to the matchmaking queue!");
					this.#matchmaker.matchUsers();
					break;
				}
				case 'success-victim': {
					msg.reply("You've been added to the matchmaking queue as a victim!");
					this.#matchmaker.matchUsers();
					break;
				}
			}

		},

		unqueue: async function(msg) {
			switch (this.#matchmaker.removeUser(msg.author)) {
				case 'noUser': {
					msg.reply("You're not queued!");
					break;
				}
				case 'success': {
					msg.reply("You've been removed the matchmaking queue!");
					break;
				}
			}
		},
	};
}

Portal = require("./Portal");
Matchmaker = require("./Matchmaker").Matchmaker;
