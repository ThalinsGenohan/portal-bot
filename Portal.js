const Discord = require("discord.js");
let Bot = require("./Bot");

const msg_divider = "```\n ```";
const msg_open  = "*The portal opens...*";
const msg_close = "*The portal closes...*";
const msg_shutdown = "The bot is shutting down. Apologies for any inconvenience.";
const msg_timeout = "The portal thread was archived.";
const msg_delete = "The portal thread was deleted.";

const msg_requestSent     = "Portal request successfully sent to {0}!";
const msg_awaiting        = "Awaiting response..."
const msg_requestError    = "Portal request could not be sent to {0}!";
const msg_incomingRequest = "Incoming portal request from {0}!\nDo you accept?";

const msg_requestAccepted      = "Request accepted!";
const msg_requestDenied        = "Request denied.";
const msg_requestCancelled     = "Request cancelled."
const msg_requestFromAccepted  = "Request from {0} accepted!";
const msg_requestFromDenied    = "Request from {0} denied.";
const msg_requestFromCancelled = "Request from {0} cancelled."

const msg_quotesNeeded   = "Quote text (prefix a line with `> `) to send through the portal.";
const msg_noQuotesNeeded = "Because this is direct through DMs, you do not need to prefix your messages.";

module.exports = class Portal {
	#sender;
	get sender() { return this.#sender; }
	#victim;
	get victim() { return this.#victim; }
	#channel;
	get channel() { return this.#channel; }
	#victimChannel;
	get victimChannel() { return this.#victimChannel; }
	#closing;
	get closing() { return this.#closing; }

	#anon;
	#direct;
	#requestMsg;
	#dmRequestMsg;

	constructor(sender, victim, channel, anon) {
		this.#sender = sender;
		this.#victim = victim;
		this.#channel = channel;
		this.#closing = false;
		this.#anon = anon;
		this.#direct = channel.type == 'DM';
	}

	static async create(sender, victim, channel, anon = false) {
		let portal = new Portal(sender, victim, channel, anon);

		portal.#victimChannel = portal.#victim.dmChannel;

		let success = portal.#victim && portal.#channel && portal.#victimChannel;
		if (!success) {
			portal.#channel.send(msg_requestError.format(portal.#victim.username));
			return undefined;
		}

		let cancelButton = new Discord.MessageActionRow().addComponents(
			new Discord.MessageButton()
				.setStyle('DANGER')
				.setLabel("Cancel")
				.setCustomId(`${channel.id}-cancel`)
		);
		portal.#requestMsg = await portal.#channel.send({
			content: msg_requestSent.format(portal.#victim.username) + "\n" + msg_awaiting,
			components: [ cancelButton ]
		});
		portal.victim.status = 'pending';

		let buttons = new Discord.MessageActionRow().addComponents(
			new Discord.MessageButton()
				.setStyle('SUCCESS')
				.setLabel("Yes")
				.setCustomId(`${victim.id}-yes`),

			new Discord.MessageButton()
				.setStyle('DANGER')
				.setLabel("No")
				.setCustomId(`${victim.id}-no`),
		);

		portal.#dmRequestMsg = await portal.#victim.send({
			content: msg_incomingRequest.format(portal.#anon
				? "anonymous"
				: portal.#sender.username
			),
			components: [ buttons ]
		});

		return portal;
	}

	async destroy(options = { shutdown: false, timeout: false, deleted: false } ) {
		this.#closing = true;

		if (options.timeout) {
			await this.#victim.send(msg_close + msg_divider + msg_timeout);

			await this.#channel.setArchived(false);
			await this.#channel.send(msg_close + "\n" + msg_timeout);
		} else if (options.deleted) {
			await this.#victim.send(msg_close + msg_divider + msg_delete);
			await this.#channel.parent.send(msg_delete);
		} else {
			await this.#victim.send(msg_close + msg_divider + (options.shutdown ? msg_shutdown : ""));
			await this.#channel.send(msg_close + (this.#direct ? msg_divider : "") + (options.shutdown ? "\n" + msg_shutdown : ""));
		}
		if (!this.#direct && !options.deleted) { await this.#channel.setArchived(true); }

		this.#victim.status = 'idle';

		this.#sender = undefined;
		this.#victim = undefined;
		this.#channel = undefined;
		this.#victimChannel = undefined;
		this.#direct = undefined;
		this.#requestMsg = undefined;
		this.#dmRequestMsg = undefined;
	}

	async handleButton(btn) {
		let status = 'error';
		if (btn.customId.match(/.*-yes$/)) {
			await this.#victim.send(msg_requestFromAccepted.format(this.#anon ? "anonymous" : this.#sender.username));
			await this.#channel.send(
				msg_requestSent.format(this.#victim.username) + "\n" +
				msg_requestAccepted + "\n" +
				(this.#direct ? msg_noQuotesNeeded : msg_quotesNeeded)
			);

			await this.#victim.send(msg_divider + msg_open);
			if (!this.#direct) {
				this.#channel = await this.#channel.threads.create({
					name: `Portal to ${this.#victim.username}`,
					autoArchiveDuration: 1440,
					reason: "Opened portal",
				});
			}
			await this.#channel.send((this.#direct ? msg_divider : "") + msg_open);

			status = 'accept';
			this.#victim.status = 'connected';
		} else if (btn.customId.match(/.*-no$/)) {
			await this.#victim.send(msg_requestFromDenied.format(this.#anon ? "anonymous" : this.#sender.username));
			await this.#channel.send(
				msg_requestSent.format(this.#victim.username) + "\n" +
				msg_requestDenied
			);

			status = 'deny';
			this.#victim.status = 'idle';
		} else if (btn.customId.match(/.*-cancel$/)) {
			await this.#victim.send(msg_requestFromCancelled.format(this.#anon ? "anonymous" : this.#sender.username));
			await this.#channel.send(
				msg_requestSent.format(this.#victim.username) + "\n" +
				msg_requestCancelled
			);

			status = 'cancel';
			this.#victim.status = 'idle';
		}
		this.#requestMsg.delete();
		this.#dmRequestMsg.delete();

		return status;
	}

	handleMessage(msg) {
		if (msg.channel.id == this.#victimChannel.id) {
			this.#channel.send(msg.content);
		} else if (msg.channel.id == this.#channel.id) {
			let m = msg.content;
			if (!this.#direct) {
				m = msg.content.replace(/^> (.*)|.*/gm, "$1").trim().replace(/\n\n+/g, "\n");
			}
			if (m == "") { return; }
			this.#victim.send(m);
		}
	}

	handleEdit(oldMsg, newMsg) {
		let m = oldMsg.content;
		let n = newMsg.content;
		let channel;
		if (oldMsg.channel.id == this.#channel.id) {
			channel = this.#victimChannel;
			if (!this.#direct) {
				m = m.replace(/^> (.*)|.*/gm, "$1").trim().replace(/\n\n+/g, "\n");
				n = n.replace(/^> (.*)|.*/gm, "$1").trim().replace(/\n\n+/g, "\n");
			}
		} else if (oldMsg.channel.id == this.#victimChannel.id) {
			channel = this.#channel;
		}

		let messages = channel.messages.cache.map(m => m);
		for (const message of messages) {
			if (m == message.content && Bot.client.user.id == message.author.id) {
				message.edit(newMsg.content);
			}
		}
	}

	handleDelete(msg) {
		let m = msg.content;

		let channel;
		if (msg.channel.id == this.#channel.id) {
			channel = this.#victimChannel;
			if (!this.#direct) {
				m = m.replace(/^> (.*)|.*/gm, "$1").trim().replace(/\n\n+/g, "\n");
			}
		} else if (msg.channel.id == this.#victimChannel.id) {
			channel = this.#channel;
		}

		let messages = channel.messages.cache.map(m => m);
		for (const message of messages) {
			if (m == message.content && Bot.client.user.id == message.author.id) {
				message.delete();
			}
		}

	}
}
