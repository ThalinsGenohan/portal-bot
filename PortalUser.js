module.exports = class PortalUser {
	#user;
	get user() { return this.#user; }

	#dmChannel;
	get dmChannel() { return this.#dmChannel; }
	get id() { return this.#user.id; }
	get username() { return this.#user.username; }

	constructor(user) {
		this.#user = user;
	}

	static async create(user) {
		let creatingDM = user.createDM();

		let portalUser = new PortalUser(user);

		portalUser.#dmChannel = await creatingDM;

		return portalUser;
	}

	async send(...args) {
		return await this.#user.send(...args);
	}
}
