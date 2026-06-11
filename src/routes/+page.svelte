<script lang="ts">
	import { userState } from '$lib/user.svelte';

	let activeTab = $state('console'); // 'console' | 'fmea' | 'fishbone' | 'glossary'
	let glossarySearch = $state('');

	// Case studies & glossary data
	const glossaryTerms = [
		{
			term: 'FMEA / FMECA',
			definition: 'Failure Mode and Effects Analysis / Failure Mode, Effects and Criticality Analysis. A systematic procedure in aviation maintenance and engineering to identify potential failure modes, assess their severity, occurrence probability, and detectability, and prioritize corrective actions.',
			aviationContext: 'Mandatory under FAA/EASA certification procedures (Part 25) for airworthiness approval of safety-critical systems.'
		},
		{
			term: 'RPN (Risk Priority Number)',
			definition: 'The product of Severity (S), Occurrence (O), and Detectability (D) ratings. RPN = S × O × D. Used to rank risk and determine whether further safety actions (redesign, redundant loops) are required.',
			aviationContext: 'Aviation severity scales place catastrophic failures at 10 (aircraft loss), meaning any catastrophic failure mode requires extremely low occurrence (O=1) to pass airworthiness requirements.'
		},
		{
			term: 'MSG-3 (Maintenance Steering Group 3)',
			definition: 'A logic-based, reliability-centered maintenance (RCM) assessment method used to develop initial scheduled maintenance tasks for new aircraft.',
			aviationContext: 'Used by Boeing, Airbus, and other OEMs to draft the Maintenance Planning Document (MPD) for aircraft types like the 737 Max or A350.'
		},
		{
			term: 'MTBF (Mean Time Between Failures)',
			definition: 'The predicted elapsed time between inherent failures of a system during operation. MTBF = Total Operating Hours / Number of Failures.',
			aviationContext: 'A critical metric for dispatch reliability. Maintained in the Component Maintenance Manual (CMM).'
		},
		{
			term: 'Fail-Safe',
			definition: 'A design property which, in the event of a failure, causes the system to revert to a safe mode of operation or remain controllable.',
			aviationContext: 'Dual-hydraulic circuits in control surfaces: if hydraulic system A fails, system B maintains mechanical flight controls.'
		},
		{
			term: 'Redundancy',
			definition: 'The duplication of critical components or functions of a system with the intention of increasing reliability of the system.',
			aviationContext: 'Triplicate Flight Control Computers (FCC) in fly-by-wire aircraft (e.g., Airbus A320) acting in an active-standby voting configuration.'
		},
		{
			term: 'EICAS / ECAM',
			definition: 'Engine Indicating and Crew Alerting System / Electronic Centralised Aircraft Monitor. Glass cockpit warning systems that continuously monitor systems and alert the crew to failure modes.',
			aviationContext: 'A primary factor in Detectability (D) ratings. Automatic EICAS fault warning reduces D rating from 8 (hidden) to 1 (immediate warning).'
		}
	];

	let filteredGlossary = $derived(
		glossaryTerms.filter(t => 
			t.term.toLowerCase().includes(glossarySearch.toLowerCase()) || 
			t.definition.toLowerCase().includes(glossarySearch.toLowerCase())
		)
	);
</script>

<div class="space-y-8 animate-fade-in">
	<!-- Hero Section / Header Banner -->
	<div class="relative rounded-2xl overflow-hidden border border-hud-cyan/25 bg-gradient-to-r from-bg-dark to-bg-darker p-8 md:p-12">
		<div class="absolute top-0 right-0 w-96 h-96 bg-hud-cyan/5 rounded-full blur-3xl -z-10"></div>
		<div class="max-w-3xl space-y-4">
			<div class="inline-flex items-center space-x-2 px-3 py-1 rounded-full border border-hud-cyan/30 bg-hud-cyan/15 text-xs text-hud-cyan font-mono tracking-widest uppercase">
				<span class="w-1.5 h-1.5 rounded-full bg-hud-cyan animate-ping"></span>
				<span>Aviation Reliability Command Center</span>
			</div>
			<h1 class="text-4xl md:text-5xl font-extrabold tracking-tight text-white">
				Aviation Reliability Engineering & FMEA Suite
			</h1>
			<p class="text-gray-400 text-lg">
				A light, fast tool for aeronautics students to study system safety architectures and aircraft maintenance engineers to perform real-world reliability analysis.
			</p>
		</div>
	</div>

	<!-- Cockpit Tab Selectors -->
	<div class="flex border-b border-border-subtle overflow-x-auto pb-px">
		<button 
			onclick={() => activeTab = 'console'} 
			class="px-6 py-3 border-b-2 font-mono text-xs tracking-wider uppercase transition-all whitespace-nowrap {activeTab === 'console' ? 'border-hud-cyan text-hud-cyan font-bold hud-text-glow-cyan' : 'border-transparent text-gray-500 hover:text-gray-300'}"
		>
			[01] Analyzer Console
		</button>
		<button 
			onclick={() => activeTab = 'fmea'} 
			class="px-6 py-3 border-b-2 font-mono text-xs tracking-wider uppercase transition-all whitespace-nowrap {activeTab === 'fmea' ? 'border-hud-cyan text-hud-cyan font-bold hud-text-glow-cyan' : 'border-transparent text-gray-500 hover:text-gray-300'}"
		>
			[02] FMEA Tutorial & Cases
		</button>
		<button 
			onclick={() => activeTab = 'fishbone'} 
			class="px-6 py-3 border-b-2 font-mono text-xs tracking-wider uppercase transition-all whitespace-nowrap {activeTab === 'fishbone' ? 'border-hud-cyan text-hud-cyan font-bold hud-text-glow-cyan' : 'border-transparent text-gray-500 hover:text-gray-300'}"
		>
			[03] Ishikawa / 6M+1 Tutorial
		</button>
		<button 
			onclick={() => activeTab = 'glossary'} 
			class="px-6 py-3 border-b-2 font-mono text-xs tracking-wider uppercase transition-all whitespace-nowrap {activeTab === 'glossary' ? 'border-hud-cyan text-hud-cyan font-bold hud-text-glow-cyan' : 'border-transparent text-gray-500 hover:text-gray-300'}"
		>
			[04] Aviation Glossary
		</button>
	</div>

	<!-- TAB CONTENT -->

	<!-- Tab 1: Analyzer Console -->
	{#if activeTab === 'console'}
		<div class="grid grid-cols-1 md:grid-cols-2 gap-8">
			<!-- FMEA Card -->
			<div class="hud-card p-6 flex flex-col justify-between space-y-6">
				<div class="space-y-4">
					<div class="flex items-center justify-between">
						<div class="p-3 bg-hud-cyan/15 rounded-lg border border-hud-cyan/35 text-hud-cyan">
							<svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
							</svg>
						</div>
						<span class="font-mono text-[10px] text-gray-500">SYSTEM_MODULE_01A</span>
					</div>
					<h2 class="text-2xl font-bold text-white">FMEA / FMECA Builder</h2>
					<p class="text-gray-400 text-sm leading-relaxed">
						Build safety-critical worksheets using aviation-standard Severity, Occurrence, and Detectability scales. Calculate Risk Priority Numbers (RPN) and view your system risk mapped directly onto a Severity vs Occurrence Heatmap.
					</p>
					<ul class="text-xs text-gray-500 space-y-1 list-disc list-inside">
						<li>Aeronautics S, O, D scale helper modals</li>
						<li>Visual 10x10 Criticality Matrix</li>
						<li>Export to PDF & Excel</li>
					</ul>
				</div>
				<div class="pt-4 flex items-center gap-4">
					<a href="/fmea" class="flex-1 py-2 px-4 rounded bg-hud-cyan hover:bg-hud-cyan-dim text-bg-darker font-bold text-sm tracking-wider uppercase text-center transition-colors">
						Launch Builder
					</a>
				</div>
			</div>

			<!-- Fishbone Card -->
			<div class="hud-card p-6 flex flex-col justify-between space-y-6">
				<div class="space-y-4">
					<div class="flex items-center justify-between">
						<div class="p-3 bg-hud-amber/15 rounded-lg border border-hud-amber/35 text-hud-amber">
							<svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
							</svg>
						</div>
						<span class="font-mono text-[10px] text-gray-500">SYSTEM_MODULE_01B</span>
					</div>
					<h2 class="text-2xl font-bold text-white">Ishikawa Fishbone Creator</h2>
					<p class="text-gray-400 text-sm leading-relaxed">
						Perform Root Cause Analysis (RCA) using pre-loaded Aviation 6M+1 categories: Man, Machine, Method, Material, Measurement, Mother Nature, and Management. Graphically map failure causes and sub-causes onto a clean interactive fishbone spine.
					</p>
					<ul class="text-xs text-gray-500 space-y-1 list-disc list-inside">
						<li>Aviation-centered 6M+1 structural branches</li>
						<li>Nested causes editor (expand/collapse tree)</li>
						<li>PNG & SVG canvas export</li>
					</ul>
				</div>
				<div class="pt-4 flex items-center gap-4">
					<a href="/fishbone" class="flex-1 py-2 px-4 rounded border border-hud-amber text-hud-amber hover:bg-hud-amber/10 font-bold text-sm tracking-wider uppercase text-center transition-colors">
						Launch Canvas
					</a>
				</div>
			</div>

			<!-- Auth Dashboard Callout -->
			<div class="md:col-span-2 hud-card p-6 border-hud-cyan/20 bg-hud-cyan/5 flex flex-col md:flex-row items-center justify-between gap-6">
				<div class="space-y-2 max-w-2xl">
					<h3 class="text-lg font-bold text-white flex items-center gap-2">
						<svg class="w-5 h-5 text-hud-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
						</svg>
						Cloud Persistence
					</h3>
					<p class="text-xs text-gray-400">
						{#if userState.user}
							You are logged in as <span class="text-hud-cyan font-bold">{userState.user.email}</span>. Your FMEA analyses and Fishbone diagrams are automatically sync'd to the cloud. Access them anytime from your Dashboard.
						{:else}
							Sign up for a student or engineer account to persist your reliability worksheets, save progress, and organize analyses into folders.
						{/if}
					</p>
				</div>
				<div>
					{#if userState.user}
						<a href="/dashboard" class="inline-block py-2 px-6 rounded border border-hud-cyan bg-hud-cyan/15 hover:bg-hud-cyan/25 text-hud-cyan font-semibold text-xs tracking-wider uppercase transition-colors">
							Open Dashboard
						</a>
					{:else}
						<a href="/register" class="inline-block py-2 px-6 rounded bg-hud-cyan hover:bg-hud-cyan-dim text-bg-darker font-bold text-xs tracking-wider uppercase transition-colors">
							Create Free Account
						</a>
					{/if}
				</div>
			</div>
		</div>

	<!-- Tab 2: FMEA Tutorial & Cases -->
	{:else if activeTab === 'fmea'}
		<div class="space-y-8 max-w-4xl mx-auto">
			<div class="hud-card p-6 space-y-4">
				<h2 class="text-xl font-bold text-hud-cyan flex items-center gap-2 font-mono">
					<span>[GUIDE]</span> Failure Mode and Effects Analysis (FMEA)
				</h2>
				<p class="text-gray-300 text-sm leading-relaxed">
					FMEA is a structured analytical tool used by aviation manufacturers and maintenance teams to systematically assess and mitigate risks.
				</p>
				<div class="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
					<div class="p-4 rounded bg-bg-darker border border-border-subtle">
						<span class="text-xs font-mono text-hud-rose block mb-1">STEP 1: SEVERITY (S)</span>
						<p class="text-xs text-gray-400">Evaluate the consequences of the failure mode on aircraft safety, passenger comfort, and structural airworthiness. Aviation ranges from 1 (No operational effect) to 10 (Catastrophic - Aircraft Loss).</p>
					</div>
					<div class="p-4 rounded bg-bg-darker border border-border-subtle">
						<span class="text-xs font-mono text-hud-amber block mb-1">STEP 2: OCCURRENCE (O)</span>
						<p class="text-xs text-gray-400">Estimate the probability that the failure will occur during the aircraft's lifecycle or flight hours. Ranges from 1 (Extremely improbable, &lt;10⁻⁹/fh) to 10 (Frequent, &gt;10⁻²/fh).</p>
					</div>
					<div class="p-4 rounded bg-bg-darker border border-border-subtle">
						<span class="text-xs font-mono text-hud-cyan block mb-1">STEP 3: DETECTABILITY (D)</span>
						<p class="text-xs text-gray-400">Assess the likelihood of detecting the failure before it results in a system hazard. Automatic EICAS warnings rate 1 (Certain detection); hidden failures with no check rate 10 (Almost impossible).</p>
					</div>
				</div>
				<div class="p-3 bg-hud-cyan/10 rounded border border-hud-cyan/30 text-xs text-hud-cyan font-mono text-center">
					RISK PRIORITY NUMBER (RPN) = SEVERITY × OCCURRENCE × DETECTABILITY
				</div>
			</div>

			<!-- FMEA Worked Case Study -->
			<div class="hud-card p-6 space-y-6">
				<div class="border-b border-border-subtle pb-4 flex items-center justify-between">
					<h3 class="text-lg font-bold text-white font-mono">[CASE_STUDY_01] Boeing 737 Landing Gear System Failure</h3>
					<span class="text-xs px-2.5 py-0.5 rounded border border-hud-rose/40 bg-hud-rose/15 text-hud-rose uppercase tracking-widest font-mono font-semibold">Catastrophic Risk</span>
				</div>
				<p class="text-sm text-gray-400 leading-relaxed">
					This worked case study illustrates how the main landing gear retraction actuator hydraulic seal degradation is modeled in an aviation FMECA.
				</p>

				<div class="overflow-x-auto">
					<table class="w-full text-left font-mono text-xs border-collapse">
						<thead>
							<tr class="border-b border-gray-700 bg-bg-darker text-gray-300">
								<th class="p-3">Component / Function</th>
								<th class="p-3">Failure Mode</th>
								<th class="p-3">Failure Cause</th>
								<th class="p-3">S</th>
								<th class="p-3">O</th>
								<th class="p-3">D</th>
								<th class="p-3 text-hud-cyan">RPN</th>
								<th class="p-3">Aviation Mitigation</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-border-subtle text-gray-400">
							<tr>
								<td class="p-3 font-semibold text-white">Retraction Actuator Cylinders</td>
								<td class="p-3">Actuator cylinder hydraulic seal blowout.</td>
								<td class="p-3">O-ring friction wear & thermal cycling degradation.</td>
								<td class="p-3 text-hud-rose font-bold">9</td>
								<td class="p-3">3</td>
								<td class="p-3">4</td>
								<td class="p-3 text-hud-cyan font-bold">108</td>
								<td class="p-3">Implement a dual-redundant mechanical uplock system. Standard flight crew checklist directs mechanical emergency gravity extension.</td>
							</tr>
							<tr>
								<td class="p-3 font-semibold text-white">Nose Gear Locking Pin</td>
								<td class="p-3">Failure to lock in down position.</td>
								<td class="p-3">Corrosion or grease freeze due to low high-altitude temperatures.</td>
								<td class="p-3 text-hud-rose font-bold">8</td>
								<td class="p-3">2</td>
								<td class="p-3">2</td>
								<td class="p-3 text-hud-cyan font-bold">32</td>
								<td class="p-3">EICAS "NOSE GEAR UNLOCKED" warning panel. Periodic maintenance task to lubricate hinge mechanisms (every A-check).</td>
							</tr>
						</tbody>
					</table>
				</div>
				
				<div class="p-4 rounded bg-bg-darker border border-border-subtle space-y-2">
					<h4 class="text-xs font-bold text-white font-mono">Engineering Assessment:</h4>
					<p class="text-xs text-gray-400 leading-relaxed">
						Even though "Seal Blowout" has a Severity of 9 (Hazardous - partial control loss if gear jams, heavy landing), the RPN is kept at 108 through excellent Detectability (crew warning lights and sensory feedback, D=4) and low Occurrence (O=3, high-grade aeronautical synthetic rubbers). The inclusion of a gravity emergency drop bypass ensures that a complete actuator lock loss remains extremely improbable.
					</p>
				</div>
			</div>
		</div>

	<!-- Tab 3: Ishikawa / 6M+1 Tutorial -->
	{:else if activeTab === 'fishbone'}
		<div class="space-y-8 max-w-4xl mx-auto">
			<div class="hud-card p-6 space-y-4">
				<h2 class="text-xl font-bold text-hud-amber flex items-center gap-2 font-mono">
					<span>[GUIDE]</span> Root Cause Analysis & The 6M+1 Fishbone
				</h2>
				<p class="text-gray-300 text-sm leading-relaxed">
					The Ishikawa (Fishbone) diagram acts as a structured cause-and-effect visualization. In aviation maintenance engineering, we adapt the traditional 6M framework into a highly detailed **6M+1** layout to ensure flight operations and organizational factors are not ignored.
				</p>
				<div class="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
					<div class="p-3 rounded bg-bg-darker border border-border-subtle text-xs">
						<strong class="text-hud-cyan block mb-1">1. MAN</strong>
						Flight crew, maintenance engineers, ATC operators, or dispatch handlers.
					</div>
					<div class="p-3 rounded bg-bg-darker border border-border-subtle text-xs">
						<strong class="text-hud-cyan block mb-1">2. MACHINE</strong>
						The airframe, avionics systems, turbofan engines, or hydraulic lines.
					</div>
					<div class="p-3 rounded bg-bg-darker border border-border-subtle text-xs">
						<strong class="text-hud-cyan block mb-1">3. METHOD</strong>
						SOPs, Aircraft Maintenance Manuals (AMM), checklist flowcharts, FAA circulars.
					</div>
					<div class="p-3 rounded bg-bg-darker border border-border-subtle text-xs">
						<strong class="text-hud-cyan block mb-1">4. MATERIAL</strong>
						Aviation fuels, turbine oils, spare parts, sealing gaskets, wiring harnesses.
					</div>
					<div class="p-3 rounded bg-bg-darker border border-border-subtle text-xs">
						<strong class="text-hud-cyan block mb-1">5. MEASUREMENT</strong>
						Cockpit telemetry, pressure gauges, diagnostic calibration, multimeters.
					</div>
					<div class="p-3 rounded bg-bg-darker border border-border-subtle text-xs">
						<strong class="text-hud-cyan block mb-1">6. MOTHER NATURE</strong>
						Severe turbulence, icing, extreme cold, volcanic ash, microbursts.
					</div>
					<div class="p-3 rounded bg-bg-darker border border-border-subtle text-xs">
						<strong class="text-hud-cyan block mb-1">7. MANAGEMENT</strong>
						Safety culture, scheduling pressures, training programs, QA oversight.
					</div>
					<div class="p-3 border border-dashed border-hud-amber/30 rounded flex items-center justify-center text-center text-[10px] text-hud-amber font-mono font-bold leading-normal">
						+1 EFFECT (THE HEAD)<br>THE SYSTEM FAULT
					</div>
				</div>
			</div>

			<!-- Ishikawa Worked Case Study -->
			<div class="hud-card p-6 space-y-6">
				<div class="border-b border-border-subtle pb-4 flex items-center justify-between">
					<h3 class="text-lg font-bold text-white font-mono">[CASE_STUDY_02] Turbofan Engine Compressor Stall</h3>
					<span class="text-xs px-2.5 py-0.5 rounded border border-hud-amber/40 bg-hud-amber/15 text-hud-amber uppercase tracking-widest font-mono font-semibold">Incident Analysis</span>
				</div>
				<p class="text-sm text-gray-400 leading-relaxed">
					A compressor stall occurred during takeoff climb. The Ishikawa diagram below models how the 6M+1 categories helped identify the root causes.
				</p>

				<div class="space-y-4">
					<div class="border border-hud-cyan/20 rounded-lg overflow-hidden bg-bg-darker p-4 font-mono text-xs">
						<div class="font-bold text-hud-cyan mb-2">6M+1 Cause Breakdown for Engine Stall:</div>
						<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div class="space-y-2">
								<div>
									<span class="text-hud-amber font-bold">● MACHINE (Jet Engine):</span>
									<ul class="list-disc list-inside pl-2 text-gray-400">
										<li>Variable Stator Vane (VSV) actuator linkage was slightly stiff.</li>
										<li>Turbine blade tip clearance exceeding limits.</li>
									</ul>
								</div>
								<div>
									<span class="text-hud-amber font-bold">● METHOD (Procedures):</span>
									<ul class="list-disc list-inside pl-2 text-gray-400">
										<li>AMM lubrication task interval was set too long.</li>
										<li>No standard telemetry analysis for pre-takeoff exhaust temperature shifts.</li>
									</ul>
								</div>
								<div>
									<span class="text-hud-amber font-bold">● MAN (Maintenance Tech):</span>
									<ul class="list-disc list-inside pl-2 text-gray-400">
										<li>Lubrication was skipped during the last A-check due to shift handover lapse.</li>
									</ul>
								</div>
							</div>

							<div class="space-y-2">
								<div>
									<span class="text-hud-amber font-bold">● MOTHER NATURE (Environment):</span>
									<ul class="list-disc list-inside pl-2 text-gray-400">
										<li>Atmospheric icing conditions during takeoff roll.</li>
										<li>High gust wind shear.</li>
									</ul>
								</div>
								<div>
									<span class="text-hud-amber font-bold">● MATERIAL (Consumables):</span>
									<ul class="list-disc list-inside pl-2 text-gray-400">
										<li>Lubricant used was a generic non-aviation grade grease (warehouse sorting error).</li>
									</ul>
								</div>
								<div>
									<span class="text-hud-amber font-bold">● MANAGEMENT (Organization):</span>
									<ul class="list-disc list-inside pl-2 text-gray-400">
										<li>Overscheduled maintenance queue causing mechanic fatigue.</li>
										<li>Lack of QA inspector verification on night shifts.</li>
									</ul>
								</div>
							</div>
						</div>
					</div>
				</div>

				<div class="p-4 rounded bg-bg-darker border border-border-subtle">
					<h4 class="text-xs font-bold text-white font-mono mb-1">Root Cause Summary:</h4>
					<p class="text-xs text-gray-400 leading-relaxed">
						The stall was not caused by a single mechanical fault, but a combination of **stiff VSV linkages (Machine)** caused by **improper grease (Material)** and a **skipped maintenance step (Man)** due to **fatigue and organizational scheduling pressures (Management)** under **severe weather icing (Mother Nature)**.
					</p>
				</div>
			</div>
		</div>

	<!-- Tab 4: Glossary -->
	{:else if activeTab === 'glossary'}
		<div class="max-w-4xl mx-auto space-y-6">
			<!-- Search Bar -->
			<div class="relative">
				<svg class="absolute left-3 top-3 w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
				</svg>
				<input 
					type="text" 
					placeholder="Search reliability terms (e.g. MTBF, RPN, ECAM)..." 
					bind:value={glossarySearch}
					class="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border-subtle bg-bg-panel text-white focus:outline-none focus:border-hud-cyan transition-colors font-mono text-sm"
				/>
			</div>

			<!-- Glossary Terms List -->
			<div class="space-y-4">
				{#each filteredGlossary as item}
					<div class="hud-card p-5 space-y-2">
						<div class="flex items-center justify-between border-b border-border-subtle pb-2">
							<h3 class="text-base font-bold text-hud-cyan font-mono">{item.term}</h3>
							<span class="font-mono text-[9px] text-gray-500 uppercase tracking-widest">Reliability Domain</span>
						</div>
						<p class="text-sm text-gray-300 leading-relaxed">{item.definition}</p>
						<div class="pt-2 flex gap-2">
							<span class="text-[10px] font-mono text-hud-amber font-semibold uppercase tracking-wider">Aviation Context:</span>
							<p class="text-xs text-gray-400 italic flex-1">{item.aviationContext}</p>
						</div>
					</div>
				{:else}
					<div class="text-center py-12 text-gray-500 font-mono text-xs border border-dashed border-border-subtle rounded-lg">
						NO GLOSSARY ENTRIES MATCHED YOUR QUERY
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>
