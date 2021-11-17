const { MessageActionRow, MessageButton } = require("discord.js");
let Bot = require("./Bot");
require('json5/lib/register');

const strings = require("./strings.json5")

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
	#closeButtonMsgs = [];

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
			portal.#channel.send(strings.portal.request.error.format(portal.#victim.username));
			return undefined;
		}

		let cancelButton = new MessageActionRow().addComponents(
			new MessageButton()
				.setStyle('DANGER')
				.setLabel(strings.buttons.text.cancel)
				.setCustomId(strings.buttons.ids.cancel.format(channel.id))
		);
		portal.#requestMsg = await portal.#channel.send({
			content: strings.portal.request.sent.format(portal.#victim.username) + '\n' + strings.portal.request.awaiting,
			components: [ cancelButton ]
		});
		portal.victim.status = 'pending';

		let buttons = new MessageActionRow().addComponents(
			new MessageButton()
				.setStyle('SUCCESS')
				.setLabel(strings.buttons.text.yes)
				.setCustomId(strings.buttons.ids.yes.format(victim.id)),

			new MessageButton()
				.setStyle('DANGER')
				.setLabel(strings.buttons.text.no)
				.setCustomId(strings.buttons.ids.no.format(victim.id)),
		);

		portal.#dmRequestMsg = await portal.#victim.send({
			content: strings.portal.request.incoming.format(portal.#anon
				? strings.portal.anonymous
				: portal.#sender.username
			),
			components: [ buttons ]
		});

		return portal;
	}

	async destroy(options = { shutdown: false, timeout: false, deleted: false } ) {
		this.#closing = true;

		if (options.timeout) {
			await this.#victim.send(strings.portal.close + strings.divider + strings.portal.timeout);

			await this.#channel.setArchived(false);
			await this.#channel.send(strings.portal.close + '\n' + strings.portal.timeout);
		} else if (options.deleted) {
			await this.#victim.send(strings.portal.close + strings.divider + strings.portal.deleted);
			await this.#channel.parent.send(strings.portal.deleted);
		} else {
			await this.#victim.send(strings.portal.close + strings.divider + (options.shutdown ? strings.portal.shutdown : ''));
			await this.#channel.send(strings.portal.close + (this.#direct ? strings.divider : '') + (options.shutdown ? '\n' + strings.portal.shutdown : ''));
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
		this.#closeButtonMsgs[0] = undefined;
		this.#closeButtonMsgs[1] = undefined;
		this.#closeButtonMsgs = undefined;
	}

	async handleButton(btn) {
		let status = 'error';
		if (btn.customId.match(/.*-yes$/)) {
			let closeButton = new MessageActionRow().addComponents(
				new MessageButton()
					.setStyle('DANGER')
					.setLabel(strings.buttons.text.close)
					.setCustomId(strings.buttons.ids.close.format(this.#victim.id)),
			);

			this.#closeButtonMsgs[0] = await this.#victim.send({
				content: strings.portal.request.accepted.receive.format(this.#anon ? strings.portal.anonymous : this.#sender.username),
				components: [closeButton],
			});
			this.#closeButtonMsgs[1] = await this.#channel.send({
				content: strings.portal.request.sent.format(this.#victim.username) + '\n' +
				         strings.portal.request.accepted.send + '\n' +
				         (this.#direct ? strings.portal.quotes.no : strings.portal.quotes.yes),
				components: [closeButton],
			});

			await this.#victim.send(strings.divider + strings.portal.open);
			if (!this.#direct) {
				this.#channel = await this.#channel.threads.create({
					name: strings.portal.thread.name.format(this.#victim.username),
					autoArchiveDuration: 1440,
					reason: strings.portal.thread.reason,
				});
			}

			await this.#channel.send((this.#direct ? strings.divider : '') + strings.portal.open);

			status = 'accept';
			this.#victim.status = 'connected';
		} else if (btn.customId.match(/.*-no$/)) {
			await this.#victim.send(strings.portal.request.denied.receive.format(this.#anon ? strings.portal.anonymous : this.#sender.username));
			await this.#channel.send(
				strings.portal.request.sent.format(this.#victim.username) + '\n' +
				strings.portal.request.denied.send
			);

			status = 'deny';
			this.#victim.status = 'idle';
		} else if (btn.customId.match(/.*-cancel$/)) {
			await this.#victim.send(strings.portal.request.cancelled.receive.format(this.#anon ? strings.portal.anonymous : this.#sender.username));
			await this.#channel.send(
				strings.portal.request.sent.format(this.#victim.username) + '\n' +
				strings.portal.request.cancelled.send
			);

			status = 'cancel';
			this.#victim.status = 'idle';
		} else if (btn.customId.match(/.*-close$/)) {
			status = 'close';

			this.#closeButtonMsgs[0].edit({
				content: strings.portal.request.accepted.receive.format(this.#anon ? strings.portal.anonymous : this.#sender.username),
				components: [],
			});
			this.#closeButtonMsgs[1].edit({
				content: strings.portal.request.sent.format(this.#victim.username) + '\n' +
				         strings.portal.request.accepted.send + '\n' +
				         (this.#direct ? strings.portal.quotes.no : strings.portal.quotes.yes),
				components: [],
			});

			return status;
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
				m = msg.content.replace(/^> (.*)|.*/gm, '$1').trim().replace(/\n\n+/g, '\n');
			}
			if (m == '') { return; }
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
				m = m.replace(/^> (.*)|.*/gm, '$1').trim().replace(/\n\n+/g, '\n');
				n = n.replace(/^> (.*)|.*/gm, '$1').trim().replace(/\n\n+/g, '\n');
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
				m = m.replace(/^> (.*)|.*/gm, '$1').trim().replace(/\n\n+/g, '\n');
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
