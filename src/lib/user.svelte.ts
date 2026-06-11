class UserState {
	user = $state<{ id: string; email: string } | null>(null);
	loading = $state(true);

	async fetchUser() {
		this.loading = true;
		try {
			const res = await fetch('/api/v1/auth/me');
			const json = await res.json();
			if (json.success && json.data.user) {
				this.user = json.data.user;
			} else {
				this.user = null;
			}
		} catch (e) {
			this.user = null;
		} finally {
			this.loading = false;
		}
	}

	async logout() {
		try {
			await fetch('/api/v1/auth/logout', { method: 'POST' });
			this.user = null;
		} catch (e) {
			console.error('Logout error:', e);
		}
	}
}

export const userState = new UserState();
