<script lang="ts">
	import { userState } from '$lib/user.svelte';
	import { onMount } from 'svelte';

	let email = $state('');
	let password = $state('');
	let confirmPassword = $state('');
	let errorMsg = $state('');
	let loading = $state(false);

	onMount(() => {
		if (userState.user) {
			window.location.href = '/dashboard';
		}
	});

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		errorMsg = '';

		if (!email.includes('@')) {
			errorMsg = 'Please enter a valid email address.';
			return;
		}
		if (password.length < 6) {
			errorMsg = 'Password must be at least 6 characters.';
			return;
		}
		if (password !== confirmPassword) {
			errorMsg = 'Passwords do not match.';
			return;
		}

		loading = true;
		try {
			const res = await fetch('/api/v1/auth/register', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, password })
			});
			const json = await res.json();
			if (json.success) {
				await userState.fetchUser();
				window.location.href = '/dashboard';
			} else {
				errorMsg = json.error || 'Registration failed.';
			}
		} catch (err: any) {
			errorMsg = 'Network error. Please try again.';
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Register - AeroReliability</title>
</svelte:head>

<div class="flex-1 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
	<div class="max-w-md w-full space-y-8 hud-card p-8 border-hud-cyan/20">
		<div class="text-center">
			<div class="inline-flex w-12 h-12 rounded border border-hud-cyan flex items-center justify-center bg-hud-cyan/10 mb-4">
				<svg class="w-6 h-6 text-hud-cyan animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
				</svg>
			</div>
			<h2 class="text-3xl font-extrabold tracking-wider text-white uppercase font-mono">
				[REGISTER]
			</h2>
			<p class="mt-2 text-sm text-gray-400">
				Initialize a new engineer credentials node.
			</p>
		</div>

		{#if errorMsg}
			<div class="p-3.5 rounded border border-hud-rose bg-hud-rose/10 text-hud-rose text-xs font-mono flex items-start space-x-2 hud-border-glow-rose">
				<svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
				</svg>
				<span class="flex-1">{errorMsg}</span>
			</div>
		{/if}

		<form class="mt-8 space-y-6" onsubmit={handleSubmit}>
			<div class="space-y-4">
				<div>
					<label for="email" class="block text-xs font-mono text-gray-400 mb-1">EMAIL_ADDRESS</label>
					<input 
						id="email" 
						type="email" 
						required 
						bind:value={email}
						placeholder="engineer@aerospace.com"
						class="w-full px-3 py-2 border border-border-subtle rounded bg-bg-darker text-white text-sm focus:outline-none focus:border-hud-cyan font-mono"
					/>
				</div>
				<div>
					<label for="password" class="block text-xs font-mono text-gray-400 mb-1">CREATE_PASSKEY</label>
					<input 
						id="password" 
						type="password" 
						required 
						bind:value={password}
						placeholder="Minimum 6 characters"
						class="w-full px-3 py-2 border border-border-subtle rounded bg-bg-darker text-white text-sm focus:outline-none focus:border-hud-cyan font-mono"
					/>
				</div>
				<div>
					<label for="confirm-password" class="block text-xs font-mono text-gray-400 mb-1">CONFIRM_PASSKEY</label>
					<input 
						id="confirm-password" 
						type="password" 
						required 
						bind:value={confirmPassword}
						placeholder="Repeat passkey"
						class="w-full px-3 py-2 border border-border-subtle rounded bg-bg-darker text-white text-sm focus:outline-none focus:border-hud-cyan font-mono"
					/>
				</div>
			</div>

			<div>
				<button 
					type="submit" 
					disabled={loading}
					class="w-full py-2 px-4 rounded bg-hud-cyan hover:bg-hud-cyan-dim text-bg-darker font-bold tracking-widest uppercase text-sm flex items-center justify-center space-x-2 transition-colors disabled:opacity-50"
				>
					{#if loading}
						<div class="w-4 h-4 rounded-full border border-bg-darker/30 border-t-bg-darker animate-spin"></div>
						<span>Registering...</span>
					{:else}
						<span>Create Account</span>
					{/if}
				</button>
			</div>

			<div class="text-center text-xs font-mono">
				<span class="text-gray-500">Already initialized?</span>
				<a href="/login" class="text-hud-cyan hover:underline ml-1">Sign In</a>
			</div>
		</form>
	</div>
</div>
