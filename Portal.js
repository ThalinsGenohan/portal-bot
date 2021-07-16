const disbut = require('discord-buttons');

let Bot = require("./Bot");
const PortalUser = require('./PortalUser');

const msg_open  = "```\n ```*The portal opens...*";
const msg_close = "*The portal closes...*```\n ```";
const msg_closeBot = msg_close + "The bot is shutting down. Apologies for any inconvenience.";

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

	#anon;
	#direct;
	#requestMsg;
	#dmRequestMsg;

	constructor(sender, channel, anon) {
		this.#sender = sender;
		this.#channel = channel;
		this.#anon = anon;
		this.#direct = channel.type == 'dm';
	}

	static async create(sender, victim, channel, anon = false) {
		let creatingVictim = PortalUser.create(victim);

		let portal = new Portal(sender, channel, anon);

		portal.#victim = await creatingVictim;
		portal.#victimChannel = portal.#victim.dmChannel;

		let success = portal.#victim && portal.#channel && portal.#victimChannel;
		if (success) {
			portal.#requestMsg = await portal.#channel.send(
				msg_requestSent.format(portal.#victim.username) + "\n" +
				msg_awaiting,
				new disbut.MessageButton()
					.setStyle('red')
					.setLabel("Cancel")
					.setID(`${channel.id}-cancel`)
			);
		} else {
			portal.#channel.send(msg_requestError.format(portal.#victim.username));
		}

		let buttons = new disbut.MessageActionRow().addComponents([
			new disbut.MessageButton()
			.setStyle('green')
			.setLabel("Yes")
			.setID(`${victim.id}-yes`),

			new disbut.MessageButton()
			.setStyle('red')
			.setLabel("No")
			.setID(`${victim.id}-no`),
		]);

		portal.#dmRequestMsg = await portal.#victim.send(
			msg_incomingRequest.format(portal.#anon
				? "anonymous"
				: portal.#sender.username
			),
			buttons
		);

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
		this.#dmRequestMsg = undefined;
	}

	async handleButton(btn) {
		btn.reply.defer();

		let status = 'error';
		if (btn.id.match(/.*-yes$/)) {
			this.#victim.send(msg_requestFromAccepted.format(this.#anon ? "anonymous" : this.#sender.username));
			this.#channel.send(
				msg_requestSent.format(this.#victim.username) + "\n" +
				msg_requestAccepted + "\n" +
				(this.#direct ? msg_noQuotesNeeded : msg_quotesNeeded)
			);

			this.#victim.send(msg_open);
			this.#channel.send(msg_open);

			status = 'accept';
		} else if (btn.id.match(/.*-no$/)) {
			this.#victim.send(msg_requestFromDenied.format(this.#anon ? "anonymous" : this.#sender.username));
			this.#channel.send(
				msg_requestSent.format(this.#victim.username) + "\n" +
				msg_requestDenied
			);
			status = 'deny';
		} else if (btn.id.match(/.*-cancel$/)) {
			this.#victim.send(msg_requestFromCancelled.format(this.#anon ? "anonymous" : this.#sender.username));
			this.#channel.send(
				msg_requestSent.format(this.#victim.username) + "\n" +
				msg_requestCancelled
			);
			status = 'cancel';
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
