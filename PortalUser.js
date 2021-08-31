module.exports = class PortalUser {
	#user;
	get user() { return this.#user; }
	#channel;
	get channel() { return this.#channel; }

	#dmChannel;
	get dmChannel() { return this.#dmChannel; }
	get bot() { return this.#user.bot; }
	get id() { return this.#user.id; }
	get username() { return this.#user.username; }

	// idle: nothing
	// pending: user has a request pending
	// connected: user has a portal connection
	// looking: user is currently queued for matchmaking
	status = 'idle';

	constructor(user, channel, dmChannel) {
		this.#user = user;
		this.#channel = channel;
		this.#dmChannel = dmChannel;
	}

	static async create(user, channel = undefined) {
		let creatingDM = user.createDM();

		let portalUser = new PortalUser(user, (channel == undefined) ? await creatingDM : channel, await creatingDM);

		return portalUser;
	}

	async send(...args) {
		return await this.#user.send(...args);
	}
}
