<script lang="ts">
	import { userState } from '$lib/user.svelte';
	import { onMount } from 'svelte';

	// Filters State
	let startDate = $state('');
	let endDate = $state('');
	
	// Analytics Data State
	let loading = $state(true);
	let errorMsg = $state('');
	let data = $state<any>(null);

	// Fetch function
	async function fetchAnalytics() {
		loading = true;
		errorMsg = '';
		try {
			let url = '/api/v1/analytics/summary';
			const params = new URLSearchParams();
			if (startDate) params.append('startDate', startDate);
			if (endDate) params.append('endDate', endDate);
			
			const queryString = params.toString();
			if (queryString) {
				url += `?${queryString}`;
			}

			const res = await fetch(url);
			const json = await res.json();
			if (json.success) {
				data = json.data;
			} else {
				errorMsg = json.error || 'Failed to fetch analytics summary.';
			}
		} catch (err: any) {
			errorMsg = 'Network error fetching analytics data.';
		} finally {
			loading = false;
		}
	}

	onMount(async () => {
		// Wait for user loading to resolve
		if (!userState.user && !userState.loading) {
			loading = false;
			return;
		}
		await fetchAnalytics();
	});

	// Date filter submit
	function applyFilters(e: Event) {
		e.preventDefault();
		fetchAnalytics();
	}

	function resetFilters() {
		startDate = '';
		endDate = '';
		fetchAnalytics();
	}

	// SVG Line Chart Coordinate Generator
	function getLinePoints(trends: any[], key: string, width: number, height: number, padding: number) {
		if (!trends || trends.length === 0) return '';
		
		const maxVal = Math.max(...trends.map(t => Number(t[key]) || 0), 5); // Fallback to 5 to avoid divide by zero
		const stepX = (width - padding * 2) / (trends.length - 1);
		
		return trends.map((t, idx) => {
			const x = padding + idx * stepX;
			const val = Number(t[key]) || 0;
			const y = height - padding - (val / maxVal) * (height - padding * 2);
			return `${x},${y}`;
		}).join(' ');
	}

	// SVG Area Coordinate Generator
	function getAreaPoints(trends: any[], key: string, width: number, height: number, padding: number) {
		if (!trends || trends.length === 0) return '';
		
		const points = getLinePoints(trends, key, width, height, padding);
		if (!points) return '';
		
		const firstX = padding;
		const lastX = padding + (trends.length - 1) * ((width - padding * 2) / (trends.length - 1));
		const baseY = height - padding;
		
		return `${firstX},${baseY} ${points} ${lastX},${baseY}`;
	}

	// CSV Export
	function exportCSV() {
		if (!data) return;
		
		let csvContent = 'data:text/csv;charset=utf-8,';
		
		// 1. Summary Section
		csvContent += 'AERORELIABILITY SUITE - COMPLIANCE & SAFETY ANALYTICS REPORT\r\n';
		csvContent += `Generated: ${new Date().toISOString()}\r\n`;
		csvContent += `Filters: Start=${startDate || 'None'}, End=${endDate || 'None'}\r\n\r\n`;
		
		csvContent += 'SUMMARY METRICS\r\n';
		csvContent += `Total Analyses,${data.summary.totalAnalyses}\r\n`;
		csvContent += `Approved Documents,${data.summary.approvedCount}\r\n`;
		csvContent += `Draft Documents,${data.summary.draftCount}\r\n`;
		csvContent += `Overdue Reviews,${data.summary.overdueCount}\r\n`;
		csvContent += `Compliance Rate %,${data.summary.complianceRate}\r\n\r\n`;

		// 2. Trends Section
		csvContent += 'DOCUMENT CREATION TRENDS\r\n';
		csvContent += 'Month,FMEA Created,Ishikawa Created\r\n';
		data.docTrends.forEach((t: any) => {
			csvContent += `${t.month},${t.fmea},${t.fishbone}\r\n`;
		});
		csvContent += '\r\n';

		// 3. RPN Trends Section
		csvContent += 'AVERAGE RPN TRENDS\r\n';
		csvContent += 'Month,Average RPN\r\n';
		data.rpnTrends.forEach((t: any) => {
			csvContent += `${t.month},${t.avgRpn}\r\n`;
		});
		csvContent += '\r\n';

		// 4. Fishbone Categories Section
		csvContent += 'FISHBONE CAUSE CATEGORY DISTRIBUTION\r\n';
		csvContent += 'Category,Cause Count\r\n';
		data.fishboneCategories.forEach((c: any) => {
			csvContent += `"${c.category}",${c.count}\r\n`;
		});
		csvContent += '\r\n';

		// 5. Top 10 Failure Modes Section
		csvContent += 'TOP 10 CRITICAL FAILURE MODES\r\n';
		csvContent += 'Index,Document,Component/System,Failure Mode,Severity (S),Occurrence (O),Criticality (SxO),RPN\r\n';
		data.topFailureModes.forEach((f: any, idx: number) => {
			csvContent += `${idx + 1},"${f.title}","${f.item}","${f.mode}",${f.s},${f.o},${f.s * f.o},${f.rpn}\r\n`;
		});

		const encodedUri = encodeURI(csvContent);
		const link = document.createElement('a');
		link.setAttribute('href', encodedUri);
		link.setAttribute('download', `AeroReliability_Safety_Report_${new Date().toISOString().substring(0, 10)}.csv`);
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	}

	// PDF Export via jsPDF & AutoTable
	async function exportPDF() {
		if (!data) return;
		const { jsPDF } = await import('jspdf');
		const { default: autoTable } = await import('jspdf-autotable');

		const doc = new jsPDF('p', 'mm', 'a4'); // Portrait A4
		
		// Header
		doc.setFillColor(15, 20, 32);
		doc.rect(0, 0, 210, 26, 'F');

		doc.setTextColor(255, 255, 255);
		doc.setFont('helvetica', 'bold');
		doc.setFontSize(15);
		doc.text('AeroReliability Safety Compliance & Analytics Dashboard', 12, 11);
		
		doc.setFont('helvetica', 'normal');
		doc.setFontSize(8);
		doc.text(`Generated: ${new Date().toUTCString()} UTC`, 12, 17);
		doc.text(`Date Filters: ${startDate || 'ALL'} to ${endDate || 'ALL'}`, 12, 21);

		// Section: Summary Metrics
		doc.setTextColor(15, 20, 32);
		doc.setFont('helvetica', 'bold');
		doc.setFontSize(11);
		doc.text('1. System Safety & Compliance Overview', 12, 34);

		const summaryHeaders = [['Metric Description', 'Value']];
		const summaryBody = [
			['Total Reliability Workbooks Created', data.summary.totalAnalyses.toString()],
			['Approved & Electronically Signed Documents', data.summary.approvedCount.toString()],
			['Pending Approval (Draft Workbooks)', data.summary.draftCount.toString()],
			['Overdue Compliance Reviews (Exceeded Interval)', data.summary.overdueCount.toString()],
			['Regulatory Compliance Rate (%)', `${data.summary.complianceRate}%`]
		];

		autoTable(doc, {
			startY: 37,
			head: summaryHeaders,
			body: summaryBody,
			theme: 'grid',
			headStyles: { fillColor: [22, 28, 45], textColor: [0, 240, 255], fontSize: 9 },
			styles: { fontSize: 8, textColor: [50, 50, 50] }
		});

		// Section: Top 10 failure modes
		let finalY = (doc as any).lastAutoTable.finalY + 10;
		doc.setTextColor(15, 20, 32);
		doc.setFont('helvetica', 'bold');
		doc.setFontSize(11);
		doc.text('2. Top 10 Critical Failure Modes (Sorted by Severity x Occurrence)', 12, finalY);

		const modesHeaders = [['#', 'Aero System', 'Component / Function', 'Failure Mode', 'S', 'O', 'SxO', 'RPN']];
		const modesBody = data.topFailureModes.map((f: any, i: number) => [
			i + 1,
			f.title.length > 25 ? f.title.substring(0, 23) + '...' : f.title,
			f.item,
			f.mode,
			f.s.toString(),
			f.o.toString(),
			(f.s * f.o).toString(),
			f.rpn.toString()
		]);

		autoTable(doc, {
			startY: finalY + 3,
			head: modesHeaders,
			body: modesBody,
			theme: 'grid',
			headStyles: { fillColor: [22, 28, 45], textColor: [0, 240, 255], fontSize: 8 },
			styles: { fontSize: 7, textColor: [50, 50, 50] },
			columnStyles: {
				4: { halign: 'center', fontStyle: 'bold' },
				5: { halign: 'center', fontStyle: 'bold' },
				6: { halign: 'center', fontStyle: 'bold', textColor: [220, 50, 50] },
				7: { halign: 'center', fontStyle: 'bold' }
			}
		});

		// Add page 2 for trends and fishbone counts
		doc.addPage();
		doc.setFillColor(15, 20, 32);
		doc.rect(0, 0, 210, 15, 'F');
		doc.setTextColor(255, 255, 255);
		doc.setFont('helvetica', 'bold');
		doc.setFontSize(10);
		doc.text('AeroReliability safety compliance - Safety Trends & Distributions', 12, 10);

		// Section: Ishikawa Categories
		doc.setTextColor(15, 20, 32);
		doc.setFont('helvetica', 'bold');
		doc.setFontSize(11);
		doc.text('3. Root Cause Analysis - Ishikawa 6M+1 Category Counts', 12, 24);

		const fishboneHeaders = [['6M+1 Quality Category', 'Identified Failure Causes Count']];
		const fishboneBody = data.fishboneCategories.map((c: any) => [c.category, c.count.toString()]);

		autoTable(doc, {
			startY: 27,
			head: fishboneHeaders,
			body: fishboneBody,
			theme: 'grid',
			headStyles: { fillColor: [22, 28, 45], textColor: [255, 170, 0], fontSize: 8 },
			styles: { fontSize: 8, textColor: [50, 50, 50] }
		});

		// Section: Monthly Trends
		finalY = (doc as any).lastAutoTable.finalY + 10;
		doc.setTextColor(15, 20, 32);
		doc.setFont('helvetica', 'bold');
		doc.setFontSize(11);
		doc.text('4. Historical Monthly Activity & RPN Progression', 12, finalY);

		const trendsHeaders = [['Month', 'FMEA Created', 'Ishikawa Created', 'Average FMEA RPN']];
		const trendsBody = data.docTrends.map((t: any, idx: number) => [
			t.month,
			t.fmea.toString(),
			t.fishbone.toString(),
			data.rpnTrends[idx] ? data.rpnTrends[idx].avgRpn.toString() : '0'
		]);

		autoTable(doc, {
			startY: finalY + 3,
			head: trendsHeaders,
			body: trendsBody,
			theme: 'grid',
			headStyles: { fillColor: [22, 28, 45], textColor: [0, 240, 255], fontSize: 8 },
			styles: { fontSize: 8, textColor: [50, 50, 50] }
		});

		doc.save(`AeroReliability_Safety_Compliance_${new Date().toISOString().substring(0, 10)}.pdf`);
	}
</script>

<svelte:head>
	<title>Analytics & FAA/EASA Compliance - AeroReliability</title>
</svelte:head>

{#if userState.loading || (loading && !data)}
	<div class="flex-1 flex flex-col items-center justify-center space-y-4 py-12">
		<div class="w-8 h-8 rounded-full border-2 border-hud-cyan/20 border-t-hud-cyan animate-spin"></div>
		<span class="font-mono text-xs text-gray-500">AGGREGATING_RELIABILITY_SAFETY_DATA...</span>
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
					You must authenticate to access the Safety & Compliance Analytics Dashboard.
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
	<div class="space-y-6 pb-12">
		<!-- Dashboard Header -->
		<div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-border-subtle pb-4">
			<div>
				<div class="flex items-center gap-3">
					<a href="/dashboard" class="text-xs font-mono text-hud-cyan hover:underline">
						&larr; Back to Dashboard
					</a>
					<span class="text-gray-600">/</span>
					<span class="text-xs font-mono text-gray-400">Compliance Analytics</span>
				</div>
				<h1 class="text-2xl font-bold text-white font-mono flex items-center gap-2 mt-1">
					<span class="w-2.5 h-2.5 rounded bg-hud-rose animate-pulse"></span>
					FAA / EASA Safety Compliance Center
				</h1>
				<p class="text-xs text-gray-400 font-mono mt-0.5">
					AERO_RELIABILITY_SUITE // SYSTEM_SAFETY_MONITOR
				</p>
			</div>

			<!-- Action buttons -->
			<div class="flex flex-wrap items-center gap-3">
				<button 
					onclick={exportCSV} 
					class="py-2 px-4 rounded border border-border-subtle text-gray-300 hover:text-hud-amber hover:border-hud-amber/40 text-xs font-mono font-bold tracking-wider uppercase transition-colors"
				>
					Export CSV
				</button>
				<button 
					onclick={exportPDF} 
					class="py-2 px-4 rounded bg-hud-cyan hover:bg-hud-cyan-dim text-bg-darker font-bold text-xs tracking-wider uppercase transition-colors"
				>
					Generate Audit PDF
				</button>
			</div>
		</div>

		<!-- Date Filter Form -->
		<form onsubmit={applyFilters} class="hud-card p-4 flex flex-wrap items-end gap-4">
			<div class="space-y-1">
				<label for="start-date" class="block text-[9px] font-mono text-gray-500 uppercase">Analysis Since</label>
				<input 
					id="start-date"
					type="date" 
					bind:value={startDate}
					class="bg-bg-darker border border-border-subtle focus:border-hud-cyan p-2 rounded text-xs text-white focus:outline-none font-mono"
				/>
			</div>
			<div class="space-y-1">
				<label for="end-date" class="block text-[9px] font-mono text-gray-500 uppercase">Analysis Until</label>
				<input 
					id="end-date"
					type="date" 
					bind:value={endDate}
					class="bg-bg-darker border border-border-subtle focus:border-hud-cyan p-2 rounded text-xs text-white focus:outline-none font-mono"
				/>
			</div>
			<div class="flex gap-2">
				<button 
					type="submit"
					class="py-2 px-4 rounded bg-hud-cyan hover:bg-hud-cyan-dim text-bg-darker font-bold text-xs uppercase tracking-wider transition-colors font-mono"
				>
					Filter
				</button>
				<button 
					type="button"
					onclick={resetFilters}
					class="py-2 px-4 rounded border border-border-subtle text-gray-400 hover:text-white text-xs uppercase tracking-wider transition-colors font-mono"
				>
					Reset
				</button>
			</div>
		</form>

		{#if errorMsg}
			<div class="p-3 rounded border border-hud-rose bg-hud-rose/10 text-hud-rose text-xs font-mono">
				{errorMsg}
			</div>
		{/if}

		{#if data}
			<!-- KPI Overview Cards -->
			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
				<!-- Compliance Circular Gauge -->
				<div class="hud-card p-5 flex items-center justify-between gap-4">
					<div class="space-y-1">
						<label class="block text-[9px] font-mono text-gray-500 uppercase tracking-widest">Compliance Rate</label>
						<span class="text-2xl font-bold text-white font-mono block">
							{data.summary.complianceRate}%
						</span>
						<p class="text-[9px] font-mono text-gray-400">Reviewed on interval</p>
					</div>
					<!-- SVG Gauge -->
					<div class="relative w-16 h-16">
						<svg class="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
							<!-- Background Circle -->
							<path
								class="text-gray-800"
								stroke="currentColor"
								stroke-width="3.5"
								fill="none"
								d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
							/>
							<!-- Foreground Circle -->
							<path
								class={data.summary.complianceRate >= 90 ? 'text-hud-emerald' : data.summary.complianceRate >= 75 ? 'text-hud-amber' : 'text-hud-rose'}
								stroke="currentColor"
								stroke-width="3.5"
								stroke-dasharray="{data.summary.complianceRate}, 100"
								stroke-linecap="round"
								fill="none"
								d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
							/>
						</svg>
						<div class="absolute inset-0 flex items-center justify-center text-[10px] font-bold font-mono text-gray-400">
							SMS
						</div>
					</div>
				</div>

				<!-- Total Documents -->
				<div class="hud-card p-5 space-y-2">
					<label class="block text-[9px] font-mono text-gray-500 uppercase tracking-widest">Total Active Studies</label>
					<span class="text-2xl font-bold text-white font-mono block">
						{data.summary.totalAnalyses}
					</span>
					<div class="flex items-center gap-3 text-[9px] font-mono text-gray-400">
						<span class="text-hud-cyan">FMEA: {data.docTrends.reduce((sum: number, t: any) => sum + t.fmea, 0)}</span>
						<span class="text-hud-amber">Ishikawa: {data.docTrends.reduce((sum: number, t: any) => sum + t.fishbone, 0)}</span>
					</div>
				</div>

				<!-- Signed Approved -->
				<div class="hud-card p-5 space-y-2">
					<label class="block text-[9px] font-mono text-gray-500 uppercase tracking-widest">Approved Baselines</label>
					<span class="text-2xl font-bold text-hud-emerald font-mono block">
						{data.summary.approvedCount}
					</span>
					<p class="text-[9px] font-mono text-gray-400">Signed off by Safety Analysts</p>
				</div>

				<!-- Overdue Reviews Warning -->
				<div class="hud-card p-5 space-y-2 {data.summary.overdueCount > 0 ? 'border-hud-rose/40 shadow-[0_0_15px_rgba(255,51,102,0.05)]' : ''}">
					<label class="block text-[9px] font-mono text-gray-500 uppercase tracking-widest">Compliance Warnings</label>
					<span class="text-2xl font-bold font-mono block {data.summary.overdueCount > 0 ? 'text-hud-rose animate-pulse' : 'text-white'}">
						{data.summary.overdueCount}
					</span>
					<p class="text-[9px] font-mono text-gray-400">
						{data.summary.overdueCount > 0 ? 'Requires immediate action & sign-off' : 'All reviews current'}
					</p>
				</div>
			</div>

			<!-- Main Chart Grid -->
			<div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
				<!-- Chart 1: Monthly Trends -->
				<div class="hud-card p-6 space-y-4">
					<div>
						<h3 class="text-sm font-bold text-white font-mono flex items-center gap-1.5">
							<span class="w-1.5 h-1.5 rounded-full bg-hud-cyan"></span>
							Monthly Document Creation Trends
						</h3>
						<p class="text-[9px] text-gray-500 font-mono mt-0.5">FMEA VS ISHIKAWA CREATION OVER TIME</p>
					</div>

					<!-- SVG Line Chart -->
					<div class="relative pt-4 w-full h-[220px]">
						<svg class="w-full h-full" viewBox="0 0 500 200" preserveAspectRatio="none">
							<!-- Background Grid -->
							<line x1="40" y1="20" x2="480" y2="20" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>
							<line x1="40" y1="60" x2="480" y2="60" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>
							<line x1="40" y1="100" x2="480" y2="100" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>
							<line x1="40" y1="140" x2="480" y2="140" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>
							<line x1="40" y1="180" x2="480" y2="180" stroke="rgba(255,255,255,0.1)" stroke-width="1.5"/>

							<!-- X & Y Axes -->
							<line x1="40" y1="20" x2="40" y2="180" stroke="rgba(255,255,255,0.1)" stroke-width="1.5"/>

							<!-- Line Plots -->
							{#if data.docTrends && data.docTrends.length > 0}
								<!-- FMEA Area -->
								<polygon 
									points={getAreaPoints(data.docTrends, 'fmea', 500, 200, 40)}
									fill="rgba(0, 240, 255, 0.05)"
								/>
								<!-- Fishbone Area -->
								<polygon 
									points={getAreaPoints(data.docTrends, 'fishbone', 500, 200, 40)}
									fill="rgba(255, 170, 0, 0.05)"
								/>

								<!-- FMEA Line -->
								<polyline 
									fill="none" 
									stroke="#00f0ff" 
									stroke-width="2.5" 
									points={getLinePoints(data.docTrends, 'fmea', 500, 200, 40)}
								/>
								<!-- Fishbone Line -->
								<polyline 
									fill="none" 
									stroke="#ffaa00" 
									stroke-width="2.5" 
									points={getLinePoints(data.docTrends, 'fishbone', 500, 200, 40)}
								/>
								
								<!-- Data points circles -->
								{#each data.docTrends as t, i}
									{@const stepX = (500 - 80) / (data.docTrends.length - 1)}
									{@const x = 40 + i * stepX}
									{@const maxFmea = Math.max(...data.docTrends.map((d: any) => d.fmea), 5)}
									{@const maxFish = Math.max(...data.docTrends.map((d: any) => d.fishbone), 5)}
									
									{@const yF = 200 - 40 - (t.fmea / maxFmea) * 120}
									{@const yFi = 200 - 40 - (t.fishbone / maxFish) * 120}
									
									<!-- FMEA Dot -->
									<circle cx={x} cy={yF} r="3.5" fill="#00f0ff" stroke="#080b11" stroke-width="1.5"/>
									<!-- Fishbone Dot -->
									<circle cx={x} cy={yFi} r="3.5" fill="#ffaa00" stroke="#080b11" stroke-width="1.5"/>
								{/each}
							{/if}
						</svg>

						<!-- Axis Labels -->
						<div class="absolute bottom-0 left-[40px] right-[20px] flex justify-between font-mono text-[8px] text-gray-500 select-none">
							{#each data.docTrends as t}
								<span>{t.month.substring(5)}</span>
							{/each}
						</div>
					</div>

					<!-- Legend -->
					<div class="flex items-center justify-center gap-6 pt-2 font-mono text-[10px]">
						<div class="flex items-center gap-1.5">
							<span class="w-3 h-1.5 bg-hud-cyan rounded-full"></span>
							<span class="text-gray-300">FMEA / FMECA Worksheets</span>
						</div>
						<div class="flex items-center gap-1.5">
							<span class="w-3 h-1.5 bg-hud-amber rounded-full"></span>
							<span class="text-gray-300">Ishikawa Fishbones</span>
						</div>
					</div>
				</div>

				<!-- Chart 2: RPN Trends -->
				<div class="hud-card p-6 space-y-4">
					<div>
						<h3 class="text-sm font-bold text-white font-mono flex items-center gap-1.5">
							<span class="w-1.5 h-1.5 rounded-full bg-hud-rose"></span>
							Average Risk Priority Number (RPN) Trend
						</h3>
						<p class="text-[9px] text-gray-500 font-mono mt-0.5">TRACKING MITIGATION PERFORMANCE (CONTINUOUS RISK REDUCTION)</p>
					</div>

					<!-- SVG Line Chart with Threat Zones -->
					<div class="relative pt-4 w-full h-[220px]">
						<svg class="w-full h-full" viewBox="0 0 500 200" preserveAspectRatio="none">
							<!-- Danger/Caution/Safe Bands -->
							<!-- Red Zone (RPN >= 250) -> Y: 20 to 110 (approx) -->
							<rect x="40" y="20" width="440" height="60" fill="rgba(255, 51, 102, 0.03)"/>
							<!-- Amber Zone (100 - 250) -->
							<rect x="40" y="80" width="440" height="60" fill="rgba(255, 170, 0, 0.02)"/>
							<!-- Green Zone (0 - 100) -->
							<rect x="40" y="140" width="440" height="40" fill="rgba(0, 240, 255, 0.02)"/>

							<!-- Grid Limits -->
							<line x1="40" y1="20" x2="480" y2="20" stroke="rgba(255, 51, 102, 0.1)" stroke-width="1"/>
							<text x="485" y="23" fill="rgba(255, 51, 102, 0.6)" font-family="monospace" font-size="7" font-weight="bold">HIGH RISK</text>
							
							<line x1="40" y1="80" x2="480" y2="80" stroke="rgba(255, 170, 0, 0.1)" stroke-width="1"/>
							<text x="485" y="83" fill="rgba(255, 170, 0, 0.6)" font-family="monospace" font-size="7" font-weight="bold">CAUTION</text>

							<line x1="40" y1="140" x2="480" y2="140" stroke="rgba(0, 240, 255, 0.1)" stroke-width="1"/>
							<text x="485" y="143" fill="rgba(0, 240, 255, 0.6)" font-family="monospace" font-size="7" font-weight="bold">SAFE ZONE</text>

							<line x1="40" y1="180" x2="480" y2="180" stroke="rgba(255,255,255,0.1)" stroke-width="1.5"/>
							<line x1="40" y1="20" x2="40" y2="180" stroke="rgba(255,255,255,0.1)" stroke-width="1.5"/>

							<!-- RPN Plot Line -->
							{#if data.rpnTrends && data.rpnTrends.length > 0}
								<!-- RPN Area -->
								<polygon 
									points={getAreaPoints(data.rpnTrends, 'avgRpn', 500, 200, 40)}
									fill="rgba(255, 51, 102, 0.05)"
								/>
								<!-- RPN Line -->
								<polyline 
									fill="none" 
									stroke="#ff3366" 
									stroke-width="2.5" 
									points={getLinePoints(data.rpnTrends, 'avgRpn', 500, 200, 40)}
									class="hud-border-glow-rose"
								/>
								
								<!-- Dots -->
								{#each data.rpnTrends as t, i}
									{@const stepX = (500 - 80) / (data.rpnTrends.length - 1)}
									{@const x = 40 + i * stepX}
									{@const maxRpn = Math.max(...data.rpnTrends.map((d: any) => d.avgRpn), 100)}
									{@const y = 200 - 40 - (t.avgRpn / maxRpn) * 120}
									<circle cx={x} cy={y} r="3.5" fill="#ff3366" stroke="#080b11" stroke-width="1.5"/>
								{/each}
							{/if}
						</svg>

						<!-- Axis Labels -->
						<div class="absolute bottom-0 left-[40px] right-[20px] flex justify-between font-mono text-[8px] text-gray-500 select-none">
							{#each data.rpnTrends as t}
								<span>{t.month.substring(5)}</span>
							{/each}
						</div>
					</div>

					<div class="text-center font-mono text-[10px] text-gray-500">
						SAFETY REPORT: DOWNWARD TREND PROVES EFFICACY OF MITIGATION ACTIONS
					</div>
				</div>
			</div>

			<!-- Lower Grid: 6M+1 and Top Hazards -->
			<div class="grid grid-cols-1 xl:grid-cols-3 gap-8">
				<!-- Category Causes Distribution (1/3 width) -->
				<div class="xl:col-span-1 hud-card p-6 space-y-6">
					<div>
						<h3 class="text-sm font-bold text-white font-mono flex items-center gap-1.5">
							<span class="w-1.5 h-1.5 rounded-full bg-hud-amber"></span>
							Ishikawa Category Breakdown
						</h3>
						<p class="text-[9px] text-gray-500 font-mono mt-0.5">6M+1 SYSTEM COMPONENT CRITIQUE COUNTS</p>
					</div>

					<!-- Horizontal Bar Chart -->
					<div class="space-y-3 font-mono">
						{#each data.fishboneCategories as cat}
							{@const maxCount = Math.max(...data.fishboneCategories.map((c: any) => c.count), 1)}
							{@const pct = (cat.count / maxCount) * 100}
							<div class="space-y-1">
								<div class="flex justify-between text-[10px]">
									<span class="text-gray-300 font-medium">{cat.category}</span>
									<span class="text-hud-amber font-bold">{cat.count} causes</span>
								</div>
								<div class="h-3 w-full bg-bg-darker rounded overflow-hidden border border-border-subtle/30">
									<div 
										style="width: {pct}%" 
										class="h-full bg-gradient-to-r from-hud-amber/50 to-hud-amber rounded-r transition-all duration-500"
									></div>
								</div>
							</div>
						{/each}
					</div>
				</div>

				<!-- Top 10 Critical failure modes (2/3 width) -->
				<div class="xl:col-span-2 hud-card p-6 space-y-4">
					<div>
						<h3 class="text-sm font-bold text-white font-mono flex items-center gap-1.5">
							<span class="w-1.5 h-1.5 rounded-full bg-hud-rose"></span>
							Top 10 Active Failure Modes
						</h3>
						<p class="text-[9px] text-gray-500 font-mono mt-0.5">SORTED BY HIGHEST CRITICALITY (SEVERITY × OCCURRENCE)</p>
					</div>

					<div class="overflow-x-auto">
						<table class="w-full text-left font-mono text-[10px] border-collapse min-w-[500px]">
							<thead>
								<tr class="border-b border-border-subtle bg-bg-darker text-gray-400 select-none">
									<th class="p-2 w-8 text-center">#</th>
									<th class="p-2">Workbook</th>
									<th class="p-2">System Component</th>
									<th class="p-2">Failure Mode</th>
									<th class="p-2 text-center text-hud-rose">S</th>
									<th class="p-2 text-center text-hud-amber">O</th>
									<th class="p-2 text-center text-hud-rose">SxO</th>
									<th class="p-2 text-center text-hud-cyan">RPN</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-border-subtle text-gray-300">
								{#each data.topFailureModes as mode, index}
									<tr class="hover:bg-white/[0.01] transition-colors">
										<td class="p-2 text-center text-gray-500 font-semibold">{index + 1}</td>
										<td class="p-2 text-gray-400 max-w-[120px] truncate" title={mode.title}>{mode.title}</td>
										<td class="p-2 font-medium text-white">{mode.item}</td>
										<td class="p-2 text-gray-400">{mode.mode}</td>
										<td class="p-2 text-center text-hud-rose font-bold">{mode.s}</td>
										<td class="p-2 text-center text-hud-amber font-bold">{mode.o}</td>
										<td class="p-2 text-center text-hud-rose font-extrabold">{mode.s * mode.o}</td>
										<td class="p-2 text-center font-bold {mode.rpn >= 250 ? 'text-hud-rose text-shadow-glow' : 'text-gray-400'}">
											{mode.rpn}
										</td>
									</tr>
								{/each}
								{#if data.topFailureModes.length === 0}
									<tr>
										<td colspan="8" class="p-4 text-center text-gray-500 italic">No failure mode data registered in saved FMEA studies.</td>
									</tr>
								{/if}
							</tbody>
						</table>
					</div>
				</div>
			</div>
		{/if}
	</div>
{/if}
