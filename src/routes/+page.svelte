<script lang="ts">
    import { onMount } from "svelte";
    import { api } from "$lib/api";
    import type { Event, Tag } from "$lib/types";
    import { parseEvent, markdownToHtml, formatDate } from "$lib/utils";
    import Header from "$lib/components/Header.svelte";
    import Footer from "$lib/components/Footer.svelte";
    import ReactionPicker from "$lib/components/ReactionPicker.svelte";
    import Badge from "$lib/components/ui/badge.svelte";
    import Input from "$lib/components/ui/input.svelte";
    import Textarea from "$lib/components/ui/textarea.svelte";
    import {
        Search,
        Plus,
        X,
        Clock,
        TrendingUp,
        Filter as FilterIcon,
        List,
        LayoutGrid,
        Tag as TagIcon,
    } from "lucide-svelte";

    // Data state
    let posts = $state<Event[]>([]);
    let loading = $state(true);
    let error = $state("");

    // Filter state
    let searchQuery = $state("");
    let selectedTags = $state<number[]>([]);
    let availableTags = $state<Tag[]>([]);
    let sortBy = $state<"newest" | "popular" | "oldest">("newest");
    let showTagsPopover = $state(false);
    let viewMode = $state<"list" | "kanban">("list");
    let filterPopoverRef = $state<HTMLDivElement | null>(null);

    // Theme settings
    let displayFeedbackPublicly = $state(true);

    // Modal state
    let showModal = $state(false);
    let postTitle = $state("");
    let postDescription = $state("");
    let submittingPost = $state(false);
    let postError = $state("");
    let formStartTime = $state(Date.now());

    onMount(async () => {
        await loadThemeSettings();
        await loadPosts();
        await loadTags();

        // Handle click outside to close filter popover
        const handleClickOutside = (event: MouseEvent) => {
            if (
                showTagsPopover &&
                filterPopoverRef &&
                !filterPopoverRef.contains(event.target as Node)
            ) {
                showTagsPopover = false;
            }
        };

        document.addEventListener("click", handleClickOutside);

        return () => {
            document.removeEventListener("click", handleClickOutside);
        };
    });

    async function loadThemeSettings() {
        try {
            const settingsData = await api.getThemeSettings();

            if (settingsData.settings) {
                // Check if settings is an object or array
                if (Array.isArray(settingsData.settings)) {
                    const feedbackSetting = settingsData.settings.find(
                        (s) => s.id === "display-feedback-publicly",
                    );
                    if (feedbackSetting !== undefined) {
                        displayFeedbackPublicly = feedbackSetting.value;
                    }
                } else if (typeof settingsData.settings === "object") {
                    // Settings might be an object with setting IDs as keys
                    if (
                        settingsData.settings["display-feedback-publicly"] !==
                        undefined
                    ) {
                        displayFeedbackPublicly =
                            settingsData.settings["display-feedback-publicly"];
                    }
                }
            }
        } catch (err) {
            // If loading settings fails, use default value (true)
            displayFeedbackPublicly = true;
        }
    }

    async function loadPosts() {
        try {
            loading = true;
            error = "";
            const data = await api.getEventsByCategory();

            // Get all events from the categories
            let allPosts: Event[] = [];
            if (data.categories) {
                // Get events from "displayed-statuses" category
                if (data.categories["displayed-statuses"]) {
                    allPosts = [...data.categories["displayed-statuses"]];
                }

                // Handle feedback category based on displayFeedbackPublicly setting
                if (displayFeedbackPublicly && data.categories["feedback"]) {
                    allPosts = [...allPosts, ...data.categories["feedback"]];
                }
            }

            posts = allPosts;

            // Sort by creation date
            posts = posts.sort(
                (a, b) =>
                    new Date(b.created_at).getTime() -
                    new Date(a.created_at).getTime(),
            );
        } catch (err) {
            error = err instanceof Error ? err.message : "Failed to load posts";
        } finally {
            loading = false;
        }
    }

    async function loadTags() {
        try {
            availableTags = await api.getTags();
        } catch (err) {
            console.error("Failed to load tags:", err);
        }
    }

    // Use $derived to reactively compute filtered posts
    let filteredPosts = $derived.by(() => {
        let result = [...posts];

        // Search filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(
                (post) =>
                    post.title.toLowerCase().includes(query) ||
                    post.content?.toLowerCase().includes(query),
            );
        }

        // Tag filter
        if (selectedTags.length > 0) {
            result = result.filter((post) =>
                post.tags?.some((tag) => selectedTags.includes(tag.id)),
            );
        }

        // Sort
        if (sortBy === "newest") {
            result.sort(
                (a, b) =>
                    new Date(b.created_at).getTime() -
                    new Date(a.created_at).getTime(),
            );
        } else if (sortBy === "popular") {
            result.sort(
                (a, b) =>
                    (b.reaction_summary?.total_count || 0) -
                    (a.reaction_summary?.total_count || 0),
            );
        }

        return result;
    });

    function groupByStatus() {
        const groups: Record<string, Event[]> = {};

        // Dynamically create groups based on actual statuses in the data
        filteredPosts.forEach((post) => {
            const status = post.status || "Uncategorized";
            if (!groups[status]) {
                groups[status] = [];
            }
            groups[status].push(post);
        });

        return groups;
    }

    function toggleTag(tagId: number) {
        if (selectedTags.includes(tagId)) {
            selectedTags = selectedTags.filter((id) => id !== tagId);
        } else {
            selectedTags = [...selectedTags, tagId];
        }
    }

    function clearFilters() {
        searchQuery = "";
        selectedTags = [];
    }

    function openModal() {
        showModal = true;
        postTitle = "";
        postDescription = "";
        postError = "";
        formStartTime = Date.now();
    }

    function closeModal() {
        showModal = false;
    }

    async function submitPost() {
        if (!postTitle.trim()) {
            postError = "Please enter a title";
            return;
        }

        try {
            submittingPost = true;
            postError = "";

            await api.submitFeedback(
                postTitle.trim(),
                postDescription.trim(),
                formStartTime,
            );

            closeModal();
            await loadPosts();
        } catch (err) {
            const errorMessage =
                err instanceof Error ? err.message : "Failed to submit post";
            postError = errorMessage;
        } finally {
            submittingPost = false;
        }
    }
</script>

<svelte:head>
    <title>Posts - Share Your Thoughts</title>
    <meta name="description" content="Submit and explore posts" />
</svelte:head>

<div class="min-h-screen bg-background flex flex-col">
    <Header />

    <div class="flex-1 flex flex-col py-6 gap-4">
        <div
            class="w-full max-w-[1200px] px-4 sm:px-6 lg:px-8 mx-auto sm:w-[70%] flex flex-col gap-4"
        >
            <!-- Filters and Search -->
            <div
                class="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between"
            >
                <!-- Search (Left Side) -->
                <div class="relative w-full sm:w-56">
                    <Search
                        class="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground"
                    />
                    <Input
                        bind:value={searchQuery}
                        placeholder="Search ideas..."
                        class="pl-9 h-9"
                    />
                </div>

                <!-- Filters (Right Side) -->
                <div class="flex flex-wrap items-center gap-2">
                    <!-- Sort -->
                    <div
                        class="inline-flex items-center rounded-md border border-input bg-background h-9"
                    >
                        <button
                            onclick={() => (sortBy = "newest")}
                            class="inline-flex items-center gap-1.5 px-3 h-full text-sm font-medium transition-colors {sortBy ===
                            'newest'
                                ? 'bg-accent text-accent-foreground'
                                : 'hover:bg-accent hover:text-accent-foreground'} rounded-l-md border-r"
                        >
                            <Clock class="h-3.5 w-3.5" />
                            Newest
                        </button>
                        <button
                            onclick={() => (sortBy = "popular")}
                            class="inline-flex items-center gap-1.5 px-3 h-full text-sm font-medium transition-colors {sortBy ===
                            'popular'
                                ? 'bg-accent text-accent-foreground'
                                : 'hover:bg-accent hover:text-accent-foreground'} rounded-r-md"
                        >
                            <TrendingUp class="h-3.5 w-3.5" />
                            Popular
                        </button>
                    </div>

                    <!-- Filter -->
                    <div class="relative" bind:this={filterPopoverRef}>
                        <button
                            onclick={() => (showTagsPopover = !showTagsPopover)}
                            class="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground text-sm font-medium transition-all {selectedTags.length >
                            0
                                ? 'border-primary bg-primary/5'
                                : ''}"
                        >
                            <FilterIcon class="h-3.5 w-3.5" />
                            <span class="hidden sm:inline">Filter</span>
                            {#if selectedTags.length > 0}
                                <span
                                    class="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold"
                                >
                                    {selectedTags.length}
                                </span>
                            {/if}
                        </button>

                        {#if showTagsPopover}
                            <div
                                class="absolute top-full mt-2 left-0 w-56 rounded-lg border border-border bg-popover shadow-lg z-50 overflow-hidden"
                            >
                                <div
                                    class="flex items-center justify-between px-3 py-2 border-b border-border/50 bg-muted/30"
                                >
                                    <p
                                        class="text-xs font-semibold text-foreground flex items-center gap-1.5"
                                    >
                                        <TagIcon class="h-3 w-3" />
                                        Filter by tags
                                    </p>
                                    {#if selectedTags.length > 0}
                                        <button
                                            onclick={clearFilters}
                                            class="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                                        >
                                            Clear all
                                        </button>
                                    {/if}
                                </div>
                                <div class="p-1.5 max-h-60 overflow-y-auto">
                                    {#if availableTags.length === 0}
                                        <p
                                            class="text-xs text-muted-foreground py-8 text-center"
                                        >
                                            No tags available
                                        </p>
                                    {:else}
                                        <div class="space-y-0.5">
                                            {#each availableTags as tag}
                                                <button
                                                    onclick={() =>
                                                        toggleTag(tag.id)}
                                                    class="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md hover:bg-accent text-xs transition-colors {selectedTags.includes(
                                                        tag.id,
                                                    )
                                                        ? 'bg-accent/50'
                                                        : ''}"
                                                >
                                                    <span
                                                        class="text-foreground font-medium"
                                                        >{tag.name}</span
                                                    >
                                                    {#if selectedTags.includes(tag.id)}
                                                        <svg
                                                            class="h-3.5 w-3.5 text-primary"
                                                            fill="none"
                                                            viewBox="0 0 24 24"
                                                            stroke="currentColor"
                                                            stroke-width="2.5"
                                                        >
                                                            <path
                                                                stroke-linecap="round"
                                                                stroke-linejoin="round"
                                                                d="M5 13l4 4L19 7"
                                                            />
                                                        </svg>
                                                    {/if}
                                                </button>
                                            {/each}
                                        </div>
                                    {/if}
                                </div>
                            </div>
                        {/if}
                    </div>

                    <!-- View Toggle -->
                    <button
                        onclick={() =>
                            (viewMode =
                                viewMode === "list" ? "kanban" : "list")}
                        class="inline-flex items-center justify-center gap-2 h-9 px-3 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground text-sm font-medium transition-colors"
                    >
                        {#if viewMode === "list"}
                            <LayoutGrid class="h-4 w-4" />
                        {:else}
                            <List class="h-4 w-4" />
                        {/if}
                    </button>

                    <!-- New Post -->
                    <button
                        onclick={openModal}
                        class="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium transition-colors"
                    >
                        <Plus class="h-4 w-4" />
                        New Post
                    </button>
                </div>
            </div>

            <!-- Separator -->
            <div class="border-t border-border"></div>

            <!-- Content -->
            {#if loading}
                <div class="flex items-center justify-center min-h-[60vh]">
                    <div
                        class="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full"
                    ></div>
                </div>
            {:else if error}
                <div class="max-w-2xl mx-auto text-center py-16">
                    <div
                        class="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive font-medium"
                    >
                        <p class="text-destructive text-sm font-medium">
                            {error}
                        </p>
                    </div>
                </div>
            {:else if filteredPosts.length === 0}
                <div class="text-center py-24 max-w-md mx-auto">
                    <div
                        class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-3"
                    >
                        <Search class="h-5 w-5 text-muted-foreground" />
                    </div>
                    <h3 class="text-base font-semibold mb-1.5">
                        No posts found
                    </h3>
                    <p class="text-sm text-muted-foreground mb-4">
                        {searchQuery || selectedTags.length > 0
                            ? "Try adjusting your filters or search query"
                            : "No posts have been submitted yet"}
                    </p>
                    {#if searchQuery || selectedTags.length > 0}
                        <button
                            onclick={clearFilters}
                            class="text-sm font-medium text-primary hover:underline"
                        >
                            Clear filters
                        </button>
                    {/if}
                </div>
            {:else if viewMode === "list"}
                <!-- List View -->
                <div class="space-y-3">
                    {#each filteredPosts as post}
                        {@const parsedPost = parseEvent(post)}
                        <article
                            class="relative bg-card border border-border rounded-lg p-4 hover:shadow-sm hover:border-border/80 transition-all group"
                        >
                            {#if post.status}
                                <span
                                    class="absolute top-3 right-3 px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 font-bold uppercase text-[10px] tracking-wider"
                                >
                                    {post.status}
                                </span>
                            {/if}
                            <div class="flex flex-col">
                                <!-- Content -->
                                <div class="flex-1 min-w-0">
                                    <!-- Header -->
                                    <div class="mb-2">
                                        <h3
                                            class="font-semibold text-base mb-1.5 leading-tight"
                                        >
                                            {post.title}
                                        </h3>
                                        {#if post.date}
                                            <time
                                                class="text-xs text-muted-foreground font-medium"
                                            >
                                                {formatDate(post.date)}
                                            </time>
                                        {/if}
                                    </div>

                                    <!-- Tags -->
                                    {#if post.tags && Array.isArray(post.tags) && post.tags.length > 0}
                                        <div class="flex flex-wrap gap-1 mb-2">
                                            {#each post.tags as tag}
                                                <Badge
                                                    variant="secondary"
                                                    class="text-xs"
                                                    style="background-color: {tag.color}20; color: {tag.color};"
                                                >
                                                    {tag.name}
                                                </Badge>
                                            {/each}
                                        </div>
                                    {/if}

                                    <!-- Content -->
                                    {#if post.content}
                                        <div
                                            class="prose prose-sm max-w-none text-muted-foreground line-clamp-3 mb-2"
                                        >
                                            {@html markdownToHtml(post.content)}
                                        </div>
                                    {/if}

                                    <!-- Media -->
                                    {#if parsedPost.media.length > 0}
                                        <div class="mb-2">
                                            <img
                                                src={parsedPost.media[0]}
                                                alt={post.title}
                                                class="w-full max-w-2xl h-auto object-cover rounded-md"
                                            />
                                        </div>
                                    {/if}

                                    <!-- Footer -->
                                    <div
                                        class="flex items-center justify-between text-xs text-muted-foreground pt-2 mt-2 border-t border-border"
                                    >
                                        <span>
                                            Posted on {new Date(
                                                post.created_at,
                                            ).toLocaleDateString("en-US", {
                                                year: "numeric",
                                                month: "long",
                                                day: "numeric",
                                            })}
                                        </span>
                                        <!-- Reactions (Bottom Right) -->
                                        <div class="flex-shrink-0">
                                            <ReactionPicker
                                                eventId={post.id}
                                                variant="popover"
                                                size="sm"
                                                initialReactions={post.reaction_summary}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </article>
                    {/each}
                </div>
            {/if}
        </div>

        <!-- Kanban Full Width Container -->
        {#if viewMode === "kanban" && !loading && !error && filteredPosts.length > 0}
            {@const groupedPosts = groupByStatus()}
            <div
                class="overflow-x-auto h-[calc(100svh-150px)] w-full px-4 sm:px-6 lg:px-8"
            >
                <div class="flex gap-3 h-full min-w-max pb-4">
                    {#each Object.entries(groupedPosts) as [status, statusPosts]}
                        <div class="flex-shrink-0 w-72 h-full flex flex-col">
                            <div
                                class="bg-muted/30 border border-border rounded-lg h-full flex flex-col"
                            >
                                <div
                                    class="px-3 py-2 border-b border-border flex items-center justify-between bg-muted/50"
                                >
                                    <h3
                                        class="font-semibold text-xs uppercase tracking-wide text-foreground"
                                    >
                                        {status}
                                    </h3>
                                    <span
                                        class="px-1.5 py-0.5 rounded text-xs bg-muted text-muted-foreground font-medium"
                                    >
                                        {statusPosts.length}
                                    </span>
                                </div>
                                <div
                                    class="p-2 space-y-2 overflow-y-auto flex-1"
                                >
                                    {#each statusPosts as post}
                                        {@const parsedPost = parseEvent(post)}
                                        <article
                                            class="bg-card rounded-md border border-border p-2 hover:shadow-sm hover:border-border/80 transition-all"
                                        >
                                            <div class="flex flex-col gap-2">
                                                <div class="flex-1">
                                                    <h4
                                                        class="font-semibold text-sm mb-1 leading-tight"
                                                    >
                                                        {post.title}
                                                    </h4>
                                                    {#if post.date}
                                                        <time
                                                            class="text-xs text-muted-foreground font-medium"
                                                        >
                                                            {formatDate(
                                                                post.date,
                                                            )}
                                                        </time>
                                                    {/if}
                                                </div>

                                                <!-- Tags -->
                                                {#if post.tags && Array.isArray(post.tags) && post.tags.length > 0}
                                                    <div
                                                        class="flex flex-wrap gap-1"
                                                    >
                                                        {#each post.tags as tag}
                                                            <Badge
                                                                variant="secondary"
                                                                class="text-xs"
                                                                style="background-color: {tag.color}20; color: {tag.color};"
                                                            >
                                                                {tag.name}
                                                            </Badge>
                                                        {/each}
                                                    </div>
                                                {/if}

                                                {#if post.content}
                                                    <div
                                                        class="prose prose-sm dark:prose-invert text-xs text-muted-foreground/80 line-clamp-2"
                                                    >
                                                        {@html markdownToHtml(
                                                            post.content,
                                                        )}
                                                    </div>
                                                {/if}

                                                <!-- Reactions (Bottom Right) -->
                                                <div
                                                    class="flex justify-end pt-1 border-t border-border/50"
                                                >
                                                    <ReactionPicker
                                                        eventId={post.id}
                                                        variant="popover"
                                                        size="sm"
                                                        initialReactions={post.reaction_summary}
                                                    />
                                                </div>
                                            </div>
                                        </article>
                                    {/each}

                                    {#if statusPosts.length === 0}
                                        <p
                                            class="text-xs text-muted-foreground text-center py-8"
                                        >
                                            No posts
                                        </p>
                                    {/if}
                                </div>
                            </div>
                        </div>
                    {/each}
                </div>
            </div>
        {/if}
    </div>

    <Footer />
</div>

<!-- Modal -->
{#if showModal}
    <div
        class="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
        onclick={closeModal}
    >
        <div
            class="bg-background border border-border rounded-lg shadow-lg w-full max-w-lg"
            onclick={(e) => e.stopPropagation()}
        >
            <!-- Header -->
            <div
                class="flex items-center justify-between px-5 py-4 border-b border-border"
            >
                <h2 class="text-lg font-semibold">New Post</h2>
                <button
                    onclick={closeModal}
                    class="h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                    <X class="h-4 w-4" />
                </button>
            </div>

            <form
                onsubmit={(e) => {
                    e.preventDefault();
                    submitPost();
                }}
                class="p-5 space-y-4"
            >
                {#if postError}
                    <div
                        class="p-2.5 bg-destructive/10 border border-destructive/20 rounded-md text-xs text-destructive font-medium"
                    >
                        {postError}
                    </div>
                {/if}

                <div class="space-y-1.5">
                    <label
                        for="post-title"
                        class="text-sm font-medium text-foreground"
                    >
                        Title
                    </label>
                    <Input
                        id="post-title"
                        bind:value={postTitle}
                        placeholder="What's on your mind?"
                        class="h-10"
                        required
                    />
                </div>

                <div class="space-y-1.5">
                    <label
                        for="post-description"
                        class="text-sm font-medium text-foreground"
                    >
                        Description
                    </label>
                    <Textarea
                        id="post-description"
                        bind:value={postDescription}
                        placeholder="Provide more details..."
                        class="resize-none"
                        rows={4}
                    />
                </div>

                <div class="flex justify-end gap-2 pt-2">
                    <button
                        type="button"
                        onclick={closeModal}
                        class="px-4 h-9 inline-flex items-center justify-center rounded-md border border-input hover:bg-accent text-sm font-medium transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={submittingPost}
                        class="px-4 h-9 inline-flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {#if submittingPost}
                            <div
                                class="h-3.5 w-3.5 animate-spin border-2 border-primary-foreground border-t-transparent rounded-full"
                            ></div>
                            Submitting...
                        {:else}
                            Submit
                        {/if}
                    </button>
                </div>
            </form>
        </div>
    </div>
{/if}

<style>
    .line-clamp-2 {
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }

    .line-clamp-3 {
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }
</style>
