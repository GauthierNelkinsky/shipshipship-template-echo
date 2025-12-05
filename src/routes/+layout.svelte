<script lang="ts">
    import "../app.css";
    import { onMount } from "svelte";
    import { settings, loadSettings } from "$lib/stores/settings";
    import { theme } from "$lib/stores/theme";
    import { themeSettings } from "$lib/stores/themeSettings";
    import { getApiEndpoint } from "$lib/config";
    import { Toaster } from "$lib/components/ui/sonner";
    import ConfigStatus from "$lib/components/ConfigStatus.svelte";
    import type { Snippet } from "svelte";
    import * as m from "$lib/paraglide/messages";
    import { getLocale, setLocale } from "$lib/paraglide/runtime";
    import type { Locale } from "$lib/paraglide/runtime";

    interface Props {
        children?: Snippet;
    }

    let { children }: Props = $props();
    let faviconUrl = $state("");

    // Function to get the complete URL for images that might be relative to the API
    function getCompleteImageUrl(url: string | undefined): string {
        if (!url) return "";

        // If the URL is already absolute (starts with http:// or https://) or is a data URL, return as is
        if (
            url.startsWith("http://") ||
            url.startsWith("https://") ||
            url.startsWith("data:")
        ) {
            return url;
        }

        // If the URL starts with '/api/uploads/', use the API endpoint
        if (url.startsWith("/api/uploads/")) {
            // Remove the '/api' prefix as getApiEndpoint will add it
            const path = url.substring(4);
            return getApiEndpoint(path);
        }

        // For other relative URLs, return as is
        return url;
    }

    function hasUserLocalePreference(): boolean {
        if (typeof document === "undefined") return false;
        const cookies = document.cookie.split(";");
        return cookies.some((cookie) =>
            cookie.trim().startsWith("PARAGLIDE_LOCALE"),
        );
    }

    onMount(async () => {
        // Initialize theme
        theme.init();

        // Load project settings
        await loadSettings();

        // Load theme settings (for translations, feedback display, etc.)
        await themeSettings.load();

        // Initialize default language
        const defaultLang = $themeSettings["default-language"] as Locale;
        if (
            defaultLang &&
            $themeSettings["enable-translations"] &&
            !hasUserLocalePreference()
        ) {
            const currentLocale = getLocale();
            if (currentLocale !== defaultLang) {
                await setLocale(defaultLang, { reload: false });
            }
        }
    });

    // Reactive statement to update favicon when settings change
    $effect(() => {
        faviconUrl = getCompleteImageUrl($settings.favicon_url) || "";
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
    <title>{$settings.title || m.header_default_title()}</title>
    <meta name="description" content={m.page_description()} />
    {#if faviconUrl}
        <link rel="icon" type="image/x-icon" href={faviconUrl} />
    {/if}
</svelte:head>

<div class="min-h-screen bg-background text-foreground">
    {@render children?.()}
    <Toaster />
    <ConfigStatus />
</div>
