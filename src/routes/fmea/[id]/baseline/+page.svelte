<script lang="ts">
	import { page } from '$app/state';
	import { userState } from '$lib/user.svelte';
	import { onMount } from 'svelte';

	const id = $derived(page.params.id);

	let loading = $state(true);
	let errorMsg = $state('');
	
	let currentAnalysis = $state<any>(null);
	let baselinesList = $state<any[]>([]);
	let selectedBaselineId = $state('');
	let selectedBaselineData = $state<any>(null);
	let fetchingBaseline = $state(false);

	// Fetch base data
	async function loadBaseData() {
		loading = true;
		errorMsg = '';
		try {
			// Fetch current analysis
			const resAnalysis = await fetch(`/api/v1/analyses/${id}`);
			const jsonAnalysis = await resAnalysis.json();
			if (jsonAnalysis.success) {
				currentAnalysis = jsonAnalysis.data;
			} else {
				errorMsg = jsonAnalysis.error || 'Failed to load current analysis.';
				return;
			}

			// Fetch baselines list
			const resBaselines = await fetch(`/api/v1/analyses/${id}/baselines`);
			const jsonBaselines = await resBaselines.json();
			if (jsonBaselines.success) {
				baselinesList = jsonBaselines.data;
				if (baselinesList.length > 0) {
					selectedBaselineId = baselinesList[0].id;
					await fetchBaselineDetails(selectedBaselineId);
				}
			} else {
				errorMsg = jsonBaselines.error || 'Failed to load baselines list.';
			}
		} catch (e) {
			errorMsg = 'Network error fetching baseline information.';
		} finally {
			loading = false;
		}
	}

	async function fetchBaselineDetails(baselineId: string) {
		fetchingBaseline = true;
		try {
			const res = await fetch(`/api/v1/analyses/${id}/baselines/${baselineId}`);
			const json = await res.json();
			if (json.success) {
				selectedBaselineData = json.data;
			} else {
				alert(json.error || 'Failed to load baseline snapshot.');
			}
		} catch (e) {
			alert('Network error loading baseline snapshot.');
		} finally {
			fetchingBaseline = false;
		}
	}

	onMount(async () => {
		if (id) {
			await loadBaseData();
		}
	});

	// Handle baseline select change
	async function handleBaselineChange(e: Event) {
		const target = e.target as HTMLSelectElement;
		if (target.value) {
			await fetchBaselineDetails(target.value);
		}
	}

	// Types for Row Comparison
	interface CompareRow {
		rowId: string;
		status: 'added' | 'deleted' | 'modified' | 'unchanged';
		current: any | null;
		baseline: any | null;
		diffFields: string[];
	}

	// Dynamic comparison computation
	let comparedRows = $derived.by<CompareRow[]>(() => {
		if (!currentAnalysis || !selectedBaselineData) return [];

		let currentRows: any[] = [];
		let baselineRows: any[] = [];

		try {
			currentRows = JSON.parse(currentAnalysis.data);
		} catch (e) {
			console.error('Failed to parse current analysis rows');
		}

		try {
			baselineRows = JSON.parse(selectedBaselineData.data);
		} catch (e) {
			console.error('Failed to parse baseline snapshot rows');
		}

		if (!Array.isArray(currentRows)) currentRows = [];
		if (!Array.isArray(baselineRows)) baselineRows = [];

		const currentMap = new Map(currentRows.map((r, i) => [r.id || String(i), r]));
		const baselineMap = new Map(baselineRows.map((r, i) => [r.id || String(i), r]));

		const allRowIds = new Set<string>();
		currentRows.forEach((r, i) => allRowIds.add(r.id || String(i)));
		baselineRows.forEach((r, i) => allRowIds.add(r.id || String(i)));

		const result: CompareRow[] = [];

		allRowIds.forEach(rowId => {
			const curr = currentMap.get(rowId);
			const base = baselineMap.get(rowId);

			if (curr && !base) {
				result.push({
					rowId,
					status: 'added',
					current: curr,
					baseline: null,
					diffFields: []
				});
			} else if (!curr && base) {
				result.push({
					rowId,
					status: 'deleted',
					current: null,
					baseline: base,
					diffFields: []
				});
			} else if (curr && base) {
				const diffFields: string[] = [];
				const fieldsToCompare = ['item', 'failureMode', 'effects', 'causes', 'severity', 'occurrence', 'detectability', 'actions'];
				
				fieldsToCompare.forEach(field => {
					if (String(curr[field] || '').trim() !== String(base[field] || '').trim()) {
						diffFields.push(field);
					}
				});

				result.push({
					rowId,
					status: diffFields.length > 0 ? 'modified' : 'unchanged',
					current: curr,
					baseline: base,
					diffFields
				});
			}
		});

		// Sort result to keep current order as much as possible, placing deleted rows at the end or in original indices
		return result;
	});

</script>

<svelte:head>
	<title>Revision Baseline Comparison - AeroReliability</title>
</svelte:head>

{#if loading}
	<div class="flex-1 flex flex-col items-center justify-center space-y-4 py-12">
		<div class="w-8 h-8 rounded-full border-2 border-hud-cyan/20 border-t-hud-cyan animate-spin"></div>
		<span class="font-mono text-xs text-gray-500">RESOLVING_BASELINE_HISTORIES...</span>
	</div>
{:else if errorMsg}
	<div class="p-6 max-w-lg mx-auto hud-card border-hud-rose/20 text-center space-y-4">
		<div class="text-hud-rose font-mono text-sm uppercase">ERR_LOAD_FAILED</div>
		<p class="text-xs text-gray-400">{errorMsg}</p>
		<a href="/dashboard" class="inline-block py-1.5 px-4 rounded bg-bg-dark border border-border-subtle text-xs text-white hover:border-hud-cyan transition-colors">
			Return to Dashboard
		</a>
	</div>
{:else}
	<div class="space-y-6 pb-12">
		<!-- Navigation and title -->
		<div class="border-b border-border-subtle pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
			<div class="space-y-1">
				<div class="flex items-center gap-3">
					<a href="/dashboard" class="text-xs font-mono text-hud-cyan hover:underline">Dashboard</a>
					<span class="text-gray-600">/</span>
					<a href="/fmea/{id}" class="text-xs font-mono text-hud-cyan hover:underline">{currentAnalysis.title}</a>
					<span class="text-gray-600">/</span>
					<span class="text-xs font-mono text-gray-400">Baseline Revision History</span>
				</div>
				<h1 class="text-xl font-bold text-white font-mono flex items-center gap-2 mt-1">
					<span class="w-2 h-2 rounded bg-hud-rose animate-pulse"></span>
					FMEA Baseline Revision Compare
				</h1>
			</div>

			<div class="flex items-center gap-3">
				<a href="/fmea/{id}" class="py-1.5 px-4 rounded bg-hud-cyan hover:bg-hud-cyan-dim text-bg-darker font-bold text-xs tracking-wider uppercase transition-colors">
					Edit Worksheet
				</a>
			</div>
		</div>

		<!-- Baseline selector card -->
		<div class="hud-card p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
			<div class="space-y-1">
				<label for="baseline-select" class="block text-[10px] font-mono text-gray-500 uppercase">Compare current version with approved baseline</label>
				{#if baselinesList.length === 0}
					<span class="text-xs text-hud-rose font-mono font-bold block">NO APPROVED BASELINES REGISTERED FOR THIS WORKBOOK</span>
				{:else}
					<select 
						id="baseline-select"
						bind:value={selectedBaselineId} 
						onchange={handleBaselineChange}
						class="bg-bg-darker border border-border-subtle focus:border-hud-rose py-1.5 px-3 rounded text-xs text-white focus:outline-none font-mono min-w-[280px]"
					>
						{#each baselinesList as baseline}
							<option value={baseline.id}>
								Version {baseline.version} - signed by {baseline.signatureName} ({new Date(baseline.createdAt).toLocaleDateString()})
							</option>
						{/each}
					</select>
				{/if}
			</div>

			{#if selectedBaselineData}
				<div class="text-xs font-mono text-gray-400 text-left sm:text-right">
					<div>Baseline Status: <span class="text-hud-emerald font-bold uppercase">Approved</span></div>
					<div>Signed On: <span class="text-white">{new Date(selectedBaselineData.createdAt).toLocaleDateString()}</span></div>
					<div>Signatory: <span class="text-hud-cyan">{selectedBaselineData.signatureName}</span></div>
				</div>
			{/if}
		</div>

		{#if baselinesList.length > 0 && selectedBaselineData}
			<!-- Legend of diff types -->
			<div class="flex flex-wrap gap-4 text-[10px] font-mono select-none bg-bg-dark/40 p-3 rounded border border-border-subtle/40">
				<span class="text-gray-500 font-bold">LEGEND:</span>
				<div class="flex items-center gap-1.5">
					<span class="w-3 h-3 rounded bg-hud-emerald/15 border border-hud-emerald/40"></span>
					<span class="text-hud-emerald font-semibold">Added Row</span>
				</div>
				<div class="flex items-center gap-1.5">
					<span class="w-3 h-3 rounded bg-hud-rose/15 border border-hud-rose/40"></span>
					<span class="text-hud-rose font-semibold">Deleted Row</span>
				</div>
				<div class="flex items-center gap-1.5">
					<span class="w-3 h-3 rounded bg-hud-amber/10 border border-hud-amber/30"></span>
					<span class="text-hud-amber font-semibold">Modified Fields</span>
				</div>
				<div class="flex items-center gap-1.5">
					<span class="w-3 h-3 rounded bg-white/[0.02] border border-border-subtle/50"></span>
					<span class="text-gray-400">Unchanged Row</span>
				</div>
			</div>

			<!-- Comparison Table -->
			{#if fetchingBaseline}
				<div class="text-center py-12 space-y-2">
					<div class="w-6 h-6 rounded-full border-2 border-hud-rose/25 border-t-hud-rose animate-spin mx-auto"></div>
					<span class="font-mono text-[10px] text-gray-500">CALCULATING_DIFFS...</span>
				</div>
			{:else}
				<div class="hud-card overflow-hidden">
					<div class="overflow-x-auto">
						<table class="w-full text-left font-mono text-[11px] border-collapse min-w-[1000px]">
							<thead>
								<tr class="border-b border-border-subtle bg-bg-darker text-gray-400 select-none">
									<th class="p-3 w-16 text-center">Status</th>
									<th class="p-3 w-40">Component / Function</th>
									<th class="p-3 w-44">Failure Mode</th>
									<th class="p-3 w-44">Failure Effects</th>
									<th class="p-3 w-44">Potential Causes</th>
									<th class="p-3 w-12 text-center text-hud-rose">S</th>
									<th class="p-3 w-12 text-center text-hud-amber">O</th>
									<th class="p-3 w-12 text-center text-hud-cyan">D</th>
									<th class="p-3 w-14 text-center">RPN</th>
									<th class="p-3">Mitigation / Actions</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-border-subtle text-gray-300">
								{#each comparedRows as comp}
									<tr class="transition-colors 
										{comp.status === 'added' ? 'bg-hud-emerald/5 hover:bg-hud-emerald/10' : ''}
										{comp.status === 'deleted' ? 'bg-hud-rose/5 hover:bg-hud-rose/10 opacity-70 line-through' : ''}
										{comp.status === 'modified' ? 'bg-hud-amber/5 hover:bg-hud-amber/8' : ''}
										{comp.status === 'unchanged' ? 'hover:bg-white/[0.01]' : ''}
									">
										<!-- Status Badge -->
										<td class="p-3 text-center">
											{#if comp.status === 'added'}
												<span class="px-1.5 py-0.5 rounded border border-hud-emerald/30 bg-hud-emerald/10 text-hud-emerald text-[9px] font-bold">NEW</span>
											{:else if comp.status === 'deleted'}
												<span class="px-1.5 py-0.5 rounded border border-hud-rose/30 bg-hud-rose/10 text-hud-rose text-[9px] font-bold">DELETED</span>
											{:else if comp.status === 'modified'}
												<span class="px-1.5 py-0.5 rounded border border-hud-amber/30 bg-hud-amber/10 text-hud-amber text-[9px] font-bold">MOD</span>
											{:else}
												<span class="text-gray-600 font-semibold">-</span>
											{/if}
										</td>

										<!-- Component / Function -->
										<td class="p-3 leading-normal">
											{#if comp.status === 'added'}
												<span class="text-hud-emerald font-semibold">{comp.current.item}</span>
											{:else if comp.status === 'deleted'}
												<span class="text-hud-rose">{comp.baseline.item}</span>
											{:else if comp.diffFields.includes('item')}
												<div class="line-through text-hud-rose text-[10px]">{comp.baseline.item}</div>
												<div class="text-hud-cyan mt-1">{comp.current.item}</div>
											{:else}
												<span>{comp.current.item}</span>
											{/if}
										</td>

										<!-- Failure Mode -->
										<td class="p-3 leading-normal">
											{#if comp.status === 'added'}
												<span class="text-hud-emerald">{comp.current.failureMode}</span>
											{:else if comp.status === 'deleted'}
												<span class="text-hud-rose">{comp.baseline.failureMode}</span>
											{:else if comp.diffFields.includes('failureMode')}
												<div class="line-through text-hud-rose text-[10px]">{comp.baseline.failureMode}</div>
												<div class="text-hud-cyan mt-1">{comp.current.failureMode}</div>
											{:else}
												<span>{comp.current.failureMode}</span>
											{/if}
										</td>

										<!-- Failure Effects -->
										<td class="p-3 leading-normal">
											{#if comp.status === 'added'}
												<span class="text-hud-emerald">{comp.current.effects}</span>
											{:else if comp.status === 'deleted'}
												<span class="text-hud-rose">{comp.baseline.effects}</span>
											{:else if comp.diffFields.includes('effects')}
												<div class="line-through text-hud-rose text-[10px]">{comp.baseline.effects}</div>
												<div class="text-hud-cyan mt-1">{comp.current.effects}</div>
											{:else}
												<span>{comp.current.effects}</span>
											{/if}
										</td>

										<!-- Potential Causes -->
										<td class="p-3 leading-normal">
											{#if comp.status === 'added'}
												<span class="text-hud-emerald">{comp.current.causes}</span>
											{:else if comp.status === 'deleted'}
												<span class="text-hud-rose">{comp.baseline.causes}</span>
											{:else if comp.diffFields.includes('causes')}
												<div class="line-through text-hud-rose text-[10px]">{comp.baseline.causes}</div>
												<div class="text-hud-cyan mt-1">{comp.current.causes}</div>
											{:else}
												<span>{comp.current.causes}</span>
											{/if}
										</td>

										<!-- Severity (S) -->
										<td class="p-3 text-center">
											{#if comp.status === 'added'}
												<span class="text-hud-rose font-bold">{comp.current.severity}</span>
											{:else if comp.status === 'deleted'}
												<span class="text-hud-rose font-semibold">{comp.baseline.severity}</span>
											{:else if comp.diffFields.includes('severity')}
												<span class="line-through text-hud-rose font-semibold mr-1">{comp.baseline.severity}</span>
												<span class="text-hud-cyan font-bold">{comp.current.severity}</span>
											{:else}
												<span class="text-hud-rose font-bold">{comp.current.severity}</span>
											{/if}
										</td>

										<!-- Occurrence (O) -->
										<td class="p-3 text-center">
											{#if comp.status === 'added'}
												<span class="text-hud-amber font-bold">{comp.current.occurrence}</span>
											{:else if comp.status === 'deleted'}
												<span class="text-hud-rose font-semibold">{comp.baseline.occurrence}</span>
											{:else if comp.diffFields.includes('occurrence')}
												<span class="line-through text-hud-rose font-semibold mr-1">{comp.baseline.occurrence}</span>
												<span class="text-hud-cyan font-bold">{comp.current.occurrence}</span>
											{:else}
												<span class="text-hud-amber font-bold">{comp.current.occurrence}</span>
											{/if}
										</td>

										<!-- Detectability (D) -->
										<td class="p-3 text-center">
											{#if comp.status === 'added'}
												<span class="text-hud-cyan font-bold">{comp.current.detectability}</span>
											{:else if comp.status === 'deleted'}
												<span class="text-hud-rose font-semibold">{comp.baseline.detectability}</span>
											{:else if comp.diffFields.includes('detectability')}
												<span class="line-through text-hud-rose font-semibold mr-1">{comp.baseline.detectability}</span>
												<span class="text-hud-cyan font-bold">{comp.current.detectability}</span>
											{:else}
												<span class="text-hud-cyan font-bold">{comp.current.detectability}</span>
											{/if}
										</td>

										<!-- RPN -->
										<td class="p-3 text-center font-bold">
											{#if comp.status === 'added'}
												<span class="{comp.current.rpn >= 250 ? 'text-hud-rose' : 'text-gray-400'}">{comp.current.rpn}</span>
											{:else if comp.status === 'deleted'}
												<span class="text-hud-rose">{comp.baseline.rpn}</span>
											{:else if comp.diffFields.includes('severity') || comp.diffFields.includes('occurrence') || comp.diffFields.includes('detectability')}
												<span class="line-through text-hud-rose text-[10px] block mr-1">{comp.baseline.rpn}</span>
												<span class="text-hud-cyan font-bold block">{comp.current.rpn}</span>
											{:else}
												<span class="{comp.current.rpn >= 250 ? 'text-hud-rose text-shadow-glow font-extrabold' : 'text-gray-400'}">{comp.current.rpn}</span>
											{/if}
										</td>

										<!-- Aeronautic Mitigation Actions -->
										<td class="p-3 leading-normal">
											{#if comp.status === 'added'}
												<span class="text-hud-emerald">{comp.current.actions}</span>
											{:else if comp.status === 'deleted'}
												<span class="text-hud-rose">{comp.baseline.actions}</span>
											{:else if comp.diffFields.includes('actions')}
												<div class="line-through text-hud-rose text-[10px]">{comp.baseline.actions}</div>
												<div class="text-hud-cyan mt-1 font-medium">{comp.current.actions}</div>
											{:else}
												<span>{comp.current.actions}</span>
											{/if}
										</td>
									</tr>
								{/each}
								{#if comparedRows.length === 0}
									<tr>
										<td colspan="10" class="p-8 text-center text-gray-500 italic">No FMEA rows detected to compare.</td>
									</tr>
								{/if}
							</tbody>
						</table>
					</div>
				</div>
			{/if}
		{/if}
	</div>
{/if}
