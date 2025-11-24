<script lang="ts">
    import { onMount } from "svelte";
    import { api } from "$lib/api";
    import type { Event, Tag } from "$lib/types";
    import { parseEvent, markdownToHtml, formatDate } from "$lib/utils";
    import Header from "$lib/components/Header.svelte";
    import Footer from "$lib/components/Footer.svelte";
    import Badge from "$lib/components/ui/badge.svelte";
    import Input from "$lib/components/ui/input.svelte";
    import Textarea from "$lib/components/ui/textarea.svelte";
    import {
        ThumbsUp,
        Search,
        Plus,
        X,
        Clock,
        TrendingUp,
        Filter as FilterIcon,
        List,
        LayoutGrid,
    } from "lucide-svelte";

    // Data state
    let ideas = $state<Event[]>([]);
    let filteredIdeas = $state<Event[]>([]);
    let loading = $state(true);
    let error = $state("");

    // Filter state
    let searchQuery = $state("");
    let selectedTags = $state<number[]>([]);
    let availableTags = $state<Tag[]>([]);
    let sortBy = $state<"newest" | "popular" | "oldest">("newest");
    let showTagsPopover = $state(false);
    let viewMode = $state<"list" | "kanban">("list");

    // Vote state
    let votedIdeas = $state(new Set<number>());
    let voteErrors = $state<Record<number, string>>({});

    // Modal state
    let showModal = $state(false);
    let ideaTitle = $state("");
    let ideaDescription = $state("");
    let selectedTagIds = $state<number[]>([]);
    let submittingIdea = $state(false);
    let ideaError = $state("");

    onMount(async () => {
        await loadIdeas();
        await loadTags();
        loadVotedIdeasFromStorage();
    });

    async function loadIdeas() {
        try {
            loading = true;
            error = "";
            const data = await api.getEventsByCategory();

            // Combine all categorized events into one array dynamically
            ideas = Object.values(data.categories)
                .flat()
                .filter((e) => e && e.id);

            // Sort by creation date
            ideas = ideas.sort(
                (a, b) =>
                    new Date(b.created_at).getTime() -
                    new Date(a.created_at).getTime(),
            );
            applyFilters();
        } catch (err) {
            error = err instanceof Error ? err.message : "Failed to load ideas";
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

    function loadVotedIdeasFromStorage() {
        try {
            const stored = localStorage.getItem("votedIdeas");
            if (stored) {
                const data = JSON.parse(stored);
                votedIdeas = new Set(data);
            }
        } catch (err) {
            console.error("Failed to load voted ideas from storage:", err);
        }
    }

    function saveVotedIdeasToStorage() {
        try {
            localStorage.setItem(
                "votedIdeas",
                JSON.stringify(Array.from(votedIdeas)),
            );
        } catch (err) {
            console.error("Failed to save voted ideas:", err);
        }
    }

    async function handleVote(ideaId: number) {
        try {
            const result = await api.voteEvent(ideaId);

            if (votedIdeas.has(ideaId)) {
                votedIdeas.delete(ideaId);
            } else {
                votedIdeas.add(ideaId);
            }
            saveVotedIdeasToStorage();

            const idea = ideas.find((i) => i.id === ideaId);
            if (idea) {
                idea.votes = result.votes;
            }
            applyFilters();

            delete voteErrors[ideaId];
        } catch (err) {
            const errorMessage =
                err instanceof Error ? err.message : "Failed to vote";
            voteErrors[ideaId] = errorMessage;
            setTimeout(() => {
                delete voteErrors[ideaId];
                voteErrors = { ...voteErrors };
            }, 3000);
        }
    }

    function applyFilters() {
        let result = [...ideas];

        // Search filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(
                (idea) =>
                    idea.title.toLowerCase().includes(query) ||
                    idea.content?.toLowerCase().includes(query),
            );
        }

        // Tag filter
        if (selectedTags.length > 0) {
            result = result.filter((idea) =>
                idea.tags?.some((tag) => selectedTags.includes(tag.id)),
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
            result.sort((a, b) => (b.votes || 0) - (a.votes || 0));
        }

        filteredIdeas = result;
    }

    function groupByStatus() {
        const groups: Record<string, Event[]> = {};

        // Dynamically create groups based on actual statuses in the data
        filteredIdeas.forEach((idea) => {
            const status = idea.status || "Uncategorized";
            if (!groups[status]) {
                groups[status] = [];
            }
            groups[status].push(idea);
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
        applyFilters();
    }

    $effect(() => {
        applyFilters();
    });

    function openModal() {
        showModal = true;
        ideaTitle = "";
        ideaDescription = "";
        selectedTagIds = [];
        ideaError = "";
    }

    function closeModal() {
        showModal = false;
    }

    function toggleTagSelection(tagId: number) {
        if (selectedTagIds.includes(tagId)) {
            selectedTagIds = selectedTagIds.filter((id) => id !== tagId);
        } else {
            selectedTagIds = [...selectedTagIds, tagId];
        }
    }

    async function submitIdea() {
        if (!ideaTitle.trim()) {
            ideaError = "Please enter a title";
            return;
        }

        try {
            submittingIdea = true;
            ideaError = "";

            await api.createEvent({
                title: ideaTitle,
                content: ideaDescription,
                tag_ids: selectedTagIds,
            });

            closeModal();
            await loadIdeas();
        } catch (err) {
            const errorMessage =
                err instanceof Error ? err.message : "Failed to submit idea";
            ideaError = errorMessage;
        } finally {
            submittingIdea = false;
        }
    }
</script>

<svelte:head>
    <title>Ideas - Share Your Thoughts</title>
    <meta name="description" content="Submit and explore innovative ideas" />
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
                    <div class="relative">
                        <button
                            onclick={() => (showTagsPopover = !showTagsPopover)}
                            class="inline-flex items-center justify-center gap-2 h-9 px-3 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground text-sm font-medium transition-colors {selectedTags.length >
                            0
                                ? 'border-primary'
                                : ''}"
                        >
                            <FilterIcon class="h-4 w-4" />
                            Filter
                            {#if selectedTags.length > 0}
                                <span
                                    class="ml-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold"
                                >
                                    {selectedTags.length}
                                </span>
                            {/if}
                        </button>

                        {#if showTagsPopover}
                            <div
                                class="absolute top-full mt-1 left-0 w-64 rounded-md border border-border bg-popover shadow-md z-50"
                            >
                                <div
                                    class="flex items-center justify-between px-3 py-2 border-b"
                                >
                                    <p class="text-sm font-medium">
                                        Filter by tags
                                    </p>
                                    {#if selectedTags.length > 0}
                                        <button
                                            onclick={clearFilters}
                                            class="text-xs text-muted-foreground hover:text-foreground"
                                        >
                                            Clear
                                        </button>
                                    {/if}
                                </div>
                                <div class="p-2 max-h-64 overflow-y-auto">
                                    {#if availableTags.length === 0}
                                        <p
                                            class="text-sm text-muted-foreground py-6 text-center"
                                        >
                                            No tags available
                                        </p>
                                    {:else}
                                        <div class="space-y-1">
                                            {#each availableTags as tag}
                                                <button
                                                    onclick={() =>
                                                        toggleTag(tag.id)}
                                                    class="w-full flex items-center justify-between px-2 py-2 rounded-sm hover:bg-accent text-sm transition-colors {selectedTags.includes(
                                                        tag.id,
                                                    )
                                                        ? 'bg-accent'
                                                        : ''}"
                                                >
                                                    <span
                                                        class="text-foreground"
                                                        >{tag.name}</span
                                                    >
                                                    {#if selectedTags.includes(tag.id)}
                                                        <svg
                                                            class="h-4 w-4 text-primary"
                                                            fill="none"
                                                            viewBox="0 0 24 24"
                                                            stroke="currentColor"
                                                            stroke-width="2"
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

                    <!-- New Idea -->
                    <button
                        onclick={openModal}
                        class="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium transition-colors"
                    >
                        <Plus class="h-4 w-4" />
                        New Idea
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
                        class="bg-destructive/10 border border-destructive/20 rounded-lg p-8"
                    >
                        <p class="text-destructive text-sm font-medium">
                            Error loading ideas: {error}
                        </p>
                    </div>
                </div>
            {:else if filteredIdeas.length === 0}
                <div class="text-center py-24 max-w-md mx-auto">
                    <div
                        class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-3"
                    >
                        <Search class="h-5 w-5 text-muted-foreground" />
                    </div>
                    <h3 class="text-base font-semibold mb-1.5">
                        No ideas found
                    </h3>
                    <p class="text-sm text-muted-foreground mb-4">
                        {searchQuery || selectedTags.length > 0
                            ? "Try adjusting your filters or search query"
                            : "No ideas have been submitted yet"}
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
                <!-- Ideas List -->
                <div class="space-y-3">
                    {#each filteredIdeas as idea}
                        {@const parsedIdea = parseEvent(idea)}
                        <article
                            class="relative bg-card border border-border rounded-lg p-4 hover:shadow-sm hover:border-border/80 transition-all group"
                        >
                            {#if idea.status}
                                <span
                                    class="absolute top-3 right-3 px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 font-bold uppercase text-[10px] tracking-wider"
                                >
                                    {idea.status}
                                </span>
                            {/if}
                            <div class="flex gap-4">
                                <!-- Vote Button (Left Side) -->
                                <div class="flex-shrink-0">
                                    <button
                                        onclick={() => handleVote(idea.id)}
                                        class="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-md transition-all {votedIdeas.has(
                                            idea.id,
                                        )
                                            ? 'bg-primary text-primary-foreground shadow-sm'
                                            : 'bg-muted text-muted-foreground hover:bg-muted/80'}"
                                        title={votedIdeas.has(idea.id)
                                            ? "Remove vote"
                                            : "Vote for this idea"}
                                    >
                                        <ThumbsUp class="h-3.5 w-3.5" />
                                        <span class="text-xs font-medium"
                                            >{idea.votes || 0}</span
                                        >
                                    </button>
                                </div>

                                <!-- Content (Right Side) -->
                                <div class="flex-1 min-w-0">
                                    <!-- Header -->
                                    <div class="mb-2">
                                        <h3
                                            class="font-semibold text-base mb-1.5 leading-tight"
                                        >
                                            {idea.title}
                                        </h3>
                                        {#if idea.date}
                                            <time
                                                class="text-xs text-muted-foreground font-medium"
                                            >
                                                {formatDate(idea.date)}
                                            </time>
                                        {/if}
                                    </div>

                                    {#if voteErrors[idea.id]}
                                        <div
                                            class="mb-2 p-2 bg-destructive/10 border border-destructive/20 rounded text-xs text-destructive"
                                        >
                                            {voteErrors[idea.id]}
                                        </div>
                                    {/if}

                                    <!-- Tags -->
                                    {#if idea.tags && Array.isArray(idea.tags) && idea.tags.length > 0}
                                        <div class="flex flex-wrap gap-1 mb-2">
                                            {#each idea.tags as tag}
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
                                    {#if idea.content}
                                        <div
                                            class="prose prose-sm dark:prose-invert mb-3 text-muted-foreground text-sm"
                                        >
                                            {@html markdownToHtml(idea.content)}
                                        </div>
                                    {/if}

                                    <!-- Media -->
                                    {#if parsedIdea.media.length > 0}
                                        <div class="mb-2">
                                            <img
                                                src={parsedIdea.media[0]}
                                                alt={idea.title}
                                                class="w-full max-w-2xl h-auto object-cover rounded-md"
                                            />
                                        </div>
                                    {/if}

                                    <!-- Footer -->
                                    <div
                                        class="flex items-center text-xs text-muted-foreground pt-2 mt-2 border-t border-border"
                                    >
                                        <span>
                                            Posted on {new Date(
                                                idea.created_at,
                                            ).toLocaleDateString("en-US", {
                                                year: "numeric",
                                                month: "long",
                                                day: "numeric",
                                            })}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </article>
                    {/each}
                </div>
            {/if}
        </div>

        <!-- Kanban Full Width Container -->
        {#if viewMode === "kanban" && !loading && !error && filteredIdeas.length > 0}
            {@const groupedIdeas = groupByStatus()}
            <div
                class="overflow-x-auto h-[calc(100svh-150px)] w-full px-4 sm:px-6 lg:px-8"
            >
                <div class="flex gap-3 h-full min-w-max pb-4">
                    {#each Object.entries(groupedIdeas) as [status, statusIdeas]}
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
                                        class="text-xs font-semibold text-muted-foreground bg-background px-1.5 py-0.5 rounded"
                                    >
                                        {statusIdeas.length}
                                    </span>
                                </div>
                                <div
                                    class="p-2 space-y-2 overflow-y-auto flex-1"
                                >
                                    {#each statusIdeas as idea}
                                        {@const parsedIdea = parseEvent(idea)}
                                        <article
                                            class="bg-card rounded-md border border-border p-2 hover:shadow-sm hover:border-border/80 transition-all"
                                        >
                                            <div
                                                class="flex items-start gap-2 mb-1.5"
                                            >
                                                <button
                                                    onclick={() =>
                                                        handleVote(idea.id)}
                                                    class="flex-shrink-0 flex flex-col items-center gap-0.5 px-1.5 py-1 rounded-md transition-all {votedIdeas.has(
                                                        idea.id,
                                                    )
                                                        ? 'bg-primary text-primary-foreground shadow-sm'
                                                        : 'bg-muted text-muted-foreground hover:bg-muted/80'}"
                                                >
                                                    <ThumbsUp class="h-3 w-3" />
                                                    <span
                                                        class="text-[10px] font-bold"
                                                        >{idea.votes || 0}</span
                                                    >
                                                </button>
                                                <div class="flex-1 min-w-0">
                                                    <h4
                                                        class="font-semibold text-sm mb-1 leading-tight"
                                                    >
                                                        {idea.title}
                                                    </h4>
                                                    {#if idea.date}
                                                        <time
                                                            class="text-xs text-muted-foreground font-medium"
                                                        >
                                                            {formatDate(
                                                                idea.date,
                                                            )}
                                                        </time>
                                                    {/if}
                                                </div>
                                            </div>

                                            {#if idea.tags && Array.isArray(idea.tags) && idea.tags.length > 0}
                                                <div
                                                    class="flex flex-wrap gap-1 mb-1.5"
                                                >
                                                    {#each idea.tags as tag}
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

                                            {#if idea.content}
                                                <div
                                                    class="prose prose-sm dark:prose-invert text-xs text-muted-foreground/80 line-clamp-2"
                                                >
                                                    {@html markdownToHtml(
                                                        idea.content,
                                                    )}
                                                </div>
                                            {/if}
                                        </article>
                                    {/each}

                                    {#if statusIdeas.length === 0}
                                        <p
                                            class="text-xs text-muted-foreground text-center py-8"
                                        >
                                            No items
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
                <h2 class="text-lg font-semibold">New Idea</h2>
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
                    submitIdea();
                }}
                class="p-5 space-y-4"
            >
                {#if ideaError}
                    <div
                        class="p-2.5 bg-destructive/10 border border-destructive/20 rounded-md text-xs text-destructive font-medium"
                    >
                        {ideaError}
                    </div>
                {/if}

                <div class="space-y-1.5">
                    <label
                        for="idea-title"
                        class="text-sm font-medium text-foreground"
                    >
                        Title
                    </label>
                    <Input
                        id="idea-title"
                        bind:value={ideaTitle}
                        placeholder="What's your idea?"
                        class="h-10"
                        required
                    />
                </div>

                <div class="space-y-1.5">
                    <label
                        for="idea-description"
                        class="text-sm font-medium text-foreground"
                    >
                        Description
                    </label>
                    <Textarea
                        id="idea-description"
                        bind:value={ideaDescription}
                        placeholder="Provide more details..."
                        class="resize-none"
                        rows={4}
                    />
                </div>

                {#if availableTags.length > 0}
                    <div class="space-y-1.5">
                        <label class="text-sm font-medium text-foreground">
                            Tags <span class="text-muted-foreground font-normal"
                                >(optional)</span
                            >
                        </label>
                        <div class="flex flex-wrap gap-1.5">
                            {#each availableTags as tag}
                                <button
                                    type="button"
                                    onclick={() => toggleTagSelection(tag.id)}
                                    class="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium transition-colors {selectedTagIds.includes(
                                        tag.id,
                                    )
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-muted text-muted-foreground hover:bg-muted/80'}"
                                >
                                    {tag.name}
                                </button>
                            {/each}
                        </div>
                    </div>
                {/if}

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
                        disabled={submittingIdea}
                        class="px-4 h-9 inline-flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {#if submittingIdea}
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
