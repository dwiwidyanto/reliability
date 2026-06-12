<script lang="ts">
	import FishboneBuilder from '$lib/components/FishboneBuilder.svelte';
	import { page } from '$app/state';

	const id = $derived(page.params.id);
</script>

<svelte:head>
	<title>Edit Ishikawa Diagram - AeroReliability</title>
</svelte:head>

{#if id}
	<FishboneBuilder analysisId={id} />
{/if}
