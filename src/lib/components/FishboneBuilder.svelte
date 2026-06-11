<script lang="ts">
	import { userState } from '$lib/user.svelte';
	import { onMount } from 'svelte';

	// Props
	let { analysisId = null as string | null } = $props();

	// Types
	interface FishboneNode {
		id: string;
		text: string;
		children: FishboneNode[];
	}

	interface FishboneData {
		effect: string;
		categories: {
			man: FishboneNode[];
			machine: FishboneNode[];
			method: FishboneNode[];
			material: FishboneNode[];
			measurement: FishboneNode[];
			motherNature: FishboneNode[];
			management: FishboneNode[];
		};
	}

	// State
	let title = $state('Aviation Root Cause - Unnamed Project');
	let effect = $state('Turbofan Compressor Stall on Takeoff Roll');
	
	// Default pre-loaded aviation 6M+1 categories
	let categories = $state<FishboneData['categories']>({
		man: [
			{ id: 'm1', text: 'Mechanic fatigue during night shift', children: [] },
			{ id: 'm2', text: 'Communication breakdown during shift handover', children: [] }
		],
		machine: [
			{ id: 'mc1', text: 'Stiff Variable Stator Vane (VSV) actuator linkage', children: [] },
			{ id: 'mc2', text: 'Worn compressor blade tips', children: [] }
		],
		method: [
			{ id: 'mt1', text: 'Lubrication checklist lacked specific torque specs', children: [] }
		],
		material: [
			{ id: 'mat1', text: 'Incorrect lubricant viscosity used', children: [] }
		],
		measurement: [
			{ id: 'ms1', text: 'EICAS sensor miscalibration', children: [] }
		],
		motherNature: [
			{ id: 'mn1', text: 'High atmospheric moisture & icing conditions', children: [] }
		],
		management: [
			{ id: 'mg1', text: 'Overscheduled maintenance flights', children: [] }
		]
	});

	let isSaving = $state(false);
	let saveStatus = $state(''); // 'success' | 'error' | ''
	let saveMessage = $state('');

	// Selection State for Editor Drawer
	// Path: category -> causeIndex -> subCauseIndex...
	// Simplifies selection by tracking selected node ID and type
	let selectedId = $state<string | null>(null);
	let selectedType = $state<'effect' | 'category' | 'cause' | null>(null);
	let selectedCategoryKey = $state<keyof FishboneData['categories'] | null>(null);
	let selectedNodePath = $state<number[]>([]); // Indexes to traverse causes

	// Retrieve currently selected node reference
	let selectedNodeRef = $derived.by(() => {
		if (!selectedId || !selectedCategoryKey) return null;
		const rootList = categories[selectedCategoryKey];
		
		if (selectedType === 'cause') {
			let current: FishboneNode | undefined = rootList[selectedNodePath[0]];
			for (let i = 1; i < selectedNodePath.length; i++) {
				if (current) {
					current = current.children[selectedNodePath[i]];
				}
			}
			return current || null;
		}
		return null;
	});

	// SVG Element Ref for PNG export
	let svgRef = $state<SVGSVGElement | null>(null);

	// Load existing analysis if ID is provided
	onMount(async () => {
		if (analysisId) {
			try {
				const res = await fetch(`/api/v1/analyses/${analysisId}`);
				const json = await res.json();
				if (json.success && json.data) {
					title = json.data.title;
					const parsed = JSON.parse(json.data.data);
					effect = parsed.effect;
					categories = parsed.categories;
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

	// Select Nodes Helpers
	function selectEffect() {
		selectedId = 'effect';
		selectedType = 'effect';
		selectedCategoryKey = null;
		selectedNodePath = [];
	}

	function selectCategory(catKey: keyof FishboneData['categories']) {
		selectedId = catKey;
		selectedType = 'category';
		selectedCategoryKey = catKey;
		selectedNodePath = [];
	}

	function selectCause(catKey: keyof FishboneData['categories'], path: number[], id: string) {
		selectedId = id;
		selectedType = 'cause';
		selectedCategoryKey = catKey;
		selectedNodePath = path;
	}

	// Add Nodes Helpers
	function addCauseToCategory(catKey: keyof FishboneData['categories']) {
		const newId = Math.random().toString(36).substring(2, 9);
		categories[catKey].push({
			id: newId,
			text: 'New Cause',
			children: []
		});
		// Select the newly added cause
		selectCause(catKey, [categories[catKey].length - 1], newId);
	}

	function addSubCause() {
		const node = selectedNodeRef;
		if (node) {
			const newId = Math.random().toString(36).substring(2, 9);
			node.children.push({
				id: newId,
				text: 'Sub-cause details',
				children: []
			});
			// Select the newly added sub-cause
			const newPath = [...selectedNodePath, node.children.length - 1];
			selectCause(selectedCategoryKey!, newPath, newId);
		}
	}

	function deleteSelectedNode() {
		if (!selectedCategoryKey || !selectedId) return;

		if (selectedType === 'category') {
			alert('Root categories cannot be deleted.');
			return;
		}

		if (selectedType === 'cause') {
			if (selectedNodePath.length === 1) {
				// Delete root cause from category array
				categories[selectedCategoryKey].splice(selectedNodePath[0], 1);
			} else {
				// Navigate to parent node and delete
				let parentList = categories[selectedCategoryKey];
				let current: FishboneNode = parentList[selectedNodePath[0]];
				for (let i = 1; i < selectedNodePath.length - 1; i++) {
					current = current.children[selectedNodePath[i]];
				}
				const childIndex = selectedNodePath[selectedNodePath.length - 1];
				current.children.splice(childIndex, 1);
			}

			// Clear selection
			selectedId = null;
			selectedType = null;
			selectedCategoryKey = null;
			selectedNodePath = [];
		}
	}

	// Save to DB
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
			type: 'fishbone',
			title: title.trim(),
			data: JSON.stringify({
				effect,
				categories
			})
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
				if (!analysisId) {
					window.location.href = `/fishbone/${json.data.id}`;
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

	// SVG Exporter
	function exportSVG() {
		if (!svgRef) return;
		const serializer = new XMLSerializer();
		const svgString = serializer.serializeToString(svgRef);
		const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
		const svgUrl = URL.createObjectURL(svgBlob);
		
		const downloadLink = document.createElement('a');
		downloadLink.href = svgUrl;
		downloadLink.download = `${title.replace(/\s+/g, '_')}_ishikawa.svg`;
		document.body.appendChild(downloadLink);
		downloadLink.click();
		document.body.removeChild(downloadLink);
	}

	// PNG Exporter
	function exportPNG() {
		if (!svgRef) return;
		const serializer = new XMLSerializer();
		const svgString = serializer.serializeToString(svgRef);
		const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
		const url = URL.createObjectURL(svgBlob);
		
		const image = new Image();
		image.onload = () => {
			const canvas = document.createElement('canvas');
			canvas.width = 1000;
			canvas.height = 600;
			const context = canvas.getContext('2d');
			if (context) {
				// Fill dark background same as SVG theme
				context.fillStyle = '#080b11';
				context.fillRect(0, 0, canvas.width, canvas.height);
				context.drawImage(image, 0, 0);
				
				const pngUrl = canvas.toDataURL('image/png');
				const downloadLink = document.createElement('a');
				downloadLink.href = pngUrl;
				downloadLink.download = `${title.replace(/\s+/g, '_')}_ishikawa.png`;
				document.body.appendChild(downloadLink);
				downloadLink.click();
				document.body.removeChild(downloadLink);
			}
		};
		image.src = url;
	}

	// Render Labels helper
	const categoryLabels = {
		man: 'Man (Personnel)',
		machine: 'Machine (Equipment)',
		method: 'Method (Procedures)',
		material: 'Material (Parts)',
		measurement: 'Measurement (Telemetry)',
		motherNature: 'Mother Nature (Environment)',
		management: 'Management (Organization)'
	};
</script>

<div class="space-y-6">
	<!-- Workspace header card -->
	<div class="hud-card p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
		<div class="space-y-1.5 flex-1 w-full">
			<label class="block text-[10px] font-mono text-gray-500 uppercase tracking-widest">Active Diagram Title</label>
			<input 
				type="text" 
				bind:value={title} 
				class="w-full bg-transparent border-b border-border-subtle focus:border-hud-cyan text-xl font-bold text-white py-1 focus:outline-none transition-colors"
			/>
		</div>
		<div class="flex items-center gap-3 w-full md:w-auto">
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
			<button 
				onclick={exportSVG} 
				class="py-2 px-4 rounded border border-border-subtle text-gray-300 hover:text-hud-cyan hover:border-hud-cyan/40 text-xs font-mono font-bold tracking-wider uppercase transition-colors"
			>
				Export SVG
			</button>
			<button 
				onclick={exportPNG} 
				class="py-2 px-4 rounded border border-border-subtle text-gray-300 hover:text-hud-amber hover:border-hud-amber/40 text-xs font-mono font-bold tracking-wider uppercase transition-colors"
			>
				Export PNG
			</button>
		</div>
	</div>

	<!-- Status Message Display -->
	{#if saveMessage}
		<div class="p-3.5 rounded border text-xs font-mono flex items-center gap-2 {saveStatus === 'success' ? 'border-hud-emerald bg-hud-emerald/10 text-hud-emerald' : 'border-hud-rose bg-hud-rose/10 text-hud-rose'}">
			<span>{saveMessage}</span>
		</div>
	{/if}

	<!-- Canvas and Sidebar layout -->
	<div class="grid grid-cols-1 lg:grid-cols-4 gap-8">
		<!-- SVG Diagram Canvas (col-span-3) -->
		<div class="lg:col-span-3 flex flex-col space-y-4">
			<div class="hud-card p-4 overflow-x-auto bg-[#080b11]">
				<!-- Main Fishbone SVG Drawing -->
				<svg 
					bind:this={svgRef}
					viewBox="0 0 1000 600" 
					class="w-full min-w-[850px] aspect-[5/3] overflow-visible select-none"
				>
					<!-- Grid helper pattern for technical blueprint style -->
					<defs>
						<pattern id="blueprint-grid" width="40" height="40" patternUnits="userSpaceOnUse">
							<path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.015)" stroke-width="1"/>
						</pattern>
					</defs>
					<rect width="100%" height="100%" fill="url(#blueprint-grid)"/>

					<!-- 1. Central Spine (Horizontal line connecting to Effect) -->
					<!-- Spine Line -->
					<line 
						x1="50" y1="300" x2="820" y2="300" 
						stroke="#0077ff" stroke-width="4" 
						stroke-dasharray="1000" stroke-dashoffset="0"
						class="hud-border-glow-cyan"
					/>
					<!-- Spine Arrow head -->
					<polygon points="820,290 840,300 820,310" fill="#0077ff" />

					<!-- 2. Effect Box (Fish Head) -->
					<g onclick={selectEffect} class="cursor-pointer group">
						<rect 
							x="840" y="250" width="150" height="100" rx="8" 
							fill="rgba(18, 25, 41, 0.9)" 
							stroke={selectedId === 'effect' ? '#ff3366' : '#ff3366'} 
							stroke-width={selectedId === 'effect' ? '3' : '1.5'} 
							class="transition-all duration-150 {selectedId === 'effect' ? 'hud-border-glow-rose shadow-[0_0_15px_rgba(255,51,102,0.2)]' : 'group-hover:stroke-hud-rose/70'}"
						/>
						<text x="915" y="275" fill="#ff3366" text-anchor="middle" font-weight="bold" font-family="monospace" font-size="10" tracking="2">EFFECT // HAZARD</text>
						<text x="915" y="305" fill="#ffffff" text-anchor="middle" font-size="11" font-weight="500">
							{effect.length > 20 ? effect.substring(0, 18) + '...' : effect}
						</text>
					</g>

					<!-- 3. Upper Categories Branches -->
					<!-- Categories: Man, Method, Measurement, Management -->
					<!-- Angles: 60 degrees. Lines start at X_top (e.g. 120) and end at X_spine = X_top + 100 -->
					
					<!-- MAN Branch (X: 120 -> 220) -->
					<g onclick={() => selectCategory('man')} class="cursor-pointer group">
						<line x1="120" y1="80" x2="220" y2="300" stroke={selectedCategoryKey === 'man' && selectedType === 'category' ? '#00f0ff' : 'rgba(255,255,255,0.2)'} stroke-width="2.5" class="group-hover:stroke-hud-cyan/50 transition-colors"/>
						<rect x="70" y="50" width="100" height="30" rx="4" fill="#0f1420" stroke={selectedCategoryKey === 'man' && selectedType === 'category' ? '#00f0ff' : 'rgba(255,255,255,0.1)'} stroke-width="1.5" />
						<text x="120" y="68" fill={selectedCategoryKey === 'man' && selectedType === 'category' ? '#00f0ff' : '#9ca3af'} text-anchor="middle" font-family="monospace" font-size="10" font-weight="bold">1. PERSONNEL</text>
					</g>
					<!-- Draw Man Causes -->
					{#each categories.man as cause, i}
						{@const ratio = (i + 1) / (categories.man.length + 1)}
						{@const cx = 120 + ratio * 100}
						{@const cy = 80 + ratio * 220}
						<g onclick={(e) => { e.stopPropagation(); selectCause('man', [i], cause.id); }} class="cursor-pointer group">
							<line x1={cx} y1={cy} x2={cx - 70} y2={cy} stroke={selectedId === cause.id ? '#00f0ff' : 'rgba(255,255,255,0.15)'} stroke-width="1.5" class="group-hover:stroke-hud-cyan transition-colors" />
							<text x={cx - 75} y={cy - 4} fill={selectedId === cause.id ? '#00f0ff' : '#d1d5db'} text-anchor="end" font-size="9" class="group-hover:fill-white">
								{cause.text.length > 20 ? cause.text.substring(0, 18) + '...' : cause.text}
							</text>
						</g>
					{/each}

					<!-- METHOD Branch (X: 320 -> 420) -->
					<g onclick={() => selectCategory('method')} class="cursor-pointer group">
						<line x1="320" y1="80" x2="420" y2="300" stroke={selectedCategoryKey === 'method' && selectedType === 'category' ? '#00f0ff' : 'rgba(255,255,255,0.2)'} stroke-width="2.5" class="group-hover:stroke-hud-cyan/50 transition-colors"/>
						<rect x="270" y="50" width="100" height="30" rx="4" fill="#0f1420" stroke={selectedCategoryKey === 'method' && selectedType === 'category' ? '#00f0ff' : 'rgba(255,255,255,0.1)'} stroke-width="1.5" />
						<text x="320" y="68" fill={selectedCategoryKey === 'method' && selectedType === 'category' ? '#00f0ff' : '#9ca3af'} text-anchor="middle" font-family="monospace" font-size="10" font-weight="bold">2. PROCEDURES</text>
					</g>
					{#each categories.method as cause, i}
						{@const ratio = (i + 1) / (categories.method.length + 1)}
						{@const cx = 320 + ratio * 100}
						{@const cy = 80 + ratio * 220}
						<g onclick={(e) => { e.stopPropagation(); selectCause('method', [i], cause.id); }} class="cursor-pointer group">
							<line x1={cx} y1={cy} x2={cx - 70} y2={cy} stroke={selectedId === cause.id ? '#00f0ff' : 'rgba(255,255,255,0.15)'} stroke-width="1.5" class="group-hover:stroke-hud-cyan transition-colors" />
							<text x={cx - 75} y={cy - 4} fill={selectedId === cause.id ? '#00f0ff' : '#d1d5db'} text-anchor="end" font-size="9" class="group-hover:fill-white">
								{cause.text.length > 20 ? cause.text.substring(0, 18) + '...' : cause.text}
							</text>
						</g>
					{/each}

					<!-- MEASUREMENT Branch (X: 520 -> 620) -->
					<g onclick={() => selectCategory('measurement')} class="cursor-pointer group">
						<line x1="520" y1="80" x2="620" y2="300" stroke={selectedCategoryKey === 'measurement' && selectedType === 'category' ? '#00f0ff' : 'rgba(255,255,255,0.2)'} stroke-width="2.5" class="group-hover:stroke-hud-cyan/50 transition-colors"/>
						<rect x="470" y="50" width="100" height="30" rx="4" fill="#0f1420" stroke={selectedCategoryKey === 'measurement' && selectedType === 'category' ? '#00f0ff' : 'rgba(255,255,255,0.1)'} stroke-width="1.5" />
						<text x="520" y="68" fill={selectedCategoryKey === 'measurement' && selectedType === 'category' ? '#00f0ff' : '#9ca3af'} text-anchor="middle" font-family="monospace" font-size="10" font-weight="bold">3. TELEMETRY</text>
					</g>
					{#each categories.measurement as cause, i}
						{@const ratio = (i + 1) / (categories.measurement.length + 1)}
						{@const cx = 520 + ratio * 100}
						{@const cy = 80 + ratio * 220}
						<g onclick={(e) => { e.stopPropagation(); selectCause('measurement', [i], cause.id); }} class="cursor-pointer group">
							<line x1={cx} y1={cy} x2={cx - 70} y2={cy} stroke={selectedId === cause.id ? '#00f0ff' : 'rgba(255,255,255,0.15)'} stroke-width="1.5" class="group-hover:stroke-hud-cyan transition-colors" />
							<text x={cx - 75} y={cy - 4} fill={selectedId === cause.id ? '#00f0ff' : '#d1d5db'} text-anchor="end" font-size="9" class="group-hover:fill-white">
								{cause.text.length > 20 ? cause.text.substring(0, 18) + '...' : cause.text}
							</text>
						</g>
					{/each}

					<!-- MANAGEMENT Branch (X: 720 -> 820) -->
					<g onclick={() => selectCategory('management')} class="cursor-pointer group">
						<line x1="720" y1="80" x2="820" y2="300" stroke={selectedCategoryKey === 'management' && selectedType === 'category' ? '#00f0ff' : 'rgba(255,255,255,0.2)'} stroke-width="2.5" class="group-hover:stroke-hud-cyan/50 transition-colors"/>
						<rect x="670" y="50" width="100" height="30" rx="4" fill="#0f1420" stroke={selectedCategoryKey === 'management' && selectedType === 'category' ? '#00f0ff' : 'rgba(255,255,255,0.1)'} stroke-width="1.5" />
						<text x="720" y="68" fill={selectedCategoryKey === 'management' && selectedType === 'category' ? '#00f0ff' : '#9ca3af'} text-anchor="middle" font-family="monospace" font-size="10" font-weight="bold">4. ORGANIZATION</text>
					</g>
					{#each categories.management as cause, i}
						{@const ratio = (i + 1) / (categories.management.length + 1)}
						{@const cx = 720 + ratio * 100}
						{@const cy = 80 + ratio * 220}
						<g onclick={(e) => { e.stopPropagation(); selectCause('management', [i], cause.id); }} class="cursor-pointer group">
							<line x1={cx} y1={cy} x2={cx - 70} y2={cy} stroke={selectedId === cause.id ? '#00f0ff' : 'rgba(255,255,255,0.15)'} stroke-width="1.5" class="group-hover:stroke-hud-cyan transition-colors" />
							<text x={cx - 75} y={cy - 4} fill={selectedId === cause.id ? '#00f0ff' : '#d1d5db'} text-anchor="end" font-size="9" class="group-hover:fill-white">
								{cause.text.length > 20 ? cause.text.substring(0, 18) + '...' : cause.text}
							</text>
						</g>
					{/each}


					<!-- 4. Lower Categories Branches -->
					<!-- Categories: Machine, Material, Mother Nature -->
					
					<!-- MACHINE Branch (X: 180 -> 280, Y: 520 -> 300 slants up) -->
					<g onclick={() => selectCategory('machine')} class="cursor-pointer group">
						<line x1="180" y1="520" x2="280" y2="300" stroke={selectedCategoryKey === 'machine' && selectedType === 'category' ? '#ffaa00' : 'rgba(255,255,255,0.2)'} stroke-width="2.5" class="group-hover:stroke-hud-amber/50 transition-colors"/>
						<rect x="130" y="520" width="100" height="30" rx="4" fill="#0f1420" stroke={selectedCategoryKey === 'machine' && selectedType === 'category' ? '#ffaa00' : 'rgba(255,255,255,0.1)'} stroke-width="1.5" />
						<text x="180" y="538" fill={selectedCategoryKey === 'machine' && selectedType === 'category' ? '#ffaa00' : '#9ca3af'} text-anchor="middle" font-family="monospace" font-size="10" font-weight="bold">5. EQUIPMENT</text>
					</g>
					{#each categories.machine as cause, i}
						{@const ratio = (i + 1) / (categories.machine.length + 1)}
						{@const cx = 180 + ratio * 100}
						{@const cy = 520 - ratio * 220}
						<g onclick={(e) => { e.stopPropagation(); selectCause('machine', [i], cause.id); }} class="cursor-pointer group">
							<line x1={cx} y1={cy} x2={cx - 70} y2={cy} stroke={selectedId === cause.id ? '#ffaa00' : 'rgba(255,255,255,0.15)'} stroke-width="1.5" class="group-hover:stroke-hud-amber transition-colors" />
							<text x={cx - 75} y={cy - 4} fill={selectedId === cause.id ? '#ffaa00' : '#d1d5db'} text-anchor="end" font-size="9" class="group-hover:fill-white">
								{cause.text.length > 20 ? cause.text.substring(0, 18) + '...' : cause.text}
							</text>
						</g>
					{/each}

					<!-- MATERIAL Branch (X: 380 -> 480) -->
					<g onclick={() => selectCategory('material')} class="cursor-pointer group">
						<line x1="380" y1="520" x2="480" y2="300" stroke={selectedCategoryKey === 'material' && selectedType === 'category' ? '#ffaa00' : 'rgba(255,255,255,0.2)'} stroke-width="2.5" class="group-hover:stroke-hud-amber/50 transition-colors"/>
						<rect x="330" y="520" width="100" height="30" rx="4" fill="#0f1420" stroke={selectedCategoryKey === 'material' && selectedType === 'category' ? '#ffaa00' : 'rgba(255,255,255,0.1)'} stroke-width="1.5" />
						<text x="380" y="538" fill={selectedCategoryKey === 'material' && selectedType === 'category' ? '#ffaa00' : '#9ca3af'} text-anchor="middle" font-family="monospace" font-size="10" font-weight="bold">6. PARTS / COMS</text>
					</g>
					{#each categories.material as cause, i}
						{@const ratio = (i + 1) / (categories.material.length + 1)}
						{@const cx = 380 + ratio * 100}
						{@const cy = 520 - ratio * 220}
						<g onclick={(e) => { e.stopPropagation(); selectCause('material', [i], cause.id); }} class="cursor-pointer group">
							<line x1={cx} y1={cy} x2={cx - 70} y2={cy} stroke={selectedId === cause.id ? '#ffaa00' : 'rgba(255,255,255,0.15)'} stroke-width="1.5" class="group-hover:stroke-hud-amber transition-colors" />
							<text x={cx - 75} y={cy - 4} fill={selectedId === cause.id ? '#ffaa00' : '#d1d5db'} text-anchor="end" font-size="9" class="group-hover:fill-white">
								{cause.text.length > 20 ? cause.text.substring(0, 18) + '...' : cause.text}
							</text>
						</g>
					{/each}

					<!-- MOTHER NATURE Branch (X: 580 -> 680) -->
					<g onclick={() => selectCategory('motherNature')} class="cursor-pointer group">
						<line x1="580" y1="520" x2="680" y2="300" stroke={selectedCategoryKey === 'motherNature' && selectedType === 'category' ? '#ffaa00' : 'rgba(255,255,255,0.2)'} stroke-width="2.5" class="group-hover:stroke-hud-amber/50 transition-colors"/>
						<rect x="530" y="520" width="100" height="30" rx="4" fill="#0f1420" stroke={selectedCategoryKey === 'motherNature' && selectedType === 'category' ? '#ffaa00' : 'rgba(255,255,255,0.1)'} stroke-width="1.5" />
						<text x="580" y="538" fill={selectedCategoryKey === 'motherNature' && selectedType === 'category' ? '#ffaa00' : '#9ca3af'} text-anchor="middle" font-family="monospace" font-size="10" font-weight="bold">7. ENVIRONMENT</text>
					</g>
					{#each categories.motherNature as cause, i}
						{@const ratio = (i + 1) / (categories.motherNature.length + 1)}
						{@const cx = 580 + ratio * 100}
						{@const cy = 520 - ratio * 220}
						<g onclick={(e) => { e.stopPropagation(); selectCause('motherNature', [i], cause.id); }} class="cursor-pointer group">
							<line x1={cx} y1={cy} x2={cx - 70} y2={cy} stroke={selectedId === cause.id ? '#ffaa00' : 'rgba(255,255,255,0.15)'} stroke-width="1.5" class="group-hover:stroke-hud-amber transition-colors" />
							<text x={cx - 75} y={cy - 4} fill={selectedId === cause.id ? '#ffaa00' : '#d1d5db'} text-anchor="end" font-size="9" class="group-hover:fill-white">
								{cause.text.length > 20 ? cause.text.substring(0, 18) + '...' : cause.text}
							</text>
						</g>
					{/each}

				</svg>
			</div>

			<div class="text-center font-mono text-[10px] text-gray-500">
				TIP: CLICK DIRECTLY ON CATEGORY BOXES OR CAUSE LABELS IN THE SVG CANVAS TO SELECT AND EDIT
			</div>
		</div>

		<!-- Interactive Editor Sidebar Panel (col-span-1) -->
		<div class="lg:col-span-1 space-y-6">
			<!-- Details Sidebar Card -->
			<div class="hud-card p-6 space-y-6">
				<div>
					<h3 class="text-sm font-bold text-white font-mono flex items-center gap-1.5">
						<span class="w-1.5 h-1.5 rounded-full bg-hud-cyan animate-pulse"></span>
						Canvas Inspector
					</h3>
					<p class="text-[10px] text-gray-500 font-mono mt-0.5">EDIT SELECTED NODE ELEMENTS</p>
				</div>

				{#if selectedId === 'effect'}
					<!-- Edit Effect Box -->
					<div class="space-y-4">
						<div class="p-3.5 rounded bg-hud-rose/10 border border-hud-rose/30 text-hud-rose font-mono text-xs">
							SELECTED: EFFECT / HAZARD HEAD
						</div>
						<div class="space-y-1">
							<label for="effect-input" class="block text-[10px] font-mono text-gray-500 uppercase">System Hazard Effect</label>
							<textarea 
								id="effect-input"
								bind:value={effect} 
								rows="4"
								class="w-full bg-bg-darker border border-border-subtle focus:border-hud-cyan p-2 rounded text-sm text-white focus:outline-none font-mono"
							></textarea>
						</div>
					</div>

				{:else if selectedType === 'category' && selectedCategoryKey}
					<!-- Edit Category Box -->
					<div class="space-y-4">
						<div class="p-3.5 rounded bg-hud-cyan/10 border border-hud-cyan/30 text-hud-cyan font-mono text-xs">
							SELECTED: {categoryLabels[selectedCategoryKey].toUpperCase()}
						</div>
						
						<!-- List causes in this category -->
						<div class="space-y-3">
							<span class="block text-[10px] font-mono text-gray-500 uppercase">Causes under this Category:</span>
							
							{#if categories[selectedCategoryKey].length === 0}
								<p class="text-xs text-gray-500 italic font-mono">No causes added yet.</p>
							{:else}
								<div class="space-y-1.5 max-h-[200px] overflow-y-auto pr-1">
									{#each categories[selectedCategoryKey] as item, i}
										<button 
											onclick={() => selectCause(selectedCategoryKey!, [i], item.id)}
											class="w-full text-left p-2 rounded bg-bg-darker border border-border-subtle hover:border-hud-cyan/40 text-xs font-mono text-gray-300 truncate"
										>
											{i + 1}. {item.text}
										</button>
									{/each}
								</div>
							{/if}

							<button 
								onclick={() => addCauseToCategory(selectedCategoryKey!)}
								class="w-full py-2 px-3 rounded bg-hud-cyan hover:bg-hud-cyan-dim text-bg-darker font-bold text-xs tracking-wider uppercase transition-colors"
							>
								+ Add Cause
							</button>
						</div>
					</div>

				{:else if selectedType === 'cause' && selectedNodeRef}
					<!-- Edit Cause Box -->
					<div class="space-y-4">
						<div class="p-3.5 rounded bg-hud-amber/10 border border-hud-amber/30 text-hud-amber font-mono text-xs">
							SELECTED: CAUSE NODE
						</div>

						<div class="space-y-1">
							<label for="cause-input" class="block text-[10px] font-mono text-gray-500 uppercase">Cause Text</label>
							<textarea 
								id="cause-input"
								bind:value={selectedNodeRef.text} 
								rows="3"
								class="w-full bg-bg-darker border border-border-subtle focus:border-hud-cyan p-2 rounded text-xs text-white focus:outline-none font-mono"
							></textarea>
						</div>

						<!-- Sub causes recursive checklist -->
						<div class="space-y-3 pt-2">
							<span class="block text-[10px] font-mono text-gray-500 uppercase">Sub-Causes / Details:</span>
							
							{#if selectedNodeRef.children.length === 0}
								<p class="text-xs text-gray-500 italic font-mono">No nested sub-causes.</p>
							{:else}
								<div class="space-y-2 max-h-[180px] overflow-y-auto pr-1">
									{#each selectedNodeRef.children as child, cIdx}
										<div class="flex items-center gap-2">
											<input 
												type="text" 
												bind:value={child.text}
												class="flex-1 bg-bg-darker border border-border-subtle focus:border-hud-cyan p-1.5 rounded text-xs text-white focus:outline-none"
											/>
											<button 
												onclick={() => selectedNodeRef!.children.splice(cIdx, 1)}
												class="text-hud-rose hover:text-red-400 font-bold px-1"
												title="Remove Subcause"
											>
												✕
											</button>
										</div>
									{/each}
								</div>
							{/if}

							<button 
								onclick={addSubCause}
								class="w-full py-1.5 px-3 rounded border border-hud-amber/40 hover:bg-hud-amber/10 text-hud-amber text-xs tracking-wider uppercase transition-colors"
							>
								+ Add Detail Sub-Cause
							</button>
						</div>

						<div class="pt-4 border-t border-border-subtle">
							<button 
								onclick={deleteSelectedNode}
								class="w-full py-1.5 rounded bg-hud-rose/10 border border-hud-rose/40 hover:bg-hud-rose/25 text-hud-rose font-bold text-xs tracking-wider uppercase transition-colors"
							>
								Delete Cause
							</button>
						</div>
					</div>

				{:else}
					<!-- Empty State inspector -->
					<div class="text-center py-8 space-y-2">
						<svg class="w-8 h-8 text-gray-600 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
						</svg>
						<p class="text-xs text-gray-500 font-mono">
							NO ACTIVE SELECTION
						</p>
						<p class="text-[10px] text-gray-500 leading-normal px-4">
							Click on categories at the edge or causes along the ribs to begin editing causes.
						</p>
					</div>
				{/if}
			</div>

			<!-- Quick category shortcuts list -->
			<div class="hud-card p-6 space-y-3">
				<strong class="block text-[10px] font-mono text-gray-500 uppercase">Category Quick Selector:</strong>
				<div class="grid grid-cols-1 gap-1.5 font-mono text-[10px]">
					{#each Object.entries(categoryLabels) as [key, label]}
						<button 
							onclick={() => selectCategory(key as keyof FishboneData['categories'])}
							class="w-full text-left p-1.5 rounded hover:bg-white/[0.03] text-gray-400 hover:text-hud-cyan flex justify-between items-center transition-all"
						>
							<span>{label}</span>
							<span class="text-gray-600">({categories[key as keyof FishboneData['categories']].length})</span>
						</button>
					{/each}
				</div>
			</div>
		</div>
	</div>
</div>
