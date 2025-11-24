<script lang="ts">
    import "../app.css";
    import { onMount } from "svelte";
    import { settings, loadSettings } from "$lib/stores/settings";
    import { theme } from "$lib/stores/theme";
    import { Toaster } from "$lib/components/ui/sonner";
    import ConfigStatus from "$lib/components/ConfigStatus.svelte";
    import type { Snippet } from "svelte";

    interface Props {
        children?: Snippet;
    }

    let { children }: Props = $props();
    let faviconUrl = $state("");

    onMount(async () => {
        // Initialize theme
        theme.init();

        // Load project settings
        await loadSettings();
    });

    // Reactive statement to update favicon when settings change
    $effect(() => {
        faviconUrl = $settings.favicon_url || "";
        updateFavicon(faviconUrl);
    });

    function updateFavicon(url: string) {
        if (typeof window === "undefined") return;

        // Remove existing favicon links
        const existingLinks = document.querySelectorAll('link[rel*="icon"]');
        existingLinks.forEach((link) => link.remove());

        if (url) {
            // Add new favicon
            const link = document.createElement("link");
            link.rel = "icon";
            link.type = "image/x-icon";
            link.href = url;
            document.head.appendChild(link);
        } else {
            // Fallback to default favicon.ico
            const link = document.createElement("link");
            link.rel = "icon";
            link.type = "image/x-icon";
            link.href = "/favicon.ico";
            document.head.appendChild(link);
        }
    }
</script>

<svelte:head>
    <title>{$settings.title || "Ideas"}</title>
    <meta name="description" content="Submit and explore ideas" />
    {#if faviconUrl}
        <link rel="icon" type="image/x-icon" href={faviconUrl} />
    {/if}
</svelte:head>

<div class="min-h-screen bg-background text-foreground">
    {@render children?.()}
    <Toaster />
    <ConfigStatus />
</div>
