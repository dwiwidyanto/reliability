<script lang="ts">
	import { userState } from '$lib/user.svelte';
	import { onMount } from 'svelte';

	// Props
	let { analysisId = null as string | null } = $props();

	// Types
	interface FmeaRow {
		id: string;
		item: string;
		failureMode: string;
		effects: string;
		causes: string;
		severity: number;
		occurrence: number;
		detectability: number;
		rpn: number;
		actions: string;
	}

	// State
	let title = $state('Aviation FMEA - Unnamed Project');
	let rows = $state<FmeaRow[]>([
		{
			id: '1',
			item: 'Hydraulic Actuator Hoses',
			failureMode: 'Pinhole rupture under peak load',
			effects: 'Loss of pressure to primary elevator controls',
			causes: 'Thermal expansion & high friction fatigue',
			severity: 9,
			occurrence: 2,
			detectability: 3,
			rpn: 54,
			actions: 'Dual hydraulic redundancy with automatic pressure monitoring EICAS alerts.'
		}
	]);

	let isSaving = $state(false);
	let saveStatus = $state(''); // 'success' | 'error' | ''
	let saveMessage = $state('');

	// Compliance State
	let status = $state<'draft' | 'approved'>('draft');
	let signatureName = $state('');
	let lastReviewedAt = $state<string | null>(null);
	let nextReviewDueAt = $state<string | null>(null);

	let signModalOpen = $state(false);
	let printSignName = $state('');
	let isSigning = $state(false);
	let isReviewing = $state(false);

	async function handleSign() {
		if (!printSignName.trim()) return;
		isSigning = true;
		try {
			const res = await fetch(`/api/v1/analyses/${analysisId}/sign`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ signatureName: printSignName.trim() })
			});
			const json = await res.json();
			if (json.success) {
				status = 'approved';
				signatureName = printSignName.trim();
				lastReviewedAt = new Date().toISOString();
				nextReviewDueAt = json.data.nextReviewDueAt;
				signModalOpen = false;
				saveStatus = 'success';
				saveMessage = 'Safety analysis signed and approved.';
			} else {
				alert(json.error || 'Failed to sign.');
			}
		} catch (e) {
			alert('Network error signing analysis.');
		} finally {
			isSigning = false;
		}
	}

	async function handleReview() {
		isReviewing = true;
		try {
			const res = await fetch(`/api/v1/analyses/${analysisId}/review`, { method: 'POST' });
			const json = await res.json();
			if (json.success) {
				lastReviewedAt = new Date().toISOString();
				nextReviewDueAt = json.data.nextReviewDueAt;
				saveStatus = 'success';
				saveMessage = 'Annual compliance review completed.';
			} else {
				alert(json.error || 'Failed to record review.');
			}
		} catch (e) {
			alert('Network error recording review.');
		} finally {
			isReviewing = false;
		}
	}

	// Scale Helper Modal State
	let modalOpen = $state(false);
	let modalType = $state<'S' | 'O' | 'D'>('S');
	let activeRowIndex = $state<number | null>(null);

	// Scales Data
	const scales = {
		S: [
			{ val: 10, label: 'Catastrophic', desc: 'Aircraft loss, structural breakup, fatal injury. Safety margin zero.' },
			{ val: 9, label: 'Hazardous', desc: 'Large reduction in safety margins. Serious passenger injury or crew workload overload.' },
			{ val: 8, label: 'Major', desc: 'Significant reduction in safety margin. Minor injury or significant crew workload increase.' },
			{ val: 7, label: 'Major-Moderate', desc: 'Moderate safety degradation. Flight path unaffected but secondary backup lost.' },
			{ val: 6, label: 'Minor-Severe', desc: 'Minor system degradation. Passenger inconvenience, flight crew distraction.' },
			{ val: 5, label: 'Minor', desc: 'Slight safety margin reduction. Distraction resolved via routine checklist.' },
			{ val: 4, label: 'Minor-Negligible', desc: 'Negligible safety impact. Standard secondary backup active.' },
			{ val: 3, label: 'Negligible-Minor', desc: 'Nuisance cabin degradation (e.g. galley power failure).' },
			{ val: 2, label: 'Negligible', desc: 'Operational irritation. No safety or performance degradation.' },
			{ val: 1, label: 'None', desc: 'No operational or safety effect.' }
		],
		O: [
			{ val: 10, label: 'Frequent', desc: 'Probability > 1e-2 per flight hour (fh). Expected to occur multiple times.' },
			{ val: 9, label: 'Reasonably Probable', desc: '1e-2 to 2e-3 / fh. Will occur several times in aircraft life.' },
			{ val: 8, label: 'Probable', desc: '2e-3 to 1e-3 / fh. Likely to occur in typical aircraft lifecycle.' },
			{ val: 7, label: 'Remote-Probable', desc: '1e-3 to 2e-4 / fh. Unlikely but known to occur on type.' },
			{ val: 6, label: 'Remote', desc: '2e-4 to 1e-4 / fh. expected to occur during lifecycle.' },
			{ val: 5, label: 'Remote-Improbable', desc: '1e-4 to 2e-5 / fh. Unlikely to occur in lifecycle.' },
			{ val: 4, label: 'Extremely Remote', desc: '2e-5 to 1e-5 / fh. Highly unlikely to occur.' },
			{ val: 3, label: 'Extremely Remote-Improbable', desc: '1e-5 to 2e-6 / fh. Extremely unlikely to occur.' },
			{ val: 2, label: 'Extremely Improbable', desc: '2e-6 to 1e-6 / fh. Negligible chance of occurrence.' },
			{ val: 1, label: 'Extremely Improbable', desc: 'Probability < 1e-6 / fh. Almost impossible to occur.' }
		],
		D: [
			{ val: 10, label: 'Almost Impossible', desc: 'Hidden failure mode. Not detectable by flight crew or A-check. Requires D-check.' },
			{ val: 9, label: 'Very Remote', desc: 'Only detectable during heavy C-check maintenance teardown.' },
			{ val: 8, label: 'Remote', desc: 'Detectable during pre-flight or daily inspection only with tool access.' },
			{ val: 7, label: 'Low-Remote', desc: 'Detectable by visual inspection with difficulty (e.g. minor leakage lines).' },
			{ val: 6, label: 'Low', desc: 'Detectable by routine flight crew pre-flight walkaround.' },
			{ val: 5, label: 'Moderate-Low', desc: 'Detectable by scheduled pilot pre-flight systems test check.' },
			{ val: 4, label: 'Moderate', desc: 'Crew detects via physical response (cockpit vibration, stiffness).' },
			{ val: 3, label: 'High-Moderate', desc: 'Crew detects via dedicated analogue indicator gauge.' },
			{ val: 2, label: 'High', desc: 'Continuous EICAS/ECAM status message panel warning display.' },
			{ val: 1, label: 'Almost Certain', desc: 'Immediate, unambiguous warning horn or red Master Warning light.' }
		]
	};

	// On mount, load analysis if ID is provided
	onMount(async () => {
		if (analysisId) {
			try {
				const res = await fetch(`/api/v1/analyses/${analysisId}`);
				const json = await res.json();
				if (json.success && json.data) {
					title = json.data.title;
					rows = JSON.parse(json.data.data);
					status = json.data.status || 'draft';
					signatureName = json.data.signatureName || '';
					lastReviewedAt = json.data.lastReviewedAt;
					nextReviewDueAt = json.data.nextReviewDueAt;
				} else {
					saveStatus = 'error';
					saveMessage = 'Failed to load project: ' + (json.error || 'not found');
				}
			} catch (e) {
				saveStatus = 'error';
				saveMessage = 'Network error loading project.';
			}
		}
	});

	// RPN and Risk Matrix Calculations
	function recalculateRPN(row: FmeaRow) {
		row.rpn = row.severity * row.occurrence * row.detectability;
	}

	// 10x10 Heatmap Matrix Representation
	// Row index: Occurrence (10 is top, 1 is bottom) -> array index 0 maps to O=10, index 9 maps to O=1
	// Col index: Severity (1 is left, 10 is right) -> array index 0 maps to S=1, index 9 maps to S=10
	let criticalityMatrix = $derived.by(() => {
		const matrix = Array(10).fill(0).map(() => Array(10).fill(0));
		rows.forEach(row => {
			const sIdx = Math.max(1, Math.min(10, row.severity)) - 1;
			const oIdx = 10 - Math.max(1, Math.min(10, row.occurrence));
			matrix[oIdx][sIdx]++;
		});
		return matrix;
	});

	function getCellColor(occVal: number, sevVal: number) {
		const criticalityIndex = occVal * sevVal;
		if (criticalityIndex >= 41) return 'bg-hud-rose/25 border-hud-rose/65 text-hud-rose'; // High
		if (criticalityIndex >= 16) return 'bg-hud-amber/20 border-hud-amber/55 text-hud-amber'; // Medium
		return 'bg-hud-emerald/15 border-hud-emerald/45 text-hud-emerald'; // Low
	}

	// Spreadsheet CRUD
	function addRow() {
		// Create a random UUID in a client-safe way without node crypto dependency if needed, 
		// but since we compiled with typescript we can just generate a random string
		const id = Math.random().toString(36).substring(2, 9);
		rows.push({
			id,
			item: '',
			failureMode: '',
			effects: '',
			causes: '',
			severity: 5,
			occurrence: 5,
			detectability: 5,
			rpn: 125,
			actions: ''
		});
	}

	function deleteRow(index: number) {
		if (rows.length === 1) {
			alert('Workbook must contain at least one failure mode row.');
			return;
		}
		rows.splice(index, 1);
	}

	// Save Worksheet to DB
	async function handleSave() {
		if (!userState.user) {
			saveStatus = 'error';
			saveMessage = 'Please sign in to save your analyses to the cloud.';
			return;
		}

		isSaving = true;
		saveStatus = '';
		saveMessage = '';

		const payload = {
			type: 'fmea',
			title: title.trim(),
			data: JSON.stringify(rows)
		};

		try {
			const url = analysisId ? `/api/v1/analyses/${analysisId}` : '/api/v1/analyses';
			const method = analysisId ? 'PUT' : 'POST';

			const res = await fetch(url, {
				method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});
			const json = await res.json();
			if (json.success) {
				saveStatus = 'success';
				saveMessage = 'Project successfully saved to cloud.';
				status = 'draft'; // Reverts to draft on update/save
				signatureName = '';
				if (!analysisId) {
					// Redirect to the newly created analysis URL
					window.location.href = `/fmea/${json.data.id}`;
				}
			} else {
				saveStatus = 'error';
				saveMessage = json.error || 'Failed to save.';
			}
		} catch (err) {
			saveStatus = 'error';
			saveMessage = 'Network error saving project.';
		} finally {
			isSaving = false;
		}
	}

	// Scale modal helper opener
	function openScaleHelper(type: 'S' | 'O' | 'D', rowIndex: number) {
		modalType = type;
		activeRowIndex = rowIndex;
		modalOpen = true;
	}

	function selectRating(val: number) {
		if (activeRowIndex !== null && activeRowIndex < rows.length) {
			if (modalType === 'S') rows[activeRowIndex].severity = val;
			if (modalType === 'O') rows[activeRowIndex].occurrence = val;
			if (modalType === 'D') rows[activeRowIndex].detectability = val;
			recalculateRPN(rows[activeRowIndex]);
		}
		modalOpen = false;
	}

	// PDF Export (client-side)
	async function exportPDF() {
		const { jsPDF } = await import('jspdf');
		const { default: autoTable } = await import('jspdf-autotable');

		const doc = new jsPDF('l', 'mm', 'a4'); // Landscape A4
		
		// Styled Header
		doc.setFillColor(15, 20, 32); // Dark blue-gray header
		doc.rect(0, 0, 297, 24, 'F');

		doc.setTextColor(255, 255, 255);
		doc.setFont('helvetica', 'bold');
		doc.setFontSize(16);
		doc.text('Aviation Failure Mode and Effects Analysis (FMEA) Report', 12, 10);
		
		doc.setFont('helvetica', 'normal');
		doc.setFontSize(9);
		doc.text(`Project: ${title}`, 12, 18);
		doc.text(`Date Generated: ${new Date().toLocaleDateString()} UTC`, 220, 18);

		const tableData = rows.map((r, i) => [
			i + 1,
			r.item,
			r.failureMode,
			r.effects,
			r.causes,
			r.severity,
			r.occurrence,
			r.detectability,
			r.rpn,
			r.actions
		]);

		autoTable(doc, {
			startY: 28,
			head: [['#', 'Component / Function', 'Failure Mode', 'Failure Effects', 'Failure Causes', 'S', 'O', 'D', 'RPN', 'Mitigation / Actions']],
			body: tableData,
			theme: 'grid',
			headStyles: { fillColor: [22, 28, 45], textColor: [0, 240, 255], fontSize: 8, fontStyle: 'bold' },
			styles: { fontSize: 8, textColor: [60, 60, 60] },
			columnStyles: {
				5: { fontStyle: 'bold', halign: 'center' },
				6: { fontStyle: 'bold', halign: 'center' },
				7: { fontStyle: 'bold', halign: 'center' },
				8: { fontStyle: 'bold', textColor: [255, 51, 102], halign: 'center' }
			}
		});

		doc.save(`${title.replace(/\s+/g, '_')}_FMEA.pdf`);
	}

	// Excel Export (client-side)
	async function exportExcel() {
		const XLSX = await import('xlsx');

		const exportRows = rows.map((r, i) => ({
			Index: i + 1,
			'Component / Function': r.item,
			'Failure Mode': r.failureMode,
			'Failure Effects': r.effects,
			'Failure Causes': r.causes,
			Severity: r.severity,
			Occurrence: r.occurrence,
			Detectability: r.detectability,
			RPN: r.rpn,
			'Mitigation Actions': r.actions
		}));

		const worksheet = XLSX.utils.json_to_sheet(exportRows);
		const workbook = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(workbook, worksheet, 'FMEA Worksheet');
		
		// Auto fit column widths
		XLSX.writeFile(workbook, `${title.replace(/\s+/g, '_')}_FMEA.xlsx`);
	}
</script>

<div class="space-y-6">
	<!-- Workspace header card -->
	<div class="hud-card p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
		<div class="space-y-1.5 flex-1 w-full">
			<label class="block text-[10px] font-mono text-gray-500 uppercase tracking-widest">Active Workbook Title</label>
			<input 
				type="text" 
				bind:value={title} 
				class="w-full bg-transparent border-b border-border-subtle focus:border-hud-cyan text-xl font-bold text-white py-1 focus:outline-none transition-colors"
			/>
			<div class="flex flex-wrap items-center gap-4 mt-2 select-none">
				{#if status === 'approved'}
					<span class="px-2 py-0.5 rounded border border-hud-emerald/30 bg-hud-emerald/10 text-hud-emerald text-[9px] font-mono font-bold tracking-wider uppercase">
						Approved / Signed
					</span>
					<span class="text-[10px] font-mono text-gray-400">
						Signed By: <span class="text-white font-semibold">{signatureName}</span>
					</span>
					{#if nextReviewDueAt}
						{@const isOverdue = new Date(nextReviewDueAt) < new Date()}
						<span class="text-[10px] font-mono {isOverdue ? 'text-hud-rose font-bold animate-pulse' : 'text-gray-400'}">
							Review Due: {new Date(nextReviewDueAt).toLocaleDateString()} {isOverdue ? '[OVERDUE]' : ''}
						</span>
					{/if}
					<a href="/fmea/{analysisId}/baseline" class="text-[10px] font-mono text-hud-cyan hover:underline font-bold">
						[View Baselines]
					</a>
				{:else}
					<span class="px-2 py-0.5 rounded border border-hud-amber/30 bg-hud-amber/10 text-hud-amber text-[9px] font-mono font-bold tracking-wider uppercase">
						Draft (Unsigned)
					</span>
					<span class="text-[10px] font-mono text-gray-500">
						FAA_STATUS: PENDING_COMPLIANCE_SIGN_OFF
					</span>
				{/if}
			</div>
		</div>
		<div class="flex flex-wrap items-center gap-3 w-full md:w-auto">
			<button 
				onclick={handleSave} 
				disabled={isSaving}
				class="flex-1 md:flex-initial py-2 px-5 rounded bg-hud-cyan hover:bg-hud-cyan-dim text-bg-darker font-bold text-xs tracking-wider uppercase flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
			>
				{#if isSaving}
					<span class="w-3.5 h-3.5 rounded-full border border-bg-darker/35 border-t-bg-darker animate-spin"></span>
				{/if}
				<span>Save cloud</span>
			</button>
			{#if analysisId && status === 'draft'}
				<button 
					onclick={() => signModalOpen = true}
					class="py-2 px-4 rounded border border-hud-rose text-hud-rose hover:bg-hud-rose/10 text-xs font-mono font-bold tracking-wider uppercase transition-colors"
				>
					Sign & Approve
				</button>
			{/if}
			{#if analysisId && status === 'approved'}
				<button 
					onclick={handleReview}
					disabled={isReviewing}
					class="py-2 px-4 rounded border border-hud-emerald text-hud-emerald hover:bg-hud-emerald/10 text-xs font-mono font-bold tracking-wider uppercase transition-colors"
				>
					Log Review
				</button>
			{/if}
			<button 
				onclick={exportPDF} 
				class="py-2 px-4 rounded border border-border-subtle text-gray-300 hover:text-hud-cyan hover:border-hud-cyan/40 text-xs font-mono font-bold tracking-wider uppercase transition-colors"
			>
				Export PDF
			</button>
			<button 
				onclick={exportExcel} 
				class="py-2 px-4 rounded border border-border-subtle text-gray-300 hover:text-hud-amber hover:border-hud-amber/40 text-xs font-mono font-bold tracking-wider uppercase transition-colors"
			>
				Export Excel
			</button>
		</div>
	</div>

	<!-- Status Message Display -->
	{#if saveMessage}
		<div class="p-3.5 rounded border text-xs font-mono flex items-center gap-2 {saveStatus === 'success' ? 'border-hud-emerald bg-hud-emerald/10 text-hud-emerald' : 'border-hud-rose bg-hud-rose/10 text-hud-rose'}">
			<span>{saveMessage}</span>
		</div>
	{/if}

	<!-- Spreadsheet and risk matrix grid layout -->
	<div class="grid grid-cols-1 xl:grid-cols-4 gap-8">
		<!-- Spreadsheet (col-span-3) -->
		<div class="xl:col-span-3 space-y-4">
			<div class="hud-card overflow-hidden">
				<div class="overflow-x-auto">
					<table class="w-full text-left font-mono text-[11px] border-collapse min-w-[900px]">
						<thead>
							<tr class="border-b border-border-subtle bg-bg-darker text-gray-400 select-none">
								<th class="p-3 w-12 text-center">#</th>
								<th class="p-3 w-48">Component / Function</th>
								<th class="p-3 w-48">Potential Failure Mode</th>
								<th class="p-3 w-48">Failure Effects</th>
								<th class="p-3 w-48">Potential Causes</th>
								<th class="p-3 w-16 text-center text-hud-rose">S</th>
								<th class="p-3 w-16 text-center text-hud-amber">O</th>
								<th class="p-3 w-16 text-center text-hud-cyan">D</th>
								<th class="p-3 w-16 text-center text-hud-cyan">RPN</th>
								<th class="p-3">Aeronautic Mitigation Actions</th>
								<th class="p-3 w-12 text-center"></th>
							</tr>
						</thead>
						<tbody class="divide-y divide-border-subtle text-gray-300">
							{#each rows as row, index}
								<tr class="hover:bg-white/[0.01] transition-colors">
									<td class="p-3 text-center text-gray-500 font-semibold">{index + 1}</td>
									<td class="p-2">
										<textarea 
											bind:value={row.item} 
											placeholder="e.g. Flight Computer A" 
											rows="2"
											class="w-full bg-bg-darker/60 border border-border-subtle focus:border-hud-cyan p-1.5 rounded resize-none focus:outline-none"
										></textarea>
									</td>
									<td class="p-2">
										<textarea 
											bind:value={row.failureMode} 
											placeholder="e.g. Memory leak in bus handler" 
											rows="2"
											class="w-full bg-bg-darker/60 border border-border-subtle focus:border-hud-cyan p-1.5 rounded resize-none focus:outline-none"
										></textarea>
									</td>
									<td class="p-2">
										<textarea 
											bind:value={row.effects} 
											placeholder="e.g. Total computer lockup" 
											rows="2"
											class="w-full bg-bg-darker/60 border border-border-subtle focus:border-hud-cyan p-1.5 rounded resize-none focus:outline-none"
										></textarea>
									</td>
									<td class="p-2">
										<textarea 
											bind:value={row.causes} 
											placeholder="e.g. Software timing overrun" 
											rows="2"
											class="w-full bg-bg-darker/60 border border-border-subtle focus:border-hud-cyan p-1.5 rounded resize-none focus:outline-none"
										></textarea>
									</td>
									<!-- Severity (S) -->
									<td class="p-2 text-center">
										<button 
											onclick={() => openScaleHelper('S', index)}
											class="w-10 py-1.5 rounded border border-hud-rose/35 bg-hud-rose/10 hover:bg-hud-rose/25 text-hud-rose font-bold text-center transition-colors"
										>
											{row.severity}
										</button>
									</td>
									<!-- Occurrence (O) -->
									<td class="p-2 text-center">
										<button 
											onclick={() => openScaleHelper('O', index)}
											class="w-10 py-1.5 rounded border border-hud-amber/35 bg-hud-amber/10 hover:bg-hud-amber/25 text-hud-amber font-bold text-center transition-colors"
										>
											{row.occurrence}
										</button>
									</td>
									<!-- Detectability (D) -->
									<td class="p-2 text-center">
										<button 
											onclick={() => openScaleHelper('D', index)}
											class="w-10 py-1.5 rounded border border-hud-cyan/35 bg-hud-cyan/10 hover:bg-hud-cyan/25 text-hud-cyan font-bold text-center transition-colors"
										>
											{row.detectability}
										</button>
									</td>
									<!-- RPN -->
									<td class="p-2 text-center font-bold text-sm {row.rpn >= 250 ? 'text-hud-rose font-extrabold text-shadow-glow' : 'text-gray-400'}">
										{row.rpn}
									</td>
									<td class="p-2">
										<textarea 
											bind:value={row.actions} 
											placeholder="e.g. Implement dual channel vote mechanism..." 
											rows="2"
											class="w-full bg-bg-darker/60 border border-border-subtle focus:border-hud-cyan p-1.5 rounded resize-none focus:outline-none"
										></textarea>
									</td>
									<td class="p-2 text-center">
										<button 
											onclick={() => deleteRow(index)}
											class="p-1.5 rounded hover:bg-hud-rose/10 text-gray-500 hover:text-hud-rose transition-colors"
											title="Delete Row"
										>
											<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
											</svg>
										</button>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
			<!-- Add Row Button -->
			<button 
				onclick={addRow}
				class="w-full py-2.5 rounded border border-dashed border-hud-cyan/40 bg-hud-cyan/5 hover:bg-hud-cyan/10 text-hud-cyan font-semibold text-xs tracking-wider uppercase text-center transition-colors font-mono"
			>
				+ Add Failure Mode Row
			</button>
		</div>

		<!-- Risk Criticality Matrix (col-span-1) -->
		<div class="xl:col-span-1 space-y-6">
			<div class="hud-card p-6 space-y-4">
				<div>
					<h3 class="text-sm font-bold text-white font-mono flex items-center gap-1.5">
						<span class="w-1.5 h-1.5 rounded-full bg-hud-cyan animate-pulse"></span>
						Criticality Matrix
					</h3>
					<p class="text-[10px] text-gray-500 font-mono mt-0.5">SEVERITY VS OCCURRENCE HEATMAP</p>
				</div>

				<!-- Matrix Grid (10x10) -->
				<div class="space-y-1">
					<div class="flex items-center text-[8px] font-mono text-gray-500 justify-center">
						OCCURRENCE (O)
					</div>
					<div class="flex gap-2">
						<!-- Y Axis labels -->
						<div class="flex flex-col justify-between text-[8px] font-mono text-gray-500 w-3 py-1 text-right select-none">
							{#each Array(10).fill(0).map((_, i) => 10 - i) as label}
								<span class="h-5 flex items-center justify-end">{label}</span>
							{/each}
						</div>

						<!-- Matrix Heatmap -->
						<div class="flex-1 grid grid-cols-10 gap-0.5">
							{#each criticalityMatrix as row, oIdx}
								{#each row as count, sIdx}
									{@const occVal = 10 - oIdx}
									{@const sevVal = sIdx + 1}
									<div 
										class="aspect-square w-full h-5 rounded-[2px] border text-[9px] font-bold flex items-center justify-center transition-all select-none hover:scale-105 {getCellColor(occVal, sevVal)}"
										title="S={sevVal}, O={occVal}: {count} failure modes"
									>
										{count > 0 ? count : ''}
									</div>
								{/each}
							{/each}
						</div>
					</div>

					<!-- X Axis labels -->
					<div class="flex gap-2">
						<div class="w-3"></div> <!-- Offset -->
						<div class="flex-1 grid grid-cols-10 gap-0.5 text-[8px] font-mono text-gray-500 text-center select-none">
							{#each Array(10).fill(0).map((_, i) => i + 1) as label}
								<span>{label}</span>
							{/each}
						</div>
					</div>
					<div class="text-[8px] font-mono text-gray-500 text-center pt-1">
						SEVERITY (S)
					</div>
				</div>

				<!-- Color Legend -->
				<div class="pt-2 border-t border-border-subtle grid grid-cols-3 gap-2 font-mono text-[9px]">
					<div class="flex items-center gap-1">
						<span class="w-2.5 h-2.5 rounded bg-hud-emerald/25 border border-hud-emerald/65"></span>
						<span class="text-gray-400">Low (S×O≤15)</span>
					</div>
					<div class="flex items-center gap-1">
						<span class="w-2.5 h-2.5 rounded bg-hud-amber/20 border border-hud-amber/55"></span>
						<span class="text-gray-400">Med (16-40)</span>
					</div>
					<div class="flex items-center gap-1">
						<span class="w-2.5 h-2.5 rounded bg-hud-rose/25 border border-hud-rose/65"></span>
						<span class="text-gray-400">High (S×O≥41)</span>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>

<!-- Modal Scale Helper -->
{#if modalOpen}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
		<!-- Modal box -->
		<div class="hud-card w-full max-w-lg overflow-hidden border-hud-cyan animate-scale-up">
			<!-- Header -->
			<div class="border-b border-border-subtle p-4 bg-bg-darker flex items-center justify-between">
				<h3 class="text-sm font-bold text-white font-mono">
					Select rating for: 
					{#if modalType === 'S'}<span class="text-hud-rose uppercase">Severity (S)</span>{/if}
					{#if modalType === 'O'}<span class="text-hud-amber uppercase">Occurrence (O)</span>{/if}
					{#if modalType === 'D'}<span class="text-hud-cyan uppercase">Detectability (D)</span>{/if}
				</h3>
				<button 
					onclick={() => modalOpen = false}
					class="text-gray-500 hover:text-white font-bold"
				>
					✕
				</button>
			</div>

			<!-- Scale options -->
			<div class="p-4 max-h-[400px] overflow-y-auto space-y-2">
				{#each scales[modalType] as item}
					<button 
						onclick={() => selectRating(item.val)}
						class="w-full text-left p-3 rounded border border-border-subtle hover:border-hud-cyan/50 hover:bg-hud-cyan/5 flex items-start gap-4 transition-all"
					>
						<span class="text-sm font-bold font-mono px-2 py-1 rounded border bg-bg-darker 
							{modalType === 'S' ? 'border-hud-rose/30 text-hud-rose' : ''}
							{modalType === 'O' ? 'border-hud-amber/30 text-hud-amber' : ''}
							{modalType === 'D' ? 'border-hud-cyan/30 text-hud-cyan' : ''}
						">
							{item.val}
						</span>
						<div class="space-y-0.5">
							<strong class="text-white text-xs block font-semibold">{item.label}</strong>
							<p class="text-[11px] text-gray-400 leading-normal">{item.desc}</p>
						</div>
					</button>
				{/each}
			</div>

			<!-- Footer -->
			<div class="border-t border-border-subtle p-3 bg-bg-darker text-right">
				<button 
					onclick={() => modalOpen = false}
					class="py-1 px-4 rounded border border-border-subtle text-xs font-semibold text-gray-400 hover:text-white transition-colors"
				>
					Cancel
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Signature Modal -->
{#if signModalOpen}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
		<div class="hud-card w-full max-w-sm border-hud-rose animate-scale-up">
			<div class="border-b border-border-subtle p-4 bg-bg-darker flex items-center justify-between">
				<h3 class="text-sm font-bold text-white font-mono uppercase text-hud-rose">Sign & Approve Analysis</h3>
				<button onclick={() => signModalOpen = false} class="text-gray-500 hover:text-white font-bold">✕</button>
			</div>
			<div class="p-5 space-y-4">
				<p class="text-xs text-gray-400 leading-normal">
					By entering your name below, you electronically sign off on this safety-critical FMEA workbook. This creates an immutable baseline revision for regulatory audit purposes.
				</p>
				<div>
					<label for="sig-name" class="block text-[10px] font-mono text-gray-500 mb-1">Printed Signature Name</label>
					<input 
						id="sig-name"
						type="text" 
						bind:value={printSignName} 
						placeholder="Capt. John Doe / Lead Engineer"
						class="w-full bg-bg-darker border border-border-subtle focus:border-hud-rose p-2 rounded text-xs text-white focus:outline-none font-mono"
					/>
				</div>
			</div>
			<div class="border-t border-border-subtle p-3 bg-bg-darker flex gap-2 justify-end">
				<button onclick={() => signModalOpen = false} class="py-1.5 px-4 rounded border border-border-subtle text-xs text-gray-400 hover:text-white transition-colors">Cancel</button>
				<button onclick={handleSign} disabled={isSigning} class="py-1.5 px-4 rounded bg-hud-rose hover:bg-red-500 text-white font-bold text-xs uppercase tracking-wider transition-colors disabled:opacity-50">Sign Revision</button>
			</div>
		</div>
	</div>
{/if}
