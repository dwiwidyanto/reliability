<script lang="ts">
	import { userState } from '$lib/user.svelte';
	import { onMount } from 'svelte';

	let analysesList = $state<any[]>([]);
	let loadingList = $state(true);
	let errorMsg = $state('');

	onMount(async () => {
		// Wait for user status to resolve
		if (!userState.user && !userState.loading) {
			// Redirect or let the page show login request
			loadingList = false;
			return;
		}

		await fetchList();
	});

	async function fetchList() {
		loadingList = true;
		errorMsg = '';
		try {
			const res = await fetch('/api/v1/analyses');
			const json = await res.json();
			if (json.success) {
				analysesList = json.data;
			} else {
				errorMsg = json.error || 'Failed to fetch saved analyses.';
			}
		} catch (err: any) {
			errorMsg = 'Network error fetching data.';
		} finally {
			loadingList = false;
		}
	}

	async function handleDelete(id: string, title: string) {
		if (!confirm(`Are you sure you want to delete "${title}"?`)) return;

		try {
			const res = await fetch(`/api/v1/analyses/${id}`, {
				method: 'DELETE'
			});
			const json = await res.json();
			if (json.success) {
				analysesList = analysesList.filter(item => item.id !== id);
			} else {
				alert(json.error || 'Delete failed.');
			}
		} catch (err) {
			alert('Network error during delete.');
		}
	}

	function formatDate(dateStr: string) {
		const d = new Date(dateStr);
		return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}
</script>

<svelte:head>
	<title>Dashboard - AeroReliability</title>
</svelte:head>

{#if userState.loading || (loadingList && analysesList.length === 0)}
	<div class="flex-1 flex flex-col items-center justify-center space-y-4 py-12">
		<div class="w-8 h-8 rounded-full border-2 border-hud-cyan/20 border-t-hud-cyan animate-spin"></div>
		<span class="font-mono text-xs text-gray-500">POLLING_CLOUD_DATABASE...</span>
	</div>
{:else if !userState.user}
	<div class="flex-1 flex items-center justify-center py-12">
		<div class="max-w-md w-full hud-card p-8 border-hud-rose/20 text-center space-y-6">
			<div class="inline-flex p-3 bg-hud-rose/15 border border-hud-rose/35 text-hud-rose rounded-lg">
				<svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
				</svg>
			</div>
			<div class="space-y-2">
				<h2 class="text-xl font-bold text-white font-mono">ACCESS_DENIED_NODE_LOCKED</h2>
				<p class="text-xs text-gray-400">
					You must authenticate to access the cloud dashboard and load saved analyses.
				</p>
			</div>
			<div class="flex gap-4">
				<a href="/login" class="flex-1 py-2 px-4 rounded bg-hud-cyan hover:bg-hud-cyan-dim text-bg-darker font-bold text-xs tracking-wider uppercase text-center transition-colors">
					Log In
				</a>
				<a href="/register" class="flex-1 py-2 px-4 rounded border border-hud-cyan text-hud-cyan hover:bg-hud-cyan/10 font-bold text-xs tracking-wider uppercase text-center transition-colors">
					Register
				</a>
			</div>
		</div>
	</div>
{:else}
	<div class="space-y-6">
		<!-- Dashboard Header -->
		<div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border-subtle pb-4">
			<div>
				<h1 class="text-2xl font-bold text-white font-mono flex items-center gap-2">
					<span class="w-2 h-2 rounded bg-hud-cyan"></span>
					Saved Analyses Dashboard
				</h1>
				<p class="text-xs text-gray-400 font-mono mt-1">
					LOC_NODE: CLOUD_PERSISTENCE // INDEXED_PROJECTS: {analysesList.length}
				</p>
			</div>

			<!-- Action buttons -->
			<div class="flex items-center gap-3">
				<a href="/fmea" class="py-2 px-4 rounded bg-hud-cyan hover:bg-hud-cyan-dim text-bg-darker font-bold text-xs tracking-wider uppercase transition-colors">
					+ New FMEA
				</a>
				<a href="/fishbone" class="py-2 px-4 rounded border border-hud-amber text-hud-amber hover:bg-hud-amber/10 font-bold text-xs tracking-wider uppercase transition-colors">
					+ New Ishikawa
				</a>
			</div>
		</div>

		{#if errorMsg}
			<div class="p-3 rounded border border-hud-rose bg-hud-rose/10 text-hud-rose text-xs font-mono">
				{errorMsg}
			</div>
		{/if}

		<!-- Project List Table -->
		{#if analysesList.length === 0}
			<div class="hud-card p-12 text-center border-dashed space-y-4">
				<div class="text-gray-500 font-mono text-xs">
					NO ACTIVE WORKBOOKS DETECTED IN CLOUD PERSISTENCE
				</div>
				<p class="text-xs text-gray-400 max-w-sm mx-auto">
					Start a new FMEA severity worksheet or draw a root cause fishbone spine above, then click Save to add it to this list.
				</p>
			</div>
		{:else}
			<div class="overflow-hidden border border-border-subtle rounded-lg bg-bg-panel backdrop-blur-md">
				<div class="overflow-x-auto">
					<table class="w-full text-left font-mono text-xs border-collapse">
						<thead>
							<tr class="border-b border-border-subtle bg-bg-darker text-gray-300">
								<th class="p-4">Project Name</th>
								<th class="p-4">Analysis Type</th>
								<th class="p-4">Last Updated</th>
								<th class="p-4">Date Created</th>
								<th class="p-4 text-right">Actions</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-border-subtle text-gray-400">
							{#each analysesList as item}
								<tr class="hover:bg-white/[0.02] transition-colors">
									<td class="p-4 font-semibold text-white">
										<a 
											href={item.type === 'fmea' ? `/fmea/${item.id}` : `/fishbone/${item.id}`}
											class="hover:text-hud-cyan hover:underline"
										>
											{item.title}
										</a>
									</td>
									<td class="p-4">
										{#if item.type === 'fmea'}
											<span class="px-2 py-0.5 rounded border border-hud-cyan/30 bg-hud-cyan/10 text-hud-cyan text-[10px] uppercase font-bold">FMEA / FMECA</span>
										{:else}
											<span class="px-2 py-0.5 rounded border border-hud-amber/30 bg-hud-amber/10 text-hud-amber text-[10px] uppercase font-bold">Ishikawa 6M+1</span>
										{/if}
									</td>
									<td class="p-4 text-xs">{formatDate(item.updatedAt)}</td>
									<td class="p-4 text-xs">{formatDate(item.createdAt)}</td>
									<td class="p-4 text-right">
										<div class="flex items-center justify-end space-x-3">
											<a 
												href={item.type === 'fmea' ? `/fmea/${item.id}` : `/fishbone/${item.id}`}
												class="text-hud-cyan hover:underline text-[10px] uppercase font-bold"
											>
												Edit
											</a>
											<button 
												onclick={() => handleDelete(item.id, item.title)}
												class="text-hud-rose hover:underline text-[10px] uppercase font-bold"
											>
												Delete
											</button>
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/if}
	</div>
{/if}
