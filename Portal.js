const disbut = require('discord-buttons');

let Bot = require("./Bot");

const msg_open  = "```\n ```*The portal opens...*";
const msg_close = "*The portal closes...*```\n ```";
const msg_closeBot = msg_close + "The bot is shutting down. Apologies for any inconvenience.";

const msg_requestSent     = "Portal request successfully sent to {0}!\nAwaiting response...";
const msg_requestError    = "Portal request could not be sent to {0}!";
const msg_incomingRequest = "Incoming portal request from {0}!\nDo you accept?";
const msg_requestAccepted = "Request accepted!";
const msg_requestDenied   = "Request denied.";

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
	#direct;

	#requestMsg;

	constructor(sender, victim, channel) {
		this.#sender = sender;
		this.#victim = victim;
		this.#channel = channel;
		this.#direct = channel.type == 'dm';
	}

	static async create(sender, victim, channel, anon = false) {
		let portal = new Portal(sender, victim, channel);

		portal.#victimChannel = await victim.createDM();

		let success = portal.#victim && portal.#channel && portal.#victimChannel;
		if (success) {
			portal.#requestMsg = await portal.#channel.send(msg_requestSent.format(portal.#victim.username));
		} else {
			portal.#channel.send(msg_requestError.format(portal.#victim.username));
		}

		let yesBtn = new disbut.MessageButton()
			.setStyle('green')
			.setLabel("Yes")
			.setID(`${victim.id}-yes`);

		let noBtn = new disbut.MessageButton()
			.setStyle('red')
			.setLabel("No")
			.setID(`${victim.id}-no`);

		let buttons = new disbut.MessageActionRow().addComponents([ yesBtn, noBtn ]);

		await portal.#victim.send(msg_incomingRequest.format(anon ? "anonymous" : sender.username), buttons);

		return portal;
	}

	async destroy(shutdown = false) {
		let msg = shutdown ? msg_closeBot : msg_close;

		await this.#victim.send(msg);
		await this.#channel.send(msg);

		this.#sender = undefined;
		this.#victim = undefined;
		this.#channel = undefined;
		this.#victimChannel = undefined;
		this.#direct = undefined;
		this.#requestMsg = undefined;
	}

	async handleButton(btn) {
		btn.reply.defer();
		btn.message.delete();

		if (btn.id.match(/.*-yes$/)) {
			this.#victim.send(msg_requestAccepted);
			this.#requestMsg.edit(`${msg_requestAccepted}\n` +
				(this.#direct ? msg_noQuotesNeeded : msg_quotesNeeded)
			);

			this.#victim.send(msg_open);
			this.#channel.send(msg_open);

			return true;
		}
		if (btn.id.match(/.*-no$/)) {
			this.#victim.send(msg_requestDenied);
			this.#channel.send(msg_requestDenied);
			return false;
		}

		console.error("ERROR: Unknown button clicked!");
		return false;
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
