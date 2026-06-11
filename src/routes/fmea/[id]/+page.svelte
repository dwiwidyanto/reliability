<script lang="ts">
	import FmeaBuilder from '$lib/components/FmeaBuilder.svelte';
	import { page } from '$app/state';

	const id = $derived(page.params.id);
</script>

<svelte:head>
	<title>Edit FMEA Worksheet - AeroReliability</title>
</svelte:head>

{#if id}
	<FmeaBuilder {id} />
{/if}
