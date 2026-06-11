<script lang="ts">
	import './layout.css';
	import { onMount } from 'svelte';
	import { userState } from '$lib/user.svelte';
	import { page } from '$app/state';

	let { children } = $props();
	let utcTime = $state('');

	onMount(() => {
		userState.fetchUser();

		// Update UTC clock (standard in aviation)
		const updateTime = () => {
			const now = new Date();
			utcTime = now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
		};
		updateTime();
		const interval = setInterval(updateTime, 1000);
		return () => clearInterval(interval);
	});

	async function handleLogout() {
		await userState.logout();
		window.location.href = '/';
	}
</script>

<svelte:head>
	<title>AeroReliability | Aviation Safety & FMEA Suite</title>
</svelte:head>

<div class="min-h-screen flex flex-col bg-bg-darker cockpit-grid relative overflow-x-hidden">
	<!-- Top Glass Navigation Bar -->
	<header class="sticky top-0 z-50 border-b border-border-subtle bg-bg-dark/80 backdrop-blur-md">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
			<!-- Logo -->
			<a href="/" class="flex items-center space-x-3 group">
				<div class="w-8 h-8 rounded border border-hud-cyan flex items-center justify-center bg-hud-cyan/10 transition-colors group-hover:bg-hud-cyan/20">
					<svg class="w-5 h-5 text-hud-cyan animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
					</svg>
				</div>
				<span class="text-xl font-bold tracking-wider text-white group-hover:text-hud-cyan transition-colors">
					AERO<span class="text-hud-cyan">RELIABILITY</span>
				</span>
			</a>

			<!-- Nav links -->
			<nav class="hidden md:flex items-center space-x-6">
				<a href="/" class="text-sm font-medium transition-colors hover:text-hud-cyan {page.url.pathname === '/' ? 'text-hud-cyan font-semibold' : 'text-gray-400'}">
					Home & Tutorials
				</a>
				{#if userState.user}
					<a href="/dashboard" class="text-sm font-medium transition-colors hover:text-hud-cyan {page.url.pathname.startsWith('/dashboard') ? 'text-hud-cyan font-semibold' : 'text-gray-400'}">
						Dashboard
					</a>
				{/if}
				<a href="/fmea" class="text-sm font-medium transition-colors hover:text-hud-cyan {page.url.pathname.startsWith('/fmea') ? 'text-hud-cyan font-semibold' : 'text-gray-400'}">
					FMEA Builder
				</a>
				<a href="/fishbone" class="text-sm font-medium transition-colors hover:text-hud-cyan {page.url.pathname.startsWith('/fishbone') ? 'text-hud-cyan font-semibold' : 'text-gray-400'}">
					Ishikawa Diagram
				</a>
			</nav>

			<!-- Auth Actions -->
			<div class="flex items-center space-x-4">
				{#if userState.loading}
					<div class="w-4 h-4 rounded-full border border-hud-cyan/30 border-t-hud-cyan animate-spin"></div>
				{:else if userState.user}
					<div class="hidden sm:flex flex-col items-end text-xs mr-2">
						<span class="text-gray-400 font-mono">USER_AUTH_OK</span>
						<span class="text-hud-cyan font-medium">{userState.user.email}</span>
					</div>
					<button 
						onclick={handleLogout} 
						class="px-4 py-1.5 rounded border border-hud-rose/40 bg-hud-rose/10 hover:bg-hud-rose/20 text-hud-rose text-xs font-semibold tracking-wider uppercase transition-colors"
					>
						Logout
					</button>
				{:else}
					<a 
						href="/login" 
						class="px-4 py-1.5 text-gray-400 hover:text-white text-xs font-semibold tracking-wider uppercase transition-colors"
					>
						Sign In
					</a>
					<a 
						href="/register" 
						class="px-4 py-1.5 rounded border border-hud-cyan/40 bg-hud-cyan/10 hover:bg-hud-cyan/20 text-hud-cyan text-xs font-semibold tracking-wider uppercase transition-colors"
					>
						Register
					</a>
				{/if}
			</div>
		</div>
	</header>

	<!-- Main App Area -->
	<main class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col">
		{@render children()}
	</main>

	<!-- Bottom EICAS Bar / Footer -->
	<footer class="border-t border-border-subtle bg-bg-dark font-mono text-[10px] text-gray-500 py-3 select-none">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-2">
			<!-- Systems indicators -->
			<div class="flex items-center space-x-6 flex-wrap justify-center gap-y-1">
				<div class="flex items-center space-x-2">
					<span class="w-2 h-2 rounded-full bg-hud-emerald animate-pulse"></span>
					<span class="text-hud-emerald font-semibold">SYS OK</span>
				</div>
				<div class="flex items-center space-x-1">
					<span>DB:</span>
					<span class="text-hud-cyan font-semibold">SQLITE_WAL_ACTIVE</span>
				</div>
				<div class="flex items-center space-x-1">
					<span>VER:</span>
					<span class="text-white font-medium">1.0.0-MVP</span>
				</div>
			</div>

			<!-- Center EICAS display message -->
			<div class="text-center text-hud-cyan tracking-widest hidden lg:block">
				--- FLIGHT SAFETY PRIMARY DOMAIN ---
			</div>

			<!-- Time stamp -->
			<div class="flex items-center space-x-4">
				<span class="text-white font-medium">{utcTime}</span>
				<span class="text-gray-500">© 2026 AeroReliability Suite</span>
			</div>
		</div>
	</footer>
</div>
